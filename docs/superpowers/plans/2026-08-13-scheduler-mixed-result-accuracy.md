# Scheduler Mixed Result Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make network coverage and performance scheduler runs return truthful partial outcomes with complete airport-level counts instead of collapsing valid mixed results into a generic failure.

**Architecture:** Preserve the database `failed` status for alerting, while retaining complete collector and regional-dispatch facts in `detail_json`. `PerformanceProbeDispatchService` produces airport-level dispatch counts, `SchedulerTaskExecutor` composes one validated top-level summary plus stage detail, and `schedulerRunPresentation` derives the existing `partial` outcome.

**Tech Stack:** TypeScript, Node test runner, React, MySQL JSON scheduler records, Vite.

---

### Task 1: Lock mixed-result contracts with failing tests

**Files:**
- Modify: `backend/tests/performanceProbeDispatchService.test.ts`
- Modify: `backend/tests/schedulerTaskExecutor.test.ts`
- Modify: `backend/tests/schedulerRunPresentation.test.ts`
- Modify: `backend/tests/adminSchedulerOutcomeUi.test.ts`

- [ ] **Step 1: Test regional airport counts**

Require successful, skipped, failed, and idempotent dispatches to return `airport_count`, `success_count`, `failure_count`, and `skipped_count`. An idempotent `create: async () => false` still counts as one successfully processed airport while `created` remains zero.

- [ ] **Step 2: Test complete executor summaries**

Add a network coverage script result with `airport_count: 63`, `success_count: 58`, `failure_count: 3`, `skipped_count: 2`, and failures that expose only `error_code`. Assert the executor preserves all values and normalizes the code into the safe `error` field.

Update the performance fixture to return this regional fact shape:

```ts
{
  airport_count: 61,
  success_count: 59,
  failure_count: 2,
  skipped_count: 0,
  created: 118,
}
```

Assert the top-level summary uses regional airport counts and `central_collection` retains the script counts.

- [ ] **Step 3: Test presentation and admin labels**

Add network coverage `58 + 3 + 2 = 63` and performance `59 + 2 = 61` runs; both must derive `partial`. Require the admin source to contain `中心采集` and `区域派发`.

- [ ] **Step 4: Run focused tests and confirm RED**

Run:

```bash
npx tsx --test backend/tests/performanceProbeDispatchService.test.ts backend/tests/schedulerTaskExecutor.test.ts backend/tests/schedulerRunPresentation.test.ts backend/tests/adminSchedulerOutcomeUi.test.ts
```

Expected: failures for the missing airport counts, skipped count, stage summary, and admin labels.

### Task 2: Produce airport-level regional dispatch facts

**Files:**
- Modify: `backend/src/services/performanceProbeDispatchService.ts`
- Test: `backend/tests/performanceProbeDispatchService.test.ts`

- [ ] **Step 1: Extend `PerformanceProbeDispatchResult`**

Add:

```ts
airport_count: number;
success_count: number;
failure_count: number;
skipped_count: number;
```

- [ ] **Step 2: Classify each airport exactly once**

No active mainland probe returns skipped. Missing snapshot, empty selected nodes, or exceptions return failed. Passing prerequisites returns success even when all `INSERT IGNORE` calls report existing idempotent tasks; task counters still describe only newly inserted jobs.

- [ ] **Step 3: Merge airport and task counts independently**

Sum the four airport counters separately from `created`, `official`, `shadow`, `job_ids`, and failures.

- [ ] **Step 4: Run dispatch tests and confirm GREEN**

Run `npx tsx --test backend/tests/performanceProbeDispatchService.test.ts` and expect zero failures.

### Task 3: Preserve complete collector summaries and compose performance stages

**Files:**
- Modify: `backend/src/services/schedulerTaskExecutor.ts`
- Test: `backend/tests/schedulerTaskExecutor.test.ts`

- [ ] **Step 1: Extend `ScriptExecutionSummary`**

