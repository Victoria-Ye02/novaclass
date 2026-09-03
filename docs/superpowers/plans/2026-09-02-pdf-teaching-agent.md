# PDF Teaching Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PDF companion an intentional, lesson-grounded Nova Teacher agent and reduce spoken-reply waiting time with ElevenLabs Flash TTS.

**Architecture:** The existing material AI endpoint gains an isolated `mode: "teacher"` branch. The frontend sends a teaching intent and reuses existing per-material chat history as session memory; no migration is needed. ElevenLabs TTS defaults to Flash with a latency optimization query parameter while retaining the safe Blob player and Burmese route.

**Tech Stack:** React/Vite, Express, MySQL chat-history rows, Groq completion service, ElevenLabs REST TTS, Node test runner, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-pdf-teaching-agent-design.md`

## Global Constraints

- Keep API secrets only in the backend.
- Do not alter generic `mode: "assistant"` behavior or its cache behavior.
- Keep microphone interruption, browser TTS fallback, and Burmese Azure/Edge speech.
- Do not add a database migration; use existing `material_chat_messages` history.
- Teacher mode only discusses the opened material and admits unreadable PDF page content.

---

### Task 1: Define and verify Nova Teacher backend mode

**Files:**

- Modify: `nova-class-backend/controllers/victoria/classroom.controller.js: materialAI`
- Modify: `nova-class-backend/test/classroom.controller.test.js`

**Interfaces:**

- Consumes: `{ action: "chat", mode: "teacher", teachingIntent, message, history, currentPage, totalPages, lang, voice }`.
- Produces: `{ reply: string }` and existing `material_chat_messages` persistence.

- [ ] **Step 1: Write failing teacher-mode backend tests**

```js
test("teacher-mode chat gives Nova the page and an active teaching sequence", async (t) => {
  // Mock material and completeText; request page 2 with teachingIntent: "start".
  // Assert system content contains exact page text plus "learning goal", "example", and "check".
});
test("teacher-mode chat does not reuse generic first-question cache", async (t) => {
  // Make material_chat_cache lookup throw; a teacher request must still return 200.
});
```

- [ ] **Step 2: Verify new backend tests fail**

Run: `node --test test/classroom.controller.test.js`

Expected: teacher-mode prompt/cache assertions fail because the mode does not exist.

- [ ] **Step 3: Add a minimal isolated teacher-mode branch**

```js
const isTeacherMode = action === "chat" && req.body.mode === "teacher";
const allowedTeachingIntents = new Set(["start", "continue", "simplify", "check", "answer"]);
const teachingIntent = allowedTeachingIntents.has(req.body.teachingIntent)
  ? req.body.teachingIntent
  : "answer";
```

Build the prompt from existing material/page context. `start` must teach goal → explanation → example → one check. `continue` chooses the next concept; `simplify` re-explains; `check` asks one material-grounded question; `answer` gives supportive feedback before moving on. Reuse existing persistence/response code but bypass generic first-question cache.

- [ ] **Step 4: Verify backend tests pass**

Run: `node --test test/classroom.controller.test.js`

Expected: all tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add nova-class-backend/controllers/victoria/classroom.controller.js nova-class-backend/test/classroom.controller.test.js
git commit -m "feat: add PDF teaching agent mode"
```

### Task 2: Replace PDF chat entry with intentional Nova Teacher flow

**Files:**

- Modify: `nova-class-frontend/src/pages/victoria/MaterialPreview.jsx: AIChatPanel`
- Modify: `nova-class-frontend/src/pages/victoria/MaterialPreview.test.jsx`

**Interfaces:**

- Consumes: existing material history plus Task 1 endpoint.
- Produces: start/resume UI, three quick actions, and teacher-mode request bodies.

- [ ] **Step 1: Write failing frontend interaction tests**

```jsx
it("starts Nova Teacher only after student presses Start learning", async () => {
  // Open panel; assert no AI POST until start click, then assert teacher/start payload.
});
it("sends continue teaching intent from quick action", async () => {
  // Start first, click Continue lesson, assert teachingIntent: "continue".
});
it("offers Resume lesson for existing material conversation", async () => {
  // Return saved assistant/user messages and verify Resume lesson appears.
});
```

- [ ] **Step 2: Verify new frontend tests fail**

Run: `npm test -- MaterialPreview.test.jsx`

