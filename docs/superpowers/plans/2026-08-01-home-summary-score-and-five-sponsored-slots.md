# Home Summary Score and Five Sponsored Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render plain right-aligned homepage summary scores and expand the commercial homepage placement system from four independently priced slots to five.

**Architecture:** Treat `shared/airportAds.ts` as the source of truth for valid homepage slots, then propagate slot 5 through marketing settings, repository availability and billing, applicant/admin UI, public view assembly, and both homepage renderers. Keep existing records compatible by filling a missing slot-5 price from the ordinary ad monthly price, and verify React/SSR parity with focused source and rendered-HTML tests.

**Tech Stack:** React 19, TypeScript 5.8, Tailwind CSS 4, Express, MySQL repository layer, Node `node:test`, Vite.

---

## File map

- `shared/airportAds.ts`: canonical list and derived types for homepage advertising positions.
- `backend/src/services/marketingSettingsService.ts`: persisted admin price defaults, normalization, and compatibility fallback.
- `backend/src/repositories/airportAdCampaignRepository.ts`: slot availability, position validation, active homepage query limit, and campaign billing inputs.
- `backend/src/routes/portalRoutes.ts`: applicant API position validation and legacy fallback configuration.
- `backend/src/routes/adminRoutes.ts`: admin dependency type for marketing settings.
- `backend/src/types/domain.ts`: public homepage sponsored-item position type.
- `src/admin/AdminApp.tsx`: admin slot-price fields and summary copy.
- `src/App.tsx`: applicant slot chooser and client-side validation.
- `src/portal/adCampaignUi.ts`: position-price lookup shared by applicant campaign UI.
- `backend/src/services/publicViewService.ts`: five-slot sponsored item assembly and `display_limit`.
- `src/pages/home/HomePageV3.tsx`: React five-card layout, vertical actions, and plain summary scores.
- `backend/src/services/publicPageRenderer.ts`: SSR five-card layout, vertical actions, and plain summary scores.
- `backend/tests/marketingSettingsService.test.ts`: defaults, old-record compatibility, updates, and invalid slot-5 price.
- `backend/tests/airportAdCampaignRepository.test.ts`: five-slot defaults, availability, active query limit, and validation.
- `backend/tests/portalRoutes.test.ts`: slot-5 purchase/renew price and fallback response.
- `backend/tests/adminRoutes.test.ts`: admin settings API accepts and returns slot-5 price.
- `backend/tests/publicViewService.test.ts`: five homepage sponsored items in position order.
- `backend/tests/publicPageRoutes.test.ts`: SSR five-card and summary score output.
- `backend/tests/frontendCrawlableLinks.test.ts`: React source assertions for five columns, vertical buttons, and plain score treatment.
- `src/portal/adCampaignUi.test.ts`: slot-5 price selection.

### Task 1: Establish slot 5 in the shared contract and marketing settings

**Files:**
- Modify: `shared/airportAds.ts`
- Modify: `backend/src/services/marketingSettingsService.ts`
- Modify: `backend/src/routes/adminRoutes.ts`
- Modify: `backend/tests/marketingSettingsService.test.ts`
- Modify: `backend/tests/adminRoutes.test.ts`

- [ ] **Step 1: Add failing expectations for five default prices and old-record fallback**

Update the expected maps in `backend/tests/marketingSettingsService.test.ts` and add a focused legacy test:

```ts
assert.deepEqual(createDefaultHomeAdSlotMonthlyPrices(), {
  1: 1000,
  2: 1000,
  3: 1000,
  4: 1000,
  5: 1000,
});

test('MarketingSettingsService fills a missing fifth homepage slot from ordinary ad price', async () => {
  const { repository } = createSettingsRepository({
    marketing_billing: {
      airport_ad_monthly_price: 1288.88,
      home_ad_slot_monthly_prices: { 1: 1600, 2: 1500, 3: 1400, 4: 1300 },
    },
  });
  const view = await new MarketingSettingsService({ systemSettingRepository: repository }).getAdminSettings();
  assert.deepEqual(view.home_ad_slot_monthly_prices, {
    1: 1600,
    2: 1500,
    3: 1400,
    4: 1300,
    5: 1288.88,
  });
});
```

