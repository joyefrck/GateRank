import assert from 'node:assert/strict';
import test from 'node:test';
import { PublicViewService } from '../src/services/publicViewService';
import type { ToolDownloadItem } from '../../shared/toolDownloads';

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
  ]);
});

test('PublicViewService.getHomePageView builds prioritized tool download CTA from published icons', async () => {
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
    toolsDownloadService: {
      getDownloadPageView: async () => ({
        config: {} as never,
        platform: null,
        platforms: ['windows', 'macos', 'ios', 'android', 'linux'],
        hotItems: [
          createToolDownloadItem('v2rayn-android', 'v2rayN', '/uploads/tools/icons/v2rayn-android.webp', 10),
          createToolDownloadItem('v2rayn-windows', 'v2rayN', '/uploads/tools/icons/v2rayn-windows.webp', 11),
          createToolDownloadItem('v2rayn-macos', 'v2rayN', '/uploads/tools/icons/v2rayn-macos.webp', 12),
          createToolDownloadItem('hiddify', 'Hiddify', '/uploads/tools/icons/hiddify.webp', 13),
          createToolDownloadItem('clash-verge-rev', 'Clash Verge Rev', '/uploads/tools/icons/clash.webp', 20),
        ],
        items: [
          createToolDownloadItem('sing-box', 'sing-box', '/uploads/tools/icons/sing-box.webp', 30),
          createToolDownloadItem('karing', 'Karing', '/uploads/tools/icons/karing.webp', 40),
          createToolDownloadItem('v2rayn', 'v2rayN', '/uploads/tools/icons/v2rayn.webp', 50),
          createToolDownloadItem('no-icon', 'No Icon', '', 60),
        ],
        total: 6,
      }),
    },
  });

  const result = await service.getHomePageView('2026-03-25');

  assert.equal(result.tool_download_cta.href, '/tools/download');
  assert.equal(result.tool_download_cta.title, '翻墙工具客户端下载');
  assert.deepEqual(result.tool_download_cta.items.map((item) => item.slug), [
    'v2rayn-android',
    'karing',
    'clash-verge-rev',
    'sing-box',
  ]);
  assert.equal(result.tool_download_cta.items.filter((item) => item.name === 'v2rayN').length, 1);
  assert.ok(result.tool_download_cta.items.every((item) => item.icon_url));
});

