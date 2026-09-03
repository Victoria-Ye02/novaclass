# PDF Teaching Agent Design

## Goal

Turn the PDF-side AI from a reactive chat box into **Nova Teacher**, a lesson-scoped teaching agent. Nova begins teaching automatically as soon as a student opens the material — no button, no waiting to be asked — then explains the open PDF step-by-step, checks understanding, adapts after the student's answer, and remembers the lesson session when the PDF is reopened.

## Product behavior

### Starting a lesson

Nova Teacher starts itself: as soon as the material's chat history has loaded, the panel sends a `start` (or, if a prior session exists for this material, `continue`) teaching request automatically — the student never has to ask to be taught. The chat handle still opens/collapses the panel as before, but that's purely a visibility toggle now; it does not gate whether the lesson has started.

This request carries the material, current PDF page, total pages, UI language, and prior conversation. The agent responds in the student's current interface language with a compact first teaching turn:

1. The learning goal for the current page/topic.
2. One short explanation grounded in the material.
3. One concrete example or analogy where useful.
4. One short comprehension question.

If an existing teaching conversation is restored for this material, the auto-triggered request uses `continue` instead of `start`, so Nova picks up from where the student left off rather than repeating the greeting or erasing progress.

### Teaching turns

The panel exposes three quick actions, in addition to the normal text input:

- **Continue lesson** — Nova advances to the next logical concept in the material, rather than asking the student what they want.
- **Explain simply** — Nova re-explains the current concept with simpler words and a fresh example.
- **Check my understanding** — Nova asks one short material-grounded question, then assesses the student's next answer.

Free-text questions remain available, but Nova answers as the current teacher: it stays in the opened material, returns to the teaching path afterward, and ends non-trivial explanations with the next useful step or check-in.

### Agent state and persistence

Teaching state is inferred from and stored alongside the existing per-material chat history, without adding a second database table for demo scope. The frontend sends an explicit `teachingIntent` on every agent request (`start`, `continue`, `simplify`, `check`, `answer`). The backend rebuilds context from the current PDF page, existing history, and intent, so an old session resumes naturally after a PDF reopen.

The backend does not claim an answer is correct unless a comprehension check was actually asked in the immediately preceding assistant turn. For a student answer after a check, the prompt asks the model to give specific, supportive feedback before choosing either reinforcement or the next concept.

## Voice experience

Voice uses the same Teaching Agent request path as text. Agent replies for voice are constrained to one to three short spoken sentences, but are still teaching turns rather than generic conversational replies.

### Latency diagnosis and fix

The current flow is serial: the browser waits for the complete LLM response, then waits for a complete MP3 response from `/classroom/tts`, because the backend buffers ElevenLabs audio with `arrayBuffer()` and the browser creates the audio element only after the entire Blob arrives. It uses `eleven_multilingual_v2`, which prioritizes quality but adds generation latency.

For non-Burmese voice replies, use ElevenLabs' lower-latency `eleven_flash_v2_5` model by default, configurable with `ELEVENLABS_TTS_MODEL_ID`. Keep `eleven_multilingual_v2` as a configurable quality fallback. The API will request `optimize_streaming_latency=3`, pass through the upstream MP3 stream instead of buffering it, and return `Transfer-Encoding: chunked`. The browser uses an `HTMLAudioElement` pointed at a temporary authenticated playback URL only if the app can securely make that URL available; since this app currently authenticates normal API calls with a header, the initial delivery keeps Blob playback for correctness and relies on Flash + short replies to materially reduce time-to-first-audio. A future production upgrade can add a short-lived signed audio URL or MediaSource streaming.

Burmese remains on Azure/Edge neural speech because the current ElevenLabs implementation does not have a reliable Burmese voice. The UI must identify this as Burmese neural speech, not imply it is the purchased ElevenLabs voice.

## API contract

Existing endpoint remains: `POST /api/classroom/materials/:materialId/ai`.

Teaching requests use:

```json
{
  "action": "chat",
  "mode": "teacher",
  "teachingIntent": "start | continue | simplify | check | answer",
  "message": "student text or deterministic quick-action instruction",
  "history": [{ "role": "assistant | user", "content": "..." }],
  "currentPage": 1,
  "totalPages": 12,
  "lang": "en | my | ko | vi",
  "voice": false
}
```

The response remains `{ "reply": "..." }`, preserving existing frontend and voice interfaces. Teacher-mode replies are not stored in the first-question cache because the current intent and conversation path determine their result.

## Files and responsibilities

- `nova-class-frontend/src/pages/victoria/MaterialPreview.jsx`: Nova Teacher panel state, intentional start/resume UI, teaching quick actions, and teacher-mode request payloads.
- `nova-class-frontend/src/pages/victoria/MaterialPreview.test.jsx`: interaction tests covering start, resume, and quick-action payloads.
- `nova-class-backend/controllers/victoria/classroom.controller.js`: agent-specific system prompt and request validation within `materialAI`; preserve existing assistant mode for backward compatibility.
- `nova-class-backend/test/classroom.controller.test.js`: backend prompt and persistence behavior tests.
- `nova-class-backend/services/ai/elevenLabs.js`: low-latency model selection and ElevenLabs streaming-latency parameter.
- `nova-class-backend/test/elevenLabs.service.test.js`: assert model and latency parameters.
- `nova-class-backend/.env.example`: document `ELEVENLABS_TTS_MODEL_ID=eleven_flash_v2_5`.

## Constraints

- No API keys reach the frontend.
- No user database data or existing student/teacher behavior is overwritten.
- The agent is grounded only in the opened material; it must say when page text cannot be read.
- UI labels use Nova Teacher rather than AI Chat in this PDF flow.
- Keep existing manual questions, chat history, microphone interruption, and browser-voice fallback working.
- No database migration for this demo iteration.

## Verification

- Frontend tests prove the student intentionally starts a teaching session and each quick action sends `mode: "teacher"` plus the proper intent.
- Backend tests prove teacher mode receives the material/page context, follows the teaching sequence, and excludes teacher-mode first turns from the shared generic-chat cache.
- ElevenLabs service tests prove Flash model and latency parameter are sent by default while an environment override works.
- Run focused frontend/backend tests and the frontend production build.
