const { detectDocumentText } = require("./googleVision");
const { normalizeCandidates } = require("../highlights/candidates");
const { withRetries } = require("../highlights/retry");

function coordinate(vertex, key) {
  return vertex?.[key] === undefined ? 0 : vertex[key];
}

function wordRect(word, pageWidth, pageHeight) {
  const vertices = word?.boundingBox?.vertices;
  if (!Array.isArray(vertices) || vertices.length === 0) return null;

  const xs = vertices.map(vertex => coordinate(vertex, "x"));
  const ys = vertices.map(vertex => coordinate(vertex, "y"));
  if (![...xs, ...ys].every(Number.isFinite)) return null;

  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);

  return {
    x: left / pageWidth,
    y: top / pageHeight,
    width: (right - left) / pageWidth,
    height: (bottom - top) / pageHeight,
  };
}

async function ocrPage(buffer) {
  const annotation = await withRetries(
    () => detectDocumentText(buffer),
    { retries: 3, baseDelayMs: 250 }
  );
  const candidates = [];

  for (const [pageIndex, page] of (annotation?.pages || []).entries()) {
    if (!Number.isFinite(page?.width) || page.width <= 0
      || !Number.isFinite(page?.height) || page.height <= 0) continue;

    let wordIndex = 0;
    for (const block of page.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const word of paragraph.words || []) {
          candidates.push({
            id: `ocr-p${pageIndex + 1}-i${wordIndex}`,
            text: (word.symbols || []).map(symbol => symbol?.text || "").join(""),
            rect: wordRect(word, page.width, page.height),
          });
          wordIndex += 1;
        }
      }
    }
  }

  return normalizeCandidates(candidates);
}

module.exports = { ocrPage };
