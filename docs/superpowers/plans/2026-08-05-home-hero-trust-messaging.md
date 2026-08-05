# Home Hero Trust Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the existing “行业首创，每日更新” message and a linked ranking-independence statement above the GateRank homepage title without increasing the Hero height.

**Architecture:** Reuse shared homepage copy and the existing transparency route in the React Hero, then mirror the same semantic structure in the server-rendered homepage. Preserve desktop height through existing right-column headroom and recover narrow-screen space by displaying the two metric cards in two columns.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Express SSR string renderer, Node test runner, Vite

---

### Task 1: Add regression coverage for React and SSR Hero content

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Write a failing React source-contract test**

Add a test that isolates `HomeHero` and verifies shared copy, the canonical transparency link, safe new-tab behavior, ordering, and the narrow-screen metric grid:

```ts
test('React homepage Hero exposes trust messaging without increasing narrow-screen height', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/home/HomePageV3.tsx'), 'utf8');
  const heroStart = source.indexOf('function HomeHero');
  const heroEnd = source.indexOf('function MetricCard', heroStart);
  const heroSource = source.slice(heroStart, heroEnd);

  assert.notEqual(heroStart, -1);
  assert.notEqual(heroEnd, -1);
  assert.match(source, /HOME_HERO_HIGHLIGHT_TEXT/);
  assert.match(source, /buildRankingTransparencyHref/);
  assert.match(heroSource, /\{HOME_HERO_HIGHLIGHT_TEXT\}/);
  assert.match(heroSource, /关于 GateRank 评分、收费与排名独立性的声明/);
  assert.match(heroSource, /href=\{buildRankingTransparencyHref\(\)\}/);
  assert.match(heroSource, /target="_blank"/);
  assert.match(heroSource, /rel="noopener noreferrer"/);
  assert.ok(heroSource.indexOf('HOME_HERO_HIGHLIGHT_TEXT') < heroSource.indexOf('<h1'));
  assert.match(heroSource, /grid-cols-2[^\"]*lg:grid-cols-1/);
  assert.match(heroSource, /col-span-2[^\"]*lg:col-span-1/);
});
```

- [ ] **Step 2: Extend the homepage SSR route assertions**

Inside the existing `if (path === '/')` block in `backend/tests/publicPageRoutes.test.ts`, replace the standalone pill assertion with semantic assertions:

```ts
assert.match(html, /<div class="home-v3-hero-eyebrow">/);
assert.match(html, /<span class="home-v3-pill">行业首创，每日更新<\/span>/);
assert.match(
  html,
  /<a class="home-v3-transparency-link" href="\/ranking-transparency" target="_blank" rel="noopener noreferrer">关于 GateRank 评分、收费与排名独立性的声明/,
);
assert.ok(html.indexOf('home-v3-hero-eyebrow') < html.indexOf('<h1>机场榜'));
assert.match(html, /\.home-v3-hero-eyebrow\s*\{[^}]*display:\s*flex;/);
assert.match(html, /@media \(max-width:\s*900px\)[\s\S]*?\.home-v3-metrics\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\);/);
assert.match(html, /@media \(min-width:\s*901px\)[\s\S]*?\.home-v3-metrics\s*\{[^}]*grid-template-columns:\s*1fr;/);
```

- [ ] **Step 3: Run the new tests and confirm they fail**

Run:

```bash
npx tsx --test --test-name-pattern "homepage Hero" backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: both new Hero contracts fail because the React eyebrow does not exist and SSR does not yet include the transparency link or responsive two-column metric rule.

- [ ] **Step 4: Commit the failing tests**

```bash
git add backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
git commit -m "test: cover homepage hero trust messaging"
```

### Task 2: Implement the React Hero eyebrow and narrow-screen height compensation

**Files:**
- Modify: `src/pages/home/HomePageV3.tsx`

- [ ] **Step 1: Import shared copy and the existing route builder**

Update the imports to include `HOME_HERO_HIGHLIGHT_TEXT` and `buildRankingTransparencyHref`:

```ts
import { HOME_FAQ_ITEMS, HOME_HERO_HIGHLIGHT_TEXT, buildHomeSeo } from '../../../shared/publicSeo';
```

```ts
import {
  buildAbsoluteUrl,
  buildFullRankingHref,
  buildHomeHref,
  buildRankingTransparencyHref,
  navigate,
  normalizeExternalHref,
  PageFrame,
  usePageSeo,
} from '../../site/publicSite';
```

- [ ] **Step 2: Add the eyebrow before the existing `h1`**

Insert this block at the beginning of the existing `space-y-2.5` content group:

```tsx
<div className="flex min-w-0 flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2.5">
  <span className="inline-flex shrink-0 items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-black tracking-[0.08em] text-rose-600">
    {HOME_HERO_HIGHLIGHT_TEXT}
  </span>
  <a
    href={buildRankingTransparencyHref()}
    target="_blank"
    rel="noopener noreferrer"
    className="group inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold leading-5 text-gray-500 transition-colors hover:text-gray-900 focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2 sm:text-[11.5px]"
  >
    <span>关于 GateRank 评分、收费与排名独立性的声明</span>
    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-900 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
  </a>
