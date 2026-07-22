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
  default: { get: vi.fn() },
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

vi.mock("../../components/PdfLessonViewer", () => ({
  default: ({ onDismissEmptySpace, highlightState, onPdfReady }) => (
    <div data-testid="controlled-pdf-viewer">
      <button type="button" onClick={() => onDismissEmptySpace?.()}>
        Click empty PDF space
      </button>
      <span data-testid="highlight-status">{highlightState?.status}</span>
      <button type="button" onClick={() => onPdfReady?.({ numPages: 3, getPage: vi.fn() })}>
        Trigger PDF ready
      </button>
    </div>
  ),
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
});
