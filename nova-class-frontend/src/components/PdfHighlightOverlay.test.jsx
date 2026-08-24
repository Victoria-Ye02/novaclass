import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PdfHighlightOverlay from "./PdfHighlightOverlay";

afterEach(cleanup);

const highlight = {
  id: 3,
  excerpt: "Key idea",
  explanation: "Core concept",
  category: "concept",
  rects: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.05 }],
};

describe("PdfHighlightOverlay", () => {
  it("renders a percentage-positioned region button", () => {
    render(<PdfHighlightOverlay highlights={[highlight]} visible />);
    const region = screen.getByRole("button", { name: "Key idea" });

    expect(region.style.left).toBe("10%");
    expect(region.style.top).toBe("20%");
    expect(region.style.width).toBe("40%");
    expect(region.style.height).toBe("5%");
  });

  it("renders no regions when visible is false", () => {
    render(<PdfHighlightOverlay highlights={[highlight]} visible={false} />);

    expect(screen.queryByRole("button", { name: "Key idea" })).toBeNull();
  });

  it("shows an explanation popover when a region is selected", () => {
    render(<PdfHighlightOverlay highlights={[highlight]} visible />);

    fireEvent.click(screen.getByRole("button", { name: "Key idea" }));

    expect(screen.getByRole("dialog", { name: "Key idea explanation" })).toBeTruthy();
    expect(screen.getByText("Core concept")).toBeTruthy();
  });

  it("closes the popover on Escape", () => {
    render(<PdfHighlightOverlay highlights={[highlight]} visible />);
    fireEvent.click(screen.getByRole("button", { name: "Key idea" }));
    expect(screen.getByRole("dialog", { name: "Key idea explanation" })).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "Key idea explanation" })).toBeNull();
  });

  it("closes the popover when clicking outside the overlay", () => {
    render(
      <div>
        <button type="button">Outside</button>
        <PdfHighlightOverlay highlights={[highlight]} visible />
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: "Key idea" }));
    expect(screen.getByRole("dialog", { name: "Key idea explanation" })).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Outside" }));

    expect(screen.queryByRole("dialog", { name: "Key idea explanation" })).toBeNull();
  });

  it("closes the popover when the highlights prop changes (page change)", () => {
    const { rerender } = render(<PdfHighlightOverlay highlights={[highlight]} visible />);
    fireEvent.click(screen.getByRole("button", { name: "Key idea" }));
    expect(screen.getByRole("dialog", { name: "Key idea explanation" })).toBeTruthy();

    rerender(<PdfHighlightOverlay highlights={[]} visible />);

    expect(screen.queryByRole("dialog", { name: "Key idea explanation" })).toBeNull();
  });

  it("closes the popover on document visibility change", () => {
    render(<PdfHighlightOverlay highlights={[highlight]} visible />);
    fireEvent.click(screen.getByRole("button", { name: "Key idea" }));
    expect(screen.getByRole("dialog", { name: "Key idea explanation" })).toBeTruthy();

    fireEvent(document, new Event("visibilitychange"));

    expect(screen.queryByRole("dialog", { name: "Key idea explanation" })).toBeNull();
  });

  it("calls onSelect with the highlight when a region is clicked", () => {
    const onSelect = vi.fn();
    render(<PdfHighlightOverlay highlights={[highlight]} visible onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Key idea" }));

    expect(onSelect).toHaveBeenCalledWith(highlight);
  });

  it("keeps pointer events off the layer and off each region button, so a real mouse drag can select the text underneath", () => {
    render(<PdfHighlightOverlay highlights={[highlight]} visible />);

    const overlay = screen.getByTestId("pdf-highlight-overlay");
    const region = screen.getByRole("button", { name: "Key idea" });

    expect(overlay.style.pointerEvents).toBe("none");
    expect(region.style.pointerEvents).toBe("none");
  });

  it("opens a highlight's popover when the parent drives selection via activateId", () => {
    const { rerender } = render(<PdfHighlightOverlay highlights={[highlight]} visible activateId={null} />);
    expect(screen.queryByRole("dialog", { name: "Key idea explanation" })).toBeNull();

    rerender(<PdfHighlightOverlay highlights={[highlight]} visible activateId={3} />);

    expect(screen.getByRole("dialog", { name: "Key idea explanation" })).toBeTruthy();
  });
});
