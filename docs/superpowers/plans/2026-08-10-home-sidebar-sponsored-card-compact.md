# Homepage Sidebar Sponsored Card Compact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide homepage sponsored-card prices and reduce occupied cards to a 168px minimum height and empty slots to a 124px minimum height while preserving all non-price content, actions, tracking, and SSR parity.

**Architecture:** Keep the existing sponsored-card components and API model intact. Remove only the homepage price markup from React and SSR, tighten card spacing through existing Tailwind/CSS surfaces, and update source/route regressions so other price displays and billing data remain untouched.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Motion, server-rendered HTML/CSS, Node test runner through `tsx`, Vite.

---

## Execution constraint

Work on the current `main` branch without creating a branch or worktree. Keep the React and SSR changes in separate commits, do not push, and do not deploy production.

## File map

- Modify `src/pages/home/HomePageV3.tsx`: remove price markup from `SponsoredDealCard`, apply 168px compact spacing, and reduce `SponsoredEmptySlot` to 124px.
- Modify `backend/src/services/publicPageRenderer.ts`: remove SSR price markup and price-only CSS, then match compact occupied and empty-card dimensions.
- Modify `backend/tests/frontendCrawlableLinks.test.ts`: prove the React sponsored-card slice does not display price and locks the new dimensions.
- Modify `backend/tests/publicPageRoutes.test.ts`: prove SSR omits price markup and locks the new CSS dimensions.
- Regenerate `dist/assets/index.css` and `dist/assets/index.js` with the production build because this repository tracks stable frontend assets.

### Task 1: Lock and implement the compact React card

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts:339-390`
- Modify: `src/pages/home/HomePageV3.tsx:474-552`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Change the React source assertions to the new price and size contract**

In `React homepage uses shared five-slot commercial cards and plain summary scores`, replace the 196px occupied-card assertion and add compact empty-card and price-negative assertions:

```ts
  assert.match(sponsoredDealCardSource, /min-h-\[168px\]/);
  assert.match(sponsoredDealCardSource, /rounded-\[18px\]/);
  assert.match(sponsoredDealCardSource, /p-3\.5/);
  assert.match(sponsoredDealCardSource, /grid grid-cols-2 gap-2/);
  assert.match(sponsoredDealCardSource, /min-h-10/);
  assert.doesNotMatch(sponsoredDealCardSource, /deal\.plan_price_month|起步月付|\/起/);
  assert.match(sponsoredEmptySlotSource, /min-h-\[124px\]/);
  assert.match(sponsoredEmptySlotSource, /p-3\.5/);
```

Keep the existing assertions for the five slots, airport name, observation days, activity title, tags, report-before-website order, `placement: 'deal_card'`, normalized website URL, click handler, external-link attributes, two-column actions, and 40px targets.

- [ ] **Step 2: Run the React regression and observe the red state**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: FAIL in `React homepage uses shared five-slot commercial cards and plain summary scores` because the current source still contains `min-h-[196px]`, `p-4`, `deal.plan_price_month`, “起步月付”, and `min-h-[140px]`.

- [ ] **Step 3: Remove price markup and apply the compact occupied-card classes**

Change the `motion.article` opening and the top content spacing to:

```tsx
    <motion.article
      ref={ref}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-[18px] border border-gray-200 bg-gradient-to-b from-slate-50/60 to-white p-3.5 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md motion-reduce:transform-none"
    >
      <div className="space-y-2">
```

Replace the current price-and-actions wrapper, including the “起步月付” block, with:

```tsx
      <div className="mt-2 border-t border-gray-100 pt-2">
        <div className="grid grid-cols-2 gap-2">
          <RouteLink href={deal.report_url} className="flex min-h-10 w-full items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-stone-900 bg-stone-900 px-2 py-2 text-center text-[12px] font-black leading-none text-white shadow-sm hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2">
            查看报告 <span className="text-[10px]">&gt;</span>
          </RouteLink>
          <a
            href={websiteHref}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            onClick={createTrackedOutboundClickHandler({
              airportId: deal.airport_id,
              campaignId: deal.campaign_id,
              pageKind: 'home',
              placement: 'deal_card',
              targetKind: 'website',
              targetUrl: websiteHref,
            })}
            className="flex min-h-10 w-full items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-2 py-2 text-center text-[12px] font-bold leading-none text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2"
          >
            官网 <ExternalLink className="h-3 w-3 text-gray-400" />
          </a>
        </div>
      </div>
```

Do not alter `SponsoredDeal`, the homepage payload, `formatPrice`, ranking prices, or any non-sponsored price display.

- [ ] **Step 4: Compact the empty slot**

Change only its size classes:

```tsx
    <RouteLink href="/apply" className="group relative flex min-h-[124px] flex-col items-center justify-between overflow-hidden rounded-[18px] border border-dashed border-gray-300 bg-gray-50/70 p-3.5 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2">
```

Keep the slot number, Sparkles icon, “联系商务合作” text, navigation target, and `min-h-10` action area.

- [ ] **Step 5: Run the React regression and type checker**

Run separately:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
npm run lint
```

Expected: the focused test file reports zero failures and `tsc --noEmit` exits 0.

- [ ] **Step 6: Commit the React slice**

```bash
git add src/pages/home/HomePageV3.tsx backend/tests/frontendCrawlableLinks.test.ts
git commit -m "feat: compact homepage sponsored cards"
```

### Task 2: Lock and implement the compact SSR card

**Files:**
- Modify: `backend/tests/publicPageRoutes.test.ts:111-148`
- Modify: `backend/src/services/publicPageRenderer.ts:2150-2180`
- Modify: `backend/src/services/publicPageRenderer.ts:3588-3610`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Replace SSR price and dimension assertions**

