# GateRank Mainland Performance Probes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Shanghai and Guangzhou performance probes, per-airport region test/result switches, versioned mainland scoring, multi-region aggregation, anomaly review, and a safe three-day shadow rollout without changing historical scores.

**Architecture:** Keep the current central collector as the backward-compatible `legacy-control` source while adding a restricted job API for remote probes. Persist probe identity, per-airport settings, job configuration snapshots, target-level results, and region scores; aggregate only complete official region sets and let probe completion trigger aggregation/recompute. Render the same configuration and grouped evidence in the existing airport performance admin tab, then deploy the two workers with isolated tokens and systemd timers.

**Tech Stack:** TypeScript 5.8, Node.js 22 test runner, Express 4, MySQL 8, React 19, Tailwind CSS 4, Vite 6, Python 3.11 `unittest`, sing-box, systemd.

**Design reference:** `docs/superpowers/specs/2026-08-08-mainland-performance-probes-design.md`

---

## File map

### Backend contracts and scoring

- Create `backend/src/config/performanceProbes.ts`: fixed probe definitions, test profiles, scoring versions, and numeric thresholds.
- Create `backend/src/services/performanceRegionScoring.ts`: pure region scoring and equal-weight region aggregation.
- Modify `backend/src/types/domain.ts`: probe, setting, job, target result, region aggregate, and daily-metric fields.
- Modify `backend/src/config/scoring.ts`: preserve legacy threshold and expose the mainland version without changing unrelated scores.
- Modify `backend/src/services/scoringEngine.ts`: prefer precomputed multi-region performance components, fall back to legacy raw metrics.

### Persistence and coordination

- Create `backend/src/repositories/performanceProbeRepository.ts`: registered probe identity, token hash, global state, heartbeat.
- Create `backend/src/repositories/performanceProbeSettingRepository.ts`: per-airport switches, defaults, optimistic version updates.
- Create `backend/src/repositories/performanceProbeJobRepository.ts`: immutable job snapshots, atomic leasing, idempotent completion.
- Create `backend/src/repositories/performanceRunTargetRepository.ts`: target-level raw results.
- Modify `backend/src/repositories/performanceRunRepository.ts`: structured probe/run fields and list-by-airport/date queries.
- Modify `backend/src/repositories/metricsRepository.ts`: persist effective performance component scores, rule summary, included probes, and review status.

### APIs and services

- Create `backend/src/middleware/performanceProbeAuth.ts`: bearer-token hash lookup and request identity.
- Create `backend/src/routes/performanceProbeRoutes.ts`: lease and upload endpoints.
- Create `backend/src/services/performanceProbeJobService.ts`: job payload sanitization, submission validation, completion orchestration.
- Create `backend/src/services/performanceProbeDispatchService.ts`: create remote jobs from current node snapshots and airport settings.
- Create `backend/src/services/performanceAnomalyService.ts`: target, location, control, ceiling, and persistence rules.
- Modify `backend/src/services/aggregationService.ts`: complete-set selection and region-first aggregation.
- Modify `backend/src/services/schedulerTaskExecutor.ts`: dispatch remote jobs alongside the legacy collector.
- Modify `backend/src/services/manualJobService.ts`: dispatch enabled remote regions and report pending completion honestly.
- Modify `backend/src/routes/adminRoutes.ts`: settings CRUD, grouped dashboard evidence, validation, and audit.
- Modify `backend/src/app.ts`: schema initialization, dependency wiring, restricted router, and rate limiting.

### Probe worker and operations

- Create `scripts/performance_probe_runner.py`: single-job remote worker with calibration, multi-target measurement, and upload.
- Create `scripts/test_performance_probe_runner.py`: pure/mocked worker coverage.
- Create `scripts/manage_performance_probe.ts`: issue/revoke one token and enable/disable one probe without accepting secrets on the command line.
- Create `ops/performance-probe/gaterank-probe.service`: hardened one-shot worker service.
- Create `ops/performance-probe/gaterank-probe.timer`: serialized polling schedule.
- Create `ops/performance-probe/gaterank-probe.env.example`: secret-free configuration template.
- Create `ops/performance-probe/install.sh`: idempotent installation with checksum-pinned sing-box.
- Create `ops/performance-probe/README.md`: deployment, rotation, verification, and rollback commands.

### Admin and public presentation

- Modify `src/admin/AdminApp.tsx`: two switches per region, explicit save, grouped results, ceiling/review states.
- Create `backend/tests/adminPerformanceProbeUi.test.ts`: admin source/accessibility regression tests.
- Modify `backend/src/services/publicViewService.ts`: expose only a neutral performance-review flag.
- Modify `backend/src/services/publicPageRenderer.ts`: render the neutral review note without exposing evidence details.
- Modify `src/pages/methodology/content.ts`: explain region-versioned speed scoring and equal weighting.

---

### Task 1: Define versioned probe and scoring contracts

**Files:**
- Create: `backend/src/config/performanceProbes.ts`
- Create: `backend/src/services/performanceRegionScoring.ts`
- Modify: `backend/src/config/scoring.ts`
- Modify: `backend/src/types/domain.ts`
- Test: `backend/tests/performanceRegionScoring.test.ts`

- [ ] **Step 1: Write failing scoring contract tests**

Cover legacy 300 Mbps full score, mainland 160 Mbps full score, mainland 180 Mbps ceiling marking, region P weighting, and equal weighting independent of node/target counts:

```ts
const mainland = scorePerformanceRegion({
  probe_id: 'cn-shanghai',
  scoring_rule_version: 'cn_dual_probe_v1',
  median_latency_ms: 60,
  median_download_mbps: 180,
  packet_loss_percent: 0,
});
assert.equal(mainland.speed_score, 100);
assert.equal(mainland.probe_ceiling, true);

const combined = aggregatePerformanceRegions([
  { ...mainland, probe_id: 'cn-shanghai', p: 100 },
  { ...mainland, probe_id: 'cn-guangzhou', p: 60 },
]);
assert.equal(combined.p, 80);
assert.deepEqual(combined.included_probe_ids, ['cn-guangzhou', 'cn-shanghai']);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx tsx --test backend/tests/performanceRegionScoring.test.ts`

