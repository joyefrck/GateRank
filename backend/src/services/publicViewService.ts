import { NEW_AIRPORT_DAYS, SHANGHAI_TIMEZONE } from '../config/scoring';
import type {
  Airport,
  DailyMetrics,
  FullRankingView,
  HomePageView,
  PublicCardItem,
  PublicCardType,
  RankingItem,
  RankingType,
  ReportView,
  ScoreDeltaView,
} from '../types/domain';
import {
  dateDaysAgo,
  diffDays,
  formatDateTimeInTimezoneIso,
  formatRelativeTimeFromNow,
  getDateInTimezone,
} from '../utils/time';

type HomeSectionKey =
  | 'today_pick'
  | 'most_stable'
  | 'best_value'
  | 'new_entries'
  | 'risk_alerts';

interface PublicViewDeps {
  airportRepository: {
    getById(id: number): Promise<Airport | null>;
  };
  metricsRepository: {
    getByAirportAndDate(airportId: number, date: string): Promise<DailyMetrics | null>;
    getTrend(airportId: number, startDate: string, endDate: string): Promise<DailyMetrics[]>;
  };
  scoreRepository: {
    getLatestAvailableDate(onOrBefore: string): Promise<string | null>;
    getByAirportAndDate(airportId: number, date: string): Promise<{
      airport_id: number;
      date: string;
      s: number;
      p: number;
      c: number;
      r: number;
      risk_penalty: number;
      score: number;
      recent_score: number;
      historical_score: number;
      final_score: number;
      details?: Record<string, unknown>;
    } | null>;
    getPublicDisplayScoreByAirportAndDate(airportId: number, date: string): Promise<number | null>;
    getTrend(
      airportId: number,
      startDate: string,
      endDate: string,
    ): Promise<
      Array<{
        date: string;
        s: number;
        p: number;
        c: number;
        r: number;
        risk_penalty: number;
        score: number;
        recent_score: number;
        historical_score: number;
        final_score: number;
        details?: Record<string, unknown>;
      }>
    >;
    getPublicFullRankingByDate(
      date: string,
      page: number,
      pageSize: number,
    ): Promise<{
      total: number;
      items: FullRankingView['items'];
    }>;
  };
  rankingRepository: {
    getLatestAvailableDate(onOrBefore: string): Promise<string | null>;
    getRanking(date: string, listType: RankingType): Promise<RankingItem[]>;
    getRanksForAirport(airportId: number, date: string): Promise<Partial<Record<RankingType, number>>>;
  };
  statsRepository: {
    getHomeStats(date: string): Promise<{
      monitored_airports: number;
      realtime_tests: number;
      latest_data_at: string | null;
    }>;
  };
}

interface CardContext {
  airport: Airport;
  metrics: DailyMetrics;
  score: {
    s: number;
    p: number;
    c: number;
    r: number;
    risk_penalty: number;
    final_score: number;
    display_score: number;
    yesterday_display_score: number | null;
  };
  metricsTrend30d: DailyMetrics[];
  scoreTrend30d: Array<{ date: string; final_score: number; display_score: number }>;
}

const SECTION_CONFIG: Record<
  HomeSectionKey,
  {
    rankingType: RankingType;
    title: string;
    subtitle: string;
    type: PublicCardType;
    limit: number;
  }
> = {
  today_pick: {
    rankingType: 'today',
    title: '今日推荐机场',
    subtitle: "Today's Top Pick",
    type: 'stable',
    limit: 3,
  },
  most_stable: {
    rankingType: 'stable',
    title: '长期稳定机场',
    subtitle: 'Most Stable',
    type: 'stable',
    limit: 3,
  },
  best_value: {
    rankingType: 'value',
    title: '性价比最佳',
    subtitle: 'Best Value',
    type: 'value',
    limit: 3,
  },
  new_entries: {
    rankingType: 'new',
    title: '新入榜潜力',
    subtitle: 'New Entries',
    type: 'new',
    limit: 3,
  },
  risk_alerts: {
    rankingType: 'risk',
    title: '风险预警',
    subtitle: 'Risk Alerts',
    type: 'risk',
    limit: 1,
  },
};

