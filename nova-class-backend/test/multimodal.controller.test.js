const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const controllerPath = require.resolve("../controllers/victoria/multimodal.controller");
const groqTextPath = require.resolve("../services/ai/groqText");
const googleVisionPath = require.resolve("../services/ai/googleVision");
const elevenLabsPath = require.resolve("../services/ai/elevenLabs");

function loadController(t, overrides = {}) {
  const originalGroqText = require.cache[groqTextPath];
  const originalGoogleVision = require.cache[googleVisionPath];
  const originalElevenLabs = require.cache[elevenLabsPath];

  const unexpected = name => async () => {
    throw new Error(`Unexpected ${name} call`);
  };

  require.cache[groqTextPath] = {
    id: groqTextPath,
    filename: groqTextPath,
    loaded: true,
    exports: {
      completeText: overrides.completeText || unexpected("completeText"),
      transcribeAudio: overrides.transcribeAudio || unexpected("transcribeAudio"),
    },
  };
  require.cache[googleVisionPath] = {
    id: googleVisionPath,
    filename: googleVisionPath,
    loaded: true,
    exports: {
      extractImageContext: overrides.extractImageContext || unexpected("extractImageContext"),
    },
  };
  require.cache[elevenLabsPath] = {
    id: elevenLabsPath,
    filename: elevenLabsPath,
    loaded: true,
    exports: {
      speechToText: overrides.speechToText || unexpected("speechToText"),
    },
  };
  delete require.cache[controllerPath];

  const controller = require(controllerPath);
  t.after(() => {
    delete require.cache[controllerPath];
    if (originalGroqText) require.cache[groqTextPath] = originalGroqText;
    else delete require.cache[groqTextPath];
    if (originalGoogleVision) require.cache[googleVisionPath] = originalGoogleVision;
    else delete require.cache[googleVisionPath];
    if (originalElevenLabs) require.cache[elevenLabsPath] = originalElevenLabs;
    else delete require.cache[elevenLabsPath];
  });
  return controller;
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function stubUnlink(t) {
  const paths = [];
  t.mock.method(fs, "unlink", (filePath, callback) => {
    paths.push(filePath);
    callback(null);
  });
  return paths;
}

test("analyzeFile preprocesses an image, prompts the text model, responds, and unlinks", async t => {
  const image = Buffer.from("image bytes");
  let visionInput;
  let completionRequest;
  const controller = loadController(t, {
    extractImageContext: async buffer => {
      visionInput = buffer;
      return {
        text: "Equation x = 2",
        labels: ["Document", "Worksheet"],
        objects: ["Book"],
      };
    },
    completeText: async request => {
      completionRequest = request;
      return { choices: [{ message: { content: "It shows an equation." } }] };
    },
  });
  t.mock.method(fs, "readFileSync", () => image);
  const unlinked = stubUnlink(t);
  const req = {
    body: { question: "What should I solve?" },
    file: { originalname: "worksheet.png", mimetype: "image/png", path: "/tmp/worksheet.png" },
  };
  const res = createResponse();

  await controller.analyzeFile(req, res);

  assert.equal(visionInput, image);
  assert.equal(completionRequest.maxTokens, 1024);
  assert.match(completionRequest.messages[1].content, /Image text:\nEquation x = 2/);
  assert.match(completionRequest.messages[1].content, /Labels: Document, Worksheet/);
  assert.match(completionRequest.messages[1].content, /Objects: Book/);
  assert.match(completionRequest.messages[1].content, /What should I solve\?/);
  assert.deepEqual(res.body, { type: "image", answer: "It shows an equation." });
  assert.deepEqual(unlinked, ["/tmp/worksheet.png"]);
});

test("analyzeFile returns a blank-question audio transcript without text completion", async t => {
  const stream = { source: "audio stream" };
  let transcriptionRequest;
  let completionCalls = 0;
  const controller = loadController(t, {
    transcribeAudio: async request => {
      transcriptionRequest = request;
      return "Lecture transcript";
    },
    completeText: async () => {
      completionCalls += 1;
      return { choices: [{ message: { content: "unexpected" } }] };
    },
  });
  t.mock.method(fs, "createReadStream", () => stream);
  const unlinked = stubUnlink(t);
  const req = {
    body: { question: "   " },
    file: { originalname: "lecture.mp3", mimetype: "audio/mpeg", path: "/tmp/lecture.mp3" },
  };
  const res = createResponse();

  await controller.analyzeFile(req, res);

  assert.deepEqual(transcriptionRequest, { file: stream, responseFormat: "text" });
  assert.equal(completionCalls, 0);
  assert.deepEqual(res.body, {
    type: "audio",
    transcription: "Lecture transcript",
    answer: "Lecture transcript",
  });
  assert.deepEqual(unlinked, ["/tmp/lecture.mp3"]);
});

test("analyzeFile answers a question about audio and preserves the transcript", async t => {
  const stream = { source: "audio stream" };
  let completionRequest;
  const controller = loadController(t, {
    transcribeAudio: async () => "Lecture transcript",
    completeText: async request => {
      completionRequest = request;
      return { choices: [{ message: { content: "The key point is recursion." } }] };
    },
  });
  t.mock.method(fs, "createReadStream", () => stream);
  const unlinked = stubUnlink(t);
  const req = {
    body: { question: "What is the key point?" },
    file: { originalname: "lecture.m4a", mimetype: "audio/mp4", path: "/tmp/lecture.m4a" },
  };
  const res = createResponse();

  await controller.analyzeFile(req, res);

  assert.equal(completionRequest.maxTokens, 1024);
  assert.match(completionRequest.messages[1].content, /Audio transcription:\nLecture transcript/);
  assert.match(completionRequest.messages[1].content, /Question: What is the key point\?/);
  assert.deepEqual(res.body, {
    type: "audio",
    transcription: "Lecture transcript",
    answer: "The key point is recursion.",
  });
  assert.deepEqual(unlinked, ["/tmp/lecture.m4a"]);
});

test("analyzeFile unlinks and returns 500 when image preprocessing fails", async t => {
  const controller = loadController(t, {
    extractImageContext: async () => {
      throw new Error("vision unavailable");
    },
  });
  t.mock.method(fs, "readFileSync", () => Buffer.from("image bytes"));
  t.mock.method(console, "error", () => {});
  const unlinked = stubUnlink(t);
  const req = {
    body: { question: "Describe this" },
    file: { originalname: "notes.jpg", mimetype: "image/jpeg", path: "/tmp/notes.jpg" },
  };
  const res = createResponse();

  await controller.analyzeFile(req, res);

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: "vision unavailable" });
  assert.deepEqual(unlinked, ["/tmp/notes.jpg"]);
});

