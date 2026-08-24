import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import API from "../../services/api";

const CARD_COLORS = [
  "var(--primary)", "#E97316", "var(--primary)", "#059669",
  "#E05252", "#0891B2", "#9333EA", "#D97706", "#0D9488",
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
            const isTeacher = cls.my_role === "teacher";
            return (
              <div
                onClick={() => navigate(`/classroom/${cls.id}`)}
                style={classCard}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 20px ${color}22`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                {/* Left color accent */}
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "4px", background: color, borderRadius: "12px 0 0 12px" }} />

                <div style={{ padding: "18px 18px 18px 22px" }}>
                  {/* Top row: name + role badge */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "6px" }}>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", lineHeight: 1.3, flex: 1 }}>
                      {cls.name}
                    </div>
                    <span style={{ flexShrink: 0, fontSize: "10px", fontWeight: 700, color: color, background: color + "18", padding: "3px 9px", borderRadius: "20px", marginTop: "2px" }}>
                      {isTeacher ? "Teacher" : "Student"}
                    </span>
                  </div>

                  {/* Subject */}
                  <div style={{ fontSize: "12px", color: "var(--text-faint)", marginBottom: "16px" }}>
                    {cls.subject || "General"}
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: "1px solid var(--border)", marginBottom: "14px" }} />

                  {/* Bottom row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    {/* Teacher info */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color }}>
                        {initial}
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>{cls.teacher_name || "Teacher"}</span>
                    </div>

                    {/* Right: student count or class code */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {isTeacher && cls.code && (
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "1.5px", fontFamily: "monospace" }}>{cls.code}</span>
                      )}
                      <span style={{ fontSize: "12px", color: "var(--text-faint)" }}>
                        {cls.student_count || 0} student{(cls.student_count || 0) !== 1 ? "s" : ""}
                      </span>
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
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>Teaching</span>
                    <span style={{ background: "var(--surface-alt)", color: "var(--text-muted)", borderRadius: "20px", padding: "1px 8px", fontSize: "11px", fontWeight: 600, letterSpacing: 0, textTransform: "none" }}>{teaching.length}</span>
                  </div>
                  <div style={gridStyle}>
                    {teaching.map((cls, idx) => <ClassCard key={cls.id} cls={cls} idx={idx} />)}
                  </div>
                </div>
              )}

              {/* Enrolled section */}
              {enrolled.length > 0 && (
                <div style={{ marginBottom: "32px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>Enrolled</span>
                    <span style={{ background: "var(--surface-alt)", color: "var(--text-muted)", borderRadius: "20px", padding: "1px 8px", fontSize: "11px", fontWeight: 600, letterSpacing: 0, textTransform: "none" }}>{enrolled.length}</span>
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
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "var(--primary-tint)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "var(--text-faint)" }}>+</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-muted)" }}>Join or Create Class</div>
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
  overflow: "hidden",
  cursor: "pointer",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  transition: "border-color 0.2s, box-shadow 0.2s",
  position: "relative",
};

const teacherAvatarStyle = {
  width: "26px", height: "26px", borderRadius: "50%",
  background: "var(--border)", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "var(--text-muted)",
};

const addCard = {
  borderRadius: "12px",
  border: "1.5px dashed var(--border)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  cursor: "pointer",
  minHeight: "100px",
  background: "transparent",
  transition: "border-color 0.15s, background 0.15s",
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
  background: "var(--primary)", color: "#fff",
  padding: "11px 20px", borderRadius: "10px",
  fontSize: "14px", fontWeight: 600, border: "none",
  cursor: "pointer", width: "100%",
};

const btnOutline = {
  background: "var(--surface)", color: "var(--primary)",
  padding: "11px 20px", borderRadius: "10px",
  fontSize: "14px", fontWeight: 600,
  border: "2px solid var(--primary)", cursor: "pointer", width: "100%",
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
