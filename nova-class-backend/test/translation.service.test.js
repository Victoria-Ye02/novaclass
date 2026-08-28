const test = require("node:test");
const assert = require("node:assert/strict");
const { translateText } = require("../services/ai/translation");

test("translates selected text into Burmese", async () => {
  let request;
  const translation = await translateText({
    text: "understand",
    targetLanguage: "my",
    completeText: async value => {
      request = value;
      return { choices: [{ message: { content: "နားလည်သည်" } }] };
    },
  });

  assert.equal(translation, "နားလည်သည်");
  assert.match(request.messages[0].content, /Burmese/);
  assert.match(request.messages[1].content, /understand/);
});

test("splits long selected text and preserves translation order", async () => {
  const text = `${"a".repeat(5000)} ${"b".repeat(5000)}`;
  const requests = [];
  const translation = await translateText({
    text,
    targetLanguage: "en",
    completeText: async request => {
      requests.push(request);
      return { choices: [{ message: { content: String(requests.length) } }] };
    },
  });

  assert.equal(translation, "1\n\n2");
  assert.equal(requests.length, 2);
  assert.ok(requests.every(request => request.messages[1].content.length <= 5000));
});

test("translates selected text into Korean", async () => {
  let request;
  const translation = await translateText({
    text: "understand",
    targetLanguage: "ko",
    completeText: async value => {
      request = value;
      return { choices: [{ message: { content: "이해하다" } }] };
    },
  });

  assert.equal(translation, "이해하다");
  assert.match(request.messages[0].content, /Korean/);
});

test("translates selected text into Vietnamese", async () => {
  let request;
  const translation = await translateText({
    text: "understand",
    targetLanguage: "vi",
    completeText: async value => {
      request = value;
      return { choices: [{ message: { content: "hiểu" } }] };
    },
  });

  assert.equal(translation, "hiểu");
  assert.match(request.messages[0].content, /Vietnamese/);
});

test("rejects empty selected text and an unsupported target language", async () => {
  await assert.rejects(
    () => translateText({ text: "", targetLanguage: "my" }),
    /text is required/
  );
  await assert.rejects(
    () => translateText({ text: "hello", targetLanguage: "fr" }),
    /targetLanguage must be my, en, ko, or vi/
  );
});