export class PublicViewService {
  constructor(private readonly deps: PublicViewDeps) {}

  async getHomePageView(date: string): Promise<HomePageView> {
    const resolvedDate = (await this.deps.rankingRepository.getLatestAvailableDate(date)) || date;
    const resolvedFromFallback = resolvedDate !== date;
    const [stats, today, stable, value, newest, rawRisk] = await Promise.all([
      this.deps.statsRepository.getHomeStats(resolvedDate),
      this.deps.rankingRepository.getRanking(resolvedDate, 'today'),
      this.deps.rankingRepository.getRanking(resolvedDate, 'stable'),
      this.deps.rankingRepository.getRanking(resolvedDate, 'value'),
      this.deps.rankingRepository.getRanking(resolvedDate, 'new'),
      this.deps.rankingRepository.getRanking(resolvedDate, 'risk'),
    ]);
    const risk = rawRisk.filter((item) => item.status === 'risk' || item.status === 'down');
    const fallbackSections =
      today.length === 0 || stable.length === 0 || value.length === 0 || newest.length === 0 || risk.length === 0
        ? await this.buildFallbackHomeSections(resolvedDate)
        : null;

    return {
      requested_date: date,
      date: resolvedDate,
      resolved_from_fallback: resolvedFromFallback,
      fallback_notice: resolvedFromFallback ? buildPublicFallbackNotice(date, resolvedDate) : null,
      generated_at: formatDateTimeInTimezoneIso(new Date(), SHANGHAI_TIMEZONE),
      hero: {
        report_time_at: stats.latest_data_at,
        report_time_text: formatRelativeTimeFromNow(stats.latest_data_at),
        monitored_airports: stats.monitored_airports,
        realtime_tests: stats.realtime_tests,
      },
      sections: {
        today_pick: {
          title: SECTION_CONFIG.today_pick.title,
          subtitle: SECTION_CONFIG.today_pick.subtitle,
          items:
            today.length > 0
              ? await this.buildHomeSectionItems('today_pick', today, resolvedDate)
              : (fallbackSections?.today_pick ?? []),
        },
        most_stable: {
          title: SECTION_CONFIG.most_stable.title,
          subtitle: SECTION_CONFIG.most_stable.subtitle,
          items:
            stable.length > 0
              ? await this.buildHomeSectionItems('most_stable', stable, resolvedDate)
              : (fallbackSections?.most_stable ?? []),
        },
        best_value: {
          title: SECTION_CONFIG.best_value.title,
          subtitle: SECTION_CONFIG.best_value.subtitle,
          items:
            value.length > 0
              ? await this.buildHomeSectionItems('best_value', value, resolvedDate)
              : (fallbackSections?.best_value ?? []),
        },
        new_entries: {
          title: SECTION_CONFIG.new_entries.title,
          subtitle: SECTION_CONFIG.new_entries.subtitle,
          items:
            newest.length > 0
              ? await this.buildHomeSectionItems('new_entries', newest, resolvedDate)
              : (fallbackSections?.new_entries ?? []),
        },
        risk_alerts: {
          title: SECTION_CONFIG.risk_alerts.title,
          subtitle: SECTION_CONFIG.risk_alerts.subtitle,
          items:
            risk.length > 0
              ? await this.buildHomeSectionItems('risk_alerts', risk, resolvedDate)
              : (fallbackSections?.risk_alerts ?? []),
        },
      },
    };
  }

  async getFullRankingView(date: string, page: number, pageSize: number): Promise<FullRankingView> {
    const resolvedDate = (await this.deps.scoreRepository.getLatestAvailableDate(date)) || date;
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, pageSize);
    const result = await this.deps.scoreRepository.getPublicFullRankingByDate(
      resolvedDate,
      safePage,
      safePageSize,
    );

