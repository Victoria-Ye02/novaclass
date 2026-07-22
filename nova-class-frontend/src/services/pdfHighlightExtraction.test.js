import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractPdfPage } from "./pdfHighlightExtraction";

// Mirrors PDF.js's real affine-transform composition so the geometry math
// under test is the same math the browser would produce.
function composeTransform(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

vi.mock("react-pdf", () => ({
  pdfjs: {
    Util: { transform: composeTransform },
  },
}));

function textViewport() {
  return { width: 200, height: 100, scale: 1, transform: [1, 0, 0, -1, 0, 100] };
}

function makePage({ items, viewport, renderResult }) {
  return {
    getTextContent: vi.fn().mockResolvedValue({ items }),
    getViewport: vi.fn().mockReturnValue(viewport),
    render: vi.fn().mockReturnValue({ promise: Promise.resolve(renderResult) }),
  };
}

function makePdf(page) {
  return { getPage: vi.fn().mockResolvedValue(page) };
}

describe("extractPdfPage", () => {
  describe("when the page has extractable text", () => {
    it("returns stable, page-scoped ids and rectangles normalized to the viewport", async () => {
      const items = [
        { str: "Hello world", transform: [10, 0, 0, 10, 20, 80], width: 60, height: 10 },
        { str: "   ", transform: [10, 0, 0, 10, 20, 70], width: 5, height: 5 },
        { str: "Second line of text", transform: [10, 0, 0, 10, 20, 60], width: 90, height: 10 },
        { str: "Invalid rect", transform: [10, 0, 0, 10, 20, 50], width: 0, height: 10 },
      ];
      const page = makePage({ items, viewport: textViewport() });
      const pdf = makePdf(page);

      const result = await extractPdfPage(pdf, 2);

      expect(result.sourceType).toBe("text");
      expect(result.candidates).toEqual([
        {
          id: "p2-i0",
          text: "Hello world",
          rect: { x: 0.1, y: 0.1, width: 0.3, height: 0.1 },
        },
        {
          id: "p2-i1",
          text: "Second line of text",
          rect: { x: 0.1, y: 0.3, width: 0.45, height: 0.1 },
        },
      ]);
      expect(page.render).not.toHaveBeenCalled();
    });

    it("discards whitespace-only items and non-positive rectangles without consuming an id", async () => {
      const items = [
        { str: "\n\t ", transform: [10, 0, 0, 10, 20, 80], width: 60, height: 10 },
        { str: "Zero width", transform: [10, 0, 0, 10, 20, 70], width: 0, height: 10 },
        { str: "Zero height", transform: [10, 0, 0, 10, 20, 60], width: 60, height: 0 },
        { str: "Kept text here for the page", transform: [10, 0, 0, 10, 20, 50], width: 60, height: 10 },
      ];
      const page = makePage({ items, viewport: textViewport() });
      const pdf = makePdf(page);

      const result = await extractPdfPage(pdf, 5);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].id).toBe("p5-i0");
      expect(result.candidates[0].text).toBe("Kept text here for the page");
    });
  });

  describe("when the page has no meaningful extractable text", () => {
    let toBlobMock;
    let fakeCanvas;
    let createElementSpy;

    beforeEach(() => {
      toBlobMock = vi.fn((callback, type) => {
        callback(new Blob(["fake-png-bytes"], { type }));
      });
      fakeCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({}),
        toBlob: toBlobMock,
      };
      const originalCreateElement = document.createElement.bind(document);
      createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tagName) => {
        if (tagName === "canvas") return fakeCanvas;
        return originalCreateElement(tagName);
      });
    });

    afterEach(() => {
      createElementSpy.mockRestore();
    });

    it("treats fewer than 20 non-whitespace characters as a scan and renders a PNG at scale 1.5", async () => {
      const items = [{ str: "Pg 3", transform: [1, 0, 0, 1, 0, 0], width: 10, height: 10 }];
      const scanViewport = { width: 300, height: 400, scale: 1.5, transform: [1.5, 0, 0, -1.5, 0, 400] };
      const page = makePage({ items, viewport: scanViewport });
      const pdf = makePdf(page);

      const result = await extractPdfPage(pdf, 3);

      expect(result.sourceType).toBe("ocr");
      expect(result.image).toBeInstanceOf(Blob);
      expect(result.image.type).toBe("image/png");

      expect(page.getViewport).toHaveBeenCalledWith({ scale: 1.5 });
      expect(page.render).toHaveBeenCalledWith({
        canvasContext: fakeCanvas.getContext.mock.results[0].value,
        viewport: scanViewport,
      });
      expect(toBlobMock).toHaveBeenCalledWith(expect.any(Function), "image/png");

      // Canvas dimensions are set for rendering, then released after the Blob exists.
      expect(fakeCanvas.width).toBe(0);
      expect(fakeCanvas.height).toBe(0);
    });

    it("treats an empty text page the same as a scan", async () => {
      const scanViewport = { width: 300, height: 400, scale: 1.5, transform: [1.5, 0, 0, -1.5, 0, 400] };
      const page = makePage({ items: [], viewport: scanViewport });
      const pdf = makePdf(page);

      const result = await extractPdfPage(pdf, 7);

      expect(result).toEqual({ sourceType: "ocr", image: expect.any(Blob) });
    });
  });
});
