const test = require("node:test");
const assert = require("node:assert/strict");

const elevenLabsPath = require.resolve("../services/ai/elevenLabs");
const controllerPath = require.resolve("../controllers/victoria/ai.controller");
const originalElevenLabs = require.cache[elevenLabsPath];
const originalController = require.cache[controllerPath];
const originalAgentId = process.env.ELEVENLABS_AGENT_ID;

function loadController(getSignedUrl) {
  delete require.cache[controllerPath];
  require.cache[elevenLabsPath] = {
    id: elevenLabsPath,
    filename: elevenLabsPath,
    loaded: true,
    exports: { getSignedUrl },
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

test.afterEach(() => {
  if (originalAgentId === undefined) delete process.env.ELEVENLABS_AGENT_ID;
  else process.env.ELEVENLABS_AGENT_ID = originalAgentId;
});

test.after(() => {
  if (originalElevenLabs) require.cache[elevenLabsPath] = originalElevenLabs;
  else delete require.cache[elevenLabsPath];
  if (originalController) require.cache[controllerPath] = originalController;
  else delete require.cache[controllerPath];
});

test("voiceSignedUrl returns a signed URL for the configured agent", async () => {
  process.env.ELEVENLABS_AGENT_ID = "agent_123";
  let receivedAgentId;
  const controller = loadController(async (agentId) => {
    receivedAgentId = agentId;
    return "wss://api.elevenlabs.io/v1/convai/conversation?token=abc";
  });
  const res = response();

  await controller.voiceSignedUrl({}, res);

  assert.equal(receivedAgentId, "agent_123");
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { signedUrl: "wss://api.elevenlabs.io/v1/convai/conversation?token=abc" });
});

test("voiceSignedUrl returns 503 when no agent is configured, without calling ElevenLabs", async () => {
  delete process.env.ELEVENLABS_AGENT_ID;
  const controller = loadController(async () => { throw new Error("should not be called"); });
  const res = response();

  await controller.voiceSignedUrl({}, res);

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { error: "Voice agent is not configured" });
});

test("voiceSignedUrl reports invalid input without exposing provider details", async () => {
  process.env.ELEVENLABS_AGENT_ID = "agent_123";
  const controller = loadController(async () => { throw new Error("provider secret"); });
  const res = response();

  await controller.voiceSignedUrl({}, res);

  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, { error: "Voice agent is temporarily unavailable" });
});