Expected: failure because the config and scoring service do not exist.

- [ ] **Step 3: Add probe/scoring types and constants**

Define stable contracts equivalent to:

```ts
export type PerformanceProbeId = 'legacy-control' | 'cn-shanghai' | 'cn-guangzhou';
export type PerformanceScoringRuleVersion = 'legacy_v1' | 'cn_dual_probe_v1';
export type PerformanceReviewStatus = 'normal' | 'needs_review' | 'suspicious';

export const PERFORMANCE_SCORING_RULES = {
  legacy_v1: { speedBadMbps: 10, speedGoodMbps: 300, ceilingMbps: null },
  cn_dual_probe_v1: { speedBadMbps: 10, speedGoodMbps: 160, ceilingMbps: 180 },
} as const;
```

Add `PerformanceRegionScore`, `PerformanceAggregate`, and optional daily metric fields:

```ts
performance_latency_score?: number | null;
performance_speed_score?: number | null;
performance_loss_score?: number | null;
performance_score?: number | null;
performance_rule_summary?: string | null;
performance_included_probe_ids?: string[];
performance_review_status?: PerformanceReviewStatus | null;
```

- [ ] **Step 4: Implement pure scoring and equal-weight aggregation**

Use existing `normalizeLinear`, latency/loss thresholds, and `SCORE_WEIGHTS.performance`. Region aggregation must average region component scores, sort probe IDs for deterministic storage, and calculate raw display medians separately.

- [ ] **Step 5: Run the scoring tests**

Run: `npx tsx --test backend/tests/performanceRegionScoring.test.ts backend/tests/scoringEngine.test.ts`

Expected: all tests pass and existing legacy score assertions remain unchanged.

- [ ] **Step 6: Commit scoring contracts**

Run: `git add backend/src/config/performanceProbes.ts backend/src/config/scoring.ts backend/src/types/domain.ts backend/src/services/performanceRegionScoring.ts backend/tests/performanceRegionScoring.test.ts backend/tests/scoringEngine.test.ts && git commit -m "feat: add versioned performance scoring"`

### Task 2: Persist probe identities and per-airport switches

