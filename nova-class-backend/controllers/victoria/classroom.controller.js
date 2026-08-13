const pool = require("../../config/db");
const { completeText } = require("../../services/ai/groqText");
const { ocrPdfPageText } = require("../../services/ai/pdfVision");
const { textToSpeech: elevenLabsTextToSpeech } = require("../../services/ai/elevenLabs");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

const RAG_URL = process.env.RAG_URL || "http://localhost:8000";

async function ragIngest(filePath, materialId, filename) {
  try {
    const buffer = fs.readFileSync(filePath);
    const blob = new Blob([buffer]);
    const form = new FormData();
    form.append("file", blob, filename || path.basename(filePath));
    form.append("material_id", String(materialId));
    await fetch(`${RAG_URL}/ingest`, { method: "POST", body: form, signal: AbortSignal.timeout(30000) });
  } catch (err) {
    console.warn("[RAG] ingest skipped:", err.message);
  }
}

async function ragRetrieve(question, materialId, nResults = 6) {
  try {
    const res = await fetch(`${RAG_URL}/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, material_id: String(materialId), n_results: nResults }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.chunks && data.chunks.length > 0) return data.chunks.join("\n\n---\n\n");
  } catch {
    // RAG unavailable — fall through to text_content fallback
  }
  return null;
}

// pdf-parse concatenates every page's text into one blob with no page
// boundaries, so the AI chat had no way to know what's actually on "page N" —
// only the bare page number. This marker format is inserted per page at
// extraction time so text_content stays a single string (no schema change)
// while still being splittable back into per-page sections later.
const PAGE_MARKER_RE = /\f<<PAGE (\d+)>>\f/g;

function pdfPageMarker(pageNumber) {
  return `\f<<PAGE ${pageNumber}>>\f`;
}

function renderPdfPageWithMarker(pageData) {
  const renderOptions = { normalizeWhitespace: false, disableCombineTextItems: false };
  return pageData.getTextContent(renderOptions).then((textContent) => {
    let lastY, text = "";
    for (const item of textContent.items) {
      if (lastY === item.transform[5] || !lastY) text += item.str;
      else text += "\n" + item.str;
      lastY = item.transform[5];
    }
    return `${pdfPageMarker(pageData.pageNumber)}${text}`;
  });
}

async function extractPdfTextWithPageMarkers(buffer) {
  const parsed = await pdfParse(buffer, { pagerender: renderPdfPageWithMarker });
  return parsed.text.trim();
}
// Reused by scripts/backfill_pdf_page_markers.js to re-extract materials
// uploaded before this marker format existed.
exports.extractPdfTextWithPageMarkers = extractPdfTextWithPageMarkers;

// Materials uploaded before this marker format existed have plain,
// unmarked text_content — splitPagesFromMarkedText correctly returns []
// for those, so callers fall back to whole-document-only behavior.
function splitPagesFromMarkedText(markedText) {
  if (!markedText) return [];
  const matches = [...markedText.matchAll(PAGE_MARKER_RE)];
  return matches.map((match, i) => {
    const start = match.index + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : markedText.length;
    return { page: Number(match[1]), text: markedText.slice(start, end).trim() };
  });
}

function stripPageMarkers(markedText) {
  return (markedText || "").replace(PAGE_MARKER_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}

// Rebuilds marked text with one page's section replaced — used to cache an
// OCR result back into text_content so future questions about that page
// skip the Vision round-trip entirely.
function replacePageText(markedText, pageNumber, newText) {
  const pages = splitPagesFromMarkedText(markedText);
  if (pages.length === 0) return markedText;
  return pages
    .map(p => `${pdfPageMarker(p.page)}${p.page === pageNumber ? newText : p.text}`)
    .join("\n\n");
}

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
              (SELECT COUNT(*) FROM class_members WHERE class_id = c.id) AS student_count,
              (SELECT COUNT(*) FROM materials WHERE class_id = c.id) AS material_count,
              (SELECT COUNT(*) FROM assignments WHERE class_id = c.id AND is_draft = 0) AS assignment_count
       FROM classes c JOIN users u ON u.id = c.teacher_id WHERE c.teacher_id = ?`,
      [userId]
    );
    const [joined] = await pool.query(
      `SELECT c.id, c.name, c.subject, c.code, 'student' AS my_role, u.name AS teacher_name,
              (SELECT COUNT(*) FROM class_members WHERE class_id = c.id) AS student_count,
              (SELECT COUNT(*) FROM materials WHERE class_id = c.id) AS material_count,
              (SELECT COUNT(*) FROM assignments WHERE class_id = c.id AND is_draft = 0) AS assignment_count
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
    res.json({ ...access.cls, my_role: access.role, my_id: req.user.id, student_count });
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
      `SELECT m.id, m.title, m.instructions, m.week, m.file_path, m.created_at, m.ai_resources,
              s.summary_short AS summary
       FROM materials m
       LEFT JOIN material_summaries s ON s.material_id = m.id
       WHERE m.class_id = ? ORDER BY m.week ASC, m.created_at ASC`,
      [req.params.id]
    );
    const ids = materials.map(m => m.id);
    const filesByMaterial = {};
    if (ids.length) {
      const [files] = await pool.query(
        `SELECT * FROM material_files WHERE material_id IN (${ids.map(() => "?").join(",")})`,
        ids
      );
      files.forEach(f => { (filesByMaterial[f.material_id] ||= []).push(f); });
    }
    const result = materials.map(m => ({
      ...m,
      file_url: m.file_path ? `/uploads/${m.file_path}` : null,
      ai_resources: m.ai_resources ? (typeof m.ai_resources === "string" ? JSON.parse(m.ai_resources) : m.ai_resources) : null,
      files: filesByMaterial[m.id] || [],
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/classroom/materials/generate-instructions
exports.generateInstructions = async (req, res) => {
  try {
    let text = "";
    let filePath = null;
    let originalFilename = req.file?.originalname || "";

    // If frontend sends cached textContent, skip file reading entirely (fast path for lang toggle)
    if (req.body.textContent) {
      text = req.body.textContent;
      if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    } else if (req.file) {
      filePath = req.file.path;
      try {
        const buf = fs.readFileSync(filePath);
        const parsed = await pdfParse(buf);
        text = parsed.text?.slice(0, 3000) || "";
      } catch { /* non-pdf or unreadable */ }

      // Image-based PDF: read all pages with Groq Vision (page by page)
      if (text.trim().length < 300) {
        text = await readPdfPagesWithVision(filePath, 10);
      }

      try { fs.unlinkSync(filePath); } catch { /* cleanup */ }
    }
    const title = req.body.title || "";
    const week = parseInt(req.body.week) || 1;
    const classId = req.body.classId || null;
    const lang = req.body.lang === "ko" ? "ko" : "en";
    const hint = text || title || originalFilename;
    if (!hint.trim()) return res.json({ instructions: "", textContent: "" });

    // Build curriculum context from existing class materials
    let curriculumContext = "";
    if (classId) {
      try {
        const [rows] = await pool.query(
          "SELECT week, title FROM materials WHERE class_id = ? ORDER BY week ASC, id ASC",
          [classId]
        );
        if (rows.length > 0) {
          const grouped = {};
          rows.forEach(r => {
            if (!grouped[r.week]) grouped[r.week] = [];
            grouped[r.week].push(r.title);
          });
          const lines = Object.entries(grouped)
            .map(([w, titles]) => `  Week ${w}: ${titles.join(", ")}`)
            .join("\n");
          curriculumContext = `\nClass curriculum (already posted):\n${lines}\n`;
        }
      } catch { /* continue without curriculum */ }
    }

    // Only include ASCII-safe filenames directly; Korean filenames confuse the output
    const cleanFilename = originalFilename.replace(/\.(pdf|PDF)$/, "").replace(/[_]/g, " ");
    const filenameIsAscii = /^[\x00-\x7F]*$/.test(cleanFilename);
    const filenameHint = !text && originalFilename && filenameIsAscii
      ? `\nMaterial filename: "${cleanFilename}"\n`
      : "";

    const isGenericTitle2 = /^(lesson|chapter|unit|week|part|section|module|lecture|class|topic)\s*\d*\s*$/i.test(title.trim());
    const titleLine = isGenericTitle2 && text
      ? `Week ${week} lesson material`
      : `"${title}" (Week ${week})`;

    const prompt = `You are a helpful teacher assistant.
A teacher is creating a lesson material: ${titleLine}.
${curriculumContext}${filenameHint}${text ? `\nLesson content (read from the actual document):\n${text}\n` : ""}
Write clear, friendly student-facing instructions for this specific lesson.
Rules:
- 3 to 5 sentences max
- BASE the instructions on the ACTUAL CONTENT above, not on the title
- If content mentions Korean vocabulary/TOPIK → mention vocabulary, Korean language study
- If content mentions programming/code → mention the specific language and concepts
- Start with what students will learn or practice in this specific lesson
- Mention what they should do (read, practice, complete exercises, etc.)
- Keep it encouraging and specific to the content
- Write in ${lang === "ko" ? "Korean ONLY. Use ONLY 한글 (Hangul). NEVER use Chinese characters (漢字), Japanese characters, Arabic, or any non-Hangul script. Do NOT use underscores. Write naturally like a Korean teacher." : "English only. No foreign characters."}
- IMPORTANT: Ignore garbled, corrupted characters in the source. Only use clearly readable content.

Return ONLY the instruction text, no headings, no bullet points.`;

    let instructions = (await askGroq(prompt, 350)).trim();
    // For Korean output: strip any Japanese/Chinese/Arabic characters that Groq mixed in
    if (lang === "ko") {
      instructions = instructions
        .replace(/[぀-ヿ]/g, "")   // Japanese hiragana/katakana
        .replace(/[一-鿿]/g, "")   // CJK (Chinese/Japanese kanji)
        .replace(/[؀-ۿ]/g, "")   // Arabic
        .replace(/\s{2,}/g, " ")
        .trim();
    }
    res.json({ instructions, textContent: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Returns true if OCR text is usable (not mostly garbage symbols)
function isOcrUsable(text) {
  if (!text || text.trim().length < 50) return false;
  const meaningful = (text.match(/[\w가-힣ㄱ-ㅎㅏ-ㅣ]/g) || []).length;
  const total = text.replace(/\s/g, "").length;
  return total > 0 && (meaningful / total) > 0.45;
}

// Shared helper — extract known tech keywords from any text (works on sparse OCR output too)
function extractCodeKeywords(text) {
  const found = new Set();
  (text.match(/import\s+([\w.]+)/g) || []).slice(0, 5)
    .forEach(m => found.add(m.replace("import ", "").split(".").pop()));
  const techPattern = /\b(JDBC|SQL|MySQL|Oracle|PostgreSQL|MongoDB|PreparedStatement|ResultSet|Connection|DriverManager|Statement|CallableStatement|DataSource|Spring|Maven|Gradle|JPA|Hibernate|Servlet|JSP|HTML|CSS|JavaScript|TypeScript|React|Vue|Angular|Node|Express|Python|Java|Kotlin|Swift|Flutter|Django|Flask|FastAPI|Docker|Kubernetes|REST|API|JSON|XML|HTTP|Git|Linux|Arduino|TensorFlow|PyTorch|pandas|numpy|OpenCV|YOLO|CNN|RNN|LSTM|POS|GUI|CRUD|MVC|OOP)\b/gi;
  (text.match(techPattern) || []).forEach(m => found.add(m.toUpperCase() === m ? m : m.toLowerCase()));
  (text.match(/(?:public\s+)?(?:class|interface|enum)\s+(\w+)/g) || []).slice(0, 3)
    .forEach(m => found.add(m.split(/\s+/).pop()));
  return [...found].slice(0, 8);
}

// Call RAG server to OCR-extract text from image-based PDF
async function extractTextViaRag(filePath, filename) {
  const RAG_URL = process.env.RAG_URL || "http://localhost:8000";
  const tempId = `yt_tmp_${Date.now()}`;
  try {
    const FormData = require("form-data");
    const form = new FormData();
    form.append("material_id", tempId);
    form.append("file", fs.createReadStream(filePath), { filename });

    const ingestRes = await fetch(`${RAG_URL}/ingest`, {
      method: "POST",
      body: form,
      headers: form.getHeaders(),
      signal: AbortSignal.timeout(60000),
    });
    if (!ingestRes.ok) return "";

    const retrieveRes = await fetch(`${RAG_URL}/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "what technology subject programming language is taught", material_id: tempId, n_results: 5 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!retrieveRes.ok) return "";
    const data = await retrieveRes.json();
    return (data.chunks || []).join("\n").slice(0, 3000);
  } catch { return ""; }
  finally {
    // Clean up temp RAG entry
    const RAG_URL2 = process.env.RAG_URL || "http://localhost:8000";
    fetch(`${RAG_URL2}/sources/${tempId}`, { method: "DELETE" }).catch(() => {});
  }
}

