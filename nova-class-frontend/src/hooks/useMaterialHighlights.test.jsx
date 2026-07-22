import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import API from "../services/api";
import { extractPdfPage } from "../services/pdfHighlightExtraction";
import { useMaterialHighlights } from "./useMaterialHighlights";

vi.mock("../services/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../services/pdfHighlightExtraction", () => ({
  extractPdfPage: vi.fn(),
}));

vi.mock("../utils/retryRequest", () => ({
  retryRequest: vi.fn((operation) => operation()),
}));

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function missingResponse() {
  return {
    data: {
      status: "missing",
      progress: { completedPages: 0, totalPages: 0 },
      submittedPages: [],
      highlights: {},
    },
  };
}

function textCandidate(pageNumber) {
  return {
    sourceType: "text",
    candidates: [
      { id: `p${pageNumber}-i0`, text: "Key idea", rect: { x: 0.1, y: 0.1, width: 0.2, height: 0.05 } },
    ],
  };
}

describe("useMaterialHighlights", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("reuses a ready cache found on mount without starting preparation", async () => {
    API.get.mockResolvedValue({
      data: {
        status: "ready",
        progress: { completedPages: 4, totalPages: 4 },
        submittedPages: [1, 2, 3, 4],
        highlights: { 1: [{ id: 9, excerpt: "Key idea", explanation: "Why", category: "concept", rects: [] }] },
      },
    });

    const { result } = renderHook(() => useMaterialHighlights({ materialId: "7", enabled: true }));

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.highlights).toEqual({
      1: [{ id: 9, excerpt: "Key idea", explanation: "Why", category: "concept", rects: [] }],
    });
    expect(API.get).toHaveBeenCalledWith(
      "/classroom/materials/7/highlights",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    await act(async () => {
      await result.current.preparePdf({ numPages: 4 });
    });
    expect(API.post).not.toHaveBeenCalled();
  });

  it("waits for preparePdf when no cached analysis exists", async () => {
    API.get.mockResolvedValue(missingResponse());

    const { result } = renderHook(() => useMaterialHighlights({ materialId: "7", enabled: true }));

    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(API.post).not.toHaveBeenCalled();
  });

  it("submits every missing page, completes, and then polls until ready", async () => {
    API.get.mockResolvedValueOnce(missingResponse());
    API.post.mockImplementation((url) => {
      if (url.endsWith("/highlights/start")) {
        return Promise.resolve({
          data: { analysisId: 5, status: "pending", progress: { completedPages: 0, totalPages: 3 }, submittedPages: [1] },
        });
      }
      if (url.endsWith("/highlights/pages")) {
        return Promise.resolve({ data: { analysisId: 5, pageNumber: 1, sourceType: "text", candidateCount: 1 } });
      }
      if (url.endsWith("/highlights/complete")) {
        return Promise.resolve({ data: { analysisId: 5, status: "processing" } });
      }
      throw new Error(`Unexpected POST ${url}`);
    });
    extractPdfPage.mockImplementation((_pdf, pageNumber) => Promise.resolve(textCandidate(pageNumber)));

    const { result } = renderHook(() => useMaterialHighlights({ materialId: "7", enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("idle"));

    API.get.mockResolvedValueOnce({
      data: {
        status: "processing",
        progress: { completedPages: 0, totalPages: 3 },
        submittedPages: [1, 2, 3],
        highlights: {},
      },
    });

    await act(async () => {
      await result.current.preparePdf({ numPages: 3 });
    });

    expect(extractPdfPage).toHaveBeenCalledTimes(2);
    expect(extractPdfPage).toHaveBeenCalledWith(expect.anything(), 2);
    expect(extractPdfPage).toHaveBeenCalledWith(expect.anything(), 3);
    expect(extractPdfPage).not.toHaveBeenCalledWith(expect.anything(), 1);

    expect(API.post).toHaveBeenCalledWith(
      "/classroom/materials/7/highlights/start",
      { totalPages: 3 },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(API.post).toHaveBeenCalledWith(
      "/classroom/materials/7/highlights/complete",
      { analysisId: 5 },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.status).toBe("processing");

    API.get.mockResolvedValueOnce({
      data: {
        status: "ready",
        progress: { completedPages: 3, totalPages: 3 },
        submittedPages: [1, 2, 3],
        highlights: { 2: [{ id: 1, excerpt: "e", explanation: "x", category: "concept", rects: [] }] },
      },
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.status).toBe("ready");
    expect(result.current.highlights).toEqual({
      2: [{ id: 1, excerpt: "e", explanation: "x", category: "concept", rects: [] }],
    });
  });

  it("submits scanned pages as multipart form data carrying the rendered image", async () => {
    API.get.mockResolvedValueOnce(missingResponse());
    API.post.mockImplementation((url) => {
      if (url.endsWith("/highlights/start")) {
        return Promise.resolve({
          data: { analysisId: 11, status: "pending", progress: { completedPages: 0, totalPages: 1 }, submittedPages: [] },
        });
      }
      if (url.endsWith("/highlights/pages")) {
        return Promise.resolve({ data: { analysisId: 11, pageNumber: 1, sourceType: "ocr", candidateCount: 2 } });
      }
      if (url.endsWith("/highlights/complete")) {
        return Promise.resolve({ data: { analysisId: 11, status: "processing" } });
      }
      throw new Error(`Unexpected POST ${url}`);
    });
    const image = new Blob(["fake-png-bytes"], { type: "image/png" });
    extractPdfPage.mockResolvedValue({ sourceType: "ocr", image });

    const { result } = renderHook(() => useMaterialHighlights({ materialId: "12", enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("idle"));

    API.get.mockResolvedValueOnce({
      data: { status: "processing", progress: { completedPages: 0, totalPages: 1 }, submittedPages: [1], highlights: {} },
    });

    await act(async () => {
      await result.current.preparePdf({ numPages: 1 });
    });

    const pagesCall = API.post.mock.calls.find(([url]) => url.endsWith("/highlights/pages"));
    expect(pagesCall).toBeTruthy();
    const [, formData] = pagesCall;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("analysisId")).toBe("11");
    expect(formData.get("pageNumber")).toBe("1");
    expect(formData.get("sourceType")).toBe("ocr");
    const submittedImage = formData.get("image");
    expect(submittedImage).toBeInstanceOf(Blob);
    expect(submittedImage.name).toBe("page-1.png");
  });

  it("stops polling and aborts in-flight requests on unmount", async () => {
    API.get.mockResolvedValueOnce({
      data: { status: "processing", progress: { completedPages: 1, totalPages: 2 }, submittedPages: [1], highlights: {} },
    });

    const { result, unmount } = renderHook(() => useMaterialHighlights({ materialId: "7", enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("processing"));
    expect(API.get).toHaveBeenCalledTimes(1);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(API.get).toHaveBeenCalledTimes(1);
  });

  it("exposes retry after a failed analysis and resumes polling", async () => {
    API.get.mockResolvedValueOnce({
      data: { status: "failed", progress: { completedPages: 1, totalPages: 2 }, submittedPages: [1], highlights: {} },
    });

    const { result } = renderHook(() => useMaterialHighlights({ materialId: "7", enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("failed"));
    expect(result.current.error).toBeTruthy();
    expect(typeof result.current.retry).toBe("function");

    API.post.mockResolvedValueOnce({
      data: { analysisId: 3, status: "processing", progress: { completedPages: 1, totalPages: 2 } },
    });
    API.get.mockResolvedValueOnce({
      data: { status: "processing", progress: { completedPages: 1, totalPages: 2 }, submittedPages: [1], highlights: {} },
    });

    await act(async () => {
      await result.current.retry();
    });

    expect(API.post).toHaveBeenCalledWith(
      "/classroom/materials/7/highlights/retry",
      {},
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.status).toBe("processing");
    expect(result.current.error).toBeNull();
  });

  it("defaults visibility to true and allows toggling", async () => {
    API.get.mockResolvedValue(missingResponse());

    const { result } = renderHook(() => useMaterialHighlights({ materialId: "7", enabled: true }));
    expect(result.current.visible).toBe(true);

    act(() => result.current.setVisible(false));
    expect(result.current.visible).toBe(false);
  });

  it("does not start duplicate preparation when preparePdf is invoked twice before the first call resolves", async () => {
    API.get.mockResolvedValueOnce(missingResponse());
    const deferredStart = createDeferred();
    API.post.mockImplementation((url) => {
      if (url.endsWith("/highlights/start")) return deferredStart.promise;
      if (url.endsWith("/highlights/pages")) return Promise.resolve({ data: {} });
      if (url.endsWith("/highlights/complete")) return Promise.resolve({ data: { analysisId: 1, status: "processing" } });
      throw new Error(`Unexpected POST ${url}`);
    });
    extractPdfPage.mockResolvedValue(textCandidate(1));

    const { result } = renderHook(() => useMaterialHighlights({ materialId: "7", enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("idle"));

    const pdf = { numPages: 1 };
    let firstCall;
    let secondCall;
    await act(async () => {
      firstCall = result.current.preparePdf(pdf);
      secondCall = result.current.preparePdf(pdf);
      deferredStart.resolve({
        data: { analysisId: 1, status: "pending", progress: { completedPages: 0, totalPages: 1 }, submittedPages: [] },
      });
      await Promise.all([firstCall, secondCall]);
    });

    const startCalls = API.post.mock.calls.filter(([url]) => url.endsWith("/highlights/start"));
    expect(startCalls).toHaveLength(1);
  });
});
