# Homepage Section Limit Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the five admin homepage display limits control the current public homepage, with `today_pick` presented as “排行榜数量”.

**Architecture:** Keep the persisted `home_section_limits.today_pick` key for backward compatibility and reinterpret it as the current homepage ranking preview limit. Remove the current hard-coded ranking limit and summary minimum so `PublicViewService` is the single source of truth consumed by React and SSR.

**Tech Stack:** TypeScript, React 19, Express service layer, Node test runner, Vite.

---

### Task 1: Lock the runtime behavior with regression tests

**Files:**
- Modify: `backend/tests/publicViewService.test.ts:117-167`
- Modify: `backend/tests/publicViewService.test.ts:240-304`

- [x] **Step 1: Make the homepage fixture expose a non-default ranking limit**

Add a `marketingSettingsService` dependency to the homepage 3.0 composition test:

```ts
marketingSettingsService: {
  getConfig: async () => ({
    click_charge_amount: 1,
    home_section_limits: {
      today_pick: 3,
      most_stable: 3,
      best_value: 3,
      new_entries: 6,
      risk_alerts: 1,
    },
  }),
},
```

Assert the repository and response both use that value:

```ts
assert.equal(rankingPageSizes[0], 3);
assert.equal(result.ranking_preview!.items.length, 3);
```

- [x] **Step 2: Change the explicit configuration test to require exact values**

Keep the existing fixture values and update assertions to:

```ts
assert.equal(fullRankingPageSizes[0], 4);
assert.equal(approvedApplicationLimits[0], 7);
assert.equal(riskPageSizes[0], 2);
```

- [x] **Step 3: Run the focused service test and verify the regression fails**

Run:

```bash
node --import tsx --test backend/tests/publicViewService.test.ts
```

Expected: failures show the current hard-coded values `10` and `4` instead of configured values `3`, `4`, and `2`.

### Task 2: Apply exact homepage limits

**Files:**
- Modify: `backend/src/services/publicViewService.ts:277-427`
- Test: `backend/tests/publicViewService.test.ts`

- [x] **Step 1: Remove the hard-coded limit constants and derived minimums**

Delete:

```ts
const HOME_RANKING_PREVIEW_LIMIT = 10;
const HOME_SUMMARY_LIMIT = 4;
```

Use the loaded configuration directly:

```ts
const sectionLimits = marketingConfig.home_section_limits;
```

- [x] **Step 2: Use the configured ranking count for query and response**

Change the full-ranking query and preview response to:

```ts
this.deps.scoreRepository.getPublicFullRankingByDate(
  resolvedDate,
  1,
  sectionLimits.today_pick,
  EMPTY_FULL_RANKING_FILTERS,
  clickChargeAmount,
)
```

```ts
ranking_preview: {
  total: fullRankingPreview.total,
  items: fullRankingPreview.items.slice(0, sectionLimits.today_pick),
},
```

- [x] **Step 3: Use the four configured summary limits without expansion**

Replace every `summarySectionLimits` use in `getHomePageView()` with `sectionLimits`, including approved applications, risk monitor, section item building, fallback generation, and new-entry merging.

- [x] **Step 4: Run the focused service test**

Run:

```bash
node --import tsx --test backend/tests/publicViewService.test.ts
```

Expected: all tests pass.

### Task 3: Rename the admin field and verify the UI contract

**Files:**
- Modify: `src/admin/AdminApp.tsx:4335-4341`
- Modify: `backend/tests/frontendCrawlableLinks.test.ts`

- [x] **Step 1: Add a static admin regression assertion**

Read `src/admin/AdminApp.tsx` in the existing source-contract test file and assert:

```ts
assert.match(adminSource, /\{ key: 'today_pick', label: '排行榜数量' \}/);
```

- [x] **Step 2: Run the static frontend test and verify it fails**

Run:

```bash
node --import tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: failure because the current label is `今日推荐`.

- [x] **Step 3: Rename the field without changing the storage key**

Update only the label:

```ts
{ key: 'today_pick', label: '排行榜数量' },
```

Also change the section description to describe one ranking table plus four homepage modules:

```tsx
description="控制公开首页排行榜与四个摘要模块的展示数量，范围 1-12。"
```

- [x] **Step 4: Run the focused frontend test**

Run:

```bash
node --import tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: all tests pass.

### Task 4: Final verification

**Files:**
- Verify: `backend/src/services/publicViewService.ts`
- Verify: `backend/tests/publicViewService.test.ts`
- Verify: `src/admin/AdminApp.tsx`
- Verify: `backend/tests/frontendCrawlableLinks.test.ts`

- [x] **Step 1: Run both focused suites together**

```bash
node --import tsx --test backend/tests/publicViewService.test.ts backend/tests/frontendCrawlableLinks.test.ts
```

Expected: all tests pass.

- [x] **Step 2: Run backend type checking**

```bash
npm run server:typecheck
```

Expected: exit code 0, or report unrelated pre-existing failures separately.

- [x] **Step 3: Build the frontend**

```bash
npm run build
```

Expected: Vite build exits 0 and regenerates `dist` consistently with the existing working tree.

- [x] **Step 4: Review the focused diff**

```bash
git diff --check -- backend/src/services/publicViewService.ts backend/tests/publicViewService.test.ts src/admin/AdminApp.tsx backend/tests/frontendCrawlableLinks.test.ts
git diff -- backend/src/services/publicViewService.ts backend/tests/publicViewService.test.ts src/admin/AdminApp.tsx backend/tests/frontendCrawlableLinks.test.ts
```

Expected: no whitespace errors; only the configured homepage limits, admin label, description, and regression tests are added to the pre-existing changes.
