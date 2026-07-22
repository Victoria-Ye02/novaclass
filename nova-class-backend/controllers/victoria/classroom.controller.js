const pool = require("../../config/db");
const { completeText } = require("../../services/ai/groqText");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");

const FILE_CONTENT_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
};

async function askGroq(prompt, maxTokens = 1024) {
  const completion = await completeText({
    messages: [{ role: "user", content: prompt }],
    maxTokens,
  });
  return completion.choices[0].message.content;
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function checkAccess(classId, userId) {
  const [classes] = await pool.query("SELECT * FROM classes WHERE id = ?", [classId]);
  if (classes.length === 0) return { error: "Class not found", status: 404 };
  const cls = classes[0];
  if (cls.teacher_id === userId) return { cls, role: "teacher" };
  const [members] = await pool.query(
    "SELECT * FROM class_members WHERE class_id = ? AND user_id = ?",
    [classId, userId]
  );
  if (members.length === 0) return { error: "Not a member of this class", status: 403 };
  return { cls, role: "student" };
}

// POST /api/classroom/classes
exports.createClass = async (req, res) => {
  const { name, subject } = req.body;
  const teacherId = req.user.id;
  if (!name) return res.status(400).json({ error: "Class name is required" });

  try {
    let code, exists = true;
    while (exists) {
      code = generateCode();
      const [rows] = await pool.query("SELECT id FROM classes WHERE code = ?", [code]);
      exists = rows.length > 0;
    }
    const [result] = await pool.query(
      "INSERT INTO classes (name, subject, code, teacher_id) VALUES (?, ?, ?, ?)",
      [name, subject || "General", code, teacherId]
    );
    res.status(201).json({ id: result.insertId, name, subject: subject || "General", code });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/classes/join
exports.joinClass = async (req, res) => {
  const { code } = req.body;
  const userId = req.user.id;
  if (!code) return res.status(400).json({ error: "Class code is required" });

  try {
    const [classes] = await pool.query("SELECT * FROM classes WHERE code = ?", [code.toUpperCase()]);
    if (classes.length === 0) return res.status(404).json({ error: "Class not found" });
    const cls = classes[0];
    if (cls.teacher_id === userId) return res.status(400).json({ error: "You already own this class" });

    await pool.query(
      "INSERT IGNORE INTO class_members (class_id, user_id) VALUES (?, ?)",
      [cls.id, userId]
    );
    res.json({ message: "Joined successfully", class: cls });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/classroom/classes
exports.listClasses = async (req, res) => {
  const userId = req.user.id;
  try {
    const [owned] = await pool.query(
      `SELECT c.id, c.name, c.subject, c.code, 'teacher' AS my_role, u.name AS teacher_name,
              (SELECT COUNT(*) FROM class_members WHERE class_id = c.id) AS student_count
       FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.teacher_id = ?`,
      [userId]
    );
    const [joined] = await pool.query(
      `SELECT c.id, c.name, c.subject, c.code, 'student' AS my_role, u.name AS teacher_name,
              (SELECT COUNT(*) FROM class_members WHERE class_id = c.id) AS student_count
       FROM classes c JOIN users u ON u.id = c.teacher_id
       JOIN class_members cm ON cm.class_id = c.id WHERE cm.user_id = ?`,
      [userId]
    );
    res.json([...owned, ...joined]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/classroom/classes/:id
exports.getClass = async (req, res) => {
  try {
    const access = await checkAccess(req.params.id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const [[{ student_count }]] = await pool.query(
      "SELECT COUNT(*) AS student_count FROM class_members WHERE class_id = ?",
      [req.params.id]
    );
    res.json({ ...access.cls, my_role: access.role, student_count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/classroom/classes/:id/members
exports.getMembers = async (req, res) => {
  try {
    const access = await checkAccess(req.params.id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const [teachers] = await pool.query(
      `SELECT u.id, u.name, u.email FROM users u JOIN classes c ON c.teacher_id = u.id WHERE c.id = ?`,
      [req.params.id]
    );
    const [students] = await pool.query(
      `SELECT u.id, u.name, u.email FROM users u JOIN class_members cm ON cm.user_id = u.id WHERE cm.class_id = ?`,
      [req.params.id]
    );
    const members = [
      ...teachers.map(t => ({ ...t, role: "teacher" })),
      ...students.map(s => ({ ...s, role: "student" })),
    ];
    res.json({ teachers, students, members });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/classroom/classes/:id/materials
exports.listMaterials = async (req, res) => {
  try {
    const access = await checkAccess(req.params.id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const [materials] = await pool.query(
      `SELECT m.id, m.title, m.instructions, m.week, m.file_path, m.created_at,
              s.summary_short AS summary
       FROM materials m
       LEFT JOIN material_summaries s ON s.material_id = m.id
       WHERE m.class_id = ? ORDER BY m.week ASC, m.created_at ASC`,
      [req.params.id]
    );
    const result = materials.map(m => ({
      ...m,
      file_url: m.file_path ? `/uploads/${m.file_path}` : null,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/classes/:id/materials  (multipart/form-data)
exports.uploadMaterial = async (req, res) => {
  const classId = req.params.id;
  const userId = req.user.id;
  if (!req.body.title) return res.status(400).json({ error: "Title is required" });

  try {
    const access = await checkAccess(classId, userId);
    if (access.error) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(access.status).json({ error: access.error });
    }

    const title = req.body.title;
    const instructions = req.body.instructions || null;
    const week = parseInt(req.body.week) || 1;
    const filePath = req.file ? req.file.filename : null;

    if (!req.file) {
      const [result] = await pool.query(
        "INSERT INTO materials (class_id, title, instructions, week, file_path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)",
        [classId, title, instructions, week, null, userId]
      );
      const materialId = result.insertId;
      await pool.query(
        "INSERT INTO class_posts (class_id, author_id, content, type, material_id) VALUES (?, ?, ?, 'material', ?)",
        [classId, userId, title, materialId]
      );
      return res.status(201).json({ id: materialId, title, instructions, week, file_url: null, summary: null });
    }

    // Extract text — only PDFs support extraction (Word/PowerPoint/images are stored as-is)
    let text = "";
    if (req.file.mimetype === "application/pdf") {
      const buffer = fs.readFileSync(req.file.path);
      const parsed = await pdfParse(buffer);
      text = parsed.text.trim();
    }

    // Save material with extracted text
    const [result] = await pool.query(
      "INSERT INTO materials (class_id, title, instructions, week, file_path, text_content, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [classId, title, instructions, week, filePath, text || null, userId]
    );
    const materialId = result.insertId;

    if (!text) {
      await pool.query(
        "INSERT INTO class_posts (class_id, author_id, content, type, material_id) VALUES (?, ?, ?, 'material', ?)",
        [classId, userId, title, materialId]
      );
      return res.status(201).json({
        id: materialId, title, instructions, week,
        file_url: `/uploads/${filePath}`, summary: null,
        warning: req.file.mimetype === "application/pdf"
          ? "Uploaded. No extractable text (scanned PDF?)."
          : "Uploaded. AI summary is only available for PDF files."
      });
    }

    // AI summary — best effort
    let summaryData = null;
    try {
      const prompt = `You are a teaching assistant. Read this material and return a JSON summary.

Text (first 30000 chars):
${text.slice(0, 30000)}

Return ONLY valid JSON with exactly these keys:
{
  "short": "one sentence capturing the core idea",
  "paragraph": "4-6 sentence summary paragraph",
  "detailed": "numbered step-by-step detailed breakdown"
}
Detect the language and reply in the same language.`;

      let out = (await askGroq(prompt)).trim();
      out = out.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      const start = out.indexOf("{");
      const end = out.lastIndexOf("}") + 1;
      const parsed2 = JSON.parse(out.slice(start, end));

      await pool.query(
        "INSERT INTO material_summaries (material_id, summary_short, summary_paragraph, summary_detailed) VALUES (?, ?, ?, ?)",
        [materialId, parsed2.short, parsed2.paragraph, parsed2.detailed]
      );
      summaryData = parsed2;
    } catch (aiErr) {
      console.warn("AI summary skipped:", aiErr.message);
    }

    await pool.query(
      "INSERT INTO class_posts (class_id, author_id, content, type, material_id) VALUES (?, ?, ?, 'material', ?)",
      [classId, userId, title, materialId]
    );

    res.status(201).json({
      id: materialId, title, instructions, week,
      file_url: `/uploads/${filePath}`,
      summary: summaryData,
      warning: summaryData ? undefined : "Uploaded. AI summary unavailable (check GROQ_API_KEY).",
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/materials/:materialId/ai
exports.materialAI = async (req, res) => {
  const { action, message, history } = req.body;
  try {
    const [mats] = await pool.query(
      `SELECT m.title, m.instructions, m.text_content,
              s.summary_paragraph, s.summary_detailed
       FROM materials m LEFT JOIN material_summaries s ON s.material_id = m.id
       WHERE m.id = ?`,
      [req.params.materialId]
    );
    if (mats.length === 0) return res.status(404).json({ error: "Material not found" });
    const mat = mats[0];

    // Use full PDF text if available, fallback to summary
    const fullText = mat.text_content
      ? mat.text_content.slice(0, 12000)
      : [mat.summary_paragraph, mat.summary_detailed].filter(Boolean).join("\n\n");

    const context = [
      `Title: ${mat.title}`,
      mat.instructions ? `Instructions: ${mat.instructions}` : null,
      fullText ? `Content:\n${fullText}` : null,
    ].filter(Boolean).join("\n\n");

    if (action === "chat") {
      const { level, lang } = req.body;
      const isEn = lang === "en";

      const levelGuide = isEn ? {
        beginner: {
          style: `The student is just starting to learn this material.`,
          qStyle: `Ask simple, fundamental questions (e.g. define a term, what is X)`,
          explain: `If wrong, gently correct and explain simply with 1-2 examples.`,
          correct: `✅ Correct!`,
          wrong: `❌ Not quite —`,
          summary: `Great job! Here's a summary of what we covered:`,
        },
        intermediate: {
          style: `The student knows the basics but has some gaps.`,
          qStyle: `Ask application-based questions (e.g. where/why do we use X)`,
          explain: `If wrong, explain the concept connection clearly.`,
          correct: `✅ Correct!`,
          wrong: `❌ Not quite —`,
          summary: `Good effort! Here's a summary of what we covered:`,
        },
        advanced: {
          style: `The student knows the material well.`,
          qStyle: `Ask challenging questions (edge cases, compare/contrast, problem-solving)`,
          explain: `If wrong, give a deeper explanation and follow up with a harder angle.`,
          correct: `✅ Correct!`,
          wrong: `❌ Not quite —`,
          summary: `Excellent! Here's a summary of the topics we explored:`,
        },
      } : {
        beginner: {
          style: `ကျောင်းသားသည် ဤသင်ခန်းစာကို ယခုမှ စတင်သင်ကြားနေသူဖြစ်သည်။`,
          qStyle: `အလွယ်ဆုံး အခြေခံမေးခွန်းများ မေးပါ (ဥပမာ - အဓိပ္ပာယ်ဖွင့်ဆို၊ ဘာလဲ ဆိုတာမျိုး)`,
          explain: `မှားရင် ဒဏ်မပေးဘဲ ရိုးရှင်းစွာ ပြင်ပြောပြီး ရှင်းပြပါ။ နမူနာ ၁-၂ ခု ပေးပါ။`,
          correct: `✅ မှန်ပါတယ်!`,
          wrong: `❌ မဟုတ်သေးပါ —`,
          summary: `ကောင်းပါတယ်! ဒါကို အကျဉ်းချုပ်ပြမည်:`,
        },
        intermediate: {
          style: `ကျောင်းသားသည် အခြေခံသိသော်လည်း အချို့ concept များ မရှင်းသေးပါ။`,
          qStyle: `application-based မေးခွန်းများ မေးပါ (ဘယ်နေရာသုံးသလဲ၊ ဘာကြောင့်သုံးသလဲ မျိုး)`,
          explain: `မှားရင် ဘာကြောင့်မှားတယ်ဆိုတာ concept ချိတ်ဆက်ပြီး ရှင်းပြပါ။`,
          correct: `✅ မှန်ပါတယ်!`,
          wrong: `❌ မဟုတ်သေးပါ —`,
          summary: `ကောင်းတယ်! ဒါကို အကျဉ်းချုပ်ပြမည်:`,
        },
        advanced: {
          style: `ကျောင်းသားသည် သင်ခန်းစာကို ကောင်းစွာ သိသည်ဟု ယူဆသည်။`,
          qStyle: `ခက်ခဲသောမေးခွန်းများ မေးပါ (edge case၊ compare/contrast၊ problem-solving မျိုး)`,
          explain: `မှားရင် deeper explanation ပေးပြီး ပိုခက်သောအသွင် ဆက်ရှင်းပြပါ။`,
          correct: `✅ မှန်ပါတယ်!`,
          wrong: `❌ မဟုတ်သေးပါ —`,
          summary: `အလွန်ကောင်းတယ်! ဒါကို အကျဉ်းချုပ်ပြမည်:`,
        },
      };

      const lg = levelGuide[level] || levelGuide.intermediate;
      const langInstruction = isEn
        ? `Respond in English only. For technical terms, use English as-is.`
        : `မြန်မာဘာသာ ဖြင့်သာ ဖြေဆိုပါ။ Technical term များကို English ဖြင့် ထားပါ၊ ရှင်းပြချက်ကို မြန်မာ ဖြင့် ပေးပါ။`;

      const systemContent = isEn
        ? `You are a Level Up AI Study Tutor. ${langInstruction}

Student profile: ${lg.style}

Material content:
${context}

**How to proceed (follow this format strictly):**
1. Ask one question — ${lg.qStyle}
2. When student answers:
   - Correct: "${lg.correct}" then add 1-2 lines of reinforcement
   - Wrong: "${lg.wrong}" ${lg.explain}
3. After evaluating, immediately ask the next question
4. After 5 questions, give a summary: "${lg.summary}"

**Important:** Don't wait for the student to ask — take initiative and ask questions yourself.`
        : `သင်သည် Level Up AI Study Tutor ဖြစ်သည်။ ${langInstruction}

ကျောင်းသား profile: ${lg.style}

သင်ခန်းစာ အကြောင်းအရာ:
${context}

**လုပ်ဆောင်ပုံ (ဤ format ကို တိတိကျကျ လိုက်နာပါ):**
1. မေးခွန်းတစ်ခု မေးပါ — ${lg.qStyle}
2. ကျောင်းသားဖြေသောအခါ:
   - မှန်ရင်: "${lg.correct}" ပြောပြီး ၁-၂ ကြောင်း ဖြည့်ပေးပါ
   - မှားရင်: "${lg.wrong}" ${lg.explain}
3. ဖြေဆိုချက်ကို အကဲဖြတ်ပြီးနောက် နောက်မေးခွန်း ချက်ချင်း မေးပါ
4. မေးခွန်း ၅ ခုပြီးရင် "${lg.summary}" ဆိုပြီး အကျဉ်းချုပ်ပေးပါ

**အရေးကြီး:** ကျောင်းသား မမေးမီ AI ကိုယ်တိုင် initiative ယူပြီး မေးပါ။`;

      const msgs = [
        { role: "system", content: systemContent },
        ...(history || []).map(h => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
        { role: "user", content: message },
      ];
      const completion = await completeText({
        messages: msgs,
        maxTokens: 600,
      });
      return res.json({ reply: completion.choices[0].message.content });
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (action === "highlights") {
      systemPrompt = `You are a study assistant. Always respond with valid JSON only. No explanation, no markdown.`;
      userPrompt = `Extract 8 key terms from this material. Return JSON: {"data":[{"term":"...","explanation":"..."}]}
Material: ${context.slice(0, 6000)}`;
    } else if (action === "summary") {
      systemPrompt = `You are a study assistant. Always respond with valid JSON only. No explanation, no markdown.`;
      userPrompt = `Summarize this material in exactly 5 bullet points. Return JSON: {"data":["point1","point2","point3","point4","point5"]}
Material: ${context.slice(0, 6000)}`;
    } else if (action === "quiz") {
      systemPrompt = `You are a quiz generator. Always respond with valid JSON only. No explanation, no markdown.`;
      userPrompt = `Create 3 multiple choice questions. Return JSON: {"data":[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]}
Material: ${context.slice(0, 6000)}`;
    }

    const completion = await completeText({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: 1500,
      responseFormat: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0].message.content);
    return res.json({ data: parsed.data });
  } catch (err) {
    console.error("materialAI error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/classroom/materials/:materialId/summary
exports.getSummary = async (req, res) => {
  try {
    const [materials] = await pool.query("SELECT * FROM materials WHERE id = ?", [req.params.materialId]);
    if (materials.length === 0) return res.status(404).json({ error: "Material not found" });
    const access = await checkAccess(materials[0].class_id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const [summaries] = await pool.query(
      "SELECT summary_short, summary_paragraph, summary_detailed FROM material_summaries WHERE material_id = ?",
      [req.params.materialId]
    );
    if (summaries.length === 0) return res.status(404).json({ error: "No summary available" });
    res.json(summaries[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/classroom/materials/:materialId — metadata for the in-app preview page
exports.getMaterial = async (req, res) => {
  try {
    const [[m]] = await pool.query(
      "SELECT id, class_id, title, instructions, week, file_path, created_at FROM materials WHERE id = ?",
      [req.params.materialId]
    );
    if (!m) return res.status(404).json({ error: "Material not found" });
    const access = await checkAccess(m.class_id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const ext = m.file_path ? (m.file_path.split(".").pop() || "").toLowerCase() : null;
    res.json({
      id: m.id,
      class_id: m.class_id,
      title: m.title,
      instructions: m.instructions,
      week: m.week,
      created_at: m.created_at,
      file_ext: ext,
      file_url: m.file_path ? `/classroom/materials/${m.id}/file` : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/classroom/materials/:materialId/file — streams the file inline (in-app preview, not a download)
exports.getMaterialFile = async (req, res) => {
  try {
    const [[m]] = await pool.query("SELECT class_id, file_path FROM materials WHERE id = ?", [req.params.materialId]);
    if (!m || !m.file_path) return res.status(404).json({ error: "File not found" });
    const access = await checkAccess(m.class_id, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    // file_path is always a bare filename written by multer — basename() guards
    // against path traversal even if that assumption ever changes upstream.
    const safeName = path.basename(m.file_path);
    const filePath = path.join(__dirname, "../../uploads", safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found on disk" });

    const ext = (safeName.split(".").pop() || "").toLowerCase();
    const contentType = FILE_CONTENT_TYPES[ext] || "application/octet-stream";
    const { size: fileSize } = fs.statSync(filePath);

    res.setHeader("Content-Type", contentType);
    // "inline" (not "attachment") is what makes the browser render it in an
    // <iframe>/<img>/<video> instead of triggering a download.
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(safeName)}"`);
    res.setHeader("Accept-Ranges", "bytes");
    // Deliberately not setting X-Frame-Options: the frontend (5173) and this API (5001)
    // are different origins, so even SAMEORIGIN would block the <iframe>. Express doesn't
    // set the header by default, so simply omitting it here keeps embedding allowed.

    const range = req.headers.range;
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match?.[1] ? parseInt(match[1], 10) : 0;
      const end = match?.[2] ? parseInt(match[2], 10) : fileSize - 1;
      if (!match || start >= fileSize || end >= fileSize || start > end) {
        res.setHeader("Content-Range", `bytes */${fileSize}`);
        return res.status(416).end();
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", end - start + 1);
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.setHeader("Content-Length", fileSize);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/classroom/classes/:classId/members/:userId  (teacher: remove student)
exports.removeMember = async (req, res) => {
  const teacherId = req.user.id;
  const { classId, userId } = req.params;
  try {
    const [[cls]] = await pool.query("SELECT * FROM classes WHERE id=?", [classId]);
    if (!cls) return res.status(404).json({ error: "Class not found" });
    if (cls.teacher_id !== teacherId) return res.status(403).json({ error: "Teachers only" });
    await pool.query("DELETE FROM class_members WHERE class_id=? AND user_id=?", [classId, userId]);
    res.json({ message: "Removed" });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// PATCH /api/classroom/materials/:id/topic
exports.updateMaterialTopic = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[m]] = await pool.query("SELECT * FROM materials WHERE id=?", [req.params.id]);
    if (!m) return res.status(404).json({ error: "Not found" });
    const access = await checkAccess(m.class_id, userId);
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });
    await pool.query("UPDATE materials SET topic=? WHERE id=?", [req.body.topic || null, req.params.id]);
    res.json({ topic: req.body.topic || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/classroom/classes/:classId/students/:studentId/stats
exports.getStudentStats = async (req, res) => {
  const { classId, studentId } = req.params;
  const userId = req.user.id;
  try {
    const access = await checkAccess(classId, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const [[student]] = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE id=?", [studentId]
    );
    if (!student) return res.status(404).json({ error: "Student not found" });

    // All assignments in this class
    const [assignments] = await pool.query(
      "SELECT id, title, points, due_date FROM assignments WHERE class_id=? AND is_draft=0", [classId]
    );

    // Student's submissions
    const [submissions] = await pool.query(
      `SELECT s.*, a.title AS assign_title, a.points AS max_points
       FROM submissions s JOIN assignments a ON s.assignment_id=a.id
       WHERE a.class_id=? AND s.student_id=?`, [classId, studentId]
    );
    const subMap = {};
    submissions.forEach(s => { subMap[s.assignment_id] = s; });

    const assignList = assignments.map(a => ({
      ...a,
      submission: subMap[a.id] || null,
      status: subMap[a.id]
        ? (subMap[a.id].grade !== null ? "graded" : "submitted")
        : "missing",
    }));

    const submitted = submissions.length;
    const total = assignments.length;
    const graded = submissions.filter(s => s.grade !== null);
    const avgGrade = graded.length > 0
      ? Math.round(graded.reduce((sum, s) => sum + (s.grade / s.max_points) * 100, 0) / graded.length)
      : null;

    // Attendance data for this student
    const [attendanceRows] = await pool.query(
      `SELECT s.title, s.session_date, r.status
       FROM attendance_sessions s
       LEFT JOIN attendance_records r ON r.session_id=s.id AND r.student_id=?
       WHERE s.class_id=? ORDER BY s.session_date DESC`,
      [studentId, classId]
    );
    const totalSessions = attendanceRows.length;
    const presentCount = attendanceRows.filter(r => r.status === "present").length;
    const lateCount = attendanceRows.filter(r => r.status === "late").length;
    const absentCount = attendanceRows.filter(r => r.status === "absent").length;
    const attendanceRate = totalSessions > 0
      ? Math.round(((presentCount + lateCount) / totalSessions) * 100)
      : null;

    res.json({
      student,
      stats: {
        totalAssignments: total,
        submittedCount: submitted,
        submissionRate: total > 0 ? Math.round((submitted / total) * 100) : 0,
        gradedCount: graded.length,
        avgGrade,
        totalSessions,
        presentCount,
        lateCount,
        absentCount,
        attendanceRate,
      },
      assignments: assignList,
      attendance: attendanceRows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/classroom/classes/:classId/invite  (invite by email)
exports.inviteStudent = async (req, res) => {
  const { classId } = req.params;
  const userId = req.user.id;
  const { email } = req.body;
  try {
    const [[cls]] = await pool.query("SELECT * FROM classes WHERE id=?", [classId]);
    if (!cls) return res.status(404).json({ error: "Class not found" });
    if (cls.teacher_id !== userId) return res.status(403).json({ error: "Teachers only" });

    const [[targetUser]] = await pool.query("SELECT id, name, email FROM users WHERE email=?", [email]);
    if (!targetUser) return res.status(404).json({ error: "User not found. They must register first." });
    if (targetUser.id === userId) return res.status(400).json({ error: "Cannot invite yourself" });

    const [[existing]] = await pool.query(
      "SELECT id FROM class_members WHERE class_id=? AND user_id=?", [classId, targetUser.id]
    );
    if (existing) return res.status(400).json({ error: "Already a member" });

    await pool.query("INSERT INTO class_members (class_id, user_id, role) VALUES (?, ?, 'student')", [classId, targetUser.id]);
    res.json({ message: "Invited", user: targetUser });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
