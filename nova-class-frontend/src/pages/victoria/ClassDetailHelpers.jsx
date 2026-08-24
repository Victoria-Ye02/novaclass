import { useState, useEffect } from "react";
import API from "../../services/api";
import CommentContent from "../../components/CommentContent";
import Icon from "../../components/Icon";

// Wide file card — thumbnail slot on the right, fixed height. Must be a
// stable module-level component (not redefined inside a parent's render
// body): a fresh function identity on every render makes React remount it,
// which reloads any <object>/<img> inside — the PDF thumbnail visibly
// flickers on every re-render of the page that renders this, not just ones
// caused by this component itself.
export function FileCard({ name, label, thumbContent, onClick, href }) {
  const card = (
    <div
      onClick={onClick}
      style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", cursor: "pointer", background: "var(--surface)", transition: "box-shadow 0.15s", textDecoration: "none", height: "90px" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
    >
      <div style={{ flex: 1, padding: "12px 16px", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "3px" }}>{name}</div>
        <div style={{ fontSize: "11px", color: "var(--text-faint)" }}>{label}</div>
      </div>
      <div style={{ width: "110px", flexShrink: 0, background: "var(--surface-alt)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderLeft: "1px solid var(--border)" }}>
        {thumbContent}
      </div>
    </div>
  );
  if (href) return <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: "none", display: "block", height: "90px" }}>{card}</a>;
  return card;
}

export function extLabel(ext) {
  const e = (ext || "").toLowerCase();
  if (e === "pdf") return "PDF";
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(e)) return "Image";
  if (e === "docx" || e === "doc") return "Word";
  if (e === "pptx" || e === "ppt") return "PowerPoint";
  return "File";
}

