const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../config/db");
const originalQuery = pool.query;

const controllerPath = require.resolve("../controllers/victoria/assignment.controller");
const notificationsPath = require.resolve("../services/notifications");

function loadController(t, { notifyUsers, notifyUser } = {}) {
  const original = require.cache[notificationsPath];
  require.cache[notificationsPath] = {
    id: notificationsPath,
    filename: notificationsPath,
    loaded: true,
    exports: {
      notifyUsers: notifyUsers || (async () => { throw new Error("Unexpected notifyUsers call"); }),
      notifyUser: notifyUser || (async () => { throw new Error("Unexpected notifyUser call"); }),
    },
  };
  delete require.cache[controllerPath];

  const controller = require(controllerPath);
  t.after(() => {
    delete require.cache[controllerPath];
    if (original) require.cache[notificationsPath] = original;
    else delete require.cache[notificationsPath];
  });
  return controller;
}

function httpDouble({ user = { id: 2 }, params = {}, body = {}, files } = {}) {
  const req = { user, params, body, files };
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
});

test("createAssignment notifies every other class member, not the teacher who posted it", async (t) => {
  let notifyCall;
  const controller = loadController(t, {
    notifyUsers: async (userIds, opts) => { notifyCall = { userIds, opts }; },
  });

  pool.query = async (sql, params) => {
    if (sql.startsWith("SELECT * FROM classes")) return [[{ id: 3, teacher_id: 2 }]];
    if (sql.startsWith("INSERT INTO assignments")) return [{ insertId: 99 }];
    if (sql.startsWith("SELECT user_id FROM class_members")) {
      return [[{ user_id: 10 }, { user_id: 11 }]];
    }
    if (sql.startsWith("SELECT a.*, u.name")) {
      return [[{ id: 99, class_id: 3, title: "Essay 1", teacher_name: "Vic" }]];
    }
    if (sql.startsWith("SELECT * FROM assignment_files")) return [[]];
    if (sql.startsWith("INSERT INTO class_posts")) return [{ insertId: 1 }];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 2 }, params: { id: "3" }, body: { title: "Essay 1" } });
  await controller.createAssignment(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(notifyCall.userIds, [10, 11]);
  assert.equal(notifyCall.opts.type, "assignment_created");
  assert.match(notifyCall.opts.title, /Essay 1/);
});

test("createAssignment does not notify anyone for a draft assignment", async (t) => {
  let notifyCalled = false;
  const controller = loadController(t, {
    notifyUsers: async () => { notifyCalled = true; },
  });

  pool.query = async (sql) => {
    if (sql.startsWith("SELECT * FROM classes")) return [[{ id: 3, teacher_id: 2 }]];
    if (sql.startsWith("INSERT INTO assignments")) return [{ insertId: 99 }];
    if (sql.startsWith("SELECT a.*, u.name")) return [[{ id: 99, class_id: 3, title: "Draft", teacher_name: "Vic" }]];
    if (sql.startsWith("SELECT * FROM assignment_files")) return [[]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 2 }, params: { id: "3" }, body: { title: "Draft", is_draft: true } });
  await controller.createAssignment(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(notifyCalled, false);
});

test("gradeSubmission notifies the student their work was graded", async (t) => {
  let notifyCall;
  const controller = loadController(t, {
    notifyUser: async (userId, opts) => { notifyCall = { userId, opts }; },
  });

  pool.query = async (sql, params) => {
    if (sql.includes("FROM submissions s JOIN assignments a")) {
      return [[{ id: 7, class_id: 3, student_id: 40, assignment_id: 55 }]];
    }
    if (sql.startsWith("SELECT * FROM classes")) return [[{ id: 3, teacher_id: 2 }]];
    if (sql.startsWith("UPDATE submissions")) return [{ affectedRows: 1 }];
    if (sql.includes("FROM submissions s\n") || sql.includes("JOIN users u ON u.id = s.student_id")) {
      return [[{ id: 7, student_id: 40, student_name: "Student A", grade: 90, assignment_id: 55 }]];
    }
    if (sql.startsWith("SELECT title FROM assignments")) return [[{ title: "Essay 1" }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 2 }, params: { id: "7" }, body: { grade: 90 } });
  await controller.gradeSubmission(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(notifyCall.userId, 40);
  assert.equal(notifyCall.opts.type, "submission_graded");
});

test("editComment lets the author update their own comment's content", async (t) => {
  const controller = loadController(t, {});
  let updateParams;
  pool.query = async (sql, params) => {
    if (sql.startsWith("SELECT * FROM assignment_comments")) return [[{ id: 5, assignment_id: 7, author_id: 40, content: "old text" }]];
    if (sql.startsWith("UPDATE assignment_comments")) { updateParams = params; return [{ affectedRows: 1 }]; }
    if (sql.startsWith("SELECT ac.*, u.name")) return [[{ id: 5, assignment_id: 7, author_id: 40, content: "new text", author_name: "Student A" }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 40 }, params: { commentId: "5" }, body: { content: "new text" } });
  await controller.editComment(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.content, "new text");
  assert.deepEqual(updateParams, ["new text", "5"]);
});

test("editComment refuses to update someone else's comment", async (t) => {
  const controller = loadController(t, {});
  pool.query = async (sql) => {
    if (sql.startsWith("SELECT * FROM assignment_comments")) return [[{ id: 5, assignment_id: 7, author_id: 40, content: "old text" }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 99 }, params: { commentId: "5" }, body: { content: "hijacked" } });
  await controller.editComment(req, res);

  assert.equal(res.statusCode, 403);
});

test("deleteComment lets the author delete their own comment", async (t) => {
  const controller = loadController(t, {});
  let deletedId;
  pool.query = async (sql, params) => {
    if (sql.startsWith("SELECT * FROM assignment_comments")) return [[{ id: 5, assignment_id: 7, author_id: 40 }]];
    if (sql.startsWith("DELETE FROM assignment_comments")) { deletedId = params[0]; return [{ affectedRows: 1 }]; }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 40 }, params: { commentId: "5" } });
  await controller.deleteComment(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(deletedId, "5");
});

test("deleteComment refuses to delete someone else's comment, teacher or not", async (t) => {
  const controller = loadController(t, {});
  pool.query = async (sql) => {
    if (sql.startsWith("SELECT * FROM assignment_comments")) return [[{ id: 5, assignment_id: 7, author_id: 40 }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 2 }, params: { commentId: "5" } });
  await controller.deleteComment(req, res);

  assert.equal(res.statusCode, 403);
});
