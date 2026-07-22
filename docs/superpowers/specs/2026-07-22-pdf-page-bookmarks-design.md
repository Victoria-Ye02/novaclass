# PDF Page Bookmarks Design

## Goal

Allow an authenticated classroom user to save the current page of a lesson PDF, revisit saved pages instantly, and close an overlay preview by clicking the empty viewer background outside the rendered PDF page.

## User experience

- Replace the browser-native PDF iframe with an application-controlled PDF.js viewer so the application knows the current page.
- Render one page at a time with previous/next controls, a page number field, and a total-page label.
- Place a floating heart button at the lower-right of the viewer. The heart is filled when the current page is saved.
- Place a saved-page list control beside the heart. It opens a compact drawer on desktop and a bottom sheet on narrow screens.
- Selecting a saved page navigates directly to that page and closes the list.
- Clicking the gray empty area outside the rendered PDF page closes the preview only when it was opened as an overlay. Clicking the PDF page, toolbar, heart, or saved-page list does not close it.
- Direct URL and refreshed standalone previews remain open when the viewer background is clicked.

## Persistence model

Add a `material_page_bookmarks` table with:

- `id` primary key
- `user_id` foreign key to `users`
- `material_id` foreign key to `materials`
- `page_number` positive integer
- `created_at` timestamp
- unique constraint on `(user_id, material_id, page_number)`

Bookmarks are scoped to the authenticated user. A user must be the class teacher or an enrolled class member to read or mutate bookmarks for a material.

## API

- `GET /api/classroom/materials/:materialId/bookmarks` returns the authenticated user's saved page numbers in ascending order.
- `POST /api/classroom/materials/:materialId/bookmarks` accepts `{ pageNumber }`, validates it as a positive integer, and creates the bookmark idempotently.
- `DELETE /api/classroom/materials/:materialId/bookmarks/:pageNumber` removes the authenticated user's bookmark idempotently.

The server validates authentication, material existence, and classroom membership for every operation. The unique database constraint prevents duplicates under concurrent requests.

## Retry and UI consistency

Bookmark save and remove operations use one initial request plus up to three automatic retries for network failures, timeouts, HTTP 408, HTTP 429, and HTTP 5xx responses. Delays are 300 ms, 600 ms, and 1200 ms.

HTTP 4xx responses other than 408 and 429 are not retried. While synchronization is in progress, the heart is disabled. The UI updates optimistically; if all attempts fail, it rolls back to the previous state and displays an error message. Pending timers and state updates are cancelled when the preview unmounts.

## Components and boundaries

- Bookmark controller: authorization, validation, and database operations.
- Classroom routes: authenticated bookmark endpoints.
- Database setup script: idempotent bookmark table creation.
- PDF viewer component: PDF loading, current-page navigation, rendered-page click boundary, and loading/error states.
- Bookmark controls: optimistic toggle, retry policy, saved-page drawer, and jump-to-page behavior.

Non-PDF material previews retain their existing behavior.

## Error handling

- PDF loading failures show a retry action without dismissing the preview.
- Bookmark-list loading failures show a non-blocking error and allow PDF reading to continue.
- Invalid or inaccessible bookmark requests return clear 4xx responses.
- A bookmark page greater than the loaded PDF page count is ignored by the client and can be removed by the user.

## Testing and verification

- Controller tests cover access control, validation, idempotent save, list, and removal.
- Retry tests cover retryable errors, non-retryable errors, success after retry, three-retry exhaustion, and rollback.
- Viewer tests cover current-page heart state, saved-page navigation, page-boundary clicks, overlay-background dismissal, and standalone non-dismissal.
- Run frontend lint/build and backend tests.
- Manually verify a representative PDF at desktop and narrow viewport sizes.

## Scope

This change adds per-user PDF page bookmarks and the requested overlay dismissal behavior. Text annotations, highlights, cross-material bookmark search, and non-PDF bookmarks are outside scope.
