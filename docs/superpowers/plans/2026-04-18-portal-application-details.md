# Portal Application Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show complete applicant-submitted airport details in the portal and allow self-editing before payment.

**Architecture:** Extend the existing portal backend with one applicant-scoped update endpoint and reuse the current `buildPortalView(...)` response shape. Update the portal page to render a dedicated application-details section that switches between editable and read-only states based on payment status.

**Tech Stack:** React, TypeScript, Express, mysql2, node:test

---

### Task 1: Backend Applicant Update Flow

**Files:**
- Modify: `backend/src/repositories/airportApplicationRepository.ts`
- Modify: `backend/src/routes/portalRoutes.ts`
- Test: `backend/tests/portalRoutes.test.ts`

- [ ] Add a repository update method for applicant-editable fields.
- [ ] Add `PATCH /portal/application` with unpaid-only guard and payload validation.
- [ ] Add backend tests for unpaid success and paid rejection.

### Task 2: Portal UI Details and Edit Form

**Files:**
- Modify: `src/App.tsx`

- [ ] Expand `PortalApplicationView` usage to cover all editable fields.
- [ ] Add local portal application form state seeded from `view.application`.
- [ ] Render complete submitted details in the portal for both unpaid and paid states.
- [ ] Add unpaid edit/save flow and paid read-only lock messaging.

### Task 3: Verification

**Files:**
- Test: `backend/tests/portalRoutes.test.ts`
- Modify: `src/App.tsx`

- [ ] Run targeted backend tests for portal routes.
- [ ] Run frontend typecheck.
- [ ] Run full production build.
