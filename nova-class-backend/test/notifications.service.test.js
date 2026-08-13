const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../config/db");
const originalQuery = pool.query;
const service = require("../services/notifications");

test.afterEach(() => {
  pool.query = originalQuery;
});

test("notifyUser inserts a single notification row", async () => {
  let captured;
  pool.query = async (sql, params) => { captured = { sql, params }; return [{ insertId: 1 }]; };

  await service.notifyUser(5, { type: "assignment_created", title: "New assignment: Essay 1", message: "In html", linkUrl: "/classroom/3" });

  assert.match(captured.sql, /INSERT INTO notifications/);
  assert.deepEqual(captured.params, [5, "assignment_created", "New assignment: Essay 1", "In html", "/classroom/3"]);
});

test("notifyUsers inserts one row per user id, skipping an excluded id", async () => {
  const inserted = [];
  pool.query = async (sql, params) => { inserted.push(params); return [{ insertId: 1 }]; };

  await service.notifyUsers([5, 6, 7], { type: "meeting_started", title: "Live now", excludeUserId: 6 });

  assert.equal(inserted.length, 2);
  assert.deepEqual(inserted.map(p => p[0]), [5, 7]);
});

test("notifyUsers does nothing when the recipient list is empty", async () => {
  let called = false;
  pool.query = async () => { called = true; return [{ insertId: 1 }]; };

  await service.notifyUsers([], { type: "x", title: "y" });

  assert.equal(called, false);
});
