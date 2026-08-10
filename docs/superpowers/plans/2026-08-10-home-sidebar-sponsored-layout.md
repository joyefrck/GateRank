# Homepage Sidebar Sponsored Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the five homepage sponsored slots below “探索更多优质机场” in the right sidebar and render each slot as one compact, full-width card without changing fields, links, or marketing tracking.

**Architecture:** Keep the existing `SponsoredDeals`, `SponsoredDealCard`, and `SponsoredEmptySlot` React boundaries, but pass sponsored data into `HomeSidebar` and adapt their layout for a single sidebar column. Mirror the same hierarchy in the server renderer by nesting `renderHomeV3SponsoredDeals(view)` inside `renderHomeV3Sidebar(view)`, adding the missing SSR exploration panel, and updating only homepage-specific CSS.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Motion, Node test runner through `tsx`, server-rendered HTML/CSS in TypeScript, Vite.

---

## Execution constraint

The repository is already on the user’s preferred current `main` branch. Do not create or switch branches or worktrees without a separate user request. Keep commits narrowly scoped and do not push or deploy.

## File map

- Modify `src/pages/home/HomePageV3.tsx`: move sponsored data into the sidebar, preserve five-slot mapping and tracking, and apply compact sidebar dimensions.
- Modify `backend/src/services/publicPageRenderer.ts`: mirror the React order in SSR, render the exploration panel, and make SSR sponsored cards single-column and compact.
- Modify `backend/tests/frontendCrawlableLinks.test.ts`: lock React component placement, order, dimensions, link attributes, and tracking invariants.
- Modify `backend/tests/publicPageRoutes.test.ts`: lock SSR sidebar order, five slots, compact CSS, fields, and sponsored link attributes.

### Task 1: Lock the React sidebar contract with a failing source regression test

**Files:**
- Modify: `backend/tests/frontendCrawlableLinks.test.ts:339-376`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Replace the old five-column card assertions with the confirmed sidebar contract**

In `React homepage uses shared five-slot commercial cards and plain summary scores`, add source slices for the page body and sidebar and replace the layout assertions with:

```ts
  const pageBodyStart = source.indexOf('return (', source.indexOf('export function HomePageV3'));
  const homeHeroStart = source.indexOf('function HomeHero');
  const homeSidebarStart = source.indexOf('function HomeSidebar');
  const summaryBoardsStart = source.indexOf('function SummaryBoards', homeSidebarStart);
  const pageBodySource = source.slice(pageBodyStart, homeHeroStart);
  const homeSidebarSource = source.slice(homeSidebarStart, summaryBoardsStart);

  assert.match(pageBodySource, /<HomeSidebar[\s\S]*news=\{data\.news_updates \|\| \[\]\}[\s\S]*deals=\{data\.sponsored_deals\?\.items \|\| \[\]\}/);
  assert.doesNotMatch(pageBodySource, /<>\s*<SponsoredDeals deals=/);
  assert.match(homeSidebarSource, /function HomeSidebar\(\{ news, deals \}/);
  assert.ok(homeSidebarSource.indexOf('探索更多优质机场') < homeSidebarSource.indexOf('<SponsoredDeals deals={deals}'));
  assert.ok(homeSidebarSource.indexOf('<SponsoredDeals deals={deals}') < homeSidebarSource.indexOf('实用工具'));
  assert.ok(homeSidebarSource.indexOf('实用工具') < homeSidebarSource.indexOf('公告与动态'));
  assert.match(sponsoredDealsSource, /grid grid-cols-1 gap-3/);
  assert.doesNotMatch(sponsoredDealsSource, /sm:grid-cols-2|lg:grid-cols-5/);
  assert.match(sponsoredDealCardSource, /min-h-\[196px\]/);
  assert.match(sponsoredDealCardSource, /rounded-\[18px\]/);
  assert.match(sponsoredDealCardSource, /grid grid-cols-2 gap-2/);
  assert.match(sponsoredDealCardSource, /min-h-10/);
  assert.match(sponsoredDealCardSource, /whileHover=\{\{ y: -2 \}\}/);
```

