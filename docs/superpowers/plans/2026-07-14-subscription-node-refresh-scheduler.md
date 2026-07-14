# Subscription Node Refresh Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a default-enabled 01:00 Asia/Shanghai scheduler task that refreshes and stores every performance-eligible airport subscription snapshot before the nightly performance run.

**Architecture:** Extend the existing scheduler task key through the database repositories, service, executor, API validation, and admin UI. Reuse `scripts/capture_subscription_nodes.py` for batch refreshes, adding explicit skipped-subscription accounting while preserving single-airport error behavior and partial-success persistence.

**Tech Stack:** TypeScript, Node.js, Express, MySQL, React, Python unittest

---

### Task 1: Make batch subscription capture skip airports without links

**Files:**
- Modify: `scripts/test_monitor_performance.py`
- Modify: `scripts/capture_subscription_nodes.py`

- [x] **Step 1: Write failing Python tests**

Add tests that patch `build_config`, `resolve_airports`, and `capture_for_airport`, then assert batch mode skips an airport whose `subscription_url` is empty, reports `target_count`, `skipped_count`, and `skipped`, and still returns failure when another configured subscription fails. Retain the existing direct `capture_for_airport` assertion for `missing_subscription_url`.

```python
def test_capture_subscription_nodes_main_skips_missing_links_and_continues_after_failure(self) -> None:
    from scripts import capture_subscription_nodes

    config = self.make_config()
    airports = [
        {"id": 1, "name": "No Link", "subscription_url": ""},
        {"id": 2, "name": "Broken", "subscription_url": "https://broken.example/sub"},
        {"id": 3, "name": "Good", "subscription_url": "https://good.example/sub"},
    ]
    with (
        patch.object(capture_subscription_nodes, "build_config", return_value=config),
        patch.object(capture_subscription_nodes, "resolve_airports", return_value=airports),
        patch.object(capture_subscription_nodes, "shanghai_now_iso", return_value="2026-07-14T01:00:00+08:00"),
        patch.object(
            capture_subscription_nodes,
            "capture_for_airport",
            side_effect=[RuntimeError("subscription_fetch_or_parse_failed"), {"airport_id": 3, "snapshot_id": 9}],
        ),
        patch("builtins.print") as print_mock,
    ):
        exit_code = capture_subscription_nodes.main()

    payload = json.loads(print_mock.call_args.args[0])
    self.assertEqual(exit_code, 1)
    self.assertEqual(payload["target_count"], 2)
    self.assertEqual(payload["success_count"], 1)
    self.assertEqual(payload["failure_count"], 1)
    self.assertEqual(payload["skipped_count"], 1)
    self.assertEqual(payload["skipped"], [{"airport_id": 1, "airport_name": "No Link", "reason": "missing_subscription_url"}])
```

- [x] **Step 2: Run the focused Python test and confirm failure**

Run: `python3 -m unittest scripts.test_monitor_performance.MonitorPerformanceTests.test_capture_subscription_nodes_main_skips_missing_links_and_continues_after_failure -v`

Expected: failure because the current script calls `capture_for_airport` for the no-link airport and does not emit skipped fields.

- [x] **Step 3: Implement batch filtering and summary fields**

In `main()`, split resolved airports into missing-link skips and configured targets before calling `capture_for_airport`:

```python
skipped = [
    {
        "airport_id": airport.get("id"),
        "airport_name": airport.get("name"),
        "reason": "missing_subscription_url",
    }
    for airport in airports
    if not str(airport.get("subscription_url") or "").strip()
]
targets = [
    airport
    for airport in airports
    if str(airport.get("subscription_url") or "").strip()
]
```

Iterate over `targets` and emit `airport_count`, `target_count`, `success_count`, `failure_count`, `skipped_count`, `results`, `failures`, and `skipped`. Continue returning exit code `1` only when `failures` is non-empty.

- [x] **Step 4: Run all performance-monitor Python tests**

Run: `python3 -m unittest scripts.test_monitor_performance -v`

Expected: all tests pass.

### Task 2: Extend scheduler persistence and task types