Extend the save/partial-update cases with a distinct slot-5 value and add `{ 5: 0 }` to invalid-price coverage. Update the admin route mocks and assertions to include `5: 1088`.

- [ ] **Step 2: Run the focused tests and confirm the red state**

Run:

```bash
npx tsx --test backend/tests/marketingSettingsService.test.ts backend/tests/adminRoutes.test.ts
```

Expected: FAIL because the returned price maps do not contain key `5`, and the admin route type/mocks still describe four positions.

- [ ] **Step 3: Expand the canonical slot list and derive five-price defaults**

In `shared/airportAds.ts`:

```ts
export const AIRPORT_HOME_AD_SLOTS = [1, 2, 3, 4, 5] as const;
```

In `backend/src/services/marketingSettingsService.ts`, replace the literal default map with:

```ts
export function createDefaultHomeAdSlotMonthlyPrices(
  fallback = DEFAULT_AIRPORT_AD_MONTHLY_PRICE,
): AirportHomeAdSlotPrices {
  return Object.fromEntries(
    AIRPORT_HOME_AD_SLOTS.map((slot) => [slot, fallback]),
  ) as AirportHomeAdSlotPrices;
}
```

The existing `normalizeHomeAdSlotMonthlyPrices()` loop then fills missing slot 5 from `defaults[5]` while preserving stored slots 1–4.

In `backend/src/routes/adminRoutes.ts`, import `AirportHomeAdSlotPrices` from `shared/airportAds` and replace the manual `Record<1 | 2 | 3 | 4, number>` dependency type with `AirportHomeAdSlotPrices`.

- [ ] **Step 4: Run the focused tests and confirm green**

Run:

```bash
npx tsx --test backend/tests/marketingSettingsService.test.ts backend/tests/adminRoutes.test.ts
```

Expected: all tests pass with five-key maps and old four-key stored settings normalized to a five-key view.

- [ ] **Step 5: Commit the shared contract and settings change**

```bash
git add shared/airportAds.ts backend/src/services/marketingSettingsService.ts backend/src/routes/adminRoutes.ts backend/tests/marketingSettingsService.test.ts backend/tests/adminRoutes.test.ts
git commit -m "feat: add fifth homepage ad price"
```

### Task 2: Extend repository availability, validation, purchase, and renewal to slot 5

**Files:**
- Modify: `backend/src/repositories/airportAdCampaignRepository.ts`
- Modify: `backend/src/routes/portalRoutes.ts`
- Modify: `backend/tests/airportAdCampaignRepository.test.ts`
- Modify: `backend/tests/portalRoutes.test.ts`
- Modify: `src/portal/adCampaignUi.test.ts`

- [ ] **Step 1: Write failing repository and route assertions for slot 5**

Update repository defaults to expect:

```ts
assert.deepEqual(status.home_slot_monthly_prices, {
  1: 1288.88,
  2: 1288.88,
  3: 1288.88,
  4: 1288.88,
  5: 1288.88,
});
assert.deepEqual(status.home_slot_availability, {
  1: true,
  2: true,
  3: true,
  4: true,
  5: true,
});
```

Add or adapt portal route purchase/renew cases so a campaign with `home_slot: 5` uses a configured `home_ad_slot_monthly_prices[5]` value. Extend `src/portal/adCampaignUi.test.ts` with:

```ts
assert.equal(
  getCampaignMonthlyPrice(
    { ...status, home_slot_monthly_prices: { ...status.home_slot_monthly_prices, 5: 2600 } },
    campaign({ home_slot: 5, is_homepage: true }),
  ),
  2600,
);
```

- [ ] **Step 2: Run the focused tests and confirm the red state**

Run:

```bash
npx tsx --test backend/tests/airportAdCampaignRepository.test.ts backend/tests/portalRoutes.test.ts src/portal/adCampaignUi.test.ts
```

