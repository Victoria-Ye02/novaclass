# PDF Smart Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically analyze text and scanned classroom PDFs, cache shared AI-selected regions, and render aligned Smart Highlights directly over each PDF page.

**Architecture:** PDF.js extracts normalized text geometry in the browser and renders an image only for scanned pages. Authenticated backend endpoints cache page candidates, use Google Vision for scan OCR, start one GPT-OSS analysis job per material/version, and persist normalized highlight rectangles. A frontend hook orchestrates cache lookup, page submission, polling, visibility, retry, and page overlays.

**Tech Stack:** React 19, React-PDF/PDF.js, Axios, Vitest, Express 5, MySQL, Google Cloud Vision, Groq `openai/gpt-oss-120b`, Node test runner.

## Global Constraints

- Execute `2026-07-22-project-ai-model-standardization.md` and `2026-07-22-pdf-true-zoom-fullscreen.md` first; this plan consumes their AI and page-sizing interfaces.
- Analysis starts automatically when a PDF opens and is shared per material.
- Text PDFs and scanned PDFs are both supported.
- Google Vision is used only for OCR; GPT-OSS selects importance from bounded text candidates.
- Page images are held in memory for OCR and are never persisted.
- Failed OCR or AI batches retry at most three times with exponential delay.
- PDF viewing, bookmarks, navigation, and zoom remain available during failure or processing.
- All routes enforce existing classroom membership access.

---

### Task 1: Highlight Persistence Schema

**Files:**
- Modify: `nova-class-backend/scripts/setup_db.js`
- Create: `nova-class-backend/test/highlight-schema.test.js`

**Interfaces:**
- Produces tables `material_highlight_analyses`, `material_highlight_pages`, and `material_pdf_highlights`.
- Analysis statuses are `pending`, `processing`, `ready`, and `failed`.