**Files:**
- Modify: `backend/src/types/domain.ts`
- Modify: `backend/src/repositories/schedulerTaskRepository.ts`
- Modify: `backend/src/repositories/schedulerRunRepository.ts`
- Modify: `backend/sql/schema.sql`
- Modify: `backend/tests/schedulerTaskRepository.test.ts`
- Modify: `backend/tests/schedulerRunRepository.test.ts`
- Modify: `backend/tests/adminSchedulerService.test.ts`

- [x] **Step 1: Update repository tests first**

Assert seven default task inserts, the new enum key, the `01:00` schedule, and explicit enabled value `1` for `subscription_node_refresh` while an existing default task remains controlled by the global default.

```ts
assert.equal(executes.filter((call) => call.sql.includes('INSERT IGNORE INTO admin_scheduler_tasks')).length, 7);
assert.ok(queries.some((sql) => sql.includes('subscription_node_refresh')));
assert.ok(executes.some((call) => call.params?.[0] === 'subscription_node_refresh'
  && call.params?.[2] === 1
  && call.params?.[3] === '01:00'));
```

Add `subscription_node_refresh: null` to typed latest-run fixtures.

- [x] **Step 2: Run repository and scheduler-service tests and confirm type/test failures**

Run: `npx tsx --test backend/tests/schedulerTaskRepository.test.ts backend/tests/schedulerRunRepository.test.ts backend/tests/adminSchedulerService.test.ts`

Expected: failures from the missing task key, seed, enum, and latest-run property.

- [x] **Step 3: Add the task key and default seed**

Add `| 'subscription_node_refresh'` to `SchedulerTaskKey`. Change the task seed shape to include an optional explicit default:

```ts
const DEFAULT_TASKS: Array<Pick<SchedulerTask, 'task_key' | 'name' | 'schedule_time'> & { enabled_by_default?: boolean }> = [
  { task_key: 'stability', name: '稳定性采集', schedule_time: '00:00' },
  { task_key: 'subscription_node_refresh', name: '订阅节点更新', schedule_time: '01:00', enabled_by_default: true },
  // existing tasks remain unchanged
];
```

Seed with `task.enabled_by_default ?? isEnabledByDefault()`. Add the key to both repository enums and orders, initialize it to `null` in latest-run maps, and add it to both enum definitions in `backend/sql/schema.sql`.

- [x] **Step 4: Re-run focused persistence/service tests**

Run: `npx tsx --test backend/tests/schedulerTaskRepository.test.ts backend/tests/schedulerRunRepository.test.ts backend/tests/adminSchedulerService.test.ts`

Expected: all focused tests pass.

### Task 3: Execute the refresh script through SchedulerTaskExecutor

**Files:**
- Modify: `backend/tests/schedulerTaskExecutor.test.ts`
- Modify: `backend/src/services/schedulerTaskExecutor.ts`
- Modify: `backend/src/services/adminSchedulerService.ts`

- [x] **Step 1: Write executor tests for success and partial failure**

Add a test that invokes `runTask('subscription_node_refresh', date)`, captures the executable path and environment, and asserts:

```ts
assert.match(scriptPath, /capture_subscription_nodes\.py$/);
assert.equal(env.ALL_AIRPORTS, '1');
assert.equal(env.SOURCE, 'scheduler-subscription-node-refresh');
assert.equal(result.status, 'succeeded');
assert.equal(result.detail.stage, 'subscription_node_refresh');
assert.equal(result.detail.target_count, 3);
assert.equal(result.detail.success_count, 3);
assert.equal(result.detail.skipped_count, 1);
```

Add a failure test whose exec error contains JSON stdout with `target_count`, `success_count`, `failure_count`, `skipped_count`, and one safe failure. Assert the overall status is `failed` and the message contains all four counts without any subscription URL.

- [x] **Step 2: Run the focused executor tests and confirm failure**

Run: `npx tsx --test backend/tests/schedulerTaskExecutor.test.ts`

Expected: new tests fail because the task falls through to aggregate recompute.

- [x] **Step 3: Add an explicit refresh task executor path**

Route the new key before aggregate recompute:

```ts
if (taskKey === 'subscription_node_refresh') {
  return this.runSubscriptionNodeRefresh();
}
```