test("transcribe returns the Whisper transcript for a non-Burmese recording and unlinks it", async t => {
  let receivedFile, receivedLanguage = "unset";
  const controller = loadController(t, {
    transcribeAudio: async ({ file, responseFormat, language }) => {
      receivedFile = file;
      receivedLanguage = language;
      assert.equal(responseFormat, "verbose_json");
      return {
        text: " 네, 궁금한 부분이 있으면 편하게 물어보세요.",
        segments: [{ text: " 네, 궁금한 부분이 있으면 편하게 물어보세요.", no_speech_prob: 0.047 }],
      };
    },
  });
  t.mock.method(fs, "createReadStream", (path) => ({ path }));
  const unlinked = stubUnlink(t);
  const req = { file: { path: "/tmp/voice-question.webm" }, body: { lang: "ko" } };
  const res = createResponse();

  await controller.transcribe(req, res);

  assert.deepEqual(receivedFile, { path: "/tmp/voice-question.webm" });
  assert.deepEqual(res.body, { text: "네, 궁금한 부분이 있으면 편하게 물어보세요." });
  assert.deepEqual(unlinked, ["/tmp/voice-question.webm"]);
  // Non-Burmese: leave Whisper to auto-detect (it handles Korean well).
  assert.equal(receivedLanguage, undefined);
});

// Whisper reliably returns *something* for a clip even when nothing was
// actually said — near-silent/noise-only audio comes back hallucinated as
// plausible filler ("Thank you.") instead of empty (verified live against
// the real Groq API: noise floor → " Thank you." at no_speech_prob 0.79,
// while a genuine Korean utterance scored 0.047 on the same model — the
// signal is reliable enough there to filter on).
test("transcribe discards a high-no_speech_prob segment for a non-Burmese language instead of returning Whisper's hallucinated filler", async t => {
  const controller = loadController(t, {
    transcribeAudio: async () => ({
      text: " Thank you.",
      segments: [{ text: " Thank you.", no_speech_prob: 0.7871094 }],
    }),
  });
  t.mock.method(fs, "createReadStream", () => ({}));
  stubUnlink(t);
  const req = { file: { path: "/tmp/voice-question.webm" }, body: { lang: "en" } };
  const res = createResponse();

  await controller.transcribe(req, res);

  assert.deepEqual(res.body, { text: "" });
});

