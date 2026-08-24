import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PdfLessonViewer from "./PdfLessonViewer";

const { mockPost, selectedLanguage } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  selectedLanguage: { value: "my" },
}));

vi.mock("../LanguageContext", () => ({
  useLang: () => ({ lang: selectedLanguage.value }),
}));

vi.mock("../services/api", () => ({
  default: { post: mockPost },
}));

vi.mock("react-pdf", async () => {
  const React = await import("react");
  return {
    pdfjs: { GlobalWorkerOptions: { workerSrc: "" } },
    Document: ({ children, onLoadSuccess }) => {
      React.useEffect(
        () => onLoadSuccess({ numPages: 5, getPage: vi.fn() }),
        [onLoadSuccess]
      );
      return <div data-testid="pdf-document">{children}</div>;
    },
    Page: ({ pageNumber, width }) => (
      <div data-testid={`rendered-page-${pageNumber}`} data-width={width}>
        PDF page {pageNumber}
      </div>
    ),
  };
});

afterEach(() => {
  cleanup();
  mockPost.mockReset();
  selectedLanguage.value = "my";
  vi.restoreAllMocks();
});

function makeHighlightState(overrides = {}) {
  return {
    status: "ready",
    progress: { completedPages: 5, totalPages: 5 },
    highlights: {},
    visible: true,
    setVisible: vi.fn(),
    preparePdf: vi.fn(),
    retry: vi.fn(),
    error: null,
    ...overrides,
  };
}

function renderViewer(overrides = {}) {
  const props = {
    fileUrl: "http://localhost/material.pdf",
    title: "Lesson PDF",
    bookmarks: [1],
    syncingPage: null,
    bookmarkError: null,
    onToggleBookmark: vi.fn(),
    onDismissEmptySpace: vi.fn(),
    ...overrides,
  };
  render(<PdfLessonViewer {...props} />);
  return props;
}

