import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFullRankingPath,
  buildFullRankingStaticPath,
  EMPTY_FULL_RANKING_FILTERS,
  parseFullRankingStaticPath,
} from '../../shared/fullRankingFilters';
import { buildFullRankingHeading, buildFullRankingSeo } from '../../shared/publicSeo';

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
