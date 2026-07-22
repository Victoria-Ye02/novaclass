# Project AI Model Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every NovaClass text-generation and reasoning call through Groq `openai/gpt-oss-120b` while retaining Google Vision and Whisper only as input preprocessors.

**Architecture:** A focused AI gateway owns the Groq client and single text model constant. Existing controllers call the gateway instead of constructing provider clients or naming text models. The multimodal controller converts images through Google Vision and audio through Whisper before any GPT-OSS reasoning call.

**Tech Stack:** Node.js CommonJS, Express, Groq SDK, `@google-cloud/vision`, Node test runner.

## Global Constraints

- Every text-generation and reasoning call must use exactly `openai/gpt-oss-120b`.
- `whisper-large-v3` may remain only on `groq.audio.transcriptions.create`.
- Google Cloud Vision may remain only for OCR and visual feature extraction.
- Public API response shapes must remain unchanged.
- No Claude or Llama model identifier may remain in production controller or service code.

---

### Task 1: Shared GPT-OSS Gateway

**Files:**
- Create: `nova-class-backend/services/ai/groqText.js`
- Create: `nova-class-backend/test/groqText.service.test.js`

**Interfaces:**
- Produces: `TEXT_MODEL`, `completeText(options)`, `transcribeAudio(options)`, and `setGroqClientForTests(client)`.
- `completeText({ messages, maxTokens, responseFormat })` returns the Groq completion object.
- `transcribeAudio({ file, responseFormat })` returns the Whisper transcription.

- [ ] **Step 1: Write the failing gateway tests**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const gateway = require("../services/ai/groqText");

test("completeText always selects GPT-OSS 120B", async () => {
  let request;
  gateway.setGroqClientForTests({
    chat: { completions: { create: async value => { request = value; return { choices: [] }; } } },
    audio: { transcriptions: { create: async () => "text" } },
  });
  await gateway.completeText({ messages: [{ role: "user", content: "hello" }], maxTokens: 77 });
  assert.equal(request.model, "openai/gpt-oss-120b");
  assert.equal(request.max_tokens, 77);
});

test("transcribeAudio keeps Whisper isolated to transcription", async () => {
  let request;
  gateway.setGroqClientForTests({
    chat: { completions: { create: async () => ({ choices: [] }) } },
    audio: { transcriptions: { create: async value => { request = value; return "transcript"; } } },
  });
  assert.equal(await gateway.transcribeAudio({ file: "stream", responseFormat: "text" }), "transcript");
  assert.equal(request.model, "whisper-large-v3");
});
```

- [ ] **Step 2: Run the tests and verify the missing module failure**

Run: `cd nova-class-backend && node --test test/groqText.service.test.js`

Expected: FAIL with `Cannot find module '../services/ai/groqText'`.

- [ ] **Step 3: Implement the gateway**

```js
const Groq = require("groq-sdk");

const TEXT_MODEL = "openai/gpt-oss-120b";
let client = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function completeText({ messages, maxTokens = 1024, responseFormat }) {
  return client.chat.completions.create({
    model: TEXT_MODEL,
    messages,
    max_tokens: maxTokens,
    ...(responseFormat ? { response_format: responseFormat } : {}),
  });
}

async function transcribeAudio({ file, responseFormat = "text" }) {
  return client.audio.transcriptions.create({
    file,
    model: "whisper-large-v3",
    response_format: responseFormat,
  });
}

function setGroqClientForTests(nextClient) { client = nextClient; }

module.exports = { TEXT_MODEL, completeText, transcribeAudio, setGroqClientForTests };
```

- [ ] **Step 4: Run the gateway tests**

Run: `cd nova-class-backend && node --test test/groqText.service.test.js`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add nova-class-backend/services/ai/groqText.js nova-class-backend/test/groqText.service.test.js
git commit -m "feat: centralize GPT-OSS text inference"
```

### Task 2: Migrate All Text Controllers

