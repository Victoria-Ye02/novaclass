# PDF Smart Highlighting Design

## Goal

When a classroom PDF opens, NovaClass automatically identifies the most important sentences, concepts, and formulas and highlights them directly on the PDF. The result is shared per material and cached in the database so later viewers see it immediately without another AI analysis.

The feature supports both text PDFs and scanned PDFs. Highlight geometry remains aligned at every supported zoom level. This work also corrects the existing zoom behavior so 200% is exactly twice the 100% rendered size and makes the material overlay fill the viewport on desktop and mobile.

## User Experience

The PDF remains usable while analysis runs. A compact toolbar control shows one of these states:

- `AI 분석 중…` while page data is being prepared and analyzed.
- `Smart Highlight 켜짐` when cached highlights are visible.
- `Smart Highlight 꺼짐` when the user hides them.
- `AI 분석 재시도` after a final analysis failure.

Highlighting is enabled by default. Important regions use a translucent yellow overlay that does not obscure the underlying content. Selecting a highlight opens a small popover containing a short explanation of why the passage matters. Pages without highlights remain visually unchanged.

The preference to show or hide highlights is local UI state; it does not change or delete the shared analysis result.

## Analysis Architecture

### Automatic startup and cache reuse

When a PDF preview opens, the client requests the material's highlight status and cached result. A ready result is rendered immediately. If no current result exists, the client asks the backend to start analysis automatically.

The database enforces one analysis record per material and analysis version. Concurrent viewers reuse the same pending, processing, ready, or failed job instead of starting duplicate AI calls. Changing the source PDF or incrementing the analysis version invalidates the old cache.

The client polls the status endpoint while work is pending or processing. PDF loading and navigation never wait for analysis to finish.

### Page extraction

PDF.js prepares page data in the browser because it already has access to the loaded PDF and its coordinate system.

For a text PDF page, the client extracts text items and their PDF.js geometry. Each item receives a stable page-local identifier and normalized bounds, so the geometry is independent of rendered pixel size.

For a page with no meaningful extractable text, the client renders an off-screen page image and uploads that page image to the authenticated analysis endpoint. The backend sends it to Google Cloud Vision document OCR. Vision returns text and word or paragraph bounds, which are converted to the same normalized coordinate format used by text PDFs.

Pages are uploaded and processed in bounded batches to avoid excessive browser memory, request size, and provider concurrency.

### Importance selection

The backend sends bounded, page-indexed text candidates to the existing Groq integration and uses `openai/gpt-oss-120b` for Smart Highlighting importance selection. The model choice is isolated in the Smart Highlighting service and does not change the models used by the project's other AI features. The prompt requests exact candidate identifiers, a concise explanation, and a category such as concept, formula, definition, or conclusion. AI output is schema-validated; unknown identifiers, malformed coordinates, duplicate regions, and excessively broad selections are rejected.

Selected neighboring items are merged only when they belong to the same logical highlight. Stored results contain the page number, normalized rectangles, original excerpt, category, and explanation.

## API and Data Model

The classroom material routes gain authenticated highlight endpoints for:

- Getting the cached status, progress, and ready result.
- Starting or joining the current material's analysis.
- Submitting bounded page extraction payloads from the PDF client.
- Retrying a failed analysis.

All endpoints use the existing classroom membership check. A user who cannot access the material cannot read results, submit page data, or start analysis.

One analysis table stores material ID, source fingerprint, analysis version, status, total and completed pages, failure summary, timestamps, and a uniqueness constraint for the current material/version. A child highlight table stores the analysis ID, page number, excerpt, explanation, category, normalized rectangle JSON, and deterministic display order. Cascading foreign keys remove analysis data when its material is deleted.

The source fingerprint is derived from immutable file metadata available to the server. Replacing a material file changes the fingerprint and prevents stale highlights from being returned.

## Rendering and Geometry

`PdfLessonViewer` renders highlights in an absolutely positioned overlay attached to the same page surface as the React-PDF canvas. Each normalized rectangle is converted to percentages of the current rendered page dimensions. The overlay therefore scales naturally with page width and stays aligned when zoom changes.

The overlay ignores pointer events except on actual highlight regions, preserving page navigation and the existing empty-background dismissal behavior. Highlight popovers stay within the viewer viewport and close on Escape, outside selection, page navigation, or highlight disablement.

The rendered page width is calculated explicitly as `basePageWidth * zoomPercent / 100` and supplied as the page width. Canvas CSS must not cap it back to the unzoomed parent width. The scrollable viewer owns overflow, making 200% exactly two times the 100% page dimensions.

The overlay material card uses the full viewport: no desktop padding, maximum width, rounded outer corners, or visible backdrop margin. Its dimensions are `100vw` by `100dvh`, while the existing top bar and PDF viewer continue to use the internal flex layout.

## Failure Handling and Retry

Each failed page or AI batch retries automatically up to three times with exponential delay. The database records progress after successful batches, allowing a retry to resume without reprocessing completed pages. A final failure changes the analysis to `failed` and retains completed diagnostic metadata without returning partial highlights as a ready result.

Failure is non-blocking: the PDF, bookmarks, navigation, and zoom remain available. The toolbar exposes a manual retry action. Starting a manual retry resets only failed work and continues to reuse valid extracted page data where possible.

If OCR credentials are missing or a provider rejects a request, the API returns a safe user-facing error code while detailed provider errors remain server-side. No API secret is included in client code or responses.

## Privacy and Configuration

Google Cloud Vision credentials are configured only through backend environment variables and are excluded from Git. Text or rendered page images are sent to Google Cloud Vision only for OCR and to Groq's `openai/gpt-oss-120b` model only as bounded extracted text for importance selection. NovaClass does not persist rendered page images in its database or uploads directory after processing.

Deployment documentation will list the required Google Cloud project, Vision API enablement, service-account credential configuration, and existing Groq key requirement. Logs must not contain document text, page images, access tokens, or provider credentials.

## Testing

Backend unit and integration tests use provider doubles and cover:

- Classroom access control on every new endpoint.
- One shared analysis job under concurrent starts.
- Ready-cache reuse and source/version invalidation.
- Text-page and scanned-page OCR branches.
- AI schema validation, coordinate normalization, and persistence.
- Batch progress, resume behavior, three automatic retries, and final failure.
- Safe responses when Vision or Groq configuration is missing.

Frontend tests use mocked PDF.js and API responses and cover:

- Automatic status lookup and analysis start on PDF open.
- Polling through pending and processing states into ready.
- Page-specific highlight rendering and explanation popovers.
- Highlight visibility toggle and non-blocking failed state.
- Coordinate alignment when zoom changes, including a true 200% width.
- Full-viewport material overlay and unchanged empty-background dismissal.

Feature-targeted lint, all frontend and backend tests, and a production frontend build must pass before completion. External provider calls are mocked in automated tests; a credentialed manual smoke test is optional and must not expose secrets.

## Out of Scope

- User-authored or editable highlight regions.
- Per-user AI ranking or separate per-user highlight storage.
- Persisting OCR page images.
- Reanalyzing a ready result every time a PDF opens.
- Supporting non-PDF material previews with Smart Highlighting.
