const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log("🌱 Seeding demo data...");

  const pw = await bcrypt.hash("demo1234", 10);

  // ── 1. Teacher ──────────────────────────────────────────────
  await conn.query(`
    INSERT INTO users (name, email, password, role) VALUES
    ('Ms. Sarah Kim', 'demo.teacher@novaclass.com', ?, 'teacher')
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `, [pw]);
  const [[teacher]] = await conn.query("SELECT id FROM users WHERE email = 'demo.teacher@novaclass.com'");

  // ── 2. Students ─────────────────────────────────────────────
  const students = [
    { name: "James Park",    email: "student1@novaclass.com" },
    { name: "Emily Choi",    email: "student2@novaclass.com" },
    { name: "Daniel Lee",    email: "student3@novaclass.com" },
    { name: "Sophia Yoon",   email: "student4@novaclass.com" },
    { name: "Kevin Oh",      email: "student5@novaclass.com" },
    { name: "Mia Jung",      email: "student6@novaclass.com" },
    { name: "Ethan Han",     email: "student7@novaclass.com" },
  ];
  for (const s of students) {
    await conn.query(`
      INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'student')
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `, [s.name, s.email, pw]);
  }
  const [studentRows] = await conn.query(
    "SELECT id FROM users WHERE email IN (?)",
    [students.map(s => s.email)]
  );

  // ── 3. Class ────────────────────────────────────────────────
  await conn.query(`
    INSERT INTO classes (name, subject, code, teacher_id) VALUES
    ('TOPIK Preparation — Intermediate', 'Korean Language', 'DEMO01', ?)
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `, [teacher.id]);
  const [[cls]] = await conn.query("SELECT id FROM classes WHERE code = 'DEMO01'");

  // Enroll students
  for (const s of studentRows) {
    await conn.query(`
      INSERT IGNORE INTO class_members (class_id, user_id) VALUES (?, ?)
    `, [cls.id, s.id]);
  }

  // ── 4. Materials ────────────────────────────────────────────
  const materials = [
    { title: "Week 1 — Korean Vocabulary Basics",      week: 1, instructions: "Study the vocabulary list and practice writing each word 5 times. Pay attention to correct stroke order." },
    { title: "Week 2 — Grammar: -(으)면 Conditionals",  week: 2, instructions: "Read through the grammar explanation and complete the practice exercises on pages 4-6." },
    { title: "Week 3 — Reading Comprehension Skills",  week: 3, instructions: "Read the two passages carefully. Answer all comprehension questions and summarize each passage in 2-3 sentences." },
    { title: "Week 4 — TOPIK Writing Strategies",      week: 4, instructions: "Review the essay structure guide. Practice writing a 200-word response using the template provided." },
  ];
  const matIds = [];
  for (const m of materials) {
    const [r] = await conn.query(`
      INSERT INTO materials (class_id, title, week, instructions, uploaded_by)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE instructions = VALUES(instructions)
    `, [cls.id, m.title, m.week, m.instructions, teacher.id]);
    const id = r.insertId || (await conn.query("SELECT id FROM materials WHERE class_id=? AND title=?", [cls.id, m.title]))[0][0].id;
    matIds.push(id);

    // Stream post for each material
    await conn.query(`
      INSERT IGNORE INTO class_posts (class_id, author_id, content, type, material_id)
      VALUES (?, ?, ?, 'material', ?)
    `, [cls.id, teacher.id, `📚 New material posted: ${m.title}`, id]);
  }

  // ── 5. Stream posts ─────────────────────────────────────────
  const posts = [
    { author: teacher.id,      content: "Welcome to TOPIK Preparation class! 🎉 We will be working hard together this semester. Please make sure to submit all assignments on time.", type: "announcement" },
    { author: studentRows[0].id, content: "Excited to start this class! I've been studying Korean for 2 years and can't wait to improve my TOPIK score. 화이팅! 💪", type: "announcement" },
    { author: studentRows[1].id, content: "The Week 1 vocabulary list is really helpful. I made flashcards for all the words!", type: "announcement" },
    { author: studentRows[3].id, content: "Does anyone want to form a study group? We could meet online twice a week 📖", type: "announcement" },
    { author: studentRows[2].id, content: "Just finished the Week 2 grammar exercises. The conditional form makes so much more sense now!", type: "announcement" },
  ];
  for (const p of posts) {
    await conn.query(`
      INSERT INTO class_posts (class_id, author_id, content, type)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE content = VALUES(content)
    `, [cls.id, p.author, p.content, p.type]);
  }

  // ── 6. Assignments ──────────────────────────────────────────
  const assignments = [
    {
      title: "Vocabulary Quiz — Week 1",
      description: "Write a sentence for each of the 20 vocabulary words from Week 1. Make sure each sentence clearly shows the meaning of the word.",
      points: 100, due: "2026-08-25",
    },
    {
      title: "Grammar Exercise — Conditionals",
      description: "Complete all 15 exercises on the conditional grammar form -(으)면. Attach your completed worksheet as a PDF.",
      points: 50, due: "2026-09-01",
    },
    {
      title: "Reading Comprehension — Passage Analysis",
      description: "Write a 300-word analysis of the Week 3 reading passage. Include main idea, supporting details, and your personal opinion.",
      points: 100, due: "2026-09-08",
    },
    {
      title: "TOPIK Writing Practice Essay",
      description: "Write a full TOPIK-style essay (400-600 characters) on the topic: '현대 사회에서 스마트폰의 역할'. Follow the essay template from Week 4 material.",
      points: 150, due: "2026-09-15",
    },
  ];
  const assignIds = [];
  for (const a of assignments) {
    const [r] = await conn.query(`
      INSERT INTO assignments (class_id, title, instructions, points, due_date, created_by, is_draft)
      VALUES (?, ?, ?, ?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE instructions = VALUES(instructions)
    `, [cls.id, a.title, a.description, a.points, a.due, teacher.id]);
    const id = r.insertId || (await conn.query("SELECT id FROM assignments WHERE class_id=? AND title=?", [cls.id, a.title]))[0][0].id;
    assignIds.push(id);
  }

  // ── 7. Submissions (mix of statuses) ────────────────────────
  const submissionData = [
    // Assignment 1 — most submitted, some graded
    { aIdx: 0, sIdx: 0, content: "1. 사과 - 나는 매일 아침 사과를 먹어요. (I eat an apple every morning.)\n2. 학교 - 우리 학교는 매우 커요. (Our school is very big.)\n3. 공부 - 저는 한국어 공부를 좋아해요. (I like studying Korean.)", status: "graded", grade: 95, comment: "Excellent work! Your sentences are natural and creative." },
    { aIdx: 0, sIdx: 1, content: "All 20 vocabulary sentences completed with detailed examples and extra context sentences for each word.", status: "graded", grade: 88, comment: "Great effort! Watch out for particle usage in sentence 7." },
    { aIdx: 0, sIdx: 2, content: "Completed all vocabulary sentences. Used each word in context from the textbook examples.", status: "turned_in" },
    { aIdx: 0, sIdx: 3, content: "20 sentences done! I tried to use words from daily life situations to make them easier to remember.", status: "turned_in" },
    { aIdx: 0, sIdx: 4, content: "Here are my 20 sentences for the vocabulary quiz assignment.", status: "turned_in" },
    // Assignment 2 — some submitted
    { aIdx: 1, sIdx: 0, content: "Completed all 15 exercises. I found exercises 8-12 on complex conditionals especially challenging but rewarding.", status: "graded", grade: 45, comment: "Good understanding of basic conditionals. Review exercises 10 and 13." },
    { aIdx: 1, sIdx: 2, content: "All grammar exercises completed. Attached worksheet PDF.", status: "turned_in" },
    { aIdx: 1, sIdx: 5, content: "Finished the conditional exercises. I made additional practice sentences for each grammar pattern.", status: "turned_in" },
    // Assignment 3 — few submitted
    { aIdx: 2, sIdx: 0, content: "The main idea of the passage is about the importance of traditional Korean culture in modern society. The author argues that despite rapid modernization, cultural heritage remains essential for national identity. I agree with this perspective because...", status: "turned_in" },
    { aIdx: 2, sIdx: 3, content: "Analysis of the reading passage focusing on vocabulary, structure, and main arguments presented by the author.", status: "turned_in" },
  ];

  for (const sub of submissionData) {
    const assignId = assignIds[sub.aIdx];
    const studentId = studentRows[sub.sIdx].id;
    if (!assignId || !studentId) continue;
    await conn.query(`
      INSERT INTO submissions (assignment_id, student_id, content, status, submitted_at, grade, grade_comment)
      VALUES (?, ?, ?, ?, NOW(), ?, ?)
      ON DUPLICATE KEY UPDATE content = VALUES(content), status = VALUES(status), grade = VALUES(grade), grade_comment = VALUES(grade_comment)
    `, [assignId, studentId, sub.content, sub.status, sub.grade || null, sub.comment || null]);
  }

  await conn.end();
  console.log("✅ Demo seed complete!");
  console.log("");
  console.log("  Teacher  →  demo.teacher@novaclass.com  /  demo1234");
  console.log("  Student  →  student1@novaclass.com      /  demo1234");
  console.log("  Class    →  TOPIK Preparation — Intermediate (code: DEMO01)");
  console.log("  Data     →  4 materials, 4 assignments, 7 students, 10 submissions");
}

seed().catch(err => { console.error("❌ Seed failed:", err.message); process.exit(1); });
