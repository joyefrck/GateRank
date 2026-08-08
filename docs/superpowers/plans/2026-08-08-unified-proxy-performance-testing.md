# Unified Proxy Performance Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Hong Kong, Shanghai, and Guangzhou measure latency and download throughput through each node's sing-box proxy with the same two-target profile and no direct-download calibration gate.

**Architecture:** Keep the existing central collector and remote-probe job architecture, but make both call the same measurement semantics: two proxy HTTP latency requests followed by sequential CacheFly and Cloudflare downloads, each using a fixed 10-second/two-connection window. Persist target evidence for both ingestion paths, treat calibration as `not_required`, and retain region-specific scoring thresholds and per-airport include switches.

**Tech Stack:** Python 3.11 `urllib`/`threading`/`unittest`, sing-box 1.13, TypeScript 5.8, Express 4, MySQL 8, React 19, Node test runner.

**Design reference:** `docs/superpowers/specs/2026-08-08-mainland-performance-probes-design.md`

---

## File map

- Modify `scripts/monitor_performance.py`: define the shared proxy target profile, proxy real-ping semantics, target-level download results, and legacy-control payload evidence.
- Modify `scripts/performance_probe_runner.py`: remove direct calibration execution and reuse the shared proxy measurement helpers.
- Modify `scripts/test_monitor_performance.py`: cover proxy real ping, target aggregation, and legacy payload evidence.
- Modify `scripts/test_performance_probe_runner.py`: cover no-calibration execution and partial/all-target failure behavior.
- Modify `backend/src/config/performanceProbes.ts`: expose `proxy_multi_target_v2` for all three regions.
- Modify `backend/src/services/performanceProbeJobService.ts`: dispatch no direct-calibration target and accept `not_required` runs.
- Modify `backend/src/services/aggregationService.ts`: accept compatible regional runs with `calibration_status=not_required`.
- Modify `backend/src/services/performanceAnomalyService.ts`: remove the calibration-pass prerequisite while retaining target/location anomaly rules.
- Modify `backend/src/routes/adminRoutes.ts`: validate inclusion using a successful compatible proxy run and persist legacy target rows.
- Modify `backend/src/types/domain.ts`: carry target evidence through the admin ingestion contract.
- Modify `src/admin/AdminApp.tsx`: replace calibration labels with proxy-profile and target-result explanations.
- Modify focused backend/frontend tests named in the tasks below.

### Task 1: Shared Python proxy measurement semantics

**Files:**
- Modify: `scripts/monitor_performance.py`
- Test: `scripts/test_monitor_performance.py`

- [ ] **Step 1: Write failing tests for proxy real ping and multi-target averaging**

Add tests that patch `build_proxy_opener`, return two response durations, and assert the minimum successful proxy HTTP duration is selected. Add a target test using two deterministic `test_speed_detailed` results and assert the node representative value is their median and each target retains `bytes_downloaded`, `duration_ms`, `download_mbps`, and `valid`.

```python
def test_proxy_real_ping_uses_minimum_of_two_successful_requests(self):
    samples, failures, attempts = monitor.test_proxy_http_latency(config)
    self.assertEqual(attempts, 2)
    self.assertEqual(failures, 0)
    self.assertEqual(min(samples), samples[0])

def test_proxy_speed_targets_keep_raw_evidence_and_use_median(self):
    results = monitor.test_speed_targets(config, [
        {"target_key": "cachefly-50mb", "url": "https://cachefly.cachefly.net/50mb.test"},
        {"target_key": "cloudflare-50mb", "url": "https://speed.cloudflare.com/__down?bytes=50000000"},
    ])
    self.assertEqual([row.target_key for row in results], ["cachefly-50mb", "cloudflare-50mb"])
    self.assertEqual(monitor.target_download_median(results), 100.0)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `python3 -m unittest scripts.test_monitor_performance -v`

Expected: FAIL because `test_speed_targets` and `target_download_median` do not exist and real ping still uses the old sampling contract.

- [ ] **Step 3: Implement the shared profile and helpers**

Add immutable target definitions and a target result dataclass:

```python
PROXY_SPEED_TARGETS_V2 = (
    {"target_key": "cachefly-50mb", "url": "https://cachefly.cachefly.net/50mb.test"},
    {"target_key": "cloudflare-50mb", "url": "https://speed.cloudflare.com/__down?bytes=50000000"},
)

