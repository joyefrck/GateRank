# Admin Marketing Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a two-Tab system-admin marketing module and a campaign-level statistics page that shows every airport ad's validity period, lifetime metrics, and daily metrics using the applicant portal's exact counting rules.

**Architecture:** Extend `AirportAdCampaignRepository` with a paginated admin campaign query and extract the current portal daily aggregation into one internal path shared by portal and admin callers. Wire two authenticated admin endpoints through `adminRoutes`, then add URL-backed filters, a reusable marketing Tab bar, a focused statistics page, and an admin detail dialog without mixing paid-ad reporting into the existing whole-site access analytics page.

**Tech Stack:** TypeScript, Express, React 19, MySQL 8, Node test runner, Vite, Tailwind CSS

**Working-tree constraint:** Core files already contain user-owned, interleaved homepage-ad and applicant-statistics changes. Preserve them. Do not create a branch or commit partially dependent implementation files during execution; verify and hand off the complete scoped diff so the user can choose the final aggregate commit boundary.

---

### Task 1: Shared contract and repository aggregation

**Files:**
- Modify: `shared/airportAds.ts`
- Modify: `backend/src/repositories/airportAdCampaignRepository.ts`
- Test: `backend/tests/airportAdCampaignRepository.test.ts`

- [ ] **Step 1: Add failing repository tests**

Add tests calling:

```ts
await repository.listAdminStats({
  page: 1,
  keyword: 'YH',
  status: 'active',
  placement: 'home_1',
}, new Date('2026-07-31T12:00:00+08:00'));

await repository.getAdminStats({ campaign_id: 101, page: 1 }, now);
```

Fixtures must include an active homepage campaign, an expired ordinary campaign, and a canceled campaign. Assert fixed page size 20, `created_at DESC, id DESC`, airport metadata, validity fields, derived status, filters, campaign-only totals, null-tracking empty data, and identical portal/admin daily results for the same campaign.

- [ ] **Step 2: Run the tests and confirm the new API is missing**

```bash
node --import tsx --test backend/tests/airportAdCampaignRepository.test.ts
```

Expected: FAIL because `listAdminStats` and `getAdminStats` do not exist.

- [ ] **Step 3: Define shared admin types**

Add to `shared/airportAds.ts`:

```ts
export type AdminAirportAdStatusFilter = 'all' | 'active' | 'expired' | 'canceled';
export type AdminAirportAdPlacementFilter = 'all' | 'deal' | `home_${AirportHomeAdSlot}`;
export type AdminAirportAdDerivedStatus = Exclude<AdminAirportAdStatusFilter, 'all'>;

export interface AdminAirportAdStatsListItem {
  campaign_id: number;
  airport_id: number;
  airport_name: string;
  airport_slug: string;
  coupon_code: string;
  home_slot: AirportHomeAdSlot | null;
  starts_at: string;
  ends_at: string;
  purchased_months: number;
  status: AdminAirportAdDerivedStatus;
  tracking_started_on: string | null;
  summary: PortalAirportAdStatsView['summary'];
}
```

Also add a list response with `{ items, pagination: { page, page_size: 20, total, total_pages } }` and an admin detail response that combines list metadata with `PortalAirportAdStatsView`.

- [ ] **Step 4: Extract common daily aggregation**

Keep the existing portal ownership query unchanged, but pass its resolved campaign into a private aggregation method. Add an admin metadata lookup joined to `airports` and pass that resolved campaign into the same method. Preserve Asia/Shanghai boundaries, 30-day reverse pagination, zero filling, event filters, `campaign_id = ?`, and null CTR. Missing admin campaigns return HTTP 404 `AIRPORT_AD_CAMPAIGN_NOT_FOUND`.

- [ ] **Step 5: Implement the admin list without N+1 queries**

Use one count query and one current-page query. Select the filtered 20 campaigns first, join `airports`, then left-join matching `marketing_events` and aggregate impressions/clicks using:

```text
event_type IN ('airport_impression', 'outbound_click')
event_date >= DATE(tracking_started_at)
event_date <= LEAST(DATE(ends_at), current Asia/Shanghai date)
```

Map canceled first, then active when `ends_at > now`, otherwise expired. Search airport name or coupon code; translate `deal` to `home_slot IS NULL` and `home_N` to the numeric slot.

- [ ] **Step 6: Run repository tests**

Run Step 2 again. Expected: all repository tests pass.

### Task 2: Authenticated admin endpoints

**Files:**
- Modify: `backend/src/routes/adminRoutes.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/tests/adminRoutes.test.ts`

- [ ] **Step 1: Add failing route tests**

Test:

```text
GET /marketing/ad-campaigns?page=2&q=YH&status=expired&placement=home_2
GET /marketing/ad-campaigns/101/stats?page=2
```

Assert normalized repository inputs. Add invalid page, status, placement and campaign ID cases plus repository 404 propagation.

- [ ] **Step 2: Run route tests and confirm failure**

```bash
node --import tsx --test backend/tests/adminRoutes.test.ts
```

Expected: FAIL because the routes and dependency contract are absent.

- [ ] **Step 3: Add the narrow dependency and parsers**

Add optional `AdminDeps.airportAdCampaignRepository` methods `listAdminStats` and `getAdminStats`. Parsers default to page 1, status `all`, placement `all`, trim `q`, and reject values outside the shared unions with HTTP 400 `BAD_REQUEST`.

- [ ] **Step 4: Register both routes**

Add beside `/marketing/settings`:

```ts
router.get('/marketing/ad-campaigns', ...);
router.get('/marketing/ad-campaigns/:campaignId/stats', ...);
```

The list has server-fixed page size 20. Detail accepts only `page`; it never trusts client airport/account/application IDs.

- [ ] **Step 5: Wire the existing repository instance**

Pass `airportAdCampaignRepository` from `backend/src/app.ts` into `createAdminRoutes`; do not instantiate another repository.

- [ ] **Step 6: Run route tests**

Run Step 2 again. Expected: all admin route tests pass.

### Task 3: URL state, Tabs, and statistics list

**Files:**
- Create: `src/admin/marketing/marketingStatisticsState.ts`
- Create: `src/admin/marketing/MarketingModuleTabs.tsx`
- Create: `src/admin/marketing/MarketingStatisticsPage.tsx`
- Modify: `src/admin/AdminApp.tsx`
- Create: `backend/tests/adminMarketingStatisticsState.test.ts`
- Modify: `backend/tests/adminMarketingUi.test.ts`

- [ ] **Step 1: Write failing state and source-contract tests**

Test `readAdminMarketingStatisticsQuery` and `buildAdminMarketingStatisticsSearch` with valid, missing, and invalid values. Assert filter changes reset page to 1 and pagination preserves filters. Extend the UI source test to prove there is one sidebar “营销模块”, both marketing routes keep it active, both Tab labels exist, and no second marketing sidebar item appears.

- [ ] **Step 2: Run tests and confirm failure**

```bash
node --import tsx --test \
  backend/tests/adminMarketingStatisticsState.test.ts \
  backend/tests/adminMarketingUi.test.ts
```

Expected: FAIL because helpers, Tabs, and the statistics route are absent.

- [ ] **Step 3: Implement canonical URL helpers**

Normalize to:

```ts
{ page: 1, q: '', status: 'all', placement: 'all' }
```

Serialize only non-default values with `URLSearchParams`. Helpers return values only and never mutate browser history.

- [ ] **Step 4: Add `MarketingModuleTabs`**

Accept `active: 'settings' | 'statistics'` and `onNavigate(path)`. Render two accessible controls with active styling. Use the same component on settings and statistics pages; do not add another sidebar item.

- [ ] **Step 5: Integrate routes and list loading**

Keep `/admin/marketing-settings`; add `/admin/marketing-statistics`. Update the existing nav predicate to match both. `MarketingStatisticsPage` receives `routeSearch`, `onUpdateUrl`, and `apiFetch` through props and calls the list endpoint.