Expected: FAIL because repository and portal fallback maps omit position 5 and the old validation message/range rejects it in at least one code path.

- [ ] **Step 3: Generate defaults and availability from the shared list**

In `backend/src/repositories/airportAdCampaignRepository.ts`, replace four-key map builders with shared-list construction:

```ts
function createDefaultHomeSlotPrices(fallback: unknown): AirportHomeAdSlotPrices {
  const monthlyPrice = normalizeMonthlyPrice(fallback);
  return Object.fromEntries(
    AIRPORT_HOME_AD_SLOTS.map((slot) => [slot, monthlyPrice]),
  ) as AirportHomeAdSlotPrices;
}

function normalizeHomeSlotPrices(
  value: Partial<AirportHomeAdSlotPrices> | null | undefined,
  fallback: unknown,
): AirportHomeAdSlotPrices {
  const defaults = createDefaultHomeSlotPrices(fallback);
  return Object.fromEntries(
    AIRPORT_HOME_AD_SLOTS.map((slot) => [
      slot,
      normalizeMonthlyPrice(value?.[slot] ?? defaults[slot]),
    ]),
  ) as AirportHomeAdSlotPrices;
}
```

Build `home_slot_availability` with `AIRPORT_HOME_AD_SLOTS.map(...)`, retain `isAirportHomeAdSlot()` as the validation predicate, and change its user-facing error to `请选择首页 1–5 号位`. The existing `LIMIT ${AIRPORT_HOME_AD_SLOTS.length}` automatically becomes 5.

In `backend/src/routes/portalRoutes.ts`, generate default price and availability maps from `AIRPORT_HOME_AD_SLOTS`; update `mustHomeAdSlot()` to report `1–5` while retaining the shared membership check.

- [ ] **Step 4: Verify purchase and renewal use the fifth configured amount**

Run:

```bash
npx tsx --test backend/tests/airportAdCampaignRepository.test.ts backend/tests/portalRoutes.test.ts src/portal/adCampaignUi.test.ts
```

Expected: all tests pass; slot 5 is selectable, independently priced, and still protected by the occupied-slot conflict check.

- [ ] **Step 5: Commit repository and applicant API support**

```bash
git add backend/src/repositories/airportAdCampaignRepository.ts backend/src/routes/portalRoutes.ts backend/tests/airportAdCampaignRepository.test.ts backend/tests/portalRoutes.test.ts src/portal/adCampaignUi.test.ts
git commit -m "feat: support fifth homepage ad placement"
```

### Task 3: Expose the fifth price in admin and applicant interfaces

**Files:**
- Modify: `src/admin/AdminApp.tsx`
- Modify: `src/App.tsx`
- Modify: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Add failing source assertions for both interfaces**

In `backend/tests/frontendCrawlableLinks.test.ts`, add source-level assertions that:

```ts
assert.match(adminSource, /AIRPORT_HOME_AD_SLOTS\.map\(String\)/);
assert.match(adminSource, /首页 1–5：/);
assert.match(portalSource, /AIRPORT_HOME_AD_SLOTS\.map\(\(slot\) =>/);
assert.match(portalSource, /请选择首页 1–5 号位/);
```

Keep the assertions scoped to `AdminApp.tsx` and `App.tsx` so unrelated four-column layouts do not cause false positives.

- [ ] **Step 2: Run the source test and confirm the red state**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: FAIL because the admin and applicant interfaces still enumerate positions 1–4.

- [ ] **Step 3: Derive admin form keys from the shared slot list**

In `src/admin/AdminApp.tsx`, import `AIRPORT_HOME_AD_SLOTS` and `AirportHomeAdSlot`, then define:

```ts
type MarketingHomeAdSlot = `${AirportHomeAdSlot}`;
const marketingHomeAdSlots = AIRPORT_HOME_AD_SLOTS.map(String) as MarketingHomeAdSlot[];
const defaultHomeAdSlotMonthlyPriceForm = Object.fromEntries(
  marketingHomeAdSlots.map((slot) => [slot, '1000']),
) as Record<MarketingHomeAdSlot, string>;
```

