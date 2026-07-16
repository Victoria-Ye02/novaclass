const pool = require("../config/db");

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

// GET /classes/:id/meeting — get active meeting
exports.getActiveMeeting = async (req, res) => {
  const userId = req.user.id;
  try {
    const access = await checkAccess(req.params.id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const [[meeting]] = await pool.query(
      `SELECT m.*, u.name AS host_name FROM class_meetings m JOIN users u ON u.id=m.started_by
       WHERE m.class_id=? AND m.is_active=1 ORDER BY m.started_at DESC LIMIT 1`,
      [req.params.id]
    );
    res.json({ meeting: meeting || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /classes/:id/meeting — start meeting (teacher)
exports.startMeeting = async (req, res) => {
  const userId = req.user.id;
  try {
    const access = await checkAccess(req.params.id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });
    // End any existing active meeting
    await pool.query("UPDATE class_meetings SET is_active=0, ended_at=NOW() WHERE class_id=? AND is_active=1", [req.params.id]);
    const { title } = req.body;
    const roomName = `nova-class-${req.params.id}-${Date.now()}`;
    const roomUrl = `https://meet.jit.si/${roomName}`;
    const [result] = await pool.query(
      "INSERT INTO class_meetings (class_id, room_url, title, started_by) VALUES (?,?,?,?)",
      [req.params.id, roomUrl, title || "Class Meeting", userId]
    );
    const [[meeting]] = await pool.query(
      `SELECT m.*, u.name AS host_name FROM class_meetings m JOIN users u ON u.id=m.started_by WHERE m.id=?`,
      [result.insertId]
    );
    res.status(201).json({ meeting });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// DELETE /classes/:id/meeting — end meeting (teacher)
exports.endMeeting = async (req, res) => {
  const userId = req.user.id;
  try {
    const access = await checkAccess(req.params.id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });
    await pool.query("UPDATE class_meetings SET is_active=0, ended_at=NOW() WHERE class_id=? AND is_active=1", [req.params.id]);
    res.json({ message: "Meeting ended" });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
