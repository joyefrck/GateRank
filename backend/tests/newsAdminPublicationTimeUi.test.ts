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