Keep the existing mapped input controls and change the summary label from `首页 1–4` to `首页 1–5`. Use a responsive five-column maximum for this setting group:

```tsx
<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
```

- [ ] **Step 4: Derive applicant choices from the shared slot list**

In `src/App.tsx`, import `AIRPORT_HOME_AD_SLOTS` next to `AirportHomeAdSlot`, then make this exact iterator replacement while preserving the current availability, price, and button body inside it:

```diff
- {([1, 2, 3, 4] as AirportHomeAdSlot[]).map((slot) => {
+ {AIRPORT_HOME_AD_SLOTS.map((slot) => {
```

Change the chooser grid to `sm:grid-cols-3 lg:grid-cols-5` and client validation copy to `请选择首页 1–5 号位`.

- [ ] **Step 5: Run the source regression test**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: all tests pass and the source contains no homepage-ad literal position list.

- [ ] **Step 6: Commit both interfaces**

```bash
git add src/admin/AdminApp.tsx src/App.tsx backend/tests/frontendCrawlableLinks.test.ts
git commit -m "feat: expose fifth homepage ad slot"
```

### Task 4: Return five sponsored deals from the public view

**Files:**
- Modify: `backend/src/types/domain.ts`
- Modify: `backend/src/services/publicViewService.ts`
- Modify: `backend/tests/publicViewService.test.ts`

- [ ] **Step 1: Expand the public-view fixture and expectations to five positions**

In `backend/tests/publicViewService.test.ts`, build five active home deals and assert:

```ts
assert.equal(result.sponsored_deals!.total, 5);
assert.equal(result.sponsored_deals!.display_limit, 5);
assert.equal(result.sponsored_deals!.items.length, 5);
assert.deepEqual(
  result.sponsored_deals!.items.map((item) => item.home_slot),
  [1, 2, 3, 4, 5],
);
```

- [ ] **Step 2: Run the service test and confirm the red state**

Run:

```bash
npx tsx --test backend/tests/publicViewService.test.ts
```

Expected: FAIL because `HOME_SPONSORED_DEAL_LIMIT` and the service filters are fixed at 4.

- [ ] **Step 3: Use the shared position type and limit in public data assembly**

In `backend/src/types/domain.ts`, import `AirportHomeAdSlot` and change:

```ts
home_slot: AirportHomeAdSlot;
```

In `backend/src/services/publicViewService.ts`, import `AIRPORT_HOME_AD_SLOTS`, `AirportHomeAdSlot`, and replace the limit and membership logic:

```ts
const HOME_SPONSORED_DEAL_LIMIT = AIRPORT_HOME_AD_SLOTS.length;

if (!(AIRPORT_HOME_AD_SLOTS as readonly number[]).includes(homeSlot)) {
  return null;
}

home_slot: homeSlot as AirportHomeAdSlot,
```

Use the same shared membership expression in `loadActiveHomeDeals()` and retain the final sort by `home_slot`.

- [ ] **Step 4: Run the public-view test and confirm green**

Run:

```bash
npx tsx --test backend/tests/publicViewService.test.ts
```

Expected: all tests pass with five ordered sponsored items and `display_limit: 5`.

- [ ] **Step 5: Commit the public data change**

```bash
git add backend/src/types/domain.ts backend/src/services/publicViewService.ts backend/tests/publicViewService.test.ts
git commit -m "feat: return five homepage sponsored deals"
```

### Task 5: Implement the React five-card layout and plain summary scores

**Files:**
- Modify: `src/pages/home/HomePageV3.tsx`
- Modify: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Add failing React source assertions**

Scope the checks to the relevant component slices:

