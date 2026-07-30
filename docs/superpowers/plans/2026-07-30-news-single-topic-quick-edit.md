# News Single-Topic Quick Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show and quickly edit one optional news topic from the article list while enforcing the one-topic maximum in every article-writing path.

**Architecture:** Keep the existing `news_article_topics` join table and the public `topics` array contract. Convert both admin controls to single-select inputs, reject multi-topic mutations in `NewsMutationService`, normalize historical associations before adding a unique article index, and reuse the existing article `PATCH` route for inline saves.

**Tech Stack:** React 19, TypeScript, Express, MySQL 8, Node test runner, Tailwind CSS, Vite.

---

### Task 1: Enforce the single-topic mutation contract

**Files:**
- Modify: `backend/tests/newsAdminRoutes.test.ts`
- Modify: `backend/src/services/newsMutationService.ts`

- [ ] **Step 1: Write the failing route regression test**

Add a route test that sends `topic_ids: [3, 7]` to
`PATCH /api/v1/admin/news/1`, expects HTTP 400, expects the message
`每篇文章最多只能选择一个专题`, and proves the repository `update` method was
not called.

```ts
test('news admin routes reject more than one article topic', async () => {
  let updateCalled = false;
  const article = {
    id: 1,
    title: '现有文章',
    slug: 'existing-article',
    excerpt: '摘要',
    cover_image_url: '',
    content_markdown: '正文',
    content_html: '<p>正文</p>',
    category_id: null,
    is_featured: false,
    is_recommended: false,
    recommend_weight: 0,
    status: 'draft' as const,
    published_at: null,
    view_count: 0,
    created_at: '2026-07-30 10:00:00',
    updated_at: '2026-07-30 10:00:00',
    category: null,
    topics: [],
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use('/api/v1/admin', createNewsAdminRoutes({
    auditRepository: { log: async () => undefined } as never,
    newsRepository: {
      listByQuery: async () => ({ items: [], total: 0 }),
      getById: async () => article,
      update: async () => {
        updateCalled = true;
        return true;
      },
      resolveCategoryId: async () => null,
      resolveTopicIds: async () => [],
    } as never,
    newsContentService: {
      render: (markdown: string) => ({
        html: markdown,
        headings: [],
        reading_minutes: 1,
        plain_text: markdown,
      }),
    } as never,
    newsPublicService: { getPreviewArticleView: async () => null } as never,
    pexelsCoverService: createPexelsServiceStub(),
    newsCoverImageService: createNewsCoverImageServiceStub(),
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'existing-article',
        topic_ids: [3, 7],
      }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).message, '每篇文章最多只能选择一个专题');
    assert.equal(updateCalled, false);
  } finally {
    await new Promise<void>((resolve, reject) => (
      server.close((error) => (error ? reject(error) : resolve()))
    ));
  }
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx tsx --test backend/tests/newsAdminRoutes.test.ts
```

Expected: the new case fails because the current mutation service accepts both
topic IDs.

- [ ] **Step 3: Add one shared validator to the mutation service**

Validate both numeric IDs and slug-resolved IDs after de-duplication:

```ts
function requireSingleTopicIds(topicIds: number[]): number[] {
  if (topicIds.length > 1) {
    throw new HttpError(400, 'BAD_REQUEST', '每篇文章最多只能选择一个专题');
  }
  return topicIds;
}
```

Use it in `resolveMetadataPayload()`:

```ts
if (payload.topic_ids !== undefined) {
  result.topic_ids = requireSingleTopicIds(parsePositiveIntList(payload.topic_ids));
} else if (payload.topic_slugs !== undefined) {
  result.topic_ids = requireSingleTopicIds(
    await this.deps.newsRepository.resolveTopicIds(parseStringList(payload.topic_slugs)),
  );
}
```

- [ ] **Step 4: Run the focused route tests**

Run:

```bash
npx tsx --test backend/tests/newsAdminRoutes.test.ts
```

Expected: all news admin route tests pass.

