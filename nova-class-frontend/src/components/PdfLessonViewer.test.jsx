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
});