```ts
assert.match(sponsoredDealsSource, /AIRPORT_HOME_AD_SLOTS\.map\(\(slot\) =>/);
assert.match(sponsoredDealsSource, /lg:grid-cols-5/);
assert.match(sponsoredCardSource, /flex flex-col[^"\n]*gap-1\.5/);
assert.doesNotMatch(summaryBoardItemSource, /<Star className=/);
assert.doesNotMatch(summaryBoardItemSource, /bg-amber-50|border-amber-200/);
assert.match(summaryBoardItemSource, /ml-auto shrink-0 text-right font-mono/);
```

- [ ] **Step 2: Run the frontend source test and confirm the red state**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: FAIL because the card grid is four columns, the buttons are side by side, and summary scores use the yellow star badge.

- [ ] **Step 3: Render five shared slots and compact the cards**

Import `AIRPORT_HOME_AD_SLOTS` and `AirportHomeAdSlot` in `HomePageV3.tsx`, use `AirportHomeAdSlot` for `SponsoredDeal.home_slot`, and render:

```tsx
<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
  {AIRPORT_HOME_AD_SLOTS.map((slot) => {
    const deal = dealsBySlot.get(slot);
    return deal
      ? <SponsoredDealCard key={deal.campaign_id} deal={deal} />
      : <SponsoredEmptySlot key={`empty-deal-${slot}`} slot={slot} />;
  })}
</div>
```

Reduce card padding from `p-[18px]` to `p-4`, reduce large internal gaps by one Tailwind step, and replace the action row with:

```tsx
<div className="flex flex-col gap-1.5 pt-0.5">
  <RouteLink href={deal.report_url} className="flex w-full items-center justify-center ...">
    查看报告 <span className="text-[10px]">&gt;</span>
  </RouteLink>
  <a href={websiteHref} className="flex w-full items-center justify-center ...">
    官网 <ExternalLink className="h-3 w-3 text-gray-400" />
  </a>
</div>
```

Preserve all existing tracking handler arguments and link security attributes.

- [ ] **Step 4: Replace the normal summary score badge with plain text**

Keep the risk branch unchanged and replace only the ordinary branch with:

```tsx
<span className="ml-auto shrink-0 text-right font-mono text-[12px] font-extrabold text-gray-700">
  {scoreLabel(item.score, item.score_hidden)}
</span>
```

Do not remove the `Star` import because the full ranking table still uses it.

- [ ] **Step 5: Run the focused React source regression test**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: all tests pass; the ordinary summary score component has no star/amber badge, and the sponsored card retains tracking and secure external-link attributes.

- [ ] **Step 6: Commit the React layout**

```bash
git add src/pages/home/HomePageV3.tsx backend/tests/frontendCrawlableLinks.test.ts
git commit -m "feat: simplify homepage scores and cards"
```

### Task 6: Match SSR to the React homepage design

