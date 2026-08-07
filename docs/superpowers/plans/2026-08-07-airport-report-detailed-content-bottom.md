# Airport Report Detailed Content Bottom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the collapsed airport report summary with a fully visible, data-backed detailed report at the bottom of every airport page while preserving SSR and React parity.

**Architecture:** Keep `shared/publicSeo.ts` as the single content-data builder, but return structured label/value/link facts instead of presentation-ready strings. React and the backend renderer consume the same sections as semantic articles and definition lists; shared navigation order follows the new DOM order.

**Tech Stack:** TypeScript, React, Express SSR, Tailwind CSS, shared TypeScript helpers, Node test runner through `tsx`, Vite

---

### Task 1: Lock the new order, semantics, and navigation with failing tests

**Files:**
- Modify: `backend/tests/publicPageRoutes.test.ts:1295-1495`
- Modify: `backend/tests/frontendReportPage.test.ts`
- Modify: `backend/tests/reportUi.test.ts`

- [x] **Step 1: Replace the old SSR accordion expectations**

In the report route test, remove expectations for `report-content-summary` and closed `<details>`. Add assertions for the new title and semantic structure:

```ts
assert.match(okHtml, /<h2>星云机场 详细测评数据<\/h2>/);
assert.doesNotMatch(okHtml, /report-content-summary/);
assert.doesNotMatch(okHtml, /<details class="report-content-detail">/);
assert.doesNotMatch(okHtml, /详细解读已折叠保留/);
assert.match(okHtml, /<article class="report-content-detail">/);
assert.match(okHtml, /<h3>综合结论<\/h3>/);
assert.match(okHtml, /<dl class="report-content-facts">/);
assert.match(okHtml, /<dt>今日推荐排名<\/dt>\s*<dd>#1<\/dd>/);
assert.match(okHtml, /<dt>性价比排名<\/dt>\s*<dd>未上榜<\/dd>/);
assert.match(okHtml, /<dt>节点地区数<\/dt>\s*<dd>1 个<\/dd>/);
assert.match(okHtml, /<dt>已收录节点总数<\/dt>\s*<dd>6 个<\/dd>/);
assert.match(okHtml, /<dt>客户端支持<\/dt>\s*<dd>Clash、Shadowrocket<\/dd>/);
assert.match(okHtml, /href="https:\/\/t\.me\/nebula_group" target="_blank" rel="nofollow noreferrer noopener"/);
```

Verify the section is last in raw HTML:

```ts
const faqStart = okHtml.indexOf('<h2>常见问题</h2>');
const detailedContentStart = okHtml.indexOf('<section id="report-content"');
assert.notEqual(faqStart, -1);
assert.notEqual(detailedContentStart, -1);
assert.ok(faqStart < detailedContentStart);
```

- [x] **Step 2: Add React source-order and semantics assertions**

In `backend/tests/frontendReportPage.test.ts`, read the `ReportContentV2` and `ReportContentNarrative` slices and assert:

```ts
assert.ok(contentV2Source.indexOf('<ReportConclusion') < contentV2Source.indexOf('<ReportContentNarrative'));
assert.match(narrativeSource, /详细测评数据/);
assert.match(narrativeSource, /<article/);
assert.match(narrativeSource, /<dl/);
assert.match(narrativeSource, /<dt/);
assert.match(narrativeSource, /<dd/);
assert.doesNotMatch(narrativeSource, /<details/);
assert.doesNotMatch(narrativeSource, /<summary/);
assert.doesNotMatch(narrativeSource, /buildReportContentSummary/);
```

- [x] **Step 3: Update the navigation-order expectations**

In `backend/tests/reportUi.test.ts`, add:

```ts
assert.deepEqual(REPORT_ANCHOR_SECTIONS.at(-1), {
  id: 'report-content',
  label: '详细测评',
});
```

Update the reading-line assertions for the new order and change the document-end expectation to `report-content`.

- [x] **Step 4: Run focused tests and verify they fail for the intended old behavior**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts backend/tests/frontendReportPage.test.ts backend/tests/reportUi.test.ts
```

Expected: FAIL because the current SSR and React render closed `<details>`, the detailed content is near the top, and `report-content` is the second navigation item.

### Task 2: Build complete structured report facts from real view data

**Files:**
- Modify: `shared/publicSeo.ts:193-202`
- Modify: `shared/publicSeo.ts:1090-1207`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [x] **Step 1: Replace summary and string facts with structured facts**

Define:

```ts
export interface PublicReportContentFact {
  label: string;
  value: string;
  href?: string;
}

export interface PublicReportContentSection {
  title: string;
  body: string;
  facts: PublicReportContentFact[];
}
```

Remove `PublicReportContentSummary` and `buildReportContentSummary()` because the duplicated top summary is no longer rendered.

- [x] **Step 2: Add complete-list and exact-value helpers**

Add helpers with explicit missing-data behavior:

```ts
function buildCompleteListSummary(items: Array<{ label: string }>, emptyLabel = '未收录'): string {
  return items.length > 0 ? items.map((item) => item.label).join('、') : emptyLabel;
}

