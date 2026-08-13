const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../config/db");
const controller = require("../controllers/victoria/notification.controller");

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

test("list returns the current user's most recent notifications, newest first", async () => {
  let capturedParams;
  pool.query = async (sql, params) => {
    capturedParams = params;
    return [[{ id: 1, type: "assignment_created", title: "New assignment", is_read: 0, created_at: "2026-08-12T10:00:00Z" }]];
  };

  const { req, res } = httpDouble({ user: { id: 5 } });
  await controller.list(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.notifications.length, 1);
  assert.deepEqual(capturedParams, [5]);
});

test("unreadCount returns the number of unread notifications for the current user", async () => {
  pool.query = async () => [[{ count: 3 }]];

  const { req, res } = httpDouble({ user: { id: 5 } });
  await controller.unreadCount(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { count: 3 });
});

test("markRead marks only the current user's own notification as read", async () => {
  let capturedParams;
  pool.query = async (sql, params) => { capturedParams = params; return [{ affectedRows: 1 }]; };

  const { req, res } = httpDouble({ user: { id: 5 }, params: { id: "42" } });
  await controller.markRead(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(capturedParams, ["42", 5]);
});

test("markAllRead marks every unread notification for the current user as read", async () => {
  let capturedParams;
  pool.query = async (sql, params) => { capturedParams = params; return [{ affectedRows: 3 }]; };

  const { req, res } = httpDouble({ user: { id: 5 } });
  await controller.markAllRead(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(capturedParams, [5]);
});
