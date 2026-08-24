import { useCallback, useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../../services/api";
import PdfLessonViewer from "../../components/PdfLessonViewer";
import Icon from "../../components/Icon";
import PrivateCommentsPanel from "../../components/PrivateCommentsPanel";
import { useMaterialBookmarks } from "../../hooks/useMaterialBookmarks";
import { useMaterialHighlights } from "../../hooks/useMaterialHighlights";
import { useLang } from "../../LanguageContext";

const API_ORIGIN = "http://localhost:5001";

const FILE_TYPE_LABEL = {
  pdf: "PDF", docx: "Word", pptx: "PowerPoint",
  png: "Image", jpg: "Image", jpeg: "Image", webp: "Image", gif: "Image",
  mp4: "Video", webm: "Video",
};

async function fetchMaterial(materialId) {
  const { data } = await API.get(`/classroom/materials/${materialId}`);
  return data;
}

// Checked live (not cached at module load) so tests can stub it per-case,
// and so the real app reflects whatever the current browser actually supports.
function getSpeechRecognitionAPI() {
  return typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;
}

const VOICE_STATUS_LABEL = {
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  ready: "Tap to talk",
};

function AIChatPanel({ materialId, currentPage, totalPages }) {
  const { lang } = useLang();
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: lang === "my"
        ? "👋 မင်္ဂလာပါ! ကျွန်ုပ်က သင့်ရဲ့ AI study assistant ပါ။ ဒီသင်ခန်းစာနဲ့ ပတ်သက်ပြီး ဘာမဆို မေးနိုင်ပါတယ်။"
        : "👋 Hello! I'm your AI study assistant. Ask me anything about this lesson.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("ready");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceQuestion, setVoiceQuestion] = useState("");
  const [voiceReply, setVoiceReply] = useState("");
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const speechSupported = getSpeechRecognitionAPI();

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  // Voice mode's own mic/speech lifecycle must never survive the component
  // that owns it — closing the material or switching lessons mid-conversation
  // would otherwise leave the mic listening or speech still queued.
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Shared by the text input's Send button and voice mode, so a spoken
  // question gets the exact same assistant-mode request and history as a
  // typed one. Returns the reply text so voice mode knows what to speak.
  async function sendMessage(text) {
    if (!text || sending) return null;
    setMessages(prev => [...prev, { role: "user", text }]);
    setSending(true);
    let replyText;
    try {
      const history = messagesRef.current
        .filter(m => m.role !== "system")
        .map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
      const { data } = await API.post(`/classroom/materials/${materialId}/ai`, {
        action: "chat",
        mode: "assistant",
        message: text,
        history,
        currentPage,
        totalPages,
        lang,
      });
      replyText = data.reply || data.response || "...";
    } catch {
      replyText = "⚠️ Something went wrong. Please try again.";
    }
    setMessages(prev => [...prev, { role: "assistant", text: replyText }]);
    setSending(false);
    return replyText;
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    await sendMessage(text);
  }

  function openVoiceMode() {
    setVoiceOpen(true);
    startListening();
  }

  function closeVoiceMode() {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setVoiceOpen(false);
    setVoiceStatus("ready");
    setVoiceTranscript("");
    setVoiceQuestion("");
    setVoiceReply("");
  }

  function startListening() {
    if (!speechSupported) return;
    const recognition = new speechSupported();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let finalTranscript = "";
    recognition.onresult = (e) => {
      let interim = "";
      finalTranscript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) finalTranscript += result[0].transcript;
        else interim += result[0].transcript;
      }
      setVoiceTranscript(finalTranscript || interim);
      if (finalTranscript) recognition.stop();
    };
    recognition.onerror = () => setVoiceStatus("ready");
    recognition.onend = () => {
      const spoken = finalTranscript.trim();
      if (spoken) handleVoiceResult(spoken);
      else setVoiceStatus("ready");
    };
    recognitionRef.current = recognition;
    setVoiceTranscript("");
    setVoiceReply("");
    setVoiceStatus("listening");
    recognition.start();
  }

  async function handleVoiceResult(text) {
    setVoiceQuestion(text);
    setVoiceStatus("thinking");
    const reply = await sendMessage(text);
    if (!reply) { setVoiceStatus("ready"); return; }
    setVoiceReply(reply);
    speak(reply);
  }

  function speak(text) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { setVoiceStatus("ready"); return; }
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.onend = () => setVoiceStatus("ready");
    utterance.onerror = () => setVoiceStatus("ready");
    setVoiceStatus("speaking");
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div style={chatPanel}>
      <div style={chatHeader}>
        <span style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
          <Icon name="chat" size={16} alt="" /> AI Chat
        </span>
        <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600 }}>● ACTIVE</span>
      </div>
      <div style={chatMessages}>
        {messages.map((m, i) => (
          <div key={i} style={m.role === "user" ? userBubbleWrap : aiBubbleWrap}>
            <div style={m.role === "user" ? userBubble : aiBubble}>{m.text}</div>
          </div>
        ))}
        {sending && (
          <div style={aiBubbleWrap}>
            <div style={{ ...aiBubble, color: "var(--text-faint)", fontStyle: "italic" }}>Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={chatInputRow}>
        <input
          style={chatInput}
          placeholder="Ask about this lesson…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          disabled={sending}
        />
        {speechSupported && (
          <button type="button" style={micBtn} onClick={openVoiceMode} aria-label="Start voice chat">
            <Icon name="microphone" size={16} alt="" />
          </button>
        )}
        <button style={sendBtn} onClick={send} disabled={sending || !input.trim()} aria-label="Send message">
          <Icon name="sent" size={16} alt="" style={{ filter: "brightness(0) invert(1)" }} />
        </button>
      </div>

      {voiceOpen && (
        <div style={voiceOverlay}>
          <button type="button" onClick={closeVoiceMode} style={voiceCloseBtn} aria-label="Close voice chat">✕</button>
          <button
            type="button"
            onClick={voiceStatus === "ready" ? startListening : undefined}
            disabled={voiceStatus !== "ready"}
            style={{
              ...voiceOrb,
              ...(voiceStatus === "listening" ? voiceOrbListening : {}),
              ...(voiceStatus === "thinking" ? voiceOrbThinking : {}),
              ...(voiceStatus === "speaking" ? voiceOrbSpeaking : {}),
            }}
            aria-label={voiceStatus === "ready" ? "Start talking" : undefined}
          >
            {voiceStatus === "speaking" ? (
              <div style={voiceBars}>
                {[0, 1, 2, 3].map(i => <span key={i} style={{ ...voiceBar, animationDelay: `${i * 0.12}s` }} />)}
              </div>
            ) : (
              <Icon name="microphone" size={36} alt="" style={{ filter: "brightness(0) invert(1)" }} />
            )}
          </button>
          <div style={voiceStatusText}>{VOICE_STATUS_LABEL[voiceStatus]}</div>

          {voiceStatus === "listening" && voiceTranscript && (
            <div style={voiceTranscriptBox}>{voiceTranscript}</div>
          )}

          {voiceStatus !== "listening" && (voiceQuestion || voiceReply) && (
            <div style={voiceCaptionBox}>
              {voiceQuestion && <div style={voiceCaptionQuestion}>You: {voiceQuestion}</div>}
              {voiceReply && <div style={voiceCaptionReply}>{voiceReply}</div>}
            </div>
          )}

          <button type="button" onClick={closeVoiceMode} style={voiceEndBtn}>
            <Icon name="multiply" size={14} alt="" style={{ filter: "brightness(0) invert(1)" }} /> End Voice Chat
          </button>
        </div>
      )}
    </div>
  );
}

