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
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Vote,
} from "lucide-react";
import { useState } from "react";
import { filterRecordsBySearch, formatRelativeTime } from "./services/dashboardService";

const activityIcons = {
  report: FileText,
  issue: CircleAlert,
  completed: CheckCircle2,
  meeting: CalendarDays,
};

const numberFormat = new Intl.NumberFormat();

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

function StatCard({ label, value, note, icon: Icon, color }) {
  return (
    <article className="stat-card">
      <div className="stat-top"><div className={`stat-icon ${color}`}><Icon size={20} /></div><span className="sample-tag">SAMPLE</span></div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-foot"><span>{note}</span></div>
    </article>
  );
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

function Dashboard({ data, summary, panchayats, activities, onNavigate, onClearSearch }) {
  const statuses = Object.entries(summary.statusCounts);
  const maxStatusCount = Math.max(1, ...statuses.map(([, count]) => count));

  return (
    <>
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
        <StatCard label="Sample Panchayats" value={numberFormat.format(summary.panchayatCount)} note="Available records" icon={Building2} color="green" />
        <StatCard label="Sample Booths" value={numberFormat.format(summary.boothCount)} note="Across sample Panchayats" icon={Vote} color="blue" />
        <StatCard label="Sample Voters" value={numberFormat.format(summary.voterCount)} note="Across sample Panchayats" icon={Users} color="purple" />
        <StatCard label="Sample Workers" value={numberFormat.format(summary.workerCount)} note="Across sample Panchayats" icon={ShieldCheck} color="orange" />
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

      <Panel title="Panchayat directory preview" eyebrow="LOCAL ADMINISTRATION" action={<button className="text-action" onClick={() => onNavigate("Panchayats")}>Open directory <ArrowRight size={15} /></button>}>
        <PanchayatTable records={panchayats.slice(0, 4)} totalCount={summary.panchayatCount} onClearSearch={onClearSearch} />
      </Panel>
    </>
  );
}

function ElectionOverview({ summary }) {
  return (
    <>
      <PageHeading eyebrow="WORKSPACE" title="Election Overview" description="Election-specific results are not part of the available sample data." />
      <Panel title="Election metrics unavailable" eyebrow="NO VERIFIED ELECTION DATA">
        <EmptyState title="No election records connected">Turnout, election-year comparisons, vote totals, and coverage metrics require verified election and booth records. They are intentionally not estimated from Panchayat aggregates.</EmptyState>
      </Panel>
      <div className="workspace-grid">
        <Panel title="Available local coverage" eyebrow="SAMPLE ONLY">
          <div className="metric-list">
            <Metric icon={Building2} label="Panchayat records" value={numberFormat.format(summary.panchayatCount)} />
            <Metric icon={Vote} label="Booths represented in sample" value={numberFormat.format(summary.boothCount)} />
          </div>
          <DataNote>These are aggregated from sample Panchayat records and do not describe an election result.</DataNote>
        </Panel>
      </div>
    </>
  );
}

function BoothManagement({ summary }) {
  return (
    <>
      <PageHeading eyebrow="WORKSPACE" title="Booth Management" description="Manage individual booth assignments and verification when booth-level records are available." />
      <Panel title="Booth records are not available" eyebrow="DATA SOURCE REQUIRED">
        <EmptyState title="No individual booths to display">The current sample only has booth counts attached to Panchayat records. Booth-level identifiers, status, assignments, and visit records require their own data source.</EmptyState>
        <DataNote>{numberFormat.format(summary.boothCount)} booths are represented by aggregate sample counts only; they are not individual booth records.</DataNote>
      </Panel>
    </>
  );
}

function PanchayatsPage({ records, totalCount, onClearSearch }) {
  return (
    <>
      <PageHeading eyebrow="WORKSPACE" title="Panchayats" description="Browse and search the Panchayat records available for this constituency." />
      <Panel title="Panchayat directory" eyebrow={`${totalCount} SAMPLE RECORDS`}>
        <PanchayatTable records={records} totalCount={totalCount} onClearSearch={onClearSearch} />
      </Panel>
    </>
  );
}

function VoterInsights({ summary }) {
  return (
    <>
      <PageHeading eyebrow="WORKSPACE" title="Voter Insights" description="Sample voter counts are aggregated by Panchayat; no individual voter records are connected." />
      <section className="stats-grid page-stats">
        <StatCard label="Voters in sample" value={numberFormat.format(summary.voterCount)} note="Across sample Panchayats" icon={Users} color="purple" />
        <StatCard label="Panchayats represented" value={numberFormat.format(summary.panchayatCount)} note="Sample records only" icon={Building2} color="green" />
      </section>
      <Panel title="No voter-level insights yet" eyebrow="VOTER RECORDS REQUIRED">
        <EmptyState title="Individual voter data is unavailable">Demographic breakdowns, turnout patterns, and voter-level search should be connected to verified, appropriately protected data before they are shown.</EmptyState>
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
          <Metric icon={MapPin} label="Active constituency" value={`${data.constituency.name}, ${data.constituency.state}`} />
          <Metric icon={Building2} label="Data source" value="Local sample records" />
          <Metric icon={Activity} label="Backend connection" value="Not configured" />
        </div>
        <DataNote>Account, notification, and constituency settings are not persisted because no backend or user preference store is available.</DataNote>
      </Panel>
    </>
  );
}

function Metric({ icon: Icon, label, value }) {
  return <div className="settings-metric"><span><Icon size={16} /></span><div><small>{label}</small><strong>{value}</strong></div></div>;
}

export function WorkspacePage(props) {
  const { page, data, summary, panchayats, activities, search, activityPeriod, activityPeriods, onActivityPeriodChange, onNavigate, onSearchChange } = props;
  switch (page) {
    case "Election Overview": return <ElectionOverview summary={summary} />;
    case "Booth Management": return <BoothManagement summary={summary} />;
    case "Panchayats": return <PanchayatsPage records={panchayats} totalCount={data.panchayats.length} onClearSearch={() => onSearchChange("")} />;
    case "Voter Insights": return <VoterInsights summary={summary} />;
    case "Constituency Map": return <ConstituencyMap data={data} search={search} panchayats={data.panchayats} />;
    case "Issues & Reports": return <IssuesReports activities={activities} />;
    case "Field Activities": return <FieldActivities activities={activities} activityPeriod={activityPeriod} activityPeriods={activityPeriods} onActivityPeriodChange={onActivityPeriodChange} />;
    case "AI Insights": return <Insights summary={summary} />;
    case "Settings": return <SettingsPage data={data} />;
    case "Dashboard":
    default:
      return <Dashboard data={data} summary={summary} panchayats={panchayats} activities={activities} onNavigate={onNavigate} onClearSearch={() => onSearchChange("")} />;
  }
}
