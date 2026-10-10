
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  FileText,
  Home,
  Lightbulb,
  Map,
  MapPin,
  Menu,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Vote,
  X,
} from "lucide-react";
import { useState } from "react";
import "./App.css";

const stats = [
  { label: "Total Booths", value: "312", change: "+12", note: "Since last update", icon: Vote, color: "blue" },
  { label: "Panchayats", value: "28", change: "100%", note: "Coverage mapped", icon: Building2, color: "green" },
  { label: "Total Voters", value: "2.84L", change: "+2.4%", note: "Compared to last year", icon: Users, color: "purple" },
  { label: "Active Workers", value: "1,246", change: "+8.2%", note: "This quarter", icon: ShieldCheck, color: "orange" },
  { label: "Issues Tracked", value: "86", change: "24 open", note: "62 resolved", icon: ClipboardList, color: "pink" },
  { label: "Upcoming Events", value: "14", change: "Next 30 days", note: "Across constituency", icon: CalendarDays, color: "cyan" },
];

const panchayats = [
  { name: "Kajraili", booths: 14, voters: "12,480", workers: 52, status: "Strong", progress: 86 },
  { name: "Bishanpur Jichho", booths: 12, voters: "10,240", workers: 46, status: "Strong", progress: 79 },
  { name: "Bairia", booths: 11, voters: "9,860", workers: 38, status: "Needs attention", progress: 54 },
  { name: "Raghunathpur", booths: 16, voters: "14,120", workers: 61, status: "Moderate", progress: 68 },
  { name: "Madhopur", booths: 9, voters: "8,450", workers: 32, status: "Strong", progress: 82 },
];

const activities = [
  { title: "Booth report updated", subtitle: "Booth 034 · Kajraili Panchayat", time: "10 min ago", icon: FileText, color: "blue" },
  { title: "New issue reported", subtitle: "Road repair · Bairia Panchayat", time: "32 min ago", icon: CircleAlert, color: "orange" },
  { title: "Field visit completed", subtitle: "Raghunathpur · Ward 08", time: "1 hour ago", icon: CheckCircle2, color: "green" },
  { title: "Meeting scheduled", subtitle: "Worker coordination · Nathnagar", time: "2 hours ago", icon: CalendarDays, color: "purple" },
];

const navGroups = [
  {
    title: "WORKSPACE",
    items: [
      { label: "Dashboard", icon: Home },
      { label: "Election Overview", icon: Vote },
      { label: "Booth Management", icon: MapPin },
      { label: "Panchayats", icon: Building2 },
      { label: "Voter Insights", icon: Users },
    ],
  },
  {
    title: "INTELLIGENCE",
    items: [
      { label: "Constituency Map", icon: Map },
      { label: "Issues & Reports", icon: ClipboardList },
      { label: "Field Activities", icon: Activity },
      { label: "AI Insights", icon: Sparkles },
    ],
  },
];

