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
  RiskMonitorItem,
  RiskMonitorView,
  ScoreDetailValue,
  ScoreDeltaView,
} from '../types/domain';
import {
  dateDaysAgo,
  diffDays,
  formatDateTimeInTimezoneIso,
  formatRelativeTimeFromNow,
  getDateInTimezone,
} from '../utils/time';
import { buildRiskReasonSummary } from '../utils/risk';

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
      details?: Record<string, ScoreDetailValue>;
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
        details?: Record<string, ScoreDetailValue>;
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
    getPublicRiskMonitorByDate?(
      date: string,
      page: number,
      pageSize: number,
    ): Promise<{
      total: number;
      items: RiskMonitorView['items'];
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
    details: Record<string, ScoreDetailValue>;
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
    const [stats, today, stable, value, newest, riskMonitor] = await Promise.all([
      this.deps.statsRepository.getHomeStats(resolvedDate),
      this.deps.rankingRepository.getRanking(resolvedDate, 'today'),
      this.deps.rankingRepository.getRanking(resolvedDate, 'stable'),
      this.deps.rankingRepository.getRanking(resolvedDate, 'value'),
      this.deps.rankingRepository.getRanking(resolvedDate, 'new'),
      this.deps.scoreRepository.getPublicRiskMonitorByDate
        ? this.deps.scoreRepository.getPublicRiskMonitorByDate(
            resolvedDate,
            1,
            SECTION_CONFIG.risk_alerts.limit,
          )
        : Promise.resolve({ total: 0, items: [] }),
    ]);
    const fallbackSections =
      today.length === 0 || stable.length === 0 || value.length === 0 || newest.length === 0
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
          items: this.buildRiskAlertHomeItems(riskMonitor.items, resolvedDate),
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

  async getRiskMonitorView(date: string, page: number, pageSize: number): Promise<RiskMonitorView> {
    const resolvedDate = (await this.deps.scoreRepository.getLatestAvailableDate(date)) || date;
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, pageSize);
    const result = this.deps.scoreRepository.getPublicRiskMonitorByDate
      ? await this.deps.scoreRepository.getPublicRiskMonitorByDate(
          resolvedDate,
          safePage,
          safePageSize,
        )
      : { total: 0, items: [] };

    return {
      date: resolvedDate,
      generated_at: formatDateTimeInTimezoneIso(new Date(), SHANGHAI_TIMEZONE),
      page: safePage,
      page_size: safePageSize,
      total: result.total,
      total_pages: Math.max(1, Math.ceil(result.total / safePageSize)),
      items: result.items.map((item) => ({
        ...item,
        snapshot_is_stale: item.score_date ? item.score_date < date : false,
      })),
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
        stability_tier: summaryCard.stability_tier,
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
        domain_penalty: getPenaltyValue(base.score.details, 'domain_penalty'),
        ssl_penalty: getPenaltyValue(base.score.details, 'ssl_penalty'),
        complaint_penalty: getPenaltyValue(base.score.details, 'complaint_penalty'),
        history_penalty: getPenaltyValue(base.score.details, 'history_penalty'),
      },
      metrics: {
        uptime_percent_30d: round2(base.metrics.uptime_percent_30d),
        median_latency_ms: round2(base.metrics.median_latency_ms),
        median_download_mbps: round2(base.metrics.median_download_mbps),
        packet_loss_percent: round2(base.metrics.packet_loss_percent),
        stable_days_streak: Number(base.metrics.stable_days_streak || 0),
        healthy_days_streak: Number(base.metrics.healthy_days_streak ?? base.metrics.stable_days_streak ?? 0),
        stability_tier: getCardStabilityTier(base.metrics),
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
        details: score.details || {},
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
      stability_tier: getCardStabilityTier(context.metrics),
      details: buildCardDetails(section, context, date),
      conclusion: buildConclusion(section, context, date),
      report_url: `/reports/${context.airport.id}?date=${date}`,
    };
  }

  private buildRiskAlertHomeItems(items: RiskMonitorItem[], date: string): PublicCardItem[] {
    return items.map((item) => ({
      type: 'risk',
      airport_id: item.airport_id,
      name: item.name,
      website: item.website,
      tags: item.tags.slice(0, 3),
      score: round2(item.score ?? 0),
      score_delta_vs_yesterday: item.score_delta_vs_yesterday,
      stability_tier: 'volatile',
      details: buildRiskMonitorCardDetails(item),
      conclusion: buildRiskMonitorConclusion(item),
      report_url: item.report_url || `/risk-monitor?date=${encodeURIComponent(date)}`,
    }));
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
  if (context.airport.status === 'down') {
    return 5;
  }
  if (isRiskAlertAirport(context.airport)) {
    return 4;
  }
  return 0;
}

