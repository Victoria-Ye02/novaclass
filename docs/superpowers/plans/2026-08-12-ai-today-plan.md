# AI Today Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add separate, actionable Teacher and Student AI Today Plan cards to the NovaClass Dashboard.

**Architecture:** The authenticated progress controller collects role-specific candidate tasks, uses Groq to refine their wording, and safely falls back to deterministic tasks. Dashboard fetches the plan and renders only the sections returned.

**Tech Stack:** Express, MySQL, Groq gateway, React, Vitest, Node test runner.

## Global Constraints

- Return no more than three tasks for each role.
- Every task action must be an internal classroom route.
- Student and teacher facts must never be mixed.
- Groq failure must fall back without breaking Dashboard.

### Task 1: Role-specific planning endpoint

**Files:**
- Modify: `nova-class-backend/controllers/victoria/progress.controller.js`
- Modify: `nova-class-backend/routes/victoria/progress.routes.js`
- Create: `nova-class-backend/test/progress.today-plan.test.js`

- [ ] Write failing controller tests for student, teacher, both-role, and fallback plans.
- [ ] Implement `todayPlan(req, res)` and add `GET /api/progress/today-plan` behind `auth`.
- [ ] Run `node --test test/progress.today-plan.test.js`.

### Task 2: Dashboard plan card

**Files:**
- Modify: `nova-class-frontend/src/pages/victoria/Dashboard.jsx`
- Modify: `nova-class-frontend/src/pages/victoria/Dashboard.test.jsx`

- [ ] Write failing tests for both role sections and task navigation.
- [ ] Fetch `/progress/today-plan` and render the responsive role cards.
- [ ] Run `npm test -- Dashboard.test.jsx && npm run build`.
