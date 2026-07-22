import { pdfjs } from "react-pdf";

// Pages with less real text than this are treated as scanned images and
// routed to OCR instead of geometry extraction.
const SCANNED_TEXT_THRESHOLD = 20;
// Normalized rectangles are scale-independent, so any viewport scale works
// for text extraction; 1 keeps the underlying pixel math simple to reason about.
const TEXT_EXTRACTION_SCALE = 1;
// Scale used when rendering a scanned page to an image for OCR.
const SCAN_RENDER_SCALE = 1.5;

function nonWhitespaceLength(text) {
  return typeof text === "string" ? text.replace(/\s+/g, "").length : 0;
}

function isScannedPage(items) {
  const joinedText = items.map((item) => item.str || "").join("");
  return nonWhitespaceLength(joinedText) < SCANNED_TEXT_THRESHOLD;
}

function candidateRect(item, viewport) {
  const transform = pdfjs.Util.transform(viewport.transform, item.transform);
  const x = transform[4];
  const y = transform[5];
  const width = item.width * viewport.scale;
  const height = item.height * viewport.scale;

  return {
    x: x / viewport.width,
    y: (y - height) / viewport.height,
    width: width / viewport.width,
    height: height / viewport.height,
  };
}

function isValidRect(rect) {
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function textCandidates(items, viewport, pageNumber) {
  const candidates = [];
  for (const item of items) {
    if (nonWhitespaceLength(item.str) === 0) continue;
    const rect = candidateRect(item, viewport);
    if (!isValidRect(rect)) continue;
    candidates.push({
      id: `p${pageNumber}-i${candidates.length}`,
      text: item.str.trim(),
      rect,
    });
  }
  return candidates;
}

async function renderPageImage(page) {
  const viewport = page.getViewport({ scale: SCAN_RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const canvasContext = canvas.getContext("2d");

  await page.render({ canvasContext, viewport }).promise;

  const image = await new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });

  // Release the offscreen canvas's backing store now that the Blob holds
  // the rendered bytes.
  canvas.width = 0;
  canvas.height = 0;

  return image;
}

export async function extractPdfPage(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const textContent = await page.getTextContent();
  const items = textContent.items || [];

  if (isScannedPage(items)) {
    return { sourceType: "ocr", image: await renderPageImage(page) };
  }

  const viewport = page.getViewport({ scale: TEXT_EXTRACTION_SCALE });
  return {
    sourceType: "text",
    candidates: textCandidates(items, viewport, pageNumber),
  };
}
