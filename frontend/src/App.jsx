import {
  Activity,
  ArrowRight,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  Home,
  LogIn,
  LogOut,
  Map,
  MapPin,
  Menu,
  Search,
  Settings,
  Sparkles,
  Target,
  Users,
  UserRound,
  Vote,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import LoginPage from "./LoginPage";
import {
  filterActivities,
  filterRecordsBySearch,
  getDashboardData,
  summarizePanchayats,
} from "./services/dashboardService";
import { WorkspacePage } from "./WorkspacePages";
import { adminRequest } from "./services/adminDataService";
import { loadWorkspaceRecords } from "./services/fieldWorkerService";
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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileDetails, setShowProfileDetails] = useState(false);
  const [showSampleWorkspace, setShowSampleWorkspace] = useState(false);
  const [authSession, setAuthSession] = useState(null);
  const [adminSummary, setAdminSummary] = useState(null);
  const [adminSummaryLoading, setAdminSummaryLoading] = useState(false);
  const [adminSummaryError, setAdminSummaryError] = useState("");
  const [workspaceRecords, setWorkspaceRecords] = useState(null);
  const [workspaceRecordsLoading, setWorkspaceRecordsLoading] = useState(false);
  const [workspaceRecordsError, setWorkspaceRecordsError] = useState("");
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

  useEffect(() => {
    if (!authSession) return undefined;

    let expiresAt;
    try {
      const tokenPayload = authSession.accessToken.split(".")[1];
      const normalizedPayload = tokenPayload.replace(/-/g, "+").replace(/_/g, "/");
      const paddedPayload = normalizedPayload.padEnd(
        Math.ceil(normalizedPayload.length / 4) * 4,
        "="
      );
      const claims = JSON.parse(atob(paddedPayload));
      expiresAt = Number.isFinite(claims.exp) ? claims.exp * 1000 : 0;
    } catch {
      expiresAt = 0;
    }

    const expirationTimer = window.setTimeout(() => {
      setAuthSession(null);
      setAdminSummary(null);
      setAdminSummaryLoading(false);
      setAdminSummaryError("");
      setWorkspaceRecords(null);
      setWorkspaceRecordsLoading(false);
      setWorkspaceRecordsError("");
      setShowProfileMenu(false);
      setShowProfileDetails(false);
      setShowSampleWorkspace(false);
    }, Math.max(0, expiresAt - Date.now()));

    return () => window.clearTimeout(expirationTimer);
  }, [authSession]);

  useEffect(() => {
    if (!authSession) return undefined;

    let active = true;
    loadWorkspaceRecords(authSession.accessToken)
      .then((records) => {
        if (active) setWorkspaceRecords(records);
      })
      .catch((error) => {
        if (active) {
          setWorkspaceRecords(null);
          setWorkspaceRecordsError(error.message);
        }
      })
      .finally(() => {
        if (active) setWorkspaceRecordsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authSession]);

  useEffect(() => {
    if (!authSession || authSession.user.role !== "admin") return undefined;

    let active = true;
    adminRequest("/admin/summary", authSession.accessToken)
      .then((summaryResult) => {
        if (active) setAdminSummary(summaryResult);
      })
      .catch((error) => {
        if (active) {
          setAdminSummary(null);
          setAdminSummaryError(error.message);
        }
      })
      .finally(() => {
        if (active) setAdminSummaryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authSession]);

  if (!showSampleWorkspace) {
    return (
      <LoginPage
        onPreviewWorkspace={returnToDashboard}
        onLoginSuccess={(session) => {
          setAuthSession(session);
          setAdminSummary(null);
          setAdminSummaryLoading(session.user.role === "admin");
          setAdminSummaryError("");
          setWorkspaceRecords(null);
          setWorkspaceRecordsLoading(true);
          setWorkspaceRecordsError("");
          returnToDashboard();
        }}
      />
    );
  }

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
  const searchResults = search.trim()
    ? [
        ...filterRecordsBySearch(
          authSession ? workspaceRecords?.panchayats ?? [] : dashboardData.panchayats,
          search,
          ["name"]
        ).map((record) => ({
          page: "Panchayats",
          query: record.name,
          value: record.id
            ? `Panchayat · ${record.name} (#${record.id})`
            : `Panchayat · ${record.name}`,
        })),
        ...(authSession ? filterRecordsBySearch(
          workspaceRecords?.booths ?? [],
          search,
          ["booth_number", "name", "panchayat_name", "address"]
        ).map((record) => ({
          page: "Booth Management",
          query: record.booth_number,
          value: `Booth · ${record.booth_number} · ${record.name} (#${record.id})`,
        })) : []),
        ...(authSession ? filterRecordsBySearch(
          workspaceRecords?.voters ?? [],
          search,
          ["name", "electoral_roll_id", "booth_number", "booth_name", "panchayat_name"]
        ).map((record) => ({
          page: "Voter Insights",
          query: record.electoral_roll_id,
          value: `Voter · ${record.name} · ${record.electoral_roll_id} (#${record.id})`,
        })) : []),
      ]
    : [];

  function navigate(label) {
    setActivePage(label);
    setSidebarOpen(false);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSearchChange(value) {
    const result = searchResults.find(({ value: optionValue }) => optionValue === value);
    if (!result) {
      setSearch(value);
      return;
    }

    setActivePage(result.page);
    setSidebarOpen(false);
    setSearch(result.query);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openLogin() {
    setShowSampleWorkspace(false);
    setShowNotifications(false);
  }

  function logout() {
    setAuthSession(null);
    setAdminSummary(null);
    setAdminSummaryLoading(false);
    setAdminSummaryError("");
    setWorkspaceRecords(null);
    setWorkspaceRecordsLoading(false);
    setWorkspaceRecordsError("");
    setShowProfileMenu(false);
    setShowProfileDetails(false);
    setShowNotifications(false);
    setShowSampleWorkspace(false);
  }

  function returnToDashboard() {
    setActivePage("Dashboard");
    setSearch("");
    setShowSampleWorkspace(true);
  }

  async function refreshAdminSummary() {
    if (!authSession || authSession.user.role !== "admin") return;
    setAdminSummaryLoading(true);
    setAdminSummaryError("");
    try {
      setAdminSummary(await adminRequest("/admin/summary", authSession.accessToken));
    } catch (error) {
      setAdminSummaryError(error.message);
    } finally {
      setAdminSummaryLoading(false);
    }
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
      isAdmin={authSession?.user.role === "admin"}
      accessToken={authSession?.accessToken}
      adminSummary={adminSummary}
      adminSummaryLoading={adminSummaryLoading}
      adminSummaryError={adminSummaryError}
      onAdminRecordsChanged={refreshAdminSummary}
      isFieldWorker={authSession?.user.role === "field_worker"}
      fieldWorkerRecords={workspaceRecords}
      fieldWorkerLoading={workspaceRecordsLoading}
      fieldWorkerError={workspaceRecordsError}
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
            <strong>{authSession?.user.role === "field_worker"
              ? "Shared database"
              : `${dashboardData.constituency.name}, ${dashboardData.constituency.state}`}</strong>
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
            <strong>{authSession ? "Live database workspace" : "Sample-data workspace"}</strong>
            <p>{authSession ? "Dashboard totals reflect saved database records." : "Preview totals reflect available mock records."}</p>
            <button onClick={() => navigate("AI Insights")}>
              View insights <ArrowRight size={15} />
            </button>
          </div>
          <div className="sidebar-user">
            <div className="avatar">{authSession ? (authSession.user.full_name || authSession.user.email)[0].toUpperCase() : "DK"}</div>
            <div className="user-copy">
              <strong>{authSession?.user.full_name || authSession?.user.email || "Dashboard Admin"}</strong>
              <small>{authSession ? (authSession.user.role === "field_worker" ? "Field Worker" : "Administrator") : "Administrator"}</small>
            </div>
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
                onChange={(event) => handleSearchChange(event.target.value)}
                list="workspace-search-results"
                placeholder={activePage === "Panchayats" ? "Search Panchayats..." : "Search available records..."}
              />
              <datalist id="workspace-search-results">
                {searchResults.map((result) => (
                  <option key={result.value} value={result.value} />
                ))}
              </datalist>
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
            {authSession ? (
              <div className="profile-menu-wrap">
                <button
                  className="icon-button profile-menu-trigger"
                  type="button"
                  aria-label="Open profile menu"
                  aria-haspopup="menu"
                  aria-expanded={showProfileMenu}
                  onClick={() => setShowProfileMenu((visible) => !visible)}
                >
                  <CircleUserRound size={19} />
                  <ChevronDown size={14} />
                </button>
                {showProfileMenu && (
                  <div className="profile-dropdown" role="menu">
                    <div className="profile-dropdown-user">
                      <strong>{authSession.user.full_name || "Not provided"}</strong>
                      <small>{authSession.user.email}</small>
                      <small>{authSession.user.role === "field_worker" ? "Field Worker" : "Administrator"}</small>
                    </div>
                    <dl className="profile-dropdown-details">
                      {[
                        ["Mobile", authSession.user.mobile_number],
                        ["Father", authSession.user.father_name],
                        ["Address", authSession.user.address],
                        ["Qualification", authSession.user.qualification],
                        ["Nearby", authSession.user.nearby_location],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value || "Not provided"}</dd>
                        </div>
                      ))}
                    </dl>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowProfileDetails(true);
                      }}
                    >
                      <UserRound size={16} /> My Profile
                    </button>
                    <button type="button" role="menuitem" onClick={logout}>
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="button button-secondary topbar-login" type="button" onClick={openLogin}>
                <LogIn size={15} /> Log in
              </button>
            )}
          </div>
        </header>

        <div className="page-content">{pageContent}</div>
      </main>
      {showProfileDetails && authSession && (
        <div
          className="profile-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowProfileDetails(false);
          }}
        >
          <section
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
          >
            <div className="profile-modal-heading">
              <div>
                <div className="eyebrow">ACCOUNT PROFILE</div>
                <h2 id="profile-modal-title">My Profile</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close profile"
                onClick={() => setShowProfileDetails(false)}
              >
                <X size={18} />
              </button>
            </div>
            <dl className="profile-details-list">
              {[
                ["Full name", authSession.user.full_name],
                ["Email", authSession.user.email],
                ["Mobile number", authSession.user.mobile_number],
                ["Father's name", authSession.user.father_name],
                ["Complete address", authSession.user.address],
                ["Qualification", authSession.user.qualification],
                ["Nearby location / landmark", authSession.user.nearby_location],
                ["Role", authSession.user.role === "field_worker" ? "Field Worker" : "Administrator"],
              ].map(([label, value]) => (
                <div className="profile-detail" key={label}>
                  <dt>{label}</dt>
                  <dd>{value || "Not provided"}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
