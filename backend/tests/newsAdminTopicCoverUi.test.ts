import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const newsPagesSource = readFileSync(path.resolve(process.cwd(), 'src/admin/news/NewsPages.tsx'), 'utf8');
const topicPanelSource = newsPagesSource.slice(
  newsPagesSource.indexOf('function TopicManagementPanel()'),
  newsPagesSource.indexOf('export function NewsEditorPage'),
);

test('topic management uses the Pexels cover picker instead of a cover URL input', () => {
  assert.ok(topicPanelSource.includes('从图库选择专题封面'));
  assert.ok(topicPanelSource.includes('<CoverPickerModal'));
  assert.equal(topicPanelSource.includes('封面图 URL'), false);
});

test('admin pexels cover imports include SEO filename context', () => {
  const contextSlugMatches = newsPagesSource.match(/context_slug:\s*form\.slug/g) || [];
  const altMatches = newsPagesSource.match(/alt:\s*item\.alt/g) || [];
  assert.ok(contextSlugMatches.length >= 2);
  assert.ok(altMatches.length >= 2);
  assert.ok(newsPagesSource.includes("target: 'topic'"));
  assert.ok(newsPagesSource.includes("target: 'article'"));
});
