const test = require("node:test");
const assert = require("node:assert/strict");
const gateway = require("../services/ai/groqText");

test("completeText sends the request to Gemini 2.5 Flash via OpenRouter", async () => {
  let request;
  gateway.setClientsForTests({
    text: { chat: { completions: { create: async value => { request = value; return { choices: [] }; } } } },
  });
  await gateway.completeText({ messages: [{ role: "user", content: "hello" }], maxTokens: 77 });
  assert.equal(request.model, "google/gemini-2.5-flash");
  assert.equal(request.max_tokens, 77);
});

test("transcribeAudio keeps Whisper isolated to transcription", async () => {
  let request;
  gateway.setClientsForTests({
    audio: { audio: { transcriptions: { create: async value => { request = value; return "transcript"; } } } },
  });
  assert.equal(await gateway.transcribeAudio({ file: "stream", responseFormat: "text" }), "transcript");
  assert.equal(request.model, "whisper-large-v3");
});
