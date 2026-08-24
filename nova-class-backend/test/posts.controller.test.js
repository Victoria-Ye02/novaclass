const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../config/db");
const originalQuery = pool.query;

const controller = require("../controllers/victoria/posts.controller");

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

test.afterEach(() => {
  pool.query = originalQuery;
});

test("addComment's response includes author_id so the poster can immediately edit/delete their own comment", async (t) => {
  pool.query = async (sql, params) => {
    if (sql.startsWith("SELECT * FROM class_posts")) return [[{ id: 7, class_id: 3 }]];
    if (sql.includes("FROM classes")) return [[{ id: 3, teacher_id: 99 }]];
    if (sql.includes("FROM class_members")) return [[{ id: 1, class_id: 3, user_id: 5 }]];
    if (sql.startsWith("INSERT INTO post_comments")) return [{ insertId: 10 }];
    if (sql.startsWith("SELECT c.id, c.content")) return [[{ id: 10, content: "nice!", author_id: 5, author_name: "Student A" }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 5 }, params: { postId: "7" }, body: { content: "nice!" } });
  await controller.addComment(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.author_id, 5);
});

test("editPostComment lets the author update their own comment's content", async (t) => {
  let updateParams;
  pool.query = async (sql, params) => {
    if (sql.startsWith("SELECT * FROM post_comments")) return [[{ id: 10, post_id: 7, author_id: 5, content: "old" }]];
    if (sql.startsWith("UPDATE post_comments")) { updateParams = params; return [{ affectedRows: 1 }]; }
    if (sql.startsWith("SELECT c.id, c.content")) return [[{ id: 10, content: "new", author_id: 5, author_name: "Student A" }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 5 }, params: { commentId: "10" }, body: { content: "new" } });
  await controller.editPostComment(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.content, "new");
  assert.deepEqual(updateParams, ["new", "10"]);
});

test("editPostComment refuses to update someone else's comment", async (t) => {
  pool.query = async (sql) => {
    if (sql.startsWith("SELECT * FROM post_comments")) return [[{ id: 10, post_id: 7, author_id: 5, content: "old" }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 99 }, params: { commentId: "10" }, body: { content: "hijacked" } });
  await controller.editPostComment(req, res);

  assert.equal(res.statusCode, 403);
});

test("deletePostComment lets the author delete their own comment", async (t) => {
  let deletedId;
  pool.query = async (sql, params) => {
    if (sql.startsWith("SELECT * FROM post_comments")) return [[{ id: 10, post_id: 7, author_id: 5 }]];
    if (sql.startsWith("DELETE FROM post_comments")) { deletedId = params[0]; return [{ affectedRows: 1 }]; }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 5 }, params: { commentId: "10" } });
  await controller.deletePostComment(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(deletedId, "10");
});

test("deletePostComment refuses to delete someone else's comment, even the teacher's", async (t) => {
  pool.query = async (sql) => {
    if (sql.startsWith("SELECT * FROM post_comments")) return [[{ id: 10, post_id: 7, author_id: 5 }]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ user: { id: 99 }, params: { commentId: "10" } });
  await controller.deletePostComment(req, res);

  assert.equal(res.statusCode, 403);
});
