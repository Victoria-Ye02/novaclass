const pool = require("../../config/db");
const fs = require("fs");
const { completeText } = require("../../services/ai/groqText");
const { notifyUsers, notifyUser } = require("../../services/notifications");

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

// GET /api/classroom/classes/:id/assignments
exports.listAssignments = async (req, res) => {
  const userId = req.user.id;
  try {
    const access = await checkAccess(req.params.id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const [assignments] = await pool.query(
      `SELECT a.*, u.name AS teacher_name FROM assignments a
       JOIN users u ON u.id = a.created_by
       WHERE a.class_id = ? ORDER BY a.created_at DESC`,
      [req.params.id]
    );

    if (access.role === "student") {
      const [subs] = await pool.query(
        `SELECT * FROM submissions WHERE student_id = ? AND assignment_id IN (
          SELECT id FROM assignments WHERE class_id = ?
        )`,
        [userId, req.params.id]
      );
      const subMap = {};
      subs.forEach(s => { subMap[s.assignment_id] = s; });
      return res.json(assignments.map(a => ({
        ...a,
        my_submission: subMap[a.id] || null,
      })));
    }

    // Teacher: get submission counts
    const [counts] = await pool.query(
      `SELECT assignment_id, COUNT(*) AS turned_in_count
       FROM submissions WHERE status IN ('turned_in','late','graded')
       AND assignment_id IN (SELECT id FROM assignments WHERE class_id = ?)
       GROUP BY assignment_id`,
      [req.params.id]
    );
    const countMap = {};
    counts.forEach(c => { countMap[c.assignment_id] = c.turned_in_count; });
    res.json(assignments.map(a => ({ ...a, turned_in_count: countMap[a.id] || 0 })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/classes/:id/assignments
exports.createAssignment = async (req, res) => {
  const userId = req.user.id;
  try {
    const access = await checkAccess(req.params.id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });

    const { title, instructions, due_date, points, is_draft, material_id } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });
    const draft = is_draft ? 1 : 0;
    const matId = material_id ? parseInt(material_id) : null;

    const [result] = await pool.query(
      "INSERT INTO assignments (class_id, title, instructions, due_date, points, is_draft, created_by, material_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [req.params.id, title.trim(), instructions || null, due_date || null, points || 100, draft, userId, matId]
    );
    const assignId = result.insertId;

    if (req.files?.length) {
      for (const f of req.files) {
        await pool.query(
          "INSERT INTO assignment_files (assignment_id, file_name, file_path) VALUES (?, ?, ?)",
          [assignId, f.originalname, f.filename]
        );
      }
    }

    if (!draft) {
      await pool.query(
        "INSERT INTO class_posts (class_id, author_id, content, type) VALUES (?, ?, ?, 'announcement')",
        [req.params.id, userId, `📝 New assignment: ${title.trim()}`]
      );
      const [members] = await pool.query(
        "SELECT user_id FROM class_members WHERE class_id = ?",
        [req.params.id]
      );
      await notifyUsers(members.map(m => m.user_id), {
        type: "assignment_created",
        title: `New assignment: ${title.trim()}`,
        linkUrl: `/classroom/${req.params.id}`,
      });
    }

    const [[assignment]] = await pool.query(
      `SELECT a.*, u.name AS teacher_name FROM assignments a
       JOIN users u ON u.id = a.created_by WHERE a.id = ?`,
      [assignId]
    );
    const [files] = await pool.query("SELECT * FROM assignment_files WHERE assignment_id = ?", [assignId]);
    res.status(201).json({ ...assignment, turned_in_count: 0, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/classroom/assignments/:id
exports.getAssignment = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[assignment]] = await pool.query(
      `SELECT a.*, u.name AS teacher_name FROM assignments a
       JOIN users u ON u.id = a.created_by WHERE a.id = ?`,
      [req.params.id]
    );
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });

    const access = await checkAccess(assignment.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const [files] = await pool.query("SELECT * FROM assignment_files WHERE assignment_id = ?", [req.params.id]);

    if (access.role === "student") {
      const [[sub]] = await pool.query(
        "SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?",
        [req.params.id, userId]
      );
      let subFiles = [];
      if (sub) {
        [subFiles] = await pool.query(
          "SELECT * FROM submission_files WHERE submission_id = ?",
          [sub.id]
        ).catch(() => [[]]);
      }
      return res.json({ ...assignment, my_submission: sub ? { ...sub, submission_files: subFiles } : null, files });
    }

    // Teacher: get all submissions
    const [submissions] = await pool.query(
      `SELECT s.*, u.name AS student_name, u.email AS student_email
       FROM submissions s JOIN users u ON u.id = s.student_id
       WHERE s.assignment_id = ? ORDER BY s.submitted_at DESC`,
      [req.params.id]
    );
    // Attach submission_files to each submission
    const subIds = submissions.map(s => s.id);
    let allSubFiles = [];
    if (subIds.length > 0) {
      [allSubFiles] = await pool.query(
        `SELECT * FROM submission_files WHERE submission_id IN (${subIds.map(() => "?").join(",")})`,
        subIds
      ).catch(() => [[]]);
    }
    const filesBySubId = {};
    allSubFiles.forEach(f => {
      if (!filesBySubId[f.submission_id]) filesBySubId[f.submission_id] = [];
      filesBySubId[f.submission_id].push(f);
    });
    const submissionsWithFiles = submissions.map(s => ({ ...s, submission_files: filesBySubId[s.id] || [] }));
    res.json({ ...assignment, submissions: submissionsWithFiles, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/assignments/:id/submit
exports.submitAssignment = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[assignment]] = await pool.query("SELECT * FROM assignments WHERE id = ?", [req.params.id]);
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });

    const access = await checkAccess(assignment.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "student") return res.status(403).json({ error: "Students only" });

    // Bootstrap submission_files table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS submission_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        submission_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sub (submission_id)
      )
    `);

    const uploadedFiles = req.files || [];
    const content = req.body.content || null;
    const now = new Date();
    const isLate = assignment.due_date && now > new Date(assignment.due_date);
    const status = isLate ? "late" : "turned_in";

    // Keep legacy file_path as first file for backwards compat
    const legacyFilePath = uploadedFiles.length > 0 ? uploadedFiles[0].filename : null;

    await pool.query(
      `INSERT INTO submissions (assignment_id, student_id, content, file_path, status, submitted_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE content=VALUES(content), file_path=COALESCE(VALUES(file_path), file_path),
       status=VALUES(status), submitted_at=NOW()`,
      [req.params.id, userId, content, legacyFilePath, status]
    );

    const [[sub]] = await pool.query(
      "SELECT * FROM submissions WHERE assignment_id = ? AND student_id = ?",
      [req.params.id, userId]
    );

    // Replace all submission files for this submission
    if (uploadedFiles.length > 0) {
      await pool.query("DELETE FROM submission_files WHERE submission_id = ?", [sub.id]);
      for (const f of uploadedFiles) {
        await pool.query(
          "INSERT INTO submission_files (submission_id, file_name, file_path) VALUES (?, ?, ?)",
          [sub.id, f.originalname, f.filename]
        );
      }
    }

    const [subFiles] = await pool.query(
      "SELECT * FROM submission_files WHERE submission_id = ?",
      [sub.id]
    );

    res.json({ ...sub, submission_files: subFiles });
  } catch (err) {
    if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/submissions/:id/grade
exports.gradeSubmission = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[sub]] = await pool.query(
      `SELECT s.*, a.class_id FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ?`,
      [req.params.id]
    );
    if (!sub) return res.status(404).json({ error: "Submission not found" });

    const access = await checkAccess(sub.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });

    const { grade, grade_comment } = req.body;
    await pool.query(
      "UPDATE submissions SET grade=?, grade_comment=?, status='graded', graded_at=NOW() WHERE id=?",
      [grade, grade_comment || null, req.params.id]
    );

    const [[updated]] = await pool.query(
      `SELECT s.*, u.name AS student_name FROM submissions s
       JOIN users u ON u.id = s.student_id WHERE s.id = ?`,
      [req.params.id]
    );

    const [[assignment]] = await pool.query("SELECT title FROM assignments WHERE id = ?", [sub.assignment_id]);
    await notifyUser(sub.student_id, {
      type: "submission_graded",
      title: `Your submission for "${assignment.title}" was graded`,
      linkUrl: `/classroom/${sub.class_id}`,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/submissions/:id/return  (teacher returns graded work)
exports.returnSubmission = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[sub]] = await pool.query(
      `SELECT s.*, a.class_id FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ?`,
      [req.params.id]
    );
    if (!sub) return res.status(404).json({ error: "Submission not found" });
    const access = await checkAccess(sub.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });

    await pool.query("UPDATE submissions SET status='returned' WHERE id=?", [req.params.id]);
    res.json({ message: "Returned" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/assignments/:id/ai-check
exports.aiCheck = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[assignment]] = await pool.query("SELECT * FROM assignments WHERE id = ?", [req.params.id]);
    if (!assignment) return res.status(404).json({ error: "Not found" });
    const access = await checkAccess(assignment.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const { answer, hasFile, fileName, lang } = req.body;
    const isEn = lang === "en";

    const submissionDesc = isEn ? [
      answer?.trim() ? `Written answer: "${answer.trim()}"` : "Written answer: none",
      hasFile ? `Attached file: ${fileName || "a file"}` : "File: not attached",
    ].join("\n") : [
      answer?.trim() ? `စာဖြင့်ဖြေဆိုချက်: "${answer.trim()}"` : "စာဖြင့်ဖြေဆိုချက်: မရှိ",
      hasFile ? `တင်သွင်းထားသောဖိုင်: ${fileName || "ဖိုင်တစ်ခု"}` : "ဖိုင်: မပူး",
    ].join("\n");

    const prompt = isEn ? `You are a homework checker AI. Check whether the student's submission meets the teacher's requirements.

Assignment: ${assignment.title}
Teacher instructions: ${assignment.instructions || "No specific instructions provided"}

Student submission:
${submissionDesc}

Check:
1. If instructions require a file/screenshot/code/image, verify the student attached one
2. If a written answer is required, check if it is relevant
3. Identify any missing parts

Respond with JSON only:
{
  "isComplete": true or false,
  "score": 0 to 100,
  "missing": ["item 1", "item 2"],
  "feedback": "2-3 sentences about what is good, what is missing, and what to improve"
}` : `သင်သည် ကျောင်းစနစ်တစ်ခုအတွက် အိမ်စာစစ်ဆေးသူ AI ဖြစ်သည်။

အိမ်စာ: ${assignment.title}
ဆရာမ၏ လမ်းညွှန်ချက်: ${assignment.instructions || "သီးခြားလမ်းညွှန်ချက် မပေးထားပါ"}

ကျောင်းသား၏ တင်သွင်းမှု:
${submissionDesc}

JSON format ဖြင့်သာ ဖြေဆိုပါ:
{
  "isComplete": true,
  "score": 80,
  "missing": ["missing item"],
  "feedback": "feedback in Burmese here"
}`;

    const completion = await completeText({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 500,
      responseFormat: { type: "json_object" },
    });
    const parsed = JSON.parse(completion.choices[0].message.content);
    res.json({
      isComplete: parsed.isComplete,
      score: parsed.score,
      missing: parsed.missing || [],
      feedback: parsed.feedback,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/classroom/assignments/:id/comments  (private comments)
exports.getComments = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[assignment]] = await pool.query("SELECT * FROM assignments WHERE id = ?", [req.params.id]);
    if (!assignment) return res.status(404).json({ error: "Not found" });
    const access = await checkAccess(assignment.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    // Teacher sees all; student sees only their own thread
    const query = access.role === "teacher"
      ? `SELECT ac.*, u.name AS author_name FROM assignment_comments ac JOIN users u ON u.id = ac.author_id WHERE ac.assignment_id = ? ORDER BY ac.created_at ASC`
      : `SELECT ac.*, u.name AS author_name FROM assignment_comments ac JOIN users u ON u.id = ac.author_id WHERE ac.assignment_id = ? AND (ac.author_id = ? OR ac.target_student_id = ?) ORDER BY ac.created_at ASC`;
    const params = access.role === "teacher" ? [req.params.id] : [req.params.id, userId, userId];
    const [comments] = await pool.query(query, params);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/assignments/:id/comments
exports.addComment = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[assignment]] = await pool.query("SELECT * FROM assignments WHERE id = ?", [req.params.id]);
    if (!assignment) return res.status(404).json({ error: "Not found" });
    const access = await checkAccess(assignment.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const { content, target_student_id } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Comment cannot be empty" });

    const targetId = access.role === "teacher" ? (target_student_id || null) : userId;
    const [result] = await pool.query(
      "INSERT INTO assignment_comments (assignment_id, author_id, target_student_id, content) VALUES (?, ?, ?, ?)",
      [req.params.id, userId, targetId, content.trim()]
    );
    const [[comment]] = await pool.query(
      `SELECT ac.*, u.name AS author_name FROM assignment_comments ac JOIN users u ON u.id = ac.author_id WHERE ac.id = ?`,
      [result.insertId]
    );
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/classroom/comments/:commentId  (author only, teacher or student)
exports.editComment = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[comment]] = await pool.query("SELECT * FROM assignment_comments WHERE id = ?", [req.params.commentId]);
    if (!comment) return res.status(404).json({ error: "Not found" });
    if (comment.author_id !== userId) return res.status(403).json({ error: "You can only edit your own comments" });

    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "Comment cannot be empty" });

    await pool.query("UPDATE assignment_comments SET content=? WHERE id=?", [content.trim(), req.params.commentId]);
    const [[updated]] = await pool.query(
      `SELECT ac.*, u.name AS author_name FROM assignment_comments ac JOIN users u ON u.id = ac.author_id WHERE ac.id = ?`,
      [req.params.commentId]
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/classroom/comments/:commentId  (author only, teacher or student)
exports.deleteComment = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[comment]] = await pool.query("SELECT * FROM assignment_comments WHERE id = ?", [req.params.commentId]);
    if (!comment) return res.status(404).json({ error: "Not found" });
    if (comment.author_id !== userId) return res.status(403).json({ error: "You can only delete your own comments" });

    await pool.query("DELETE FROM assignment_comments WHERE id=?", [req.params.commentId]);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/classroom/assignments/:id/draft  (toggle draft status)
exports.toggleDraft = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[assignment]] = await pool.query("SELECT * FROM assignments WHERE id = ?", [req.params.id]);
    if (!assignment) return res.status(404).json({ error: "Not found" });
    const access = await checkAccess(assignment.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });

    const newDraft = req.body.is_draft ? 1 : 0;
    await pool.query("UPDATE assignments SET is_draft=? WHERE id=?", [newDraft, req.params.id]);
    if (!newDraft) {
      await pool.query(
        "INSERT INTO class_posts (class_id, author_id, content, type) VALUES (?, ?, ?, 'announcement')",
        [assignment.class_id, userId, `📝 New assignment: ${assignment.title}`]
      );
    }
    res.json({ is_draft: !!newDraft });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/classroom/assignments/:id  (teacher only)
exports.updateAssignment = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[assignment]] = await pool.query("SELECT * FROM assignments WHERE id = ?", [req.params.id]);
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });

    const access = await checkAccess(assignment.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });

    const { title, instructions, due_date, points, is_draft } = req.body;
    let delete_file_ids = [];
    try { delete_file_ids = req.body.delete_file_ids ? JSON.parse(req.body.delete_file_ids) : []; } catch {}

    await pool.query(
      "UPDATE assignments SET title=?, instructions=?, due_date=?, points=?, is_draft=? WHERE id=?",
      [
        title ?? assignment.title,
        instructions ?? assignment.instructions,
        due_date ?? assignment.due_date,
        points ?? assignment.points,
        is_draft !== undefined ? is_draft : assignment.is_draft,
        req.params.id,
      ]
    );

    // Delete removed files
    if (delete_file_ids.length) {
      await pool.query("DELETE FROM assignment_files WHERE id IN (?) AND assignment_id = ?", [delete_file_ids, req.params.id]);
    }

    // Add new files
    if (req.files?.length) {
      for (const f of req.files) {
        await pool.query(
          "INSERT INTO assignment_files (assignment_id, file_name, file_path) VALUES (?, ?, ?)",
          [req.params.id, f.originalname, f.filename]
        );
      }
    }

    const [[updated]] = await pool.query("SELECT * FROM assignments WHERE id = ?", [req.params.id]);
    const [files] = await pool.query("SELECT * FROM assignment_files WHERE assignment_id = ?", [req.params.id]);
    res.json({ ...updated, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteAssignment = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[assignment]] = await pool.query("SELECT * FROM assignments WHERE id = ?", [req.params.id]);
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });

    const access = await checkAccess(assignment.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });

    await pool.query("DELETE FROM assignments WHERE id = ?", [req.params.id]);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/classroom/classes/:id/stream-stats
exports.getStreamStats = async (req, res) => {
  const userId = req.user.id;
  const classId = req.params.id;
  try {
    const access = await checkAccess(classId, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    // Total assignments (non-draft)
    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM assignments WHERE class_id=? AND is_draft=0", [classId]
    );

    let submissionRate = 0;
    let submittedCount = 0;
    let totalExpected = 0;

    if (access.role === "teacher") {
      // Teacher: submissions across all students
      // class_members only ever holds students — the teacher is tracked via
      // classes.teacher_id, not as a member row — so no role filter needed
      // (the table has no `role` column at all).
      const [[{ students }]] = await pool.query(
        "SELECT COUNT(*) AS students FROM class_members WHERE class_id=?", [classId]
      );
      totalExpected = total * students;
      const [[{ submitted }]] = await pool.query(
        `SELECT COUNT(*) AS submitted FROM submissions s
         JOIN assignments a ON s.assignment_id = a.id
         WHERE a.class_id=? AND a.is_draft=0`, [classId]
      );
      submittedCount = submitted;
      submissionRate = totalExpected > 0 ? Math.round((submitted / totalExpected) * 100) : 0;
    } else {
      // Student: my own submission rate
      totalExpected = total;
      const [[{ submitted }]] = await pool.query(
        `SELECT COUNT(*) AS submitted FROM submissions s
         JOIN assignments a ON s.assignment_id=a.id
         WHERE a.class_id=? AND a.is_draft=0 AND s.student_id=?`, [classId, userId]
      );
      submittedCount = submitted;
      submissionRate = total > 0 ? Math.round((submitted / total) * 100) : 0;
    }

    // Recent announcements (posts)
    const [recentPosts] = await pool.query(
      "SELECT id, content, created_at FROM class_posts WHERE class_id=? ORDER BY created_at DESC LIMIT 3", [classId]
    );

    // Recent materials
    const [recentMats] = await pool.query(
      "SELECT id, title, created_at FROM materials WHERE class_id=? ORDER BY created_at DESC LIMIT 3", [classId]
    );

    // Recent assignments
    const [recentAssigns] = await pool.query(
      "SELECT id, title, due_date, is_draft FROM assignments WHERE class_id=? AND is_draft=0 ORDER BY created_at DESC LIMIT 3", [classId]
    );

    res.json({
      totalAssignments: total,
      submittedCount,
      totalExpected,
      submissionRate,
      recentPosts,
      recentMaterials: recentMats,
      recentAssignments: recentAssigns,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/classroom/assignments/:id/submission-stats  (teacher)
exports.getSubmissionStats = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[assignment]] = await pool.query("SELECT * FROM assignments WHERE id=?", [req.params.id]);
    if (!assignment) return res.status(404).json({ error: "Not found" });
    const access = await checkAccess(assignment.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });

    const [students] = await pool.query(
      `SELECT u.id, u.name FROM class_members cm JOIN users u ON u.id=cm.user_id
       WHERE cm.class_id=?`, [assignment.class_id]
    );
    const [subs] = await pool.query(
      "SELECT * FROM submissions WHERE assignment_id=?", [req.params.id]
    );
    const subMap = {};
    subs.forEach(s => { subMap[s.student_id] = s; });

    const result = students.map(s => ({
      student: s,
      submission: subMap[s.id] || null,
      status: subMap[s.id]
        ? (subMap[s.id].grade !== null ? "graded" : "submitted")
        : "missing",
    }));

    res.json({ assignment, students: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PATCH /api/classroom/assignments/:id/topic
exports.updateTopic = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[a]] = await pool.query("SELECT * FROM assignments WHERE id=?", [req.params.id]);
    if (!a) return res.status(404).json({ error: "Not found" });
    const access = await checkAccess(a.class_id, userId);
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });
    await pool.query("UPDATE assignments SET topic=? WHERE id=?", [req.body.topic || null, req.params.id]);
    res.json({ topic: req.body.topic || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
