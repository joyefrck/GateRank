import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const adminAppSource = readFileSync(resolve(process.cwd(), 'src/admin/AdminApp.tsx'), 'utf8');
const marketingTabsPath = resolve(process.cwd(), 'src/admin/marketing/MarketingModuleTabs.tsx');
const marketingStatisticsPath = resolve(process.cwd(), 'src/admin/marketing/MarketingStatisticsPage.tsx');
const marketingTabsSource = existsSync(marketingTabsPath) ? readFileSync(marketingTabsPath, 'utf8') : '';
const marketingStatisticsSource = existsSync(marketingStatisticsPath) ? readFileSync(marketingStatisticsPath, 'utf8') : '';

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

test('marketing module keeps one sidebar item and exposes settings and statistics tabs', () => {
  assert.equal((adminAppSource.match(/label: '营销模块'/g) || []).length, 1);
  assert.match(adminAppSource, /path === '\/admin\/marketing-settings' \|\| path === '\/admin\/marketing-statistics'/);
  assert.match(adminAppSource, /path === '\/admin\/marketing-statistics'/);
  assert.match(marketingTabsSource, /营销设置/);
  assert.match(marketingTabsSource, /营销统计/);
});

test('admin marketing statistics renders campaign context, metrics, pagination, and recovery states', () => {
  assert.match(marketingStatisticsSource, /\/api\/v1\/admin\/marketing\/ad-campaigns/);
  assert.match(marketingStatisticsSource, /每日统计/);
  assert.match(marketingStatisticsSource, /机场 \/ 优惠码/);
  assert.match(marketingStatisticsSource, /申请有效期/);
  assert.match(marketingStatisticsSource, /累计曝光/);
  assert.match(marketingStatisticsSource, /累计点击/);
  assert.match(marketingStatisticsSource, /总体点击率/);
  assert.match(marketingStatisticsSource, /精确统计始于/);
  assert.match(marketingStatisticsSource, /暂无精确访问数据/);
  assert.match(marketingStatisticsSource, /重新加载/);
  assert.match(marketingStatisticsSource, /每页 30 条/);
  assert.match(marketingStatisticsSource, /role="dialog"/);
  assert.match(marketingStatisticsSource, /aria-modal="true"/);
});
