# Homepage Observation Days From Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every homepage observation-duration display count from the airport's GateRank onboarding date instead of the airport's founding date.

**Architecture:** Add one shared date-only calculator used by React, SSR, and the homepage view service. Preserve the existing API field `created_at` for ranking items, and add an explicitly named `airport_created_at` field to advertising deal rows so campaign creation time cannot be confused with airport onboarding time.

**Tech Stack:** TypeScript, React 19, Express SSR, MySQL, Node test runner with `tsx --test`.

---

### Task 1: Shared observation-day semantics

**Files:**
- Create: `shared/observationDays.ts`
- Create: `backend/tests/observationDays.test.ts`

- [ ] **Step 1: Write the failing calculator tests**

```ts
test('calculateObservationDays counts onboarding day as day one', () => {
  assert.equal(calculateObservationDays('2026-03-21', '2026-07-31'), 133);
  assert.equal(calculateObservationDays('2026-07-31', '2026-07-31'), 1);
});

test('calculateObservationDays clamps future onboarding and rejects invalid dates', () => {
  assert.equal(calculateObservationDays('2026-08-01', '2026-07-31'), 0);
  assert.equal(calculateObservationDays(null, '2026-07-31'), null);
  assert.equal(calculateObservationDays('invalid', '2026-07-31'), null);
});
```

- [ ] **Step 2: Run the test and verify it fails because the helper does not exist**

Run: `npx tsx --test backend/tests/observationDays.test.ts`

Expected: FAIL because `shared/observationDays.ts` cannot be resolved.

- [ ] **Step 3: Implement the shared calculator**

```ts
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function calculateObservationDays(
  onboardedAt: string | null | undefined,
  targetDate: string | null | undefined,
): number | null {
  const start = parseDateOnly(onboardedAt);
  const end = parseDateOnly(targetDate);
  if (start === null || end === null) return null;
  return Math.max(0, Math.floor((end - start) / 86_400_000) + 1);
}

function parseDateOnly(value: string | null | undefined): number | null {
  const dateOnly = String(value || '').slice(0, 10);
  if (!DATE_ONLY_PATTERN.test(dateOnly)) return null;
  const parsed = Date.parse(`${dateOnly}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? parsed : null;
}
```

- [ ] **Step 4: Run the test and verify both cases pass**

Run: `npx tsx --test backend/tests/observationDays.test.ts`

Expected: 2 tests pass, 0 fail.

### Task 2: React and SSR ranking consistency

**Files:**
- Modify: `src/pages/home/HomePageV3.tsx`
- Modify: `backend/src/services/publicPageRenderer.ts`
- Modify: `backend/tests/frontendCrawlableLinks.test.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Add failing source and SSR assertions**

Require both React ranking renderers to call `observationDays(item.created_at, date, ...)`, reject `item.founded_on`, set the SSR fixture to `founded_on: '2025-01-01'` and `created_at: '2026-03-20'`, and assert the March 23 page contains `观察 4 天`.

- [ ] **Step 2: Run the focused tests and verify the new assertions fail**

Run: `npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts`

Expected: FAIL because React and SSR still use `founded_on`.

- [ ] **Step 3: Switch React and SSR to the shared onboarding calculator**

```ts
const days = calculateObservationDays(onboardedAt, date);
if (days === null) return compact ? '观察 —' : '--';
return compact ? `观察 ${days} 天` : `${days} 天`;
```

Add `created_at: string` to the React `FullRankingItem`, pass `item.created_at` from desktop and mobile renderers, and pass `item.created_at` to the SSR formatter.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts backend/tests/observationDays.test.ts`

Expected: all selected tests pass.

### Task 3: Homepage advertising observation days

**Files:**
- Modify: `shared/airportAds.ts`
- Modify: `backend/src/repositories/airportAdCampaignRepository.ts`
- Modify: `backend/src/services/publicViewService.ts`
- Modify: `backend/tests/airportAdCampaignRepository.test.ts`
- Modify: `backend/tests/publicViewService.test.ts`

- [ ] **Step 1: Add failing repository and view-service assertions**

Add `airport_created_at: '2026-03-20 00:00:00'` to the deal row fixture and assert it maps to `2026-03-20T00:00:00+08:00`. In the homepage service test, use a founding date in 2024 and an onboarding date of 2026-03-20 for a 2026-03-23 page, then assert `tracking_days === 4`.

- [ ] **Step 2: Run the focused tests and verify the new assertions fail**

Run: `npx tsx --test backend/tests/airportAdCampaignRepository.test.ts backend/tests/publicViewService.test.ts`

Expected: FAIL because deal rows do not expose airport onboarding time and `tracking_days` still uses `founded_on`.

- [ ] **Step 3: Map and consume the airport onboarding timestamp**

```ts
// selectDealSql
DATE_FORMAT(airport.created_at, '%Y-%m-%d %H:%i:%s') AS airport_created_at,

// buildHomeSponsoredDeals
const onboardedAt = airport?.created_at || deal.airport_created_at;
tracking_days: calculateObservationDays(onboardedAt, date) ?? 0,
```

Declare `airport_created_at` in `CampaignRow` and `AirportDealView`, and map it with `sqlDateTimeToTimezoneIso`.

- [ ] **Step 4: Run the focused tests and verify they pass**

Run: `npx tsx --test backend/tests/airportAdCampaignRepository.test.ts backend/tests/publicViewService.test.ts backend/tests/observationDays.test.ts`

Expected: all selected tests pass.

### Task 4: Full verification and delivery

**Files:**
- Verify all files changed in Tasks 1-3.

- [ ] **Step 1: Run focused regression tests**

Run: `npx tsx --test backend/tests/observationDays.test.ts backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts backend/tests/airportAdCampaignRepository.test.ts backend/tests/publicViewService.test.ts`

Expected: 0 failures.

- [ ] **Step 2: Run type checks**

Run: `npm run lint && npm run server:typecheck`

Expected: both commands exit 0.

- [ ] **Step 3: Run the complete backend suite and production build**

Run: `npm run test:backend && npm run build`

Expected: backend suite reports 0 failures and Vite build exits 0.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check && git status --short && git diff --stat`

Expected: no whitespace errors; only the planned implementation, tests, generated build assets if tracked, and plan/spec files are present.

- [ ] **Step 5: Commit the implementation**

```bash
git add shared/observationDays.ts shared/airportAds.ts src/pages/home/HomePageV3.tsx backend/src/services/publicPageRenderer.ts backend/src/services/publicViewService.ts backend/src/repositories/airportAdCampaignRepository.ts backend/tests/observationDays.test.ts backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts backend/tests/airportAdCampaignRepository.test.ts backend/tests/publicViewService.test.ts dist
git commit -m "fix: count homepage observation days from onboarding"
```

