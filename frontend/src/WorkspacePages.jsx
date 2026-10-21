import {
  Activity,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  FileText,
  Lightbulb,
  MapPin,
  MessageSquare,
  Sparkles,
  Target,
  Users,
  Vote,
} from "lucide-react";
import { useState } from "react";
import { filterRecordsBySearch, formatRelativeTime } from "./services/dashboardService";
import AdminDataManagement from "./AdminDataManagement";
import {
  configuredBlockPanchayats,
  getBlockDisplayName,
  preferredBlockOrder,
  sortBlocks,
} from "./blockHierarchyUtils";

const activityIcons = {
  report: FileText,
  issue: CircleAlert,
  completed: CheckCircle2,
  meeting: CalendarDays,
};

const numberFormat = new Intl.NumberFormat();
const demoBlockCount = 3;

function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="page-heading-actions">{children}</div>}
    </div>
  );
}

function Panel({ title, eyebrow, action, children, className = "" }) {
  return (
    <section className={`panel workspace-panel ${className}`}>
      <div className="section-title">
        <div>
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ title, children }) {
  return (
    <div className="workspace-empty">
      <div className="workspace-empty-icon"><CircleAlert size={20} /></div>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

function DataNote({ children }) {
  return <div className="data-note"><Lightbulb size={15} /><span>{children}</span></div>;
}

function PanchayatTable({ records, totalCount, onClearSearch }) {
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead><tr><th>PANCHAYAT</th><th>BOOTHS</th><th>VOTERS</th><th>WORKERS</th><th>STATUS</th><th>PROGRESS</th></tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id ?? record.name}>
                <td><div className="panchayat-name"><span className="panchayat-avatar">{record.name.charAt(0)}</span><strong>{record.name}</strong></div></td>
                <td>{numberFormat.format(record.booths)}</td>
                <td>{numberFormat.format(record.voters)}</td>
                <td>{numberFormat.format(record.workers)}</td>
                <td><span className={`table-status ${record.status === "Strong" ? "status-strong" : record.status === "Moderate" ? "status-moderate" : "status-review"}`}><span />{record.status}</span></td>
                <td><div className="table-progress"><div className="table-progress-track"><span style={{ width: `${record.progress}%` }} /></div><small>{record.progress}%</small></div></td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan="6" className="empty-state">No matching Panchayats found.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>Showing {records.length} of {totalCount} sample Panchayat records</span>
        {onClearSearch && <button onClick={onClearSearch}>Clear search <ArrowRight size={14} /></button>}
      </div>
    </>
  );
}

