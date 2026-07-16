const pool = require("../config/db");

// GET /api/progress/summary
exports.summary = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[{ classes_joined }]] = await pool.query(
      "SELECT COUNT(*) AS classes_joined FROM class_members WHERE user_id = ?",
      [userId]
    );
    const [[{ classes_teaching }]] = await pool.query(
      "SELECT COUNT(*) AS classes_teaching FROM classes WHERE teacher_id = ?",
      [userId]
    );
    const [[{ questions_asked }]] = await pool.query(
      "SELECT COUNT(*) AS questions_asked FROM kmate_history WHERE user_id = ?",
      [userId]
    );
    const [[{ materials_accessed }]] = await pool.query(
      `SELECT COUNT(DISTINCT m.id) AS materials_accessed
       FROM materials m
       JOIN classes c ON c.id = m.class_id
       LEFT JOIN class_members cm ON cm.class_id = c.id
       WHERE cm.user_id = ? OR c.teacher_id = ?`,
      [userId, userId]
    );

    res.json({
      classes_joined: Number(classes_joined),
      classes_teaching: Number(classes_teaching),
      questions_asked: Number(questions_asked),
      materials_accessed: Number(materials_accessed),
      streak_days: 1,
      level: "Intermediate",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
