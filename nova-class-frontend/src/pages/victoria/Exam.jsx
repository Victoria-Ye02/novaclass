import { useState } from "react";
import Sidebar from "../../components/Sidebar";
import API from "../../services/api";

const symbols = ["①", "②", "③", "④"];

function formatText(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

export default function Exam() {
  const [step, setStep]       = useState("home");   // home | settings | loading | exam | results
  const [topic, setTopic]     = useState("mixed");
  const [count, setCount]     = useState(5);
  const [lang, setLang]       = useState("English");
  const [questions, setQs]    = useState([]);
  const [answers, setAnswers] = useState([]);
  const [current, setCurrent] = useState(0);
  const [result, setResult]   = useState(null);
  const [timeLeft, setTime]   = useState(null);

  async function startExam() {
    setStep("loading");
    try {
      const res = await API.post("/kmate/quiz/generate", { topic, count });
      setQs(res.data.questions);
      setAnswers(new Array(res.data.questions.length).fill(0));
      setCurrent(0);
      setTime(count * 60); // 1 min per question
      setStep("exam");
    } catch {
      setStep("settings");
      alert("❌ Failed to generate exam. Make sure both servers are running.");
    }
  }

  async function submitExam() {
    setStep("loading");
    try {
      const res = await API.post("/kmate/quiz/check", { questions, answers, language: lang });
      setResult(res.data);
      setStep("results");
    } catch {
      setStep("exam");
      alert("❌ Submission failed.");
    }
  }

  function reset() {
    setStep("home"); setQs([]); setAnswers([]); setCurrent(0); setResult(null);
  }

  const q = questions[current];
  const answered = answers.filter(a => a > 0).length;

  // ── HOME ──────────────────────────────
  if (step === "home") return (
    <div style={s.layout}>
      <Sidebar />
      <main style={s.main}>
        <div style={s.hero}>
          <div style={s.heroIcon}>📝</div>
          <h1 style={s.heroTitle}>TOPIK II Exam Mode</h1>
          <p style={s.heroSub}>Practice with AI-generated TOPIK II exam questions.<br />Get instant scoring and detailed explanations.</p>
          <button style={s.startHeroBtn} onClick={() => setStep("settings")}>🚀 Start Exam</button>
        </div>

        <div style={s.featuresGrid}>
          {[
            { icon: "🤖", title: "AI-Generated",    desc: "Fresh questions every time based on real TOPIK II patterns" },
            { icon: "📊", title: "Instant Scoring",  desc: "Know your score immediately after submitting" },
            { icon: "💡", title: "Full Explanation", desc: "K.Mate explains every answer in detail" },
            { icon: "🌐", title: "Any Language",     desc: "Get explanations in English, Korean, or Burmese" },
          ].map((f, i) => (
            <div key={i} style={s.featureCard}>
              <div style={s.featureIcon}>{f.icon}</div>
              <div style={s.featureTitle}>{f.title}</div>
              <div style={s.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );

  // ── SETTINGS ──────────────────────────
  if (step === "settings") return (
    <div style={s.layout}>
      <Sidebar />
      <main style={s.main}>
        <div style={s.settingsCard}>
          <h2 style={s.settingsTitle}>⚙️ Exam Settings</h2>

          <div style={s.settingsSection}>
            <label style={s.sLabel}>Choose Topic</label>
            <div style={s.optRow}>
              {[
                { val: "grammar",    label: "📝 Grammar"    },
                { val: "vocabulary", label: "📖 Vocabulary" },
                { val: "mixed",      label: "🎯 Mixed"      },
              ].map(t => (
                <button key={t.val} style={{ ...s.optBtn, ...(topic === t.val ? s.optActive : {}) }}
                  onClick={() => setTopic(t.val)}>{t.label}</button>
              ))}
            </div>
          </div>

          <div style={s.settingsSection}>
            <label style={s.sLabel}>Number of Questions</label>
            <div style={s.optRow}>
              {[5, 10, 15, 20].map(n => (
                <button key={n} style={{ ...s.optBtn, ...(count === n ? s.optActive : {}) }}
                  onClick={() => setCount(n)}>{n} Questions</button>
              ))}
            </div>
          </div>

          <div style={s.settingsSection}>
            <label style={s.sLabel}>Explanation Language</label>
            <div style={s.optRow}>
              {[
                { val: "English", label: "🇬🇧 English" },
                { val: "Korean",  label: "🇰🇷 Korean"  },
                { val: "Burmese", label: "🇲🇲 Burmese" },
              ].map(l => (
                <button key={l.val} style={{ ...s.optBtn, ...(lang === l.val ? s.optActive : {}) }}
                  onClick={() => setLang(l.val)}>{l.label}</button>
              ))}
            </div>
          </div>

          <div style={s.settingsInfo}>
            ⏱️ Time: {count} minutes &nbsp;|&nbsp; 📝 {count} Questions &nbsp;|&nbsp; 🎯 {topic.charAt(0).toUpperCase()+topic.slice(1)}
          </div>

          <div style={s.settingsBtns}>
            <button style={s.backBtn} onClick={reset}>← Back</button>
            <button style={s.beginBtn} onClick={startExam}>Begin Exam →</button>
          </div>
        </div>
      </main>
    </div>
  );

  // ── LOADING ───────────────────────────
  if (step === "loading") return (
    <div style={s.layout}>
      <Sidebar />
      <main style={{ ...s.main, ...s.center }}>
        <div style={s.loadingBox}>
          <div style={s.loadingIcon}>⏳</div>
          <h3 style={s.loadingText}>Generating your exam...</h3>
          <p style={s.loadingSub}>K.Mate is preparing TOPIK II questions for you</p>
        </div>
      </main>
    </div>
  );

  // ── EXAM ──────────────────────────────
  if (step === "exam" && q) return (
    <div style={s.layout}>
      <Sidebar />
      <main style={s.examMain}>
        {/* Exam Header */}
        <div style={s.examHeader}>
          <div style={s.examTitle}>📝 TOPIK II Practice Exam</div>
          <div style={s.examMeta}>
            <span style={s.metaChip}>{answered}/{questions.length} Answered</span>
            <span style={s.metaChip}>Q{current+1}/{questions.length}</span>
          </div>
        </div>

        {/* Progress */}
        <div style={s.examProgress}>
          <div style={{ ...s.examProgressFill, width: `${((current+1)/questions.length)*100}%` }} />
        </div>

        {/* Question Navigator */}
        <div style={s.qNav}>
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              style={{
                ...s.qDot,
                background: i === current ? "#3B37CC" : answers[i] > 0 ? "#10b981" : "#e5e7eb",
                color: i === current || answers[i] > 0 ? "#fff" : "#6b7280",
              }}>{i+1}</button>
          ))}
        </div>

        {/* Question */}
        <div style={s.qCard}>
          <div style={s.qNum}>Question {current+1}</div>
          <div style={s.qText}>{q.q}</div>
          <div style={s.optionsGrid}>
            {q.opts.map((opt, i) => (
              <button key={i}
                style={{
                  ...s.optChoice,
                  ...(answers[current] === i+1 ? s.optChosen : {})
                }}
                onClick={() => { const a = [...answers]; a[current] = i+1; setAnswers(a); }}
              >
                <span style={s.optSymbol}>{symbols[i]}</span>
                <span>{opt}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Navigation */}
        <div style={s.examNavRow}>
          <button style={s.navPrev} disabled={current === 0} onClick={() => setCurrent(c => c-1)}>← Previous</button>
          <div style={{ display: "flex", gap: "10px" }}>
            {current < questions.length-1
              ? <button style={s.navNext} onClick={() => setCurrent(c => c+1)}>Next →</button>
              : <button style={s.navSubmit} onClick={submitExam}>
                  ✅ Submit Exam ({answered}/{questions.length} answered)
                </button>
            }
          </div>
        </div>
      </main>
    </div>
  );

  // ── RESULTS ───────────────────────────
  if (step === "results" && result) {
    const pct   = Math.round((result.score / result.total) * 100);
    const grade = pct >= 80 ? { label: "Excellent! 🎉", color: "#10b981" }
                : pct >= 60 ? { label: "Good Job! 👍",   color: "#3B37CC" }
                :             { label: "Keep Studying 💪", color: "#f59e0b" };
    return (
      <div style={s.layout}>
        <Sidebar />
        <main style={s.main}>
          {/* Score Card */}
          <div style={s.resultHero}>
            <div style={s.bigScore}>{result.score}<span style={s.bigScoreTotal}>/{result.total}</span></div>
            <div style={{ color: grade.color, fontSize: "20px", fontWeight: 700 }}>{grade.label}</div>
            <div style={s.pctBar}>
              <div style={{ ...s.pctFill, width: `${pct}%`, background: grade.color }} />
            </div>
            <div style={s.pctLabel}>{pct}% Score</div>
          </div>

          {/* Per-question result */}
          <div style={s.resultGrid}>
            {result.results.map((r, i) => (
              <div key={i} style={{ ...s.resultItem, borderLeft: `4px solid ${r.is_correct ? "#10b981" : "#ef4444"}` }}>
                <div style={s.resultHeader}>
                  <span style={s.resultQ}>Q{i+1}</span>
                  <span style={{ color: r.is_correct ? "#10b981" : "#ef4444", fontWeight: 700 }}>
                    {r.is_correct ? "✅ Correct" : "❌ Wrong"}
                  </span>
                </div>
                <div style={s.resultQText}>{r.question}</div>
                <div style={s.resultAnswer}>
                  Correct: <strong>{symbols[r.correct_answer-1]} {r.options[r.correct_answer-1]}</strong>
                  {!r.is_correct && <> &nbsp;|&nbsp; You: <span style={{color:"#ef4444"}}>{symbols[r.user_answer-1]} {r.options[r.user_answer-1]}</span></>}
                </div>
              </div>
            ))}
          </div>

          {/* K.Mate Explanation */}
          <div style={s.explanationCard}>
            <h3 style={s.expTitle}>🤖 K.Mate's Explanation</h3>
            <div style={s.expText} dangerouslySetInnerHTML={{ __html: formatText(result.explanation) }} />
          </div>

          <div style={s.resultBtns}>
            <button style={s.retryBtn} onClick={() => setStep("settings")}>🔄 Try Again</button>
            <button style={s.homeBtn} onClick={reset}>🏠 Back to Exam Home</button>
          </div>
        </main>
      </div>
    );
  }

  return null;
}

const s = {
  layout: { display: "flex", minHeight: "100vh", background: "#f5f5f5" },
  main: { marginLeft: "240px", flex: 1, padding: "32px 40px" },
  examMain: { marginLeft: "240px", flex: 1, padding: "24px 40px", display: "flex", flexDirection: "column" },
  center: { display: "flex", alignItems: "center", justifyContent: "center" },

  // Home
  hero: { textAlign: "center", padding: "48px 20px 40px", background: "linear-gradient(135deg,#3B37CC,#7c3aed)", borderRadius: "20px", color: "#fff", marginBottom: "28px" },
  heroIcon: { fontSize: "56px", marginBottom: "16px" },
  heroTitle: { fontSize: "32px", fontWeight: 800, marginBottom: "12px" },
  heroSub: { fontSize: "16px", opacity: 0.85, lineHeight: 1.7, marginBottom: "28px" },
  startHeroBtn: { background: "#fff", color: "#3B37CC", padding: "14px 36px", borderRadius: "12px", fontSize: "16px", fontWeight: 700, border: "none" },
  featuresGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px" },
  featureCard: { background: "#fff", borderRadius: "14px", padding: "24px", textAlign: "center", border: "1px solid #e5e7eb" },
  featureIcon: { fontSize: "32px", marginBottom: "12px" },
  featureTitle: { fontSize: "15px", fontWeight: 700, color: "#1a1a2e", marginBottom: "6px" },
  featureDesc: { fontSize: "13px", color: "#6b7280", lineHeight: 1.6 },

  // Settings
  settingsCard: { background: "#fff", borderRadius: "16px", padding: "36px", border: "1px solid #e5e7eb", maxWidth: "600px", margin: "0 auto" },
  settingsTitle: { fontSize: "22px", fontWeight: 700, marginBottom: "28px", color: "#1a1a2e" },
  settingsSection: { marginBottom: "24px" },
  sLabel: { display: "block", fontSize: "14px", fontWeight: 600, color: "#374151", marginBottom: "10px" },
  optRow: { display: "flex", gap: "10px", flexWrap: "wrap" },
  optBtn: { flex: 1, padding: "10px 16px", border: "2px solid #e5e7eb", borderRadius: "10px", fontSize: "14px", fontWeight: 500, background: "#fff", color: "#6b7280", minWidth: "100px" },
  optActive: { borderColor: "#3B37CC", background: "#ede9fe", color: "#3B37CC", fontWeight: 700 },
  settingsInfo: { background: "#f5f5f5", padding: "12px 16px", borderRadius: "10px", fontSize: "14px", color: "#6b7280", textAlign: "center", marginBottom: "24px" },
  settingsBtns: { display: "flex", gap: "12px" },
  backBtn: { flex: 1, padding: "12px", border: "1.5px solid #e5e7eb", borderRadius: "10px", background: "#fff", color: "#6b7280", fontSize: "15px", fontWeight: 600 },
  beginBtn: { flex: 2, padding: "12px", background: "#3B37CC", color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 700 },

  // Loading
  loadingBox: { textAlign: "center", background: "#fff", padding: "48px", borderRadius: "16px", border: "1px solid #e5e7eb" },
  loadingIcon: { fontSize: "48px", marginBottom: "16px" },
  loadingText: { fontSize: "20px", fontWeight: 700, color: "#1a1a2e", marginBottom: "8px" },
  loadingSub: { fontSize: "14px", color: "#6b7280" },

  // Exam
  examHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  examTitle: { fontSize: "20px", fontWeight: 700, color: "#1a1a2e" },
  examMeta: { display: "flex", gap: "8px" },
  metaChip: { background: "#ede9fe", color: "#3B37CC", padding: "4px 12px", borderRadius: "20px", fontSize: "13px", fontWeight: 600 },
  examProgress: { height: "6px", background: "#e5e7eb", borderRadius: "4px", marginBottom: "16px", overflow: "hidden" },
  examProgressFill: { height: "100%", background: "#3B37CC", borderRadius: "4px", transition: "width 0.3s" },
  qNav: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "20px" },
  qDot: { width: "32px", height: "32px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, border: "none", cursor: "pointer" },
  qCard: { background: "#fff", borderRadius: "16px", padding: "28px", border: "1px solid #e5e7eb", marginBottom: "20px", flex: 1 },
  qNum: { fontSize: "13px", color: "#3B37CC", fontWeight: 700, marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.5px" },
  qText: { fontSize: "18px", fontWeight: 600, color: "#1a1a2e", lineHeight: 1.7, marginBottom: "24px", padding: "16px", background: "#f5f5f5", borderRadius: "10px", borderLeft: "4px solid #3B37CC" },
  optionsGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  optChoice: { display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", border: "2px solid #e5e7eb", borderRadius: "10px", fontSize: "15px", background: "#fff", color: "#1a1a2e", textAlign: "left", cursor: "pointer" },
  optChosen: { borderColor: "#3B37CC", background: "#ede9fe", color: "#3B37CC", fontWeight: 600 },
  optSymbol: { fontSize: "18px", fontWeight: 700, color: "#3B37CC", minWidth: "24px" },
  examNavRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  navPrev: { padding: "10px 24px", border: "1.5px solid #e5e7eb", borderRadius: "10px", background: "#fff", color: "#6b7280", fontSize: "14px", fontWeight: 600 },
  navNext: { padding: "10px 24px", background: "#3B37CC", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 600 },
  navSubmit: { padding: "10px 24px", background: "#10b981", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 700 },

  // Results
  resultHero: { background: "#fff", borderRadius: "16px", padding: "32px", textAlign: "center", border: "1px solid #e5e7eb", marginBottom: "24px" },
  bigScore: { fontSize: "72px", fontWeight: 800, color: "#3B37CC", lineHeight: 1 },
  bigScoreTotal: { fontSize: "40px", color: "#9ca3af" },
  pctBar: { height: "8px", background: "#e5e7eb", borderRadius: "4px", margin: "16px auto 8px", maxWidth: "300px", overflow: "hidden" },
  pctFill: { height: "100%", borderRadius: "4px" },
  pctLabel: { fontSize: "16px", color: "#6b7280" },
  resultGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" },
  resultItem: { background: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #e5e7eb" },
  resultHeader: { display: "flex", justifyContent: "space-between", marginBottom: "6px" },
  resultQ: { fontSize: "12px", fontWeight: 700, color: "#3B37CC", textTransform: "uppercase" },
  resultQText: { fontSize: "14px", color: "#1a1a2e", marginBottom: "8px", lineHeight: 1.5 },
  resultAnswer: { fontSize: "13px", color: "#6b7280" },
  explanationCard: { background: "#fff", borderRadius: "16px", padding: "24px", border: "1px solid #e5e7eb", marginBottom: "24px" },
  expTitle: { fontSize: "16px", fontWeight: 700, color: "#1a1a2e", marginBottom: "16px" },
  expText: { fontSize: "14px", lineHeight: 1.9, color: "#374151" },
  resultBtns: { display: "flex", gap: "12px" },
  retryBtn: { flex: 1, padding: "13px", background: "#3B37CC", color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 700 },
  homeBtn: { flex: 1, padding: "13px", background: "#fff", color: "#374151", border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "15px", fontWeight: 600 },
};
