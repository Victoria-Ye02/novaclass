# PDF Selection Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated students select PDF text and receive its Groq translation in their currently selected NovaClass language.

**Architecture:** A small backend translation service owns input validation, safe chunk splitting, and Groq prompt construction; the authenticated AI controller exposes it as `{ translation }`. `PdfLessonViewer` enables the PDF text layer, detects a selection on pointer release, and displays a translated-text popover using the existing Axios client and `LanguageContext` language.

**Tech Stack:** Express/CommonJS, Groq SDK gateway, Node test runner, React/Vite, React PDF, Vitest and Testing Library.

## Global Constraints

- Only `my` (Burmese) and `en` (English) are valid translation targets.
- Return faithful translation only; do not persist selected text or return explanations.
- Each Groq request contains no more than 5,000 characters; preserve order when a selection spans chunks.
- Keep `GROQ_API_KEY` server-side and keep `/api/ai/translate` behind existing JWT middleware.
- Enable `renderTextLayer` because native PDF text selection is required.

---

### Task 1: Testable translation service and protected endpoint

**Files:**
- Create: `nova-class-backend/services/ai/translation.js`
- Create: `nova-class-backend/test/translation.service.test.js`
- Modify: `nova-class-backend/controllers/victoria/ai.controller.js`
- Modify: `nova-class-backend/routes/victoria/ai.routes.js`

**Interfaces:**
- Produces `translateText({ text, targetLanguage, completeText })`, resolving to a joined translation string.
- Consumes `completeText({ messages, maxTokens })` from `services/ai/groqText.js`.
- Produces `POST /api/ai/translate { text, targetLanguage } -> { translation }`.

- [ ] **Step 1: Write the failing service tests**

```js
const { translateText } = require("../services/ai/translation");

test("translates into the requested Burmese language", async () => {
  let request;
  const translation = await translateText({
    text: "understand",
    targetLanguage: "my",
    completeText: async value => {
      request = value;
      return { choices: [{ message: { content: "နားလည်သည်" } }] };
    },
  });
  assert.equal(translation, "နားလည်သည်");
  assert.match(request.messages[0].content, /Burmese/);
});

test("splits a long selection and preserves translated chunk order", async () => {
  const text = `${"a".repeat(5000)} ${"b".repeat(5000)}`;
  const seen = [];
  const translation = await translateText({
    text,
    targetLanguage: "en",
    completeText: async request => {
      seen.push(request.messages[1].content);
      return { choices: [{ message: { content: String(seen.length) } }] };
    },
  });
  assert.equal(translation, "1\n\n2");
  assert.equal(seen.length, 2);
});

test("rejects empty text and unsupported language", async () => {
  await assert.rejects(() => translateText({ text: "", targetLanguage: "my" }), /text is required/);
  await assert.rejects(() => translateText({ text: "hello", targetLanguage: "ko" }), /targetLanguage/);
});
```

- [ ] **Step 2: Verify the service test fails**

Run: `cd nova-class-backend && node --test test/translation.service.test.js`

Expected: FAIL with `Cannot find module '../services/ai/translation'`.

- [ ] **Step 3: Implement the service and controller endpoint**

```js
const TARGET_LANGUAGES = { my: "Burmese (Myanmar)", en: "English" };

async function translateText({ text, targetLanguage, completeText }) {
  if (!text || !text.trim()) throw new Error("text is required");
  if (!TARGET_LANGUAGES[targetLanguage]) throw new Error("targetLanguage must be my or en");
  // Split at whitespace before 5,000 characters, then translate each chunk in order.
}
```

```js
exports.translate = async (req, res) => {
  try {
    const translation = await translateText({ ...req.body, completeText });
    res.json({ translation });
  } catch (error) {
    const status = /required|targetLanguage/.test(error.message) ? 400 : 502;
    res.status(status).json({ error: status === 502 ? "Translation is temporarily unavailable" : error.message });
  }
};
```

Add `router.post("/translate", auth, translate);` to `ai.routes.js`.

- [ ] **Step 4: Verify the service tests pass**

Run: `cd nova-class-backend && node --test test/translation.service.test.js`

