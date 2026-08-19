# Leave request attachment (design)

## Context

`ClassDetail.jsx` has a "Request leave" modal in the student attendance view (`leaveModal`/`leaveForm`/`leaveHistory` state, ~line 110 and ~2737-2968). It is a frontend-only mockup: submitting pushes into local `leaveHistory` state, with no backend table, API, or teacher-side view. Requests do not persist past a page reload.

Scope for this change: extend the mockup to accept a supporting file (e.g. a hospital note) when the reason is "Medical," matching its current fidelity level (no backend wiring). A full backend-integrated version (persistence, teacher approval, attendance sync) was discussed and deferred — not part of this change.

## Design

- Add `attachment: null` to the `leaveForm` state object.
- In the leave request form modal, when `leaveForm.reasonType === "medical"`, render a file input:
  - Label: "Hospital note / medical certificate (optional)"
  - `accept="image/*,.pdf"`
  - Stores the selected `File` object in `leaveForm.attachment`
  - Shows the selected filename with a small remove (×) button once chosen
- Changing `reasonType` away from `"medical"` clears `leaveForm.attachment`.
- On submit, the existing `{ ...leaveForm }` spread into `leaveHistory` already carries `attachment` through — no submit-handler change needed beyond the state addition.
- In the "My leave requests" history list, show a small "📎 filename" line under the request when `req.attachment` is present.

## Out of scope

- No backend table, API route, or persistence.
- No teacher-side view of requests or attachments.
- No file size/type validation beyond the `accept` attribute (browser-level hint only).
