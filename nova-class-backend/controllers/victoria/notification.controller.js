const pool = require("../../config/db");

// GET /api/notifications
exports.list = async (req, res) => {
  try {
    const [notifications] = await pool.query(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 15",
      [req.user.id]
    );
    res.json({ notifications });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/notifications/unread-count
exports.unreadCount = async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0",
      [req.user.id]
    );
    res.json({ count: row.count });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/notifications/read-all
exports.markAllRead = async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ?",
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
