import { useEffect, useState } from "react";
import API from "../services/api";
import CommentThread from "./CommentThread";
import MaterialCommentGroup from "./MaterialCommentGroup";

// Owns all of its own state (comments, input value, sending) so that typing
// a comment only re-renders this component — not the page it's embedded in.
// Sharing input state with a parent that also renders a PDF viewer/thumbnail
// makes every keystroke re-render that <object>/<canvas> too, which browsers
// visibly reload/flash on. onCountChange lets a parent show a badge without
// subscribing to the full (per-keystroke-changing) comment list.
export default function PrivateCommentsPanel({ materialId, isTeacher, myId, containerStyle, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    setComments([]);
    API.get(`/classroom/materials/${materialId}/comments`)
      .then(({ data }) => { if (active) setComments(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setComments([]); });
    return () => { active = false; };
  }, [materialId]);

  useEffect(() => {
    onCountChange?.(comments.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length]);

  async function send() {
    if (!input.trim()) return;
    setSending(true);
    try {
      const { data } = await API.post(`/classroom/materials/${materialId}/comments`, { content: input.trim() });
      setComments(prev => [...prev, data]);
      setInput("");
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  }

  async function postTeacherReply(studentId, content) {
    const { data } = await API.post(`/classroom/materials/${materialId}/comments`, { content, target_student_id: studentId });
    setComments(prev => [...prev, data]);
  }

  if (isTeacher) {
    const groups = Object.values(comments.reduce((acc, c) => {
      const sid = c.target_student_id;
      if (!acc[sid]) {
        const studentComment = comments.find(x => x.author_id === sid);
        acc[sid] = { studentId: sid, studentName: studentComment?.author_name || `Student #${sid}`, comments: [] };
      }
      acc[sid].comments.push(c);
      return acc;
    }, {}));
    return groups.length === 0 ? (
      <div style={{ fontSize: "12px", color: "var(--text-faint)" }}>No comments yet.</div>
    ) : (
      <div style={containerStyle}>
        {groups.map(g => (
          <MaterialCommentGroup key={g.studentId} studentId={g.studentId} studentName={g.studentName}
            comments={g.comments} myId={myId}
            onUpdate={(cid, updated) => setComments(prev => prev.map(x => x.id === cid ? updated : x))}
            onDelete={cid => setComments(prev => prev.filter(x => x.id !== cid))}
            onPost={postTeacherReply} />
        ))}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: comments.length ? "12px" : 0 }}>
        <CommentThread comments={comments} myId={myId} endpoint="material-comments"
          emptyText="Ask your teacher a private question about this lesson."
          onUpdate={(cid, updated) => setComments(prev => prev.map(x => x.id === cid ? updated : x))}
          onDelete={cid => setComments(prev => prev.filter(x => x.id !== cid))} />
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Write a private comment..."
          style={{ flex: 1, border: "1px solid var(--border)", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", outline: "none", background: "var(--surface)", color: "var(--text)" }} />
        <button onClick={send} disabled={sending || !input.trim()}
          style={{ background: "var(--primary)", color: "#fff", border: "none", borderRadius: "20px", padding: "8px 18px", fontSize: "13px", cursor: "pointer", fontWeight: 600, flexShrink: 0 }}>
          Send
        </button>
      </div>
    </div>
  );
}