**Files:**
- Create: `backend/src/repositories/performanceProbeRepository.ts`
- Create: `backend/src/repositories/performanceProbeSettingRepository.ts`
- Test: `backend/tests/performanceProbeRepository.test.ts`
- Test: `backend/tests/performanceProbeSettingRepository.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write failing repository tests**

Test registered probe reads, SHA-256 token lookup, heartbeat updates, default airport settings, invariant enforcement, and optimistic conflict:

```ts
await assert.rejects(
  settings.saveAll({
    airport_id: 9,
    expected_config_version: 3,
    updated_by: 'ops',
    settings: [{ probe_id: 'cn-shanghai', test_enabled: false, include_in_result: true }],
  }),
  /include_in_result requires test_enabled/,
);
```

Also assert that an airport cannot save zero included regions. Safe migration defaults are legacy `true/true`, Shanghai `false/false`, Guangzhou `false/false`; the rollout tasks explicitly enable mainland shadow testing first for the canary and later for all airports.

- [ ] **Step 2: Run repository tests and verify they fail**

Run: `npx tsx --test backend/tests/performanceProbeRepository.test.ts backend/tests/performanceProbeSettingRepository.test.ts`

Expected: module-not-found failures.

- [ ] **Step 3: Implement probe registry schema**

Create `performance_probes` with `probe_id`, display/region/provider/bandwidth/type/profile/rule fields, `globally_enabled`, `token_hash`, rotation/heartbeat timestamps, and timestamps. Seed the three stable rows idempotently; never seed plaintext tokens.

Provide methods:

```ts
list(): Promise<PerformanceProbe[]>;
getById(probeId: PerformanceProbeId): Promise<PerformanceProbe | null>;
findEnabledByTokenHash(tokenHash: string): Promise<PerformanceProbe | null>;
setTokenHash(probeId: PerformanceProbeId, tokenHash: string): Promise<void>;
revokeToken(probeId: PerformanceProbeId): Promise<void>;
setGloballyEnabled(probeId: PerformanceProbeId, enabled: boolean): Promise<void>;
touchLastSeen(probeId: PerformanceProbeId): Promise<void>;
```

- [ ] **Step 4: Implement per-airport settings schema and atomic save**

Create `airport_performance_probe_settings` keyed by `(airport_id, probe_id)` plus `config_version`, `updated_by`, `updated_at`. `getByAirport()` materializes missing rows from the safe migration defaults without creating mainland traffic or changing existing airports' public result. `saveAll()` runs in a transaction, locks current rows, checks `expected_config_version`, validates invariants, increments one shared version, and returns the normalized list.

- [ ] **Step 5: Wire schema initialization**

Instantiate both repositories in `createApp()`, call `ensureSchema()`, and pass them only to services/routes that need them. Do not expose token hashes through any response.

- [ ] **Step 6: Run repository and app type checks**

Run: `npx tsx --test backend/tests/performanceProbeRepository.test.ts backend/tests/performanceProbeSettingRepository.test.ts && npm run server:typecheck`

Expected: all commands exit 0.

- [ ] **Step 7: Commit probe settings persistence**

Run: `git add backend/src/app.ts backend/src/repositories/performanceProbeRepository.ts backend/src/repositories/performanceProbeSettingRepository.ts backend/tests/performanceProbeRepository.test.ts backend/tests/performanceProbeSettingRepository.test.ts && git commit -m "feat: persist performance probe settings"`

### Task 3: Persist jobs, structured runs, and target evidence

**Files:**
- Create: `backend/src/repositories/performanceProbeJobRepository.ts`
- Create: `backend/src/repositories/performanceRunTargetRepository.ts`
- Modify: `backend/src/repositories/performanceRunRepository.ts`
- Modify: `backend/src/types/domain.ts`
- Test: `backend/tests/performanceProbeJobRepository.test.ts`
- Test: `backend/tests/performanceRunRepository.test.ts`
- Test: `backend/tests/performanceRunTargetRepository.test.ts`

- [ ] **Step 1: Write failing persistence tests**

Assert atomic lease behavior, expired lease recovery, idempotency uniqueness, immutable configuration snapshots, legacy row mapping, list-by-date behavior, and target rows:

```ts
assert.equal(leased?.probe_id, 'cn-shanghai');
assert.equal(leased?.include_in_result_snapshot, false);
assert.equal(leased?.config_version, 4);
assert.equal(leased?.status, 'leased');
assert.deepEqual(await targets.listByRun(runId), [
  { node_key: 'node-a', target_key: 'target-a', download_mbps: 91.2, valid: true },
]);
```

- [ ] **Step 2: Run persistence tests and verify they fail**

Run: `npx tsx --test backend/tests/performanceProbeJobRepository.test.ts backend/tests/performanceRunRepository.test.ts backend/tests/performanceRunTargetRepository.test.ts`

Expected: new repository modules/columns are missing.

- [ ] **Step 3: Implement immutable job snapshots**

Create `performance_probe_jobs` with `job_id` UUID, airport/probe/snapshot IDs, config version, test/include snapshots, profile/rule, source, status, lease owner/expiry, attempts, idempotency key, timestamps, and unique `(probe_id, idempotency_key)`. Use a transaction plus `SELECT ... FOR UPDATE SKIP LOCKED` where available; keep a tested fallback transaction for the deployed MySQL version.

- [ ] **Step 4: Extend performance run persistence compatibly**

Use `ensureColumn()` for `job_id`, `probe_id`, region/provider/bandwidth, run mode, profile/rule/config version, calibration fields, review fields, and sampled date. Existing rows map to `legacy-control`, `legacy_v1`, and `official` in the TypeScript adapter without destructive backfill. Add `listByAirportAndDate()` and `markReviewStatus()`; retain `getLatestByAirportAndDate()` for old callers during migration.

- [ ] **Step 5: Store target-level results**

Create `performance_run_targets` keyed by `(run_id, node_key, target_key)` with bytes, duration, Mbps, HTTP/network error, validity, and timestamp. Reject non-finite/negative measurements before SQL execution.

- [ ] **Step 6: Run persistence tests and type check**

Run: `npx tsx --test backend/tests/performanceProbeJobRepository.test.ts backend/tests/performanceRunRepository.test.ts backend/tests/performanceRunTargetRepository.test.ts && npm run server:typecheck`

Expected: all commands exit 0.

- [ ] **Step 7: Commit structured performance persistence**

Run: `git add backend/src/types/domain.ts backend/src/repositories/performanceProbeJobRepository.ts backend/src/repositories/performanceRunRepository.ts backend/src/repositories/performanceRunTargetRepository.ts backend/tests/performanceProbeJobRepository.test.ts backend/tests/performanceRunRepository.test.ts backend/tests/performanceRunTargetRepository.test.ts && git commit -m "feat: persist multi-probe performance runs"`

### Task 4: Add restricted probe authentication and job APIs

**Files:**
- Create: `backend/src/middleware/performanceProbeAuth.ts`
- Create: `backend/src/routes/performanceProbeRoutes.ts`
- Create: `backend/src/services/performanceProbeJobService.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/performanceProbeAuth.test.ts`
- Test: `backend/tests/performanceProbeRoutes.test.ts`

- [ ] **Step 1: Write failing auth and route tests**

Cover missing/malformed/revoked tokens, token-to-probe binding, rate-limited bodies, atomic job lease, sanitized node payload, forged `probe_id`, wrong-probe job submission, duplicate submission, oversized/invalid measurements, and secret-free errors/audits:

```ts
const response = await fetch(`${base}/api/v1/performance-probe/runs`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ job_id: jobId, probe_id: 'cn-guangzhou', calibration_mbps: 200 }),
});
assert.equal(response.status, 403);
assert.doesNotMatch(JSON.stringify(await response.json()), /raw_uri|password|token/i);
```

- [ ] **Step 2: Run route tests and verify they fail**

Run: `npx tsx --test backend/tests/performanceProbeAuth.test.ts backend/tests/performanceProbeRoutes.test.ts`

Expected: modules/routes are missing.

- [ ] **Step 3: Implement bearer authentication**

Require `Authorization: Bearer <token>`, reject control characters, SHA-256 the raw token, perform constant-shape repository lookup, attach only the sanitized probe identity to the request, and update heartbeat after successful auth. Never log headers or hashes.

- [ ] **Step 4: Implement lease and upload service**

`leaseNextJob()` returns only the assigned job's nodes, IDs, profile parameters, targets, and expiry. `submitRun()` derives identity and run mode from the stored job, requires calibration, validates node/target membership, inserts run plus targets in one transaction, and marks the job complete idempotently.

Return `204` when no job is available and `201` with only `run_id`, `job_id`, and completion state after a first upload. A repeated identical idempotency key returns the original IDs; conflicting content returns `409`.

- [ ] **Step 5: Mount the restricted router**

Instantiate and initialize the job and target repositories, then mount `/api/v1/performance-probe` outside `adminAuth`, behind `express.json({ limit: '512kb' })`, probe auth, and a dedicated rate limiter. Keep `/api/v1/admin/performance-runs` available for `legacy-control` only.

- [ ] **Step 6: Run security-focused tests and type check**

Run: `npx tsx --test backend/tests/performanceProbeAuth.test.ts backend/tests/performanceProbeRoutes.test.ts backend/tests/securityMiddleware.test.ts && npm run server:typecheck`

Expected: all commands exit 0.

- [ ] **Step 7: Commit restricted probe APIs**

Run: `git add backend/src/app.ts backend/src/middleware/performanceProbeAuth.ts backend/src/routes/performanceProbeRoutes.ts backend/src/services/performanceProbeJobService.ts backend/tests/performanceProbeAuth.test.ts backend/tests/performanceProbeRoutes.test.ts && git commit -m "feat: add restricted performance probe api"`

### Task 5: Build the remote probe worker

**Files:**
- Create: `scripts/performance_probe_runner.py`
- Create: `scripts/test_performance_probe_runner.py`
- Modify: `scripts/monitor_performance.py`
- Test: `scripts/test_monitor_performance.py`

- [ ] **Step 1: Write failing worker tests**

Use `unittest.mock` to cover no-job exit, auth headers, direct calibration, calibration failure, multiple targets, node target median, target error retention, timeout cleanup, upload idempotency, and redacted exceptions:

```py
self.assertEqual(build_node_summary([
    TargetResult("a", 40.0, True, None),
    TargetResult("b", 100.0, True, None),
    TargetResult("c", 1000.0, False, "timeout"),
]).download_mbps, 70.0)
```

Assert that serialized stdout/stderr never contains `raw_uri`, outbound passwords, bearer tokens, or subscription URLs.

- [ ] **Step 2: Run Python tests and verify they fail**

Run: `python3 -m unittest scripts.test_performance_probe_runner -v`

Expected: import failure because the runner does not exist.

- [ ] **Step 3: Extract only reusable measurement helpers from the legacy script**

Keep existing CLI behavior stable. Export safe helpers for starting/stopping sing-box, converting snapshot nodes, connect/HTTP probes, and one target download. Update existing Python tests before moving code so `monitor_performance.py` remains behaviorally identical.

- [ ] **Step 4: Implement one-shot job execution**

The runner reads `PROBE_API_BASE`, `PROBE_API_TOKEN`, `SING_BOX_BIN`, and bounded timeout settings; leases one job; calibrates against the profile's direct domestic calibration target; measures the assigned nodes/targets serially; uploads once; cleans temporary configuration and child processes in `finally`; then exits 0. `204` also exits 0, while auth/schema/network failures exit nonzero with a sanitized error code.

- [ ] **Step 5: Enforce calibrated profile semantics**

If calibration is below 160 Mbps, upload a failed batch with `calibration_status='failed'` and no official measurements. For valid batches, preserve every raw target value, compute node medians from valid targets, set `probe_ceiling` at 180 Mbps, and leave scoring to the server.

- [ ] **Step 6: Run all performance Python tests**

Run: `python3 -m unittest scripts.test_monitor_performance scripts.test_performance_probe_runner -v`

Expected: all tests pass; no real network or sing-box process is used by tests.

- [ ] **Step 7: Commit the remote worker**

Run: `git add scripts/monitor_performance.py scripts/test_monitor_performance.py scripts/performance_probe_runner.py scripts/test_performance_probe_runner.py && git commit -m "feat: add mainland performance probe worker"`

### Task 6: Dispatch jobs from scheduler and manual collection

**Files:**
- Create: `backend/src/services/performanceProbeDispatchService.ts`
- Modify: `backend/src/services/schedulerTaskExecutor.ts`
- Modify: `backend/src/services/manualJobService.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/performanceProbeDispatchService.test.ts`
- Test: `backend/tests/schedulerTaskExecutor.test.ts`
- Test: `backend/tests/manualJobService.test.ts`

- [ ] **Step 1: Write failing dispatch tests**

Cover test-disabled regions, shadow/official snapshots, global probe disable, missing/stale node snapshots, node preference filtering, duplicate dispatch, and source labels. Scheduler/manual tests must assert that legacy collection still runs and remote jobs are reported separately:

```ts
assert.deepEqual(result.jobs.map((job) => [job.probe_id, job.include_in_result_snapshot]), [
  ['cn-guangzhou', false],
  ['cn-shanghai', false],
]);
assert.match(manualMessage, /大陆地区任务已创建 2 个，完成后自动聚合/);
```

- [ ] **Step 2: Run dispatch tests and verify they fail**

Run: `npx tsx --test backend/tests/performanceProbeDispatchService.test.ts backend/tests/schedulerTaskExecutor.test.ts backend/tests/manualJobService.test.ts`

Expected: dispatch service is missing and existing messages have no remote-job counts.

- [ ] **Step 3: Implement snapshot-based dispatch**

For each runnable airport, load its current settings, registered/global probe state, latest reusable node snapshot, and node preference. Create jobs only for enabled non-legacy probes, snapshot the complete config, and use deterministic idempotency key `date:airport_id:probe_id:source:config_version`.

Missing snapshot or zero selected nodes returns a structured per-airport dispatch failure without embedding node credentials.

- [ ] **Step 4: Integrate scheduled collection**

Keep `monitor_performance.py` as the `legacy-control` collector. After its run, dispatch mainland jobs and include `remote_job_count`, `shadow_job_count`, `official_job_count`, and sanitized dispatch failures in scheduler detail. A dispatch failure makes the performance task partial/failed according to existing scheduler semantics; it does not erase successful legacy data.

- [ ] **Step 5: Integrate manual collection**

For today's performance/full job, run legacy collection, dispatch enabled mainland jobs for that airport, then aggregate only immediately available official data. Return a truthful message that remote results are pending and will trigger completion; historical-date jobs remain recompute-only and never dispatch probes.

- [ ] **Step 6: Run service tests and type check**

Run: `npx tsx --test backend/tests/performanceProbeDispatchService.test.ts backend/tests/schedulerTaskExecutor.test.ts backend/tests/manualJobService.test.ts && npm run server:typecheck`

Expected: all commands exit 0.

- [ ] **Step 7: Commit dispatch integration**

Run: `git add backend/src/app.ts backend/src/services/performanceProbeDispatchService.ts backend/src/services/schedulerTaskExecutor.ts backend/src/services/manualJobService.ts backend/tests/performanceProbeDispatchService.test.ts backend/tests/schedulerTaskExecutor.test.ts backend/tests/manualJobService.test.ts && git commit -m "feat: dispatch regional performance jobs"`

### Task 7: Aggregate only complete official region sets

**Files:**
- Modify: `backend/src/repositories/metricsRepository.ts`
- Modify: `backend/src/services/aggregationService.ts`
- Modify: `backend/src/services/scoringEngine.ts`
- Modify: `backend/src/services/performanceProbeJobService.ts`
- Modify: `backend/src/types/domain.ts`
- Test: `backend/tests/metricsRepository.test.ts`
- Test: `backend/tests/aggregationService.test.ts`
- Test: `backend/tests/scoringEngine.test.ts`
- Test: `backend/tests/performanceProbeRoutes.test.ts`

- [ ] **Step 1: Write failing completeness and scoring tests**

Cover legacy-only fallback, two official mainland regions, shadow exclusion, missing official region, calibration failure, mismatched config versions, stale completed jobs, raw median display, and precomputed component use:

```ts
assert.deepEqual(await service.aggregateAirportForDate(9, date), { aggregated: 0, pending_probe_ids: ['cn-guangzhou'] });
assert.equal(savedMetrics.performance_score, 80);
assert.deepEqual(savedMetrics.performance_included_probe_ids, ['cn-guangzhou', 'cn-shanghai']);
```

Assert that `computeScore()` uses `performance_score` when present and preserves current 300 Mbps legacy behavior when absent.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npx tsx --test backend/tests/metricsRepository.test.ts backend/tests/aggregationService.test.ts backend/tests/scoringEngine.test.ts backend/tests/performanceProbeRoutes.test.ts`