@dataclass(frozen=True)
class SpeedTargetResult:
    target_key: str
    download_mbps: float | None
    bytes_downloaded: int
    duration_ms: float
    valid: bool
    error_code: str | None
```

Implement `test_speed_targets(config, targets)` by replacing only `test_url_speed`, running targets sequentially, and recording failures instead of aborting the node. Implement `target_download_median` from valid non-null results. Configure proxy HTTP latency for exactly two attempts and use its minimum successful value as the scored latency while retaining TCP-connect samples as diagnostics.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `python3 -m unittest scripts.test_monitor_performance -v`

Expected: all monitor performance tests pass.

- [ ] **Step 5: Commit the shared measurement unit**

```bash
git add scripts/monitor_performance.py scripts/test_monitor_performance.py
git commit -m "feat: unify proxy performance measurements"
```

### Task 2: Remove remote-probe direct calibration and submit proxy evidence

**Files:**
- Modify: `scripts/performance_probe_runner.py`
- Test: `scripts/test_performance_probe_runner.py`

- [ ] **Step 1: Replace the failed-calibration test with no-calibration execution tests**

Create a job with no `calibration.url`, patch node selection and measurement, then assert the runner still uploads the run:

```python
def test_run_without_calibration_executes_proxy_measurements(self):
    result = run_once(config)
    self.assertEqual(result["status"], "success")
    self.assertEqual(upload["calibration_status"], "not_required")
    self.assertIsNone(upload["calibration_mbps"])
    self.assertEqual(upload["diagnostics"]["test_profile"], "proxy_multi_target_v2")
