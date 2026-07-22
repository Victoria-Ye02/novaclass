import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PdfLessonViewer from "./PdfLessonViewer";

vi.mock("react-pdf", async () => {
  const React = await import("react");
  return {
    pdfjs: { GlobalWorkerOptions: { workerSrc: "" } },
    Document: ({ children, onLoadSuccess }) => {
      React.useEffect(() => onLoadSuccess({ numPages: 5 }), [onLoadSuccess]);
      return <div data-testid="pdf-document">{children}</div>;
    },
    Page: ({ pageNumber }) => (
      <div data-testid={`rendered-page-${pageNumber}`}>PDF page {pageNumber}</div>
    ),
  };
});

afterEach(cleanup);

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
});
