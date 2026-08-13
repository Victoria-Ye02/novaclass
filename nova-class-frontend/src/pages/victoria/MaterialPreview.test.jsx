import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import API from "../../services/api";
import { useMaterialHighlights } from "../../hooks/useMaterialHighlights";
import MaterialPreview from "./MaterialPreview";

const navigate = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  useParams: () => ({ id: "4", materialId: "9" }),
}));

vi.mock("../../services/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("../../hooks/useMaterialBookmarks", () => ({
  useMaterialBookmarks: () => ({
    bookmarks: [2],
    loading: false,
    syncingPage: null,
    error: null,
    toggleBookmark: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock("../../hooks/useMaterialHighlights", () => ({
  useMaterialHighlights: vi.fn(),
}));

const capturedOnPageChangeRefs = [];

vi.mock("../../components/PdfLessonViewer", () => ({
  default: ({ onDismissEmptySpace, highlightState, onPdfReady, onPageChange }) => {
    capturedOnPageChangeRefs.push(onPageChange);
    return (
      <div data-testid="controlled-pdf-viewer">
        <button type="button" onClick={() => onDismissEmptySpace?.()}>
          Click empty PDF space
        </button>
        <span data-testid="highlight-status">{highlightState?.status}</span>
        <button type="button" onClick={() => onPdfReady?.({ numPages: 3, getPage: vi.fn() })}>
          Trigger PDF ready
        </button>
        <button type="button" onClick={() => onPageChange?.(2, 41)}>
          Trigger page change
        </button>
      </div>
    );
  },
}));

function pdfMaterial() {
  return {
    id: 9,
    title: "Database Lesson",
    file_ext: "pdf",
    file_url: "/classroom/materials/9/file",
  };
}

describe("MaterialPreview PDF integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnPageChangeRefs.length = 0;
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key) => key === "nova_token" ? "test-token" : null),
      setItem: vi.fn(),
      clear: vi.fn(),
    });
    API.get.mockResolvedValue({ data: pdfMaterial() });
    useMaterialHighlights.mockReturnValue({
      status: "ready",
      progress: { completedPages: 5, totalPages: 5 },
      highlights: {},
      visible: true,
      setVisible: vi.fn(),
      preparePdf: vi.fn(),
      retry: vi.fn(),
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("closes an overlay when the controlled viewer reports an empty-space click", async () => {
    render(<MaterialPreview isOverlay />);
    expect(await screen.findByTestId("controlled-pdf-viewer")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Click empty PDF space" }));

    expect(navigate).toHaveBeenCalledWith(-1);
  });

  it("keeps a standalone preview open after an empty-space click", async () => {
    render(<MaterialPreview />);
    expect(await screen.findByTestId("controlled-pdf-viewer")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Click empty PDF space" }));

    expect(navigate).not.toHaveBeenCalled();
  });

  it("fills the viewport in overlay mode", async () => {
    render(<MaterialPreview isOverlay />);

    await screen.findByTestId("controlled-pdf-viewer");
    const card = screen.getByTestId("material-overlay-card");

    expect(card.style.width).toBe("100vw");
    expect(card.style.height).toBe("100dvh");
    expect(card.style.maxWidth).toBe("none");
    expect(card.style.borderRadius).toBe("0px");
  });

  it("preserves the existing image preview path", async () => {
    API.get.mockResolvedValue({
      data: {
        id: 9,
        title: "Diagram",
        file_ext: "png",
        file_url: "/classroom/materials/9/file",
      },
    });

    render(<MaterialPreview />);

    await waitFor(() => expect(screen.getByRole("img", { name: "Diagram" })).toBeTruthy());
    expect(screen.queryByTestId("controlled-pdf-viewer")).toBeNull();
  });

  it("connects useMaterialHighlights for the current material and passes its state to the viewer", async () => {
    render(<MaterialPreview />);
    await screen.findByTestId("controlled-pdf-viewer");

    expect(useMaterialHighlights).toHaveBeenCalledWith({ materialId: "9", enabled: true });
    expect(screen.getByTestId("highlight-status").textContent).toBe("ready");
  });

  it("wires onPdfReady to the hook's preparePdf callback", async () => {
    const preparePdf = vi.fn();
    useMaterialHighlights.mockReturnValue({
      status: "processing",
      progress: { completedPages: 1, totalPages: 3 },
      highlights: {},
      visible: true,
      setVisible: vi.fn(),
      preparePdf,
      retry: vi.fn(),
      error: null,
    });

    render(<MaterialPreview />);
    await screen.findByTestId("controlled-pdf-viewer");

    fireEvent.click(screen.getByRole("button", { name: "Trigger PDF ready" }));

    expect(preparePdf).toHaveBeenCalledWith({ numPages: 3, getPage: expect.any(Function) });
  });

  it("sends the current page to the AI chat in assistant mode, not the quiz-tutor level", async () => {
    API.post.mockResolvedValue({ data: { reply: "Sure, here's page 2." } });
    render(<MaterialPreview />);
    await screen.findByTestId("controlled-pdf-viewer");

    fireEvent.click(screen.getByRole("button", { name: "Trigger page change" }));
    fireEvent.click(screen.getByLabelText("Open AI chat"));

    const input = await screen.findByPlaceholderText("Ask about this lesson…");
    fireEvent.change(input, { target: { value: "explain this page" } });
    fireEvent.click(screen.getByLabelText("Send message"));

    await waitFor(() => expect(API.post).toHaveBeenCalledWith(
      "/classroom/materials/9/ai",
      expect.objectContaining({
        action: "chat",
        mode: "assistant",
        message: "explain this page",
        currentPage: 2,
        totalPages: 41,
      })
    ));
    const [, body] = API.post.mock.calls[0];
    expect(body.level).toBeUndefined();
  });

  it("passes a referentially stable onPageChange callback across re-renders (regression: an inline callback here previously caused an infinite render loop)", async () => {
    render(<MaterialPreview />);
    await screen.findByTestId("controlled-pdf-viewer");

    const refsBeforeCount = capturedOnPageChangeRefs.length;
    expect(refsBeforeCount).toBeGreaterThan(0);
    const refBefore = capturedOnPageChangeRefs.at(-1);

    // Triggering a page change updates state in MaterialPreview, which
    // re-renders PdfLessonViewer with a fresh onPageChange prop. If that
    // prop isn't memoized, its identity changes every time it fires, which
    // (combined with PdfLessonViewer's own effect depending on it) is exactly
    // the shape of bug that produces "Maximum update depth exceeded."
    fireEvent.click(screen.getByRole("button", { name: "Trigger page change" }));

    const refAfter = capturedOnPageChangeRefs.at(-1);
    expect(refAfter).toBe(refBefore);
  });

  describe("AI Chat voice mode", () => {
    // A minimal fake of the browser SpeechRecognition API. Real instances are
    // event-driven (onresult/onerror/onend callbacks fired by the browser as
    // the user speaks); this lets tests drive that lifecycle by hand.
    class FakeSpeechRecognition {
      constructor() {
        FakeSpeechRecognition.instances.push(this);
        this.lang = "";
        this.interimResults = false;
        this.onresult = null;
        this.onerror = null;
        this.onend = null;
      }
      start() {}
      stop() { this.onend?.(); }
    }
    FakeSpeechRecognition.instances = [];

    function speechResult(transcript, { isFinal = true } = {}) {
      const alt = { transcript };
      const result = Object.assign([alt], { isFinal });
      return { resultIndex: 0, results: [result] };
    }

    beforeEach(() => {
      FakeSpeechRecognition.instances.length = 0;
      vi.stubGlobal("SpeechRecognition", FakeSpeechRecognition);
      vi.stubGlobal("SpeechSynthesisUtterance", function (text) { this.text = text; });
      vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
    });

    async function openChatAndVoiceMode() {
      render(<MaterialPreview />);
      await screen.findByTestId("controlled-pdf-viewer");
      fireEvent.click(screen.getByLabelText("Open AI chat"));
      await screen.findByPlaceholderText("Ask about this lesson…");
      fireEvent.click(screen.getByLabelText("Start voice chat"));
    }

    it("hides the microphone button when the browser has no SpeechRecognition support", async () => {
      vi.unstubAllGlobals();
      vi.stubGlobal("localStorage", {
        getItem: vi.fn((key) => key === "nova_token" ? "test-token" : null),
        setItem: vi.fn(), clear: vi.fn(),
      });
      render(<MaterialPreview />);
      await screen.findByTestId("controlled-pdf-viewer");
      fireEvent.click(screen.getByLabelText("Open AI chat"));
      await screen.findByPlaceholderText("Ask about this lesson…");

      expect(screen.queryByLabelText("Start voice chat")).toBeNull();
    });

    it("opens the voice overlay and starts listening as soon as the mic button is tapped", async () => {
      await openChatAndVoiceMode();

      expect(screen.getByText("Listening…")).toBeTruthy();
      expect(FakeSpeechRecognition.instances).toHaveLength(1);
    });

    it("sends the final transcript to the assistant-mode AI endpoint and speaks the reply", async () => {
      API.post.mockResolvedValueOnce({ data: { reply: "The mitochondria is the powerhouse of the cell." } });
      await openChatAndVoiceMode();
      const recognition = FakeSpeechRecognition.instances[0];

      recognition.onresult(speechResult("what is the mitochondria"));

      await waitFor(() => expect(API.post).toHaveBeenCalledWith(
        "/classroom/materials/9/ai",
        expect.objectContaining({ mode: "assistant", message: "what is the mitochondria" }),
      ));
      // Appears twice: once in the chat log behind the overlay, once as the
      // voice mode's on-screen caption of what the AI is saying.
      await waitFor(() => expect(
        screen.getAllByText("The mitochondria is the powerhouse of the cell.").length
      ).toBeGreaterThanOrEqual(2));
      expect(screen.getByText("You: what is the mitochondria")).toBeTruthy();
      expect(speechSynthesis.speak).toHaveBeenCalledTimes(1);
      expect(screen.getByText("Speaking…")).toBeTruthy();
    });

    it("returns to the ready state to talk again once speech finishes", async () => {
      API.post.mockResolvedValueOnce({ data: { reply: "Answer." } });
      await openChatAndVoiceMode();
      const recognition = FakeSpeechRecognition.instances[0];
      recognition.onresult(speechResult("a question"));
      await waitFor(() => expect(speechSynthesis.speak).toHaveBeenCalledTimes(1));

      const utterance = speechSynthesis.speak.mock.calls[0][0];
      utterance.onend();

      expect(await screen.findByText("Tap to talk")).toBeTruthy();
    });

    it("stops recognition and cancels speech when voice mode is closed", async () => {
      await openChatAndVoiceMode();
      const recognition = FakeSpeechRecognition.instances[0];
      const stopSpy = vi.spyOn(recognition, "stop");

      fireEvent.click(screen.getByLabelText("Close voice chat"));

      expect(stopSpy).toHaveBeenCalled();
      expect(speechSynthesis.cancel).toHaveBeenCalled();
      expect(screen.queryByText("Listening…")).toBeNull();
    });

    it("also closes voice mode from the prominent End Voice Chat button", async () => {
      await openChatAndVoiceMode();
      const recognition = FakeSpeechRecognition.instances[0];
      const stopSpy = vi.spyOn(recognition, "stop");

      fireEvent.click(screen.getByText("End Voice Chat"));

      expect(stopSpy).toHaveBeenCalled();
      expect(screen.queryByText("Listening…")).toBeNull();
    });
  });
});
