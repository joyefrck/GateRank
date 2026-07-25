# GateRank Public Page Analytics Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every valid public HTML page contribute exactly one correctly classified page view to GateRank Admin analytics while keeping private, machine-readable, redirect, download, and error routes excluded.

**Architecture:** Define marketing page kinds and Chinese labels once in a shared module, then derive client, backend, and Admin behavior from it. Keep React-owned page views client-side, keep News, publish-token docs, and `/for-ai` server-side, and replace the MySQL ENUM with an application-validated `VARCHAR(64)` so future public page additions cannot be blocked by schema drift.

**Tech Stack:** TypeScript 5.8, React 19, Express 4, MySQL 8, Node test runner, Vite 6

---

### Task 1: Centralize page kinds and make React route coverage exhaustive

**Files:**
- Create: `shared/marketingAnalytics.ts`
- Create: `src/site/marketingRoutes.ts`
- Create: `backend/tests/marketingPageKinds.test.ts`
- Modify: `src/site/marketing.ts`
- Modify: `src/App.tsx`
- Modify: `src/admin/AdminApp.tsx`
- Modify: `backend/src/types/domain.ts`

- [ ] **Step 1: Add a failing shared registry and client mapping test**

Create `backend/tests/marketingPageKinds.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MARKETING_PAGE_KINDS,
  getMarketingPageKindLabel,
  isMarketingPageKind,
} from '../../shared/marketingAnalytics';
import {
  MARKETING_PAGE_KIND_BY_ROUTE,
  toMarketingPageKind,
} from '../../src/site/marketingRoutes';

test('marketing page kind registry covers every public HTML module', () => {
  assert.deepEqual(MARKETING_PAGE_KINDS, [
    'home',
    'full_ranking',
    'risk_monitor',
    'report',
    'deals',
    'methodology',
    'news',
    'apply',
    'publish_token_docs',
    'monthly_reports',
    'monthly_report',
    'ranking_transparency',
    'tools_download',
    'streaming_check',
    'ip_check',
    'dns_leak_test',
    'for_ai',
  ]);
  assert.equal(getMarketingPageKindLabel('deals'), '活动优惠');
  assert.equal(getMarketingPageKindLabel('monthly_report'), '月报详情');
  assert.equal(getMarketingPageKindLabel('dns_leak_test'), 'DNS 泄漏检测');
  assert.equal(getMarketingPageKindLabel('unexpected_kind'), 'unexpected_kind');
  assert.equal(isMarketingPageKind('for_ai'), true);
  assert.equal(isMarketingPageKind('unexpected_kind'), false);
});

test('React route mapping explicitly classifies or excludes every route kind', () => {
  assert.deepEqual(MARKETING_PAGE_KIND_BY_ROUTE, {
    home: 'home',
    report: 'report',
    apply: 'apply',
    portal: null,
    full_ranking: 'full_ranking',
    monthly_reports: 'monthly_reports',
    monthly_report: 'monthly_report',
    deals: 'deals',
    risk_monitor: 'risk_monitor',
    methodology: 'methodology',
    ranking_transparency: 'ranking_transparency',
    publish_token_docs: 'publish_token_docs',
    tools_download: 'tools_download',
    streaming_check: 'streaming_check',
    ip_check: 'ip_check',
    dns_leak_test: 'dns_leak_test',
    not_found: null,
  });
  for (const [routeKind, expected] of Object.entries(MARKETING_PAGE_KIND_BY_ROUTE)) {
    assert.equal(
      toMarketingPageKind(routeKind as keyof typeof MARKETING_PAGE_KIND_BY_ROUTE),
      expected,
    );
  }
});

test('every registered page kind has a human-readable label', () => {
  for (const pageKind of MARKETING_PAGE_KINDS) {
    assert.notEqual(getMarketingPageKindLabel(pageKind), '');
    assert.notEqual(getMarketingPageKindLabel(pageKind), pageKind);
  }
});
```

- [ ] **Step 2: Run the new test and verify failure**

Run:

```bash
npx tsx --test backend/tests/marketingPageKinds.test.ts
```

Expected: FAIL because `shared/marketingAnalytics.ts` and
`src/site/marketingRoutes.ts` do not exist.

- [ ] **Step 3: Implement the shared registry**

Create `shared/marketingAnalytics.ts`:

```ts
export const MARKETING_PAGE_KIND_LABELS = {
  home: '首页',
  full_ranking: '全量榜单',
  risk_monitor: '跑路监测',
  report: '机场报告',
  deals: '活动优惠',
  methodology: '测评方法',
  news: 'News',
  apply: '申请页',
  publish_token_docs: '发布文档',
  monthly_reports: '月报中心',
  monthly_report: '月报详情',
  ranking_transparency: '排名独立性声明',
  tools_download: '工具下载',
  streaming_check: '流媒体检测',
  ip_check: 'IP 检测',
  dns_leak_test: 'DNS 泄漏检测',
  for_ai: 'AI 数据入口',
} as const;

export type MarketingPageKind = keyof typeof MARKETING_PAGE_KIND_LABELS;

export const MARKETING_PAGE_KINDS = Object.freeze(
  Object.keys(MARKETING_PAGE_KIND_LABELS) as MarketingPageKind[],
);

export function isMarketingPageKind(value: unknown): value is MarketingPageKind {
  return typeof value === 'string'
    && Object.prototype.hasOwnProperty.call(MARKETING_PAGE_KIND_LABELS, value);
}

export function getMarketingPageKindLabel(value: string): string {
  return isMarketingPageKind(value)
    ? MARKETING_PAGE_KIND_LABELS[value]
    : value;
}
```

- [ ] **Step 4: Implement an exhaustive React route map**

Create `src/site/marketingRoutes.ts`:

```ts
import type { MarketingPageKind } from '../../shared/marketingAnalytics';

export type AppRouteKind =
  | 'home'
  | 'report'
  | 'apply'
  | 'portal'
  | 'full_ranking'
  | 'monthly_reports'
  | 'monthly_report'
  | 'deals'
  | 'risk_monitor'
  | 'methodology'
  | 'ranking_transparency'
  | 'publish_token_docs'
  | 'tools_download'
  | 'streaming_check'
  | 'ip_check'
  | 'dns_leak_test'
  | 'not_found';

export const MARKETING_PAGE_KIND_BY_ROUTE = {
  home: 'home',
  report: 'report',
  apply: 'apply',
  portal: null,
  full_ranking: 'full_ranking',
  monthly_reports: 'monthly_reports',
  monthly_report: 'monthly_report',
  deals: 'deals',
  risk_monitor: 'risk_monitor',
  methodology: 'methodology',
  ranking_transparency: 'ranking_transparency',
  publish_token_docs: 'publish_token_docs',
  tools_download: 'tools_download',
  streaming_check: 'streaming_check',
  ip_check: 'ip_check',
  dns_leak_test: 'dns_leak_test',
  not_found: null,
} as const satisfies Record<AppRouteKind, MarketingPageKind | null>;

export function toMarketingPageKind(routeKind: AppRouteKind): MarketingPageKind | null {
  return MARKETING_PAGE_KIND_BY_ROUTE[routeKind];
}
```

Use individual route kinds for the three tools rather than the current
`tool_placeholder` umbrella. This keeps the route map and Admin categories
one-to-one.

- [ ] **Step 5: Integrate the shared types and route map**

In `src/site/marketing.ts`, remove the local `MarketingPageKind` union and add:

```ts
import type { MarketingPageKind } from '../../shared/marketingAnalytics';
export type { MarketingPageKind } from '../../shared/marketingAnalytics';
```

In `backend/src/types/domain.ts`, remove the local `MarketingPageKind` union and
re-export the shared type:

```ts
import type { MarketingPageKind } from '../../../shared/marketingAnalytics';
export type { MarketingPageKind } from '../../../shared/marketingAnalytics';
```

In `src/admin/AdminApp.tsx`, import:

```ts
import {
  getMarketingPageKindLabel,
  type MarketingPageKind,
} from '../../shared/marketingAnalytics';
```

Remove the local `MarketingPageKind` union. Replace:

```tsx
{formatMarketingPageKind(item.page_kind)}
```

with:

```tsx
{getMarketingPageKindLabel(item.page_kind)}
```

Delete `formatMarketingPageKind`. Unknown stored values must display their raw
value rather than being mislabeled as “发布文档”.

In `src/App.tsx`:

1. Import `type AppRouteKind` and `toMarketingPageKind`.
2. Change `RouteState.kind` to `AppRouteKind`.
3. Remove `toolPlaceholder`.
4. Parse each tool route directly:

```ts
const streamingCheckMatch = path.match(/^\/tools\/streaming-check\/?$/);
const ipCheckMatch = path.match(/^\/tools\/ip-check\/?$/);
const dnsLeakTestMatch = path.match(/^\/tools\/dns-leak-test\/?$/);

if (streamingCheckMatch) return { kind: 'streaming_check' };
if (ipCheckMatch) return { kind: 'ip_check' };
if (dnsLeakTestMatch) return { kind: 'dns_leak_test' };
```

5. Replace the `tool_placeholder` render branch with:

```tsx
if (route.kind === 'streaming_check') return <StreamingCheckPage />;
if (route.kind === 'ip_check') return <IPCheckPage />;
if (route.kind === 'dns_leak_test') return <DNSLeakTestPage />;
```

6. Remove the local `toMarketingPageKind` function.

- [ ] **Step 6: Run the focused test and client typecheck**

Run:

```bash
npx tsx --test backend/tests/marketingPageKinds.test.ts
npm run lint
```

Expected: PASS with no missing `AppRouteKind` mapping or local page-kind type
drift.

- [ ] **Step 7: Commit the shared registry and exhaustive client mapping**

```bash
git add \
  shared/marketingAnalytics.ts \
  src/site/marketingRoutes.ts \
  src/site/marketing.ts \
  src/App.tsx \
  src/admin/AdminApp.tsx \
  backend/src/types/domain.ts \
  backend/tests/marketingPageKinds.test.ts
git commit -m "refactor: centralize marketing page kinds"
```

### Task 2: Accept every public page kind and migrate the database safely

**Files:**
- Modify: `backend/src/routes/publicRoutes.ts`
- Modify: `backend/src/repositories/marketingEventRepository.ts`
- Modify: `backend/sql/schema.sql`
- Modify: `backend/tests/publicRoutes.test.ts`
- Modify: `backend/tests/marketingEventRepository.test.ts`

- [ ] **Step 1: Add a failing API acceptance test**

Import `MARKETING_PAGE_KINDS` in `backend/tests/publicRoutes.test.ts` and add:

```ts
test('POST /marketing/events accepts every registered public page kind', async () => {
  const insertedRecords: MarketingEventInsertRecord[] = [];
  const app = express();
  app.use(express.json());
  app.use(createPublicRoutes({
    airportRepository: { getById: async () => null },
    airportApplicationRepository: { create: async () => 1 },
    metricsRepository: { getByAirportAndDate: async () => null },
    scoreRepository: {
      getByAirportAndDate: async () => null,
      getTrend: async () => [],
    },
    rankingRepository: { getRanking: async () => [] },
    publicViewService: {
      getHomePageView: async () => ({}),
      getFullRankingView: async () => ({}),
      getRiskMonitorView: async () => ({}),
      getReportView: async () => null,
    } as never,
    marketingRepository: {
      insertMany: async (records) => { insertedRecords.push(...records); },
    },
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/marketing/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'user-agent': 'coverage-test/1.0' },
      body: JSON.stringify({
        events: MARKETING_PAGE_KINDS.map((pageKind) => ({
          event_type: 'page_view',
          page_kind: pageKind,
          page_path: `/coverage/${pageKind}`,
          client_session_id: 'coverage-session',
        })),
      }),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(
      insertedRecords.map((record) => record.page_kind),
      MARKETING_PAGE_KINDS,
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close(
      (error) => (error ? reject(error) : resolve()),
    ));
  }
});
```

- [ ] **Step 2: Add failing repository migration tests**

Extend `backend/tests/marketingEventRepository.test.ts`:

```ts
test('MarketingEventRepository migrates legacy page kind ENUM to VARCHAR once', async () => {
  const queries: string[] = [];
  const repository = new MarketingEventRepository({
    query: async (sql: string, params?: unknown[]) => {
      queries.push(sql);
      if (sql.includes('SHOW COLUMNS FROM marketing_events LIKE ?')) {
        const field = String(params?.[0] || '');
        return [[{
          Field: field,
          Type: field === 'page_kind'
            ? "enum('home','full_ranking','risk_monitor')"
            : 'varchar(255)',
        }]];
      }
      if (sql.includes('SHOW INDEX')) return [[{ Key_name: 'existing' }]];
      return [[]];
    },
    execute: async () => [{}],
  } as never);

  await repository.ensureSchema();

  assert.equal(
    queries.filter((sql) => (
      /ALTER TABLE marketing_events\s+MODIFY COLUMN page_kind VARCHAR\(64\) NOT NULL/i
        .test(sql)
    )).length,
    1,
  );
});

test('MarketingEventRepository leaves an existing VARCHAR page kind unchanged', async () => {
  const queries: string[] = [];
  const repository = new MarketingEventRepository({
    query: async (sql: string, params?: unknown[]) => {
      queries.push(sql);
      if (sql.includes('SHOW COLUMNS FROM marketing_events LIKE ?')) {
        return [[{ Field: String(params?.[0] || ''), Type: 'varchar(64)' }]];
      }
      if (sql.includes('SHOW INDEX')) return [[{ Key_name: 'existing' }]];
      return [[]];
    },
    execute: async () => [{}],
  } as never);

  await repository.ensureSchema();

  assert.equal(
    queries.some((sql) => /MODIFY COLUMN page_kind/i.test(sql)),
    false,
  );
});
```

- [ ] **Step 3: Run the focused backend tests and verify failure**

Run:

```bash
npx tsx --test \
  backend/tests/publicRoutes.test.ts \
  backend/tests/marketingEventRepository.test.ts
```

Expected: FAIL because the backend whitelist and database schema still contain
the legacy page-kind ENUM.

- [ ] **Step 4: Derive backend validation from the shared registry**

In `backend/src/routes/publicRoutes.ts`:

```ts
import { isMarketingPageKind } from '../../../shared/marketingAnalytics';
```

Remove `MARKETING_PAGE_KINDS` and replace the page-kind validation with:

```ts
const pageKind = String(payload.page_kind || '');
if (!isMarketingPageKind(pageKind)) {
  throw new HttpError(400, 'BAD_REQUEST', `events[${index}].page_kind is invalid`);
}
```

The type guard narrows the returned value to `MarketingPageKind`.

- [ ] **Step 5: Implement the idempotent database migration**

Change the create-table definition in
`backend/src/repositories/marketingEventRepository.ts` and
`backend/sql/schema.sql` to:

```sql
page_kind VARCHAR(64) NOT NULL,
```

Extend `ColumnInfoRow`:

```ts
interface ColumnInfoRow extends RowDataPacket {
  Field: string;
  Type: string;
}
```

After `CREATE TABLE IF NOT EXISTS marketing_events`, call:

```ts
await this.ensurePageKindColumnType();
```

Add:

```ts
private async ensurePageKindColumnType(): Promise<void> {
  const [rows] = await this.pool.query<ColumnInfoRow[]>(
    'SHOW COLUMNS FROM marketing_events LIKE ?',
    ['page_kind'],
  );
  const currentType = String(rows[0]?.Type || '').trim().toLowerCase();
  if (currentType !== 'varchar(64)') {
    await this.pool.query(`
      ALTER TABLE marketing_events
      MODIFY COLUMN page_kind VARCHAR(64) NOT NULL
    `);
  }
}
```

Keep `idx_marketing_events_page_kind_date` unchanged.

- [ ] **Step 6: Run focused API and migration tests**

Run:

```bash
npx tsx --test \
  backend/tests/publicRoutes.test.ts \
  backend/tests/marketingEventRepository.test.ts
npm run server:typecheck
```

Expected: PASS. The API accepts all 17 shared page kinds, an old ENUM produces
one ALTER, and a current `VARCHAR(64)` produces none.

- [ ] **Step 7: Commit backend validation and schema compatibility**

```bash
git add \
  backend/src/routes/publicRoutes.ts \
  backend/src/repositories/marketingEventRepository.ts \
  backend/sql/schema.sql \
  backend/tests/publicRoutes.test.ts \
  backend/tests/marketingEventRepository.test.ts
git commit -m "fix: accept all public page analytics kinds"
```

### Task 3: Track server-rendered public pages without double counting

**Files:**
- Modify: `backend/src/utils/marketing.ts`
- Modify: `backend/src/routes/newsPublicRoutes.ts`
- Modify: `backend/src/routes/machineReadableRoutes.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/tests/marketingUtils.test.ts`
- Modify: `backend/tests/newsPublicRoutes.test.ts`
- Modify: `backend/tests/machineReadableRoutes.test.ts`

- [ ] **Step 1: Add a failing non-blocking server tracking helper test**