test('PublicViewService.getHomePageView uses configured home section limits for source queries', async () => {
  const fullRankingPageSizes: number[] = [];
  const approvedApplicationLimits: number[] = [];
  const riskPageSizes: number[] = [];
  const service = new PublicViewService({
    airportRepository: {
      getById: async () => null,
      listLatestApprovedApplicationAirports: async (limit: number) => {
        approvedApplicationLimits.push(limit);
        return [];
      },
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
      getPublicFullRankingByDate: async (_date: string, _page: number, pageSize: number) => {
        fullRankingPageSizes.push(pageSize);
        return {
          total: 0,
          items: [],
        };
      },
      getPublicRiskMonitorByDate: async (_date: string, _page: number, pageSize: number) => {
        riskPageSizes.push(pageSize);
        return {
          total: 0,
          items: [],
        };
      },
    },
    marketingSettingsService: {
      getConfig: async () => ({
        click_charge_amount: 1,
        home_section_limits: {
          today_pick: 4,
          most_stable: 5,
          best_value: 6,
          new_entries: 7,
          risk_alerts: 2,
        },
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
        realtime_tests: 12,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  await service.getHomePageView('2026-03-24');

  assert.equal(fullRankingPageSizes[0], 4);
  assert.equal(approvedApplicationLimits[0], 7);
  assert.equal(riskPageSizes[0], 2);
});

test('PublicViewService.getHomePageView defaults home section limits without marketing settings', async () => {
  const fullRankingPageSizes: number[] = [];
  const approvedApplicationLimits: number[] = [];
  const riskPageSizes: number[] = [];
  const service = new PublicViewService({
    airportRepository: {
      getById: async () => null,
      listLatestApprovedApplicationAirports: async (limit: number) => {
        approvedApplicationLimits.push(limit);
        return [];
      },
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
      getPublicFullRankingByDate: async (_date: string, _page: number, pageSize: number) => {
        fullRankingPageSizes.push(pageSize);
        return {
          total: 0,
          items: [],
        };
      },
      getPublicRiskMonitorByDate: async (_date: string, _page: number, pageSize: number) => {
        riskPageSizes.push(pageSize);
        return {
          total: 0,
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

  await service.getHomePageView('2026-03-24');

  assert.equal(fullRankingPageSizes[0], 3);
  assert.equal(approvedApplicationLimits[0], 6);
  assert.equal(riskPageSizes[0], 1);
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
  assert.equal(result.tool_download_cta.href, '/tools/download');
  assert.equal(result.tool_download_cta.title, '翻墙工具客户端下载');
  assert.deepEqual(result.tool_download_cta.items, []);
  assert.deepEqual(requestedDates, ['2026-03-24:2:20']);
});

test('PublicViewService.getHomePageView reuses card context across sections for the same airport', async () => {
  const counts = {
    airport: 0,
    metrics: 0,
    metricsTrend: 0,
    score: 0,
    yesterdayScore: 0,
    scoreTrend: 0,
  };
  const rankingItem = {
    airport_id: 1,
    rank: 1,
    name: 'Alpha',
    status: 'normal' as const,
    tags: ['稳定'],
    score: 95,
    key_metrics: {
      uptime_percent_30d: 99.9,
      median_latency_ms: 45,
      median_download_mbps: 120,
      packet_loss_percent: 0,
    },
  };
  const service = new PublicViewService({
    airportRepository: {
      getById: async (id: number) => {
        counts.airport += 1;
        return {
          id,
          name: 'Alpha',
          website: 'https://alpha.example.com',
          status: 'normal',
          is_listed: true,
          plan_price_month: 12,
          has_trial: true,
          tags: ['稳定'],
          created_at: '2026-03-20',
        };
      },
    },
    metricsRepository: {
      getByAirportAndDate: async () => {
        counts.metrics += 1;
        return {
          airport_id: 1,
          date: '2026-03-24',
          uptime_percent_30d: 99.9,
          median_latency_ms: 45,
          median_download_mbps: 120,
          packet_loss_percent: 0,
          stable_days_streak: 15,
          domain_ok: true,
          ssl_days_left: 180,
          recent_complaints_count: 0,
          history_incidents: 0,
        };
      },
      getTrend: async () => {
        counts.metricsTrend += 1;
        return [{
          airport_id: 1,
          date: '2026-03-24',
          uptime_percent_30d: 99.9,
          median_latency_ms: 45,
          median_download_mbps: 120,
          packet_loss_percent: 0,
          stable_days_streak: 15,
          domain_ok: true,
          ssl_days_left: 180,
          recent_complaints_count: 0,
          history_incidents: 0,
        }];
      },
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async () => {
        counts.score += 1;
        return {
          airport_id: 1,
          date: '2026-03-24',
          s: 92,
          p: 88,
          c: 81,
          r: 100,
          risk_penalty: 0,
          score: 90,
          recent_score: 90,
          historical_score: 88,
          final_score: 89,
          details: {
            total_score: 95,
          },
        };
      },
      getPublicDisplayScoreByAirportAndDate: async () => {
        counts.yesterdayScore += 1;
        return 93;
      },
      getTrend: async () => {
        counts.scoreTrend += 1;
        return [{
          airport_id: 1,
          date: '2026-03-24',
          s: 92,
          p: 88,
          c: 81,
          r: 100,
          risk_penalty: 0,
          score: 90,
          recent_score: 90,
          historical_score: 88,
          final_score: 89,
          details: {
            total_score: 95,
          },
        }];
      },
      getPublicFullRankingByDate: async () => ({
        total: 1,
        items: [{
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
          score: 95,
          score_delta_vs_yesterday: {
            label: '对比昨天',
            value: 2,
          },
          report_url: '/airports/alpha-example',
        }],
      }),
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async (_date: string, listType: 'today' | 'stable' | 'value' | 'new' | 'risk') => {
        if (listType === 'risk') {
          return [];
        }
        return [rankingItem];
      },
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
  assert.equal(result.sections.today_pick.items[0]?.name, 'Alpha');
  assert.equal(result.sections.most_stable.items[0]?.name, 'Alpha');
  assert.equal(result.sections.best_value.items[0]?.name, 'Alpha');
  assert.equal(result.sections.new_entries.items[0]?.name, 'Alpha');
  assert.deepEqual(counts, {
    airport: 1,
    metrics: 1,
    metricsTrend: 1,
    score: 1,
    yesterdayScore: 1,
    scoreTrend: 1,
  });
});

test('PublicViewService.getHomePageView limits new entries to listed active airports', async () => {
  const airportIds = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const airportsById = new Map(
    airportIds.map((id) => [
      id,
      {
        id,
        name: `Airport ${id}`,
        website: `https://airport-${id}.example.com`,
        status: id === 8 ? 'down' as const : 'normal' as const,
        is_listed: id !== 9,
        plan_price_month: 12,
        has_trial: true,
        tags: ['新入榜'],
        created_at: `2026-03-${String(20 - id).padStart(2, '0')}`,
      },
    ]),
  );
  const metricsById = new Map(
    airportIds.map((id) => [
      id,
      {
        airport_id: id,
        date: '2026-03-24',
        uptime_percent_30d: 99.9,
        median_latency_ms: 50,
        median_download_mbps: 100,
        packet_loss_percent: 0,
        stable_days_streak: 5,
        domain_ok: true,
        ssl_days_left: 120,
        recent_complaints_count: 0,
        history_incidents: 0,
      },
    ]),
  );
  const scoresById = new Map(
    airportIds.map((id) => [
      id,
      {
        airport_id: id,
        date: '2026-03-24',
        s: 80,
        p: 80,
        c: 80,
        r: 95,
        risk_penalty: 0,
        score: 90 - id,
        recent_score: 90 - id,
        historical_score: 90 - id,
        final_score: 90 - id,
        details: {
          total_score: 90 - id,
        },
      },
    ]),
  );
  const newRankingItems = airportIds.map((id, index) => ({
    airport_id: id,
    rank: index + 1,
    name: `Airport ${id}`,
    status: id === 8 ? 'down' as const : 'normal' as const,
    tags: ['新入榜'],
    score: 90 - id,
    key_metrics: {
      uptime_percent_30d: 99.9,
      median_latency_ms: 50,
      median_download_mbps: 100,
      packet_loss_percent: 0,
    },
  }));

  const service = new PublicViewService({
    airportRepository: {
      getById: async (id: number) => airportsById.get(id) || null,
      getByIds: async (ids: number[]) => new Map(ids.flatMap((id) => {
        const airport = airportsById.get(id);
        return airport ? [[id, airport]] : [];
      })),
    },
    metricsRepository: {
      getByAirportAndDate: async (airportId: number) => metricsById.get(airportId) || null,
      getTrend: async (airportId: number) => {
        const metric = metricsById.get(airportId);
        return metric ? [metric] : [];
      },
      getByAirportIdsAndDate: async (ids: number[]) => new Map(ids.flatMap((id) => {
        const metric = metricsById.get(id);
        return metric ? [[id, metric]] : [];
      })),
      getTrendsByAirportIds: async (ids: number[]) => new Map(ids.flatMap((id) => {
        const metric = metricsById.get(id);
        return metric ? [[id, [metric]]] : [];
      })),
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async (airportId: number) => scoresById.get(airportId) || null,
      getPublicDisplayScoreByAirportAndDate: async (airportId: number) => scoresById.get(airportId)?.final_score ?? null,
      getPublicDisplayScoresByDate: async (ids: number[]) => new Map(ids.flatMap((id) => {
        const score = scoresById.get(id);
        return score ? [[id, score.final_score]] : [];
      })),
      getTrend: async (airportId: number) => {
        const score = scoresById.get(airportId);
        return score ? [score] : [];
      },
      getByAirportIdsAndDate: async (ids: number[]) => new Map(ids.flatMap((id) => {
        const score = scoresById.get(id);
        return score ? [[id, score]] : [];
      })),
      getTrendsByAirportIds: async (ids: number[]) => new Map(ids.flatMap((id) => {
        const score = scoresById.get(id);
        return score ? [[id, [score]]] : [];
      })),
      getPublicFullRankingByDate: async () => ({
        total: 0,
        items: [],
      }),
    },
    applicantBillingRepository: {
      getPublicScoreVisibilityByAirportIds: async (ids: number[]) => {
        const visibility = new Map<number, { score_hidden: boolean; score_hidden_reason: 'insufficient_balance' | null }>();
        for (const id of ids) {
          visibility.set(id, {
            score_hidden: id === 2,
            score_hidden_reason: id === 2 ? 'insufficient_balance' : null,
          });
        }
        return visibility;
      },
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async (_date: string, listType: 'today' | 'stable' | 'value' | 'new' | 'risk') => (
        listType === 'new' ? newRankingItems : []
      ),
      getRanksForAirport: async () => ({}),
    },
    statsRepository: {
      getHomeStats: async () => ({
        monitored_airports: 9,
        realtime_tests: 18,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getHomePageView('2026-03-24');

  assert.deepEqual(result.sections.new_entries.items.map((item) => item.airport_id), [1, 3, 4, 5, 6, 7]);
  assert.equal(result.sections.new_entries.items.length, 6);
  assert.ok(result.sections.new_entries.items.every((item) => item.airport_id !== 2 && item.airport_id !== 8 && item.airport_id !== 9));
});

test('PublicViewService.getHomePageView prioritizes latest approved application airports in new entries', async () => {
  const airportIds = Array.from({ length: 11 }, (_, index) => index + 1);
  const airportsById = new Map(
    airportIds.map((id) => [
      id,
      {
        id,
        name: id === 7 ? 'Latest Low Score' : `Airport ${id}`,
        website: `https://airport-${id}.example.com`,
        status: id === 9 ? 'down' as const : 'normal' as const,
        is_listed: id !== 10,
        plan_price_month: 12,
        has_trial: true,
        tags: ['新入榜'],
        created_at: id === 11 ? '2026-03-19' : `2026-03-${String(20 - id).padStart(2, '0')}`,
      },
    ]),
  );
  const metricsById = new Map(
    airportIds.map((id) => [
      id,
      {
        airport_id: id,
        date: '2026-03-24',
        uptime_percent_30d: 99.9,
        median_latency_ms: 50,
        median_download_mbps: 100,
        packet_loss_percent: 0,
        stable_days_streak: 5,
        domain_ok: true,
        ssl_days_left: 120,
        recent_complaints_count: 0,
        history_incidents: 0,
      },
    ]),
  );
  const scoresById = new Map(
    airportIds
      .filter((id) => id !== 8)
      .map((id) => [
        id,
        {
          airport_id: id,
          date: '2026-03-24',
          s: 80,
          p: 80,
          c: 80,
          r: 95,
          risk_penalty: 0,
          score: id === 7 ? 20 : 90 - id,
          recent_score: id === 7 ? 20 : 90 - id,
          historical_score: id === 7 ? 20 : 90 - id,
          final_score: id === 7 ? 20 : 90 - id,
          details: {
            total_score: id === 7 ? 20 : 90 - id,
          },
        },
      ]),
  );
  const newRankingItems = [1, 2, 3, 4, 5, 6].map((id, index) => ({
    airport_id: id,
    rank: index + 1,
    name: `Airport ${id}`,
    status: 'normal' as const,
    tags: ['新入榜'],
    score: 90 - id,
    key_metrics: {
      uptime_percent_30d: 99.9,
      median_latency_ms: 50,
      median_download_mbps: 100,
      packet_loss_percent: 0,
    },
  }));

  const service = new PublicViewService({
    airportRepository: {
      getById: async (id: number) => airportsById.get(id) || null,
      getByIds: async (ids: number[]) => new Map(ids.flatMap((id) => {
        const airport = airportsById.get(id);
        return airport ? [[id, airport]] : [];
      })),
      listLatestApprovedApplicationAirports: async () => [11, 7, 8, 9, 10].flatMap((id) => {
        const airport = airportsById.get(id);
        return airport ? [airport] : [];
      }),
    },
    metricsRepository: {
      getByAirportAndDate: async (airportId: number) => metricsById.get(airportId) || null,
      getTrend: async (airportId: number) => {
        const metric = metricsById.get(airportId);
        return metric ? [metric] : [];
      },
      getByAirportIdsAndDate: async (ids: number[]) => new Map(ids.flatMap((id) => {
        const metric = metricsById.get(id);
        return metric ? [[id, metric]] : [];
      })),
      getTrendsByAirportIds: async (ids: number[]) => new Map(ids.flatMap((id) => {
        const metric = metricsById.get(id);
        return metric ? [[id, [metric]]] : [];
      })),
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async (airportId: number) => scoresById.get(airportId) || null,
      getPublicDisplayScoreByAirportAndDate: async (airportId: number) => scoresById.get(airportId)?.final_score ?? null,
      getPublicDisplayScoresByDate: async (ids: number[]) => new Map(ids.flatMap((id) => {
        const score = scoresById.get(id);
        return score ? [[id, score.final_score]] : [];
      })),
      getTrend: async (airportId: number) => {
        const score = scoresById.get(airportId);
        return score ? [score] : [];
      },
      getByAirportIdsAndDate: async (ids: number[]) => new Map(ids.flatMap((id) => {
        const score = scoresById.get(id);
        return score ? [[id, score]] : [];
      })),
      getTrendsByAirportIds: async (ids: number[]) => new Map(ids.flatMap((id) => {
        const score = scoresById.get(id);
        return score ? [[id, [score]]] : [];
      })),
      getPublicFullRankingByDate: async () => ({
        total: 0,
        items: [],
      }),
    },
    applicantBillingRepository: {
      getPublicScoreVisibilityByAirportIds: async (ids: number[]) => {
        const visibility = new Map<number, { score_hidden: boolean; score_hidden_reason: 'insufficient_balance' | null }>();
        for (const id of ids) {
          visibility.set(id, {
            score_hidden: id === 11,
            score_hidden_reason: id === 11 ? 'insufficient_balance' : null,
          });
        }
        return visibility;
      },
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async (_date: string, listType: 'today' | 'stable' | 'value' | 'new' | 'risk') => (
        listType === 'new' ? newRankingItems : []
      ),
      getRanksForAirport: async () => ({}),
    },
    statsRepository: {
      getHomeStats: async () => ({
        monitored_airports: 10,
        realtime_tests: 20,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getHomePageView('2026-03-24');

  assert.deepEqual(result.sections.new_entries.items.map((item) => item.airport_id), [7, 1, 2, 3, 4, 5]);
  assert.equal(result.sections.new_entries.items[0]?.score, 20);
  assert.ok(result.sections.new_entries.items.every((item) => item.airport_id !== 8));
  assert.ok(result.sections.new_entries.items.every((item) => item.airport_id !== 9));
  assert.ok(result.sections.new_entries.items.every((item) => item.airport_id !== 10));
  assert.ok(result.sections.new_entries.items.every((item) => item.airport_id !== 11));
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
            report_url: '/airports/alpha-example',
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

test('PublicViewService.getHomePageView fallback new entries skips hidden scores', async () => {
  const airportsById = new Map([1, 2, 3].map((id) => [
    id,
    {
      id,
      name: `Airport ${id}`,
      website: `https://airport-${id}.example.com`,
      status: 'normal' as const,
      is_listed: true,
      plan_price_month: 12,
      has_trial: true,
      tags: ['新入榜'],
      created_at: `2026-03-${22 - id}`,
    },
  ]));
  const scoresById = new Map([1, 2, 3].map((id) => [
    id,
    {
      airport_id: id,
      date: '2026-03-24',
      s: 80,
      p: 80,
      c: 80,
      r: 95,
      risk_penalty: 0,
      score: 90 - id,
      recent_score: 90 - id,
      historical_score: 90 - id,
      final_score: 90 - id,
      details: { total_score: 90 - id },
    },
  ]));
  const fullRankingItems = [1, 2, 3].map((id, index) => ({
    airport_id: id,
    rank: index + 1,
    name: `Airport ${id}`,
    website: `https://airport-${id}.example.com`,
    status: 'normal' as const,
    tags: ['新入榜'],
    founded_on: '2024-01-01',
    plan_price_month: 12,
    has_trial: true,
    airport_intro: `Airport ${id} intro`,
    created_at: `2026-03-${22 - id}`,
    score: 90 - id,
    score_delta_vs_yesterday: { label: '对比昨天', value: 1 },
    report_url: `/airports/airport-${id}`,
  }));

  const service = new PublicViewService({
    airportRepository: {
      getById: async (id: number) => airportsById.get(id) || null,
    },
    metricsRepository: {
      getByAirportAndDate: async (airportId: number) => ({
        airport_id: airportId,
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
      getTrend: async (airportId: number) => [{
        airport_id: airportId,
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
      getByAirportAndDate: async (airportId: number) => scoresById.get(airportId) || null,
      getPublicDisplayScoreByAirportAndDate: async (airportId: number) => scoresById.get(airportId)?.final_score ?? null,
      getTrend: async (airportId: number) => {
        const score = scoresById.get(airportId);
        return score ? [score] : [];
      },
      getPublicFullRankingByDate: async () => ({
        total: fullRankingItems.length,
        items: fullRankingItems,
      }),
    },
    applicantBillingRepository: {
      getPublicScoreVisibilityByAirportIds: async (ids: number[]) => {
        const visibility = new Map<number, { score_hidden: boolean; score_hidden_reason: 'insufficient_balance' | null }>();
        for (const id of ids) {
          visibility.set(id, {
            score_hidden: id === 2,
            score_hidden_reason: id === 2 ? 'insufficient_balance' : null,
          });
        }
        return visibility;
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
        realtime_tests: 8,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getHomePageView('2026-03-24');

  assert.deepEqual(result.sections.new_entries.items.map((item) => item.airport_id), [1, 3]);
  assert.ok(result.sections.new_entries.items.every((item) => item.score_hidden !== true));
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
            report_url: '/airports/gamma-example',
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
            report_url: '/airports/beta-example',
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
            report_url: '/airports/alpha-example',
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

  assert.deepEqual(result.sections.today_pick.items.map((item) => item.name), ['Gamma', 'Beta', 'Alpha']);
  assert.equal(result.sections.today_pick.items[0].score, 99);
  assert.equal(result.sections.today_pick.items[1].stability_tier, 'volatile');
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
            report_url: '/airports/alpha-example',
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
    { label: '运行天数', value: '64 天' },
    { label: '核心亮点', value: '性价比高' },
  ]);
  assert.match(item.conclusion, /亮点：当前价格与实际表现更均衡/);
  assert.doesNotMatch(item.conclusion, /提醒：/);
});

test('PublicViewService.getHomePageView shows one running day for same-day today picks', async () => {
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
        tags: ['新手友好'],
        created_at: '2026-03-24',
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
        healthy_days_streak: 0,
        stability_tier: 'stable' as const,
        domain_ok: true,
        ssl_days_left: 120,
        recent_complaints_count: 0,
        history_incidents: 0,
      }),
      getTrend: async () => [],
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
      getPublicDisplayScoreByAirportAndDate: async () => 83,
      getTrend: async () => [],
      getPublicFullRankingByDate: async () => ({
        total: 1,
        items: [
          {
            airport_id: 1,
            rank: 1,
            name: 'Alpha',
            website: 'https://alpha.example.com',
            status: 'normal' as const,
            tags: ['新手友好'],
            founded_on: '2024-01-01',
            plan_price_month: 12,
            has_trial: true,
            airport_intro: 'Alpha intro',
            created_at: '2026-03-24',
            score: 83,
            score_delta_vs_yesterday: {
              label: '对比昨天',
              value: null,
            },
            report_url: '/airports/alpha-example',
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
  assert.deepEqual(result.sections.today_pick.items[0].details, [
    { label: '运行天数', value: '1 天' },
    { label: '核心亮点', value: '新手友好' },
  ]);
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
            report_url: `/airports/${airport.name.toLowerCase()}-example`,
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
  assert.deepEqual(todayPickNames, ['Alpha', 'Bravo', 'Charlie']);
  assert.ok(result.sections.today_pick.items.every((item) => item.details[1]?.label !== '最近30天'));
  assert.ok(result.sections.today_pick.items.every((item) => !item.conclusion.includes('提醒：')));
  assert.equal(result.sections.today_pick.items[0].score, 95);
});

test('PublicViewService.getHomePageView today pick follows full ranking order instead of persisted today ranking', async () => {
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
      getPublicFullRankingByDate: async (_date: string, page: number, pageSize: number) => ({
        total: 0,
        items: [
          {
            airport_id: 4,
            rank: 1,
            name: 'Healthy B',
            website: 'https://healthy-b.example.com',
            status: 'normal' as const,
            tags: ['性价比高'],
            founded_on: '2024-01-01',
            plan_price_month: 12,
            has_trial: true,
            airport_intro: 'Healthy B intro',
            created_at: '2026-01-20',
            score: 90,
            score_delta_vs_yesterday: { label: '对比昨天', value: 1 },
            report_url: '/airports/healthy-b-example',
          },
          {
            airport_id: 2,
            rank: 2,
            name: 'Volatile',
            website: 'https://volatile.example.com',
            status: 'normal' as const,
            tags: ['测试'],
            founded_on: '2024-01-01',
            plan_price_month: 12,
            has_trial: true,
            airport_intro: 'Volatile intro',
            created_at: '2026-01-20',
            score: 95,
            score_delta_vs_yesterday: { label: '对比昨天', value: 1 },
            report_url: '/airports/volatile-example',
          },
          {
            airport_id: 3,
            rank: 3,
            name: 'Healthy A',
            website: 'https://healthy-a.example.com',
            status: 'normal' as const,
            tags: ['高性能'],
            founded_on: '2024-01-01',
            plan_price_month: 12,
            has_trial: true,
            airport_intro: 'Healthy A intro',
            created_at: '2026-01-20',
            score: 88,
            score_delta_vs_yesterday: { label: '对比昨天', value: 1 },
            report_url: '/airports/healthy-a-example',
          },
        ].slice((page - 1) * pageSize, page * pageSize),
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

  assert.deepEqual(result.sections.today_pick.items.map((item) => item.name), ['Healthy B', 'Volatile', 'Healthy A']);
  assert.deepEqual(result.sections.today_pick.items.map((item) => item.score), [90, 95, 88]);
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
          items: [{
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
            score: 83,
            score_delta_vs_yesterday: {
              label: '对比昨天',
              value: 1,
            },
            report_url: '/airports/alpha-example',
          }],
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
            report_url: '/airports/alpha-example',
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
        streaming_support: ['netflix', 'chatgpt'],
        payment_methods: ['alipay', 'usdt_trc20'],
        profile: {
          plan: {
            supports_monthly: true,
            supports_quarterly: false,
            supports_half_yearly: true,
            supports_annual: true,
            lowest_monthly_price: 9.9,
            lowest_annual_monthly_price: 8.8,
            has_trial_plan: true,
            has_lifetime_plan: false,
          },
          telegram: {
            has_group: true,
            group_url: 'https://t.me/alpha_group',
            has_channel: true,
            channel_url: 'https://t.me/alpha_channel',
            has_customer_service_bot: true,
            has_ticket_system: false,
            group_allows_speaking: true,
            group_member_count: 1600,
            recent_active_at: '2026-03-23',
          },
          clients: {
            self_built_client: true,
            clash: true,
            shadowrocket: true,
            surge: false,
          },
          import_methods: {
            one_click_import: true,
            subscription_link: true,
            universal_subscription: false,
            qr_code_import: false,
            tutorials: true,
          },
          regions: {
            hong_kong: {
              has_residential: false,
              has_native_ip: true,
              line_types: ['iepl'],
            },
            japan: {
              has_residential: true,
              has_native_ip: false,
              line_types: ['bgp'],
            },
          },
        } as any,
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
      getTrend: async () => [
        {
          airport_id: 1,
          date: '2026-03-23',
          uptime_percent_30d: 99.8,
          median_latency_ms: 55,
          median_download_mbps: 80,
          packet_loss_percent: 100,
          stable_days_streak: 29,
          domain_ok: false,
          ssl_days_left: 2,
          recent_complaints_count: 3,
          history_incidents: 1,
        },
        {
          airport_id: 1,
          date: '2026-03-24',
          uptime_percent_30d: 99.9,
          median_latency_ms: 52,
          median_download_mbps: 88,
          packet_loss_percent: 20,
          packet_loss_measurement: 'proxy_http_request_failure_rate_v1',
          stable_days_streak: 30,
          domain_ok: false,
          ssl_days_left: 1,
          recent_complaints_count: 3,
          history_incidents: 1,
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
  assert.equal(result.tool_download_cta.href, '/tools/download');
  assert.equal(result.tool_download_cta.title, '翻墙工具客户端下载');
  assert.deepEqual(result.tool_download_cta.items, []);
  assert.equal(result.summary_card.type, 'stable');
  assert.equal(result.summary_card.stability_tier, 'stable');
  assert.equal(result.ranking.risk_alerts_rank, null);
  assert.deepEqual(result.trends.packet_loss_30d, [{ date: '2026-03-24', value: 20 }]);
  assert.deepEqual(
    result.capabilities.streaming.map((item) => item.label),
    ['Netflix', 'ChatGPT'],
  );
  assert.deepEqual(
    result.capabilities.payment_methods.map((item) => item.label),
    ['支付宝', 'USDT-TRC20'],
  );
  assert.deepEqual(
    result.capabilities.clients.map((item) => item.label),
    ['自建客户端', 'Clash', 'Shadowrocket'],
  );
  assert.deepEqual(
    result.capabilities.import_methods.map((item) => item.label),
    ['一键导入', '订阅链接', '教程支持'],
  );
  assert.deepEqual(
    result.capabilities.regions.map((item) => [item.label, item.node_count, item.line_types]),
    [['香港', 0, ['IEPL']], ['日本', 0, ['BGP']]],
  );
  assert.equal(result.capabilities.plan.supports_monthly, true);
  assert.equal(result.capabilities.plan.supports_quarterly, false);
  assert.equal(result.capabilities.plan.supports_half_yearly, true);
  assert.equal(result.capabilities.plan.supports_annual, true);
  assert.equal(result.capabilities.plan.lowest_monthly_price, 9.9);
  assert.equal(result.capabilities.plan.lowest_annual_monthly_price, 8.8);
  assert.equal(result.capabilities.plan.has_lifetime_plan, false);
  assert.equal(result.capabilities.telegram.has_group, true);
  assert.equal(result.capabilities.telegram.group_url, 'https://t.me/alpha_group');
  assert.equal(result.capabilities.telegram.has_channel, true);
  assert.equal(result.capabilities.telegram.channel_url, 'https://t.me/alpha_channel');
  assert.equal(result.capabilities.telegram.group_allows_speaking, true);
  assert.equal(result.capabilities.telegram.has_customer_service_bot, true);
  assert.equal(result.capabilities.telegram.has_ticket_system, false);
  assert.equal(result.capabilities.telegram.group_member_count, 1600);
});

test('PublicViewService.getReportView includes latest snapshot node counts as region coverage', async () => {
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
        streaming_support: [],
        payment_methods: [],
        profile: {
          plan: {
            supports_monthly: null,
            supports_quarterly: null,
            supports_half_yearly: null,
            supports_annual: null,
            lowest_monthly_price: null,
            lowest_annual_monthly_price: null,
            has_trial_plan: null,
            has_lifetime_plan: null,
          },
          telegram: {
            has_group: null,
            group_url: null,
            has_channel: null,
            channel_url: null,
            has_customer_service_bot: null,
            has_ticket_system: null,
            group_allows_speaking: null,
            group_member_count: null,
            recent_active_at: null,
          },
          clients: {},
          import_methods: {},
          regions: {
            hong_kong: { has_residential: null, has_native_ip: null, line_types: [] },
            singapore: { has_residential: null, has_native_ip: null, line_types: [] },
            united_states: { has_residential: null, has_native_ip: null, line_types: [] },
          },
        } as any,
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
        domain_ok: true,
        ssl_days_left: 90,
        recent_complaints_count: 0,
        history_incidents: 0,
      }),
      getTrend: async () => [],
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getByAirportAndDate: async () => ({
        airport_id: 1,
        date: '2026-03-24',
        s: 82,
        p: 76,
        c: 70,
        r: 100,
        risk_penalty: 0,
        score: 80,
        recent_score: 80,
        historical_score: 78,
        final_score: 79,
        details: { total_score: 83 },
      }),
      getPublicDisplayScoreByAirportAndDate: async () => 80,
      getTrend: async () => [],
      getPublicFullRankingByDate: async () => ({ total: 1, items: [] }),
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
    subscriptionNodeSnapshotRepository: {
      getLatestByAirport: async () => ({
        id: 99,
        airport_id: 1,
        captured_at: '2026-03-24T09:00:00+08:00',
        source: 'test',
        subscription_url: null,
        subscription_format: 'clash_yaml',
        parsed_nodes_count: 5,
        supported_nodes_count: 5,
        nodes: [
          { name: 'HK-1', region: 'HK', type: 'vless', outbound: {}, raw_uri: '' },
          { name: '香港 2', region: null, type: 'vless', outbound: {}, raw_uri: '' },
          { name: 'SG-1', region: 'SG', type: 'vless', outbound: {}, raw_uri: '' },
          { name: 'US-1', region: 'US', type: 'vless', outbound: {}, raw_uri: '' },
          { name: 'Unknown-1', region: 'Mars', type: 'vless', outbound: {}, raw_uri: '' },
        ],
        unsupported_nodes: [],
        created_at: '2026-03-24T09:00:00+08:00',
      }),
    },
  });

  const result = await service.getReportView(1, '2026-03-24');

  assert.ok(result);
  assert.deepEqual(
    result.capabilities.regions.map((item) => [item.key, item.label, item.node_count, item.line_types]),
    [
      ['hong_kong', '香港', 2, []],
      ['singapore', '新加坡', 1, []],
      ['united_states', '美国', 1, []],
    ],
  );
});

test('PublicViewService.getReportView derives today pick rank from public full ranking preview', async () => {
  const fullRankingCalls: string[] = [];
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
        tags: ['高端路线'],
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
          manual_total_score: 92,
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
          manual_total_score: 92,
          total_score: 83,
        },
      }],
      getPublicFullRankingByDate: async (date: string, page: number, pageSize: number) => {
        fullRankingCalls.push(`${date}:${page}:${pageSize}`);
        return {
          total: 3,
          items: [
            { airport_id: 8, rank: 1 } as any,
            { airport_id: 1, rank: 2 } as any,
            { airport_id: 9, rank: 3 } as any,
          ],
        };
      },
    },
    rankingRepository: {
      getLatestAvailableDate: async () => '2026-03-24',
      getRanking: async () => [],
      getRanksForAirport: async () => ({
        stable: 12,
      }),
    },
    statsRepository: {
      getHomeStats: async () => ({
        monitored_airports: 3,
        realtime_tests: 8,
        latest_data_at: '2026-03-24T10:00:00+08:00',
      }),
    },
  });

  const result = await service.getReportView(1, '2026-03-24');
  assert.ok(result);
  assert.equal(result.ranking.today_pick_rank, 2);
  assert.deepEqual(fullRankingCalls, ['2026-03-24:1:3']);
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
            report_url: '/airports/down-example',
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
            report_url: '/airports/watch-example',
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

function createToolDownloadItem(slug: string, name: string, iconUrl: string, sortOrder: number): ToolDownloadItem {
  return {
    id: sortOrder,
    slug,
    name,
    summary: `${name} 科学上网客户端`,
    description: `${name} 可用于导入机场订阅。`,
    platforms: ['windows'],
    platform_versions: { windows: 'Windows 10/11' },
    icon_url: iconUrl,
    local_file_url: '',
    official_url: `https://example.com/${slug}`,
    primary_action: 'official',
    version: 'latest',
    file_size_label: '',
    download_count: 0,
    is_hot: sortOrder <= 20,
    sort_order: sortOrder,
    status: 'published',
    published_at: '2026-07-08 10:00:00',
    content_updated_at: null,
    created_at: '2026-07-08 09:00:00',
    updated_at: '2026-07-08 10:00:00',
  };
}
