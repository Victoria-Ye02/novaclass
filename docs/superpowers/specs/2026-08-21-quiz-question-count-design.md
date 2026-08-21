# Practice Quiz: selectable question count (design)

## Context

K.MATE's Practice Quiz settings screen (`KMate.jsx`, `QuizMode()`) already has a "Number of Questions" selector, but it only offers `5` and `10`, defaulting to `5`. The generate (`POST /kmate/quiz/generate`) and check (`POST /kmate/quiz/check`) endpoints in `kmate.controller.js` are already fully count-agnostic: `count` flows directly into the AI prompt (`Generate ${count} multiple-choice...`), and scoring uses `questions.length` dynamically. No backend change is required.

Settings today is a single screen: Topic, Count, and Language are three button-rows above one "Start Quiz" button — not a multi-step wizard. Per the request to keep the UI flow unchanged as much as possible, this stays a single screen.

## Design

- `count` state initializes to `null` instead of `5` — no option is pre-selected.
- Count options change from `[5,10]` to `[3,5,10]`.
- "Start Quiz" button gets `disabled={!count}`, so quiz generation cannot fire until the student explicitly picks 3, 5, or 10 — mirroring the existing `disabled={!answers[current]}` pattern used on the Next/Submit buttons later in the same component.

## Out of scope

- No backend/controller/route changes (already generic).
- No change to question rendering, answer submission, or scoring/results display — all already derive from `questions.length` / `result.total` dynamically.
- Not introducing a separate wizard step for count selection.
