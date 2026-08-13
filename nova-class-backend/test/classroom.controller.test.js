const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../config/db");
const originalQuery = pool.query;
const originalFetch = global.fetch;

const controllerPath = require.resolve("../controllers/victoria/classroom.controller");
const groqTextPath = require.resolve("../services/ai/groqText");
const pdfVisionPath = require.resolve("../services/ai/pdfVision");
const elevenLabsPath = require.resolve("../services/ai/elevenLabs");

function loadController(t, { completeText, ocrPdfPageText, elevenLabsTextToSpeech } = {}) {
  const originalGroqText = require.cache[groqTextPath];
  require.cache[groqTextPath] = {
    id: groqTextPath,
    filename: groqTextPath,
    loaded: true,
    exports: {
      completeText,
      askGroq: async () => { throw new Error("Unexpected askGroq call"); },
    },
  };

  const originalPdfVision = require.cache[pdfVisionPath];
  require.cache[pdfVisionPath] = {
    id: pdfVisionPath,
    filename: pdfVisionPath,
    loaded: true,
    exports: {
      ocrPdfPageText: ocrPdfPageText || (async () => { throw new Error("Unexpected ocrPdfPageText call"); }),
    },
  };

  const originalElevenLabs = require.cache[elevenLabsPath];
  require.cache[elevenLabsPath] = {
    id: elevenLabsPath,
    filename: elevenLabsPath,
    loaded: true,
    exports: {
      textToSpeech: elevenLabsTextToSpeech || (async () => { throw new Error("Unexpected textToSpeech call"); }),
    },
  };

  delete require.cache[controllerPath];

  const controller = require(controllerPath);
  t.after(() => {
    delete require.cache[controllerPath];
    if (originalGroqText) require.cache[groqTextPath] = originalGroqText;
    else delete require.cache[groqTextPath];
    if (originalPdfVision) require.cache[pdfVisionPath] = originalPdfVision;
    else delete require.cache[pdfVisionPath];
    if (originalElevenLabs) require.cache[elevenLabsPath] = originalElevenLabs;
    else delete require.cache[elevenLabsPath];
  });
  return controller;
}