    return {
      date: resolvedDate,
      generated_at: formatDateTimeInTimezoneIso(new Date(), SHANGHAI_TIMEZONE),
      page: safePage,
      page_size: safePageSize,
      total: result.total,
      total_pages: Math.max(1, Math.ceil(result.total / safePageSize)),
      items: result.items,
    };
  }

  async getReportView(airportId: number, date: string): Promise<ReportView | null> {
    const resolvedDate = (await this.deps.scoreRepository.getLatestAvailableDate(date)) || date;
    const resolvedFromFallback = resolvedDate !== date;
    const base = await this.loadCardContext(airportId, resolvedDate);
    if (!base) {
      return null;
    }

    const rawRanking = await this.deps.rankingRepository.getRanksForAirport(airportId, resolvedDate);
    const ranking = {
      ...rawRanking,
      risk: isRiskAlertAirport(base.airport) ? rawRanking.risk : undefined,
    };
    const section = resolveSummarySection(base.airport, base.metrics, base.score, ranking, resolvedDate);
    const summaryCard = this.buildCard(section, base, resolvedDate);
    const metricsStartDate = dateDaysAgo(resolvedDate, 29);

    return {
      requested_date: date,
      date: resolvedDate,
      resolved_from_fallback: resolvedFromFallback,
      fallback_notice: resolvedFromFallback ? buildPublicFallbackNotice(date, resolvedDate) : null,
      airport: {
        id: base.airport.id,
        name: base.airport.name,
        website: base.airport.website,
        status: base.airport.status,
        tags: base.airport.tags,
      },
      summary_card: {
        type: summaryCard.type,
        name: summaryCard.name,
        tags: summaryCard.tags,
        score: summaryCard.score,
        details: summaryCard.details,
        conclusion: summaryCard.conclusion,
      },
      ranking: {
        today_pick_rank: ranking.today ?? null,
        most_stable_rank: ranking.stable ?? null,
        best_value_rank: ranking.value ?? null,
        new_entries_rank: ranking.new ?? null,
        risk_alerts_rank: ranking.risk ?? null,
      },
      score_breakdown: {
        s: round2(base.score.s),
        p: round2(base.score.p),
        c: round2(base.score.c),
        r: round2(base.score.r),
        final_score: round2(base.score.display_score),
        risk_penalty: round2(base.score.risk_penalty),
      },
      metrics: {
        uptime_percent_30d: round2(base.metrics.uptime_percent_30d),
        median_latency_ms: round2(base.metrics.median_latency_ms),
        median_download_mbps: round2(base.metrics.median_download_mbps),
        packet_loss_percent: round2(base.metrics.packet_loss_percent),
        stable_days_streak: Number(base.metrics.stable_days_streak || 0),
        recent_complaints_count: Number(base.metrics.recent_complaints_count || 0),
        history_incidents: Number(base.metrics.history_incidents || 0),
      },
      trends: {
        score_30d: base.scoreTrend30d.map((row) => ({ date: row.date, value: round2(row.display_score) })),
        uptime_30d: base.metricsTrend30d
          .filter((row) => typeof row.uptime_percent_30d === 'number')
          .map((row) => ({ date: row.date, value: round2(row.uptime_percent_30d) })),
        latency_30d: base.metricsTrend30d
          .filter((row) => typeof row.median_latency_ms === 'number')
          .map((row) => ({ date: row.date, value: round2(row.median_latency_ms) })),
        download_30d: base.metricsTrend30d
          .filter((row) => typeof row.median_download_mbps === 'number')
          .map((row) => ({ date: row.date, value: round2(row.median_download_mbps) })),
      },
    };
  }

  private async buildHomeSectionItems(
    section: HomeSectionKey,
    rankingItems: RankingItem[],
    date: string,
  ): Promise<PublicCardItem[]> {
    const config = SECTION_CONFIG[section];
    const items = await Promise.all(
      rankingItems.slice(0, config.limit).map(async (item) => {
        const context = await this.loadCardContext(item.airport_id, date);
        if (!context) {
          return null;
        }
        return this.buildCard(section, context, date);
      }),
    );

    return items.filter((item): item is PublicCardItem => item !== null);
  }

  private async buildFallbackHomeSections(
    date: string,
  ): Promise<Record<HomeSectionKey, PublicCardItem[]>> {
    const { items } = await this.deps.scoreRepository.getPublicFullRankingByDate(date, 1, 100);
    const contexts = (
      await Promise.all(items.map((item) => this.loadCardContext(item.airport_id, date)))
    ).filter((context): context is CardContext => context !== null);

    const byScore = [...contexts].sort(compareByDisplayScoreDesc);
    const byStable = [...contexts].sort(compareByStabilityDesc);
    const byValue = [...contexts].sort(compareByValueDesc);
    const byNew = [...contexts]
      .filter((context) => isNewAirportContext(context, date))
      .sort(compareByDisplayScoreDesc);
    const byRisk = [...contexts]
      .filter((context) => isRiskAlertContext(context))
      .sort(compareByRiskPriority);

    return {
      today_pick: byScore.slice(0, SECTION_CONFIG.today_pick.limit).map((context) => this.buildCard('today_pick', context, date)),
      most_stable: byStable
        .slice(0, SECTION_CONFIG.most_stable.limit)
        .map((context) => this.buildCard('most_stable', context, date)),
      best_value: byValue
        .slice(0, SECTION_CONFIG.best_value.limit)
        .map((context) => this.buildCard('best_value', context, date)),
      new_entries: (byNew.length > 0 ? byNew : byScore)
        .slice(0, SECTION_CONFIG.new_entries.limit)
        .map((context) => this.buildCard('new_entries', context, date)),
      risk_alerts: byRisk
        .slice(0, SECTION_CONFIG.risk_alerts.limit)
        .map((context) => this.buildCard('risk_alerts', context, date)),
    };
  }

  private async loadCardContext(airportId: number, date: string): Promise<CardContext | null> {
    const trendStartDate = dateDaysAgo(date, 29);
    const yesterdayDate = dateDaysAgo(date, 1);
    const [airport, metrics, score, yesterdayDisplayScore, metricsTrend30d, scoreTrend30d] = await Promise.all([
      this.deps.airportRepository.getById(airportId),
      this.deps.metricsRepository.getByAirportAndDate(airportId, date),
      this.deps.scoreRepository.getByAirportAndDate(airportId, date),
      this.deps.scoreRepository.getPublicDisplayScoreByAirportAndDate(airportId, yesterdayDate),
      this.deps.metricsRepository.getTrend(airportId, trendStartDate, date),
      this.deps.scoreRepository.getTrend(airportId, trendStartDate, date),
    ]);

    if (!airport || !metrics || !score) {
      return null;
    }

    return {
      airport,
      metrics,
      score: {
        s: score.s,
        p: score.p,
        c: score.c,
        r: score.r,
        risk_penalty: score.risk_penalty,
        final_score: score.final_score,
        display_score: getDisplayScore(score),
        yesterday_display_score: yesterdayDisplayScore,
      },
      metricsTrend30d,
      scoreTrend30d: scoreTrend30d.map((row) => ({
        date: row.date,
        final_score: row.final_score,
        display_score: getDisplayScore(row),
      })),
    };
  }

  private buildCard(section: HomeSectionKey, context: CardContext, date: string): PublicCardItem {
    const config = SECTION_CONFIG[section];
    return {
      type: config.type,
      airport_id: context.airport.id,
      name: context.airport.name,
      website: context.airport.website,
      tags: context.airport.tags.slice(0, 3),
      score: round2(context.score.display_score),
      score_delta_vs_yesterday: buildScoreDeltaView(
        context.score.display_score,
        context.score.yesterday_display_score,
      ),
      details: buildCardDetails(section, context, date),
      conclusion: buildConclusion(section, context, date),
      report_url: `/reports/${context.airport.id}?date=${date}`,
    };
  }
}

