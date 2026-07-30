import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const newsPagesSource = readFileSync(
  path.resolve(process.cwd(), 'src/admin/news/NewsPages.tsx'),
  'utf8',
);
const adminSource = readFileSync(
  path.resolve(process.cwd(), 'src/admin/AdminApp.tsx'),
  'utf8',
);
const listSource = newsPagesSource.slice(
  newsPagesSource.indexOf('export function NewsListPage'),
  newsPagesSource.indexOf('function TopicManagementPanel()'),
);

test('news list is controlled by the route search and writes normalized URLs', () => {
  assert.ok(listSource.includes('routeSearch'));
  assert.ok(listSource.includes('readNewsListQuery(routeSearch)'));
  assert.ok(listSource.includes("onUpdateListUrl(buildNewsListPath(nextQuery), 'replace')"));
  assert.ok(listSource.includes("onUpdateListUrl(buildNewsListPath(nextQuery), 'push')"));
  assert.ok(listSource.includes('onEdit(item.id, buildNewsListSearch(listQuery))'));
  assert.ok(listSource.includes('onCreate(buildNewsListSearch(listQuery))'));
});

test('admin navigation carries news list state into and out of the editor', () => {
  assert.ok(adminSource.includes('const replaceNavigate = (to: string) =>'));
  assert.ok(adminSource.includes('routeSearch={search}'));
  assert.ok(adminSource.includes('navigate(`/admin/news/new${listSearch}`)'));
  assert.ok(adminSource.includes('navigate(`/admin/news/${id}${listSearch}`)'));
  assert.ok(adminSource.includes('onBack={() => navigate(`/admin/news${search}`)}'));
  assert.ok(adminSource.includes(
    'onNavigateToArticle={(id) => navigate(`/admin/news/${id}${search}`)}',
  ));
});