Extend `backend/tests/marketingUtils.test.ts` imports with
`trackServerMarketingPageView`, then add:

```ts
test('trackServerMarketingPageView records one normalized server page view', async () => {
  const records: MarketingEventInsertRecord[] = [];
  trackServerMarketingPageView(
    { insertMany: async (items) => { records.push(...items); } },
    stubRequest({
      headers: { 'user-agent': 'coverage-test/1.0' },
      ip: '127.0.0.1',
    }),
    { page_kind: 'for_ai', page_path: '/for-ai' },
  );

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(records.length, 1);
  assert.equal(records[0]?.page_kind, 'for_ai');
  assert.equal(records[0]?.page_path, '/for-ai');
});
```

Also import the `MarketingEventInsertRecord` type.

- [ ] **Step 2: Add failing `/for-ai` route coverage**

Change `startMachineReadableServer` in
`backend/tests/machineReadableRoutes.test.ts` to accept an optional dependency
override:

```ts
async function startMachineReadableServer(
  overrides: Record<string, unknown> = {},
) {
  const app = express();
  app.use(createMachineReadableRoutes({
    ...createMachineReadableDeps(),
    ...overrides,
  } as never));
  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close(
      (error) => (error ? reject(error) : resolve()),
    )),
  };
}
```

Add:

```ts
test('GET /for-ai records one page view while machine-readable routes record none', async () => {
  const records: MarketingEventInsertRecord[] = [];
  const marketingRepository = {
    insertMany: async (items: MarketingEventInsertRecord[]) => {
      records.push(...items);
    },
  };
  const { baseUrl, close } = await startMachineReadableServer({ marketingRepository });
  try {
    assert.equal((await fetch(`${baseUrl}/for-ai`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/llms.txt`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/data/summary.json`)).status, 200);
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(
      records.map(({ page_kind, page_path }) => ({ page_kind, page_path })),
      [{ page_kind: 'for_ai', page_path: '/for-ai' }],
    );
  } finally {
    await close();
  }
});
```

- [ ] **Step 3: Add News single-write and error exclusion assertions**

In `backend/tests/newsPublicRoutes.test.ts`, add a focused test using a
`marketingRepository` capture:

```ts
test('News and publish docs HTML record once while missing News records none', async () => {
  const records: MarketingEventInsertRecord[] = [];
  const app = express();
  app.use(createNewsPublicRoutes({
    newsPublicService: {
      getListView: async () => ({
        page: 1,
        page_size: 12,
        total: 0,
        total_pages: 1,
        featured: null,
        items: [],
      }),
      getArticleViewBySlug: async () => null,
      getPreviewArticleView: async () => null,
      getSitemapItems: async () => [],
    } as never,
    marketingRepository: {
      insertMany: async (items) => { records.push(...items); },
    },
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    assert.equal((await fetch(`http://127.0.0.1:${port}/news`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/publish-token-docs`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/publish-token-docs.md`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/news/missing`)).status, 404);
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(
      records.map(({ page_kind, page_path }) => ({ page_kind, page_path })),
      [
        { page_kind: 'news', page_path: '/news' },
        { page_kind: 'publish_token_docs', page_path: '/publish-token-docs' },
      ],
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close(
      (error) => (error ? reject(error) : resolve()),
    ));
  }
});
```

Import `MarketingEventInsertRecord`.

- [ ] **Step 4: Run the server tracking tests and verify failure**

Run:

```bash
npx tsx --test \
  backend/tests/marketingUtils.test.ts \
  backend/tests/newsPublicRoutes.test.ts \
  backend/tests/machineReadableRoutes.test.ts
```

Expected: FAIL because the common helper and `/for-ai` marketing dependency do
not exist.

- [ ] **Step 5: Implement the shared non-blocking server helper**

In `backend/src/utils/marketing.ts` add:

```ts
export interface MarketingPageViewRepository {
  insertMany(records: MarketingEventInsertRecord[]): Promise<void>;
}

