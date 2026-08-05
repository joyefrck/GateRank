# Scheduler Partial Outcome Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show exact per-airport success and failure counts for scheduler runs, derive a visible partial-success outcome, and expose every stored failure item without weakening persisted failure semantics.

**Architecture:** Keep `admin_scheduler_runs.status` unchanged and add a pure backend presentation adapter that derives `outcome` and `result_summary` from structured details or legacy summaries. Extend batch executors to persist complete structured failures, attach the derived presentation to task, run, and daily-stat API responses, then render compact semantic summaries and accessible expandable failure details in the existing admin page.

**Tech Stack:** TypeScript, Node.js test runner, Express, MySQL 8 JSON fields, React 19, Tailwind CSS, Vite.

---

### Task 1: Normalize scheduler batch outcomes

**Files:**
- Create: `backend/src/services/schedulerRunPresentation.ts`
- Modify: `backend/src/types/domain.ts`
- Test: `backend/tests/schedulerRunPresentation.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Cover structured subscription details, legacy `60/61 succeeded, 1 failed` summaries, full failures, incomplete historical failures, resample count mapping, invalid counts, and URL redaction:

```ts
const view = presentSchedulerRun(createRun({
  task_key: 'stability',
  status: 'failed',
  message: '稳定性采集失败：60/61 succeeded, 1 failed; 网际快车 #43: The read operation timed out',
  detail_json: { summary: '60/61 succeeded, 1 failed; 网际快车 #43: The read operation timed out' },
}));
assert.equal(view.outcome, 'partial');
assert.equal(view.result_summary?.success_count, 60);
assert.equal(view.result_summary?.failure_count, 1);
assert.equal(view.result_summary?.failures[0]?.airport_id, 43);
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npx tsx --test backend/tests/schedulerRunPresentation.test.ts`

Expected: failure because `schedulerRunPresentation.ts` does not exist.

- [ ] **Step 3: Add presentation types and pure adapter**

Add domain types equivalent to:

```ts
export type SchedulerRunOutcome = SchedulerRunStatus | 'partial';
export interface SchedulerRunFailureDetail {
  airport_id: number | null;
  airport_name: string | null;
  error: string;
}
export interface SchedulerRunResultSummary {
  total_count: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  failures: SchedulerRunFailureDetail[];
  missing_failure_detail_count: number;
}
export interface SchedulerRunView extends SchedulerRun {
  outcome: SchedulerRunOutcome;
  result_summary: SchedulerRunResultSummary | null;
}
```

Implement `presentSchedulerRun(run)` as a pure adapter. Prefer structured `detail_json`; use stable legacy regex parsing only as fallback. Apply task-specific mappings from the approved design and sanitize every error before returning it.

- [ ] **Step 4: Run normalization tests**

Run: `npx tsx --test backend/tests/schedulerRunPresentation.test.ts`

Expected: all normalization tests pass.

- [ ] **Step 5: Commit normalization**

Run: `git add backend/src/types/domain.ts backend/src/services/schedulerRunPresentation.ts backend/tests/schedulerRunPresentation.test.ts && git commit -m "feat: normalize scheduler run outcomes"`

### Task 2: Persist complete batch execution details

**Files:**
- Modify: `backend/src/services/schedulerTaskExecutor.ts`
- Test: `backend/tests/schedulerTaskExecutor.test.ts`

- [ ] **Step 1: Add failing executor tests**

Assert that stability/performance script failures retain all structured counts and failures, risk inspection collects every failed airport, and persisted execution status remains `failed`:

```ts
assert.equal(result.detail.airport_count, 61);
assert.equal(result.detail.success_count, 59);
assert.equal(result.detail.failure_count, 2);
assert.deepEqual(result.detail.failures, [
  { airport_id: 43, airport_name: '网际快车', error: 'The read operation timed out' },
  { airport_id: 72, airport_name: '闪狐云', error: 'connection reset' },
]);
assert.equal(result.status, 'failed');
```

- [ ] **Step 2: Run executor tests and verify the new assertions fail**

Run: `npx tsx --test backend/tests/schedulerTaskExecutor.test.ts`

Expected: new structured detail assertions fail against the current condensed output.

- [ ] **Step 3: Parse and preserve structured script summaries**

Replace string-only stage details with a structure equivalent to:

```ts
interface ScriptStageResult {
  stage: 'stability' | 'performance';
  status: 'succeeded' | 'failed';
  detail: string;
  airport_count?: number;
  success_count?: number;
  failure_count?: number;
  failures?: SchedulerRunFailureDetail[];
}
```

Parse stdout from both resolved and rejected `execFile` calls, preserve all failures, and sanitize errors. Keep the existing concise message for readability.

- [ ] **Step 4: Collect structured risk failures**

During risk inspection, capture `airport_id`, optional airport name, and sanitized error for each failed airport. Return `total_count`, `success_count`, `failure_count`, and `failures` in `detail_json` while keeping the task failed when any airport fails.

- [ ] **Step 5: Run executor tests**

Run: `npx tsx --test backend/tests/schedulerTaskExecutor.test.ts`

Expected: all executor tests pass.

- [ ] **Step 6: Commit structured execution details**

Run: `git add backend/src/services/schedulerTaskExecutor.ts backend/tests/schedulerTaskExecutor.test.ts && git commit -m "feat: retain scheduler failure details"`

### Task 3: Expose presentation results through scheduler APIs

**Files:**
- Modify: `backend/src/repositories/schedulerRunRepository.ts`
- Modify: `backend/src/services/adminSchedulerService.ts`
- Test: `backend/tests/schedulerRunRepository.test.ts`
- Test: `backend/tests/adminSchedulerService.test.ts`
- Test: `backend/tests/adminRoutes.test.ts`

- [ ] **Step 1: Add failing repository and service tests**

Extend daily-stat fixtures with the latest run message and detail. Assert that task latest runs, paginated runs, and daily stats expose derived outcomes and summaries:

```ts
assert.equal(result.items[0]?.last_outcome, 'partial');
assert.equal(result.items[0]?.last_result_summary?.success_count, 60);
assert.equal(result.items[0]?.last_result_summary?.failure_count, 1);
```

- [ ] **Step 2: Run focused repository and service tests**

Run: `npx tsx --test backend/tests/schedulerRunRepository.test.ts backend/tests/adminSchedulerService.test.ts`

Expected: failure because daily stats do not return latest message/detail and services return raw runs.

- [ ] **Step 3: Extend daily-stat query data**

Select the latest run's `message` and `detail_json` alongside `last_status`, map JSON safely, and add internal fields needed for presentation without changing historical rows.

- [ ] **Step 4: Present all outgoing scheduler runs**

Use `presentSchedulerRun` for task latest runs and paginated run items. Derive `last_outcome` and `last_result_summary` for daily stat rows. Do not change `markFinished` or the database status enum.

- [ ] **Step 5: Run API-surface tests**

Run: `npx tsx --test backend/tests/schedulerRunRepository.test.ts backend/tests/adminSchedulerService.test.ts backend/tests/adminRoutes.test.ts`

Expected: all scheduler repository/service/route tests pass.

- [ ] **Step 6: Commit scheduler API presentation**

Run: `git add backend/src/repositories/schedulerRunRepository.ts backend/src/services/adminSchedulerService.ts backend/tests/schedulerRunRepository.test.ts backend/tests/adminSchedulerService.test.ts backend/tests/adminRoutes.test.ts && git commit -m "feat: expose scheduler outcome summaries"`

### Task 4: Render exact counts and expandable failure details

**Files:**
- Modify: `src/admin/AdminApp.tsx`
- Create: `backend/tests/adminSchedulerOutcomeUi.test.ts`

- [ ] **Step 1: Add a failing admin-source regression test**

Assert that the admin source includes explicit partial-success copy, renamed run-count columns, result-summary rendering, incomplete-history copy, and a native details element:

```ts
assert.match(adminSource, /部分成功/);
assert.match(adminSource, /成功执行/);
assert.match(adminSource, /失败执行/);
assert.match(adminSource, /查看.*失败项/);
assert.match(adminSource, /<details/);
```

- [ ] **Step 2: Run the UI regression test and verify it fails**

Run: `npx tsx --test backend/tests/adminSchedulerOutcomeUi.test.ts`

Expected: failure because the new presentation does not exist.

- [ ] **Step 3: Extend frontend response types**

Mirror `SchedulerRunOutcome` and `SchedulerRunResultSummary` on `SchedulerRunRecord`; add `last_outcome` and `last_result_summary` to `SchedulerDailyStat`.

- [ ] **Step 4: Add small scheduler presentation components**

Implement focused in-file components:

```tsx
<SchedulerOutcomeBadge outcome={run.outcome} />
<SchedulerResultSummary summary={run.result_summary} />
<SchedulerFailureDetails summary={run.result_summary} />
```

Use emerald for success, amber for partial, rose for failure, neutral for running. Render `<details><summary>` only when failures or missing historical details exist. Keep text selectable and escaped by React.

- [ ] **Step 5: Update task cards, daily stats, logs, and filter copy**

Show exact totals on latest-run cards and log rows; rename daily run-count columns to `成功执行` / `失败执行`; add `最近处理结果`; render `last_outcome`; rename the failed filter option to `失败/部分成功`.

- [ ] **Step 6: Run UI test, TypeScript checks, and production build**

Run:

```bash
npx tsx --test backend/tests/adminSchedulerOutcomeUi.test.ts
npm run server:typecheck
npm run lint
npm run build
```

Expected: every command exits 0.

- [ ] **Step 7: Commit the admin presentation**

Run: `git add src/admin/AdminApp.tsx backend/tests/adminSchedulerOutcomeUi.test.ts dist && git commit -m "feat: show scheduler partial outcomes"`

### Task 5: Complete focused and full verification

**Files:**
- Verify only; no new files expected.

- [ ] **Step 1: Run all scheduler-focused tests**

Run:

```bash
npx tsx --test backend/tests/schedulerRunPresentation.test.ts backend/tests/schedulerTaskExecutor.test.ts backend/tests/schedulerRunRepository.test.ts backend/tests/adminSchedulerService.test.ts backend/tests/adminSchedulerOutcomeUi.test.ts
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run the full backend suite**

Run: `npm run test:backend`

Expected: exit 0; if unrelated pre-existing failures exist, report them separately and retain the focused passing evidence.

- [ ] **Step 3: Inspect final diff and workspace state**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors and only scoped scheduler/design/plan changes.
