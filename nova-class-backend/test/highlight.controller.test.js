const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const pool = require("../config/db");
const controller = require("../controllers/victoria/highlight.controller");
const analyzer = require("../services/highlights/analyze");
const ocr = require("../services/ai/googleVisionOcr");

const originalQuery = pool.query;
const originalStat = fs.promises.stat;
const originalAnalyzeHighlights = analyzer.analyzeHighlights;
const originalOcrPage = ocr.ocrPage;

const FILE = "stored-notes.pdf";
const FILE_STAT = { size: 4096, mtimeMs: 1721600000123 };
const FINGERPRINT = crypto
  .createHash("sha256")
  .update(JSON.stringify([FILE, FILE_STAT.size, FILE_STAT.mtimeMs]))
  .digest("hex");

function httpDouble({ user = { id: 2 }, params = {}, body = {}, file } = {}) {
  const req = { user, params, body, file };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return { req, res };
}

function installFileStat() {
  fs.promises.stat = async filePath => {
    assert.equal(path.basename(filePath), FILE);
    return FILE_STAT;
  };
}

function materialAccessQuery({ teacherId = 2, member = true } = {}) {
  return async (sql, params) => {
    if (sql.includes("FROM materials")) {
      assert.deepEqual(params, [9]);
      return [[{ id: 9, class_id: 4, file_path: FILE }]];
    }
    if (sql.includes("FROM classes")) {
      assert.deepEqual(params, [4]);
      return [[{ teacher_id: teacherId }]];
    }
    if (sql.includes("FROM class_members")) {
      assert.deepEqual(params, [4, 2]);
      return [member ? [{ allowed: 1 }] : []];
    }
    return null;
  };
}

async function flushBackgroundWork() {
  await new Promise(resolve => setImmediate(resolve));
}

test.afterEach(() => {
  pool.query = originalQuery;
  fs.promises.stat = originalStat;
  analyzer.analyzeHighlights = originalAnalyzeHighlights;
  ocr.ocrPage = originalOcrPage;
});

test("getHighlights denies a user who cannot access the material's class", async () => {
  const accessQuery = materialAccessQuery({ teacherId: 8, member: false });
  pool.query = async (sql, params) => {
    const result = await accessQuery(sql, params);
    if (result) return result;
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ params: { materialId: "9" } });
  await controller.getHighlights(req, res);

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: "Not a member of this class" });
});