export default function MaterialPreview({ isOverlay = false }) {
  const { id, materialId } = useParams();
  const navigate = useNavigate();
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [splitChat, setSplitChat] = useState(false);
  const [matAssignments, setMatAssignments] = useState([]);
  const [assignmentsOpen, setAssignmentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [myRole, setMyRole] = useState(null);
  const [myId, setMyId] = useState(null);
  const [pdfPageState, setPdfPageState] = useState({ currentPage: 1, totalPages: 0 });
  // Stable identity is required here: PdfLessonViewer's onPageChange effect
  // lists this callback as a dependency, so a fresh inline function on every
  // render would re-fire that effect every render, call setPdfPageState
  // again, and re-render this component — an infinite loop. The same-value
  // bailout below is a second line of defense against reintroducing it.
  const handlePdfPageChange = useCallback((currentPage, totalPages) => {
    setPdfPageState((prev) => (
      prev.currentPage === currentPage && prev.totalPages === totalPages
        ? prev
        : { currentPage, totalPages }
    ));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      setMaterial(await fetchMaterial(materialId));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => {
    let active = true;
    fetchMaterial(materialId)
      .then((data) => {
        if (active) {
          setMaterial(data);
          setError(false);
        }
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [materialId]);

  // Assignments tied to this specific lesson (material_id), so a student
  // sees them right where the lesson lives instead of only in the class's
  // general assignments list. Best-effort — a failed fetch just hides the
  // badge rather than blocking the lesson from loading.
  useEffect(() => {
    let active = true;
    API.get(`/classroom/materials/${materialId}/assignments`)
      .then(({ data }) => { if (active) setMatAssignments(Array.isArray(data) ? data : []); })
      .catch(() => { if (active) setMatAssignments([]); });
    return () => { active = false; };
  }, [materialId]);

  // Needed to tell "my own comment" apart from the teacher's/other students'
  // replies, and to decide whether to show the single-thread (student) or
  // grouped-by-student (teacher) comment view.
  useEffect(() => {
    if (!material?.class_id) return;
    let active = true;
    API.get(`/classroom/classes/${material.class_id}`)
      .then(({ data }) => { if (active) { setMyRole(data.my_role); setMyId(data.my_id); } })
      .catch(() => {});
    return () => { active = false; };
  }, [material?.class_id]);

  // Overlay mode: closing goes back to whatever pushed this route (the classroom
  // page underneath). Standalone mode (direct URL / refresh — no history to return
  // to within the app) goes to the classroom page explicitly instead.
  function goBack() {
    if (isOverlay) navigate(-1);
    else navigate(`/classroom/${id}`);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === "Escape") goBack();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOverlay, id]);

  useEffect(() => {
    if (!isOverlay) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [isOverlay]);

  const token = localStorage.getItem("nova_token");
  const fileUrl = material?.file_url
    ? `${API_ORIGIN}/api${material.file_url}?token=${encodeURIComponent(token)}`
    : null;
  // The `download` attribute on <a> is ignored cross-origin — force a real
  // download via the server's Content-Disposition instead (see getMaterialFile).
  const downloadUrl = fileUrl ? `${fileUrl}&download=1` : null;
  const ext = material?.file_ext;
  const typeLabel = FILE_TYPE_LABEL[ext] || "File";
  const isImage = ["png", "jpg", "jpeg", "webp", "gif"].includes(ext);
  const isVideo = ["mp4", "webm"].includes(ext);
  const isPdf = ext === "pdf";
  const {
    bookmarks,
    syncingPage,
    error: bookmarkError,
    toggleBookmark,
  } = useMaterialBookmarks({
    materialId,
    enabled: isPdf && Boolean(fileUrl),
  });
  const highlightState = useMaterialHighlights({ materialId, enabled: isPdf });

  const content = (
    <>
      {/* Top bar */}
      <div style={topBar}>
        <button onClick={goBack} style={backBtn} aria-label="Back to classroom">←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={fileNameStyle}>{loading ? "Loading…" : material?.title || "Untitled"}</div>
        </div>
        {matAssignments.length > 0 && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setAssignmentsOpen(v => !v)}
              style={assignmentsBadge}
              aria-expanded={assignmentsOpen}
              aria-label="Assignments for this lesson"
            >
              📝 {matAssignments.length}
            </button>
            {assignmentsOpen && (
              <div style={assignmentsDropdown}>
                <div style={assignmentsDropdownTitle}>Assignments for this lesson</div>
                {matAssignments.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => navigate(`/classroom/${id}?tab=classwork`)}
                    style={assignmentRow}
                  >
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>{a.title}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "2px" }}>
                      {a.due_date ? `Due ${new Date(a.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "No due date"}
                      {"my_submission" in a ? (a.my_submission ? " · Submitted" : " · Not submitted") : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {myRole && (
          <div style={{ position: "relative", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setCommentsOpen(v => !v)}
              style={assignmentsBadge}
              aria-expanded={commentsOpen}
              aria-label="Private comments"
            >
              💬{commentCount > 0 ? ` ${commentCount}` : ""}
            </button>
            <div style={{ ...assignmentsDropdown, width: "320px", maxHeight: "70vh", overflowY: "auto", display: commentsOpen ? "block" : "none" }}>
              <div style={assignmentsDropdownTitle}>
                {myRole === "teacher" ? "Private comments" : "Private comment to your teacher"}
              </div>
              <PrivateCommentsPanel materialId={materialId} isTeacher={myRole === "teacher"} myId={myId} onCountChange={setCommentCount}
                containerStyle={myRole === "teacher" ? undefined : { padding: "0 10px" }} />
            </div>
          </div>
        )}
        {!loading && !error && (
          <span style={badge}>{typeLabel}</span>
        )}
        {fileUrl && (
          <a href={downloadUrl} download={material?.title} style={downloadBtn}>
            ⬇ Download
          </a>
        )}
      </div>

      {/* Body */}
      <div style={body}>
        <div style={pdfPane}>
        {loading ? (
          <div style={skeleton}>
            <div style={skeletonBar} />
            <div style={{ ...skeletonBar, width: "60%" }} />
          </div>
        ) : error ? (
          <div style={centerMsg}>
            <div style={{ marginBottom: "12px" }}><Icon name="error" size={40} alt="" /></div>
            <div style={{ fontSize: "15px", fontWeight: 600, color: "#1a1a2e", marginBottom: "16px" }}>
              Couldn't load this material.
            </div>
            <button onClick={load} style={retryBtn}>Retry</button>
          </div>
        ) : !fileUrl ? (
          <div style={centerMsg}>
            <div style={{ marginBottom: "12px" }}><Icon name="file" size={40} alt="" /></div>
            <div style={{ fontSize: "15px", color: "#6b7280" }}>No file attached to this lesson.</div>
          </div>
        ) : isPdf ? (
          <PdfLessonViewer
            fileUrl={fileUrl}
            title={material.title}
            bookmarks={bookmarks}
            syncingPage={syncingPage}
            bookmarkError={bookmarkError}
            onToggleBookmark={toggleBookmark}
            onDismissEmptySpace={isOverlay ? goBack : undefined}
            highlightState={highlightState}
            onPdfReady={highlightState.preparePdf}
            onPageChange={handlePdfPageChange}
          />
        ) : isImage ? (
          <div style={centerMsg}>
            <img src={fileUrl} alt={material.title} style={imgStyle} />
          </div>
        ) : isVideo ? (
          <div style={centerMsg}>
            <video src={fileUrl} controls style={videoStyle} />
          </div>
        ) : (
          <div style={centerMsg}>
            <div style={{ marginBottom: "12px" }}><Icon name="attach" size={40} alt="" /></div>
            <div style={{ fontSize: "15px", color: "#6b7280", marginBottom: "16px" }}>
              Preview isn't available for this file type.
            </div>
            <a href={downloadUrl} download={material.title} style={retryBtn}>Download</a>
          </div>
        )}
        </div>
        {isPdf && !loading && !error && fileUrl && (
          <div style={chatSidebarWrapper(splitChat)}>
            <button
              type="button"
              onClick={() => setSplitChat(v => !v)}
              style={chatHandle}
              aria-label={splitChat ? "Close AI chat" : "Open AI chat"}
              aria-pressed={splitChat}
            />
            <div style={chatSlideContent(splitChat)}>
              <AIChatPanel
                key={materialId}
                materialId={materialId}
                currentPage={pdfPageState.currentPage}
                totalPages={pdfPageState.totalPages}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (isOverlay) {
    return (
      <div className="material-overlay-backdrop" style={backdrop} onClick={goBack}>
        <div className="material-overlay-card" data-testid="material-overlay-card" style={overlayCard} onClick={e => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      {content}
    </div>
  );
}

const page = {
  height: "100vh", width: "100vw", display: "flex", flexDirection: "column",
  background: "#1a1a2e", position: "fixed", inset: 0,
};

const backdrop = {
  position: "fixed", inset: 0, zIndex: 50,
  background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer",
};

const overlayCard = {
  width: "100vw", maxWidth: "none", height: "100dvh",
  background: "#1a1a2e", borderRadius: 0, boxShadow: "none",
  overflow: "hidden", cursor: "default",
  display: "flex", flexDirection: "column",
};

const topBar = {
  height: "60px", flexShrink: 0, display: "flex", alignItems: "center", gap: "14px",
  padding: "0 20px", background: "var(--surface)", borderBottom: "1px solid var(--border)",
};

const backBtn = {
  background: "none", border: "none", fontSize: "22px", color: "var(--text-muted)",
  cursor: "pointer", lineHeight: 1, flexShrink: 0,
};

const fileNameStyle = {
  fontSize: "15px", fontWeight: 700, color: "var(--text)",
  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
};

const badge = {
  fontSize: "11px", fontWeight: 700, color: "var(--primary)", background: "var(--primary-tint)",
  padding: "4px 10px", borderRadius: "20px", flexShrink: 0,
};

const downloadBtn = {
  display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700,
  color: "#fff", background: "var(--primary)", padding: "8px 16px", borderRadius: "8px",
  flexShrink: 0, whiteSpace: "nowrap",
};

const assignmentsBadge = {
  fontSize: "12px", fontWeight: 700, color: "var(--primary)", background: "var(--primary-tint)",
  border: "1px solid var(--border)", padding: "6px 12px", borderRadius: "20px",
  cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
};

const assignmentsDropdown = {
  position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 20,
  width: "280px", background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "12px", boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "8px",
};

const assignmentsDropdownTitle = {
  fontSize: "11px", fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase",
  letterSpacing: "0.5px", padding: "6px 10px",
};

const assignmentRow = {
  display: "block", width: "100%", textAlign: "left", background: "none", border: "none",
  cursor: "pointer", padding: "8px 10px", borderRadius: "8px",
};

const body = {
  flex: 1, minHeight: 0, display: "flex", alignItems: "stretch", justifyContent: "center",
  background: "#525659",
};

const centerMsg = {
  flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", textAlign: "center", padding: "40px",
};

const imgStyle = { maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: "6px" };

const videoStyle = { maxWidth: "100%", maxHeight: "100%" };

const retryBtn = {
  background: "var(--primary)", color: "#fff", border: "none", borderRadius: "8px",
  padding: "10px 20px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
  textDecoration: "none", display: "inline-block",
};

const skeleton = {
  flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
  justifyContent: "center", gap: "12px", padding: "40px",
};

const skeletonBar = {
  width: "80%", maxWidth: "480px", height: "16px", borderRadius: "6px",
  background: "linear-gradient(90deg, #3a3a52 25%, #4a4a68 50%, #3a3a52 75%)",
  backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
};

const pdfPane = {
  flex: 1, minWidth: 0, display: "flex", alignItems: "stretch", justifyContent: "center",
  overflow: "hidden",
};

const CHAT_HANDLE_WIDTH = 14;
const CHAT_HANDLE_HEIGHT = 85;
const CHAT_SIDEBAR_WIDTH = 500;
const CHAT_COLLAPSED_WIDTH = 22;

const chatSidebarWrapper = (open) => ({
  position: "relative", flexShrink: 0,
  width: open ? `${CHAT_SIDEBAR_WIDTH}px` : `${CHAT_COLLAPSED_WIDTH}px`,
  transition: "width 300ms ease-in-out",
  background: "#525659",
  // `overflow: clip` (not "hidden"): the sliding child is moved via `transform`,
  // and Chromium counts a transformed element's post-transform box toward its
  // nearest scrollable ancestor's scrollable overflow. With "hidden" that makes
  // this wrapper an actual scroll container, and the browser auto-scrolls it to
  // reveal the transformed content — shifting everything inside (including the
  // always-visible handle) out of view. "clip" clips visually without ever
  // establishing a scroll container, so there is no scrollLeft to auto-adjust.
  overflow: "clip",
});

const chatHandle = {
  position: "absolute", top: "50%",
  left: `${(CHAT_COLLAPSED_WIDTH - CHAT_HANDLE_WIDTH) / 2}px`,
  transform: "translateY(-50%)",
  width: `${CHAT_HANDLE_WIDTH}px`, height: `${CHAT_HANDLE_HEIGHT}px`,
  borderRadius: "9999px", background: "#0f0f14", border: "none", padding: 0,
  cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.35)", zIndex: 2,
};

const chatSlideContent = (open) => ({
  position: "absolute", top: 0, bottom: 0,
  left: `${CHAT_COLLAPSED_WIDTH}px`,
  width: `${CHAT_SIDEBAR_WIDTH - CHAT_COLLAPSED_WIDTH}px`,
  transform: open ? "translateX(0)" : "translateX(100%)",
  transition: "transform 300ms ease-in-out",
  display: "flex", borderLeft: "1px solid var(--border)",
});

const chatPanel = {
  position: "relative",
  flex: 1, minWidth: 0, display: "flex", flexDirection: "column",
  background: "var(--surface)", borderLeft: "1px solid var(--border)",
};

const chatHeader = {
  height: "48px", flexShrink: 0, display: "flex", alignItems: "center",
  justifyContent: "space-between", padding: "0 16px",
  borderBottom: "1px solid var(--border)", background: "var(--surface-alt)",
};

const chatMessages = {
  flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 14px",
  display: "flex", flexDirection: "column", gap: "10px",
};

const aiBubbleWrap = { display: "flex", justifyContent: "flex-start" };
const userBubbleWrap = { display: "flex", justifyContent: "flex-end" };

const aiBubble = {
  maxWidth: "85%", background: "var(--surface-alt)", color: "var(--text)",
  borderRadius: "12px 12px 12px 2px", padding: "10px 12px",
  fontSize: "13px", lineHeight: 1.55, whiteSpace: "pre-wrap",
};

const userBubble = {
  maxWidth: "85%", background: "var(--primary)", color: "#fff",
  borderRadius: "12px 12px 2px 12px", padding: "10px 12px",
  fontSize: "13px", lineHeight: 1.55, whiteSpace: "pre-wrap",
};

const chatInputRow = {
  flexShrink: 0, display: "flex", gap: "8px", padding: "12px 14px",
  borderTop: "1px solid var(--border)", background: "var(--surface)",
};

const chatInput = {
  flex: 1, border: "1px solid var(--border)", borderRadius: "8px",
  padding: "8px 12px", fontSize: "13px", outline: "none",
  color: "var(--text)", background: "var(--surface)",
};

const sendBtn = {
  background: "var(--primary)", color: "#fff", border: "none", borderRadius: "8px",
  padding: "8px 14px", fontSize: "15px", cursor: "pointer", flexShrink: 0,
};

const micBtn = {
  background: "var(--surface-alt)", color: "var(--text-muted)", border: "1px solid var(--border)",
  borderRadius: "8px", padding: "8px 10px", cursor: "pointer", flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center",
};

const voiceOverlay = {
  position: "absolute", inset: 0, background: "var(--surface)",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  gap: "18px", padding: "32px",
};

const voiceCloseBtn = {
  position: "absolute", top: "14px", right: "14px",
  width: "30px", height: "30px", borderRadius: "50%",
  background: "var(--surface-alt)", border: "1px solid var(--border)", color: "var(--text-muted)",
  fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

const voiceOrb = {
  width: "88px", height: "88px", borderRadius: "50%", border: "none",
  background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", transition: "transform 0.2s ease",
};

const voiceOrbListening = {
  background: "linear-gradient(135deg, var(--primary), var(--primary))",
  animation: "voiceListenPulse 1.6s ease-in-out infinite",
  cursor: "default",
};

const voiceOrbThinking = {
  background: "linear-gradient(135deg, var(--primary), var(--primary))",
  cursor: "default", opacity: 0.85,
};

const voiceOrbSpeaking = {
  background: "linear-gradient(135deg, var(--primary), var(--primary))",
  cursor: "default",
};

const voiceBars = { display: "flex", alignItems: "center", gap: "4px", height: "28px" };

const voiceBar = {
  width: "4px", height: "100%", borderRadius: "2px", background: "#fff",
  animation: "voiceSpeakWave 0.9s ease-in-out infinite",
};

const voiceStatusText = {
  fontSize: "14px", fontWeight: 600, color: "var(--text-muted)",
};

const voiceTranscriptBox = {
  maxWidth: "100%", fontSize: "14px", color: "var(--text)", textAlign: "center",
  lineHeight: 1.5, padding: "0 8px",
};

const voiceCaptionBox = {
  maxWidth: "100%", maxHeight: "160px", overflowY: "auto",
  display: "flex", flexDirection: "column", gap: "8px",
  padding: "12px 14px", borderRadius: "12px", background: "var(--surface-alt)",
};

const voiceCaptionQuestion = {
  fontSize: "12px", fontWeight: 600, color: "var(--text-faint)", textAlign: "center",
};

const voiceCaptionReply = {
  fontSize: "14px", color: "var(--text)", textAlign: "center", lineHeight: 1.5,
};

const voiceEndBtn = {
  display: "flex", alignItems: "center", gap: "6px",
  background: "#ef4444", color: "#fff", border: "none", borderRadius: "20px",
  padding: "10px 20px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
  marginTop: "4px",
};
