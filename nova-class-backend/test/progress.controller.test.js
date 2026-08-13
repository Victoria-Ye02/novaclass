const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../config/db");
const controller = require("../controllers/victoria/progress.controller");

const originalQuery = pool.query;

test.afterEach(() => {
  pool.query = originalQuery;
});

function httpDouble({ user = { id: 5 } } = {}) {
  const req = { user };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

test("summary includes to_grade_count: submissions awaiting grading across every class the user teaches", async () => {
  let capturedParams;
  pool.query = async (sql, params) => {
    if (sql.includes("classes_joined")) return [[{ classes_joined: 2 }]];
    if (sql.includes("classes_teaching")) return [[{ classes_teaching: 1 }]];
    if (sql.includes("questions_asked")) return [[{ questions_asked: 5 }]];
    if (sql.includes("materials_accessed")) return [[{ materials_accessed: 9 }]];
    if (sql.includes("to_grade_count") || sql.includes("submissions")) {
      capturedParams = params;
      return [[{ to_grade_count: 4 }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 5 } });
  await controller.summary(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.to_grade_count, 4);
  assert.deepEqual(capturedParams, [5]);
});

test("summary reports zero to_grade_count for a user who teaches nothing", async () => {
  pool.query = async (sql) => {
    if (sql.includes("classes_joined")) return [[{ classes_joined: 0 }]];
    if (sql.includes("classes_teaching")) return [[{ classes_teaching: 0 }]];
    if (sql.includes("questions_asked")) return [[{ questions_asked: 0 }]];
    if (sql.includes("materials_accessed")) return [[{ materials_accessed: 0 }]];
    if (sql.includes("to_grade_count") || sql.includes("submissions")) return [[{ to_grade_count: 0 }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 5 } });
  await controller.summary(req, res);

  assert.equal(res.body.to_grade_count, 0);
});
