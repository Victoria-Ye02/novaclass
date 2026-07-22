# PDF Arrow Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add guarded left/right arrow page navigation to the existing lesson PDF viewer.

**Architecture:** Keep keyboard behavior inside `PdfLessonViewer` so the listener exists only while a PDF is open. Reuse the existing clamped `goToPage` function and protect form fields, modifier combinations, vertical scrolling, and the saved-page dialog.

**Tech Stack:** React 19, Vitest 4, Testing Library 16.

## Global Constraints

- `ArrowLeft` moves backward and `ArrowRight` moves forward by one page.
- Up/down arrows and modified key combinations retain native behavior.
- Ignore shortcuts in input, textarea, select, content-editable elements, and while saved pages are open.
- Never navigate below page 1 or above the loaded page count.

---

### Task 1: Guarded PDF arrow navigation

**Files:**
- Modify: `nova-class-frontend/src/components/PdfLessonViewer.jsx`
- Modify: `nova-class-frontend/src/components/PdfLessonViewer.test.jsx`

**Interfaces:**
- Consumes: browser `keydown` events, `currentPage`, `numPages`, and `savedPagesOpen`.
- Produces: previous/next page navigation and `aria-keyshortcuts` metadata on toolbar buttons.

- [ ] **Step 1: Write failing interaction tests**

```jsx
fireEvent.keyDown(window, { key: "ArrowRight" });
expect(screen.getByTestId("rendered-page-2")).toBeTruthy();
fireEvent.keyDown(window, { key: "ArrowLeft" });
expect(screen.getByTestId("rendered-page-1")).toBeTruthy();
```

Add assertions that the first/last page clamps, input-focused arrows are ignored, vertical arrows are not prevented, and saved-page-dialog arrows are ignored.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd nova-class-frontend && npx vitest run src/components/PdfLessonViewer.test.jsx --environment jsdom`

Expected: new keyboard tests FAIL because no keydown listener exists.

- [ ] **Step 3: Implement the guarded listener**

Add a `useEffect` listener that returns early for modifier keys, open saved pages, editable targets, and non-left/right arrows. Call `event.preventDefault()` only for handled left/right keys and call `goToPage(currentPage ± 1)`. Add `aria-keyshortcuts="ArrowLeft"` and `aria-keyshortcuts="ArrowRight"` to the existing toolbar buttons.

- [ ] **Step 4: Run focused verification**

Run:

```bash
npx vitest run src/components/PdfLessonViewer.test.jsx --environment jsdom
npx eslint src/components/PdfLessonViewer.jsx src/components/PdfLessonViewer.test.jsx
```

Expected: all focused tests PASS and ESLint exits 0.

- [ ] **Step 5: Run regression verification and commit**

Run:

```bash
npm test
npm run build
```

Expected: all frontend tests PASS and Vite build exits 0.

```bash
git add nova-class-frontend/src/components/PdfLessonViewer.jsx nova-class-frontend/src/components/PdfLessonViewer.test.jsx
git commit -m "feat: navigate PDF pages with arrow keys"
```