Keep the existing assertions for `AIRPORT_HOME_AD_SLOTS`, `home_slot`, tag rendering, report-before-website order, `placement: 'deal_card'`, tracking URL normalization, and `rel="nofollow sponsored noopener noreferrer"`.

- [ ] **Step 2: Run the React source test and verify the new assertions fail for the old layout**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: FAIL in `React homepage uses shared five-slot commercial cards and plain summary scores` because `HomeSidebar` does not accept `deals`, the page still renders `SponsoredDeals` above the columns, and the cards still contain five-column/215px/stacked-action classes.

- [ ] **Step 3: Confirm the failure is contractual rather than an unrelated test error**

Read the failing assertion and confirm the actual source excerpt contains the old `sm:grid-cols-2 lg:grid-cols-5`, `min-h-[215px]`, or standalone `<SponsoredDeals>` structure. Do not edit production code until this red state is observed.

### Task 2: Move and resize the React sponsored area

**Files:**
- Modify: `src/pages/home/HomePageV3.tsx:299-327`
- Modify: `src/pages/home/HomePageV3.tsx:442-552`
- Modify: `src/pages/home/HomePageV3.tsx:710-779`
- Test: `backend/tests/frontendCrawlableLinks.test.ts`

- [ ] **Step 1: Pass the sponsored items into `HomeSidebar` and remove the standalone section**

Change the loaded homepage body to:

```tsx
              <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
                  <div className="lg:col-span-8">
                    <RankingPreview
                      items={data.ranking_preview?.items || []}
                      date={data.date}
                    />
                  </div>
                  <HomeSidebar
                    news={data.news_updates || []}
                    deals={data.sponsored_deals?.items || []}
                  />
                </div>
              </section>
```

There must be no `SponsoredDeals` call between the fragment opening and this twelve-column section.

- [ ] **Step 2: Convert `SponsoredDeals` from a page-width section into a sidebar section**

Use the existing mapping and empty-state logic with this outer structure:

```tsx
    <section id="today-discovery-section" aria-labelledby="sponsored-deals-title" className="space-y-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
      <div className="space-y-3 border-b border-gray-100 pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 id="sponsored-deals-title" className="text-[17px] font-black tracking-tight text-gray-900 sm:text-[18px]">商业合作专区</h2>
          <span className="flex items-center gap-1 rounded-md border border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-amber-700">
            <Sparkles className="h-3 w-3 text-amber-500" /> 广告展位
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11.5px] font-medium text-gray-400">独立于机场评分 · 官方合作招商中</span>
          <RouteLink href="/apply" className="text-[11.5px] font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">申请入驻 &gt;</RouteLink>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {AIRPORT_HOME_AD_SLOTS.map((slot) => {
          const deal = dealsBySlot.get(slot);
          return deal
            ? <SponsoredDealCard key={deal.campaign_id} deal={deal} />
            : <SponsoredEmptySlot key={`empty-deal-${slot}`} slot={slot} />;
        })}
      </div>
      {deals.length === 0 ? <span className="sr-only">当前暂无有效广告</span> : null}
    </section>
```

- [ ] **Step 3: Apply the compact occupied-card dimensions without changing fields or tracking**

Change only layout and interaction classes around the existing field rendering:

```tsx
    <motion.article
      ref={ref}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative flex min-h-[196px] flex-col justify-between overflow-hidden rounded-[18px] border border-gray-200 bg-gradient-to-b from-slate-50/60 to-white p-4 shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md motion-reduce:transform-none"
    >
```

Replace the stacked action wrapper with a two-column wrapper and ensure both links are 40px or taller:

```tsx
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <RouteLink
            href={deal.report_url}
            className="flex min-h-10 w-full items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-stone-900 bg-stone-900 px-2 py-2 text-center text-[12px] font-black leading-none text-white shadow-sm hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-500 focus-visible:ring-offset-2"
          >
            查看报告 <span className="text-[10px]">&gt;</span>
          </RouteLink>
```