Remove the positive assertion for `<small>月付起</small><strong>¥12</strong>` and add:

```ts
        assert.doesNotMatch(sponsoredDealHtml, /月付起|home-v3-deal-bottom|¥12/);
        assert.match(html, /\.home-v3-deal\s*\{[^}]*min-height:\s*168px;[^}]*border-radius:\s*18px;[^}]*padding:\s*14px;/);
        assert.match(html, /\.home-v3-deal\.home-v3-empty\s*\{[^}]*min-height:\s*124px;/);
        assert.doesNotMatch(html, /\.home-v3-deal-bottom(?:\s|>|\.)/);
```

Keep the assertions for five cards, the fifth empty slot, title, tracking days, activity title, coupon, tags, report URL, website URL, target, rel, single-column grid, two-column actions, and 40px action height.

- [ ] **Step 2: Run the SSR route regression and observe red state**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: FAIL because SSR still emits `home-v3-deal-bottom`, “月付起”, `¥12`, a 196px occupied minimum, and no 124px empty override.

- [ ] **Step 3: Remove only the SSR homepage price block**

In `renderHomeV3SponsoredDeals`, delete this block:

```ts
              <div class="home-v3-deal-bottom">
                <span><small>月付起</small><strong>¥${escapeHtml(formatPublicPrice(deal.plan_price_month))}</strong></span>
              </div>
```

Leave the offer title, coupon, tags, report link, website link, and `rel="nofollow sponsored noopener noreferrer"` unchanged.

- [ ] **Step 4: Apply compact occupied and empty-card CSS**

Replace the occupied card rule with:

```css
  .home-v3-deal { display: flex; min-height: 168px; flex-direction: column; border: 1px solid #e5e5e5; border-radius: 18px; background: #fff; padding: 14px; box-shadow: 0 4px 20px rgba(15,23,42,.04); }
  .home-v3-deal.home-v3-empty { min-height: 124px; }
```

Delete all four price-only selectors:

```css
  .home-v3-deal-bottom { display: flex; align-items: end; justify-content: space-between; gap: 10px; margin-top: auto; border-top: 1px solid #f5f5f5; padding-top: 12px; }
  .home-v3-deal-bottom > span small, .home-v3-deal-bottom > span strong { display: block; }
  .home-v3-deal-bottom small { color: #a3a3a3; font-size: 10px; font-weight: 800; }
  .home-v3-deal-bottom strong { margin-top: 2px; color: #171717; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
```

Keep `.home-v3-deal-actions` as two columns with an 8px gap and keep action links at 40px minimum height.

- [ ] **Step 5: Run the SSR route regression and server type checker**

Run separately:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
npm run server:typecheck
```

Expected: the focused route test reports zero failures and backend TypeScript exits 0.

- [ ] **Step 6: Commit the SSR slice**

```bash
git add backend/src/services/publicPageRenderer.ts backend/tests/publicPageRoutes.test.ts
git commit -m "feat: hide homepage sponsored prices in SSR"
```

### Task 3: Verify runtime dimensions and complete the build

**Files:**
- Modify only if browser evidence exposes a scoped defect: `src/pages/home/HomePageV3.tsx`, `backend/src/services/publicPageRenderer.ts`, and their focused tests.
- Regenerate: `dist/assets/index.css`, `dist/assets/index.js`

- [ ] **Step 1: Reuse or start local services**

Verify the existing detached services first:

```bash
curl -sS http://127.0.0.1:8787/healthz
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
```

Expected: API returns `{"status":"ok"}` and the frontend returns `200`. If either is absent, start only the missing `gaterank-api` or `gaterank-vite` service through the repository’s established detached `screen` workflow.

- [ ] **Step 2: Inspect the React page at desktop and phone widths**

In a real browser, measure occupied and empty ad cards at approximately 1440px and 390px viewport widths. Verify:

- occupied cards have a 168px minimum and no price label or value;
- their actual height stays close to 168px unless the title or tags require more room;
- empty slots have a 124px minimum;
- report and website buttons remain side by side and at least 40px high;
- name, observation days, activity title, and tags remain visible;
- the five-card single-column order and zero horizontal overflow remain intact.

- [ ] **Step 3: Inspect the SSR page before and after client takeover**

Open `http://127.0.0.1:8787/` and verify the initial sidebar contains the same price-free occupied card, compact empty slots, two-column actions, and no layout jump after hydration. Read browser console warnings and errors without clicking report or website actions.

- [ ] **Step 4: Run the focused and full regression matrix**

Run each command separately and retain each exit code:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
npm run test:backend
npm run lint
npm run server:typecheck
npm run build
git diff --check
```

Expected: focused and full backend tests report zero failures; both TypeScript checks exit 0; Vite exits 0; `git diff --check` prints nothing. The existing Vite chunk-size warning is informational and does not make the build fail.

- [ ] **Step 5: Commit tracked production assets**

Inspect `git status --short`. If the successful build changes only the tracked stable bundles, commit them:

```bash
git add dist/assets/index.css dist/assets/index.js
git commit -m "build: refresh compact sponsored card assets"
```

Do not stage unrelated files and do not create an empty commit.

- [ ] **Step 6: Report final evidence**

Run:

```bash
git diff --check
git status --porcelain=v1
git log -5 --oneline
```

Expected: diff check has no output, status is empty, and the log contains separate React, SSR, and build commits. Report measured desktop/mobile heights, focused and full test counts, type/build results, commit hashes, and that no push or production deployment occurred.
