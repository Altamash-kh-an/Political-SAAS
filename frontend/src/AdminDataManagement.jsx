import { useEffect, useRef, useState } from "react";
import { adminRequest } from "./services/adminDataService";
import BlockHierarchy from "./BlockHierarchy";
import { getBlockDisplayName, sortBlocks } from "./blockHierarchyUtils";

const resources = {
  Panchayats: {
    singular: "Panchayat",
    path: "/admin/panchayats",
    relatedPath: "/admin/blocks",
    fields: [
      { name: "name", label: "Panchayat name", maxLength: 150 },
      { name: "block_id", label: "Block", type: "block", optional: true },
    ],
    columns: [
      { name: "name", label: "Panchayat" },
      {
        name: "block_name",
        label: "Block",
        format: (value, record) => value
          ? record.parent_block_name ? `${record.parent_block_name} · ${value}` : value
          : "Unassigned",
      },
      { name: "created_at", label: "Added", format: (value) => new Date(value).toLocaleDateString() },
    ],
  },
  "Booth Management": {
    singular: "Booth",
    path: "/admin/booths",
    relatedPath: "/admin/panchayats",
    secondaryRelatedPath: "/admin/blocks",
    fields: [
      { name: "block_id", label: "Block", type: "booth-block", optional: true },
      { name: "panchayat_id", label: "Panchayat", type: "panchayat" },
      { name: "booth_number", label: "Booth number", maxLength: 32 },
      { name: "name", label: "Booth name", maxLength: 150 },
      { name: "address", label: "Address", type: "textarea", maxLength: 2000 },
      { name: "village_name", label: "Village / Mohalla / Tola", maxLength: 150, optional: true },
    ],
    columns: [
      { name: "booth_number", label: "Number" },
      { name: "name", label: "Booth" },
      { name: "address", label: "Address" },
      { name: "village_name", label: "Village / Mohalla / Tola" },
      {
        name: "block_name",
        label: "Block",
        format: (value, record) => value
          ? record.parent_block_name ? `${record.parent_block_name} · ${value}` : value
          : "Unassigned",
      },
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
  const [secondaryRelatedRecords, setSecondaryRelatedRecords] = useState([]);
  const [formValues, setFormValues] = useState({});
  const [editingRecord, setEditingRecord] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [importFile, setImportFile] = useState(null);
  const importFileInputRef = useRef(null);
  const [importPreview, setImportPreview] = useState(null);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importNotice, setImportNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function loadRecords() {
      setIsLoading(true);
      setError("");
      setRecords([]);
      setRelatedRecords([]);
      setSecondaryRelatedRecords([]);
      try {
        const relatedPaths = [
          resource.relatedPath,
          resource.secondaryRelatedPath,
        ].filter(Boolean);
        const results = await Promise.allSettled([
          adminRequest(resource.path, accessToken),
          ...relatedPaths.map((path) => adminRequest(path, accessToken)),
        ]);
        if (active) {
          const [recordsResult, ...relatedRecordsResults] = results;
          const loadErrors = [];
          if (recordsResult.status === "fulfilled") {
            setRecords(recordsResult.value);
          } else {
            loadErrors.push(recordsResult.reason.message);
          }
          if (relatedRecordsResults[0]?.status === "fulfilled") {
            setRelatedRecords(relatedRecordsResults[0].value);
          } else if (relatedRecordsResults[0]?.status === "rejected") {
            loadErrors.push(relatedRecordsResults[0].reason.message);
          }
          if (relatedRecordsResults[1]?.status === "fulfilled") {
            setSecondaryRelatedRecords(relatedRecordsResults[1].value);
          } else if (relatedRecordsResults[1]?.status === "rejected") {
            loadErrors.push(relatedRecordsResults[1].reason.message);
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
    const searchableColumns = page === "Panchayats"
      ? [...resource.columns, { name: "parent_block_name" }]
      : resource.columns;
    return searchableColumns.some(({ name }) =>
      String(record[name] ?? "").toLocaleLowerCase().includes(normalizedSearch)
    );
  });
  const relatedBlocksById = new Map(
    (resource.secondaryRelatedPath ? secondaryRelatedRecords : relatedRecords)
      .map((record) => [record.id, record]),
  );
  const blockRecords = resource.secondaryRelatedPath
    ? secondaryRelatedRecords
    : relatedRecords;

  function clearForm() {
    setFormValues({});
    setEditingRecord(null);
  }

  function startEditing(record) {
    setEditingRecord(record);
    setFormValues(
      Object.fromEntries(resource.fields.map(({ name }) => [
        name,
        String(name === "block_id" ? record.block_id ?? "" : record[name] ?? ""),
      ]))
    );
    setError("");
  }

  async function submitForm(event) {
    event.preventDefault();
    if (isSaving) return;
    const payload = Object.fromEntries(
      Object.entries(formValues).map(([name, value]) => [
        name,
        ["panchayat_id", "booth_id", "block_id"].includes(name)
          ? name === "block_id" && value === "" ? null : Number(value)
          : value.trim(),
      ])
    );
    const invalidField = resource.fields.find(({ name, minLength, maxLength, optional }) => {
      const value = payload[name];
      if (name === "block_id" && value === null) return false;
      if (optional && value === "") return false;
      if (["panchayat_id", "booth_id", "block_id"].includes(name)) {
        return !Number.isSafeInteger(value) || value < 1;
      }
      return (
        typeof value !== "string" ||
        value.length < (minLength ?? 1) ||
        value.length > maxLength
      );
    });
    if (invalidField) {
      setError(["panchayat_id", "booth_id", "block_id"].includes(invalidField.name)
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

  async function previewBoothImport(event) {
    event.preventDefault();
    if (!importFile || isPreviewingImport) return;

    setIsPreviewingImport(true);
    setImportError("");
    setImportNotice("");
    setImportPreview(null);
    try {
      const filename = encodeURIComponent(importFile.name);
      const preview = await adminRequest(
        `/admin/booths/import/preview?filename=${filename}`,
        accessToken,
        {
          method: "POST",
          body: importFile,
          headers: { "Content-Type": importFile.type || "application/octet-stream" },
        },
      );
      setImportPreview(preview);
    } catch (previewError) {
      setImportError(previewError.message);
    } finally {
      setIsPreviewingImport(false);
    }
  }

  async function confirmBoothImport() {
    if (!importPreview?.importable || isImporting) return;
    if (!window.confirm(
      `Import all ${importPreview.row_count} booth records? Existing records will not be overwritten.`,
    )) {
      return;
    }

    setIsImporting(true);
    setImportError("");
    setImportNotice("");
    try {
      const result = await adminRequest(
        "/admin/booths/import/confirm",
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({
            confirmed: true,
            rows: importPreview.rows.map((row) => ({
              row_number: row.row_number,
              booth_number: row.booth_number,
              polling_station_name: row.polling_station_name,
              polling_station_address: row.polling_station_address,
              block_name: row.block_name,
              village_name: row.village_name,
              panchayat_name: row.panchayat_name,
            })),
          }),
        },
      );
      setImportNotice(`${result.imported_count} booth records imported.`);
      setImportPreview(null);
      setImportFile(null);
      if (importFileInputRef.current) importFileInputRef.current.value = "";
      try {
        setRecords(await adminRequest(resource.path, accessToken));
        await onRecordsChanged();
      } catch (refreshError) {
        setImportError(
          `Import completed, but the displayed records could not be refreshed: ${refreshError.message}`,
        );
      }
    } catch (confirmationError) {
      setImportError(confirmationError.message);
    } finally {
      setIsImporting(false);
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

      {page === "Booth Management" && (
        <section className="panel workspace-panel admin-management-panel">
          <div className="section-title">
            <div>
              <div className="eyebrow">BULK BOOTH DATA</div>
              <h2>Import from Excel or CSV</h2>
            </div>
          </div>
          <p>
            Upload a file with booth_number, polling_station_name,
            polling_station_address, block_name, village_name, and panchayat_name.
            All rows are checked before any records can be saved. Blocks and Panchayats
            must already exist with the matching relationship; import does not create or
            change either record.
          </p>
          <form className="admin-form-actions" onSubmit={previewBoothImport}>
            <label className="admin-form-field">
              <span>Excel or CSV file</span>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx,.csv"
                disabled={isPreviewingImport || isImporting}
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] ?? null);
                  setImportPreview(null);
                  setImportError("");
                  setImportNotice("");
                }}
              />
            </label>
            <button
              className="button button-primary"
              type="submit"
              disabled={!importFile || isPreviewingImport || isImporting}
            >
              {isPreviewingImport ? "Validating..." : "Preview all rows"}
            </button>
          </form>
          {importError && <p className="admin-error" role="alert">{importError}</p>}
          {importNotice && <p role="status">{importNotice}</p>}
          {importPreview && (
            <>
              <p role="status">
                {importPreview.valid_count} valid of {importPreview.row_count} rows;
                {" "}{importPreview.error_count} rows with errors.
              </p>
              <div className="table-wrap admin-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>ROW</th>
                      <th>BOOTH NUMBER</th>
                      <th>POLLING STATION</th>
                      <th>ADDRESS</th>
                      <th>BLOCK</th>
                      <th>VILLAGE / MOHALLA / TOLA</th>
                      <th>PANCHAYAT</th>
                      <th>VALIDATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.rows.map((row) => (
                      <tr key={row.row_number}>
                        <td>{row.row_number}</td>
                        <td>{row.booth_number}</td>
                        <td>{row.polling_station_name}</td>
                        <td>{row.polling_station_address}</td>
                        <td>{row.block_name}</td>
                        <td>{row.village_name}</td>
                        <td>{row.panchayat_name}</td>
                        <td>{row.errors.length ? row.errors.join(" ") : "Ready"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="button button-primary"
                type="button"
                disabled={!importPreview.importable || isImporting || isPreviewingImport}
                onClick={confirmBoothImport}
              >
                {isImporting
                  ? "Importing..."
                  : `Confirm import of ${importPreview.row_count} booths`}
              </button>
            </>
          )}
        </section>
      )}

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
                  required={!field.optional}
                  value={formValues[field.name] ?? ""}
                  disabled={isSaving}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFormValues(
                      field.name === "block_id"
                        ? { ...formValues, block_id: value, panchayat_id: "" }
                        : { ...formValues, [field.name]: value },
                    );
                  }}
                >
                  <option value="">
                    {field.optional ? "Leave unassigned" : `Select ${field.label.toLowerCase()}`}
                  </option>
                  {field.type === "block" || field.type === "booth-block"
                    ? sortBlocks(
                        blockRecords.filter((record) => record.parent_id != null),
                        relatedBlocksById,
                      )
                        .map((record) => (
                          <option key={record.id} value={record.id}>
                            {getBlockDisplayName(record, relatedBlocksById.get(record.parent_id))
                              .toLocaleUpperCase()}
                          </option>
                        ))
                    : relatedRecords
                      .filter((record) =>
                        field.type !== "panchayat" ||
                        !formValues.block_id ||
                        record.block_id === Number(formValues.block_id)
                      )
                      .map((record) => (
                        <option key={record.id} value={record.id}>
                          {field.type === "panchayat"
                            ? record.name
                            : `${record.booth_number} · ${record.name} · ${record.panchayat_name}`}
                        </option>
                      ))}
                </select>
              ) : (
                <input
                  required={!field.optional}
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
        {page === "Panchayats" && (
          <div className="admin-hierarchy-section">
            <div className="section-title">
              <div>
                <div className="eyebrow">DATABASE HIERARCHY</div>
                <h2>Block hierarchy</h2>
              </div>
            </div>
            {isLoading ? (
              <p className="admin-loading" role="status">Loading Block hierarchy...</p>
            ) : error && relatedRecords.length === 0 ? (
              <p className="admin-error" role="alert">{error}</p>
            ) : (
              <BlockHierarchy
                blocks={relatedRecords}
                panchayats={records}
                search={search}
                onEditPanchayat={startEditing}
              />
            )}
          </div>
        )}
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
                      <td key={name}>{format ? format(record[name], record) : record[name]}</td>
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
