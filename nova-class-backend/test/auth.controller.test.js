const test = require("node:test");
const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");

const pool = require("../config/db");
const controller = require("../controllers/victoria/auth.controller");

const originalQuery = pool.query;

const controllerPath = require.resolve("../controllers/victoria/auth.controller");
const googleAuthPath = require.resolve("google-auth-library");

// auth.controller.js instantiates `new OAuth2Client()` once at module scope,
// so swap the module in require.cache (matching the multimodal.controller.test.js
// convention for external API clients) and force a fresh require per test.
function loadGoogleController(t, { verifyIdToken, clientId = "test-client-id.apps.googleusercontent.com" } = {}) {
  const originalGoogleAuth = require.cache[googleAuthPath];
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  // `null` (not `undefined`) means "explicitly unset" — a destructuring
  // default only skips when the property is `undefined`, so passing
  // `clientId: undefined` here would silently fall through to the default.
  if (clientId === null) delete process.env.GOOGLE_CLIENT_ID;
  else process.env.GOOGLE_CLIENT_ID = clientId;

  require.cache[googleAuthPath] = {
    id: googleAuthPath,
    filename: googleAuthPath,
    loaded: true,
    exports: {
      OAuth2Client: class {
        async verifyIdToken(args) {
          if (!verifyIdToken) throw new Error("Unexpected verifyIdToken call");
          return verifyIdToken(args);
        }
      },
    },
  };
  delete require.cache[controllerPath];

  const freshController = require(controllerPath);
  t.after(() => {
    delete require.cache[controllerPath];
    if (originalGoogleAuth) require.cache[googleAuthPath] = originalGoogleAuth;
    else delete require.cache[googleAuthPath];
    if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = previousClientId;
    pool.query = originalQuery;
  });
  return freshController;
}

function ticketFor(payload) {
  return { getPayload: () => payload };
}

// utf8mb4_0900_ai_ci is case-insensitive but NO PAD, so " a@b.com" and "a@b.com "
// miss the row entirely. Normalizing before the lookup is what keeps a stray
// space from autofill or a mobile keyboard reading as "User not found".
const STORED_EMAIL = "victoria@nova.com";
const PASSWORD = "correct-horse";

function httpDouble(body, user) {
  const req = { body, user };
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

const STORED_USERNAME = "victoria6";

// The login query now matches either column with the same normalized
// identifier (`WHERE email = ? OR username = ?`), so both bound params carry
// whatever the user typed, whether it was their email or their ID.
function installUserRow(hash, seen) {
  pool.query = async (sql, params) => {
    seen.push(params);
    const matches = params.includes(STORED_EMAIL) || params.includes(STORED_USERNAME);
    if (!matches) return [[]];
    return [[{ id: 1, name: "Victoria", email: STORED_EMAIL, username: STORED_USERNAME, password: hash, role: "teacher" }]];
  };
}

test("login normalizes the submitted email", async t => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret";
  t.after(() => {
    pool.query = originalQuery;
    process.env.JWT_SECRET = previousSecret;
  });

  for (const submitted of [
    STORED_EMAIL,
    `${STORED_EMAIL} `,
    ` ${STORED_EMAIL}`,
    "  Victoria@Nova.COM  ",
  ]) {
    const seen = [];
    installUserRow(hash, seen);
    const { req, res } = httpDouble({ email: submitted, password: PASSWORD });

    await controller.login(req, res);

    assert.deepEqual(seen, [[STORED_EMAIL, STORED_EMAIL]], `lookup for ${JSON.stringify(submitted)}`);
    assert.equal(res.statusCode, 200, `status for ${JSON.stringify(submitted)}`);
    assert.equal(typeof res.body.token, "string");
    assert.equal(res.body.user.name, "Victoria");
  }
});

test("login succeeds when the submitted value is the account's ID (username), not its email", async t => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  process.env.JWT_SECRET = "test-secret";
  const seen = [];
  installUserRow(hash, seen);
  t.after(() => {
    pool.query = originalQuery;
  });

  const { req, res } = httpDouble({ email: "  Victoria6  ", password: PASSWORD });
  await controller.login(req, res);

  assert.deepEqual(seen, [[STORED_USERNAME, STORED_USERNAME]]);
  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.token, "string");
});

test("login still rejects a genuinely unknown email or ID", async t => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const seen = [];
  installUserRow(hash, seen);
  t.after(() => {
    pool.query = originalQuery;
  });

  const { req, res } = httpDouble({ email: "nobody@nova.com", password: PASSWORD });
  await controller.login(req, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: "User not found" });
});