Expected: fields and complete-set behavior are missing.

- [ ] **Step 3: Persist effective performance components**

Add nullable metrics columns for latency/speed/loss/P components, rule summary, included probe IDs JSON, review status, and pending probe IDs JSON. Extend every metrics select/adapter and keep null defaults for old rows.

- [ ] **Step 4: Select and aggregate region runs**

For the date and airport, derive the official required set from job snapshots/settings. Pick the latest valid run per required probe with matching config version. If any official probe is missing or invalid, return `aggregated: 0` with `pending_probe_ids` and do not upsert new performance fields. Shadow failures remain visible but non-blocking.

When complete, score each region using its stored rule version, equally average component/P scores, store raw medians for explanation/value score, and preserve existing stability/risk fields.

- [ ] **Step 5: Trigger completion after uploads**

After an accepted upload, call a completion coordinator that checks the official set. Only when complete, run `aggregateAirportForDate()` followed by `recomputeAirportForDate()`. Duplicate uploads must not re-run completion; failed/shadow-only batches never overwrite a valid official day.

- [ ] **Step 6: Prefer precomputed P in the scoring engine**

Use persisted performance components and P when all are finite; otherwise execute the current raw-metric formula. Add details for rule summary and included probes while keeping `ScoreDetailValue` serializable.