- [ ] **Step 1: Add a failing schema source test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("setup creates cascading material highlight tables", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "setup_db.js"), "utf8");
  for (const table of ["material_highlight_analyses", "material_highlight_pages", "material_pdf_highlights"]) {
    assert.match(source, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(source, /UNIQUE KEY unique_material_highlight_analysis/);
  assert.match(source, /ON DELETE CASCADE/);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd nova-class-backend && node --test test/highlight-schema.test.js`

Expected: FAIL because the analysis tables do not exist.

- [ ] **Step 3: Add the schema**

Add tables with these required columns:

```sql
CREATE TABLE IF NOT EXISTS material_highlight_analyses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  source_fingerprint CHAR(64) NOT NULL,
  analysis_version INT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('pending','processing','ready','failed') NOT NULL DEFAULT 'pending',
  total_pages INT UNSIGNED NOT NULL,
  completed_pages INT UNSIGNED NOT NULL DEFAULT 0,
  failure_code VARCHAR(80),
  attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_material_highlight_analysis (material_id, source_fingerprint, analysis_version),
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);
```

`material_highlight_pages` stores unique `(analysis_id, page_number)`, `source_type ENUM('text','ocr')`, and `candidates_json LONGTEXT`. `material_pdf_highlights` stores analysis ID, page number, excerpt, explanation, category, `rects_json JSON`, and display order. Both foreign keys cascade from the analysis.

- [ ] **Step 4: Run the schema test**

Run: `cd nova-class-backend && node --test test/highlight-schema.test.js`

Expected: PASS.

- [ ] **Step 5: Apply the schema to the configured local database**

Run: `cd nova-class-backend && node scripts/setup_db.js`

Expected: `✅ All tables created successfully`.

- [ ] **Step 6: Commit**

```bash
git add nova-class-backend/scripts/setup_db.js nova-class-backend/test/highlight-schema.test.js
git commit -m "feat: add PDF highlight persistence"
```

### Task 2: Candidate Validation, OCR Geometry, and Retry Services

**Files:**
- Create: `nova-class-backend/services/highlights/candidates.js`
- Create: `nova-class-backend/services/highlights/retry.js`
- Create: `nova-class-backend/services/ai/googleVisionOcr.js`
- Create: `nova-class-backend/test/highlight-services.test.js`

**Interfaces:**
- `normalizeCandidates(input)` returns at most 2,000 valid `{ id, text, rect }` records.
- `ocrPage(buffer)` returns candidates with normalized `[0,1]` rectangles.
- `withRetries(operation, { retries: 3, baseDelayMs })` retries three times after the initial attempt.

- [ ] **Step 1: Write failing validation and retry tests**

```js
test("normalizeCandidates removes invalid and out-of-range geometry", () => {
  assert.deepEqual(normalizeCandidates([
    { id: "p1-i1", text: " Key idea ", rect: { x: 0.1, y: 0.2, width: 0.4, height: 0.05 } },
    { id: "bad", text: "", rect: { x: -1, y: 0, width: 2, height: 1 } },
  ]), [{ id: "p1-i1", text: "Key idea", rect: { x: 0.1, y: 0.2, width: 0.4, height: 0.05 } }]);
});

test("withRetries permits one attempt plus three retries", async () => {
  let attempts = 0;
  const result = await withRetries(async () => {
    attempts += 1;
    if (attempts < 4) throw new Error("temporary");
    return "ok";
  }, { retries: 3, baseDelayMs: 0 });
  assert.equal(result, "ok");
  assert.equal(attempts, 4);
});
```

Also mock Vision's `fullTextAnnotation.pages[].blocks[].paragraphs[].words[]` and assert `ocrPage` joins symbols and converts bounding vertices using detected page width and height.

- [ ] **Step 2: Run and verify missing-module failure**

Run: `cd nova-class-backend && node --test test/highlight-services.test.js`

Expected: FAIL because the services do not exist.

- [ ] **Step 3: Implement strict normalization and retry**

Use finite-number checks, clamp rectangles to the page, discard empty or zero-area regions, cap text at 1,000 characters per candidate, cap candidate count at 2,000, and reject duplicate IDs. Implement exponential delays as `baseDelayMs * 2 ** retryIndex` and allow injection of `baseDelayMs: 0` in tests.

- [ ] **Step 4: Implement OCR mapping**

Call `detectDocumentText(buffer)` from the model-standardization plan and map every word's symbol text and bounding vertices into normalized rectangles. Wrap that call in `withRetries(..., { retries: 3, baseDelayMs: 250 })`. Do not write the input buffer to disk.

- [ ] **Step 5: Run service tests**

Run: `cd nova-class-backend && node --test test/highlight-services.test.js`

Expected: validation, coordinate, and four-attempt tests PASS.

- [ ] **Step 6: Commit**

```bash
git add nova-class-backend/services/highlights nova-class-backend/services/ai/googleVisionOcr.js nova-class-backend/test/highlight-services.test.js
git commit -m "feat: prepare PDF highlight candidates"
```

### Task 3: Authenticated Highlight API and Shared Job

**Files:**
- Create: `nova-class-backend/controllers/victoria/highlight.controller.js`
- Create: `nova-class-backend/services/highlights/analyze.js`
- Create: `nova-class-backend/test/highlight.controller.test.js`
- Modify: `nova-class-backend/middleware/upload.js`
- Modify: `nova-class-backend/routes/victoria/classroom.routes.js`

**Interfaces:**
- `GET /api/classroom/materials/:materialId/highlights` returns `{ status, progress, submittedPages, highlights }`.
- `POST /api/classroom/materials/:materialId/highlights/start` accepts `{ totalPages }` and returns the shared analysis.
- `POST /api/classroom/materials/:materialId/highlights/pages` accepts multipart fields `analysisId`, `pageNumber`, `sourceType`, `candidates`, and optional in-memory `image`.
- `POST /api/classroom/materials/:materialId/highlights/complete` conditionally starts the one background analysis.
- `POST /api/classroom/materials/:materialId/highlights/retry` resets failed work and resumes.

- [ ] **Step 1: Write failing controller tests with pool and provider doubles**

Cover: unauthorized class member receives 403; two starts return the same analysis ID; ready GET returns page-grouped rectangles; an invalid candidate payload returns 400; scan upload calls OCR without a disk path; complete changes only one `pending` row to `processing`; a `processing` row untouched for five minutes becomes retryable; failed analysis can retry.

Use the existing `httpDouble` pattern from `test/bookmark.controller.test.js`, and assert SQL parameters for material ID, source fingerprint, version `1`, and user access checks.

- [ ] **Step 2: Run and verify failure**

Run: `cd nova-class-backend && node --test test/highlight.controller.test.js`

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Add bounded in-memory upload middleware and routes**

```js
const highlightPageImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ["image/png", "image/jpeg"].includes(file.mimetype)),
});
module.exports.highlightPageImage = highlightPageImage;
```

Register the five routes before the generic material file route and apply `upload.highlightPageImage.single("image")` only to the page submission route.

- [ ] **Step 4: Implement access, fingerprint, caching, and page submission**

Factor local helpers in the controller for material access and SHA-256 fingerprinting from file size, modification time, and stored filename. Validate `totalPages` as `1..2000` and `pageNumber` within the analysis range. Store normalized text candidates or OCR candidates using an idempotent unique page insert/update. On start or retry, transition a `processing` row whose `updated_at` is older than five minutes to `failed` before claiming it, allowing interrupted in-process work to resume safely.

- [ ] **Step 5: Implement GPT-OSS selection and persistence**

`analyze.js` loads at most 20 pages, 6,000 candidates, or 50,000 text characters per batch, calls `completeText` with JSON schema output, accepts only returned candidate IDs present in the batch, merges adjacent selected rectangles, and writes excerpt, explanation, category, and rectangle JSON in one transaction per batch. Update completed page count after each committed batch and set `ready` only after all pages succeed. Wrap each AI batch with the shared three-retry helper.

Start it after a conditional SQL update:

```sql
UPDATE material_highlight_analyses
SET status='processing', failure_code=NULL
WHERE id=? AND status IN ('pending','failed')
```

Only call the unawaited job when `affectedRows === 1`; attach `.catch` that records `failed` without leaking provider details.

- [ ] **Step 6: Run controller and backend tests**

Run: `cd nova-class-backend && npm test`

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add nova-class-backend/controllers/victoria/highlight.controller.js nova-class-backend/services/highlights/analyze.js nova-class-backend/test/highlight.controller.test.js nova-class-backend/middleware/upload.js nova-class-backend/routes/victoria/classroom.routes.js
git commit -m "feat: add shared PDF highlight analysis API"
```

