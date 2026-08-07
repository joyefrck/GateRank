# Airport Report Long-Tail Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand every airport report page's meta description and keywords with airport-specific price, USDT, plan, node, Telegram, usability, and client search intents without changing visible page content.

**Architecture:** Keep `buildReportSeo()` in `shared/publicSeo.ts` as the single source for SSR and React metadata. Extend its keyword list and replace only its description formatter with a bounded, data-backed long-tail summary; verify the server-rendered HTML and the missing-data fallback through focused tests.

**Tech Stack:** TypeScript, Express SSR, React metadata takeover, Node test runner through `tsx`

---

### Task 1: Lock the long-tail metadata contract with failing tests

**Files:**
- Modify: `backend/tests/publicPageRoutes.test.ts:1295-1475`
- Modify: `backend/tests/publicPageRoutes.test.ts:1608-1612`

- [x] **Step 1: Add a meta-keywords extractor and airport-specific assertions**

Add this helper beside `extractMetaDescription()`:

```ts
function extractMetaKeywords(html: string): string {
  const matched = html.match(/<meta name="keywords" content="([^"]+)"/);
  assert.ok(matched, 'meta keywords missing');
  return matched[1];
}
```

In `GET /airports/:slug renders report HTML and legacy reports redirect to stable URL`, assert the description contains the new intent terms and the actual fixture price:

```ts
assert.match(description, /价格多少/);
assert.match(description, /支持 USDT 吗/);
assert.match(description, /套餐和节点/);
assert.match(description, /电报群/);
assert.match(description, /支持哪些客户端/);
assert.match(description, /最低月付 ¥18/);
```

Then extract keywords and require every airport-specific phrase without duplicates:

```ts
const keywords = extractMetaKeywords(okHtml);
for (const keyword of [
  '星云机场价格多少',
  '星云机场套餐价格',
  '星云机场支持USDT吗',
  '星云机场有哪些节点',
  '星云机场电报群',
  '星云机场Telegram群',
  '星云机场是否值得使用',
  '星云机场是否支持使用',
  '星云机场支持哪些客户端',
]) {
  assert.ok(keywords.split(',').includes(keyword), `missing report keyword: ${keyword}`);
}
assert.equal(new Set(keywords.split(',')).size, keywords.split(',').length);
```

- [x] **Step 2: Add a missing-data regression test**

Import `buildReportSeo` from `../../shared/publicSeo` and add this focused test near the report route tests:

```ts
test('report long-tail metadata does not invent missing capability facts', () => {
  const seo = buildReportSeo({
    ...reportView,
    capabilities: {
      ...reportView.capabilities,
      plan: {
        ...reportView.capabilities.plan,
        lowest_monthly_price: null,
      },
      payment_methods: [],
      clients: [],
      regions: [],
    },
  });

  assert.match(seo.description, /价格信息/);
  assert.doesNotMatch(`${seo.description},${seo.keywords}`, /undefined|null|NaN|¥0/);
  assert.match(seo.description, /支持 USDT 吗/);
  assert.doesNotMatch(seo.description, /不支持 USDT/);
});
```

- [x] **Step 3: Run the focused test and confirm the new contract fails**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: FAIL because the current description lacks `价格多少` and the current keywords lack `星云机场价格多少` and the other new phrases.

### Task 2: Implement shared long-tail metadata generation

**Files:**
- Modify: `shared/publicSeo.ts:929-953`
- Test: `backend/tests/publicPageRoutes.test.ts`

- [x] **Step 1: Build a deduplicated keyword list in `buildReportSeo()`**

Compute the normalized `searchName` before the keyword list, then replace the string-concatenated airport keyword prefix with an array and `Set`:

```ts
const searchName = airportName ? buildReportSearchName(airportName) : undefined;
const airportKeywords = airportName
  ? [
      `${airportName}怎么样`,
      `${airportName}测评`,
      `${airportName}跑路`,
      `${airportName}官网`,
      `${searchName}测评`,
      `${airportName}价格多少`,
      `${airportName}套餐价格`,
      `${airportName}支持USDT吗`,
      `${airportName}有哪些节点`,
      `${airportName}电报群`,
      `${airportName}Telegram群`,
      `${airportName}是否值得使用`,
      `${airportName}是否支持使用`,
      `${airportName}支持哪些客户端`,
    ]
  : [];
const keywords = [
  ...airportKeywords,
  '机场榜GateRank',
  '机场测评报告',
  '机场评分',
  '机场趋势',
  '机场榜',
  '机场推荐',
  '机场官网',
  '跑路风险',
  'GateRank',
];
```

Return `keywords: [...new Set(keywords)].join(',')` while leaving title selection unchanged. The normalized `searchName` prevents names already ending in `机场` from producing `机场机场测评`.

- [x] **Step 2: Replace only the report description formatter**

Use the current view data without claiming unsupported capabilities:

```ts
function buildReportDescription(view: PublicReportSeoView, airportName: string, statusLabel: string): string {
  const score = formatPublicScoreText(view);
  const trendLabel = buildReportTrendLabel(view);
  const priceText = view.capabilities.plan.lowest_monthly_price === null
    ? '价格信息'
    : `最低月付 ${formatOptionalCurrencyText(view.capabilities.plan.lowest_monthly_price)}`;

  return `${airportName}价格多少、支持 USDT 吗、有哪些套餐和节点、是否有电报群、支持哪些客户端？${PUBLIC_SITE_BRAND_NAME}机场测评汇总${priceText}、支付方式、节点地区和客户端，并结合评分${score}、状态${statusLabel}、官网入口、稳定性、下载速度、延迟、代理请求失败率、${trendLabel}与跑路风险分析，帮助判断是否值得使用。`;
}
```

This keeps all previously tested report signals while adding the requested long-tail intent and a truthful missing-price fallback.

- [x] **Step 3: Run the focused test and confirm it passes**

Run:

```bash
npx tsx --test backend/tests/publicPageRoutes.test.ts
```

Expected: PASS with zero failing tests, including the report route and missing-data metadata cases.

### Task 3: Verify the complete metadata surface and commit

**Files:**
- Modify: `shared/publicSeo.ts`
- Modify: `backend/tests/publicPageRoutes.test.ts`
- Modify: `dist/assets/index.js`
- Create: `docs/superpowers/plans/2026-08-07-airport-report-long-tail-meta.md`

- [x] **Step 1: Run server type checking**

Run:

```bash
npm run server:typecheck
```

Expected: exit code 0 with no TypeScript errors.

- [x] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: exit code 0 and a successful Vite production build.

- [x] **Step 3: Review the exact diff and whitespace**

Run:

```bash
git diff --check
git diff -- shared/publicSeo.ts backend/tests/publicPageRoutes.test.ts dist/assets/index.js docs/superpowers/plans/2026-08-07-airport-report-long-tail-meta.md
```

Expected: no whitespace errors; only the shared metadata helper, its focused tests, the tracked production bundle, and this plan are changed by this task. The pre-existing payment gateway changes and Vite dependency-cache metadata remain unstaged and untouched.

- [x] **Step 4: Commit only the task files**

Run:

```bash
git add shared/publicSeo.ts backend/tests/publicPageRoutes.test.ts dist/assets/index.js docs/superpowers/plans/2026-08-07-airport-report-long-tail-meta.md
git commit -m "feat: expand airport report long-tail metadata"
```

Expected: one commit containing the plan, metadata implementation, regression tests, and tracked production bundle; `backend/src/services/paymentGatewayService.ts`, `backend/tests/paymentGatewayService.test.ts`, and `node_modules/.vite/deps/_metadata.json` remain unstaged.