function SectionTitle({ eyebrow, title, action }) {
  return (
    <div className="section-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function App() {
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("2025");
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");

  const filteredPanchayats = panchayats.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  function askAI(question) {
    const q = (question || aiQuestion).trim();
    if (!q) return;
    setAiQuestion(q);
    setAiAnswer(
      `Here is a starting point for "${q}": review the latest booth reports, compare panchayat-level coverage, and verify any outstanding field updates before making a decision. This demo dashboard uses sample data.`
    );
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><Target size={23} /></div>
          <div className="brand-copy">
            <strong>Constituency<span>IQ</span></strong>
            <small>INTELLIGENCE PORTAL</small>
          </div>
          <button className="mobile-close icon-button" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={19} />
          </button>
        </div>

        <div className="constituency-select">
          <div className="constituency-symbol"><MapPin size={19} /></div>
          <div className="constituency-copy">
            <small>ACTIVE CONSTITUENCY</small>
            <strong>Nathnagar, Bihar</strong>
          </div>
          <ChevronDown size={16} />
        </div>

        <nav className="side-navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <div className="nav-heading">{group.title}</div>
              {group.items.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  className={`nav-link ${activeNav === label ? "active" : ""}`}
                  onClick={() => {
                    setActiveNav(label);
                    setSidebarOpen(false);
                  }}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>

                  {activeNav === label && <span className="active-marker" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><Sparkles size={18} /></div>
            <strong>Need a quick insight?</strong>
            <p>Ask your constituency AI assistant.</p>
            <button onClick={() => document.getElementById("ai-question")?.focus()}>
              Ask AI Assistant <ArrowRight size={15} />
            </button>
          </div>
          <button className="nav-link settings-link" onClick={() => setActiveNav("Settings")}>
            <Settings size={18} /><span>Settings</span>
          </button>
          <div className="sidebar-user">
            <div className="avatar">DK</div>
            <div className="user-copy"><strong>Dashboard Admin</strong><small>Administrator</small></div>
            <MoreDots />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu size={21} />
            </button>
            <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={15} /><strong>{activeNav}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <Search size={17} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search panchayats..." />
              <kbd>⌘ K</kbd>
            </label>
            <div className="notification-wrap">
              <button className="icon-button notification-button" onClick={() => setShowNotifications(!showNotifications)} aria-label="Notifications">
                <Bell size={19} /><span className="notification-dot" />
              </button>
              {showNotifications && (
                <div className="notification-popover">
                  <strong>Notifications</strong>
                  <p><CircleAlert size={15} /> 8 issues need review.</p>
                  <p><CalendarDays size={15} /> 2 upcoming field meetings.</p>
                </div>
              )}
            </div>
            <div className="top-user">
              <div className="avatar">DK</div>
              <div className="user-copy"><strong>Admin</strong><small>Super Admin</small></div>
              <ChevronDown size={15} />
            </div>
          </div>
        </header>

        <div className="page-content">
          <section className="ai-panel" id="ai-panel">
            <div className="ai-orb"><Sparkles size={23} /></div>
            <div className="ai-intro"><span>YOUR INTELLIGENCE ASSISTANT</span><h2>Ask Nathnagar AI</h2><p>Explore your constituency data with natural language.</p></div>
            <form className="ai-form" onSubmit={(e) => { e.preventDefault(); askAI(); }}>
              <div className="ai-input-wrap"><MessageSquare size={17} /><input id="ai-question" value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} placeholder='Ask something about your dashboard...' /><button type="submit" aria-label="Ask AI"><ArrowRight size={19} /></button></div>
              <div className="ai-examples"><span>Try:</span><button type="button" onClick={() => askAI("Summarize booth status")}>Booth status</button><button type="button" onClick={() => askAI("Show panchayat progress")}>Panchayat progress</button><button type="button" onClick={() => askAI("List issues needing review")}>Issues to review</button></div>
            </form>
            {aiAnswer && <div className="ai-answer"><Sparkles size={16} /><p>{aiAnswer}</p><button onClick={() => setAiAnswer("")} aria-label="Dismiss answer"><X size={16} /></button></div>}
          </section>

          <section className="welcome-row">
            <div>
              <div className="welcome-kicker"><span className="live-dot" /> CONSTITUENCY INTELLIGENCE</div>
              <h1>Nathnagar <span>Dashboard</span></h1>
              <p>One unified view of constituency performance, field operations and election readiness.</p>
            </div>
            <div className="welcome-actions">
              <button className="button button-secondary"><CalendarDays size={16} /> Last 30 days <ChevronDown size={15} /></button>
              <button className="button button-primary" onClick={() => window.print()}><FileText size={16} /> Export Report</button>
            </div>
          </section>

          <section className="hero-banner">
            <div className="hero-grid" />
            <div className="hero-content">
              <div className="hero-label"><span className="hero-label-dot" /> LIVE CONSTITUENCY OVERVIEW</div>
              <h2>Know your ground.<br /><span>Lead with insight.</span></h2>
              <p>Track election metrics, field activity and local priorities across Nathnagar — all in one place.</p>
              <div className="hero-meta">
                <span><MapPin size={15} /> Nathnagar, Bhagalpur, Bihar</span>
                <span><CalendarDays size={15} /> Data overview · {period}</span>
              </div>
            </div>
            <div className="hero-visual" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="orbit orbit-three" />
              <div className="hero-pin"><MapPin size={30} /></div>
              <div className="hero-floating hero-floating-top"><Activity size={16} /><span><b>Field activity</b><small>Performance tracking</small></span></div>
              <div className="hero-floating hero-floating-bottom"><Target size={17} /><span><b>Constituency focus</b><small>Ground-level insights</small></span></div>
            </div>
            <div className="hero-side-note"><span>01</span><span className="hero-side-line" /><span>LOCAL INTELLIGENCE</span></div>
          </section>

          <section className="stats-grid">
            {stats.map(({ label, value, change, note, icon: Icon, color }) => (
              <article className="stat-card" key={label}>
                <div className="stat-top">
                  <div className={`stat-icon ${color}`}><Icon size={20} strokeWidth={1.9} /></div>
                  <button className="stat-menu" aria-label={`More about ${label}`}>···</button>
                </div>
                <div className="stat-value">{value}</div>
                <div className="stat-label">{label}</div>
                <div className="stat-foot">
                  <span className={`stat-change ${label === "Issues Tracked" ? "neutral" : ""}`}>
                    {label === "Issues Tracked" ? <CircleAlert size={13} /> : <ArrowUpRight size={14} />}
                    {change}
                  </span>
                  <span>{note}</span>
                </div>
              </article>
            ))}
          </section>

          <section className="dashboard-grid overview-grid">
            <article className="panel election-panel">
              <SectionTitle
                eyebrow="PERFORMANCE SNAPSHOT"
                title="Election Overview"
                action={<select className="select-control" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Election year"><option>2025</option><option>2024</option><option>2023</option></select>}
              />
              <div className="election-content">
                <div className="donut-wrap">
                  <div className="donut-chart"><div className="donut-hole"><strong>68.4%</strong><span>Turnout rate</span></div></div>
                  <div className="donut-caption"><span className="legend-dot blue-dot" /> Overall voter turnout</div>
                </div>
                <div className="election-details">
                  <div className="election-metric">
                    <div className="election-metric-icon voters"><Users size={17} /></div>
                    <div><small>Registered voters</small><strong>2,84,560</strong></div>
                    <span className="metric-trend"><ArrowUpRight size={13} /> 2.4%</span>
                  </div>
                  <div className="election-metric">
                    <div className="election-metric-icon voted"><CheckCircle2 size={17} /></div>
                    <div><small>Votes cast (est.)</small><strong>1,94,641</strong></div>
                    <span className="metric-trend"><ArrowUpRight size={13} /> 1.8%</span>
                  </div>
                  <div className="election-metric">
                    <div className="election-metric-icon pending"><Target size={17} /></div>
                    <div><small>Booth coverage</small><strong>92.6%</strong></div>
                    <span className="metric-neutral">On track</span>
                  </div>
                </div>
              </div>
              <div className="panel-bottom-note"><Lightbulb size={16} /><span><strong>Insight:</strong> Booth coverage is progressing well. Review pending updates for a complete picture.</span></div>
            </article>

            <article className="panel booth-panel">
              <SectionTitle eyebrow="FIELD OPERATIONS" title="Booth Status" action={<button className="text-action" onClick={() => setActiveNav("Booth Management")}>View all <ArrowRight size={15} /></button>} />
              <div className="booth-summary">
                <div><span className="status-dot green-status" /> <span>Verified</span><strong>248</strong><small>79.5% of booths</small></div>
                <div><span className="status-dot amber-status" /> <span>In progress</span><strong>46</strong><small>14.7% of booths</small></div>
                <div><span className="status-dot red-status" /> <span>Needs review</span><strong>18</strong><small>5.8% of booths</small></div>
              </div>
              <div className="booth-progress-title"><span>Overall verification</span><strong>79.5%</strong></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: "79.5%" }} /></div>
              <div className="booth-footer"><span><CheckCircle2 size={14} /> Updated recently</span><span>312 total booths</span></div>
              <div className="booth-alert"><CircleAlert size={17} /><div><strong>18 booths need attention</strong><span>Review field reports to update their status.</span></div><ChevronRight size={17} /></div>
            </article>
          </section>

          <section className="dashboard-grid insights-grid">
            <article className="panel insights-panel">
              <SectionTitle eyebrow="DATA-DRIVEN HIGHLIGHTS" title="Key Insights" action={<span className="ai-badge"><Sparkles size={13} /> AI ASSISTED</span>} />
              <div className="insight-list">
                <div className="insight-item">
                  <div className="insight-icon green-insight"><ArrowUpRight size={18} /></div>
                  <div className="insight-body"><strong>Strong field coverage</strong><p>Most tracked booths have recent updates. Continue checking booths with pending reports.</p><span className="insight-tag green-tag">POSITIVE TREND</span></div>
                </div>
                <div className="insight-item">
                  <div className="insight-icon orange-insight"><CircleAlert size={18} /></div>
                  <div className="insight-body"><strong>Attention needed in Bairia</strong><p>Current sample data shows lower progress. Verify local activity and follow-up needs.</p><span className="insight-tag orange-tag">NEEDS REVIEW</span></div>
                </div>
                <div className="insight-item">
                  <div className="insight-icon blue-insight"><Activity size={18} /></div>
                  <div className="insight-body"><strong>Keep records up to date</strong><p>Recent reports can improve the reliability of constituency-wide summaries.</p><span className="insight-tag blue-tag">RECOMMENDED</span></div>
                </div>
              </div>
              <button className="insights-footer" onClick={() => setActiveNav("AI Insights")}>Explore all insights <ArrowRight size={16} /></button>
            </article>

            <article className="panel map-panel">
              <SectionTitle eyebrow="GEOGRAPHIC VIEW" title="Constituency Map" action={<button className="icon-button small-icon" onClick={() => setActiveNav("Constituency Map")} aria-label="Open map"><ArrowUpRight size={17} /></button>} />
              <div className="map-art">
                <div className="map-grid-lines" />
                <svg className="map-river" viewBox="0 0 500 300" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M-10 180 C 70 110, 110 230, 185 155 S 285 100, 340 155 S 425 220, 510 90" />
                  <path d="M-10 194 C 70 124, 110 244, 185 169 S 285 114, 340 169 S 425 234, 510 104" />
                </svg>
                <svg className="map-boundaries" viewBox="0 0 500 300" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M40 30 L150 18 L200 65 L275 48 L330 80 L450 40 L470 120 L405 165 L435 240 L350 275 L280 235 L205 270 L160 215 L65 235 L30 155 Z" />
                  <path d="M150 18 L135 105 L205 145 L160 215 M200 65 L205 145 L275 48 M205 145 L300 130 L405 165 M300 130 L280 235 M65 235 L100 155 L30 155 M100 155 L135 105 L205 145 M350 275 L340 205 L435 240 M330 80 L300 130 L340 205" />
                </svg>
                <div className="map-pin pin-one"><span /><small>Nathnagar</small></div>
                <div className="map-pin pin-two"><span /><small>Kajraili</small></div>
                <div className="map-pin pin-three"><span /><small>Bairia</small></div>
                <div className="map-pin pin-four"><span /><small>Madhopur</small></div>
                <div className="map-legend"><span><i className="legend-pin green-pin" /> Strong</span><span><i className="legend-pin amber-pin" /> Moderate</span><span><i className="legend-pin red-pin" /> Review</span></div>
                <div className="map-disclaimer">Illustrative map · Not for navigation</div>
              </div>
              <div className="map-footer"><span><MapPin size={15} /> Nathnagar constituency</span><button onClick={() => setActiveNav("Constituency Map")}>Explore map <ArrowRight size={15} /></button></div>
            </article>
          </section>

          <section className="dashboard-grid bottom-grid">
            <article className="panel panchayat-panel">
              <SectionTitle eyebrow="LOCAL ADMINISTRATION" title="Panchayat Performance" action={<button className="text-action" onClick={() => setActiveNav("Panchayats")}>View all <ArrowRight size={15} /></button>} />
              <div className="table-wrap">
                <table>
                  <thead><tr><th>PANCHAYAT</th><th>BOOTHS</th><th>VOTERS</th><th>WORKERS</th><th>STATUS</th><th>PROGRESS</th></tr></thead>
                  <tbody>
                    {filteredPanchayats.map((p) => (
                      <tr key={p.name}>
                        <td><div className="panchayat-name"><span className="panchayat-avatar">{p.name.charAt(0)}</span><strong>{p.name}</strong></div></td>
                        <td>{p.booths}</td><td>{p.voters}</td><td>{p.workers}</td>
                        <td><span className={`table-status ${p.status === "Strong" ? "status-strong" : p.status === "Moderate" ? "status-moderate" : "status-review"}`}><span />{p.status}</span></td>
                        <td><div className="table-progress"><div className="table-progress-track"><span style={{ width: `${p.progress}%` }} /></div><small>{p.progress}%</small></div></td>
                      </tr>
                    ))}
                    {filteredPanchayats.length === 0 && <tr><td colSpan="6" className="empty-state">No matching panchayats found.</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="table-footer"><span>Showing {filteredPanchayats.length} of {panchayats.length} sample panchayats</span><button onClick={() => setSearch("")}>Clear search <ArrowRight size={14} /></button></div>
            </article>

            <article className="panel activity-panel">
              <SectionTitle eyebrow="LATEST UPDATES" title="Recent Activities" action={<button className="icon-button small-icon" aria-label="Activity options"><ChevronDown size={17} /></button>} />
              <div className="activity-list">
                {activities.map(({ title, subtitle, time, icon: Icon, color }) => (
                  <div className="activity-item" key={title}>
                    <div className={`activity-icon ${color}`}><Icon size={17} /></div>
                    <div className="activity-text"><strong>{title}</strong><span>{subtitle}</span><small>{time}</small></div>
                  </div>
                ))}
              </div>
              <button className="activity-footer" onClick={() => setActiveNav("Field Activities")}>View activity log <ArrowRight size={15} /></button>
            </article>
          </section>

          <footer className="page-footer"><span>© 2026 ConstituencyIQ <span className="footer-separator">·</span> Nathnagar Intelligence Portal</span><span><span className="footer-live" /> Dashboard online <span className="footer-separator">·</span> Sample data for UI demonstration</span></footer>
        </div>
      </main>
    </div>
  );
}

function MoreDots() {
  return <button className="more-dots" aria-label="More user options">···</button>;
}

export default App;
