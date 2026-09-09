const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../config/db");
const originalQuery = pool.query;
const originalFetch = global.fetch;
const originalKmateAiUrl = process.env.KMATE_AI_URL;
const controller = require("../controllers/victoria/kmate.controller");

function httpDouble({ user = { id: 5 }, body = {} } = {}) {
  const req = { user, body };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

test.afterEach(() => {
  pool.query = originalQuery;
  global.fetch = originalFetch;
  if (originalKmateAiUrl === undefined) delete process.env.KMATE_AI_URL;
  else process.env.KMATE_AI_URL = originalKmateAiUrl;
});

test("ask proxies the question to the K.MATE AI service and saves the answer to history", async () => {
  process.env.KMATE_AI_URL = "http://localhost:8082";
  let requestedUrl, requestedBody;
  global.fetch = async (url, options) => {
    requestedUrl = url;
    requestedBody = JSON.parse(options.body);
    return { ok: true, json: async () => ({ answer: "TOPIK stands for Test of Proficiency in Korean." }) };
  };
  let savedQuery, savedParams;
  pool.query = async (sql, params) => {
    savedQuery = sql;
    savedParams = params;
    return [{}];
  };

  const { req, res } = httpDouble({ body: { question: "What is TOPIK?" } });
  await controller.ask(req, res);

  assert.equal(requestedUrl, "http://localhost:8082/ask");
  assert.deepEqual(requestedBody, { question: "What is TOPIK?" });
  assert.match(savedQuery, /INSERT INTO kmate_history/);
  assert.deepEqual(savedParams, [5, "What is TOPIK?", "TOPIK stands for Test of Proficiency in Korean."]);
  assert.deepEqual(res.body, { answer: "TOPIK stands for Test of Proficiency in Korean." });
});

test("ask rejects a request with no question, without calling the AI service", async () => {
  global.fetch = async () => { throw new Error("fetch should not be called"); };

  const { req, res } = httpDouble({ body: {} });
  await controller.ask(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "question is required" });
});

test("ask reports 502 when the K.MATE AI service is unreachable or errors", async () => {
  global.fetch = async () => ({ ok: false, status: 500, text: async () => "internal error" });

  const { req, res } = httpDouble({ body: { question: "What is TOPIK?" } });
  await controller.ask(req, res);

  assert.equal(res.statusCode, 502);
  assert.match(res.body.error, /K.MATE AI service request failed: 500/);
});
