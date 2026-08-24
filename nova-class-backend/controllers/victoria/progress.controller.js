const pool = require("../../config/db");
const { completeText } = require("../../services/ai/groqText");

function getDayDiff(dueDateStr) {
  if (!dueDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0, 0, 0, 0);
  const diffTime = dueDate - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatDueDate(dueDateStr) {
  if (!dueDateStr) return "";
  const dayDiff = getDayDiff(dueDateStr);
  if (dayDiff < 0) return `${Math.abs(dayDiff)} days overdue`;
  if (dayDiff === 0) return "Due today";
  if (dayDiff === 1) return "Due tomorrow";
  return `D-${dayDiff}`;
}

function fallbackTask(candidate) {
  if (candidate.kind === "student-assignment") {
    return {
      title: `Complete ${candidate.title}`,
      reason: `Upcoming assignment in ${candidate.className}`,
      dueDate: candidate.dueDate || null,
      dueLabel: formatDueDate(candidate.dueDate),
      isOverdue: candidate.dueDate ? getDayDiff(candidate.dueDate) < 0 : false,
      link: `/classroom/${candidate.classId}?tab=classwork&assign=${candidate.assignId}`,
    };
  }
  return {
    title: `Grade ${candidate.count} submission${candidate.count === 1 ? "" : "s"}`,
    reason: `Student work is waiting in ${candidate.className}`,
    dueDate: null,
    dueLabel: "",
    isOverdue: false,
    link: `/classroom/${candidate.classId}?tab=classwork`,
  };
}

function refineTasks(candidates, aiTasks) {
  const byId = new Map(candidates.map(candidate => [candidate.id, candidate]));
  return (aiTasks || []).slice(0, 3).flatMap(task => {
    const candidate = byId.get(task.id);
    if (!candidate || !task.title || !task.reason) return [];
    return [{
      title: String(task.title),
      reason: String(task.reason),
      dueDate: candidate.dueDate || null,
      dueLabel: formatDueDate(candidate.dueDate),
      isOverdue: candidate.dueDate ? getDayDiff(candidate.dueDate) < 0 : false,
      link: candidate.kind === "student-assignment"
        ? `/classroom/${candidate.classId}?tab=classwork&assign=${candidate.assignId}`
        : `/classroom/${candidate.classId}?tab=classwork`,
    }];
  });
}

async function createTodayPlans(studentCandidates, teacherCandidates, language = "en") {
  const fallback = {
    studentPlan: studentCandidates.slice(0, 3).map(fallbackTask),
    teacherPlan: teacherCandidates.slice(0, 3).map(fallbackTask),
  };
  if (!studentCandidates.length && !teacherCandidates.length) return fallback;

  try {
    const languageInstruction =
      language === "my" ? "Rewrite in Burmese (မြန်မာ)." :
      language === "en" ? "Rewrite in English." :
      "Rewrite in the user's language.";

    const completion = await completeText({
      maxTokens: 700,
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: `You are a classroom planning assistant. Rewrite only the provided tasks into concise, helpful titles and reasons. ${languageInstruction} Return JSON only: {\"student\":[{\"id\":\"...\",\"title\":\"...\",\"reason\":\"...\"}],\"teacher\":[{\"id\":\"...\",\"title\":\"...\",\"reason\":\"...\"}]}. Never invent IDs or tasks.` },
        { role: "user", content: JSON.stringify({ student: studentCandidates, teacher: teacherCandidates }) },
      ],
    });
    const parsed = JSON.parse(completion.choices[0].message.content);
    const studentPlan = refineTasks(studentCandidates, parsed.student);
    const teacherPlan = refineTasks(teacherCandidates, parsed.teacher);
    const sortByOverdue = (tasks) => tasks.sort((a, b) => (b.isOverdue ? 1 : 0) - (a.isOverdue ? 1 : 0));
    return {
      studentPlan: sortByOverdue(studentPlan.length > 0 ? studentPlan : fallback.studentPlan),
      teacherPlan: sortByOverdue(teacherPlan.length > 0 ? teacherPlan : fallback.teacherPlan),
    };
  } catch {
    return fallback;
  }
}

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
    // Submissions turned in but not yet graded, across every class this
    // user teaches — the Dashboard's "assignments to grade" stat.
    const [[{ to_grade_count }]] = await pool.query(
      `SELECT COUNT(*) AS to_grade_count
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN classes c ON c.id = a.class_id
       WHERE c.teacher_id = ? AND s.status IN ('turned_in', 'late')`,
      [userId]
    );

    res.json({
      classes_joined: Number(classes_joined),
      classes_teaching: Number(classes_teaching),
      questions_asked: Number(questions_asked),
      materials_accessed: Number(materials_accessed),
      to_grade_count: Number(to_grade_count),
      streak_days: 1,
      level: "Intermediate",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/progress/today-plan
exports.todayPlan = async (req, res) => {
  const userId = req.user.id;
  const language = req.query.lang || req.headers['x-language'] || 'en';
  try {
    const [studentAssignments] = await pool.query(
      `/* student_plan_assignments */
       SELECT a.id, a.class_id, a.title, c.name AS class_name, a.due_date
       FROM assignments a
       JOIN class_members cm ON cm.class_id = a.class_id AND cm.user_id = ?
       JOIN classes c ON c.id = a.class_id
       LEFT JOIN submissions s ON s.assignment_id = a.id AND s.student_id = ?
       WHERE a.is_draft = 0 AND a.due_date IS NOT NULL
         AND (s.id IS NULL OR s.status IN ('draft', 'returned'))
       ORDER BY a.due_date ASC LIMIT 3`,
      [userId, userId]
    );
    const [teacherSubmissions] = await pool.query(
      `/* teacher_plan_submissions */
       SELECT c.id AS class_id, c.name AS class_name, COUNT(*) AS count
       FROM submissions s
       JOIN assignments a ON a.id = s.assignment_id
       JOIN classes c ON c.id = a.class_id
       WHERE c.teacher_id = ? AND s.status IN ('turned_in', 'late')
       GROUP BY c.id, c.name ORDER BY count DESC LIMIT 3`,
      [userId]
    );

    const studentCandidates = studentAssignments.map(row => ({
      id: `student-assignment-${row.id}`, kind: "student-assignment", title: row.title,
      classId: row.class_id, className: row.class_name, dueDate: row.due_date, assignId: row.id,
    }));
    const teacherCandidates = teacherSubmissions.map(row => ({
      id: `teacher-grading-${row.class_id}`, kind: "teacher-grading", classId: row.class_id,
      className: row.class_name, count: Number(row.count),
    }));
    res.json(await createTodayPlans(studentCandidates, teacherCandidates, language));
  } catch (err) {
    res.status(500).json({ error: "Unable to build today's plan" });
  }
};
