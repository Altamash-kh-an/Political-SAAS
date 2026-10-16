import { useEffect, useState } from "react";
import { adminRequest } from "./services/adminDataService";

const resources = {
  Panchayats: {
    singular: "Panchayat",
    path: "/admin/panchayats",
    fields: [{ name: "name", label: "Panchayat name", maxLength: 150 }],
    columns: [
      { name: "name", label: "Panchayat" },
      { name: "created_at", label: "Added", format: (value) => new Date(value).toLocaleDateString() },
    ],
  },
  "Booth Management": {
    singular: "Booth",
    path: "/admin/booths",
    relatedPath: "/admin/panchayats",
    fields: [
      { name: "panchayat_id", label: "Panchayat", type: "panchayat" },
      { name: "booth_number", label: "Booth number", maxLength: 32 },
      { name: "name", label: "Booth name", maxLength: 150 },
      { name: "address", label: "Address", type: "textarea", maxLength: 2000 },
    ],
    columns: [
      { name: "booth_number", label: "Number" },
      { name: "name", label: "Booth" },
      { name: "address", label: "Address" },
      { name: "panchayat_name", label: "Panchayat" },
    ],
  },
  "Voter Insights": {
    singular: "Voter",
    path: "/admin/voters",
    relatedPath: "/admin/booths",
    fields: [
      { name: "booth_id", label: "Booth", type: "booth" },
      { name: "electoral_roll_id", label: "Electoral roll ID", minLength: 1, maxLength: 64 },
      { name: "name", label: "Voter name", minLength: 2, maxLength: 150 },
    ],
    columns: [
      { name: "name", label: "Voter" },
      { name: "electoral_roll_id", label: "Electoral roll ID" },
      { name: "booth_number", label: "Booth number" },
      { name: "booth_name", label: "Booth" },
      { name: "panchayat_name", label: "Panchayat" },
    ],
  },
};

