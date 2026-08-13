const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../config/db");
const controller = require("../controllers/victoria/meeting.controller");

const originalQuery = pool.query;

const controllerPath = require.resolve("../controllers/victoria/meeting.controller");
const notificationsPath = require.resolve("../services/notifications");

function loadController(t, { notifyUsers } = {}) {
  const original = require.cache[notificationsPath];
  require.cache[notificationsPath] = {
    id: notificationsPath,
    filename: notificationsPath,
    loaded: true,
    exports: {
      notifyUsers: notifyUsers || (async () => { throw new Error("Unexpected notifyUsers call"); }),
      notifyUser: async () => { throw new Error("Unexpected notifyUser call"); },
    },
  };
  delete require.cache[controllerPath];

  const freshController = require(controllerPath);
  t.after(() => {
    delete require.cache[controllerPath];
    if (original) require.cache[notificationsPath] = original;
    else delete require.cache[notificationsPath];
  });
  return freshController;
}

test.afterEach(() => {
  pool.query = originalQuery;
});

function httpDouble({ user = { id: 2 }, params = {}, body = {} } = {}) {
  const req = { user, params, body };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

test("listMyActiveMeetings returns active meetings across every class the student belongs to", async () => {
  let capturedParams;
  pool.query = async (sql, params) => {
    capturedParams = params;
    return [[
      { id: 1, class_id: 3, class_name: "html", room_url: "https://meet.jit.si/nova-class-3-1", title: "Class Meeting", host_name: "Teacher A", started_at: "2026-08-12T10:00:00Z" },
    ]];
  };

  const { req, res } = httpDouble({ user: { id: 27 } });
  await controller.listMyActiveMeetings(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.meetings.length, 1);
  assert.equal(res.body.meetings[0].class_name, "html");
  // Queried by this user's id (as both teacher and member), not hardcoded.
  assert.ok(capturedParams.includes(27));
});

test("listMyActiveMeetings returns an empty array when nothing is live", async () => {
  pool.query = async () => [[]];

  const { req, res } = httpDouble({ user: { id: 27 } });
  await controller.listMyActiveMeetings(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.meetings, []);
});

test("listMyActiveMeetings reports a 500 with the db error message on failure", async () => {
  pool.query = async () => { throw new Error("connection lost"); };

  const { req, res } = httpDouble({ user: { id: 27 } });
  await controller.listMyActiveMeetings(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, "connection lost");
});

test("startMeeting notifies every other class member that a meeting is live, not the host who started it", async (t) => {
  let notifyCall;
  const meetingController = loadController(t, {
    notifyUsers: async (userIds, opts) => { notifyCall = { userIds, opts }; },
  });

  pool.query = async (sql, params) => {
    if (sql.startsWith("SELECT * FROM classes")) return [[{ id: 3, teacher_id: 2 }]];
    if (sql.startsWith("UPDATE class_meetings")) return [{ affectedRows: 0 }];
    if (sql.startsWith("INSERT INTO class_meetings")) return [{ insertId: 9 }];
    if (sql.startsWith("SELECT m.*, u.name AS host_name")) {
      return [[{ id: 9, class_id: 3, room_url: "https://meet.jit.si/x", title: "Class Meeting", host_name: "Teacher" }]];
    }
    if (sql.startsWith("SELECT user_id FROM class_members")) return [[{ user_id: 10 }, { user_id: 11 }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 2 }, params: { id: "3" } });
  await meetingController.startMeeting(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(notifyCall.userIds, [10, 11]);
  assert.equal(notifyCall.opts.type, "meeting_started");
});
