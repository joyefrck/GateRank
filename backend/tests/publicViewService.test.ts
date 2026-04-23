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
      getPublicDisplayScoreByAirportAndDate: async () => null,
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
  assert.equal(result.requested_date, '2026-03-25');
  assert.equal(result.date, '2026-03-24');
  assert.equal(result.resolved_from_fallback, true);
  assert.match(result.fallback_notice || '', /2026-03-25/);
  assert.equal(result.hero.report_time_at, '2026-03-24T10:00:00+08:00');
  assert.deepEqual(statsDates, ['2026-03-24']);
  assert.deepEqual(rankingDates, [
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
      getPublicDisplayScoreByAirportAndDate: async () => null,
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
        is_listed: true,
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
      getPublicDisplayScoreByAirportAndDate: async () => 80,
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
            score_delta_vs_yesterday: {
              label: '对比昨天',
              value: 3,
            },
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
  assert.equal(result.requested_date, '2026-03-25');
  assert.equal(result.date, '2026-03-24');
  assert.equal(result.resolved_from_fallback, true);
  assert.equal(result.hero.report_time_at, '2026-03-24T10:00:00+08:00');
  assert.equal(result.sections.today_pick.items.length, 1);
  assert.equal(result.sections.today_pick.items[0].name, 'Alpha');
  assert.deepEqual(result.sections.today_pick.items[0].score_delta_vs_yesterday, {
    label: '对比昨天',
    value: 3,
  });
  assert.equal(result.sections.today_pick.items[0].stability_tier, 'stable');
  assert.equal(result.sections.most_stable.items.length, 1);
});

