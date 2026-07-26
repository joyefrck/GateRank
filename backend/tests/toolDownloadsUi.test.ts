import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const appSource = readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
const cardStart = appSource.indexOf('function ToolDownloadCard(');
const cardEnd = appSource.indexOf('function ToolPlaceholderPage(', cardStart);
const toolDownloadCardSource = appSource.slice(cardStart, cardEnd);

test('client-rendered tool download links defer the filename to the response header', () => {
  assert.ok(cardStart >= 0);
  assert.ok(cardEnd > cardStart);
  assert.match(toolDownloadCardSource, /href=\{buildToolControlledDownloadUrl\(item, platform\)\}/);
  assert.doesNotMatch(toolDownloadCardSource, /\bdownload=/);
  assert.doesNotMatch(appSource, /\bbuildToolDownloadFilename\b/);
});