// ── Inline "+ Add Assignment" form on a material's detail page. Owns its own
// input state so typing doesn't re-render the whole ClassDetail page — that
// page also renders the material's PDF thumbnail, which visibly flickers
// (reloads) on every keystroke if its parent re-renders while typing here.
export function MaterialAssignmentForm({ classId, materialId, onCreated, onCancel }) {
  const [form, setForm] = useState({ title: "", instructions: "", due_date: "", points: 100 });
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("instructions", form.instructions);
      if (form.due_date) fd.append("due_date", form.due_date);
      fd.append("points", form.points);
      fd.append("material_id", materialId);
      const { data } = await API.post(`/classroom/classes/${classId}/assignments`, fd);
      onCreated(data);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create assignment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--primary-tint)", borderRadius: "12px", padding: "16px", marginBottom: "14px" }}>
      <input placeholder="Assignment title *" value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", marginBottom: "10px", boxSizing: "border-box", background: "var(--surface)", color: "var(--text)" }} />
      <textarea placeholder="Instructions (optional)" value={form.instructions}
        onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
        rows={2}
        style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", fontSize: "13px", marginBottom: "10px", resize: "vertical", boxSizing: "border-box", background: "var(--surface)", color: "var(--text)" }} />
      <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "11px", color: "var(--text-faint)", marginBottom: "4px" }}>Due date</div>
          <input type="datetime-local" value={form.due_date}
            onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
            style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 10px", fontSize: "12px", boxSizing: "border-box", background: "var(--surface)", color: "var(--text)" }} />
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "var(--text-faint)", marginBottom: "4px" }}>Points</div>
          <input type="number" value={form.points} min={0} max={1000}
            onChange={e => setForm(f => ({ ...f, points: e.target.value }))}
            style={{ width: "80px", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 10px", fontSize: "12px", boxSizing: "border-box", background: "var(--surface)", color: "var(--text)" }} />
        </div>
      </div>
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
        <button onClick={onCancel}
          style={{ fontSize: "12px", color: "var(--text-faint)", background: "none", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 14px", cursor: "pointer" }}>Cancel</button>
        <button onClick={create} disabled={saving || !form.title.trim()}
          style={{ fontSize: "12px", fontWeight: 700, color: "#fff", background: "var(--primary)", border: "none", borderRadius: "8px", padding: "6px 16px", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
          {saving ? "Saving…" : "Create"}
        </button>
      </div>
    </div>
  );
}

// ── Submission Comments (inline, for teacher's assignment detail) ──
export function SubmissionComments({ assignId, studentId, studentName, myName, myId }) {
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!assignId) return;
    API.get(`/classroom/assignments/${assignId}/comments?student=${studentId}`)
      .then(r => setComments((r.data || []).filter(c => !c.target_student_id || c.target_student_id === studentId || c.author_id === studentId)))
      .catch(() => {});
  }, [assignId, studentId]);

  async function send() {
    if (!input.trim()) return;
    setSending(true);
    try {
      const { data } = await API.post(`/classroom/assignments/${assignId}/comments`, {
        content: input, target_student_id: studentId,
      });
      setComments(prev => [...prev, data]);
      setInput("");
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  }

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "8px", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
        <Icon name="lock" size={11} alt="" /> PRIVATE COMMENT — {studentName}
      </div>
      <div style={{ maxHeight: "160px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "8px" }}>
        {comments.length === 0
          ? <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>No comments yet.</div>
          : comments.map((c, i) => (
            <div key={i} style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              <span style={{ fontWeight: 700 }}>{c.author_name || (c.author_id === studentId ? studentName : myName)}:</span>{" "}
              <CommentContent comment={c} isMine={c.author_id === myId}
                onUpdate={updated => setComments(prev => prev.map(x => x.id === c.id ? updated : x))}
                onDelete={() => setComments(prev => prev.filter(x => x.id !== c.id))} />
            </div>
          ))
        }
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Add private comment..." style={{ flex: 1, padding: "6px 10px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
        <button onClick={send} disabled={sending || !input.trim()}
          style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", cursor: "pointer", fontWeight: 600 }}>
          Send
        </button>
      </div>
    </div>
  );
}

// ── Stream Section Component ──
export function StreamSection({ icon, title, onMore, children, empty, emptyMsg }) {
  return (
    <div style={{ background: "var(--surface)", borderRadius: "12px", border: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid var(--surface-alt)", background: "var(--surface-alt)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "18px" }}>{icon}</span>
          <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>{title}</span>
        </div>
        <button onClick={onMore} style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>
          More »
        </button>
      </div>
      <div style={{ padding: "6px 18px 10px" }}>
        {empty
          ? <div style={{ fontSize: "13px", color: "var(--text-faint)", padding: "12px 0" }}>{emptyMsg}</div>
          : children
        }
      </div>
    </div>
  );
}

export function StreamRow({ label, date, badge, badgeColor, onClick, actions }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--surface-alt)", cursor: onClick ? "pointer" : "default", gap: "6px" }}
      onMouseEnter={e => onClick && (e.currentTarget.style.background = "var(--surface-alt)")}
      onMouseLeave={e => onClick && (e.currentTarget.style.background = "transparent")}>
      <span style={{ fontSize: "13px", color: "var(--text-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        · {label}
      </span>
      {actions}
      {badge && <span style={{ fontSize: "11px", color: badgeColor || "var(--text-muted)", fontWeight: 600, flexShrink: 0 }}>{badge}</span>}
      {date && !badge && <span style={{ fontSize: "11px", color: "var(--text-faint)", flexShrink: 0 }}>{date}</span>}
    </div>
  );
}

// ── Post Card Component ──
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function PostCard({ post, myName, myId, isTeacher, onEdit, onDelete, onLike, onPin, expandedComments, setExpandedComments, commentInputs, setCommentInputs, submittingComment, handleComment, onCommentUpdate, onCommentDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isMaterial = post.type === "material";
  const commentCount = post.comments?.length || 0;
  const showComments = expandedComments[post.id];
  const initial = (post.author_name || "T")[0].toUpperCase();

  return (
    <div style={{ ...fbPostCard, ...(post.is_pinned ? fbPinnedCard : {}) }}>
      {/* Pin strip */}
      {!!post.is_pinned && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, color: "var(--primary)", padding: "12px 18px 0" }}>
          <span>📌</span> Pinned announcement
        </div>
      )}

      {/* Post header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "16px 18px 0" }}>
        <div style={{ display: "flex", gap: "11px", alignItems: "center" }}>
          <div style={{ ...fbAvatar, flexShrink: 0 }}>{initial}</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--text)" }}>{post.author_name}</span>
              <span style={isTeacher ? fbTeacherBadge : fbStudentBadge}>{isTeacher ? "Teacher" : "Student"}</span>
              {isMaterial && <span style={fbMaterialBadge}>📄 Material</span>}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "2px" }}>{timeAgo(post.created_at)}</div>
          </div>
        </div>

        {/* Three-dot menu — teacher or own post */}
        {!isMaterial && (isTeacher || post.author_id === myId) && (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setMenuOpen(m => !m)}
              style={{ width: "32px", height: "32px", borderRadius: "10px", background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}
            >⋯</button>
            {menuOpen && (
              <div style={fbMenu} onMouseLeave={() => setMenuOpen(false)}>
                {isTeacher && (
                  <>
                    <button onClick={() => { onEdit(post); setMenuOpen(false); }} style={fbMenuItem}>
                      ✏️ Edit post
                    </button>
                    <button onClick={() => { onPin(post.id); setMenuOpen(false); }} style={fbMenuItem}>
                      {post.is_pinned ? "📌 Unpin" : "📌 Pin to top"}
                    </button>
                  </>
                )}
                {(isTeacher || post.author_id === myId) && (
                  <button onClick={() => { onDelete(post.id); setMenuOpen(false); }} style={{ ...fbMenuItem, color: "#ef4444" }}>
                    🗑️ Delete post
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {post.content?.trim() && (
        <p style={{ fontSize: "13.5px", color: "var(--text)", lineHeight: 1.6, margin: "12px 18px 14px" }}>
          {post.content}
        </p>
      )}

      {/* Post image */}
      {post.image_url && (
        <div style={{ margin: post.content?.trim() ? "0 0 14px" : "12px 0 14px" }}>
          <img
            src={`http://localhost:5001${post.image_url}`}
            alt="post"
            style={{ width: "100%", maxHeight: "480px", objectFit: "cover", display: "block", cursor: "pointer" }}
            onClick={() => window.open(`http://localhost:5001${post.image_url}`, "_blank")}
          />
        </div>
      )}

      {/* Material card */}
      {isMaterial && post.material_title && (
        <div style={{ margin: "0 18px 14px" }}>
          <div style={matPostCard}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text)" }}>{post.material_title}</div>
                {post.material_instructions && (
                  <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>{post.material_instructions}</div>
                )}
              </div>
              {post.material_file_url && (
                <a
                  href={`http://localhost:5001/api/classroom/materials/${post.material_id}/file?download=1&token=${encodeURIComponent(localStorage.getItem("nova_token"))}`}
                  target="_blank" rel="noopener noreferrer" style={dlBtn}
                >
                  ↓ Download
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 18px 10px", fontSize: "11.5px", color: "var(--text-faint)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          {post.like_count > 0 && (
            <>
              <span style={{ fontSize: "13px" }}>❤️</span>
              <span>{post.like_count}</span>
            </>
          )}
        </div>
        {commentCount > 0 && (
          <button onClick={() => setExpandedComments(e => ({ ...e, [post.id]: !e[post.id] }))} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11.5px", color: "var(--text-faint)" }}>
            {commentCount} comment{commentCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Action row */}
      <div style={{ display: "flex", gap: "2px", borderTop: "1px solid var(--border)", padding: "6px 10px" }}>
        <button
          onClick={() => onLike(post.id)}
          style={{ ...fbActionBtn, color: post.liked_by_me ? "#ec4899" : "var(--text-muted)", fontWeight: post.liked_by_me ? 700 : 500 }}
        >
          {post.liked_by_me ? "❤️" : "🤍"} Like
        </button>
        <button
          onClick={() => setExpandedComments(e => ({ ...e, [post.id]: !e[post.id] }))}
          style={fbActionBtn}
        >
          💬 Comment
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div style={{ padding: "0 18px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {post.comments?.map(c => (
            <div key={c.id} style={{ display: "flex", gap: "9px" }}>
              <div style={fbAvatarSm}>{(c.author_name || "U")[0].toUpperCase()}</div>
              <div style={fbCommentBubble}>
                <b style={{ fontSize: "11.5px" }}>{c.author_name}</b>
                <div style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text)", lineHeight: 1.4 }}>
                  <CommentContent comment={c} isMine={c.author_id === myId} endpoint="post-comments"
                    onUpdate={updated => onCommentUpdate(post.id, updated)}
                    onDelete={() => onCommentDelete(post.id, c.id)} />
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-faint)", marginTop: "3px" }}>{timeAgo(c.created_at)}</div>
              </div>
            </div>
          ))}

          {/* Comment input */}
          <div style={{ display: "flex", gap: "9px", alignItems: "center" }}>
            <div style={{ ...fbAvatarSm, background: "var(--primary)", color: "#fff", flexShrink: 0 }}>
              {myName[0].toUpperCase()}
            </div>
            <input
              value={commentInputs[post.id] || ""}
              onChange={e => setCommentInputs(c => ({ ...c, [post.id]: e.target.value }))}
              onKeyDown={e => e.key === "Enter" && handleComment(post.id)}
              placeholder="Write a comment..."
              style={fbCommentInput}
            />
            <button
              onClick={() => handleComment(post.id)}
              disabled={submittingComment[post.id] || !commentInputs[post.id]?.trim()}
              style={sendBtn}
            >→</button>
          </div>
        </div>
      )}
    </div>
  );
}

const QUIZ_DIFFICULTY_COLOR = { easy: "#16a34a", medium: "#d97706", hard: "#dc2626" };

export function QuizView({ questions }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const score = submitted
    ? questions.filter((q, i) => answers[i] === q.answer).length
    : 0;

  return (
    <div>
      {questions.map((q, i) => (
        <div key={i} style={{ marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
              Q{i + 1}. {q.question}
            </div>
            {q.difficulty && QUIZ_DIFFICULTY_COLOR[q.difficulty] && (
              <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: QUIZ_DIFFICULTY_COLOR[q.difficulty], background: `${QUIZ_DIFFICULTY_COLOR[q.difficulty]}18`, padding: "2px 7px", borderRadius: "999px", flexShrink: 0 }}>
                {q.difficulty}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {q.options.map((opt, j) => {
              const letter = opt[0];
              const isSelected = answers[i] === letter;
              const isCorrect = letter === q.answer;
              let bg = "var(--surface-alt)", border = "1px solid var(--border)", color = "var(--text-muted)";
              if (submitted) {
                if (isCorrect) { bg = "rgba(34,197,94,0.12)"; border = "2px solid #22c55e"; color = "#22c55e"; }
                else if (isSelected) { bg = "rgba(239,68,68,0.1)"; border = "2px solid #ef4444"; color = "#ef4444"; }
              } else if (isSelected) {
                bg = "var(--primary-tint)"; border = "2px solid var(--primary)"; color = "var(--primary)";
              }
              return (
                <div
                  key={j}
                  onClick={() => !submitted && setAnswers(a => ({ ...a, [i]: letter }))}
                  style={{ padding: "10px 14px", borderRadius: "8px", background: bg, border, color, fontSize: "13px", cursor: submitted ? "default" : "pointer" }}
                >
                  {opt}
                  {submitted && isCorrect && " ✓"}
                  {submitted && isSelected && !isCorrect && " ✗"}
                </div>
              );
            })}
          </div>
          {submitted && (
            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px", fontStyle: "italic" }}>
              💡 {q.explanation}
            </div>
          )}
        </div>
      ))}
      {!submitted ? (
        <button
          onClick={() => setSubmitted(true)}
          disabled={Object.keys(answers).length < questions.length}
          style={{ ...btnStyle, opacity: Object.keys(answers).length < questions.length ? 0.5 : 1 }}
        >
          Submit Quiz
        </button>
      ) : (
        <div style={{ background: score === questions.length ? "rgba(34,197,94,0.12)" : "var(--primary-tint)", borderRadius: "10px", padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "28px", fontWeight: 800, color: score === questions.length ? "#22c55e" : "var(--primary)" }}>
            {score}/{questions.length}
          </div>
          <div style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>
            {score === questions.length ? "Perfect! 🎉" : score >= 2 ? "Good job! 👍" : "Keep studying! 📚"}
          </div>
        </div>
      )}
    </div>
  );
}

export const btnStyle = { background: "var(--primary)", color: "#fff", border: "none", borderRadius: "10px", padding: "12px 24px", fontSize: "14px", fontWeight: 600, cursor: "pointer", width: "100%" };

export function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Styles ──
export const layout = { display: "flex", minHeight: "100vh", background: "var(--bg)" };

export const topHeader = {
  background: "var(--surface)", borderBottom: "1px solid var(--border)",
  padding: "14px 28px", display: "flex", alignItems: "center",
  justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50,
};

export const backBtn = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: "18px", color: "var(--text-muted)", padding: "4px 8px",
};

export const tabBtn = (active) => ({
  padding: "8px 18px", borderRadius: "8px", border: "none",
  fontSize: "14px", fontWeight: 600, cursor: "pointer",
  background: active ? "var(--primary)" : "transparent",
  color: active ? "#fff" : "var(--text-muted)",
});

export const avatarSm = {
  width: "36px", height: "36px", borderRadius: "50%",
  background: "var(--border)", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "var(--text-muted)",
};

export const announceCard = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "12px", padding: "16px 20px", marginBottom: "20px",
};

export const announceTextarea = {
  flex: 1, border: "none", outline: "none", fontSize: "14px",
  color: "var(--text-muted)", resize: "none", background: "transparent",
  fontFamily: "inherit", lineHeight: 1.6,
};

export const postBtn = {
  background: "var(--primary)", color: "#fff", border: "none",
  borderRadius: "8px", padding: "8px 20px", fontSize: "13px",
  fontWeight: 600, cursor: "pointer",
};

export const postCard = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "12px", padding: "20px", marginBottom: "16px",
};

export const matPostCard = {
  background: "var(--bg)", border: "1px solid var(--border)",
  borderRadius: "10px", padding: "14px 16px", marginBottom: "4px",
};

export const dlBtn = {
  background: "var(--primary)", color: "#fff", textDecoration: "none",
  borderRadius: "8px", padding: "7px 14px", fontSize: "13px",
  fontWeight: 600, flexShrink: 0,
};

export const commentToggle = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: "13px", color: "var(--text-muted)", fontWeight: 500, padding: "4px 0",
};

export const commentRow = {
  display: "flex", gap: "10px", marginBottom: "10px", alignItems: "flex-start",
};

export const commentAvatar = {
  width: "28px", height: "28px", borderRadius: "50%", background: "var(--border)",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: "12px", fontWeight: 700, color: "var(--text-muted)", flexShrink: 0,
};

export const commentBubble = {
  background: "var(--surface-alt)", borderRadius: "12px", padding: "8px 12px",
  fontSize: "13px", color: "var(--text-muted)", flex: 1,
};

export const commentInput = {
  flex: 1, padding: "8px 14px", borderRadius: "20px",
  border: "1px solid var(--border)", fontSize: "13px", outline: "none",
  color: "var(--text)", background: "var(--surface)",
};

export const sendBtn = {
  background: "var(--primary)", color: "#fff", border: "none",
  borderRadius: "50%", width: "32px", height: "32px",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", fontSize: "16px", flexShrink: 0,
};

export const aiCard = {
  background: "linear-gradient(135deg, var(--primary), var(--primary))",
  borderRadius: "14px", padding: "20px",
};

export const aiBtn = {
  marginTop: "14px", background: "var(--surface)", color: "var(--primary)",
  border: "none", borderRadius: "8px", padding: "8px 16px",
  fontSize: "13px", fontWeight: 600, cursor: "pointer", width: "100%",
};

export const sideCard = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "14px", padding: "16px 20px",
};

// ── Facebook-style stream styles ──
export const fbPostCard = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "16px", overflow: "hidden", marginBottom: "14px",
};

export const fbPinnedCard = {
  borderColor: "rgba(79,70,229,0.3)",
  background: "var(--surface)",
};

export const fbAvatar = {
  width: "40px", height: "40px", borderRadius: "50%",
  background: "linear-gradient(135deg, var(--primary), var(--primary))",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#fff", fontSize: "15px", fontWeight: 700,
  boxShadow: "0 0 0 2px var(--surface), 0 0 0 4px rgba(79,70,229,0.2)",
};

export const fbAvatarSm = {
  width: "32px", height: "32px", borderRadius: "50%",
  background: "var(--border)", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "var(--text-muted)",
};

export const fbTeacherBadge = {
  fontSize: "9px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
  letterSpacing: "0.03em", background: "rgba(79,70,229,0.12)", color: "var(--primary)",
};

export const fbStudentBadge = {
  fontSize: "9px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
  letterSpacing: "0.03em", background: "rgba(8,145,178,0.12)", color: "#0891B2",
};

export const fbMaterialBadge = {
  fontSize: "9px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px",
  background: "var(--primary-tint)", color: "var(--primary)",
};

export const fbMenu = {
  position: "absolute", right: 0, top: "38px", zIndex: 100,
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "14px", boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
  padding: "6px", minWidth: "170px",
};

export const fbMenuItem = {
  display: "flex", alignItems: "center", gap: "8px", width: "100%",
  padding: "9px 12px", borderRadius: "9px", background: "none", border: "none",
  cursor: "pointer", fontSize: "12.5px", fontWeight: 500, color: "var(--text)",
  textAlign: "left",
};

export const fbActionBtn = {
  flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
  gap: "7px", padding: "8px", borderRadius: "10px", background: "none", border: "none",
  cursor: "pointer", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)",
};

export const fbCommentBubble = {
  background: "var(--surface-alt)", borderRadius: "14px", padding: "8px 12px", flex: 1,
};

export const fbCommentInput = {
  flex: 1, background: "var(--surface-alt)", borderRadius: "999px",
  padding: "8px 16px", fontSize: "12px", color: "var(--text)",
  border: "none", outline: "none",
};

// Composer card for stream
export const fbComposerCard = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "16px", padding: "20px 22px", marginBottom: "16px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
};

export const fbComposerInput = {
  flex: 1, background: "var(--surface-alt)", borderRadius: "12px",
  padding: "14px 20px", fontSize: "14px", color: "var(--text-muted)",
  border: "1.5px solid var(--border)", outline: "none", cursor: "text",
  minHeight: "48px", display: "flex", alignItems: "center",
};

export const banner = {
  background: "linear-gradient(135deg, var(--primary), var(--primary))",
  borderRadius: "14px", padding: "24px 28px",
  display: "flex", justifyContent: "space-between",
  alignItems: "center", marginBottom: "24px",
};

export const newMatBtn = {
  background: "var(--surface)", color: "var(--primary)", border: "none",
  borderRadius: "8px", padding: "10px 20px", fontSize: "13px",
  fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
};

export const weekLabel = {
  fontSize: "12px", fontWeight: 700, color: "var(--text-faint)",
  textTransform: "uppercase", letterSpacing: "1px", padding: "14px 0 6px",
};

export const matRow = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "14px 18px", background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "10px", marginBottom: "3px", cursor: "pointer",
};