- [ ] **Step 7: Run aggregation/scoring tests and type checks**

Run: `npx tsx --test backend/tests/metricsRepository.test.ts backend/tests/aggregationService.test.ts backend/tests/scoringEngine.test.ts backend/tests/performanceProbeRoutes.test.ts && npm run server:typecheck`

Expected: all commands exit 0.

- [ ] **Step 8: Commit complete-set aggregation**

Run: `git add backend/src/types/domain.ts backend/src/repositories/metricsRepository.ts backend/src/services/aggregationService.ts backend/src/services/scoringEngine.ts backend/src/services/performanceProbeJobService.ts backend/tests/metricsRepository.test.ts backend/tests/aggregationService.test.ts backend/tests/scoringEngine.test.ts backend/tests/performanceProbeRoutes.test.ts && git commit -m "feat: aggregate complete probe regions"`

### Task 8: Analyze anomalies without automatic punishment

**Files:**
- Create: `backend/src/services/performanceAnomalyService.ts`
- Modify: `backend/src/services/performanceProbeJobService.ts`
- Modify: `backend/src/repositories/performanceRunRepository.ts`
- Modify: `backend/src/repositories/metricsRepository.ts`
- Test: `backend/tests/performanceAnomalyService.test.ts`

- [ ] **Step 1: Write failing anomaly tests**

Cover target ratio `>3` with high `>100`, Shanghai/Guangzhou ratio, legacy/mainland ratio with legacy `>300`, 180 Mbps ceiling-only, calibration invalidation, cohort target degradation suppression, consecutive-day promotion, and two independent dimensions:

```ts
assert.deepEqual(assessPerformanceEvidence(ceilingOnlyFixture), {
  status: 'normal',
  reasons: [],
  flags: ['probe_ceiling'],
});
assert.equal(assessPerformanceEvidence(twoDimensionsFixture).status, 'suspicious');
```

- [ ] **Step 2: Run anomaly tests and verify they fail**

Run: `npx tsx --test backend/tests/performanceAnomalyService.test.ts`

Expected: anomaly service is missing.

- [ ] **Step 3: Implement pure evidence rules**

Return stable reason codes instead of accusation text:

```ts
type PerformanceReviewReason =
  | 'target_ratio_over_3x'
  | 'region_ratio_over_3x'
  | 'legacy_mainland_ratio_over_3x'
  | 'cohort_target_degraded';
```

`probe_ceiling` remains a flag, never a reason. Cohort degradation suppresses target-ratio evidence for that target. `suspicious` requires the same reason on two consecutive dates or two independent reasons on one date.

- [ ] **Step 4: Persist assessment after complete evidence arrives**

Run assessment after target rows and region runs are stored. Update the run review status/reason JSON and the matching daily metric's `performance_review_status`; never mutate performance components, total score, risk penalty, listing state, tags, or historical raw measurements.

- [ ] **Step 5: Run anomaly and regression tests**

Run: `npx tsx --test backend/tests/performanceAnomalyService.test.ts backend/tests/aggregationService.test.ts backend/tests/risk.test.ts backend/tests/taggingService.test.ts`

Expected: all commands exit 0 and no risk/tag behavior changes.

- [ ] **Step 6: Commit evidence analysis**

Run: `git add backend/src/services/performanceAnomalyService.ts backend/src/services/performanceProbeJobService.ts backend/src/repositories/performanceRunRepository.ts backend/src/repositories/metricsRepository.ts backend/tests/performanceAnomalyService.test.ts && git commit -m "feat: classify performance probe anomalies"`

### Task 9: Add per-airport probe settings and grouped dashboard APIs

**Files:**
- Modify: `backend/src/routes/adminRoutes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/adminRoutes.test.ts`

- [ ] **Step 1: Write failing admin route tests**

Test `GET`/`PATCH /airports/:id/performance-probe-settings`, default rows, optimistic version conflicts, invariants, calibration gate, actor audit, no credential leakage, historical dashboard snapshots, and grouped current runs:

```ts
assert.deepEqual(canaryData.settings.map((row) => [row.probe_id, row.test_enabled, row.include_in_result]), [
  ['legacy-control', true, true],
  ['cn-shanghai', true, false],
  ['cn-guangzhou', true, false],
]);
assert.equal(audits[0]?.action, 'update_performance_probe_settings');
assert.doesNotMatch(JSON.stringify(audits), /raw_uri|token_hash|password/i);
```

- [ ] **Step 2: Run admin route tests and verify they fail**

Run: `npx tsx --test backend/tests/adminRoutes.test.ts`

Expected: new endpoints and grouped fields are absent.

- [ ] **Step 3: Add settings read/update routes**

The GET response includes sanitized probe metadata, switches, shared `config_version`, last calibration/run/review state, and `editable` based on requested date. PATCH accepts the complete three-row draft plus `expected_config_version`, validates all invariants server-side, blocks inclusion when the latest calibration is not valid, saves atomically, and writes one before/after audit event.

- [ ] **Step 4: Group dashboard evidence by probe**

Replace the single latest-run assumption in the performance dashboard payload with `probe_runs[]` while retaining scalar fields for compatibility. Scalar values must come from the stored daily aggregate, not whichever probe uploaded last. Each group includes run/profile/rule/calibration/review metadata, selected/tested nodes, target summaries, participation state, and sanitized errors. Historical dates use stored task/run snapshots and are read-only.

- [ ] **Step 5: Run route tests and type check**

Run: `npx tsx --test backend/tests/adminRoutes.test.ts && npm run server:typecheck`

Expected: all commands exit 0.

- [ ] **Step 6: Commit admin probe APIs**

Run: `git add backend/src/app.ts backend/src/routes/adminRoutes.ts backend/tests/adminRoutes.test.ts && git commit -m "feat: expose airport probe settings"`

### Task 10: Render accessible region switches and evidence

**Files:**
- Modify: `src/admin/AdminApp.tsx`
- Create: `backend/tests/adminPerformanceProbeUi.test.ts`

**Visual thesis:** Keep the operations page calm and compact: one white fine-bordered region card, dense black labels, indigo semantic switch states, and one restrained save action that becomes dominant only while changes are pending.

**Content hierarchy:** configuration summary → one row per region with state/switches → save/validation feedback → existing node selection → grouped collection evidence.

**Interaction feedback:** local draft changes, automatic include-off when test is disabled, explicit confirmation for scoring-scope changes, visible saving/success/error states, and keyboard/focus support.

- [ ] **Step 1: Write a failing admin UI source test**

Assert that the performance tab contains the new card before node selection, both labeled switches, form semantics, 40px targets, focus-visible classes, pending-change save, confirmation copy, historical read-only behavior, rule-aware formula copy, and grouped probe evidence:

```ts
assert.ok(source.indexOf('测试地区配置') < source.indexOf('性能测试节点'));
assert.match(source, /开启测试/);
assert.match(source, /并入测试结果/);
assert.match(source, /从下一轮性能采集生效，不修改历史成绩/);
assert.match(source, /aria-checked/);
assert.match(source, /focus-visible:/);
```

- [ ] **Step 2: Run the UI test and verify it fails**

Run: `npx tsx --test backend/tests/adminPerformanceProbeUi.test.ts`

Expected: the card and controls are absent.

- [ ] **Step 3: Add frontend response and draft types**

Mirror sanitized backend fields only. Load settings alongside dashboard/node selection, reset the draft on airport/date change, compare normalized rows for dirty state, and handle `409` by reloading with a clear “配置已被其他管理员更新” message.

- [ ] **Step 4: Implement the region settings card**

Render a semantic list/table that collapses cleanly on mobile. Each switch is a `<button type="button" role="switch">` with `aria-checked`, visible text, `min-h-10`, and `focus-visible:ring-2`. Disable inclusion when testing is off. Use indigo for enabled semantic state, neutral/rose/amber badges for shadow/failed/review, and avoid another permanent black button beside the existing manual action.

The save action appears/enables only for a dirty draft. If inclusion changes, show the approved confirmation text before PATCH. Update the formula block to show the active included rule versions instead of always claiming a 300 Mbps speed ceiling. Never display probe tokens, subscription URLs, raw URIs, or outbound objects.

- [ ] **Step 5: Render grouped collection results**

Add one compact expandable section per probe with calibration, rule version, participation, raw region metrics, ceiling label `≥180 Mbps，达到探针带宽上限`, target spread, and neutral review reasons. Keep the existing aggregate summary above the groups.

- [ ] **Step 6: Run frontend validation**

Run:

```bash
npx tsx --test backend/tests/adminPerformanceProbeUi.test.ts
npm run lint
npm run build
```

Expected: all commands exit 0 and `dist/` is regenerated.

- [ ] **Step 7: Verify in a real browser**

Open one airport's performance tab at desktop and narrow mobile widths. Verify switch keyboard operation, focus rings, confirmation, disabled states, dirty-state persistence, no horizontal overflow, grouped result expansion, and historical read-only rendering. Capture screenshots for the implementation handoff; do not commit screenshots unless explicitly requested.

- [ ] **Step 8: Commit the admin UI**

Run: `git add src/admin/AdminApp.tsx backend/tests/adminPerformanceProbeUi.test.ts dist && git commit -m "feat: configure airport performance regions"`

### Task 11: Publish neutral review messaging and methodology

**Files:**
- Modify: `backend/src/services/publicViewService.ts`
- Modify: `backend/src/services/publicPageRenderer.ts`
- Modify: `backend/src/types/domain.ts`
- Modify: `src/pages/methodology/content.ts`
- Test: `backend/tests/publicViewService.test.ts`
- Test: `backend/tests/frontendReportPage.test.ts`
- Test: `backend/tests/publicSiteSeo.test.ts`

- [ ] **Step 1: Write failing public presentation tests**

Assert that `needs_review`/`suspicious` becomes only a boolean/neutral note, raw evidence and internal reason codes are absent, normal pages render no warning, and methodology explains both speed thresholds and equal region weighting:

