# Deal Detail Redundant Action Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the self-referential “优惠详情” action only on airport deal detail pages while preserving it on the deals index.

**Architecture:** Keep `DealCard` shared between index and detail pages, but add an explicit optional rendering prop whose default preserves current index behavior. The detail page opts out, and the shared card switches its action grid from three columns to two columns without changing routing, analytics, or outbound-link semantics.

**Tech Stack:** React, TypeScript, Tailwind CSS, Node test runner, Vite

---

### Task 1: Lock the page-specific behavior with a regression test

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts:157-185`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Add failing source-contract assertions**

Add assertions to the existing airport deal detail test:

```ts
assert.match(cardSource, /showDetailAction\?: boolean/);
assert.match(cardSource, /showDetailAction = true/);
assert.match(detailSource, /showDetailAction=\{false\}/);
assert.doesNotMatch(dealsSource, /showDetailAction=\{false\}/);
assert.match(cardSource, /showDetailAction \? \(/);
assert.match(cardSource, /showDetailAction \? 'sm:grid-cols-/);
```

- [ ] **Step 2: Run the focused test and confirm the new assertions fail**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: FAIL because `DealCard` does not yet expose or consume `showDetailAction`.

### Task 2: Implement the conditional action rail

**Files:**
- Modify: `src/pages/deals/DealCard.tsx:8-120`
- Modify: `src/pages/deals/DealDetailPage.tsx:131-137`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Add the optional prop with a compatibility-preserving default**

Extend `DealCardProps` and the component parameters:

```tsx
interface DealCardProps {
  key?: React.Key;
  deal: AirportDealView;
  tone: string;
  pagePath: string;
  detailHref: string;
  showDetailAction?: boolean;
}

export function DealCard({
  deal,
  tone,
  pagePath,
  detailHref,
  showDetailAction = true,
}: DealCardProps) {
```

- [ ] **Step 2: Make the action grid and detail link conditional**

Use two equal columns on detail pages and preserve the current three-column index layout:

```tsx
<div className={`mt-4 grid grid-cols-2 gap-y-1.5 border-t border-slate-200 pt-4 ${showDetailAction ? 'sm:grid-cols-[minmax(130px,1.15fr)_minmax(90px,.8fr)_minmax(76px,.65fr)]' : 'sm:grid-cols-2'} sm:gap-y-0`}>
  {showDetailAction ? (
    <a
      href={detailHref}
      onClick={(event) => { event.preventDefault(); navigate(detailHref); }}
      className="group col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-900 bg-stone-900 px-3 text-[13px] font-black text-white shadow-[0_8px_18px_rgba(23,23,23,0.14)] transition duration-200 hover:-translate-y-0.5 hover:bg-stone-800 hover:shadow-[0_12px_24px_rgba(23,23,23,0.18)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 motion-reduce:transform-none sm:col-span-1"
    >
      优惠详情
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
    </a>
  ) : null}
  <a
    href={deal.report_url}
    onClick={(event) => { event.preventDefault(); navigate(deal.report_url); }}
    className={`inline-flex h-10 items-center justify-center px-2 text-[13px] font-black text-slate-600 transition hover:text-slate-950 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${showDetailAction ? 'sm:border-l sm:border-slate-200' : ''}`}
  >
    查看测评
  </a>
  {websiteHref === '#' ? null : (
    <a
      href={websiteHref}
      target="_blank"
      onClick={outboundClick}
      rel="sponsored nofollow noreferrer noopener"
      className="inline-flex h-10 items-center justify-center gap-1 border-l border-slate-200 px-2 text-[13px] font-black text-slate-600 transition hover:text-slate-950 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
    >
      官网
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  )}
</div>
```

- [ ] **Step 3: Opt out from the detail page only**

Pass the explicit prop in `DealDetailPage`:

```tsx
<DealCard
  deal={deal}
  tone={DEAL_TONES[index % DEAL_TONES.length]}
  pagePath={detailHref}
  detailHref={detailHref}
  showDetailAction={false}
/>
```

- [ ] **Step 4: Run the focused test and type checking**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
npm run lint
```

Expected: all focused tests pass and `tsc --noEmit` exits 0.

- [ ] **Step 5: Commit the source change**

```bash
git add backend/tests/frontendCrawlableLinks.test.ts src/pages/deals/DealCard.tsx src/pages/deals/DealDetailPage.tsx
git commit -m "fix: remove redundant deal detail action"
```

### Task 3: Verify responsive rendering and generated assets

**Files:**
- Modify: `dist/assets/index.css`
- Modify: `dist/assets/index.js`

- [ ] **Step 1: Verify the detail page in a real browser**

Open `http://127.0.0.1:3000/deals/xiaomi` and confirm:

```text
Desktop: each deal card shows only 查看测评 and 官网 on one row.
375px mobile: the two actions remain 40px tall, share one row, and the document has no horizontal overflow.
Deals index: 优惠详情 remains present.
```

- [ ] **Step 2: Build production assets**

Run:

```bash
npm run build
```

Expected: Vite exits 0 and refreshes only generated frontend assets affected by the component change.

- [ ] **Step 3: Run final verification**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/viteConfig.test.ts
npm run lint
git diff --check
git status --short --branch
```

Expected: 24 tests pass, type checking exits 0, no whitespace errors remain, and only intentional generated files are pending before the asset commit.

- [ ] **Step 4: Commit generated assets**

```bash
git add dist/assets/index.css dist/assets/index.js
git commit -m "build: refresh deal detail action assets"
```
