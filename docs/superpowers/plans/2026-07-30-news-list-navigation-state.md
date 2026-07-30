# News List Navigation State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve news-list keyword, status, category, and page across editor navigation, saves, refreshes, and browser history.

**Architecture:** Add a small pure URL-state module for parsing and serializing news list queries. Make `NewsListPage` derive its controls and requests from `routeSearch`, then let `AdminApp` carry the same search string into editor routes and back to the list using push or replace history semantics.

**Tech Stack:** React 19, TypeScript, browser History API, Node test runner, Vite.

---

### Task 1: Define and test the news list URL contract

**Files:**
- Create: `src/admin/news/newsListNavigation.ts`
- Create: `backend/tests/newsListNavigation.test.ts`

- [ ] **Step 1: Write failing query parsing and serialization tests**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNewsListPath,
  buildNewsListSearch,
  readNewsListQuery,
} from '../../src/admin/news/newsListNavigation';

test('readNewsListQuery restores valid news list state', () => {
  assert.deepEqual(
    readNewsListQuery('?keyword=USDT&status=published&category=guide&page=3'),
    {
      keyword: 'USDT',
      status: 'published',
      category: 'guide',
      page: 3,
    },
  );
});

test('readNewsListQuery falls back from invalid values', () => {
  assert.deepEqual(
    readNewsListQuery('?keyword=%20%20&status=unknown&category=%20&page=-2'),
    {
      keyword: '',
      status: 'all',
      category: 'all',
      page: 1,
    },
  );
});