function httpDouble({ user = { id: 2 }, params = {}, body = {}, files = {} } = {}) {
  const req = { user, params, body, files };
  const res = {
    statusCode: 200,
    body: undefined,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

test.afterEach(() => {
  pool.query = originalQuery;
  global.fetch = originalFetch;
});

test("assistant-mode chat sends a plain-assistant system prompt with the current page, not the quiz-tutor prompt", async (t) => {
  global.fetch = async () => { throw new Error("RAG unavailable in test"); };
  pool.query = async (sql) => {
    if (sql.includes("FROM materials")) {
      return [[{
        title: "JDBC와 응용 프로젝트 I",
        instructions: null,
        text_content: "2026-1학기 | JAVA프로그래밍실무 2th week JDBC와응용프로젝트I",
        summary_paragraph: null,
        summary_detailed: null,
      }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  let capturedMessages;
  const controller = loadController(t, {
    completeText: async (request) => {
      capturedMessages = request.messages;
      return { choices: [{ message: { content: "Sure, here's what page 2 covers." } }] };
    },
  });

  const { req, res } = httpDouble({
    params: { materialId: "9" },
    body: {
      action: "chat",
      mode: "assistant",
      message: "explain this page",
      history: [],
      currentPage: 2,
      totalPages: 41,
      lang: "en",
    },
  });

  await controller.materialAI(req, res);

  assert.equal(res.statusCode, 200);
  const systemMessage = capturedMessages.find((m) => m.role === "system").content;
  assert.match(systemMessage, /page 2 of 41/i);
  assert.doesNotMatch(systemMessage, /take initiative/i);
  assert.doesNotMatch(systemMessage, /Level Up AI Study Tutor/i);
});

test("assistant-mode chat instructs honesty when almost no text was extracted for the document", async (t) => {
  global.fetch = async () => { throw new Error("RAG unavailable in test"); };
  pool.query = async (sql) => {
    if (sql.includes("FROM materials")) {
      return [[{
        title: "JDBC와 응용 프로젝트 I",
        instructions: null,
        // 239 chars across 41 pages — far below any reasonable per-page average,
        // matching the real image-heavy slide deck that triggered this bug.
        text_content: "x".repeat(239),
        summary_paragraph: null,
        summary_detailed: null,
      }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  let capturedMessages;
  const controller = loadController(t, {
    completeText: async (request) => {
      capturedMessages = request.messages;
      return { choices: [{ message: { content: "..." } }] };
    },
  });

  const { req, res } = httpDouble({
    params: { materialId: "9" },
    body: {
      action: "chat",
      mode: "assistant",
      message: "explain this page",
      history: [],
      currentPage: 2,
      totalPages: 41,
      lang: "en",
    },
  });

  await controller.materialAI(req, res);

  const systemMessage = capturedMessages.find((m) => m.role === "system").content;
  assert.match(systemMessage, /can't read|cannot read|honestly/i);
  assert.match(systemMessage, /image-based/i);
});

// Matches the page-marker format written by extractPdfTextWithPageMarkers()
// at upload time: a form-feed-delimited "\f<<PAGE n>>\f" before each page's text.
function markedPdfText(pages) {
  return pages.map(({ page, text }) => `\f<<PAGE ${page}>>\f${text}`).join("\n\n");
}

test("assistant-mode chat gives the model the exact text of the page the student is viewing, not just its number", async (t) => {
  global.fetch = async () => { throw new Error("RAG unavailable in test"); };
  pool.query = async (sql) => {
    if (sql.includes("FROM materials")) {
      return [[{
        title: "Cell Biology",
        instructions: null,
        text_content: markedPdfText([
          { page: 1, text: "Introduction to the cell." },
          { page: 2, text: "The mitochondria is the powerhouse of the cell." },
          { page: 3, text: "Conclusion and summary." },
        ]),
        summary_paragraph: null,
        summary_detailed: null,
      }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  let capturedMessages;
  const controller = loadController(t, {
    completeText: async (request) => {
      capturedMessages = request.messages;
      return { choices: [{ message: { content: "..." } }] };
    },
  });

  const { req, res } = httpDouble({
    params: { materialId: "9" },
    body: {
      action: "chat", mode: "assistant", message: "what's on this page",
      history: [], currentPage: 2, totalPages: 3, lang: "en",
    },
  });

  await controller.materialAI(req, res);

  const systemMessage = capturedMessages.find((m) => m.role === "system").content;
  assert.match(systemMessage, /The mitochondria is the powerhouse of the cell\./);
  // Still whole-document aware, not just the current page in isolation.
  assert.match(systemMessage, /Introduction to the cell\./);
  assert.match(systemMessage, /Conclusion and summary\./);
});

test("assistant-mode chat honestly flags only the current page as unreadable when the rest of the document has real text", async (t) => {
  global.fetch = async () => { throw new Error("RAG unavailable in test"); };
  pool.query = async (sql) => {
    if (sql.includes("FROM materials")) {
      return [[{
        title: "Mixed Deck",
        instructions: null,
        text_content: markedPdfText([
          { page: 1, text: "A fully readable text page with plenty of real content here." },
          { page: 2, text: "" }, // image-only slide — nothing extracted
        ]),
        summary_paragraph: null,
        summary_detailed: null,
      }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  let capturedMessages;
  const controller = loadController(t, {
    completeText: async (request) => {
      capturedMessages = request.messages;
      return { choices: [{ message: { content: "..." } }] };
    },
  });

  const { req, res } = httpDouble({
    params: { materialId: "9" },
    body: {
      action: "chat", mode: "assistant", message: "what's on this page",
      history: [], currentPage: 2, totalPages: 2, lang: "en",
    },
  });

  await controller.materialAI(req, res);

  const systemMessage = capturedMessages.find((m) => m.role === "system").content;
  assert.match(systemMessage, /page 2.*(no extractable text|image-based)/is);
  // The document-wide sparse warning must NOT fire — most of the document has real text.
  assert.doesNotMatch(systemMessage, /most pages/i);
});

test("assistant-mode chat OCRs a page whose embedded text is unreadable and caches the result", async (t) => {
  global.fetch = async () => { throw new Error("RAG unavailable in test"); };
  const queries = [];
  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes("FROM materials")) {
      return [[{
        title: "Broken Font Deck",
        instructions: null,
        file_path: "1781843899651-596532.pdf",
        text_content: markedPdfText([
          { page: 1, text: "Title slide with real embedded text." },
          { page: 2, text: "" }, // font's ToUnicode mapping is broken — nothing extracted
        ]),
        summary_paragraph: null,
        summary_detailed: null,
      }]];
    }
    if (sql.startsWith("UPDATE materials")) return [{ affectedRows: 1 }];
    throw new Error(`Unexpected query: ${sql}`);
  };

  let capturedMessages;
  let ocrCalledWith;
  const controller = loadController(t, {
    completeText: async (request) => {
      capturedMessages = request.messages;
      return { choices: [{ message: { content: "..." } }] };
    },
    ocrPdfPageText: async (pdfPath, pageNumber) => {
      ocrCalledWith = { pdfPath, pageNumber };
      return "데이터베이스 시스템\n- 파일 시스템의 문제점을 해결한 시스템";
    },
  });

  const { req, res } = httpDouble({
    params: { materialId: "9" },
    body: {
      action: "chat", mode: "assistant", message: "what's on this page",
      history: [], currentPage: 2, totalPages: 2, lang: "en",
    },
  });

  await controller.materialAI(req, res);

  assert.equal(ocrCalledWith.pageNumber, 2);
  assert.match(ocrCalledWith.pdfPath, /1781843899651-596532\.pdf$/);

  const systemMessage = capturedMessages.find((m) => m.role === "system").content;
  assert.match(systemMessage, /데이터베이스 시스템/);
  // Must not fall back to the "can't read this page" honesty warning once OCR succeeded.
  assert.doesNotMatch(systemMessage, /no extractable text was found for page 2/i);

  // Cached back to the database so the next student's question skips the OCR round-trip.
  const update = queries.find(q => q.sql.startsWith("UPDATE materials"));
  assert.ok(update, "expected text_content to be cached back to the database");
  assert.match(update.params[0], /데이터베이스 시스템/);
  assert.equal(update.params[1], "9");
});

test("assistant-mode chat falls back to the honest 'can't read' message when OCR finds nothing", async (t) => {
  global.fetch = async () => { throw new Error("RAG unavailable in test"); };
  pool.query = async (sql) => {
    if (sql.includes("FROM materials")) {
      return [[{
        title: "Broken Font Deck",
        instructions: null,
        file_path: "1781843899651-596532.pdf",
        text_content: markedPdfText([
          { page: 1, text: "Title slide with real embedded text." },
          { page: 2, text: "" },
        ]),
        summary_paragraph: null,
        summary_detailed: null,
      }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  let capturedMessages;
  const controller = loadController(t, {
    completeText: async (request) => {
      capturedMessages = request.messages;
      return { choices: [{ message: { content: "..." } }] };
    },
    ocrPdfPageText: async () => null, // genuinely blank page, or the vision call failed
  });

  const { req, res } = httpDouble({
    params: { materialId: "9" },
    body: {
      action: "chat", mode: "assistant", message: "what's on this page",
      history: [], currentPage: 2, totalPages: 2, lang: "en",
    },
  });

  await controller.materialAI(req, res);

  const systemMessage = capturedMessages.find((m) => m.role === "system").content;
  assert.match(systemMessage, /page 2.*(no extractable text|image-based)/is);
});

test("assistant-mode chat instructs the model to stay scoped to this lesson's material and redirect unrelated questions", async (t) => {
  global.fetch = async () => { throw new Error("RAG unavailable in test"); };
  pool.query = async (sql) => {
    if (sql.includes("FROM materials")) {
      return [[{
        title: "JDBC와 응용 프로젝트 I",
        instructions: null,
        text_content: "2026-1학기 | JAVA프로그래밍실무 2th week JDBC와응용프로젝트I",
        summary_paragraph: null,
        summary_detailed: null,
      }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  let capturedMessages;
  const controller = loadController(t, {
    completeText: async (request) => {
      capturedMessages = request.messages;
      return { choices: [{ message: { content: "..." } }] };
    },
  });

  const { req, res } = httpDouble({
    params: { materialId: "9" },
    body: {
      action: "chat", mode: "assistant", message: "what's this page about",
      history: [], currentPage: 2, totalPages: 41, lang: "en",
    },
  });

  await controller.materialAI(req, res);

  const systemMessage = capturedMessages.find((m) => m.role === "system").content;
  assert.match(systemMessage, /only.*(this lesson|this material|this document)/i);
  assert.match(systemMessage, /unrelated/i);
});

test("omitting assistant mode preserves the existing Level Up quiz-tutor behavior", async (t) => {
  global.fetch = async () => { throw new Error("RAG unavailable in test"); };
  pool.query = async (sql) => {
    if (sql.includes("FROM materials")) {
      return [[{
        title: "JDBC와 응용 프로젝트 I",
        instructions: null,
        text_content: "Some material text.",
        summary_paragraph: null,
        summary_detailed: null,
      }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  let capturedMessages;
  const controller = loadController(t, {
    completeText: async (request) => {
      capturedMessages = request.messages;
      return { choices: [{ message: { content: "Let's begin! Question 1..." } }] };
    },
  });

  const { req, res } = httpDouble({
    params: { materialId: "9" },
    body: {
      action: "chat",
      message: "I'm ready",
      history: [],
      level: "intermediate",
      lang: "en",
    },
  });

  await controller.materialAI(req, res);

  const systemMessage = capturedMessages.find((m) => m.role === "system").content;
  assert.match(systemMessage, /Level Up AI Study Tutor/i);
  assert.match(systemMessage, /take initiative/i);
});

test("textToSpeech streams back the audio ElevenLabs generated for the given text", async (t) => {
  let capturedText;
  const controller = loadController(t, {
    elevenLabsTextToSpeech: async (text) => {
      capturedText = text;
      return Buffer.from("fake-mp3-bytes");
    },
  });

  const { req, res } = httpDouble({ body: { text: "The mitochondria is the powerhouse of the cell." } });
  await controller.textToSpeech(req, res);

  assert.equal(capturedText, "The mitochondria is the powerhouse of the cell.");
  assert.equal(res.headers["Content-Type"], "audio/mpeg");
  assert.ok(Buffer.isBuffer(res.body));
  assert.equal(res.body.toString(), "fake-mp3-bytes");
});

test("textToSpeech rejects an empty request without calling ElevenLabs", async (t) => {
  let called = false;
  const controller = loadController(t, {
    elevenLabsTextToSpeech: async () => { called = true; return Buffer.from(""); },
  });

  const { req, res } = httpDouble({ body: { text: "   " } });
  await controller.textToSpeech(req, res);

  assert.equal(called, false);
  assert.equal(res.statusCode, 400);
});

test("textToSpeech reports 503 with a clear message when ElevenLabs isn't configured", async (t) => {
  const controller = loadController(t, {
    elevenLabsTextToSpeech: async () => {
      const error = new Error("ElevenLabs is not configured (ELEVENLABS_API_KEY is unset)");
      error.code = "ELEVENLABS_NOT_CONFIGURED";
      throw error;
    },
  });

  const { req, res } = httpDouble({ body: { text: "hello" } });
  await controller.textToSpeech(req, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, "ELEVENLABS_NOT_CONFIGURED");
});

test("listUpcomingDeadlines returns undue assignments across every class this user teaches or is enrolled in, soonest first", async (t) => {
  let capturedParams;
  pool.query = async (sql, params) => {
    capturedParams = params;
    return [[
      { id: 1, title: "Essay 1", due_date: "2026-08-15T00:00:00Z", class_id: 3, class_name: "html", my_status: null },
      { id: 2, title: "Quiz 2", due_date: "2026-08-20T00:00:00Z", class_id: 5, class_name: "java", my_status: "turned_in" },
    ]];
  };

  const controller = loadController(t, {});
  const { req, res } = httpDouble({ user: { id: 27 } });
  await controller.listUpcomingDeadlines(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.deadlines.length, 2);
  assert.equal(res.body.deadlines[0].title, "Essay 1");
  assert.ok(capturedParams.includes(27));
});

test("listUpcomingDeadlines returns an empty array when nothing is due", async (t) => {
  pool.query = async () => [[]];

  const controller = loadController(t, {});
  const { req, res } = httpDouble({ user: { id: 27 } });
  await controller.listUpcomingDeadlines(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.deadlines, []);
});

test("listClasses includes real material_count and assignment_count per class, for both taught and enrolled classes", async (t) => {
  const queries = [];
  pool.query = async (sql, params) => {
    queries.push(sql);
    if (sql.includes("teacher_id = ?")) {
      return [[{ id: 1, name: "html", subject: "CS", code: "ABC123", my_role: "teacher", teacher_name: "Vic", student_count: 5, material_count: 3, assignment_count: 2 }]];
    }
    return [[{ id: 2, name: "java", subject: "CS", code: "XYZ789", my_role: "student", teacher_name: "Someone", student_count: 10, material_count: 7, assignment_count: 4 }]];
  };

  const controller = loadController(t, {});
  const { req, res } = httpDouble({ user: { id: 27 } });
  await controller.listClasses(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body[0].material_count, 3);
  assert.equal(res.body[0].assignment_count, 2);
  assert.equal(res.body[1].material_count, 7);
  assert.equal(res.body[1].assignment_count, 4);
  assert.ok(queries.every(sql => sql.includes("material_count") && sql.includes("assignment_count")));
});

test("uploadMaterial stores every uploaded file, not just the primary document, as separate attachments", async (t) => {
  const classId = 9, userId = 2;
  const materialFileInserts = [];
  let materialsInsertParams;
  pool.query = async (sql, params) => {
    if (sql.includes("FROM classes")) return [[{ id: classId, teacher_id: userId }]];
    if (sql.startsWith("INSERT INTO materials")) { materialsInsertParams = params; return [{ insertId: 55 }]; }
    if (sql.startsWith("INSERT INTO material_files")) { materialFileInserts.push(params); return [{}]; }
    if (sql.startsWith("INSERT INTO class_posts")) return [{}];
    if (sql.includes("FROM material_files")) {
      return [[
        { id: 1, material_id: 55, file_name: "handout.pdf", file_path: "extra1-abc.pdf" },
        { id: 2, material_id: 55, file_name: "notes.docx", file_path: "extra2-def.docx" },
      ]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const controller = loadController(t, {});
  const { req, res } = httpDouble({
    user: { id: userId },
    params: { id: classId },
    body: { title: "Week 1 slides" },
    files: {
      file: [{ filename: "primary-123.png", originalname: "slides.png", mimetype: "image/png", path: "uploads/primary-123.png" }],
      files: [
        { filename: "extra1-abc.pdf", originalname: "handout.pdf", mimetype: "application/pdf", path: "uploads/extra1-abc.pdf" },
        { filename: "extra2-def.docx", originalname: "notes.docx", mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", path: "uploads/extra2-def.docx" },
      ],
    },
  });
  await controller.uploadMaterial(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(materialsInsertParams[4], "primary-123.png");
  assert.equal(materialFileInserts.length, 2);
  assert.deepEqual(materialFileInserts[0], [55, "handout.pdf", "extra1-abc.pdf"]);
  assert.deepEqual(materialFileInserts[1], [55, "notes.docx", "extra2-def.docx"]);
  assert.equal(res.body.files.length, 2);
});

test("uploadMaterial accepts supplementary attachments even with no primary document", async (t) => {
  const classId = 9, userId = 2;
  const materialFileInserts = [];
  pool.query = async (sql, params) => {
    if (sql.includes("FROM classes")) return [[{ id: classId, teacher_id: userId }]];
    if (sql.startsWith("INSERT INTO materials")) return [{ insertId: 56 }];
    if (sql.startsWith("INSERT INTO material_files")) { materialFileInserts.push(params); return [{}]; }
    if (sql.startsWith("INSERT INTO class_posts")) return [{}];
    if (sql.includes("FROM material_files")) return [[{ id: 3, material_id: 56, file_name: "reading.pdf", file_path: "extra-xyz.pdf" }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const controller = loadController(t, {});
  const { req, res } = httpDouble({
    user: { id: userId },
    params: { id: classId },
    body: { title: "Text-only lesson" },
    files: { files: [{ filename: "extra-xyz.pdf", originalname: "reading.pdf", mimetype: "application/pdf", path: "uploads/extra-xyz.pdf" }] },
  });
  await controller.uploadMaterial(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.file_url, null);
  assert.equal(materialFileInserts.length, 1);
  assert.equal(res.body.files.length, 1);
});

test("updateMaterial keeps existing attachments by default when editing", async (t) => {
  const classId = 9, userId = 2, materialId = 55;
  const deleteCalls = [];
  pool.query = async (sql, params) => {
    if (sql.startsWith("SELECT * FROM materials")) {
      return [[{ id: materialId, class_id: classId, title: "Week 1", instructions: null, week: 1, file_path: "primary-123.png", text_content: null, ai_resources: null }]];
    }
    if (sql.includes("FROM classes")) return [[{ id: classId, teacher_id: userId }]];
    if (sql.startsWith("UPDATE materials")) return [{}];
    if (sql.startsWith("DELETE FROM material_files")) { deleteCalls.push(params); return [{}]; }
    if (sql.includes("FROM material_files")) {
      return [[{ id: 1, material_id: materialId, file_name: "handout.pdf", file_path: "extra1-abc.pdf" }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const controller = loadController(t, {});
  const { req, res } = httpDouble({
    user: { id: userId },
    params: { id: materialId },
    body: { title: "Week 1 (updated)" },
  });
  await controller.updateMaterial(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(deleteCalls.length, 0);
  assert.equal(res.body.files.length, 1);
  assert.equal(res.body.files[0].file_name, "handout.pdf");
});

test("updateMaterial deletes only the attachments explicitly listed in delete_file_ids", async (t) => {
  const classId = 9, userId = 2, materialId = 55;
  const deleteCalls = [];
  const insertCalls = [];
  pool.query = async (sql, params) => {
    if (sql.startsWith("SELECT * FROM materials")) {
      return [[{ id: materialId, class_id: classId, title: "Week 1", instructions: null, week: 1, file_path: "primary-123.png", text_content: null, ai_resources: null }]];
    }
    if (sql.includes("FROM classes")) return [[{ id: classId, teacher_id: userId }]];
    if (sql.startsWith("UPDATE materials")) return [{}];
    if (sql.startsWith("DELETE FROM material_files")) { deleteCalls.push(params); return [{}]; }
    if (sql.startsWith("INSERT INTO material_files")) { insertCalls.push(params); return [{}]; }
    if (sql.includes("FROM material_files")) return [[{ id: 2, material_id: materialId, file_name: "new.pdf", file_path: "new-1.pdf" }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const controller = loadController(t, {});
  const { req, res } = httpDouble({
    user: { id: userId },
    params: { id: materialId },
    body: { title: "Week 1", delete_file_ids: JSON.stringify([1]) },
    files: { files: [{ filename: "new-1.pdf", originalname: "new.pdf", mimetype: "application/pdf", path: "uploads/new-1.pdf" }] },
  });
  await controller.updateMaterial(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(deleteCalls[0], [[1], materialId]);
  assert.deepEqual(insertCalls[0], [materialId, "new.pdf", "new-1.pdf"]);
});

test("listMaterials includes each material's supplementary attachments", async (t) => {
  const classId = 9, userId = 2;
  pool.query = async (sql, params) => {
    if (sql.includes("FROM classes")) return [[{ id: classId, teacher_id: userId }]];
    if (sql.includes("FROM materials m")) {
      return [[{ id: 55, title: "Week 1", instructions: null, week: 1, file_path: "primary-123.png", created_at: "2026-08-01", ai_resources: null, summary: null }]];
    }
    if (sql.includes("FROM material_files")) {
      return [[{ id: 1, material_id: 55, file_name: "handout.pdf", file_path: "extra1-abc.pdf" }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const controller = loadController(t, {});
  const { req, res } = httpDouble({ user: { id: userId }, params: { id: classId } });
  await controller.listMaterials(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body[0].files.length, 1);
  assert.equal(res.body[0].files[0].file_name, "handout.pdf");
});

test("getMaterial includes the material's supplementary attachments", async (t) => {
  const classId = 9, userId = 2, materialId = 55;
  pool.query = async (sql, params) => {
    if (sql.startsWith("SELECT id, class_id")) return [[{ id: materialId, class_id: classId, title: "Week 1", instructions: null, week: 1, file_path: "primary-123.png", created_at: "2026-08-01" }]];
    if (sql.includes("FROM classes")) return [[{ id: classId, teacher_id: userId }]];
    if (sql.includes("FROM material_files")) return [[{ id: 1, material_id: materialId, file_name: "handout.pdf", file_path: "extra1-abc.pdf" }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const controller = loadController(t, {});
  const { req, res } = httpDouble({ user: { id: userId }, params: { materialId } });
  await controller.getMaterial(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.files.length, 1);
  assert.equal(res.body.files[0].file_name, "handout.pdf");
});
