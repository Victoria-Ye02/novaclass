const pool = require("../../config/db");

async function checkAccess(classId, userId) {
  const [[cls]] = await pool.query("SELECT * FROM classes WHERE id=?", [classId]);
  if (!cls) return { error: "Class not found", status: 404 };
  const isTeacher = cls.teacher_id === userId;
  if (!isTeacher) {
    const [[member]] = await pool.query("SELECT id FROM class_members WHERE class_id=? AND user_id=?", [classId, userId]);
    if (!member) return { error: "Not a member", status: 403 };
  }
  return { role: isTeacher ? "teacher" : "student" };
}

// GET /classes/:id/attendance
exports.getSessions = async (req, res) => {
  const userId = req.user.id;
  try {
    const access = await checkAccess(req.params.id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const [sessions] = await pool.query(
      "SELECT * FROM attendance_sessions WHERE class_id=? ORDER BY session_date DESC",
      [req.params.id]
    );
    // For each session get summary counts
    const detailed = await Promise.all(sessions.map(async s => {
      const [[counts]] = await pool.query(
        "SELECT COUNT(*) AS total, SUM(status='present') AS present, SUM(status='absent') AS absent, SUM(status='late') AS late FROM attendance_records WHERE session_id=?",
        [s.id]
      );
      return { ...s, ...counts };
    }));
    res.json(detailed);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /classes/:id/attendance
exports.createSession = async (req, res) => {
  const userId = req.user.id;
  try {
    const access = await checkAccess(req.params.id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });
    const { title, session_date } = req.body;
    if (!title || !session_date) return res.status(400).json({ error: "title and session_date required" });
    const [[existing]] = await pool.query(
      "SELECT id FROM attendance_sessions WHERE class_id=? AND session_date=?",
      [req.params.id, session_date]
    );
    if (existing) return res.status(409).json({ error: "A session already exists for this date." });
    const [result] = await pool.query(
      "INSERT INTO attendance_sessions (class_id, title, session_date, created_by) VALUES (?,?,?,?)",
      [req.params.id, title, session_date, userId]
    );
    // Auto-create absent records for all students (members who are not teacher)
    const [[cls]] = await pool.query("SELECT teacher_id FROM classes WHERE id=?", [req.params.id]);
    const [students] = await pool.query(
      "SELECT user_id FROM class_members WHERE class_id=? AND user_id!=?",
      [req.params.id, cls.teacher_id]
    );
    for (const s of students) {
      await pool.query(
        "INSERT IGNORE INTO attendance_records (session_id, student_id, status) VALUES (?,?,'absent')",
        [result.insertId, s.user_id]
      );
    }
    const [[session]] = await pool.query("SELECT * FROM attendance_sessions WHERE id=?", [result.insertId]);
    const [records] = await pool.query(
      `SELECT r.*, u.name, u.email FROM attendance_records r JOIN users u ON u.id=r.student_id WHERE r.session_id=?`,
      [result.insertId]
    );
    res.status(201).json({ ...session, records });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /attendance/:sessionId
exports.getSession = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[session]] = await pool.query("SELECT * FROM attendance_sessions WHERE id=?", [req.params.sessionId]);
    if (!session) return res.status(404).json({ error: "Session not found" });
    const access = await checkAccess(session.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const [records] = await pool.query(
      `SELECT r.*, u.name, u.email FROM attendance_records r JOIN users u ON u.id=r.student_id WHERE r.session_id=? ORDER BY u.name`,
      [req.params.sessionId]
    );
    res.json({ ...session, records });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PATCH /attendance/:sessionId/mark
exports.markAttendance = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[session]] = await pool.query("SELECT * FROM attendance_sessions WHERE id=?", [req.params.sessionId]);
    if (!session) return res.status(404).json({ error: "Not found" });
    const access = await checkAccess(session.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });
    const { records } = req.body; // [{ student_id, status }]
    for (const r of records) {
      await pool.query(
        "INSERT INTO attendance_records (session_id, student_id, status) VALUES (?,?,?) ON DUPLICATE KEY UPDATE status=?",
        [req.params.sessionId, r.student_id, r.status, r.status]
      );
    }
    const [updated] = await pool.query(
      `SELECT r.*, u.name, u.email FROM attendance_records r JOIN users u ON u.id=r.student_id WHERE r.session_id=?`,
      [req.params.sessionId]
    );
    res.json({ records: updated });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /attendance/:sessionId
exports.deleteSession = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[session]] = await pool.query("SELECT * FROM attendance_sessions WHERE id=?", [req.params.sessionId]);
    if (!session) return res.status(404).json({ error: "Not found" });
    const access = await checkAccess(session.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });
    await pool.query("DELETE FROM attendance_sessions WHERE id=?", [req.params.sessionId]);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /classes/:id/attendance/student — student's own attendance
