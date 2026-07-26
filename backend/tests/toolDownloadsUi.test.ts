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

test('hot tool cards reserve badge space only on the title and keep responsive trust metadata', () => {
  assert.match(
    toolDownloadCardSource,
    /<h3 className=\{`truncate text-lg font-black text-slate-950 \$\{item\.is_hot \? 'pr-16' : ''\}`\}>/,
  );
  assert.match(
    toolDownloadCardSource,
    /<p className="whitespace-normal break-words text-sm leading-5 text-slate-500 sm:whitespace-nowrap">/,
  );
  assert.match(toolDownloadCardSource, /<div className="min-w-0 flex-1">/);
  assert.doesNotMatch(
    toolDownloadCardSource,
    /<div className=\{`flex items-center gap-3 \$\{item\.is_hot \? 'pr-16' : ''\}`\}>/,
  );
  assert.doesNotMatch(
    toolDownloadCardSource,
    /<p className="truncate text-sm text-slate-500">/,
  );
});
