# Homepage Sponsored Full-Card Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage sponsored-card buttons with one 88px full-card website link while preserving new-tab behavior, sponsored attributes, click tracking, impression tracking, and SSR parity.

**Architecture:** Keep the sponsored-deal API and model unchanged. Convert the React occupied card from `motion.article` plus nested links to one `motion.a`, convert the SSR occupied card to one crawlable external anchor, and simplify empty slots to one compact `/apply` link with no inner button treatment.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Framer Motion, server-rendered HTML/CSS, Node test runner, Vite.

---

## File Map

- `src/pages/home/HomePageV3.tsx`: React full-card website link, tracking, focus and compact empty slot.
- `backend/src/services/publicPageRenderer.ts`: SSR full-card external anchor and 88px styles.
- `backend/tests/frontendCrawlableLinks.test.ts`: React source-contract regression coverage.
- `backend/tests/publicPageRoutes.test.ts`: SSR HTML, link and CSS regression coverage.
- `dist/assets/index.css`: generated Tailwind styles.
- `dist/assets/index.js`: generated React bundle.

### Task 1: Add the failing React full-card contract

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts:378-397`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Replace the button assertions with one-card-link assertions**

Require the occupied-card source to contain:

```ts
assert.match(sponsoredDealCardSource, /useRef<HTMLAnchorElement>\(null\)/);
assert.match(sponsoredDealCardSource, /<motion\.a/);
assert.match(sponsoredDealCardSource, /href=\{websiteHref\}/);
assert.match(sponsoredDealCardSource, /target="_blank"/);
assert.match(sponsoredDealCardSource, /rel="nofollow sponsored noopener noreferrer"/);
assert.match(sponsoredDealCardSource, /aria-label=\{`访问 \$\{deal\.name\} 官网（新标签页）`\}/);
assert.match(sponsoredDealCardSource, /onClick=\{createTrackedOutboundClickHandler\(\{/);
assert.match(sponsoredDealCardSource, /min-h-\[88px\]/);
assert.match(sponsoredDealCardSource, /whileTap=\{\{ scale: 0\.99 \}\}/);
assert.doesNotMatch(sponsoredDealCardSource, /<RouteLink|deal\.report_url|查看报告|官网 <ExternalLink|grid-cols-2/);
```

Require the empty slot to use `min-h-[88px]`, retain `href="/apply"`, contain plain “申请入驻” text, and omit `Sparkles`, `min-h-10`, and the white button treatment.

- [ ] **Step 2: Run the React contract test and verify it fails**

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: FAIL because the current component is a 136px article with report and website buttons.

### Task 2: Implement the React full-card link

**Files:**
- Modify: `src/pages/home/HomePageV3.tsx:473-527`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Convert the occupied card to one tracked external anchor**

Use an anchor-specific ref:

```tsx
const ref = useRef<HTMLAnchorElement>(null);
```

Replace the `motion.article` and nested actions with:

```tsx
<motion.a
  ref={ref}
  href={websiteHref}
  target="_blank"
  rel="nofollow sponsored noopener noreferrer"
  aria-label={`访问 ${deal.name} 官网（新标签页）`}
  onClick={createTrackedOutboundClickHandler({
    airportId: deal.airport_id,
    campaignId: deal.campaign_id,
    pageKind: 'home',
    placement: 'deal_card',
    targetKind: 'website',
    targetUrl: websiteHref,
  })}
  whileHover={{ y: -2 }}
  whileTap={{ scale: 0.99 }}
  transition={{ duration: 0.2 }}
  className="group relative flex min-h-[88px] flex-col justify-center overflow-hidden rounded-[18px] border border-gray-200 bg-gradient-to-b from-slate-50/60 to-white p-3 no-underline shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 motion-reduce:transform-none"
>
  <h3 className="truncate text-[14px] font-black leading-tight text-gray-900 transition-colors group-hover:text-indigo-600 sm:text-[15px]">{deal.name}</h3>
  <span className="mt-1 block font-mono text-[11.5px] leading-none text-gray-400">{deal.tracking_days} 天观察</span>
  <p className="mt-2 truncate text-[11.5px] font-medium leading-snug text-gray-500">
    {deal.discount_title || '查看官网了解当前优惠活动。'}
  </p>
</motion.a>
```

Do not change the impression hook parameters or the `SponsoredDeal` fields.

- [ ] **Step 2: Simplify the empty slot to one 88px link**

Keep the outer `RouteLink href="/apply"`, change its shell to `min-h-[88px] justify-center p-2.5`, remove `Sparkles` and the inner button-styled span, and render:

```tsx
<span className="block text-[13px] font-extrabold text-gray-800">首页 {slot} 号广告位招募中</span>
<span className="mt-1 block text-[11.5px] font-bold text-indigo-600">申请入驻</span>
```

- [ ] **Step 3: Run React tests and lint**

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
npm run lint
```

Expected: 24 React source-contract tests pass and TypeScript exits 0.

- [ ] **Step 4: Commit the React stage**

```bash
git add src/pages/home/HomePageV3.tsx backend/tests/frontendCrawlableLinks.test.ts
git diff --cached --check
git commit -m "feat: make sponsored cards full-card links"
```

### Task 3: Add the failing SSR full-card contract

**Files:**
- Modify: `backend/tests/publicPageRoutes.test.ts:121-147`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Require one external card anchor and no action block**

Update the SSR card selector and assertions:

```ts
const homepageDealCards = Array.from(html.matchAll(/<a class="home-v3-deal(?: home-v3-empty)?"/g));
const sponsoredDealHtml = html.match(/<a class="home-v3-deal"[\s\S]*?<\/a>/)?.[0] || '';
assert.match(sponsoredDealHtml, /href="https:\/\/deal\.example\.com" target="_blank" rel="nofollow sponsored noopener noreferrer" aria-label="访问 星云优惠机场 官网（新标签页）"/);
assert.doesNotMatch(sponsoredDealHtml, /home-v3-deal-actions|查看测评报告|>官网\s*</);
assert.equal((sponsoredDealHtml.match(/href=/g) || []).length, 1);
assert.match(html, /\.home-v3-deal\s*\{[^}]*min-height:\s*88px;[^}]*justify-content:\s*center;[^}]*padding:\s*10px 12px;/);
assert.match(html, /\.home-v3-deal\.home-v3-empty\s*\{[^}]*min-height:\s*88px;/);
assert.doesNotMatch(html, /\.home-v3-deal-actions|\.home-v3-deal-report|\.home-v3-deal-website/);
```

Also assert the empty slot is an outer `/apply` link containing plain “申请入驻” text with no nested anchor.

- [ ] **Step 2: Run the SSR route test and verify it fails**

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: FAIL because the SSR still uses an article, nested report/website links, 136px occupied cards, and 104px empty cards.

### Task 4: Implement SSR full-card parity

**Files:**
- Modify: `backend/src/services/publicPageRenderer.ts:2154-2172`
- Modify: `backend/src/services/publicPageRenderer.ts:3583-3595`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Render one external anchor per occupied card**

Use:

```ts
<a class="home-v3-deal" href="${escapeAttribute(normalizeExternalHref(deal.website))}" target="_blank" rel="nofollow sponsored noopener noreferrer" aria-label="访问 ${escapeAttribute(deal.name)} 官网（新标签页）" data-marketing-placement="deal_card" data-airport-id="${deal.airport_id}">
  <div class="home-v3-deal-top">
    <h3>${escapeHtml(deal.name)}</h3>
    <small>${deal.tracking_days} 天观察</small>
  </div>
  <div class="home-v3-deal-offer">
    <p>${escapeHtml(deal.discount_title || '查看官网了解当前优惠活动。')}</p>
  </div>
</a>
```

Render each empty slot as one `<a class="home-v3-deal home-v3-empty" href="/apply">` containing `<strong>` and `<span>申请入驻</span>` with no nested anchor.

- [ ] **Step 2: Replace action CSS with 88px full-card feedback**

Use:

```css
.home-v3-deal { display:flex; min-height:88px; flex-direction:column; justify-content:center; border:1px solid #e5e5e5; border-radius:18px; background:#fff; padding:10px 12px; color:inherit; text-decoration:none; box-shadow:0 4px 20px rgba(15,23,42,.04); transition:border-color .2s ease,box-shadow .2s ease,transform .2s ease; }
.home-v3-deal:hover { border-color:#a5b4fc; box-shadow:0 8px 22px rgba(15,23,42,.08); transform:translateY(-2px); }
.home-v3-deal:focus-visible { outline:2px solid #a5b4fc; outline-offset:2px; }
.home-v3-deal.home-v3-empty { min-height:88px; gap:4px; padding:10px 12px; }
.home-v3-deal.home-v3-empty > span { color:#4f46e5; font-size:11px; font-weight:800; }
```

Delete `.home-v3-deal-actions`, `.home-v3-deal-report`, and `.home-v3-deal-website`. Keep shared ranking `.home-v3-tags` styles.

- [ ] **Step 3: Run SSR tests and server typecheck**

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
npm run server:typecheck
```

Expected: 34 route tests pass and server TypeScript exits 0.

- [ ] **Step 4: Commit the SSR stage**

```bash
git add backend/src/services/publicPageRenderer.ts backend/tests/publicPageRoutes.test.ts
git diff --cached --check
git commit -m "feat: align sponsored full-card links in SSR"
```

### Task 5: Browser acceptance, full regression and assets

**Files:**
- Modify: `dist/assets/index.css`
- Modify: `dist/assets/index.js`

- [ ] **Step 1: Measure React desktop and mobile**

At 1440px and 390px widths, verify occupied and empty cards are approximately 88px, the occupied card contains exactly one anchor target, no button/report text exists, the website rel/target values are correct, and card/page horizontal overflow is zero.

- [ ] **Step 2: Measure SSR desktop**

Verify `.home-v3-deal` is approximately 88px, contains one external anchor with the expected attributes, has no nested actions, and produces no browser console warnings or errors.

- [ ] **Step 3: Run complete verification**

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
npm run test:backend
npm run lint
npm run server:typecheck
npm run build
git diff --check
```

Expected: zero test failures, both TypeScript checks exit 0, Vite build exits 0, and `git diff --check` prints nothing.

- [ ] **Step 4: Commit generated assets only**

```bash
git add dist/assets/index.css dist/assets/index.js
git diff --cached --check
git commit -m "build: refresh sponsored full-card assets"
```

- [ ] **Step 5: Confirm final state**

```bash
git status --short
git log -6 --oneline
```

Expected: only the pre-existing user-owned `scripts/__pycache__/monitor_performance.cpython-314.pyc` modification remains. Do not stage or edit that file.
