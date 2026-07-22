# PDF Page Bookmarks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-user, database-backed PDF page bookmarks with a retrying heart control, direct page navigation, and overlay dismissal from the empty PDF background.

**Architecture:** Keep bookmark authorization and persistence in a focused backend controller mounted under the existing classroom router. Replace the PDF iframe with a `react-pdf` viewer, isolate retry behavior in a pure utility and bookmark synchronization in a hook, and keep `MaterialPreview` responsible only for material loading and preview composition.

**Tech Stack:** React 19, Vite 8, react-pdf 10 / PDF.js 5, Axios, Vitest 4, Testing Library 16, Node.js test runner, Express 5, MySQL 8.

## Global Constraints

- Bookmarks are unique by authenticated user, material, and positive page number.
- Every bookmark endpoint must verify that the user teaches or belongs to the material's class.
- Bookmark save and removal use one initial request plus at most three retries at 300 ms, 600 ms, and 1200 ms.
- Retry only network errors, timeouts, HTTP 408, HTTP 429, and HTTP 5xx responses.
- Overlay background clicks close only when the target is empty viewer space; PDF pages and controls never close it.
- Standalone material previews never close from viewer-background clicks.
- Preserve all non-PDF preview behavior and existing user changes.

---

### Task 1: Bookmark persistence and authenticated API

**Files:**
- Create: `nova-class-backend/controllers/victoria/bookmark.controller.js`
- Create: `nova-class-backend/test/bookmark.controller.test.js`
- Modify: `nova-class-backend/routes/victoria/classroom.routes.js`
- Modify: `nova-class-backend/scripts/setup_db.js`
- Modify: `nova-class-backend/package.json`

**Interfaces:**
- Consumes: `req.user.id`, `req.params.materialId`, `req.params.pageNumber`, `req.body.pageNumber`, and the shared MySQL pool.
- Produces: `listBookmarks(req,res)`, `saveBookmark(req,res)`, and `removeBookmark(req,res)`; list response `{ pages: number[] }`; save response `{ pageNumber: number, saved: true }`; delete response `{ pageNumber: number, saved: false }`.

- [ ] **Step 1: Write controller tests that mock `pool.query`**

Cover list success, access denial, invalid page, idempotent insert, and idempotent delete by replacing `pool.query` with a deterministic async function and invoking the controller with lightweight request/response doubles.

```js
test("saveBookmark inserts a unique user/material/page tuple", async () => {
  pool.query = async (sql, params) => {
    if (sql.includes("FROM materials")) return [[{ id: 9, class_id: 4 }]];
    if (sql.includes("FROM classes")) return [[{ id: 4, teacher_id: 2 }]];
    if (sql.includes("INSERT IGNORE")) {
      assert.deepEqual(params, [2, 9, 7]);
      return [{ affectedRows: 1 }];
    }
    throw new Error(`Unexpected query: ${sql}`);
  };
  const { req, res } = httpDouble({ user: { id: 2 }, params: { materialId: "9" }, body: { pageNumber: 7 } });
  await controller.saveBookmark(req, res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { pageNumber: 7, saved: true });
});
```

- [ ] **Step 2: Run the backend test and verify RED**

Run: `cd nova-class-backend && node --test test/bookmark.controller.test.js`

Expected: FAIL because `bookmark.controller.js` does not exist.

- [ ] **Step 3: Implement the controller and access helper**

Use `getAccessibleMaterial(materialId, userId)` to load the material, check the class owner, then check `class_members`. Validate page numbers with `Number.isInteger(pageNumber) && pageNumber > 0`. Use `INSERT IGNORE` and a keyed `DELETE` so both mutations are idempotent.

```js
await pool.query(
  `INSERT IGNORE INTO material_page_bookmarks (user_id, material_id, page_number)
   VALUES (?, ?, ?)`,
  [userId, materialId, pageNumber]
);
```

- [ ] **Step 4: Register routes and table creation**

Add authenticated GET/POST/DELETE routes and create the table with cascading foreign keys and `UNIQUE KEY unique_material_page_bookmark (user_id, material_id, page_number)`. Resolve `.env` relative to `__dirname` so the migration works regardless of the caller's current directory.

- [ ] **Step 5: Add and run the backend test script**

Add `"test": "node --test test/**/*.test.js"` and run `npm test`.

Expected: all bookmark controller tests PASS.

- [ ] **Step 6: Commit the backend unit**

```bash
git add nova-class-backend/controllers/victoria/bookmark.controller.js nova-class-backend/test/bookmark.controller.test.js nova-class-backend/routes/victoria/classroom.routes.js nova-class-backend/scripts/setup_db.js nova-class-backend/package.json
git commit -m "feat: add user PDF page bookmark API"
```