// Whisper can't transcribe Burmese at all (live-verified: a clean Burmese clip
// comes back empty when forced, or as script gibberish auto-detected), so a
// Burmese-UI recording skips Whisper entirely and goes to ElevenLabs Scribe,
// which transcribes it accurately.
test("routes Burmese voice input to Scribe, not Whisper", async t => {
  let scribeCalled = false;
  const controller = loadController(t, {
    // transcribeAudio left as the throwing stub — Whisper must never be reached
    // for Burmese; hitting it would be the bug.
    speechToText: async () => {
      scribeCalled = true;
      return "မင်္ဂလာပါ ဒီသင်ခန်းစာနဲ့ ပတ်သက်ပြီး မေးချင်လို့ပါ";
    },
  });
  t.mock.method(fs, "readFileSync", () => Buffer.from("audio"));
  stubUnlink(t);
  const req = { file: { path: "/tmp/voice-question.webm" }, body: { lang: "my" } };
  const res = createResponse();

  await controller.transcribe(req, res);

  assert.equal(scribeCalled, true);
  assert.deepEqual(res.body, { text: "မင်္ဂလာပါ ဒီသင်ခန်းစာနဲ့ ပတ်သက်ပြီး မေးချင်လို့ပါ" });
});

test("returns empty text when Scribe finds no speech in a Burmese recording", async t => {
  const controller = loadController(t, {
    speechToText: async () => "",
  });
  t.mock.method(fs, "readFileSync", () => Buffer.from("silence"));
  stubUnlink(t);
  const req = { file: { path: "/tmp/voice-question.webm" }, body: { lang: "my" } };
  const res = createResponse();

  await controller.transcribe(req, res);

  assert.deepEqual(res.body, { text: "" });
});

// The bug: a student with the UI set to English (or any non-Burmese language)
// speaks Burmese, Whisper auto-detects it as Hindi (a real, live-observed
// confusion) and transcribes gibberish instead of the actual words. The fix
// re-transcribes with Scribe and uses that, since it actually comes back in
// Burmese script.
test("rescues Burmese speech that Whisper mis-detected as Hindi (non-Burmese UI) via a Scribe retry", async t => {
  let scribeCalled = false;
  const controller = loadController(t, {
    transcribeAudio: async () => ({
      language: "hindi",
      text: " नमस्ते",
      segments: [{ text: " नमस्ते", no_speech_prob: 0.1 }],
    }),
    speechToText: async () => {
      scribeCalled = true;
      return "မင်္ဂလာပါ ဒီသင်ခန်းစာနဲ့ ပတ်သက်ပြီး မေးချင်လို့ပါ";
    },
  });
  t.mock.method(fs, "createReadStream", () => ({}));
  t.mock.method(fs, "readFileSync", () => Buffer.from("audio"));
  stubUnlink(t);
  const req = { file: { path: "/tmp/voice-question.webm" }, body: { lang: "en" } };
  const res = createResponse();

  await controller.transcribe(req, res);

  assert.equal(scribeCalled, true);
  assert.deepEqual(res.body, { text: "မင်္ဂလာပါ ဒီသင်ခန်းစာနဲ့ ပတ်သက်ပြီး မေးချင်လို့ပါ" });
});

// The retry must not paper over a genuine other-language utterance that Whisper
// simply doesn't have a name for in OTHER_SUPPORTED_WHISPER_LANGUAGES — if the
// Scribe retry doesn't actually come back in Burmese script, the original
// transcript wins.
test("keeps the original transcript when the Scribe retry isn't actually Burmese", async t => {
  const controller = loadController(t, {
    transcribeAudio: async () => ({
      language: "hindi",
      text: " नमस्ते",
      segments: [{ text: " नमस्ते", no_speech_prob: 0.1 }],
    }),
    speechToText: async () => "Thank you.", // not Burmese script → don't override
  });
  t.mock.method(fs, "createReadStream", () => ({}));
  t.mock.method(fs, "readFileSync", () => Buffer.from("audio"));
  stubUnlink(t);
  const req = { file: { path: "/tmp/voice-question.webm" }, body: { lang: "en" } };
  const res = createResponse();

  await controller.transcribe(req, res);

  assert.deepEqual(res.body, { text: "नमस्ते" });
});

test("transcribe returns 400 when no audio was uploaded", async t => {
  const controller = loadController(t);
  const res = createResponse();

  await controller.transcribe({ file: undefined }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "No audio uploaded" });
});

test("transcribe unlinks the recording and returns 502 when Whisper fails", async t => {
  const controller = loadController(t, {
    transcribeAudio: async () => { throw new Error("Whisper unavailable"); },
  });
  t.mock.method(fs, "createReadStream", () => ({}));
  const unlinked = stubUnlink(t);
  const req = { file: { path: "/tmp/voice-question.webm" } };
  const res = createResponse();

  await controller.transcribe(req, res);

  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, { error: "Whisper unavailable" });
  assert.deepEqual(unlinked, ["/tmp/voice-question.webm"]);
});