test('news list URL builders omit defaults and preserve active state', () => {
  assert.equal(
    buildNewsListSearch({
      keyword: ' USDT ',
      status: 'published',
      category: 'guide',
      page: 3,
    }),
    '?keyword=USDT&status=published&category=guide&page=3',
  );
  assert.equal(
    buildNewsListPath({
      keyword: '',
      status: 'all',
      category: 'all',
      page: 1,
    }),
    '/admin/news',
  );
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
npx tsx --test backend/tests/newsListNavigation.test.ts
```

Expected: fail because `newsListNavigation.ts` does not exist.

- [ ] **Step 3: Implement the pure URL-state module**

```ts
export type NewsListStatusFilter = 'all' | 'draft' | 'published' | 'archived';

export interface NewsListQueryState {
  keyword: string;
  status: NewsListStatusFilter;
  category: string;
  page: number;
}

const NEWS_STATUS_FILTERS = new Set<NewsListStatusFilter>([
  'all',
  'draft',
  'published',
  'archived',
]);

export function readNewsListQuery(search: string): NewsListQueryState {
  const params = new URLSearchParams(search);
  const status = params.get('status') || 'all';
  const page = Number(params.get('page'));
  return {
    keyword: (params.get('keyword') || '').trim(),
    status: NEWS_STATUS_FILTERS.has(status as NewsListStatusFilter)
      ? status as NewsListStatusFilter
      : 'all',
    category: (params.get('category') || '').trim() || 'all',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function buildNewsListSearch(query: NewsListQueryState): string {
  const params = new URLSearchParams();
  const keyword = query.keyword.trim();
  if (keyword) params.set('keyword', keyword);
  if (query.status !== 'all') params.set('status', query.status);
  if (query.category !== 'all') params.set('category', query.category);
  if (query.page > 1) params.set('page', String(query.page));
  const search = params.toString();
  return search ? `?${search}` : '';
}

export function buildNewsListPath(query: NewsListQueryState): string {
  return `/admin/news${buildNewsListSearch(query)}`;
}
```

- [ ] **Step 4: Run the URL-state tests**

Run:

```bash
npx tsx --test backend/tests/newsListNavigation.test.ts
```

Expected: three tests pass.

### Task 2: Make the news list route-controlled

**Files:**
- Modify: `src/admin/news/NewsPages.tsx`
- Create: `backend/tests/newsAdminNavigationStateUi.test.ts`

- [ ] **Step 1: Write failing source-contract tests**

Read the `NewsListPage` source section and assert:

```ts
assert.ok(listSource.includes('routeSearch'));
assert.ok(listSource.includes('readNewsListQuery(routeSearch)'));
assert.ok(listSource.includes("onUpdateListUrl(buildNewsListPath(nextQuery), 'replace')"));
assert.ok(listSource.includes("onUpdateListUrl(buildNewsListPath(nextQuery), 'push')"));
assert.ok(listSource.includes('onEdit(item.id, buildNewsListSearch(listQuery))'));
assert.ok(listSource.includes('onCreate(buildNewsListSearch(listQuery))'));
```

- [ ] **Step 2: Run the UI test and verify it fails**

Run:

```bash
npx tsx --test backend/tests/newsAdminNavigationStateUi.test.ts
```

Expected: fail because the list still owns default-only state.

- [ ] **Step 3: Extend list props and derive state from the route**

```ts
interface NewsListPageProps {
  routeSearch: string;
  onUpdateListUrl: (path: string, mode: 'push' | 'replace') => void;
  onCreate: (listSearch: string) => void;
  onEdit: (id: number, listSearch: string) => void;
}
```

Inside `NewsListPage`, replace the four independent query states with:

```ts
const listQuery = useMemo(() => readNewsListQuery(routeSearch), [routeSearch]);
const { page, keyword, status, category } = listQuery;

function updateListQuery(
  nextQuery: NewsListQueryState,
  mode: 'push' | 'replace',
): void {
  onUpdateListUrl(buildNewsListPath(nextQuery), mode);
}
```

- [ ] **Step 4: Route all list controls through normalized URLs**

Keyword typing uses replace:

```tsx
onChange={(event) => {
  const nextQuery = { ...listQuery, keyword: event.target.value, page: 1 };
  onUpdateListUrl(buildNewsListPath(nextQuery), 'replace');
}}
```

Status, category, and pagination use push:

```tsx
onChange={(event) => {
  const nextQuery = {
    ...listQuery,
    status: event.target.value as NewsListStatusFilter,
    page: 1,
  };
  onUpdateListUrl(buildNewsListPath(nextQuery), 'push');
}}
```

Existing edit/create actions preserve the normalized search:

```tsx
onClick={() => onEdit(item.id, buildNewsListSearch(listQuery))}
onClick={() => onCreate(buildNewsListSearch(listQuery))}
```

- [ ] **Step 5: Normalize unavailable categories and out-of-range pages**

After categories load, replace an unknown category with `all` and page one.
After a list response, if `page` exceeds the computed last page, replace the
URL with the bounded page so the next request loads a valid result set.

- [ ] **Step 6: Run focused list UI and navigation tests**

Run:

```bash
npx tsx --test \
  backend/tests/newsAdminNavigationStateUi.test.ts \
  backend/tests/newsAdminSingleTopicUi.test.ts \
  backend/tests/newsAdminTopicCoverUi.test.ts
```

Expected: all focused UI tests pass.

### Task 3: Preserve search state through editor routes

**Files:**
- Modify: `src/admin/AdminApp.tsx`
- Modify: `backend/tests/newsAdminNavigationStateUi.test.ts`

- [ ] **Step 1: Add failing AdminApp navigation assertions**

```ts
assert.ok(adminSource.includes('const replaceNavigate = (to: string) =>'));
assert.ok(adminSource.includes('routeSearch={search}'));
assert.ok(adminSource.includes('navigate(`/admin/news/new${listSearch}`)'));
assert.ok(adminSource.includes('navigate(`/admin/news/${id}${listSearch}`)'));
assert.ok(adminSource.includes("onBack={() => navigate(`/admin/news${search}`)}"));
assert.ok(adminSource.includes('onNavigateToArticle={(id) => navigate(`/admin/news/${id}${search}`)}'));
```

- [ ] **Step 2: Run the source test and verify the AdminApp assertions fail**

Run:

```bash
npx tsx --test backend/tests/newsAdminNavigationStateUi.test.ts
```

Expected: the list assertions pass after Task 2 and the new AdminApp assertions
fail.

- [ ] **Step 3: Add push and replace navigation helpers**

```ts
const updateLocation = (to: string, mode: 'push' | 'replace') => {
  window.history[mode === 'replace' ? 'replaceState' : 'pushState']({}, '', to);
  setPath(window.location.pathname);
  setSearch(window.location.search);
  setMobileNavOpen(false);
};

const navigate = (to: string) => updateLocation(to, 'push');
const replaceNavigate = (to: string) => updateLocation(to, 'replace');
```

- [ ] **Step 4: Wire the news list and editor**

```tsx
<NewsListPage
  routeSearch={search}
  onUpdateListUrl={(to, mode) => (
    mode === 'replace' ? replaceNavigate(to) : navigate(to)
  )}
  onCreate={(listSearch) => navigate(`/admin/news/new${listSearch}`)}
  onEdit={(id, listSearch) => navigate(`/admin/news/${id}${listSearch}`)}
/>
```

```tsx
<NewsEditorPage
  articleId={path === '/admin/news/new' ? undefined : Number(path.split('/')[3])}
  onBack={() => navigate(`/admin/news${search}`)}
  onNavigateToArticle={(id) => navigate(`/admin/news/${id}${search}`)}
/>
```

- [ ] **Step 5: Run focused navigation tests**

Run:

```bash
npx tsx --test \
  backend/tests/newsListNavigation.test.ts \
  backend/tests/newsAdminNavigationStateUi.test.ts
```

Expected: all URL and navigation tests pass.

### Task 4: Verify and package the change

**Files:**
- Verify: `src/admin/news/newsListNavigation.ts`
- Verify: `src/admin/news/NewsPages.tsx`
- Verify: `src/admin/AdminApp.tsx`
- Verify: `backend/tests/newsListNavigation.test.ts`
- Verify: `backend/tests/newsAdminNavigationStateUi.test.ts`
- Regenerate: `dist/assets/AdminApp.js`
- Regenerate: `dist/assets/index.css`

- [ ] **Step 1: Run all focused news tests**

```bash
npx tsx --test \
  backend/tests/newsListNavigation.test.ts \
  backend/tests/newsAdminNavigationStateUi.test.ts \
  backend/tests/newsAdminSingleTopicUi.test.ts \
  backend/tests/newsAdminTopicCoverUi.test.ts \
  backend/tests/newsAdminRoutes.test.ts \
  backend/tests/newsRepository.test.ts
```

Expected: zero failures.

- [ ] **Step 2: Run frontend TypeScript**

```bash
npm run lint
```

Expected: exit 0.

- [ ] **Step 3: Run the complete backend suite**

```bash
npm run test:backend
```

Expected: zero failures.

- [ ] **Step 4: Build production assets**

```bash
npm run build
```

Expected: Vite exits 0 and refreshes the tracked admin bundle.

- [ ] **Step 5: Verify the running local frontend**

```bash
curl -fsS http://127.0.0.1:3000/src/admin/news/NewsPages.tsx \
  | rg 'readNewsListQuery|buildNewsListPath|routeSearch'
```

Expected: the live Vite module contains the route-state implementation.

- [ ] **Step 6: Review and commit the exact feature diff**

```bash
git diff --check
git status --short
git diff --stat
git add \
  src/admin/news/newsListNavigation.ts \
  src/admin/news/NewsPages.tsx \
  src/admin/AdminApp.tsx \
  backend/tests/newsListNavigation.test.ts \
  backend/tests/newsAdminNavigationStateUi.test.ts \
  dist/assets/AdminApp.js \
  dist/assets/index.css
git commit -m "fix: preserve news list navigation state"
```