### Task 4: Browser PDF Extraction

**Files:**
- Create: `nova-class-frontend/src/services/pdfHighlightExtraction.js`
- Create: `nova-class-frontend/src/services/pdfHighlightExtraction.test.js`

**Interfaces:**
- `extractPdfPage(pdf, pageNumber)` returns `{ sourceType: 'text', candidates }` or `{ sourceType: 'ocr', image: Blob }`.
- Candidate rectangles are normalized to page width and height.

- [ ] **Step 1: Write failing text and scan extraction tests**

Mock `pdf.getPage`, `page.getViewport`, `page.getTextContent`, and `page.render`. Assert meaningful text produces stable IDs such as `p2-i0` and normalized rectangles. Assert an empty text page renders a PNG Blob from an off-screen canvas at scale `1.5` and returns `sourceType: 'ocr'`.

- [ ] **Step 2: Run and verify failure**

Run: `cd nova-class-frontend && npm test -- src/services/pdfHighlightExtraction.test.js`

Expected: FAIL because the extraction module does not exist.

- [ ] **Step 3: Implement PDF.js geometry extraction**

Use `pdfjs.Util.transform(viewport.transform, item.transform)` to convert each item into viewport coordinates. Normalize `x`, `y - height`, `width`, and `height` by viewport dimensions; discard whitespace and invalid rectangles. Treat a page as scanned when joined extractable text is shorter than 20 non-whitespace characters.

For scans, create a canvas, render with `page.render({ canvasContext, viewport })`, convert using `canvas.toBlob(..., 'image/png')`, and release its dimensions after creating the Blob.

- [ ] **Step 4: Run extraction tests**

