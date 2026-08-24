import { useEffect, useState } from "react";
import axios from "axios";

const ADMIN_API = axios.create({ baseURL: "http://localhost:5001/api" });

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "20px 24px", flex: 1, minWidth: "160px" }}>
      <div style={{ fontSize: "28px", marginBottom: "8px" }}>{icon}</div>
      <div style={{ fontSize: "28px", fontWeight: 800, color: color || "#1a1a2e", lineHeight: 1 }}>{value ?? "—"}</div>
      <div style={{ fontSize: "13px", fontWeight: 600, color: "#374151", marginTop: "4px" }}>{label}</div>
      {sub && <div style={{ fontSize: "11px", color: "#9ca3af", marginTop: "2px" }}>{sub}</div>}
    </div>
  );
}

function Badge({ text, color, bg }) {
  return (
    <span style={{ fontSize: "11px", fontWeight: 700, color, background: bg, padding: "2px 8px", borderRadius: "10px" }}>{text}</span>
  );
}

export default function AdminDashboard() {
  const [secret, setSecret] = useState(() => sessionStorage.getItem("nova_admin_secret") || "");
  const [input, setInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleLogin(e) {
    e.preventDefault();
    const val = input.trim();
    if (!val) return;
    setLoading(true);
    setAuthError("");
    ADMIN_API.get("/admin/stats", { headers: { "x-admin-secret": val } })
      .then(r => { setStats(r.data); setSecret(val); sessionStorage.setItem("nova_admin_secret", val); })
      .catch(() => setAuthError("Password မမှန်ဘူး — ထပ်ကြိုးစားပါ"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!secret) return;
    setLoading(true);
    ADMIN_API.get("/admin/stats", { headers: { "x-admin-secret": secret } })
      .then(r => setStats(r.data))
      .catch(e => {
        if (e.response?.status === 401) { sessionStorage.removeItem("nova_admin_secret"); setSecret(""); }
        else setError(e.response?.data?.error || "Failed to load stats");
      })
      .finally(() => setLoading(false));
  }, [secret]);

  // Password gate
  if (!secret || (!stats && !loading)) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f0f1a", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, -apple-system, sans-serif" }}>
        <div style={{ background: "#1a1a2e", borderRadius: "16px", padding: "40px 48px", width: "360px", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
          <div style={{ marginBottom: "28px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>📊</div>
            <div style={{ fontSize: "20px", fontWeight: 800, color: "#fff" }}>
              <span style={{ color: "var(--primary-light)" }}>Nova</span> Class
            </div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>Admin Dashboard</div>
          </div>
          <form onSubmit={handleLogin}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#9ca3af", display: "block", marginBottom: "6px" }}>ADMIN PASSWORD</label>
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
              style={{ width: "100%", padding: "11px 14px", borderRadius: "8px", border: `1px solid ${authError ? "#ef4444" : "#374151"}`, background: "#0f0f1a", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box", marginBottom: authError ? "6px" : "16px" }}
            />
            {authError && <div style={{ fontSize: "12px", color: "#ef4444", marginBottom: "14px" }}>{authError}</div>}
            <button type="submit" disabled={loading || !input.trim()}
              style={{ width: "100%", padding: "11px", borderRadius: "8px", background: loading ? "#374151" : "var(--primary)", color: "#fff", border: "none", fontSize: "14px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer" }}>
              {loading ? "Checking..." : "Enter Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const u = stats?.users;
  const c = stats?.content;
  const ai = stats?.ai;

  return (
    <div style={{ minHeight: "100vh", background: "#f8f9fa", fontFamily: "Inter, -apple-system, sans-serif" }}>
      {/* Top bar */}
      <div style={{ background: "#1a1a2e", color: "#fff", padding: "0 32px", height: "60px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "1px", height: "20px", background: "#374151" }} />
          <span style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.3px" }}>
            <span style={{ color: "var(--primary-light)" }}>Nova</span> Class
          </span>
          <span style={{ fontSize: "12px", color: "#6b7280", background: "#374151", padding: "2px 8px", borderRadius: "6px" }}>Admin Dashboard</span>
        </div>
        <div style={{ fontSize: "12px", color: "#6b7280" }}>
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </div>
      </div>

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "80px", color: "#6b7280", fontSize: "16px" }}>
            Loading statistics...
          </div>
        )}
        {error && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "16px", color: "#dc2626", marginBottom: "24px" }}>
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* ── Row 1: Overview stat cards ── */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>Overview</div>
              <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                <StatCard icon="👥" label="Total Users" value={u?.total} sub={`+${u?.new_this_week ?? 0} this week`} color="var(--primary)" />
                <StatCard icon="🏫" label="Classes" value={c?.total_classes} color="#0f766e" />
                <StatCard icon="📄" label="Materials" value={c?.total_materials} sub={`+${c?.materials_this_week ?? 0} this week`} color="var(--primary)" />
                <StatCard icon="📝" label="Assignments" value={c?.total_assignments} color="#b45309" />
                <StatCard icon="✅" label="Submissions" value={c?.total_submissions} sub={`${c?.graded_submissions ?? 0} graded`} color="#137333" />
              </div>
            </div>

            {/* ── Row 2: Users + Classes side by side ── */}
            <div style={{ display: "flex", gap: "20px", marginTop: "28px", alignItems: "flex-start" }}>

              {/* Left: Users */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>Users</div>

                {/* Role breakdown */}
                <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "16px 20px", marginBottom: "14px", display: "flex", gap: "24px" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "32px", fontWeight: 800, color: "var(--primary)" }}>{u?.teachers ?? 0}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>Teachers</div>
                  </div>
                  <div style={{ width: "1px", background: "#f3f4f6" }} />
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "32px", fontWeight: 800, color: "#0f766e" }}>{u?.students ?? 0}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600 }}>Students</div>
                  </div>
                  <div style={{ width: "1px", background: "#f3f4f6" }} />
                  <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
                    {/* Simple bar */}
                    <div style={{ width: "100%", height: "12px", background: "#f3f4f6", borderRadius: "6px", overflow: "hidden" }}>
                      <div style={{
                        width: "100%",
                        height: "100%", background: "var(--primary)", borderRadius: "6px",
                        transform: `scaleX(${u?.total ? u.teachers / u.total : 0})`,
                        transformOrigin: "left",
                        transition: "transform 0.6s ease"
                      }} />
                    </div>
                  </div>
                </div>

                {/* Recent users table */}
                <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid #f3f4f6", fontSize: "13px", fontWeight: 700, color: "#374151" }}>
                    Recent Signups
                  </div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        <th style={{ padding: "10px 20px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: "11px", textTransform: "uppercase" }}>Name</th>
                        <th style={{ padding: "10px 12px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: "11px", textTransform: "uppercase" }}>Role</th>
                        <th style={{ padding: "10px 20px 10px 12px", textAlign: "right", fontWeight: 600, color: "#6b7280", fontSize: "11px", textTransform: "uppercase" }}>Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentUsers.map((u, i) => (
                        <tr key={u.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                          <td style={{ padding: "10px 20px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: u.role === "teacher" ? "var(--primary-tint)" : "#e0f2fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: u.role === "teacher" ? "var(--primary)" : "#0369a1", flexShrink: 0 }}>
                                {u.name?.[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: "#1a1a2e" }}>{u.name}</div>
                                <div style={{ fontSize: "11px", color: "#9ca3af" }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <Badge
                              text={u.role}
                              color={u.role === "teacher" ? "var(--primary)" : "#0369a1"}
                              bg={u.role === "teacher" ? "var(--primary-tint)" : "#e0f2fe"}
                            />
                          </td>
                          <td style={{ padding: "10px 20px 10px 12px", textAlign: "right", color: "#6b7280", fontSize: "12px" }}>
                            {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Classes */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>Classes</div>
                <div style={{ background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "#fafafa" }}>
                        <th style={{ padding: "10px 20px", textAlign: "left", fontWeight: 600, color: "#6b7280", fontSize: "11px", textTransform: "uppercase" }}>Class</th>
                        <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 600, color: "#6b7280", fontSize: "11px" }}>👥</th>
                        <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 600, color: "#6b7280", fontSize: "11px" }}>📄</th>
                        <th style={{ padding: "10px 8px", textAlign: "center", fontWeight: 600, color: "#6b7280", fontSize: "11px" }}>📝</th>
                        <th style={{ padding: "10px 20px 10px 8px", textAlign: "center", fontWeight: 600, color: "#6b7280", fontSize: "11px" }}>✅</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.classes.map((cl, i) => (
                        <tr key={cl.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                          <td style={{ padding: "12px 20px" }}>
                            <div style={{ fontWeight: 600, color: "#1a1a2e" }}>{cl.name}</div>
                            <div style={{ fontSize: "11px", color: "#9ca3af" }}>{cl.subject}</div>
                          </td>
                          <td style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: "#374151" }}>{cl.student_count}</td>
                          <td style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: "var(--primary)" }}>{cl.material_count}</td>
                          <td style={{ padding: "12px 8px", textAlign: "center", fontWeight: 700, color: "#b45309" }}>{cl.assignment_count}</td>
                          <td style={{ padding: "12px 20px 12px 8px", textAlign: "center", fontWeight: 700, color: "#137333" }}>{cl.submission_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: "10px 20px", borderTop: "1px solid #f3f4f6", display: "flex", gap: "16px", fontSize: "11px", color: "#9ca3af" }}>
                    <span>👥 Students</span>
                    <span>📄 Materials</span>
                    <span>📝 Assignments</span>
                    <span>✅ Submissions</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Row 3: AI feature usage ── */}
            <div style={{ marginTop: "28px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "12px" }}>AI Feature Usage</div>
              <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
                {[
                  { icon: "💬", label: "AI Chat (Study Mentor)", value: ai?.ai_chats, color: "var(--primary)", bg: "var(--primary-tint)" },
                  { icon: "📋", label: "Auto Summaries", value: ai?.ai_summaries, color: "#0f766e", bg: "#d1fae5" },
                  { icon: "🖊️", label: "PDF Highlights", value: ai?.ai_highlights, color: "var(--primary)", bg: "var(--primary-tint)" },
                  { icon: "🔍", label: "Highlight Analyses", value: ai?.ai_highlight_analyses, color: "#b45309", bg: "#fef3c7" },
                  { icon: "🤖", label: "K_MATE Sessions", value: ai?.kmate_sessions, color: "#0369a1", bg: "#e0f2fe" },
                ].map(f => (
                  <div key={f.label} style={{ flex: 1, minWidth: "140px", background: "#fff", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "16px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
                      {f.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: "22px", fontWeight: 800, color: f.color, lineHeight: 1 }}>{f.value ?? 0}</div>
                      <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: 600, marginTop: "2px" }}>{f.label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
