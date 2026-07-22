import { useEffect, useRef, useState } from "react";
import "./PdfLessonViewer.css";

function toPercent(fraction) {
  return `${fraction * 100}%`;
}

export default function PdfHighlightOverlay({ highlights = [], visible, onSelect }) {
  const [selectedId, setSelectedId] = useState(null);
  const containerRef = useRef(null);

  // A new `highlights` array reference means the page changed (or the
  // underlying data was refreshed) — either way, a stale popover shouldn't
  // linger pointing at a region that may no longer be on screen. Adjusting
  // state during render (rather than in an effect) avoids an extra
  // commit-then-rerender cascade for this "reset on prop change" case.
  const [previousHighlights, setPreviousHighlights] = useState(highlights);
  if (previousHighlights !== highlights) {
    setPreviousHighlights(highlights);
    setSelectedId(null);
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onPointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setSelectedId(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    function onVisibilityChange() {
      setSelectedId(null);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  if (!visible) return null;

  const selectedHighlight = highlights.find((highlight) => highlight.id === selectedId) || null;

  return (
    <div
      className="pdf-highlight-overlay"
      data-testid="pdf-highlight-overlay"
      ref={containerRef}
      style={{ pointerEvents: "none" }}
    >
      {highlights.map((highlight) =>
        (highlight.rects || []).map((rect, rectIndex) => (
          <button
            key={`${highlight.id}-${rectIndex}`}
            type="button"
            className={`pdf-highlight-region${selectedId === highlight.id ? " is-selected" : ""}`}
            style={{
              left: toPercent(rect.x),
              top: toPercent(rect.y),
              width: toPercent(rect.width),
              height: toPercent(rect.height),
              pointerEvents: "auto",
            }}
            aria-label={highlight.excerpt}
            onClick={(event) => {
              event.stopPropagation();
              setSelectedId(highlight.id);
              onSelect?.(highlight);
            }}
          />
        ))
      )}

      {selectedHighlight && (
        <div
          className="pdf-highlight-popover"
          role="dialog"
          aria-label={`${selectedHighlight.excerpt} explanation`}
          style={{ pointerEvents: "auto" }}
        >
          <strong className="pdf-highlight-popover-excerpt">{selectedHighlight.excerpt}</strong>
          <p className="pdf-highlight-popover-explanation">{selectedHighlight.explanation}</p>
          <button
            type="button"
            className="pdf-highlight-popover-close"
            aria-label="Close highlight explanation"
            onClick={() => setSelectedId(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
