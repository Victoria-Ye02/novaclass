const test = require("node:test");
const assert = require("node:assert/strict");

const groqTextPath = require.resolve("../services/ai/groqText");
const controllerPath = require.resolve("../controllers/victoria/ai.controller");
const originalGroqText = require.cache[groqTextPath];
const originalController = require.cache[controllerPath];

function loadController(completeText) {
  delete require.cache[controllerPath];
  require.cache[groqTextPath] = {
    id: groqTextPath,
    filename: groqTextPath,
    loaded: true,
    exports: { completeText },
  };
  return require("../controllers/victoria/ai.controller");
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test.after(() => {
  if (originalGroqText) require.cache[groqTextPath] = originalGroqText;
  else delete require.cache[groqTextPath];
  if (originalController) require.cache[controllerPath] = originalController;
  else delete require.cache[controllerPath];
});

test("translate returns selected text in the requested language", async () => {
  const controller = loadController(async () => ({
    choices: [{ message: { content: "နားလည်သည်" } }],
  }));
  const res = response();

  await controller.translate({ body: { text: "understand", targetLanguage: "my" } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { translation: "နားလည်သည်" });
});

test("translate reports invalid input without exposing provider details", async () => {
  const controller = loadController(async () => { throw new Error("provider secret"); });
  const res = response();

  await controller.translate({ body: { text: "", targetLanguage: "my" } }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "text is required" });
});