Render search, status, placement, loading, retry, empty state, fixed 20-row pagination, and the agreed columns. Use Beijing dates and show `累计 N 个月`, ordinary/home placement text, three statuses, and `—` for null CTR. Store filters/page in the URL and reset page on filter changes.

- [ ] **Step 6: Run UI/state tests**

Run Step 2 again. Expected: all UI/state tests pass.

### Task 4: Admin daily-statistics dialog

**Files:**
- Modify: `src/admin/marketing/MarketingStatisticsPage.tsx`
- Modify: `backend/tests/adminMarketingUi.test.ts`

- [ ] **Step 1: Add failing dialog assertions**

Assert the page includes the detail endpoint, `每日统计`, airport, placement, coupon, validity, purchased months, `tracking_started_on`, cumulative metrics, daily columns, 30-day pagination, no-exact-data state, and retry.

- [ ] **Step 2: Run the UI test and confirm failure**

```bash
node --import tsx --test backend/tests/adminMarketingUi.test.ts
```

Expected: FAIL because the dialog is incomplete.

- [ ] **Step 3: Implement loading and stable pagination**

Opening a row loads page 1. Keep the last successful cumulative summary while another daily page loads; disable repeated pagination. Closing resets dialog-local state but preserves list URL state.

- [ ] **Step 4: Implement metadata, metrics, rows, and accessibility**

Show airport, placement, coupon, `starts_at`–`ends_at`, months, and precise tracking start. Reuse applicant labels and formatting for the three cards and daily table. Add a labeled close control, `role="dialog"`, `aria-modal="true"`, retry, and explicit `暂无精确访问数据` state.

- [ ] **Step 5: Run the UI test**

Run Step 2 again. Expected: all UI assertions pass.

### Task 5: Cross-surface verification and generated assets

**Files:**
- Verify: `shared/airportAds.ts`
- Verify: `backend/src/repositories/airportAdCampaignRepository.ts`
- Verify: `backend/src/routes/adminRoutes.ts`
- Verify: `backend/src/app.ts`
- Verify: `src/admin/AdminApp.tsx`
- Verify: `src/admin/marketing/`
- Verify: relevant backend tests
- Regenerate: `dist/assets/AdminApp.js` and related Vite assets

- [ ] **Step 1: Run focused regressions**

```bash
node --import tsx --test \
  backend/tests/airportAdCampaignRepository.test.ts \
  backend/tests/portalRoutes.test.ts \
  backend/tests/adminRoutes.test.ts \
  backend/tests/adminMarketingStatisticsState.test.ts \
  backend/tests/adminMarketingUi.test.ts
```

Expected: all pass, including applicant ownership and daily-statistics behavior.

- [ ] **Step 2: Run both type checks**

```bash
npm run lint
npm run server:typecheck
```

Expected: both exit 0. If unrelated baseline failures exist, record exact diagnostics and separately prove no new error references touched files.

- [ ] **Step 3: Build production assets**

```bash
npm run build
```

Expected: Vite exits 0 and regenerates tracked admin assets. Review generated changes only after source verification.

- [ ] **Step 4: Perform browser acceptance with installed Chrome integration**

Verify one sidebar item, Tab refresh/history, URL-backed filters, all three statuses, placement/validity labels, applicant/admin metric parity, and loading/empty/error/retry/pagination states.

- [ ] **Step 5: Audit the final scoped diff**

```bash
git status --short
git diff --check
git diff --stat
git diff -- shared/airportAds.ts backend/src/repositories/airportAdCampaignRepository.ts backend/src/routes/adminRoutes.ts backend/src/app.ts src/admin/AdminApp.tsx src/admin/marketing backend/tests/airportAdCampaignRepository.test.ts backend/tests/adminRoutes.test.ts backend/tests/adminMarketingStatisticsState.test.ts backend/tests/adminMarketingUi.test.ts
```

Expected: no whitespace errors; every change maps to this plan or the pre-existing ad work. Do not stage or commit overlapping implementation files without explicit aggregate-commit instruction.
