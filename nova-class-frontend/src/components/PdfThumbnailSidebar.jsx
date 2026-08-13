import { useEffect, useRef } from "react";

const THUMBNAIL_WIDTH = 110;

function ThumbnailPage({ pdfDocument, pageNumber, active, onSelect }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!pdfDocument) return undefined;

    const pending = pdfDocument.getPage(pageNumber);
    if (!pending || typeof pending.then !== "function") return undefined;

    let cancelled = false;
    pending
      .then((page) => {
        if (cancelled || !page) return;
        const canvas = canvasRef.current;
        if (!canvas) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const scale = THUMBNAIL_WIDTH / baseViewport.width;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const canvasContext = canvas.getContext("2d");
        if (!canvasContext) return;
        page.render({ canvasContext, viewport });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pdfDocument, pageNumber]);

  return (
    <button
      type="button"
      className={`pdf-thumbnail-item${active ? " is-active" : ""}`}
      aria-current={active ? "true" : undefined}
      aria-label={`Go to page ${pageNumber}`}
      onClick={() => onSelect(pageNumber)}
    >
      <canvas ref={canvasRef} className="pdf-thumbnail-canvas" />
      <span className="pdf-thumbnail-number">{pageNumber}</span>
    </button>
  );
}

export default function PdfThumbnailSidebar({ pdfDocument, numPages, currentPage, onSelectPage }) {
  if (!numPages) return null;

  const pages = Array.from({ length: numPages }, (_, index) => index + 1);

  return (
    <nav className="pdf-thumbnail-list" aria-label="Page thumbnails">
      {pages.map((pageNumber) => (
        <ThumbnailPage
          key={pageNumber}
          pdfDocument={pdfDocument}
          pageNumber={pageNumber}
          active={pageNumber === currentPage}
          onSelect={onSelectPage}
        />
      ))}
    </nav>
  );
}
