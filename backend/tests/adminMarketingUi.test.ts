import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const adminAppSource = readFileSync(resolve(process.cwd(), 'src/admin/AdminApp.tsx'), 'utf8');

test('marketing page renders airport conversion before collapsed popular pages table', () => {
  const airportConversionIndex = adminAppSource.indexOf('机场转化表');
  const popularPagesIndex = adminAppSource.indexOf('热门页面');
  const popularPagesTableIndex = adminAppSource.indexOf('marketing-popular-pages-table');

  assert.notEqual(airportConversionIndex, -1);
  assert.notEqual(popularPagesIndex, -1);
  assert.notEqual(popularPagesTableIndex, -1);
  assert.ok(airportConversionIndex < popularPagesIndex);
  assert.ok(popularPagesIndex < popularPagesTableIndex);
  assert.match(adminAppSource, /const \[isPopularPagesOpen, setIsPopularPagesOpen\] = useState\(false\);/);
  assert.match(adminAppSource, /aria-expanded=\{isPopularPagesOpen\}/);
  assert.match(adminAppSource, /aria-controls="marketing-popular-pages-table"/);
  assert.match(adminAppSource, /\{isPopularPagesOpen && \(/);
});
