# Manual Regional Performance Wait Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep a manual performance job active until its Shanghai and Guangzhou probe jobs have returned, then refresh the admin evidence automatically.

**Architecture:** Return exact regional job IDs from dispatch, wait for those IDs in the manual-job service only, and reuse the existing frontend manual-job poller. Refresh the dashboard for both successful and failed terminal states so partial evidence remains visible.

**Tech Stack:** TypeScript, Node.js, Express, MySQL, React, node:test

---

### Task 1: Track exact dispatched probe jobs

**Files:**
- Modify: `backend/src/services/performanceProbeDispatchService.ts`
- Modify: `backend/src/repositories/performanceProbeJobRepository.ts`
- Test: `backend/tests/performanceProbeDispatchService.test.ts`
- Test: `backend/tests/performanceProbeJobRepository.test.ts`

- [ ] Add failing tests asserting that dispatch returns the created UUIDs and that repository status reads are limited to the requested IDs.
- [ ] Extend `PerformanceProbeDispatchResult` with `job_ids: string[]` and append only IDs whose insert succeeds.
- [ ] Add `listByIds(jobIds)` to the repository using a parameterized `IN` query and return normalized jobs.
- [ ] Run the two focused test files and confirm they pass.

### Task 2: Wait for regional completion in manual jobs

**Files:**
- Modify: `backend/src/services/performanceProbeDispatchService.ts`
- Modify: `backend/src/services/manualJobService.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/performanceProbeDispatchService.test.ts`
- Test: `backend/tests/manualJobService.test.ts`

- [ ] Add failing tests for waiting progress, completed jobs, terminal failure, and timeout.
- [ ] Implement `waitForJobs(jobIds, options)` with bounded polling and progress callbacks.
- [ ] Change manual performance/full execution to update `markRunning()` with regional progress and finish only after the exact dispatched jobs complete.
- [ ] Keep scheduler dispatch non-blocking.
- [ ] Run focused service tests and confirm they pass.

### Task 3: Refresh evidence for every terminal outcome

**Files:**
- Modify: `src/admin/AdminApp.tsx`
- Test: `src/admin/AdminApp.test.tsx`

- [ ] Add a failing UI regression test proving failed terminal jobs reload the dashboard just like successful jobs.
- [ ] Reload the dashboard before rendering either terminal message; keep existing neutral/success/error styling.
- [ ] Run the focused admin UI test and confirm it passes.

### Task 4: Verify and publish

**Files:**
- Modify generated admin bundle only through the existing build.

- [ ] Run focused backend and frontend tests.
- [ ] Run `npm run server:typecheck`, `npm run lint`, Python probe tests, the backend suite, and `npm run build`.
- [ ] Run `git diff --check` and inspect the final diff for unrelated changes or secrets.
- [ ] Commit the scoped fix, push `main`, wait for CI, deploy API and Web together, and verify the production manual flow returns both regional results without a page refresh.