function compareByDisplayScoreDesc(left: CardContext, right: CardContext): number {
  return right.score.display_score - left.score.display_score;
}

function compareByStabilityDesc(left: CardContext, right: CardContext): number {
  return (
    Number(right.metrics.stable_days_streak || 0) - Number(left.metrics.stable_days_streak || 0) ||
    Number(right.metrics.uptime_percent_30d || 0) - Number(left.metrics.uptime_percent_30d || 0) ||
    compareByDisplayScoreDesc(left, right)
  );
}

function compareByValueDesc(left: CardContext, right: CardContext): number {
  const leftValueScore = left.score.display_score / Math.max(left.airport.plan_price_month || 1, 1);
  const rightValueScore = right.score.display_score / Math.max(right.airport.plan_price_month || 1, 1);
  return rightValueScore - leftValueScore || compareByDisplayScoreDesc(left, right);
}

function compareByRiskPriority(left: CardContext, right: CardContext): number {
  return (
    getRiskPriority(right) - getRiskPriority(left) ||
    Number(right.metrics.recent_complaints_count || 0) - Number(left.metrics.recent_complaints_count || 0) ||
    Number(right.metrics.history_incidents || 0) - Number(left.metrics.history_incidents || 0) ||
    left.score.r - right.score.r
  );
}

