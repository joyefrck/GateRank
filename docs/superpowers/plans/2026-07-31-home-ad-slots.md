# GateRank Home Ad Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional, independently priced homepage positions 1–4 to the existing airport promotion purchase flow.

**Architecture:** Extend the existing marketing JSON configuration with four position prices and extend `airport_ad_campaigns` with nullable `home_slot`. The server remains authoritative for price and occupancy; portal and admin pages consume the expanded shared contract, while the homepage only reads campaigns with an active homepage position.

**Tech Stack:** TypeScript, React, Express, MySQL, Node test runner, Vite.

---

### Task 1: Shared contract and marketing pricing

**Files:**
- Modify: `shared/airportAds.ts`
- Modify: `backend/src/services/marketingSettingsService.ts`
- Modify: `backend/src/routes/adminRoutes.ts`
- Modify: `backend/tests/marketingSettingsService.test.ts`
- Modify: `backend/tests/adminRoutes.test.ts`

- [ ] **Step 1: Add failing tests for default, stored and updated position prices**

Assert that old configuration falls back to the ordinary monthly price and that `{1,2,3,4}` can be saved independently.

- [ ] **Step 2: Run focused tests and confirm the new assertions fail**

Run:

```bash
node --import tsx --test backend/tests/marketingSettingsService.test.ts backend/tests/adminRoutes.test.ts
```

Expected: failures because `home_ad_slot_monthly_prices` is absent.

- [ ] **Step 3: Add the shared position types and defaults**

```ts
export const AIRPORT_HOME_AD_SLOTS = [1, 2, 3, 4] as const;
export type AirportHomeAdSlot = (typeof AIRPORT_HOME_AD_SLOTS)[number];
export type AirportHomeAdSlotPrices = Record<AirportHomeAdSlot, number>;
```

Add `home_ad_slot_monthly_prices` to marketing input, view and billing configuration. Normalize every position with the ordinary ad price as its legacy fallback.

- [ ] **Step 4: Parse the new admin payload**

Accept only keys `1`–`4`, require positive finite numbers, and preserve omitted values.

- [ ] **Step 5: Run focused tests**

Expected: all marketing and admin settings tests pass.

### Task 2: Campaign persistence, billing and occupancy

**Files:**
- Modify: `backend/src/repositories/airportAdCampaignRepository.ts`
- Modify: `backend/tests/airportAdCampaignRepository.test.ts`

- [ ] **Step 1: Add failing repository tests**

Cover ordinary purchase with `home_slot = null`, homepage purchase with a selected slot, occupied-slot rejection, slot release after cancellation/expiry and renewal conflict.

- [ ] **Step 2: Run repository tests and confirm failure**

```bash
node --import tsx --test backend/tests/airportAdCampaignRepository.test.ts
```

- [ ] **Step 3: Add nullable storage**

Add `home_slot TINYINT UNSIGNED NULL` to the create-table statement and an idempotent information-schema migration for existing installations. Include `home_slot` in all campaign selects and inserts.

- [ ] **Step 4: Add transactional occupancy validation**

For a homepage purchase, lock active campaigns and reject another active record with the same slot using HTTP 409 `AIRPORT_HOME_AD_SLOT_OCCUPIED`. Keep the existing global six-campaign limit.

- [ ] **Step 5: Make renewal position-aware**

Load `home_slot` in the locked campaign row. The route supplies the price for the existing slot; the repository rechecks that a renewed expired campaign does not collide with another active occupant.

- [ ] **Step 6: Run repository tests**

Expected: all repository tests pass.

### Task 3: Portal API and server-authoritative prices

**Files:**
- Modify: `backend/src/routes/portalRoutes.ts`
- Modify: `backend/tests/portalRoutes.test.ts`

- [ ] **Step 1: Add failing route tests**

Test status price/availability output, default ordinary purchase, required homepage position, per-position price replacement, occupied response and position-aware renewal.

- [ ] **Step 2: Run portal tests and confirm failure**

```bash
node --import tsx --test backend/tests/portalRoutes.test.ts
```

- [ ] **Step 3: Resolve purchase price from server configuration**

Parse:

```ts
is_homepage: boolean;
home_slot: AirportHomeAdSlot | null;
```

When homepage is false, pass `home_slot: null` and `airport_ad_monthly_price`. When true, require a valid slot and pass `home_ad_slot_monthly_prices[home_slot]`. Never parse a request price.

- [ ] **Step 4: Resolve renewal price from the stored campaign position**

Use the locked campaign’s `home_slot` and current marketing settings; content-only edits do not change placement.

- [ ] **Step 5: Return availability and prices**

Include all four prices and an availability record in `PortalAirportAdStatus`.

- [ ] **Step 6: Run portal tests**

Expected: all portal route tests pass.

### Task 4: Admin pricing interface

**Files:**
- Modify: `src/admin/AdminApp.tsx`

- [ ] **Step 1: Extend admin view and form types**

Add four string inputs in form state and map them to/from the server response.

- [ ] **Step 2: Add the four-input pricing card**

Keep the ordinary monthly price field and label it “普通优惠活动月费（元）”. Add a card titled “首页广告位月费（元）” with fields “首页 1 号位” through “首页 4 号位”.

- [ ] **Step 3: Update the summary**

Show the ordinary price and compact `首页 1–4：¥…` values without changing the existing admin layout system.

- [ ] **Step 4: Run typecheck and build**

```bash
npm run server:typecheck
npm run build
```

Expected: no TypeScript or build errors.

### Task 5: Portal purchase interface

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Extend purchase form state**

Add `is_homepage: false` and `home_slot: null` defaults. Editing retains stored placement but does not expose placement controls.

- [ ] **Step 2: Add optional homepage controls**

Add a default-off switch/choice. When enabled, render four position cards with monthly price and occupancy; disabled positions show “投放中”.

- [ ] **Step 3: Calculate the preview price**

Use ordinary price when homepage is off and the selected slot price when on. Multiply by the selected month count and show the complete formula.

- [ ] **Step 4: Submit placement fields**

Send `is_homepage` and `home_slot` for new purchases. Keep PATCH placement immutable.

- [ ] **Step 5: Label campaign placement**

Show “普通优惠活动” or “首页 N 号位” in the campaign list and use the corresponding current price for renewal warnings.

- [ ] **Step 6: Run lint and build**

Expected: both commands pass.

### Task 6: Homepage aggregation and fixed-position rendering

**Files:**
- Modify: `backend/src/repositories/airportAdCampaignRepository.ts`
- Modify: `backend/src/services/publicViewService.ts`
- Modify: `backend/src/services/publicPageRenderer.ts`
- Modify: `backend/src/types/domain.ts`
- Modify: `src/pages/home/HomePageV3.tsx`
- Modify: `backend/tests/publicViewService.test.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Add failing homepage tests**

Assert that ordinary campaigns are excluded, homepage campaigns sort by slot, gaps remain gaps and SSR includes only purchased homepage placements.

- [ ] **Step 2: Add the active homepage query**

Filter `home_slot IS NOT NULL`, active dates, listed airports and non-down status; order by `home_slot ASC`.

- [ ] **Step 3: Preserve position in the home view**

Add `home_slot` to `HomeSponsoredDealView`. Build a four-slot map rather than slicing arbitrary active deals.

- [ ] **Step 4: Render fixed slots**

React and SSR render positions 1–4. Missing positions use the established empty card; later positions never shift left.

- [ ] **Step 5: Run homepage tests**

Expected: focused public view and route tests pass.

### Task 7: Full verification

**Files:**
- Verify only; do not commit, push or deploy.

- [ ] **Step 1: Run static checks**

```bash
npm run lint
npm run server:typecheck
git diff --check
```

- [ ] **Step 2: Run backend regression**

```bash
npm run test:backend
```

- [ ] **Step 3: Build production assets**

```bash
npm run build
```

- [ ] **Step 4: Browser acceptance**

Verify admin four-price editing, default ordinary purchase, homepage position selection/price, occupied position state, fixed homepage ordering and direct external official-site links in the local runtime.

- [ ] **Step 5: Report only local results**

Summarize modified files, tests and any pre-existing unrelated failures. Leave all changes unstaged and uncommitted.