Parse `skipped_count` with a default of zero and include `N skipped` in the textual summary when positive. Accept either `error` or `error_code` in failure objects, then apply existing sanitization.

- [ ] **Step 2: Compose performance detail**

With regional dispatch, expose regional airport counts at the top level, preserve script counts under `central_collection`, retain the raw structured `regional_dispatch`, and normalize its failure codes into the top-level failures array. Without regional dispatch, keep the script summary at the top level.

- [ ] **Step 3: Preserve alerting semantics**

Any regional failure keeps persisted status `failed`; valid mixed top-level counts allow the API to derive `partial`.

- [ ] **Step 4: Run executor tests and confirm GREEN**

Run `npx tsx --test backend/tests/schedulerTaskExecutor.test.ts` and expect zero failures.

### Task 4: Normalize and render stage-aware results

**Files:**
- Modify: `backend/src/types/domain.ts`
- Modify: `backend/src/services/schedulerRunPresentation.ts`
- Modify: `backend/src/services/adminSchedulerService.ts`
- Modify: `src/admin/AdminApp.tsx`
- Modify: `backend/tests/schedulerRunPresentation.test.ts`
- Modify: `backend/tests/adminSchedulerService.test.ts`
- Modify: `backend/tests/adminSchedulerOutcomeUi.test.ts`

- [ ] **Step 1: Add a stage-summary view**

Define:

```ts
export interface SchedulerRunStageSummary {
  central_collection: SchedulerRunResultSummary | null;
  regional_dispatch: SchedulerRunResultSummary | null;
  regional_job_count: number;
}
```

Add `stage_summary` to run views and `last_stage_summary` to daily-stat views.

- [ ] **Step 2: Normalize skipped and stage counts**

For stability, performance, and network coverage, read `detail.skipped_count ?? 0`. Accept a stage only when `total = success + failure + skipped`. Convert regional `error_code` through the existing failure sanitizer.

- [ ] **Step 3: Render a restrained detail line**

Add a `SchedulerStageSummary` component using existing neutral text styles. Render, where available, `中心采集：成功 X，失败 Y，跳过 Z；区域派发：成功 X，失败 Y，任务排队 N` in latest-run cards, daily statistics, and execution logs.

- [ ] **Step 4: Run presentation and UI tests**

Run:

```bash
npx tsx --test backend/tests/schedulerRunPresentation.test.ts backend/tests/adminSchedulerService.test.ts backend/tests/adminSchedulerOutcomeUi.test.ts
```

Expected: zero failures and both production-shaped mixed examples derive `partial`.

### Task 5: Verify, publish, deploy, and accept production

**Files:**
- Generate required `dist` assets only through `npm run build`
- Exclude unrelated Vite and Python cache files

- [ ] **Step 1: Run all focused regressions**

Run the four focused test files from Task 1. Expected: zero failures.

- [ ] **Step 2: Run full gates separately**

Run each command and capture its exit code:

```bash
npm run test:backend
npm run server:typecheck
npm run lint
npm run build
git diff --check
```

Expected: every command exits zero; report any pre-existing failure separately.

- [ ] **Step 3: Commit only intended files**

Inspect the diff, stage implementation, tests, plan, and required generated assets explicitly, and exclude `node_modules/.vite` plus `scripts/__pycache__`.

- [ ] **Step 4: Publish current `main`**

Push without creating a branch, verify local and remote SHA match, and wait for the Docker publication workflow to succeed.

- [ ] **Step 5: Deploy GateRank API and web only**

Pull and recreate `gaterank-api` and `gaterank-web` in the confirmed production compose directory. Do not restart MySQL, OpenResty, probes, or unrelated services.

- [ ] **Step 6: Perform read-only production acceptance**

Verify `/healthz`, container restart counts, deployed SHA, and the next scheduler result. Confirm `detail_json` includes complete skipped or regional airport counts and the API returns `partial` with matching figures. Do not rewrite historical rows.