**Files:**
- Modify: `backend/src/services/publicPageRenderer.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Add failing rendered-HTML assertions**

In the homepage branch of `backend/tests/publicPageRoutes.test.ts`, assert five deal articles and vertical actions:

```ts
assert.equal((html.match(/<article class="home-v3-deal(?: |")/g) || []).length, 5);
assert.match(html, /首页 5 号广告位招募中/);
assert.match(html, /class="home-v3-deal-actions"[\s\S]*查看测评报告[\s\S]*官网/);
assert.match(html, /\.home-v3-deal-grid\s*\{[^}]*grid-template-columns:\s*repeat\(5,minmax\(0,1fr\)\)/);
assert.match(html, /\.home-v3-summary-grid li strong\s*\{[^}]*text-align:\s*right/);
assert.doesNotMatch(html, /home-v3-summary-score[^>]*(?:background|amber)/);
```

- [ ] **Step 2: Run the SSR route test and confirm the red state**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: FAIL because SSR renders four cards and does not yet expose the stacked action wrapper or explicit score alignment.

- [ ] **Step 3: Render all five shared positions**

Import `AIRPORT_HOME_AD_SLOTS` in `publicPageRenderer.ts` and make this exact iterator replacement without changing the existing populated/empty branch in this step:

```diff
- ${([1, 2, 3, 4] as const).map((slot) => {
+ ${AIRPORT_HOME_AD_SLOTS.map((slot) => {
```

- [ ] **Step 4: Stack SSR actions and align summary scores**

Replace the website icon/report-link split with an explicit action group:

```html
<div class="home-v3-deal-actions">
  <a class="home-v3-report-link" href="...">查看测评报告</a>
  <a class="home-v3-website-link" href="..." target="_blank" rel="nofollow sponsored noopener noreferrer">官网 ↗</a>
</div>
```

Update the inline CSS:

```css
.home-v3-deal-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; }
.home-v3-deal-actions { display:grid; gap:6px; margin-top:8px; }
.home-v3-deal-actions a { display:flex; min-height:32px; align-items:center; justify-content:center; border-radius:9px; font-size:10px; font-weight:900; text-decoration:none; }
.home-v3-report-link { background:#171717; color:#fff; }
.home-v3-website-link { border:1px solid #e5e5e5; background:#fff; color:#404040; }
.home-v3-summary-grid li strong { color:#404040; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; text-align:right; }
```

Retain the existing two-column breakpoint at 900 px and single-column breakpoint at 600 px.

- [ ] **Step 5: Run the SSR route test and confirm green**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: all tests pass with five SSR cards, an empty fifth placeholder when appropriate, vertically ordered actions, and right-aligned plain summary scores.

- [ ] **Step 6: Commit SSR parity**

```bash
git add backend/src/services/publicPageRenderer.ts backend/tests/publicPageRoutes.test.ts
git commit -m "feat: align SSR five-card homepage layout"
```

### Task 7: Run complete verification and inspect the rendered homepage

**Files:**
- Verify only; modify focused tests or implementation files only if a failure reveals an in-scope defect.

- [ ] **Step 1: Run all focused regression suites together**

Run:

```bash
npx tsx --test \
  backend/tests/marketingSettingsService.test.ts \
  backend/tests/airportAdCampaignRepository.test.ts \
  backend/tests/portalRoutes.test.ts \
  backend/tests/adminRoutes.test.ts \
  backend/tests/publicViewService.test.ts \
  backend/tests/publicPageRoutes.test.ts \
  backend/tests/frontendCrawlableLinks.test.ts \
  src/portal/adCampaignUi.test.ts
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 2: Run type checks, lint alias, and production build**

Run:

```bash
npm run server:typecheck
npm run lint
npm run build
```

Expected: each command exits 0. `npm run lint` is the repository frontend TypeScript check.

- [ ] **Step 3: Run the complete backend suite**

Run:

```bash
npm run test:backend
```

Expected: zero failed tests. If unrelated pre-existing failures occur, record their exact names separately and re-run all focused suites to preserve in-scope evidence.

- [ ] **Step 4: Verify whitespace and final diff scope**

Run:

```bash
git diff --check 727f5510^..HEAD
git status --short --branch
git diff --stat 727f5510^..HEAD
```

Expected: no whitespace errors; only the planned homepage, advertising, admin/applicant UI, test, spec, and plan files are changed.

- [ ] **Step 5: Validate the existing local services before visual inspection**

Run:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:8787 -sTCP:LISTEN
curl -fsS http://127.0.0.1:8787/healthz
curl -fsS http://127.0.0.1:8787/api/v1/pages/home | head -c 300
```

Expected: existing Vite/API listeners are reused if healthy; `/healthz` succeeds and the homepage API responds. Do not start duplicate services.

- [ ] **Step 6: Inspect desktop and mobile layouts**

Open the existing local homepage and verify:

- desktop commercial area shows five equal-width cards in one row;
- report button is above the website button;
- tablet/mobile breakpoints show two/one columns without overflow;
- ordinary category scores are plain, right-aligned numbers with no star or yellow badge;
- long airport names truncate before colliding with the score;
- risk rows retain the red `风险` status.

- [ ] **Step 7: Record final evidence**

Capture the focused test count, full backend test count, typecheck/build exit status, and visual observations in the final handoff. Do not claim completion until every command above has fresh successful output or any unrelated baseline failure is explicitly separated.