Expected: controls are absent and teacher-mode payload assertions fail.

- [ ] **Step 3: Implement Nova Teacher panel state and request helper**

```jsx
const [lessonStarted, setLessonStarted] = useState(false);
const [hasSavedLesson, setHasSavedLesson] = useState(false);
async function sendTeachingIntent(teachingIntent, message) {
  return sendMessage(message, { teachingIntent });
}
```

Before `lessonStarted`, render Start learning with Nova Teacher or Resume lesson. Once started, render Continue lesson, Explain simply, and Check my understanding. Quick actions use `mode: "teacher"`; typed questions after start use `teachingIntent: "answer"`. Preserve generic assistant mode only before teaching begins.

- [ ] **Step 4: Replace PDF labels and add accessible controls**

```jsx
<Icon name="chat" size={16} alt="" /> Nova Teacher
<button type="button">Start learning with Nova Teacher</button>
<button type="button">Continue lesson</button>
<button type="button">Explain simply</button>
<button type="button">Check my understanding</button>
```

- [ ] **Step 5: Verify frontend tests and build**

Run: `npm test -- MaterialPreview.test.jsx && npm run build`

Expected: all MaterialPreview tests pass and Vite exits 0.

- [ ] **Step 6: Commit Task 2**

```bash
git add nova-class-frontend/src/pages/victoria/MaterialPreview.jsx nova-class-frontend/src/pages/victoria/MaterialPreview.test.jsx
git commit -m "feat: guide PDF lessons with Nova Teacher"
```

### Task 3: Reduce ElevenLabs time-to-speech with Flash

**Files:**

- Modify: `nova-class-backend/services/ai/elevenLabs.js`
- Modify: `nova-class-backend/test/elevenLabs.service.test.js`
- Modify: `nova-class-backend/.env.example`

**Interfaces:**

- Consumes: optional `ELEVENLABS_TTS_MODEL_ID`.
- Produces: existing `textToSpeech(text, voiceId)` MP3 Buffer API with Flash default and `optimize_streaming_latency=3`.

- [ ] **Step 1: Write failing service tests**

```js
test("textToSpeech defaults to ElevenLabs Flash with latency optimization", async () => {
  // Assert model_id is eleven_flash_v2_5 and URL has optimize_streaming_latency=3.
});
test("textToSpeech honors ELEVENLABS_TTS_MODEL_ID", async () => {
  // Set eleven_multilingual_v2 and assert it becomes model_id.
});
```

- [ ] **Step 2: Verify service tests fail**

Run: `node --test test/elevenLabs.service.test.js`

Expected: current v2 model/no latency parameter fails the assertions.

- [ ] **Step 3: Implement configurable Flash defaults**

```js
const DEFAULT_TTS_MODEL_ID = "eleven_flash_v2_5";
const ttsModelId = process.env.ELEVENLABS_TTS_MODEL_ID || DEFAULT_TTS_MODEL_ID;
const url = `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}?optimize_streaming_latency=3`;
```

Preserve existing timeout, headers, voice selection, and Buffer result.

- [ ] **Step 4: Document setting**

```dotenv
# Faster English/Korean/Vietnamese speech. Use eleven_multilingual_v2 for quality-first playback.
ELEVENLABS_TTS_MODEL_ID=eleven_flash_v2_5
```

- [ ] **Step 5: Verify service tests pass**

Run: `node --test test/elevenLabs.service.test.js`

Expected: all tests pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add nova-class-backend/services/ai/elevenLabs.js nova-class-backend/test/elevenLabs.service.test.js nova-class-backend/.env.example
git commit -m "perf: reduce ElevenLabs TTS latency"
```

### Task 4: Final verification

- [ ] **Step 1: Run focused backend tests**

Run: `node --test test/classroom.controller.test.js test/elevenLabs.service.test.js`

Expected: all focused tests pass.

- [ ] **Step 2: Run frontend test and production build**

Run: `npm test -- MaterialPreview.test.jsx && npm run build`

Expected: all MaterialPreview tests pass and Vite exits 0.

- [ ] **Step 3: Inspect production diff for whitespace errors**

Run: `git diff --check HEAD -- nova-class-backend/controllers/victoria/classroom.controller.js nova-class-backend/services/ai/elevenLabs.js nova-class-frontend/src/pages/victoria/MaterialPreview.jsx`

Expected: no output.