function isRiskAlertAirport(airport: Airport): boolean {
  return airport.status === 'down' || airport.tags.includes('风险观察');
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
  const healthyStreakDays = Math.max(
    0,
    Number(context.metrics.healthy_days_streak ?? context.metrics.stable_days_streak ?? 0),
  );
  const minorDays30d = getMinorFluctuationDays30d(context.metricsTrend30d);
  const volatileDays30d = getVolatileDays30d(context.metricsTrend30d);
  const trackingDays = Math.max(1, diffDays(context.airport.created_at, date) + 1);
  const primaryRiskReason = getPrimaryRiskReason(context.metrics);
  const complaintTrendLabel = getComplaintTrendLabel(context.metrics.recent_complaints_count);
  const trendLabel = getTrendLabel(context.scoreTrend30d);

  switch (section) {
    case 'today_pick':
      return [
        { label: '健康记录', value: `${healthyStreakDays} 天` },
        { label: '最近30天', value: `${volatileDays30d} 异常 · ${minorDays30d} 轻微` },
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
  const healthyStreakDays = Math.max(
    0,
    Number(context.metrics.healthy_days_streak ?? context.metrics.stable_days_streak ?? 0),
  );
  const priceText = `¥${formatPrice(context.airport.plan_price_month)}/月`;
  const trackingDays = Math.max(1, diffDays(context.airport.created_at, date) + 1);
  const trendLabel = getTrendLabel(context.scoreTrend30d);
  const primaryRiskReason = getPrimaryRiskReason(context.metrics);
  const complaintTrendLabel = getComplaintTrendLabel(context.metrics.recent_complaints_count);
  const minorDays30d = getMinorFluctuationDays30d(context.metricsTrend30d);
  const volatileDays30d = getVolatileDays30d(context.metricsTrend30d);
  const stabilityTier = getCardStabilityTier(context.metrics);

  switch (section) {
    case 'today_pick':
      return `${buildTodayPickHighlight(context, healthyStreakDays)} ${buildTodayPickReminder(
        context,
        stabilityTier,
        volatileDays30d,
        minorDays30d,
      )}`;
    case 'most_stable':
      return `近阶段可用率维持在 ${uptimeText}，连续稳定记录达到 ${streakDays} 天，适合对长期在线质量要求更高的用户。`;
    case 'best_value':
      return `当前价格为 ${priceText}，在成本与性能之间保持了更好的平衡，适合预算敏感但仍看重体验的用户。`;
    case 'new_entries':
      return `已观察 ${trackingDays} 天，近期评分趋势为${trendLabel}，目前处于持续跟踪阶段，具备继续上榜的潜力。`;
    case 'risk_alerts':
      return `${buildRiskReasonSummary({
        metrics: context.metrics,
        score: {
          r: context.score.r,
          details: context.score.details,
        },
      })} 建议暂停续费，优先核查官网、订阅和历史异常。`;
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

function getCardStabilityTier(metrics: DailyMetrics): PublicCardItem['stability_tier'] {
  if (
    metrics.stability_tier === 'stable' ||
    metrics.stability_tier === 'minor_fluctuation' ||
    metrics.stability_tier === 'volatile'
  ) {
    return metrics.stability_tier;
  }
  if (metrics.is_stable_day === true || Number(metrics.stable_days_streak || 0) > 0) {
    return 'stable';
  }
  return 'volatile';
}

function getMinorFluctuationDays30d(items: DailyMetrics[]): number {
  return items.filter((row) => getCardStabilityTier(row) === 'minor_fluctuation').length;
}

function getVolatileDays30d(items: DailyMetrics[]): number {
  return items.filter((row) => getCardStabilityTier(row) === 'volatile').length;
}

function buildTodayPickHighlight(context: CardContext, healthyStreakDays: number): string {
  const preferredTag = getPreferredHighlightTag(context.airport.tags);
  if (preferredTag) {
    switch (preferredTag) {
      case '长期稳定':
        return `亮点：当前已连续保持 ${healthyStreakDays} 天健康记录，长期使用更省心。`;
      case '新手友好':
        return '亮点：门槛更低、风险更可控，适合作为大多数用户的优先候选。';
      case '性价比高':
        return '亮点：当前价格与实际表现更均衡，预算和体验之间更容易兼顾。';
      case '高性能':
        return '亮点：当前性能维度更突出，适合更看重速度和线路响应的用户。';
      case '高端路线':
        return '亮点：当前综合体验更偏高端路线，适合愿意为稳定体验付溢价的用户。';
      case '新入榜':
        return '亮点：近期表现足够靠前，属于值得继续重点观察的新晋候选。';
    }
    return `亮点：当前已连续保持 ${healthyStreakDays} 天健康记录，整体表现仍然值得优先关注。`;
  }

  const strongestDimension = getStrongestScoreDimension(context.score);
  switch (strongestDimension) {
    case 's':
      return `亮点：稳定性仍是当前最强项，健康记录已经来到 ${healthyStreakDays} 天。`;
    case 'p':
      return '亮点：性能维度当前最突出，延迟与速度表现更有竞争力。';
    case 'c':
      return '亮点：价格维度当前最突出，整体成本效率更有优势。';
    case 'r':
      return '亮点：当前风险侧较干净，基础信任面相对更稳。';
  }
}

function buildTodayPickReminder(
  context: CardContext,
  stabilityTier: PublicCardItem['stability_tier'],
  volatileDays30d: number,
  minorDays30d: number,
): string {
  if (stabilityTier === 'volatile') {
    return '提醒：当前处于异常波动状态，建议优先确认登录、订阅与高峰时段可用性。';
  }
  if (stabilityTier === 'minor_fluctuation') {
    return '提醒：当前可以正常使用，但存在轻微抖动，建议继续观察高峰时段延迟。';
  }
  if (volatileDays30d > 0) {
    return `提醒：最近30天出现 ${volatileDays30d} 天异常波动、${minorDays30d} 天轻微抖动，短期稳定性仍需继续跟踪。`;
  }
  if (context.metrics.recent_complaints_count > 0) {
    return `提醒：近期投诉有 ${context.metrics.recent_complaints_count} 条，继续使用前建议交叉核对官网和订阅状态。`;
  }
  if (context.metrics.history_incidents > 0) {
    return `提醒：历史异常累计 ${context.metrics.history_incidents} 次，长期使用前仍建议结合完整报告复核。`;
  }
  return '提醒：当前没有明显异常记录，适合作为近期优先观察和试用的主力候选。';
}

function getPreferredHighlightTag(tags: string[]): string | null {
  const preferredTags = ['长期稳定', '新手友好', '性价比高', '高性能', '高端路线', '新入榜'];
  for (const tag of preferredTags) {
    if (tags.includes(tag)) {
      return tag;
    }
  }
  return null;
}

function getStrongestScoreDimension(score: CardContext['score']): 's' | 'p' | 'c' | 'r' {
  const dimensions: Array<{ key: 's' | 'p' | 'c' | 'r'; value: number }> = [
    { key: 's', value: score.s },
    { key: 'p', value: score.p },
    { key: 'c', value: score.c },
    { key: 'r', value: score.r },
  ];
  dimensions.sort((left, right) => right.value - left.value);
  return dimensions[0]?.key ?? 's';
}

function buildRiskMonitorCardDetails(
  item: RiskMonitorItem,
): [PublicCardItem['details'][0], PublicCardItem['details'][1]] {
  return [
    {
      label: '监测类型',
      value: item.monitor_reason === 'down' ? '已跑路' : '风险观察',
    },
    {
      label: '评分快照',
      value: item.score_date
        ? `${item.score_date}${item.snapshot_is_stale ? '（非实时）' : ''}`
        : '暂无历史评分',
    },
  ];
}

function buildRiskMonitorConclusion(item: RiskMonitorItem): string {
  if (item.monitor_reason === 'down') {
    return '该机场已由管理员确认标记为跑路状态，已停止日常测评与调度采样。建议暂停续费，并仅将其作为风险留档对象观察。';
  }
  if (item.risk_reason_summary) {
    return `${item.risk_reason_summary}${item.snapshot_is_stale && item.score_date ? ` 当前说明基于 ${item.score_date} 快照，非实时探测结果。` : ''}`;
  }
  return '该机场当前命中“风险观察”标签，尚未进入管理员确认跑路状态。建议优先核查官网、订阅、投诉与近期波动，再决定是否继续使用。';
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

function getPenaltyValue(details: Record<string, ScoreDetailValue>, key: string): number {
  const value = details[key];
  return typeof value === 'number' && Number.isFinite(value) ? round2(value) : 0;
}

function buildPublicFallbackNotice(requestedDate: string, resolvedDate: string): string {
  return `${requestedDate} 的公开分数尚未生成，当前展示 ${resolvedDate} 的最新已生成快照，非实时探测结果。`;
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