Generalize `runScriptStage` to accept the new stage and script, run it with `ALL_AIRPORTS=1`, `SOURCE=scheduler-subscription-node-refresh`, admin auth, optional `AIRPORT_STATUS`, and the existing script timeout. Parse JSON output into structured detail counts so scheduler run records retain `airport_count`, `target_count`, `success_count`, `failure_count`, and `skipped_count`.

Add the task description:

```ts
subscription_node_refresh: '批量刷新性能测试范围内的订阅链接并保存最新节点快照，供后续性能采集使用。',
```

- [x] **Step 4: Run executor and scheduler-service tests**

Run: `npx tsx --test backend/tests/schedulerTaskExecutor.test.ts backend/tests/adminSchedulerService.test.ts`

Expected: all tests pass.

### Task 4: Accept and display the new scheduler task in admin

**Files:**
- Modify: `backend/src/routes/adminRoutes.ts`
- Modify: `backend/tests/adminRoutes.test.ts`
- Modify: `src/admin/AdminApp.tsx`

- [x] **Step 1: Write the API regression assertion**

Extend the scheduler task route fixture to seven items and assert the new task appears after `stability` with `task_key === 'subscription_node_refresh'`. Add a PATCH request using the new key and assert it is accepted by `toSchedulerTaskKey` rather than returning `BAD_REQUEST`.

- [x] **Step 2: Run the focused route tests and confirm failure**

Run: `npx tsx --test --test-name-pattern='scheduler' backend/tests/adminRoutes.test.ts`

Expected: the new task-key PATCH test fails with HTTP 400.

- [x] **Step 3: Extend backend validation and admin UI labels**

Add the key to `toSchedulerTaskKey()` and its error message. Extend the frontend union to include both `subscription_node_refresh` and the already-rendered `stability_resample_guard`, add labels for both, add both filter options, and replace the stale “四个全局任务” page description with a generic scheduler description.

```ts
if (taskKey === 'subscription_node_refresh') return '订阅节点更新';
if (taskKey === 'stability_resample_guard') return '稳定性复测保护';
```

- [x] **Step 4: Run route tests and TypeScript checks**

Run: `npx tsx --test --test-name-pattern='scheduler' backend/tests/adminRoutes.test.ts`

Expected: scheduler route tests pass.

Run: `npm run lint`

Expected: frontend TypeScript check passes.

Run: `npm run server:typecheck`

Expected baseline note: the repository currently reports unrelated pre-existing errors in `publicPageRoutes.test.ts`, `toolsRoutes.test.ts`, and browser-only `src/site/publicSite.tsx`. Confirm no scheduler file appears in that error list, then run the targeted scheduler compile from Task 5.

### Task 5: Full verification and handoff

**Files:**
- Verify all modified files from Tasks 1-4

- [x] **Step 1: Run backend and Python regression suites**

Run: `npm run test:backend`

Expected: all backend tests pass.

Run: `python3 -m unittest scripts.test_monitor_performance -v`

Expected: all Python tests pass.

- [x] **Step 2: Run type checks and production build**

Run: `npm run lint`

Expected: exit code 0.

Run: `npm run server:typecheck`

Expected baseline note: record the unrelated existing backend-project errors rather than modifying those modules in this feature.

Run: `npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --lib ES2022,DOM --types node --strict --skipLibCheck --allowSyntheticDefaultImports backend/src/middleware/requestContext.ts backend/src/types/domain.ts backend/src/repositories/schedulerTaskRepository.ts backend/src/repositories/schedulerRunRepository.ts backend/src/services/adminSchedulerService.ts backend/src/services/schedulerTaskExecutor.ts backend/src/routes/adminRoutes.ts`

Expected: exit code 0 for the complete changed scheduler backend surface.

Run: `npm run build`

Expected: Vite production build exits 0.

- [x] **Step 3: Check schema/task coverage and diff hygiene**

Run: `rg -n "subscription_node_refresh" backend/src backend/sql/schema.sql backend/tests src/admin/AdminApp.tsx`

Expected: the task appears in types, both repositories, executor, scheduler description, route validation, tests, frontend type/label/filter, and schema baseline.

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only the plan and feature files are modified.
