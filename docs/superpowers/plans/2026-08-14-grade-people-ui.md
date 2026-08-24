# Grade/People UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge Grades into People tab with rank/sparkline/at-risk detection, add teacher-to-student note system, show notice box on student class page.

**Architecture:** Backend adds two endpoints (send note, rich members). Frontend replaces People tab list with ranked table + filter chips + send-note panel; student ClassDetail shows dismissible notice box for teacher notes.

**Tech Stack:** Node/Express + MySQL (backend), React inline styles (frontend, matches existing pattern)

## Global Constraints
- Follow existing inline-style React pattern (no CSS modules, no Tailwind)
- No new npm packages
- Notifications table already exists: `id, user_id, type, title, message, link_url, is_read, created_at`
- At-risk threshold: grade < 70% OR attendance < 80%
- Top filter: grade >= 85%

---

### Task 1: Backend — Send Note API

**Files:**
- Modify: `nova-class-backend/controllers/victoria/classroom.controller.js`
- Modify: `nova-class-backend/routes/victoria/classroom.routes.js`

- [ ] Add `exports.sendNote` to classroom.controller.js — teacher POSTs `{ studentId, category, message }` → inserts row into `notifications` for the student
- [ ] Wire route: `router.post("/classes/:classId/notes", auth, ctrl.sendNote)`
- [ ] Test: POST with teacher auth → student sees notification in GET /api/notifications

```js
// classroom.controller.js
exports.sendNote = async (req, res) => {
  const { classId } = req.params;
  const { studentId, category, message } = req.body;
  const teacherId = req.user.id;
  try {
    const [[cls]] = await pool.query("SELECT * FROM classes WHERE id=?", [classId]);
    if (!cls || cls.teacher_id !== teacherId) return res.status(403).json({ error: "Not teacher" });
    const [[teacher]] = await pool.query("SELECT name FROM users WHERE id=?", [teacherId]);
    const categoryLabel = { concern: "Attendance/Grade concern", reminder: "General reminder", positive: "Positive feedback" }[category] || category;
    await pool.query(
      "INSERT INTO notifications (user_id, type, title, message, link_url) VALUES (?,?,?,?,?)",
      [studentId, "teacher_note",
       `Note from ${teacher.name}`,
       `[${categoryLabel}] ${message}`,
       `/classroom/${classId}`]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
```

---

### Task 2: Backend — Rich Members API

**Files:**
- Modify: `nova-class-backend/controllers/victoria/classroom.controller.js`
- Modify: `nova-class-backend/routes/victoria/classroom.routes.js`

- [ ] Add `exports.getRichMembers` — returns students with grade%, attendance%, last 3 graded assignment scores (for sparkline), at-risk flag
- [ ] Wire route: `router.get("/classes/:classId/members/rich", auth, ctrl.getRichMembers)`

