import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicViewService } from '../src/services/publicViewService';
import { renderHomePublicPage } from '../src/services/publicPageRenderer';

function fixture(ids: number[]) {
  const calls: Array<number[] | undefined> = [];
  const items = Array.from({ length: 15 }, (_, i) => ({
    airport_id: i + 1, name: `测试机场 ${i + 1}`, rank: i + 1,
    node_count: i === 14 ? 128 : i === 13 ? 0 : null,
    score: 100 - i, score_hidden: false, score_hidden_reason: null,
    status: 'normal', website: 'https://example.com', report_url: `/reports/${i+1}`,
    tags: [], plan_price_month: 10, created_at: '2026-01-01', founded_on: null,
    score_delta_vs_yesterday: { value: 0, label: '对比昨天', direction: 'flat' },
  }));
  const service = new PublicViewService({
    homeAirportRotationService: {
      getSelection: async (limit, interval) => {
        assert.equal(limit, 12);
        assert.equal(interval, 30);
        return { total: ids.length ? 15 : 0, airport_ids: ids,
          rotation: { interval_minutes: 30, round: 2, started_at: '2026-09-14T00:00:00Z', next_rotation_at: '2026-09-14T00:30:00Z' } };
      },
    },
    airportRepository: { getById: async () => null },
    metricsRepository: { getByAirportAndDate: async () => null, getTrend: async () => [] },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-09-14',
      getByAirportAndDate: async () => null, getPublicDisplayScoreByAirportAndDate: async () => null, getTrend: async () => [],
      getPublicFullRankingByDate: async (_date, _page, _size, _filters, _price, _version, selected) => {
        calls.push(selected);
        return { total: 15, items: items.filter(item => !selected || selected.includes(item.airport_id)) as never };
      },
    },
    rankingRepository: { getLatestAvailableDate: async () => '2026-09-14', getRanking: async () => [], getRanksForAirport: async () => ({}) },
    statsRepository: { getHomeStats: async () => ({ monitored_airports: 15, realtime_tests: 0, latest_data_at: null }) },
    marketingSettingsService: { getConfig: async () => ({ click_charge_amount: 1, home_rotation_interval_minutes: 30, home_section_limits: { today_pick: 12 } }) },
  });
  return { service, calls, items };
}

test('homepage orders selected IDs, retains scores, supports twelve rows and leaves full ranking unchanged', async () => {
  const ids = [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4];
  const { service, calls, items } = fixture(ids);
  const home = await service.getHomePageView('2026-09-14');
  assert.deepEqual(calls[0], ids);
  assert.deepEqual(home.ranking_preview!.items.map(item => item.airport_id), ids);
  assert.deepEqual(home.ranking_preview!.items.map(item => item.rank), Array.from({ length: 12 }, (_, i) => i + 1));
  assert.equal(home.ranking_preview!.items[0].score, items[14].score);
  assert.equal(home.ranking_preview!.total, 15);
  assert.equal(home.ranking_preview!.rotation!.interval_minutes, 30);
  const html = renderHomePublicPage('https://example.com', home);
  assert.match(html, /GateRank 优秀机场/);
  const rotationSection = html.match(/<section class="home-v3-ranking"[\s\S]*?<\/section>/)?.[0] || '';
  assert.ok(rotationSection);
  assert.doesNotMatch(rotationSection, /每 30 分钟|评分 \/ 涨跌|>公平轮换</);
  assert.match(rotationSection, /机场名称<\/th><th scope="col">节点数量/);
  assert.match(rotationSection, /<strong>128 个<\/strong>/);
  assert.match(rotationSection, /<strong>0 个<\/strong>/);
  assert.match(rotationSection, /<strong>—<\/strong>/);
  assert.match(html, /展示顺序/);
  assert.match(html, /home-v3-rank-12/);
  const ranking = await service.getFullRankingView('2026-09-14', 1, 20);
  assert.equal(calls.at(-1), undefined);
  assert.equal(ranking.items[0].airport_id, 1);
  assert.equal(items[14].rank, 15, 'homepage must not mutate shared ranking rows');
});

test('an empty eligible pool stays empty without score ranking fallback', async () => {
  const { service } = fixture([]);
  const home = await service.getHomePageView('2026-09-14');
  assert.deepEqual(home.ranking_preview!.items, []);
  assert.deepEqual(home.sections.today_pick.items, []);
  assert.match(renderHomePublicPage('https://example.com', home), /暂无符合展示条件的机场/);
});