**Files:**
- Modify: `nova-class-backend/controllers/victoria/ai.controller.js`
- Modify: `nova-class-backend/controllers/victoria/kmate.controller.js`
- Modify: `nova-class-backend/controllers/victoria/classroom.controller.js`
- Modify: `nova-class-backend/controllers/victoria/assignment.controller.js`
- Modify: `nova-class-backend/package.json`
- Modify: `nova-class-backend/package-lock.json`
- Create: `nova-class-backend/test/ai-model-standardization.test.js`

**Interfaces:**
- Consumes: `completeText` from Task 1.
- Produces: Existing controller exports and JSON response shapes without Anthropic usage or direct text model IDs.

- [ ] **Step 1: Write a failing production-source invariant test**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("production AI code has no Claude or Llama model identifiers", () => {
  const names = ["ai", "kmate", "classroom", "assignment"];
  const sources = names.map(name => fs.readFileSync(
    path.join(__dirname, "..", "controllers", "victoria", `${name}.controller.js`),
    "utf8"
  ));
  const joined = sources.join("\n");
  assert.doesNotMatch(joined, /claude-|llama-/i);
  assert.doesNotMatch(joined, /@anthropic-ai\/sdk/);
});
```

- [ ] **Step 2: Run it and verify it finds current model IDs**

Run: `cd nova-class-backend && node --test test/ai-model-standardization.test.js`

Expected: FAIL matching a current Claude or Llama identifier.

- [ ] **Step 3: Replace controller calls with the gateway**

At each controller top level import:

```js
const { completeText } = require("../../services/ai/groqText");
```

Replace each text completion with this shape, retaining its existing messages, token limit, parsing, and response object:

```js
const completion = await completeText({
  messages,
  maxTokens: 1024,
  responseFormat: needsJson ? { type: "json_object" } : undefined,
});
const output = completion.choices[0].message.content;
```

For `ai.controller.js`, convert Anthropic's separate `system` argument into the first system message and keep responses exactly `{ response }` and the current summary JSON. Delete the Anthropic client construction.

For `classroom.controller.js`, make `askGroq` delegate to `completeText`; migrate both study chat and structured actions. For K-Mate and assignment checking, keep prompts and response parsing unchanged.

- [ ] **Step 4: Remove the unused Anthropic dependency**

Run: `cd nova-class-backend && npm uninstall @anthropic-ai/sdk`

Expected: `package.json` and `package-lock.json` no longer list `@anthropic-ai/sdk`.

- [ ] **Step 5: Run the invariant and complete backend suite**

Run: `cd nova-class-backend && npm test`

Expected: all tests PASS, including the source invariant.

- [ ] **Step 6: Commit**

```bash
git add nova-class-backend/controllers/victoria/ai.controller.js nova-class-backend/controllers/victoria/kmate.controller.js nova-class-backend/controllers/victoria/classroom.controller.js nova-class-backend/controllers/victoria/assignment.controller.js nova-class-backend/package.json nova-class-backend/package-lock.json nova-class-backend/test/ai-model-standardization.test.js
git commit -m "feat: standardize text AI on GPT-OSS 120B"
```

### Task 3: Replace the Image Reasoning Model with Vision Preprocessing

**Files:**
- Create: `nova-class-backend/services/ai/googleVision.js`
- Create: `nova-class-backend/test/googleVision.service.test.js`
- Modify: `nova-class-backend/controllers/victoria/multimodal.controller.js`
- Modify: `nova-class-backend/package.json`
- Modify: `nova-class-backend/package-lock.json`
- Modify: `nova-class-backend/test/ai-model-standardization.test.js`

**Interfaces:**
- Produces: `extractImageContext(buffer)` returning `{ text: string, labels: string[], objects: string[] }` and `detectDocumentText(buffer)` returning the raw Vision document annotation.
- Consumes: `completeText` and `transcribeAudio` from Task 1.

- [ ] **Step 1: Install Vision and write the failing adapter test**

Run: `cd nova-class-backend && npm install @google-cloud/vision`

Add a provider injection test:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const vision = require("../services/ai/googleVision");

test("extractImageContext returns bounded text labels and objects", async () => {
  vision.setVisionClientForTests({
    annotateImage: async () => [{
      fullTextAnnotation: { text: "Equation x = 2" },
      labelAnnotations: [{ description: "Document" }],
      localizedObjectAnnotations: [{ name: "Book" }],
    }],
  });
  assert.deepEqual(await vision.extractImageContext(Buffer.from("image")), {
    text: "Equation x = 2",
    labels: ["Document"],
    objects: ["Book"],
  });
});
```

