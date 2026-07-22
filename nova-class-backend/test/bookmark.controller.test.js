const test = require("node:test");
const assert = require("node:assert/strict");

const pool = require("../config/db");
const originalQuery = pool.query;
const controller = require("../controllers/victoria/bookmark.controller");

function httpDouble({ user = { id: 2 }, params = {}, body = {} } = {}) {
  const req = { user, params, body };
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

test.afterEach(() => {
  pool.query = originalQuery;
});

test("listBookmarks returns the current user's saved pages in ascending order", async () => {
  pool.query = async (sql, params) => {
    if (sql.includes("FROM materials")) return [[{ id: 9, class_id: 4 }]];
    if (sql.includes("FROM classes")) return [[{ teacher_id: 2 }]];
    if (sql.includes("FROM material_page_bookmarks")) {
      assert.deepEqual(params, [2, 9]);
      return [[{ page_number: 2 }, { page_number: 7 }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ params: { materialId: "9" } });
  await controller.listBookmarks(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { pages: [2, 7] });
});

test("listBookmarks denies a user who cannot access the material's class", async () => {
  pool.query = async (sql) => {
    if (sql.includes("FROM materials")) return [[{ id: 9, class_id: 4 }]];
    if (sql.includes("FROM classes")) return [[{ teacher_id: 8 }]];
    if (sql.includes("FROM class_members")) return [[]];
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ params: { materialId: "9" } });
  await controller.listBookmarks(req, res);

  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: "Not a member of this class" });
});

test("saveBookmark rejects a non-positive page number without querying the database", async () => {
  pool.query = async () => {
    throw new Error("Database should not be queried");
  };

  const { req, res } = httpDouble({ params: { materialId: "9" }, body: { pageNumber: 0 } });
  await controller.saveBookmark(req, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "pageNumber must be a positive integer" });
});

test("saveBookmark inserts a unique user/material/page tuple", async () => {
  pool.query = async (sql, params) => {
    if (sql.includes("FROM materials")) return [[{ id: 9, class_id: 4 }]];
    if (sql.includes("FROM classes")) return [[{ teacher_id: 2 }]];
    if (sql.includes("INSERT IGNORE")) {
      assert.deepEqual(params, [2, 9, 7]);
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ params: { materialId: "9" }, body: { pageNumber: 7 } });
  await controller.saveBookmark(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { pageNumber: 7, saved: true });
});

test("removeBookmark is idempotent and returns the removed page", async () => {
  pool.query = async (sql, params) => {
    if (sql.includes("FROM materials")) return [[{ id: 9, class_id: 4 }]];
    if (sql.includes("FROM classes")) return [[{ teacher_id: 2 }]];
    if (sql.includes("DELETE FROM material_page_bookmarks")) {
      assert.deepEqual(params, [2, 9, 7]);
      return [{ affectedRows: 0 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ params: { materialId: "9", pageNumber: "7" } });
  await controller.removeBookmark(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { pageNumber: 7, saved: false });
});