// Strip PDF encoding artifacts and OCR garbage from Vision output before passing to LLM
function sanitizeVisionText(text) {
  if (!text) return "";
  // Remove Myanmar/Burmese Unicode
  text = text.replace(/[က-႟]/g, "");
  // Remove Arabic/Persian Unicode
  text = text.replace(/[؀-ۿ]/g, "");
  // Remove Thai Unicode
  text = text.replace(/[฀-๿]/g, "");
  // Remove Japanese Hiragana and Katakana
  text = text.replace(/[぀-ヿ]/g, "");
  // Remove CJK (Chinese/Japanese kanji — Korean Hangul is separate and NOT removed)
  text = text.replace(/[一-鿿]/g, "");
  // Remove comma-separated garbage: short random tokens mixed with any non-ASCII
  text = text.replace(/\b[a-z]{2,6}(,\s*(?:[a-z]{1,6}|[^\x00-\x7F]{1,3})){1,}\b/gi, "");
  // Clean up leftover punctuation and whitespace
  text = text.replace(/,\s*,/g, ",").replace(/\s{2,}/g, " ").trim();
  return text;
}

// Convert PDF pages to images one by one, read each with Groq Vision, aggregate descriptions
async function readPdfPagesWithVision(pdfPath, maxPages = 10) {
  const tmpPrefix = `/tmp/ytpdf_${Date.now()}`;
  const pngFiles = [];
  try {
    await execFileAsync("/opt/homebrew/bin/pdftoppm", [
      "-r", "72", "-f", "1", "-l", String(maxPages), "-png", pdfPath, tmpPrefix
    ], { timeout: 60000 });

    // Collect all generated PNG files in order
    const dir = path.dirname(tmpPrefix);
    const base = path.basename(tmpPrefix);
    const found = fs.readdirSync(dir)
      .filter(f => f.startsWith(base) && f.endsWith(".png"))
      .sort()
      .map(f => path.join(dir, f));
    pngFiles.push(...found);

    if (pngFiles.length === 0) return "";

    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const descriptions = [];
    for (const png of pngFiles) {
      try {
        const base64 = fs.readFileSync(png).toString("base64");
        const result = await model.generateContent([
          { inlineData: { data: base64, mimeType: "image/png" } },
          "Extract key topics, terms, and concepts from this educational document page. List them briefly in English only. Ignore any garbled, unreadable, or corrupted characters — only include clearly readable text.",
        ]);
        const desc = sanitizeVisionText(result.response.text() || "");
        if (desc.trim()) descriptions.push(desc.trim());
      } catch (e) {
        console.warn("[Vision] page read failed:", e.message);
      }
    }

    return descriptions.join("\n");
  } catch (e) {
    console.warn("[Vision] PDF pages read failed:", e.message);
    return "";
  } finally {
    for (const f of pngFiles) try { fs.unlinkSync(f); } catch {}
  }
}