### Task 2: Retrying bookmark requests

**Files:**
- Create: `nova-class-frontend/src/utils/retryRequest.js`
- Create: `nova-class-frontend/src/utils/retryRequest.test.js`
- Modify: `nova-class-frontend/package.json`
- Modify: `nova-class-frontend/package-lock.json`

**Interfaces:**
- Consumes: `retryRequest(operation, options?)`, where `operation` returns a promise and options may supply `delays` and `signal`.
- Produces: the successful operation value or the final error; exports `isRetryableRequestError(error)`.

- [ ] **Step 1: Install the frontend runtime and test dependencies**

Run: `cd nova-class-frontend && npm install react-pdf && npm install --save-dev vitest jsdom @testing-library/react @testing-library/dom @testing-library/user-event`

Expected: `react-pdf` 10.x and Vitest 4.x resolve against React 19 and Vite 8.

- [ ] **Step 2: Write retry tests**

```js
it("uses all three retries before returning success", async () => {
  const operation = vi.fn()
    .mockRejectedValueOnce(networkError())
    .mockRejectedValueOnce({ response: { status: 500 } })
    .mockRejectedValueOnce({ response: { status: 429 } })
    .mockResolvedValue("saved");
  await expect(retryRequest(operation, { delays: [0, 0, 0] })).resolves.toBe("saved");
  expect(operation).toHaveBeenCalledTimes(4);
});
```

Also assert that HTTP 400 is attempted once, four failed attempts throw the final error, and an aborted signal stops pending retries.

- [ ] **Step 3: Run the retry test and verify RED**

Run: `npx vitest run src/utils/retryRequest.test.js`

Expected: FAIL because the utility does not exist.

- [ ] **Step 4: Implement the minimal retry utility**

```js
export async function retryRequest(operation, { delays = [300, 600, 1200], signal } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try { return await operation(); }
    catch (error) {
      if (!isRetryableRequestError(error) || attempt >= delays.length) throw error;
      await wait(delays[attempt], signal);
    }
  }
}
```

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run src/utils/retryRequest.test.js`

Expected: all retry tests PASS.

```bash
git add nova-class-frontend/package.json nova-class-frontend/package-lock.json nova-class-frontend/src/utils
git commit -m "feat: add retry policy for bookmark sync"
```

### Task 3: User bookmark synchronization hook

**Files:**
- Create: `nova-class-frontend/src/hooks/useMaterialBookmarks.js`
- Create: `nova-class-frontend/src/hooks/useMaterialBookmarks.test.jsx`

**Interfaces:**
- Consumes: `{ materialId, enabled }`, shared Axios `API`, and `retryRequest`.
- Produces: `{ bookmarks, loading, syncingPage, error, toggleBookmark, clearError }`.

- [ ] **Step 1: Write hook tests with a mocked API module**

Test initial sorted loading, optimistic save, optimistic removal, rollback after final failure, and no state update after unmount.

```jsx
const { result } = renderHook(() => useMaterialBookmarks({ materialId: "9", enabled: true }));
await waitFor(() => expect(result.current.bookmarks).toEqual([2, 7]));
await act(() => result.current.toggleBookmark(4));
expect(result.current.bookmarks).toEqual([2, 4, 7]);
```

- [ ] **Step 2: Run the hook test and verify RED**

Run: `npx vitest run src/hooks/useMaterialBookmarks.test.jsx --environment jsdom`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement optimistic synchronization and rollback**

Use an `AbortController` per mounted hook, immutable sorted page arrays, a single `syncingPage` guard, POST for save, DELETE for remove, and `retryRequest`. Restore the previous array and expose a readable error after final failure.

- [ ] **Step 4: Run tests and commit**

Run: `npx vitest run src/hooks/useMaterialBookmarks.test.jsx --environment jsdom`

Expected: all hook tests PASS.

```bash
git add nova-class-frontend/src/hooks
git commit -m "feat: sync per-user PDF bookmarks"
```

### Task 4: Controlled PDF viewer and bookmark controls

**Files:**
- Create: `nova-class-frontend/src/components/PdfLessonViewer.jsx`
- Create: `nova-class-frontend/src/components/PdfLessonViewer.css`
- Create: `nova-class-frontend/src/components/PdfLessonViewer.test.jsx`

**Interfaces:**
- Consumes: `{ fileUrl, title, bookmarks, syncingPage, bookmarkError, onToggleBookmark, onDismissEmptySpace }`.
- Produces: controlled current-page rendering, previous/next/direct navigation, bookmark drawer, and empty-background dismissal events.

- [ ] **Step 1: Write viewer interaction tests**

Mock `react-pdf` so `Document` reports five pages and `Page` renders a labeled element. Verify filled heart state, toggle callback with current page, saved-page jump, clamped page input, background dismissal, and event propagation from the page and controls.

```jsx
fireEvent.click(screen.getByRole("button", { name: "Next page" }));
fireEvent.click(screen.getByRole("button", { name: "Save page 2" }));
expect(onToggleBookmark).toHaveBeenCalledWith(2);
fireEvent.click(screen.getByTestId("pdf-page-surface"));
expect(onDismissEmptySpace).not.toHaveBeenCalled();
fireEvent.click(screen.getByTestId("pdf-viewer-background"));
expect(onDismissEmptySpace).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Run the viewer test and verify RED**