test("register stores the normalized email and ID (username)", async t => {
  let insertParams;
  pool.query = async (sql, params) => {
    insertParams = params;
    return [{ insertId: 42 }];
  };
  t.after(() => {
    pool.query = originalQuery;
  });

  const { req, res } = httpDouble({
    name: "Vic", email: "  New.User@Nova.com  ", username: "  NewUser6  ", password: PASSWORD,
  });
  await controller.register(req, res);

  assert.equal(insertParams[0], "Vic");
  assert.equal(insertParams[1], "new.user@nova.com");
  assert.equal(insertParams[2], "newuser6");
  assert.equal(typeof insertParams[3], "string");
  assert.equal(insertParams[4], "student");
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.email, "new.user@nova.com");
  assert.equal(res.body.username, "newuser6");
});

test("register rejects an ID (username) shorter than 6 characters without touching the database", async t => {
  let queried = false;
  pool.query = async () => { queried = true; return [{ insertId: 1 }]; };
  t.after(() => {
    pool.query = originalQuery;
  });

  const { req, res } = httpDouble({ name: "Vic", email: "vic@nova.com", username: "abc12", password: PASSWORD });
  await controller.register(req, res);

  assert.equal(queried, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "ID must be at least 6 characters" });
});

test("register rejects a missing ID (username) without touching the database", async t => {
  let queried = false;
  pool.query = async () => { queried = true; return [{ insertId: 1 }]; };
  t.after(() => {
    pool.query = originalQuery;
  });

  const { req, res } = httpDouble({ name: "Vic", email: "vic@nova.com", password: PASSWORD });
  await controller.register(req, res);

  assert.equal(queried, false);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "ID must be at least 6 characters" });
});