exports.suggestYoutubeForMaterial = async (req, res) => {
  let tempFilePath = null;
  try {
    const title = req.body.title || "";
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) return res.json({ videos: [], warning: "YOUTUBE_API_KEY not configured" });

    let pdfText = "";
    let originalFilename = req.file?.originalname || "";
    if (req.file) {
      tempFilePath = req.file.path;
      try {
        const buf = fs.readFileSync(req.file.path);
        const parsed = await pdfParse(buf);
        pdfText = parsed.text?.slice(0, 3000) || "";
      } catch { /* non-pdf or unreadable */ }
    }

    if (!title.trim() && !pdfText && !originalFilename) return res.json({ videos: [] });

    const isGenericTitle = /^(lesson|chapter|unit|week|part|section|module|lecture|class|topic)\s*\d*\s*$/i.test(title.trim());

    const usableText = isOcrUsable(pdfText) ? pdfText : "";

    // If pdf-parse returned little text (image/scanned PDF), read all pages with Groq Vision
    let visionDescription = "";
    if (req.file && pdfText.trim().length < 300) {
      visionDescription = await readPdfPagesWithVision(req.file.path, 10);
    }

    let searchQuery = isGenericTitle ? "study tutorial" : `${title} tutorial`;

    try {
      // Pre-translate common Korean educational terms so Groq doesn't guess
      const korToEng = {
        "토픽": "TOPIK", "어휘": "vocabulary", "듣기": "listening", "읽기": "reading",
        "쓰기": "writing", "문법": "grammar", "말하기": "speaking", "발음": "pronunciation",
        "정답": "answer key", "해설": "explanation", "연습": "practice", "시험": "exam",
        "빈도별": "by frequency", "초급": "beginner", "중급": "intermediate", "고급": "advanced",
        "한국어": "Korean language", "일본어": "Japanese language", "중국어": "Chinese language",
        "수학": "math", "과학": "science", "영어": "English", "역사": "history",
      };
      let cleanFn = originalFilename.replace(/\.(pdf|PDF)$/, "").replace(/[_]/g, " ");
      Object.entries(korToEng).forEach(([kor, eng]) => { cleanFn = cleanFn.replace(new RegExp(kor, "g"), eng); });

      const context = [
        title && !isGenericTitle ? `Material title: "${title}"` : "",
        originalFilename ? `Filename: "${cleanFn}"` : "",
        visionDescription ? `\nAI vision read of document: ${visionDescription}` : "",
        !visionDescription && usableText ? `\nContent excerpt:\n${usableText.slice(0, 1500)}` : "",
        /korean|한국어|korea/.test(languageHint) ? `\nPreferred video language: Korean. Include "Korean" as a search term.` : "",
      ].filter(Boolean).join("\n");

      const queryPrompt = `Identify the subject of this educational material and extract 3-5 key English search terms.

${context}

Rules:
- If it's a Korean language exam (TOPIK), include "TOPIK" and "Korean" as terms
- If it's programming, include the language and concept (e.g. "Java", "JDBC")
- Always include "tutorial" or "practice" or "lesson" as a term
- Return ONLY a comma-separated list of terms, nothing else

Example outputs:
TOPIK, Korean, vocabulary, practice
Java, JDBC, database, tutorial
English, grammar, present tense, lesson`;

      const raw = (await askGroq(queryPrompt, 60)).trim();
      // Groq returns "term1, term2, term3" — join into search query
      if (raw && raw.length > 3 && raw.length < 200 && raw.includes(",")) {
        const terms = raw.split(",").map(t => t.trim()).filter(t => /^[\x00-\x7F]+$/.test(t) && t.length > 1);
        if (terms.length >= 2) searchQuery = terms.slice(0, 5).join(" ");
      } else if (raw && raw.length > 3 && raw.length < 100 && /^[\x00-\x7F]+$/.test(raw)) {
        searchQuery = raw;
      }
    } catch {
      const fallbackKeywords = extractCodeKeywords(usableText + " " + originalFilename);
      if (fallbackKeywords.length > 0) searchQuery = `${fallbackKeywords.slice(0, 3).join(" ")} tutorial`;
    }

    const pageToken = req.body.pageToken || "";
    const languageHint = (req.body.languageHint || "English").toLowerCase().trim();
    let ytLang = "en";
    let ytRegion = "";
    let langQuerySuffix = "";
    if (/korean|한국어|korea/.test(languageHint)) {
      ytLang = "ko"; ytRegion = "KR"; langQuerySuffix = " Korean 한국어";
    }
    // append Korean suffix to push YouTube toward Korean-language results
    if (langQuerySuffix) searchQuery = searchQuery + langQuerySuffix;
    const ytLangParam = `&relevanceLanguage=${ytLang}${ytRegion ? `&regionCode=${ytRegion}` : ""}`;
    const ytUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=3${ytLangParam}&key=${YOUTUBE_API_KEY}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const ytRes = await fetch(ytUrl, { signal: AbortSignal.timeout(10000) });
    if (!ytRes.ok) return res.json({ videos: [] });

    const ytData = await ytRes.json();
    const videos = (ytData.items || []).map(item => ({
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
      channel: item.snippet.channelTitle,
    }));

    res.json({ videos, searchQuery, nextPageToken: ytData.nextPageToken || null });
  } catch (err) {
    res.status(500).json({ error: err.message, videos: [] });
  } finally {
    if (tempFilePath) try { fs.unlinkSync(tempFilePath); } catch { /* cleanup */ }
  }
};