Expected: all tests PASS.

- [ ] **Step 5: Commit backend translation work**

```bash
git add nova-class-backend/services/ai/translation.js nova-class-backend/test/translation.service.test.js nova-class-backend/controllers/victoria/ai.controller.js nova-class-backend/routes/victoria/ai.routes.js
git commit -m "feat: add selected-text translation API"
```

### Task 2: PDF selection translation UI

**Files:**
- Modify: `nova-class-frontend/src/components/PdfLessonViewer.jsx`
- Modify: `nova-class-frontend/src/components/PdfLessonViewer.css`
- Modify: `nova-class-frontend/src/components/PdfLessonViewer.test.jsx`

**Interfaces:**
- Consumes `useLang().lang` and `API.post("/ai/translate", { text, targetLanguage: lang })`.
- Produces a text selection action and accessible `PDF translation` dialog that can be dismissed.

- [ ] **Step 1: Write failing viewer tests**

```jsx
it("translates selected PDF text in the app's selected language", async () => {
  vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "이해하다", rangeCount: 1, getRangeAt: () => ({ getBoundingClientRect: () => ({ top: 20, left: 20 }) }) });
  renderViewer({ language: "my" });
  fireEvent.mouseUp(await screen.findByTestId("pdf-page-surface"));
  fireEvent.click(screen.getByRole("button", { name: "Translate selected text" }));
  expect(mockPost).toHaveBeenCalledWith("/ai/translate", { text: "이해하다", targetLanguage: "my" });
  expect(await screen.findByRole("dialog", { name: "PDF translation" })).toHaveTextContent("နားလည်သည်");
});

it("dismisses the translation dialog", async () => {
  renderViewerWithTranslationOpen();
  fireEvent.click(screen.getByRole("button", { name: "Close translation" }));
  expect(screen.queryByRole("dialog", { name: "PDF translation" })).toBeNull();
});
```

- [ ] **Step 2: Verify the viewer test fails**

Run: `cd nova-class-frontend && npm test -- PdfLessonViewer.test.jsx`

Expected: FAIL because no selected-text action exists.

- [ ] **Step 3: Implement minimal UI behavior**

```jsx
const { lang } = useLang();
const [selectionText, setSelectionText] = useState("");
const [translation, setTranslation] = useState(null);
const [translationState, setTranslationState] = useState("idle");

function captureSelection() {
  const text = window.getSelection()?.toString().trim() || "";
  setSelectionText(text);
}
```

- Set `renderTextLayer` to `true` on `<Page>`.
- Call `captureSelection` from `onMouseUp` on `.pdf-page-surface`.
- Render a `Translate selected text` action only when `selectionText` exists.
- Translate through the Axios service with `{ text: selectionText, targetLanguage: lang }`.
- Render loading, generic error with retry, translated text, and a close button in an accessible dialog.
- Add responsive styles that keep the action and dialog within the viewer bounds.

- [ ] **Step 4: Verify viewer tests pass and run the frontend suite**

Run: `cd nova-class-frontend && npm test -- PdfLessonViewer.test.jsx && npm test && npm run build`

Expected: tests PASS and production build succeeds.

- [ ] **Step 5: Commit frontend translation work**

```bash
git add nova-class-frontend/src/components/PdfLessonViewer.jsx nova-class-frontend/src/components/PdfLessonViewer.css nova-class-frontend/src/components/PdfLessonViewer.test.jsx
git commit -m "feat: translate selected PDF text"
```

### Task 3: End-to-end regression verification

**Files:**
- Modify: no production files expected

**Interfaces:**
- Verifies the protected endpoint and PDF viewer changes coexist with existing highlights, bookmarks, and builds.

- [ ] **Step 1: Run backend suite**

Run: `cd nova-class-backend && npm test`

Expected: all Node tests PASS.

- [ ] **Step 2: Run frontend suite and build**

Run: `cd nova-class-frontend && npm test && npm run build`

Expected: all Vitest tests PASS and Vite build succeeds.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff HEAD~2..HEAD --check && git status --short`

Expected: no whitespace errors; only the intended commits and pre-existing user changes appear.
