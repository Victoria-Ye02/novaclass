import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import API from "../../services/api";
import { useMaterialHighlights } from "../../hooks/useMaterialHighlights";
import MaterialPreview from "./MaterialPreview";

const navigate = vi.fn();
const { selectedLanguage, currentParams } = vi.hoisted(() => ({
  selectedLanguage: { value: "en" },
  currentParams: { id: "4", materialId: "9" },
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  useParams: () => currentParams,
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock("../../LanguageContext", () => ({
  useLang: () => ({ lang: selectedLanguage.value }),
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
    currentParams.id = "4";
    currentParams.materialId = "9";
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

  it("sends the student's current page on every teacher request, including after they turn a page mid-lesson", async () => {
    API.post
      .mockResolvedValueOnce({ data: { reply: "Sure, here's page 1." } })
      .mockResolvedValueOnce({ data: { reply: "Now on page 2." } });
    render(<MaterialPreview />);
    await screen.findByTestId("controlled-pdf-viewer");
    fireEvent.click(screen.getByLabelText("Open AI chat"));
    await screen.findByText("Sure, here's page 1.");
    const [, startBody] = API.post.mock.calls[0];
    expect(startBody.level).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Trigger page change" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue lesson" }));

    await waitFor(() => expect(API.post).toHaveBeenLastCalledWith(
      "/classroom/materials/9/ai",
      expect.objectContaining({ mode: "teacher", teachingIntent: "continue", currentPage: 2, totalPages: 41 })
    ));
  });

  it("starts Nova Teacher automatically as soon as the material loads, without waiting for the chat panel to be opened", async () => {
    API.post.mockResolvedValue({ data: { reply: "Today we will learn about databases." } });
    render(<MaterialPreview />);
    await screen.findByTestId("controlled-pdf-viewer");

    await waitFor(() => expect(API.post).toHaveBeenCalledWith(
      "/classroom/materials/9/ai",
      expect.objectContaining({
        action: "chat",
        mode: "teacher",
        teachingIntent: "start",
        currentPage: 1,
      })
    ));
  });

  it("continues a Nova Teacher lesson from the quick action", async () => {
    API.post
      .mockResolvedValueOnce({ data: { reply: "A database stores organized data." } })
      .mockResolvedValueOnce({ data: { reply: "Now let's learn about tables." } });
    render(<MaterialPreview />);
    await screen.findByTestId("controlled-pdf-viewer");

    fireEvent.click(screen.getByLabelText("Open AI chat"));
    await screen.findByText("A database stores organized data.");
    fireEvent.click(screen.getByRole("button", { name: "Continue lesson" }));

    await waitFor(() => expect(API.post).toHaveBeenLastCalledWith(
      "/classroom/materials/9/ai",
      expect.objectContaining({ mode: "teacher", teachingIntent: "continue" })
    ));
    await screen.findByText("Now let's learn about tables.");
  });

  it("resumes (rather than restarts) a lesson this material already has saved history for", async () => {
    API.get.mockImplementation((url) => {
      if (url.includes("chat-history")) {
        return Promise.resolve({ data: { messages: [{ role: "assistant", content: "We learned about primary keys." }] } });
      }
      return Promise.resolve({ data: pdfMaterial() });
    });
    API.post.mockResolvedValue({ data: { reply: "Welcome back — let's continue." } });
    render(<MaterialPreview />);
    await screen.findByTestId("controlled-pdf-viewer");

    await waitFor(() => expect(API.post).toHaveBeenCalledWith(
      "/classroom/materials/9/ai",
      expect.objectContaining({ mode: "teacher", teachingIntent: "continue" })
    ));
    expect(await screen.findByText("We learned about primary keys.")).toBeTruthy();
  });

  it("sends the Settings-selected language to the AI chat instead of always English", async () => {
    selectedLanguage.value = "my";
    try {
      API.post.mockResolvedValue({ data: { reply: "မိုက်တိုကွန်ဒရီယာ..." } });
      render(<MaterialPreview />);
      await screen.findByTestId("controlled-pdf-viewer");

      await waitFor(() => expect(API.post).toHaveBeenCalledWith(
        "/classroom/materials/9/ai",
        expect.objectContaining({ lang: "my" })
      ));
    } finally {
      selectedLanguage.value = "en";
    }
  });

  it("resets the AI chat panel when switching to a different material, instead of leaking the previous material's conversation into it", async () => {
    API.post.mockResolvedValueOnce({ data: { reply: "This lesson covers the POS system's Java/JDBC implementation." } });

    const { rerender } = render(<MaterialPreview />);
    await screen.findByTestId("controlled-pdf-viewer");

    fireEvent.click(screen.getByLabelText("Open AI chat"));

    await screen.findByText("This lesson covers the POS system's Java/JDBC implementation.");

    // Switch to a different material — same overlay/route shape, just a new
    // materialId, the way clicking to another lesson in the same session does.
    currentParams.materialId = "12";
    API.get.mockResolvedValue({ data: { ...pdfMaterial(), id: 12, title: "Grammar: Superlatives" } });
    rerender(<MaterialPreview />);
    await screen.findByTestId("controlled-pdf-viewer");

    expect(screen.queryByText("This lesson covers the POS system's Java/JDBC implementation.")).toBeNull();
    expect(screen.getByText("👋 Hello. I'm Professor Nova, ready to guide you through this lesson.")).toBeTruthy();
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
    // Voice input records raw audio (MediaRecorder) and transcribes it with
    // Whisper server-side, rather than using the browser's own
    // SpeechRecognition — so these fakes stand in for the Web Audio /
    // MediaRecorder pipeline instead of a recognition API. The component's
    // own voice-activity loop polls the fake analyser on each
    // requestAnimationFrame tick and compares against Date.now(), so tests
    // drive it by advancing a fake clock and firing queued rAF callbacks by
    // hand — mirroring VOICE_MIN_SPEECH_MS / VOICE_SILENCE_TIMEOUT_MS from
    // MaterialPreview.jsx.
    const MIN_SPEECH_MS = 500;
    const SILENCE_TIMEOUT_MS = 900;

    class FakeAnalyserNode {
      constructor() { this.fftSize = 512; this.volume = 0; }
      getByteTimeDomainData(data) {
        const deviation = Math.min(127, Math.round(this.volume * 128));
        for (let i = 0; i < data.length; i++) data[i] = 128 + (i % 2 === 0 ? deviation : -deviation);
      }
    }

    class FakeAudioContext {
      constructor() {
        this.analyser = new FakeAnalyserNode();
        FakeAudioContext.instances.push(this);
      }
      createMediaStreamSource() { return { connect: () => {} }; }
      createAnalyser() { return this.analyser; }
      close() { return Promise.resolve(); }
    }
    FakeAudioContext.instances = [];

    class FakeMediaRecorder {
      constructor(stream) {
        this.stream = stream;
        this.state = "inactive";
        this.mimeType = "audio/webm";
        this.ondataavailable = null;
        this.onstop = null;
        FakeMediaRecorder.instances.push(this);
      }
      start() { this.state = "recording"; }
      stop() {
        if (this.state === "inactive") return;
        this.state = "inactive";
        this.ondataavailable?.({ data: new Blob(["audio"], { type: this.mimeType }) });
        this.onstop?.();
      }
    }
    FakeMediaRecorder.instances = [];

    function fakeMicStream() {
      return { getTracks: () => [{ stop: vi.fn() }] };
    }

    let systemNow;
    let rafCallbacks;

    function tickVad() {
      const callbacks = rafCallbacks;
      rafCallbacks = [];
      callbacks.forEach(cb => cb());
    }

    function advance(ms) { systemNow += ms; }

    function setVolume(level) {
      FakeAudioContext.instances[FakeAudioContext.instances.length - 1].analyser.volume = level;
    }

    // Drives a full listening turn from silence, through enough sustained
    // "speech" to count as a real answer, back to silence past the timeout —
    // the same three-tick shape the component's own loop needs to notice
    // speech started, confirm it lasted, then notice it stopped.
    async function completeListeningTurn() {
      setVolume(0.5);
      advance(50);
      tickVad();
      advance(MIN_SPEECH_MS + 100);
      tickVad();
      setVolume(0);
      advance(SILENCE_TIMEOUT_MS + 100);
      tickVad();
    }

    beforeEach(() => {
      FakeAudioContext.instances.length = 0;
      FakeMediaRecorder.instances.length = 0;
      systemNow = 1_000_000;
      rafCallbacks = [];
      vi.spyOn(Date, "now").mockImplementation(() => systemNow);
      vi.stubGlobal("requestAnimationFrame", (cb) => { rafCallbacks.push(cb); return rafCallbacks.length; });
      vi.stubGlobal("cancelAnimationFrame", () => {});
      vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
      vi.stubGlobal("AudioContext", FakeAudioContext);
      Object.defineProperty(window.navigator, "mediaDevices", {
        value: { getUserMedia: vi.fn().mockResolvedValue(fakeMicStream()) },
        configurable: true,
      });
      vi.stubGlobal("SpeechSynthesisUtterance", function (text) { this.text = text; });
      vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
    });

    async function openChatAndVoiceMode() {
      render(<MaterialPreview />);
      await screen.findByTestId("controlled-pdf-viewer");
      fireEvent.click(screen.getByLabelText("Open AI chat"));
      await waitFor(() => expect(API.post).toHaveBeenCalledWith(
        "/classroom/materials/9/ai",
        expect.objectContaining({ mode: "teacher", teachingIntent: "start" }),
      ));
      fireEvent.click(screen.getByLabelText("Start voice chat"));
      await screen.findByText("Listening…");
    }

    it("hides the microphone button when the browser has no voice input support", async () => {
      Object.defineProperty(window.navigator, "mediaDevices", { value: undefined, configurable: true });
      vi.stubGlobal("MediaRecorder", undefined);
      render(<MaterialPreview />);
      await screen.findByTestId("controlled-pdf-viewer");
      fireEvent.click(screen.getByLabelText("Open AI chat"));
      await waitFor(() => expect(API.post).toHaveBeenCalledWith(
        "/classroom/materials/9/ai",
        expect.objectContaining({ mode: "teacher", teachingIntent: "start" }),
      ));

      expect(screen.queryByLabelText("Start voice chat")).toBeNull();
    });

    it("opens the voice overlay and starts recording as soon as the mic button is tapped", async () => {
      await openChatAndVoiceMode();

      expect(FakeMediaRecorder.instances).toHaveLength(1);
      expect(FakeMediaRecorder.instances[0].state).toBe("recording");
    });

    it("transcribes the recording, sends it to Nova Teacher, and speaks the reply", async () => {
      API.post.mockImplementation((url) => {
        if (url === "/multimodal/transcribe") return Promise.resolve({ data: { text: "what is the mitochondria" } });
        if (url === "/classroom/materials/9/ai") return Promise.resolve({ data: { reply: "The mitochondria is the powerhouse of the cell." } });
        return Promise.reject(new Error(`Unexpected POST ${url}`));
      });
      await openChatAndVoiceMode();

      await completeListeningTurn();

      await waitFor(() => expect(API.post).toHaveBeenCalledWith("/multimodal/transcribe", expect.any(FormData)));
      await waitFor(() => expect(API.post).toHaveBeenCalledWith(
        "/classroom/materials/9/ai",
        expect.objectContaining({ mode: "teacher", teachingIntent: "answer", message: "what is the mitochondria", voice: true }),
      ));
      // Appears twice: once in the chat log behind the overlay, once as the
      // voice mode's on-screen caption of what the AI is saying.
      await waitFor(() => expect(
        screen.getAllByText("The mitochondria is the powerhouse of the cell.").length
      ).toBeGreaterThanOrEqual(2));
      expect(screen.getByText("You: what is the mitochondria")).toBeTruthy();
      await waitFor(() => expect(speechSynthesis.speak).toHaveBeenCalledTimes(1));
      expect(screen.getByText("Speaking…")).toBeTruthy();
    });

    it("cuts Nova off and starts capturing the student's question as soon as they start talking over her — no tap needed", async () => {
      API.post.mockImplementation((url) => {
        if (url === "/multimodal/transcribe") return Promise.resolve({ data: { text: "first question" } });
        if (url === "/classroom/materials/9/ai") return Promise.resolve({ data: { reply: "First answer." } });
        return Promise.reject(new Error(`Unexpected POST ${url}`));
      });
      await openChatAndVoiceMode();
      await completeListeningTurn();
      await waitFor(() => expect(speechSynthesis.speak).toHaveBeenCalledTimes(1));
      expect(screen.getByText("Speaking…")).toBeTruthy();

      // speak() starts a second recording segment purely to watch for a
      // barge-in — not a fresh one the student had to ask for by tapping.
      expect(FakeMediaRecorder.instances).toHaveLength(2);

      // The student starts talking over Nova.
      setVolume(0.5);
      advance(50);
      tickVad();

      expect(speechSynthesis.cancel).toHaveBeenCalled();
      expect(await screen.findByText("Listening…")).toBeTruthy();
      // Continues the very same recording — interrupting doesn't spin up a
      // third instance.
      expect(FakeMediaRecorder.instances).toHaveLength(2);

      // The same recording captures the rest of what they actually meant to
      // say, exactly like a normal turn would.
      API.post.mockImplementation((url) => {
        if (url === "/multimodal/transcribe") return Promise.resolve({ data: { text: "wait actually never mind" } });
        if (url === "/classroom/materials/9/ai") return Promise.resolve({ data: { reply: "Second answer." } });
        return Promise.reject(new Error(`Unexpected POST ${url}`));
      });
      advance(MIN_SPEECH_MS + 100);
      tickVad();
      setVolume(0);
      advance(SILENCE_TIMEOUT_MS + 100);
      tickVad();

      await waitFor(() => expect(API.post).toHaveBeenCalledWith(
        "/classroom/materials/9/ai",
        expect.objectContaining({ message: "wait actually never mind" }),
      ));
    });

    it("automatically starts listening again once speech finishes, without needing another tap", async () => {
      API.post.mockImplementation((url) => {
        if (url === "/multimodal/transcribe") return Promise.resolve({ data: { text: "a question" } });
        if (url === "/classroom/materials/9/ai") return Promise.resolve({ data: { reply: "Answer." } });
        return Promise.reject(new Error(`Unexpected POST ${url}`));
      });
      await openChatAndVoiceMode();
      await completeListeningTurn();
      await waitFor(() => expect(speechSynthesis.speak).toHaveBeenCalledTimes(1));

      const utterance = speechSynthesis.speak.mock.calls[0][0];
      utterance.onend();

      expect(await screen.findByText("Listening…")).toBeTruthy();
      // [0] the initial listening segment, [1] speak()'s barge-in watcher —
      // reused in place as the next listening turn rather than a fresh
      // third recorder.
      expect(FakeMediaRecorder.instances).toHaveLength(2);
    });

    it("keeps listening (rather than going silent) when a recording ends with no speech captured", async () => {
      await openChatAndVoiceMode();
      const recorder = FakeMediaRecorder.instances[0];

      recorder.stop(); // e.g. the max-turn safety cap, or any stop with nothing said

      expect(await screen.findByText("Listening…")).toBeTruthy();
      expect(FakeMediaRecorder.instances).toHaveLength(2);
    });

    it("returns to the ready state once speech finishes if voice mode was closed in the meantime", async () => {
      API.post.mockImplementation((url) => {
        if (url === "/multimodal/transcribe") return Promise.resolve({ data: { text: "a question" } });
        if (url === "/classroom/materials/9/ai") return Promise.resolve({ data: { reply: "Answer." } });
        return Promise.reject(new Error(`Unexpected POST ${url}`));
      });
      await openChatAndVoiceMode();
      await completeListeningTurn();
      await waitFor(() => expect(speechSynthesis.speak).toHaveBeenCalledTimes(1));
      const utterance = speechSynthesis.speak.mock.calls[0][0];

      fireEvent.click(screen.getByLabelText("Close voice chat"));
      utterance.onend();

      expect(screen.queryByText("Listening…")).toBeNull();
      // [0] the initial listening segment, [1] the barge-in watcher from
      // speak() — closing already stopped it; onend firing afterward
      // shouldn't start a third.
      expect(FakeMediaRecorder.instances).toHaveLength(2);
    });

    it("stops recording and cancels speech when voice mode is closed", async () => {
      await openChatAndVoiceMode();
      const recorder = FakeMediaRecorder.instances[0];
      const stopSpy = vi.spyOn(recorder, "stop");

      fireEvent.click(screen.getByLabelText("Close voice chat"));

      expect(stopSpy).toHaveBeenCalled();
      expect(speechSynthesis.cancel).toHaveBeenCalled();
      expect(screen.queryByText("Listening…")).toBeNull();
    });

    it("also closes voice mode from the prominent End Voice Chat button", async () => {
      await openChatAndVoiceMode();
      const recorder = FakeMediaRecorder.instances[0];
      const stopSpy = vi.spyOn(recorder, "stop");

      fireEvent.click(screen.getByText("End Voice Chat"));

      expect(stopSpy).toHaveBeenCalled();
      expect(screen.queryByText("Listening…")).toBeNull();
    });

    // AIChatPanel never unmounts when the sidebar is collapsed — it only
    // slides out of view with CSS — so a voice session left open would
    // otherwise keep listening and replying indefinitely in the background,
    // invisible, once the student collapses the sidebar by its handle
    // instead of using the voice panel's own End Voice Chat/X button.
    it("also stops the mic when the chat sidebar itself is collapsed, not just via the voice panel's own close button", async () => {
      await openChatAndVoiceMode();
      const recorder = FakeMediaRecorder.instances[0];
      const stopSpy = vi.spyOn(recorder, "stop");

      fireEvent.click(screen.getByLabelText("Close AI chat"));

      expect(stopSpy).toHaveBeenCalled();
    });
  });
});
