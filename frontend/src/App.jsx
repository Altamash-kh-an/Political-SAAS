import {
  Activity,
  ArrowRight,
  Bell,
  Building2,
  ChevronRight,
  ClipboardList,
  Home,
  Map,
  MapPin,
  Menu,
  Search,
  Settings,
  Sparkles,
  Target,
  Users,
  Vote,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  filterActivities,
  filterRecordsBySearch,
  getDashboardData,
  summarizePanchayats,
} from "./services/dashboardService";
import { WorkspacePage } from "./WorkspacePages";
import "./App.css";

const pages = [
  { label: "Dashboard", icon: Home, group: "WORKSPACE" },
  { label: "Election Overview", icon: Vote, group: "WORKSPACE" },
  { label: "Booth Management", icon: MapPin, group: "WORKSPACE" },
  { label: "Panchayats", icon: Building2, group: "WORKSPACE" },
  { label: "Voter Insights", icon: Users, group: "WORKSPACE" },
  { label: "Constituency Map", icon: Map, group: "INTELLIGENCE" },
  { label: "Issues & Reports", icon: ClipboardList, group: "INTELLIGENCE" },
  { label: "Field Activities", icon: Activity, group: "INTELLIGENCE" },
  { label: "AI Insights", icon: Sparkles, group: "INTELLIGENCE" },
  { label: "Settings", icon: Settings, group: "ACCOUNT" },
];

const dashboardData = getDashboardData();
const { activityPeriods } = dashboardData;

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [activityPeriod, setActivityPeriod] = useState("30d");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const searchInputRef = useRef(null);
  const summary = summarizePanchayats(dashboardData.panchayats);

  useEffect(() => {
    function focusSearch(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const filteredPanchayats = filterRecordsBySearch(
    dashboardData.panchayats,
    search,
    ["name", "booths", "voters", "workers", "status", "progress"]
  );
  const filteredActivities = filterActivities(
    dashboardData.activities,
    search,
    activityPeriod
  );

  function navigate(label) {
    setActivePage(label);
    setSidebarOpen(false);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 1000px)").matches) {
      setSidebarOpen((open) => !open);
    } else {
      setSidebarCollapsed((collapsed) => !collapsed);
    }
  }

  const currentPage = pages.find(({ label }) => label === activePage) ?? pages[0];
  const pageContent = (
    <WorkspacePage
      page={activePage}
      data={dashboardData}
      summary={summary}
      panchayats={filteredPanchayats}
      activities={filteredActivities}
      search={search}
      activityPeriod={activityPeriod}
      activityPeriods={activityPeriods}
      onSearchChange={setSearch}
      onActivityPeriodChange={setActivityPeriod}
      onNavigate={navigate}
    />
  );

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
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
        </div>

        <div className="constituency-select">
          <div className="constituency-symbol"><MapPin size={19} /></div>
          <div className="constituency-copy">
            <small>ACTIVE CONSTITUENCY</small>
            <strong>{dashboardData.constituency.name}, {dashboardData.constituency.state}</strong>
          </div>
        </div>

        <nav className="side-navigation" aria-label="Workspace navigation">
          {["WORKSPACE", "INTELLIGENCE", "ACCOUNT"].map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-heading">{group}</div>
              {pages.filter((item) => item.group === group).map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  className={`nav-link ${activePage === label ? "active" : ""}`}
                  onClick={() => navigate(label)}
                  title={sidebarCollapsed ? label : undefined}
                  aria-current={activePage === label ? "page" : undefined}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                  {activePage === label && <span className="active-marker" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><Sparkles size={18} /></div>
            <strong>Sample-data workspace</strong>
            <p>Dashboard totals reflect available mock records.</p>
            <button onClick={() => navigate("AI Insights")}>
              View insights <ArrowRight size={15} />
            </button>
          </div>
          <div className="sidebar-user">
            <div className="avatar">DK</div>
            <div className="user-copy"><strong>Dashboard Admin</strong><small>Administrator</small></div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarOpen ? "Close sidebar" : sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
              {sidebarOpen ? <X size={19} /> : <Menu size={21} />}
            </button>
            <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={15} /><strong>{currentPage.label}</strong></div>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <Search size={17} />
              <input
                ref={searchInputRef}
                aria-label={`Search ${activePage}`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={activePage === "Panchayats" ? "Search Panchayats..." : "Search available records..."}
              />
              {search && <button className="search-clear" type="button" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}
              <kbd>⌘ K</kbd>
            </label>
            <div className="notification-wrap">
              <button className="icon-button notification-button" onClick={() => setShowNotifications((visible) => !visible)} aria-label="Toggle notifications" aria-expanded={showNotifications}>
                <Bell size={19} /><span className="notification-dot" />
              </button>
              {showNotifications && (
                <div className="notification-popover">
                  <strong>Notifications</strong>
                  <p>No live notifications are available in demo mode.</p>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="page-content">{pageContent}</div>
      </main>
    </div>
  );
}

export default App;
