import test from 'node:test';
import assert from 'node:assert/strict';
import { MonthlyReportGenerationService } from '../src/services/monthlyReportGenerationService';
import { NewsContentService } from '../src/services/newsContentService';
import type { Airport, AirportScoreDaily, DailyMetrics, RankingItem } from '../src/types/domain';

test('MonthlyReportGenerationService builds fixed monthly summary template from listed airports', async () => {
  const service = new MonthlyReportGenerationService({
    airportRepository: {
      listAll: async () => [
        createAirport({ id: 1, name: '光速云', status: 'normal', is_listed: true, plan_price_month: 18, created_at: '2026-05-10' }),
        createAirport({ id: 2, name: '稳连机场', status: 'normal', is_listed: true, plan_price_month: 28, created_at: '2025-12-01' }),
        createAirport({ id: 3, name: '风险节点', status: 'risk', is_listed: true, plan_price_month: 12, created_at: '2026-03-01', tags: ['风险观察'] }),
        createAirport({ id: 4, name: '隐藏机场', status: 'normal', is_listed: false, plan_price_month: 8, created_at: '2026-01-01' }),
      ],
    },
    metricsRepository: {
      getByAirportIdsAndDate: async () => new Map([
        [1, createMetrics({ airport_id: 1, uptime_percent_30d: 99.9, median_download_mbps: 180, median_latency_ms: 56, packet_loss_percent: 0.1, healthy_days_streak: 30, stable_days_streak: 28 })],
        [2, createMetrics({ airport_id: 2, uptime_percent_30d: 98.2, median_download_mbps: 96, median_latency_ms: 78, packet_loss_percent: 0.4, healthy_days_streak: 18, stable_days_streak: 16 })],
        [3, createMetrics({ airport_id: 3, uptime_percent_30d: 91.2, median_download_mbps: 32, median_latency_ms: 180, packet_loss_percent: 2.4, healthy_days_streak: 3, stable_days_streak: 2, recent_complaints_count: 4, history_incidents: 2 })],
      ]),
    },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-06-30',
      getByAirportIdsAndDate: async () => new Map([
        [1, createScore({ airport_id: 1, final_score: 91, s: 95, p: 90, c: 82, r: 96, risk_penalty: 2 })],
        [2, createScore({ airport_id: 2, final_score: 84, s: 89, p: 82, c: 75, r: 92, risk_penalty: 4 })],
        [3, createScore({ airport_id: 3, final_score: 58, s: 62, p: 55, c: 88, r: 45, risk_penalty: 34 })],
      ]),
    },
    rankingRepository: {
      getRanking: async (_date, listType) => rankingByType[listType] || [],
    },
    newsContentService: new NewsContentService(),
  });

  const report = await service.generate({ year: 2026, month: 6 });

  assert.equal(report.year, 2026);
  assert.equal(report.month, 6);
  assert.equal(report.slug, '2026-06-airport-vpn-ranking-report');
  assert.equal(report.status, 'draft');
  assert.equal(report.published_at, null);
  assert.match(report.title, /2026年6月机场 VPN 月度报告/);
  assert.match(report.excerpt, /3 个已上架机场/);
  assert.match(report.content_markdown, /## 一、执行摘要/);
  assert.match(report.content_markdown, /## 二、全站样本概览/);
  assert.match(report.content_markdown, /## 三、综合榜单变化/);
  assert.match(report.content_markdown, /## 四、稳定性分类/);
  assert.match(report.content_markdown, /## 五、性能分类/);
  assert.match(report.content_markdown, /## 六、性价比分类/);
  assert.match(report.content_markdown, /## 七、风险观察/);
  assert.match(report.content_markdown, /## 八、新入榜与异常机场/);
  assert.match(report.content_markdown, /## 九、客户端、节点与支付能力分布/);
  assert.match(report.content_markdown, /## 十、下月观察项/);
  assert.match(report.content_markdown, /## 十一、评分口径附录/);
  assert.match(report.content_markdown, /光速云/);
  assert.match(report.content_markdown, /风险节点/);
  assert.doesNotMatch(report.content_markdown, /隐藏机场/);
  assert.match(report.content_html, /<h2[^>]*>一、执行摘要<\/h2>/);
});

test('MonthlyReportGenerationService rejects fallback data outside selected month', async () => {
  const service = new MonthlyReportGenerationService({
    airportRepository: { listAll: async () => [] },
    metricsRepository: { getByAirportIdsAndDate: async () => new Map() },
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-05-31',
      getByAirportIdsAndDate: async () => new Map(),
    },
    rankingRepository: { getRanking: async () => [] },
    newsContentService: new NewsContentService(),
  });

  await assert.rejects(
    () => service.generate({ year: 2026, month: 6 }),
    /MONTHLY_REPORT_SOURCE_DATA_NOT_FOUND/,
  );
});

test('MonthlyReportGenerationService period options disable existing, current, and future months', async () => {
  const service = new MonthlyReportGenerationService({
    airportRepository: { listAll: async () => [] },
    metricsRepository: { getByAirportIdsAndDate: async () => new Map() },
    scoreRepository: {
      getLatestAvailableDate: async () => null,
      getByAirportIdsAndDate: async () => new Map(),
    },
    rankingRepository: { getRanking: async () => [] },
    monthlyReportRepository: {
      listPeriods: async () => [{ year: 2026, month: 5 }],
    },
    newsContentService: new NewsContentService(),
    now: () => new Date('2026-07-02T04:00:00.000Z'),
  });

  const options = await service.buildPeriodOptions(1);
  const months = options.years[0].months;

  assert.equal(months.find((item) => item.month === 5)?.available, false);
  assert.match(months.find((item) => item.month === 5)?.reason || '', /已经存在/);
  assert.equal(months.find((item) => item.month === 6)?.available, true);
  assert.equal(months.find((item) => item.month === 7)?.available, false);
  assert.match(months.find((item) => item.month === 7)?.reason || '', /当前月尚未结束/);
  assert.equal(months.find((item) => item.month === 8)?.available, false);
  assert.match(months.find((item) => item.month === 8)?.reason || '', /未来月份/);
});

const rankingByType: Record<string, RankingItem[]> = {
  today: [
    createRanking({ airport_id: 1, rank: 1, name: '光速云', score: 91 }),
    createRanking({ airport_id: 2, rank: 2, name: '稳连机场', score: 84 }),
  ],
  stable: [
    createRanking({ airport_id: 1, rank: 1, name: '光速云', score: 95 }),
    createRanking({ airport_id: 2, rank: 2, name: '稳连机场', score: 89 }),
  ],
  value: [
    createRanking({ airport_id: 3, rank: 1, name: '风险节点', score: 88 }),
    createRanking({ airport_id: 1, rank: 2, name: '光速云', score: 82 }),
  ],
  risk: [
    createRanking({ airport_id: 3, rank: 1, name: '风险节点', status: 'risk', score: 34 }),
  ],
  new: [
    createRanking({ airport_id: 1, rank: 1, name: '光速云', score: 91 }),
  ],
};

function createAirport(input: Partial<Airport> & { id: number; name: string }): Airport {
  return {
    id: input.id,
    name: input.name,
    website: `https://airport-${input.id}.example.com`,
    websites: [`https://airport-${input.id}.example.com`],
    status: input.status || 'normal',
    is_listed: input.is_listed ?? true,
    plan_price_month: input.plan_price_month ?? 20,
    has_trial: input.has_trial ?? false,
    streaming_support: input.streaming_support || ['netflix'],
    payment_methods: input.payment_methods || ['alipay'],
    has_annual_plan: input.has_annual_plan ?? true,
    has_telegram_group: input.has_telegram_group ?? true,
    telegram_allows_speaking: input.telegram_allows_speaking ?? true,
    has_lifetime_plan: input.has_lifetime_plan ?? false,
    tags: input.tags || [],
    manual_tags: input.manual_tags || [],
    auto_tags: input.auto_tags || [],
    created_at: input.created_at || '2026-01-01',
  };
}

function createMetrics(input: Partial<DailyMetrics> & { airport_id: number }): DailyMetrics {
  return {
    airport_id: input.airport_id,
    date: '2026-06-30',
    uptime_percent_30d: input.uptime_percent_30d ?? 99,
    median_latency_ms: input.median_latency_ms ?? 80,
    median_download_mbps: input.median_download_mbps ?? 100,
    packet_loss_percent: input.packet_loss_percent ?? 0.2,
    stable_days_streak: input.stable_days_streak ?? 20,
    healthy_days_streak: input.healthy_days_streak ?? 20,
    stability_tier: input.stability_tier ?? 'stable',
    domain_ok: true,
    ssl_days_left: 60,
    recent_complaints_count: input.recent_complaints_count ?? 0,
    history_incidents: input.history_incidents ?? 0,
  };
}

function createScore(input: Partial<AirportScoreDaily> & { airport_id: number }): AirportScoreDaily {
  return {
    airport_id: input.airport_id,
    date: '2026-06-30',
    s: input.s ?? 80,
    p: input.p ?? 80,
    c: input.c ?? 80,
    r: input.r ?? 80,
    risk_penalty: input.risk_penalty ?? 0,
    score: input.score ?? input.final_score ?? 80,
    recent_score: input.recent_score ?? input.final_score ?? 80,
    historical_score: input.historical_score ?? input.final_score ?? 80,
    final_score: input.final_score ?? 80,
    details: input.details || {},
  };
}

function createRanking(input: Partial<RankingItem> & { airport_id: number; rank: number; name: string; score: number }): RankingItem {
  return {
    airport_id: input.airport_id,
    rank: input.rank,
    name: input.name,
    status: input.status || 'normal',
    tags: input.tags || [],
    score: input.score,
    key_metrics: {
      uptime_percent_30d: 99,
      median_latency_ms: 80,
      median_download_mbps: 100,
      packet_loss_percent: 0.2,
    },
  };
}
