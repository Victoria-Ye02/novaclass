import { useState, useRef, useEffect } from "react";
import Sidebar from "../../components/Sidebar";
import Icon from "../../components/Icon";
import API from "../../services/api";

const quickBtns = [
  { icon: "note", label: "Grammar Q1", q: "책을 많이 ( ) 지식을 쌓을 수 있다 — what is the answer?" },
  { icon: "note", label: "Grammar Q2", q: "이 동네로 이사를 ( ) 일 년이 됐다 — explain the answer" },
  { icon: "book", label: "Vocabulary", q: "What does 가성비 mean?" },
  { icon: "info", label: "TOPIK Info", q: "What sections are in TOPIK II?" },
  { flag: "🇲🇲",  label: "Burmese",    q: "TOPIK II ရဲ့ grammar 만큼 ကို မြန်မာလို ရှင်းပြပေး" },
];

const ATTACH_TYPES = [
  { key: "image", icon: "camera",     label: "Image", accept: "image/*" },
  { key: "audio", icon: "microphone", label: "Audio", accept: "audio/*,.mp3,.wav,.m4a,.webm" },
  { key: "file",  icon: "file",       label: "File",  accept: ".pdf,.docx" },
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

export default function KMate() {
  const [messages, setMessages] = useState([
    { role: "bot", text: "👋 K.Mate မှ ကြိုဆိုပါတယ်!\nTOPIK II ပြင်ဆင်ရာတွင် ကူညီပေးပါမည်။\nEnglish / 한국어 / မြန်မာ — any language!" }
  ]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attachFile, setAttachFile] = useState(null); // { file, type }
  const bottomRef = useRef();
  const fileRef = useRef();
  const pendingTypeRef = useRef("image");

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  function pickAttachType(key) {
    setAttachOpen(false);
    pendingTypeRef.current = key;
    // Set accept + click synchronously (in the same user-gesture tick) so the
    // native file picker actually opens — a deferred click loses activation.
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

  async function send(q) {
    const text = (q || input).trim();
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
    <div style={s.layout}>
      <Sidebar />
      <main style={s.main}>
        <div style={s.header}>
          <div>
            <h2 style={s.title}><Icon name="bot" size={22} style={{ marginRight: "6px" }} />K_MATE</h2>
            <p style={s.sub}>TOPIK II AI Tutor — Ask anything in any language</p>
          </div>
          <button style={s.quizToggleBtn} onClick={() => setQuizMode(!quizMode)}>
            <Icon name={quizMode ? "chat" : "clipboard"} size={14} style={{ marginRight: "4px" }} />
            {quizMode ? "Back to Chat" : "Practice Quiz"}
          </button>
        </div>

        {quizMode ? <QuizMode /> : (
          <>
            {/* Chat */}
            <div style={s.chatBox}>
              {messages.map((m, i) => (
                <div key={i} style={{ ...s.msgRow, justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {m.role === "bot" && <Icon name="bot" size={24} style={s.botAvatar} />}
                  <div style={{ ...s.bubble, ...(m.role === "user" ? s.userBubble : s.botBubble) }}
                    dangerouslySetInnerHTML={{ __html: formatText(m.text) }} />
                  {m.role === "user" && <Icon name="user" size={24} style={s.userAvatar} />}
                </div>
              ))}
              {loading && (
                <div style={{ ...s.msgRow, justifyContent: "flex-start" }}>
                  <Icon name="bot" size={24} style={s.botAvatar} />
                  <div style={{ ...s.bubble, ...s.botBubble, color: "var(--text-faint)", fontStyle: "italic" }}>
                    K.Mate is thinking...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick Buttons */}
            <div style={s.quickRow}>
              {quickBtns.map((b, i) => (
                <button key={i} style={s.quickBtn} onClick={() => send(b.q)}>
                  {b.icon ? <Icon name={b.icon} size={12} style={{ marginRight: "4px" }} /> : b.flag + " "}
                  {b.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div style={s.inputBox}>
              {attachFile && (
                <div style={s.attachChip}>
                  <span>
                    <Icon name={ATTACH_TYPES.find(t => t.key === attachFile.type)?.icon} size={14} />
                    {" " + attachFile.file.name}
                  </span>
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
                            onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                          >
                            <Icon name={t.icon} size={16} /> {t.label}
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
                  <input
                    ref={fileRef}
                    type="file"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                </div>
                <textarea
                  style={s.textarea}
                  placeholder="Ask K.Mate anything about TOPIK..."
                  value={input}
                  rows={1}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                />
                <button style={{ ...s.sendBtn, opacity: loading ? 0.5 : 1 }} onClick={() => send()} disabled={loading}>➤</button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── Quiz Mode ──────────────────────────────────────────────
function QuizMode() {
  const [step, setStep]       = useState("settings"); // settings | loading | questions | results
  const [topic, setTopic]     = useState("grammar");
  const [count, setCount]     = useState(5);
  const [lang, setLang]       = useState("English");
  const [questions, setQs]    = useState([]);
  const [answers, setAnswers] = useState([]);
  const [current, setCurrent] = useState(0);
  const [result, setResult]   = useState(null);

  async function startQuiz() {
    setStep("loading");
    try {
      const res = await API.post("/kmate/quiz/generate", { topic, count });
      setQs(res.data.questions);
      setAnswers(new Array(res.data.questions.length).fill(0));
      setCurrent(0);
      setStep("questions");
    } catch { setStep("settings"); alert("Quiz generation failed. Is the server running?"); }
  }

  async function submitQuiz() {
    setStep("loading");
    try {
      const res = await API.post("/kmate/quiz/check", { questions, answers, language: lang });
      setResult(res.data);
      setStep("results");
    } catch { setStep("questions"); alert("Check failed."); }
  }

  const symbols = ["①","②","③","④"];
  const q = questions[current];

  const TOPIC_ICON = { grammar: "note", vocabulary: "book", mixed: "target" };
  const TOPIC_LABEL = { grammar: "Grammar", vocabulary: "Vocabulary", mixed: "Mixed" };

  if (step === "loading") return (
    <div style={s.quizCenter}><Icon name="hourglass" size={40} style={s.spinner} /><p>Processing...</p></div>
  );

  if (step === "settings") return (
    <div style={s.quizCard}>
      <h3 style={s.quizTitle}><Icon name="clipboard" size={20} style={{ marginRight: "6px" }} />TOPIK II Practice Quiz</h3>
      <label style={s.qLabel}>Choose Topic</label>
      <div style={s.optRow}>
        {["grammar","vocabulary","mixed"].map(t => (
          <button key={t} style={{ ...s.optBtn, ...(topic===t ? s.optActive : {}) }} onClick={() => setTopic(t)}>
            <Icon name={TOPIC_ICON[t]} size={14} style={{ marginRight: "4px" }} />{TOPIC_LABEL[t]}
          </button>
        ))}
      </div>
      <label style={s.qLabel}>Number of Questions</label>
      <div style={s.optRow}>
        {[5,10].map(n => (
          <button key={n} style={{ ...s.optBtn, ...(count===n ? s.optActive : {}) }} onClick={() => setCount(n)}>
            {n} Questions
          </button>
        ))}
      </div>
      <label style={s.qLabel}>Explanation Language</label>
      <div style={s.optRow}>
        {["English","Korean","Burmese"].map(l => (
          <button key={l} style={{ ...s.optBtn, ...(lang===l ? s.optActive : {}) }} onClick={() => setLang(l)}>
            {l === "English" ? "🇬🇧 English" : l === "Korean" ? "🇰🇷 Korean" : "🇲🇲 Burmese"}
          </button>
        ))}
      </div>
      <button style={s.startBtn} onClick={startQuiz}><Icon name="rocket" size={16} style={{ marginRight: "6px" }} />Start Quiz</button>
    </div>
  );

  if (step === "questions" && q) return (
    <div style={s.quizCard}>
      <div style={s.qProgress}>Question {current+1} / {questions.length}</div>
      <div style={s.qProgressBar}><div style={{ ...s.qProgressFill, width: `${((current+1)/questions.length)*100}%` }} /></div>
      <div style={s.qText}>{q.q}</div>
      <div style={s.optionsCol}>
        {q.opts.map((opt, i) => (
          <button key={i}
            style={{ ...s.choiceBtn, ...(answers[current] === i+1 ? s.choiceActive : {}) }}
            onClick={() => { const a = [...answers]; a[current] = i+1; setAnswers(a); }}
          >{symbols[i]} {opt}</button>
        ))}
      </div>
      <div style={s.qNav}>
        {current > 0 && <button style={s.navBtn} onClick={() => setCurrent(c => c-1)}>← Back</button>}
        {current < questions.length-1
          ? <button style={{ ...s.navBtn, ...s.navBtnPrimary }} disabled={!answers[current]} onClick={() => setCurrent(c => c+1)}>Next →</button>
          : <button style={{ ...s.navBtn, ...s.navBtnGreen }} disabled={!answers[current]} onClick={submitQuiz}>
              <Icon name="checkmark-yes" size={14} style={{ marginRight: "4px" }} />Submit Quiz
            </button>
        }
      </div>
    </div>
  );

  if (step === "results" && result) {
    const pct = Math.round((result.score / result.total) * 100);
    const scoreIcon = pct >= 80 ? "party-popper" : pct >= 60 ? "thumbs-up" : "flexed-biceps";
    return (
      <div style={s.quizCard}>
        <div style={s.scoreCard}>
          <div style={s.scoreNum}>{result.score} / {result.total}</div>
          <div style={s.scoreLabel}>{pct}% <Icon name={scoreIcon} size={18} /></div>
        </div>
        <div style={s.explanation} dangerouslySetInnerHTML={{ __html: formatText(result.explanation) }} />
        <div style={s.qNav}>
          <button style={{ ...s.navBtn, ...s.navBtnPrimary }} onClick={() => { setStep("settings"); setResult(null); }}>
            <Icon name="refresh" size={14} style={{ marginRight: "4px" }} />Try Again
          </button>
        </div>
      </div>
    );
  }
  return null;
}

const s = {
  layout: { display: "flex", minHeight: "100vh", background: "var(--bg)" },
  main: { marginLeft: "240px", flex: 1, display: "flex", flexDirection: "column", height: "100vh", padding: "24px 32px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  title: { fontSize: "22px", fontWeight: 700, color: "var(--text)" },
  sub: { fontSize: "13px", color: "var(--text-muted)" },
  quizToggleBtn: {
    background: "var(--primary)", color: "#fff", padding: "10px 20px",
    borderRadius: "10px", fontSize: "14px", fontWeight: 600, border: "none",
  },
  chatBox: {
    flex: 1, overflowY: "auto", background: "var(--surface)", borderRadius: "16px",
    padding: "20px", marginBottom: "12px", border: "1px solid var(--border)",
    display: "flex", flexDirection: "column", gap: "16px",
  },
  msgRow: { display: "flex", gap: "10px", alignItems: "flex-end" },
  botAvatar: { fontSize: "24px", flexShrink: 0 },
  userAvatar: { fontSize: "24px", flexShrink: 0 },
  bubble: { maxWidth: "75%", padding: "12px 16px", borderRadius: "16px", fontSize: "14px", lineHeight: 1.7 },
  userBubble: { background: "var(--primary)", color: "#fff", borderBottomRightRadius: "4px" },
  botBubble: { background: "var(--surface-alt)", color: "var(--text)", border: "1px solid var(--border)", borderBottomLeftRadius: "4px" },
  quickRow: { display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" },
  quickBtn: {
    background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--primary)",
    padding: "6px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 500,
  },
  inputBox: { background: "var(--surface)", borderRadius: "14px", border: "1px solid var(--border)", padding: "12px" },
  inputRow: { display: "flex", gap: "10px", alignItems: "center" },
  textarea: {
    flex: 1, border: "none", resize: "none", fontSize: "14px",
    color: "var(--text)", background: "transparent", outline: "none",
  },
  attachBtn: {
    width: "36px", height: "36px", borderRadius: "50%", border: "1.5px solid var(--border)",
    background: "var(--surface-alt)", color: "var(--primary)", fontSize: "20px", lineHeight: 1,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "transform 0.15s", flexShrink: 0,
  },
  menuOverlay: { position: "fixed", inset: 0, zIndex: 10 },
  attachMenu: {
    position: "absolute", bottom: "46px", left: 0, width: "170px",
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.15)", overflow: "hidden", zIndex: 11,
  },
  attachMenuItem: {
    width: "100%", display: "flex", alignItems: "center", gap: "8px",
    padding: "10px 14px", border: "none", borderBottom: "1px solid var(--surface-alt)",
    background: "transparent", cursor: "pointer", fontSize: "13px",
    fontWeight: 600, color: "var(--text)", textAlign: "left",
  },
  attachChip: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
    background: "var(--primary-tint)", color: "var(--primary)", fontSize: "12px", fontWeight: 600,
    padding: "6px 10px", borderRadius: "8px", marginBottom: "10px",
  },
  chipRemove: {
    border: "none", background: "transparent", color: "var(--primary)",
    cursor: "pointer", fontSize: "12px", fontWeight: 700,
  },
  sendBtn: {
    background: "var(--primary)", color: "#fff", border: "none",
    width: "40px", height: "40px", borderRadius: "10px", fontSize: "18px",
  },
  // Quiz styles
  quizCenter: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" },
  spinner: { fontSize: "40px" },
  quizCard: { background: "var(--surface)", borderRadius: "16px", padding: "28px", border: "1px solid var(--border)", flex: 1, overflowY: "auto" },
  quizTitle: { fontSize: "20px", fontWeight: 700, marginBottom: "20px", color: "var(--text)" },
  qLabel: { display: "block", fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "8px" },
  optRow: { display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" },
  optBtn: {
    flex: 1, padding: "10px 16px", border: "2px solid var(--border)",
    borderRadius: "10px", fontSize: "14px", fontWeight: 500,
    background: "transparent", color: "var(--text-muted)", minWidth: "100px",
  },
  optActive: { borderColor: "var(--primary)", background: "var(--primary-tint)", color: "var(--primary)", fontWeight: 700 },
  startBtn: {
    width: "100%", padding: "14px", background: "var(--primary)", color: "#fff",
    borderRadius: "12px", fontSize: "16px", fontWeight: 700, border: "none", marginTop: "8px",
  },
  qProgress: { fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" },
  qProgressBar: { height: "4px", background: "var(--border)", borderRadius: "4px", marginBottom: "20px" },
  qProgressFill: { height: "100%", background: "var(--primary)", borderRadius: "4px", transition: "width 0.3s" },
  qText: { fontSize: "17px", fontWeight: 600, color: "var(--text)", padding: "16px", background: "var(--surface-alt)", borderRadius: "10px", marginBottom: "20px", lineHeight: 1.7, borderLeft: "4px solid var(--primary)" },
  optionsCol: { display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" },
  choiceBtn: {
    padding: "13px 16px", border: "2px solid var(--border)", borderRadius: "10px",
    fontSize: "15px", background: "var(--surface)", color: "var(--text)", textAlign: "left",
  },
  choiceActive: { borderColor: "var(--primary)", background: "var(--primary-tint)", color: "var(--primary)", fontWeight: 600 },
  qNav: { display: "flex", gap: "10px", justifyContent: "flex-end" },
  navBtn: { padding: "10px 24px", border: "1.5px solid var(--border)", borderRadius: "10px", fontSize: "14px", fontWeight: 600, background: "var(--surface)", color: "var(--text-muted)" },
  navBtnPrimary: { background: "var(--primary)", color: "#fff", border: "none" },
  navBtnGreen: { background: "#10b981", color: "#fff", border: "none" },
  scoreCard: { textAlign: "center", padding: "24px", background: "var(--surface-alt)", borderRadius: "12px", marginBottom: "20px" },
  scoreNum: { fontSize: "48px", fontWeight: 800, color: "var(--primary)" },
  scoreLabel: { fontSize: "18px", color: "var(--text-muted)", marginTop: "4px" },
  explanation: { fontSize: "14px", lineHeight: 1.9, color: "var(--text-muted)", marginBottom: "20px" },
};