- [ ] **Step 2: Verify failure, then implement the Vision adapter**

Run: `cd nova-class-backend && node --test test/googleVision.service.test.js`

Expected before implementation: FAIL because `googleVision` does not exist.

Implementation core:

```js
const vision = require("@google-cloud/vision");
let client = new vision.ImageAnnotatorClient();

async function extractImageContext(buffer) {
  const [result] = await client.annotateImage({
    image: { content: buffer },
    features: [
      { type: "DOCUMENT_TEXT_DETECTION" },
      { type: "LABEL_DETECTION", maxResults: 12 },
      { type: "OBJECT_LOCALIZATION", maxResults: 12 },
    ],
  });
  return {
    text: (result.fullTextAnnotation?.text || "").slice(0, 12000),
    labels: (result.labelAnnotations || []).map(item => item.description).filter(Boolean),
    objects: (result.localizedObjectAnnotations || []).map(item => item.name).filter(Boolean),
  };
}

async function detectDocumentText(buffer) {
  const [result] = await client.documentTextDetection({ image: { content: buffer } });
  return result.fullTextAnnotation || { text: "", pages: [] };
}

function setVisionClientForTests(nextClient) { client = nextClient; }
module.exports = { extractImageContext, detectDocumentText, setVisionClientForTests };
```

- [ ] **Step 3: Migrate the multimodal controller**

For images, call `extractImageContext(fs.readFileSync(filePath))`, put its text, labels, and objects into a text prompt, then call `completeText`. For audio, call `transcribeAudio`; only call `completeText` when a question is supplied. For PDF and DOCX, call `completeText`. Remove the direct Groq client and all model strings from this controller.

- [ ] **Step 4: Strengthen and run tests**

Extend the invariant test's `names` array with `"multimodal"` and assert `multimodal.controller.js` contains both `extractImageContext` and `completeText`, then run:

Run: `cd nova-class-backend && npm test`

Expected: all tests PASS and only `services/ai/groqText.js` contains the allowed GPT-OSS and Whisper model IDs.

- [ ] **Step 5: Commit**

```bash
git add nova-class-backend/services/ai/googleVision.js nova-class-backend/test/googleVision.service.test.js nova-class-backend/controllers/victoria/multimodal.controller.js nova-class-backend/test/ai-model-standardization.test.js nova-class-backend/package.json nova-class-backend/package-lock.json
git commit -m "feat: preprocess images before GPT-OSS reasoning"
```

### Task 4: Model Migration Verification

**Files:**
- Modify only if verification exposes a defect in files already listed above.

- [ ] **Step 1: Run backend tests**

Run: `cd nova-class-backend && npm test`

Expected: all tests PASS.

- [ ] **Step 2: Audit production model literals**

Run: `rg -n 'model\s*:' nova-class-backend --glob '*.js' --glob '!**/node_modules/**' --glob '!**/test/**'`

Expected: text model selection exists only in `services/ai/groqText.js`; the only additional model literal is the Whisper transcription model in that same gateway.

- [ ] **Step 3: Verify dependency removal and lock integrity**

Run: `cd nova-class-backend && npm ls @anthropic-ai/sdk @google-cloud/vision groq-sdk`

Expected: Anthropic is absent; Vision and Groq resolve without dependency errors.

- [ ] **Step 4: Commit verification fixes if required**

```bash
git add nova-class-backend
git commit -m "fix: complete GPT-OSS model migration"
```