function getRiskPriority(context: CardContext): number {
  if (isRiskAlertAirport(context.airport)) {
    return 4;
  }
  return 0;
}

function isRiskAlertAirport(airport: Airport): boolean {
  return airport.status === 'risk' || airport.status === 'down';
}

function isRiskAlertContext(context: CardContext): boolean {
  return getRiskPriority(context) > 0;
}

function isNewAirportContext(context: CardContext, date: string): boolean {
  return context.airport.tags.includes('新入榜') || diffDays(context.airport.created_at, date) < NEW_AIRPORT_DAYS;
}

function buildCardDetails(
  section: HomeSectionKey,
  context: CardContext,
  date: string,
): [PublicCardItem['details'][0], PublicCardItem['details'][1]] {
  const streakDays = Math.max(0, Number(context.metrics.stable_days_streak || 0));
  const unstableDays30d = context.metricsTrend30d.filter((row) => row.is_stable_day === false).length;
  const trackingDays = Math.max(1, diffDays(context.airport.created_at, date) + 1);
  const primaryRiskReason = getPrimaryRiskReason(context.metrics);
  const complaintTrendLabel = getComplaintTrendLabel(context.metrics.recent_complaints_count);
  const trendLabel = getTrendLabel(context.scoreTrend30d);

  switch (section) {
    case 'today_pick':
      return [
        { label: '稳定记录', value: `${streakDays} 天` },
        { label: '最近30天', value: `${unstableDays30d} 波动` },
      ];
    case 'most_stable':
      return [
        { label: '稳定记录', value: `${streakDays} 天` },
        { label: '可用率', value: `${formatPercent(context.metrics.uptime_percent_30d)}%` },
      ];
    case 'best_value':
      return [
        { label: '连续无波动', value: `${streakDays} 天` },
        { label: '价格', value: `¥${formatPrice(context.airport.plan_price_month)}/月起` },
      ];
    case 'new_entries':
      return [
        { label: '观察时长', value: `${trackingDays} 天` },
        { label: '近期评分', value: trendLabel },
      ];
    case 'risk_alerts':
      return [
        { label: '异常记录', value: primaryRiskReason },
        { label: '投诉指数', value: complaintTrendLabel },
      ];
  }
}

function buildConclusion(section: HomeSectionKey, context: CardContext, date: string): string {
  const uptimeText = `${formatPercent(context.metrics.uptime_percent_30d)}%`;
  const streakDays = Math.max(0, Number(context.metrics.stable_days_streak || 0));
  const priceText = `¥${formatPrice(context.airport.plan_price_month)}/月`;
  const trackingDays = Math.max(1, diffDays(context.airport.created_at, date) + 1);
  const trendLabel = getTrendLabel(context.scoreTrend30d);
  const primaryRiskReason = getPrimaryRiskReason(context.metrics);
  const complaintTrendLabel = getComplaintTrendLabel(context.metrics.recent_complaints_count);

  switch (section) {
    case 'today_pick':
      return `综合表现最均衡，当前稳定记录已达 ${streakDays} 天，适合大多数用户优先考虑。长期使用风险低，整体可靠性突出。`;
    case 'most_stable':
      return `近阶段可用率维持在 ${uptimeText}，连续稳定记录达到 ${streakDays} 天，适合对长期在线质量要求更高的用户。`;
    case 'best_value':
      return `当前价格为 ${priceText}，在成本与性能之间保持了更好的平衡，适合预算敏感但仍看重体验的用户。`;
    case 'new_entries':
      return `已观察 ${trackingDays} 天，近期评分趋势为${trendLabel}，目前处于持续跟踪阶段，具备继续上榜的潜力。`;
    case 'risk_alerts':
      return `当前主要风险信号为“${primaryRiskReason}”，投诉表现为${complaintTrendLabel}。建议暂停续费，优先核查官网、订阅和历史异常。`;
  }
}

