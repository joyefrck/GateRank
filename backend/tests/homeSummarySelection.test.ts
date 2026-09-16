import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PublicViewService } from '../src/services/publicViewService';
import { renderHomePublicPage } from '../src/services/publicPageRenderer';
import { nextHomeRotationAt } from '../../shared/homeAirportRotation';
import type { HomeAirportSelection } from '../src/services/homeAirportRotationService';

const rotation = { interval_minutes: 30, round: 1, started_at: '2026-09-16T00:00:00Z', next_rotation_at: '2026-09-16T00:30:00Z' };
const selection = (ids: number[]): HomeAirportSelection => ({ airport_ids: ids, total: ids.length, rotation });

function fixture(ids: number[] = [7, 3, 1], withdrawn = false) {
  const deps: ConstructorParameters<typeof PublicViewService>[0] = {
    homeAirportRotationService: {
      getSelection: async () => selection([]),
      getSummarySelections: async (date, limits, interval, version) => {
        assert.equal(date, '2026-09-16'); assert.equal(interval, 30); assert.equal(version, 'v1_spcr');
        assert.equal(limits.most_stable, 2); assert.equal(limits.best_value, 3);
        return { most_stable: selection(ids.slice(0, 2)), best_value: selection(ids) };
      },
    },
    airportRepository: { getById: async id => ({ id, name: `测试机场${id}`, slug: `summary-${id}`,
      website: 'https://example.com', status: withdrawn && id === 7 ? 'risk' : 'normal', tags: [], is_listed: true,
      plan_price_month: 10, has_trial: false, founded_on: '2024-01-01', created_at: '2026-01-01' }) },
    metricsRepository: { getByAirportAndDate: async id => ({ airport_id: id, date: '2026-09-16',
      stable_days_streak: 14, domain_ok: true, ssl_days_left: 90, recent_complaints_count: 0, history_incidents: 0,
      uptime_percent_30d: 99.9, median_latency_ms: 50, median_download_mbps: 100, packet_loss_percent: 0 }), getTrend: async () => [] },
    scoreRepository: { getLatestAvailableDate: async () => '2026-09-16',
      getByAirportAndDate: async id => ({ airport_id: id, date: '2026-09-16', s: 80, p: 65, c: 75, r: 75,
        risk_penalty: 0, score: 100-id, recent_score: 100-id, historical_score: 100-id, final_score: 100-id }),
      getPublicDisplayScoreByAirportAndDate: async id => 100-id, getTrend: async () => [],
      getPublicFullRankingByDate: async () => ({ total: 0, items: [] }) },
    rankingRepository: { getLatestAvailableDate: async () => '2026-09-16', getRanksForAirport: async () => ({}),
      getRanking: async (_date, type) => { assert.equal(type, 'new', 'old stable/value rankings must not drive homepage'); return []; } },
    statsRepository: { getHomeStats: async () => ({ monitored_airports: 7, realtime_tests: 0, latest_data_at: null }) },
    marketingSettingsService: { getConfig: async () => ({ click_charge_amount: 1, home_rotation_interval_minutes: 30,
      home_section_limits: { most_stable: 2, best_value: 3 } }) },
  };
  return new PublicViewService(deps);
}

test('home summary API keeps independent queue order, configured sizes and actual scores; SSR uses matching copy', async () => {
  const home = await fixture().getHomePageView('2026-09-16');
  assert.deepEqual(home.sections.most_stable.items.map(row => row.airport_id), [7, 3]);
  assert.deepEqual(home.sections.best_value.items.map(row => row.airport_id), [7, 3, 1]);
  assert.deepEqual(home.sections.best_value.items.map(row => row.score), [93, 97, 99]);
  assert.deepEqual(home.sections.best_value.rotation, rotation);
  const html = renderHomePublicPage('https://example.com', home);
  assert.match(html, /性价比推荐/); assert.match(html, /稳定实惠 · 公平轮换/);
  assert.match(html, /稳定达标 · 公平轮换/); assert.doesNotMatch(html, /性价比最佳|IEPL专线 · 不宕机/);
});

test('empty summary pools stay empty; a selected airport becoming risky is rejected at card construction', async () => {
  const empty = await fixture([]).getHomePageView('2026-09-16');
  assert.deepEqual(empty.sections.most_stable.items, []); assert.deepEqual(empty.sections.best_value.items, []);
  const home = await fixture([7, 3, 1], true).getHomePageView('2026-09-16');
  assert.deepEqual(home.sections.most_stable.items.map(row => row.airport_id), [3]);
  assert.deepEqual(home.sections.best_value.items.map(row => row.airport_id), [3, 1]);
});

test('refresh follows earliest of all three independent queues, including absent excellent-airport metadata', () => {
  const earlier = { ...rotation, next_rotation_at: '2026-09-16T00:05:00Z' };
  assert.equal(nextHomeRotationAt([rotation, earlier, undefined]), Date.parse(earlier.next_rotation_at));
  assert.equal(nextHomeRotationAt([undefined, earlier, rotation]), Date.parse(earlier.next_rotation_at));
  assert.equal(nextHomeRotationAt([undefined]), null);
  const react = readFileSync(new URL('../../src/pages/home/HomePageV3.tsx', import.meta.url), 'utf8');
  assert.match(react, /nextHomeRotationAt\(\[data\?\.ranking_preview\?\.rotation,[\s\S]*?data\?\.sections\.most_stable\.rotation, data\?\.sections\.best_value\.rotation\]/);
});