Apply the same `min-h-10`, `focus-visible:outline-none`, `focus-visible:ring-2`, and `focus-visible:ring-offset-2` pattern to the existing website anchor. Preserve its `href`, `target`, `rel`, `onClick`, label, and external-link icon exactly.

- [ ] **Step 4: Resize empty slots without inventing fields**

Use an auto-growing compact empty card:

```tsx
    <RouteLink href="/apply" className="group relative flex min-h-[140px] flex-col items-center justify-between overflow-hidden rounded-[18px] border border-dashed border-gray-300 bg-gray-50/70 p-4 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2">
```

Add `min-h-10` to the existing “联系商务合作” element. Keep the slot number and application link unchanged.

- [ ] **Step 5: Insert the sponsored area immediately after the exploration panel**

Change the sidebar signature and ordering to:

```tsx
function HomeSidebar({ news, deals }: { news: NewsUpdate[]; deals: SponsoredDeal[] }) {
  return (
    <aside className="space-y-6 lg:col-span-4" aria-label="工具、商业合作与最新动态">
```

Insert the sponsored component between the closing tag of the exploration section and the opening tag of the tools section:

```tsx
      </section>

      <SponsoredDeals deals={deals} />

      <section className="space-y-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
```

Do not change the exploration copy, tools, or news data.

- [ ] **Step 6: Run the React source regression**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts
```

Expected: all tests in the file PASS with zero failures.

- [ ] **Step 7: Run the frontend type checker**

Run:

```bash
npm run lint
```

Expected: exit code 0 and no TypeScript errors.

- [ ] **Step 8: Commit the React slice**

```bash
git add src/pages/home/HomePageV3.tsx backend/tests/frontendCrawlableLinks.test.ts
git commit -m "feat: move homepage ads into sidebar"
```

### Task 3: Lock the SSR sidebar order and compact CSS with a failing route regression

**Files:**
- Modify: `backend/tests/publicPageRoutes.test.ts:105-133`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Add SSR hierarchy assertions before the existing field assertions**

After confirming the sponsored heading, add:

```ts
        const sidebarStart = html.indexOf('<aside class="home-v3-sidebar"');
        const sidebarEnd = html.indexOf('</aside>', sidebarStart);
        const exploreStart = html.indexOf('探索更多优质机场', sidebarStart);
        const sponsoredStart = html.indexOf('<h2 id="home-v3-sponsored-title">商业合作专区</h2>', sidebarStart);
        const toolsStart = html.indexOf('网络工具箱', sidebarStart);
        const newsStart = html.indexOf('公告与动态', sidebarStart);

        assert.notEqual(sidebarStart, -1);
        assert.notEqual(sidebarEnd, -1);
        assert.ok(sidebarStart < exploreStart);
        assert.ok(exploreStart < sponsoredStart);
        assert.ok(sponsoredStart < toolsStart);
        assert.ok(toolsStart < newsStart);
        assert.ok(newsStart < sidebarEnd);