```ts
assert.match(html, /不同测试地区结果差异较大，正在复核/);
assert.doesNotMatch(html, /作弊|造假|legacy_mainland_ratio_over_3x/);
```

- [ ] **Step 2: Run public tests and verify they fail**

Run: `npx tsx --test backend/tests/publicViewService.test.ts backend/tests/frontendReportPage.test.ts backend/tests/publicSiteSeo.test.ts`

Expected: neutral review field/copy and methodology text are absent.

- [ ] **Step 3: Add a minimal public review field**

Map any non-normal internal performance review status to `performance_under_review: true` in `ReportView`. Do not expose probe IDs, ratios, reason codes, target names, or calibration details.

- [ ] **Step 4: Render neutral copy and update methodology**

Render one restrained note near core performance metrics only when under review. Explain that legacy control uses 300 Mbps full score, mainland 200 Mbps probes use 160 Mbps full score plus an `≥180 Mbps` ceiling label, regions are scored first then equally averaged, and historical scores are not backfilled.

- [ ] **Step 5: Run public/type/build checks**

Run:

```bash
npx tsx --test backend/tests/publicViewService.test.ts backend/tests/frontendReportPage.test.ts backend/tests/publicSiteSeo.test.ts
npm run server:typecheck
npm run lint
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit public transparency updates**

Run: `git add backend/src/types/domain.ts backend/src/services/publicViewService.ts backend/src/services/publicPageRenderer.ts src/pages/methodology/content.ts backend/tests/publicViewService.test.ts backend/tests/frontendReportPage.test.ts backend/tests/publicSiteSeo.test.ts dist && git commit -m "feat: explain regional performance scoring"`

### Task 12: Add token provisioning and hardened probe deployment assets

**Files:**
- Create: `scripts/manage_performance_probe.ts`
- Create: `ops/performance-probe/gaterank-probe.service`
- Create: `ops/performance-probe/gaterank-probe.timer`
- Create: `ops/performance-probe/gaterank-probe.env.example`
- Create: `ops/performance-probe/install.sh`
- Create: `ops/performance-probe/README.md`
- Create: `backend/tests/performanceProbeOps.test.ts`

- [ ] **Step 1: Write failing operations artifact tests**

Assert no secrets in tracked files, environment file mode instructions, non-root service user, `NoNewPrivileges`, writable-path restriction, serialized execution, pinned sing-box checksum, token one-time output, and explicit rollback commands:

```ts
assert.match(service, /User=gaterank-probe/);
assert.match(service, /NoNewPrivileges=true/);
assert.match(service, /UMask=0077/);
assert.doesNotMatch(allArtifacts, /ADMIN_API_KEY=[^\s#]+|PROBE_API_TOKEN=[^\s#]+|Bearer [A-Za-z0-9]/);
```

- [ ] **Step 2: Run artifact tests and verify they fail**

Run: `npx tsx --test backend/tests/performanceProbeOps.test.ts`

Expected: operations files are missing.

- [ ] **Step 3: Implement probe token and global-state management**

The script requires `PROBE_ID` and `PROBE_ACTION=issue-token|revoke-token|enable|disable`, and refuses `legacy-control`. `issue-token` generates 32 random bytes, stores only SHA-256 through `PerformanceProbeRepository.setTokenHash()`, and prints plaintext once. Other actions print status only. It must not accept a token via command-line arguments or log database connection secrets.

- [ ] **Step 4: Implement idempotent installation**

`install.sh` validates Debian 12 tools, creates `/opt/gaterank-probe`, creates the locked `gaterank-probe` user, installs a virtual environment, copies only required Python files, downloads the configured sing-box release, verifies the committed SHA-256, installs systemd units, and leaves the timer disabled until the operator runs the documented activation command.

- [ ] **Step 5: Harden service/timer and document rotation/rollback**

Use `Type=oneshot`, `User=gaterank-probe`, `Group=gaterank-probe`, `UMask=0077`, `NoNewPrivileges=true`, `PrivateTmp=true`, `ProtectSystem=strict`, `ProtectHome=true`, bounded memory/CPU/runtime, and only the required writable state directory. Timer uses `Persistent=true` plus randomized delay and cannot overlap because the service is oneshot.

The README must include preflight, token generation, environment installation with mode `0600`, dry run, timer enable, journal redaction check, token rotation, stop/disable, token revoke, and removal commands. It must require validated SSH-key login before password rotation and contain no server password.

- [ ] **Step 6: Run operations and shell checks**

Run:

```bash
npx tsx --test backend/tests/performanceProbeOps.test.ts
bash -n ops/performance-probe/install.sh
if command -v systemd-analyze >/dev/null 2>&1; then
  systemd-analyze verify ops/performance-probe/gaterank-probe.service ops/performance-probe/gaterank-probe.timer
else
  echo 'systemd-analyze unavailable; verify on Debian probe before activation'
fi
```

Expected: repository tests and `bash -n` exit 0. If macOS lacks `systemd-analyze`, record that verification as deferred to the Debian probes rather than treating it as passed.

- [ ] **Step 7: Commit deployment assets**

Run: `git add scripts/manage_performance_probe.ts ops/performance-probe backend/tests/performanceProbeOps.test.ts && git commit -m "ops: add hardened performance probe deployment"`

### Task 13: Complete local verification and compatibility rehearsal

**Files:**
- Verify only; fix only scoped failures in the files above.

- [ ] **Step 1: Run all focused TypeScript tests**

Run:

```bash
npx tsx --test \
  backend/tests/performanceRegionScoring.test.ts \
  backend/tests/performanceProbeRepository.test.ts \
  backend/tests/performanceProbeSettingRepository.test.ts \
  backend/tests/performanceProbeJobRepository.test.ts \
  backend/tests/performanceRunRepository.test.ts \
  backend/tests/performanceRunTargetRepository.test.ts \
  backend/tests/performanceProbeAuth.test.ts \
  backend/tests/performanceProbeRoutes.test.ts \
  backend/tests/performanceProbeDispatchService.test.ts \
  backend/tests/performanceAnomalyService.test.ts \
  backend/tests/aggregationService.test.ts \
  backend/tests/scoringEngine.test.ts \
  backend/tests/adminRoutes.test.ts \
  backend/tests/adminPerformanceProbeUi.test.ts \
  backend/tests/performanceProbeOps.test.ts
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 2: Run Python and static checks**

Run:

```bash
python3 -m unittest scripts.test_monitor_performance scripts.test_performance_probe_runner -v
bash -n ops/performance-probe/install.sh
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Run full project verification**

Run:

```bash
npm run test:backend
npm run server:typecheck
npm run lint
npm run build
```

Expected: all commands exit 0. If a pre-existing unrelated failure appears, reproduce it on the pre-feature commit before classifying it as debt; never describe a truncated parallel run as passing evidence.

- [ ] **Step 4: Rehearse migration against a disposable database clone**

Start the backend against a clone of production schema/data, verify all `ensureSchema()` calls complete, old performance rows read as legacy, current public scores remain identical before any mainland job is included, repeated startup is idempotent, and rolling back the application binary still reads old tables. Do not rehearse against the production database.

- [ ] **Step 5: Inspect final scope and secrets**

Run:

```bash
git status --short
git diff --stat HEAD~12..HEAD
git grep -n -E 'PROBE_API_TOKEN=.+|ADMIN_API_KEY=.+|raw_uri.*password|BEGIN (RSA|OPENSSH) PRIVATE KEY'
```

Expected: only intended files/build artifacts are changed and the secret scan returns no tracked secret.

### Task 14: Deploy one-airport shadow canary

**Files:**
- Production runtime only; do not commit generated tokens, environment files, logs, or screenshots.

- [ ] **Step 1: Deploy the backward-compatible backend first**

Use the existing production deployment procedure. Before continuing, verify health endpoints, schema initialization, existing scheduler state, and one unchanged legacy performance collection. Compare current public/admin P values with the pre-deploy snapshot.

- [ ] **Step 2: Provision independent probe tokens**

Run `PROBE_ACTION=issue-token` separately for `cn-shanghai` and `cn-guangzhou`. Store each one-time plaintext directly in its host's root-owned temporary environment setup, then write `/etc/gaterank-probe.env` as mode `0600` owned by `gaterank-probe`; do not paste tokens into chat, shell history, repository files, or command-line arguments. Enable each probe with `PROBE_ACTION=enable` only after its environment and empty-queue dry run are ready.

- [ ] **Step 3: Install both probes without enabling timers**

Copy the committed ops bundle, run `install.sh`, verify sing-box checksum, Python version, service sandbox, environment ownership, disk/memory headroom, and SSH recovery access. Run one `systemctl start gaterank-probe.service` dry execution against an empty queue and confirm a clean no-job exit.

- [ ] **Step 4: Enable Now acceleration only**

In the admin performance tab for Now acceleration, save Shanghai and Guangzhou as `test_enabled=true`, `include_in_result=false`; keep legacy `true/true`. Leave all other airports' mainland settings test-disabled during canary even if their stored defaults are shadow-ready.

- [ ] **Step 5: Enable timers and verify one complete shadow cycle**

Enable/start both timers. Trigger the airport manual performance job, then verify both remote jobs lease once, calibration is at least 160 Mbps, target rows upload, grouped admin evidence appears, logs contain no secrets, and the public/admin official P remains from legacy only.

- [ ] **Step 6: Exercise canary rollback**

Disable one timer and confirm the other/legacy flow remains healthy; re-enable it and complete a job. Revoke/rotate a test token and confirm old auth fails/new auth succeeds. Restore the canary to both timers enabled, shadow only.

### Task 15: Run three-day shadow observation and manually cut over

**Files:**
- Production runtime and operational evidence only.

- [ ] **Step 1: Expand shadow testing to all runnable airports**

Use an audited backend operation or individually saved settings to set Shanghai/Guangzhou `test_enabled=true`, `include_in_result=false` while legacy remains `true/true`. Stagger queue creation and keep each probe single-job serialized.

- [ ] **Step 2: Record three complete Beijing-calendar days**

For each day, record total/leased/completed/failed/expired jobs, calibration pass rate, median runtime, target health, per-region result completeness, ceiling counts, target/location/control review counts, and resource peaks. A day is complete only if both probes finish every expected shadow job or every exception is explicitly resolved and rerun.

- [ ] **Step 3: Apply cutover gates**

Proceed only when all three days have valid Shanghai/Guangzhou calibration, no unresolved target-wide degradation, acceptable queue completion time, no secret leakage, and reviewed anomaly explanations. Keep shadow mode if any gate fails; do not weaken the 160 Mbps calibration threshold to force passage.

- [ ] **Step 4: Cut over one reviewed airport first**

Set Shanghai/Guangzhou to `true/true` and legacy to `true/false`. Wait for the next complete official batch, verify both regions are included exactly once, confirm `cn_dual_probe_v1`, compare old/new P and total score, inspect the public methodology/review note, and verify historical dates are unchanged.

- [ ] **Step 5: Expand cutover manually**

Apply the same setting change to the remaining airports in reviewed batches. Do not auto-enable inclusion from elapsed time alone. Preserve legacy testing as shadow control unless probe resource or operations policy requires disabling it.

- [ ] **Step 6: Finish production acceptance**

Verify one full scheduler cycle, one manual collection, missing-region behavior, calibration failure behavior, settings audit logs, probe token isolation, public/admin display, server/probe CPU-memory-disk, and rollback controls. Rotate the previously exposed SSH password only after key-based login succeeds independently on each host.

---

## Execution stop conditions

- Stop before production deployment if focused tests, type checks, build, disposable-database rehearsal, or secret scan fails.
- Stop the affected probe if calibration is below 160 Mbps, the service leaks secrets, temporary node configs survive cleanup, or resource pressure destabilizes the host.
- Keep legacy scoring if either official mainland region is incomplete; never silently score from one of two configured official regions.
- Do not label an airport as cheating from automated evidence; route `needs_review` and `suspicious` to human review only.
- Do not begin the three-day clock until the canary cycle and rollback exercise both pass.
