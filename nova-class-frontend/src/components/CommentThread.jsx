import CommentContent from "./CommentContent";

// Chat-bubble comment thread — same left/right, tinted-vs-neutral bubble
// language as the AI Chat panel (MaterialPreview.jsx), so every "thread" in
// the app reads the same way instead of inventing a new list style per spot.
export default function CommentThread({ comments, myId, endpoint = "material-comments", onUpdate, onDelete, emptyText = "No comments yet." }) {
  if (!comments.length) {
    return <div style={{ fontSize: "12px", color: "var(--text-faint)", padding: "2px 0" }}>{emptyText}</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {comments.map(c => {
        const mine = c.author_id === myId;
        return (
          <div key={c.id} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-faint)", margin: mine ? "0 3px 4px 0" : "0 0 4px 3px" }}>
              {c.author_name}
            </div>
            <div style={{
              maxWidth: "85%",
              background: mine ? "var(--primary)" : "var(--surface-alt)",
              color: mine ? "#fff" : "var(--text)",
              borderRadius: mine ? "14px 14px 3px 14px" : "14px 14px 14px 3px",
              padding: "9px 13px",
              fontSize: "13px",
              lineHeight: 1.5,
            }}>
              <CommentContent comment={c} isMine={mine} endpoint={endpoint} light={mine}
                onUpdate={onUpdate ? (updated => onUpdate(c.id, updated)) : undefined}
                onDelete={onDelete ? (() => onDelete(c.id)) : undefined} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
