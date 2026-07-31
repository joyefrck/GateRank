# Unlimited Promotions and Homepage Ad Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the global six-campaign cap while keeping homepage positions 1–4 exclusive, and use the activity title as the homepage ad description with a homepage-only helper.

**Architecture:** Remove the obsolete count/limit contract from the shared portal status and repository purchase transaction. Keep homepage availability as the only placement-capacity contract. Render `discount_title` consistently in React and SSR homepage cards, while leaving the ordinary deals page on `discount_description`.

**Tech Stack:** TypeScript, React, Express, MySQL, Node test runner, Vite.

---

### Task 1: Prove campaigns are unlimited

**Files:**
- Modify: `backend/tests/airportAdCampaignRepository.test.ts`
- Modify: `backend/src/repositories/airportAdCampaignRepository.ts`
- Modify: `shared/airportAds.ts`

- [ ] **Step 1: Write failing repository assertions**

Update the active-deal query test to assert that its SQL has no `LIMIT 6`. In the ordinary purchase test, return seven rows for the former locking query and assert that purchase still inserts and charges normally.

- [ ] **Step 2: Run the focused test and confirm failure**

```bash
node --import tsx --test backend/tests/airportAdCampaignRepository.test.ts
```

Expected: failure because the query still contains `LIMIT 6` or purchase still returns `AIRPORT_AD_SLOTS_SOLD_OUT`.

- [ ] **Step 3: Remove the global cap implementation**

Delete `AIRPORT_AD_SLOT_LIMIT`, `CountRow`, `countActiveCampaigns`, and `countActiveCampaignsForUpdate`. Remove `LIMIT ${AIRPORT_AD_SLOT_LIMIT}` from `listActiveDeals`, and remove the count/409 branch from `purchase`.

- [ ] **Step 4: Run the repository test**

```bash
node --import tsx --test backend/tests/airportAdCampaignRepository.test.ts
```

Expected: all repository tests pass, including occupied homepage-slot rejection.

### Task 2: Remove obsolete portal capacity state

**Files:**
- Modify: `shared/airportAds.ts`
- Modify: `backend/src/routes/portalRoutes.ts`
- Modify: `backend/tests/portalRoutes.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Update route tests to the new contract**

Remove `remaining_slots` and `slot_limit` from portal-status fixtures and assertions. Add assertions that the JSON response has neither property while retaining `home_slot_availability`.

- [ ] **Step 2: Remove the fields from server fallbacks and shared types**

`PortalAirportAdStatus` must contain campaign data, prices, homepage availability, warning threshold, and allowed months only. The no-repository fallback in `getPortalAdStatus` must match the same shape.

- [ ] **Step 3: Remove sold-out UI behavior**

Delete both `remaining_slots <= 0` guards, the `soldOut`/`canCreateCampaign` variables, the `剩余 X/6` badge, and the six-slot warning. Replace the section description with:

```tsx
description="购买成功后立即上架，优惠信息不影响 GateRank Score。首页广告位按位置独立计费。"
```

Keep the create button disabled only while the latest status is refreshing.

- [ ] **Step 4: Run portal tests and typecheck**

```bash
node --import tsx --test backend/tests/portalRoutes.test.ts
npm run server:typecheck
```

Expected: route tests pass and TypeScript reports no references to removed fields.

### Task 3: Use the activity title on homepage ads

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/home/HomePageV3.tsx`
- Modify: `backend/src/services/publicPageRenderer.ts`
- Modify: `backend/tests/frontendCrawlableLinks.test.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Add source and SSR regression assertions**

Assert the React homepage card renders `deal.discount_title` and does not use `discount_description` in its description. Assert rendered homepage HTML places the title in the ad description and omits the distinct discount-description fixture text from the homepage card.

- [ ] **Step 2: Run focused tests and confirm failure**

```bash
node --import tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: failure because React and SSR still render `discount_description`.

- [ ] **Step 3: Implement the shared field rule**

Render the homepage description as:

```tsx
{deal.discount_title || '查看官网了解当前优惠活动。'}
```

Use the equivalent escaped `discount_title` expression in SSR. Do not change `src/pages/deals/DealsPage.tsx`, which continues to render `discount_description`.

- [ ] **Step 4: Add the conditional portal helper**

Under the activity-title input, render only when `form.is_homepage` is true:

```tsx
{form.is_homepage ? (
  <p className="mt-2 text-xs font-medium text-cyan-700">显示在首页广告描述中。</p>
) : null}
```

Editing an existing homepage campaign already initializes `form.is_homepage` from its stored placement, so the same condition covers create and edit.

- [ ] **Step 5: Run focused tests and build**

```bash
node --import tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
npm run build
```

Expected: focused tests and production build pass.

### Task 4: Full verification

**Files:**
- Verify only; leave implementation code uncommitted.

- [ ] **Step 1: Run static and backend checks**

```bash
npm run lint
npm run server:typecheck
npm run test:backend
git diff --check
```

- [ ] **Step 2: Rebuild tracked assets**

```bash
npm run build
```

- [ ] **Step 3: Inspect requirement strings and diff**

```bash
rg -n "AIRPORT_AD_SLOT_LIMIT|remaining_slots|slot_limit|AIRPORT_AD_SLOTS_SOLD_OUT|当前 6 个广告位|剩余 .* /" shared src backend --glob '!dist/**'
git diff --stat
```

Expected: no old six-slot capacity implementation remains; homepage position occupancy references remain.