exports.getMyAttendance = async (req, res) => {
  const userId = req.user.id;
  try {
    const access = await checkAccess(req.params.id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const [rows] = await pool.query(
      `SELECT s.title, s.session_date, r.status FROM attendance_sessions s
       LEFT JOIN attendance_records r ON r.session_id=s.id AND r.student_id=?
       WHERE s.class_id=? ORDER BY s.session_date DESC`,
      [userId, req.params.id]
    );
    const total = rows.length;
    const present = rows.filter(r => r.status === "present").length;
    const late = rows.filter(r => r.status === "late").length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : null;
    res.json({ rows, total, present, late, absent: total - present - late, rate });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/classroom/attendance/summary — this calendar month's attendance
// rate across every class the user is enrolled in (as a student), for the
// Dashboard's attendance ring. Teachers with no student enrollments simply
// get an all-zero, null-rate result — the frontend hides the widget then.
exports.getMyMonthlyAttendance = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[counts]] = await pool.query(
      `SELECT COUNT(*) AS total, SUM(r.status='present') AS present,
              SUM(r.status='late') AS late, SUM(r.status='absent') AS absent
       FROM attendance_records r
       JOIN attendance_sessions s ON s.id = r.session_id
       WHERE r.student_id = ?
         AND MONTH(s.session_date) = MONTH(CURDATE())
         AND YEAR(s.session_date) = YEAR(CURDATE())`,
      [userId]
    );
    const total = Number(counts.total) || 0;
    const present = Number(counts.present) || 0;
    const late = Number(counts.late) || 0;
    const absent = Number(counts.absent) || 0;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : null;
    res.json({ total, present, late, absent, rate });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// ─── Leave Requests ────────────────────────────────────────────────────────
// Schema (leave_requests table + attachment_path column) lives in
// scripts/setup_db.js — this used to bootstrap itself here via a
// self-executing IIFE that ran a real, unmocked DB query the instant this
// module was require()'d, which left an idle connection open and hung the
// test suite whenever a test file imported this controller.

// POST /classes/:id/leave-requests   (student) — accepts optional file
exports.createLeaveRequest = async (req, res) => {
  const userId = req.user.id;
  try {
    const access = await checkAccess(req.params.id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "student") return res.status(403).json({ error: "Students only" });
    const { from_date, to_date, reason_type, details } = req.body;
    if (!from_date || !to_date) return res.status(400).json({ error: "from_date and to_date required" });
    const attachment_path = req.file ? req.file.filename : null;
    const [result] = await pool.query(
      "INSERT INTO leave_requests (class_id, student_id, from_date, to_date, reason_type, details, attachment_path) VALUES (?,?,?,?,?,?,?)",
      [req.params.id, userId, from_date, to_date, reason_type || "other", details || "", attachment_path]
    );
    const [[row]] = await pool.query("SELECT * FROM leave_requests WHERE id=?", [result.insertId]);
    res.status(201).json(row);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /classes/:id/leave-requests
// teacher → all requests with student name; student → own only
exports.listLeaveRequests = async (req, res) => {
  const userId = req.user.id;
  try {
    const access = await checkAccess(req.params.id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    let rows;
    if (access.role === "teacher") {
      [rows] = await pool.query(
        `SELECT lr.*, u.name AS student_name, u.email AS student_email
         FROM leave_requests lr JOIN users u ON u.id = lr.student_id
         WHERE lr.class_id = ? ORDER BY lr.created_at DESC`,
        [req.params.id]
      );
    } else {
      [rows] = await pool.query(
        "SELECT * FROM leave_requests WHERE class_id=? AND student_id=? ORDER BY created_at DESC",
        [req.params.id, userId]
      );
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PATCH /leave-requests/:id   (teacher: approve or reject)
exports.reviewLeaveRequest = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[lr]] = await pool.query("SELECT * FROM leave_requests WHERE id=?", [req.params.id]);
    if (!lr) return res.status(404).json({ error: "Not found" });
    const access = await checkAccess(lr.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status)) return res.status(400).json({ error: "status must be approved or rejected" });
    await pool.query(
      "UPDATE leave_requests SET status=?, reviewed_by=?, reviewed_at=NOW() WHERE id=?",
      [status, userId, req.params.id]
    );
    const [[updated]] = await pool.query("SELECT * FROM leave_requests WHERE id=?", [req.params.id]);
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
};
