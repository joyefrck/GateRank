import { effectiveComponent } from './scoreComponents';
import { NEW_AIRPORT_DAYS, SHANGHAI_TIMEZONE } from '../config/scoring';
import { CLICK_CHARGE_AMOUNT } from '../config/billing';
import type { PublicScoreVisibility } from '../repositories/applicantBillingRepository';
import type {
  Airport,
  DailyMetrics,
  FullRankingView,
  HomeNewsUpdateView,
  HomePageView,
  HomeSponsoredDealView,
  NewsArticleListItem,
  NetworkCoverageRun,
  PublicCardItem,
  PublicCardType,
  RankingItem,
  RankingType,
  ReportCapabilities,
  ReportView,
  RiskMonitorItem,
  RiskMonitorView,
  ScoreDetailValue,
  ScoreDeltaView,
  SubscriptionNodeSnapshot,
} from '../types/domain';
import {
  AIRPORT_HOME_AD_SLOTS,
  type AirportDealView,
  type AirportHomeAdSlot,
} from '../../../shared/airportAds';
import {
  dateDaysAgo,
  diffDays,
  formatDateTimeInTimezoneIso,
  formatRelativeTimeFromNow,
  getDateInTimezone,
} from '../utils/time';
import { buildRiskReasonSummary } from '../utils/risk';
import { isInformationalNodeName } from '../utils/informationalNode';
import { findNodeRegionDefinition, REPORT_NODE_REGION_DEFINITIONS } from '../utils/nodeRegion';
import { buildTodayPickRows, isTodayPickEligible, type RankedAirportInput } from './rankingService';
import { DEFAULT_HOME_SECTION_LIMITS, type HomeSectionLimits } from './marketingSettingsService';
import { buildAirportReportPath, buildAirportSlugCandidate } from '../../../shared/publicSeo';
import { EMPTY_FULL_RANKING_FILTERS, type FullRankingFilters } from '../../../shared/fullRankingFilters';
import { calculateObservationDays } from '../../../shared/observationDays';
import {
  buildHomeToolDownloadCta,
  type HomeToolDownloadCta,
  type HomeToolDownloadCtaItem,
  type ToolDownloadItem,
  type ToolsDownloadPageView,
} from '../../../shared/toolDownloads';

type HomeSectionKey =
  | 'today_pick'
  | 'most_stable'
  | 'best_value'
  | 'new_entries'
  | 'risk_alerts';

