import { useState } from "react";
import CommentThread from "./CommentThread";

// Teacher's view of one student's private comment thread about a lesson —
// its own composer since the teacher may be replying into several students'
// threads from the same panel.
export default function MaterialCommentGroup({ studentId, studentName, comments, myId, onUpdate, onDelete, onPost }) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (!input.trim()) return;
    setSending(true);
    try {
      await onPost(studentId, input.trim());
      setInput("");
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  }

  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "10px" }}>{studentName}</div>
      <div style={{ marginBottom: "10px" }}>
        <CommentThread comments={comments} myId={myId} endpoint="material-comments" onUpdate={onUpdate} onDelete={onDelete} />
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder={`Reply to ${studentName}...`}
          style={{ flex: 1, border: "1px solid var(--border)", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", outline: "none", color: "var(--text)", background: "var(--surface)" }} />
        <button onClick={send} disabled={sending || !input.trim()}
          style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: "20px", padding: "8px 18px", fontSize: "13px", fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
          Send
        </button>
      </div>
    </div>
  );
}
