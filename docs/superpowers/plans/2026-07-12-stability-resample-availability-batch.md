# Stability Resample Availability Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make manual and scheduler stability rechecks replace stale same-day availability observations so recovered airports are no longer pinned to an S score of 30.

**Architecture:** Normalize stability availability samples once in `AggregationService` by date. For each day, keep all ordinary observations unless a recheck marker exists; when one exists, retain the last recheck and all later observations. Reuse that normalized map for today uptime, 30-day uptime, stability tier, and streaks so all derived metrics share identical batch semantics.

**Tech Stack:** TypeScript, Node.js test runner, `tsx`, existing GateRank aggregation and scoring services.

---

### Task 1: Add availability recheck regression coverage

**Files:**
- Modify: `backend/tests/aggregationService.test.ts`
- Test: `backend/tests/aggregationService.test.ts`

- [ ] **Step 1: Write a failing regression test for stale failures replaced by a manual recheck**

Add a test beside the existing latest stability latency batch test. Build one day of three failed ordinary stability observations followed by one successful ordinary observation and one successful `manual-stability` observation. Include low latency samples after the manual marker, aggregate the day, and assert:

```ts
assert.equal(written[0].uptime_percent_today, 100);
assert.equal(written[0].uptime_percent_30d, 100);
assert.equal(written[0].stability_tier, 'stable');
assert.equal(written[0].healthy_days_streak, 2);
```

- [ ] **Step 2: Add compatibility coverage for normal observations and post-recheck observations**

Add two focused cases:

```ts
// No recheck marker: false + true remains 50%.
assert.equal(written[0].uptime_percent_today, 50);

// A successful manual recheck followed by a failed cron observation becomes 50%.
assert.equal(written[0].uptime_percent_today, 50);
```

Use `probe_scope: 'stability'` for every availability sample. Add a previous-day successful manual recheck in the first case so the 30-day and streak assertions prove historical dates use the same normalized map.

- [ ] **Step 3: Run the targeted test and verify the regression fails**

Run:

```bash
npx tsx --test backend/tests/aggregationService.test.ts
```

Expected: the new stale-failure test fails because `uptime_percent_today` is calculated from every same-day availability sample instead of the final recheck boundary.

### Task 2: Normalize availability samples by the last recheck boundary

**Files:**
- Modify: `backend/src/services/aggregationService.ts:77-138`
- Modify: `backend/src/services/aggregationService.ts:190-215`
- Test: `backend/tests/aggregationService.test.ts`

- [ ] **Step 1: Replace the separate raw availability collections with one normalized map**

In `aggregateAirport`, construct the effective map before calculating current-day uptime:

```ts
const availByDay = buildAvailabilityMap(samples);
const dayAvail = availByDay.get(date) || [];
const uptimePercentToday = dayAvail.length ? round2(average(dayAvail) * 100) : 0;
```

Remove the later loop that rebuilds `availByDay` from every raw availability sample. Keep `calcUptimePercent`, `getStabilityTier`, and both streak calculations consuming the normalized map.

- [ ] **Step 2: Add focused helpers for daily availability batch selection**

Add helpers near `buildLatencyMap`:

```ts
function buildAvailabilityMap(samples: ProbeSample[]): Map<string, number[]> {
  const samplesByDay = new Map<string, ProbeSample[]>();
  for (const sample of samples) {
    if (
      sample.sample_type !== 'availability' ||
      sample.probe_scope !== 'stability' ||
      sample.availability === null
    ) {
      continue;
    }
    const key = sample.sampled_at.slice(0, 10);
    const list = samplesByDay.get(key) || [];
    list.push(sample);
    samplesByDay.set(key, list);
  }

  const availByDay = new Map<string, number[]>();
  for (const [day, daySamples] of samplesByDay.entries()) {
    availByDay.set(day, getEffectiveAvailabilityBatch(daySamples));
  }
  return availByDay;
}

function getEffectiveAvailabilityBatch(samples: ProbeSample[]): number[] {
  const availabilitySamples = samples
    .filter(
      (sample) =>
        sample.sample_type === 'availability' &&
        sample.probe_scope === 'stability' &&
        sample.availability !== null,
    )
    .slice()
    .sort((left, right) => sampleTimeMs(left) - sampleTimeMs(right));
  const latestRecheck = availabilitySamples
    .filter((sample) => isAvailabilityRecheckSource(sample.source))
    .at(-1);
  const effectiveSamples = latestRecheck
    ? availabilitySamples.filter((sample) => sampleTimeMs(sample) >= sampleTimeMs(latestRecheck))
    : availabilitySamples;
  return effectiveSamples.map((sample) => (sample.availability ? 1 : 0));
}

function isAvailabilityRecheckSource(source: string): boolean {
  return source === 'manual-stability' || source === 'scheduler-stability-resample';
}
```

This deliberately does not treat `cron-stability` or `scheduler-stability` as replacement markers; those remain ordinary observations.

- [ ] **Step 3: Run the aggregation tests and verify they pass**

Run:

```bash
npx tsx --test backend/tests/aggregationService.test.ts
```

Expected: all aggregation service tests pass, including the three new availability batch cases.

### Task 3: Verify types, backend behavior, and diff scope

**Files:**
- Verify: `backend/src/services/aggregationService.ts`
- Verify: `backend/tests/aggregationService.test.ts`

- [ ] **Step 1: Run backend type checking**

Run:

```bash
npm run server:typecheck
```

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 2: Run the complete backend test suite**

Run:

```bash
npm run test:backend
```

Expected: exit code 0 and no failed tests. If an unrelated pre-existing failure appears, report its exact test name and output separately rather than claiming the complete suite passed.

- [ ] **Step 3: Inspect the final patch**

Run:

```bash
git diff --check
git diff -- backend/src/services/aggregationService.ts backend/tests/aggregationService.test.ts
```

Expected: no whitespace errors; changes are limited to availability batch normalization and its regression coverage.

- [ ] **Step 4: Commit the implementation only if the user requests a commit**

If explicitly requested:

```bash
git add backend/src/services/aggregationService.ts backend/tests/aggregationService.test.ts
git commit -m "fix: replace stale stability availability on recheck"
```
