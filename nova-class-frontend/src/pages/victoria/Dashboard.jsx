import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import Icon from "../../components/Icon";
import API from "../../services/api";
import { useLang } from "../../LanguageContext";

const URGENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const CAL_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVENT_COLORS = ["var(--primary)", "#059669", "#E97316", "#DC2626", "#0891B2", "var(--primary)"];

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatDateTime(dateStr) {
  const d = new Date(dateStr);
  const isToday = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleString("default", { hour: "numeric", minute: "2-digit", hour12: true });
  const date = d.toLocaleString("default", { day: "numeric", month: "short" });
  return { day: String(d.getDate()).padStart(2, "0"), month: d.toLocaleString("default", { month: "short" }).toUpperCase(), time, label: isToday ? `Today ${time}` : `${date}` };
}


export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [classes, setClasses] = useState(null);
  const [deadlines, setDeadlines] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [todayPlan, setTodayPlan] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => new Date());
  const [calEvents, setCalEvents] = useState([]);
  const [addModal, setAddModal] = useState(null); // { date: "YYYY-MM-DD" }
  const [addForm, setAddForm] = useState({ class_id: "", title: "", color: EVENT_COLORS[0] });
  const [addLoading, setAddLoading] = useState(false);
  const [hoveredDay, setHoveredDay] = useState(null);
  const navigate = useNavigate();
  const bellRef = useRef(null);
  const name = localStorage.getItem("nova_name") || "Student";
  const { lang } = useLang();

  function loadNotifications() {
    API.get("/notifications").then(r => setNotifications(r.data.notifications || [])).catch(() => {});
    API.get("/notifications/unread-count").then(r => setUnreadCount(r.data.count || 0)).catch(() => {});
  }

  useEffect(() => {
    API.get("/progress/summary").then(r => setSummary(r.data)).catch(() => {});
    API.get(`/progress/today-plan?lang=${lang}`).then(r => setTodayPlan(r.data)).catch(() => setTodayPlan({ studentPlan: [], teacherPlan: [] }));
    API.get("/classroom/classes").then(r => setClasses(r.data)).catch(() => setClasses([]));
    API.get("/classroom/deadlines").then(r => setDeadlines(r.data.deadlines || [])).catch(() => setDeadlines([]));
    API.get("/classroom/attendance/summary").then(r => setAttendance(r.data)).catch(() => {});
    loadNotifications();
  }, []);

  useEffect(() => {
    function onOutsideClick(e) {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  useEffect(() => {
    API.get(`/calendar/events?month=${monthKey(calMonth)}`)
      .then(r => setCalEvents(r.data || []))
      .catch(() => {});
  }, [calMonth]);

  async function handleAddEvent() {
    if (!addForm.class_id || !addForm.title.trim()) return;
    setAddLoading(true);
    try {
      const { data } = await API.post("/calendar/events", {
        class_id: addForm.class_id,
        date: addModal.date,
        title: addForm.title.trim(),
        color: addForm.color,
      });
      setCalEvents(prev => [...prev, data]);
      setAddModal(null);
      setAddForm({ class_id: "", title: "", color: EVENT_COLORS[0] });
    } catch (e) {
      console.error(e);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDeleteEvent(id) {
    await API.delete(`/calendar/events/${id}`).catch(() => {});
    setCalEvents(prev => prev.filter(e => e.id !== id));
  }

  function openNotification(n) {
    if (!n.is_read) {
      API.post(`/notifications/${n.id}/read`).catch(() => {});
      setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, is_read: 1 } : x)));
      setUnreadCount(c => Math.max(0, c - 1));
    }
    setBellOpen(false);
    if (n.link_url) navigate(n.link_url);
  }

  const isTeaching = (summary?.classes_teaching ?? 0) > 0;
  const isLearning = (summary?.classes_joined ?? 0) > 0;
  const roleLabel = [isTeaching && "Teacher", isLearning && "Student"].filter(Boolean).join(" · ")
    || (localStorage.getItem("nova_role") || "student").toUpperCase();

  const allClasses = classes?.classes || classes || [];
  const teachingClasses = allClasses.filter(c => c.my_role === "teacher");

  // Build calendar grid for calMonth
  const calYear = calMonth.getFullYear();
  const calMo = calMonth.getMonth();
  const firstDay = new Date(calYear, calMo, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMo + 1, 0).getDate();
  const calCells = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // pad to full rows
  while (calCells.length % 7 !== 0) calCells.push(null);

  const todayStr = toYMD(new Date());
  const eventsMap = {}; // date string -> [event]
  calEvents.forEach(ev => {
    const d = ev.date.slice(0, 10);
    if (!eventsMap[d]) eventsMap[d] = [];
    eventsMap[d].push(ev);
  });

  const now = Date.now();
  const urgentDeadline = (deadlines || [])
    .filter(d => {
      const t = new Date(d.due_date).getTime();
      return t > now && t - now < URGENT_WINDOW_MS;
    })
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];

  let banner = null;
  if (urgentDeadline) {
    const due = formatDateTime(urgentDeadline.due_date);
    banner = {
      icon: "📌",
      text: `"${urgentDeadline.title}" assignment due ${due.time} today — ${urgentDeadline.class_name} class`,
      action: () => navigate(`/classroom/${urgentDeadline.class_id}`),
    };
  } else if ((summary?.to_grade_count ?? 0) > 0) {
    const n = summary.to_grade_count;
    banner = {
      icon: "📝",
      text: `${n} submission${n > 1 ? "s" : ""} waiting to be graded`,
      action: () => navigate("/classroom"),
    };
  }

  return (
    <div style={s.layout}>
      <Sidebar />
      <main style={s.main}>
        {/* Top Bar */}
        <div style={s.topbar}>
          <div style={s.searchWrap}>
            <Icon name="search" size={14} style={s.searchIcon} />
            <input style={s.search} placeholder="Search lessons, materials, or students..." />
          </div>
          <div style={s.topbarRight}>
            <div style={s.bellWrap} ref={bellRef}>
              <button type="button" style={s.bellBtn} aria-label="Notifications" onClick={() => setBellOpen(o => !o)}>
                <Icon name="bell" size={18} alt="" />
                {unreadCount > 0 && <span data-testid="unread-badge" style={s.bellBadge}>{unreadCount}</span>}
              </button>
              {bellOpen && (
                <div style={s.bellDropdown}>
                  <div style={s.bellDropdownHeader}>
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                      <span
                        style={s.bellMarkAll}
                        onClick={() => {
                          API.post("/notifications/read-all").catch(() => {});
                          setNotifications(prev => prev.map(x => ({ ...x, is_read: 1 })));
                          setUnreadCount(0);
                        }}
                      >
                        Mark all read
                      </span>
                    )}
                  </div>
                  {notifications.length === 0 && <div style={s.bellEmpty}>No notifications yet</div>}
                  {notifications.map(n => (
                    <div key={n.id} style={{ ...s.bellItem, ...(n.is_read ? {} : s.bellItemUnread) }} onClick={() => openNotification(n)}>
                      <div style={s.bellItemTitle}>{n.title}</div>
                      <div style={s.bellItemTime}>{formatDateTime(n.created_at).label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={s.userChip}>
              <div style={s.avatar}>{name[0]?.toUpperCase()}</div>
              <div>
                <div style={s.userName}>{name}</div>
                <div style={s.userRole}>{roleLabel}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Welcome */}
        <div style={s.welcomeRow}>
          <h1 style={s.welcomeTitle}>Welcome back, {name} 👋</h1>
        </div>

        {/* Priority banner */}
        {banner && (
          <div style={s.priorityBanner}>
            <span style={s.priorityText}>{banner.icon} {banner.text}</span>
            <button style={s.priorityBtn} onClick={banner.action}>View</button>
          </div>
        )}

        {todayPlan && (isTeaching || isLearning) && (
          <section style={s.todayPlanCard} aria-label="AI Today Plan">
            <div style={s.todayPlanHeader}>
              <div><span style={s.todayPlanSparkle}>✦</span> AI Today Plan</div>
              <span style={s.todayPlanHint}>Your next best steps</span>
            </div>
            <div style={s.todayPlanSections}>
              {isLearning && (
                <div style={s.todayPlanSection}>
                  <h3 style={s.todayPlanTitle}>Student Today Plan</h3>
                  {todayPlan.studentPlan?.length > 0 ? todayPlan.studentPlan.map((task, index) => (
                    <button type="button" key={`${task.link}-${index}`} style={{ ...s.todayTask, background: task.isOverdue ? "rgba(239, 68, 68, 0.08)" : "transparent" }} onClick={() => navigate(task.link)}>
                      <span style={s.todayTaskNumber}>{index + 1}</span>
                      <span style={s.todayTaskCopy}><strong>{task.title}</strong><small>{task.reason}</small></span>
                      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                        {task.dueLabel && <span style={{ fontSize: "11px", fontWeight: 600, color: task.isOverdue ? "#EF4444" : "#6B7280" }}>{task.dueLabel}</span>}
                        <span style={s.todayTaskGo}>Start →</span>
                      </span>
                    </button>
                  )) : <p style={s.todayPlanEmpty}>You are all caught up. Review a lesson or practice with K_MATE.</p>}
                </div>
              )}
              {isTeaching && (
                <div style={s.todayPlanSection}>
                  <h3 style={s.todayPlanTitle}>Teacher Today Plan</h3>
                  {todayPlan.teacherPlan?.length > 0 ? todayPlan.teacherPlan.map((task, index) => (
                    <button type="button" key={`${task.link}-${index}`} style={{ ...s.todayTask, background: task.isOverdue ? "rgba(239, 68, 68, 0.08)" : "transparent" }} onClick={() => navigate(task.link)}>
                      <span style={s.todayTaskNumber}>{index + 1}</span>
                      <span style={s.todayTaskCopy}><strong>{task.title}</strong><small>{task.reason}</small></span>
                      <span style={s.todayTaskGo}>Review →</span>
                    </button>
                  )) : <p style={s.todayPlanEmpty}>No grading is waiting today. Your classes are up to date.</p>}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Unified summary card */}
        {(isTeaching || isLearning) && (
          <div style={s.summaryCard}>
            <div style={s.summaryHalves}>
              {isTeaching && (
                <div style={{ ...s.summaryBlock, ...(isLearning ? s.summaryBlockBordered : {}) }}>
                  <div style={s.summaryBlockIcon}><Icon name="graduation-cap" size={22} alt="" /></div>
                  <div>
                    <div style={s.summaryBlockLabel}>Teaching</div>
                    <div style={s.summaryStatsRow}>
                      <span><strong>{summary.classes_teaching}</strong> classes</span>
                      <span><strong>{summary.to_grade_count}</strong> to grade</span>
                    </div>
                    <div style={s.quickActions}>
                      <button style={s.quickActionBtn} onClick={() => navigate("/classroom")}>
                        <Icon name="add-file" size={13} alt="" /> Create assignment
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {isLearning && (
                <div style={s.summaryBlock}>
                  <div style={{ ...s.summaryBlockIcon, ...s.summaryBlockIconCyan }}><Icon name="book" size={22} alt="" /></div>
                  <div>
                    <div style={s.summaryBlockLabel}>Learning</div>
                    <div style={s.summaryStatsRow}>
                      <span><strong>{summary.classes_joined}</strong> classes</span>
                      <span><strong>{summary.questions_asked}</strong> K.MATE Qs</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {attendance && attendance.total > 0 && (
              <div style={s.attendanceStrip}>
                <div style={s.attendanceRing(attendance.rate)}>{attendance.rate}%</div>
                <div style={s.attendanceText}>
                  <div><strong>Your attendance — {attendance.rate}% this month</strong></div>
                  <div style={s.attendanceBreakdown}>
                    {attendance.present} present · {attendance.late} late · {attendance.absent} absent
                  </div>
                </div>
                <span style={{ ...s.attendanceBadge, ...(attendance.rate >= 80 ? s.attendanceBadgeGood : s.attendanceBadgeBad) }}>
                  {attendance.rate >= 80 ? "Above requirement" : "Below requirement"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Main Grid */}
        <div style={s.grid}>
          {/* Left: Classes */}
          <div style={s.colLeft}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Your classes</h3>
              <span style={s.viewAll} onClick={() => navigate("/classroom")}>View All</span>
            </div>
            <div style={s.classList}>
              {(classes || []).map(cls => (
                <div key={cls.id} style={s.classRow} onClick={() => navigate(`/classroom/${cls.id}`)}>
                  <div style={s.classRowIcon}><Icon name="book" size={16} alt="" /></div>
                  <div style={s.classRowBody}>
                    <div style={s.classRowName}>{cls.name}</div>
                    <div style={s.classRowSub}>
                      {cls.my_role === "teacher" ? (cls.subject || "General") : `Taught by ${cls.teacher_name}`} · {cls.material_count} materials
                    </div>
                  </div>
                  <span style={{ ...s.classTag, ...(cls.my_role === "teacher" ? s.classTagTeaching : s.classTagLearning) }}>
                    {cls.my_role === "teacher" ? "Teaching" : "Learning"}
                  </span>
                </div>
              ))}
              <div style={s.classRowAdd} onClick={() => navigate("/classroom")}>
                <span>+ Join or Create Class</span>
              </div>
            </div>

            <div style={{ ...s.sectionHeader, marginTop: "20px" }}>
              <h3 style={s.sectionTitle}>AI Tools</h3>
            </div>
            <div style={s.aiToolsChip} onClick={() => navigate("/kmate")}>
              <Icon name="bot" size={16} alt="" /> Open K_MATE and more AI tools →
            </div>
          </div>

          {/* Right: Calendar + Upcoming */}
          <div style={s.colRight}>
            {/* Full Monthly Calendar */}
            <div style={s.card}>
              {/* Calendar header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <button
                  onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                  style={s.calNavBtn}
                >‹</button>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>
                  {calMonth.toLocaleString("default", { month: "long", year: "numeric" })}
                </span>
                <button
                  onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                  style={s.calNavBtn}
                >›</button>
              </div>

              {/* Day-of-week headers */}
              <div style={s.calGrid}>
                {CAL_HEADERS.map(h => (
                  <div key={h} style={s.calDayHeader}>{h}</div>
                ))}

                {/* Day cells */}
                {calCells.map((day, idx) => {
                  if (!day) return <div key={`empty-${idx}`} />;
                  const dateStr = `${calYear}-${String(calMo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isToday = dateStr === todayStr;
                  const dayEvents = eventsMap[dateStr] || [];
                  const isHovered = hoveredDay === dateStr;

                  return (
                    <div
                      key={dateStr}
                      style={{
                        ...s.calCell,
                        ...(isToday ? s.calCellToday : {}),
                        ...(isHovered && isTeaching ? { background: "var(--primary-tint)" } : {}),
                        position: "relative",
                      }}
                      onMouseEnter={() => isTeaching && setHoveredDay(dateStr)}
                      onMouseLeave={() => setHoveredDay(null)}
                    >
                      {/* Day number — ringed in the event's color when this date has an event */}
                      <span
                        title={dayEvents.length > 0 ? dayEvents.map(ev => ev.title).join(", ") : undefined}
                        onClick={e => { if (dayEvents.length > 0 && isTeaching) { e.stopPropagation(); handleDeleteEvent(dayEvents[0].id); } }}
                        style={{
                          fontSize: "12px", fontWeight: isToday ? 700 : 500,
                          boxSizing: "border-box",
                          ...(dayEvents.length > 0 ? {
                            width: "20px", height: "20px", borderRadius: "50%",
                            border: `2px solid ${dayEvents[0].color}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: isTeaching ? "pointer" : "default",
                          } : {}),
                        }}
                      >{day}</span>

                      {/* Teacher: + button on hover */}
                      {isTeaching && isHovered && (
                        <button
                          onClick={() => {
                            setAddModal({ date: dateStr });
                            setAddForm({ class_id: teachingClasses[0]?.id || "", title: "", color: EVENT_COLORS[0] });
                          }}
                          style={s.calAddBtn}
                          title="Add note"
                        >+</button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Legend: today's events */}
              {eventsMap[todayStr]?.length > 0 && (
                <div style={{ marginTop: "10px", borderTop: "1px solid var(--border)", paddingTop: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                  {eventsMap[todayStr].map(ev => (
                    <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: ev.color, flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{ev.title}</span>
                      <span style={{ color: "var(--text-faint)", fontSize: "10px" }}>{ev.class_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming deadlines */}
            <div style={s.card}>
              <h3 style={s.cardHeading}>Upcoming</h3>
              {deadlines && deadlines.length === 0 && <p style={s.noEventsHint}>No upcoming deadlines — you're all caught up 🎉</p>}
              {(deadlines || []).slice(0, 3).map(dl => {
                const due = formatDateTime(dl.due_date);
                return (
                  <div key={dl.id} style={s.upcomingRow}>
                    <span style={s.upcomingDot} />
                    <span style={s.upcomingTitle}>{dl.title} — {dl.class_name}</span>
                    <span style={s.upcomingTime}>{due.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Add Event Modal */}
      {addModal && (
        <div style={s.overlay} onClick={() => setAddModal(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>Add Note</h3>
            <p style={{ margin: "0 0 18px", fontSize: "12px", color: "var(--text-faint)" }}>{addModal.date}</p>

            <label style={s.fieldLabel}>Class</label>
            <select
              value={addForm.class_id}
              onChange={e => setAddForm(f => ({ ...f, class_id: e.target.value }))}
              style={s.fieldInput}
            >
              <option value="">Select class…</option>
              {teachingClasses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <label style={{ ...s.fieldLabel, marginTop: "12px" }}>Note</label>
            <input
              autoFocus
              value={addForm.title}
              onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Exam day, Holiday…"
              style={s.fieldInput}
              onKeyDown={e => e.key === "Enter" && handleAddEvent()}
            />

            <label style={{ ...s.fieldLabel, marginTop: "12px" }}>Color</label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              {EVENT_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setAddForm(f => ({ ...f, color: c }))}
                  style={{
                    width: "24px", height: "24px", borderRadius: "50%", background: c, border: "none",
                    cursor: "pointer", outline: addForm.color === c ? `3px solid ${c}` : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setAddModal(null)} style={s.btnOutline}>Cancel</button>
              <button
                onClick={handleAddEvent}
                disabled={addLoading || !addForm.class_id || !addForm.title.trim()}
                style={{ ...s.btnPrimary, opacity: (!addForm.class_id || !addForm.title.trim() || addLoading) ? 0.6 : 1 }}
              >
                {addLoading ? "Saving…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  layout: { display: "flex", minHeight: "100vh", background: "var(--bg)" },
  main: { marginLeft: "240px", flex: 1, padding: "24px 32px", minHeight: "100vh" },
  topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" },
  searchWrap: { position: "relative", flex: 1, maxWidth: "400px" },
  searchIcon: { position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "14px" },
  search: {
    width: "100%", padding: "10px 10px 10px 36px", background: "var(--surface)", color: "var(--text)",
    border: "1.5px solid var(--border)", borderRadius: "10px", fontSize: "14px",
  },
  topbarRight: { display: "flex", alignItems: "center", gap: "16px" },
  bellWrap: { position: "relative" },
  bellBtn: {
    position: "relative", width: "38px", height: "38px", borderRadius: "50%",
    background: "var(--surface)", border: "1px solid var(--border)",
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
  },
  bellBadge: {
    position: "absolute", top: "-2px", right: "-2px", background: "#DC2626", color: "#fff",
    fontSize: "10px", fontWeight: 700, borderRadius: "9px", minWidth: "16px", height: "16px",
    display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px",
  },
  bellDropdown: {
    position: "absolute", top: "46px", right: 0, width: "300px", maxHeight: "360px", overflowY: "auto",
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px",
    boxShadow: "0 4px 20px rgba(15,23,42,0.12)", zIndex: 50,
  },
  bellDropdownHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 14px", borderBottom: "1px solid var(--border)", fontSize: "13px", fontWeight: 700, color: "var(--text)",
  },
  bellMarkAll: { fontSize: "12px", fontWeight: 600, color: "var(--primary)", cursor: "pointer" },
  bellEmpty: { padding: "20px", textAlign: "center", fontSize: "13px", color: "var(--text-muted)" },
  bellItem: { padding: "10px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer" },
  bellItemUnread: { background: "var(--surface-alt)" },
  bellItemTitle: { fontSize: "13px", fontWeight: 600, color: "var(--text)" },
  bellItemTime: { fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" },
  userChip: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: {
    width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary)",
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700,
  },
  userName: { fontSize: "14px", fontWeight: 600, color: "var(--text)" },
  userRole: { fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.3px" },
  welcomeRow: { marginBottom: "16px" },
  welcomeTitle: { fontSize: "24px", fontWeight: 700, color: "var(--text)" },
  priorityBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "linear-gradient(135deg, var(--primary), var(--primary))", color: "#fff",
    borderRadius: "16px", padding: "16px 22px", marginBottom: "20px",
  },
  priorityText: { fontSize: "14px", fontWeight: 600 },
  priorityBtn: {
    background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", borderRadius: "8px",
    padding: "8px 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer", flexShrink: 0,
  },
  todayPlanCard: { background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: "16px", padding: "18px", marginBottom: "20px" },
  todayPlanHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", color: "var(--text)", fontSize: "15px", fontWeight: 800, marginBottom: "14px" },
  todayPlanSparkle: { color: "var(--primary)", marginRight: "6px" },
  todayPlanHint: { color: "var(--text-muted)", fontSize: "12px", fontWeight: 600 },
  todayPlanSections: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px" },
  todayPlanSection: { display: "flex", flexDirection: "column", gap: "8px" },
  todayPlanTitle: { color: "#3730A3", fontSize: "13px", fontWeight: 800, margin: 0 },
  todayPlanEmpty: { margin: 0, padding: "11px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.45 },
  todayTask: { display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", cursor: "pointer", textAlign: "left", color: "var(--text)" },
  todayTaskNumber: { width: "22px", height: "22px", flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "50%", background: "var(--border)", color: "var(--primary-dark)", fontSize: "11px", fontWeight: 800 },
  todayTaskCopy: { display: "flex", flex: 1, minWidth: 0, flexDirection: "column", gap: "2px", fontSize: "12px" },
  todayTaskGo: { color: "var(--primary)", fontSize: "11px", fontWeight: 800, flexShrink: 0 },
  summaryCard: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(15,23,42,0.06)", marginBottom: "20px", overflow: "hidden",
  },
  summaryHalves: { display: "flex" },
  summaryBlock: { flex: 1, display: "flex", gap: "14px", padding: "22px" },
  summaryBlockBordered: { borderRight: "1px solid var(--border)" },
  summaryBlockIcon: {
    width: "44px", height: "44px", borderRadius: "12px", background: "var(--primary-tint)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  summaryBlockIconCyan: { background: "#ECFEFF" },
  summaryBlockLabel: { fontSize: "15px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" },
  summaryStatsRow: { display: "flex", gap: "16px", fontSize: "13px", color: "var(--text-muted)" },
  quickActions: { display: "flex", gap: "8px", marginTop: "10px" },
  quickActionBtn: {
    display: "flex", alignItems: "center", gap: "5px", background: "var(--surface-alt)",
    border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 10px",
    fontSize: "12px", fontWeight: 600, color: "var(--text)", cursor: "pointer",
  },
  attendanceStrip: {
    display: "flex", alignItems: "center", gap: "14px", padding: "16px 22px",
    background: "var(--surface-alt)", borderTop: "1px solid var(--border)",
  },
  attendanceRing: (rate) => ({
    width: "42px", height: "42px", borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "10px", fontWeight: 800, color: "var(--text)",
    background: `conic-gradient(#16A34A ${rate}%, var(--border) ${rate}% 100%)`,
  }),
  attendanceText: { flex: 1, fontSize: "13px", color: "var(--text)" },
  attendanceBreakdown: { fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" },
  attendanceBadge: { fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px", flexShrink: 0 },
  attendanceBadgeGood: { background: "#FEF3C7", color: "#D97706" },
  attendanceBadgeBad: { background: "#FEE2E2", color: "#DC2626" },
  grid: { display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "20px" },
  colLeft: {},
  colRight: { display: "flex", flexDirection: "column", gap: "16px", position: "sticky", top: "24px", alignSelf: "flex-start" },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" },
  sectionTitle: { fontSize: "15px", fontWeight: 700, color: "var(--text)" },
  viewAll: { fontSize: "13px", color: "var(--primary)", cursor: "pointer", fontWeight: 600 },
  classList: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(15,23,42,0.06)", overflow: "hidden",
  },
  classRow: {
    display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px",
    borderBottom: "1px solid var(--border)", cursor: "pointer",
  },
  classRowIcon: {
    width: "32px", height: "32px", borderRadius: "8px", background: "var(--surface-alt)",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  classRowBody: { flex: 1, minWidth: 0 },
  classRowName: { fontSize: "14px", fontWeight: 700, color: "var(--text)" },
  classRowSub: { fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" },
  classTag: { fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px", flexShrink: 0 },
  classTagTeaching: { background: "var(--primary-tint)", color: "var(--primary)" },
  classTagLearning: { background: "#ECFEFF", color: "#06B6D4" },
  classRowAdd: {
    padding: "14px 18px", border: "1.5px dashed var(--border)", textAlign: "center",
    fontSize: "13px", fontWeight: 600, color: "var(--text-muted)", cursor: "pointer",
  },
  aiToolsChip: {
    display: "flex", alignItems: "center", gap: "8px", background: "var(--surface)",
    border: "1px solid var(--border)", borderRadius: "12px", padding: "12px 16px",
    fontSize: "13px", fontWeight: 600, color: "var(--text)", cursor: "pointer",
  },
  card: {
    background: "var(--surface)", borderRadius: "16px", padding: "16px",
    border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(15,23,42,0.06)",
  },
  cardHeading: { fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--text)" },
  noEventsHint: { fontSize: "13px", color: "var(--text-muted)" },
  upcomingRow: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid var(--border)" },
  upcomingDot: { width: "7px", height: "7px", borderRadius: "50%", background: "var(--primary)", flexShrink: 0 },
  upcomingTitle: { flex: 1, fontSize: "13px", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  upcomingTime: { fontSize: "12px", color: "var(--text-muted)", flexShrink: 0 },
  // Calendar
  calNavBtn: {
    width: "28px", height: "28px", borderRadius: "8px", border: "1px solid var(--border)",
    background: "var(--surface-alt)", color: "var(--text)", fontSize: "16px",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },
  calGrid: {
    display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px",
  },
  calDayHeader: {
    textAlign: "center", fontSize: "10px", fontWeight: 700, color: "var(--text-faint)",
    padding: "4px 0 6px",
  },
  calCell: {
    minHeight: "36px", borderRadius: "6px", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: "3px 2px",
    cursor: "default", transition: "background 0.1s",
    background: "transparent",
  },
  calCellToday: {
    background: "var(--primary)", color: "#fff",
  },
  calAddBtn: {
    position: "absolute", bottom: "1px", right: "1px",
    width: "14px", height: "14px", borderRadius: "4px",
    background: "var(--primary)", color: "#fff",
    border: "none", fontSize: "12px", lineHeight: 1,
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700,
  },
  // Modal
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  modalBox: {
    background: "var(--surface)", borderRadius: "16px", padding: "24px",
    width: "340px", maxWidth: "92vw", border: "1px solid var(--border)",
  },
  fieldLabel: { display: "block", fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "5px" },
  fieldInput: {
    width: "100%", padding: "9px 12px", borderRadius: "8px", border: "1px solid var(--border)",
    background: "var(--surface-alt)", color: "var(--text)", fontSize: "13px", boxSizing: "border-box",
  },
  btnPrimary: {
    flex: 1, padding: "10px", background: "var(--primary)", color: "#fff",
    border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
  },
  btnOutline: {
    flex: 1, padding: "10px", background: "transparent", color: "var(--text-muted)",
    border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
  },
};
