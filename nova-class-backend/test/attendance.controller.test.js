const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../config/db");
const controller = require("../controllers/victoria/attendance.controller");

const originalQuery = pool.query;

test.afterEach(() => {
  pool.query = originalQuery;
});

function httpDouble({ user = { id: 5 }, params = {} } = {}) {
  const req = { user, params };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

test("getMyMonthlyAttendance computes a rate from this month's present/late/absent counts across every class", async () => {
  let capturedParams;
  pool.query = async (sql, params) => {
    capturedParams = params;
    return [[{ total: 50, present: 46, late: 2, absent: 2 }]];
  };

  const { req, res } = httpDouble({ user: { id: 5 } });
  await controller.getMyMonthlyAttendance(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.total, 50);
  assert.equal(res.body.present, 46);
  assert.equal(res.body.late, 2);
  assert.equal(res.body.absent, 2);
  assert.equal(res.body.rate, 96); // round((46+2)/50*100)
  assert.deepEqual(capturedParams, [5]);
});

test("getMyMonthlyAttendance returns a null rate instead of dividing by zero when there are no sessions yet", async () => {
  pool.query = async () => [[{ total: 0, present: 0, late: 0, absent: 0 }]];

  const { req, res } = httpDouble({ user: { id: 5 } });
  await controller.getMyMonthlyAttendance(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.rate, null);
});
