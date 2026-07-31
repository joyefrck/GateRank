# Portal Ad Statistics and Renewal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add campaign-level daily impression/click statistics with 30-row pagination and a dedicated renewal flow for active and expired portal ads.

**Architecture:** Existing marketing events gain an optional campaign identifier, while `airport_ad_campaigns.tracking_started_at` defines the exact-data boundary. The campaign repository owns authorized statistics aggregation and transactional renewal; portal routes expose narrow authenticated endpoints, and the existing portal page renders separate statistics and renewal modals.

**Tech Stack:** TypeScript, Express, React, MySQL 8, Node test runner, Vite

---

### Task 1: Campaign-aware marketing events

**Files:**
- Modify: `backend/src/types/domain.ts`
- Modify: `backend/src/utils/marketing.ts`
- Modify: `backend/src/routes/publicRoutes.ts`
- Modify: `backend/src/repositories/marketingEventRepository.ts`
- Modify: `backend/sql/schema.sql`
- Modify: `src/site/marketing.ts`
- Modify: `src/pages/deals/DealsPage.tsx`
- Modify: `src/pages/home/HomePageV3.tsx`
- Test: `backend/tests/publicRoutes.test.ts`
- Test: `backend/tests/marketingEventRepository.test.ts`

- [ ] **Step 1: Write failing request and persistence tests**

Add a `campaign_id: 77` advertising event to `POST /marketing/events` and assert the inserted record preserves it. Add a repository assertion that schema creation/migration includes `campaign_id` plus `idx_marketing_events_campaign_date_type`, and that `insertMany` places the ID between `airport_id` and `placement`.

- [ ] **Step 2: Run tests and confirm the new assertions fail**

Run:

```bash
node --import tsx --test backend/tests/publicRoutes.test.ts backend/tests/marketingEventRepository.test.ts
```

Expected: failure because event payloads and inserts do not yet include `campaign_id`.

- [ ] **Step 3: Implement the event contract and schema migration**

Add `campaign_id?: number | null` to browser/server payloads and `campaign_id: number | null` to insert records. Validate positive integers in `validateMarketingEventPayload`, map the field in `buildMarketingEventRecord`, add the nullable column and index idempotently, and include it in `insertMany`.

- [ ] **Step 4: Attach campaign IDs to ad impressions and clicks**

Extend the browser helpers:

```ts
interface MarketingImpressionOptions {
  campaignId?: number | null;
}

createTrackedOutboundClickHandler({
  campaignId?: number | null;
  // existing fields
})
```

Pass `deal.campaign_id` from homepage sponsored cards and `/deals` cards. Add `useMarketingImpression` to the deals card so both placements collect impressions.

- [ ] **Step 5: Run the focused event tests**

Run the command from Step 2. Expected: all tests pass.

### Task 2: Exact tracking boundary and statistics aggregation

**Files:**
- Modify: `shared/airportAds.ts`
- Modify: `backend/src/repositories/airportAdCampaignRepository.ts`
- Modify: `backend/sql/schema.sql`
- Test: `backend/tests/airportAdCampaignRepository.test.ts`

- [ ] **Step 1: Define shared statistics response types**

Add:

```ts
export interface PortalAirportAdDailyStat {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number | null;
}

export interface PortalAirportAdStatsView {
  campaign_id: number;
  tracking_started_on: string | null;
  summary: { impressions: number; clicks: number; ctr: number | null };
  daily: PortalAirportAdDailyStat[];
  pagination: { page: number; page_size: 30; total: number; total_pages: number };
}
```

- [ ] **Step 2: Write failing repository tests**

Cover ownership rejection, `tracking_started_at = NULL` empty results, a 31-day range split into 30/1 rows, date-descending zero-filled days, campaign-only event filtering, summary totals across all pages, and `ctr: null` when impressions are zero.

- [ ] **Step 3: Run the repository tests and confirm failure**

```bash
node --import tsx --test backend/tests/airportAdCampaignRepository.test.ts
```

Expected: failure because `getPortalStats` and the tracking boundary do not exist.

- [ ] **Step 4: Add schema and model support**

Add nullable `tracking_started_at` to table creation, idempotent migration, campaign selects, and portal campaign views. New purchases set it to `starts_at`. Migration initializes it only for currently active, non-expired campaigns.

- [ ] **Step 5: Implement `getPortalStats`**

Use a campaign ownership query with `airport_id`, `applicant_account_id`, and `application_id`. Query summary and the requested date window with `campaign_id = ?` and event types `airport_impression`/`outbound_click`; generate the 30-day page in TypeScript using Asia/Shanghai dates and zero-fill missing dates.

- [ ] **Step 6: Run the repository tests**

Run the command from Step 3. Expected: all tests pass.

### Task 3: Authenticated statistics endpoint

**Files:**
- Modify: `backend/src/routes/portalRoutes.ts`
- Test: `backend/tests/portalRoutes.test.ts`

- [ ] **Step 1: Write failing endpoint tests**

Test `GET /portal/ad-campaign/99/stats?page=2`, asserting the route passes campaign/account/application/airport ownership and page to the repository. Add invalid campaign ID and invalid page cases returning HTTP 400.

- [ ] **Step 2: Run the route tests and confirm failure**

```bash
node --import tsx --test backend/tests/portalRoutes.test.ts
```