```

Add one-target-valid and both-target-failed cases; the first must retain a node download value with `partial`, while the second must not fabricate `0 Mbps`.

- [ ] **Step 2: Run the runner test and verify RED**

Run: `python3 -m unittest scripts.test_performance_probe_runner -v`

Expected: FAIL because `run_once` currently uploads `calibration_target_missing` before selecting nodes.

- [ ] **Step 3: Implement no-calibration proxy execution**

Delete the `measure_direct_download` gate from `run_once`. Always select nodes and run proxy measurements, and build payloads with:

```python
"calibration_status": "not_required",
"calibration_mbps": None,
"diagnostics": {
    "test_profile": "proxy_multi_target_v2",
    "speed_measurement": "average_multi_connection_download_via_sing_box_proxy",
    "target_count": len(targets),
},
```

Use the shared latency and multi-target helpers from `monitor_performance.py`; keep per-target error codes and byte/duration evidence.

- [ ] **Step 4: Run both Python suites and verify GREEN**

Run: `python3 -m unittest scripts.test_monitor_performance scripts.test_performance_probe_runner -v`

Expected: all tests pass.

- [ ] **Step 5: Commit the remote runner change**

```bash
git add scripts/performance_probe_runner.py scripts/test_performance_probe_runner.py
git commit -m "feat: run regional probes without direct calibration"
```

### Task 3: Version job payloads and accept `not_required` regional runs

**Files:**
- Modify: `backend/src/config/performanceProbes.ts`
- Modify: `backend/src/services/performanceProbeJobService.ts`
- Modify: `backend/src/services/aggregationService.ts`
- Modify: `backend/src/services/performanceAnomalyService.ts`
- Test: `backend/tests/performanceProbeJobService.test.ts`
- Test: `backend/tests/aggregationService.test.ts`
- Test: `backend/tests/performanceAnomalyService.test.ts`
- Test: `backend/tests/performanceProbeDispatchService.test.ts`

- [ ] **Step 1: Write failing backend tests**

Assert all three probe definitions expose `test_profile: 'proxy_multi_target_v2'`; leased regional jobs contain the two fixed targets and no calibration URL; a successful `not_required` regional run is finalized, aggregated, and anomaly-assessed.

```ts
assert.deepEqual(job.calibration, { mode: 'not_required' });
assert.deepEqual(job.speed_targets, [
  { target_key: 'cachefly-50mb', url: 'https://cachefly.cachefly.net/50mb.test' },
  { target_key: 'cloudflare-50mb', url: 'https://speed.cloudflare.com/__down?bytes=50000000' },
]);
assert.equal(run.calibration_status, 'not_required');
```

- [ ] **Step 2: Run focused backend tests and verify RED**

Run: `npx tsx --test backend/tests/performanceProbeJobService.test.ts backend/tests/aggregationService.test.ts backend/tests/performanceAnomalyService.test.ts backend/tests/performanceProbeDispatchService.test.ts`

Expected: failures reference the old profile names and `calibration_status !== 'passed'` gates.

- [ ] **Step 3: Implement version and validity changes**

Set every `PerformanceProbeDefinition.test_profile` to `proxy_multi_target_v2`. Return `{ mode: 'not_required' }` from the job calibration builder and return the fixed CacheFly/Cloudflare target array without environment-dependent empty defaults. Replace regional validity checks with a helper that requires `status === 'success'`, matching `config_version`, a non-null `median_download_mbps`, and `calibration_status === 'not_required'` for the v2 profile; preserve legacy reads for old records.

- [ ] **Step 4: Run focused backend tests and verify GREEN**

Run the command from Step 2.

Expected: all focused tests pass.

- [ ] **Step 5: Commit backend profile semantics**

```bash
git add backend/src/config/performanceProbes.ts backend/src/services/performanceProbeJobService.ts backend/src/services/aggregationService.ts backend/src/services/performanceAnomalyService.ts backend/tests/performanceProbeJobService.test.ts backend/tests/aggregationService.test.ts backend/tests/performanceAnomalyService.test.ts backend/tests/performanceProbeDispatchService.test.ts
git commit -m "feat: accept proxy-only regional performance runs"
```

### Task 4: Persist Hong Kong target rows and validate inclusion by proxy evidence

**Files:**
- Modify: `backend/src/types/domain.ts`
- Modify: `backend/src/routes/adminRoutes.ts`
- Test: `backend/tests/adminRoutes.test.ts`
- Modify: `scripts/monitor_performance.py`
- Test: `scripts/test_monitor_performance.py`

- [ ] **Step 1: Write failing ingestion and inclusion tests**

Post a legacy performance run with two `target_results` and assert `performanceRunTargetRepository.insertMany` receives rows bound to the inserted run ID. Patch a recent Shanghai run with `status='success'`, `test_profile='proxy_multi_target_v2'`, `median_download_mbps=88`, and `calibration_status='not_required'`; enabling inclusion must return 200. A run without a valid download value must return 409 `PERFORMANCE_PROBE_PROXY_RUN_REQUIRED`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npx tsx --test backend/tests/adminRoutes.test.ts`

Expected: target rows are ignored and inclusion is rejected by the old 160 Mbps calibration gate.

- [ ] **Step 3: Implement target ingestion and proxy-run validation**

Extend `PerformanceRunInput` with `target_results?: Omit<PerformanceRunTarget, 'run_id'>[]`. Add `insertMany` to the admin dependency contract, validate each target's key, bytes, duration, nullable Mbps/status/error, and boolean validity, then insert rows after the run ID is created. Change the settings gate to require a successful compatible v2 run with finite positive `median_download_mbps`; remove the calibration threshold and return the new error code/message.

Update the Hong Kong monitor payload with `probe_id='legacy-control'`, `test_profile='proxy_multi_target_v2'`, `calibration_status='not_required'`, per-target rows, and proxy real-ping latency samples.

- [ ] **Step 4: Run ingestion and Python tests and verify GREEN**

