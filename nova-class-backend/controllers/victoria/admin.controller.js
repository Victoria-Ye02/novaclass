const pool = require("../../config/db");

exports.getStats = async (req, res) => {
  try {
    const [[userRoles]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(role = 'teacher') AS teachers,
        SUM(role = 'student') AS students,
        SUM(created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS new_this_week,
        SUM(created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS new_this_month
      FROM users
    `);

    const [recentUsers] = await pool.query(`
      SELECT id, name, email, role, created_at
      FROM users ORDER BY created_at DESC LIMIT 8
    `);

    const [[contentStats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM classes) AS total_classes,
        (SELECT COUNT(*) FROM materials) AS total_materials,
        (SELECT COUNT(*) FROM materials WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS materials_this_week,
        (SELECT COUNT(*) FROM assignments) AS total_assignments,
        (SELECT COUNT(*) FROM submissions) AS total_submissions,
        (SELECT COUNT(*) FROM submissions WHERE status = 'graded') AS graded_submissions,
        (SELECT COUNT(*) FROM submissions WHERE submitted_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS submissions_this_week
    `);

    const [classesList] = await pool.query(`
      SELECT
        c.id, c.name, c.subject, c.created_at,
        COUNT(DISTINCT cm.user_id) AS student_count,
        COUNT(DISTINCT m.id)       AS material_count,
        COUNT(DISTINCT a.id)       AS assignment_count,
        COUNT(DISTINCT s.id)       AS submission_count
      FROM classes c
      LEFT JOIN class_members cm ON cm.class_id = c.id
      LEFT JOIN materials m      ON m.class_id = c.id
      LEFT JOIN assignments a    ON a.class_id = c.id
      LEFT JOIN submissions s    ON s.assignment_id = a.id
      GROUP BY c.id
      ORDER BY student_count DESC
    `);

    const [[aiStats]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM chat_logs)                    AS ai_chats,
        (SELECT COUNT(*) FROM material_summaries)           AS ai_summaries,
        (SELECT COUNT(*) FROM material_pdf_highlights)      AS ai_highlights,
        (SELECT COUNT(*) FROM material_highlight_analyses)  AS ai_highlight_analyses,
        (SELECT COUNT(*) FROM kmate_history)                AS kmate_sessions
    `);

    res.json({
      users: userRoles,
      recentUsers,
      content: contentStats,
      classes: classesList,
      ai: aiStats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