</div>
```

- [ ] **Step 3: Make metric cards compensate for the new mobile content**

Change the metric wrapper and report-time wrapper to use two columns below the desktop breakpoint:

```tsx
<div className="grid w-full min-w-0 grid-cols-2 gap-2 lg:w-auto lg:min-w-[220px] lg:grid-cols-1">
```

```tsx
<div className="col-span-2 flex justify-end pt-1 lg:col-span-1">
```

Make metric cards compact enough for narrow phones without changing their desktop appearance:

```tsx
<div className="flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-xl border border-gray-100 bg-white p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.015)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)] sm:gap-2.5 sm:p-3">
```

Hide the decorative icon below `sm` and permit the value column to shrink:

```tsx
<div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400 sm:flex">
```

```tsx
<div className="flex min-w-0 flex-col">
```

- [ ] **Step 4: Run the React regression test**

Run:

```bash
npx tsx --test --test-name-pattern "React homepage Hero" backend/tests/frontendCrawlableLinks.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the React implementation**

```bash
git add src/pages/home/HomePageV3.tsx backend/tests/frontendCrawlableLinks.test.ts
git commit -m "feat: add homepage hero trust eyebrow"
```

### Task 3: Mirror the Hero eyebrow and responsive metric layout in SSR

**Files:**
- Modify: `backend/src/services/publicPageRenderer.ts`

- [ ] **Step 1: Replace the standalone SSR pill with the eyebrow structure**

Replace the existing `home-v3-pill` element before the `h1` with:

```ts
<div class="home-v3-hero-eyebrow">
  <span class="home-v3-pill">${escapeHtml(HOME_HERO_HIGHLIGHT_TEXT)}</span>
  <a class="home-v3-transparency-link" href="${escapeAttribute(PUBLIC_SEO_PATHS.rankingTransparency)}" target="_blank" rel="noopener noreferrer">关于 GateRank 评分、收费与排名独立性的声明 <span aria-hidden="true">↗</span></a>
</div>
```

- [ ] **Step 2: Add SSR eyebrow and link styles**

Replace the current `.home-v3-pill` declaration and the `h1` top margin with:

```css
.home-v3-hero-eyebrow { display: flex; min-width: 0; align-items: center; gap: 10px; }
.home-v3-pill { display: inline-flex; flex: 0 0 auto; border: 1px solid #fecdd3; border-radius: 999px; background: #fff1f2; padding: 4px 10px; color: #e11d48; font-size: 10px; font-weight: 900; letter-spacing: .08em; }
.home-v3-transparency-link { display: inline-flex; min-width: 0; align-items: center; gap: 6px; color: #737373; font-size: 11px; font-weight: 800; line-height: 1.6; text-decoration: none; transition: color .18s ease; }
.home-v3-transparency-link:hover { color: #171717; }
.home-v3-transparency-link:focus-visible { border-radius: 6px; outline: 2px solid #fda4af; outline-offset: 3px; }
.home-v3-transparency-link span { flex: 0 0 auto; border-radius: 5px; background: #171717; padding: 0 4px; color: #fff; transition: transform .18s ease; }
.home-v3-transparency-link:hover span { transform: translateX(2px); }
.home-v3-hero h1 { margin: 10px 0 0; color: #0a0a0a; font-size: clamp(20px,2.4vw,30px); font-weight: 900; line-height: 1.15; letter-spacing: -.04em; }
```

- [ ] **Step 3: Add narrow-screen height compensation and desktop reset**

Inside `@media (max-width: 900px)`, add:

```css
.home-v3-hero-eyebrow { align-items: flex-start; flex-direction: column; gap: 6px; }
.home-v3-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); }
.home-v3-report-time { grid-column: 1 / -1; }
.home-v3-metric { min-width: 0; padding-right: 54px; }
```

Then add a desktop reset after that media query:

```css
@media (min-width: 901px) {
  .home-v3-metrics { grid-template-columns: 1fr; }
}
```

- [ ] **Step 4: Run the SSR regression test**

Run:

```bash
npx tsx --test --test-name-pattern "public SEO routes return crawlable HTML" backend/tests/publicPageRoutes.test.ts
```

Expected: PASS, including the homepage eyebrow, link, and responsive style assertions.

- [ ] **Step 5: Commit the SSR implementation**

```bash
git add backend/src/services/publicPageRenderer.ts backend/tests/publicPageRoutes.test.ts
git commit -m "feat: mirror homepage hero trust messaging in SSR"
```

### Task 4: Verify behavior, rendering, and production build

**Files:**
- Verify: `src/pages/home/HomePageV3.tsx`
- Verify: `backend/src/services/publicPageRenderer.ts`
- Verify: `backend/tests/frontendCrawlableLinks.test.ts`
- Verify: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Run focused homepage tests**

```bash
npx tsx --test --test-name-pattern "homepage Hero|React homepage keeps the 3.0 Hero|public SEO routes return crawlable HTML" backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: all matched tests pass with zero failures.

- [ ] **Step 2: Run both TypeScript checks**

```bash
npm run lint
npm run server:typecheck
```

Expected: both commands exit 0.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: Vite exits 0 and writes the production bundle to `dist/`.

- [ ] **Step 4: Verify the live local page in a real browser**

Open the existing local homepage at `http://127.0.0.1:3000/` without starting a duplicate service. Capture desktop and mobile screenshots, then verify:

- Desktop Hero height is unchanged from the pre-change baseline.
- The eyebrow is one row on desktop and the title remains the strongest element.
- The complete statement is visible on mobile without horizontal scrolling.
- The two metric cards are side by side below 901px and return to one column on desktop.
- The statement opens `/ranking-transparency` in a new tab.
- Focus-visible styling appears during keyboard navigation.

- [ ] **Step 5: Inspect the final diff and repository state**

```bash
git diff --check
git status --short --branch
```

Expected: no whitespace errors; only intentional commits and the ignored or untracked visual-companion workspace remain.
