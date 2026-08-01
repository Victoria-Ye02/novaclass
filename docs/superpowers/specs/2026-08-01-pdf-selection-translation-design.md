# PDF Selection Translation Design

## Goal

Let a student select a word, sentence, or paragraph in an in-app PDF lesson and receive a translation in the language currently selected for the NovaClass interface.

## Scope

- The feature works only in `PdfLessonViewer` while a PDF material is open.
- The selected text is translated on demand; no automatic PDF-wide analysis or persistent vocabulary storage is added.
- A request can contain up to 5,000 characters. Longer selections are translated in consecutive chunks and displayed in their original order.
- The target language is the existing `nova_lang` setting: `my` maps to Burmese and `en` maps to English. Unsupported future settings are rejected by the backend rather than guessed.

## User Flow

1. The student drags across text in the PDF text layer.
2. When a non-empty selection ends inside the PDF viewer, a small `Translate` action appears beside the selection.
3. Selecting the action sends the selected text and current app language to a protected backend endpoint.
4. The result appears in a dismissible viewer popover. It shows only the target-language translation.
5. The UI shows a loading state while translating and a short retryable error if the request fails.

## Architecture

The frontend owns browser selection detection, popover placement, chunking, and rendering. It calls a new authenticated `POST /api/ai/translate` endpoint through the existing Axios service.

The backend validates the target language and total text size, chunks text at safe boundaries, and calls the existing Groq `completeText` gateway once per chunk. The prompt requires a faithful translation only; no explanations, markdown, or extra language output. The endpoint returns `{ translation }` so the UI stays independent of the provider.

## Error Handling and Safety

- Empty or whitespace-only selection returns HTTP 400.
- Target language outside `my` and `en` returns HTTP 400.
- Individual chunks are capped at 5,000 characters and split at sentence/whitespace boundaries where possible.
- A provider failure returns HTTP 502 with a generic user-safe error; provider details remain server-side.
- The selected document text is not stored in the database.

## Testing

- Backend node tests cover invalid inputs, target-language prompt construction, multi-chunk ordering, and provider failures.
- Frontend Vitest tests cover displaying the translation action for a selection, passing the chosen app language, loading/success/error states, and dismissing the popover.
