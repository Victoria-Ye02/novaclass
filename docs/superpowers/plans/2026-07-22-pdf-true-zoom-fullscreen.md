# PDF True Zoom and Fullscreen Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PDF 200% zoom exactly twice the 100% rendered width and make the material overlay fill the entire viewport.

**Architecture:** Compute the final page pixel width explicitly and pass it as React-PDF's sole sizing input, leaving overflow to the scroll container. Remove desktop modal constraints so the overlay card uses the dynamic viewport dimensions on every breakpoint.

**Tech Stack:** React 19, React-PDF, CSS, Vitest, Testing Library.

## Global Constraints

- Zoom remains clamped to 50–200% in 25% steps.
- Keyboard and toolbar zoom behavior remain unchanged.
- 200% width must equal two times the 100% width.
- Overlay mode must use `100vw` by `100dvh` with no outer desktop gap.
- Standalone material preview behavior must remain unchanged.

---

### Task 1: True Rendered PDF Width

**Files:**
- Modify: `nova-class-frontend/src/components/PdfLessonViewer.test.jsx`
- Modify: `nova-class-frontend/src/components/PdfLessonViewer.jsx`
- Modify: `nova-class-frontend/src/components/PdfLessonViewer.css`

**Interfaces:**
- Produces: `renderedPageWidth = pageWidth * zoomPercent / 100` passed as `<Page width>`.

- [ ] **Step 1: Change the React-PDF mock to expose width and add a failing ratio assertion**

```jsx
Page: ({ pageNumber, width }) => (
  <div data-testid={`rendered-page-${pageNumber}`} data-width={width}>
    PDF page {pageNumber}
  </div>
),
```

In the zoom test, capture the 100% width, click Zoom in four times, and assert:

```js
const baseWidth = Number(page.dataset.width);
for (let press = 0; press < 4; press += 1) {
  fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
}
expect(Number(page.dataset.width)).toBe(baseWidth * 2);
```

Replace the existing `data-scale` assertions in the reset, clamp, keyboard shortcut, and dialog tests with `data-width` assertions relative to the captured 100% width. Keep percentage-label and disabled-button assertions unchanged.

- [ ] **Step 2: Run the targeted test and verify failure**

Run: `cd nova-class-frontend && npm test -- src/components/PdfLessonViewer.test.jsx`

Expected: FAIL because the existing mock receives the unscaled `pageWidth` at 200%.

- [ ] **Step 3: Compute and use the final width**

Add:

```js
const renderedPageWidth = pageWidth * zoomPercent / 100;
```

Pass `width={renderedPageWidth}` to `<Page>`, remove its `scale` prop, and use `renderedPageWidth` for the skeleton width.

Remove the constraining canvas declarations:

```css
.pdf-page-surface canvas {
  display: block;
}
```

Specifically delete `max-width: 100%` and `height: auto !important`; React-PDF owns the exact canvas CSS dimensions.

- [ ] **Step 4: Run PDF viewer tests**

Run: `cd nova-class-frontend && npm test -- src/components/PdfLessonViewer.test.jsx`

Expected: all PDF viewer tests PASS with width-based assertions.

- [ ] **Step 5: Commit**

```bash
git add nova-class-frontend/src/components/PdfLessonViewer.jsx nova-class-frontend/src/components/PdfLessonViewer.css nova-class-frontend/src/components/PdfLessonViewer.test.jsx
git commit -m "fix: render true PDF zoom dimensions"
```

### Task 2: Full-Viewport Material Overlay

**Files:**
- Modify: `nova-class-frontend/src/pages/victoria/MaterialPreview.test.jsx`
- Modify: `nova-class-frontend/src/pages/victoria/MaterialPreview.jsx`
- Modify: `nova-class-frontend/src/index.css`

**Interfaces:**
- Produces: overlay card styles `width: 100vw`, `height: 100dvh`, `maxWidth: none`, and `borderRadius: 0`.

- [ ] **Step 1: Add a failing full-viewport test**

Add `data-testid="material-overlay-card"` to the overlay card and test:

```js
it("fills the viewport in overlay mode", async () => {
  render(<MaterialPreview isOverlay />);
  await screen.findByTestId("controlled-pdf-viewer");
  const card = screen.getByTestId("material-overlay-card");
  expect(card.style.width).toBe("100vw");
  expect(card.style.height).toBe("100dvh");
  expect(card.style.maxWidth).toBe("none");
  expect(card.style.borderRadius).toBe("0px");
});
```

- [ ] **Step 2: Run and verify failure**

Run: `cd nova-class-frontend && npm test -- src/pages/victoria/MaterialPreview.test.jsx`

Expected: FAIL because the card currently uses `width: 100%`, `maxWidth: 1100px`, and `borderRadius: 16px`.

- [ ] **Step 3: Apply full-viewport styles**

Set:

```js
const overlayCard = {
  width: "100vw", maxWidth: "none", height: "100dvh",
  background: "#1a1a2e", borderRadius: 0, boxShadow: "none",
  overflow: "hidden", cursor: "default", display: "flex", flexDirection: "column",
};
```

Change `.material-overlay-backdrop` padding to `0` for all viewport sizes. Keep fade animation and remove the now-redundant mobile radius override.

- [ ] **Step 4: Run related and complete frontend checks**

Run: `cd nova-class-frontend && npm test -- src/pages/victoria/MaterialPreview.test.jsx src/components/PdfLessonViewer.test.jsx`

Expected: both suites PASS.

Run: `cd nova-class-frontend && npm run build`

Expected: Vite production build succeeds.

- [ ] **Step 5: Commit**

```bash
git add nova-class-frontend/src/pages/victoria/MaterialPreview.jsx nova-class-frontend/src/pages/victoria/MaterialPreview.test.jsx nova-class-frontend/src/index.css
git commit -m "fix: make material overlay fullscreen"
```
