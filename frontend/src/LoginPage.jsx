import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import { useState } from "react";

const roles = [
  {
    id: "admin",
    label: "Admin",
    description: "Manage your constituency",
    icon: ShieldCheck,
  },
  {
    id: "field-worker",
    label: "Field Worker",
    description: "Update field activity",
    icon: Users,
  },
];

function LoginPage({ onPreviewWorkspace }) {
  const [role, setRole] = useState("admin");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [notice, setNotice] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    setNotice(
      "Sign-in is unavailable: no authentication service is configured. Your credentials were not sent."
    );
  }

  return (
    <main className="login-page">
      <section className="login-showcase" aria-label="ConstituencyIQ overview">
        <div className="login-brand">
          <span className="login-brand-mark"><Target size={22} /></span>
          <span className="login-brand-name">Constituency<span>IQ</span></span>
        </div>

        <div className="login-showcase-copy">
          <span className="login-eyebrow"><span /> CONSTITUENCY INTELLIGENCE PORTAL</span>
          <h1>Clarity on the ground.<br /><span>Confidence in every decision.</span></h1>
          <p>
            Bring your constituency operations into focus with one connected
            workspace for your team.
          </p>
        </div>

        <div className="login-map-visual" aria-hidden="true">
          <span className="login-map-orbit login-map-orbit-one" />
          <span className="login-map-orbit login-map-orbit-two" />
          <span className="login-map-line login-map-line-one" />
          <span className="login-map-line login-map-line-two" />
          <span className="login-map-pin login-map-pin-one"><MapPin size={15} /></span>
          <span className="login-map-pin login-map-pin-two"><MapPin size={15} /></span>
          <span className="login-map-pin login-map-pin-three"><MapPin size={15} /></span>
          <span className="login-map-center"><Target size={25} /></span>
        </div>

        <div className="login-showcase-footer">
          <span><ShieldCheck size={15} /> Built for trusted teams</span>
          <span>CONSTITUENCYIQ · WORKSPACE</span>
        </div>
      </section>

      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-form-wrap">
          <div className="login-mobile-brand">
            <span className="login-brand-mark"><Target size={21} /></span>
            <span className="login-brand-name">Constituency<span>IQ</span></span>
          </div>

          <div className="login-heading">
            <span className="login-form-eyebrow">WELCOME BACK</span>
            <h2 id="login-title">Sign in to your workspace</h2>
            <p>Choose your role and enter your account details to continue.</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <fieldset className="login-role-fieldset">
              <legend>Sign in as</legend>
              <div className="login-role-options">
                {roles.map(({ id, label, description, icon: Icon }) => (
                  <label
                    className={`login-role-option ${role === id ? "selected" : ""}`}
                    key={id}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={id}
                      checked={role === id}
                      onChange={() => {
                        setRole(id);
                        setNotice("");
                      }}
                    />
                    <span className="login-role-icon"><Icon size={18} /></span>
                    <span className="login-role-copy">
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    <span className="login-role-indicator" />
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="login-field">
              <span>Email address</span>
              <span className="login-input-wrap">
                <Mail size={17} aria-hidden="true" />
                <input
                  type="email"
                  name="email"
                  placeholder="you@organization.org"
                  autoComplete="username"
                  required
                  onChange={() => setNotice("")}
                />
              </span>
            </label>

            <label className="login-field">
              <span>Password</span>
              <span className="login-input-wrap">
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  type={passwordVisible ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  onChange={() => setNotice("")}
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                  aria-pressed={passwordVisible}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {notice && <p className="login-notice" role="alert">{notice}</p>}

            <button className="login-submit" type="submit">
              Sign in <ArrowRight size={17} />
            </button>
          </form>

          <p className="login-security-note">
            <LockKeyhole size={14} />
            Authentication must be configured by your organization before sign-in is available.
          </p>

          <div className="login-preview">
            <span>Just exploring?</span>
            <button type="button" onClick={onPreviewWorkspace}>
              Preview the sample workspace <ArrowRight size={15} />
            </button>
            <small>This preview uses sample data and does not sign you in.</small>
          </div>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;