// Materials support one primary document (the field named "file" — drives
// the PDF viewer/OCR/highlight pipeline, unchanged) plus any number of
// supplementary attachments (the field named "files") stored in the
// material_files child table, mirroring assignment_files.
async function saveMaterialFiles(materialId, uploadedFiles) {
  for (const f of uploadedFiles) {
    await pool.query(
      "INSERT INTO material_files (material_id, file_name, file_path) VALUES (?, ?, ?)",
      [materialId, f.originalname, f.filename]
    );
  }
  const [files] = await pool.query("SELECT * FROM material_files WHERE material_id = ?", [materialId]);
  return files;
}

// POST /api/classroom/classes/:id/materials  (multipart/form-data)
exports.uploadMaterial = async (req, res) => {
  const classId = req.params.id;
  const userId = req.user.id;
  if (!req.body.title) return res.status(400).json({ error: "Title is required" });

  const primaryFile = req.files?.file?.[0] || null;
  const extraFiles = req.files?.files || [];

  try {
    const access = await checkAccess(classId, userId);
    if (access.error) {
      if (primaryFile) fs.unlink(primaryFile.path, () => {});
      extraFiles.forEach(f => fs.unlink(f.path, () => {}));
      return res.status(access.status).json({ error: access.error });
    }

    const title = req.body.title;
    const instructions = req.body.instructions || null;
    const week = parseInt(req.body.week) || 1;
    const filePath = primaryFile ? primaryFile.filename : null;

    if (!primaryFile) {
      const [result] = await pool.query(
        "INSERT INTO materials (class_id, title, instructions, week, file_path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)",
        [classId, title, instructions, week, null, userId]
      );
      const materialId = result.insertId;
      const files = await saveMaterialFiles(materialId, extraFiles);
      await pool.query(
        "INSERT INTO class_posts (class_id, author_id, content, type, material_id) VALUES (?, ?, ?, 'material', ?)",
        [classId, userId, title, materialId]
      );
      return res.status(201).json({ id: materialId, title, instructions, week, file_url: null, summary: null, files });
    }

    // Extract text — only PDFs support extraction (Word/PowerPoint/images are stored as-is)
    let text = "";
    if (primaryFile.mimetype === "application/pdf") {
      const buffer = fs.readFileSync(primaryFile.path);
      text = await extractPdfTextWithPageMarkers(buffer);
    }

    // Save material with extracted text
    const [result] = await pool.query(
      "INSERT INTO materials (class_id, title, instructions, week, file_path, text_content, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [classId, title, instructions, week, filePath, text || null, userId]
    );
    const materialId = result.insertId;
    const files = await saveMaterialFiles(materialId, extraFiles);

    if (!text) {
      await pool.query(
        "INSERT INTO class_posts (class_id, author_id, content, type, material_id) VALUES (?, ?, ?, 'material', ?)",
        [classId, userId, title, materialId]
      );
      return res.status(201).json({
        id: materialId, title, instructions, week,
        file_url: `/uploads/${filePath}`, summary: null, files,
        warning: primaryFile.mimetype === "application/pdf"
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

    // Fire-and-forget: index into RAG so chat/quiz can use full document
    ragIngest(primaryFile.path, materialId, primaryFile.originalname || primaryFile.filename);

    // AI resource suggestions — use teacher's selection if provided, otherwise auto-generate
    let aiResources = null;
    if (req.body.ai_resources) {
      try {
        const parsed = typeof req.body.ai_resources === "string"
          ? JSON.parse(req.body.ai_resources)
          : req.body.ai_resources;
        if (Array.isArray(parsed) && parsed.length > 0) {
          aiResources = parsed;
          await pool.query("UPDATE materials SET ai_resources = ? WHERE id = ?", [JSON.stringify(aiResources), materialId]);
        }
      } catch { /* ignore malformed */ }
    }

    if (!aiResources) try {
      const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
      if (YOUTUBE_API_KEY) {
        // Use Groq to generate a precise YouTube search query based on lesson content
        const contentHint = summaryData
          ? summaryData.short || summaryData.paragraph
          : (text ? text.slice(0, 1000) : instructions || title);
        let searchQuery = `${title} tutorial`;
        try {
          const queryPrompt = `A teacher uploaded a lesson titled "${title}".
Lesson content: ${contentHint}

Generate a short, specific YouTube search query (max 8 words) that would find the most relevant educational video for students learning this topic.
Return ONLY the search query text, nothing else. No quotes, no explanation.`;
          const raw = (await askGroq(queryPrompt, 50)).trim();
          if (raw && raw.length > 3 && raw.length < 100) searchQuery = raw;
        } catch {
          // fallback to title
        }

        const ytRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=3&relevanceLanguage=en&key=${YOUTUBE_API_KEY}`,
          { signal: AbortSignal.timeout(10000) }
        );
        if (ytRes.ok) {
          const ytData = await ytRes.json();
          aiResources = (ytData.items || []).map(item => ({
            title: item.snippet.title,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
            channel: item.snippet.channelTitle,
            type: "video",
          }));
          await pool.query("UPDATE materials SET ai_resources = ? WHERE id = ?", [JSON.stringify(aiResources), materialId]);
        }
      }
    } catch (resErr) {
      console.warn("YouTube resources skipped:", resErr.message);
    }

    res.status(201).json({
      id: materialId, title, instructions, week,
      file_url: `/uploads/${filePath}`,
      summary: summaryData,
      ai_resources: aiResources,
      files,
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
      `SELECT m.title, m.instructions, m.text_content, m.file_path,
              s.summary_paragraph, s.summary_detailed
       FROM materials m LEFT JOIN material_summaries s ON s.material_id = m.id
       WHERE m.id = ?`,
      [req.params.materialId]
    );
    if (mats.length === 0) return res.status(404).json({ error: "Material not found" });
    const mat = mats[0];

    // Build retrieval query: for chat use the user's message, for others use action keywords
    const retrievalQuery = action === "chat" && message
      ? message
      : action === "quiz"   ? "key concepts, vocabulary, grammar rules, main topics, important points"
      : action === "summary" ? "main topics, core concepts, key points, lesson overview"
      : action === "highlights" ? "key terms, definitions, important vocabulary, formulas"
      : mat.title;

    // Try RAG first (full-document coverage), fallback to text_content.
    // text_content may carry page markers (see extractPdfTextWithPageMarkers) —
    // stripped here so they never leak into anything the AI reads as prose.
    const cleanTextContent = stripPageMarkers(mat.text_content);
    const ragText = await ragRetrieve(retrievalQuery, req.params.materialId);
    const fullText = ragText
      || (cleanTextContent ? cleanTextContent.slice(0, 40000) : null)
      || [mat.summary_paragraph, mat.summary_detailed].filter(Boolean).join("\n\n");

    const context = [
      `Title: ${mat.title}`,
      mat.instructions ? `Instructions: ${mat.instructions}` : null,
      fullText ? `Content:\n${fullText}` : null,
    ].filter(Boolean).join("\n\n");

    if (action === "chat" && req.body.mode === "assistant") {
      const { lang, currentPage, totalPages } = req.body;
      const isEn = lang === "en";

      const langInstruction = isEn
        ? `Respond in English only. For technical terms, use English as-is.`
        : `မြန်မာဘာသာ ဖြင့်သာ ဖြေဆိုပါ။ Technical term များကို English ဖြင့် ထားပါ၊ ရှင်းပြချက်ကို မြန်မာ ဖြင့် ပေးပါ။`;

      const pageContext = currentPage && totalPages
        ? (isEn
            ? `The student is currently viewing page ${currentPage} of ${totalPages}.`
            : `ကျောင်းသား လက်ရှိ ကြည့်နေသည့် စာမျက်နှာမှာ ${totalPages} ထဲမှ ${currentPage} ဖြစ်သည်။`)
        : "";

      // Pages are only available for materials uploaded after the page-marker
      // format existed (extractPdfTextWithPageMarkers). Older materials fall
      // back to the previous whole-document-only sparse heuristic below.
      const pages = splitPagesFromMarkedText(mat.text_content);
      let currentPageEntry = currentPage ? pages.find(p => p.page === Number(currentPage)) : null;
      let currentPageHasText = Boolean(currentPageEntry && currentPageEntry.text.length >= 20);

      // The page renders fine visually but pdf-parse found nothing — likely a
      // broken font ToUnicode mapping (common in PPT-exported decks), not a
      // real image. Read the rendered page with Vision instead, and cache the
      // result back into text_content so no other student re-pays this cost.
      if (currentPage && pages.length > 0 && !currentPageHasText && mat.file_path?.toLowerCase().endsWith(".pdf")) {
        const pdfPath = path.join(__dirname, "../../uploads", path.basename(mat.file_path));
        const ocrText = await ocrPdfPageText(pdfPath, Number(currentPage));
        if (ocrText) {
          currentPageEntry = { page: Number(currentPage), text: ocrText };
          currentPageHasText = true;
          const updatedMarkedText = replacePageText(mat.text_content, Number(currentPage), ocrText);
          pool.query("UPDATE materials SET text_content = ? WHERE id = ?", [updatedMarkedText, req.params.materialId])
            .catch(err => console.warn("[OCR] cache write failed:", err.message));
        }
      }

      const currentPageBlock = currentPageHasText
        ? (isEn
            ? `\n\nCurrent page (page ${currentPage}) content, verbatim:\n${currentPageEntry.text}`
            : `\n\nလက်ရှိ စာမျက်နှာ (page ${currentPage}) ၏ အကြောင်းအရာ:\n${currentPageEntry.text}`)
        : "";

      const extractedLength = cleanTextContent.length;
      const avgCharsPerPage = totalPages ? extractedLength / totalPages : Infinity;

      const pageSpecificWarning = currentPage && pages.length > 0 && !currentPageHasText
        ? (isEn
            ? `No extractable text was found for page ${currentPage} specifically — it's likely an image-based slide. Don't guess its content; say so honestly if asked about it. The rest of the document below may still be usable for other questions.`
            : `စာမျက်နှာ ${currentPage} အတွက် စာသား ထုတ်ယူ၍ မရခဲ့ပါ — ပုံစံ slide ဖြစ်နိုင်ပါသည်။ ဒီစာမျက်နှာ အကြောင်း မေးခွန်းအတွက် မှန်းဆ၍ မဖြေဘဲ ရိုးသားစွာ ပြောပါ။ အောက်ပါ document အခြားအပိုင်းများကိုမူ အခြား မေးခွန်းများအတွက် အသုံးပြု၍ ရနိုင်ပါသည်။`)
        : "";

      const documentWideSparseWarning = pages.length === 0 && avgCharsPerPage < 80
        ? (isEn
            ? `Only ${extractedLength} characters of text could be extracted from this ${totalPages}-page document in total — most pages, likely including the current one, are image-based slides with no extractable text. You do NOT have reliable access to specific page content. If asked about "this page" or details you cannot verify in the Material content below, honestly say you can't read that page's content because it appears to be an image-based slide, instead of guessing or inventing details.`
            : `ဤ ${totalPages} မျက်နှာ document တစ်ခုလုံးမှ စာသား ${extractedLength} လုံးသာ ထုတ်ယူနိုင်ခဲ့သည် — စာမျက်နှာအများစု (လက်ရှိ စာမျက်နှာ အပါအဝင် ဖြစ်နိုင်သည်) သည် စာသား ထုတ်ယူ၍ မရသော ပုံစံ slide များ ဖြစ်သည်။ ဤ စာမျက်နှာ အတွက် တိကျသော အကြောင်းအရာ ရရှိထားခြင်း မရှိပါ။ "ဒီ page" သို့မဟုတ် အောက်ပါ Material content တွင် အတည်ပြုနိုင်ခြင်း မရှိသော အသေးစိတ်များကို မေးမြန်းပါက၊ မှန်းဆ၍ မဖြေဘဲ ဤ စာမျက်နှာကို ပုံစံ slide ဖြစ်၍ ဖတ်၍ မရကြောင်း ရိုးသားစွာ ပြောပါ။`)
        : "";

      const sparseWarning = pageSpecificWarning || documentWideSparseWarning;

      const scopeInstruction = isEn
        ? `You only discuss this lesson's material. If the student asks something unrelated to this document (general chit-chat, other subjects, unrelated topics), politely say you can only help with this lesson's content and ask what they'd like to know about it — do not answer the unrelated question.`
        : `သင်သည် ဤ သင်ခန်းစာ အကြောင်းအရာကိုသာ ဆွေးနွေးပါသည်။ ကျောင်းသားက ဤ document နှင့် မသက်ဆိုင်သော မေးခွန်း (ယေဘုယျ စကားစမြည်၊ အခြား ဘာသာရပ်များ) မေးပါက၊ ဤ သင်ခန်းစာ အကြောင်းအရာကိုသာ ကူညီနိုင်ကြောင်း ယဉ်ကျေးစွာ ပြောပြီး ဘာသိချင်သည်ကို ပြန်မေးပါ — မသက်ဆိုင်သော မေးခွန်းကို လုံးဝ မဖြေပါနှင့်။`;

      const systemContent = isEn
        ? `You are a helpful AI study assistant for this lesson material. ${langInstruction} ${scopeInstruction}
${pageContext}${currentPageBlock}

Material content (full document):
${context}

${sparseWarning}

Answer the student's question directly and naturally. When asked about the current page, prioritize the "Current page" content above — it's the exact text of that page. Only state facts that are actually supported by the content above — never invent page numbers, headings, or details you cannot verify.`
        : `သင်သည် ဤ သင်ခန်းစာ အတွက် အထောက်အကူပြု AI study assistant ဖြစ်သည်။ ${langInstruction} ${scopeInstruction}
${pageContext}${currentPageBlock}

သင်ခန်းစာ အကြောင်းအရာ (document တစ်ခုလုံး):
${context}

${sparseWarning}

ကျောင်းသား၏ မေးခွန်းကို တိုက်ရိုက်နှင့် သဘာဝကျစွာ ဖြေပါ။ လက်ရှိ စာမျက်နှာနှင့် ပတ်သက်၍ မေးလျှင် အထက်ပါ "Current page" အကြောင်းအရာကို ဦးစားပေး အသုံးပြုပါ — ၎င်းသည် ထိုစာမျက်နှာ၏ အတိအကျ စာသား ဖြစ်သည်။ အထက်ပါ အကြောင်းအရာ တွင် အမှန်တကယ် ရှိသော အချက်များကိုသာ ပြောပါ — စိစစ်၍ မရသော စာမျက်နှာနံပါတ်၊ ခေါင်းစဉ် (သို့) အသေးစိတ်များကို လုံးဝ မတီထွင်ပါနှင့်။`;

      const msgs = [
        { role: "system", content: systemContent },
        ...(history || []).map(h => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.content })),
        { role: "user", content: message },
      ];
      const completion = await completeText({ messages: msgs, maxTokens: 600 });
      return res.json({ reply: completion.choices[0].message.content });
    }

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

    const [files] = await pool.query("SELECT * FROM material_files WHERE material_id = ?", [m.id]);

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
      files,
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
    // "inline" lets the browser render the file instead of triggering a download.
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

// PUT /api/classroom/materials/:id
exports.updateMaterial = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[m]] = await pool.query("SELECT * FROM materials WHERE id=?", [req.params.id]);
    if (!m) return res.status(404).json({ error: "Not found" });
    const access = await checkAccess(m.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.role !== "teacher") return res.status(403).json({ error: "Teachers only" });

    const title = (req.body.title || m.title).trim();
    const instructions = req.body.instructions !== undefined ? (req.body.instructions || null) : m.instructions;
    const week = req.body.week ? parseInt(req.body.week) : m.week;

    let aiResources = m.ai_resources;
    if (req.body.ai_resources !== undefined) {
      try { aiResources = JSON.parse(req.body.ai_resources); } catch { aiResources = []; }
    }

    let filePath = m.file_path;
    let textContent = m.text_content;

    const primaryFile = req.files?.file?.[0] || null;
    const extraFiles = req.files?.files || [];

    if (primaryFile) {
      if (m.file_path) {
        const oldPath = path.join(__dirname, "../../uploads", m.file_path);
        try { fs.unlinkSync(oldPath); } catch {}
      }
      filePath = primaryFile.filename;
      if (primaryFile.mimetype === "application/pdf") {
        const buffer = fs.readFileSync(primaryFile.path);
        textContent = await extractPdfTextWithPageMarkers(buffer);
      } else {
        textContent = null;
      }
    }

    // Existing attachments are kept by default — only removed when the
    // caller explicitly lists their ids, never as a side effect of editing.
    let deleteFileIds = [];
    try { deleteFileIds = req.body.delete_file_ids ? JSON.parse(req.body.delete_file_ids) : []; } catch {}

    const aiResourcesJson = Array.isArray(aiResources) ? JSON.stringify(aiResources) : JSON.stringify([]);
    await pool.query(
      "UPDATE materials SET title=?, instructions=?, week=?, file_path=?, text_content=?, ai_resources=? WHERE id=?",
      [title, instructions, week, filePath, textContent, aiResourcesJson, m.id]
    );

    if (deleteFileIds.length) {
      await pool.query("DELETE FROM material_files WHERE id IN (?) AND material_id = ?", [deleteFileIds, m.id]);
    }
    const files = await saveMaterialFiles(m.id, extraFiles);

    const fileUrl = filePath ? `/uploads/${filePath}` : null;
    res.json({ id: m.id, title, instructions, week, file_url: fileUrl, class_id: m.class_id, ai_resources: aiResources || [], files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/classroom/materials/:materialId/assignments
exports.getMaterialAssignments = async (req, res) => {
  const userId = req.user.id;
  try {
    const [[m]] = await pool.query("SELECT * FROM materials WHERE id=?", [req.params.materialId]);
    if (!m) return res.status(404).json({ error: "Not found" });
    const access = await checkAccess(m.class_id, userId);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const [assignments] = await pool.query(
      "SELECT * FROM assignments WHERE material_id=? AND is_draft=0 ORDER BY created_at DESC",
      [req.params.materialId]
    );

    if (access.role === "student") {
      const ids = assignments.map(a => a.id);
      if (ids.length === 0) return res.json([]);
      const [subs] = await pool.query(
        `SELECT * FROM submissions WHERE student_id=? AND assignment_id IN (${ids.map(() => "?").join(",")})`,
        [userId, ...ids]
      );
      const subMap = {};
      subs.forEach(s => { subMap[s.assignment_id] = s; });
      return res.json(assignments.map(a => ({ ...a, my_submission: subMap[a.id] || null })));
    }

    const ids = assignments.map(a => a.id);
    if (ids.length === 0) return res.json([]);
    const [counts] = await pool.query(
      `SELECT assignment_id, COUNT(*) AS turned_in_count FROM submissions
       WHERE status IN ('turned_in','late','graded') AND assignment_id IN (${ids.map(() => "?").join(",")})
       GROUP BY assignment_id`,
      ids
    );
    const countMap = {};
    counts.forEach(c => { countMap[c.assignment_id] = c.turned_in_count; });
    res.json(assignments.map(a => ({ ...a, turned_in_count: countMap[a.id] || 0 })));
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// POST /api/classroom/tts  { text }
// Speaks AI Chat replies aloud in voice mode with a natural ElevenLabs voice
// instead of the browser's built-in (robotic) speech synthesis.
exports.textToSpeech = async (req, res) => {
  const text = (req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "text is required" });

  try {
    const audio = await elevenLabsTextToSpeech(text.slice(0, 5000));
    res.set("Content-Type", "audio/mpeg");
    res.send(audio);
  } catch (err) {
    if (err.code === "ELEVENLABS_NOT_CONFIGURED") {
      return res.status(503).json({ error: err.message, code: err.code });
    }
    res.status(502).json({ error: err.message, code: err.code });
  }
};

// GET /api/classroom/deadlines — next 5 undue assignments across every class
// this user teaches or is enrolled in. No single-class assignment endpoint
// covers this; the Dashboard's "Upcoming Events" widget needs a cross-class view.
exports.listUpcomingDeadlines = async (req, res) => {
  const userId = req.user.id;
  try {
    const [deadlines] = await pool.query(
      `SELECT a.id, a.title, a.due_date, c.id AS class_id, c.name AS class_name,
              sub.status AS my_status
       FROM assignments a
       JOIN classes c ON c.id = a.class_id
       LEFT JOIN submissions sub ON sub.assignment_id = a.id AND sub.student_id = ?
       WHERE a.is_draft = 0
         AND a.due_date IS NOT NULL
         AND a.due_date >= NOW()
         AND (c.teacher_id = ? OR c.id IN (SELECT class_id FROM class_members WHERE user_id = ?))
       ORDER BY a.due_date ASC
       LIMIT 5`,
      [userId, userId, userId]
    );
    res.json({ deadlines });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
