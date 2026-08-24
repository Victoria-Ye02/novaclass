const test = require("node:test");
const assert = require("node:assert/strict");
const gateway = require("../services/ai/groqText");

test("completeText always selects GLM-5.2 via OpenRouter with reasoning disabled", async () => {
  let request;
  gateway.setClientsForTests({
    text: { chat: { completions: { create: async value => { request = value; return { choices: [] }; } } } },
  });
  await gateway.completeText({ messages: [{ role: "user", content: "hello" }], maxTokens: 77 });
  assert.equal(request.model, "z-ai/glm-5.2");
  assert.equal(request.max_tokens, 77);
  assert.deepEqual(request.reasoning, { enabled: false });
});

test("transcribeAudio keeps Whisper isolated to transcription", async () => {
  let request;
  gateway.setClientsForTests({
    audio: { audio: { transcriptions: { create: async value => { request = value; return "transcript"; } } } },
  });
  assert.equal(await gateway.transcribeAudio({ file: "stream", responseFormat: "text" }), "transcript");
  assert.equal(request.model, "whisper-large-v3");
});
