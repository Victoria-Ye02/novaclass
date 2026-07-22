import { useCallback, useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "./PdfLessonViewer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 175, 200];

function viewerPageWidth() {
  if (typeof window === "undefined") return 820;
  return window.innerWidth <= 640
    ? Math.max(240, window.innerWidth - 32)
    : Math.min(820, window.innerWidth - 160);
}

function isEditableTarget(target) {
  if (!(target instanceof Element)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || ["input", "textarea", "select"].includes(tagName);
}

export default function PdfLessonViewer({
  fileUrl,
  title,
  bookmarks,
  syncingPage,
  bookmarkError,
  onToggleBookmark,
  onDismissEmptySpace,
}) {
  const [numPages, setNumPages] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [pageWidth, setPageWidth] = useState(viewerPageWidth);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [savedPagesOpen, setSavedPagesOpen] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const savedPages = useMemo(
    () => [...new Set(bookmarks)].sort((a, b) => a - b),
    [bookmarks]
  );
  const currentPageSaved = savedPages.includes(currentPage);
  const bookmarkBusy = syncingPage !== null;
  const renderedPageWidth = pageWidth * zoomPercent / 100;

  useEffect(() => {
    const onResize = () => setPageWidth(viewerPageWidth());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onDocumentLoad = useCallback(({ numPages: loadedPageCount }) => {
    setNumPages(loadedPageCount);
    setCurrentPage(1);
    setPageInput("1");
    setLoadError(false);
  }, []);

  const changeZoom = useCallback((direction) => {
    setZoomPercent((currentZoom) => {
      const currentIndex = ZOOM_LEVELS.indexOf(currentZoom);
      const nextIndex = Math.min(
        Math.max(currentIndex + direction, 0),
        ZOOM_LEVELS.length - 1
      );
      return ZOOM_LEVELS[nextIndex];
    });
  }, []);

  const resetZoom = useCallback(() => setZoomPercent(100), []);

  const goToPage = useCallback((requestedPage) => {
    if (!numPages) return;
    const parsed = Number.parseInt(requestedPage, 10);
    const nextPage = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), numPages)
      : currentPage;
    setCurrentPage(nextPage);
    setPageInput(String(nextPage));
  }, [currentPage, numPages]);

  useEffect(() => {
    function onKeyDown(event) {
      if (
        savedPagesOpen ||
        event.defaultPrevented ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const zoomModifier = event.metaKey || event.ctrlKey;
      if (zoomModifier && !event.altKey) {
        if (event.key === "+" || event.key === "=") {
          event.preventDefault();
          changeZoom(1);
          return;
        }
        if (event.key === "-") {
          event.preventDefault();
          changeZoom(-1);
          return;
        }
        if (event.key === "0") {
          event.preventDefault();
          resetZoom();
          return;
        }
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      goToPage(currentPage + (event.key === "ArrowRight" ? 1 : -1));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [changeZoom, currentPage, goToPage, resetZoom, savedPagesOpen]);

  function commitPageInput() {
    goToPage(pageInput);
  }

  function onBackgroundClick(event) {
    if (event.target === event.currentTarget) onDismissEmptySpace?.();
  }

  return (
    <section className="pdf-lesson-viewer" aria-label={`PDF viewer: ${title}`}>
      <div className="pdf-viewer-toolbar" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="pdf-toolbar-button"
          aria-label="Previous page"
          aria-keyshortcuts="ArrowLeft"
          disabled={!numPages || currentPage <= 1}
          onClick={() => goToPage(currentPage - 1)}
        >
          ←
        </button>
        <label className="pdf-page-control">
          <span className="sr-only">Page number</span>
          <input
            aria-label="Page number"
            type="number"
            min="1"
            max={numPages || 1}
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={commitPageInput}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitPageInput();
            }}
          />
          <span aria-hidden="true">/</span>
          <span>{numPages || "—"}</span>
        </label>
        <button
          type="button"
          className="pdf-toolbar-button"
          aria-label="Next page"
          aria-keyshortcuts="ArrowRight"
          disabled={!numPages || currentPage >= numPages}
          onClick={() => goToPage(currentPage + 1)}
        >
          →
        </button>
        <span className="pdf-toolbar-divider" aria-hidden="true" />
        <div className="pdf-zoom-controls" role="group" aria-label="PDF zoom controls">
          <button
            type="button"
            className="pdf-toolbar-button pdf-zoom-step"
            aria-label="Zoom out"
            aria-keyshortcuts="Control+- Meta+-"
            disabled={zoomPercent === ZOOM_LEVELS[0]}
            onClick={() => changeZoom(-1)}
          >
            −
          </button>
          <button
            type="button"
            className="pdf-zoom-reset"
            aria-label="Reset zoom to 100%"
            aria-keyshortcuts="Control+0 Meta+0"
            onClick={resetZoom}
          >
            {zoomPercent}%
          </button>
          <button
            type="button"
            className="pdf-toolbar-button pdf-zoom-step"
            aria-label="Zoom in"
            aria-keyshortcuts="Control+= Meta+="
            disabled={zoomPercent === ZOOM_LEVELS.at(-1)}
            onClick={() => changeZoom(1)}
          >
            +
          </button>
        </div>
      </div>

      <div
        className="pdf-viewer-background"
        data-testid="pdf-viewer-background"
        onClick={onBackgroundClick}
      >
        {loadError ? (
          <div className="pdf-viewer-status" onClick={(event) => event.stopPropagation()}>
            <span className="pdf-status-icon" aria-hidden="true">!</span>
            <strong>PDF를 불러오지 못했습니다.</strong>
            <button
              type="button"
              className="pdf-retry-button"
              onClick={() => {
                setLoadError(false);
                setRetryKey((key) => key + 1);
              }}
            >
              다시 시도
            </button>
          </div>
        ) : (
          <div
            className="pdf-page-surface"
            data-testid="pdf-page-surface"
            onClick={(event) => event.stopPropagation()}
          >
            <Document
              key={retryKey}
              file={fileUrl}
              onLoadSuccess={onDocumentLoad}
              onLoadError={() => setLoadError(true)}
              loading={<div className="pdf-loading-card">PDF를 불러오는 중…</div>}
            >
              <Page
                pageNumber={currentPage}
                width={renderedPageWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                loading={<div className="pdf-page-skeleton" style={{ width: renderedPageWidth }} />}
              />
            </Document>
          </div>
        )}
      </div>

      <div className="pdf-floating-actions" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="pdf-saved-pages-button"
          aria-label="Open saved pages"
          aria-expanded={savedPagesOpen}
          onClick={() => setSavedPagesOpen((open) => !open)}
        >
          <span aria-hidden="true">☰</span>
          <span>{savedPages.length}</span>
        </button>
        <button
          type="button"
          className={`pdf-heart-button${currentPageSaved ? " is-saved" : ""}`}
          aria-label={`${currentPageSaved ? "Remove saved" : "Save"} page ${currentPage}`}
          aria-pressed={currentPageSaved}
          disabled={bookmarkBusy || !numPages}
          onClick={() => onToggleBookmark(currentPage)}
        >
          <span aria-hidden="true">{currentPageSaved ? "♥" : "♡"}</span>
          {syncingPage === currentPage && <span className="pdf-sync-dot" />}
        </button>
      </div>

      {bookmarkError && (
        <div className="pdf-bookmark-error" role="status" onClick={(event) => event.stopPropagation()}>
          {bookmarkError}
        </div>
      )}

      {savedPagesOpen && (
        <aside
          className="pdf-saved-pages-panel"
          role="dialog"
          aria-label="Saved pages"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pdf-saved-pages-header">
            <div>
              <strong>저장한 페이지</strong>
              <span>{savedPages.length}개</span>
            </div>
            <button
              type="button"
              aria-label="Close saved pages"
              onClick={() => setSavedPagesOpen(false)}
            >
              ×
            </button>
          </div>
          {savedPages.length === 0 ? (
            <div className="pdf-saved-empty">
              하트를 눌러 중요한 페이지를 저장해 보세요.
            </div>
          ) : (
            <div className="pdf-saved-page-list">
              {savedPages.map((page) => {
                const validPage = !numPages || page <= numPages;
                return (
                  <div className="pdf-saved-page-row" key={page}>
                    <button
                      type="button"
                      aria-label={`Go to saved page ${page}`}
                      disabled={!validPage}
                      className={page === currentPage ? "is-current" : ""}
                      onClick={() => {
                        goToPage(page);
                        setSavedPagesOpen(false);
                      }}
                    >
                      <span>페이지 {page}</span>
                      {page === currentPage && <small>현재</small>}
                      {!validPage && <small>없는 페이지</small>}
                    </button>
                    {!validPage && (
                      <button
                        type="button"
                        className="pdf-remove-invalid"
                        aria-label={`Remove saved page ${page}`}
                        disabled={bookmarkBusy}
                        onClick={() => onToggleBookmark(page)}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      )}
    </section>
  );
}
