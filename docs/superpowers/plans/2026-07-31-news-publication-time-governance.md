# News Publication Time Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Preserve every News article's first publication time, keep modification time independent from views, align all public time surfaces, remove same-page article duplication, and provide a guarded historical repair tool.

**Architecture:** Keep `news_articles.published_at` as the immutable first-publication timestamp and retain `updated_at` as the editorial modification timestamp by preventing view-count writes from touching it. Centralize visible-card de-duplication in `NewsPublicService`, expose `updated_at` through public view models for JSON-LD and Sitemap, and run historical corrections only through a typed dry-run-first transactional repair service.

**Tech Stack:** TypeScript 5.8, Node test runner, Express, React 19, MySQL 8 via `mysql2/promise`, Vite, Tailwind CSS.

---

## File map

- `backend/src/services/newsMutationService.ts`: first-publication write contract.
- `backend/src/repositories/newsRepository.ts`: editorial timestamp and view-count persistence rules.
- `src/admin/news/NewsPages.tsx`: state-aware save, publish, restore, and archive actions.
- `backend/src/services/newsPublicService.ts`: public `updated_at` projection and page-wide de-duplication.
- `backend/src/services/newsPageRenderer.ts`: Article JSON-LD publication/modification time.
- `backend/src/routes/newsPublicRoutes.ts`: News Sitemap `lastmod` selection.
- `backend/src/services/newsPublicationTimeRepairService.ts`: mapping validation, dry-run, transaction, backup, and rollback behavior.
- `scripts/repair-news-publication-time.ts`: operator CLI; dry-run is the default.
- `backend/tests/*.test.ts`: behavior-focused regressions for every boundary above.

### Task 1: Make publication and view timestamps obey their contracts

**Files:**
- Create: `backend/tests/newsMutationService.test.ts`
- Modify: `backend/tests/newsRepository.test.ts`
- Modify: `backend/src/services/newsMutationService.ts`
- Modify: `backend/src/repositories/newsRepository.ts`

- [x] **Step 1: Write failing publication-time service tests**

Create `backend/tests/newsMutationService.test.ts` with a mutable repository stub and these three cases:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsMutationService } from '../src/services/newsMutationService';

function createHarness(status: 'draft' | 'published' | 'archived', publishedAt: string | null) {
  const article = {
    id: 7,
    title: '时间测试',
    slug: 'publication-time-test',
    excerpt: '摘要',
    cover_image_url: '',
    content_markdown: '正文',
    content_html: '<p>正文</p>',
    category_id: null,
    is_featured: false,
    is_recommended: false,
    recommend_weight: 0,
    status,
    published_at: publishedAt,
    view_count: 0,
    created_at: '2026-05-01 08:00:00',
    updated_at: '2026-05-01 08:00:00',
    category: null,
    topics: [],
  };
  const updates: Array<Record<string, unknown>> = [];
  const service = new NewsMutationService({
    newsRepository: {
      getById: async () => article,
      getBySlug: async () => article,
      create: async () => article.id,
      update: async (_id, input) => {
        updates.push(input);
        Object.assign(article, input);
        return true;
      },
      resolveCategoryId: async () => null,
      resolveTopicIds: async () => [],
    } as never,
    newsContentService: {
      render: (markdown: string) => ({
        html: `<p>${markdown}</p>`,
        headings: [],
        reading_minutes: 1,
        plain_text: markdown,
      }),
    } as never,
    newsCoverImageService: { compressUploadedCover: async () => '' } as never,
  });
  return { article, service, updates };
}

