import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PdfThumbnailSidebar from "./PdfThumbnailSidebar";

afterEach(cleanup);

function makeFakePage(width = 600, height = 800) {
  return {
    getViewport: vi.fn(({ scale }) => ({ width: width * scale, height: height * scale, scale })),
    render: vi.fn(),
  };
}

describe("PdfThumbnailSidebar", () => {
  it("renders one thumbnail button per page", () => {
    render(
      <PdfThumbnailSidebar
        pdfDocument={{ getPage: vi.fn() }}
        numPages={3}
        currentPage={1}
        onSelectPage={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Go to page 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to page 2" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to page 3" })).toBeTruthy();
  });

  it("marks only the current page's thumbnail as active", () => {
    render(
      <PdfThumbnailSidebar
        pdfDocument={{ getPage: vi.fn() }}
        numPages={3}
        currentPage={2}
        onSelectPage={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Go to page 2" }).getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("button", { name: "Go to page 1" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("button", { name: "Go to page 3" }).getAttribute("aria-current")).toBeNull();
  });

  it("calls onSelectPage with the clicked page number", () => {
    const onSelectPage = vi.fn();
    render(
      <PdfThumbnailSidebar
        pdfDocument={{ getPage: vi.fn() }}
        numPages={3}
        currentPage={1}
        onSelectPage={onSelectPage}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Go to page 3" }));

    expect(onSelectPage).toHaveBeenCalledWith(3);
  });

  it("renders nothing when there are no pages yet", () => {
    const { container } = render(
      <PdfThumbnailSidebar
        pdfDocument={null}
        numPages={0}
        currentPage={1}
        onSelectPage={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders each page onto its own canvas at a thumbnail-sized viewport", async () => {
    // jsdom has no real canvas backend; getContext("2d") returns null unless
    // stubbed, matching the convention used in pdfHighlightExtraction.test.js.
    const getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({});
    const fakePage = makeFakePage(600, 800);
    const getPage = vi.fn().mockResolvedValue(fakePage);

    render(
      <PdfThumbnailSidebar
        pdfDocument={{ getPage }}
        numPages={1}
        currentPage={1}
        onSelectPage={vi.fn()}
      />
    );

    await waitFor(() => expect(fakePage.render).toHaveBeenCalledTimes(1));

    expect(getPage).toHaveBeenCalledWith(1);
    // Requested a small thumbnail-scale viewport, not full page size.
    const [{ scale }] = fakePage.getViewport.mock.calls.at(-1);
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThan(1);
    const renderArgs = fakePage.render.mock.calls[0][0];
    expect(renderArgs.viewport).toBeTruthy();
    expect(renderArgs.canvasContext).toBeTruthy();

    getContextSpy.mockRestore();
  });

  it("does not throw when getPage has no implementation (bare mock)", () => {
    expect(() => render(
      <PdfThumbnailSidebar
        pdfDocument={{ getPage: vi.fn() }}
        numPages={2}
        currentPage={1}
        onSelectPage={vi.fn()}
      />
    )).not.toThrow();
  });
});