export function trackServerMarketingPageView(
  repository: MarketingPageViewRepository | undefined,
  req: Request,
  input: {
    page_kind: MarketingPageKind;
    page_path: string;
  },
): void {
  if (!repository) return;

  void repository
    .insertMany([buildServerPageViewRecord(req, input)])
    .catch((error) => {
      console.error('[marketing] failed to record server-side page view', {
        pagePath: input.page_path,
        pageKind: input.page_kind,
        requestId: req.requestId || 'unknown',
        error,
      });
    });
}
```

In `backend/src/routes/newsPublicRoutes.ts`, replace the private tracker with
this helper and keep calls only after the requested list, taxonomy, article, or
document has been resolved successfully.

- [ ] **Step 6: Track `/for-ai` and wire its repository**

In `backend/src/routes/machineReadableRoutes.ts` add
`marketingRepository?: MarketingPageViewRepository` to `MachineReadableDeps`.
After `getSummary` succeeds, render the HTML first, then track and send it:

```ts
const html = renderForAiPublicPage(siteUrl, summary, frontendAssets);
trackServerMarketingPageView(deps.marketingRepository, req, {
  page_kind: 'for_ai',
  page_path: '/for-ai',
});
res.status(200).type('html').send(html);
```

Do not call the helper from `.txt`, `.md`, `.json`, 404, or error branches.

In `backend/src/app.ts` pass:

```ts
marketingRepository: marketingEventRepository,
```

to `createMachineReadableRoutes`.

- [ ] **Step 7: Run focused server tracking and typecheck verification**

Run:

```bash
npx tsx --test \
  backend/tests/marketingUtils.test.ts \
  backend/tests/newsPublicRoutes.test.ts \
  backend/tests/machineReadableRoutes.test.ts
npm run server:typecheck
```

Expected: PASS. `/for-ai` records once, machine-readable routes record zero,
successful News HTML records once, and missing News records zero.

- [ ] **Step 8: Commit server-rendered page coverage**

```bash
git add \
  backend/src/utils/marketing.ts \
  backend/src/routes/newsPublicRoutes.ts \
  backend/src/routes/machineReadableRoutes.ts \
  backend/src/app.ts \
  backend/tests/marketingUtils.test.ts \
  backend/tests/newsPublicRoutes.test.ts \
  backend/tests/machineReadableRoutes.test.ts
git commit -m "fix: track server-rendered public pages"
```

### Task 4: Run complete verification and refresh production assets

**Files:**
- Modify generated files under: `dist/`

- [ ] **Step 1: Run all focused analytics tests**

Run:

```bash
npx tsx --test \
  backend/tests/marketingPageKinds.test.ts \
  backend/tests/marketingUtils.test.ts \
  backend/tests/marketingEventRepository.test.ts \
  backend/tests/publicRoutes.test.ts \
  backend/tests/newsPublicRoutes.test.ts \
  backend/tests/machineReadableRoutes.test.ts \
  backend/tests/siteAnalytics.test.ts \
  backend/tests/adminRoutes.test.ts
```

Expected: PASS with zero failures.

- [ ] **Step 2: Run the full backend suite**

Run:

```bash
npm run test:backend
```

Expected: PASS with zero failures.

- [ ] **Step 3: Run both TypeScript checks**

Run:

```bash
npm run lint
npm run server:typecheck
```

Expected: both commands exit `0` with no new errors.

- [ ] **Step 4: Build production assets**

Run:

```bash
npm run build
```

Expected: Vite exits `0` and updates the tracked assets under `dist/`.

- [ ] **Step 5: Verify the built artifact contains every new category**

Run:

```bash
rg -n \
  "月报中心|月报详情|排名独立性声明|工具下载|流媒体检测|IP 检测|DNS 泄漏检测|AI 数据入口" \
  dist/assets
```

Expected: all eight labels are present in the generated frontend/Admin assets.

Also run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only planned source, tests, schema, docs, and
generated `dist/` changes are present in addition to the user's pre-existing
`node_modules` and `.superpowers/brainstorm` changes.

- [ ] **Step 6: Review requirements against the final diff**

Confirm from the diff and tests:

1. All 17 public page kinds exist in the shared registry.
2. All React route kinds are explicitly tracked or excluded.
3. `/for-ai`, News, and publish-token docs use server tracking.
4. API, machine-readable, redirect, download, private, 404, and 500 routes do
   not record page views.
5. The API and database accept every registered page kind.
6. Admin labels every registered type and does not mislabel `deals`.
7. No historical event backfill or production deployment was performed.

- [ ] **Step 7: Commit generated assets and final verification state**

```bash
git add dist
git commit -m "build: refresh public analytics assets"
```

Do not add `node_modules`, `.superpowers/brainstorm`, or other unrelated
working-tree changes.
