const test = require("node:test");
const assert = require("node:assert/strict");
const vision = require("../services/ai/googleVision");

test("extractImageContext returns bounded text labels and objects", async () => {
  vision.setVisionClientForTests({
    annotateImage: async () => [{
      fullTextAnnotation: { text: "Equation x = 2" },
      labelAnnotations: [{ description: "Document" }],
      localizedObjectAnnotations: [{ name: "Book" }],
    }],
  });
  assert.deepEqual(await vision.extractImageContext(Buffer.from("image")), {
    text: "Equation x = 2",
    labels: ["Document"],
    objects: ["Book"],
  });
});

test("detectDocumentText returns the document annotation", async () => {
  const annotation = { text: "Study notes", pages: [{ width: 800, height: 1000 }] };
  vision.setVisionClientForTests({
    documentTextDetection: async () => [{ fullTextAnnotation: annotation }],
  });

  assert.equal(await vision.detectDocumentText(Buffer.from("document")), annotation);
});