```js
exports.getRichMembers = async (req, res) => {
  const { classId } = req.params;
  const teacherId = req.user.id;
  try {
    const [[cls]] = await pool.query("SELECT * FROM classes WHERE id=?", [classId]);
    if (!cls || cls.teacher_id !== teacherId) return res.status(403).json({ error: "Not teacher" });

    const [students] = await pool.query(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN class_members cm ON cm.user_id = u.id WHERE cm.class_id = ?`,
      [classId]
    );
    const [assignments] = await pool.query(
      "SELECT id, points FROM assignments WHERE class_id=? AND is_draft=0 ORDER BY created_at ASC",
      [classId]
    );
    const [allSubs] = await pool.query(
      `SELECT s.student_id, s.assignment_id, s.grade FROM submissions s
       JOIN assignments a ON a.id=s.assignment_id WHERE a.class_id=? AND s.grade IS NOT NULL`,
      [classId]
    );
    const [attSessions] = await pool.query(
      "SELECT id FROM attendance_sessions WHERE class_id=?", [classId]
    );
    const sessionIds = attSessions.map(s => s.id);
    const [attRecords] = sessionIds.length
      ? await pool.query(
          `SELECT student_id, status FROM attendance_records WHERE session_id IN (?)`,
          [sessionIds])
      : [[]];

    const subMap = {};
    allSubs.forEach(s => {
      if (!subMap[s.student_id]) subMap[s.student_id] = [];
      subMap[s.student_id].push({ assignment_id: s.assignment_id, grade: s.grade });
    });
    const attMap = {};
    attRecords.forEach(r => {
      if (!attMap[r.student_id]) attMap[r.student_id] = [];
      attMap[r.student_id].push(r.status);
    });

    const rows = students.map(st => {
      const subs = subMap[st.id] || [];
      const gradedSubs = subs.filter(s => s.grade !== null);
      const earned = gradedSubs.reduce((acc, s) => acc + s.grade, 0);
      const possible = gradedSubs.reduce((acc, s) => {
        const a = assignments.find(a => a.id === s.assignment_id);
        return acc + (a?.points || 0);
      }, 0);
      const gradePct = possible > 0 ? Math.round((earned / possible) * 100) : null;

      const att = attMap[st.id] || [];
      const totalSessions = sessionIds.length;
      const presentCount = att.filter(s => s === "present" || s === "late").length;
      const attPct = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : null;

      // Last 3 graded assignment %s for sparkline
      const sorted = [...gradedSubs].sort((a, b) => a.assignment_id - b.assignment_id);
      const last3 = sorted.slice(-3).map(s => {
        const a = assignments.find(a => a.id === s.assignment_id);
        return a ? Math.round((s.grade / a.points) * 100) : 0;
      });

      const isAtRisk = (gradePct !== null && gradePct < 70) || (attPct !== null && attPct < 80);

      return { id: st.id, name: st.name, email: st.email, gradePct, attPct, sparkline: last3, isAtRisk };
    });

    // Sort by gradePct desc (nulls last), attach rank
    rows.sort((a, b) => (b.gradePct ?? -1) - (a.gradePct ?? -1));
    rows.forEach((r, i) => { r.rank = i + 1; });

    res.json({ students: rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
```

---

### Task 3: Frontend — People Tab Redesign

**Files:**
- Modify: `nova-class-frontend/src/pages/victoria/ClassDetail.jsx` (People tab section ~line 3114)

- [ ] Add state: `richMembers`, `richLoading`, `peopleFilter` ("all"|"risk"|"top"), `notePanel` (null | studentObj)
- [ ] Load rich members when People tab opens (or lazy-load)
- [ ] Replace student list with ranked table matching the mockup
- [ ] Add filter chips
- [ ] Add sparkline (3 inline divs, bar chart style)
- [ ] Add ✎ note button per row
- [ ] Grades tab: hide for teacher (teacher sees grades inside People)

---

### Task 4: Frontend — Enhanced Member Detail Panel

**Files:**
- Modify: `nova-class-frontend/src/pages/victoria/ClassDetail.jsx` (detail panel ~line 3174)

- [ ] Gradient header: indigo for normal, red for at-risk
- [ ] Show rank + "Rank N in class"
- [ ] At-risk action box (red background, "Send a note" shortcut)
- [ ] "Send note" button in normal panel too

---

### Task 5: Frontend — Send Note Panel

**Files:**
- Modify: `nova-class-frontend/src/pages/victoria/ClassDetail.jsx`

- [ ] Note panel overlay: category select + textarea + Send button
- [ ] Calls `POST /api/classroom/classes/${id}/notes`
- [ ] On success: close panel, show toast-style confirm

---

### Task 6: Frontend — Student Notice Box in ClassDetail

**Files:**
- Modify: `nova-class-frontend/src/pages/victoria/ClassDetail.jsx`

- [ ] On mount (student role): fetch `/api/notifications` filtered to `type === 'teacher_note'` and `link_url === /classroom/${id}` and `is_read === 0`
- [ ] Show dismissible orange notice box at top of page (matches mockup)
- [ ] Dismiss: PATCH `/api/notifications/:id/read`, remove from local state
