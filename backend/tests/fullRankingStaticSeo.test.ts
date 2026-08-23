import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFullRankingPath,
  buildFullRankingStaticPath,
  EMPTY_FULL_RANKING_FILTERS,
  getIndexableFullRankingFilterPaths,
  parseFullRankingStaticPath,
} from '../../shared/fullRankingFilters';
import { buildFullRankingHeading, buildFullRankingSeo } from '../../shared/publicSeo';
import { AIRPORT_REGION_FILTERS } from '../../shared/airportFilterCatalog';
import { NODE_REGION_CATALOG } from '../../shared/nodeRegionCatalog';

test('static full ranking filter paths cover priority SEO examples', () => {
  const checks = [
    ['payment', 'alipay', '/rankings/payment/alipay', '支持支付宝的机场 VPN 推荐排名'],
    ['payment', 'usdt_trc20', '/rankings/payment/usdt-trc20', '支持 USDT-TRC20 的机场 VPN 推荐排名'],
    ['client', 'shadowrocket', '/rankings/client/shadowrocket', '支持 Shadowrocket 机场推荐'],
    ['client', 'surge', '/rankings/client/surge', '支持 Surge 机场推荐'],
    ['region', 'hong_kong', '/rankings/region/hong-kong', '香港节点机场排行榜'],
    ['region', 'japan', '/rankings/region/japan', '日本节点机场排行榜'],
    ['line', 'iepl', '/rankings/line/iepl', 'IEPL 专线机场排名'],
    ['streaming', 'chatgpt', '/rankings/unlock/chatgpt', '支持 ChatGPT 机场推荐'],
    ['streaming', 'netflix', '/rankings/unlock/netflix', '支持 Netflix 机场推荐'],
  ] as const;

  for (const [category, value, path, heading] of checks) {
    const filters = { ...EMPTY_FULL_RANKING_FILTERS, [category]: [value] };
    assert.equal(buildFullRankingStaticPath(category, value), path);
    assert.equal(buildFullRankingPath(filters), path);
    assert.deepEqual(parseFullRankingStaticPath(path), { category, value });
    assert.equal(buildFullRankingHeading(filters), heading);
    assert.doesNotMatch(buildFullRankingSeo({ filters }).title, /机场机场/);
  }
});

test('region filters cover the shared node catalog without indexing newly added long-tail regions', () => {
  assert.equal(AIRPORT_REGION_FILTERS.length, NODE_REGION_CATALOG.length);
  assert.equal(new Set(AIRPORT_REGION_FILTERS.map((item) => item.key)).size, NODE_REGION_CATALOG.length);
  assert.equal(new Set(AIRPORT_REGION_FILTERS.map((item) => item.regionCode)).size, NODE_REGION_CATALOG.length);

  for (const region of NODE_REGION_CATALOG) {
    const option = AIRPORT_REGION_FILTERS.find((item) => item.key === region.key);
    assert.deepEqual(
      option && { code: option.regionCode, label: option.label },
      { code: region.code, label: region.label },
    );
  }

  const thailandFilters = { ...EMPTY_FULL_RANKING_FILTERS, region: ['thailand'] };
  assert.equal(buildFullRankingPath(thailandFilters), '/rankings/all?region=thailand');
  assert.equal(parseFullRankingStaticPath('/rankings/region/thailand'), null);
  assert.ok(!getIndexableFullRankingFilterPaths().includes('/rankings/region/thailand'));
  assert.ok(getIndexableFullRankingFilterPaths().includes('/rankings/region/turkey'));
});
