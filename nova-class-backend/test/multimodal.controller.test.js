const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const controllerPath = require.resolve("../controllers/victoria/multimodal.controller");
const groqTextPath = require.resolve("../services/ai/groqText");
const googleVisionPath = require.resolve("../services/ai/googleVision");

function loadController(t, overrides = {}) {
  const originalGroqText = require.cache[groqTextPath];
  const originalGoogleVision = require.cache[googleVisionPath];

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
  delete require.cache[controllerPath];

  const controller = require(controllerPath);
  t.after(() => {
    delete require.cache[controllerPath];
    if (originalGroqText) require.cache[groqTextPath] = originalGroqText;
    else delete require.cache[groqTextPath];
    if (originalGoogleVision) require.cache[googleVisionPath] = originalGoogleVision;
    else delete require.cache[googleVisionPath];
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