function AdminDataManagement({ page, accessToken, search, onRecordsChanged }) {
  const resource = resources[page];
  const [records, setRecords] = useState([]);
  const [relatedRecords, setRelatedRecords] = useState([]);
  const [formValues, setFormValues] = useState({});
  const [editingRecord, setEditingRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadRecords() {
      setIsLoading(true);
      setError("");
      try {
        const results = await Promise.allSettled([
          adminRequest(resource.path, accessToken),
          resource.relatedPath
            ? adminRequest(resource.relatedPath, accessToken)
            : Promise.resolve([]),
        ]);
        if (active) {
          const [recordsResult, relatedRecordsResult] = results;
          const loadErrors = [];
          if (recordsResult.status === "fulfilled") {
            setRecords(recordsResult.value);
          } else {
            loadErrors.push(recordsResult.reason.message);
          }
          if (relatedRecordsResult.status === "fulfilled") {
            setRelatedRecords(relatedRecordsResult.value);
          } else {
            loadErrors.push(relatedRecordsResult.reason.message);
          }
          setError(loadErrors.join(" "));
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadRecords();
    return () => {
      active = false;
    };
  }, [accessToken, resource]);

  const visibleRecords = records.filter((record) => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    if (!normalizedSearch) return true;
    return resource.columns.some(({ name }) =>
      String(record[name] ?? "").toLocaleLowerCase().includes(normalizedSearch)
    );
  });

  function clearForm() {
    setFormValues({});
    setEditingRecord(null);
  }

  function startEditing(record) {
    setEditingRecord(record);
    setFormValues(
      Object.fromEntries(resource.fields.map(({ name }) => [name, String(record[name] ?? "")]))
    );
    setError("");
  }

  async function submitForm(event) {
    event.preventDefault();
    if (isSaving) return;
    const payload = Object.fromEntries(
      Object.entries(formValues).map(([name, value]) => [
        name,
        ["panchayat_id", "booth_id"].includes(name) ? Number(value) : value.trim(),
      ])
    );
    const invalidField = resource.fields.find(({ name, minLength, maxLength }) => {
      const value = payload[name];
      if (["panchayat_id", "booth_id"].includes(name)) {
        return !Number.isSafeInteger(value) || value < 1;
      }
      return (
        typeof value !== "string" ||
        value.length < (minLength ?? 1) ||
        value.length > maxLength
      );
    });
    if (invalidField) {
      setError(["panchayat_id", "booth_id"].includes(invalidField.name)
        ? `Select a valid ${invalidField.label.toLowerCase()}.`
        : `${invalidField.label} must contain between ${invalidField.minLength ?? 1} and ${invalidField.maxLength} characters.`);
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await adminRequest(
        editingRecord ? `${resource.path}/${editingRecord.id}` : resource.path,
        accessToken,
        {
          method: editingRecord ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        }
      );
      const refreshedRecords = await adminRequest(resource.path, accessToken);
      setRecords(refreshedRecords);
      clearForm();
      await onRecordsChanged();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteRecord(record) {
    const label = record.name || record.booth_number || record.electoral_roll_id;
    if (!window.confirm(`Delete ${resource.singular.toLowerCase()} "${label}"? This cannot be undone.`)) {
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      await adminRequest(`${resource.path}/${record.id}`, accessToken, { method: "DELETE" });
      setRecords(await adminRequest(resource.path, accessToken));
      if (editingRecord?.id === record.id) clearForm();
      await onRecordsChanged();
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setIsSaving(false);
    }
  }

  const title = resource.singular === "Panchayat" ? "Panchayats" : `${resource.singular} management`;

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMIN DATA MANAGEMENT</div>
          <h1>{title}</h1>
          <p>
            Manage verified {resource.singular.toLowerCase()} records stored in your database.
            {page === "Voter Insights" && " Voter records are visible only to authenticated Admins."}
          </p>
        </div>
        <span className="sample-badge admin-live-badge"><span /> ADMIN ONLY</span>
      </div>

      <section className="panel workspace-panel admin-management-panel">
        <div className="section-title">
          <div>
            <div className="eyebrow">{records.length} DATABASE RECORD{records.length === 1 ? "" : "S"}</div>
            <h2>{editingRecord ? `Edit ${resource.singular}` : `Add ${resource.singular}`}</h2>
          </div>
        </div>
        <form className="admin-record-form" onSubmit={submitForm}>
          {resource.fields.map((field) => (
            <label className="admin-form-field" key={field.name}>
              <span>{field.label}</span>
              {field.type === "textarea" ? (
                <textarea
                  required
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                  value={formValues[field.name] ?? ""}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormValues({ ...formValues, [field.name]: event.target.value })
                  }
                />
              ) : field.type ? (
                <select
                  required
                  value={formValues[field.name] ?? ""}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormValues({ ...formValues, [field.name]: event.target.value })
                  }
                >
                  <option value="">Select {field.label.toLowerCase()}</option>
                  {relatedRecords.map((record) => (
                    <option key={record.id} value={record.id}>
                      {field.type === "panchayat"
                        ? record.name
                        : `${record.booth_number} · ${record.name} · ${record.panchayat_name}`}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  required
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                  value={formValues[field.name] ?? ""}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormValues({ ...formValues, [field.name]: event.target.value })
                  }
                />
              )}
            </label>
          ))}
          <div className="admin-form-actions">
            <button className="button button-primary" type="submit" disabled={isSaving || isLoading}>
              {isSaving ? "Saving..." : editingRecord ? "Save changes" : `Add ${resource.singular}`}
            </button>
            {editingRecord && (
              <button className="button button-secondary" type="button" disabled={isSaving} onClick={clearForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
        {error && <p className="admin-error" role="alert">{error}</p>}
      </section>

      <section className="panel workspace-panel admin-records-panel">
        <div className="section-title">
          <div>
            <div className="eyebrow">DATABASE</div>
            <h2>{resource.singular} records</h2>
          </div>
          <span className="admin-record-count">{numberFormat.format(records.length)}</span>
        </div>
        {isLoading ? (
          <p className="admin-loading" role="status">Loading records...</p>
        ) : visibleRecords.length ? (
          <div className="table-wrap admin-table-wrap">
            <table>
              <thead>
                <tr>
                  {resource.columns.map(({ label }) => <th key={label}>{label}</th>)}
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => (
                  <tr key={record.id}>
                    {resource.columns.map(({ name, format }) => (
                      <td key={name}>{format ? format(record[name]) : record[name]}</td>
                    ))}
                    <td>
                      <div className="admin-row-actions">
                        <button type="button" disabled={isSaving} onClick={() => startEditing(record)}>Edit</button>
                        <button type="button" className="admin-delete-button" disabled={isSaving} onClick={() => deleteRecord(record)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="workspace-empty">
            <strong>{search ? "No matching records" : `No ${resource.singular.toLowerCase()} records yet`}</strong>
            <p>{search ? "Try a different search term." : "New records will be saved to your database and remain available after restarting the app."}</p>
          </div>
        )}
      </section>
    </>
  );
}

const numberFormat = new Intl.NumberFormat();

export default AdminDataManagement;
