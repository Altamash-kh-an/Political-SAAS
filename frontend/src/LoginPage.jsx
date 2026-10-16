import {
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  MapPin,
  ShieldCheck,
  Target,
  Users,
  User,
} from "lucide-react";
import { useState } from "react";
import { apiBaseUrl } from "./services/apiConfig";

const loginEndpoint = `${apiBaseUrl}/auth/login`;
const registrationEndpoint = `${apiBaseUrl}/auth/register`;
const profileEndpoint = `${apiBaseUrl}/auth/me`;
const backendRoleByUiRole = {
  admin: "admin",
  "field-worker": "field_worker",
};

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

const emptyRegistration = {
  full_name: "",
  email: "",
  mobile_number: "",
  password: "",
  confirm_password: "",
  father_name: "",
  address: "",
  qualification: "",
  nearby_location: "",
};

function LoginPage({ onPreviewWorkspace, onLoginSuccess }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registration, setRegistration] = useState(emptyRegistration);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [notice, setNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;

    let normalizedMobile = "";
    if (mode === "register") {
      if (registration.password !== registration.confirm_password) {
        setNotice("The passwords do not match.");
        return;
      }

      normalizedMobile = registration.mobile_number
        .trim()
        .replace(/[ -]/g, "");
      if (!/^(?:\+91)?[6-9]\d{9}$/.test(normalizedMobile)) {
        setNotice("Enter a valid Indian mobile number, with an optional +91 country code.");
        return;
      }
    }

    setIsSubmitting(true);
    setNotice("");

    try {
      let response;
      try {
        response = await fetch(mode === "register" ? registrationEndpoint : loginEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "register"
              ? {
                  full_name: registration.full_name.trim(),
                  email: registration.email.trim(),
                  mobile_number: normalizedMobile,
                  password: registration.password,
                  father_name: registration.father_name.trim(),
                  address: registration.address.trim(),
                  qualification: registration.qualification.trim(),
                  nearby_location: registration.nearby_location.trim(),
                  role: "field_worker",
                }
              : { email, password }
          ),
        });
      } catch {
        setNotice("Unable to reach the authentication service. Check your connection and try again.");
        return;
      }

      let payload;
      try {
        payload = await response.json();
      } catch {
        setNotice(
          response.status >= 500
            ? "The authentication service is unavailable. Please try again later."
            : "The authentication service returned an invalid response."
        );
        return;
      }

      if (!response.ok) {
        if (mode === "register" && response.status === 409) {
          setNotice("An account with that email is already registered. Sign in instead.");
        } else if (mode === "register" && response.status === 403) {
          setNotice("Public registration is restricted to Field Worker accounts.");
        } else if (mode === "register" && response.status === 422) {
          setNotice("Check that all fields are valid and complete, then try again.");
        } else if (response.status === 401) {
          setNotice("Invalid email or password. Please try again.");
        } else if (response.status >= 500) {
          setNotice("The authentication service is unavailable. Please try again later.");
        } else {
          setNotice("Sign-in failed. Check your account details and try again.");
        }
        return;
      }

      if (mode === "register") {
        const profileFields = [
          payload?.full_name,
          payload?.mobile_number,
          payload?.father_name,
          payload?.address,
          payload?.qualification,
          payload?.nearby_location,
        ];
        if (
          response.status !== 201 ||
          !payload ||
          typeof payload !== "object" ||
          !Number.isInteger(payload.id) ||
          typeof payload.email !== "string" ||
          payload.email !== registration.email.trim().toLowerCase() ||
          payload.role !== "field_worker" ||
          typeof payload.created_at !== "string" ||
          Number.isNaN(Date.parse(payload.created_at)) ||
          !profileFields.every((value) => typeof value === "string")
        ) {
          setNotice("The authentication service returned an invalid registration response.");
          return;
        }

        setEmail(registration.email.trim());
        setPassword("");
        setRegistration(emptyRegistration);
        setRole("field-worker");
        setMode("login");
        setNotice("Registration successful. Sign in with your new Field Worker account.");
        return;
      }

      if (
        !payload ||
        typeof payload !== "object" ||
        !Number.isInteger(payload.id) ||
        typeof payload.email !== "string" ||
        typeof payload.role !== "string" ||
        typeof payload.access_token !== "string" ||
        payload.access_token.length === 0 ||
        payload.token_type !== "bearer"
      ) {
        setNotice("The authentication service returned an invalid login response.");
        return;
      }

      if (payload.role !== backendRoleByUiRole[role]) {
        setNotice("The selected role does not match this account. Choose the correct role and try again.");
        return;
      }

      let profileResponse;
      try {
        profileResponse = await fetch(profileEndpoint, {
          headers: { Authorization: `${payload.token_type} ${payload.access_token}` },
        });
      } catch {
        setNotice("Unable to load your profile. Check your connection and try again.");
        return;
      }

      if (profileResponse.status === 401) {
        setNotice("Your sign-in session could not be verified. Please sign in again.");
        return;
      }
      if (!profileResponse.ok) {
        setNotice("Unable to load your profile. Please try again later.");
        return;
      }

      let profile;
      try {
        profile = await profileResponse.json();
      } catch {
        setNotice("The authentication service returned an invalid profile response.");
        return;
      }

      if (
        !profile ||
        typeof profile !== "object" ||
        !Number.isInteger(profile.id) ||
        profile.id !== payload.id ||
        typeof profile.email !== "string" ||
        profile.email !== payload.email ||
        profile.role !== payload.role ||
        ![
          profile.full_name,
          profile.mobile_number,
          profile.father_name,
          profile.address,
          profile.qualification,
          profile.nearby_location,
        ].every((value) => value === null || typeof value === "string")
      ) {
        setNotice("The authentication service returned an invalid profile response.");
        return;
      }

      setPassword("");
      onLoginSuccess({
        user: profile,
        accessToken: payload.access_token,
        tokenType: payload.token_type,
      });
    } finally {
      setIsSubmitting(false);
    }
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
            <span className="login-form-eyebrow">{mode === "login" ? "WELCOME BACK" : "FIELD WORKER ACCOUNT"}</span>
            <h2 id="login-title">{mode === "login" ? "Sign in to your workspace" : "Create your account"}</h2>
            <p>{mode === "login" ? "Choose your role and enter your account details to continue." : "Complete your profile to register as a Field Worker."}</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {mode === "login" && (
              <fieldset className="login-role-fieldset" disabled={isSubmitting}>
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
            )}

            {mode === "register" && (
              <>
                <label className="login-field">
                  <span>Full name</span>
                  <span className="login-input-wrap">
                    <Users size={17} aria-hidden="true" />
                    <input
                      name="full_name"
                      autoComplete="name"
                      minLength={2}
                      maxLength={150}
                      required
                      value={registration.full_name}
                      disabled={isSubmitting}
                      onChange={(event) => {
                        setRegistration({ ...registration, full_name: event.target.value });
                        setNotice("");
                      }}
                    />
                  </span>
                </label>
              </>
            )}

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
                  value={mode === "login" ? email : registration.email}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    if (mode === "login") {
                      setEmail(event.target.value);
                    } else {
                      setRegistration({ ...registration, email: event.target.value });
                    }
                    setNotice("");
                  }}
                />
              </span>
            </label>

            {mode === "register" && (
              <>
                <label className="login-field">
                  <span>Mobile number</span>
                  <span className="login-input-wrap">
                    <Mail size={17} aria-hidden="true" />
                    <input
                      type="tel"
                      name="mobile_number"
                      autoComplete="tel"
                      placeholder="9876543210 or +91 9876543210"
                      required
                      value={registration.mobile_number}
                      disabled={isSubmitting}
                      onChange={(event) => {
                        setRegistration({ ...registration, mobile_number: event.target.value });
                        setNotice("");
                      }}
                    />
                  </span>
                </label>
                {[
                  ["father_name", "Father's name", User, "text", "off", 2, 150],
                  ["qualification", "Qualification", GraduationCap, "text", "off", 2, 150],
                  ["address", "Complete address", MapPin, "text", "street-address", 5, 2000],
                  ["nearby_location", "Nearby location / landmark", MapPin, "text", "off", 2, 255],
                ].map(([name, label, Icon, type, autoComplete, minLength, maxLength]) => (
                  <label className="login-field" key={name}>
                    <span>{label}</span>
                    <span className="login-input-wrap">
                      <Icon size={17} aria-hidden="true" />
                      <input
                        type={type}
                        name={name}
                        autoComplete={autoComplete}
                        minLength={minLength}
                        maxLength={maxLength}
                        required
                        value={registration[name]}
                        disabled={isSubmitting}
                        onChange={(event) => {
                          setRegistration({ ...registration, [name]: event.target.value });
                          setNotice("");
                        }}
                      />
                    </span>
                  </label>
                ))}
              </>
            )}

            <label className="login-field">
              <span>Password</span>
              <span className="login-input-wrap">
                <LockKeyhole size={17} aria-hidden="true" />
                <input
                  type={passwordVisible ? "text" : "password"}
                  name="password"
                  placeholder="Enter your password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  minLength={mode === "register" ? 8 : undefined}
                  maxLength={128}
                  required
                  value={mode === "login" ? password : registration.password}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    if (mode === "login") {
                      setPassword(event.target.value);
                    } else {
                      setRegistration({ ...registration, password: event.target.value });
                    }
                    setNotice("");
                  }}
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                  aria-pressed={passwordVisible}
                  disabled={isSubmitting}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                >
                  {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>

            {mode === "register" && (
              <label className="login-field">
                <span>Confirm password</span>
                <span className="login-input-wrap">
                  <LockKeyhole size={17} aria-hidden="true" />
                  <input
                    type={passwordVisible ? "text" : "password"}
                    name="confirm_password"
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={128}
                    required
                    value={registration.confirm_password}
                    disabled={isSubmitting}
                    onChange={(event) => {
                      setRegistration({ ...registration, confirm_password: event.target.value });
                      setNotice("");
                    }}
                  />
                </span>
              </label>
            )}

            {notice && <p className="login-notice" role="alert">{notice}</p>}

            <button className="login-submit" type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
              {isSubmitting
                ? mode === "login" ? "Signing in..." : "Creating account..."
                : mode === "login" ? "Sign in" : "Create Field Worker account"} <ArrowRight size={17} />
            </button>
          </form>

          <p className="login-security-note">
            <LockKeyhole size={14} />
            {mode === "login"
              ? "Only organization-provisioned accounts can sign in."
              : "Public registration is available only for Field Worker accounts."}
          </p>

          <div className="login-account-switch">
            {mode === "login" ? "Need a Field Worker account?" : "Already registered?"}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setNotice("");
              }}
            >
              {mode === "login" ? "Register here" : "Sign in"}
            </button>
          </div>

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