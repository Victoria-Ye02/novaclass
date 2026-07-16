import { useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../../services/api";

export default function Login() {
  const [tab, setTab]         = useState("login");
  const [email, setEmail]     = useState("");
  const [password, setPass]   = useState("");
  const [name, setName]       = useState("");
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await API.post("/auth/login", { email, password });
      localStorage.setItem("nova_token", res.data.token);
      localStorage.setItem("nova_name", res.data.user.name);
      localStorage.setItem("nova_role", res.data.user.role || "student");
      localStorage.setItem("nova_email", (res.data.user.email || email).toLowerCase());
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid ID or password. Please try again.");
    }
    setLoading(false);
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await API.post("/auth/register", { name, email, password });
      setSuccess("Registered! Please login.");
      setTimeout(() => { setTab("login"); setSuccess(""); }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed.");
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
                    type="email" placeholder="Enter your email"
                    value={email} onChange={e => setEmail(e.target.value)} required
                  />
                </div>
              </div>
              <div style={s.field}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <label style={s.label}>Password</label>
                  <span style={s.forgotLink}>Forgot Password?</span>
                </div>
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
          <button style={s.googleBtn}>
            <span style={{ fontSize: "18px" }}>G</span> Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: { display: "flex", minHeight: "100vh" },
  left: {
    flex: 1,
    background: "linear-gradient(135deg, #3B37CC 0%, #6c35b5 60%, #9333ea 100%)",
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
    width: "480px", background: "#f5f5f5",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "40px",
  },
  card: { width: "100%", maxWidth: "400px" },
  welcome: { fontSize: "28px", fontWeight: 700, color: "#3B37CC", marginBottom: "6px" },
  sub: { fontSize: "14px", color: "#6b7280", marginBottom: "24px" },
  tabRow: { display: "flex", background: "#e5e7eb", borderRadius: "10px", padding: "4px", marginBottom: "20px" },
  tab: {
    flex: 1, padding: "8px", borderRadius: "8px", fontSize: "13px",
    fontWeight: 600, background: "transparent", color: "#6b7280", border: "none",
  },
  tabActive: { background: "#fff", color: "#3B37CC", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" },
  errorBox: {
    background: "#fef2f2", border: "1px solid #fca5a5", color: "#dc2626",
    padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px",
  },
  successBox: {
    background: "#f0fdf4", border: "1px solid #86efac", color: "#16a34a",
    padding: "10px 14px", borderRadius: "8px", fontSize: "13px", marginBottom: "16px",
  },
  field: { marginBottom: "16px" },
  label: { display: "block", fontSize: "13px", fontWeight: 600, color: "#374151", marginBottom: "6px" },
  inputWrap: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: { position: "absolute", left: "12px", fontSize: "14px" },
  eyeIcon: { position: "absolute", right: "12px", fontSize: "14px", cursor: "pointer" },
  input: {
    width: "100%", padding: "11px 40px", background: "#fff",
    border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "14px", color: "#1a1a2e",
  },
  inputError: { borderColor: "#ef4444" },
  forgotLink: { fontSize: "12px", color: "#3B37CC", cursor: "pointer", fontWeight: 500 },
  signInBtn: {
    width: "100%", padding: "13px", background: "#3B37CC", color: "#fff",
    borderRadius: "10px", fontSize: "15px", fontWeight: 700, border: "none",
    marginTop: "8px", transition: "background 0.2s",
  },
  divider: {
    textAlign: "center", margin: "20px 0", color: "#9ca3af", fontSize: "13px",
    borderTop: "1px solid #e5e7eb", paddingTop: "20px",
  },
  googleBtn: {
    width: "100%", padding: "11px", background: "#fff",
    border: "1.5px solid #e5e7eb", borderRadius: "10px",
    fontSize: "14px", fontWeight: 600, color: "#374151",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
  },
};
