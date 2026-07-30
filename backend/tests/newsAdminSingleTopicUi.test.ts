import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const newsPagesSource = readFileSync(path.resolve(process.cwd(), 'src/admin/news/NewsPages.tsx'), 'utf8');
const listSource = newsPagesSource.slice(
  newsPagesSource.indexOf('export function NewsListPage'),
  newsPagesSource.indexOf('function TopicManagementPanel()'),
);
const editorSource = newsPagesSource.slice(
  newsPagesSource.indexOf('export function NewsEditorPage'),
  newsPagesSource.indexOf('function StatusPill'),
);
const editorTopicFieldSource = editorSource.slice(
  editorSource.indexOf('<Field label="分类与专题">'),
  editorSource.indexOf('<Field label="首页推荐">'),
);
const listHeaderSource = listSource.slice(
  listSource.indexOf('<thead'),
  listSource.indexOf('</thead>'),
);

test('news list shows topic after updated time and keeps the full editor action', () => {
  assert.ok(listHeaderSource.indexOf('更新时间') < listHeaderSource.indexOf('专题'));
  assert.ok(listHeaderSource.indexOf('专题') < listHeaderSource.indexOf('操作'));
  assert.ok(listSource.includes('未设置'));
  assert.ok(listSource.includes('<Pencil'));
  assert.ok(listSource.includes('onClick={() => onEdit(item.id)}'));
});

test('news list quick topic editor saves one optional topic through the article patch route', () => {
  assert.ok(listSource.includes("method: 'PATCH'"));
  assert.ok(listSource.includes('slug: item.slug'));
  assert.ok(listSource.includes('topic_ids: topicId ? [topicId] : []'));
  assert.ok(listSource.includes("err instanceof Error ? err.message : '专题更新失败'"));
});

test('news full editor exposes an optional single-topic select', () => {
  assert.ok(editorTopicFieldSource.includes('<option value="">无专题</option>'));
  assert.ok(editorTopicFieldSource.includes('topic_ids: value ? [Number(value)] : []'));
  assert.equal(editorTopicFieldSource.includes('type="checkbox"'), false);
});
