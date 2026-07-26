import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const adminSource = readFileSync(path.resolve(process.cwd(), 'src/admin/AdminApp.tsx'), 'utf8');
const listStart = adminSource.indexOf('<h2 className="text-lg font-black tracking-normal">软件列表</h2>');
const listEnd = adminSource.indexOf('<h2 className="font-black tracking-normal">页面 SEO 配置</h2>', listStart);
const softwareListSource = adminSource.slice(listStart, listEnd);

test('software list renders a dedicated software version column', () => {
  assert.ok(listStart >= 0);
  assert.ok(listEnd > listStart);
  assert.match(softwareListSource, />平台与系统版本<\/th>/);
  assert.match(softwareListSource, />软件版本<\/th>/);
  assert.ok(
    softwareListSource.indexOf('平台与系统版本') < softwareListSource.indexOf('软件版本'),
  );
  assert.match(softwareListSource, /\{item\.version \|\| '—'\}/);
  assert.match(softwareListSource, /colSpan=\{6\}/);
});