function getTrendLabel(items: Array<{ date: string; final_score: number; display_score: number }>): string {
  if (items.length < 2) {
    return '持平';
  }

  const recent = items.slice(-7);
  const latest = recent[recent.length - 1];
  const previous = recent[recent.length - 2];
  const baseline = previous ?? recent[0];
  const delta = latest.display_score - baseline.display_score;
  if (delta > 3) {
    return '上升中';
  }
  if (delta < -3) {
    return '下降中';
  }
  return '持平';
}

function getPrimaryRiskReason(metrics: DailyMetrics): string {
  if (metrics.domain_ok === false) {
    return '官网失联';
  }
  if (typeof metrics.ssl_days_left === 'number' && metrics.ssl_days_left <= 7) {
    return '证书告急';
  }
  if (metrics.recent_complaints_count > 0) {
    return '投诉上升';
  }
  if (metrics.history_incidents > 0) {
    return '历史异常';
  }
  return '风险观察';
}

function getComplaintTrendLabel(count: number): string {
  if (count >= 5) {
    return '显著上升';
  }
  if (count >= 1) {
    return '轻微上升';
  }
  return '正常';
}

function formatPercent(value: number): string {
  return Number(value).toFixed(value % 1 === 0 ? 0 : 2);
}

function formatPrice(value: number): string {
  const rounded = round2(value);
  return Number.isInteger(rounded) ? String(rounded.toFixed(0)) : rounded.toFixed(1);
}

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function buildPublicFallbackNotice(requestedDate: string, resolvedDate: string): string {
  return `${requestedDate} 的公开分数尚未生成，当前展示 ${resolvedDate} 的最新已发布结果。`;
}

function getDisplayScore(score: { final_score: number; details?: Record<string, unknown> }): number {
  const totalScore = Number(score.details?.total_score);
  return Number.isFinite(totalScore) ? totalScore : score.final_score;
}

function buildScoreDeltaView(currentScore: number, yesterdayScore: number | null): ScoreDeltaView {
  return {
    label: '对比昨天',
    value: yesterdayScore === null ? null : round2(currentScore - yesterdayScore),
  };
}

function resolveSummarySection(
  airport: Airport,
  metrics: DailyMetrics,
  score: CardContext['score'],
  ranking: Partial<Record<RankingType, number>>,
  date: string,
): HomeSectionKey {
  if (isRiskAlertAirport(airport)) {
    return 'risk_alerts';
  }

  if (airport.tags.includes('新入榜') || diffDays(airport.created_at, date) < NEW_AIRPORT_DAYS) {
    return 'new_entries';
  }

  const rankedCandidates: Array<{ key: HomeSectionKey; rank: number }> = [];
  if (ranking.today) {
    rankedCandidates.push({ key: 'today_pick', rank: ranking.today });
  }
  if (ranking.stable) {
    rankedCandidates.push({ key: 'most_stable', rank: ranking.stable });
  }
  if (ranking.value) {
    rankedCandidates.push({ key: 'best_value', rank: ranking.value });
  }
  if (ranking.new) {
    rankedCandidates.push({ key: 'new_entries', rank: ranking.new });
  }

  rankedCandidates.sort((a, b) => a.rank - b.rank);
  if (rankedCandidates.length > 0) {
    return rankedCandidates[0].key;
  }

  if (metrics.stable_days_streak >= 30) {
    return 'most_stable';
  }

  if (score.c >= score.s) {
    return 'best_value';
  }

  return 'today_pick';
}

export function parsePublicDate(input: unknown): string {
  const date = typeof input === 'string' && input.trim() ? input.trim() : getDateInTimezone();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('date must be YYYY-MM-DD');
  }
  return date;
}
