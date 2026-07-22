const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizeCandidates } = require("../services/highlights/candidates");
const { withRetries } = require("../services/highlights/retry");
const { ocrPage } = require("../services/ai/googleVisionOcr");
const vision = require("../services/ai/googleVision");

test("normalizeCandidates removes invalid and out-of-range geometry", () => {
  assert.deepEqual(normalizeCandidates([
    { id: "p1-i1", text: " Key idea ", rect: { x: 0.1, y: 0.2, width: 0.4, height: 0.05 } },
    { id: "bad", text: "", rect: { x: -1, y: 0, width: 2, height: 1 } },
    { id: "infinite", text: "No", rect: { x: 0, y: 0, width: Infinity, height: 1 } },
    { id: "zero", text: "No", rect: { x: 0, y: 0, width: 0, height: 1 } },
  ]), [{
    id: "p1-i1",
    text: "Key idea",
    rect: { x: 0.1, y: 0.2, width: 0.4, height: 0.05 },
  }]);
});

test("normalizeCandidates clamps intersecting rectangles to the page", () => {
  assert.deepEqual(normalizeCandidates([
    { id: "clamped", text: "Visible", rect: { x: -0.1, y: 0.8, width: 0.3, height: 0.4 } },
    { id: "outside", text: "Hidden", rect: { x: 1.1, y: 0, width: 0.2, height: 0.2 } },
  ]), [{
    id: "clamped",
    text: "Visible",
    rect: { x: 0, y: 0.8, width: 0.19999999999999998, height: 0.19999999999999996 },
  }]);
});

test("normalizeCandidates rejects duplicate IDs and bounds text and candidate count", () => {
  const input = Array.from({ length: 2002 }, (_, index) => ({
    id: `candidate-${index}`,
    text: index === 0 ? `  ${"x".repeat(1100)}  ` : "text",
    rect: { x: 0, y: 0, width: 0.1, height: 0.1 },
  }));
  input.splice(1, 0, {
    id: "candidate-0",
    text: "duplicate",
    rect: { x: 0, y: 0, width: 0.1, height: 0.1 },
  });

  const result = normalizeCandidates(input);

  assert.equal(result.length, 2000);
  assert.equal(result[0].text, "x".repeat(1000));
  assert.equal(result.filter(candidate => candidate.id === "candidate-0").length, 1);
  assert.equal(result.at(-1).id, "candidate-1999");
});

test("normalizeCandidates returns no candidates for a non-array payload", () => {
  assert.deepEqual(normalizeCandidates(null), []);
  assert.deepEqual(normalizeCandidates({}), []);
});

test("withRetries permits one attempt plus three retries", async () => {
  let attempts = 0;
  const result = await withRetries(async () => {
    attempts += 1;
    if (attempts < 4) throw new Error("temporary");
    return "ok";
  }, { retries: 3, baseDelayMs: 0 });

  assert.equal(result, "ok");
  assert.equal(attempts, 4);
});

test("withRetries uses exponential delays between retries", async () => {
  const originalSetTimeout = global.setTimeout;
  const delays = [];
  let attempts = 0;
  global.setTimeout = (callback, delay) => {
    delays.push(delay);
    callback();
  };

  try {
    await assert.rejects(
      withRetries(async () => {
        attempts += 1;
        throw new Error("still unavailable");
      }, { retries: 3, baseDelayMs: 5 }),
      /still unavailable/
    );
  } finally {
    global.setTimeout = originalSetTimeout;
  }

  assert.equal(attempts, 4);
  assert.deepEqual(delays, [5, 10, 20]);
});

test("ocrPage joins word symbols and normalizes Vision bounding vertices", async () => {
  const image = Buffer.from("page image");
  let request;
  vision.setVisionClientForTests({
    documentTextDetection: async (nextRequest) => {
      request = nextRequest;
      return [{
        fullTextAnnotation: {
          pages: [{
            width: 200,
            height: 100,
            blocks: [{
              paragraphs: [{
                words: [{
                  symbols: [{ text: "Key" }, { text: " " }, { text: "idea" }],
                  boundingBox: {
                    vertices: [
                      { x: 20, y: 10 },
                      { x: 100, y: 10 },
                      { x: 100, y: 30 },
                      { x: 20, y: 30 },
                    ],
                  },
                }],
              }],
            }],
          }],
        },
      }];
    },
  });

  const result = await ocrPage(image);

  assert.deepEqual(request, { image: { content: image } });
  assert.deepEqual(result, [{
    id: "ocr-p1-i0",
    text: "Key idea",
    rect: { x: 0.1, y: 0.1, width: 0.4, height: 0.2 },
  }]);
});
