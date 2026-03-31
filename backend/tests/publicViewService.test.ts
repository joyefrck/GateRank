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
  assert.equal(result.sections.most_stable.items.length, 1);
});

test('PublicViewService.getHomePageView returns negative and missing score deltas', async () => {
  const baseAirport = {
    id: 1,
    name: 'Alpha',
    website: 'https://alpha.example.com',
    status: 'normal' as const,
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
});

test('PublicViewService.getHomePageView filters stale normal airports from persisted risk ranking', async () => {
  const service = new PublicViewService({
    airportRepository: {
      getById: async () => ({
        id: 1,
        name: 'uuone',
        website: 'https://uuone.example.com',
        status: 'normal' as const,
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
            score_date: '2026-03-23',
            report_url: '/reports/2?date=2026-03-23',
            monitor_reason: 'risk_watch' as const,
            risk_penalty: 55,
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
});
