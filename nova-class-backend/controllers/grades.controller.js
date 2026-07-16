const pool = require("../config/db");

async function checkAccess(classId, userId) {
  const [classes] = await pool.query("SELECT * FROM classes WHERE id = ?", [classId]);
  if (classes.length === 0) return { error: "Class not found", status: 404 };
  const cls = classes[0];
  if (cls.teacher_id === userId) return { cls, role: "teacher" };
  const [members] = await pool.query(
    "SELECT * FROM class_members WHERE class_id = ? AND user_id = ?",
    [classId, userId]
  );
  if (members.length === 0) return { error: "Not a member", status: 403 };
  return { cls, role: "student" };
}

// GET /api/classroom/classes/:id/grades
exports.getGrades = async (req, res) => {
  const userId = req.user.id;
  try {
    const access = await checkAccess(req.params.id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const [assignments] = await pool.query(
      "SELECT id, title, points, due_date FROM assignments WHERE class_id = ? ORDER BY created_at ASC",
      [req.params.id]
    );

    if (access.role === "student") {
      // Student: their own grades
      const [submissions] = await pool.query(
        `SELECT s.assignment_id, s.grade, s.status, s.grade_comment
         FROM submissions s
         WHERE s.student_id = ? AND s.assignment_id IN (
           SELECT id FROM assignments WHERE class_id = ?
         )`,
        [userId, req.params.id]
      );
      const subMap = {};
      submissions.forEach(s => { subMap[s.assignment_id] = s; });

      const rows = assignments.map(a => {
        const sub = subMap[a.id];
        return {
          assignment_id: a.id,
          title: a.title,
          points: a.points,
          due_date: a.due_date,
          grade: sub?.grade ?? null,
          status: sub?.status ?? "assigned",
          grade_comment: sub?.grade_comment ?? null,
        };
      });

      const graded = rows.filter(r => r.grade !== null);
      const totalEarned = graded.reduce((s, r) => s + r.grade, 0);
      const totalPossible = graded.reduce((s, r) => s + r.points, 0);
      const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : null;

      return res.json({ role: "student", rows, totalEarned, totalPossible, percentage });
    }

    // Teacher: grade book (all students × all assignments)
    const [students] = await pool.query(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN class_members cm ON cm.user_id = u.id
       WHERE cm.class_id = ?`,
      [req.params.id]
    );

    const [allSubs] = await pool.query(
      `SELECT s.student_id, s.assignment_id, s.grade, s.status
       FROM submissions s
       WHERE s.assignment_id IN (SELECT id FROM assignments WHERE class_id = ?)`,
      [req.params.id]
    );

    const subMap = {};
    allSubs.forEach(s => {
      if (!subMap[s.student_id]) subMap[s.student_id] = {};
      subMap[s.student_id][s.assignment_id] = s;
    });

    const rows = students.map(student => {
      const grades = assignments.map(a => {
        const sub = subMap[student.id]?.[a.id];
        return { assignment_id: a.id, grade: sub?.grade ?? null, status: sub?.status ?? "assigned" };
      });
      const graded = grades.filter(g => g.grade !== null);
      const earned = graded.reduce((s, g) => s + g.grade, 0);
      const possible = graded.reduce((s, g) => {
        const a = assignments.find(a => a.id === g.assignment_id);
        return s + (a?.points || 0);
      }, 0);
      const pct = possible > 0 ? Math.round((earned / possible) * 100) : null;
      return { student_id: student.id, name: student.name, email: student.email, grades, earned, possible, percentage: pct };
    });

    // Class average
    const gradedRows = rows.filter(r => r.possible > 0);
    const classAvg = gradedRows.length > 0
      ? Math.round(gradedRows.reduce((s, r) => s + r.percentage, 0) / gradedRows.length)
      : null;

    res.json({ role: "teacher", assignments, rows, classAvg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
