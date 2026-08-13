import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import API from "../../services/api";

const CARD_COLORS = [
  "#1B6CA8", "#E97316", "#9333EA", "#059669",
  "#DC2626", "#0891B2", "#7C3AED", "#D97706", "#0D9488",
];

export default function Classroom() {
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | "getstarted" | "join" | "create"
  const [joinCode, setJoinCode] = useState("");
  const [createForm, setCreateForm] = useState({ name: "", subject: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadClasses(); }, []);

  async function loadClasses() {
    try {
      setLoading(true);
      const { data } = await API.get("/classroom/classes");
      setClasses(data.classes || data || []);
    } catch (err) {
      console.error("Failed to load classes:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return;
    setSubmitting(true); setError("");
    try {
      await API.post("/classroom/classes/join", { code: joinCode.trim() });
      closeModal(); loadClasses();
    } catch (err) {
      setError(err.response?.data?.message || "Class not found. Check the code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreate() {
    if (!createForm.name.trim()) return;
    setSubmitting(true); setError("");
    try {
      await API.post("/classroom/classes", createForm);
      closeModal(); loadClasses();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create class.");
    } finally {
      setSubmitting(false);
    }
  }

  function closeModal() {
    setModal(null); setError("");
    setJoinCode("");
    setCreateForm({ name: "", subject: "", description: "" });
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar />
      <main style={{ marginLeft: "240px", flex: 1, padding: "32px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", margin: 0 }}>Classroom</h1>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>
              Manage your classes and course materials
            </p>
          </div>
          <button
            onClick={() => setModal("getstarted")}
            style={{ ...btnPrimary, width: "auto" }}
          >
            + Join or Create
          </button>
        </div>

        {/* Class Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px", color: "var(--text-faint)", fontSize: "15px" }}>
            Loading classes...
          </div>
        ) : (() => {
          const teaching = classes.filter(c => c.my_role === "teacher");
          const enrolled = classes.filter(c => c.my_role === "student");

          const ClassCard = ({ cls, idx }) => {
            const color = CARD_COLORS[idx % CARD_COLORS.length];
            const initial = (cls.teacher_name || "T")[0].toUpperCase();
            return (
              <div
                onClick={() => navigate(`/classroom/${cls.id}`)}
                style={classCard}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,0,0,0.15)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"; }}
              >
                {/* Colored header */}
                <div style={{ background: color, padding: "18px 18px 44px", borderRadius: "12px 12px 0 0", position: "relative", overflow: "hidden" }}>
                  {/* Decorative circles */}
                  <div style={{ position: "absolute", right: "-16px", top: "-16px", width: "80px", height: "80px", borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
                  <div style={{ position: "absolute", right: "20px", top: "30px", width: "50px", height: "50px", borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />

                  <div style={{ fontSize: "18px", fontWeight: 700, color: "#fff", marginBottom: "4px", lineHeight: 1.3, position: "relative", zIndex: 1 }}>
                    {cls.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.85)", position: "relative", zIndex: 1 }}>
                    {cls.subject || "General"}
                  </div>

                  {/* Teacher avatar — overlapping */}
                  <div style={{
                    position: "absolute", bottom: "-20px", right: "16px",
                    width: "44px", height: "44px", borderRadius: "50%",
                    background: "rgba(255,255,255,0.9)", border: "3px solid var(--surface)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px", fontWeight: 800, color: color,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.15)", zIndex: 2,
                  }}>
                    {initial}
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: "28px 16px 14px" }}>
                  <div style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 500, marginBottom: "10px" }}>
                    {cls.teacher_name || "Teacher"}
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: "1px solid var(--border)", marginBottom: "10px" }} />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>{cls.student_count || 0}</div>
                        <div style={{ fontSize: "10px", color: "var(--text-faint)" }}>Students</div>
                      </div>
                      {cls.my_role === "teacher" && cls.code && (
                        <>
                          <div style={{ width: "1px", background: "var(--border)" }} />
                          <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "13px", fontWeight: 700, color: color, letterSpacing: "2px" }}>{cls.code}</div>
                            <div style={{ fontSize: "10px", color: "var(--text-faint)" }}>Class Code</div>
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{ background: color + "18", color: color, fontSize: "10px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px" }}>
                      {cls.my_role === "teacher" ? "Teacher" : "Student"}
                    </div>
                  </div>
                </div>
              </div>
            );
          };

          return (
            <div>
              {/* Teaching section */}
              {teaching.length > 0 && (
                <div style={{ marginBottom: "32px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#3B37CC", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>
                    👨‍🏫 Teaching ({teaching.length})
                  </div>
                  <div style={gridStyle}>
                    {teaching.map((cls, idx) => <ClassCard key={cls.id} cls={cls} idx={idx} />)}
                  </div>
                </div>
              )}

              {/* Enrolled section */}
              {enrolled.length > 0 && (
                <div style={{ marginBottom: "32px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "14px" }}>
                    🎓 Enrolled ({enrolled.length})
                  </div>
                  <div style={gridStyle}>
                    {enrolled.map((cls, idx) => <ClassCard key={cls.id} cls={cls} idx={idx + teaching.length} />)}
                  </div>
                </div>
              )}

              {/* Add class card */}
              <div style={gridStyle}>
                <div
                  onClick={() => setModal("getstarted")}
                  style={addCard}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"}
                  onMouseLeave={e => e.currentTarget.style.background = "var(--surface)"}
                >
                  <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", color: "var(--text-faint)" }}>+</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-muted)" }}>Join or Create Class</div>
                  <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>Start a new learning journey</div>
                </div>
              </div>
            </div>
          );
        })()}

        {classes.length === 0 && !loading && (
          <div style={{ textAlign: "center", paddingTop: "12px" }}>
            <p style={{ fontSize: "14px", color: "var(--text-faint)" }}>
              No classes yet. Click "+ Join or Create" to get started!
            </p>
          </div>
        )}
      </main>

      {/* Modal overlay */}
      {modal && (
        <div style={overlay} onClick={closeModal}>
          <div onClick={e => e.stopPropagation()} style={modalBox}>

            {/* GET STARTED */}
            {modal === "getstarted" && (
              <div style={{ textAlign: "center" }}>
                <h2 style={{ fontSize: "22px", fontWeight: 700, color: "var(--text)", margin: "0 0 8px" }}>Get Started</h2>
                <p style={{ fontSize: "14px", color: "var(--text-muted)", marginBottom: "32px" }}>
                  Join an existing class or create your own.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                  <button style={btnPrimary} onClick={() => { setModal("join"); setError(""); }}>
                    Join a Class →
                  </button>
                  <button style={btnOutline} onClick={() => { setModal("create"); setError(""); }}>
                    + Create a Class
                  </button>
                </div>
                <button onClick={closeModal} style={{ background: "none", border: "none", color: "var(--text-faint)", fontSize: "14px", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            )}

            {/* JOIN A CLASS */}
            {modal === "join" && (
              <div>
                <div style={{ textAlign: "center", marginBottom: "24px" }}>
                  <div style={{ fontSize: "52px", marginBottom: "10px" }}>🎓</div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
                    Join a Class
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    Enter the class code provided by your teacher.
                  </p>
                </div>
                <label style={labelStyle}>Class Code</label>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABC-123"
                  style={inputStyle}
                  onKeyDown={e => e.key === "Enter" && handleJoin()}
                  autoFocus
                />
                {error && <p style={{ color: "#ef4444", fontSize: "13px", margin: "8px 0 0" }}>{error}</p>}
                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <button onClick={() => { setModal("getstarted"); setError(""); }} style={{ ...btnOutline, flex: 1 }}>
                    ← Back
                  </button>
                  <button
                    onClick={handleJoin}
                    disabled={submitting || !joinCode.trim()}
                    style={{ ...btnPrimary, flex: 1, opacity: (!joinCode.trim() || submitting) ? 0.6 : 1 }}
                  >
                    {submitting ? "Joining..." : "Join Class →"}
                  </button>
                </div>
              </div>
            )}

            {/* CREATE A CLASS */}
            {modal === "create" && (
              <div>
                <div style={{ textAlign: "center", marginBottom: "24px" }}>
                  <div style={{ fontSize: "52px", marginBottom: "10px" }}>📚</div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
                    Create a Class
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    Set up your classroom in seconds.
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "4px" }}>
                  <div>
                    <label style={labelStyle}>Class Name *</label>
                    <input
                      value={createForm.name}
                      onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Java Programming 101"
                      style={inputStyle}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Subject</label>
                    <input
                      value={createForm.subject}
                      onChange={e => setCreateForm(f => ({ ...f, subject: e.target.value }))}
                      placeholder="e.g. Computer Science"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Description</label>
                    <textarea
                      value={createForm.description}
                      onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Brief class description..."
                      style={{ ...inputStyle, height: "72px", resize: "none" }}
                    />
                  </div>
                </div>
                {error && <p style={{ color: "#ef4444", fontSize: "13px", margin: "8px 0 0" }}>{error}</p>}
                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                  <button onClick={() => { setModal("getstarted"); setError(""); }} style={{ ...btnOutline, flex: 1 }}>
                    ← Back
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={submitting || !createForm.name.trim()}
                    style={{ ...btnPrimary, flex: 1, opacity: (!createForm.name.trim() || submitting) ? 0.6 : 1 }}
                  >
                    {submitting ? "Creating..." : "Create Class →"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: "20px",
};

const classCard = {
  borderRadius: "12px",
  overflow: "visible",
  cursor: "pointer",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  transition: "transform 0.2s, box-shadow 0.2s",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const teacherAvatarStyle = {
  width: "26px", height: "26px", borderRadius: "50%",
  background: "var(--border)", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "var(--text-muted)",
};

const addCard = {
  borderRadius: "12px",
  border: "2px dashed var(--border)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  cursor: "pointer",
  minHeight: "170px",
  background: "var(--surface)",
  transition: "background 0.15s",
};

const overlay = {
  position: "fixed", inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1000,
};

const modalBox = {
  background: "var(--surface)",
  borderRadius: "16px",
  padding: "32px",
  width: "400px",
  maxWidth: "92vw",
};

const btnPrimary = {
  background: "#3B37CC", color: "#fff",
  padding: "11px 20px", borderRadius: "10px",
  fontSize: "14px", fontWeight: 600, border: "none",
  cursor: "pointer", width: "100%",
};

const btnOutline = {
  background: "var(--surface)", color: "#3B37CC",
  padding: "11px 20px", borderRadius: "10px",
  fontSize: "14px", fontWeight: 600,
  border: "2px solid #3B37CC", cursor: "pointer", width: "100%",
};

const labelStyle = {
  display: "block", fontSize: "13px", fontWeight: 600,
  color: "var(--text-muted)", marginBottom: "6px",
};

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: "8px",
  border: "1px solid var(--border)", fontSize: "14px", outline: "none",
  boxSizing: "border-box", background: "var(--surface)", color: "var(--text)",
};