test("two starts reuse the same material fingerprint and analysis ID", async () => {
  installFileStat();
  const accessQuery = materialAccessQuery();
  let insertCalls = 0;

  pool.query = async (sql, params) => {
    const access = await accessQuery(sql, params);
    if (access) return access;
    if (sql.includes("failure_code = 'stale_processing'")) {
      assert.deepEqual(params, [9, FINGERPRINT, 1]);
      return [{ affectedRows: 0 }];
    }
    if (sql.includes("INSERT INTO material_highlight_analyses")) {
      insertCalls += 1;
      assert.deepEqual(params, [9, FINGERPRINT, 1, 12]);
      return [{ insertId: 31, affectedRows: insertCalls === 1 ? 1 : 0 }];
    }
    if (sql.includes("FROM material_highlight_analyses")) {
      assert.deepEqual(params, [9, FINGERPRINT, 1]);
      return [[{ id: 31, status: "pending", total_pages: 12, completed_pages: 0 }]];
    }
    if (sql.includes("FROM material_highlight_pages")) {
      assert.deepEqual(params, [31]);
      return [[{ page_number: 2 }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const first = httpDouble({ params: { materialId: "9" }, body: { totalPages: 12 } });
  const second = httpDouble({ params: { materialId: "9" }, body: { totalPages: 12 } });
  await controller.startHighlights(first.req, first.res);
  await controller.startHighlights(second.req, second.res);

  const expected = {
    analysisId: 31,
    status: "pending",
    progress: { completedPages: 0, totalPages: 12 },
    submittedPages: [2],
  };
  assert.deepEqual(first.res.body, expected);
  assert.deepEqual(second.res.body, expected);
  assert.equal(insertCalls, 2);
});

test("ready GET returns normalized rectangles grouped by outer PDF page", async () => {
  installFileStat();
  const accessQuery = materialAccessQuery();
  pool.query = async (sql, params) => {
    const access = await accessQuery(sql, params);
    if (access) return access;
    if (sql.includes("FROM material_highlight_analyses")) {
      assert.deepEqual(params, [9, FINGERPRINT, 1]);
      return [[{ id: 41, status: "ready", total_pages: 2, completed_pages: 2 }]];
    }
    if (sql.includes("FROM material_highlight_pages")) {
      assert.deepEqual(params, [41]);
      return [[{ page_number: 1 }, { page_number: 2 }]];
    }
    if (sql.includes("FROM material_pdf_highlights")) {
      assert.deepEqual(params, [41]);
      return [[
        {
          id: 5,
          page_number: 2,
          excerpt: "Key idea",
          explanation: "Core concept",
          category: "concept",
          rects_json: JSON.stringify([{ x: 0.1, y: 0.2, width: 0.4, height: 0.05 }]),
        },
        {
          id: 6,
          page_number: 2,
          excerpt: "Conclusion",
          explanation: null,
          category: "conclusion",
          rects_json: JSON.stringify([{ x: 0.2, y: 0.8, width: 0.3, height: 0.04 }]),
        },
      ]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ params: { materialId: "9" } });
  await controller.getHighlights(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    status: "ready",
    progress: { completedPages: 2, totalPages: 2 },
    submittedPages: [1, 2],
    highlights: {
      2: [
        {
          id: 5,
          excerpt: "Key idea",
          explanation: "Core concept",
          category: "concept",
          rects: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.05 }],
        },
        {
          id: 6,
          excerpt: "Conclusion",
          explanation: null,
          category: "conclusion",
          rects: [{ x: 0.2, y: 0.8, width: 0.3, height: 0.04 }],
        },
      ],
    },
  });
});

test("page submission rejects invalid candidate JSON without storing a page", async () => {
  installFileStat();
  const accessQuery = materialAccessQuery();
  let insertCalls = 0;
  pool.query = async (sql, params) => {
    const access = await accessQuery(sql, params);
    if (access) return access;
    if (sql.includes("FROM material_highlight_analyses")) {
      assert.deepEqual(params, [51, 9, FINGERPRINT, 1]);
      return [[{ id: 51, total_pages: 8, status: "pending" }]];
    }
    if (sql.includes("INSERT INTO material_highlight_pages")) {
      insertCalls += 1;
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({
    params: { materialId: "9" },
    body: { analysisId: "51", pageNumber: "3", sourceType: "text", candidates: "not-json" },
  });
  await controller.submitHighlightPage(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "Invalid candidates payload" });
  assert.equal(insertCalls, 0);
});

test("scan submission sends only the in-memory buffer to OCR and stores the outer page number", async () => {
  installFileStat();
  const accessQuery = materialAccessQuery();
  const image = Buffer.from("page image bytes");
  let ocrInput;
  let storedCandidates;

  ocr.ocrPage = async buffer => {
    ocrInput = buffer;
    return [{
      id: "ocr-p1-i0",
      text: "Scanned key idea",
      rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
    }];
  };
  pool.query = async (sql, params) => {
    const access = await accessQuery(sql, params);
    if (access) return access;
    if (sql.includes("FROM material_highlight_analyses")) {
      assert.deepEqual(params, [52, 9, FINGERPRINT, 1]);
      return [[{ id: 52, total_pages: 8, status: "pending" }]];
    }
    if (sql.includes("INSERT INTO material_highlight_pages")) {
      assert.deepEqual(params.slice(0, 3), [52, 7, "ocr"]);
      storedCandidates = JSON.parse(params[3]);
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({
    params: { materialId: "9" },
    body: { analysisId: "52", pageNumber: "7", sourceType: "ocr", candidates: "[]" },
    file: { buffer: image, mimetype: "image/png", size: image.length },
  });
  await controller.submitHighlightPage(req, res);

  assert.equal(ocrInput, image);
  assert.equal(req.file.path, undefined);
  assert.deepEqual(storedCandidates, [{
    id: "ocr-p1-i0",
    text: "Scanned key idea",
    rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.04 },
    pageNumber: 7,
  }]);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, {
    analysisId: 52,
    pageNumber: 7,
    sourceType: "ocr",
    candidateCount: 1,
  });
});

test("concurrent complete calls conditionally claim only one pending analysis", async () => {
  installFileStat();
  const accessQuery = materialAccessQuery();
  let claimed = false;
  let analyzeCalls = 0;
  analyzer.analyzeHighlights = async (analysisId, options) => {
    assert.equal(analysisId, 61);
    assert.equal(options.expectedAttemptCount, 5);
    analyzeCalls += 1;
  };

  pool.query = async (sql, params) => {
    const access = await accessQuery(sql, params);
    if (access) return access;
    if (sql.includes("FROM material_highlight_analyses")) {
      assert.deepEqual(params, [61, 9, FINGERPRINT, 1]);
      return [[{
        id: 61,
        status: claimed ? "processing" : "pending",
        total_pages: 2,
        completed_pages: 0,
        attempt_count: 4,
      }]];
    }
    if (sql.includes("COUNT(*) AS submitted_pages")) {
      assert.deepEqual(params, [61]);
      return [[{ submitted_pages: 2 }]];
    }
    if (sql.includes("failure_code = 'stale_processing'")) return [{ affectedRows: 0 }];
    if (sql.includes("status IN ('pending','failed')")) {
      assert.deepEqual(params, [61]);
      if (claimed) return [{ affectedRows: 0 }];
      claimed = true;
      return [{ affectedRows: 1 }];
    }
    if (sql.includes("SELECT attempt_count")) return [[{ attempt_count: 5 }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const first = httpDouble({ params: { materialId: "9" }, body: { analysisId: 61 } });
  const second = httpDouble({ params: { materialId: "9" }, body: { analysisId: 61 } });
  await Promise.all([
    controller.completeHighlights(first.req, first.res),
    controller.completeHighlights(second.req, second.res),
  ]);
  await flushBackgroundWork();

  assert.equal(analyzeCalls, 1);
  assert.equal(first.res.statusCode, 202);
  assert.equal(second.res.statusCode, 202);
  assert.equal(first.res.body.status, "processing");
  assert.equal(second.res.body.status, "processing");
});

test("retry recovers a processing analysis untouched for five minutes", async () => {
  installFileStat();
  const accessQuery = materialAccessQuery();
  let staleRecovered = false;
  let analyzeCalls = 0;
  analyzer.analyzeHighlights = async () => { analyzeCalls += 1; };

  pool.query = async (sql, params) => {
    const access = await accessQuery(sql, params);
    if (access) return access;
    if (sql.includes("failure_code = 'stale_processing'")) {
      assert.match(sql, /DATE_SUB\(NOW\(\), INTERVAL 5 MINUTE\)/);
      assert.deepEqual(params, [9, FINGERPRINT, 1]);
      staleRecovered = true;
      return [{ affectedRows: 1 }];
    }
    if (sql.includes("FROM material_highlight_analyses")) {
      assert.ok(staleRecovered);
      assert.deepEqual(params, [9, FINGERPRINT, 1]);
      return [[{ id: 71, status: "failed", total_pages: 3, completed_pages: 1 }]];
    }
    if (sql.includes("COUNT(*) AS submitted_pages")) return [[{ submitted_pages: 3 }]];
    if (sql.includes("status IN ('pending','failed')")) {
      assert.deepEqual(params, [71]);
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ params: { materialId: "9" } });
  await controller.retryHighlights(req, res);
  await flushBackgroundWork();

  assert.equal(analyzeCalls, 1);
  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, {
    analysisId: 71,
    status: "processing",
    progress: { completedPages: 1, totalPages: 3 },
  });
});

test("retry resumes failed analysis without deleting submitted page data", async () => {
  installFileStat();
  const accessQuery = materialAccessQuery();
  let analyzeCalls = 0;
  let deletedPages = false;
  analyzer.analyzeHighlights = async () => { analyzeCalls += 1; };
  pool.query = async (sql, params) => {
    const access = await accessQuery(sql, params);
    if (access) return access;
    if (sql.includes("failure_code = 'stale_processing'")) return [{ affectedRows: 0 }];
    if (sql.includes("FROM material_highlight_analyses")) {
      assert.deepEqual(params, [9, FINGERPRINT, 1]);
      return [[{ id: 72, status: "failed", total_pages: 4, completed_pages: 2 }]];
    }
    if (sql.includes("COUNT(*) AS submitted_pages")) return [[{ submitted_pages: 4 }]];
    if (sql.includes("DELETE FROM material_highlight_pages")) {
      deletedPages = true;
      return [{ affectedRows: 4 }];
    }
    if (sql.includes("status IN ('pending','failed')")) {
      assert.deepEqual(params, [72]);
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ params: { materialId: "9" } });
  await controller.retryHighlights(req, res);
  await flushBackgroundWork();

  assert.equal(analyzeCalls, 1);
  assert.equal(deletedPages, false);
  assert.equal(res.body.status, "processing");
});

test("background provider failures are recorded with a safe code and never returned", async () => {
  installFileStat();
  const accessQuery = materialAccessQuery();
  const secretError = "provider rejected private document text";
  let failureUpdate;
  analyzer.analyzeHighlights = async () => { throw new Error(secretError); };

  pool.query = async (sql, params) => {
    const access = await accessQuery(sql, params);
    if (access) return access;
    if (sql.includes("FROM material_highlight_analyses")) {
      return [[{ id: 73, status: "pending", total_pages: 1, completed_pages: 0 }]];
    }
    if (sql.includes("COUNT(*) AS submitted_pages")) return [[{ submitted_pages: 1 }]];
    if (sql.includes("failure_code = 'stale_processing'")) return [{ affectedRows: 0 }];
    if (sql.includes("status IN ('pending','failed')")) return [{ affectedRows: 1 }];
    if (sql.includes("failure_code = 'analysis_failed'")) {
      failureUpdate = { sql, params };
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({
    params: { materialId: "9" },
    body: { analysisId: 73 },
  });
  await controller.completeHighlights(req, res);
  await flushBackgroundWork();

  assert.deepEqual(failureUpdate.params, [73, 1]);
  assert.doesNotMatch(JSON.stringify(res.body), /provider|private document/i);
  assert.deepEqual(res.body, { analysisId: 73, status: "processing" });
});

test("analysis selects only page-local candidate IDs and persists each batch transactionally", async () => {
  const events = [];
  const inserts = [];
  let completionRequest;
  const pages = [
    {
      page_number: 1,
      candidates_json: JSON.stringify([
        { id: "same", pageNumber: 1, text: "Key", rect: { x: 0.1, y: 0.2, width: 0.1, height: 0.05 } },
        { id: "next", pageNumber: 1, text: "idea", rect: { x: 0.2, y: 0.2, width: 0.1, height: 0.05 } },
      ]),
    },
    {
      page_number: 2,
      candidates_json: JSON.stringify([
        { id: "same", pageNumber: 2, text: "Conclusion", rect: { x: 0.2, y: 0.8, width: 0.3, height: 0.04 } },
      ]),
    },
  ];

  const connection = {
    async beginTransaction() { events.push("begin"); },
    async query(sql, params) {
      if (sql.includes("DELETE FROM material_pdf_highlights")) {
        events.push("delete");
        assert.deepEqual(params, [88, 1, 2]);
        return [{ affectedRows: 0 }];
      }
      if (sql.includes("INSERT INTO material_pdf_highlights")) {
        events.push("insert");
        inserts.push(params);
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("SET completed_pages")) {
        events.push("progress");
        assert.deepEqual(params, [2, 88, 4]);
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected transaction query: ${sql}`);
    },
    async commit() { events.push("commit"); },
    async rollback() { events.push("rollback"); },
    release() { events.push("release"); },
  };
  const db = {
    async query(sql, params) {
      if (sql.includes("FROM material_highlight_analyses")) {
        assert.deepEqual(params, [88]);
        return [[{
          id: 88,
          status: "processing",
          total_pages: 2,
          completed_pages: 0,
          attempt_count: 4,
        }]];
      }
      if (sql.includes("COUNT(*) AS submitted_pages")) {
        assert.deepEqual(params, [88]);
        return [[{ submitted_pages: 2, first_page: 1, last_page: 2 }]];
      }
      if (sql.includes("FROM material_highlight_pages")) {
        assert.deepEqual(params, [88, 0]);
        return [pages];
      }
      if (sql.includes("SET status = 'ready'")) {
        assert.deepEqual(params, [88, 2, 4]);
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    async getConnection() { return connection; },
  };

  await analyzer.analyzeHighlights(88, {
    db,
    expectedAttemptCount: 4,
    retryBaseDelayMs: 0,
    completeText: async request => {
      completionRequest = request;
      return {
        choices: [{
          message: {
            content: JSON.stringify({
              highlights: [
                {
                  pageNumber: 1,
                  candidateIds: ["same", "next", "unknown"],
                  explanation: "Core idea",
                  category: "concept",
                },
                {
                  pageNumber: 2,
                  candidateIds: ["same"],
                  explanation: "Final result",
                  category: "conclusion",
                },
              ],
            }),
          },
        }],
      };
    },
  });

  assert.equal(completionRequest.responseFormat.type, "json_schema");
  assert.match(completionRequest.messages[1].content, /"pageNumber":1/);
  assert.match(completionRequest.messages[1].content, /"pageNumber":2/);
  assert.equal(inserts.length, 2);
  assert.deepEqual(inserts[0], [
    88,
    1,
    "Key idea",
    "Core idea",
    "concept",
    JSON.stringify([{ x: 0.1, y: 0.2, width: 0.20000000000000004, height: 0.04999999999999999 }]),
    0,
  ]);
  assert.deepEqual(inserts[1], [
    88,
    2,
    "Conclusion",
    "Final result",
    "conclusion",
    JSON.stringify([{ x: 0.2, y: 0.8, width: 0.3, height: 0.04 }]),
    0,
  ]);
  assert.deepEqual(events, ["begin", "delete", "insert", "insert", "progress", "commit", "release"]);
});

test("a stale worker attempt exits before provider calls or persistence", async () => {
  let providerCalls = 0;
  let connectionCalls = 0;
  const db = {
    async query(sql, params) {
      if (sql.includes("FROM material_highlight_analyses")) {
        assert.deepEqual(params, [99]);
        return [[{
          id: 99,
          status: "processing",
          total_pages: 1,
          completed_pages: 0,
          attempt_count: 3,
        }]];
      }
      throw new Error(`Stale worker continued with query: ${sql}`);
    },
    async getConnection() {
      connectionCalls += 1;
      throw new Error("Stale worker opened a transaction");
    },
  };

  await analyzer.analyzeHighlights(99, {
    db,
    expectedAttemptCount: 2,
    retryBaseDelayMs: 0,
    completeText: async () => {
      providerCalls += 1;
      throw new Error("Stale worker called the provider");
    },
  });

  assert.equal(providerCalls, 0);
  assert.equal(connectionCalls, 0);
});

test("highlight routes use authentication and only the page image route uses bounded memory upload", () => {
  const routes = fs.readFileSync(
    path.join(__dirname, "../routes/victoria/classroom.routes.js"),
    "utf8"
  );
  const uploadSource = fs.readFileSync(path.join(__dirname, "../middleware/upload.js"), "utf8");

  assert.match(routes, /router\.get\("\/materials\/:materialId\/highlights",\s*auth,\s*highlights\.getHighlights\)/);
  assert.match(routes, /router\.post\("\/materials\/:materialId\/highlights\/start",\s*auth,\s*highlights\.startHighlights\)/);
  assert.match(routes, /router\.post\("\/materials\/:materialId\/highlights\/pages",\s*auth,\s*upload\.highlightPageImage\.single\("image"\),\s*highlights\.submitHighlightPage\)/);
  assert.match(routes, /router\.post\("\/materials\/:materialId\/highlights\/complete",\s*auth,\s*highlights\.completeHighlights\)/);
  assert.match(routes, /router\.post\("\/materials\/:materialId\/highlights\/retry",\s*auth,\s*highlights\.retryHighlights\)/);
  assert.ok(routes.indexOf("/highlights") < routes.indexOf("/materials/:materialId/file"));
  assert.match(uploadSource, /memoryStorage\(\)/);
  assert.match(uploadSource, /fileSize:\s*8 \* 1024 \* 1024/);
  assert.match(uploadSource, /\["image\/png", "image\/jpeg"\]\.includes\(file\.mimetype\)/);
});