export const matIcon = {
  width: "36px", height: "36px", borderRadius: "8px",
  background: "var(--primary-tint)", display: "flex", alignItems: "center",
  justifyContent: "center", fontSize: "16px", flexShrink: 0,
};

export const fileChip = {
  display: "flex", alignItems: "center", gap: "8px",
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px",
  padding: "8px 14px", fontSize: "13px", color: "var(--text-muted)",
  textDecoration: "none", maxWidth: "100%", boxSizing: "border-box",
};

export const fab = {
  position: "fixed", bottom: "32px", right: "32px",
  width: "56px", height: "56px", borderRadius: "50%",
  background: "var(--primary)", color: "#fff", fontSize: "28px",
  border: "none", cursor: "pointer",
  boxShadow: "0 4px 16px rgba(59,55,204,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center",
};

export const sectionHead = {
  fontSize: "13px", fontWeight: 700, color: "var(--primary)",
  textTransform: "uppercase", letterSpacing: "1px", margin: "0 0 12px",
};

export const memberRow = {
  display: "flex", alignItems: "center", gap: "12px",
  padding: "12px 16px", background: "var(--surface)", borderRadius: "10px",
  border: "1px solid var(--border)", marginBottom: "4px",
};

export const memberAvatar = {
  width: "40px", height: "40px", borderRadius: "50%",
  background: "var(--border)", color: "var(--text-muted)", display: "flex",
  alignItems: "center", justifyContent: "center",
  fontSize: "16px", fontWeight: 700, flexShrink: 0,
};

