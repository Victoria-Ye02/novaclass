const test = require("node:test");
const assert = require("node:assert/strict");
const vision = require("../services/ai/googleVision");

test("extractImageContext returns bounded text labels and objects", async () => {
  const image = Buffer.from("image");
  const sourceText = `${"x".repeat(12000)}truncated`;
  let request;

  vision.setVisionClientForTests({
    annotateImage: async (nextRequest) => {
      request = nextRequest;
      return [{
        fullTextAnnotation: { text: sourceText },
        labelAnnotations: [{ description: "Document" }],
        localizedObjectAnnotations: [{ name: "Book" }],
      }];
    },
  });

  const context = await vision.extractImageContext(image);

  assert.deepEqual(request, {
    image: { content: image },
    features: [
      { type: "DOCUMENT_TEXT_DETECTION" },
      { type: "LABEL_DETECTION", maxResults: 12 },
      { type: "OBJECT_LOCALIZATION", maxResults: 12 },
    ],
  });
  assert.deepEqual(context, {
    text: "x".repeat(12000),
    labels: ["Document"],
    objects: ["Book"],
  });
  assert.equal(context.text.length, 12000);
});

test("detectDocumentText returns the document annotation", async () => {
  const annotation = { text: "Study notes", pages: [{ width: 800, height: 1000 }] };
  vision.setVisionClientForTests({
    documentTextDetection: async () => [{ fullTextAnnotation: annotation }],
  });

  assert.equal(await vision.detectDocumentText(Buffer.from("document")), annotation);
});

test("rejects cleanly with VISION_NOT_CONFIGURED when GOOGLE_APPLICATION_CREDENTIALS is unset, without touching the real client", async () => {
  const original = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  vision.setVisionClientForTests(null);

  try {
    await assert.rejects(
      () => vision.extractImageContext(Buffer.from("image")),
      (error) => {
        assert.equal(error.code, "VISION_NOT_CONFIGURED");
        return true;
      }
    );
    await assert.rejects(
      () => vision.detectDocumentText(Buffer.from("document")),
      (error) => {
        assert.equal(error.code, "VISION_NOT_CONFIGURED");
        return true;
      }
    );
  } finally {
    if (original === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = original;
    vision.setVisionClientForTests(null);
  }
});

test("rejects cleanly with VISION_NOT_CONFIGURED when GOOGLE_APPLICATION_CREDENTIALS points to a missing file", async () => {
  const original = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = "/tmp/does-not-exist-vision-credentials.json";
  vision.setVisionClientForTests(null);

  try {
    await assert.rejects(
      () => vision.detectDocumentText(Buffer.from("document")),
      (error) => {
        assert.equal(error.code, "VISION_NOT_CONFIGURED");
        return true;
      }
    );
  } finally {
    if (original === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    else process.env.GOOGLE_APPLICATION_CREDENTIALS = original;
    vision.setVisionClientForTests(null);
  }
});
