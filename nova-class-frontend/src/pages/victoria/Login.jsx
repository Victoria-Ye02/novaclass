import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";

// OAuth client IDs are public by design (embedded in frontend code, verified
// against the corresponding secret only on Google's own servers), so this is
// not a value that needs to live in an env file.
const GOOGLE_CLIENT_ID = "758626044822-0jl8fkqk0l1t15d4loac8tl9k89rk5d3.apps.googleusercontent.com";

// The API reports failures as { error: "..." }, so reading `message` here would
// swallow every real reason behind the generic fallback. A request that never
// reached the server has no response at all — say so rather than blaming credentials.
function authErrorText(err, fallback) {
  if (!err.response) return "Cannot reach the server. Is the backend running on port 5001?";
  return err.response.data?.error || err.response.data?.message || fallback;
}

export default function Login() {
  const [tab, setTab]         = useState("login");
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [name, setName]       = useState("");
  const [username, setUsername] = useState("");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [googleError, setGoogleError] = useState("");
  const navigate = useNavigate();
  const googleBtnRef = useRef(null);

  // Stable identity matters here: it's a dependency of the Google sign-in
  // effect below, which must only load/initialize the script once on mount.
  const storeSessionAndGo = useCallback((data, fallbackEmail) => {
    localStorage.setItem("nova_token", data.token);
    localStorage.setItem("nova_name", data.user.name);
    localStorage.setItem("nova_role", data.user.role || "student");
    localStorage.setItem("nova_email", (data.user.email || fallbackEmail).toLowerCase());
    navigate("/");
  }, [navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await API.post("/auth/login", { email: email.trim().toLowerCase(), password });
      storeSessionAndGo(res.data, email);
    } catch (err) {
      setError(authErrorText(err, "Invalid ID or password. Please try again."));
    }
    setLoading(false);
  }

  useEffect(() => {
    // Captured fresh on every `tab` change, so a credential response is always
    // attributed to whichever tab was active when the button was rendered:
    // the Login tab must never silently create an account, and the Sign Up
    // tab is the only place that's allowed to.
    async function handleGoogleCredential(response) {
      setGoogleError("");
      try {
        const intent = tab === "register" ? "register" : "login";
        const res = await API.post("/auth/google", { credential: response.credential, intent });
        storeSessionAndGo(res.data, "");
      } catch (err) {
        setGoogleError(authErrorText(err, tab === "register"
          ? "Google sign-up failed. Please try again."
          : "No account found for this Google email. Please sign up first."));
      }
    }

    let cancelled = false;
    const scriptId = "google-identity-services";
    function renderGoogleButton() {
      if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: "standard", theme: "outline", size: "large",
        text: tab === "register" ? "signup_with" : "continue_with",
        shape: "rectangular", width: 336,
      });
    }

    if (window.google?.accounts?.id) {
      renderGoogleButton();
    } else if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = renderGoogleButton;
      script.onerror = () => !cancelled && setGoogleError("Couldn't load Google Sign-In. Check your connection.");
      document.body.appendChild(script);
    } else {
      document.getElementById(scriptId).addEventListener("load", renderGoogleButton, { once: true });
    }

    return () => { cancelled = true; };
  }, [storeSessionAndGo, tab]);

  async function handleRegister(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await API.post("/auth/register", {
        name, email: email.trim().toLowerCase(), username: username.trim().toLowerCase(), password,
      });
      setSuccess("Registered! Please login.");
      setTimeout(() => { setTab("login"); setSuccess(""); }, 1500);
    } catch (err) {
      setError(authErrorText(err, "Registration failed."));
    }
    setLoading(false);
  }

  return (
    <div style={s.page}>
      {/* Left Panel */}
      <div style={s.left}>
        <div style={s.leftContent}>
          <h1 style={s.brand}>NOVA CLASS</h1>
          <h2 style={s.tagline}>Empowering the Next Generation</h2>
          <p style={s.desc}>
            A sophisticated ecosystem designed for academic precision and administrative excellence.
          </p>
          <div style={s.badges}>
            <span style={s.badge}>✦ Precision Learning</span>
            <span style={s.badge}>🛡 Secure Access</span>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div style={s.right}>
        <div style={s.card}>
          <h2 style={s.welcome}>Welcome Back</h2>
          <p style={s.sub}>Please enter your credentials to continue.</p>

          {/* Tab Toggle */}
          <div style={s.tabRow}>
            <button
              style={{ ...s.tab, ...(tab === "login" ? s.tabActive : {}) }}
              onClick={() => { setTab("login"); setError(""); }}
            >Student Login</button>
            <button
              style={{ ...s.tab, ...(tab === "register" ? s.tabActive : {}) }}
              onClick={() => { setTab("register"); setError(""); }}
            >Sign Up</button>
          </div>

          {/* Error / Success */}
          {error   && <div style={s.errorBox}>⚠️ {error}</div>}
          {success && <div style={s.successBox}>✅ {success}</div>}

          {/* Login Form */}
          {tab === "login" && (
            <form onSubmit={handleLogin}>
              <div style={s.field}>
                <label style={s.label}>Email / ID</label>
                <div style={s.inputWrap}>
                  <span style={s.inputIcon}>👤</span>
                  <input
                    style={{ ...s.input, ...(error ? s.inputError : {}) }}
                    type="text" autoComplete="username" placeholder="Enter your email or ID"
                    value={email} onChange={e => setEmail(e.target.value)} required
                  />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Password</label>
                <div style={s.inputWrap}>
                  <span style={s.inputIcon}>🔒</span>
                  <input
                    style={{ ...s.input, ...(error ? s.inputError : {}) }}
                    type={showPass ? "text" : "password"} placeholder="••••••••"
                    value={password} onChange={e => setPass(e.target.value)} required
                  />
                  <span style={s.eyeIcon} onClick={() => setShowPass(!showPass)}>
                    {showPass ? "🙈" : "👁"}
                  </span>
                </div>
              </div>
              <button style={s.signInBtn} type="submit" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}

          {/* Register Form */}
          {tab === "register" && (
            <form onSubmit={handleRegister}>
              <div style={s.field}>
                <label style={s.label}>Full Name</label>
                <div style={s.inputWrap}>
                  <span style={s.inputIcon}>👤</span>
                  <input style={s.input} type="text" placeholder="Your name"
                    value={name} onChange={e => setName(e.target.value)} required />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Email</label>
                <div style={s.inputWrap}>
                  <span style={s.inputIcon}>✉️</span>
                  <input style={s.input} type="email" placeholder="your@email.com"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>ID (at least 6 characters)</label>
                <div style={s.inputWrap}>
                  <span style={s.inputIcon}>🆔</span>
                  <input style={s.input} type="text" autoComplete="username"
                    placeholder="Choose an ID for logging in" minLength={6}
                    value={username} onChange={e => setUsername(e.target.value)} required />
                </div>
              </div>
              <div style={s.field}>
                <label style={s.label}>Password</label>
                <div style={s.inputWrap}>
                  <span style={s.inputIcon}>🔒</span>
                  <input style={s.input} type="password" placeholder="••••••••"
                    value={password} onChange={e => setPass(e.target.value)} required />
                </div>
              </div>
              <button style={s.signInBtn} type="submit" disabled={loading}>
                {loading ? "Registering..." : "Create Account"}
              </button>
            </form>
          )}

          <div style={s.divider}><span>or continue with</span></div>
          {googleError && <div style={s.errorBox}>⚠️ {googleError}</div>}
          <div ref={googleBtnRef} style={s.googleBtnSlot} />
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { display: "flex", minHeight: "100vh" },
  left: {
    flex: 1,
    background: "linear-gradient(135deg, var(--primary) 0%, #6c35b5 60%, #9333ea 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "48px", position: "relative", overflow: "hidden",
  },
  leftContent: { color: "#fff", maxWidth: "420px", zIndex: 1 },
  brand: { fontSize: "42px", fontWeight: 800, marginBottom: "12px", letterSpacing: "-1px" },
  tagline: { fontSize: "24px", fontWeight: 700, marginBottom: "16px", lineHeight: 1.3 },
  desc: { fontSize: "15px", opacity: 0.85, lineHeight: 1.7, marginBottom: "32px" },
  badges: { display: "flex", gap: "16px", flexWrap: "wrap" },
  badge: {
    background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)",
    padding: "8px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: 500,
  },
  right: {
    width: "480px", background: "var(--bg)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "40px",
  },
  card: { width: "100%", maxWidth: "400px" },
  welcome: { fontSize: "28px", fontWeight: 700, color: "var(--primary)", marginBottom: "6px" },
  sub: { fontSize: "14px", color: "var(--text-muted)", marginBottom: "24px" },
  tabRow: { display: "flex", background: "var(--border)", borderRadius: "10px", padding: "4px", marginBottom: "20px" },
  tab: {
    flex: 1, padding: "8px", borderRadius: "8px", fontSize: "13px",
    fontWeight: 600, background: "transparent", color: "var(--text-muted)", border: "none",
  },
  tabActive: { background: "var(--surface)", color: "var(--primary)", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" },
  errorBox: {
    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
    padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px",
  },
  successBox: {
    background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e",
    padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px",
  },
  field: { marginBottom: "16px" },
  label: { display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" },
  inputWrap: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: { position: "absolute", left: "12px", fontSize: "14px" },
  eyeIcon: { position: "absolute", right: "12px", fontSize: "14px", cursor: "pointer" },
  input: {
    width: "100%", padding: "11px 40px", background: "var(--surface)",
    border: "1.5px solid var(--border)", borderRadius: "10px", fontSize: "14px", color: "var(--text)",
  },
  inputError: { borderColor: "#ef4444" },
  signInBtn: {
    width: "100%", padding: "13px", background: "var(--primary)", color: "#fff",
    borderRadius: "10px", fontSize: "15px", fontWeight: 700, border: "none",
    marginTop: "8px", transition: "background 0.2s",
  },
  divider: {
    textAlign: "center", margin: "20px 0", color: "var(--text-faint)", fontSize: "13px",
    borderTop: "1px solid var(--border)", paddingTop: "20px",
  },
  googleBtnSlot: {
    display: "flex", justifyContent: "center", minHeight: "40px",
  },
};