function formatReportRank(value: number | null): string {
  return typeof value === 'number' ? `#${value}` : '未上榜';
}

function formatReportRegionDetail(region: PublicReportSeoView['capabilities']['regions'][number]): string {
  const parts = [region.node_count > 0 ? `${region.node_count} 节点` : '节点数量未收录'];
  if (region.line_types.length > 0) parts.push(region.line_types.join('/'));
  if (region.has_native_ip === true) parts.push('原生 IP');
  if (region.has_residential === true) parts.push('家宽');
  return parts.join(' · ');
}
```

Calculate node totals with `reduce()` and do not treat zero as unavailable.

- [x] **Step 3: Rebuild all eight shared sections**

Return the confirmed sections with exact facts. The comprehensive section includes all five ranking facts:

```ts
facts: [
  { label: '数据日期', value: view.date },
  { label: '公开总分', value: score },
  { label: '当前状态', value: statusLabel },
  { label: '综合评级', value: buildScoreGradeText(view.summary_card.score) },
  { label: '今日推荐排名', value: formatReportRank(view.ranking.today_pick_rank) },
  { label: '长期稳定排名', value: formatReportRank(view.ranking.most_stable_rank) },
  { label: '性价比排名', value: formatReportRank(view.ranking.best_value_rank) },
  { label: '新入榜排名', value: formatReportRank(view.ranking.new_entries_rank) },
  { label: '风险预警排名', value: formatReportRank(view.ranking.risk_alerts_rank) },
]
```

The nodes section appends one fact per region and full client/import/streaming lists. The Telegram section returns link facts only when URLs exist:

```ts
{
  label: 'Telegram 群链接',
  value: telegram.group_url || '未收录',
  ...(telegram.group_url ? { href: telegram.group_url } : {}),
}
```

Use `formatNullableSupportText()` for recorded booleans and `formatOptionalCurrencyText()` for prices. Keep hidden scores as `暂不公开` and use `未收录` for missing lists, URLs, member count, and activity time.

- [x] **Step 4: Run the route test to validate real fixture data**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: it still fails on markup/order until renderer work is complete, but TypeScript execution reaches the new structured data without exceptions or missing-value artifacts.

### Task 3: Move and render the React detailed report

**Files:**
- Modify: `src/App.tsx:63-72`
- Modify: `src/App.tsx:4821-4966`
- Modify: `shared/reportUi.ts:1-11`
- Test: `backend/tests/frontendReportPage.test.ts`
- Test: `backend/tests/reportUi.test.ts`

- [x] **Step 1: Move `ReportContentNarrative` after the conclusion**

Remove its current position directly after `ReportHeroV2`, and render it after:

```tsx
<ReportPlanTelegramSection data={data} />
<ReportConclusion data={data} rankPairs={rankPairs} />
<ReportContentNarrative data={data} />
```

- [x] **Step 2: Replace the accordion with semantic visible content**

Remove `buildReportContentSummary` usage and render:

```tsx
<section id="report-content" className="scroll-mt-36 rounded-[8px] border border-slate-200 bg-white p-5 md:p-6">
  <ReportSectionTitle title={`${data.airport.name} 详细测评数据`} />
  <div className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
    {sections.map((section) => (
      <article key={section.title} className="py-6 first:pt-5 last:pb-5">
        <h3 className="text-base font-black tracking-tight text-slate-950 md:text-lg">{section.title}</h3>
        <p className="mt-3 text-sm leading-8 text-slate-600">{section.body}</p>
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {section.facts.map((fact) => (
            <div key={fact.label} className="min-w-0 rounded-[8px] bg-slate-50 px-3 py-3">
              <dt className="text-xs font-bold text-slate-500">{fact.label}</dt>
              <dd className="mt-1 min-w-0 break-words text-sm font-black text-slate-950">
                {fact.href ? (
                  <a href={normalizeExternalHref(fact.href)} target="_blank" rel="nofollow noreferrer noopener" className="inline-flex min-h-10 items-center break-all text-blue-600 underline decoration-blue-200 underline-offset-4">
                    {fact.value}
                  </a>
                ) : fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </article>
    ))}
  </div>
  <ReportComparisonLinks data={data} />
</section>
```

- [x] **Step 3: Move the shared navigation item to the end**

Set `REPORT_ANCHOR_SECTIONS` order to overview, snapshot, capabilities, score, metrics, trends, plan/telegram, conclusion, then:

```ts
{ id: 'report-content', label: '详细测评' },
```

- [x] **Step 4: Run React and navigation tests**

Run:

```bash
npx tsx --test backend/tests/frontendReportPage.test.ts backend/tests/reportUi.test.ts
```

Expected: PASS with the detailed content after the conclusion and `report-content` active at document end.

### Task 4: Move and render the SSR detailed report

**Files:**
- Modify: `backend/src/services/publicPageRenderer.ts:34-44`
- Modify: `backend/src/services/publicPageRenderer.ts:1110-1188`
- Modify: `backend/src/services/publicPageRenderer.ts:3382-3477`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [x] **Step 1: Move the SSR section after FAQ**

Remove `${renderReportContentSections(view)}` after the Hero and append it after `${renderReportFaq(faqItems)}`.

- [x] **Step 2: Render semantic articles and definition lists**

Remove `buildReportContentSummary` import and replace `renderReportContentSections()` markup with:

```ts
<section id="report-content" class="report-section report-content report-anchor-target">
  <h2>${escapeHtml(view.airport.name)} 详细测评数据</h2>
  <div class="report-content-details">
    ${sections.map((section) => `
      <article class="report-content-detail">
        <h3>${escapeHtml(section.title)}</h3>
        <p>${escapeHtml(section.body)}</p>
        <dl class="report-content-facts">
          ${section.facts.map((fact) => `
            <div>
              <dt>${escapeHtml(fact.label)}</dt>
              <dd>${fact.href
                ? `<a href="${escapeAttribute(normalizeExternalHref(fact.href))}" target="_blank" rel="nofollow noreferrer noopener">${escapeHtml(fact.value)}</a>`
                : escapeHtml(fact.value)}</dd>
            </div>
          `).join('')}
        </dl>
      </article>
    `).join('')}
  </div>
  ${renderReportComparisonLinks(view)}
</section>
```

- [x] **Step 3: Replace old accordion CSS**

Delete `.report-content-summary`, `.report-content-chips`, `summary`, and pill-fact rules. Add a bordered divider layout, two-column definition list, `overflow-wrap:anywhere`, blue external links, a visible focus outline, and a mobile one-column rule under the existing report breakpoint.

- [x] **Step 4: Run the complete focused test set**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts backend/tests/frontendReportPage.test.ts backend/tests/reportUi.test.ts backend/tests/frontendCrawlableLinks.test.ts
```

Expected: PASS with no closed accordion markup, full real data in raw HTML, bottom placement, crawlable comparison links, and matching navigation order.

### Task 5: Verify browser layout, types, build, and commit

**Files:**
- Modify: `shared/publicSeo.ts`
- Modify: `shared/reportUi.ts`
- Modify: `src/App.tsx`
- Modify: `backend/src/services/publicPageRenderer.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`
- Modify: `backend/tests/frontendReportPage.test.ts`
- Modify: `backend/tests/reportUi.test.ts`
- Modify: `dist/assets/index.js`
- Create: `docs/superpowers/plans/2026-08-07-airport-report-detailed-content-bottom.md`

- [x] **Step 1: Run server and frontend type checking**

Run:

```bash
npm run server:typecheck
npm run lint
```

Expected: both commands exit 0 with no TypeScript errors.

- [x] **Step 2: Build the production bundle**

Run:

```bash
npm run build
```

Expected: Vite exits 0 and refreshes the tracked `dist/assets/index.js` bundle. Existing chunk-size warnings are non-blocking.

- [x] **Step 3: Verify desktop and mobile in the browser**

Use the existing Chrome session against the current local report page. At desktop width and a mobile width near 390px, verify:

- `详细测评数据` is the final report section.
- All eight topics are visible without clicking.
- Definition lists are two columns on desktop and one column on mobile.
- Long Telegram URLs and client names wrap without horizontal overflow.
- The fixed desktop nav ends with and activates `详细测评`.

- [x] **Step 4: Review and stage only task files**

Run:

```bash
git diff --check -- shared/publicSeo.ts shared/reportUi.ts src/App.tsx backend/src/services/publicPageRenderer.ts backend/tests/publicPageRoutes.test.ts backend/tests/frontendReportPage.test.ts backend/tests/reportUi.test.ts dist/assets/index.js docs/superpowers/plans/2026-08-07-airport-report-detailed-content-bottom.md
git status --short
```

Expected: task files contain only the approved report changes. Pre-existing `backend/src/services/paymentGatewayService.ts` and `backend/tests/paymentGatewayService.test.ts` remain unstaged and untouched.

- [x] **Step 5: Commit the implementation**

Run:

```bash
git add shared/publicSeo.ts shared/reportUi.ts src/App.tsx backend/src/services/publicPageRenderer.ts backend/tests/publicPageRoutes.test.ts backend/tests/frontendReportPage.test.ts backend/tests/reportUi.test.ts dist/assets/index.js docs/superpowers/plans/2026-08-07-airport-report-detailed-content-bottom.md
git commit -m "feat: show detailed airport report content"
```

Expected: one implementation commit containing the plan, shared data builder, SSR/React rendering, navigation, tests, and tracked bundle; payment gateway files remain unstaged.
