# AI Today Plan Design

## Goal

Show role-specific, actionable daily plans on the NovaClass Dashboard so a person who teaches, learns, or does both knows their highest-priority work.

## User Roles

A NovaClass account can have two simultaneous classroom roles:

- **Teacher:** owns one or more classes.
- **Student:** is enrolled in one or more classes.

The Dashboard must not select one global role. It displays a Teacher Today Plan when the user owns a class, a Student Today Plan when the user is enrolled in a class, and both sections when both conditions are true.

## Student Today Plan

The backend collects only the current student's accessible facts: open assignments with due dates and submission status, and recent course materials. The AI produces up to three ordered tasks with a concise reason and a safe dashboard/classroom destination.

Priority order is: overdue or due soon unsubmitted assignments, then upcoming unsubmitted assignments, then recent material review. Each card action opens the related class.

## Teacher Today Plan

The backend collects teacher-owned facts: submissions awaiting grading, published assignments with students who have not submitted, and recent classes without course materials. The AI produces up to three ordered tasks with a concise reason and destination.

Priority order is: submissions awaiting grade, due-soon assignments with outstanding students, then classes needing current material. Each card action opens the related class.

## Architecture

`GET /api/progress/today-plan` is authenticated and owns access-controlled fact collection. It obtains a deterministic priority-sorted candidate list from MySQL and calls the existing Groq text gateway only when there are candidate tasks. The prompt returns strict JSON. The controller validates returned task IDs against the candidate list before sending `{ studentPlan, teacherPlan }` to the browser.

`Dashboard.jsx` fetches this endpoint with its existing dashboard data and renders a responsive AI Today Plan card. The frontend never determines role or invents task links; it renders the returned sections and sends the user to the returned internal route.

## Reliability and Safety

- No plan section appears when its role has no eligible tasks.
- If Groq is unavailable or returns invalid JSON, the endpoint returns the deterministic candidate tasks rather than failing the Dashboard.
- Task text sent to Groq contains titles, dates, statuses, and counts only; no submission body, private note, or student identity is sent.
- Return at most three tasks per role and only internal `/classroom/<id>` routes.

## Testing

- Backend tests validate fact collection role separation, candidate-link validation, AI JSON parsing, and fallback ordering.
- Dashboard tests verify fetching, rendering both role sections, hiding absent sections, and navigating on an action.