describe("PdfLessonViewer", () => {
  it("translates selected PDF text into the selected app language", async () => {
    mockPost.mockResolvedValue({ data: { translation: "နားလည်သည်" } });
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "understand",
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 20, left: 20, width: 80, height: 20 }) }),
    });

    renderViewer();
    fireEvent.mouseUp(await screen.findByTestId("pdf-page-surface"));
    fireEvent.click(screen.getByRole("button", { name: "Translate selected text" }));

    expect(mockPost).toHaveBeenCalledWith("/ai/translate", {
      text: "understand",
      targetLanguage: "my",
    });
    const dialog = await screen.findByRole("dialog", { name: "PDF translation" });
    expect(dialog.textContent).toContain("နားလည်သည်");
  });

  it("dismisses the PDF translation dialog", async () => {
    mockPost.mockResolvedValue({ data: { translation: "understand" } });
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "이해하다",
      rangeCount: 1,
      getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 20, left: 20, width: 80, height: 20 }) }),
    });

    renderViewer();
    fireEvent.mouseUp(await screen.findByTestId("pdf-page-surface"));
    fireEvent.click(screen.getByRole("button", { name: "Translate selected text" }));
    await screen.findByRole("dialog", { name: "PDF translation" });
    fireEvent.click(screen.getByRole("button", { name: "Close translation" }));

    expect(screen.queryByRole("dialog", { name: "PDF translation" })).toBeNull();
  });

  it("shows bookmark state for the current page and toggles that page", async () => {
    const props = renderViewer();

    expect(await screen.findByTestId("rendered-page-1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByTestId("rendered-page-2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save page 2" }));

    expect(props.onToggleBookmark).toHaveBeenCalledWith(2);
  });

  it("jumps directly to a page selected from saved pages", async () => {
    renderViewer({ bookmarks: [1, 4] });
    await screen.findByTestId("rendered-page-1");

    fireEvent.click(screen.getByRole("button", { name: "Open saved pages" }));
    fireEvent.click(screen.getByRole("button", { name: "Go to saved page 4" }));

    expect(screen.getByTestId("rendered-page-4")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "Saved pages" })).toBeNull();
  });

  it("clamps direct page entry to the loaded page range", async () => {
    renderViewer();
    await screen.findByTestId("rendered-page-1");

    const input = screen.getByRole("spinbutton", { name: "Page number" });
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByTestId("rendered-page-5")).toBeTruthy();
  });

  it("dismisses only when the empty viewer background is clicked", async () => {
    const props = renderViewer();
    await screen.findByTestId("rendered-page-1");

    fireEvent.click(screen.getByTestId("pdf-page-surface"));
    expect(props.onDismissEmptySpace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("pdf-viewer-background"));
    expect(props.onDismissEmptySpace).toHaveBeenCalledOnce();
  });

  it("disables bookmark controls while a page is synchronizing", async () => {
    renderViewer({ syncingPage: 1 });
    await screen.findByTestId("rendered-page-1");

    expect(screen.getByRole("button", { name: "Remove saved page 1" }).disabled).toBe(true);
  });

  it("moves between pages with the left and right arrow keys", async () => {
    renderViewer();
    await screen.findByTestId("rendered-page-1");

    const rightEvent = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(window, rightEvent);
    expect(rightEvent.defaultPrevented).toBe(true);
    expect(screen.getByTestId("rendered-page-2")).toBeTruthy();

    const leftEvent = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    });
    fireEvent(window, leftEvent);
    expect(leftEvent.defaultPrevented).toBe(true);
    expect(screen.getByTestId("rendered-page-1")).toBeTruthy();
  });

  it("keeps keyboard navigation within the loaded page range", async () => {
    renderViewer();
    await screen.findByTestId("rendered-page-1");

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByTestId("rendered-page-1")).toBeTruthy();

    for (let press = 0; press < 8; press += 1) {
      fireEvent.keyDown(window, { key: "ArrowRight" });
    }
    expect(screen.getByTestId("rendered-page-5")).toBeTruthy();
  });

  it("does not intercept arrows while the page input is focused", async () => {
    renderViewer();
    await screen.findByTestId("rendered-page-1");
    const input = screen.getByRole("spinbutton", { name: "Page number" });
    input.focus();

    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByTestId("rendered-page-1")).toBeTruthy();
  });

  it("preserves vertical arrows and modified key combinations", async () => {
    renderViewer();
    await screen.findByTestId("rendered-page-1");

    const downEvent = new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(downEvent);
    expect(downEvent.defaultPrevented).toBe(false);

    fireEvent.keyDown(window, { key: "ArrowRight", metaKey: true });
    expect(screen.getByTestId("rendered-page-1")).toBeTruthy();
  });

  it("ignores arrow navigation while the saved-page dialog is open", async () => {
    renderViewer({ bookmarks: [1, 4] });
    await screen.findByTestId("rendered-page-1");
    fireEvent.click(screen.getByRole("button", { name: "Open saved pages" }));

    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(screen.getByTestId("rendered-page-1")).toBeTruthy();
    expect(screen.getByRole("dialog", { name: "Saved pages" })).toBeTruthy();
  });

  it("zooms in, zooms out, and resets from the toolbar", async () => {
    renderViewer();
    const page = await screen.findByTestId("rendered-page-1");
    const baseWidth = Number(page.dataset.width);

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(Number(page.dataset.width)).toBe(baseWidth * 1.25);
    expect(screen.getByRole("button", { name: "Reset zoom to 100%" }).textContent).toContain("125%");

    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(Number(page.dataset.width)).toBe(baseWidth);

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom to 100%" }));
    expect(Number(page.dataset.width)).toBe(baseWidth);
  });

  it("clamps toolbar zoom between 50% and 200%", async () => {
    renderViewer();
    const page = await screen.findByTestId("rendered-page-1");
    const baseWidth = Number(page.dataset.width);
    const zoomOut = screen.getByRole("button", { name: "Zoom out" });
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });

    fireEvent.click(zoomOut);
    fireEvent.click(zoomOut);
    expect(Number(page.dataset.width)).toBe(baseWidth * 0.5);
    expect(zoomOut.disabled).toBe(true);

    for (let press = 0; press < 8; press += 1) fireEvent.click(zoomIn);
    expect(Number(page.dataset.width)).toBe(baseWidth * 2);
    expect(zoomIn.disabled).toBe(true);
  });

  it("supports Control and Command zoom shortcuts", async () => {
    renderViewer();
    const page = await screen.findByTestId("rendered-page-1");
    const baseWidth = Number(page.dataset.width);

    fireEvent.keyDown(window, { key: "+", ctrlKey: true });
    expect(Number(page.dataset.width)).toBe(baseWidth * 1.25);

    fireEvent.keyDown(window, { key: "-", metaKey: true });
    expect(Number(page.dataset.width)).toBe(baseWidth);

    fireEvent.keyDown(window, { key: "+", metaKey: true });
    fireEvent.keyDown(window, { key: "0", metaKey: true });
    expect(Number(page.dataset.width)).toBe(baseWidth);
  });

  it("ignores zoom shortcuts in the page input and saved-page dialog", async () => {
    renderViewer({ bookmarks: [1, 4] });
    const page = await screen.findByTestId("rendered-page-1");
    const baseWidth = Number(page.dataset.width);
    const input = screen.getByRole("spinbutton", { name: "Page number" });
    input.focus();

    fireEvent.keyDown(input, { key: "+", ctrlKey: true });
    expect(Number(page.dataset.width)).toBe(baseWidth);

    input.blur();
    fireEvent.click(screen.getByRole("button", { name: "Open saved pages" }));
    fireEvent.keyDown(window, { key: "+", ctrlKey: true });
    expect(Number(page.dataset.width)).toBe(baseWidth);
  });

  it("renders a page twice as wide at 200% zoom", async () => {
    renderViewer();
    const page = await screen.findByTestId("rendered-page-1");
    const baseWidth = Number(page.dataset.width);

    for (let press = 0; press < 4; press += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    }

    expect(Number(page.dataset.width)).toBe(baseWidth * 2);
  });

  describe("highlight integration", () => {
    it("calls onPdfReady with the loaded pdf proxy", async () => {
      const onPdfReady = vi.fn();
      renderViewer({ onPdfReady, highlightState: makeHighlightState() });
      await screen.findByTestId("rendered-page-1");

      expect(onPdfReady).toHaveBeenCalledTimes(1);
      const [pdfArg] = onPdfReady.mock.calls[0];
      expect(pdfArg.numPages).toBe(5);
      expect(typeof pdfArg.getPage).toBe("function");
    });

    it("renders only the current page's highlight regions", async () => {
      const highlightState = makeHighlightState({
        highlights: {
          1: [{
            id: 1, excerpt: "Page one highlight", explanation: "Explains page one",
            category: "concept", rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.05 }],
          }],
          2: [{
            id: 2, excerpt: "Page two highlight", explanation: "Explains page two",
            category: "concept", rects: [{ x: 0.15, y: 0.15, width: 0.2, height: 0.05 }],
          }],
        },
      });
      renderViewer({ highlightState });
      await screen.findByTestId("rendered-page-1");

      expect(screen.getByRole("button", { name: "Page one highlight" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Page two highlight" })).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Next page" }));

      expect(screen.getByRole("button", { name: "Page two highlight" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Page one highlight" })).toBeNull();
    });

    it("shows analysis progress in the toolbar while processing", async () => {
      renderViewer({
        highlightState: makeHighlightState({
          status: "processing",
          progress: { completedPages: 2, totalPages: 5 },
        }),
      });
      await screen.findByTestId("rendered-page-1");

      expect(
        screen.getByRole("status", { name: "AI highlight analysis progress" }).textContent
      ).toContain("2/5");
    });

    it("toggles ready highlights off and on from the toolbar", async () => {
      const setVisible = vi.fn();
      const highlightState = makeHighlightState({
        visible: true,
        setVisible,
        highlights: {
          1: [{
            id: 1, excerpt: "Page one highlight", explanation: "Explains page one",
            category: "concept", rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.05 }],
          }],
        },
      });
      renderViewer({ highlightState });
      await screen.findByTestId("rendered-page-1");

      expect(screen.getByRole("button", { name: "Page one highlight" })).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Toggle AI highlights" }));
      expect(setVisible).toHaveBeenCalledWith(false);
    });

    it("hides highlight regions when highlightState.visible is false", async () => {
      const highlightState = makeHighlightState({
        visible: false,
        highlights: {
          1: [{
            id: 1, excerpt: "Page one highlight", explanation: "Explains page one",
            category: "concept", rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.05 }],
          }],
        },
      });
      renderViewer({ highlightState });
      await screen.findByTestId("rendered-page-1");

      expect(screen.queryByRole("button", { name: "Page one highlight" })).toBeNull();
    });

    it("opens a highlight's popover on a real-coordinate click, without the region blocking the click from reaching the page", async () => {
      const highlightState = makeHighlightState({
        highlights: {
          1: [{
            id: 1, excerpt: "Page one highlight", explanation: "Explains page one",
            category: "concept", rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.05 }],
          }],
        },
      });
      renderViewer({ highlightState });
      const surface = await screen.findByTestId("pdf-page-surface");

      vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
        top: 0, left: 0, width: 1000, height: 1000, right: 1000, bottom: 1000,
      });

      // Inside the highlight's rect: x in [0.1, 0.3], y in [0.1, 0.15] of the page.
      fireEvent.mouseUp(surface, { clientX: 150, clientY: 120 });

      expect(await screen.findByRole("dialog", { name: "Page one highlight explanation" })).toBeTruthy();
    });

    it("does not open a popover on a real-coordinate click outside any highlight rect", async () => {
      const highlightState = makeHighlightState({
        highlights: {
          1: [{
            id: 1, excerpt: "Page one highlight", explanation: "Explains page one",
            category: "concept", rects: [{ x: 0.1, y: 0.1, width: 0.2, height: 0.05 }],
          }],
        },
      });
      renderViewer({ highlightState });
      const surface = await screen.findByTestId("pdf-page-surface");

      vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
        top: 0, left: 0, width: 1000, height: 1000, right: 1000, bottom: 1000,
      });

      fireEvent.mouseUp(surface, { clientX: 800, clientY: 800 });

      expect(screen.queryByRole("dialog", { name: "Page one highlight explanation" })).toBeNull();
    });

    it("shows a retry affordance on failure without removing the PDF page", async () => {
      const retry = vi.fn();
      renderViewer({ highlightState: makeHighlightState({ status: "failed", retry }) });
      await screen.findByTestId("rendered-page-1");

      const retryButton = screen.getByRole("button", { name: "AI 분석 재시도" });
      fireEvent.click(retryButton);

      expect(retry).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("rendered-page-1")).toBeTruthy();
    });
  });
});