test('first publish assigns published_at', async () => {
  const { article, service } = createHarness('draft', null);
  await service.publish(article.id);
  assert.match(String(article.published_at), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('publishing an already published article preserves first publication time', async () => {
  const original = '2026-05-21 01:40:23';
  const { article, service } = createHarness('published', original);
  await service.publish(article.id);
  assert.equal(article.published_at, original);
});

test('restoring an archived article preserves first publication time', async () => {
  const original = '2026-06-06 14:25:36';
  const { article, service } = createHarness('archived', original);
  await service.publish(article.id);
  assert.equal(article.published_at, original);
  assert.equal(article.status, 'published');
});
```

- [x] **Step 2: Strengthen the view-count repository expectation**

Change the existing `NewsRepository.incrementViewCount` assertion to require an explicit timestamp no-op:

```ts
assert.deepEqual(calls, [{
  sql: `UPDATE news_articles
          SET view_count = view_count + 1,
              updated_at = updated_at
        WHERE id = ?`,
  params: [42],
}]);
```

- [x] **Step 3: Run the focused tests and verify the red state**

Run:

```bash
npx tsx --test backend/tests/newsMutationService.test.ts backend/tests/newsRepository.test.ts
```

Expected: the two preservation tests fail because `publish()` overwrites the timestamp, and the repository test fails because the view update does not preserve `updated_at` explicitly.

- [x] **Step 4: Implement the minimal write-contract changes**

Extend the current article shape and preserve its existing publication time:

```ts
interface CurrentArticleState {
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_markdown: string;
  status: NewsStatus;
  published_at: string | null;
}

// Inside publish()
await this.deps.newsRepository.update(id, {
  ...articleInput,
  ...metadataInput,
  status: 'published',
  published_at: current.published_at || nowInShanghai(),
});
```

Protect the editorial timestamp during view increments:

```ts
const [result] = await this.pool.execute<ResultSetHeader>(
  `UPDATE news_articles
      SET view_count = view_count + 1,
          updated_at = updated_at
    WHERE id = ?`,
  [articleId],
);
```

- [x] **Step 5: Run the focused tests and commit**

Run:

```bash
npx tsx --test backend/tests/newsMutationService.test.ts backend/tests/newsRepository.test.ts
```

Expected: all tests in both files pass.

Commit:

```bash
git add backend/tests/newsMutationService.test.ts backend/tests/newsRepository.test.ts backend/src/services/newsMutationService.ts backend/src/repositories/newsRepository.ts
git commit -m "fix: preserve news publication timestamps"
```

### Task 2: Make admin actions match article state

**Files:**
- Create: `backend/tests/newsAdminPublicationTimeUi.test.ts`
- Modify: `src/admin/news/NewsPages.tsx`

- [x] **Step 1: Write the failing source-level UI contract**

Create `backend/tests/newsAdminPublicationTimeUi.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(path.resolve(process.cwd(), 'src/admin/news/NewsPages.tsx'), 'utf8');
const editor = source.slice(
  source.indexOf('export function NewsEditorPage'),
  source.indexOf('function StatusPill'),
);

test('published articles save updates without exposing the publish action again', () => {
  assert.match(editor, /form\.status === 'published' \? '保存更新' : '保存草稿'/);
  assert.match(editor, /form\.status !== 'published'.*发布文章/s);
  assert.match(editor, /form\.status === 'archived' \? '恢复发布' : '发布文章'/);
  assert.match(editor, /form\.status === 'published' \? '文章更新已保存' : '草稿已保存'/);
});
```

- [x] **Step 2: Run the new test and verify it fails**

Run:

```bash
npx tsx --test backend/tests/newsAdminPublicationTimeUi.test.ts
```

Expected: FAIL because both buttons and notices currently use unconditional draft/publish labels.

- [x] **Step 3: Implement state-aware labels and actions**

Keep `saveDraft()` as the PATCH implementation but make its notice state-aware:

```ts
setNotice(form.status === 'published' ? '文章更新已保存' : '草稿已保存');
```

Use state-aware button text:

```tsx
<Save size={16} />
{form.status === 'published' ? '保存更新' : '保存草稿'}
```

Do not render the publish action for an already published article:

```tsx
{form.status !== 'published' ? (
  <button
    className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
    onClick={() => void publishArticle()}
    disabled={saving}
  >
    <Send size={16} />
    {form.status === 'archived' ? '恢复发布' : '发布文章'}
  </button>
) : null}
```

- [x] **Step 4: Run focused admin UI tests and commit**

Run:

```bash
npx tsx --test backend/tests/newsAdminPublicationTimeUi.test.ts backend/tests/newsAdminSingleTopicUi.test.ts backend/tests/newsAdminNavigationStateUi.test.ts
```

Expected: all tests pass and the existing full editor/topic/navigation contracts remain intact.

Commit:

```bash
git add backend/tests/newsAdminPublicationTimeUi.test.ts src/admin/news/NewsPages.tsx
git commit -m "fix: clarify news editor publication actions"
```

### Task 3: Align public API, JSON-LD, and Sitemap modification times

**Files:**
- Modify: `backend/src/services/newsPublicService.ts`
- Modify: `backend/src/services/newsPageRenderer.ts`
- Modify: `backend/src/routes/newsPublicRoutes.ts`
- Modify: `backend/tests/newsPublicRoutes.test.ts`

- [x] **Step 1: Add failing public-route assertions**

In the article SEO test, give the stub distinct times:

```ts
published_at: '2026-03-28 18:00:00',
updated_at: '2026-04-02 09:30:00',
```

Then assert both JSON-LD values:

```ts
assert.match(html, /"datePublished":"2026-03-28T18:00:00\+08:00"/);
assert.match(html, /"dateModified":"2026-04-02T09:30:00\+08:00"/);
```

In the Sitemap test, use a later update time and require it as `lastmod`:

```ts
updated_at: '2026-04-03 12:45:00',
assert.match(xml, /<lastmod>2026-04-03T12:45:00\+08:00<\/lastmod>/);
```

- [x] **Step 2: Run the focused public-route cases and verify they fail**

Run:

```bash
npx tsx --test --test-name-pattern="seo metadata|includes published news urls" backend/tests/newsPublicRoutes.test.ts
```

Expected: `dateModified` still equals `datePublished`, and Sitemap still uses `published_at`.

- [x] **Step 3: Carry `updated_at` through the public view model**

Add the field to `PublicNewsCardView`:

```ts
export interface PublicNewsCardView {
  // existing fields
  published_at: string | null;
  updated_at: string;
  // existing fields
}
```

Map it in `toCardView()`:

```ts
published_at: article.published_at,
updated_at: article.updated_at,
```

- [x] **Step 4: Correct JSON-LD and Sitemap field selection**

In `renderNewsArticlePage()`:

```ts
datePublished: toIsoDate(article.published_at),
dateModified: toIsoDate(article.updated_at || article.published_at),
```

In `buildSitemapXml()`:

```ts
const lastmod = item.updated_at || item.published_at;
if (lastmod) {
  lastmodByPath.set(`/news/${item.slug}`, lastmod.replace(' ', 'T') + '+08:00');
}
```

- [x] **Step 5: Run all News public-route tests and commit**

Run:

```bash
npx tsx --test backend/tests/newsPublicRoutes.test.ts
```

Expected: all News API, SSR, JSON-LD, topic, category, and Sitemap cases pass.

Commit:

```bash
git add backend/src/services/newsPublicService.ts backend/src/services/newsPageRenderer.ts backend/src/routes/newsPublicRoutes.ts backend/tests/newsPublicRoutes.test.ts
git commit -m "fix: align public news modification dates"
```

### Task 4: De-duplicate articles across visible News modules

**Files:**
- Create: `backend/tests/newsPublicService.test.ts`
- Modify: `backend/src/services/newsPublicService.ts`

- [x] **Step 1: Write a failing service-level de-duplication test**

Create a test whose repository returns the same article in featured, list, recommended, risk, and guide candidates:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle } from '../src/types/domain';
import { NewsPublicService } from '../src/services/newsPublicService';

function makeArticle(id: number): NewsArticle {
  const day = String(Math.min(28, id)).padStart(2, '0');
  return {
    id,
    title: `文章 ${id}`,
    slug: `article-${id}`,
    excerpt: `摘要 ${id}`,
    cover_image_url: '',
    content_markdown: `正文 ${id}`,
    content_html: `<p>正文 ${id}</p>`,
    category_id: null,
    is_featured: id === 1,
    is_recommended: id <= 14,
    recommend_weight: 100 - id,
    status: 'published',
    published_at: `2026-07-${day} 10:00:00`,
    view_count: id,
    created_at: `2026-07-${day} 09:00:00`,
    updated_at: `2026-07-${day} 11:00:00`,
    category: null,
    topics: [],
  };
}

test('NewsPublicService assigns each visible article to only one module', async () => {
  const articles = Array.from({ length: 20 }, (_, index) => makeArticle(index + 1));
  const service = new NewsPublicService({
    listCategories: async () => [],
    listTopics: async () => [],
    getFeaturedPublished: async () => articles[0],
    listPublishedDetailed: async (query: { exclude_ids?: number[] }) => ({
      total: 19,
      items: articles.filter((item) => !query.exclude_ids?.includes(item.id)).slice(0, 12),
    }),
    listRecommendedPublished: async () => articles.slice(0, 14),
    listLatestByCategory: async () => articles.slice(0, 10),
  } as never, {
    render: () => ({ html: '', headings: [], reading_minutes: 1, plain_text: '' }),
  } as never);

  const view = await service.getListView(1, 12);
  const visibleIds = [
    ...(view.featured ? [view.featured.id] : []),
    ...view.items.map((item) => item.id),
    ...view.recommended.map((item) => item.id),
    ...view.risk_watch.map((item) => item.id),
    ...view.guides.map((item) => item.id),
  ];
  assert.equal(view.items.length, 12);
  assert.equal(new Set(visibleIds).size, visibleIds.length);
  assert.equal(view.total, 20);
});
```

Define `makeArticle(id)` in the same test with every `NewsArticle` field, including distinct `published_at`, `created_at`, and `updated_at`, so no `as unknown` payload gaps hide contract errors.

- [x] **Step 2: Run the service test and verify it fails**

Run:

```bash
npx tsx --test backend/tests/newsPublicService.test.ts
```

Expected: FAIL because recommended/risk/guide arrays repeat featured and list article IDs, and the main list loses one item when featured is removed after pagination.

- [x] **Step 3: Query and allocate cards in deterministic priority order**

Always resolve the featured candidate before the paginated list. If no article is explicitly featured, resolve the latest matching article through a one-item page as the existing fallback. Exclude that candidate from the main list query on every page and restore the public total:

```ts
const featuredFilters = {
  category_slug: filters.category_slug,
  topic_slug: filters.topic_slug,
  keyword,
};
const explicitFeatured = await this.newsRepository.getFeaturedPublished(featuredFilters);
const fallbackResult = explicitFeatured ? null : await this.newsRepository.listPublishedDetailed({
  page: 1,
  pageSize: 1,
  ...featuredFilters,
});
const featuredArticle = explicitFeatured || fallbackResult?.items[0] || null;
const featuredIds = featuredArticle ? [featuredArticle.id] : [];
const result = await this.newsRepository.listPublishedDetailed({
  page: safePage,
  pageSize: safePageSize,
  category_slug: filters.category_slug,
  topic_slug: filters.topic_slug,
  keyword,
  exclude_ids: featuredIds,
});
const featured = safePage === 1 && featuredArticle ? this.toCardView(featuredArticle) : null;
const items = result.items.map((article) => this.toCardView(article));
const total = result.total + featuredIds.length;
```

Fetch larger sidebar candidate pools and allocate them through one helper:

```ts
function takeUniqueCards(
  candidates: PublicNewsCardView[],
  usedIds: Set<number>,
  limit: number,
): PublicNewsCardView[] {
  const selected: PublicNewsCardView[] = [];
  for (const candidate of candidates) {
    if (usedIds.has(candidate.id)) continue;
    usedIds.add(candidate.id);
    selected.push(candidate);
    if (selected.length === limit) break;
  }
  return selected;
}
```

Use priority `featured → items → recommended → risk_watch → guides`, requesting 18 recommended and 9 category candidates before filtering:

```ts
const usedIds = new Set<number>([
  ...(featured ? [featured.id] : []),
  ...items.map((item) => item.id),
]);
const recommended = takeUniqueCards(recommendedCandidates, usedIds, 6);
const riskWatch = takeUniqueCards(riskCandidates, usedIds, 3);
const guides = takeUniqueCards(guideCandidates, usedIds, 3);
```

Apply the same rule to topic-page pinned/items/recommended arrays:

```ts
const pinned = resolvedPinnedArticles.map((article) => this.toCardView(article));
const items = result.items.map((article) => this.toCardView(article));
const usedIds = new Set([...pinned, ...items].map((item) => item.id));
const recommended = takeUniqueCards(
  recommendedItems.map((item) => this.toCardView(item)),
  usedIds,
  6,
);
```

- [x] **Step 4: Run service and public route tests and commit**

Run:

```bash
npx tsx --test backend/tests/newsPublicService.test.ts backend/tests/newsPublicRoutes.test.ts
```

Expected: visible IDs are unique, the main list retains its requested size, public totals remain article totals, and SSR routes still pass.

Commit:

```bash
git add backend/tests/newsPublicService.test.ts backend/src/services/newsPublicService.ts
git commit -m "fix: deduplicate public news modules"
```

### Task 5: Build the dry-run-first historical repair tool

**Files:**
- Create: `backend/src/services/newsPublicationTimeRepairService.ts`
- Create: `scripts/repair-news-publication-time.ts`
- Create: `backend/tests/newsPublicationTimeRepairService.test.ts`
- Modify: `package.json`

- [x] **Step 1: Write failing validation and transaction tests**

Define the mapping contract and isolated database harness in the test:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsPublicationTimeRepairService } from '../src/services/newsPublicationTimeRepairService';

const validEntry = {
  id: 16,
  expected_published_at: '2026-07-30 11:16:45',
  published_at: '2026-05-20 20:30:00',
  expected_updated_at: '2026-07-31 09:00:00',
  updated_at: '2026-05-20 20:30:00',
  source: 'mysql-binlog-before-2026-07-30',
};

const currentRow = {
  id: 16,
  created_at: '2026-05-20 20:00:00',
  published_at: validEntry.expected_published_at,
  updated_at: validEntry.expected_updated_at,
};

class FakeRepairConnection {
  sql: string[] = [];
  beginTransactionCalls = 0;
  commitCalls = 0;
  rollbackCalls = 0;
  nextAffectedRows = 1;

  constructor(public rows = [currentRow]) {}

  async query(sql: string): Promise<[unknown[]]> {
    this.sql.push(sql);
    if (sql.includes('COUNT(*) AS total')) return [[{ total: this.rows.length }]];
    if (sql.includes('FROM news_articles')) return [this.rows];
    return [[]];
  }

  async execute(sql: string): Promise<[{ affectedRows: number }]> {
    this.sql.push(sql);
    return [{ affectedRows: this.nextAffectedRows }];
  }

  async beginTransaction(): Promise<void> { this.beginTransactionCalls += 1; }
  async commit(): Promise<void> { this.commitCalls += 1; }
  async rollback(): Promise<void> { this.rollbackCalls += 1; }
  release(): void {}
}

function createHarness(rows = [currentRow]) {
  const connection = new FakeRepairConnection(rows);
  const service = new NewsPublicationTimeRepairService(
    { getConnection: async () => connection } as never,
    () => new Date('2026-07-31T23:30:00+08:00'),
  );
  return { connection, service };
}
```

Add these cases to `backend/tests/newsPublicationTimeRepairService.test.ts`:

```ts
test('dry run rejects missing source, future dates, and duplicate article ids', async () => {
  const { service } = createHarness();
  await assert.rejects(
    () => service.dryRun([
      { ...validEntry, source: '' },
      { ...validEntry, id: 17, published_at: '2099-01-01 00:00:00' },
      { ...validEntry },
    ]),
    /invalid repair mapping/,
  );
});

test('dry run reports current-value conflicts without opening a transaction', async () => {
  const { connection, service } = createHarness([{
    ...currentRow,
    published_at: '2026-07-30 11:00:00',
  }]);
  const report = await service.dryRun([validEntry]);
  assert.equal(report.ready, false);
  assert.deepEqual(report.conflicts, [{ id: 16, field: 'published_at' }]);
  assert.equal(connection.beginTransactionCalls, 0);
});

test('apply backs up and updates every mapped row in one transaction', async () => {
  const { connection, service } = createHarness();
  const report = await service.apply([validEntry], '20260731T233000');
  assert.equal(report.updated, 1);
  assert.equal(connection.beginTransactionCalls, 1);
  assert.equal(connection.commitCalls, 1);
  assert.equal(connection.rollbackCalls, 0);
  assert.match(connection.sql.join('\n'), /CREATE TABLE news_publication_time_backup_20260731T233000/);
  assert.match(connection.sql.join('\n'), /WHERE id = \? AND published_at = \? AND updated_at = \?/);
});

test('apply rolls back when an optimistic update affects zero rows', async () => {
  const { connection, service } = createHarness();
  connection.nextAffectedRows = 0;
  await assert.rejects(() => service.apply([validEntry], '20260731T233001'), /row count mismatch/);
  assert.equal(connection.rollbackCalls, 1);
  assert.equal(connection.commitCalls, 0);
});

test('rollback restores backup values only when current values match the mapping', async () => {
  const { connection, service } = createHarness([{
    ...currentRow,
    published_at: validEntry.published_at,
    updated_at: validEntry.updated_at,
  }]);
  const report = await service.rollback([validEntry], '20260731T233000');
  assert.equal(report.updated, 1);
  assert.match(connection.sql.join('\n'), /news_publication_time_backup_20260731T233000/);
  assert.match(connection.sql.join('\n'), /a\.published_at = \? AND a\.updated_at = \?/);
});
```

- [x] **Step 2: Run the repair-service test and verify it fails**

Run:

```bash
npx tsx --test backend/tests/newsPublicationTimeRepairService.test.ts
```

Expected: FAIL because the repair service and mapping contract do not exist.

- [x] **Step 3: Implement strict mapping validation and dry-run**

Create these public types and reject every invalid entry before opening a transaction:

```ts
import type { Pool, ResultSetHeader } from 'mysql2/promise';

export interface NewsPublicationTimeRepairEntry {
  id: number;
  expected_published_at: string;
  published_at: string;
  expected_updated_at: string;
  updated_at: string;
  source: string;
  allow_before_created_at?: boolean;
  justification?: string;
}

export interface NewsPublicationTimeRepairReport {
  ready: boolean;
  checked: number;
  updated: number;
  conflicts: Array<{ id: number; field: 'missing' | 'published_at' | 'updated_at' }>;
}

export class NewsPublicationTimeRepairService {
  constructor(
    private readonly pool: Pick<Pool, 'getConnection'>,
    private readonly now: () => Date = () => new Date(),
  ) {}
}
```

Validation must require positive unique IDs, SQL datetime strings, non-future replacement dates, non-empty source, `published_at >= created_at` unless the mapping explicitly carries both `allow_before_created_at: true` and a non-empty `justification`, and `updated_at >= published_at`.

`dryRun()` must select the exact mapped IDs, compare current values with both expected values, and return conflicts without mutating data.

- [x] **Step 4: Implement transactional apply and backup**

Validate the run ID with `/^\d{8}T\d{6}$/`. Because MySQL DDL implicitly commits, create and populate the backup table before opening the update transaction:

```ts
await connection.query(`CREATE TABLE news_publication_time_backup_${runId} LIKE news_articles`);
await connection.query(
  `INSERT INTO news_publication_time_backup_${runId}
   SELECT * FROM news_articles WHERE id IN (${placeholders})`,
  ids,
);
await requireBackupRowCount(connection, runId, entries.length);
await connection.beginTransaction();
```

Update each row with optimistic guards and preserve the intended modification time explicitly:

```ts
const [result] = await connection.execute<ResultSetHeader>(
  `UPDATE news_articles
      SET published_at = ?, updated_at = ?
    WHERE id = ? AND published_at = ? AND updated_at = ?`,
  [entry.published_at, entry.updated_at, entry.id, entry.expected_published_at, entry.expected_updated_at],
);
if (result.affectedRows !== 1) {
  throw new Error(`row count mismatch for article ${entry.id}`);
}
```

Commit only after every row succeeds; otherwise roll back the updates while retaining the backup table. A repeated apply with the same run ID or changed current values must fail closed rather than altering the row again.

Implement `rollback(entries, runId)` using the same mapping file. Restore only where the live row still equals the repaired values:

```ts
const [result] = await connection.execute<ResultSetHeader>(
  `UPDATE news_articles a
    INNER JOIN news_publication_time_backup_${runId} backup ON backup.id = a.id
      SET a.published_at = backup.published_at,
          a.updated_at = backup.updated_at
    WHERE a.id = ? AND a.published_at = ? AND a.updated_at = ?`,
  [entry.id, entry.published_at, entry.updated_at],
);
if (result.affectedRows !== 1) {
  throw new Error(`rollback row count mismatch for article ${entry.id}`);
}
```

Any missing backup row or optimistic-guard mismatch rolls back the complete restoration.

- [x] **Step 5: Add a dry-run-default CLI**

Register this package script:

```json
"news:repair-publication-time": "tsx scripts/repair-news-publication-time.ts"
```

The CLI must require `--mapping=/absolute/path.json`; omit `--apply` for dry-run. Apply additionally requires a 14-character Shanghai timestamp passed through `--run-id`, matching `^\d{8}T\d{6}$`. Rollback requires `--rollback`, the original apply run ID, and the same mapping file. Apply and rollback print the backup table name. The CLI must load environment variables through `dotenv/config`, obtain `getDbPool()`, print only IDs/timestamps/sources, never database credentials, and close the pool in `finally`.

- [x] **Step 6: Run focused tests, typecheck, and commit**

Run:

```bash
npx tsx --test backend/tests/newsPublicationTimeRepairService.test.ts
npm run server:typecheck
```

Expected: repair tests pass and backend typecheck exits 0.

Commit:

```bash
git add backend/src/services/newsPublicationTimeRepairService.ts scripts/repair-news-publication-time.ts backend/tests/newsPublicationTimeRepairService.test.ts package.json
git commit -m "feat: add guarded news timestamp repair tool"
```

### Task 6: Run repository-wide verification and browser acceptance

**Files:**
- Modify: `dist/assets/AdminApp.js`
- Modify: `dist/assets/index.js`
- Modify: `docs/superpowers/plans/2026-07-31-news-publication-time-governance.md` only to check completed boxes during execution

- [x] **Step 1: Run all focused News tests**

Run:

```bash
npx tsx --test \
  backend/tests/newsMutationService.test.ts \
  backend/tests/newsRepository.test.ts \
  backend/tests/newsAdminRoutes.test.ts \
  backend/tests/newsAdminPublicationTimeUi.test.ts \
  backend/tests/newsAdminSingleTopicUi.test.ts \
  backend/tests/newsPublicService.test.ts \
  backend/tests/newsPublicRoutes.test.ts \
  backend/tests/newsPublicationTimeRepairService.test.ts
```

Expected: all focused tests pass with zero failures.

- [x] **Step 2: Run full static and backend verification**

Run:

```bash
npm run lint
npm run server:typecheck
npm run test:backend
VITE_SITE_URL=https://gate-rank.com VITE_API_BASE='' npm run build
git diff --check
```

Expected: frontend and backend typechecks pass, the complete backend suite reports zero failures, production build succeeds, and `git diff --check` prints nothing. The existing Vite large-chunk warning is non-blocking unless a new error accompanies it.

- [x] **Step 3: Verify the built local application in Chrome**

Start the API in one terminal:

```bash
npm run server:dev
```

Start a built-asset preview/proxy in another terminal:

```bash
node --input-type=module -e 'import express from "express"; import path from "node:path"; const app=express(); app.use("/assets",express.static("dist/assets")); for (const prefix of ["/api","/news","/uploads","/sitemap.xml"]) app.use(prefix,async(req,res)=>{const upstream=await fetch(`http://127.0.0.1:8787${req.originalUrl}`); res.status(upstream.status); upstream.headers.forEach((value,key)=>{if(!["content-encoding","content-length","transfer-encoding"].includes(key)) res.setHeader(key,value);}); res.send(Buffer.from(await upstream.arrayBuffer()));}); app.use((_req,res)=>res.sendFile(path.resolve("dist/index.html"))); app.listen(3010,"127.0.0.1",()=>console.log("http://127.0.0.1:3010"));'
```

Open `http://127.0.0.1:3010/admin/news` and `http://127.0.0.1:3010/news` in Chrome. Verify:

- a published article editor shows `保存更新` and no `发布文章` button;
- a draft shows `保存草稿` and `发布文章`;
- an archived article shows `恢复发布`;
- `/news` contains no duplicate article ID across featured, main list, recommended, risk, and guide sections;
- an article's JSON-LD has distinct `datePublished` and `dateModified` values;
- opening an article increments its view count without changing the admin `更新时间`.

Expected: all six checks pass in the hydrated UI and SSR source.

- [x] **Step 4: Commit generated assets and plan progress**

Review the generated diff before committing; include only expected News/admin bundle changes:

```bash
git add dist/assets/AdminApp.js dist/assets/index.js docs/superpowers/plans/2026-07-31-news-publication-time-governance.md
git commit -m "build: refresh news publication assets"
```

### Task 7: Production rollout and separately approved historical repair

**Files:**
- No repository files change during this task.

- [ ] **Step 1: Push and deploy only after explicit release authorization**

Push the reviewed commits, wait for the paired `gaterank-web:main` and `gaterank-api:main` images to publish successfully, then update both services together. Verify `/healthz`, `/api/v1/pages/home`, `/news`, and one article route before proceeding.

Expected: both containers run the same release and all four routes return HTTP 200.

- [ ] **Step 2: Build an evidence-backed repair mapping**

Take a production database backup. Recover candidate historical values in this order: pre-incident backup/binlog, trusted old Sitemap/page snapshot, then user-approved article mapping. Export the mapping outside the repository with the exact schema from Task 5. Do not infer dates solely from IDs, titles, Slugs, or clustered timestamps.

- [ ] **Step 3: Run dry-run and stop for approval**

Run inside the API environment with the production database variables already configured:

```bash
npm run news:repair-publication-time -- --mapping=/secure/news-publication-repair.json
```

Expected: the report shows `ready: true`, zero conflicts, the exact article count, and every old/new timestamp plus source. Present this report and the database backup evidence to the user. Do not add `--apply` until the user explicitly approves that exact mapping.

- [ ] **Step 4: Apply the approved mapping transaction**

After approval, generate a unique run ID and execute:

```bash
repair_run_id="$(TZ=Asia/Shanghai date +%Y%m%dT%H%M%S)"
npm run news:repair-publication-time -- \
  --mapping=/secure/news-publication-repair.json \
  --apply \
  --run-id="$repair_run_id"
```

Expected: updated count equals mapping count, the transaction commits, and the output names the backup table.

- [ ] **Step 5: Verify production and retain rollback evidence**

Re-query all published articles, confirm the count equals the pre-repair baseline, compare the before/after distribution, inspect two News pages and the homepage, verify Article JSON-LD and Sitemap, and confirm a page view no longer changes `updated_at`. Retain the mapping, dry-run output, apply output, database backup identifier, and rollback-table name together.

Expected: only approved time fields differ; article count, Slugs, content, view counts, categories, topics, and recommendation settings remain unchanged.

If production verification fails because of repaired timestamps, use the retained run ID and the exact same mapping file:

```bash
npm run news:repair-publication-time -- \
  --mapping=/secure/news-publication-repair.json \
  --rollback \
  --run-id="$repair_run_id"
```

Expected: every mapped article is restored from the named backup table in one transaction, with optimistic guards preventing rollback over later editorial changes.