Run: `npx tsx --test backend/tests/adminRoutes.test.ts && python3 -m unittest scripts.test_monitor_performance -v`

Expected: all tests pass.

- [ ] **Step 5: Commit Hong Kong parity**

```bash
git add backend/src/types/domain.ts backend/src/routes/adminRoutes.ts backend/tests/adminRoutes.test.ts scripts/monitor_performance.py scripts/test_monitor_performance.py
git commit -m "feat: persist Hong Kong proxy target evidence"
```

### Task 5: Update admin evidence wording

**Files:**
- Modify: `src/admin/AdminApp.tsx`
- Test: `backend/tests/adminPerformanceProbeUi.test.ts`

- [ ] **Step 1: Write failing UI assertions**

Assert the performance evidence section contains `代理测速配置`, `无需直连校准`, and target summaries, and no longer renders the labels `校准速度` or the sentence mentioning calibration in grouped evidence.

- [ ] **Step 2: Run the focused UI test and verify RED**

Run: `npx tsx --test backend/tests/adminPerformanceProbeUi.test.ts`

Expected: the old calibration labels are still rendered.

- [ ] **Step 3: Implement the wording and evidence fields**

Replace calibration fields with a neutral `无需直连校准` badge for v2 runs, label latency as `代理真实延迟中位数`, retain TCP connect latency as diagnostic, and describe the grouped table as two proxy download targets. Do not change the two per-region switches or layout hierarchy.

- [ ] **Step 4: Run UI tests, lint, and build**

Run: `npx tsx --test backend/tests/adminPerformanceProbeUi.test.ts && npm run lint && npm run build`

Expected: tests pass; TypeScript and Vite exit 0.

- [ ] **Step 5: Commit the UI update**

```bash
git add src/admin/AdminApp.tsx backend/tests/adminPerformanceProbeUi.test.ts
git commit -m "fix: explain proxy-only performance evidence"
```

### Task 6: Full verification and production shadow acceptance

**Files:**
- Modify only if verification exposes a scoped defect.

- [ ] **Step 1: Run the complete local verification matrix**

```bash
python3 -m unittest discover -s scripts -p 'test_*.py' -v
npm run test:backend
npm run server:typecheck
npm run lint
npm run build
git diff --check
```

Expected: every command exits 0; no failed or skipped feature-critical tests.

- [ ] **Step 2: Publish the current main branch**

Push only after confirming `git status --short` is clean and `git log --oneline origin/main..HEAD` contains only the approved design and implementation commits.

- [ ] **Step 3: Deploy API and Web as one paired release**

Use the existing production Compose workflow. Record previous image IDs for rollback, pull the successful GHCR build, recreate `gaterank-api` and `gaterank-web`, and verify `/healthz`, public home, methodology, and unauthenticated probe endpoint behavior.

- [ ] **Step 4: Refresh both probe bundles**

Copy the verified runner to Shanghai and Guangzhou, validate checksum and systemd unit syntax, then restart their timers. Do not print tokens or subscription/node payloads.

- [ ] **Step 5: Run a Now shadow cycle**

Keep Shanghai and Guangzhou `test_enabled=true`, `include_in_result=false`. Trigger one manual performance collection and verify both jobs complete with `calibration_status=not_required`, non-empty CacheFly/Cloudflare target evidence where reachable, and no `calibration_target_missing` or direct-download requests.

- [ ] **Step 6: Verify public-score isolation and rollback readiness**

Confirm Now's formal included probes still contain only `legacy-control`, the public P score is unchanged by shadow rows, production logs contain no secrets, and disabling either region prevents its next job without affecting Hong Kong.

- [ ] **Step 7: Clean temporary local artifacts**

Remove the exact temporary v2rayN checkout `/tmp/gaterank-v2rayn.ohlgbu` and the exact prior sing-box staging directory `/tmp/gaterank-singbox.SuDqI0` after verifying neither is referenced by a running process. Clear persistent shell token variables and close that shell session.
