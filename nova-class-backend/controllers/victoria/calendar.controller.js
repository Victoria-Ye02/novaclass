const db = require("../../config/db");

// Schema (calendar_events table) lives in scripts/setup_db.js — this used to
// bootstrap itself here via an async function invoked at module load, the
// same anti-pattern found and fixed in posts/attendance/classroom
// controllers: a real, unmocked query fires the instant this module is
// require()'d, before any test has a chance to mock pool.query.

// GET /api/calendar/events?month=YYYY-MM
// Returns events for all classes the caller is a member of (teacher or student)
exports.getEvents = async (req, res) => {
  const userId = req.user.id;
  const month = req.query.month; // "2026-08"
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: "month query param required (YYYY-MM)" });
  }
  const [rows] = await db.query(
    `SELECT ce.id, ce.class_id, ce.date, ce.title, ce.color,
            c.name AS class_name, u.name AS teacher_name
     FROM calendar_events ce
     JOIN classes c ON c.id = ce.class_id
     JOIN users u ON u.id = ce.teacher_id
     WHERE DATE_FORMAT(ce.date, '%Y-%m') = ?
       AND (
         ce.teacher_id = ?
         OR ce.class_id IN (
           SELECT class_id FROM class_members WHERE user_id = ?
         )
       )
     ORDER BY ce.date`,
    [month, userId, userId]
  );
  res.json(rows);
};

// POST /api/calendar/events  { class_id, date, title, color }
exports.createEvent = async (req, res) => {
  const teacherId = req.user.id;
  const { class_id, date, title, color = "#4F46E5" } = req.body;
  if (!class_id || !date || !title?.trim()) {
    return res.status(400).json({ message: "class_id, date, title required" });
  }
  // Verify caller is teacher of that class
  const [[cls]] = await db.query(
    "SELECT id FROM classes WHERE id = ? AND teacher_id = ?",
    [class_id, teacherId]
  );
  if (!cls) return res.status(403).json({ message: "Not your class" });

  const [result] = await db.query(
    "INSERT INTO calendar_events (class_id, teacher_id, date, title, color) VALUES (?,?,?,?,?)",
    [class_id, teacherId, date, title.trim(), color]
  );
  res.status(201).json({ id: result.insertId, class_id, date, title: title.trim(), color });
};

// DELETE /api/calendar/events/:id
exports.deleteEvent = async (req, res) => {
  const teacherId = req.user.id;
  const { id } = req.params;
  const [[ev]] = await db.query(
    "SELECT id FROM calendar_events WHERE id = ? AND teacher_id = ?",
    [id, teacherId]
  );
  if (!ev) return res.status(403).json({ message: "Not found or not yours" });
  await db.query("DELETE FROM calendar_events WHERE id = ?", [id]);
  res.json({ ok: true });
};