Run: `cd nova-class-frontend && npm test -- src/services/pdfHighlightExtraction.test.js`

Expected: both extraction branches PASS.

- [ ] **Step 5: Commit**

```bash
git add nova-class-frontend/src/services/pdfHighlightExtraction.js nova-class-frontend/src/services/pdfHighlightExtraction.test.js
git commit -m "feat: extract PDF highlight geometry"
```

### Task 5: Analysis Orchestration Hook

**Files:**
- Create: `nova-class-frontend/src/hooks/useMaterialHighlights.js`
- Create: `nova-class-frontend/src/hooks/useMaterialHighlights.test.jsx`

**Interfaces:**
- Produces `{ status, progress, highlights, visible, setVisible, preparePdf, retry, error }`.
- Consumes a material ID, enabled flag, API service, and `extractPdfPage`.

- [ ] **Step 1: Write failing hook tests**

Cover: mount GET reuses ready cache; missing cache waits for `preparePdf`; `preparePdf` starts once, submits every missing page, completes, and polls; scan pages send `FormData` with an image; unmount cancels polling; failed state exposes retry; visibility defaults true.

Use fake timers for two-second polling and deferred promises to prove React Strict Mode does not start duplicate preparation.

- [ ] **Step 2: Run and verify failure**

Run: `cd nova-class-frontend && npm test -- src/hooks/useMaterialHighlights.test.jsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement cache lookup and preparation**

Use an `AbortController` per lifecycle and a `preparationRef` keyed by material ID. After start, skip `submittedPages`; extract and submit remaining pages sequentially to limit memory. Send text pages as multipart JSON fields and scanned pages with the Blob named `page-<n>.png`. Call complete only after all submissions succeed.

- [ ] **Step 4: Implement polling, retry, and stale-response protection**

Poll only pending/processing every 2 seconds. Associate state updates with the current material ID so late responses from a previous preview cannot overwrite the new material. Retry calls the retry endpoint and resumes polling. Convert final failures into the Korean toolbar message without throwing into the PDF viewer.

- [ ] **Step 5: Run hook tests**

Run: `cd nova-class-frontend && npm test -- src/hooks/useMaterialHighlights.test.jsx`

Expected: all hook tests PASS with no timer leaks.

- [ ] **Step 6: Commit**

```bash
git add nova-class-frontend/src/hooks/useMaterialHighlights.js nova-class-frontend/src/hooks/useMaterialHighlights.test.jsx
git commit -m "feat: orchestrate automatic PDF highlights"
```

### Task 6: Highlight Overlay and PDF Integration

**Files:**
- Create: `nova-class-frontend/src/components/PdfHighlightOverlay.jsx`
- Create: `nova-class-frontend/src/components/PdfHighlightOverlay.test.jsx`
- Modify: `nova-class-frontend/src/components/PdfLessonViewer.jsx`
- Modify: `nova-class-frontend/src/components/PdfLessonViewer.css`
- Modify: `nova-class-frontend/src/components/PdfLessonViewer.test.jsx`
- Modify: `nova-class-frontend/src/pages/victoria/MaterialPreview.jsx`
- Modify: `nova-class-frontend/src/pages/victoria/MaterialPreview.test.jsx`

**Interfaces:**
- `PdfHighlightOverlay({ highlights, visible, onSelect })` renders percentage-positioned buttons.
- `PdfLessonViewer` gains `highlightState` and `onPdfReady(pdf)` props.
- `MaterialPreview` connects `useMaterialHighlights({ materialId, enabled: isPdf })` to the viewer.

- [ ] **Step 1: Write failing overlay tests**

```jsx
render(<PdfHighlightOverlay highlights={[{
  id: 3, excerpt: "Key idea", explanation: "Core concept", category: "concept",
  rects: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.05 }],
}]} visible />);
const region = screen.getByRole("button", { name: "Key idea" });
expect(region.style.left).toBe("10%");
expect(region.style.top).toBe("20%");
expect(region.style.width).toBe("40%");
```

Assert hidden mode renders no regions, selecting shows the explanation popover, and Escape closes it.

- [ ] **Step 2: Add failing viewer integration tests**

Extend the React-PDF Document mock to call `onLoadSuccess({ numPages: 5, getPage: vi.fn() })`. Assert `onPdfReady` receives the proxy, only current-page highlights render, the toolbar reports processing progress, the toggle hides ready highlights, and failed state exposes `AI 분석 재시도` without removing the PDF page.

- [ ] **Step 3: Run and verify failures**

Run: `cd nova-class-frontend && npm test -- src/components/PdfHighlightOverlay.test.jsx src/components/PdfLessonViewer.test.jsx`

Expected: FAIL because the overlay and new props do not exist.

- [ ] **Step 4: Implement overlay and accessible interactions**

Render a page-sized absolute layer inside `.pdf-page-surface`. Each rectangle button uses `left/top/width/height` percentages, translucent yellow fill, an amber border, and pointer events only on the region. The containing layer uses `pointer-events: none`; region buttons restore `pointer-events: auto`. Popovers close on Escape, outside click, page change, or visibility change.

- [ ] **Step 5: Add toolbar state and connect the hook**

Call `onPdfReady(pdf)` inside the existing document load callback. Add a compact toolbar button showing processing progress, ready on/off state, or retry. In `MaterialPreview`, instantiate the hook and pass its state and callbacks. Existing bookmark, page navigation, and zoom props remain unchanged.

- [ ] **Step 6: Run component and page tests**

Run: `cd nova-class-frontend && npm test -- src/components/PdfHighlightOverlay.test.jsx src/components/PdfLessonViewer.test.jsx src/pages/victoria/MaterialPreview.test.jsx`

Expected: all related suites PASS.

- [ ] **Step 7: Commit**

```bash
git add nova-class-frontend/src/components/PdfHighlightOverlay.jsx nova-class-frontend/src/components/PdfHighlightOverlay.test.jsx nova-class-frontend/src/components/PdfLessonViewer.jsx nova-class-frontend/src/components/PdfLessonViewer.css nova-class-frontend/src/components/PdfLessonViewer.test.jsx nova-class-frontend/src/pages/victoria/MaterialPreview.jsx nova-class-frontend/src/pages/victoria/MaterialPreview.test.jsx
git commit -m "feat: render automatic PDF smart highlights"
```

### Task 7: Configuration Documentation and End-to-End Verification

**Files:**
- Create: `nova-class-backend/.env.example`
- Create: `nova-class-backend/README.md`
- Modify: `.gitignore`
- Modify only if verification exposes defects in files listed by earlier tasks.

- [ ] **Step 1: Document required non-secret configuration**

Add `!.env.example` after the root `.env.*` ignore rule. Create this non-secret example:

```dotenv
GROQ_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/google-vision-service-account.json
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=
DB_NAME=nova_class
PORT=5001
```

The README explains enabling Google Cloud Vision, creating a least-privilege service account, setting the credential file path outside Git, running `node scripts/setup_db.js`, and starting backend/frontend from their own directories.

- [ ] **Step 2: Run backend verification**

Run: `cd nova-class-backend && npm test`

Expected: all backend tests PASS.

- [ ] **Step 3: Run frontend verification**

Run: `cd nova-class-frontend && npm test`

Expected: all frontend tests PASS.

Run: `cd nova-class-frontend && npx eslint src/components/PdfLessonViewer.jsx src/components/PdfHighlightOverlay.jsx src/hooks/useMaterialHighlights.js src/services/pdfHighlightExtraction.js src/pages/victoria/MaterialPreview.jsx`

Expected: no errors.

Run: `cd nova-class-frontend && npm run build`

Expected: Vite production build succeeds.

- [ ] **Step 4: Confirm secrets and uploads are excluded**

Run: `git status --short && git diff --check`

Expected: no `.env`, credential JSON, rendered page image, or user upload is staged. The four existing untracked upload files remain untouched.

- [ ] **Step 5: Commit documentation or verification fixes**

```bash
git add .gitignore nova-class-backend/.env.example nova-class-backend/README.md
git commit -m "docs: configure PDF smart highlighting"
```