Run: `npx vitest run src/components/PdfLessonViewer.test.jsx --environment jsdom`

Expected: FAIL because the viewer does not exist.

- [ ] **Step 3: Implement PDF.js worker setup and viewer**

Configure `pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()`. Render one responsive page at a time. Stop propagation on the page surface, toolbar, floating controls, drawer, and bottom sheet. Use semantic labels for every icon control.

- [ ] **Step 4: Implement responsive visual states**

Create a desktop drawer, narrow-screen bottom sheet, 44-pixel minimum touch targets, visible focus rings, filled/unfilled heart states, loading skeleton, PDF error retry control, synchronization indicator, and non-blocking bookmark error message.

- [ ] **Step 5: Run tests and commit**

Run: `npx vitest run src/components/PdfLessonViewer.test.jsx --environment jsdom`

Expected: all viewer tests PASS.

```bash
git add nova-class-frontend/src/components/PdfLessonViewer.jsx nova-class-frontend/src/components/PdfLessonViewer.css nova-class-frontend/src/components/PdfLessonViewer.test.jsx
git commit -m "feat: add bookmarked PDF lesson viewer"
```

### Task 5: Material preview integration and end-to-end verification

**Files:**
- Create: `nova-class-frontend/src/pages/victoria/MaterialPreview.test.jsx`
- Modify: `nova-class-frontend/src/pages/victoria/MaterialPreview.jsx`
- Modify: `nova-class-frontend/src/index.css` only if a shared overlay rule is required

**Interfaces:**
- Consumes: `PdfLessonViewer`, `useMaterialBookmarks`, existing material metadata and overlay `goBack()`.
- Produces: PDF-specific preview with bookmark persistence; unchanged image, video, and unsupported-file paths.

- [ ] **Step 1: Write an integration test for overlay versus standalone dismissal**

Mock material loading and `PdfLessonViewer`. Assert that `onDismissEmptySpace` is `goBack` in overlay mode and a no-op in standalone mode, while existing non-PDF rendering remains reachable.

- [ ] **Step 2: Run the integration test and verify RED**

Run: `npx vitest run src/pages/victoria/MaterialPreview.test.jsx --environment jsdom`

Expected: FAIL because `MaterialPreview` still uses an iframe.

- [ ] **Step 3: Replace only the PDF iframe branch**

Call `useMaterialBookmarks({ materialId, enabled: isPdf && Boolean(fileUrl) })`, render `PdfLessonViewer`, and pass `isOverlay ? goBack : undefined` for empty-background dismissal. Preserve all existing branches, top bar actions, escape behavior, and modal route behavior.

- [ ] **Step 4: Run focused and full automated verification**

Run:

```bash
cd nova-class-backend && npm test
cd ../nova-class-frontend && npx vitest run --environment jsdom
npm run lint
npm run build
```

Expected: all tests PASS, ESLint reports zero errors, and Vite build exits 0.

- [ ] **Step 5: Apply and verify the database migration**

Run: `cd nova-class-backend && node scripts/setup_db.js`

Expected: `All tables created successfully`; then verify `SHOW CREATE TABLE material_page_bookmarks` reports both foreign keys and the unique tuple constraint.

- [ ] **Step 6: Manual browser verification**

Open a lesson PDF, navigate to page 2, save it, reload, jump from the saved-page list, remove it, and confirm empty gray background closes only the overlay. Repeat at a narrow viewport.

- [ ] **Step 7: Commit the integration**

```bash
git add nova-class-frontend/src/pages/victoria/MaterialPreview.jsx nova-class-frontend/src/pages/victoria/MaterialPreview.test.jsx nova-class-frontend/src/index.css
git commit -m "feat: integrate PDF page bookmarks"
```