### Task 2: Normalize and constrain repository storage

**Files:**
- Modify: `backend/tests/newsRepository.test.ts`
- Modify: `backend/src/repositories/newsRepository.ts`

- [ ] **Step 1: Write failing repository expectations**

Extend `NewsRepository.ensureSchema` coverage to require:

```ts
assert.ok(calls.some((call) => (
  call.sql.includes('DELETE candidate') &&
  call.sql.includes('preferred_topic.is_active > candidate_topic.is_active')
)));
assert.ok(calls.some((call) => (
  call.sql.includes('CREATE UNIQUE INDEX uk_news_article_topics_article') &&
  call.sql.includes('news_article_topics (article_id)')
)));
```

Add a topic-only update test that expects both the association replacement and
the article timestamp touch:

```ts
await repository.update(42, { topic_ids: [7] });
assert.ok(calls.some((call) => (
  call.sql.includes('UPDATE news_articles SET updated_at = CURRENT_TIMESTAMP') &&
  JSON.stringify(call.params) === JSON.stringify([42])
)));
```

- [ ] **Step 2: Run repository tests and verify they fail**

Run:

```bash
npx tsx --test backend/tests/newsRepository.test.ts
```

Expected: the normalization, unique index, and topic-only timestamp assertions
fail.

- [ ] **Step 3: Add idempotent historical normalization and the unique index**

Call normalization after the topic tables exist and before adding the index:

```ts
await this.normalizeArticleTopicsForSingleTopic();
await this.ensureIndex(
  'news_article_topics',
  'uk_news_article_topics_article',
  'CREATE UNIQUE INDEX uk_news_article_topics_article ON news_article_topics (article_id)',
);
```

Implement deterministic preference for active topic, lower sort order, then
lower topic ID:

```ts
private async normalizeArticleTopicsForSingleTopic(): Promise<void> {
  await this.pool.execute(`
    DELETE candidate
      FROM news_article_topics candidate
      INNER JOIN news_topics candidate_topic ON candidate_topic.id = candidate.topic_id
      INNER JOIN news_article_topics preferred
              ON preferred.article_id = candidate.article_id
             AND preferred.topic_id <> candidate.topic_id
      INNER JOIN news_topics preferred_topic ON preferred_topic.id = preferred.topic_id
     WHERE preferred_topic.is_active > candidate_topic.is_active
        OR (
          preferred_topic.is_active = candidate_topic.is_active
          AND preferred_topic.sort_order < candidate_topic.sort_order
        )
        OR (
          preferred_topic.is_active = candidate_topic.is_active
          AND preferred_topic.sort_order = candidate_topic.sort_order
          AND preferred_topic.id < candidate_topic.id
        )
  `);
}
```

- [ ] **Step 4: Touch article update time for topic-only writes**

After synchronizing topics, update the article row when no ordinary article
columns were changed:

```ts
if (input.topic_ids !== undefined) {
  await this.syncArticleTopics(id, input.topic_ids);
  if (updates.length === 0) {
    const [result] = await this.pool.execute<ResultSetHeader>(
      'UPDATE news_articles SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id],
    );
    changed = result.affectedRows > 0;
  } else {
    changed = true;
  }
}
```

- [ ] **Step 5: Run repository tests**

Run:

```bash
npx tsx --test backend/tests/newsRepository.test.ts
```

Expected: all repository tests pass.

### Task 3: Add admin UI regressions

**Files:**
- Create: `backend/tests/newsAdminSingleTopicUi.test.ts`

- [ ] **Step 1: Add source-contract tests for list and editor behavior**

Read `src/admin/news/NewsPages.tsx`, split the `NewsListPage` and
`NewsEditorPage` sections, then assert:

```ts
assert.ok(listSource.indexOf('更新时间') < listSource.indexOf('专题'));
assert.ok(listSource.indexOf('专题') < listSource.indexOf('操作'));
assert.ok(listSource.includes('未设置'));
assert.ok(listSource.includes("method: 'PATCH'"));
assert.ok(listSource.includes('topic_ids: topicId ? [topicId] : []'));
assert.ok(listSource.includes('slug: item.slug'));
assert.ok(listSource.includes('<Pencil'));
assert.ok(editorSource.includes('<option value="">无专题</option>'));
assert.ok(editorSource.includes('topic_ids: value ? [Number(value)] : []'));
assert.equal(editorTopicFieldSource.includes('type="checkbox"'), false);
assert.ok(listSource.includes('onClick={() => onEdit(item.id)}'));
```

- [ ] **Step 2: Run the new UI test and verify it fails**

Run:

```bash
npx tsx --test backend/tests/newsAdminSingleTopicUi.test.ts
```

Expected: the new source contract fails against the existing multi-select UI.

### Task 4: Implement the list quick editor and full-editor single select

**Files:**
- Modify: `src/admin/news/NewsPages.tsx`

- [ ] **Step 1: Load active topics for the article list**

Add `Pencil` to the icon imports, a `topics` list state, `editingTopicId`, and
`savingTopicId`. Load `/api/v1/admin/news/topics` alongside the categories.

- [ ] **Step 2: Implement inline topic saving**

Reuse the article mutation route and update only the affected row from its
hydrated response:

```ts
async function quickUpdateTopic(
  item: NewsListResponse['items'][number],
  topicId: number | null,
): Promise<void> {
  setSavingTopicId(item.id);
  setError('');
  try {
    const article = await apiFetch<NewsArticle>(`/api/v1/admin/news/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        slug: item.slug,
        topic_ids: topicId ? [topicId] : [],
      }),
    });
    setItems((current) => current.map((currentItem) => (
      currentItem.id === item.id
        ? { ...currentItem, topics: article.topics, updated_at: article.updated_at }
        : currentItem
    )));
    setEditingTopicId(null);
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : '专题更新失败');
  } finally {
    setSavingTopicId(null);
  }
}
```

- [ ] **Step 3: Add the table column and row editor**

Increase the table minimum width, insert `专题` after `更新时间`, update empty
state `colSpan` values to six, show a chip or `未设置`, and render a native
single-select plus pencil button. The select saves in `onChange`, closes in
`onBlur`, and handles Escape in `onKeyDown`.

- [ ] **Step 4: Replace editor topic checkboxes**

Replace the checkbox group with:

```tsx
<select
  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none focus:border-neutral-400"
  value={form.topic_ids[0] ?? ''}
  onChange={(event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      topic_ids: value ? [Number(value)] : [],
    }));
  }}
>
  <option value="">无专题</option>
  {topics.map((item) => (
    <option key={item.id} value={item.id}>{item.name}</option>
  ))}
</select>
```

- [ ] **Step 5: Run focused UI tests**

Run:

```bash
npx tsx --test backend/tests/newsAdminSingleTopicUi.test.ts backend/tests/newsAdminTopicCoverUi.test.ts
```

Expected: all focused admin UI tests pass.

### Task 5: Verify the integrated change

**Files:**
- Verify all modified source, test, and generated build files.

- [ ] **Step 1: Run focused news regressions**

Run:

```bash
npx tsx --test \
  backend/tests/newsAdminRoutes.test.ts \
  backend/tests/newsRepository.test.ts \
  backend/tests/newsAdminSingleTopicUi.test.ts \
  backend/tests/newsAdminTopicCoverUi.test.ts
```

Expected: zero failures.

- [ ] **Step 2: Run both TypeScript checks**

Run:

```bash
npm run lint
npm run server:typecheck
```

Expected: both commands exit 0.

- [ ] **Step 3: Run the complete backend suite**

Run:

```bash
npm run test:backend
```

Expected: zero failures.

- [ ] **Step 4: Build production assets**

Run:

```bash
npm run build
```

Expected: Vite exits 0 and refreshes tracked production assets where required.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors and only the planned news feature, tests, plan,
and required build artifacts are changed.