interface PublicViewDeps {
  airportRepository: {
    getById(id: number): Promise<Airport | null>;
    getBySlug?(slug: string): Promise<Airport | null>;
    getByIds?(ids: number[]): Promise<Map<number, Airport>>;
    listLatestApprovedApplicationAirports?(limit: number): Promise<Airport[]>;
  };
  metricsRepository: {
    getByAirportAndDate(airportId: number, date: string): Promise<DailyMetrics | null>;
    getTrend(airportId: number, startDate: string, endDate: string): Promise<DailyMetrics[]>;
    getByAirportIdsAndDate?(airportIds: number[], date: string): Promise<Map<number, DailyMetrics>>;
    getTrendsByAirportIds?(
      airportIds: number[],
      startDate: string,
      endDate: string,
    ): Promise<Map<number, DailyMetrics[]>>;
  };
  scoreRepository: {
    getLatestAvailableDate(onOrBefore: string): Promise<string | null>;
    getLatestAvailableDateByAirport?(
      airportId: number,
      onOrBefore: string,
      scoreRuleVersion?: 'v1_spcr' | 'v2_spncr',
    ): Promise<string | null>;
    getByAirportAndDate(airportId: number, date: string): Promise<{
      airport_id: number;
      date: string;
      s: number;
      p: number;
      n?: number | null;
      c: number;
      r: number;
      risk_penalty: number;
      score: number;
      recent_score: number;
      historical_score: number;
      final_score: number;
      details?: Record<string, ScoreDetailValue>;
    } | null>;
    getPublicDisplayScoreByAirportAndDate(
      airportId: number,
      date: string,
      scoreRuleVersion?: 'v1_spcr' | 'v2_spncr',
    ): Promise<number | null>;
    getPublicDisplayScoresByDate?(
      airportIds: number[],
      date: string,
      scoreRuleVersion?: 'v1_spcr' | 'v2_spncr',
    ): Promise<Map<number, number>>;
    getTrend(
      airportId: number,
      startDate: string,
      endDate: string,
    ): Promise<
      Array<{
        date: string;
        s: number;
        p: number;
        n?: number | null;
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
    getByAirportIdsAndDate?(
      airportIds: number[],
      date: string,
    ): Promise<
      Map<number, {
        airport_id: number;
        date: string;
        s: number;
        p: number;
        n?: number | null;
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
    getTrendsByAirportIds?(
      airportIds: number[],
      startDate: string,
      endDate: string,
    ): Promise<
      Map<number, Array<{
        date: string;
        s: number;
        p: number;
        n?: number | null;
        c: number;
        r: number;
        risk_penalty: number;
        score: number;
        recent_score: number;
        historical_score: number;
        final_score: number;
        details?: Record<string, ScoreDetailValue>;
      }>>
    >;
      getPublicFullRankingByDate(
        date: string,
        page: number,
        pageSize: number,
        filters?: FullRankingFilters,
        clickChargeAmount?: number,
        scoreRuleVersion?: 'v1_spcr' | 'v2_spncr',
      ): Promise<{
        total: number;
        items: FullRankingView['items'];
      }>;
      getPublicRiskMonitorByDate?(
        date: string,
        page: number,
        pageSize: number,
        clickChargeAmount?: number,
      ): Promise<{
        total: number;
        items: RiskMonitorView['items'];
      }>;
    };
    applicantBillingRepository?: {
      getPublicScoreVisibilityByAirportIds?(
        airportIds: number[],
        clickChargeAmount?: number,
      ): Promise<Map<number, PublicScoreVisibility>>;
    };
    marketingSettingsService?: {
      getConfig(): Promise<{
        click_charge_amount: number;
        home_section_limits?: Partial<HomeSectionLimits>;
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
  subscriptionNodeSnapshotRepository?: {
    getLatestByAirport(airportId: number): Promise<SubscriptionNodeSnapshot | null>;
  };
    networkCoverageRunRepository?: {
    getLatestSuccessfulByAirportAndDate(airportId: number, date: string): Promise<NetworkCoverageRun | null>;
  };
  scoreRuleService?: {
    resolveRuleVersion(date: string): Promise<'v1_spcr' | 'v2_spncr'>;
    isForceDisabled?(): boolean;
  };
  toolsDownloadService?: {
    getDownloadPageView(platform?: null): Promise<ToolsDownloadPageView>;
  };
  airportAdCampaignRepository?: {
    listActiveDeals(): Promise<AirportDealView[]>;
    listActiveHomeDeals?(): Promise<AirportDealView[]>;
  };
  newsRepository?: {
    listPublished(options: { page?: number; pageSize?: number }): Promise<{
      items: NewsArticleListItem[];
      total: number;
    }>;
  };
}

interface CardContext {
  airport: Airport;
  metrics: DailyMetrics;
  score: {
    s: number;
    p: number;
    n: number | null;
    c: number;
    r: number;
      risk_penalty: number;
      final_score: number;
      display_score: number | null;
      score_hidden: boolean;
      score_hidden_reason: 'insufficient_balance' | null;
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
    limit: 6,
  },
  risk_alerts: {
    rankingType: 'risk',
    title: '风险预警',
    subtitle: 'Risk Alerts',
    type: 'risk',
    limit: 1,
  },
};

const DEFAULT_SCORE_VISIBILITY: PublicScoreVisibility = {
  score_hidden: false,
  score_hidden_reason: null,
};
const HOME_TOOL_DOWNLOAD_CTA_LIMIT = 4;
const HOME_SPONSORED_DEAL_LIMIT = AIRPORT_HOME_AD_SLOTS.length;
const HOME_NEWS_UPDATE_LIMIT = 5;

export class PublicViewService {
  constructor(private readonly deps: PublicViewDeps) {}

    async getHomePageView(date: string): Promise<HomePageView> {
      const resolvedDate = (await this.deps.rankingRepository.getLatestAvailableDate(date)) || date;
      const resolvedFromFallback = resolvedDate !== date;
      const marketingConfig = await this.getMarketingConfig();
      const clickChargeAmount = marketingConfig.click_charge_amount;
      const sectionLimits = marketingConfig.home_section_limits;
      const scoreRuleVersion = await this.resolveActiveScoreRuleVersion(resolvedDate);
      const [
      stats,
      fullRankingPreview,
      stable,
      value,
      newest,
      latestApprovedApplicationAirports,
      riskMonitor,
      toolDownloadCta,
      activeDeals,
      newsResult,
    ] = await Promise.all([
      this.deps.statsRepository.getHomeStats(resolvedDate),
        this.deps.scoreRepository.getPublicFullRankingByDate(
          resolvedDate,
          1,
          sectionLimits.today_pick,
          EMPTY_FULL_RANKING_FILTERS,
          clickChargeAmount,
          scoreRuleVersion,
        ),
      this.deps.rankingRepository.getRanking(resolvedDate, 'stable'),
      this.deps.rankingRepository.getRanking(resolvedDate, 'value'),
      this.deps.rankingRepository.getRanking(resolvedDate, 'new'),
      this.deps.airportRepository.listLatestApprovedApplicationAirports
        ? this.deps.airportRepository.listLatestApprovedApplicationAirports(
            sectionLimits.new_entries,
          )
        : Promise.resolve([]),
      this.deps.scoreRepository.getPublicRiskMonitorByDate
        ? this.deps.scoreRepository.getPublicRiskMonitorByDate(
              resolvedDate,
              1,
              sectionLimits.risk_alerts,
              clickChargeAmount,
            )
        : Promise.resolve({ total: 0, items: [] }),
      this.buildToolDownloadCta(),
      this.loadActiveHomeDeals(),
      this.deps.newsRepository?.listPublished({ page: 1, pageSize: HOME_NEWS_UPDATE_LIMIT })
        ?? Promise.resolve({ items: [], total: 0 }),
    ]);
    const preloadedContexts = await this.preloadCardContexts(
      collectRankingAirportIds(
        fullRankingPreview.items,
        stable,
        value,
        newest,
        latestApprovedApplicationAirports.map((airport) => ({ airport_id: airport.id })),
        activeDeals.map((deal) => ({ airport_id: deal.airport_id })),
        ),
        resolvedDate,
        clickChargeAmount,
      );
    const loadCardContext = this.createCardContextLoader(preloadedContexts, clickChargeAmount);
    const [
      todayPickItems,
      stableItems,
      valueItems,
      newestItems,
      latestApprovedApplicationItems,
      sponsoredDeals,
    ] = await Promise.all([
      this.buildHomeSectionItems(
        'today_pick',
        fullRankingPreview.items.slice(0, sectionLimits.today_pick),
        resolvedDate,
        loadCardContext,
        sectionLimits,
      ),
      stable.length > 0
        ? this.buildHomeSectionItems('most_stable', stable, resolvedDate, loadCardContext, sectionLimits)
        : Promise.resolve([]),
      value.length > 0
        ? this.buildHomeSectionItems('best_value', value, resolvedDate, loadCardContext, sectionLimits)
        : Promise.resolve([]),
      newest.length > 0
        ? this.buildHomeSectionItems('new_entries', newest, resolvedDate, loadCardContext, sectionLimits)
        : Promise.resolve([]),
      latestApprovedApplicationAirports.length > 0
        ? this.buildHomeSectionItems(
            'new_entries',
            latestApprovedApplicationAirports.map((airport) => ({ airport_id: airport.id })),
            resolvedDate,
            loadCardContext,
            sectionLimits,
          )
        : Promise.resolve([]),
      this.buildHomeSponsoredDeals(activeDeals, resolvedDate, loadCardContext),
    ]);
    const newEntryItems = mergeHomeSectionItems(
      sectionLimits.new_entries,
      latestApprovedApplicationItems,
      newestItems,
    );
    const fallbackSections =
      todayPickItems.length === 0 ||
      stable.length === 0 ||
      value.length === 0 ||
      newEntryItems.length < sectionLimits.new_entries
          ? await this.buildFallbackHomeSections(
              resolvedDate,
              loadCardContext,
              clickChargeAmount,
              sectionLimits,
            )
          : null;
    const finalNewEntryItems = mergeHomeSectionItems(
      sectionLimits.new_entries,
      newEntryItems,
      fallbackSections?.new_entries ?? [],
    );

    return {
      requested_date: date,
      date: resolvedDate,
      resolved_from_fallback: resolvedFromFallback,
      fallback_notice: resolvedFromFallback ? buildPublicFallbackNotice(date, resolvedDate, scoreRuleVersion) : null,
      generated_at: formatDateTimeInTimezoneIso(new Date(), SHANGHAI_TIMEZONE),
      hero: {
        report_time_at: stats.latest_data_at,
        report_time_text: formatRelativeTimeFromNow(stats.latest_data_at),
        monitored_airports: stats.monitored_airports,
        realtime_tests: stats.realtime_tests,
      },
      tool_download_cta: toolDownloadCta,
      ranking_preview: {
        total: fullRankingPreview.total,
        items: fullRankingPreview.items.slice(0, sectionLimits.today_pick),
      },
      sponsored_deals: {
        total: activeDeals.length,
        display_limit: HOME_SPONSORED_DEAL_LIMIT,
        items: sponsoredDeals,
      },
      news_updates: newsResult.items.slice(0, HOME_NEWS_UPDATE_LIMIT).map(toHomeNewsUpdate),
      sections: {
        today_pick: {
          title: SECTION_CONFIG.today_pick.title,
          subtitle: SECTION_CONFIG.today_pick.subtitle,
          items: todayPickItems.length > 0 ? todayPickItems : (fallbackSections?.today_pick ?? []),
        },
        most_stable: {
          title: SECTION_CONFIG.most_stable.title,
          subtitle: SECTION_CONFIG.most_stable.subtitle,
          items: stable.length > 0 ? stableItems : (fallbackSections?.most_stable ?? []),
        },
        best_value: {
          title: SECTION_CONFIG.best_value.title,
          subtitle: SECTION_CONFIG.best_value.subtitle,
          items: value.length > 0 ? valueItems : (fallbackSections?.best_value ?? []),
        },
        new_entries: {
          title: SECTION_CONFIG.new_entries.title,
          subtitle: SECTION_CONFIG.new_entries.subtitle,
          items: finalNewEntryItems,
        },
        risk_alerts: {
          title: SECTION_CONFIG.risk_alerts.title,
          subtitle: SECTION_CONFIG.risk_alerts.subtitle,
          items: this.buildRiskAlertHomeItems(riskMonitor.items, resolvedDate),
        },
      },
    };
  }

  async getFullRankingView(
    date: string,
    page: number,
    pageSize: number,
    filters: FullRankingFilters = EMPTY_FULL_RANKING_FILTERS,
    ): Promise<FullRankingView> {
      const resolvedDate = (await this.deps.scoreRepository.getLatestAvailableDate(date)) || date;
      const safePage = Math.max(1, page);
      const safePageSize = Math.max(1, pageSize);
      const clickChargeAmount = await this.getClickChargeAmount();
      const scoreRuleVersion = await this.resolveActiveScoreRuleVersion(resolvedDate);
      const [result, toolDownloadCta] = await Promise.all([
        this.deps.scoreRepository.getPublicFullRankingByDate(
          resolvedDate,
          safePage,
          safePageSize,
          filters,
          clickChargeAmount,
          scoreRuleVersion,
        ),
        this.buildToolDownloadCta(),
      ]);

    return {
      date: resolvedDate,
      score_rule_version: scoreRuleVersion,
      generated_at: formatDateTimeInTimezoneIso(new Date(), SHANGHAI_TIMEZONE),
      filters,
      page: safePage,
      page_size: safePageSize,
      total: result.total,
      total_pages: Math.max(1, Math.ceil(result.total / safePageSize)),
      tool_download_cta: toolDownloadCta,
      items: result.items,
    };
  }

    async getRiskMonitorView(date: string, page: number, pageSize: number): Promise<RiskMonitorView> {
      const resolvedDate = (await this.deps.scoreRepository.getLatestAvailableDate(date)) || date;
      const safePage = Math.max(1, page);
      const safePageSize = Math.max(1, pageSize);
      const clickChargeAmount = await this.getClickChargeAmount();
      const result = this.deps.scoreRepository.getPublicRiskMonitorByDate
        ? await this.deps.scoreRepository.getPublicRiskMonitorByDate(
            resolvedDate,
            safePage,
            safePageSize,
            clickChargeAmount,
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
      const requestedRuleVersion = await this.resolveActiveScoreRuleVersion(date);
      const forcedRuleVersion = this.deps.scoreRuleService?.isForceDisabled?.()
        ? requestedRuleVersion
        : undefined;
      const latestAirportDate = this.deps.scoreRepository.getLatestAvailableDateByAirport
        ? await this.deps.scoreRepository.getLatestAvailableDateByAirport(airportId, date, forcedRuleVersion)
        : await this.deps.scoreRepository.getLatestAvailableDate(date);
      const resolvedDate = latestAirportDate || date;
      const resolvedFromFallback = resolvedDate !== date;
      const marketingConfig = await this.getMarketingConfig();
      const clickChargeAmount = marketingConfig.click_charge_amount;
      const base = await this.loadCardContext(airportId, resolvedDate, clickChargeAmount);
    if (!base) {
      return null;
    }

    const scoreRuleVersion = resolveScoreRuleVersion(base.score.details);
    const [rawRanking, nodeSnapshot, networkCoverageRun, toolDownloadCta] = await Promise.all([
      this.deps.rankingRepository.getRanksForAirport(airportId, resolvedDate),
      this.deps.subscriptionNodeSnapshotRepository?.getLatestByAirport(airportId) ?? Promise.resolve(null),
      scoreRuleVersion === 'v2_spncr'
        ? this.deps.networkCoverageRunRepository?.getLatestSuccessfulByAirportAndDate(airportId, resolvedDate) ?? Promise.resolve(null)
        : Promise.resolve(null),
      this.buildToolDownloadCta(),
    ]);
    const todayRank = rawRanking.today ?? (await this.getTodayPickRankFromPublicRanking(
      airportId,
      resolvedDate,
      clickChargeAmount,
      marketingConfig.home_section_limits.today_pick,
    ));
    const ranking = {
      ...rawRanking,
      today: todayRank,
      risk: isRiskAlertAirport(base.airport) ? rawRanking.risk : undefined,
    };
    const section = resolveSummarySection(base.airport, base.metrics, base.score, ranking, resolvedDate);
    const summaryCard = this.buildCard(section, base, resolvedDate);
    const metricsStartDate = dateDaysAgo(resolvedDate, 29);

    return {
      requested_date: date,
      date: resolvedDate,
      score_rule_version: scoreRuleVersion,
      resolved_from_fallback: resolvedFromFallback,
      fallback_notice: resolvedFromFallback ? buildPublicFallbackNotice(date, resolvedDate, scoreRuleVersion) : null,
      performance_under_review:
        base.metrics.performance_review_status != null && base.metrics.performance_review_status !== 'normal',
      tool_download_cta: toolDownloadCta,
      airport: {
        id: base.airport.id,
        slug: resolvePublicAirportSlug(base.airport),
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
          score_hidden: summaryCard.score_hidden,
          score_hidden_reason: summaryCard.score_hidden_reason,
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
        s: base.score.score_hidden ? null : round2(base.score.s),
        p: base.score.score_hidden ? null : round2(base.score.p),
        n: !base.score.score_hidden && scoreRuleVersion === 'v2_spncr' && base.score.n != null ? round2(base.score.n) : null,
        c: base.score.score_hidden ? null : round2(base.score.c),
        r: base.score.score_hidden ? null : round2(base.score.r),
          final_score: base.score.score_hidden ? null : round2(base.score.display_score ?? 0),
        risk_penalty: round2(base.score.risk_penalty),
        domain_penalty: getPenaltyValue(base.score.details, 'domain_penalty'),
        ssl_penalty: getPenaltyValue(base.score.details, 'ssl_penalty'),
        complaint_penalty: getPenaltyValue(base.score.details, 'complaint_penalty'),
        history_penalty: getPenaltyValue(base.score.details, 'history_penalty'),
      },
      network_coverage: networkCoverageRun ? buildNetworkCoverageSummary(networkCoverageRun) : null,
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
          score_30d: base.score.score_hidden
            ? []
            : base.scoreTrend30d.map((row) => ({ date: row.date, value: round2(row.display_score) })),
        uptime_30d: base.metricsTrend30d
          .filter((row) => typeof row.uptime_percent_30d === 'number')
          .map((row) => ({ date: row.date, value: round2(row.uptime_percent_30d) })),
        latency_30d: base.metricsTrend30d
          .filter((row) => typeof row.median_latency_ms === 'number')
          .map((row) => ({ date: row.date, value: round2(row.median_latency_ms) })),
        download_30d: base.metricsTrend30d
          .filter((row) => typeof row.median_download_mbps === 'number')
          .map((row) => ({ date: row.date, value: round2(row.median_download_mbps) })),
        packet_loss_30d: base.metricsTrend30d
          .filter(
            (row) =>
              row.packet_loss_measurement === 'proxy_http_request_failure_rate_v1' &&
              typeof row.packet_loss_percent === 'number',
          )
          .map((row) => ({ date: row.date, value: round2(row.packet_loss_percent) })),
      },
      capabilities: buildReportCapabilities(base.airport, nodeSnapshot),
    };
  }

  async getReportViewBySlug(slug: string, date: string): Promise<ReportView | null> {
    if (!this.deps.airportRepository.getBySlug) {
      return null;
    }
    const airport = await this.deps.airportRepository.getBySlug(slug);
    if (!airport) {
      return null;
    }
    return this.getReportView(airport.id, date);
  }

  private async getClickChargeAmount(): Promise<number> {
    return (await this.getMarketingConfig()).click_charge_amount;
  }

  private async resolveActiveScoreRuleVersion(date: string): Promise<'v1_spcr' | 'v2_spncr'> {
    return this.deps.scoreRuleService?.resolveRuleVersion(date) ?? 'v1_spcr';
  }

  private async getMarketingConfig(): Promise<{
    click_charge_amount: number;
    home_section_limits: HomeSectionLimits;
  }> {
    if (!this.deps.marketingSettingsService) {
      return {
        click_charge_amount: CLICK_CHARGE_AMOUNT,
        home_section_limits: { ...DEFAULT_HOME_SECTION_LIMITS },
      };
    }
    const config = await this.deps.marketingSettingsService.getConfig();
    const amount = Number(config.click_charge_amount);
    return {
      click_charge_amount: Number.isFinite(amount) && amount > 0 ? amount : CLICK_CHARGE_AMOUNT,
      home_section_limits: normalizeHomeSectionLimits(config.home_section_limits),
    };
  }

  private async buildToolDownloadCta(): Promise<HomeToolDownloadCta> {
    if (!this.deps.toolsDownloadService) {
      return buildHomeToolDownloadCta([]);
    }
    try {
      const view = await this.deps.toolsDownloadService.getDownloadPageView(null);
      return buildHomeToolDownloadCta(selectHomeToolDownloadCtaItems(view));
    } catch {
      return buildHomeToolDownloadCta([]);
    }
  }

  private async getScoreVisibilityByAirportIds(
    airportIds: number[],
    clickChargeAmount: number,
  ): Promise<Map<number, PublicScoreVisibility>> {
    if (!this.deps.applicantBillingRepository?.getPublicScoreVisibilityByAirportIds) {
      return new Map(airportIds.map((airportId) => [airportId, DEFAULT_SCORE_VISIBILITY]));
    }
    return this.deps.applicantBillingRepository.getPublicScoreVisibilityByAirportIds(
      airportIds,
      clickChargeAmount,
    );
  }

  private async buildHomeSponsoredDeals(
    deals: AirportDealView[],
    date: string,
    loadCardContext: (airportId: number, targetDate: string) => Promise<CardContext | null>,
  ): Promise<HomeSponsoredDealView[]> {
    const items = await Promise.all(
      deals.slice(0, HOME_SPONSORED_DEAL_LIMIT).map(async (deal) => {
        const homeSlot = Number(deal.home_slot);
        if (!AIRPORT_HOME_AD_SLOTS.includes(homeSlot as AirportHomeAdSlot)) {
          return null;
        }
        const context = await loadCardContext(deal.airport_id, date);
        const airport = context?.airport;
        const currentScore = context?.score.display_score ?? null;
        const yesterdayScore = context?.score.yesterday_display_score ?? null;
        const onboardedAt = airport?.created_at || deal.airport_created_at;

        return {
          campaign_id: deal.campaign_id,
          airport_id: deal.airport_id,
          home_slot: homeSlot as AirportHomeAdSlot,
          name: airport?.name || deal.airport_name,
          website: airport?.website || deal.website,
          report_url: deal.report_url,
          discount_title: deal.discount_title,
          discount_description: deal.discount_description,
          coupon_code: deal.coupon_code,
          plan_price_month: Number(airport?.plan_price_month ?? deal.plan_price_month ?? 0),
          tracking_days: calculateObservationDays(onboardedAt, date) ?? 0,
          tags: (airport?.tags || deal.tags || []).slice(0, 3),
          score: currentScore,
          score_hidden: context?.score.score_hidden ?? false,
          score_hidden_reason: context?.score.score_hidden_reason ?? null,
          score_delta_vs_yesterday: buildScoreDeltaView(currentScore, yesterdayScore),
        };
      }),
    );

    return items
      .filter((item): item is HomeSponsoredDealView => item !== null)
      .sort((left, right) => left.home_slot - right.home_slot);
  }

  private async loadActiveHomeDeals(): Promise<AirportDealView[]> {
    const repository = this.deps.airportAdCampaignRepository;
    if (!repository) {
      return [];
    }
    const deals = repository.listActiveHomeDeals
      ? await repository.listActiveHomeDeals()
      : await repository.listActiveDeals();
    return deals
      .filter((deal) => AIRPORT_HOME_AD_SLOTS.includes(Number(deal.home_slot) as AirportHomeAdSlot))
      .sort((left, right) => Number(left.home_slot) - Number(right.home_slot))
      .slice(0, HOME_SPONSORED_DEAL_LIMIT);
  }

  private async buildHomeSectionItems(
    section: HomeSectionKey,
    rankingItems: Array<Pick<RankingItem, 'airport_id'>>,
    date: string,
    loadCardContext: (airportId: number, targetDate: string) => Promise<CardContext | null>,
    sectionLimits: HomeSectionLimits,
  ): Promise<PublicCardItem[]> {
    const items = await Promise.all(
      rankingItems.map(async (item) => {
        const context = await loadCardContext(item.airport_id, date);
        if (!context) {
          return null;
        }
        if (section === 'new_entries' && !isVisibleNewEntryContext(context)) {
          return null;
        }
        return this.buildCard(section, context, date);
      }),
    );

    return items
      .filter((item): item is PublicCardItem => item !== null)
      .sort(comparePublicCardVisibility)
      .slice(0, sectionLimits[section]);
  }

  private async getTodayPickRankFromPublicRanking(
    airportId: number,
    date: string,
    clickChargeAmount: number,
    todayPickLimit: number = DEFAULT_HOME_SECTION_LIMITS.today_pick,
  ): Promise<number | undefined> {
    const scoreRuleVersion = await this.resolveActiveScoreRuleVersion(date);
    const { items } = await this.deps.scoreRepository.getPublicFullRankingByDate(
      date,
      1,
      todayPickLimit,
      EMPTY_FULL_RANKING_FILTERS,
      clickChargeAmount,
      scoreRuleVersion,
    );
    const matchedItem = items.find((item) => item.airport_id === airportId);
    return matchedItem?.rank;
  }

  private async buildFallbackHomeSections(
    date: string,
    loadCardContext: (airportId: number, targetDate: string) => Promise<CardContext | null>,
    clickChargeAmount: number,
    sectionLimits: HomeSectionLimits,
  ): Promise<Record<HomeSectionKey, PublicCardItem[]>> {
    const scoreRuleVersion = await this.resolveActiveScoreRuleVersion(date);
    const { items } = await this.deps.scoreRepository.getPublicFullRankingByDate(
      date,
      1,
      100,
      EMPTY_FULL_RANKING_FILTERS,
      clickChargeAmount,
      scoreRuleVersion,
    );
    const contexts = (
      await Promise.all(items.map((item) => loadCardContext(item.airport_id, date)))
    ).filter((context): context is CardContext => context !== null);

    const byScore = [...contexts].sort(compareByDisplayScoreDesc);
    const byStable = [...contexts].sort(compareByStabilityDesc);
    const byValue = [...contexts].sort(compareByValueDesc);
    const byNew = [...contexts]
      .filter((context) => isNewAirportContext(context, date) && isVisibleNewEntryContext(context))
      .sort(compareByNewAirportEntryDesc);
    const byRisk = [...contexts]
      .filter((context) => isRiskAlertContext(context))
      .sort(compareByRiskPriority);

    return {
      today_pick: byScore
        .slice(0, sectionLimits.today_pick)
        .map((context) => this.buildCard('today_pick', context, date)),
      most_stable: byStable
        .slice(0, sectionLimits.most_stable)
        .map((context) => this.buildCard('most_stable', context, date)),
      best_value: byValue
        .slice(0, sectionLimits.best_value)
        .map((context) => this.buildCard('best_value', context, date)),
      new_entries: byNew
        .slice(0, sectionLimits.new_entries)
        .map((context) => this.buildCard('new_entries', context, date)),
      risk_alerts: byRisk
        .slice(0, sectionLimits.risk_alerts)
        .map((context) => this.buildCard('risk_alerts', context, date)),
    };
  }

  private createCardContextLoaderWithCache(
    cache: Map<string, Promise<CardContext | null>>,
    clickChargeAmount: number,
  ): (airportId: number, date: string) => Promise<CardContext | null> {
    return (airportId: number, date: string) => {
      const key = `${airportId}:${date}`;
      const cached = cache.get(key);
      if (cached) {
        return cached;
      }

      const pending = this.loadCardContext(airportId, date, clickChargeAmount);
      cache.set(key, pending);
      return pending;
    };
  }

  private createCardContextLoader(
    preloaded?: Map<string, CardContext | null>,
    clickChargeAmount: number = CLICK_CHARGE_AMOUNT,
  ): (airportId: number, date: string) => Promise<CardContext | null> {
    const cache = new Map<string, Promise<CardContext | null>>();
    for (const [key, value] of preloaded || []) {
      cache.set(key, Promise.resolve(value));
    }
    return this.createCardContextLoaderWithCache(cache, clickChargeAmount);
  }

  private async preloadCardContexts(
    airportIds: number[],
    date: string,
    clickChargeAmount: number,
  ): Promise<Map<string, CardContext | null>> {
    if (
      airportIds.length === 0 ||
      !this.deps.airportRepository.getByIds ||
      !this.deps.metricsRepository.getByAirportIdsAndDate ||
      !this.deps.metricsRepository.getTrendsByAirportIds ||
      !this.deps.scoreRepository.getByAirportIdsAndDate ||
      !this.deps.scoreRepository.getTrendsByAirportIds ||
      !this.deps.scoreRepository.getPublicDisplayScoresByDate
    ) {
      return new Map();
    }

    const uniqueAirportIds = Array.from(new Set(airportIds));
    const scoreRuleVersion = await this.resolveActiveScoreRuleVersion(date);
    const trendStartDate = dateDaysAgo(date, 29);
    const yesterdayDate = dateDaysAgo(date, 1);
    const [
      airportsById,
      metricsById,
      scoresById,
      yesterdayDisplayScores,
      metricsTrendsById,
      scoreTrendsById,
      scoreVisibilityById,
    ] = await Promise.all([
      this.deps.airportRepository.getByIds(uniqueAirportIds),
      this.deps.metricsRepository.getByAirportIdsAndDate(uniqueAirportIds, date),
      this.deps.scoreRepository.getByAirportIdsAndDate(uniqueAirportIds, date),
      this.deps.scoreRepository.getPublicDisplayScoresByDate(uniqueAirportIds, yesterdayDate, scoreRuleVersion),
      this.deps.metricsRepository.getTrendsByAirportIds(uniqueAirportIds, trendStartDate, date),
      this.deps.scoreRepository.getTrendsByAirportIds(uniqueAirportIds, trendStartDate, date),
      this.getScoreVisibilityByAirportIds(uniqueAirportIds, clickChargeAmount),
    ]);

    const contexts = new Map<string, CardContext | null>();
    for (const airportId of uniqueAirportIds) {
      const airport = airportsById.get(airportId) || null;
      const metrics = metricsById.get(airportId) || null;
      const score = scoresById.get(airportId) || null;
      const scoreVisibility = scoreVisibilityById.get(airportId) || DEFAULT_SCORE_VISIBILITY;
      if (!airport || !metrics || !score || !airport.is_listed) {
        contexts.set(`${airportId}:${date}`, null);
        continue;
      }

      const scoreTrend30d = scoreTrendsById.get(airportId) || [];
      contexts.set(`${airportId}:${date}`, {
        airport,
        metrics,
        score: {
          s: effectiveComponent(score, 's'),
          p: effectiveComponent(score, 'p'),
          n: score.n != null || score.details?.score_rule_version === 'v2_spncr' ? effectiveComponent(score, 'n') : null,
          c: effectiveComponent(score, 'c'),
          r: effectiveComponent(score, 'r'),
          risk_penalty: score.risk_penalty,
          final_score: score.final_score,
          display_score: scoreVisibility.score_hidden ? null : getDisplayScore(score),
          score_hidden: scoreVisibility.score_hidden,
          score_hidden_reason: scoreVisibility.score_hidden_reason,
          yesterday_display_score: scoreVisibility.score_hidden ? null : (yesterdayDisplayScores.get(airportId) ?? null),
          details: score.details || {},
        },
        metricsTrend30d: metricsTrendsById.get(airportId) || [],
        scoreTrend30d: scoreTrend30d.map((row) => ({
          date: row.date,
          final_score: row.final_score,
          display_score: getDisplayScore(row),
        })),
      });
    }

    return contexts;
  }

  private async loadCardContext(
    airportId: number,
    date: string,
    clickChargeAmount: number = CLICK_CHARGE_AMOUNT,
  ): Promise<CardContext | null> {
    const trendStartDate = dateDaysAgo(date, 29);
    const yesterdayDate = dateDaysAgo(date, 1);
    const scoreRuleVersion = await this.resolveActiveScoreRuleVersion(date);
    const [airport, metrics, score, yesterdayDisplayScore, metricsTrend30d, scoreTrend30d, scoreVisibilityById] = await Promise.all([
      this.deps.airportRepository.getById(airportId),
      this.deps.metricsRepository.getByAirportAndDate(airportId, date),
      this.deps.scoreRepository.getByAirportAndDate(airportId, date),
      this.deps.scoreRepository.getPublicDisplayScoreByAirportAndDate(airportId, yesterdayDate, scoreRuleVersion),
      this.deps.metricsRepository.getTrend(airportId, trendStartDate, date),
      this.deps.scoreRepository.getTrend(airportId, trendStartDate, date),
      this.getScoreVisibilityByAirportIds([airportId], clickChargeAmount),
    ]);

    if (!airport || !metrics || !score) {
      return null;
    }

    if (!airport.is_listed) {
      return null;
    }

    const scoreVisibility = scoreVisibilityById.get(airportId) || DEFAULT_SCORE_VISIBILITY;

    return {
      airport,
      metrics,
      score: {
        s: effectiveComponent(score, 's'),
        p: effectiveComponent(score, 'p'),
        n: score.n != null || score.details?.score_rule_version === 'v2_spncr' ? effectiveComponent(score, 'n') : null,
        c: effectiveComponent(score, 'c'),
        r: effectiveComponent(score, 'r'),
        risk_penalty: score.risk_penalty,
        final_score: score.final_score,
        display_score: scoreVisibility.score_hidden ? null : getDisplayScore(score),
        score_hidden: scoreVisibility.score_hidden,
        score_hidden_reason: scoreVisibility.score_hidden_reason,
        yesterday_display_score: scoreVisibility.score_hidden ? null : yesterdayDisplayScore,
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
      score: context.score.score_hidden ? null : round2(context.score.display_score ?? 0),
      score_hidden: context.score.score_hidden,
      score_hidden_reason: context.score.score_hidden_reason,
      score_delta_vs_yesterday: buildScoreDeltaView(
        context.score.display_score,
        context.score.yesterday_display_score,
      ),
      stability_tier: getCardStabilityTier(context.metrics),
      details: buildCardDetails(section, context, date),
      conclusion: buildConclusion(section, context, date),
      report_url: buildAirportReportPath(resolvePublicAirportSlug(context.airport)),
    };
  }

  private buildRiskAlertHomeItems(items: RiskMonitorItem[], date: string): PublicCardItem[] {
    return items.map((item) => ({
      type: 'risk',
      airport_id: item.airport_id,
        name: item.name,
        website: item.website,
        tags: item.tags.slice(0, 3),
        score: item.score_hidden ? null : round2(item.score ?? 0),
        score_hidden: item.score_hidden,
        score_hidden_reason: item.score_hidden_reason,
        score_delta_vs_yesterday: item.score_delta_vs_yesterday,
      stability_tier: 'volatile',
      details: buildRiskMonitorCardDetails(item),
      conclusion: buildRiskMonitorConclusion(item),
      report_url: item.report_url || `/risk-monitor?date=${encodeURIComponent(date)}`,
    }));
  }
}

function collectRankingAirportIds(...rankingLists: Array<Array<Pick<RankingItem, 'airport_id'>>>): number[] {
  return Array.from(
    new Set(
      rankingLists.flatMap((items) => items.map((item) => item.airport_id)),
    ),
  );
}

function selectHomeToolDownloadCtaItems(view: ToolsDownloadPageView): HomeToolDownloadCtaItem[] {
  const byFamily = new Map<string, ToolDownloadItem>();
  for (const item of [...view.hotItems, ...view.items]) {
    const familyKey = getHomeToolDownloadFamilyKey(item);
    if (!item.icon_url || byFamily.has(familyKey)) {
      continue;
    }
    byFamily.set(familyKey, item);
  }

  return Array.from(byFamily.values())
    .sort((left, right) => {
      const priorityDelta = getHomeToolDownloadPriority(left) - getHomeToolDownloadPriority(right);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      const hotDelta = Number(right.is_hot) - Number(left.is_hot);
      if (hotDelta !== 0) {
        return hotDelta;
      }
      return left.sort_order - right.sort_order || left.name.localeCompare(right.name);
    })
    .slice(0, HOME_TOOL_DOWNLOAD_CTA_LIMIT)
    .map((item) => ({
      slug: item.slug,
      name: item.name,
      icon_url: item.icon_url,
    }));
}

function getHomeToolDownloadPriority(item: Pick<ToolDownloadItem, 'slug' | 'name'>): number {
  const value = `${item.slug} ${item.name}`.toLowerCase();
  if (value.includes('v2rayn')) return 0;
  if (value.includes('karing')) return 1;
  if (value.includes('clash') || value.includes('mihomo')) return 2;
  if (value.includes('sing-box') || value.includes('singbox')) return 3;
  return 100;
}

function getHomeToolDownloadFamilyKey(item: Pick<ToolDownloadItem, 'slug' | 'name'>): string {
  const value = `${item.slug} ${item.name}`.toLowerCase();
  if (value.includes('v2rayn')) return 'v2rayn';
  if (value.includes('karing')) return 'karing';
  if (value.includes('clash') || value.includes('mihomo')) return 'clash';
  if (value.includes('sing-box') || value.includes('singbox')) return 'sing-box';
  if (value.includes('hiddify')) return 'hiddify';
  return `slug:${item.slug}`;
}

function resolvePublicAirportSlug(airport: Pick<Airport, 'id' | 'slug' | 'name' | 'website'>): string {
  return airport.slug || buildAirportSlugCandidate({ name: airport.name, website: airport.website }) || `airport-${airport.id}`;
}

const STREAMING_LABELS: Record<string, string> = {
  netflix: 'Netflix',
  chatgpt: 'ChatGPT',
  disney_plus: 'Disney+',
  hbo_max: 'HBO Max',
  youtube_premium: 'YouTube Premium',
  tiktok: 'TikTok',
  spotify: 'Spotify',
};

const PAYMENT_LABELS: Record<string, string> = {
  wechat: '微信',
  alipay: '支付宝',
  usdt_trc20: 'USDT-TRC20',
  usdt_erc20: 'USDT-ERC20',
  usdt_bep20: 'USDT-BEP20',
  stripe_card: '银行卡',
  paypal: 'PayPal',
  crypto_other: '其他加密货币',
  unionpay: '银联',
};

const CLIENT_LABELS: Record<string, string> = {
  self_built_client: '自建客户端',
  clash: 'Clash',
  clash_verge: 'Clash Verge',
  shadowrocket: 'Shadowrocket',
  quantumult_x: 'Quantumult X',
  stash: 'Stash',
  surge: 'Surge',
  sing_box: 'sing-box',
  v2rayn: 'v2rayN',
  v2rayng: 'v2rayNG',
  nekobox: 'NekoBox',
  surfboard: 'Surfboard',
  xiaohuojian: '小火箭',
  openclash: 'OpenClash',
};

const IMPORT_METHOD_LABELS: Record<string, string> = {
  one_click_import: '一键导入',
  subscription_link: '订阅链接',
  universal_subscription: '通用订阅',
  qr_code_import: '二维码导入',
  tutorials: '教程支持',
};

const LINE_TYPE_LABELS: Record<string, string> = {
  iepl: 'IEPL',
  iplc: 'IPLC',
  cn2: 'CN2',
  bgp: 'BGP',
  relay: '中转',
};

function buildReportCapabilities(airport: Airport, nodeSnapshot: SubscriptionNodeSnapshot | null = null): ReportCapabilities {
  const profile = airport.profile;
  const plan = profile?.plan;
  const telegram = profile?.telegram;
  const regionNodeCounts = buildRegionNodeCounts(nodeSnapshot);
  return {
    plan: {
      supports_monthly: plan?.supports_monthly ?? null,
      supports_quarterly: plan?.supports_quarterly ?? null,
      supports_half_yearly: plan?.supports_half_yearly ?? null,
      supports_annual: plan?.supports_annual ?? airport.has_annual_plan ?? null,
      lowest_monthly_price: plan?.lowest_monthly_price ?? airport.plan_price_month ?? null,
      lowest_annual_monthly_price: plan?.lowest_annual_monthly_price ?? null,
      has_trial_plan: plan?.has_trial_plan ?? airport.has_trial ?? null,
      has_lifetime_plan: plan?.has_lifetime_plan ?? airport.has_lifetime_plan ?? null,
    },
    streaming: toCapabilityItems(airport.streaming_support || [], STREAMING_LABELS),
    payment_methods: toCapabilityItems(airport.payment_methods || [], PAYMENT_LABELS),
    telegram: {
      items: buildTelegramCapabilityItems(airport),
      has_group: telegram?.has_group ?? airport.has_telegram_group ?? null,
      group_url: telegram?.group_url ?? null,
      has_channel: telegram?.has_channel ?? null,
      channel_url: telegram?.channel_url ?? null,
      group_allows_speaking: telegram?.group_allows_speaking ?? airport.telegram_allows_speaking ?? null,
      group_member_count: telegram?.group_member_count ?? null,
      recent_active_at: telegram?.recent_active_at ?? null,
      has_customer_service_bot: telegram?.has_customer_service_bot ?? null,
      has_ticket_system: telegram?.has_ticket_system ?? null,
    },
    clients: toCapabilityItemsFromBooleanMap(profile?.clients, CLIENT_LABELS),
    import_methods: toCapabilityItemsFromBooleanMap(profile?.import_methods, IMPORT_METHOD_LABELS),
    regions: buildRegionCapabilities(profile?.regions, regionNodeCounts),
  };
}

function toCapabilityItems(values: string[], labels: Record<string, string>): ReportCapabilities['streaming'] {
  return values
    .filter((value) => Boolean(labels[value]))
    .map((value) => ({ key: value, label: labels[value] }));
}

function toCapabilityItemsFromBooleanMap(
  values: object | undefined,
  labels: Record<string, string>,
): ReportCapabilities['streaming'] {
  if (!values) {
    return [];
  }
  const source = values as Record<string, boolean | null | undefined>;
  return Object.entries(labels)
    .filter(([key]) => source[key] === true)
    .map(([key, label]) => ({ key, label }));
}

function buildTelegramCapabilityItems(airport: Airport): ReportCapabilities['telegram']['items'] {
  const telegram = airport.profile?.telegram;
  const items: ReportCapabilities['telegram']['items'] = [];
  if (telegram?.has_group === true || airport.has_telegram_group === true) {
    items.push({ key: 'group', label: 'Telegram 群组' });
  }
  if (telegram?.has_channel === true) {
    items.push({ key: 'channel', label: 'Telegram 频道' });
  }
  if (telegram?.has_customer_service_bot === true) {
    items.push({ key: 'customer_service_bot', label: '客服机器人' });
  }
  if (telegram?.has_ticket_system === true) {
    items.push({ key: 'ticket_system', label: '工单系统' });
  }
  if (telegram?.group_allows_speaking === true || airport.telegram_allows_speaking === true) {
    items.push({ key: 'group_allows_speaking', label: '群内可发言' });
  }
  return items;
}

function buildRegionCapabilities(
  values: Record<string, { line_types?: string[]; has_residential?: boolean | null; has_native_ip?: boolean | null }> | undefined,
  nodeCounts: Record<string, number> = {},
): ReportCapabilities['regions'] {
  const source = values || {};
  return REPORT_NODE_REGION_DEFINITIONS
    .map((definition) => {
      const key = definition.reportKey;
      const region = source[key as keyof typeof source];
      const nodeCount = nodeCounts[key] || 0;
      if (nodeCount <= 0) {
        return null;
      }
      const lineTypes = Array.isArray(region?.line_types)
        ? region.line_types.map((type) => LINE_TYPE_LABELS[type] || type)
        : [];
      return {
        key,
        label: definition.name,
        node_count: nodeCount,
        line_types: lineTypes,
        has_residential: region?.has_residential ?? null,
        has_native_ip: region?.has_native_ip ?? null,
      };
    })
    .filter((item): item is ReportCapabilities['regions'][number] => item !== null);
}

function buildRegionNodeCounts(snapshot: SubscriptionNodeSnapshot | null): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of snapshot?.nodes || []) {
    if (isInformationalNodeName(node.name)) {
      continue;
    }
    const definition = findNodeRegionDefinition(`${node.region || ''} ${node.name}`);
    if (definition) {
      counts[definition.reportKey] = (counts[definition.reportKey] || 0) + 1;
    }
  }
  return counts;
}

function mergeHomeSectionItems(limit: number, ...groups: PublicCardItem[][]): PublicCardItem[] {
  const safeLimit = Math.max(0, Math.floor(limit));
  const seenAirportIds = new Set<number>();
  const items: PublicCardItem[] = [];

  for (const group of groups) {
    for (const item of group) {
      if (seenAirportIds.has(item.airport_id)) {
        continue;
      }
      seenAirportIds.add(item.airport_id);
      items.push(item);
      if (items.length >= safeLimit) {
        return items;
      }
    }
  }

  return items;
}

function comparePublicCardVisibility(left: PublicCardItem, right: PublicCardItem): number {
  return Number(left.score_hidden) - Number(right.score_hidden);
}

function normalizeHomeSectionLimits(value: Partial<HomeSectionLimits> | undefined): HomeSectionLimits {
  const limits = { ...DEFAULT_HOME_SECTION_LIMITS };
  if (!value) {
    return limits;
  }

  for (const key of Object.keys(limits) as Array<keyof HomeSectionLimits>) {
    const next = Number(value[key]);
    if (Number.isInteger(next) && next >= 1 && next <= 12) {
      limits[key] = next;
    }
  }

  return limits;
}

function compareByDisplayScoreDesc(left: CardContext, right: CardContext): number {
  return (
    Number(left.score.score_hidden) - Number(right.score.score_hidden) ||
    getSortableDisplayScore(right) - getSortableDisplayScore(left)
  );
}

function compareByStabilityDesc(left: CardContext, right: CardContext): number {
  return (
    Number(right.metrics.stable_days_streak || 0) - Number(left.metrics.stable_days_streak || 0) ||
    Number(right.metrics.uptime_percent_30d || 0) - Number(left.metrics.uptime_percent_30d || 0) ||
    compareByDisplayScoreDesc(left, right)
  );
}

function compareByValueDesc(left: CardContext, right: CardContext): number {
  const leftValueScore = getSortableDisplayScore(left) / Math.max(left.airport.plan_price_month || 1, 1);
  const rightValueScore = getSortableDisplayScore(right) / Math.max(right.airport.plan_price_month || 1, 1);
  return rightValueScore - leftValueScore || compareByDisplayScoreDesc(left, right);
}

function getSortableDisplayScore(context: CardContext): number {
  return context.score.display_score ?? Number.NEGATIVE_INFINITY;
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

function isVisibleNewEntryContext(context: CardContext): boolean {
  return context.airport.status !== 'down' && !context.score.score_hidden;
}

function compareByNewAirportEntryDesc(left: CardContext, right: CardContext): number {
  return right.airport.created_at.localeCompare(left.airport.created_at) || right.airport.id - left.airport.id;
}

function buildCardDetails(
  section: HomeSectionKey,
  context: CardContext,
  date: string,
): [PublicCardItem['details'][0], PublicCardItem['details'][1]] {
  const streakDays = Math.max(0, Number(context.metrics.stable_days_streak || 0));
  const trackingDays = Math.max(1, diffDays(context.airport.created_at, date) + 1);
  const primaryRiskReason = getPrimaryRiskReason(context.metrics);
  const complaintTrendLabel = getComplaintTrendLabel(context.metrics.recent_complaints_count);
  const trendLabel = getTrendLabel(context.scoreTrend30d);

  switch (section) {
    case 'today_pick':
      return [
        { label: '运行天数', value: `${trackingDays} 天` },
        getTodayPickPositiveDetail(context),
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

  switch (section) {
    case 'today_pick':
      return buildTodayPickHighlight(context, healthyStreakDays);
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
    return '官网探测异常';
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

function getTodayPickPositiveDetail(
  context: CardContext,
): PublicCardItem['details'][1] {
  const preferredTag = getPreferredHighlightTag(context.airport.tags);
  if (preferredTag) {
    return {
      label: '核心亮点',
      value: preferredTag,
    };
  }

  return {
    label: '核心优势',
    value: getStrongestScoreDimensionLabel(getStrongestScoreDimension(context.score)),
  };
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

function getStrongestScoreDimensionLabel(dimension: ReturnType<typeof getStrongestScoreDimension>): string {
  switch (dimension) {
    case 's':
      return '稳定性突出';
    case 'p':
      return '性能突出';
    case 'c':
      return '成本效率突出';
    case 'r':
      return '风险侧更干净';
  }
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

function resolveScoreRuleVersion(details: Record<string, ScoreDetailValue>): 'v1_spcr' | 'v2_spncr' {
  return details.score_rule_version === 'v2_spncr' ? 'v2_spncr' : 'v1_spcr';
}

function buildNetworkCoverageSummary(run: NetworkCoverageRun): NonNullable<ReportView['network_coverage']> {
  return {
    sampled_date: run.sampled_date,
    rule_version: run.rule_version,
    detected_nodes_count: run.detected_nodes_count,
    healthy_nodes_count: run.healthy_nodes_count,
    unsupported_nodes_count: run.unsupported_nodes_count,
    unknown_healthy_nodes_count: run.unknown_healthy_nodes_count,
    healthy_node_rate: round2(run.healthy_node_rate),
    core_regions: run.core_regions,
    extended_regions: run.extended_regions,
    max_region_code: run.max_region_code,
    max_region_share: round2(run.max_region_share),
    node_count_score: round2(run.node_count_score),
    region_score: round2(run.region_score),
    health_rate_score: round2(run.health_rate_score),
    balance_score: round2(run.balance_score),
  };
}

function getPenaltyValue(details: Record<string, ScoreDetailValue>, key: string): number {
  const value = details[key];
  return typeof value === 'number' && Number.isFinite(value) ? round2(value) : 0;
}

function buildPublicFallbackNotice(
  requestedDate: string,
  resolvedDate: string,
  scoreRuleVersion?: 'v1_spcr' | 'v2_spncr',
): string {
  const ruleLabel = scoreRuleVersion ? `，规则版本 ${scoreRuleVersion}` : '';
  return `${requestedDate} 的公开分数尚未生成，当前展示 ${resolvedDate} 的最新已生成快照${ruleLabel}，非实时探测结果。`;
}

function toHomeNewsUpdate(item: NewsArticleListItem): HomeNewsUpdateView {
  return {
    id: item.id,
    title: item.title,
    slug: item.slug,
    href: `/news/${encodeURIComponent(item.slug)}`,
    published_at: item.published_at,
  };
}

function getDisplayScore(score: { final_score: number; details?: Record<string, unknown> }): number {
  const manualTotalScore = score.details?.manual_total_score == null ? NaN : Number(score.details.manual_total_score);
  if (Number.isFinite(manualTotalScore)) {
    return manualTotalScore;
  }
  const totalScore = score.details?.total_score == null ? NaN : Number(score.details.total_score);
  return Number.isFinite(totalScore) ? totalScore : score.final_score;
}

function buildScoreDeltaView(currentScore: number | null, yesterdayScore: number | null): ScoreDeltaView {
  return {
    label: '对比昨天',
    value: currentScore === null || yesterdayScore === null ? null : round2(currentScore - yesterdayScore),
  };
}

function toTodayPickRankedAirportInput(context: CardContext): RankedAirportInput {
  return {
    airport: context.airport,
    metrics: context.metrics,
    score: {
      s: context.score.s,
      p: context.score.p,
      n: context.score.n,
      c: context.score.c,
      r: context.score.r,
      risk_penalty: context.score.risk_penalty,
      score: context.score.final_score,
      recent_score: context.score.final_score,
      historical_score: context.score.final_score,
      final_score: context.score.final_score,
      details: {
        ...context.score.details,
        total_score: context.score.display_score,
      },
    },
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
