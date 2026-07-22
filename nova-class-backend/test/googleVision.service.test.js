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
