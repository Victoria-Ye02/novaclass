import { useState } from "react";
import API from "../services/api";

// Editable comment content — shows edit/delete only for the comment's own author.
// `endpoint` selects which comment resource this belongs to ("comments" for
// assignment comments, "material-comments" for lesson comments) since each
// has its own author-only edit/delete route. `light` switches the edit/delete
// icon color for use inside a dark/colored chat bubble.
export default function CommentContent({ comment, isMine, onUpdate, onDelete, endpoint = "comments", light = false }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.content);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const { data } = await API.put(`/classroom/${endpoint}/${comment.id}`, { content: text.trim() });
      onUpdate(data);
      setEditing(false);
    } catch (err) { console.error(err); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!window.confirm("Delete this comment?")) return;
    setBusy(true);
    try {
      await API.delete(`/classroom/${endpoint}/${comment.id}`);
      onDelete();
    } catch (err) { console.error(err); }
    finally { setBusy(false); }
  }

  if (editing) {
    return (
      <div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2} autoFocus
          style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 8px", fontSize: "13px", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
        <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
          <button onClick={save} disabled={busy || !text.trim()} style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Save</button>
          <button onClick={() => { setEditing(false); setText(comment.content); }} style={{ fontSize: "11px", color: "#9aa0a6", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Cancel</button>
        </div>
      </div>
    );
  }

  const iconColor = light ? "rgba(255,255,255,0.8)" : "#9aa0a6";
  return (
    <span>
      {comment.content}
      {isMine && (
        <span style={{ marginLeft: "8px", whiteSpace: "nowrap" }}>
          <button onClick={() => setEditing(true)} title="Edit" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: iconColor, padding: "0 2px" }}>✏️</button>
          <button onClick={remove} disabled={busy} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: iconColor, padding: "0 2px" }}>🗑️</button>
        </span>
      )}
    </span>
  );
}
