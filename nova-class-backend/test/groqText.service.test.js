const test = require("node:test");
const assert = require("node:assert/strict");
const gateway = require("../services/ai/groqText");

test("completeText always selects GPT-OSS 120B", async () => {
  let request;
  gateway.setGroqClientForTests({
    chat: { completions: { create: async value => { request = value; return { choices: [] }; } } },
    audio: { transcriptions: { create: async () => "text" } },
  });
  await gateway.completeText({ messages: [{ role: "user", content: "hello" }], maxTokens: 77 });
  assert.equal(request.model, "openai/gpt-oss-120b");
  assert.equal(request.max_tokens, 77);
});

test("transcribeAudio keeps Whisper isolated to transcription", async () => {
  let request;
  gateway.setGroqClientForTests({
    chat: { completions: { create: async () => ({ choices: [] }) } },
    audio: { transcriptions: { create: async value => { request = value; return "transcript"; } } },
  });
  assert.equal(await gateway.transcribeAudio({ file: "stream", responseFormat: "text" }), "transcript");
  assert.equal(request.model, "whisper-large-v3");
});
