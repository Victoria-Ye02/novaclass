import { useState, useRef, useEffect } from "react";
import API from "../services/api";

const ATTACH_TYPES = [
  { key: "image", icon: "📸", label: "Image", accept: "image/*" },
  { key: "audio", icon: "🎤", label: "Audio", accept: "audio/*,.mp3,.wav,.m4a,.webm" },
  { key: "file",  icon: "📄", label: "File",  accept: ".pdf,.docx" },
];

function formatText(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

// The backend often responds with a clear reason (expired token, bad
// request, etc). Surface that instead of always blaming "the server".
function errorMessage(err) {
  if (err.response) {
    const status = err.response.status;
    const serverMsg = err.response.data?.error || err.response.data?.message;
    if (status === 401) return "⚠️ Your session has expired. Please log out and log back in.";
    if (serverMsg) return `❌ ${serverMsg}`;
    return `❌ Server error (${status}). Please try again.`;
  }
  return "❌ Cannot reach the server. Please check your connection or try again later.";
}

const WELCOME_MSG = { role: "bot", text: "👋 Hi! I'm the Nova Class Assistant.\nAsk me anything — not just TOPIK, anything at all." };

// Chat history is scoped per logged-in account so different users (or
// different Gmail logins) on the same browser never see each other's chats.
function getSessionsKey() {
  const who = (localStorage.getItem("nova_email") || localStorage.getItem("nova_name") || "guest").toLowerCase();
  return `nova_assistant_sessions_${who}`;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeSession() {
  return { id: genId(), messages: [WELCOME_MSG], updatedAt: Date.now() };
}

function loadSessions() {
  try {
    const saved = JSON.parse(localStorage.getItem(getSessionsKey()));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}
  return [makeSession()];
}

function sessionTitle(session) {
  const userMsg = session.messages.find(m => m.role === "user");
  if (!userMsg) return "New conversation";
  const line = userMsg.text.split("\n")[0];
  return line.length > 36 ? line.slice(0, 36) + "…" : line;
}

function timeAgo(ts) {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function NovaAssistant() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sessions, setSessions] = useState(loadSessions);
  const [activeId, setActiveId] = useState(() => sessions[0]?.id);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachFile, setAttachFile] = useState(null); // { file, type }
  const bottomRef = useRef();
  const fileRef = useRef();
  const pendingTypeRef = useRef("image");

  const activeSession = sessions.find(sess => sess.id === activeId) || sessions[0];
  const messages = activeSession.messages;

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    try { localStorage.setItem(getSessionsKey(), JSON.stringify(sessions)); } catch {}
  }, [sessions]);

  function setMessages(updater) {
    setSessions(prev => {
      const updated = prev.map(sess => sess.id === activeSession.id
        ? { ...sess, messages: typeof updater === "function" ? updater(sess.messages) : updater, updatedAt: Date.now() }
        : sess);
      const idx = updated.findIndex(sess => sess.id === activeSession.id);
      const [item] = updated.splice(idx, 1);
      return [item, ...updated];
    });
  }

  function newChat() {
    const isEmpty = activeSession.messages.length <= 1 && activeSession.messages[0]?.role === "bot";
    if (!isEmpty) {
      const ns = makeSession();
      setSessions(prev => [ns, ...prev]);
      setActiveId(ns.id);
    }
  }

  function selectSession(id) {
    setActiveId(id);
  }

  function deleteSession(id, e) {
    e.stopPropagation();
    setSessions(prev => {
      const filtered = prev.filter(sess => sess.id !== id);
      const next = filtered.length ? filtered : [makeSession()];
      if (id === activeId) setActiveId(next[0].id);
      return next;
    });
  }

  function pickAttachType(key) {
    setAttachOpen(false);
    pendingTypeRef.current = key;
    if (fileRef.current) {
      fileRef.current.accept = ATTACH_TYPES.find(t => t.key === key)?.accept || "";
      fileRef.current.click();
    }
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) setAttachFile({ file, type: pendingTypeRef.current });
    e.target.value = "";
  }

  async function send() {
    const text = input.trim();
    if ((!text && !attachFile) || loading) return;

    if (attachFile) {
      const { file, type } = attachFile;
      const icon = ATTACH_TYPES.find(t => t.key === type)?.icon || "📎";
      setMessages(m => [...m, { role: "user", text: `${icon} ${file.name}${text ? `\n${text}` : ""}` }]);
      setInput("");
      setAttachFile(null);
      setLoading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        if (text) fd.append("question", text);
        const res = await API.post("/multimodal/analyze", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const { answer, transcription } = res.data;
        const reply = transcription && transcription !== answer
          ? `**Transcription:** ${transcription}\n\n**Answer:** ${answer}`
          : (answer || "No answer");
        setMessages(m => [...m, { role: "bot", text: reply }]);
      } catch (err) {
        setMessages(m => [...m, { role: "bot", text: errorMessage(err) }]);
      }
      setLoading(false);
      return;
    }

    setInput("");
    setMessages(m => [...m, { role: "user", text }]);
    setLoading(true);
    try {
      const res = await API.post("/kmate/ask", { question: text });
      setMessages(m => [...m, { role: "bot", text: res.data.answer || "No answer" }]);
    } catch (err) {
      setMessages(m => [...m, { role: "bot", text: errorMessage(err) }]);
    }
    setLoading(false);
  }

  return (
    <>
      {open && (
        <div style={{ ...s.panel, ...(expanded ? s.panelExpanded : {}) }} onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div style={s.header}>
            <div>
              <div style={s.headerTitle}>🌟 Nova Class</div>
              <div style={s.headerSub}>Ask me anything, anytime</div>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button style={s.closeBtn} onClick={() => setSidebarOpen(o => !o)} title={sidebarOpen ? "Hide history" : "Show history"}>
                📜
              </button>
              <button style={s.closeBtn} onClick={() => setExpanded(e => !e)} title={expanded ? "Exit full screen" : "Full screen"}>
                {expanded ? "⤡" : "⤢"}
              </button>
              <button style={s.closeBtn} onClick={() => setOpen(false)}>✕</button>
            </div>
          </div>

          <div style={s.body}>
            {sidebarOpen && (
              /* History sidebar */
              <div style={s.sidebar}>
                <button style={s.newChatBtn} onClick={newChat}>
                  <span style={{ fontSize: "16px" }}>+</span> New chat
                </button>
                <div style={s.historyLabel}>Recents</div>
                <div style={s.historyList}>
                  {sessions.map(sess => (
                    <div
                      key={sess.id}
                      style={{ ...s.historyItem, ...(sess.id === activeSession.id ? s.historyItemActive : {}) }}
                      onClick={() => selectSession(sess.id)}
                      onMouseEnter={e => { if (sess.id !== activeSession.id) e.currentTarget.style.background = "#f0f0f0"; }}
                      onMouseLeave={e => { if (sess.id !== activeSession.id) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={s.historyItemTitle}>{sessionTitle(sess)}</div>
                        <div style={s.historyItemTime}>{timeAgo(sess.updatedAt)}</div>
                      </div>
                      <button style={s.historyDeleteBtn} onClick={e => deleteSession(sess.id, e)} title="Delete conversation">🗑️</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={s.mainCol}>
              {/* Messages */}
              <div style={s.chatBox}>
                {messages.map((m, i) => (
                  <div key={i} style={{ ...s.msgRow, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                    {m.role === "bot" && <div style={s.botAvatar}>🌟</div>}
                    <div style={{ ...s.bubble, ...(m.role === "user" ? s.userBubble : s.botBubble) }}
                      dangerouslySetInnerHTML={{ __html: formatText(m.text) }} />
                    {m.role === "user" && <div style={s.userAvatar}>👤</div>}
                  </div>
                ))}
                {loading && (
                  <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
                    <div style={s.botAvatar}>🌟</div>
                    <div style={{ ...s.bubble, ...s.botBubble, color: "#9ca3af", fontStyle: "italic" }}>
                      Thinking...
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={s.inputBox}>
                {attachFile && (
                  <div style={s.attachChip}>
                    <span>{ATTACH_TYPES.find(t => t.key === attachFile.type)?.icon} {attachFile.file.name}</span>
                    <button style={s.chipRemove} onClick={() => setAttachFile(null)}>✕</button>
                  </div>
                )}
                <div style={s.inputRow}>
                  <div style={{ position: "relative" }}>
                    {attachOpen && (
                      <>
                        <div onClick={() => setAttachOpen(false)} style={s.menuOverlay} />
                        <div style={s.attachMenu}>
                          {ATTACH_TYPES.map(t => (
                            <button key={t.key} style={s.attachMenuItem} onClick={() => pickAttachType(t.key)}
                              onMouseEnter={e => e.currentTarget.style.background = "#f5f5f5"}
                              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                              <span style={{ fontSize: "16px" }}>{t.icon}</span> {t.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                    <button
                      style={{ ...s.attachBtn, transform: attachOpen ? "rotate(45deg)" : "rotate(0deg)" }}
                      onClick={() => setAttachOpen(o => !o)}
                      title="Attach image, audio, or file"
                    >
                      +
                    </button>
                    <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
                  </div>
                  <textarea
                    style={s.textarea}
                    placeholder="Ask Nova Class anything..."
                    value={input}
                    rows={1}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  />
                  <button style={{ ...s.sendBtn, opacity: loading ? 0.5 : 1 }} onClick={send} disabled={loading}>➤</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Button (hidden while full screen, to avoid overlapping the panel's own close button) */}
      {!(open && expanded) && (
        <button
          onClick={() => setOpen(o => !o)}
          style={s.fab}
          title="Nova Class Assistant"
        >
          {open ? "✕" : "🌟"}
        </button>
      )}
    </>
  );
}

const s = {
  fab: {
    position: "fixed", bottom: "24px", right: "24px", width: "60px", height: "60px",
    borderRadius: "50%", background: "#3B37CC", color: "#fff", border: "4px solid #fff",
    cursor: "pointer", fontSize: "24px", boxShadow: "0 0 0 3px #3B37CC, 0 8px 24px rgba(0,0,0,0.3)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2147483647,
  },
  panel: {
    position: "fixed", bottom: "96px", right: "24px", width: "620px", maxWidth: "92vw",
    height: "560px", maxHeight: "75vh", background: "#fff", borderRadius: "18px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column",
    overflow: "hidden", zIndex: 2147483646, border: "1px solid #e5e7eb",
    transition: "width 0.2s, height 0.2s",
  },
  panelExpanded: {
    top: 0, left: 0, right: 0, bottom: 0,
    width: "100vw", height: "100vh", maxWidth: "100vw", maxHeight: "100vh",
    borderRadius: 0,
  },
  header: {
    background: "linear-gradient(135deg, #3B37CC, #7C3AED)", padding: "16px 18px",
    display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
  },
  headerTitle: { fontSize: "16px", fontWeight: 700, color: "#fff" },
  headerSub: { fontSize: "11px", color: "rgba(255,255,255,0.85)", marginTop: "2px" },
  closeBtn: {
    background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
    borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontSize: "14px",
  },
  body: { flex: 1, display: "flex", minHeight: 0, overflow: "hidden" },
  sidebar: {
    width: "210px", flexShrink: 0, borderRight: "1px solid #e5e7eb",
    background: "#f9fafb", padding: "12px 10px", overflowY: "auto",
    display: "flex", flexDirection: "column",
  },
  mainCol: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  chatBox: {
    flex: 1, overflowY: "auto", padding: "16px", display: "flex",
    flexDirection: "column", gap: "12px", background: "#fff",
  },
  msgRow: { display: "flex", gap: "8px", alignItems: "flex-end" },
  botAvatar: { fontSize: "18px", flexShrink: 0 },
  userAvatar: { fontSize: "18px", flexShrink: 0 },
  bubble: { maxWidth: "78%", padding: "10px 13px", borderRadius: "14px", fontSize: "13px", lineHeight: 1.6 },
  userBubble: { background: "#3B37CC", color: "#fff", borderBottomRightRadius: "4px" },
  botBubble: { background: "#f5f5f5", color: "#1a1a2e", border: "1px solid #e5e7eb", borderBottomLeftRadius: "4px" },
  inputBox: { borderTop: "1px solid #e5e7eb", padding: "10px 12px", flexShrink: 0 },
  inputRow: { display: "flex", gap: "8px", alignItems: "center" },
  textarea: {
    flex: 1, border: "none", resize: "none", fontSize: "13px",
    color: "#1a1a2e", background: "transparent", outline: "none",
  },
  sendBtn: {
    background: "#3B37CC", color: "#fff", border: "none",
    width: "34px", height: "34px", borderRadius: "10px", fontSize: "15px", flexShrink: 0,
  },
  attachBtn: {
    width: "32px", height: "32px", borderRadius: "50%", border: "1.5px solid #e5e7eb",
    background: "#f9fafb", color: "#3B37CC", fontSize: "18px", lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "transform 0.15s", flexShrink: 0,
  },
  menuOverlay: { position: "fixed", inset: 0, zIndex: 10 },
  attachMenu: {
    position: "absolute", bottom: "40px", left: 0, width: "160px",
    background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)", overflow: "hidden", zIndex: 11,
  },
  attachMenuItem: {
    width: "100%", display: "flex", alignItems: "center", gap: "8px",
    padding: "9px 12px", border: "none", borderBottom: "1px solid #f3f4f6",
    background: "transparent", cursor: "pointer", fontSize: "12px",
    fontWeight: 600, color: "#1a1a2e", textAlign: "left",
  },
  attachChip: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
    background: "#ede9fe", color: "#3B37CC", fontSize: "11px", fontWeight: 600,
    padding: "5px 9px", borderRadius: "8px", marginBottom: "8px",
  },
  chipRemove: {
    border: "none", background: "transparent", color: "#3B37CC",
    cursor: "pointer", fontSize: "11px", fontWeight: 700,
  },
  newChatBtn: {
    display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
    width: "100%", padding: "10px", borderRadius: "10px", border: "1.5px solid #e5e7eb",
    background: "#f9fafb", color: "#3B37CC", fontSize: "13px", fontWeight: 700,
    cursor: "pointer", marginBottom: "16px", flexShrink: 0,
  },
  historyLabel: {
    fontSize: "11px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase",
    letterSpacing: "0.5px", marginBottom: "8px", flexShrink: 0,
  },
  historyList: { display: "flex", flexDirection: "column", gap: "4px" },
  historyItem: {
    display: "flex", alignItems: "center", gap: "8px", padding: "10px 10px",
    borderRadius: "10px", cursor: "pointer",
  },
  historyItemActive: { background: "#ede9fe" },
  historyItemTitle: {
    fontSize: "13px", fontWeight: 600, color: "#1a1a2e", whiteSpace: "nowrap",
    overflow: "hidden", textOverflow: "ellipsis",
  },
  historyItemTime: { fontSize: "11px", color: "#9ca3af", marginTop: "2px" },
  historyDeleteBtn: {
    border: "none", background: "transparent", cursor: "pointer",
    fontSize: "13px", flexShrink: 0, opacity: 0.6,
  },
};
