# Homepage Sponsored Card 136px Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress occupied homepage sponsored cards to approximately 136px, remove their tags and airport mark, and match their two action buttons to the compact GateRank ranking controls without changing data or tracking behavior.

**Architecture:** Keep the existing `SponsoredDeals` data flow and tracking hooks intact. Change only the React card presentation in `HomePageV3.tsx` and the equivalent SSR markup/CSS in `publicPageRenderer.ts`, with source-contract tests guarding the visible fields, dimensions, links, and parity.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Framer Motion, server-rendered HTML/CSS, Node test runner, Vite.

---

## File Map

- `src/pages/home/HomePageV3.tsx`: React occupied and empty sponsored-card layout and Tailwind sizing.
- `backend/src/services/publicPageRenderer.ts`: SSR sponsored-card markup and CSS parity.
- `backend/tests/frontendCrawlableLinks.test.ts`: React source-contract regression coverage.
- `backend/tests/publicPageRoutes.test.ts`: SSR HTML and CSS regression coverage.
- `dist/assets/index.css`: generated Tailwind production styles.
- `dist/assets/index.js`: generated React production bundle.

### Task 1: Lock the React card contract with a failing test

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts:342-386`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Replace the old 168px assertions with the new visible-content contract**

Inside the existing sponsored-card source slice assertions, require the new height, the missing airport mark and tags, the one-line offer, the ranking-sized button padding, and a 104px empty slot:

```ts
assert.match(sponsoredDealCardSource, /min-h-\[136px\]/);
assert.doesNotMatch(sponsoredDealCardSource, /<AirportMark\b/);
assert.doesNotMatch(sponsoredDealCardSource, /deal\.tags|<FeatureTag\b/);
assert.match(sponsoredDealCardSource, /truncate text-\[11\.5px\]/);
assert.match(sponsoredDealCardSource, /px-3 py-1\.5[^"']*text-\[12px\][^"']*leading-relaxed/);
assert.match(sponsoredDealCardSource, /self-center[^"']*px-3 py-1[^"']*text-\[12px\][^"']*leading-relaxed/);
assert.match(sponsoredEmptySlotSource, /min-h-\[104px\]/);
```

Keep the existing assertions for `report_url`, website tracking, `nofollow sponsored noopener noreferrer`, two-column actions, and the absence of price content.

- [ ] **Step 2: Run the focused React contract test and verify it fails**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: FAIL because the source still contains `min-h-[168px]`, `<AirportMark>`, `deal.tags`, and `min-h-[124px]`.

### Task 2: Implement the compact React card

**Files:**
- Modify: `src/pages/home/HomePageV3.tsx:473-543`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Remove the airport mark and tag row from `SponsoredDealCard`**

Replace the card’s visible content wrapper with a text-only identity block and one-line offer:

```tsx
<div>
  <div className="min-w-0">
    <h3 className="truncate text-[14px] font-black leading-tight text-gray-900 transition-colors group-hover:text-indigo-600 sm:text-[15px]">
      {deal.name}
    </h3>
    <span className="mt-1 block font-mono text-[11.5px] leading-none text-gray-400">
      {deal.tracking_days} 天观察
    </span>
  </div>
  <p className="mt-2 truncate text-[11.5px] font-medium leading-snug text-gray-500">
    {deal.discount_title || '查看官网了解当前优惠活动。'}
  </p>
</div>
```

Do not remove `tags`, `coupon_code`, or `plan_price_month` from `SponsoredDeal`; they remain API/model fields used elsewhere.

- [ ] **Step 2: Apply the 136px shell and ranking-sized buttons**

Set the occupied card shell and action classes to:

```tsx
className="group relative flex min-h-[136px] flex-col justify-between overflow-hidden rounded-[18px] border border-gray-200 bg-gradient-to-b from-slate-50/60 to-white p-3 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md motion-reduce:transform-none"
```

```tsx
<div className="mt-1 border-t border-gray-100 pt-1">
  <div className="grid grid-cols-2 items-center gap-2">
```

Use the ranking primary-button rhythm for “查看报告”:

```tsx
className="flex w-full items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-stone-900 bg-stone-900 px-3 py-1.5 text-center text-[12px] font-black leading-relaxed text-white shadow-sm transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-stone-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 motion-reduce:transform-none"
```

Use the ranking secondary-button rhythm for “官网”, with `self-center` preventing grid stretching:

```tsx
className="flex w-full self-center items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-3 py-1 text-center text-[12px] font-bold leading-relaxed text-gray-700 shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2"
```

- [ ] **Step 3: Compress the empty sponsored slot**

Change its shell to `min-h-[104px] p-2.5`, its icon container to `h-8 w-8`, its icon to `h-4 w-4`, and its CTA to the ranking primary-button padding `px-3 py-1.5 text-[12px] leading-relaxed`. Keep its `/apply` route and focus behavior.

- [ ] **Step 4: Run the React contract test and lint**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
npm run lint
```

Expected: all `frontendCrawlableLinks` tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the React change**

```bash
git add src/pages/home/HomePageV3.tsx backend/tests/frontendCrawlableLinks.test.ts
git diff --cached --check
git commit -m "feat: simplify compact homepage sponsored cards"
```

### Task 3: Lock the SSR card contract with a failing test

**Files:**
- Modify: `backend/tests/publicPageRoutes.test.ts:121-146`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Update the SSR assertions for the new markup and CSS**

Add assertions scoped to `sponsoredDealHtml`:

```ts
assert.doesNotMatch(sponsoredDealHtml, /home-v3-airport-mark/);
assert.doesNotMatch(sponsoredDealHtml, /home-v3-tags|优惠码|低价稳定|流媒体/);
assert.match(html, /\.home-v3-deal\s*\{[^}]*min-height:\s*136px;[^}]*border-radius:\s*18px;[^}]*padding:\s*12px;/);
assert.match(html, /\.home-v3-deal\.home-v3-empty\s*\{[^}]*min-height:\s*104px;/);
assert.match(html, /\.home-v3-deal-offer p\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/);
assert.match(html, /\.home-v3-deal-report\s*\{[^}]*height:\s*32px;/);
assert.match(html, /\.home-v3-deal-website\s*\{[^}]*height:\s*30px;/);
```

Remove the superseded assertions for 168px, 124px, 40px action height, and the sponsored `.home-v3-tags` row. Keep link, rel, price-absence, two-column grid, and tracking assertions.

- [ ] **Step 2: Run the SSR route test and verify it fails**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: FAIL because the SSR still renders `.home-v3-airport-mark`, `.home-v3-tags`, 168px cards, 124px empty slots, and 40px action controls.

### Task 4: Implement SSR parity

**Files:**
- Modify: `backend/src/services/publicPageRenderer.ts:2154-2173`
- Modify: `backend/src/services/publicPageRenderer.ts:3583-3600`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Remove sponsored airport-mark and tag markup**

Render the occupied card identity without the decorative span:

```ts
<div class="home-v3-deal-top">
  <h3>${escapeHtml(deal.name)}</h3>
  <small>${deal.tracking_days} 天观察</small>
</div>
```

Delete the sponsored `<div class="home-v3-tags">...</div>` line. Do not change the separate ranking-table and deal-detail tag rendering elsewhere in the file.

- [ ] **Step 2: Apply compact SSR CSS**

Use these sponsored-card rules:

```css
.home-v3-deal { display:flex; min-height:136px; flex-direction:column; border:1px solid #e5e5e5; border-radius:18px; background:#fff; padding:12px; box-shadow:0 4px 20px rgba(15,23,42,.04); }
.home-v3-deal.home-v3-empty { min-height:104px; }
.home-v3-deal-top { min-width:0; }
.home-v3-deal h3 { overflow:hidden; margin:0; color:#171717; font-size:14px; text-overflow:ellipsis; white-space:nowrap; }
.home-v3-deal-top small { display:block; margin-top:4px; color:#a3a3a3; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10px; }
.home-v3-deal-offer { margin-top:8px; }
.home-v3-deal-offer p { overflow:hidden; margin:0; color:#737373; font-size:11px; line-height:1.35; text-overflow:ellipsis; white-space:nowrap; }
.home-v3-deal-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:center; gap:8px; margin-top:auto; border-top:1px solid #f5f5f5; padding-top:6px; }
.home-v3-deal-actions a { display:flex; width:100%; box-sizing:border-box; align-items:center; justify-content:center; border:1px solid #e5e5e5; border-radius:12px; font-size:11px; font-weight:900; text-decoration:none; }
.home-v3-deal-report { height:32px; border-color:#171717 !important; background:#171717; color:#fff; }
.home-v3-deal-website { height:30px; background:#fafafa; color:#404040; }
```

Remove `.home-v3-airport-mark`, `.home-v3-deal-top > div`, and sponsored-only `.home-v3-tags`/coupon rules only if no remaining SSR consumer uses them. Confirm with `rg` before deletion.

- [ ] **Step 3: Run the SSR route test and server typecheck**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
npm run server:typecheck
```

Expected: all `publicPageRoutes` tests pass and server TypeScript exits 0.

- [ ] **Step 4: Commit the SSR change**

```bash
git add backend/src/services/publicPageRenderer.ts backend/tests/publicPageRoutes.test.ts
git diff --cached --check
git commit -m "feat: align compact sponsored cards in SSR"
```

### Task 5: Verify browser layout and refresh production assets

**Files:**
- Modify: `dist/assets/index.css`
- Modify: `dist/assets/index.js`

- [ ] **Step 1: Verify the live React page on desktop**

Open `http://127.0.0.1:3000/` in a real browser at a desktop viewport. Measure each occupied sponsored card with `getBoundingClientRect()` and verify:

- height is approximately 136px;
- no airport mark, feature tag, coupon tag, or price is visible;
- the activity title is one line with no horizontal overflow;
- the report button is approximately 32px high and the website button approximately 30px high;
- both actions remain clickable and aligned.

- [ ] **Step 2: Verify the live React page on mobile**

At a 390px-wide viewport, verify the same fields and button dimensions, plus `scrollWidth <= clientWidth` for the sponsored card and page.

- [ ] **Step 3: Verify SSR HTML in a real browser**

Load the backend-rendered homepage from `http://127.0.0.1:8787/`. Before React takeover, verify the occupied sponsored card is approximately 136px, the airport mark and tag row are absent, both actions retain their links, and the console has no new errors.

- [ ] **Step 4: Run the complete verification suite**

Run each command separately and require exit code 0:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
npm run test:backend
npm run lint
npm run server:typecheck
npm run build
git diff --check
```

Expected: focused tests and all backend tests report zero failures; both TypeScript checks and Vite build exit 0; `git diff --check` prints nothing.

- [ ] **Step 5: Commit only generated assets changed by the build**

```bash
git add dist/assets/index.css dist/assets/index.js
git diff --cached --check
git commit -m "build: refresh simplified sponsored card assets"
```

- [ ] **Step 6: Confirm final repository state**

Run:

```bash
git status --short
git log -6 --oneline
```

Expected: only the pre-existing user-owned `scripts/__pycache__/monitor_performance.cpython-314.pyc` modification remains; implementation, tests, and generated assets are committed. Do not stage or modify that cache file.
