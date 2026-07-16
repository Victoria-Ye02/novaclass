import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import API from "../../services/api";

const today = new Date();
const monthName = today.toLocaleString("default", { month: "long" });
const year = today.getFullYear();

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const navigate = useNavigate();
  const name = localStorage.getItem("nova_name") || "Student";

  useEffect(() => {
    API.get("/progress/summary").then(r => setSummary(r.data)).catch(() => {});
  }, []);

  return (
    <div style={s.layout}>
      <Sidebar />
      <main style={s.main}>
        {/* Top Bar */}
        <div style={s.topbar}>
          <div style={s.searchWrap}>
            <span style={s.searchIcon}>🔍</span>
            <input style={s.search} placeholder="Search lessons, materials, or students..." />
          </div>
          <div style={s.userChip}>
            <div style={s.avatar}>{name[0]?.toUpperCase()}</div>
            <div>
              <div style={s.userName}>{name}</div>
              <div style={s.userRole}>STUDENT</div>
            </div>
          </div>
        </div>

        {/* Welcome */}
        <div style={s.welcomeRow}>
          <div>
            <h1 style={s.welcomeTitle}>Welcome back, {name}! 👋</h1>
            <p style={s.welcomeSub}>Here is what is happening on your educational portal today.</p>
          </div>
        </div>

        {/* Stats Row */}
        <div style={s.statsRow}>
          {[
            { icon: "💬", label: "Total Chats",    value: summary?.total_chats      ?? "—" },
            { icon: "✅", label: "Quiz Accuracy",  value: summary?.overall_accuracy  ? `${summary.overall_accuracy}%` : "—" },
            { icon: "📚", label: "Total Quizzes",  value: summary?.total_quizzes     ?? "—" },
            { icon: "🎯", label: "TOPIK Level",    value: "II" },
          ].map((stat, i) => (
            <div key={i} style={s.statCard}>
              <span style={s.statIcon}>{stat.icon}</span>
              <div style={s.statValue}>{stat.value}</div>
              <div style={s.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Main Grid */}
        <div style={s.grid}>
          {/* Left: Classes */}
          <div style={s.colLeft}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Your Classes</h3>
              <span style={s.viewAll}>View All</span>
            </div>
            <div style={s.classCards}>
              {/* Add New */}
              <div style={{ ...s.classCard, ...s.classCardAdd }} onClick={() => navigate("/classroom")}>
                <div style={s.plusIcon}>+</div>
                <div style={s.cardTitle}>Join or Create Class</div>
                <div style={s.cardSub}>Start a new journey</div>
              </div>
              {/* Active */}
              <div style={s.classCard}>
                <span style={{ ...s.badge, background: "#d1fae5", color: "#065f46" }}>ACTIVE</span>
                <div style={s.cardTitle}>Advanced Korean II</div>
                <div style={s.cardSub}>Manage your learning or teaching materials here.</div>
                <div style={s.cardFooter}>
                  <div style={s.avatarGroup}>👤👤👤 <span style={s.cardSub}>+12</span></div>
                  <span style={s.arrow}>→</span>
                </div>
              </div>
              {/* Upcoming */}
              <div style={s.classCard}>
                <span style={{ ...s.badge, background: "#dbeafe", color: "#1e40af" }}>UPCOMING</span>
                <div style={s.cardTitle}>TOPIK Prep (Intensive)</div>
                <div style={s.progressWrap}>
                  <div style={s.progressBar}><div style={{ ...s.progressFill, width: "65%" }} /></div>
                  <span style={s.cardSub}>Curriculum Progress 65%</span>
                </div>
                <button style={s.resumeBtn} onClick={() => navigate("/kmate")}>Resume Lesson</button>
              </div>
            </div>

            {/* AI Tools */}
            <div style={{ ...s.sectionHeader, marginTop: "24px" }}>
              <h3 style={s.sectionTitle}>Recommended AI Tools</h3>
              <span style={s.proBadge}>PRO</span>
            </div>
            <div style={s.aiTools}>
              {[
                { icon: "🌐", name: "Smart Translator",  desc: "Real-time context"        },
                { icon: "✏️", name: "Grammar Fixer",     desc: "Deep structural analysis" },
                { icon: "📋", name: "TOPIK Quizzer",     desc: "Personalized practice"    },
                { icon: "🤖", name: "K_MATE",            desc: "Help 24/7"                },
              ].map((tool, i) => (
                <div key={i} style={s.toolCard}
                  onClick={() => tool.name === "K_MATE" && navigate("/kmate")}
                >
                  <div style={s.toolIcon}>{tool.icon}</div>
                  <div style={s.toolName}>{tool.name}</div>
                  <div style={s.toolDesc}>{tool.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Calendar + Events + Insights */}
          <div style={s.colRight}>
            {/* Calendar */}
            <div style={s.card}>
              <div style={s.calHeader}>
                <span style={s.calTitle}>{monthName} {year}</span>
                <div style={s.calNav}><button style={s.calBtn}>‹</button><button style={s.calBtn}>›</button></div>
              </div>
              <MiniCalendar />
            </div>

            {/* Upcoming Events */}
            <div style={s.card}>
              <h3 style={s.cardHeading}>Upcoming Events</h3>
              {[
                { date: "28", month: "MAY", title: "TOPIK Mock Exam",      time: "09:00 AM – Online Portal" },
                { date: "02", month: "JUN", title: "Curriculum Workshop",  time: "02:30 PM – Room 402"      },
              ].map((e, i) => (
                <div key={i} style={s.eventRow}>
                  <div style={s.eventDate}>
                    <div style={s.eventDay}>{e.date}</div>
                    <div style={s.eventMonth}>{e.month}</div>
                  </div>
                  <div>
                    <div style={s.eventTitle}>{e.title}</div>
                    <div style={s.eventTime}>{e.time}</div>
                  </div>
                </div>
              ))}
              <button style={s.scheduleBtn}>Full Schedule</button>
            </div>

            {/* Platform Insights */}
            <div style={s.card}>
              <h3 style={s.cardHeading}>Platform Insights</h3>
              {[
                { label: "Classroom Engagement", pct: 84 },
                { label: "AI Tool Adoption",     pct: 62 },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: "12px" }}>
                  <div style={s.insightRow}>
                    <span style={s.insightLabel}>{item.label}</span>
                    <span style={s.insightPct}>{item.pct}%</span>
                  </div>
                  <div style={s.progressBar}>
                    <div style={{ ...s.progressFill, width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MiniCalendar() {
  const days = ["S","M","T","W","T","F","S"];
  const today = new Date().getDate();
  const cells = Array.from({ length: 35 }, (_, i) => i - 2);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "4px", marginBottom: "8px" }}>
        {days.map(d => <div key={d} style={{ textAlign: "center", fontSize: "11px", color: "#9ca3af", fontWeight: 600 }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "4px" }}>
        {cells.map((d, i) => (
          <div key={i} style={{
            textAlign: "center", fontSize: "12px", padding: "4px",
            borderRadius: "50%", cursor: d > 0 ? "pointer" : "default",
            background: d === today ? "#3B37CC" : "transparent",
            color: d === today ? "#fff" : d > 0 ? "#374151" : "transparent",
            fontWeight: d === today ? 700 : 400,
          }}>{d > 0 ? d : ""}</div>
        ))}
      </div>
    </div>
  );
}

const s = {
  layout: { display: "flex", minHeight: "100vh", background: "#f5f5f5" },
  main: { marginLeft: "240px", flex: 1, padding: "24px 32px", minHeight: "100vh" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" },
  searchWrap: { position: "relative", flex: 1, maxWidth: "400px" },
  searchIcon: { position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px" },
  search: {
    width: "100%", padding: "10px 10px 10px 36px", background: "#fff",
    border: "1.5px solid #e5e7eb", borderRadius: "10px", fontSize: "14px",
  },
  userChip: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: {
    width: "36px", height: "36px", borderRadius: "50%", background: "#3B37CC",
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
  },
  userName: { fontSize: "14px", fontWeight: 600 },
  userRole: { fontSize: "11px", color: "#6b7280", letterSpacing: "0.5px" },
  welcomeRow: { marginBottom: "24px" },
  welcomeTitle: { fontSize: "26px", fontWeight: 700, color: "#1a1a2e", marginBottom: "4px" },
  welcomeSub: { fontSize: "14px", color: "#6b7280" },
  statsRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "28px" },
  statCard: {
    background: "#fff", borderRadius: "12px", padding: "20px",
    textAlign: "center", border: "1px solid #e5e7eb",
  },
  statIcon: { fontSize: "24px", display: "block", marginBottom: "8px" },
  statValue: { fontSize: "28px", fontWeight: 700, color: "#3B37CC" },
  statLabel: { fontSize: "12px", color: "#6b7280", marginTop: "4px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 300px", gap: "24px" },
  colLeft: {},
  colRight: { display: "flex", flexDirection: "column", gap: "16px" },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" },
  sectionTitle: { fontSize: "16px", fontWeight: 700, color: "#1a1a2e" },
  viewAll: { fontSize: "13px", color: "#3B37CC", cursor: "pointer", fontWeight: 600 },
  proBadge: {
    background: "#3B37CC", color: "#fff", padding: "2px 8px",
    borderRadius: "4px", fontSize: "11px", fontWeight: 700,
  },
  classCards: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px" },
  classCard: {
    background: "#fff", borderRadius: "12px", padding: "20px",
    border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: "8px",
  },
  classCardAdd: {
    border: "2px dashed #e5e7eb", cursor: "pointer",
    alignItems: "center", justifyContent: "center", textAlign: "center",
  },
  plusIcon: {
    width: "40px", height: "40px", borderRadius: "50%", background: "#f5f5f5",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "24px", color: "#6b7280", marginBottom: "8px",
  },
  badge: { padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: 700, width: "fit-content" },
  cardTitle: { fontSize: "15px", fontWeight: 700, color: "#1a1a2e" },
  cardSub: { fontSize: "12px", color: "#6b7280" },
  cardFooter: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" },
  avatarGroup: { fontSize: "14px", display: "flex", alignItems: "center", gap: "4px" },
  arrow: { fontSize: "16px", color: "#3B37CC" },
  progressWrap: { display: "flex", flexDirection: "column", gap: "4px" },
  progressBar: { background: "#e5e7eb", borderRadius: "4px", height: "6px", overflow: "hidden" },
  progressFill: { background: "#3B37CC", height: "100%", borderRadius: "4px" },
  resumeBtn: {
    background: "#3B37CC", color: "#fff", padding: "8px 16px",
    borderRadius: "8px", fontSize: "13px", fontWeight: 600, border: "none", marginTop: "4px",
  },
  aiTools: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "12px" },
  toolCard: {
    background: "#fff", borderRadius: "12px", padding: "16px",
    textAlign: "center", border: "1px solid #e5e7eb", cursor: "pointer",
  },
  toolIcon: { fontSize: "24px", marginBottom: "8px" },
  toolName: { fontSize: "13px", fontWeight: 700, color: "#1a1a2e", marginBottom: "2px" },
  toolDesc: { fontSize: "11px", color: "#6b7280" },
  card: { background: "#fff", borderRadius: "12px", padding: "16px", border: "1px solid #e5e7eb" },
  calHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" },
  calTitle: { fontWeight: 700, fontSize: "14px" },
  calNav: { display: "flex", gap: "4px" },
  calBtn: { background: "transparent", border: "1px solid #e5e7eb", borderRadius: "4px", padding: "2px 8px", cursor: "pointer" },
  cardHeading: { fontSize: "15px", fontWeight: 700, marginBottom: "12px", color: "#1a1a2e" },
  eventRow: { display: "flex", gap: "12px", marginBottom: "12px", alignItems: "flex-start" },
  eventDate: { background: "#3B37CC", color: "#fff", borderRadius: "8px", padding: "6px 10px", textAlign: "center", minWidth: "44px" },
  eventDay: { fontSize: "16px", fontWeight: 700 },
  eventMonth: { fontSize: "10px", letterSpacing: "0.5px" },
  eventTitle: { fontSize: "13px", fontWeight: 600, color: "#1a1a2e" },
  eventTime: { fontSize: "11px", color: "#6b7280" },
  scheduleBtn: {
    width: "100%", padding: "8px", background: "transparent",
    border: "1.5px solid #e5e7eb", borderRadius: "8px", fontSize: "13px",
    fontWeight: 600, color: "#6b7280", marginTop: "4px",
  },
  insightRow: { display: "flex", justifyContent: "space-between", marginBottom: "4px" },
  insightLabel: { fontSize: "13px", color: "#374151" },
  insightPct: { fontSize: "13px", fontWeight: 700, color: "#3B37CC" },
};