export const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};

export const modalStyle = {
  background: "var(--surface)", borderRadius: "16px", padding: "28px",
  width: "420px", maxWidth: "92vw",
};

export const btnPrimary = {
  background: "var(--primary)", color: "#fff", padding: "11px 20px",
  borderRadius: "10px", fontSize: "14px", fontWeight: 600,
  border: "none", cursor: "pointer", width: "100%",
};

export const btnOutline = {
  background: "var(--surface)", color: "var(--text-muted)", padding: "11px 20px",
  borderRadius: "10px", fontSize: "14px", fontWeight: 600,
  border: "1px solid var(--border)", cursor: "pointer", width: "100%",
};

export const lbl = { display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" };
export const inp = { width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "14px", outline: "none", boxSizing: "border-box", color: "var(--text)", background: "var(--surface)" };

export const aiMentorPanel = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "16px", padding: "20px",
  position: "sticky", top: "80px",
};

export const aiAvatarStyle = {
  width: "44px", height: "44px", borderRadius: "12px",
  background: "linear-gradient(135deg, var(--primary), var(--primary))",
  display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px",
};

export const aiFeatureCard = {
  borderRadius: "12px", padding: "14px 16px",
  marginBottom: "10px", cursor: "pointer",
  transition: "all 0.15s",
};