test('PublicViewService.getHomePageView fallback today picks follow relaxed filters and score ordering', async () => {
  const airportById = new Map([
    [1, {
      id: 1,
      name: 'Alpha',
      website: 'https://alpha.example.com',
      status: 'normal' as const,
      is_listed: true,
      plan_price_month: 12,
      has_trial: true,
      tags: ['稳定'],
      created_at: '2026-03-20',
    }],
    [2, {
      id: 2,
      name: 'Beta',
      website: 'https://beta.example.com',
      status: 'normal' as const,
      is_listed: true,
      plan_price_month: 13,
      has_trial: true,
      tags: ['波动'],
      created_at: '2026-03-20',
    }],
    [3, {
      id: 3,
      name: 'Gamma',
      website: 'https://gamma.example.com',
      status: 'normal' as const,
      is_listed: true,
      plan_price_month: 14,
      has_trial: true,
      tags: ['风险观察'],
      created_at: '2026-03-20',
    }],
  ]);

  const metricById = new Map([
    [1, {
      airport_id: 1,
      date: '2026-03-24',
      uptime_percent_30d: 99.9,
      median_latency_ms: 52,
      median_download_mbps: 88,
      packet_loss_percent: 0,
      stable_days_streak: 5,
      healthy_days_streak: 5,
      stability_tier: 'stable' as const,
      domain_ok: true,
      ssl_days_left: 120,
      recent_complaints_count: 0,
      history_incidents: 0,
    }],
    [2, {
      airport_id: 2,
      date: '2026-03-24',
      uptime_percent_30d: 98.9,
      median_latency_ms: 61,
      median_download_mbps: 80,
      packet_loss_percent: 0.2,
      stable_days_streak: 4,
      healthy_days_streak: 4,
      stability_tier: 'volatile' as const,
      domain_ok: true,
      ssl_days_left: 120,
      recent_complaints_count: 0,
      history_incidents: 0,
    }],
    [3, {
      airport_id: 3,
      date: '2026-03-24',
      uptime_percent_30d: 99.5,
      median_latency_ms: 55,
      median_download_mbps: 82,
      packet_loss_percent: 0,
      stable_days_streak: 6,
      healthy_days_streak: 6,
      stability_tier: 'stable' as const,
      domain_ok: true,
      ssl_days_left: 120,
      recent_complaints_count: 0,
      history_incidents: 0,
    }],
  ]);

  const scoreById = new Map([
    [1, {
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
    [2, {
      airport_id: 2,
      date: '2026-03-24',
      s: 75,
      p: 70,
      c: 68,
      r: 88,
      risk_penalty: 8,
      score: 92,
      recent_score: 92,
      historical_score: 90,
      final_score: 91,
      details: {
        total_score: 96,
      },
    }],
    [3, {
      airport_id: 3,
      date: '2026-03-24',
      s: 90,
      p: 82,
      c: 72,
      r: 93,
      risk_penalty: 0,
      score: 89,
      recent_score: 89,
      historical_score: 87,
      final_score: 88,
      details: {
        total_score: 99,
      },
    }],
  ]);

  const service = new PublicViewService({
    airportRepository: {
      getById: async (id: number) => airportById.get(id) || null,
    },
    metricsRepository: {
      getByAirportAndDate: async (airportId: number) => metricById.get(airportId) || null,
      getTrend: async (airportId: number) => {
        const metric = metricById.get(airportId);
        return metric ? [metric] : [];
      },
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async (airportId: number) => scoreById.get(airportId) || null,
      getPublicDisplayScoreByAirportAndDate: async (airportId: number) => {
        const score = scoreById.get(airportId);
        return score ? Number(score.details?.total_score ?? score.final_score) - 1 : null;
      },
      getTrend: async (airportId: number) => {
        const score = scoreById.get(airportId);
        return score ? [score] : [];
      },
      getPublicFullRankingByDate: async () => ({
        total: 3,
        items: [
          {
            airport_id: 3,
            rank: 1,
            name: 'Gamma',
            website: 'https://gamma.example.com',
            status: 'normal' as const,
            tags: ['风险观察'],
            founded_on: '2024-01-01',
            plan_price_month: 14,
            has_trial: true,
            airport_intro: 'Gamma intro',
            created_at: '2026-03-20',
            score: 99,
            score_delta_vs_yesterday: {
              label: '对比昨天',
              value: 1,
            },
            report_url: '/reports/3?date=2026-03-24',
          },
          {
            airport_id: 2,
            rank: 2,
            name: 'Beta',
            website: 'https://beta.example.com',
            status: 'normal' as const,
            tags: ['波动'],
            founded_on: '2024-01-01',
            plan_price_month: 13,
            has_trial: true,
            airport_intro: 'Beta intro',
            created_at: '2026-03-20',
            score: 96,
            score_delta_vs_yesterday: {
              label: '对比昨天',
              value: 1,
            },
            report_url: '/reports/2?date=2026-03-24',
          },
          {
            airport_id: 1,
            rank: 3,
            name: 'Alpha',
            website: 'https://alpha.example.com',
            status: 'normal' as const,
            tags: ['稳定'],
            founded_on: '2024-01-01',
            plan_price_month: 12,
            has_trial: true,
            airport_intro: 'Alpha intro',
            created_at: '2026-03-20',
            score: 83,
            score_delta_vs_yesterday: {
              label: '对比昨天',
              value: 1,
            },
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
        monitored_airports: 3,
        realtime_tests: 8,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getHomePageView('2026-03-25');

  assert.deepEqual(result.sections.today_pick.items.map((item) => item.name), ['Beta', 'Alpha']);
  assert.equal(result.sections.today_pick.items[0].score, 96);
  assert.equal(result.sections.today_pick.items[0].stability_tier, 'volatile');
});

test('PublicViewService.getHomePageView builds today pick details and positive highlights only', async () => {
  const service = new PublicViewService({
    airportRepository: {
      getById: async () => ({
        id: 1,
        name: 'Alpha',
        website: 'https://alpha.example.com',
        status: 'normal' as const,
        is_listed: true,
        plan_price_month: 12,
        has_trial: true,
        tags: ['性价比高'],
        created_at: '2026-01-20',
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
        stable_days_streak: 0,
        healthy_days_streak: 12,
        stability_tier: 'minor_fluctuation' as const,
        domain_ok: true,
        ssl_days_left: 120,
        recent_complaints_count: 0,
        history_incidents: 0,
      }),
      getTrend: async () => [
        {
          airport_id: 1,
          date: '2026-03-23',
          uptime_percent_30d: 99.9,
          median_latency_ms: 52,
          median_download_mbps: 88,
          packet_loss_percent: 0,
          stable_days_streak: 10,
          healthy_days_streak: 11,
          stability_tier: 'stable' as const,
          is_stable_day: true,
          domain_ok: true,
          ssl_days_left: 120,
          recent_complaints_count: 0,
          history_incidents: 0,
        },
        {
          airport_id: 1,
          date: '2026-03-24',
          uptime_percent_30d: 99.9,
          median_latency_ms: 52,
          median_download_mbps: 88,
          packet_loss_percent: 0,
          stable_days_streak: 0,
          healthy_days_streak: 12,
          stability_tier: 'minor_fluctuation' as const,
          is_stable_day: false,
          domain_ok: true,
          ssl_days_left: 120,
          recent_complaints_count: 0,
          history_incidents: 0,
        },
      ],
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async () => ({
        airport_id: 1,
        date: '2026-03-24',
        s: 82,
        p: 76,
        c: 88,
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
      getPublicDisplayScoreByAirportAndDate: async () => 80,
      getTrend: async () => [{
        airport_id: 1,
        date: '2026-03-24',
        s: 82,
        p: 76,
        c: 88,
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
            status: 'normal' as const,
            tags: ['性价比高'],
            founded_on: '2024-01-01',
            plan_price_month: 12,
            has_trial: true,
            airport_intro: 'Alpha intro',
            created_at: '2026-01-20',
            score: 83,
            score_delta_vs_yesterday: {
              label: '对比昨天',
              value: 3,
            },
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

  const result = await service.getHomePageView('2026-03-24');
  const item = result.sections.today_pick.items[0];
  assert.equal(item.stability_tier, 'minor_fluctuation');
  assert.deepEqual(item.details, [
    { label: '健康记录', value: '12 天' },
    { label: '核心亮点', value: '性价比高' },
  ]);
  assert.match(item.conclusion, /亮点：当前价格与实际表现更均衡/);
  assert.doesNotMatch(item.conclusion, /提醒：/);
});

test('PublicViewService.getHomePageView fallback uses score-sorted today picks', async () => {
  const airportMap = new Map([
    [1, { id: 1, name: 'Alpha', displayScore: 95, healthyDays: 20, s: 90, riskPenalty: 0, tags: ['长期稳定'] }],
    [2, { id: 2, name: 'Bravo', displayScore: 94, healthyDays: 19, s: 89, riskPenalty: 0, tags: ['高性能'] }],
    [3, { id: 3, name: 'Charlie', displayScore: 93, healthyDays: 18, s: 88, riskPenalty: 0, tags: [] }],
    [4, { id: 4, name: 'Delta', displayScore: 99, healthyDays: 25, s: 92, riskPenalty: 5, tags: ['性价比高'] }],
  ]);

  const service = new PublicViewService({
    airportRepository: {
      getById: async (id: number) => {
        const airport = airportMap.get(id);
        assert.ok(airport);
        return {
          id: airport.id,
          name: airport.name,
          website: `https://${airport.name.toLowerCase()}.example.com`,
          status: 'normal' as const,
          is_listed: true,
          plan_price_month: 12,
          has_trial: true,
          tags: airport.tags,
          created_at: '2026-01-20',
        };
      },
    },
    metricsRepository: {
      getByAirportAndDate: async (airportId: number) => {
        const airport = airportMap.get(airportId);
        assert.ok(airport);
        return {
          airport_id: airportId,
          date: '2026-03-24',
          uptime_percent_30d: 99.9,
          median_latency_ms: 52,
          median_download_mbps: 88,
          packet_loss_percent: 0,
          stable_days_streak: airport.healthyDays,
          healthy_days_streak: airport.healthyDays,
          stability_tier: 'stable' as const,
          domain_ok: true,
          ssl_days_left: 120,
          recent_complaints_count: 0,
          history_incidents: 0,
        };
      },
      getTrend: async (airportId: number) => {
        const airport = airportMap.get(airportId);
        assert.ok(airport);
        return [{
          airport_id: airportId,
          date: '2026-03-24',
          uptime_percent_30d: 99.9,
          median_latency_ms: 52,
          median_download_mbps: 88,
          packet_loss_percent: 0,
          stable_days_streak: airport.healthyDays,
          healthy_days_streak: airport.healthyDays,
          stability_tier: 'stable' as const,
          domain_ok: true,
          ssl_days_left: 120,
          recent_complaints_count: 0,
          history_incidents: 0,
        }];
      },
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async (airportId: number) => {
        const airport = airportMap.get(airportId);
        assert.ok(airport);
        return {
          airport_id: airportId,
          date: '2026-03-24',
          s: airport.s,
          p: 80,
          c: 80,
          r: 95,
          risk_penalty: airport.riskPenalty,
          score: airport.displayScore,
          recent_score: airport.displayScore,
          historical_score: airport.displayScore,
          final_score: airport.displayScore,
          details: {
            total_score: airport.displayScore,
          },
        };
      },
      getPublicDisplayScoreByAirportAndDate: async (airportId: number) => {
        const airport = airportMap.get(airportId);
        assert.ok(airport);
        return airport.displayScore - 1;
      },
      getTrend: async (airportId: number) => {
        const airport = airportMap.get(airportId);
        assert.ok(airport);
        return [{
          airport_id: airportId,
          date: '2026-03-24',
          s: airport.s,
          p: 80,
          c: 80,
          r: 95,
          risk_penalty: airport.riskPenalty,
          score: airport.displayScore,
          recent_score: airport.displayScore,
          historical_score: airport.displayScore,
          final_score: airport.displayScore,
          details: {
            total_score: airport.displayScore,
          },
        }];
      },
      getPublicFullRankingByDate: async () => ({
        total: 4,
        items: [1, 2, 3, 4].map((airportId, index) => {
          const airport = airportMap.get(airportId);
          assert.ok(airport);
          return {
            airport_id: airportId,
            rank: index + 1,
            name: airport.name,
            website: `https://${airport.name.toLowerCase()}.example.com`,
            status: 'normal' as const,
            tags: airport.tags,
            founded_on: '2024-01-01',
            plan_price_month: 12,
            has_trial: true,
            airport_intro: `${airport.name} intro`,
            created_at: '2026-01-20',
            score: airport.displayScore,
            score_delta_vs_yesterday: {
              label: '对比昨天',
              value: 1,
            },
            report_url: `/reports/${airportId}?date=2026-03-24`,
          };
        }),
      }),
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async () => [],
      getRanksForAirport: async () => ({}),
    },
    statsRepository: {
      getHomeStats: async () => ({
        monitored_airports: 4,
        realtime_tests: 12,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getHomePageView('2026-03-24');
  const todayPickNames = result.sections.today_pick.items.map((item) => item.name);
  assert.deepEqual(todayPickNames, ['Delta', 'Alpha', 'Bravo']);
  assert.ok(result.sections.today_pick.items.every((item) => item.details[1]?.label !== '最近30天'));
  assert.ok(result.sections.today_pick.items.every((item) => !item.conclusion.includes('提醒：')));
  assert.equal(result.sections.today_pick.items[0].score, 99);
});

test('PublicViewService.getHomePageView filters risk-watch airports from persisted today ranking but keeps volatile ones', async () => {
  const airportMap = new Map([
    [1, { id: 1, name: 'RiskWatch', tags: ['风险观察'], stabilityTier: 'stable' as const }],
    [2, { id: 2, name: 'Volatile', tags: ['测试'], stabilityTier: 'volatile' as const }],
    [3, { id: 3, name: 'Healthy A', tags: ['高性能'], stabilityTier: 'stable' as const }],
    [4, { id: 4, name: 'Healthy B', tags: ['性价比高'], stabilityTier: 'minor_fluctuation' as const }],
  ]);

  const service = new PublicViewService({
    airportRepository: {
      getById: async (id: number) => {
        const airport = airportMap.get(id);
        assert.ok(airport);
        return {
          id,
          name: airport.name,
          website: `https://${airport.name.toLowerCase().replace(/\s+/g, '-')}.example.com`,
          status: 'normal' as const,
          is_listed: true,
          plan_price_month: 12,
          has_trial: true,
          tags: airport.tags,
          created_at: '2026-01-20',
        };
      },
    },
    metricsRepository: {
      getByAirportAndDate: async (airportId: number) => {
        const airport = airportMap.get(airportId);
        assert.ok(airport);
        return {
          airport_id: airportId,
          date: '2026-03-24',
          uptime_percent_30d: 99.9,
          median_latency_ms: 52,
          median_download_mbps: 88,
          packet_loss_percent: 0,
          stable_days_streak: 12,
          healthy_days_streak: 12,
          stability_tier: airport.stabilityTier,
          domain_ok: true,
          ssl_days_left: 120,
          recent_complaints_count: 0,
          history_incidents: 0,
        };
      },
      getTrend: async (airportId: number) => {
        const airport = airportMap.get(airportId);
        assert.ok(airport);
        return [{
          airport_id: airportId,
          date: '2026-03-24',
          uptime_percent_30d: 99.9,
          median_latency_ms: 52,
          median_download_mbps: 88,
          packet_loss_percent: 0,
          stable_days_streak: 12,
          healthy_days_streak: 12,
          stability_tier: airport.stabilityTier,
          domain_ok: true,
          ssl_days_left: 120,
          recent_complaints_count: 0,
          history_incidents: 0,
        }];
      },
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async (airportId: number) => ({
        airport_id: airportId,
        date: '2026-03-24',
        s: airportId === 2 ? 75 : airportId === 3 ? 85 : 83,
        p: 80,
        c: 82,
        r: 95,
        risk_penalty: 0,
        score: airportId === 2 ? 95 : airportId === 3 ? 88 : 90,
        recent_score: airportId === 2 ? 95 : airportId === 3 ? 88 : 90,
        historical_score: airportId === 2 ? 95 : airportId === 3 ? 88 : 90,
        final_score: airportId === 2 ? 95 : airportId === 3 ? 88 : 90,
        details: {
          total_score: airportId === 2 ? 95 : airportId === 3 ? 88 : 90,
        },
      }),
      getPublicDisplayScoreByAirportAndDate: async (airportId: number) =>
        airportId === 2 ? 94 : airportId === 3 ? 87 : 89,
      getTrend: async (airportId: number) => [{
        airport_id: airportId,
        date: '2026-03-24',
        s: airportId === 2 ? 75 : airportId === 3 ? 85 : 83,
        p: 80,
        c: 82,
        r: 95,
        risk_penalty: 0,
        score: airportId === 2 ? 95 : airportId === 3 ? 88 : 90,
        recent_score: airportId === 2 ? 95 : airportId === 3 ? 88 : 90,
        historical_score: airportId === 2 ? 95 : airportId === 3 ? 88 : 90,
        final_score: airportId === 2 ? 95 : airportId === 3 ? 88 : 90,
        details: {
          total_score: airportId === 2 ? 95 : airportId === 3 ? 88 : 90,
        },
      }],
      getPublicFullRankingByDate: async () => ({
        total: 0,
        items: [],
      }),
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async (_date: string, listType: string) =>
        listType === 'today'
          ? [1, 2, 3, 4].map((airportId, index) => {
              const airport = airportMap.get(airportId);
              assert.ok(airport);
              return {
                airport_id: airportId,
                rank: index + 1,
                name: airport.name,
                status: 'normal' as const,
                tags: airport.tags,
                score: 85,
                key_metrics: {
                  uptime_percent_30d: 99.9,
                  median_latency_ms: 52,
                  median_download_mbps: 88,
                  packet_loss_percent: 0,
                },
              };
            })
          : [],
      getRanksForAirport: async () => ({}),
    },
    statsRepository: {
      getHomeStats: async () => ({
        monitored_airports: 4,
        realtime_tests: 12,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getHomePageView('2026-03-24');

  assert.deepEqual(result.sections.today_pick.items.map((item) => item.name), ['Volatile', 'Healthy B', 'Healthy A']);
  assert.deepEqual(result.sections.today_pick.items.map((item) => item.score), [95, 90, 88]);
});

test('PublicViewService.getHomePageView returns negative and missing score deltas', async () => {
  const baseAirport = {
    id: 1,
    name: 'Alpha',
    website: 'https://alpha.example.com',
    status: 'normal' as const,
    is_listed: true,
    plan_price_month: 12,
    has_trial: true,
    tags: ['稳定'],
    created_at: '2026-03-20',
  };
  const baseMetrics = {
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
  };
  const baseScore = {
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
  };

  const createService = (yesterdayDisplayScore: number | null) =>
    new PublicViewService({
      airportRepository: {
        getById: async () => baseAirport,
      },
      metricsRepository: {
        getByAirportAndDate: async () => baseMetrics,
        getTrend: async () => [baseMetrics],
      },
      scoreRepository: {
        getLatestAvailableDate: async () => '2026-03-24',
        getByAirportAndDate: async () => baseScore,
        getPublicDisplayScoreByAirportAndDate: async () => yesterdayDisplayScore,
        getTrend: async () => [baseScore],
        getPublicFullRankingByDate: async () => ({
          total: 1,
          items: [],
        }),
      },
      rankingRepository: {
        getLatestAvailableDate: async () => '2026-03-24',
        getRanking: async () => [{
          airport_id: 1,
          rank: 1,
          name: 'Alpha',
          status: 'normal' as const,
          tags: ['稳定'],
          score: 83,
          key_metrics: {
            uptime_percent_30d: 99.9,
            median_latency_ms: 52,
            median_download_mbps: 88,
            packet_loss_percent: 0,
          },
        }],
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

  const negativeDelta = await createService(85).getHomePageView('2026-03-25');
  assert.equal(negativeDelta.sections.today_pick.items[0].score_delta_vs_yesterday.value, -2);

  const missingDelta = await createService(null).getHomePageView('2026-03-25');
  assert.equal(missingDelta.sections.today_pick.items[0].score_delta_vs_yesterday.value, null);
});

test('PublicViewService.getHomePageView keeps risk alerts empty for normal airports', async () => {
  const service = new PublicViewService({
    airportRepository: {
      getById: async () => ({
        id: 1,
        name: 'Alpha',
        website: 'https://alpha.example.com',
        status: 'normal' as const,
        is_listed: true,
        plan_price_month: 12,
        has_trial: true,
        tags: ['稳定'],
        created_at: '2026-01-20',
      }),
    },
    metricsRepository: {
      getByAirportAndDate: async () => ({
        airport_id: 1,
        date: '2026-03-24',
        uptime_percent_30d: 92,
        median_latency_ms: 60,
        median_download_mbps: 70,
        packet_loss_percent: 1,
        stable_days_streak: 5,
        domain_ok: false,
        ssl_days_left: 2,
        recent_complaints_count: 6,
        history_incidents: 2,
      }),
      getTrend: async () => [{
        airport_id: 1,
        date: '2026-03-24',
        uptime_percent_30d: 92,
        median_latency_ms: 60,
        median_download_mbps: 70,
        packet_loss_percent: 1,
        stable_days_streak: 5,
        domain_ok: false,
        ssl_days_left: 2,
        recent_complaints_count: 6,
        history_incidents: 2,
      }],
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async () => ({
        airport_id: 1,
        date: '2026-03-24',
        s: 75,
        p: 70,
        c: 68,
        r: 45,
        risk_penalty: 55,
        score: 68,
        recent_score: 68,
        historical_score: 66,
        final_score: 67,
        details: {
          total_score: 69,
        },
      }),
      getPublicDisplayScoreByAirportAndDate: async () => 68,
      getTrend: async () => [{
        airport_id: 1,
        date: '2026-03-24',
        s: 75,
        p: 70,
        c: 68,
        r: 45,
        risk_penalty: 55,
        score: 68,
        recent_score: 68,
        historical_score: 66,
        final_score: 67,
        details: {
          total_score: 69,
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
            status: 'normal' as const,
            tags: ['稳定'],
            founded_on: '2024-01-01',
            plan_price_month: 12,
            has_trial: true,
            airport_intro: 'Alpha intro',
            created_at: '2026-03-20',
            score: 69,
            score_delta_vs_yesterday: {
              label: '对比昨天',
              value: 1,
            },
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
  assert.deepEqual(result.sections.risk_alerts.items, []);
});

test('PublicViewService.getReportView does not classify normal airport as risk alerts', async () => {
  const service = new PublicViewService({
    airportRepository: {
      getById: async () => ({
        id: 1,
        name: 'Alpha',
        website: 'https://alpha.example.com',
        status: 'normal' as const,
        is_listed: true,
        plan_price_month: 12,
        has_trial: true,
        tags: ['稳定'],
        created_at: '2026-01-20',
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
        stable_days_streak: 30,
        domain_ok: false,
        ssl_days_left: 1,
        recent_complaints_count: 3,
        history_incidents: 1,
      }),
      getTrend: async () => [{
        airport_id: 1,
        date: '2026-03-24',
        uptime_percent_30d: 99.9,
        median_latency_ms: 52,
        median_download_mbps: 88,
        packet_loss_percent: 0,
        stable_days_streak: 30,
        domain_ok: false,
        ssl_days_left: 1,
        recent_complaints_count: 3,
        history_incidents: 1,
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
        r: 40,
        risk_penalty: 60,
        score: 80,
        recent_score: 80,
        historical_score: 78,
        final_score: 79,
        details: {
          total_score: 83,
        },
      }),
      getPublicDisplayScoreByAirportAndDate: async () => 80,
      getTrend: async () => [{
        airport_id: 1,
        date: '2026-03-24',
        s: 82,
        p: 76,
        c: 70,
        r: 40,
        risk_penalty: 60,
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
        items: [],
      }),
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async () => [],
      getRanksForAirport: async () => ({
        stable: 1,
      }),
    },
    statsRepository: {
      getHomeStats: async () => ({
        monitored_airports: 1,
        realtime_tests: 8,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getReportView(1, '2026-03-24');
  assert.ok(result);
  assert.equal(result.summary_card.type, 'stable');
  assert.equal(result.summary_card.stability_tier, 'stable');
  assert.equal(result.ranking.risk_alerts_rank, null);
});

test('PublicViewService.getReportView falls back to latest score date and exposes fallback notice', async () => {
  const service = new PublicViewService({
    airportRepository: {
      getById: async () => ({
        id: 1,
        name: 'Alpha',
        website: 'https://alpha.example.com',
        status: 'normal' as const,
        is_listed: true,
        plan_price_month: 12,
        has_trial: true,
        tags: ['稳定'],
        created_at: '2026-01-20',
      }),
    },
    metricsRepository: {
      getByAirportAndDate: async (_airportId: number, date: string) => ({
        airport_id: 1,
        date,
        uptime_percent_30d: 99.9,
        median_latency_ms: 52,
        median_download_mbps: 88,
        packet_loss_percent: 0,
        stable_days_streak: 30,
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
        stable_days_streak: 30,
        domain_ok: true,
        ssl_days_left: 120,
        recent_complaints_count: 0,
        history_incidents: 0,
      }],
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async (_airportId: number, date: string) => ({
        airport_id: 1,
        date,
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
          domain_penalty: 0,
          ssl_penalty: 0,
          complaint_penalty: 0,
          history_penalty: 0,
        },
      }),
      getPublicDisplayScoreByAirportAndDate: async () => 80,
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
          domain_penalty: 0,
          ssl_penalty: 0,
          complaint_penalty: 0,
          history_penalty: 0,
        },
      }],
      getPublicFullRankingByDate: async () => ({
        total: 1,
        items: [],
      }),
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async () => [],
      getRanksForAirport: async () => ({
        stable: 1,
      }),
    },
    statsRepository: {
      getHomeStats: async () => ({
        monitored_airports: 1,
        realtime_tests: 8,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getReportView(1, '2026-03-25');
  assert.ok(result);
  assert.equal(result?.requested_date, '2026-03-25');
  assert.equal(result?.date, '2026-03-24');
  assert.equal(result?.resolved_from_fallback, true);
  assert.match(result?.fallback_notice || '', /2026-03-24/);
  assert.match(result?.fallback_notice || '', /非实时探测结果/);
});

test('PublicViewService.getReportView exposes detailed risk penalties and mixed-clear conclusion', async () => {
  const service = new PublicViewService({
    airportRepository: {
      getById: async () => ({
        id: 1,
        name: 'Alpha',
        website: 'https://alpha.example.com',
        status: 'normal' as const,
        is_listed: true,
        plan_price_month: 12,
        has_trial: true,
        tags: ['风险观察'],
        created_at: '2026-01-20',
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
        stable_days_streak: 30,
        domain_ok: true,
        ssl_days_left: 120,
        recent_complaints_count: 2,
        history_incidents: 0,
      }),
      getTrend: async () => [{
        airport_id: 1,
        date: '2026-03-24',
        uptime_percent_30d: 99.9,
        median_latency_ms: 52,
        median_download_mbps: 88,
        packet_loss_percent: 0,
        stable_days_streak: 30,
        domain_ok: true,
        ssl_days_left: 120,
        recent_complaints_count: 2,
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
        r: 72,
        risk_penalty: 28,
        score: 80,
        recent_score: 80,
        historical_score: 78,
        final_score: 79,
        details: {
          total_score: 83,
          domain_penalty: 0,
          ssl_penalty: 0,
          complaint_penalty: 6,
          history_penalty: 0,
        },
      }),
      getPublicDisplayScoreByAirportAndDate: async () => 80,
      getTrend: async () => [{
        airport_id: 1,
        date: '2026-03-24',
        s: 82,
        p: 76,
        c: 70,
        r: 72,
        risk_penalty: 28,
        score: 80,
        recent_score: 80,
        historical_score: 78,
        final_score: 79,
        details: {
          total_score: 83,
          domain_penalty: 0,
          ssl_penalty: 0,
          complaint_penalty: 6,
          history_penalty: 0,
        },
      }],
      getPublicFullRankingByDate: async () => ({
        total: 1,
        items: [],
      }),
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async () => [],
      getRanksForAirport: async () => ({
        risk: 1,
      }),
    },
    statsRepository: {
      getHomeStats: async () => ({
        monitored_airports: 1,
        realtime_tests: 8,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getReportView(1, '2026-03-24');
  assert.ok(result);
  assert.equal(result?.summary_card.type, 'risk');
  assert.equal(result?.score_breakdown.domain_penalty, 0);
  assert.equal(result?.score_breakdown.ssl_penalty, 0);
  assert.equal(result?.score_breakdown.complaint_penalty, 6);
  assert.equal(result?.score_breakdown.history_penalty, 0);
  assert.match(result?.summary_card.conclusion || '', /官网当前探测正常/);
  assert.match(result?.summary_card.conclusion || '', /近期投诉 2 条/);
});

test('PublicViewService.getHomePageView filters stale normal airports from persisted risk ranking', async () => {
  const service = new PublicViewService({
    airportRepository: {
      getById: async () => ({
        id: 1,
        name: 'uuone',
        website: 'https://uuone.example.com',
        status: 'normal' as const,
        is_listed: true,
        plan_price_month: 12,
        has_trial: true,
        tags: [],
        created_at: '2026-01-20',
      }),
    },
    metricsRepository: {
      getByAirportAndDate: async () => ({
        airport_id: 1,
        date: '2026-03-24',
        uptime_percent_30d: 90,
        median_latency_ms: 60,
        median_download_mbps: 70,
        packet_loss_percent: 1,
        stable_days_streak: 10,
        domain_ok: true,
        ssl_days_left: 120,
        recent_complaints_count: 0,
        history_incidents: 0,
      }),
      getTrend: async () => [{
        airport_id: 1,
        date: '2026-03-24',
        uptime_percent_30d: 90,
        median_latency_ms: 60,
        median_download_mbps: 70,
        packet_loss_percent: 1,
        stable_days_streak: 10,
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
        s: 80,
        p: 75,
        c: 70,
        r: 85,
        risk_penalty: 15,
        score: 78,
        recent_score: 78,
        historical_score: 76,
        final_score: 77,
        details: {
          total_score: 79,
        },
      }),
      getPublicDisplayScoreByAirportAndDate: async () => 78,
      getTrend: async () => [{
        airport_id: 1,
        date: '2026-03-24',
        s: 80,
        p: 75,
        c: 70,
        r: 85,
        risk_penalty: 15,
        score: 78,
        recent_score: 78,
        historical_score: 76,
        final_score: 77,
        details: {
          total_score: 79,
        },
      }],
      getPublicFullRankingByDate: async () => ({
        total: 1,
        items: [],
      }),
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async (_date: string, listType: 'today' | 'stable' | 'value' | 'new' | 'risk') => {
        if (listType === 'risk') {
          return [{
            airport_id: 1,
            rank: 1,
            name: 'uuone',
            status: 'normal' as const,
            tags: [],
            score: 15,
            key_metrics: {
              uptime_percent_30d: 90,
              median_latency_ms: 60,
              median_download_mbps: 70,
              packet_loss_percent: 1,
            },
          }];
        }
        return [];
      },
      getRanksForAirport: async () => ({
        risk: 1,
      }),
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
  assert.deepEqual(result.sections.risk_alerts.items, []);
});

test('PublicViewService.getRiskMonitorView includes down airports and risk-watch tags', async () => {
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
      getPublicDisplayScoreByAirportAndDate: async () => null,
      getTrend: async () => [],
      getPublicFullRankingByDate: async () => ({
        total: 0,
        items: [],
      }),
      getPublicRiskMonitorByDate: async () => ({
        total: 2,
        items: [
          {
            airport_id: 1,
            rank: 1,
            name: 'Down Airport',
            website: 'https://down.example.com',
            status: 'down',
            tags: ['不推荐'],
            founded_on: '2025-01-01',
            plan_price_month: 10,
            has_trial: false,
            airport_intro: 'down',
            created_at: '2026-03-01',
            score: 11,
            score_delta_vs_yesterday: { label: '对比昨天', value: -2 },
            score_date: '2026-03-23',
            report_url: '/reports/1?date=2026-03-23',
            monitor_reason: 'down' as const,
            risk_penalty: 90,
            risk_reasons: [],
            risk_reason_summary: '该机场已由管理员确认标记为跑路状态，已停止日常测评与调度采样。',
            snapshot_is_stale: true,
          },
          {
            airport_id: 2,
            rank: 2,
            name: 'Watch Airport',
            website: 'https://watch.example.com',
            status: 'normal' as const,
            tags: ['风险观察'],
            founded_on: '2025-01-01',
            plan_price_month: 15,
            has_trial: true,
            airport_intro: 'watch',
            created_at: '2026-03-02',
            score: 44,
            score_delta_vs_yesterday: { label: '对比昨天', value: -1 },
            score_date: '2026-03-24',
            report_url: '/reports/2?date=2026-03-24',
            monitor_reason: 'risk_watch' as const,
            risk_penalty: 55,
            risk_reasons: ['recent_complaints'],
            risk_reason_summary: '官网当前探测正常，当前风险主要来自近期投诉 2 条。',
            snapshot_is_stale: false,
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
        monitored_airports: 2,
        realtime_tests: 8,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getRiskMonitorView('2026-03-25', 1, 20);
  assert.equal(result.date, '2026-03-24');
  assert.equal(result.total, 2);
  assert.deepEqual(
    result.items.map((item) => [item.name, item.monitor_reason]),
    [['Down Airport', 'down'], ['Watch Airport', 'risk_watch']],
  );
  assert.equal(result.items[1]?.snapshot_is_stale, true);
  assert.deepEqual(result.items[1]?.risk_reasons, ['recent_complaints']);
  assert.match(result.items[1]?.risk_reason_summary || '', /官网当前探测正常/);
});