Expected: 404 for the missing route.

- [ ] **Step 3: Implement the endpoint**

Resolve the authenticated account and approved airport exactly as other ad routes do, require a positive `campaignId` and `page`, then call `getPortalStats({ campaign_id, airport_id, applicant_account_id, application_id, page })`.

- [ ] **Step 4: Run the route tests**

Run the command from Step 2. Expected: all tests pass.

### Task 4: Dedicated active and expired renewal transaction

**Files:**
- Modify: `backend/src/repositories/airportAdCampaignRepository.ts`
- Modify: `backend/src/routes/portalRoutes.ts`
- Test: `backend/tests/airportAdCampaignRepository.test.ts`
- Test: `backend/tests/portalRoutes.test.ts`

- [ ] **Step 1: Write failing repository renewal tests**

Add cases proving active campaigns extend from `ends_at`, expired campaigns restart from `now` and set `starts_at`, canceled campaigns return `AIRPORT_AD_CAMPAIGN_NOT_RENEWABLE`, current placement price is charged, occupied homepage slots roll back, and renewal initializes `tracking_started_at` only when it was previously null.

- [ ] **Step 2: Run the repository test and confirm failure**

```bash
node --import tsx --test backend/tests/airportAdCampaignRepository.test.ts
```

Expected: expired renewal fails because the current editable query requires `ends_at > now`.

- [ ] **Step 3: Split content editing from renewal**

Keep `PATCH /portal/ad-campaign/:campaignId` for active content edits with `extend_months: 0`. Add repository method:

```ts
renew(input: {
  campaign_id: number;
  airport_id: number;
  applicant_account_id: number;
  application_id: number;
  months: AirportAdMonthOption;
  monthly_price: number;
}, now?: Date): Promise<AirportDealView>
```

Lock the campaign regardless of expiry but require database `status = 'active'`. Recheck homepage occupancy, lock the wallet, charge once, update dates/months/amount/tracking boundary, and write one transaction.

- [ ] **Step 4: Add failing and passing route tests**

Add `POST /portal/ad-campaign/:campaignId/renew` with `{ months }`. The route loads current campaign placement from portal status, resolves the current configured price, and calls `renew`. Test ordinary and homepage pricing plus missing/invalid/canceled campaign responses.

- [ ] **Step 5: Run both focused suites**

```bash
node --import tsx --test backend/tests/airportAdCampaignRepository.test.ts backend/tests/portalRoutes.test.ts
```

Expected: all tests pass.

### Task 5: Portal statistics and renewal modals

**Files:**
- Create: `src/portal/adCampaignUi.ts`
- Create: `src/portal/adCampaignUi.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing pure UI helper tests**

Test current placement price resolution, active renewal date calculation from `ends_at`, expired renewal date calculation from `now`, and pagination labels. Keep timezone-sensitive date computation in a pure helper with injected `now`.

- [ ] **Step 2: Run and confirm failure**

```bash
node --import tsx --test src/portal/adCampaignUi.test.ts
```

Expected: module not found before implementation.

- [ ] **Step 3: Implement pure helpers and types**

Export `getCampaignMonthlyPrice`, `getRenewalBaseDate`, `getRenewalEndsAt`, and `getPaginationItems`; reuse the shared stats contract.

- [ ] **Step 4: Add portal state and request handlers**

Add independent selected-campaign state for stats and renewal, per-modal loading/error/submitting states, stats page state, `GET .../stats?page=N`, and `POST .../renew` handlers. On renewal success refresh `/portal/me` and campaign status, then close the renewal modal.

- [ ] **Step 5: Render the list actions and modals**

Add a “访问统计” column. All rows show “查看统计”; active rows show “修改 / 延期 / 下架”, expired rows show “延期”, and canceled rows show neither renewal nor edit. Render three summary cards plus 30-row daily table/pagination, and a renewal confirmation modal containing price, month, end-date, charge, and expected balance.

- [ ] **Step 6: Run helper tests and typecheck**

```bash
node --import tsx --test src/portal/adCampaignUi.test.ts
npm run lint
```

Expected: helper tests pass and TypeScript reports no new feature errors.

### Task 6: Integrated verification and generated bundle

**Files:**
- Modify: `dist/assets/index.js`
- Modify: `dist/assets/index.css`

- [ ] **Step 1: Run all focused regressions**

```bash
node --import tsx --test \
  backend/tests/publicRoutes.test.ts \
  backend/tests/marketingEventRepository.test.ts \
  backend/tests/airportAdCampaignRepository.test.ts \
  backend/tests/portalRoutes.test.ts \
  src/portal/adCampaignUi.test.ts
```

Expected: zero failures.

- [ ] **Step 2: Run typecheck**

```bash
npm run lint
```

Expected: exit 0, or report pre-existing unrelated diagnostics separately after proving no touched-file diagnostics remain.

- [ ] **Step 3: Build the production frontend**

```bash
npm run build
```

Expected: exit 0 and refreshed production assets.

- [ ] **Step 4: Re-run focused tests after the build**

Run the command from Step 1 again. Expected: zero failures.

- [ ] **Step 5: Review the final diff against the design**

Confirm exact campaign attribution, no historical guessing, 30-row date-descending pagination, separate renewal UI, active/expired/canceled rules, current prices, transactional rollback, and preservation of unrelated dirty changes.