function ActivityList({ records, emptyMessage }) {
  if (!records.length) return <EmptyState title="No matching activity records">{emptyMessage}</EmptyState>;

  return (
    <div className="activity-list">
      {records.map((record) => {
        const Icon = activityIcons[record.icon] ?? Activity;
        return (
          <article className="activity-item" key={record.id}>
            <div className={`activity-icon ${record.color}`}><Icon size={17} /></div>
            <div className="activity-text">
              <strong>{record.title}</strong>
              <span>{record.subtitle}</span>
              <small>{formatRelativeTime(record.occurredAt)}</small>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, note, icon: Icon, color, sourceTag = "SAMPLE", onClick }) {
  const content = (
    <>
      <div className="stat-top"><div className={`stat-icon ${color}`}><Icon size={20} /></div><span className="sample-tag">{sourceTag}</span></div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-foot"><span>{note}</span></div>
    </>
  );
  return onClick ? (
    <button className="stat-card stat-card-clickable" type="button" onClick={onClick}>
      {content}
    </button>
  ) : <article className="stat-card">{content}</article>;
}

function AskAI({ constituencyName }) {
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState("");
  const suggestions = [
    "Summarize Panchayat status",
    "Show Panchayat progress",
    "What data is available?",
  ];

  function submitQuestion(event) {
    event.preventDefault();
    if (!question.trim()) return;
    setNotice("Demo only: no AI service is connected, so responses are unavailable.");
  }

  return (
    <section className="ai-panel" aria-label={`${constituencyName} AI demo`}>
      <div className="ai-orb"><Sparkles size={23} /></div>
      <div className="ai-intro">
        <span>DEMO MODE · NO AI SERVICE CONNECTED</span>
        <h2>Ask {constituencyName} AI</h2>
        <p>Explore the kinds of questions you can ask about constituency data.</p>
      </div>
      <form className="ai-form" onSubmit={submitQuestion}>
        <div className="ai-input-wrap">
          <MessageSquare size={17} />
          <input
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              setNotice("");
            }}
            placeholder="Ask something about your dashboard..."
            aria-label="Ask the AI demo"
          />
          <button type="submit" aria-label="Submit demo question"><ArrowRight size={19} /></button>
        </div>
        <div className="ai-examples">
          <span>Try:</span>
          {suggestions.map((suggestion) => (
            <button
              type="button"
              key={suggestion}
              onClick={() => {
                setQuestion(suggestion);
                setNotice("");
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>
      {notice && <div className="ai-demo-notice" role="status">{notice}</div>}
    </section>
  );
}

function Dashboard({ data, summary, activities, onNavigate }) {
  const statuses = Object.entries(summary.statusCounts);
  const maxStatusCount = Math.max(1, ...statuses.map(([, count]) => count));

  return (
    <>
      <h1 className="welcome-heading"><span>Welcome to Nathnagar Constituency</span></h1>
      <AskAI constituencyName={data.constituency.name} />
      <PageHeading
        eyebrow="CONSTITUENCY INTELLIGENCE"
        title={`${data.constituency.name} Dashboard`}
        description="A concise view of sample Panchayat coverage, progress and recent field activity."
      >
        <span className="sample-badge"><span /> DEMO DATA</span>
      </PageHeading>

      <section className="hero-banner dashboard-hero">
        <div className="hero-grid" />
        <div className="hero-content">
          <div className="hero-label"><span className="hero-label-dot" /> WORKSPACE OVERVIEW</div>
          <h2>Local records.<br /><span>Clearer decisions.</span></h2>
          <p>Review the available Panchayat sample and navigate to focused workspace pages for more detail.</p>
          <div className="hero-meta">
            <span><MapPin size={15} /> {data.constituency.name}, {data.constituency.district}, {data.constituency.state}</span>
            <span><Building2 size={15} /> {summary.panchayatCount} Panchayat sample records</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
          <div className="hero-pin"><MapPin size={30} /></div>
          <div className="hero-floating hero-floating-top"><Activity size={16} /><span><b>Available records</b><small>Local sample data</small></span></div>
          <div className="hero-floating hero-floating-bottom"><Target size={17} /><span><b>Progress tracking</b><small>Calculated from records</small></span></div>
        </div>
      </section>

      <section className="stats-grid dashboard-stats">
        <StatCard label="Blocks" value={numberFormat.format(demoBlockCount)} note="Configured blocks" icon={Building2} color="green" onClick={() => onNavigate("Blocks")} />
        <StatCard label="Booths" value={numberFormat.format(summary.boothCount)} note="Across Panchayats" icon={Vote} color="blue" onClick={() => onNavigate("Booth Management")} />
        <StatCard label="Panchayats" value={numberFormat.format(summary.panchayatCount)} note="Available records" icon={MapPin} color="purple" onClick={() => onNavigate("Panchayats")} />
        <StatCard label="Voters" value={numberFormat.format(summary.voterCount)} note="Across Booths" icon={Users} color="orange" onClick={() => onNavigate("Voter Insights")} />
      </section>

      <section className="workspace-grid dashboard-panels">
        <Panel title="Panchayat progress" eyebrow="SAMPLE RECORDS" action={<button className="text-action" onClick={() => onNavigate("Panchayats")}>All Panchayats <ArrowRight size={15} /></button>}>
          {statuses.length ? (
            <div className="status-chart">
              {statuses.map(([status, count]) => (
                <div className="status-chart-row" key={status}>
                  <div className="status-chart-label"><span>{status}</span><strong>{count}</strong></div>
                  <div className="status-chart-track"><span className={`status-chart-fill ${status === "Strong" ? "strong-fill" : status === "Moderate" ? "moderate-fill" : "review-fill"}`} style={{ width: `${(count / maxStatusCount) * 100}%` }} /></div>
                </div>
              ))}
              <div className="average-progress"><span>Average recorded progress</span><strong>{summary.averageProgress}%</strong></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${summary.averageProgress}%` }} /></div>
            </div>
          ) : <EmptyState title="No Panchayat records">Add records through a future data source to see summaries.</EmptyState>}
          <DataNote>Summary reflects {summary.panchayatCount} sample Panchayat records, not verified constituency totals.</DataNote>
        </Panel>

        <Panel title="Recent activity" eyebrow="SAMPLE RECORDS" action={<button className="text-action" onClick={() => onNavigate("Field Activities")}>Activity log <ArrowRight size={15} /></button>}>
          <ActivityList records={activities.slice(0, 3)} emptyMessage="Try a different search or date range." />
        </Panel>
      </section>

    </>
  );
}

const configuredBlocks = [
  { id: "configured-root", name: "NATHNAGAR BLOCK", parent_id: null },
  { id: "configured-nathnagar", name: "NATHNAGAR", parent_id: "configured-root" },
  { id: "configured-jagdishpur", name: "JAGDISHPUR", parent_id: "configured-root" },
  { id: "configured-sabour", name: "SABOUR", parent_id: "configured-root" },
];

function BlocksPage({ blocks, panchayats, loading, error, isLive, search, onNavigate }) {
  if (isLive && loading) return <p className="admin-loading" role="status">Loading Blocks...</p>;
  if (isLive && error) return <p className="admin-error" role="alert">{error}</p>;

  const displayedBlocks = isLive ? blocks : configuredBlocks;
  const blocksById = new Map(displayedBlocks.map((block) => [block.id, block]));
  const visibleBlocks = sortBlocks(
    displayedBlocks
      .filter((block) => block.parent_id != null)
      .filter((block) => preferredBlockOrder.includes(
        getBlockDisplayName(block, blocksById.get(block.parent_id)).toLocaleUpperCase(),
      ))
      .filter((block) => getBlockDisplayName(
        block,
        blocksById.get(block.parent_id),
      ).toLocaleUpperCase().includes(search.trim().toLocaleUpperCase())),
    blocksById,
  );

  return (
    <>
      <PageHeading eyebrow={isLive ? "LIVE DATABASE" : "LOCAL ADMINISTRATION"} title="Blocks" description="Choose a Block to view its Panchayat directory." />
      <section className="block-overview-grid" aria-label="Blocks">
        {visibleBlocks.map((block) => {
          const name = getBlockDisplayName(block, blocksById.get(block.parent_id)).toLocaleUpperCase();
          const count = isLive
            ? panchayats.filter(({ block_id }) => block_id === block.id).length
            : configuredBlockPanchayats[name]?.length ?? 0;
          return (
            <button
              className="block-overview-card"
              key={block.id}
              type="button"
              onClick={() => onNavigate("Block Details", { ...block, display_name: name })}
            >
              <span className="block-overview-icon"><Building2 size={20} /></span>
              <strong>{name}</strong>
              <span>{numberFormat.format(count)} Panchayats</span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          );
        })}
      </section>
      {visibleBlocks.length === 0 && (
        <div className="workspace-empty">
          <strong>{search ? "No matching Blocks" : "No Blocks available"}</strong>
          <p>{search ? "Try a different search term." : "Block records are not available."}</p>
        </div>
      )}
    </>
  );
}

function BlockDetailsPage({ block, blocks, panchayats, loading, error, isLive, search, onNavigate }) {
  if (!block) {
    return (
      <div className="workspace-empty">
        <strong>No Block selected</strong>
        <p>Choose a Block from the Blocks overview.</p>
        <button className="button button-secondary" type="button" onClick={() => onNavigate("Blocks")}>Back to Blocks</button>
      </div>
    );
  }
  if (isLive && loading) return <p className="admin-loading" role="status">Loading Panchayats...</p>;
  if (isLive && error) return <p className="admin-error" role="alert">{error}</p>;

  const blocksById = new Map(blocks.map((record) => [record.id, record]));
  const name = (block.display_name ?? getBlockDisplayName(
    block,
    blocksById.get(block.parent_id),
  )).toLocaleUpperCase();
  const records = isLive
    ? panchayats.filter(({ block_id }) => block_id === block.id)
    : (configuredBlockPanchayats[name] ?? []).map((panchayatName) => ({
        id: `${name}-${panchayatName}`,
        name: panchayatName,
        block_name: name,
      }));
  const visibleRecords = records.filter(({ name: panchayatName, block_name }) =>
    `${panchayatName} ${block_name ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  );

  return (
    <>
      <PageHeading
        eyebrow="BLOCK DIRECTORY"
        title={name}
        description={`Panchayats assigned to ${name}.`}
      >
        <button className="button button-secondary" type="button" onClick={() => onNavigate("Blocks")}>
          <ArrowRight size={15} /> All Blocks
        </button>
      </PageHeading>
      <Panel title="Panchayats" eyebrow={`${visibleRecords.length} OF ${records.length} RECORDS`}>
        {visibleRecords.length ? (
          <ul className="block-detail-panchayat-list">
            {visibleRecords.map((record) => (
              <li
                key={record.id}
                role="button"
                tabIndex={0}
                onClick={() => onNavigate("Panchayat Details", record)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onNavigate("Panchayat Details", record);
                  }
                }}
              >
                <Building2 size={15} /><strong>{record.name}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <div className="workspace-empty">
            <strong>{search ? "No matching Panchayats" : "No Panchayats assigned"}</strong>
            <p>{search ? "Try a different search term." : "There are no Panchayat records assigned to this Block."}</p>
          </div>
        )}
      </Panel>
    </>
  );
}

function normalizeName(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").toLocaleLowerCase() : "";
}

function getDatabasePanchayatId(panchayat) {
  const numericId = Number(panchayat?.id);
  return Number.isSafeInteger(numericId) && numericId > 0 ? numericId : null;
}

function resolveSelectedPanchayat(panchayat, panchayats) {
  const databaseId = getDatabasePanchayatId(panchayat);
  if (databaseId !== null) {
    const match = panchayats.find((record) => Number(record.id) === databaseId);
    if (match) return match;
  }

  const name = normalizeName(panchayat?.name);
  if (name) {
    const match = panchayats.find((record) => normalizeName(record.name) === name);
    if (match) return match;
  }

  return panchayat ?? null;
}

function PanchayatDetailsPage({ panchayat, block, booths, loading, error, onNavigate }) {
  if (!panchayat) {
    return (
      <div className="workspace-empty">
        <strong>No Panchayat selected</strong>
        <p>Choose a Panchayat from a Block.</p>
        <button className="button button-secondary" type="button" onClick={() => onNavigate("Blocks")}>Back to Blocks</button>
      </div>
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="PANCHAYAT DIRECTORY"
        title={panchayat.name}
        description="Panchayat details and assigned Block."
      >
        <button className="button button-secondary" type="button" onClick={() => onNavigate("Block Details", block)}>
          Back to Block
        </button>
      </PageHeading>
      <Panel title="Assigned Block">
        <p>{panchayat.block_name ?? "Not assigned"}</p>
      </Panel>
      <Panel title="Booths" eyebrow={`${numberFormat.format(booths.length)} TOTAL RECORDS`}>
        {error ? <p className="admin-error" role="alert">{error}</p> : loading ? (
          <p className="admin-loading" role="status">Loading Booth records...</p>
        ) : booths.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>BOOTH NUMBER</th>
                  <th>BOOTH NAME</th>
                  <th>ADDRESS</th>
                  <th>VILLAGE / MOHALLA / TOLA</th>
                </tr>
              </thead>
              <tbody>
                {booths.map((booth) => (
                  <tr key={booth.id}>
                    <td>{booth.booth_number}</td>
                    <td>{booth.name}</td>
                    <td>{booth.address}</td>
                    <td>{booth.village_name ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No Booth records">No Booth records are assigned to this Panchayat.</EmptyState>
        )}
      </Panel>
    </>
  );
}

function AdminDashboard({
  data,
  summary,
  isLoading,
  error,
  onNavigate,
  blocks,
  hierarchyLoading,
  hierarchyError,
}) {
  const metrics = [
    { label: "Blocks", value: blocks.filter(({ parent_id }) => parent_id != null).length, icon: Building2, color: "green", page: "Blocks" },
    { label: "Booths", key: "booth_count", icon: Vote, color: "blue", page: "Booth Management" },
    { label: "Panchayats", key: "panchayat_count", icon: MapPin, color: "purple", page: "Panchayats" },
    { label: "Voters", key: "voter_count", icon: Users, color: "orange", page: "Voter Insights" },
  ];

  return (
    <>
      <PageHeading
        eyebrow="LIVE DATABASE"
        title={`${data.constituency.name} Dashboard`}
        description="Totals are calculated from the Panchayat, Booth, and Voter records in your database."
      >
        <span className="sample-badge admin-live-badge"><span /> DATABASE</span>
      </PageHeading>
      <section className="stats-grid admin-dashboard-stats">
        {metrics.map(({ label, key, value, icon, color, page }) => (
          <StatCard
            key={label}
            label={label}
            value={isLoading ? "…" : key ? summary ? numberFormat.format(summary[key]) : "—" : numberFormat.format(value)}
            note="Database records"
            icon={icon}
            color={color}
            sourceTag="LIVE"
            onClick={() => onNavigate(page)}
          />
        ))}
      </section>
      {error && <p className="admin-error" role="alert">{error}</p>}
      <Panel title="Browse Blocks" eyebrow="LIVE DATABASE" action={<button className="text-action" type="button" onClick={() => onNavigate("Blocks")}>Open Blocks <ArrowRight size={15} /></button>}>
        <p className="admin-dashboard-copy">Open the Blocks overview to browse each Block and its assigned Panchayats.</p>
        {hierarchyError && <p className="admin-error" role="alert">{hierarchyError}</p>}
        {hierarchyLoading && <p className="admin-loading" role="status">Loading Block records...</p>}
      </Panel>
      <Panel title="Manage constituency records" eyebrow="ADMIN ONLY">
        <p className="admin-dashboard-copy">
          Add and maintain verified Panchayat, Booth, and Voter records. Changes are saved directly to the database.
        </p>
        <div className="admin-dashboard-actions">
          <button className="button button-secondary" onClick={() => onNavigate("Panchayats")}>Manage Panchayats</button>
          <button className="button button-secondary" onClick={() => onNavigate("Booth Management")}>Manage Booths</button>
          <button className="button button-secondary" onClick={() => onNavigate("Voter Insights")}>Manage Voters</button>
        </div>
      </Panel>
    </>
  );
}

function getFieldWorkerSummary(records) {
  const boothCounts = new Map();
  const boothPanchayatIds = new Map();
  for (const booth of records?.booths ?? []) {
    boothCounts.set(booth.panchayat_id, (boothCounts.get(booth.panchayat_id) ?? 0) + 1);
    boothPanchayatIds.set(booth.id, booth.panchayat_id);
  }

  const voterCounts = new Map();
  for (const voter of records?.voters ?? []) {
    const panchayatId = boothPanchayatIds.get(voter.booth_id);
    if (panchayatId !== undefined) {
      voterCounts.set(panchayatId, (voterCounts.get(panchayatId) ?? 0) + 1);
    }
  }

  const panchayats = (records?.panchayats ?? []).map((panchayat) => ({
    ...panchayat,
    booth_count: boothCounts.get(panchayat.id) ?? 0,
    voter_count: voterCounts.get(panchayat.id) ?? 0,
  }));

  return {
    panchayats,
    panchayatCount: panchayats.length,
    boothCount: records?.booths?.length ?? 0,
    voterCount: records?.voters?.length ?? 0,
  };
}

function FieldWorkerDashboard({ data, records, summary, loading, error, onNavigate }) {
  const metrics = [
    { label: "Blocks", value: (records?.blocks ?? []).filter(({ parent_id }) => parent_id != null).length, icon: Building2, color: "green", page: "Blocks" },
    { label: "Booths", value: summary.boothCount, icon: Vote, color: "blue", page: "Booth Management" },
    { label: "Panchayats", value: summary.panchayatCount, icon: MapPin, color: "purple", page: "Panchayats" },
    { label: "Voters", value: summary.voterCount, icon: Users, color: "orange", page: "Voter Insights" },
  ];
  return (
    <>
      <h1 className="welcome-heading"><span>Welcome to Nathnagar Constituency</span></h1>
      <AskAI constituencyName={data.constituency.name} />
      <PageHeading
        eyebrow="CONSTITUENCY INTELLIGENCE"
        title={`${data.constituency.name} Dashboard`}
        description="A live view of Panchayat, Booth, and Voter records maintained by an Admin."
      >
        <span className="sample-badge admin-live-badge"><span /> LIVE DATABASE</span>
      </PageHeading>

      <section className="hero-banner dashboard-hero">
        <div className="hero-grid" />
        <div className="hero-content">
          <div className="hero-label"><span className="hero-label-dot" /> WORKSPACE OVERVIEW</div>
          <h2>Local records.<br /><span>Clearer decisions.</span></h2>
          <p>Review Admin-managed constituency records and navigate to read-only workspace pages.</p>
          <div className="hero-meta">
            <span><MapPin size={15} /> {data.constituency.name}, {data.constituency.district}, {data.constituency.state}</span>
            <span><Building2 size={15} /> {summary.panchayatCount} database Panchayat records</span>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" />
          <div className="hero-pin"><MapPin size={30} /></div>
          <div className="hero-floating hero-floating-top"><Activity size={16} /><span><b>Available records</b><small>Shared database</small></span></div>
          <div className="hero-floating hero-floating-bottom"><Target size={17} /><span><b>Panchayat coverage</b><small>Calculated from records</small></span></div>
        </div>
      </section>

      <section className="stats-grid dashboard-stats">
        {metrics.map(({ label, value, icon, color, page }) => (
          <StatCard key={label} label={label} value={loading ? "…" : error ? "—" : numberFormat.format(value)} note="Database records" icon={icon} color={color} sourceTag="LIVE" onClick={() => onNavigate(page)} />
        ))}
      </section>
      {error && <p className="admin-error" role="alert">{error}</p>}
      {loading ? <p className="admin-loading" role="status">Loading database records...</p> : !error && (
        <>
          <section className="workspace-grid dashboard-panels">
            <Panel title="Local administration" eyebrow="LIVE DATABASE" action={<button className="text-action" onClick={() => onNavigate("Blocks")}>Browse Blocks <ArrowRight size={15} /></button>}>
              <p className="admin-dashboard-copy">Open a Block to view its assigned Panchayats.</p>
            </Panel>

            <Panel title="Recent activity" eyebrow="FIELD ACTIVITY">
              <EmptyState title="No activity records connected">Field activity records are not stored in the current database.</EmptyState>
            </Panel>
          </section>
        </>
      )}
    </>
  );
}

function ElectionOverview({ summary, isFieldWorker = false }) {
  return (
    <>
      <PageHeading eyebrow="WORKSPACE" title="Election Overview" description="Election results are not available because this database has no election-result records." />
      <Panel title="Election metrics unavailable" eyebrow="NO VERIFIED ELECTION DATA">
        <EmptyState title="No election records connected">Turnout, election-year comparisons, vote totals, and coverage metrics require verified election and booth records. They are intentionally not estimated from Panchayat aggregates.</EmptyState>
      </Panel>
      <div className="workspace-grid">
        <Panel title="Available local coverage" eyebrow={isFieldWorker ? "LIVE DATABASE" : "SAMPLE ONLY"}>
          <div className="metric-list">
            <Metric icon={Building2} label="Panchayat records" value={numberFormat.format(summary.panchayatCount)} />
            <Metric icon={Vote} label={isFieldWorker ? "Booth records" : "Booths represented in sample"} value={numberFormat.format(summary.boothCount)} />
          </div>
          <DataNote>{isFieldWorker ? "Counts come from authenticated read-only database records." : "These are aggregated from sample Panchayat records and do not describe an election result."}</DataNote>
        </Panel>
      </div>
    </>
  );
}

function BoothManagement({ summary, records = [], loading = false, error = "" }) {
  return (
    <>
      <PageHeading eyebrow="WORKSPACE" title="Booth Management" description="Browse Booth records maintained by an Admin. This view is read-only." />
      <Panel title="Booth directory" eyebrow={`${numberFormat.format(summary.boothCount)} DATABASE RECORDS`}>
        {error ? <p className="admin-error" role="alert">{error}</p> : loading ? <p className="admin-loading" role="status">Loading Booth records...</p> : records.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>BOOTH NUMBER</th><th>BOOTH</th><th>BLOCK</th><th>PANCHAYAT</th><th>ADDRESS</th></tr></thead>
              <tbody>{records.map((record) => <tr key={record.id}><td>{record.booth_number}</td><td>{record.name}</td><td>{record.block_name ? `${record.parent_block_name} · ${record.block_name}` : "Unassigned"}</td><td>{record.panchayat_name}</td><td>{record.address}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No Booth records">Admin-managed Booth records will appear here when available.</EmptyState>}
      </Panel>
    </>
  );
}

function PanchayatsPage({
  records,
  totalCount,
  onClearSearch,
  isFieldWorker = false,
  loading = false,
  error = "",
}) {
  return (
    <>
      <PageHeading eyebrow="WORKSPACE" title="Panchayats" description="Browse and search Admin-managed Panchayat records." />
      <Panel title="Panchayat directory" eyebrow={`${totalCount} ${isFieldWorker ? "DATABASE" : "SAMPLE"} RECORDS`}>
        {isFieldWorker
          ? error ? <p className="admin-error" role="alert">{error}</p>
            : loading ? <p className="admin-loading" role="status">Loading Panchayat records...</p>
            : <DatabasePanchayatTable records={records} />
          : <PanchayatTable records={records} totalCount={totalCount} onClearSearch={onClearSearch} />}
      </Panel>
    </>
  );
}

function DatabasePanchayatTable({ records }) {
  return records.length ? (
    <div className="table-wrap">
      <table>
        <thead><tr><th>PANCHAYAT</th><th>BLOCK</th><th>BOOTHS</th><th>VOTERS</th></tr></thead>
        <tbody>{records.map((record) => (
          <tr key={record.id}>
            <td>{record.name}</td>
            <td>{record.block_name ?? "Unassigned"}</td>
            <td>{numberFormat.format(record.booth_count ?? 0)}</td>
            <td>{numberFormat.format(record.voter_count ?? 0)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  ) : <EmptyState title="No Panchayat records">Admin-managed records will appear here when available.</EmptyState>;
}

function VoterInsights({ summary, records = [], loading = false, error = "", isFieldWorker = false }) {
  return (
    <>
      <PageHeading eyebrow="WORKSPACE" title="Voter Insights" description={isFieldWorker ? "Browse individual voter records maintained by an Admin. This view is read-only." : "Sample voter counts are aggregated by Panchayat; no individual voter records are connected."} />
      <section className="stats-grid page-stats">
        <StatCard label={isFieldWorker ? "Voters" : "Voters in sample"} value={numberFormat.format(summary.voterCount)} note={isFieldWorker ? "Database records" : "Across sample Panchayats"} icon={Users} color="purple" sourceTag={isFieldWorker ? "LIVE" : "SAMPLE"} />
        <StatCard label="Panchayats represented" value={numberFormat.format(summary.panchayatCount)} note={isFieldWorker ? "Database records" : "Sample records only"} icon={Building2} color="green" sourceTag={isFieldWorker ? "LIVE" : "SAMPLE"} />
      </section>
      <Panel title={isFieldWorker ? "Voter records" : "No voter-level insights yet"} eyebrow={isFieldWorker ? "READ ONLY" : "VOTER RECORDS REQUIRED"}>
        {isFieldWorker ? (error ? <p className="admin-error" role="alert">{error}</p> : loading ? <p className="admin-loading" role="status">Loading Voter records...</p> : records.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>VOTER</th><th>ELECTORAL ROLL ID</th><th>BLOCK</th><th>BOOTH</th><th>PANCHAYAT</th></tr></thead>
            <tbody>{records.map((record) => <tr key={record.id}><td>{record.name}</td><td>{record.electoral_roll_id}</td><td>{record.block_name ? `${record.parent_block_name} · ${record.block_name}` : "Unassigned"}</td><td>{record.booth_number} · {record.booth_name}</td><td>{record.panchayat_name}</td></tr>)}</tbody>
          </table></div>
        ) : <EmptyState title="No Voter records">Admin-managed Voter records will appear here when available.</EmptyState>) : (
          <EmptyState title="Individual voter data is unavailable">Demographic breakdowns, turnout patterns, and voter-level search should be connected to verified, appropriately protected data before they are shown.</EmptyState>
        )}
      </Panel>
    </>
  );
}

function ConstituencyMap({ data, search, panchayats }) {
  const locations = filterRecordsBySearch(data.mapLocations, search, ["name"]);
  return (
    <>
      <PageHeading eyebrow="INTELLIGENCE" title="Constituency Map" description="Illustrative workspace map. It is not geographically accurate or suitable for navigation." />
      <Panel title={data.constituency.name} eyebrow={`${data.constituency.district}, ${data.constituency.state}`}>
        <div className="map-art workspace-map">
          <div className="map-grid-lines" />
          <svg className="map-river" viewBox="0 0 500 300" preserveAspectRatio="none" aria-hidden="true">
            <path d="M-10 180 C 70 110, 110 230, 185 155 S 285 100, 340 155 S 425 220, 510 90" />
            <path d="M-10 194 C 70 124, 110 244, 185 169 S 285 114, 340 169 S 425 234, 510 104" />
          </svg>
          <svg className="map-boundaries" viewBox="0 0 500 300" preserveAspectRatio="none" aria-hidden="true">
            <path d="M40 30 L150 18 L200 65 L275 48 L330 80 L450 40 L470 120 L405 165 L435 240 L350 275 L280 235 L205 270 L160 215 L65 235 L30 155 Z" />
            <path d="M150 18 L135 105 L205 145 L160 215 M200 65 L205 145 L275 48 M205 145 L300 130 L405 165 M300 130 L280 235 M65 235 L100 155 L30 155 M100 155 L135 105 L205 145 M350 275 L340 205 L435 240 M330 80 L300 130 L340 205" />
          </svg>
          {locations.map(({ name, position }) => {
            const record = panchayats.find(({ name: panchayatName }) => panchayatName === name);
            const markerClass = record?.status === "Needs attention" ? "pin-review" : record?.status === "Moderate" ? "pin-moderate" : record ? "pin-strong" : "pin-constituency";
            return <div className={`map-pin ${position} ${markerClass}`} key={name}><span /><small>{name}</small></div>;
          })}
          {!locations.length && <div className="map-empty">No locations match this search.</div>}
          <div className="map-legend"><span><i className="legend-pin green-pin" /> Strong</span><span><i className="legend-pin amber-pin" /> Moderate</span><span><i className="legend-pin red-pin" /> Needs attention</span><span><i className="legend-pin constituency-pin" /> Constituency</span></div>
          <div className="map-disclaimer">Illustrative map · Not for navigation</div>
        </div>
        <DataNote>Marker names and status use sample data. Boundary and position artwork is illustrative.</DataNote>
      </Panel>
    </>
  );
}

function IssuesReports({ activities }) {
  const issueRecords = activities.filter(({ icon }) => icon === "issue");
  return (
    <>
      <PageHeading eyebrow="INTELLIGENCE" title="Issues & Reports" description="Issue-related sample activity only; no issue or report records are connected." />
      <Panel title="Issue-related activity" eyebrow={`${issueRecords.length} MATCHING ACTIVITY RECORD${issueRecords.length === 1 ? "" : "S"}`}>
        <ActivityList records={issueRecords} emptyMessage="No issue-related sample activity matches this search and date range." />
        <DataNote>An activity mention is not a complete issue record. Status, ownership, and resolution details need a verified issue data source.</DataNote>
      </Panel>
    </>
  );
}

function FieldActivities({ activities, activityPeriod, activityPeriods, onActivityPeriodChange }) {
  return (
    <>
      <PageHeading eyebrow="INTELLIGENCE" title="Field Activities" description="Search available activity records and filter them by their recorded timestamp.">
        <label className="filter-control"><CalendarDays size={16} /><select value={activityPeriod} onChange={(event) => onActivityPeriodChange(event.target.value)} aria-label="Filter activity date range">
          {activityPeriods.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </PageHeading>
      <Panel title="Activity log" eyebrow={`${activities.length} MATCHING RECORD${activities.length === 1 ? "" : "S"}`}>
        <ActivityList records={activities} emptyMessage="Try a different search or date range." />
      </Panel>
    </>
  );
}

function Insights({ summary }) {
  const statusRows = Object.entries(summary.statusCounts);
  return (
    <>
      <PageHeading eyebrow="INTELLIGENCE" title="AI Insights" description="Record-based highlights from the local sample. No AI service is connected." />
      <Panel title="Panchayat status summary" eyebrow="CALCULATED FROM SAMPLE RECORDS">
        {statusRows.length ? <div className="insight-list">
          {statusRows.map(([status, count]) => (
            <div className="insight-item" key={status}>
              <div className={`insight-icon ${status === "Strong" ? "green-insight" : status === "Moderate" ? "blue-insight" : "orange-insight"}`}><Activity size={18} /></div>
              <div className="insight-body"><strong>{status}</strong><p>{count} of {summary.panchayatCount} sample Panchayat records.</p><span className="insight-tag blue-tag">SAMPLE SUMMARY</span></div>
            </div>
          ))}
        </div> : <EmptyState title="No sample records">There are no Panchayat records to summarize.</EmptyState>}
        <DataNote>These are descriptive summaries, not AI-generated recommendations or verified constituency-wide conclusions.</DataNote>
      </Panel>
    </>
  );
}

function SettingsPage({ data }) {
  return (
    <>
      <PageHeading eyebrow="ACCOUNT" title="Settings" description="Workspace information for this local demo." />
      <Panel title="Workspace configuration" eyebrow="READ-ONLY DEMO">
        <div className="settings-list">
          <Metric icon={MapPin} label="Active constituency" value="Not configured" />
          <Metric icon={Building2} label="Data source" value="Local sample records" />
          <Metric icon={Activity} label="Backend connection" value="Not configured" />
        </div>
        <DataNote>Workspace settings are read-only in this sample-data view.</DataNote>
      </Panel>
    </>
  );
}

function FieldWorkerMap({ records, loading, error }) {
  return (
    <>
      <PageHeading eyebrow="INTELLIGENCE" title="Constituency Map" description="A map needs verified location coordinates, which are not part of the current database records." />
      <Panel title="Panchayat locations" eyebrow="LOCATION DATA REQUIRED">
        {error ? <p className="admin-error" role="alert">{error}</p> : loading ? <p className="admin-loading" role="status">Loading Panchayat records...</p> : records.length ? (
          <>
            <EmptyState title="Map locations are not configured">Panchayat names and records are available, but no coordinates are stored. No approximate or sample map positions are shown.</EmptyState>
            <ul>{records.map(({ id, name }) => <li key={id}>{name}</li>)}</ul>
          </>
        ) : <EmptyState title="No Panchayat records">Admin-managed Panchayat records will appear here when available.</EmptyState>}
      </Panel>
    </>
  );
}

function FieldWorkerInsights({ summary, loading, error }) {
  return (
    <>
      <PageHeading eyebrow="INTELLIGENCE" title="Database Insights" description="Live descriptive counts from Admin-managed database records. No AI service is connected." />
      <Panel title="Constituency record summary" eyebrow="LIVE DATABASE">
        {error ? <p className="admin-error" role="alert">{error}</p> : loading ? <p className="admin-loading" role="status">Loading database records...</p> : (
          <div className="metric-list">
            <Metric icon={Building2} label="Panchayat records" value={numberFormat.format(summary.panchayatCount)} />
            <Metric icon={Vote} label="Booth records" value={numberFormat.format(summary.boothCount)} />
            <Metric icon={Users} label="Voter records" value={numberFormat.format(summary.voterCount)} />
          </div>
        )}
        <DataNote>These counts describe stored records only; they do not imply election results or worker activity.</DataNote>
      </Panel>
    </>
  );
}

function FieldWorkerSettings({ loading, error }) {
  return (
    <>
      <PageHeading eyebrow="ACCOUNT" title="Settings" description="Read-only workspace information." />
      <Panel title="Workspace configuration" eyebrow="READ ONLY">
        <div className="settings-list">
          <Metric icon={MapPin} label="Active constituency" value={`${data.constituency.name}, ${data.constituency.state}`} />
          <Metric icon={Building2} label="Data source" value="Shared database records" />
          <Metric icon={Activity} label="Backend connection" value={error ? "Unavailable" : loading ? "Connecting..." : "Connected"} />
        </div>
        {error && <p className="admin-error" role="alert">{error}</p>}
      </Panel>
    </>
  );
}

function Metric({ icon: Icon, label, value }) {
  return <div className="settings-metric"><span><Icon size={16} /></span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

export function WorkspacePage(props) {
  const {
    page,
    selectedBlock,
    selectedPanchayat,
    data,
    summary,
    panchayats,
    activities,
    search,
    activityPeriod,
    activityPeriods,
    onActivityPeriodChange,
    onNavigate,
    onSearchChange,
    isAdmin = false,
    accessToken,
    adminSummary,
    adminSummaryLoading = false,
    adminSummaryError = "",
    onAdminRecordsChanged = () => {},
    isFieldWorker = false,
    fieldWorkerRecords = null,
    fieldWorkerLoading = false,
    fieldWorkerError = "",
  } = props;
  const fieldWorkerSummary = getFieldWorkerSummary(fieldWorkerRecords);
  const fieldWorkerPanchayats = filterRecordsBySearch(
    fieldWorkerSummary.panchayats,
    search,
    ["name", "block_name", "parent_block_name", "booth_count", "voter_count"],
  );
  const fieldWorkerBooths = filterRecordsBySearch(
    fieldWorkerRecords?.booths ?? [],
    search,
    ["booth_number", "name", "panchayat_name", "block_name", "parent_block_name", "address"],
  );
  const fieldWorkerVoters = filterRecordsBySearch(
    fieldWorkerRecords?.voters ?? [],
    search,
    ["name", "electoral_roll_id", "booth_number", "booth_name", "panchayat_name", "block_name", "parent_block_name"],
  );
  switch (page) {
    case "Blocks": return (
      <BlocksPage
        blocks={fieldWorkerRecords?.blocks ?? []}
        panchayats={fieldWorkerSummary.panchayats}
        loading={fieldWorkerLoading}
        error={fieldWorkerError}
        isLive={isAdmin || isFieldWorker}
        search={search}
        onNavigate={onNavigate}
      />
    );
    case "Block Details": return (
      <BlockDetailsPage
        block={selectedBlock}
        blocks={fieldWorkerRecords?.blocks ?? []}
        panchayats={fieldWorkerSummary.panchayats}
        loading={fieldWorkerLoading}
        error={fieldWorkerError}
        isLive={isAdmin || isFieldWorker}
        search={search}
        onNavigate={onNavigate}
      />
    );
    case "Panchayat Details": {
      const selectedPanchayatRecord = resolveSelectedPanchayat(
        selectedPanchayat,
        fieldWorkerSummary.panchayats,
      );
      const selectedPanchayatId = getDatabasePanchayatId(selectedPanchayatRecord);
      const selectedPanchayatName = normalizeName(selectedPanchayatRecord?.name);
      const assignedBooths = (fieldWorkerRecords?.booths ?? []).filter((booth) => {
        if (selectedPanchayatId !== null) {
          return Number(booth.panchayat_id) === selectedPanchayatId;
        }
        return (
          selectedPanchayatName !== "" &&
          normalizeName(booth.panchayat_name) === selectedPanchayatName
        );
      });
      return (
        <PanchayatDetailsPage
          panchayat={selectedPanchayatRecord}
          block={selectedBlock}
          booths={assignedBooths}
          loading={fieldWorkerLoading}
          error={fieldWorkerError}
          onNavigate={onNavigate}
        />
      );
    }
    case "Election Overview": return isFieldWorker
      ? fieldWorkerError ? <p className="admin-error" role="alert">{fieldWorkerError}</p>
        : fieldWorkerLoading ? <p className="admin-loading" role="status">Loading database records...</p>
          : <ElectionOverview summary={fieldWorkerSummary} isFieldWorker />
      : <ElectionOverview summary={summary} />;
    case "Booth Management": return isAdmin
      ? <AdminDataManagement page={page} accessToken={accessToken} search={search} onRecordsChanged={onAdminRecordsChanged} />
      : isFieldWorker
        ? <BoothManagement summary={fieldWorkerSummary} records={fieldWorkerBooths} loading={fieldWorkerLoading} error={fieldWorkerError} />
        : <BoothManagement summary={summary} />;
    case "Panchayats": return isAdmin
      ? <AdminDataManagement page={page} accessToken={accessToken} search={search} onRecordsChanged={onAdminRecordsChanged} />
      : isFieldWorker
        ? <PanchayatsPage records={fieldWorkerPanchayats} totalCount={fieldWorkerSummary.panchayatCount} onClearSearch={() => onSearchChange("")} isFieldWorker loading={fieldWorkerLoading} error={fieldWorkerError} />
        : <PanchayatsPage records={panchayats} totalCount={data.panchayats.length} onClearSearch={() => onSearchChange("")} />;
    case "Voter Insights": return isAdmin
      ? <AdminDataManagement page={page} accessToken={accessToken} search={search} onRecordsChanged={onAdminRecordsChanged} />
      : isFieldWorker
        ? <VoterInsights summary={fieldWorkerSummary} records={fieldWorkerVoters} loading={fieldWorkerLoading} error={fieldWorkerError} isFieldWorker />
        : <VoterInsights summary={summary} />;
    case "Constituency Map": return isFieldWorker
      ? <FieldWorkerMap records={fieldWorkerPanchayats} loading={fieldWorkerLoading} error={fieldWorkerError} />
      : <ConstituencyMap data={data} search={search} panchayats={data.panchayats} />;
    case "Issues & Reports": return isFieldWorker
      ? <Panel title="No issue records connected" eyebrow="DATA SOURCE REQUIRED"><EmptyState title="No issues or reports">This database does not contain issue or report records.</EmptyState></Panel>
      : <IssuesReports activities={activities} />;
    case "Field Activities": return isFieldWorker
      ? <Panel title="No field activity records" eyebrow="DATA SOURCE REQUIRED"><EmptyState title="No activity records">This database does not contain field activity records.</EmptyState></Panel>
      : <FieldActivities activities={activities} activityPeriod={activityPeriod} activityPeriods={activityPeriods} onActivityPeriodChange={onActivityPeriodChange} />;
    case "AI Insights": return isFieldWorker
      ? <FieldWorkerInsights summary={fieldWorkerSummary} loading={fieldWorkerLoading} error={fieldWorkerError} />
      : <Insights summary={summary} />;
    case "Settings": return isFieldWorker
      ? <FieldWorkerSettings loading={fieldWorkerLoading} error={fieldWorkerError} />
      : <SettingsPage data={data} />;
    case "Dashboard":
    default:
      return isAdmin
        ? <AdminDashboard
            data={data}
            summary={adminSummary}
            isLoading={adminSummaryLoading}
            error={[adminSummaryError, fieldWorkerError].filter(Boolean).join(" ")}
            onNavigate={onNavigate}
            blocks={fieldWorkerRecords?.blocks ?? []}
            hierarchyLoading={fieldWorkerLoading}
            hierarchyError={fieldWorkerError}
          />
        : isFieldWorker
          ? <FieldWorkerDashboard data={data} records={fieldWorkerRecords} summary={fieldWorkerSummary} loading={fieldWorkerLoading} error={fieldWorkerError} onNavigate={onNavigate} />
          : <Dashboard data={data} summary={summary} activities={activities} onNavigate={onNavigate} />;
  }
}