```

- [ ] **Step 2: Replace obsolete grid and dimension assertions**

Replace the five-column, two-column media-query, 264px card, and one-column action assertions with:

```ts
        assert.match(html, /\.home-v3-deal-grid\s*\{[^}]*grid-template-columns:\s*1fr;[^}]*gap:\s*12px;/);
        assert.doesNotMatch(html, /\.home-v3-deal-grid\s*\{[^}]*repeat\(5,minmax\(0,1fr\)\)/);
        assert.match(html, /\.home-v3-deal\s*\{[^}]*min-height:\s*196px;[^}]*border-radius:\s*18px;[^}]*padding:\s*16px;/);
        assert.match(html, /\.home-v3-deal-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\);[^}]*gap:\s*8px;/);
        assert.match(html, /\.home-v3-deal-actions a\s*\{[^}]*min-height:\s*40px;/);
        assert.match(html, /\.home-v3-sidebar > \.home-v3-explore\s*\{[^}]*background:\s*#1e1b4b;[^}]*color:\s*#fff;/);
```

Keep all existing assertions for five cards, the fifth empty slot, title, tracking days, discount title, coupon, tags, price, report URL, website URL, `target`, and `rel`.

- [ ] **Step 3: Run the SSR public route test and verify red state**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: FAIL because the sponsored section is still outside `.home-v3-sidebar`, SSR lacks the exploration panel, the grid uses five columns, and actions use one column.

### Task 4: Mirror the sidebar hierarchy and compact cards in SSR

**Files:**
- Modify: `backend/src/services/publicPageRenderer.ts:232-241`
- Modify: `backend/src/services/publicPageRenderer.ts:2139-2181`
- Modify: `backend/src/services/publicPageRenderer.ts:2221-2250`
- Modify: `backend/src/services/publicPageRenderer.ts:3575-3625`
- Modify: `backend/src/services/publicPageRenderer.ts:3674-3697`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [ ] **Step 1: Remove the top-level SSR sponsored section**

Change `.home-v3-main` to:

```ts
        <div class="home-v3-main">
          <div class="home-v3-columns">
            ${renderHomeV3Ranking(view)}
            ${renderHomeV3Sidebar(view)}
          </div>
          ${renderHomeV3Summaries(view)}
          ${renderHomeV3Trust()}
          ${renderHomeV3Faq()}
        </div>
```

- [ ] **Step 2: Give the SSR sponsored section a sidebar-targetable class**

Change the opening tag in `renderHomeV3SponsoredDeals` to:

```ts
    <section class="home-v3-sponsored" aria-labelledby="home-v3-sponsored-title">
```

Do not remove coupon code, tags, price, report, website, empty slots, or sponsored link attributes.

- [ ] **Step 3: Add the SSR exploration panel and then render sponsored deals**

At the start of `renderHomeV3Sidebar`, before the tools section, render:

```ts
      <section class="home-v3-explore">
        <span>EXCELLENCE IN CONSOLIDATION</span>
        <h2>探索更多优质机场</h2>
        <p>想快速找出适合特定需求的高阶中转网络么？寻找配有电竞游戏级别优化、4K Netflix HDR高流控或双向原生 IP 的高级套餐通道。</p>
        <a href="/rankings/all">立即探索 <span aria-hidden="true">→</span></a>
      </section>
      ${renderHomeV3SponsoredDeals(view)}
```

Update the aside label to `工具、商业合作与最新动态`. Leave tools and news after the sponsored call.

- [ ] **Step 4: Apply compact single-column SSR styles**

Replace the old sponsored layout declarations with these values while preserving unrelated selectors:

```css
  .home-v3-deal-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .home-v3-deal { display: flex; min-height: 196px; flex-direction: column; border: 1px solid #e5e5e5; border-radius: 18px; background: #fff; padding: 16px; box-shadow: 0 4px 20px rgba(15,23,42,.04); }
  .home-v3-deal-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; margin-top: 10px; }
  .home-v3-deal-actions a { display: flex; width: 100%; min-height: 40px; box-sizing: border-box; align-items: center; justify-content: center; border: 1px solid #e5e5e5; border-radius: 10px; font-size: 10px; font-weight: 900; text-decoration: none; }
```

Add exploration-panel styles after the generic sidebar card selector so they win the cascade:

```css
  .home-v3-sidebar > .home-v3-explore { position: relative; border-color: #1e1b4b; background: #1e1b4b; color: #fff; }
  .home-v3-explore > span { color: #fcd34d; font-size: 10px; font-weight: 900; letter-spacing: .08em; }
  .home-v3-explore h2 { margin: 10px 0 0; color: #fff; font-size: 20px; line-height: 1.2; }
  .home-v3-explore p { margin: 10px 0 0; color: #e0e7ff; font-size: 12px; line-height: 1.7; }
  .home-v3-explore > a { display: inline-flex; min-height: 40px; align-items: center; gap: 5px; margin-top: 14px; border: 1px solid rgba(255,255,255,.12); border-radius: 12px; background: rgba(255,255,255,.08); padding: 0 16px; color: #c7d2fe; font-size: 12px; font-weight: 900; text-decoration: none; }
```

Remove `.home-v3-deal-grid` from the `max-width: 900px` and `max-width: 600px` grid overrides because it is already one column at every width. Keep summary, trust, and FAQ responsive rules unchanged.

- [ ] **Step 5: Run the SSR route regression**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: all tests in the file PASS with zero failures.

- [ ] **Step 6: Run the server type checker**

Run:

```bash
npm run server:typecheck
```

Expected: exit code 0 and no TypeScript errors.

- [ ] **Step 7: Commit the SSR slice**

```bash
git add backend/src/services/publicPageRenderer.ts backend/tests/publicPageRoutes.test.ts
git commit -m "feat: align homepage sidebar SSR ads"
```

### Task 5: Verify visual behavior and complete the regression suite

**Files:**
- Modify only if verification exposes a scoped layout defect: `src/pages/home/HomePageV3.tsx`, `backend/src/services/publicPageRenderer.ts`, or their two focused tests.
- Verify: React homepage and SSR homepage.

- [ ] **Step 1: Start the local frontend and API needed by the existing development workflow**

Run the repository’s normal local services without changing production state. At minimum:

```bash
npm run dev
```

Expected: Vite listens on `http://127.0.0.1:3000`. If the homepage API is not already available, start `npm run server:dev` in a second terminal using the existing local environment.

- [ ] **Step 2: Inspect desktop layout in a real browser**

At approximately 1440px viewport width, verify:

- the ranking remains in the eight-column main region;
- the right sidebar order is exploration, commercial section, tools, news;
- all five ad slots are full-width and one per row;
- occupied cards retain name, observation days, offer title, two tags, price, report, and website;
- actions are equal-width, at least 40px high, and do not wrap;
- the sidebar card width aligns with exploration and tools containers;
- hover movement is restrained and keyboard focus is visible.

Do not click production outbound links; use local links only and inspect attributes when a click would create marketing events.

- [ ] **Step 3: Inspect tablet and phone layout**

At approximately 768px and 390px viewport widths, verify:

- ranking precedes the former sidebar;
- exploration, ads, tools, and news preserve order;
- ads remain one per row;
- no horizontal overflow occurs;
- no field is clipped;
- both actions remain usable and touch targets are at least 40px.

- [ ] **Step 4: Compare SSR and hydrated structure**

Inspect the initial document HTML and the hydrated React page. Confirm the sponsored area appears inside the sidebar and after exploration in both, with no visible location jump during hydration.

- [ ] **Step 5: Run focused tests again after visual adjustments**

Run:

```bash
npx tsx --test backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
```

Expected: both files complete with zero failures.

- [ ] **Step 6: Run the full verification matrix sequentially and record each exit code**

Run each command separately so output is not truncated or mistaken for another command’s result:

```bash
npm run test:backend
npm run lint
npm run server:typecheck
npm run build
git diff --check
git status --short
```

Expected: backend tests report zero failures; both TypeScript commands exit 0; Vite production build exits 0; `git diff --check` prints nothing. `git status --short` may show only the intentional plan or any final scoped verification adjustment not yet committed.

- [ ] **Step 7: Commit any scoped verification adjustment**

If browser verification required a layout correction, stage only the related homepage renderer and test files, then commit:

```bash
git add src/pages/home/HomePageV3.tsx backend/src/services/publicPageRenderer.ts backend/tests/frontendCrawlableLinks.test.ts backend/tests/publicPageRoutes.test.ts
git commit -m "fix: refine homepage sidebar ad layout"
```

If no adjustment was needed, do not create an empty commit.

- [ ] **Step 8: Report completion evidence without pushing or deploying**

Report the changed files, desktop/tablet/mobile findings, focused test counts, full backend test count, type-check/build exit codes, commit hashes, and final working-tree status. Explicitly state that production was not deployed.
