import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicViewService } from '../src/services/publicViewService';

test('PublicViewService.getHomePageView falls back to latest ranking date', async () => {
  const rankingDates: string[] = [];
  const statsDates: string[] = [];
  const service = new PublicViewService({
    airportRepository: {
      getById: async () => null,
    },
    metricsRepository: {
      getByAirportAndDate: async () => null,
      getTrend: async () => [],
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async () => null,
      getTrend: async () => [],
      getPublicFullRankingByDate: async () => ({
        total: 0,
        items: [],
      }),
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async (date: string) => {
        rankingDates.push(date);
        return [];
      },
      getRanksForAirport: async () => ({}),
    },
    statsRepository: {
      getHomeStats: async (date: string) => {
        statsDates.push(date);
        return {
          monitored_airports: 3,
          realtime_tests: 12,
          latest_data_at: '2026-03-24T10:00:00+08:00',
        };
      },
    },
  });

  const result = await service.getHomePageView('2026-03-25');
  assert.equal(result.date, '2026-03-24');
  assert.equal(result.hero.report_time_at, '2026-03-24T10:00:00+08:00');
  assert.deepEqual(statsDates, ['2026-03-24']);
  assert.deepEqual(rankingDates, [
    '2026-03-24',
    '2026-03-24',
    '2026-03-24',
    '2026-03-24',
    '2026-03-24',
  ]);
});

test('PublicViewService.getFullRankingView falls back to latest score date', async () => {
  const requestedDates: string[] = [];
  const service = new PublicViewService({
    airportRepository: {
      getById: async () => null,
    },
    metricsRepository: {
      getByAirportAndDate: async () => null,
      getTrend: async () => [],
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async () => null,
      getTrend: async () => [],
      getPublicFullRankingByDate: async (date: string, page: number, pageSize: number) => {
        requestedDates.push(`${date}:${page}:${pageSize}`);
        return {
          total: 2,
          items: [],
        };
      },
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async () => [],
      getRanksForAirport: async () => ({}),
    },
    statsRepository: {
      getHomeStats: async () => ({
        monitored_airports: 3,
        realtime_tests: 12,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getFullRankingView('2026-03-25', 2, 20);
  assert.equal(result.date, '2026-03-24');
  assert.equal(result.page, 2);
  assert.equal(result.page_size, 20);
  assert.deepEqual(requestedDates, ['2026-03-24:2:20']);
});

test('PublicViewService.getHomePageView builds fallback cards from public scores when rankings are empty', async () => {
  const service = new PublicViewService({
    airportRepository: {
      getById: async (id: number) => ({
        id,
        name: 'Alpha',
        website: 'https://alpha.example.com',
        status: 'normal',
        plan_price_month: 12,
        has_trial: true,
        tags: ['稳定'],
        created_at: '2026-03-20',
      }),
    },
    metricsRepository: {
      getByAirportAndDate: async () => ({
        airport_id: 1,
        date: '2026-03-24',
        uptime_percent_30d: 99.9,
        median_latency_ms: 52,
        median_download_mbps: 88,
        packet_loss_percent: 0,
        stable_days_streak: 5,
        domain_ok: true,
        ssl_days_left: 120,
        recent_complaints_count: 0,
        history_incidents: 0,
      }),
      getTrend: async () => [{
        airport_id: 1,
        date: '2026-03-24',
        uptime_percent_30d: 99.9,
        median_latency_ms: 52,
        median_download_mbps: 88,
        packet_loss_percent: 0,
        stable_days_streak: 5,
        domain_ok: true,
        ssl_days_left: 120,
        recent_complaints_count: 0,
        history_incidents: 0,
      }],
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async () => ({
        airport_id: 1,
        date: '2026-03-24',
        s: 82,
        p: 76,
        c: 70,
        r: 95,
        risk_penalty: 0,
        score: 80,
        recent_score: 80,
        historical_score: 78,
        final_score: 79,
        details: {
          total_score: 83,
        },
      }),
      getTrend: async () => [{
        airport_id: 1,
        date: '2026-03-24',
        s: 82,
        p: 76,
        c: 70,
        r: 95,
        risk_penalty: 0,
        score: 80,
        recent_score: 80,
        historical_score: 78,
        final_score: 79,
        details: {
          total_score: 83,
        },
      }],
      getPublicFullRankingByDate: async () => ({
        total: 1,
        items: [
          {
            airport_id: 1,
            rank: 1,
            name: 'Alpha',
            website: 'https://alpha.example.com',
            status: 'normal',
            tags: ['稳定'],
            founded_on: '2024-01-01',
            plan_price_month: 12,
            has_trial: true,
            airport_intro: 'Alpha intro',
            created_at: '2026-03-20',
            score: 83,
            report_url: '/reports/1?date=2026-03-24',
          },
        ],
      }),
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async () => [],
      getRanksForAirport: async () => ({}),
    },
    statsRepository: {
      getHomeStats: async () => ({
        monitored_airports: 1,
        realtime_tests: 8,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getHomePageView('2026-03-25');
  assert.equal(result.date, '2026-03-24');
  assert.equal(result.hero.report_time_at, '2026-03-24T10:00:00+08:00');
  assert.equal(result.sections.today_pick.items.length, 1);
  assert.equal(result.sections.today_pick.items[0].name, 'Alpha');
  assert.equal(result.sections.most_stable.items.length, 1);
});