test("googleLogin creates a new account when signing up (intent: register)", async t => {
  let insertParams;
  const googleController = loadGoogleController(t, {
    verifyIdToken: async ({ idToken, audience }) => {
      assert.equal(idToken, "fake-credential");
      assert.equal(audience, "test-client-id.apps.googleusercontent.com");
      return ticketFor({ email: "New.Student@Nova.com", email_verified: true, name: "New Student" });
    },
  });
  process.env.JWT_SECRET = "test-secret";

  pool.query = async (sql, params) => {
    if (sql.includes("SELECT * FROM users")) {
      assert.deepEqual(params, ["new.student@nova.com"]);
      return [[]];
    }
    if (sql.includes("INSERT INTO users")) {
      insertParams = params;
      return [{ insertId: 77 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ credential: "fake-credential", intent: "register" });
  await googleController.googleLogin(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(typeof res.body.token, "string");
  assert.deepEqual(res.body.user, {
    id: 77, name: "New Student", role: "student", email: "new.student@nova.com",
  });
  assert.equal(insertParams[0], "New Student");
  assert.equal(insertParams[1], "new.student@nova.com");
  assert.equal(typeof insertParams[2], "string");
  assert.notEqual(insertParams[2], ""); // a real (unusable) password hash is stored, never blank
  assert.equal(insertParams[3], "student");
});

test("googleLogin signs in an existing user by email instead of creating a duplicate", async t => {
  const googleController = loadGoogleController(t, {
    verifyIdToken: async () => ticketFor({ email: "victoria@nova.com", email_verified: true, name: "Ignored Google Name" }),
  });
  process.env.JWT_SECRET = "test-secret";

  let insertCalled = false;
  pool.query = async (sql) => {
    if (sql.includes("SELECT * FROM users")) {
      return [[{ id: 1, name: "Victoria", email: "victoria@nova.com", role: "teacher" }]];
    }
    if (sql.includes("INSERT INTO users")) {
      insertCalled = true;
      return [{ insertId: 999 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ credential: "fake-credential" });
  await googleController.googleLogin(req, res);

  assert.equal(insertCalled, false);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.user, { id: 1, name: "Victoria", role: "teacher", email: "victoria@nova.com" });
});

test("googleLogin refuses to sign in a Google account that never signed up (intent: login)", async t => {
  const googleController = loadGoogleController(t, {
    verifyIdToken: async () => ticketFor({ email: "stranger@nova.com", email_verified: true, name: "Stranger" }),
  });

  let insertCalled = false;
  pool.query = async (sql) => {
    if (sql.includes("SELECT * FROM users")) return [[]];
    if (sql.includes("INSERT INTO users")) {
      insertCalled = true;
      return [{ insertId: 999 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ credential: "fake-credential", intent: "login" });
  await googleController.googleLogin(req, res);

  assert.equal(insertCalled, false);
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: "No account found for this Google email. Please sign up first." });
});

test("googleLogin defaults to login-only (no account creation) when intent is omitted", async t => {
  const googleController = loadGoogleController(t, {
    verifyIdToken: async () => ticketFor({ email: "stranger@nova.com", email_verified: true, name: "Stranger" }),
  });

  let insertCalled = false;
  pool.query = async (sql) => {
    if (sql.includes("SELECT * FROM users")) return [[]];
    if (sql.includes("INSERT INTO users")) {
      insertCalled = true;
      return [{ insertId: 999 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };

  const { req, res } = httpDouble({ credential: "fake-credential" });
  await googleController.googleLogin(req, res);

  assert.equal(insertCalled, false);
  assert.equal(res.statusCode, 404);
});

test("googleLogin fails fast without calling Google when GOOGLE_CLIENT_ID isn't configured", async t => {
  const googleController = loadGoogleController(t, { clientId: null });

  const { req, res } = httpDouble({ credential: "fake-credential" });
  await googleController.googleLogin(req, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "Google sign-in is not configured on this server" });
});

test("googleLogin rejects an invalid or expired credential", async t => {
  const googleController = loadGoogleController(t, {
    verifyIdToken: async () => { throw new Error("Token used too late"); },
  });

  const { req, res } = httpDouble({ credential: "fake-credential" });
  await googleController.googleLogin(req, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Invalid Google credential" });
});

test("googleLogin rejects an unverified Google email without writing to the database", async t => {
  const googleController = loadGoogleController(t, {
    verifyIdToken: async () => ticketFor({ email: "unverified@nova.com", email_verified: false, name: "Nope" }),
  });

  pool.query = async () => { throw new Error("Should not query the database"); };

  const { req, res } = httpDouble({ credential: "fake-credential" });
  await googleController.googleLogin(req, res);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: "Google email is not verified" });
});

test("updateMe renames the authenticated user and rejects a blank name", async t => {
  const queries = [];
  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.startsWith("UPDATE users")) return [{ affectedRows: 1 }];
    if (sql.startsWith("SELECT")) {
      return [[{ id: 5, name: "New Name", email: "vic@nova.com", username: "victoria6", role: "student" }]];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  t.after(() => { pool.query = originalQuery; });

  const { req, res } = httpDouble({ name: "  New Name  " }, { id: 5 });
  await controller.updateMe(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.name, "New Name");
  assert.equal(queries[0].params[0], "New Name");
  assert.equal(queries[0].params[1], 5);

  // Blank name must be rejected before ever touching the database.
  queries.length = 0;
  const blank = httpDouble({ name: "   " }, { id: 5 });
  await controller.updateMe(blank.req, blank.res);

  assert.equal(blank.res.statusCode, 400);
  assert.deepEqual(blank.res.body, { error: "Name cannot be empty" });
  assert.deepEqual(queries, []);
});

test("deleteMe removes a plain student account with no owned classes or materials", async t => {
  const queries = [];
  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes("FROM classes WHERE teacher_id")) return [[{ count: 0 }]];
    if (sql.includes("FROM materials WHERE uploaded_by")) return [[{ count: 0 }]];
    if (sql.startsWith("DELETE FROM class_members")) return [{ affectedRows: 2 }];
    if (sql.startsWith("DELETE FROM users")) return [{ affectedRows: 1 }];
    throw new Error(`Unexpected query: ${sql}`);
  };
  t.after(() => { pool.query = originalQuery; });

  const { req, res } = httpDouble({}, { id: 5 });
  await controller.deleteMe(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { success: true });
  assert.ok(queries.some(q => q.sql.startsWith("DELETE FROM class_members") && q.params[0] === 5));
  assert.ok(queries.some(q => q.sql.startsWith("DELETE FROM users") && q.params[0] === 5));
});

test("deleteMe refuses to delete a teacher who still owns classes, without deleting anything", async t => {
  const queries = [];
  pool.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes("FROM classes WHERE teacher_id")) return [[{ count: 2 }]];
    if (sql.includes("FROM materials WHERE uploaded_by")) return [[{ count: 0 }]];
    throw new Error(`Unexpected query: ${sql}`);
  };
  t.after(() => { pool.query = originalQuery; });

  const { req, res } = httpDouble({}, { id: 5 });
  await controller.deleteMe(req, res);

  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, {
    error: "Cannot delete an account that owns classes or uploaded materials. Please delete or transfer them first.",
  });
  assert.ok(!queries.some(q => q.sql.startsWith("DELETE")));
});
