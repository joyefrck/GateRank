# Homepage Sponsored Compact Mark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a restrained 30px airport initial mark beside each occupied homepage sponsored-card name without changing the 88px card height, full-card website link, or tracking behavior.

**Architecture:** Reuse the existing React `AirportMark` component with its `compact` variant. Render equivalent server-side markup and gradient styling so the first SSR frame matches React, while keeping the mark decorative and the outer card as the only interactive element.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Framer Motion, server-rendered HTML/CSS, Node test runner, Vite.

---

## File Map

- `src/pages/home/HomePageV3.tsx`: place the existing compact mark beside sponsored-card name metadata.
- `backend/src/services/publicPageRenderer.ts`: render the same decorative initial mark and 30px SSR styling.
- `backend/tests/frontendCrawlableLinks.test.ts`: enforce the compact React mark while preserving the full-card link contract.
- `backend/tests/publicPageRoutes.test.ts`: enforce SSR mark markup, size, and single-link semantics.
- `dist/assets/index.js`: generated React production bundle.

### Task 1: Add failing React and SSR contracts

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts:342-397`
- Modify: `backend/tests/publicPageRoutes.test.ts:121-151`

- [ ] **Step 1: Require the React compact mark**

Replace the assertion that forbids `AirportMark` inside `SponsoredDealCard` with:

```ts
assert.match(sponsoredDealCardSource, /<AirportMark name=\{deal\.name\} compact \/>/);
assert.match(sponsoredDealCardSource, /flex min-w-0 items-center gap-2/);
assert.match(source, /compact \? 'h-\[30px\] w-\[30px\] rounded-lg text-\[11px\]'/);
```

Keep the assertions for `min-h-[88px]`, one `motion.a`, `_blank`, sponsored rel attributes, no nested report/website controls, and no price or tags.

- [ ] **Step 2: Require the SSR decorative mark**

Replace the assertion that forbids `.home-v3-airport-mark` with:

```ts
assert.match(sponsoredDealHtml, /<span class="home-v3-airport-mark" style="background:linear-gradient\(135deg,hsl\(\d+ 72% 56%\),hsl\(\d+ 72% 44%\)\)" aria-hidden="true">星<\/span>/);
assert.match(html, /\.home-v3-airport-mark\s*\{[^}]*width:\s*30px;[^}]*height:\s*30px;[^}]*flex:\s*0 0 30px;[^}]*border-radius:\s*8px;[^}]*font-size:\s*11px;/);
assert.match(html, /\.home-v3-deal-top\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*gap:\s*8px;/);
```

Keep the assertion that the occupied card contains exactly one `href`, because the mark must not introduce another interactive element.

- [ ] **Step 3: Run the focused tests and verify they fail**

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: FAIL because React currently omits `AirportMark` and SSR currently omits `.home-v3-airport-mark`.

### Task 2: Restore the compact mark in React

**Files:**
- Modify: `src/pages/home/HomePageV3.tsx:473-511`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Group the compact mark with name metadata**

Replace the standalone name and observation elements inside `motion.a` with:

```tsx
<div className="flex min-w-0 items-center gap-2">
  <AirportMark name={deal.name} compact />
  <div className="min-w-0">
    <h3 className="truncate text-[14px] font-black leading-tight text-gray-900 transition-colors group-hover:text-indigo-600 sm:text-[15px]">{deal.name}</h3>
    <span className="mt-1 block font-mono text-[11.5px] leading-none text-gray-400">{deal.tracking_days} 天观察</span>
  </div>
</div>
```

Leave the activity paragraph after this group. Do not change `min-h-[88px]`, the anchor attributes, impression hook, click handler, hover/tap feedback, or empty-slot markup.

- [ ] **Step 2: Run the React test and lint**

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
npm run lint
```

Expected: all React source-contract tests pass and TypeScript exits 0.

### Task 3: Restore equivalent SSR markup and style

**Files:**
- Modify: `backend/src/services/publicPageRenderer.ts:2150-2163`
- Modify: `backend/src/services/publicPageRenderer.ts:3579-3589`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Add a deterministic hue helper**

Add a local helper beside the homepage rendering helpers:

```ts
function resolveAirportMarkHue(name: string): number {
  return Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
}
```

- [ ] **Step 2: Render the decorative mark in the existing deal top row**

For each occupied deal, calculate `markHue` and render:

```ts
const markHue = resolveAirportMarkHue(deal.name);
return `
  <a class="home-v3-deal" href="${escapeAttribute(normalizeExternalHref(deal.website))}" target="_blank" rel="nofollow sponsored noopener noreferrer" aria-label="访问 ${escapeAttribute(deal.name)} 官网（新标签页）" data-marketing-placement="deal_card" data-airport-id="${deal.airport_id}">
    <div class="home-v3-deal-top">
      <span class="home-v3-airport-mark" style="background:linear-gradient(135deg,hsl(${markHue} 72% 56%),hsl(${(markHue + 30) % 360} 72% 44%))" aria-hidden="true">${escapeHtml(deal.name.trim().charAt(0).toUpperCase() || 'G')}</span>
      <div><h3>${escapeHtml(deal.name)}</h3><small>${deal.tracking_days} 天观察</small></div>
    </div>
    <div class="home-v3-deal-offer">
      <p>${escapeHtml(deal.discount_title || '查看官网了解当前优惠活动。')}</p>
    </div>
  </a>
`;
```

The outer card remains the single anchor; the mark is a non-interactive `span` with `aria-hidden="true"`.

- [ ] **Step 3: Add 30px SSR styles**

Use:

```css
.home-v3-deal-top { display:flex; min-width:0; align-items:center; gap:8px; }
.home-v3-airport-mark { display:inline-flex; width:30px; height:30px; flex:0 0 30px; align-items:center; justify-content:center; border-radius:8px; color:#fff; font-size:11px; font-weight:900; box-shadow:0 1px 2px rgba(15,23,42,.12); }
.home-v3-deal-top > div { min-width:0; flex:1; }
```

Keep `.home-v3-deal` and `.home-v3-deal.home-v3-empty` at `88px`.

- [ ] **Step 4: Run the SSR test and server typecheck**

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
npm run server:typecheck
```

Expected: all public route tests pass and server TypeScript exits 0.

### Task 4: Browser acceptance and final regression

**Files:**
- Modify: `dist/assets/index.js`

- [ ] **Step 1: Verify React and SSR in a real browser**

At desktop and `390×844`, verify occupied cards remain `88px` tall; the mark is `30×30px`; the title and offer do not overflow; the card has no nested anchor or button; the page has no horizontal overflow; and React/SSR console logs contain no new warning or error.

- [ ] **Step 2: Run focused and full verification**

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
npm run test:backend
npm run lint
npm run server:typecheck
npm run build
git diff --check
```

Expected: focused tests, full backend tests, both TypeScript checks, production build, and whitespace validation all pass.

- [ ] **Step 3: Commit generated assets only**

```bash
git add dist/assets/index.js
git diff --cached --check
git commit -m "build: refresh sponsored compact mark assets"
```

Do not stage `scripts/__pycache__/monitor_performance.cpython-314.pyc` or any other unrelated file.
