import { Router } from 'express';
import { STABILITY_RULES } from '../config/scoring';
import { HttpError } from '../middleware/errorHandler';
import { calcPriceScore, computeFinalEngineScore } from '../services/scoringEngine';
import {
  DEFAULT_TELEGRAM_API_BASE,
  DEFAULT_TELEGRAM_NOTIFY_TIMEOUT_MS,
  DEFAULT_WEBHOOK_NOTIFY_TIMEOUT_MS,
  type NotificationDeliveryMode,
  type TelegramNotificationSettingsInput,
  TelegramSendError,
} from '../services/telegramNotificationService';
import {
  DEFAULT_MEDIA_LIBRARY_TIMEOUT_MS,
  type MediaLibrarySettingsInput,
} from '../services/mediaLibrarySettingsService';
import type {
  HomeSectionLimits,
  MarketingSettingsInput,
  RankClickChargeAmounts,
} from '../services/marketingSettingsService';
import { SmtpSendError } from '../services/mailService';
import type { PaymentGatewaySettingsInput } from '../services/paymentGatewaySettingsService';
import type { SmtpSettingsInput, SmtpTemplateKey } from '../services/smtpSettingsService';
import { buildMonthlyMarkdownReport } from '../services/monthlyMarkdownReportService';
import {
  DEFAULT_USER_TELEGRAM_API_BASE,
  type UserTelegramBotTemplateKey,
  type UserTelegramBotSettingsInput,
} from '../services/userTelegramBotSettingsService';
import type { XOAuthSettingsInput } from '../services/xOAuthSettingsService';
import type { SchedulerDailyStat } from '../repositories/schedulerRunRepository';
import { PerformanceProbeSettingsConflictError } from '../repositories/performanceProbeSettingRepository';
import type {
  RechargeOrderView,
  WalletTransactionType,
  WalletTransactionView,
} from '../repositories/applicantBillingRepository';
import type { AirportListSortBy, AirportListSortOrder } from '../repositories/airportRepository';
import type { AccessTokenScope } from '../utils/accessToken';
import type { SubscriptionNodeCaptureResult } from '../services/subscriptionNodeCaptureService';
import { createRandomPassword, hashPassword } from '../utils/password';
import type {
  AirportApplicationReviewStatus,
  AirportApplicationPaymentStatus,
  AirportProfile,
  AirportPaymentMethod,
  AirportStatus,
  AirportStreamingSupport,
  ManualJobKind,
  MarketingAirportConversionItem,
  MarketingGranularity,
  PerformanceNodePreference,
  PerformanceNodePreferenceInput,
  PerformanceNodePreferenceNode,
  AirportPerformanceProbeSettingsInput,
  AirportPerformanceProbeSettingsView,
  PerformanceProbe,
  PerformanceProbeId,
  PerformanceRun,
  PerformanceRunTarget,
  PerformanceRunNode,
  DailyMetricsInput,
  PerformanceRunInput,
  ProbeSampleInput,
  ProbeSampleType,
  ProbeScope,
  SchedulerRunStatus,
  SchedulerTaskKey,
  StabilityTier,
  ReportView,
  SubscriptionNodeSnapshot,
  SubscriptionNodeSnapshotInput,
  SubscriptionNodeSnapshotNode,
  SubscriptionNodeSnapshotUnsupportedNode,
} from '../types/domain';
import { parseAirportProfilePayload } from '../utils/airportProfile';
import {
  computeEffectiveLatencyStats,
  getStabilityTier,
  computeLatencyStats,
  computeSScore,
  computeStabilityScore,
  computeStreakScore,
  computeUptimeScore,
  isStableDay,
} from '../utils/stability';
import { buildPortalLoginUrl, getSiteOrigin } from '../utils/siteUrl';
import { buildPerformanceNodeKey, buildPerformanceNodeMatchIdentity } from '../utils/performanceNodeKey';
import { formatSqlDateTimeInTimezone, getDateInTimezone } from '../utils/time';
import {
  AIRPORT_HOME_AD_SLOTS,
  type AdminAirportAdPlacementFilter,
  type AdminAirportAdStatsListView,
  type AdminAirportAdStatsView,
  type AdminAirportAdStatusFilter,
  type AirportHomeAdSlotPrices,
} from '../../../shared/airportAds';

interface AdminDeps {
  airportRepository: {
    listByQuery(query: {
      keyword?: string;
      status?: AirportStatus;
      isListed?: boolean;
      page?: number;
      pageSize?: number;
      sortBy?: AirportListSortBy;
      sortOrder?: AirportListSortOrder;
      scoreDate?: string | null;
    }): Promise<{ items: unknown[]; total: number }>;
    getById(id: number): Promise<unknown | null>;
    create(input: {
      slug?: string | null;
      name: string;
      website: string;
      websites?: string[];
      status?: AirportStatus;
      is_listed?: boolean;
      plan_price_month: number;
      has_trial: boolean;
      streaming_support?: AirportStreamingSupport[];
      payment_methods?: AirportPaymentMethod[];
      payment_crypto_other?: string | null;
      has_annual_plan?: boolean | null;
      has_telegram_group?: boolean | null;
      telegram_allows_speaking?: boolean | null;
      has_lifetime_plan?: boolean | null;
      profile?: AirportProfile;
      subscription_url?: string | null;
      applicant_email?: string | null;
      applicant_telegram?: string | null;
      founded_on?: string | null;
      airport_intro?: string | null;
      test_account?: string | null;
      test_password?: string | null;
      manual_tags?: string[];
      tags?: string[];
    }): Promise<number>;
    update(
      id: number,
      input: {
        slug?: string | null;
        name?: string;
        website?: string;
        websites?: string[];
        status?: AirportStatus;
        is_listed?: boolean;
        plan_price_month?: number;
        has_trial?: boolean;
        streaming_support?: AirportStreamingSupport[];
        payment_methods?: AirportPaymentMethod[];
        payment_crypto_other?: string | null;
        has_annual_plan?: boolean | null;
        has_telegram_group?: boolean | null;
        telegram_allows_speaking?: boolean | null;
        has_lifetime_plan?: boolean | null;
        profile?: AirportProfile;
        subscription_url?: string | null;
        subscription_url_updated_source?: 'admin' | 'portal' | null;
        applicant_email?: string | null;
        applicant_telegram?: string | null;
        founded_on?: string | null;
        airport_intro?: string | null;
        test_account?: string | null;
        test_password?: string | null;
        manual_tags?: string[];
        tags?: string[];
      },
    ): Promise<boolean>;
  };
  airportApplicationRepository: {
    listByQuery(query: {
      keyword?: string;
      paymentStatus?: AirportApplicationPaymentStatus;
      reviewStatus?: AirportApplicationReviewStatus;
      page?: number;
      pageSize?: number;
    }): Promise<{ items: unknown[]; total: number }>;
    getById(id: number): Promise<unknown | null>;
    review(
      id: number,
      input: {
        review_status: Exclude<AirportApplicationReviewStatus, 'pending' | 'awaiting_payment'>;
        review_note?: string | null;
        approved_airport_id?: number | null;
        reviewed_by: string;
        reviewed_at: string;
      },
    ): Promise<boolean>;
    updateAdminNote?(id: number, adminNote: string | null): Promise<boolean>;
    createEmailReply?(input: {
      application_id: number;
      to_email: string;
      reply_body: string;
      sent_by: string;
      sent_at: string;
    }): Promise<number>;
    markPaid?(id: number, paymentAmount: number, paidAt: string): Promise<boolean>;
    deleteUnpaid(id: number): Promise<boolean>;
    updateSubscriptionUrlByApprovedAirportId?(
      approvedAirportId: number,
      subscriptionUrl: string | null,
      source: 'admin' | 'portal',
    ): Promise<number>;
  };
  applicationPaymentOrderRepository?: {
    getLatestByApplicationId(applicationId: number): Promise<{
      id: number;
      amount: number;
      status: 'created' | 'paid' | 'failed' | 'expired';
    } | null>;
    expireOpenOrdersByApplicationId(applicationId: number): Promise<number>;
  };
  applicantBillingRepository?: {
    linkAirportByApplicationId(applicationId: number, airportId: number): Promise<void>;
    listWalletsByAirportIds?(airportIds: number[]): Promise<Map<number, { id: number; balance: number }>>;
    listRechargeOrdersByAirportId?(
      airportId: number,
      page?: number,
      pageSize?: number,
    ): Promise<{ items: RechargeOrderView[]; total: number }>;
    listWalletTransactionsByAirportId?(
      airportId: number,
      page?: number,
      pageSize?: number,
      transactionType?: WalletTransactionType,
    ): Promise<{ items: WalletTransactionView[]; total: number }>;
    addWalletBalanceAdjustment?(input: {
      airport_id: number;
      amount: number;
      description: string;
      reference_id: string;
    }): Promise<unknown | null>;
    clearAutoUnlistedByAirportId?(airportId: number): Promise<number>;
  };
  applicantAccountRepository?: {
    getByAirportId?(airportId: number): Promise<{
      id: number;
      application_id: number;
      email: string;
      password_hash: string;
      must_change_password: boolean;
    } | null>;
    updatePassword?(id: number, passwordHash: string, mustChangePassword: boolean): Promise<boolean>;
  };
  airportAdCampaignRepository?: {
    listAdminStats(input: {
      page: number;
      keyword?: string;
      status: AdminAirportAdStatusFilter;
      placement: AdminAirportAdPlacementFilter;
    }): Promise<AdminAirportAdStatsListView>;
    getAdminStats(input: { campaign_id: number; page: number }): Promise<AdminAirportAdStatsView>;
  };
  probeSampleRepository: {
    insertProbeSample(input: ProbeSampleInput): Promise<number>;
    insertPacketLossSample(input: ProbeSampleInput): Promise<number>;
    listProbeSamples(
      airportId: number,
      date: string,
      sampleType?: ProbeSampleType,
      limit?: number,
      probeScope?: ProbeScope,
    ): Promise<unknown[]>;
    listLatestProbeSamples(
      airportId: number,
      limit: number,
      sampleType?: ProbeSampleType,
      probeScope?: ProbeScope,
    ): Promise<unknown[]>;
  };
  performanceRunRepository: {
    insert(input: PerformanceRunInput): Promise<number>;
    getLatestByAirportAndDate(airportId: number, date: string): Promise<unknown | null>;
    getLatestByAirportBeforeDate(airportId: number, date: string): Promise<unknown | null>;
    getLatestByAirportProbeBeforeDate?(
      airportId: number,
      probeId: PerformanceProbeId,
      date: string,
    ): Promise<PerformanceRun | null>;
    listByAirportAndDate?(airportId: number, date: string): Promise<PerformanceRun[]>;
  };
  performanceProbeRepository?: {
    list(): Promise<PerformanceProbe[]>;
  };
  performanceProbeSettingRepository?: {
    getByAirport(airportId: number): Promise<AirportPerformanceProbeSettingsView>;
    saveAll(input: AirportPerformanceProbeSettingsInput): Promise<AirportPerformanceProbeSettingsView>;
  };
  performanceRunTargetRepository?: {
    listByRun(runId: number): Promise<PerformanceRunTarget[]>;
    insertMany(targets: PerformanceRunTarget[]): Promise<void>;
  };
  subscriptionNodeSnapshotRepository?: {
    insert(input: SubscriptionNodeSnapshotInput): Promise<number>;
    getLatestByAirport(airportId: number): Promise<SubscriptionNodeSnapshot | null>;
  };
  subscriptionNodeCaptureService?: {
    capture(airportId: number, actor: string): Promise<SubscriptionNodeCaptureResult>;
  };
  performanceNodePreferenceRepository?: {
    getByAirport(airportId: number): Promise<PerformanceNodePreference | null>;
    save(input: PerformanceNodePreferenceInput): Promise<void>;
    clear(airportId: number): Promise<boolean>;
  };
  metricsRepository: {
    upsertDaily(input: DailyMetricsInput): Promise<void>;
    getByAirportAndDate(airportId: number, date: string): Promise<unknown | null>;
    patchComplaintCount(
      airportId: number,
      date: string,
      count: number,
      mode: 'set' | 'increment',
    ): Promise<void>;
    patchIncidentCount(
      airportId: number,
      date: string,
      count: number,
      mode: 'set' | 'increment',
    ): Promise<void>;
  };
  scoreRepository: {
    getByAirportAndDate(airportId: number, date: string): Promise<unknown | null>;
    getTrend(airportId: number, startDate: string, endDate: string): Promise<unknown[]>;
    updateManualTotalScore?(airportId: number, date: string, totalScore: number | null): Promise<boolean>;
    getLatestAvailableDate?(onOrBefore: string): Promise<string | null>;
    getPublicDisplayScoresByDate?(airportIds: number[], date: string): Promise<Map<number, number>>;
  };
  recomputeService: {
    recomputeForDate(date: string): Promise<{ recomputed: number }>;
    recomputeAirportForDate(date: string, airportId: number): Promise<{ recomputed: number }>;
  };
  aggregationService: {
    aggregateForDate(date: string): Promise<{ aggregated: number }>;
    aggregateAirportForDate(airportId: number, date: string): Promise<{ aggregated: number }>;
  };
  manualJobService: {
    createJob(input: {
      airportId: number;
      date: string;
      kind: ManualJobKind;
      createdBy: string;
      requestId: string;
    }): Promise<unknown>;
    getJob(jobId: number): Promise<unknown | null>;
  };
  auditRepository: {
    log(action: string, actor: string, requestId: string, payload: unknown): Promise<void>;
  };
  publicViewService: {
    getHomePageView(date: string): Promise<unknown>;
    getReportView(airportId: number, date: string): Promise<ReportView | null>;
  };
  publicPageCache?: {
    clear(): void;
  };
  telegramNotificationService?: {
    getAdminSettings(): Promise<unknown>;
    updateAdminSettings(input: TelegramNotificationSettingsInput, updatedBy: string): Promise<unknown>;
    sendTestMessage(input: TelegramNotificationSettingsInput): Promise<void>;
  };
  userTelegramBotSettingsService?: {
    getAdminSettings(): Promise<unknown>;
    updateAdminSettings(input: UserTelegramBotSettingsInput, updatedBy: string): Promise<unknown>;
    syncWebhook(updatedBy?: string): Promise<unknown>;
  };
  mediaLibrarySettingsService?: {
    getAdminSettings(): Promise<unknown>;
    updateAdminSettings(input: MediaLibrarySettingsInput, updatedBy: string): Promise<unknown>;
  };
  paymentGatewaySettingsService?: {
    getAdminSettings(): Promise<unknown>;
    updateAdminSettings(input: PaymentGatewaySettingsInput, updatedBy: string): Promise<unknown>;
    getConfig?(): Promise<unknown>;
  };
  marketingSettingsService?: {
    getAdminSettings(): Promise<unknown>;
    updateAdminSettings(input: MarketingSettingsInput, updatedBy: string): Promise<unknown>;
    getConfig(): Promise<{
      application_fee_amount: number;
      click_charge_amount: number;
      airport_ad_monthly_price?: number;
      home_ad_slot_monthly_prices?: AirportHomeAdSlotPrices;
      recharge_amounts?: number[];
      admin_telegram_username?: string | null;
      home_section_limits?: HomeSectionLimits;
    }>;
  };
  smtpSettingsService?: {
    getAdminSettings(): Promise<unknown>;
    updateAdminSettings(input: SmtpSettingsInput, updatedBy: string): Promise<unknown>;
    updateTemplateEnabled?(templateKey: SmtpTemplateKey, enabled: boolean, updatedBy: string): Promise<unknown>;
  };
  xOAuthSettingsService?: {
    getAdminSettings(): Promise<unknown>;
    updateAdminSettings(input: XOAuthSettingsInput, updatedBy: string): Promise<unknown>;
  };
  mailService?: {
    sendTestMail(input: SmtpSettingsInput & { test_to: string }): Promise<void>;
    sendApplicationApprovedEmail(input: { to: string; airportName: string }): Promise<void>;
    sendApplicantPasswordResetEmail?(input: {
      to: string;
      airportName: string;
      portalEmail: string;
      newPassword: string;
      portalLoginUrl: string;
    }): Promise<void>;
    sendApplicationReplyEmail?(input: {
      to: string;
      airportName: string;
      replyBody: string;
      adminTelegramUsername: string;
      adminTelegramUrl: string;
      portalLoginUrl: string;
    }): Promise<void>;
    sendLowBalanceWarningEmail?(input: { to: string; airportName: string; balance: number; thresholdAmount: number }): Promise<void>;
    sendAirportAutoUnlistedEmail?(input: { to: string; airportName: string; balance: number; thresholdAmount: number }): Promise<void>;
    sendAirportOnlineEmail?(input: { to: string; airportName: string; balance: number; thresholdAmount: number }): Promise<void>;
  };
  accessTokenService?: {
    listAdminTokens(): Promise<unknown>;
    createAdminToken(input: {
      name: string;
      description?: string;
      scopes: AccessTokenScope[];
      expires_at?: string | null;
    }, createdBy: string): Promise<unknown>;
    revokeAdminToken(id: number): Promise<unknown>;
  };
  schedulerService?: {
    listTasks(): Promise<unknown[]>;
    updateTask(
      taskKey: SchedulerTaskKey,
      patch: {
        enabled?: boolean;
        schedule_time?: string;
        updated_by: string;
      },
    ): Promise<unknown>;
    restartTask(taskKey: SchedulerTaskKey, actor: string): Promise<unknown>;
    listRuns(query: {
      taskKey?: SchedulerTaskKey;
      status?: SchedulerRunStatus;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    }): Promise<{ items: unknown[]; total: number; page: number; page_size: number }>;
    getDailyStats(query: {
      taskKey?: SchedulerTaskKey;
      dateFrom?: string;
      dateTo?: string;
    }): Promise<{ date_from: string; date_to: string; items: SchedulerDailyStat[] }>;
  };
  marketingRepository?: {
    getOverview(query: {
      dateFrom: string;
      dateTo: string;
      granularity: MarketingGranularity;
      sourceLabel?: string;
      countryCode?: string;
    }): Promise<unknown>;
    getPageStats(query: {
      dateFrom: string;
      dateTo: string;
      sourceLabel?: string;
      countryCode?: string;
    }): Promise<unknown[]>;
    getAirportStats(query: {
      dateFrom: string;
      dateTo: string;
      keyword?: string;
      sortBy?: 'ctr' | 'clicks' | 'impressions' | 'last_clicked_at';
      sortOrder?: 'asc' | 'desc';
      sourceLabel?: string;
      countryCode?: string;
    }): Promise<MarketingAirportConversionItem[]>;
    getAirportDetail(query: {
      airportId: number;
      dateFrom: string;
      dateTo: string;
      granularity: MarketingGranularity;
      sourceLabel?: string;
      countryCode?: string;
    }): Promise<unknown | null>;
  };
}

export function createAdminRoutes(deps: AdminDeps): Router {
  const router = Router();

  router.get('/scheduler/tasks', async (_req, res, next) => {
    try {
      res.json({ items: await getSchedulerService(deps).listTasks() });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/scheduler/tasks/:taskKey', async (req, res, next) => {
    try {
      const taskKey = toSchedulerTaskKey(req.params.taskKey);
      const payload = (req.body ?? {}) as Record<string, unknown>;
      const patch: {
        enabled?: boolean;
        schedule_time?: string;
        updated_by: string;
      } = {
        updated_by: actorFromReq(req),
      };

      if (payload.enabled !== undefined) {
        patch.enabled = Boolean(payload.enabled);
      }
      if (payload.schedule_time !== undefined) {
        patch.schedule_time = parseScheduleTime(payload.schedule_time);
      }
      if (patch.enabled === undefined && patch.schedule_time === undefined) {
        throw new HttpError(400, 'BAD_REQUEST', 'enabled 或 schedule_time 至少传一个');
      }

      const task = await getSchedulerService(deps).updateTask(taskKey, patch);
      await deps.auditRepository.log('update_scheduler_task', actorFromReq(req), req.requestId, {
        task_key: taskKey,
        patch,
      });
      res.json(task);
    } catch (error) {
      next(error);
    }
  });

  router.post('/scheduler/tasks/:taskKey/restart', async (req, res, next) => {
    try {
      const taskKey = toSchedulerTaskKey(req.params.taskKey);
      const task = await getSchedulerService(deps).restartTask(taskKey, actorFromReq(req));
      await deps.auditRepository.log('restart_scheduler_task', actorFromReq(req), req.requestId, {
        task_key: taskKey,
      });
      res.json(task);
    } catch (error) {
      next(error);
    }
  });

  router.get('/scheduler/runs', async (req, res, next) => {
    try {
      const taskKey = req.query.task_key ? toSchedulerTaskKey(req.query.task_key) : undefined;
      const status = req.query.status ? toSchedulerRunStatus(req.query.status) : undefined;
      const dateFrom = req.query.date_from === undefined ? undefined : parseDate(req.query.date_from);
      const dateTo = req.query.date_to === undefined ? undefined : parseDate(req.query.date_to);
      const page = toPositiveInt(req.query.page, 1);
      const pageSize = toBoundedPositiveInt(req.query.page_size, 20, 100);
      res.json(await getSchedulerService(deps).listRuns({
        taskKey,
        status,
        dateFrom,
        dateTo,
        page,
        pageSize,
      }));
    } catch (error) {
      next(error);
    }
  });

  router.get('/scheduler/daily-stats', async (req, res, next) => {
    try {
      const taskKey = req.query.task_key ? toSchedulerTaskKey(req.query.task_key) : undefined;
      const dateFrom = req.query.date_from === undefined ? undefined : parseDate(req.query.date_from);
      const dateTo = req.query.date_to === undefined ? undefined : parseDate(req.query.date_to);
      res.json(await getSchedulerService(deps).getDailyStats({
        taskKey,
        dateFrom,
        dateTo,
      }));
    } catch (error) {
      next(error);
    }
  });

  router.get('/marketing/overview', async (req, res, next) => {
    try {
      const range = parseMarketingDateRange(req.query.date_from, req.query.date_to);
      const granularity = parseMarketingGranularity(req.query.granularity);
      const sourceLabel = parseMarketingSourceLabel(req.query.source_label);
      const countryCode = parseMarketingCountryCode(req.query.country_code);
      res.json(await getMarketingRepository(deps).getOverview({
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        granularity,
        sourceLabel,
        countryCode,
      }));
    } catch (error) {
      next(error);
    }
  });

  router.get('/marketing/pages', async (req, res, next) => {
    try {
      const range = parseMarketingDateRange(req.query.date_from, req.query.date_to);
      const sourceLabel = parseMarketingSourceLabel(req.query.source_label);
      const countryCode = parseMarketingCountryCode(req.query.country_code);
      res.json({
        date_from: range.dateFrom,
        date_to: range.dateTo,
        items: await getMarketingRepository(deps).getPageStats({
          dateFrom: range.dateFrom,
          dateTo: range.dateTo,
          sourceLabel,
          countryCode,
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/marketing/airports', async (req, res, next) => {
    try {
      const range = parseMarketingDateRange(req.query.date_from, req.query.date_to);
      const keyword = optionalString(req.query.keyword);
      const sortBy = parseMarketingAirportSortBy(req.query.sort_by);
      const sortOrder = parseSortOrder(req.query.sort_order);
      const sourceLabel = parseMarketingSourceLabel(req.query.source_label);
      const countryCode = parseMarketingCountryCode(req.query.country_code);
      res.json({
        date_from: range.dateFrom,
        date_to: range.dateTo,
        sort_by: sortBy,
        sort_order: sortOrder,
        keyword: keyword || '',
        items: await getMarketingRepository(deps).getAirportStats({
          dateFrom: range.dateFrom,
          dateTo: range.dateTo,
          keyword,
          sortBy,
          sortOrder,
          sourceLabel,
          countryCode,
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/marketing/airports/:id', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const range = parseMarketingDateRange(req.query.date_from, req.query.date_to);
      const granularity = parseMarketingGranularity(req.query.granularity);
      const sourceLabel = parseMarketingSourceLabel(req.query.source_label);
      const countryCode = parseMarketingCountryCode(req.query.country_code);
      const detail = await getMarketingRepository(deps).getAirportDetail({
        airportId,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        granularity,
        sourceLabel,
        countryCode,
      });
      if (!detail) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }
      res.json(detail);
    } catch (error) {
      next(error);
    }
  });

  router.get('/marketing/ad-campaigns', async (req, res, next) => {
    try {
      const page = req.query.page === undefined ? 1 : toPositiveIntOrThrow(req.query.page, 'page');
      const keyword = optionalString(req.query.q) || undefined;
      const status = parseAdminAirportAdStatus(req.query.status);
      const placement = parseAdminAirportAdPlacement(req.query.placement);
      res.json(await getAirportAdCampaignRepository(deps).listAdminStats({
        page,
        keyword,
        status,
        placement,
      }));
    } catch (error) {
      next(error);
    }
  });

  router.get('/marketing/ad-campaigns/:campaignId/stats', async (req, res, next) => {
    try {
      const campaignId = toPositiveIntOrThrow(req.params.campaignId, 'campaignId');
      const page = req.query.page === undefined ? 1 : toPositiveIntOrThrow(req.query.page, 'page');
      res.json(await getAirportAdCampaignRepository(deps).getAdminStats({
        campaign_id: campaignId,
        page,
      }));
    } catch (error) {
      next(error);
    }
  });

  router.get('/marketing/settings', async (_req, res, next) => {
    try {
      res.json(await getMarketingSettingsService(deps).getAdminSettings());
    } catch (error) {
      next(error);
    }
  });

  router.patch('/marketing/settings', async (req, res, next) => {
    try {
      const input = parseMarketingSettingsPayload((req.body ?? {}) as Record<string, unknown>);
      const result = await getMarketingSettingsService(deps).updateAdminSettings(
        input,
        actorFromReq(req),
      );
      await deps.auditRepository.log(
        'update_marketing_settings',
        actorFromReq(req),
        req.requestId,
        input,
      );
      deps.publicPageCache?.clear();
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/system-settings/telegram', async (req, res, next) => {
    try {
      res.json(await getTelegramNotificationService(deps).getAdminSettings());
    } catch (error) {
      next(error);
    }
  });

  router.patch('/system-settings/telegram', async (req, res, next) => {
    try {
      const input = parseTelegramSettingsPayload((req.body ?? {}) as Record<string, unknown>, false);
      const result = await getTelegramNotificationService(deps).updateAdminSettings(
        input,
        actorFromReq(req),
      );
      await deps.auditRepository.log(
        'update_system_setting_telegram',
        actorFromReq(req),
        req.requestId,
        input,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/system-settings/telegram/test', async (req, res, next) => {
    try {
      const input = parseTelegramSettingsPayload((req.body ?? {}) as Record<string, unknown>, true);
      await getTelegramNotificationService(deps).sendTestMessage(input);
      await deps.auditRepository.log(
        'test_system_setting_telegram',
        actorFromReq(req),
        req.requestId,
        input,
      );
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof TelegramSendError) {
        next(new HttpError(error.status, 'TELEGRAM_TEST_FAILED', error.message));
        return;
      }
      next(error);
    }
  });

  router.get('/system-settings/user-telegram-bot', async (_req, res, next) => {
    try {
      res.json(await getUserTelegramBotSettingsService(deps).getAdminSettings());
    } catch (error) {
      next(error);
    }
  });

  router.patch('/system-settings/user-telegram-bot', async (req, res, next) => {
    try {
      const input = {
        ...parseUserTelegramBotSettingsPayload((req.body ?? {}) as Record<string, unknown>),
        request_origin: getSiteOrigin(req),
      };
      const result = await getUserTelegramBotSettingsService(deps).updateAdminSettings(
        input,
        actorFromReq(req),
      );
      await deps.auditRepository.log(
        'update_system_setting_user_telegram_bot',
        actorFromReq(req),
        req.requestId,
        { ...input, bot_token: input.bot_token ? '***' : undefined },
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/system-settings/user-telegram-bot/sync-webhook', async (req, res, next) => {
    try {
      const result = await getUserTelegramBotSettingsService(deps).syncWebhook(actorFromReq(req));
      await deps.auditRepository.log(
        'sync_system_setting_user_telegram_bot_webhook',
        actorFromReq(req),
        req.requestId,
        result,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/system-settings/media-libraries', async (_req, res, next) => {
    try {
      res.json(await getMediaLibrarySettingsService(deps).getAdminSettings());
    } catch (error) {
      next(error);
    }
  });

  router.get('/system-settings/payment-gateway', async (_req, res, next) => {
    try {
      res.json(await getPaymentGatewaySettingsService(deps).getAdminSettings());
    } catch (error) {
      next(error);
    }
  });

  router.patch('/system-settings/payment-gateway', async (req, res, next) => {
    try {
      const input = parsePaymentGatewaySettingsPayload((req.body ?? {}) as Record<string, unknown>);
      const result = await getPaymentGatewaySettingsService(deps).updateAdminSettings(
        input,
        actorFromReq(req),
      );
      await deps.auditRepository.log(
        'update_system_setting_payment_gateway',
        actorFromReq(req),
        req.requestId,
        input,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/system-settings/smtp', async (_req, res, next) => {
    try {
      res.json(await getSmtpSettingsService(deps).getAdminSettings());
    } catch (error) {
      next(error);
    }
  });

  router.get('/system-settings/x-oauth', async (_req, res, next) => {
    try {
      res.json(await getXOAuthSettingsService(deps).getAdminSettings());
    } catch (error) {
      next(error);
    }
  });

  router.patch('/system-settings/x-oauth', async (req, res, next) => {
    try {
      const input = parseXOAuthSettingsPayload((req.body ?? {}) as Record<string, unknown>);
      const result = await getXOAuthSettingsService(deps).updateAdminSettings(
        input,
        actorFromReq(req),
      );
      await deps.auditRepository.log(
        'update_system_setting_x_oauth',
        actorFromReq(req),
        req.requestId,
        {
          ...input,
          client_secret: input.client_secret
            ? '[redacted]'
            : input.client_secret,
        },
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/system-settings/smtp', async (req, res, next) => {
    try {
      const input = parseSmtpSettingsPayload((req.body ?? {}) as Record<string, unknown>, false);
      const result = await getSmtpSettingsService(deps).updateAdminSettings(
        input,
        actorFromReq(req),
      );
      await deps.auditRepository.log(
        'update_system_setting_smtp',
        actorFromReq(req),
        req.requestId,
        input,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/system-settings/smtp/templates/:key/enabled', async (req, res, next) => {
    try {
      const templateKey = toSmtpTemplateKey(req.params.key);
      const payload = toPlainObject(req.body ?? {}, 'body');
      const enabled = optionalBoolean(payload.enabled);
      if (enabled === undefined) {
        throw new HttpError(400, 'BAD_REQUEST', 'enabled must be boolean');
      }
      const smtpSettingsService = getSmtpSettingsService(deps);
      if (!smtpSettingsService.updateTemplateEnabled) {
        throw new Error('smtpSettingsService.updateTemplateEnabled is not configured');
      }
      const result = await smtpSettingsService.updateTemplateEnabled(templateKey, enabled, actorFromReq(req));
      await deps.auditRepository.log(
        'update_system_setting_smtp_template_enabled',
        actorFromReq(req),
        req.requestId,
        { template_key: templateKey, enabled },
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/system-settings/smtp/test', async (req, res, next) => {
    try {
      const payload = toPlainObject(req.body ?? {}, 'body');
      const input = parseSmtpSettingsPayload(payload, true);
      const testTo = mustString(payload.test_to, 'test_to');
      await getMailService(deps).sendTestMail({
        ...input,
        test_to: testTo,
      });
      await deps.auditRepository.log(
        'test_system_setting_smtp',
        actorFromReq(req),
        req.requestId,
        { ...input, test_to: testTo },
      );
      res.json({ ok: true });
    } catch (error) {
      if (error instanceof SmtpSendError) {
        next(new HttpError(error.status, 'SMTP_TEST_FAILED', error.message));
        return;
      }
      next(error);
    }
  });

  router.patch('/system-settings/media-libraries', async (req, res, next) => {
    try {
      const input = parseMediaLibrarySettingsPayload((req.body ?? {}) as Record<string, unknown>);
      const result = await getMediaLibrarySettingsService(deps).updateAdminSettings(
        input,
        actorFromReq(req),
      );
      await deps.auditRepository.log(
        'update_system_setting_media_libraries',
        actorFromReq(req),
        req.requestId,
        input,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/system-settings/publish-tokens', async (_req, res, next) => {
    try {
      res.json(await getAccessTokenService(deps).listAdminTokens());
    } catch (error) {
      next(error);
    }
  });

  router.post('/system-settings/publish-tokens', async (req, res, next) => {
    try {
      const input = parsePublishTokenPayload((req.body ?? {}) as Record<string, unknown>);
      const result = await getAccessTokenService(deps).createAdminToken(
        input,
        actorFromReq(req),
      ) as { token: { id: number } };
      await deps.auditRepository.log(
        'create_publish_token',
        actorFromReq(req),
        req.requestId,
        {
          token_id: result.token.id,
          name: input.name,
          scopes: input.scopes,
        },
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post('/system-settings/publish-tokens/:id/revoke', async (req, res, next) => {
    try {
      const tokenId = toPositiveIntOrThrow(req.params.id, 'token id');
      const result = await getAccessTokenService(deps).revokeAdminToken(tokenId);
      await deps.auditRepository.log(
        'revoke_publish_token',
        actorFromReq(req),
        req.requestId,
        { token_id: tokenId },
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get('/airport-applications', async (req, res, next) => {
    try {
      const page = toPositiveInt(req.query.page, 1);
      const pageSize = toBoundedPositiveInt(req.query.page_size, 20, 100);
      const keyword = optionalString(req.query.keyword);
      const reviewStatus = req.query.review_status
        ? toAirportApplicationReviewStatus(req.query.review_status)
        : undefined;
      const paymentStatus = req.query.payment_status
        ? toAirportApplicationPaymentStatus(req.query.payment_status)
        : undefined;
      const result = await deps.airportApplicationRepository.listByQuery({
        page,
        pageSize,
        keyword,
        paymentStatus,
        reviewStatus,
      });
      res.json({ page, page_size: pageSize, total: result.total, items: result.items });
    } catch (error) {
      next(error);
    }
  });

  router.get('/airport-applications/:id', async (req, res, next) => {
    try {
      const applicationId = toPositiveInt(req.params.id, 0);
      if (applicationId <= 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'application id must be positive integer');
      }
      const application = await deps.airportApplicationRepository.getById(applicationId);
      if (!application) {
        throw new HttpError(404, 'AIRPORT_APPLICATION_NOT_FOUND', `application ${applicationId} not found`);
      }
      res.json(application);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/airport-applications/:id', async (req, res, next) => {
    try {
      const applicationId = toPositiveInt(req.params.id, 0);
      if (applicationId <= 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'application id must be positive integer');
      }
      const application = await deps.airportApplicationRepository.getById(applicationId);
      if (!application) {
        throw new HttpError(404, 'AIRPORT_APPLICATION_NOT_FOUND', `application ${applicationId} not found`);
      }
      const currentApplication = application as {
        payment_status?: AirportApplicationPaymentStatus;
      };
      if (currentApplication.payment_status === 'paid') {
        throw new HttpError(409, 'AIRPORT_APPLICATION_DELETE_NOT_ALLOWED', '已支付申请不能删除');
      }

      const deleted = await deps.airportApplicationRepository.deleteUnpaid(applicationId);
      if (!deleted) {
        throw new HttpError(409, 'AIRPORT_APPLICATION_DELETE_NOT_ALLOWED', '当前申请状态不支持删除');
      }

      await deps.auditRepository.log('delete_airport_application', actorFromReq(req), req.requestId, {
        application_id: applicationId,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.patch('/airport-applications/:id/admin-note', async (req, res, next) => {
    try {
      const applicationId = toPositiveInt(req.params.id, 0);
      if (applicationId <= 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'application id must be positive integer');
      }

      if (!deps.airportApplicationRepository.updateAdminNote) {
        throw new Error('airportApplicationRepository.updateAdminNote is not configured');
      }

      const application = await deps.airportApplicationRepository.getById(applicationId);
      if (!application) {
        throw new HttpError(404, 'AIRPORT_APPLICATION_NOT_FOUND', `application ${applicationId} not found`);
      }

      const payload = (req.body ?? {}) as Record<string, unknown>;
      const adminNote = optionalString(payload.admin_note) || null;
      const updated = await deps.airportApplicationRepository.updateAdminNote(applicationId, adminNote);
      if (!updated) {
        throw new HttpError(409, 'AIRPORT_APPLICATION_ADMIN_NOTE_NOT_UPDATED', '后台备注保存失败');
      }

      await deps.auditRepository.log('update_airport_application_admin_note', actorFromReq(req), req.requestId, {
        application_id: applicationId,
      });

      const updatedApplication = await deps.airportApplicationRepository.getById(applicationId);
      res.json(updatedApplication);
    } catch (error) {
      next(error);
    }
  });

  router.post('/airport-applications/:id/replies', async (req, res, next) => {
    try {
      const applicationId = toPositiveInt(req.params.id, 0);
      if (applicationId <= 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'application id must be positive integer');
      }
      if (!deps.airportApplicationRepository.createEmailReply) {
        throw new Error('airportApplicationRepository.createEmailReply is not configured');
      }

      const application = await deps.airportApplicationRepository.getById(applicationId);
      if (!application) {
        throw new HttpError(404, 'AIRPORT_APPLICATION_NOT_FOUND', `application ${applicationId} not found`);
      }
      const currentApplication = application as {
        name: string;
        applicant_email?: string | null;
        payment_status?: AirportApplicationPaymentStatus;
        review_status?: AirportApplicationReviewStatus;
      };
      if (!['awaiting_payment', 'pending'].includes(String(currentApplication.review_status || ''))) {
        throw new HttpError(409, 'AIRPORT_APPLICATION_REPLY_NOT_ALLOWED', '只有待支付或待审核的申请可以发送邮件回复');
      }
      const toEmail = optionalString(currentApplication.applicant_email);
      if (!toEmail) {
        throw new HttpError(409, 'AIRPORT_APPLICATION_REPLY_EMAIL_MISSING', '申请人邮箱为空，无法发送邮件回复');
      }

      const payload = (req.body ?? {}) as Record<string, unknown>;
      const replyBody = optionalString(payload.reply_body);
      if (!replyBody) {
        throw new HttpError(400, 'BAD_REQUEST', 'reply_body is required');
      }
      const mailService = getMailService(deps);
      if (!mailService.sendApplicationReplyEmail) {
        throw new Error('mailService.sendApplicationReplyEmail is not configured');
      }
      const contactInfo = await getApplicationReplyContactInfo(deps, req);

      await mailService.sendApplicationReplyEmail({
        to: toEmail,
        airportName: currentApplication.name,
        replyBody,
        adminTelegramUsername: contactInfo.adminTelegramUsername,
        adminTelegramUrl: contactInfo.adminTelegramUrl,
        portalLoginUrl: contactInfo.portalLoginUrl,
      });

      const sentAt = formatSqlDateTimeInTimezone(new Date(), 'Asia/Shanghai');
      const replyId = await deps.airportApplicationRepository.createEmailReply({
        application_id: applicationId,
        to_email: toEmail,
        reply_body: replyBody,
        sent_by: actorFromReq(req),
        sent_at: sentAt,
      });
      await deps.auditRepository.log('send_airport_application_reply', actorFromReq(req), req.requestId, {
        application_id: applicationId,
        reply_id: replyId,
        to_email: toEmail,
        sent_at: sentAt,
      });

      const updatedApplication = await deps.airportApplicationRepository.getById(applicationId);
      res.status(201).json(updatedApplication);
    } catch (error) {
      if (error instanceof SmtpSendError) {
        next(new HttpError(error.status, 'APPLICATION_REPLY_EMAIL_FAILED', error.message));
        return;
      }
      next(error);
    }
  });

  router.patch('/airport-applications/:id/mark-paid', async (req, res, next) => {
    try {
      const applicationId = toPositiveInt(req.params.id, 0);
      if (applicationId <= 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'application id must be positive integer');
      }

      const application = await deps.airportApplicationRepository.getById(applicationId);
      if (!application) {
        throw new HttpError(404, 'AIRPORT_APPLICATION_NOT_FOUND', `application ${applicationId} not found`);
      }

      const currentApplication = application as {
        review_status?: AirportApplicationReviewStatus;
        payment_status?: 'unpaid' | 'paid';
      };

      if (currentApplication.review_status !== 'awaiting_payment' || currentApplication.payment_status === 'paid') {
        throw new HttpError(409, 'AIRPORT_APPLICATION_MARK_PAID_NOT_ALLOWED', '当前申请状态不支持改为已支付');
      }

      if (!deps.airportApplicationRepository.markPaid) {
        throw new Error('airportApplicationRepository.markPaid is not configured');
      }

      const paymentOrderRepository = getApplicationPaymentOrderRepository(deps);
      const latestOrder = await paymentOrderRepository.getLatestByApplicationId(applicationId);
      const marketingConfig = await getMarketingSettingsService(deps).getConfig();
      const paymentAmount = latestOrder?.amount && latestOrder.amount > 0
        ? Number(latestOrder.amount)
        : Number(marketingConfig.application_fee_amount);
      const paidAt = formatSqlDateTimeInTimezone(new Date(), 'Asia/Shanghai');

      const marked = await deps.airportApplicationRepository.markPaid(applicationId, paymentAmount, paidAt);
      if (!marked) {
        throw new HttpError(409, 'AIRPORT_APPLICATION_MARK_PAID_NOT_ALLOWED', '该申请已处理，不能再次修改支付状态');
      }

      const expiredOrders = await paymentOrderRepository.expireOpenOrdersByApplicationId(applicationId);
      await deps.auditRepository.log('mark_airport_application_paid', actorFromReq(req), req.requestId, {
        application_id: applicationId,
        payment_amount: paymentAmount,
        paid_at: paidAt,
        latest_payment_order_id: latestOrder?.id ?? null,
        expired_orders: expiredOrders,
      });

      const updatedApplication = await deps.airportApplicationRepository.getById(applicationId);
      res.json(updatedApplication);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/airport-applications/:id/review', async (req, res, next) => {
    try {
      const applicationId = toPositiveInt(req.params.id, 0);
      if (applicationId <= 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'application id must be positive integer');
      }
      const payload = (req.body ?? {}) as Record<string, unknown>;
      const reviewStatus = toReviewStatus(payload.review_status);
      const reviewNote = payload.review_note === undefined ? undefined : optionalString(payload.review_note) || null;
      const application = await deps.airportApplicationRepository.getById(applicationId);
      if (!application) {
        throw new HttpError(404, 'AIRPORT_APPLICATION_NOT_FOUND', `application ${applicationId} not found`);
      }
      const currentApplication = application as {
        review_status?: AirportApplicationReviewStatus;
        payment_status?: 'unpaid' | 'paid';
        approved_airport_id?: number | null;
        name: string;
        website: string;
        websites?: string[];
        status: AirportStatus;
        plan_price_month: number;
        has_trial: boolean;
        streaming_support?: AirportStreamingSupport[];
        payment_methods?: AirportPaymentMethod[];
        payment_crypto_other?: string | null;
        profile?: AirportProfile;
        subscription_url?: string | null;
        applicant_email?: string | null;
        applicant_telegram?: string | null;
        founded_on?: string | null;
        airport_intro?: string | null;
        test_account?: string | null;
        test_password?: string | null;
      };
      if (currentApplication.review_status === 'awaiting_payment') {
        throw new HttpError(409, 'AIRPORT_APPLICATION_PAYMENT_REQUIRED', '该申请尚未支付，不能审核');
      }
      if (currentApplication.payment_status !== 'paid') {
        throw new HttpError(409, 'AIRPORT_APPLICATION_PAYMENT_REQUIRED', '该申请尚未完成支付，不能审核');
      }
      if (currentApplication.review_status && currentApplication.review_status !== 'pending') {
        throw new HttpError(409, 'AIRPORT_APPLICATION_ALREADY_REVIEWED', '该申请已处理，不能再次修改');
      }

      let approvedAirportId = currentApplication.approved_airport_id || null;
      if (reviewStatus === 'reviewed' && !approvedAirportId) {
        approvedAirportId = await deps.airportRepository.create({
          name: currentApplication.name,
          website: currentApplication.website,
          websites: currentApplication.websites,
          status: currentApplication.status,
          is_listed: true,
          plan_price_month: currentApplication.plan_price_month,
          has_trial: currentApplication.has_trial,
          streaming_support: currentApplication.streaming_support || [],
          payment_methods: currentApplication.payment_methods || [],
          payment_crypto_other: currentApplication.payment_crypto_other || null,
          profile: currentApplication.profile,
          subscription_url: currentApplication.subscription_url || null,
          applicant_email: currentApplication.applicant_email || null,
          applicant_telegram: currentApplication.applicant_telegram || null,
          founded_on: currentApplication.founded_on || null,
          airport_intro: currentApplication.airport_intro || null,
          test_account: currentApplication.test_account || null,
          test_password: currentApplication.test_password || null,
          tags: [],
        });
        await deps.applicantBillingRepository?.linkAirportByApplicationId(applicationId, approvedAirportId);
      }
      const reviewedAt = formatSqlDateTimeInTimezone(new Date(), 'Asia/Shanghai');
      const updated = await deps.airportApplicationRepository.review(applicationId, {
        review_status: reviewStatus,
        review_note: reviewNote,
        approved_airport_id: approvedAirportId,
        reviewed_by: actorFromReq(req),
        reviewed_at: reviewedAt,
      });

      if (!updated) {
        throw new HttpError(409, 'AIRPORT_APPLICATION_ALREADY_REVIEWED', '该申请已处理，不能再次修改');
      }

      await deps.auditRepository.log('review_airport_application', actorFromReq(req), req.requestId, {
        application_id: applicationId,
        review_status: reviewStatus,
        review_note: reviewNote,
        approved_airport_id: approvedAirportId,
        reviewed_at: reviewedAt,
      });
      if (reviewStatus === 'reviewed' && approvedAirportId) {
        deps.publicPageCache?.clear();
      }
      if (reviewStatus === 'reviewed' && currentApplication.applicant_email && deps.mailService) {
        try {
          await deps.mailService.sendApplicationApprovedEmail({
            to: currentApplication.applicant_email,
            airportName: currentApplication.name,
          });
        } catch (error) {
          console.error('[mail] failed to send application approved email', {
            applicationId,
            requestId: req.requestId,
            error,
          });
        }
      }
      const reviewedApplication = await deps.airportApplicationRepository.getById(applicationId);
      res.json(reviewedApplication);
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports', async (req, res, next) => {
    try {
      const page = toPositiveInt(req.query.page, 1);
      const pageSize = toPositiveInt(req.query.page_size, 50);
      const keyword = optionalString(req.query.keyword);
      const status = req.query.status ? toStatus(req.query.status) : undefined;
      const isListed = req.query.is_listed ? toAirportListedFilter(req.query.is_listed) : undefined;
      const sortBy = req.query.sort_by ? parseAirportListSortBy(req.query.sort_by) : undefined;
      const sortOrder = sortBy ? parseSortOrder(req.query.sort_order) : undefined;
      const scoreRepository = deps.scoreRepository;
      const scoreDate = scoreRepository.getLatestAvailableDate && scoreRepository.getPublicDisplayScoresByDate
        ? await scoreRepository.getLatestAvailableDate(getDateInTimezone())
        : null;
      const result = await deps.airportRepository.listByQuery({
        page,
        pageSize,
        keyword,
        status,
        isListed,
        sortBy,
        sortOrder,
        scoreDate,
      });
      const airports = result.items as Array<{ id?: number } & Record<string, unknown>>;
      let scoreMap = new Map<number, number>();
      let walletMap = new Map<number, { id: number; balance: number }>();
      const airportIds = airports
        .map((item) => Number(item.id))
        .filter((id) => Number.isInteger(id) && id > 0);

      if (scoreRepository.getPublicDisplayScoresByDate) {
        if (scoreDate && airportIds.length > 0) {
          scoreMap = await scoreRepository.getPublicDisplayScoresByDate(airportIds, scoreDate);
        }
      }
      if (deps.applicantBillingRepository?.listWalletsByAirportIds && airportIds.length > 0) {
        walletMap = await deps.applicantBillingRepository.listWalletsByAirportIds(airportIds);
      }

      res.json({
        page,
        page_size: pageSize,
        total: result.total,
        items: airports.map((item) => {
          const airportId = Number(item.id);
          const wallet = Number.isInteger(airportId) ? walletMap.get(airportId) : undefined;
          return {
            ...item,
            total_score: Number.isInteger(airportId) ? scoreMap.get(airportId) ?? null : null,
            wallet_id: wallet?.id ?? null,
            wallet_balance: wallet?.balance ?? null,
          };
        }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const airport = await deps.airportRepository.getById(airportId);
      if (!airport) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }
      const walletMap = deps.applicantBillingRepository?.listWalletsByAirportIds
        ? await deps.applicantBillingRepository.listWalletsByAirportIds([airportId])
        : new Map<number, { id: number; balance: number }>();
      const wallet = walletMap.get(airportId);
      res.json({
        ...(airport as Record<string, unknown>),
        wallet_id: wallet?.id ?? null,
        wallet_balance: wallet?.balance ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/airports', async (req, res, next) => {
    try {
      const payload = req.body ?? {};
      const name = mustString(payload.name, 'name');
      const slug = optionalString(payload.slug) || null;
      const websiteBundle = parseWebsiteFields(payload, true);
      const primaryWebsite = websiteBundle.website as string;
      const status = payload.status ? toStatus(payload.status) : 'normal';
      const isListed = payload.is_listed === undefined ? true : toBooleanFlag(payload.is_listed);
      ensureDownConfirmed(status, payload.confirm_down);
      const planPriceMonth = mustNumber(payload.plan_price_month, 'plan_price_month');
      const hasTrial = Boolean(payload.has_trial);
      const streamingSupport =
        payload.streaming_support === undefined
          ? []
          : toAirportStreamingSupportArray(payload.streaming_support);
      const paymentMethods =
        payload.payment_methods === undefined
          ? []
          : toAirportPaymentMethodArray(payload.payment_methods);
      const paymentCryptoOther = optionalString(payload.payment_crypto_other) || null;
      const profile = parseAirportProfilePayload(payload.profile);
      const subscriptionUrl = optionalString(payload.subscription_url);
      const applicantEmail = optionalString(payload.applicant_email) || null;
      const applicantTelegram = optionalString(payload.applicant_telegram) || null;
      const foundedOn = optionalDate(payload.founded_on, 'founded_on') || null;
      const airportIntro = optionalString(payload.airport_intro) || null;
      const testAccount = optionalString(payload.test_account) || null;
      const testPassword = optionalString(payload.test_password) || null;
      const manualTags =
        payload.manual_tags !== undefined
          ? toStringArray(payload.manual_tags)
          : toStringArray(payload.tags || []);

      const airportId = await deps.airportRepository.create({
        slug,
        name,
        website: primaryWebsite,
        websites: websiteBundle.websites,
        status,
        is_listed: isListed,
        plan_price_month: planPriceMonth,
        has_trial: hasTrial,
        streaming_support: streamingSupport,
        payment_methods: paymentMethods,
        payment_crypto_other: paymentCryptoOther,
        has_annual_plan: toNullableBooleanFlag(payload.has_annual_plan, 'has_annual_plan'),
        has_telegram_group: toNullableBooleanFlag(payload.has_telegram_group, 'has_telegram_group'),
        telegram_allows_speaking: toNullableBooleanFlag(payload.telegram_allows_speaking, 'telegram_allows_speaking'),
        has_lifetime_plan: toNullableBooleanFlag(payload.has_lifetime_plan, 'has_lifetime_plan'),
        profile,
        subscription_url: subscriptionUrl || null,
        applicant_email: applicantEmail,
        applicant_telegram: applicantTelegram,
        founded_on: foundedOn,
        airport_intro: airportIntro,
        test_account: testAccount,
        test_password: testPassword,
        manual_tags: manualTags,
      });

      await deps.auditRepository.log('create_airport', actorFromReq(req), req.requestId, payload);
      deps.publicPageCache?.clear();
      res.status(201).json({ airport_id: airportId });
    } catch (error) {
      next(normalizeAirportMutationError(error));
    }
  });

  router.patch('/airports/:id', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const payload = req.body ?? {};
      const websiteBundle = parseWebsiteFields(payload, false);
      const nextStatus = payload.status ? toStatus(payload.status) : undefined;
      ensureDownConfirmed(nextStatus, payload.confirm_down);
      const patch = {
        slug: payload.slug === undefined ? undefined : optionalString(payload.slug) || null,
        name: optionalString(payload.name),
        website: websiteBundle.website,
        websites: websiteBundle.websites,
        status: nextStatus,
        is_listed: payload.is_listed === undefined ? undefined : toBooleanFlag(payload.is_listed),
        plan_price_month:
          payload.plan_price_month === undefined
            ? undefined
            : mustNumber(payload.plan_price_month, 'plan_price_month'),
        has_trial: payload.has_trial === undefined ? undefined : Boolean(payload.has_trial),
        streaming_support:
          payload.streaming_support === undefined
            ? undefined
            : toAirportStreamingSupportArray(payload.streaming_support),
        payment_methods:
          payload.payment_methods === undefined
            ? undefined
            : toAirportPaymentMethodArray(payload.payment_methods),
        payment_crypto_other:
          payload.payment_crypto_other === undefined
            ? undefined
            : optionalString(payload.payment_crypto_other) || null,
        has_annual_plan:
          payload.has_annual_plan === undefined
            ? undefined
            : toNullableBooleanFlag(payload.has_annual_plan, 'has_annual_plan'),
        has_telegram_group:
          payload.has_telegram_group === undefined
            ? undefined
            : toNullableBooleanFlag(payload.has_telegram_group, 'has_telegram_group'),
        telegram_allows_speaking:
          payload.telegram_allows_speaking === undefined
            ? undefined
            : toNullableBooleanFlag(payload.telegram_allows_speaking, 'telegram_allows_speaking'),
        has_lifetime_plan:
          payload.has_lifetime_plan === undefined
            ? undefined
            : toNullableBooleanFlag(payload.has_lifetime_plan, 'has_lifetime_plan'),
        profile:
          payload.profile === undefined
            ? undefined
            : parseAirportProfilePayload(payload.profile),
        subscription_url:
          payload.subscription_url === undefined
            ? undefined
            : optionalString(payload.subscription_url) || null,
        subscription_url_updated_source: undefined as 'admin' | 'portal' | null | undefined,
        applicant_email:
          payload.applicant_email === undefined
            ? undefined
            : optionalString(payload.applicant_email) || null,
        applicant_telegram:
          payload.applicant_telegram === undefined
            ? undefined
            : optionalString(payload.applicant_telegram) || null,
        founded_on:
          payload.founded_on === undefined
            ? undefined
            : optionalDate(payload.founded_on, 'founded_on') || null,
        airport_intro:
          payload.airport_intro === undefined
            ? undefined
            : optionalString(payload.airport_intro) || null,
        test_account:
          payload.test_account === undefined
            ? undefined
            : optionalString(payload.test_account) || null,
        test_password:
          payload.test_password === undefined
            ? undefined
            : optionalString(payload.test_password) || null,
        manual_tags:
          payload.manual_tags === undefined
            ? payload.tags === undefined
              ? undefined
              : toStringArray(payload.tags)
            : toStringArray(payload.manual_tags),
      };
      if (payload.subscription_url !== undefined) {
        patch.subscription_url_updated_source = 'admin';
      }
      for (const key of Object.keys(patch) as Array<keyof typeof patch>) {
        if (patch[key] === undefined) {
          delete patch[key];
        }
      }

      const updated = await deps.airportRepository.update(airportId, patch);
      if (!updated) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found or no changes`);
      }
      if (payload.subscription_url !== undefined) {
        await deps.airportApplicationRepository.updateSubscriptionUrlByApprovedAirportId?.(
          airportId,
          patch.subscription_url ?? null,
          'admin',
        );
      }
      if (patch.is_listed === true && deps.applicantBillingRepository?.clearAutoUnlistedByAirportId) {
        await deps.applicantBillingRepository.clearAutoUnlistedByAirportId(airportId);
      }

      await deps.auditRepository.log('update_airport', actorFromReq(req), req.requestId, {
        airport_id: airportId,
        patch,
      });
      deps.publicPageCache?.clear();
      res.json({ airport_id: airportId, updated: true });
    } catch (error) {
      next(normalizeAirportMutationError(error));
    }
  });

  router.get('/airports/:id/recharge-orders', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const airport = await deps.airportRepository.getById(airportId);
      if (!airport) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }
      const page = toPositiveInt(req.query.page, 1);
      const pageSize = toBoundedPositiveInt(req.query.page_size, 20, 100);
      const billingRepository = deps.applicantBillingRepository;
      if (!billingRepository?.listRechargeOrdersByAirportId) {
        throw new Error('applicantBillingRepository.listRechargeOrdersByAirportId is not configured');
      }
      const result = await billingRepository.listRechargeOrdersByAirportId(airportId, page, pageSize);
      res.json({
        page,
        page_size: pageSize,
        total: result.total,
        items: result.items,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/wallet-transactions', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const airport = await deps.airportRepository.getById(airportId);
      if (!airport) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }
      const page = toPositiveInt(req.query.page, 1);
      const pageSize = toBoundedPositiveInt(req.query.page_size, 20, 100);
      const billingRepository = deps.applicantBillingRepository;
      if (!billingRepository?.listWalletTransactionsByAirportId) {
        throw new Error('applicantBillingRepository.listWalletTransactionsByAirportId is not configured');
      }
      const result = await billingRepository.listWalletTransactionsByAirportId(airportId, page, pageSize, 'click_charge');
      res.json({
        page,
        page_size: pageSize,
        total: result.total,
        items: result.items,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/airports/:id/wallet/adjustments', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const airport = await deps.airportRepository.getById(airportId);
      if (!airport) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }
      const billingRepository = deps.applicantBillingRepository;
      if (!billingRepository?.addWalletBalanceAdjustment) {
        throw new Error('applicantBillingRepository.addWalletBalanceAdjustment is not configured');
      }

      const payload = (req.body ?? {}) as Record<string, unknown>;
      const amount = parseNonZeroMoney(payload.amount, 'amount');
      const description = optionalString(payload.description) || formatAdminWalletAdjustmentDescription(amount);
      const wallet = await billingRepository.addWalletBalanceAdjustment({
        airport_id: airportId,
        amount,
        description,
        reference_id: req.requestId,
      });
      if (!wallet) {
        throw new HttpError(409, 'AIRPORT_WALLET_NOT_FOUND', '该机场未绑定申请人钱包，不能调整余额');
      }

      await deps.auditRepository.log('adjust_airport_wallet_balance', actorFromReq(req), req.requestId, {
        airport_id: airportId,
        amount,
        description,
      });
      res.json({ airport_id: airportId, wallet });
    } catch (error) {
      if (isCodedError(error, 'AIRPORT_WALLET_BALANCE_INSUFFICIENT')) {
        next(new HttpError(409, 'AIRPORT_WALLET_BALANCE_INSUFFICIENT', '扣减金额不能超过当前余额'));
        return;
      }
      next(error);
    }
  });

  router.post('/airports/:id/applicant-password-reset', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const airport = await deps.airportRepository.getById(airportId);
      if (!airport) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }

      const accountRepository = getApplicantAccountRepository(deps);
      const account = await accountRepository.getByAirportId(airportId);
      if (!account) {
        throw new HttpError(409, 'AIRPORT_APPLICANT_ACCOUNT_NOT_FOUND', '该机场未绑定申请人登录账号，无法重置密码');
      }

      const mailService = getMailService(deps);
      if (!mailService.sendApplicantPasswordResetEmail) {
        throw new Error('mailService.sendApplicantPasswordResetEmail is not configured');
      }

      const toEmail = optionalString((airport as { applicant_email?: string | null }).applicant_email)
        || optionalString(account.email);
      if (!toEmail) {
        throw new HttpError(
          409,
          'AIRPORT_APPLICANT_PASSWORD_RESET_EMAIL_NOT_CONFIGURED',
          '未配置可接收重置密码邮件的邮箱',
        );
      }

      const previousPasswordHash = account.password_hash;
      const previousMustChangePassword = account.must_change_password;
      const newPassword = createRandomPassword();
      const newPasswordHash = await hashPassword(newPassword);
      const updated = await accountRepository.updatePassword(account.id, newPasswordHash, true);
      if (!updated) {
        throw new HttpError(409, 'AIRPORT_APPLICANT_PASSWORD_NOT_UPDATED', '申请人登录密码重置失败');
      }

      try {
        await mailService.sendApplicantPasswordResetEmail({
          to: toEmail,
          airportName: getAirportNameForMail(airport, airportId),
          portalEmail: account.email,
          newPassword,
          portalLoginUrl: buildPortalLoginUrl(req),
        });
      } catch (error) {
        try {
          await accountRepository.updatePassword(account.id, previousPasswordHash, previousMustChangePassword);
        } catch (rollbackError) {
          console.error('[admin] failed to rollback applicant password reset', {
            airportId,
            applicantAccountId: account.id,
            applicationId: account.application_id,
            requestId: req.requestId,
            error: rollbackError,
          });
        }
        throw error;
      }

      await deps.auditRepository.log('reset_airport_applicant_password', actorFromReq(req), req.requestId, {
        airport_id: airportId,
        applicant_account_id: account.id,
        application_id: account.application_id,
        to_email: toEmail,
      });

      res.json({
        ok: true,
        airport_id: airportId,
        applicant_account_id: account.id,
        application_id: account.application_id,
        to_email: toEmail,
      });
    } catch (error) {
      if (error instanceof SmtpSendError) {
        next(new HttpError(error.status, 'AIRPORT_APPLICANT_PASSWORD_RESET_EMAIL_FAILED', error.message));
        return;
      }
      next(error);
    }
  });

  router.post('/probe-samples', async (req, res, next) => {
    try {
      const payload = req.body ?? {};
      const sampleType = toSampleType(payload.sample_type);
      const input: ProbeSampleInput = {
        airport_id: toAirportId(payload.airport_id),
        sampled_at: mustDateTime(payload.sampled_at, 'sampled_at'),
        sample_type: sampleType,
        probe_scope: payload.probe_scope ? toProbeScope(payload.probe_scope) : undefined,
        latency_ms: payload.latency_ms === undefined ? undefined : mustNumber(payload.latency_ms, 'latency_ms'),
        download_mbps:
          payload.download_mbps === undefined
            ? undefined
            : mustNumber(payload.download_mbps, 'download_mbps'),
        availability:
          payload.availability === undefined
            ? undefined
            : Boolean(payload.availability),
        packet_loss_percent:
          payload.packet_loss_percent === undefined
            ? undefined
            : mustNumber(payload.packet_loss_percent, 'packet_loss_percent'),
        source: optionalString(payload.source) || 'manual',
      };

      validateProbeSample(input);
      const sampleId = await deps.probeSampleRepository.insertProbeSample(input);
      if (input.packet_loss_percent !== undefined) {
        await deps.probeSampleRepository.insertPacketLossSample(input);
      }

      await deps.auditRepository.log('insert_probe_sample', actorFromReq(req), req.requestId, input);
      res.status(201).json({ sample_id: sampleId });
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/probe-samples', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const sampleType = req.query.type ? toSampleType(req.query.type) : undefined;
      const probeScope = req.query.scope ? toProbeScope(req.query.scope) : undefined;
      const latest = toBooleanFlag(req.query.latest);
      const limit = toBoundedPositiveInt(req.query.limit, 20, 200);
      if (latest) {
        const items = await deps.probeSampleRepository.listLatestProbeSamples(
          airportId,
          limit,
          sampleType,
          probeScope,
        );
        res.json({
          airport_id: airportId,
          date: null,
          latest: true,
          limit,
          type: sampleType || null,
          scope: probeScope || null,
          items,
        });
        return;
      }

      const date = parseDate(req.query.date);
      const items = await deps.probeSampleRepository.listProbeSamples(
        airportId,
        date,
        sampleType,
        req.query.limit === undefined ? undefined : limit,
        probeScope,
      );
      res.json({
        airport_id: airportId,
        date,
        latest: false,
        limit: req.query.limit === undefined ? null : limit,
        type: sampleType || null,
        scope: probeScope || null,
        items,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/airports/:id/subscription-node-snapshots', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const input = toSubscriptionNodeSnapshotInput(airportId, req.body ?? {});
      const snapshotId = await getSubscriptionNodeSnapshotRepository(deps).insert(input);
      await deps.auditRepository.log('insert_subscription_node_snapshot', actorFromReq(req), req.requestId, {
        snapshot_id: snapshotId,
        airport_id: input.airport_id,
        captured_at: input.captured_at,
        source: input.source,
        subscription_format: input.subscription_format,
        parsed_nodes_count: input.parsed_nodes_count,
        supported_nodes_count: input.supported_nodes_count,
        unsupported_nodes_count: input.unsupported_nodes?.length || 0,
      });
      res.status(201).json({ snapshot_id: snapshotId, airport_id: input.airport_id, captured_at: input.captured_at });
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/subscription-node-snapshots/latest', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const snapshot = await getSubscriptionNodeSnapshotRepository(deps).getLatestByAirport(airportId);
      if (!snapshot) {
        throw new HttpError(404, 'SUBSCRIPTION_NODE_SNAPSHOT_NOT_FOUND', 'subscription node snapshot not found');
      }
      res.json(snapshot);
    } catch (error) {
      next(error);
    }
  });

  router.post('/airports/:id/subscription-node-snapshots/capture', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const airport = await deps.airportRepository.getById(airportId);
      if (!airport) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }
      const savedSubscriptionUrl = airport && typeof airport === 'object'
        ? stringOrNull((airport as { subscription_url?: unknown }).subscription_url)
        : null;
      if (!savedSubscriptionUrl) {
        throw new HttpError(400, 'MISSING_SUBSCRIPTION_URL', '请先保存订阅链接后再获取节点');
      }

      const result = await getSubscriptionNodeCaptureService(deps).capture(airportId, actorFromReq(req));
      const safeResult = toSafeSubscriptionNodeCaptureResult(result);
      await deps.auditRepository.log('capture_subscription_nodes', actorFromReq(req), req.requestId, safeResult);
      res.status(201).json(safeResult);
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/performance-probe-settings', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const date = parseDate(req.query.date);
      const settingRepository = getPerformanceProbeSettingRepository(deps);
      const probeRepository = getPerformanceProbeRepository(deps);
      const [currentView, probes, runs] = await Promise.all([
        settingRepository.getByAirport(airportId),
        probeRepository.list(),
        deps.performanceRunRepository.listByAirportAndDate?.(airportId, date) ?? Promise.resolve([]),
      ]);
      const editable = date === getDateInTimezone();
      const effectiveView = editable || runs.length === 0
        ? currentView
        : historicalPerformanceSettingsView(airportId, currentView, runs);
      const runByProbe = new Map<PerformanceProbeId, PerformanceRun>();
      for (const run of runs) {
        const probeId = run.probe_id || 'legacy-control';
        if (!runByProbe.has(probeId)) runByProbe.set(probeId, run);
      }
      const settingByProbe = new Map(effectiveView.settings.map((setting) => [setting.probe_id, setting]));
      res.json({
        airport_id: airportId,
        date,
        editable,
        config_version: effectiveView.config_version,
        settings: probes.map((probe) => ({
          probe_id: probe.probe_id,
          display_name: probe.display_name,
          region_code: probe.region_code,
          provider: probe.provider,
          bandwidth_mbps: probe.bandwidth_mbps,
          probe_type: probe.probe_type,
          test_profile: probe.test_profile,
          scoring_rule_version: probe.scoring_rule_version,
          globally_enabled: probe.globally_enabled,
          token_configured: probe.token_configured,
          last_seen_at: probe.last_seen_at,
          test_enabled: settingByProbe.get(probe.probe_id)?.test_enabled ?? false,
          include_in_result: settingByProbe.get(probe.probe_id)?.include_in_result ?? false,
          updated_by: settingByProbe.get(probe.probe_id)?.updated_by ?? null,
          updated_at: settingByProbe.get(probe.probe_id)?.updated_at ?? null,
          last_run: safePerformanceProbeRun(runByProbe.get(probe.probe_id) || null),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/airports/:id/performance-probe-settings', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const payload = (req.body || {}) as Record<string, unknown>;
      const date = parseDate(payload.date);
      if (date !== getDateInTimezone()) {
        throw new HttpError(409, 'HISTORICAL_PROBE_SETTINGS_READ_ONLY', '历史日期的测试地区配置只读');
      }
      const settingRepository = getPerformanceProbeSettingRepository(deps);
      const before = await settingRepository.getByAirport(airportId);
      const settings = parsePerformanceProbeSettings(payload.settings);
      const beforeByProbe = new Map(before.settings.map((setting) => [setting.probe_id, setting]));
      for (const setting of settings) {
        if (
          setting.probe_id === 'legacy-control'
          || !setting.include_in_result
          || beforeByProbe.get(setting.probe_id)?.include_in_result
        ) continue;
        const latest = await deps.performanceRunRepository.getLatestByAirportProbeBeforeDate?.(
          airportId,
          setting.probe_id,
          date,
        );
        if (
          !latest
          || latest.status !== 'success'
          || latest.test_profile !== 'proxy_multi_target_v2'
          || !Number.isFinite(Number(latest.median_download_mbps))
          || Number(latest.median_download_mbps) <= 0
        ) {
          throw new HttpError(
            409,
            'PERFORMANCE_PROBE_PROXY_RUN_REQUIRED',
            `${setting.probe_id} 最近一次统一代理测速没有有效下载结果，暂不能并入测试结果`,
          );
        }
      }
      const expectedConfigVersion = Number(payload.expected_config_version);
      if (!Number.isInteger(expectedConfigVersion) || expectedConfigVersion < 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'expected_config_version must be a non-negative integer');
      }
      let after: AirportPerformanceProbeSettingsView;
      try {
        after = await settingRepository.saveAll({
          airport_id: airportId,
          expected_config_version: expectedConfigVersion,
          updated_by: actorFromReq(req),
          settings,
        });
      } catch (error) {
        if (error instanceof PerformanceProbeSettingsConflictError) {
          throw new HttpError(409, 'PERFORMANCE_PROBE_SETTINGS_CONFLICT', '配置已被其他管理员更新，请重新加载');
        }
        throw error;
      }
      await deps.auditRepository.log(
        'update_performance_probe_settings',
        actorFromReq(req),
        req.requestId,
        { airport_id: airportId, before, after },
      );
      res.json(after);
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/performance-node-selection', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const [snapshot, preference] = await Promise.all([
        getSubscriptionNodeSnapshotRepository(deps).getLatestByAirport(airportId),
        getPerformanceNodePreferenceRepository(deps).getByAirport(airportId),
      ]);
      const candidates = snapshot ? buildPerformanceNodeSelectionCandidates(snapshot.nodes) : [];
      const selectedKeys = resolvePerformanceNodeSelectionKeys(preference?.selected_nodes || [], candidates);

      res.json({
        airport_id: airportId,
        snapshot: snapshot ? {
          id: snapshot.id,
          captured_at: snapshot.captured_at,
          source: snapshot.source,
          subscription_format: snapshot.subscription_format,
          parsed_nodes_count: snapshot.parsed_nodes_count,
          supported_nodes_count: snapshot.supported_nodes_count,
        } : null,
        nodes: candidates,
        selected_keys: selectedKeys,
        mode: selectedKeys.length > 0 ? 'specified' : 'default',
        updated_by: preference?.updated_by ?? null,
        updated_at: preference?.updated_at ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/airports/:id/performance-node-selection', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const payload = (req.body || {}) as Record<string, unknown>;
      const selectedKeys = [...new Set(
        toStringArray(payload.selected_keys, 'selected_keys')
          .map((key) => key.trim())
          .filter(Boolean),
      )];
      const repository = getPerformanceNodePreferenceRepository(deps);

      if (selectedKeys.length === 0) {
        await repository.clear(airportId);
        await deps.auditRepository.log('clear_performance_node_selection', actorFromReq(req), req.requestId, {
          airport_id: airportId,
        });
        res.json({ airport_id: airportId, selected_keys: [], mode: 'default' });
        return;
      }

      const snapshot = await getSubscriptionNodeSnapshotRepository(deps).getLatestByAirport(airportId);
      if (!snapshot) {
        throw new HttpError(404, 'SUBSCRIPTION_NODE_SNAPSHOT_NOT_FOUND', 'subscription node snapshot not found');
      }
      const candidates = buildPerformanceNodeSelectionCandidates(snapshot.nodes);
      const candidateByKey = new Map(candidates.map((node) => [node.key, node]));
      const unknownKeys = selectedKeys.filter((key) => !candidateByKey.has(key));
      if (unknownKeys.length > 0) {
        throw new HttpError(400, 'BAD_REQUEST', `selected_keys contains unknown node key: ${unknownKeys[0]}`);
      }

      const selectedNodes = selectedKeys.map((key) => candidateByKey.get(key)).filter(Boolean) as PerformanceNodePreferenceNode[];
      await repository.save({
        airport_id: airportId,
        selected_nodes: selectedNodes,
        updated_by: actorFromReq(req),
      });
      await deps.auditRepository.log('update_performance_node_selection', actorFromReq(req), req.requestId, {
        airport_id: airportId,
        selected_nodes: selectedNodes,
      });
      res.json({
        airport_id: airportId,
        selected_keys: selectedNodes.map((node) => node.key),
        mode: 'specified',
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/daily-metrics', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const date = parseDate(req.query.date);
      const data = await deps.metricsRepository.getByAirportAndDate(airportId, date);
      if (!data) {
        throw new HttpError(404, 'DAILY_METRICS_NOT_FOUND', `daily metrics not found for ${airportId}`);
      }
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/scores', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const date = parseDate(req.query.date);
      const data = await deps.scoreRepository.getByAirportAndDate(airportId, date);
      if (!data) {
        throw new HttpError(404, 'SCORE_NOT_FOUND', `score not found for ${airportId}`);
      }
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/airports/:id/scores/:date/manual-total-score', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const date = parseDate(req.params.date);
      const totalScore = parseManualTotalScore((req.body ?? {}).total_score);
      const existingScore = await deps.scoreRepository.getByAirportAndDate(airportId, date);
      if (!existingScore) {
        throw new HttpError(404, 'SCORE_NOT_FOUND', `score not found for ${airportId}`);
      }
      if (!deps.scoreRepository.updateManualTotalScore) {
        throw new HttpError(500, 'SCORE_REPOSITORY_UNAVAILABLE', 'manual score update is unavailable');
      }

      const updated = await deps.scoreRepository.updateManualTotalScore(airportId, date, totalScore);
      if (!updated) {
        throw new HttpError(404, 'SCORE_NOT_FOUND', `score not found for ${airportId}`);
      }

      await deps.auditRepository.log('update_manual_total_score', actorFromReq(req), req.requestId, {
        airport_id: airportId,
        date,
        manual_total_score: totalScore,
      });
      res.json({ airport_id: airportId, date, manual_total_score: totalScore });
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/dashboard', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const date = parseDate(req.query.date);
      const [base, metrics, score, performanceRun, latestPerformanceRun, performanceRuns, dayProbeSamples, latestAvailableScoreDate] = await Promise.all([
        deps.airportRepository.getById(airportId),
        deps.metricsRepository.getByAirportAndDate(airportId, date),
        deps.scoreRepository.getByAirportAndDate(airportId, date),
        deps.performanceRunRepository.getLatestByAirportAndDate(airportId, date),
        deps.performanceRunRepository.getLatestByAirportBeforeDate(airportId, date),
        deps.performanceRunRepository.listByAirportAndDate?.(airportId, date) ?? Promise.resolve([]),
        deps.probeSampleRepository.listProbeSamples(airportId, date, undefined, 1),
        deps.scoreRepository.getLatestAvailableDate?.(date) ?? null,
      ]);

      if (!base) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }

      const metricsObj = (metrics || {}) as Record<string, unknown>;
      const scoreObj = (score || {}) as Record<string, unknown>;
      const performanceRunObj = (performanceRun || {}) as Record<string, unknown>;
      const latestPerformanceRunObj = ((latestPerformanceRun || performanceRun) || {}) as Record<string, unknown>;
      const details = ((scoreObj.details as Record<string, unknown>) || {}) as Record<string, unknown>;
      const latencySamples = numberArrayOrEmpty(metricsObj.latency_samples_ms);
      const latencyStats = computeLatencyStats(latencySamples);
      const effectiveLatencyStats = computeEffectiveLatencyStats(latencySamples);
      const uptimePercentToday =
        numberOrNull(metricsObj.uptime_percent_today) ??
        numberOrNull(metricsObj.uptime_percent_30d) ??
        0;
      const latencyCv = numberOrNull(metricsObj.latency_cv) ?? latencyStats.cv;
      const effectiveLatencyCv =
        numberOrNull(details.effective_latency_cv) ??
        effectiveLatencyStats.cv ??
        latencyCv;
      const stableDaysStreak = numberOrNull(metricsObj.stable_days_streak);
      const healthyDaysStreak = numberOrNull(metricsObj.healthy_days_streak) ?? stableDaysStreak;
      const stabilityTier =
        stabilityTierOrNull(metricsObj.stability_tier) ??
        getStabilityTier(uptimePercentToday, latencySamples);
      const uptimeScore =
        numberOrNull(details.uptime_score) ?? computeUptimeScore(uptimePercentToday);
      const stabilityScore =
        numberOrNull(details.stability_score) ?? computeStabilityScore(effectiveLatencyCv);
      const streakScore =
        numberOrNull(details.streak_score) ??
        computeStreakScore(healthyDaysStreak ?? stableDaysStreak ?? 0);
      const sScore =
        numberOrNull(scoreObj.s) ??
        computeSScore(uptimeScore, stabilityScore, streakScore);
      const baseObj = (base || {}) as Record<string, unknown>;
      const scoreTrend = await deps.scoreRepository.getTrend(
        airportId,
        String(baseObj.created_at || date),
        date,
      );
      const scoreTrendRows = scoreTrend as Array<Record<string, unknown>>;
      const hasScore = Boolean(score);
      const finalEngineScore = hasScore
        ? computeFinalEngineScore({
          sSeries: scoreTrendRows
            .filter((row) => numberOrNull(row.s) !== null)
            .map((row) => ({ date: String(row.date), score: Number(row.s) })),
          pSeries: scoreTrendRows
            .filter((row) => numberOrNull(row.p) !== null)
            .map((row) => ({ date: String(row.date), score: Number(row.p) })),
          rSeries: scoreTrendRows
            .filter((row) => numberOrNull(row.r) !== null)
            .map((row) => ({ date: String(row.date), score: Number(row.r) })),
          pricePer100gb: Number(baseObj.plan_price_month || 0),
          referenceDate: date,
        })
        : null;
      const formulaTotalScore = finalEngineScore?.final_score ?? null;
      const manualTotalScore = numberOrNull(details.manual_total_score);
      const displayTotalScore = manualTotalScore ?? formulaTotalScore;
      const hasMetrics = Boolean(metrics);
      const hasProbeSamples = dayProbeSamples.length > 0;
      const publicResolvedDate = hasScore ? date : latestAvailableScoreDate;
      const resolvedFromFallback =
        !hasScore &&
        typeof publicResolvedDate === 'string' &&
        publicResolvedDate.length > 0 &&
        publicResolvedDate !== date;
      const pipelineStage = hasScore
        ? 'ready'
        : hasMetrics
          ? 'metrics_pending_score'
          : hasProbeSamples
            ? 'samples_pending_aggregation'
            : 'empty';
      const pipelineMessage =
        pipelineStage === 'metrics_pending_score'
          ? resolvedFromFallback
            ? `${date} 的日聚合已完成，但公开分数与榜单尚未生成；用户端当前仍会回退展示 ${publicResolvedDate}。`
            : `${date} 的日聚合已完成，但公开分数与榜单尚未生成。`
          : pipelineStage === 'samples_pending_aggregation'
            ? `${date} 的原始样本已采集，但日聚合尚未完成；稳定性卡片正在等待写入每日指标。`
            : pipelineStage === 'empty'
              ? `${date} 暂无采样或聚合结果。`
              : null;

      const hasPerformanceMetrics =
        numberOrNull(metricsObj.median_latency_ms) !== null ||
        numberOrNull(metricsObj.median_download_mbps) !== null ||
        numberOrNull(metricsObj.packet_loss_percent) !== null;
      const latestPerformanceDate =
        stringOrNull(latestPerformanceRunObj.sampled_at)?.slice(0, 10) ?? null;
      const performanceDiagnostics = toObjectOrEmpty(latestPerformanceRunObj.diagnostics);
      const includedPerformanceProbeIds = new Set(
        toSafeStringList(metricsObj.performance_included_probe_ids),
      );
      const performanceDataMode =
        performanceRun
          ? '当日实测'
          : hasPerformanceMetrics && latestPerformanceDate
            ? '历史缓存'
            : '无性能数据';
      const groupedPerformanceRuns = await Promise.all(
        (performanceRuns as PerformanceRun[]).map(async (run) => {
          const targets = deps.performanceRunTargetRepository
            ? await deps.performanceRunTargetRepository.listByRun(run.id)
            : [];
          return buildAdminPerformanceProbeRun(run, targets, includedPerformanceProbeIds);
        }),
      );

      res.json({
        date,
        pipeline: {
          stage: pipelineStage,
          message: pipelineMessage,
          has_probe_samples: hasProbeSamples,
          has_metrics: hasMetrics,
          has_score: hasScore,
          public_resolved_date: publicResolvedDate,
          resolved_from_fallback: resolvedFromFallback,
        },
        base: {
          ...baseObj,
          total_score: displayTotalScore,
          formula_total_score: formulaTotalScore,
          manual_total_score: manualTotalScore,
          total_score_source: manualTotalScore !== null ? 'manual' : formulaTotalScore !== null ? 'formula' : null,
          price_score: calcPriceScore(Number(baseObj.plan_price_month || 0)),
          score_data_days: finalEngineScore?.data_days ?? null,
        },
        stability: {
          uptime_percent_30d: numberOrNull(metricsObj.uptime_percent_30d),
          uptime_percent_today: numberOrNull(metricsObj.uptime_percent_today),
          latency_samples_ms: latencySamples,
          latency_mean_ms: numberOrNull(metricsObj.latency_mean_ms) ?? latencyStats.meanMs,
          latency_std_ms: numberOrNull(metricsObj.latency_std_ms) ?? latencyStats.stdMs,
          latency_cv: latencyCv,
          effective_latency_cv: effectiveLatencyCv,
          download_samples_mbps: numberArrayOrEmpty(metricsObj.download_samples_mbps),
          stable_days_streak: stableDaysStreak,
          healthy_days_streak: healthyDaysStreak,
          is_stable_day:
            boolOrNull(metricsObj.is_stable_day) ??
            isStableDay(uptimePercentToday, latencySamples),
          stability_tier: stabilityTier,
          s: sScore,
          uptime_score: uptimeScore,
          stability_score: stabilityScore,
          streak_score: streakScore,
          stability_rule_version:
            stringOrNull(details.stability_rule_version) ?? STABILITY_RULES.ruleVersion,
        },
        performance: {
          median_latency_ms: numberOrNull(metricsObj.median_latency_ms),
          median_download_mbps: numberOrNull(metricsObj.median_download_mbps),
          packet_loss_percent: numberOrNull(metricsObj.packet_loss_percent),
          p: numberOrNull(scoreObj.p),
          latency_score: numberOrNull(details.latency_score),
          speed_score: numberOrNull(details.speed_score),
          loss_score: numberOrNull(details.loss_score),
          performance_rule_summary: stringOrNull(metricsObj.performance_rule_summary),
          included_probe_ids: toSafeStringList(metricsObj.performance_included_probe_ids),
          pending_probe_ids: toSafeStringList(metricsObj.performance_pending_probe_ids),
          review_status: stringOrNull(metricsObj.performance_review_status),
          probe_runs: groupedPerformanceRuns,
          data_source_mode: performanceDataMode,
          cache_source_date: performanceRun ? null : latestPerformanceDate,
          collect_status: stringOrNull(latestPerformanceRunObj.status),
          last_sampled_at: stringOrNull(latestPerformanceRunObj.sampled_at),
          last_source: stringOrNull(latestPerformanceRunObj.source),
          subscription_format: stringOrNull(latestPerformanceRunObj.subscription_format),
          node_source: stringOrNull(performanceDiagnostics.node_source),
          cache_snapshot_id: numberOrNull(performanceDiagnostics.cache_snapshot_id),
          cache_captured_at: stringOrNull(performanceDiagnostics.cache_captured_at),
          cache_subscription_url_matches_current: boolOrNull(
            performanceDiagnostics.cache_subscription_url_matches_current,
          ),
          subscription_refresh_error_code: stringOrNull(
            performanceDiagnostics.subscription_refresh_error_code,
          ),
          subscription_refresh_error_message: stringOrNull(
            performanceDiagnostics.subscription_refresh_error_message,
          ),
          parsed_nodes_count: numberOrNull(latestPerformanceRunObj.parsed_nodes_count),
          supported_nodes_count: numberOrNull(latestPerformanceRunObj.supported_nodes_count),
          available_nodes_count: numberOrNull(latestPerformanceRunObj.available_nodes_count),
          unavailable_nodes_count: numberOrNull(latestPerformanceRunObj.unavailable_nodes_count),
          node_availability_percent: numberOrNull(latestPerformanceRunObj.node_availability_percent),
          node_unavailability_percent: numberOrNull(latestPerformanceRunObj.node_unavailability_percent),
          selected_nodes: performanceNodesOrEmpty(latestPerformanceRunObj.selected_nodes),
          tested_nodes: performanceNodesOrEmpty(latestPerformanceRunObj.tested_nodes),
          tested_nodes_count: performanceNodesOrEmpty(latestPerformanceRunObj.tested_nodes).length,
          tested_region_count: numberOrNull(performanceDiagnostics.tested_region_count),
          error_code: stringOrNull(latestPerformanceRunObj.error_code),
          error_message: stringOrNull(latestPerformanceRunObj.error_message),
          latency_measurement: stringOrNull(performanceDiagnostics.latency_measurement),
          latency_probe_target: stringOrNull(performanceDiagnostics.latency_probe_target),
          proxy_http_test_url: stringOrNull(performanceDiagnostics.proxy_http_test_url),
          proxy_http_median_latency_ms: numberOrNull(
            performanceDiagnostics.proxy_http_median_latency_ms,
          ),
          packet_loss_measurement: stringOrNull(performanceDiagnostics.packet_loss_measurement),
          packet_loss_test_url: stringOrNull(performanceDiagnostics.packet_loss_test_url),
          packet_loss_failed_attempts: numberOrNull(performanceDiagnostics.packet_loss_failed_attempts),
          packet_loss_total_attempts: numberOrNull(performanceDiagnostics.packet_loss_total_attempts),
          packet_loss_attempts_per_node: numberOrNull(performanceDiagnostics.packet_loss_attempts_per_node),
          speed_measurement: stringOrNull(performanceDiagnostics.speed_measurement),
          speed_test_url: stringOrNull(performanceDiagnostics.speed_test_url),
          speed_test_connections: numberOrNull(performanceDiagnostics.speed_test_connections),
          node_availability_check: stringOrNull(performanceDiagnostics.node_availability_check),
          node_availability_error_summary:
            Array.isArray(performanceDiagnostics.node_availability_error_summary)
              ? performanceDiagnostics.node_availability_error_summary
              : [],
        },
        risk: {
          domain_ok: boolOrNull(metricsObj.domain_ok),
          ssl_days_left: numberOrNull(metricsObj.ssl_days_left),
          recent_complaints_count: numberOrNull(metricsObj.recent_complaints_count),
          history_incidents: numberOrNull(metricsObj.history_incidents),
          domain_penalty: numberOrNull(details.domain_penalty),
          ssl_penalty: numberOrNull(details.ssl_penalty),
          complaint_penalty: numberOrNull(details.complaint_penalty),
          history_penalty: numberOrNull(details.history_penalty),
          node_availability_penalty: numberOrNull(details.node_availability_penalty),
          total_penalty:
            numberOrNull(details.total_penalty) ??
            numberOrNull(scoreObj.risk_penalty),
          risk_penalty: numberOrNull(scoreObj.risk_penalty),
          r: numberOrNull(scoreObj.r),
          risk_level: stringOrNull(details.risk_level),
        },
        time_decay: {
          date,
          recent_score_cache: hasScore ? numberOrNull(scoreObj.recent_score) : null,
          historical_score_cache: hasScore ? numberOrNull(scoreObj.historical_score) : null,
          score: hasScore ? numberOrNull(scoreObj.score) : null,
          recent_score: hasScore ? numberOrNull(scoreObj.recent_score) : null,
          historical_score: hasScore ? numberOrNull(scoreObj.historical_score) : null,
          final_score: hasScore ? numberOrNull(scoreObj.final_score) : null,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/report-preview', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const date = parseDate(req.query.date);
      const report = await deps.publicViewService.getReportView(airportId, date);
      if (!report) {
        throw new HttpError(
          404,
          'REPORT_NOT_FOUND',
          `report preview not found for airport ${airportId} date ${date}`,
        );
      }

      res.json({
        ...report,
        debug: {
          airport_id: airportId,
          date,
          preview_mode: 'admin',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/monthly-report-markdown', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const { year, month } = parseMonthlyReportPeriod(req.query.year, req.query.month);
      if (!isCompletedReportMonth(year, month, getDateInTimezone())) {
        throw new HttpError(400, 'BAD_REQUEST', '只能导出已经完成的月份报告');
      }

      const requestedDate = getMonthEndDate(year, month);
      const report = await deps.publicViewService.getReportView(airportId, requestedDate);
      if (!report || !isSameReportMonth(report.date, year, month)) {
        throw new HttpError(404, 'REPORT_NOT_FOUND', `${year}-${pad2(month)} 暂无可导出的月度报告数据`);
      }

      const markdown = buildMonthlyMarkdownReport({
        report,
        year,
        month,
        requestedDate,
        siteOrigin: getSiteOrigin(req),
      });
      const filename = buildMonthlyReportFilename(report.airport.name, year, month);
      const fallbackFilename = `GateRank-${airportId}-${year}-${pad2(month)}-monthly-report.md`;
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fallbackFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      );
      res.send(markdown);
    } catch (error) {
      next(error);
    }
  });

  router.get('/pages/home-preview', async (req, res, next) => {
    try {
      const date = parseDate(req.query.date);
      const page = await deps.publicViewService.getHomePageView(date);
      res.json({
        ...(page as Record<string, unknown>),
        debug: {
          date,
          preview_mode: 'admin',
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/airports/:id/manual-jobs', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const airport = (await deps.airportRepository.getById(airportId)) as {
        status?: AirportStatus;
        is_listed?: boolean;
      } | null;
      if (!airport) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }
      if (airport.status === 'down') {
        throw new HttpError(409, 'AIRPORT_DOWN_MANUAL_JOB_DISABLED', '已跑路机场已停止手动测评与风险体检');
      }
      if (airport.is_listed === false) {
        throw new HttpError(409, 'AIRPORT_UNLISTED_MANUAL_JOB_DISABLED', '已下架机场已停止手动测评与风险体检');
      }
      const payload = req.body ?? {};
      const date = parseDate(payload.date);
      const kind = toManualJobKind(payload.kind);
      const job = await deps.manualJobService.createJob({
        airportId,
        date,
        kind,
        createdBy: actorFromReq(req),
        requestId: req.requestId,
      });
      res.status(202).json(job);
    } catch (error) {
      if (error instanceof Error && error.message.includes('已有执行中的任务')) {
        next(new HttpError(409, 'MANUAL_JOB_CONFLICT', error.message));
        return;
      }
      next(error);
    }
  });

  router.get('/manual-jobs/:id', async (req, res, next) => {
    try {
      const jobId = toPositiveInt(req.params.id, 0);
      if (jobId <= 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'job id must be positive integer');
      }
      const job = await deps.manualJobService.getJob(jobId);
      if (!job) {
        throw new HttpError(404, 'MANUAL_JOB_NOT_FOUND', `manual job ${jobId} not found`);
      }
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  router.post('/jobs/aggregate', async (req, res, next) => {
    try {
      const date = parseDate(req.query.date);
      const result = await deps.aggregationService.aggregateForDate(date);
      await deps.auditRepository.log('aggregate_metrics', actorFromReq(req), req.requestId, { date, result });
      res.json({ date, ...result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/metrics/daily', async (req, res, next) => {
    try {
      const payload = req.body ?? {};
      const latencySamples = toNumberArray(payload.latency_samples_ms ?? []);
      const latencyStats = computeLatencyStats(latencySamples);
      const uptimePercentToday = optionalNumber(payload.uptime_percent_today);
      const derivedUptimePercentToday =
        uptimePercentToday === undefined
          ? mustNumber(payload.uptime_percent_30d, 'uptime_percent_30d')
          : uptimePercentToday;
      const stabilityTier =
        optionalStabilityTier(payload.stability_tier) ??
        getStabilityTier(derivedUptimePercentToday, latencySamples);
      const input: DailyMetricsInput = {
        airport_id: toAirportId(payload.airport_id),
        date: parseDate(payload.date),
        uptime_percent_30d: mustNumber(payload.uptime_percent_30d, 'uptime_percent_30d'),
        uptime_percent_today: derivedUptimePercentToday,
        latency_samples_ms: latencySamples,
        latency_mean_ms: optionalNumber(payload.latency_mean_ms) ?? latencyStats.meanMs,
        latency_std_ms: optionalNumber(payload.latency_std_ms) ?? latencyStats.stdMs,
        latency_cv: optionalNumber(payload.latency_cv) ?? latencyStats.cv,
        download_samples_mbps: toNumberArray(payload.download_samples_mbps ?? []),
        median_latency_ms: mustNumber(payload.median_latency_ms, 'median_latency_ms'),
        median_download_mbps: mustNumber(payload.median_download_mbps, 'median_download_mbps'),
        packet_loss_percent: mustNumber(payload.packet_loss_percent, 'packet_loss_percent'),
        stable_days_streak: mustNumber(payload.stable_days_streak, 'stable_days_streak'),
        healthy_days_streak:
          optionalNumber(payload.healthy_days_streak) ??
          mustNumber(payload.stable_days_streak, 'stable_days_streak'),
        is_stable_day:
          optionalBoolean(payload.is_stable_day) ??
          isStableDay(derivedUptimePercentToday, latencySamples),
        stability_tier: stabilityTier,
        domain_ok: Boolean(payload.domain_ok),
        ssl_days_left: optionalNumber(payload.ssl_days_left) ?? null,
        recent_complaints_count: mustNumber(payload.recent_complaints_count ?? 0, 'recent_complaints_count'),
        history_incidents: mustNumber(payload.history_incidents ?? 0, 'history_incidents'),
      };

      await deps.metricsRepository.upsertDaily(input);
      await deps.auditRepository.log('upsert_daily_metrics', actorFromReq(req), req.requestId, input);
      res.status(201).json({ airport_id: input.airport_id, date: input.date });
    } catch (error) {
      next(error);
    }
  });

  router.post('/scores/recompute', async (req, res, next) => {
    try {
      const date = parseDate(req.query.date);
      const result = await deps.recomputeService.recomputeForDate(date);
      await deps.auditRepository.log('recompute_scores', actorFromReq(req), req.requestId, {
        date,
        result,
      });
      res.json({ date, ...result });
    } catch (error) {
      next(error);
    }
  });

  router.post('/performance-runs', async (req, res, next) => {
    try {
      const payload = req.body ?? {};
      const input = toPerformanceRunInput(payload);

      for (const [index, latency] of (input.latency_samples_ms || []).entries()) {
        await deps.probeSampleRepository.insertProbeSample({
          airport_id: input.airport_id,
          sampled_at: input.latency_sampled_at?.[index] || input.sampled_at,
          sample_type: 'latency',
          probe_scope: 'performance',
          latency_ms: latency,
          source: input.source,
        });
      }

      for (const download of input.download_samples_mbps || []) {
        await deps.probeSampleRepository.insertProbeSample({
          airport_id: input.airport_id,
          sampled_at: input.sampled_at,
          sample_type: 'download',
          probe_scope: 'performance',
          download_mbps: download,
          source: input.source,
        });
      }

      if (input.packet_loss_percent !== undefined) {
        await deps.probeSampleRepository.insertPacketLossSample({
          airport_id: input.airport_id,
          sampled_at: input.sampled_at,
          sample_type: 'latency',
          probe_scope: 'performance',
          packet_loss_percent: input.packet_loss_percent,
          source: input.source,
        });
      }

      const runId = await deps.performanceRunRepository.insert(input);
      const targets = toPerformanceRunTargets(payload.target_results, runId);
      if (targets.length > 0) {
        if (!deps.performanceRunTargetRepository) {
          throw new Error('performanceRunTargetRepository is not configured');
        }
        await deps.performanceRunTargetRepository.insertMany(targets);
      }
      await deps.auditRepository.log('insert_performance_run', actorFromReq(req), req.requestId, input);
      res.status(201).json({ run_id: runId, airport_id: input.airport_id, sampled_at: input.sampled_at });
    } catch (error) {
      next(error);
    }
  });

  router.post('/complaints', async (req, res, next) => {
    try {
      const payload = req.body ?? {};
      const airportId = toAirportId(payload.airport_id);
      const date = parseDate(payload.date);
      const count = mustNumber(payload.count ?? 1, 'count');
      const mode = payload.mode === 'set' ? 'set' : 'increment';

      await deps.metricsRepository.patchComplaintCount(airportId, date, count, mode);
      await deps.auditRepository.log('patch_complaints', actorFromReq(req), req.requestId, {
        airport_id: airportId,
        date,
        count,
        mode,
      });
      res.json({ airport_id: airportId, date, count, mode });
    } catch (error) {
      next(error);
    }
  });

  router.post('/incidents', async (req, res, next) => {
    try {
      const payload = req.body ?? {};
      const airportId = toAirportId(payload.airport_id);
      const date = parseDate(payload.date);
      const count = mustNumber(payload.count ?? 1, 'count');
      const mode = payload.mode === 'set' ? 'set' : 'increment';

      await deps.metricsRepository.patchIncidentCount(airportId, date, count, mode);
      await deps.auditRepository.log('patch_incidents', actorFromReq(req), req.requestId, {
        airport_id: airportId,
        date,
        count,
        mode,
      });
      res.json({ airport_id: airportId, date, count, mode });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function getTelegramNotificationService(deps: AdminDeps): NonNullable<AdminDeps['telegramNotificationService']> {
  if (!deps.telegramNotificationService) {
    throw new Error('telegramNotificationService is not configured');
  }
  return deps.telegramNotificationService;
}

function getUserTelegramBotSettingsService(
  deps: AdminDeps,
): NonNullable<AdminDeps['userTelegramBotSettingsService']> {
  if (!deps.userTelegramBotSettingsService) {
    throw new Error('userTelegramBotSettingsService is not configured');
  }
  return deps.userTelegramBotSettingsService;
}

function getSchedulerService(deps: AdminDeps): NonNullable<AdminDeps['schedulerService']> {
  if (!deps.schedulerService) {
    throw new Error('schedulerService is not configured');
  }
  return deps.schedulerService;
}

function getMarketingRepository(deps: AdminDeps): NonNullable<AdminDeps['marketingRepository']> {
  if (!deps.marketingRepository) {
    throw new Error('marketingRepository is not configured');
  }
  return deps.marketingRepository;
}

function getAirportAdCampaignRepository(
  deps: AdminDeps,
): NonNullable<AdminDeps['airportAdCampaignRepository']> {
  if (!deps.airportAdCampaignRepository) {
    throw new Error('airportAdCampaignRepository is not configured');
  }
  return deps.airportAdCampaignRepository;
}

function parseAdminAirportAdStatus(value: unknown): AdminAirportAdStatusFilter {
  const status = value === undefined || value === '' ? 'all' : String(value);
  if (!['all', 'active', 'expired', 'canceled'].includes(status)) {
    throw new HttpError(400, 'BAD_REQUEST', 'status must be all, active, expired, or canceled');
  }
  return status as AdminAirportAdStatusFilter;
}

function parseAdminAirportAdPlacement(value: unknown): AdminAirportAdPlacementFilter {
  const placement = value === undefined || value === '' ? 'all' : String(value);
  if (placement !== 'all' && placement !== 'deal' && !AIRPORT_HOME_AD_SLOTS.some((slot) => placement === `home_${slot}`)) {
    throw new HttpError(400, 'BAD_REQUEST', 'placement must be all, deal, or a configured homepage slot');
  }
  return placement as AdminAirportAdPlacementFilter;
}

function parseDate(value: unknown): string {
  const date = String(value || getDateInTimezone());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'BAD_REQUEST', 'date must be YYYY-MM-DD');
  }
  return date;
}

function parseMonthlyReportPeriod(yearValue: unknown, monthValue: unknown): { year: number; month: number } {
  const year = Number(yearValue);
  const month = Number(monthValue);
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    throw new HttpError(400, 'BAD_REQUEST', 'year must be an integer between 2020 and 2100');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new HttpError(400, 'BAD_REQUEST', 'month must be an integer between 1 and 12');
  }
  return { year, month };
}

function isCompletedReportMonth(year: number, month: number, currentDate: string): boolean {
  const currentYear = Number(currentDate.slice(0, 4));
  const currentMonth = Number(currentDate.slice(5, 7));
  return year < currentYear || (year === currentYear && month < currentMonth);
}

function getMonthEndDate(year: number, month: number): string {
  const endDate = new Date(Date.UTC(year, month, 0));
  return endDate.toISOString().slice(0, 10);
}

function isSameReportMonth(date: string, year: number, month: number): boolean {
  return date.slice(0, 7) === `${year}-${pad2(month)}`;
}

function buildMonthlyReportFilename(airportName: string, year: number, month: number): string {
  const safeAirportName = airportName.trim().replace(/[\\/:*?"<>|\r\n]+/g, '-').replace(/\s+/g, '-');
  return `GateRank-${safeAirportName || 'airport'}-${year}-${pad2(month)}-monthly-report.md`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toAirportId(value: unknown): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'airport_id must be positive integer');
  }
  return num;
}

function mustString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value).trim();
}

function optionalDate(value: unknown, fieldName: string): string | undefined {
  const date = optionalString(value);
  if (date === undefined || date === '') {
    return undefined;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be YYYY-MM-DD`);
  }
  return date;
}

function mustNumber(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be number`);
  }
  return num;
}

function parsePositiveMoney(value: unknown, fieldName: string): number {
  const num = mustNumber(value, fieldName);
  if (num <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be positive number`);
  }
  return Math.round(num * 100) / 100;
}

function parseNonZeroMoney(value: unknown, fieldName: string): number {
  const amount = Number(mustNumber(value, fieldName).toFixed(2));
  if (amount === 0) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be non-zero number`);
  }
  return amount;
}

function formatAdminWalletAdjustmentDescription(amount: number): string {
  return amount > 0
    ? `后台加款 ¥${amount.toFixed(2)}`
    : `后台扣减 ¥${Math.abs(amount).toFixed(2)}`;
}

function isCodedError(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && String(error.code) === code;
}

function parseManualTotalScore(value: unknown): number | null {
  if (value === null) {
    return null;
  }
  if (value === undefined || value === '') {
    throw new HttpError(400, 'BAD_REQUEST', 'total_score is required');
  }
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    throw new HttpError(400, 'BAD_REQUEST', 'total_score must be a number between 0 and 100');
  }
  return Math.round(num * 100) / 100;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new HttpError(400, 'BAD_REQUEST', 'must be number');
  }
  return num;
}

function optionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return boolOrNull(value) ?? undefined;
}

function optionalStabilityTier(value: unknown): StabilityTier | undefined {
  if (
    value === 'stable' ||
    value === 'minor_fluctuation' ||
    value === 'volatile'
  ) {
    return value;
  }
  return undefined;
}

function parseMarketingGranularity(value: unknown): MarketingGranularity {
  const normalized = String(value || 'day').trim();
  if (normalized === 'hour' || normalized === 'day' || normalized === 'week' || normalized === 'month') {
    return normalized;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'granularity must be hour, day, week, or month');
}

function parseMarketingDateRange(dateFromValue: unknown, dateToValue: unknown): { dateFrom: string; dateTo: string } {
  const dateTo = dateToValue === undefined ? getDateInTimezone() : parseDate(dateToValue);
  const dateFrom = dateFromValue === undefined
    ? shiftDateString(dateTo, -29)
    : parseDate(dateFromValue);
  if (dateFrom > dateTo) {
    throw new HttpError(400, 'BAD_REQUEST', 'date_from cannot be after date_to');
  }
  return { dateFrom, dateTo };
}

function parseMarketingSourceLabel(value: unknown): string | undefined {
  const label = optionalString(value);
  return label || undefined;
}

function parseMarketingCountryCode(value: unknown): string | undefined {
  const countryCode = optionalString(value)?.toUpperCase();
  if (!countryCode) {
    return undefined;
  }
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new HttpError(400, 'BAD_REQUEST', 'country_code must be ISO 3166-1 alpha-2');
  }
  return countryCode;
}

function parseMarketingAirportSortBy(
  value: unknown,
): 'ctr' | 'clicks' | 'impressions' | 'last_clicked_at' {
  const normalized = String(value || 'ctr').trim();
  if (normalized === 'ctr' || normalized === 'clicks' || normalized === 'impressions' || normalized === 'last_clicked_at') {
    return normalized;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'sort_by must be ctr, clicks, impressions, or last_clicked_at');
}

function parseAirportListSortBy(value: unknown): AirportListSortBy {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'score' || normalized === 'balance') {
    return normalized;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'sort_by must be score or balance');
}

function parseSortOrder(value: unknown): 'asc' | 'desc' {
  const normalized = String(value || 'desc').trim().toLowerCase();
  if (normalized === 'asc' || normalized === 'desc') {
    return normalized;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'sort_order must be asc or desc');
}

function shiftDateString(dateString: string, offsetDays: number): string {
  const [year, month, day] = dateString.split('-').map((item) => Number(item));
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

function parseScheduleTime(value: unknown): string {
  const normalized = String(value ?? '').trim();
  if (!/^\d{2}:\d{2}$/.test(normalized)) {
    throw new HttpError(400, 'BAD_REQUEST', 'schedule_time must be HH:mm');
  }
  const [hour, minute] = normalized.split(':').map((part) => Number(part));
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new HttpError(400, 'BAD_REQUEST', 'schedule_time must be HH:mm');
  }
  return normalized;
}

function toSchedulerTaskKey(value: unknown): SchedulerTaskKey {
  const taskKey = String(value || '').trim();
  if (
    taskKey === 'stability'
    || taskKey === 'subscription_node_refresh'
    || taskKey === 'performance'
    || taskKey === 'risk'
    || taskKey === 'aggregate_recompute'
    || taskKey === 'billing_listing_sync'
    || taskKey === 'stability_resample_guard'
  ) {
    return taskKey;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'taskKey must be stability|subscription_node_refresh|performance|risk|aggregate_recompute|billing_listing_sync|stability_resample_guard');
}

function toSchedulerRunStatus(value: unknown): SchedulerRunStatus {
  const status = String(value || '').trim();
  if (status === 'running' || status === 'succeeded' || status === 'failed') {
    return status;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'status must be running|succeeded|failed');
}

function parseTelegramSettingsPayload(
  payload: Record<string, unknown>,
  allowPartial: boolean,
): TelegramNotificationSettingsInput {
  const enabled = optionalBoolean(payload.enabled);
  if (!allowPartial && enabled === undefined) {
    throw new HttpError(400, 'BAD_REQUEST', 'enabled must be boolean');
  }

  const deliveryMode = parseDeliveryMode(payload.delivery_mode, allowPartial);
  const telegramChat = parseTelegramChatSettingsPayload(
    payload.telegram_chat,
    allowPartial,
  );
  const webhook = parseWebhookSettingsPayload(payload.webhook, allowPartial);

  return {
    enabled,
    delivery_mode: deliveryMode,
    telegram_chat: telegramChat,
    webhook,
  };
}

function parseUserTelegramBotSettingsPayload(
  payload: Record<string, unknown>,
): UserTelegramBotSettingsInput {
  return {
    enabled: optionalBoolean(payload.enabled),
    bot_token: payload.bot_token === undefined ? undefined : String(payload.bot_token ?? '').trim(),
    api_base:
      payload.api_base === undefined
        ? undefined
        : String(payload.api_base || DEFAULT_USER_TELEGRAM_API_BASE).trim(),
    webhook_origin: payload.webhook_origin === undefined ? undefined : String(payload.webhook_origin ?? '').trim(),
    webhook_secret: payload.webhook_secret === undefined ? undefined : String(payload.webhook_secret ?? '').trim(),
    templates:
      payload.templates === undefined
        ? undefined
        : parseUserTelegramBotTemplatePayload(payload.templates),
  };
}

function parseUserTelegramBotTemplatePayload(
  value: unknown,
): NonNullable<UserTelegramBotSettingsInput['templates']> {
  const payload = toPlainObject(value, 'templates');
  const templates: NonNullable<UserTelegramBotSettingsInput['templates']> = {};

  for (const key of USER_TELEGRAM_BOT_TEMPLATE_KEYS) {
    if (payload[key] === undefined) {
      continue;
    }
    const item = toPlainObject(payload[key], `templates.${key}`);
    templates[key] = {
      enabled: item.enabled === undefined ? undefined : optionalBoolean(item.enabled),
      body: item.body === undefined ? undefined : String(item.body ?? '').trim(),
    };
  }

  return templates;
}

function parseMediaLibrarySettingsPayload(
  payload: Record<string, unknown>,
): MediaLibrarySettingsInput {
  const providers = toPlainObject(payload.providers, 'providers');
  const pexels = parsePexelsMediaLibraryPayload(providers.pexels);

  return {
    providers: {
      pexels,
    },
  };
}

function parsePaymentGatewaySettingsPayload(
  payload: Record<string, unknown>,
): PaymentGatewaySettingsInput {
  return {
    enabled: optionalBoolean(payload.enabled),
    epay:
      payload.epay === undefined
        ? undefined
        : parsePaymentGatewayEpaySettingsPayload(payload.epay),
    pid: payload.pid === undefined ? undefined : String(payload.pid ?? '').trim(),
    private_key:
      payload.private_key === undefined ? undefined : String(payload.private_key ?? '').trim(),
    platform_public_key:
      payload.platform_public_key === undefined
        ? undefined
        : String(payload.platform_public_key ?? '').trim(),
    notify_origin:
      payload.notify_origin === undefined ? undefined : String(payload.notify_origin ?? '').trim(),
    usdt:
      payload.usdt === undefined
        ? undefined
        : parsePaymentGatewayUsdtSettingsPayload(payload.usdt),
  };
}

function parsePaymentGatewayEpaySettingsPayload(payload: unknown) {
  const record = toPlainObject(payload, 'epay');
  return {
    enabled: optionalBoolean(record.enabled),
  };
}

function parsePaymentGatewayUsdtSettingsPayload(payload: unknown) {
  const record = toPlainObject(payload, 'usdt');
  return {
    enabled: optionalBoolean(record.enabled),
    gateway_url:
      record.gateway_url === undefined ? undefined : String(record.gateway_url ?? '').trim(),
    merchant_id:
      record.merchant_id === undefined ? undefined : String(record.merchant_id ?? '').trim(),
    secret_key:
      record.secret_key === undefined ? undefined : String(record.secret_key ?? '').trim(),
  };
}

function parseMarketingSettingsPayload(
  payload: Record<string, unknown>,
): MarketingSettingsInput {
  return {
    application_fee_amount:
      payload.application_fee_amount === undefined
        ? undefined
        : mustNumber(payload.application_fee_amount, 'application_fee_amount'),
    click_charge_amount:
      payload.click_charge_amount === undefined
        ? undefined
        : mustNumber(payload.click_charge_amount, 'click_charge_amount'),
    rank_click_charge_amounts:
      payload.rank_click_charge_amounts === undefined
        ? undefined
        : parseRankClickChargeAmountsPayload(payload.rank_click_charge_amounts),
    airport_ad_monthly_price:
      payload.airport_ad_monthly_price === undefined
        ? undefined
        : mustNumber(payload.airport_ad_monthly_price, 'airport_ad_monthly_price'),
    home_ad_slot_monthly_prices:
      payload.home_ad_slot_monthly_prices === undefined
        ? undefined
        : parseHomeAdSlotMonthlyPricesPayload(payload.home_ad_slot_monthly_prices),
    recharge_amounts:
      payload.recharge_amounts === undefined
        ? undefined
        : parseRechargeAmountsPayload(payload.recharge_amounts),
    admin_telegram_username:
      payload.admin_telegram_username === undefined
        ? undefined
        : optionalString(payload.admin_telegram_username),
    home_section_limits:
      payload.home_section_limits === undefined
        ? undefined
        : parseHomeSectionLimitsPayload(payload.home_section_limits),
  };
}

function parseHomeAdSlotMonthlyPricesPayload(
  payload: unknown,
): MarketingSettingsInput['home_ad_slot_monthly_prices'] {
  const record = toPlainObject(payload, 'home_ad_slot_monthly_prices');
  return Object.fromEntries(
    Object.entries(record).map(([slot, value]) => [
      slot,
      mustNumber(value, `home_ad_slot_monthly_prices.${slot}`),
    ]),
  ) as MarketingSettingsInput['home_ad_slot_monthly_prices'];
}

function parseRankClickChargeAmountsPayload(
  payload: unknown,
): Partial<RankClickChargeAmounts> {
  const record = toPlainObject(payload, 'rank_click_charge_amounts');
  return Object.fromEntries(
    Object.entries(record).map(([rank, value]) => [
      rank,
      value === null ? null : mustNumber(value, `rank_click_charge_amounts.${rank}`),
    ]),
  ) as Partial<RankClickChargeAmounts>;
}

function parseRechargeAmountsPayload(payload: unknown): number[] {
  if (!Array.isArray(payload)) {
    throw new HttpError(400, 'BAD_REQUEST', 'recharge_amounts must be array');
  }
  return payload.map((value, index) => mustNumber(value, `recharge_amounts.${index}`));
}

function parseHomeSectionLimitsPayload(payload: unknown): MarketingSettingsInput['home_section_limits'] {
  const record = toPlainObject(payload, 'home_section_limits');
  return {
    today_pick:
      record.today_pick === undefined
        ? undefined
        : mustNumber(record.today_pick, 'home_section_limits.today_pick'),
    most_stable:
      record.most_stable === undefined
        ? undefined
        : mustNumber(record.most_stable, 'home_section_limits.most_stable'),
    best_value:
      record.best_value === undefined
        ? undefined
        : mustNumber(record.best_value, 'home_section_limits.best_value'),
    new_entries:
      record.new_entries === undefined
        ? undefined
        : mustNumber(record.new_entries, 'home_section_limits.new_entries'),
    risk_alerts:
      record.risk_alerts === undefined
        ? undefined
        : mustNumber(record.risk_alerts, 'home_section_limits.risk_alerts'),
  };
}

function parseXOAuthSettingsPayload(payload: Record<string, unknown>): XOAuthSettingsInput {
  const codeChallengeMethod = payload.code_challenge_method === undefined
    ? undefined
    : String(payload.code_challenge_method) === 'S256'
      ? 'S256'
      : 'plain';

  return {
    enabled: payload.enabled === undefined ? undefined : optionalBoolean(payload.enabled),
    client_id: payload.client_id === undefined ? undefined : String(payload.client_id ?? '').trim(),
    client_secret:
      payload.client_secret === undefined ? undefined : String(payload.client_secret ?? '').trim(),
    redirect_uri: payload.redirect_uri === undefined ? undefined : String(payload.redirect_uri ?? '').trim(),
    authorize_url: payload.authorize_url === undefined ? undefined : String(payload.authorize_url ?? '').trim(),
    token_url: payload.token_url === undefined ? undefined : String(payload.token_url ?? '').trim(),
    me_url: payload.me_url === undefined ? undefined : String(payload.me_url ?? '').trim(),
    scope: payload.scope === undefined ? undefined : String(payload.scope ?? '').trim(),
    code_challenge_method: codeChallengeMethod,
  };
}

function parseSmtpSettingsPayload(
  payload: Record<string, unknown>,
  allowPartial: boolean,
): SmtpSettingsInput {
  return {
    enabled:
      payload.enabled === undefined
        ? allowPartial
          ? undefined
          : false
        : optionalBoolean(payload.enabled),
    host: payload.host === undefined ? undefined : String(payload.host ?? '').trim(),
    port:
      payload.port === undefined
        ? allowPartial
          ? undefined
          : 465
        : toPositiveIntOrThrow(payload.port, 'port'),
    secure: payload.secure === undefined ? undefined : optionalBoolean(payload.secure),
    username: payload.username === undefined ? undefined : String(payload.username ?? '').trim(),
    password: payload.password === undefined ? undefined : String(payload.password ?? '').trim(),
    from_name: payload.from_name === undefined ? undefined : String(payload.from_name ?? '').trim(),
    from_email:
      payload.from_email === undefined ? undefined : String(payload.from_email ?? '').trim(),
    reply_to: payload.reply_to === undefined ? undefined : String(payload.reply_to ?? '').trim(),
    templates:
      payload.templates === undefined
        ? undefined
        : parseSmtpTemplatePayload(payload.templates),
  };
}

function parseSmtpTemplatePayload(
  value: unknown,
): NonNullable<SmtpSettingsInput['templates']> {
  const payload = toPlainObject(value, 'templates');
  const templates: NonNullable<SmtpSettingsInput['templates']> = {};

  for (const key of SMTP_TEMPLATE_KEYS) {
    if (payload[key] === undefined) {
      continue;
    }
    const item = toPlainObject(payload[key], `templates.${key}`);
    templates[key] = {
      enabled: item.enabled === undefined ? undefined : optionalBoolean(item.enabled),
      subject: item.subject === undefined ? undefined : String(item.subject ?? '').trim(),
      body: item.body === undefined ? undefined : String(item.body ?? '').trim(),
    };
  }

  return templates;
}

const SMTP_TEMPLATE_KEYS: SmtpTemplateKey[] = [
  'applicant_credentials',
  'application_approved',
  'application_reply',
  'low_balance_warning',
  'airport_auto_unlisted',
  'airport_online',
];

const USER_TELEGRAM_BOT_TEMPLATE_KEYS: UserTelegramBotTemplateKey[] = [
  'low_balance_warning',
  'airport_auto_unlisted',
  'airport_online',
  'recharge_welcome',
];

function toSmtpTemplateKey(value: unknown): SmtpTemplateKey {
  const key = String(value || '').trim();
  if ((SMTP_TEMPLATE_KEYS as string[]).includes(key)) {
    return key as SmtpTemplateKey;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'template key must be valid SMTP template key');
}

function parsePexelsMediaLibraryPayload(
  value: unknown,
): NonNullable<MediaLibrarySettingsInput['providers']>['pexels'] {
  const payload = toPlainObject(value, 'providers.pexels');

  return {
    enabled: optionalBoolean(payload.enabled),
    api_key: payload.api_key === undefined ? undefined : String(payload.api_key ?? '').trim(),
    timeout_ms:
      payload.timeout_ms === undefined
        ? DEFAULT_MEDIA_LIBRARY_TIMEOUT_MS
        : toPositiveIntOrThrow(payload.timeout_ms, 'providers.pexels.timeout_ms'),
  };
}

function parsePublishTokenPayload(
  payload: Record<string, unknown>,
): {
  name: string;
  description?: string;
  scopes: AccessTokenScope[];
  expires_at?: string | null;
} {
  const name = String(payload.name || '').trim();
  if (!name) {
    throw new HttpError(400, 'BAD_REQUEST', 'name 不能为空');
  }

  const scopes = payload.scopes;
  if (!Array.isArray(scopes)) {
    throw new HttpError(400, 'BAD_REQUEST', 'scopes must be array');
  }

  return {
    name,
    description: payload.description === undefined ? undefined : String(payload.description ?? '').trim(),
    scopes: scopes.map((scope) => String(scope || '').trim()) as AccessTokenScope[],
    expires_at: payload.expires_at === undefined || payload.expires_at === null
      ? null
      : String(payload.expires_at).trim(),
  };
}

function parseDeliveryMode(
  value: unknown,
  allowPartial: boolean,
): NotificationDeliveryMode | undefined {
  if (value === undefined) {
    if (allowPartial) {
      return undefined;
    }
    throw new HttpError(400, 'BAD_REQUEST', 'delivery_mode must be telegram_chat|webhook');
  }
  if (value === 'telegram_chat' || value === 'webhook') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'delivery_mode must be telegram_chat|webhook');
}

function parseTelegramChatSettingsPayload(
  value: unknown,
  allowPartial: boolean,
): TelegramNotificationSettingsInput['telegram_chat'] {
  if (value === undefined) {
    if (allowPartial) {
      return undefined;
    }
    return {
      chat_id: '',
      api_base: DEFAULT_TELEGRAM_API_BASE,
      timeout_ms: DEFAULT_TELEGRAM_NOTIFY_TIMEOUT_MS,
    };
  }

  const payload = toPlainObject(value, 'telegram_chat');
  return {
    bot_token:
      payload.bot_token === undefined ? undefined : String(payload.bot_token ?? '').trim(),
    chat_id:
      payload.chat_id === undefined
        ? allowPartial
          ? undefined
          : ''
        : String(payload.chat_id ?? '').trim(),
    api_base:
      payload.api_base === undefined
        ? allowPartial
          ? undefined
          : DEFAULT_TELEGRAM_API_BASE
        : String(payload.api_base ?? '').trim(),
    timeout_ms:
      payload.timeout_ms === undefined
        ? allowPartial
          ? undefined
          : DEFAULT_TELEGRAM_NOTIFY_TIMEOUT_MS
        : toPositiveIntOrThrow(payload.timeout_ms, 'telegram_chat.timeout_ms'),
  };
}

function parseWebhookSettingsPayload(
  value: unknown,
  allowPartial: boolean,
): TelegramNotificationSettingsInput['webhook'] {
  if (value === undefined) {
    if (allowPartial) {
      return undefined;
    }
    return {
      url: '',
      timeout_ms: DEFAULT_WEBHOOK_NOTIFY_TIMEOUT_MS,
    };
  }

  const payload = toPlainObject(value, 'webhook');
  return {
    url:
      payload.url === undefined ? (allowPartial ? undefined : '') : String(payload.url ?? '').trim(),
    bearer_token:
      payload.bearer_token === undefined
        ? undefined
        : String(payload.bearer_token ?? '').trim(),
    timeout_ms:
      payload.timeout_ms === undefined
        ? allowPartial
          ? undefined
          : DEFAULT_WEBHOOK_NOTIFY_TIMEOUT_MS
        : toPositiveIntOrThrow(payload.timeout_ms, 'webhook.timeout_ms'),
  };
}

function toNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'must be number array');
  }
  return value.map((item) => {
    const num = Number(item);
    if (!Number.isFinite(num)) {
      throw new HttpError(400, 'BAD_REQUEST', 'must be number array');
    }
    return num;
  });
}

function toPlainObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be object`);
  }
  return value as Record<string, unknown>;
}

function toPositiveInt(value: unknown, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : fallback;
}

function toPositiveIntOrThrow(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be positive integer`);
  }
  return num;
}

function toBoundedPositiveInt(value: unknown, fallback: number, max: number): number {
  return Math.min(max, toPositiveInt(value, fallback));
}

function toBooleanFlag(value: unknown): boolean {
  if (value === true || value === 1) {
    return true;
  }
  if (value === false || value === 0) {
    return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return false;
}

function toNullableBooleanFlag(value: unknown, fieldName: string): boolean | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (value === true || value === 1) {
    return true;
  }
  if (value === false || value === 0) {
    return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no') {
      return false;
    }
  }
  throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be boolean or null`);
}

function ensureDownConfirmed(status: AirportStatus | undefined, confirmDown: unknown): void {
  if (status === 'down' && !toBooleanFlag(confirmDown)) {
    throw new HttpError(409, 'DOWN_STATUS_REQUIRES_CONFIRMATION', '将机场标记为跑路前，必须由管理员显式确认');
  }
}

function toStatus(value: unknown): AirportStatus {
  if (value === 'normal' || value === 'risk' || value === 'down') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'status must be normal|risk|down');
}

function toAirportStreamingSupportArray(value: unknown): AirportStreamingSupport[] {
  return toEnumArray(value, 'streaming_support', [
    'netflix',
    'chatgpt',
    'disney_plus',
    'hbo_max',
    'youtube_premium',
    'tiktok',
    'spotify',
  ]);
}

function toAirportPaymentMethodArray(value: unknown): AirportPaymentMethod[] {
  return toEnumArray(value, 'payment_methods', [
    'wechat',
    'alipay',
    'usdt_trc20',
    'usdt_erc20',
    'usdt_bep20',
    'stripe_card',
    'paypal',
    'crypto_other',
    'unionpay',
  ]);
}

function toEnumArray<T extends string>(value: unknown, fieldName: string, allowedValues: readonly T[]): T[] {
  const items = toStringArray(value, fieldName)
    .map((item) => item.trim())
    .filter(Boolean);
  const allowed = new Set(allowedValues);
  const invalid = items.find((item) => !allowed.has(item as T));
  if (invalid) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} contains unsupported value: ${invalid}`);
  }
  return [...new Set(items as T[])];
}

function toAirportListedFilter(value: unknown): boolean {
  if (value === 'listed') {
    return true;
  }
  if (value === 'unlisted') {
    return false;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'is_listed must be listed|unlisted');
}

function toAirportApplicationReviewStatus(value: unknown): AirportApplicationReviewStatus {
  if (
    value === 'awaiting_payment'
    || value === 'pending'
    || value === 'reviewed'
    || value === 'rejected'
  ) {
    return value;
  }
  throw new HttpError(
    400,
    'BAD_REQUEST',
    'review_status must be awaiting_payment|pending|reviewed|rejected',
  );
}

function toAirportApplicationPaymentStatus(value: unknown): AirportApplicationPaymentStatus {
  if (value === 'unpaid' || value === 'paid') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'payment_status must be unpaid|paid');
}

function toReviewStatus(
  value: unknown,
): Exclude<AirportApplicationReviewStatus, 'pending' | 'awaiting_payment'> {
  if (value === 'reviewed' || value === 'rejected') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'review_status must be reviewed|rejected');
}

function toSampleType(value: unknown): ProbeSampleType {
  if (value === 'latency' || value === 'download' || value === 'availability') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'sample_type must be latency|download|availability');
}

function toProbeScope(value: unknown): ProbeScope {
  if (value === 'stability' || value === 'performance') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'probe_scope must be stability|performance');
}

function toStringArray(value: unknown, fieldName = 'items'): string[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be array`);
  }
  return value.map((v) => String(v));
}

function parseWebsiteFields(
  payload: Record<string, unknown>,
  required: boolean,
): { website: string | undefined; websites: string[] | undefined } {
  const primaryWebsite = optionalString(payload.website);
  const websiteItems = payload.websites === undefined ? undefined : toStringArray(payload.websites, 'websites');
  const normalized = [primaryWebsite || '', ...(websiteItems || [])]
    .map((value) => value.trim())
    .filter(Boolean);
  const websites = [...new Set(normalized)];

  if (required && websites.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'website or websites is required');
  }

  if (!required && payload.website === undefined && payload.websites === undefined) {
    return { website: undefined, websites: undefined };
  }

  return {
    website: websites[0],
    websites,
  };
}

function mustDateTime(value: unknown, fieldName: string): string {
  const str = String(value || '');
  if (!str || Number.isNaN(new Date(str).getTime())) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be valid datetime`);
  }
  return formatSqlDateTimeInTimezone(str, 'Asia/Shanghai');
}

function validateProbeSample(input: ProbeSampleInput): void {
  if (input.sample_type === 'latency' && input.latency_ms === undefined) {
    throw new HttpError(400, 'BAD_REQUEST', 'latency sample requires latency_ms');
  }
  if (input.sample_type === 'download' && input.download_mbps === undefined) {
    throw new HttpError(400, 'BAD_REQUEST', 'download sample requires download_mbps');
  }
  if (input.sample_type === 'availability' && input.availability === undefined) {
    throw new HttpError(400, 'BAD_REQUEST', 'availability sample requires availability');
  }
}

function toPerformanceRunInput(payload: Record<string, unknown>): PerformanceRunInput {
  const latencySamples = toNumberArrayOrDefault(payload.latency_samples_ms);
  const latencySampledAt = toDateTimeArray(payload.latency_sampled_at, 'latency_sampled_at');
  const downloadSamples = toNumberArrayOrDefault(payload.download_samples_mbps);
  const packetLossPercent = optionalNumber(payload.packet_loss_percent);
  const medianLatency = optionalNumber(payload.median_latency_ms) ?? medianOrUndefined(latencySamples);
  const medianDownload = optionalNumber(payload.median_download_mbps) ?? medianOrUndefined(downloadSamples);

  return {
    airport_id: toAirportId(payload.airport_id),
    sampled_at: mustDateTime(payload.sampled_at, 'sampled_at'),
    source: optionalString(payload.source) || 'cron-performance',
    status: toPerformanceRunStatus(payload.status),
    probe_id: toOptionalPerformanceProbeId(payload.probe_id),
    run_mode: toOptionalPerformanceRunMode(payload.run_mode),
    test_profile: optionalString(payload.test_profile),
    scoring_rule_version: toOptionalPerformanceScoringRuleVersion(payload.scoring_rule_version),
    config_version: optionalNumber(payload.config_version),
    calibration_status: toOptionalPerformanceCalibrationStatus(payload.calibration_status),
    calibration_mbps: optionalNumber(payload.calibration_mbps) ?? null,
    subscription_format: optionalString(payload.subscription_format) || null,
    parsed_nodes_count: optionalNumber(payload.parsed_nodes_count) ?? 0,
    supported_nodes_count: optionalNumber(payload.supported_nodes_count) ?? 0,
    selected_nodes: toPerformanceNodeArray(payload.selected_nodes),
    tested_nodes: toPerformanceNodeArray(payload.tested_nodes),
    available_nodes_count: optionalNumber(payload.available_nodes_count),
    unavailable_nodes_count: optionalNumber(payload.unavailable_nodes_count),
    node_availability_percent: optionalNumber(payload.node_availability_percent),
    node_unavailability_percent: optionalNumber(payload.node_unavailability_percent),
    latency_samples_ms: latencySamples,
    latency_sampled_at: latencySampledAt,
    download_samples_mbps: downloadSamples,
    packet_loss_percent: packetLossPercent,
    median_latency_ms: medianLatency,
    median_download_mbps: medianDownload,
    error_code: optionalString(payload.error_code) || null,
    error_message: optionalString(payload.error_message) || null,
    diagnostics: toObjectOrEmpty(payload.diagnostics),
  };
}

function toPerformanceRunTargets(value: unknown, runId: number): PerformanceRunTarget[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'target_results must be an array');
  }
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, 'BAD_REQUEST', `target_results[${index}] must be an object`);
    }
    const row = item as Record<string, unknown>;
    const nodeKey = optionalString(row.node_key);
    const targetKey = optionalString(row.target_key);
    const bytesDownloaded = optionalNumber(row.bytes_downloaded);
    const durationMs = optionalNumber(row.duration_ms);
    if (!nodeKey || !targetKey) {
      throw new HttpError(400, 'BAD_REQUEST', `target_results[${index}] requires node_key and target_key`);
    }
    if (bytesDownloaded === undefined || bytesDownloaded < 0 || durationMs === undefined || durationMs < 0) {
      throw new HttpError(400, 'BAD_REQUEST', `target_results[${index}] byte and duration values must be non-negative`);
    }
    if (typeof row.valid !== 'boolean') {
      throw new HttpError(400, 'BAD_REQUEST', `target_results[${index}].valid must be boolean`);
    }
    return {
      run_id: runId,
      node_key: nodeKey,
      target_key: targetKey,
      bytes_downloaded: bytesDownloaded,
      duration_ms: durationMs,
      download_mbps: optionalNumber(row.download_mbps) ?? null,
      http_status: optionalNumber(row.http_status) ?? null,
      error_code: optionalString(row.error_code) || null,
      valid: row.valid,
    };
  });
}

function toOptionalPerformanceProbeId(value: unknown): PerformanceRunInput['probe_id'] {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'legacy-control' || value === 'cn-shanghai' || value === 'cn-guangzhou') return value;
  throw new HttpError(400, 'BAD_REQUEST', 'probe_id is invalid');
}

function toOptionalPerformanceRunMode(value: unknown): PerformanceRunInput['run_mode'] {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'official' || value === 'shadow') return value;
  throw new HttpError(400, 'BAD_REQUEST', 'run_mode must be official|shadow');
}

function toOptionalPerformanceScoringRuleVersion(
  value: unknown,
): PerformanceRunInput['scoring_rule_version'] {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'legacy_v1' || value === 'cn_dual_probe_v1') return value;
  throw new HttpError(400, 'BAD_REQUEST', 'scoring_rule_version is invalid');
}

function toOptionalPerformanceCalibrationStatus(
  value: unknown,
): PerformanceRunInput['calibration_status'] {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'not_required' || value === 'passed' || value === 'failed') return value;
  throw new HttpError(400, 'BAD_REQUEST', 'calibration_status is invalid');
}

function toSubscriptionNodeSnapshotInput(
  airportId: number,
  payload: Record<string, unknown>,
): SubscriptionNodeSnapshotInput {
  const payloadAirportId = payload.airport_id === undefined ? airportId : toAirportId(payload.airport_id);
  if (payloadAirportId !== airportId) {
    throw new HttpError(400, 'BAD_REQUEST', 'airport_id must match path airport id');
  }
  const nodes = toSubscriptionSnapshotNodeArray(payload.nodes);
  if (nodes.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'nodes must include at least one reusable node');
  }
  const unsupportedNodes = toUnsupportedSubscriptionNodeArray(payload.unsupported_nodes);
  return {
    airport_id: airportId,
    captured_at: mustDateTime(payload.captured_at, 'captured_at'),
    source: optionalString(payload.source) || 'cron-performance',
    subscription_url: optionalString(payload.subscription_url) || null,
    subscription_format: optionalString(payload.subscription_format) || null,
    parsed_nodes_count: optionalNumber(payload.parsed_nodes_count) ?? nodes.length + unsupportedNodes.length,
    supported_nodes_count: optionalNumber(payload.supported_nodes_count) ?? nodes.length,
    nodes,
    unsupported_nodes: unsupportedNodes,
  };
}

function toDateTimeArray(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be an array`);
  }
  return value.map((item, index) => mustDateTime(item, `${fieldName}[${index}]`));
}

function toPerformanceRunStatus(value: unknown): PerformanceRunInput['status'] {
  if (value === 'success' || value === 'partial' || value === 'skipped' || value === 'failed') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'status must be success|partial|skipped|failed');
}

function toManualJobKind(value: unknown): ManualJobKind {
  if (value === 'full' || value === 'stability' || value === 'performance' || value === 'risk' || value === 'time_decay') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'kind must be full|stability|performance|risk|time_decay');
}

function actorFromReq(req: { header(name: string): string | undefined }): string {
  return req.header('x-admin-actor') || 'admin';
}

function getMediaLibrarySettingsService(deps: AdminDeps) {
  if (!deps.mediaLibrarySettingsService) {
    throw new Error('mediaLibrarySettingsService is not configured');
  }
  return deps.mediaLibrarySettingsService;
}

function getApplicationPaymentOrderRepository(deps: AdminDeps) {
  if (!deps.applicationPaymentOrderRepository) {
    throw new Error('applicationPaymentOrderRepository is not configured');
  }
  return deps.applicationPaymentOrderRepository;
}

function getPaymentGatewaySettingsService(deps: AdminDeps) {
  if (!deps.paymentGatewaySettingsService) {
    throw new Error('paymentGatewaySettingsService is not configured');
  }
  return deps.paymentGatewaySettingsService;
}

async function getApplicationReplyContactInfo(
  deps: AdminDeps,
  req: {
    protocol?: string;
    headers?: Record<string, unknown>;
    header?(name: string): string | undefined;
  },
): Promise<{
  adminTelegramUsername: string;
  adminTelegramUrl: string;
  portalLoginUrl: string;
}> {
  const marketingConfig = deps.marketingSettingsService
    ? await deps.marketingSettingsService.getConfig()
    : null;
  const username = String(marketingConfig?.admin_telegram_username || '').trim();
  return {
    adminTelegramUsername: username ? `@${username}` : '未配置',
    adminTelegramUrl: username ? `https://t.me/${username}` : '未配置',
    portalLoginUrl: buildPortalLoginUrl(req),
  };
}

function getMarketingSettingsService(deps: AdminDeps) {
  if (!deps.marketingSettingsService) {
    throw new Error('marketingSettingsService is not configured');
  }
  return deps.marketingSettingsService;
}

function getSmtpSettingsService(deps: AdminDeps) {
  if (!deps.smtpSettingsService) {
    throw new Error('smtpSettingsService is not configured');
  }
  return deps.smtpSettingsService;
}

function getXOAuthSettingsService(deps: AdminDeps) {
  if (!deps.xOAuthSettingsService) {
    throw new Error('xOAuthSettingsService is not configured');
  }
  return deps.xOAuthSettingsService;
}

function getMailService(deps: AdminDeps) {
  if (!deps.mailService) {
    throw new Error('mailService is not configured');
  }
  return deps.mailService;
}

function getApplicantAccountRepository(deps: AdminDeps): Required<NonNullable<AdminDeps['applicantAccountRepository']>> {
  if (!deps.applicantAccountRepository?.getByAirportId || !deps.applicantAccountRepository.updatePassword) {
    throw new Error('applicantAccountRepository password reset methods are not configured');
  }
  return deps.applicantAccountRepository as Required<NonNullable<AdminDeps['applicantAccountRepository']>>;
}

function getAirportNameForMail(airport: unknown, airportId: number): string {
  if (airport && typeof airport === 'object' && 'name' in airport) {
    const name = String((airport as { name?: unknown }).name || '').trim();
    if (name) {
      return name;
    }
  }
  return `机场 #${airportId}`;
}

function getAccessTokenService(deps: AdminDeps) {
  if (!deps.accessTokenService) {
    throw new Error('accessTokenService is not configured');
  }
  return deps.accessTokenService;
}

function getSubscriptionNodeSnapshotRepository(deps: AdminDeps): NonNullable<AdminDeps['subscriptionNodeSnapshotRepository']> {
  if (!deps.subscriptionNodeSnapshotRepository) {
    throw new Error('subscriptionNodeSnapshotRepository is not configured');
  }
  return deps.subscriptionNodeSnapshotRepository;
}

function getSubscriptionNodeCaptureService(deps: AdminDeps): NonNullable<AdminDeps['subscriptionNodeCaptureService']> {
  if (!deps.subscriptionNodeCaptureService) {
    throw new Error('subscriptionNodeCaptureService is not configured');
  }
  return deps.subscriptionNodeCaptureService;
}

function toSafeSubscriptionNodeCaptureResult(result: SubscriptionNodeCaptureResult): SubscriptionNodeCaptureResult {
  return {
    airport_id: Number(result.airport_id),
    snapshot_id: Number(result.snapshot_id),
    captured_at: String(result.captured_at || ''),
    subscription_format: result.subscription_format == null ? null : String(result.subscription_format),
    parsed_nodes_count: Number(result.parsed_nodes_count || 0),
    supported_nodes_count: Number(result.supported_nodes_count || 0),
    unsupported_nodes_count: Number(result.unsupported_nodes_count || 0),
  };
}

function getPerformanceNodePreferenceRepository(deps: AdminDeps): NonNullable<AdminDeps['performanceNodePreferenceRepository']> {
  if (!deps.performanceNodePreferenceRepository) {
    throw new Error('performanceNodePreferenceRepository is not configured');
  }
  return deps.performanceNodePreferenceRepository;
}

function getPerformanceProbeSettingRepository(
  deps: AdminDeps,
): NonNullable<AdminDeps['performanceProbeSettingRepository']> {
  if (!deps.performanceProbeSettingRepository) {
    throw new Error('performanceProbeSettingRepository is not configured');
  }
  return deps.performanceProbeSettingRepository;
}

function getPerformanceProbeRepository(deps: AdminDeps): NonNullable<AdminDeps['performanceProbeRepository']> {
  if (!deps.performanceProbeRepository) {
    throw new Error('performanceProbeRepository is not configured');
  }
  return deps.performanceProbeRepository;
}

function parsePerformanceProbeSettings(
  value: unknown,
): AirportPerformanceProbeSettingsInput['settings'] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'settings must be an array');
  }
  const allowed = new Set<PerformanceProbeId>(['legacy-control', 'cn-shanghai', 'cn-guangzhou']);
  return value.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new HttpError(400, 'BAD_REQUEST', `settings[${index}] must be an object`);
    }
    const row = item as Record<string, unknown>;
    const probeId = String(row.probe_id || '') as PerformanceProbeId;
    if (!allowed.has(probeId)) {
      throw new HttpError(400, 'BAD_REQUEST', `settings[${index}].probe_id is invalid`);
    }
    if (typeof row.test_enabled !== 'boolean' || typeof row.include_in_result !== 'boolean') {
      throw new HttpError(400, 'BAD_REQUEST', `settings[${index}] switches must be boolean`);
    }
    return {
      probe_id: probeId,
      test_enabled: row.test_enabled,
      include_in_result: row.include_in_result,
    };
  });
}

function historicalPerformanceSettingsView(
  airportId: number,
  fallback: AirportPerformanceProbeSettingsView,
  runs: PerformanceRun[],
): AirportPerformanceProbeSettingsView {
  const latestByProbe = new Map<PerformanceProbeId, PerformanceRun>();
  for (const run of runs) {
    const probeId = run.probe_id || 'legacy-control';
    if (!latestByProbe.has(probeId)) latestByProbe.set(probeId, run);
  }
  return {
    airport_id: airportId,
    config_version: Math.max(0, ...runs.map((run) => Number(run.config_version || 0))),
    settings: fallback.settings.map((setting) => {
      const run = latestByProbe.get(setting.probe_id);
      return {
        ...setting,
        test_enabled: Boolean(run),
        include_in_result: run?.run_mode === 'official',
        updated_by: null,
        updated_at: run?.sampled_at || null,
      };
    }),
  };
}

function safePerformanceProbeRun(run: PerformanceRun | null): Record<string, unknown> | null {
  if (!run) return null;
  return {
    id: run.id,
    job_id: run.job_id ?? null,
    sampled_at: run.sampled_at,
    status: run.status,
    run_mode: run.run_mode || 'official',
    test_profile: run.test_profile || 'legacy_single_target_v1',
    scoring_rule_version: run.scoring_rule_version || 'legacy_v1',
    config_version: Number(run.config_version || 0),
    calibration_status: run.calibration_status || 'not_required',
    calibration_mbps: numberOrNull(run.calibration_mbps),
    review_status: run.review_status || 'normal',
    review_reasons: (run.review_reasons || []).map(String),
    median_latency_ms: numberOrNull(run.median_latency_ms),
    median_download_mbps: numberOrNull(run.median_download_mbps),
    packet_loss_percent: numberOrNull(run.packet_loss_percent),
    error_code: stringOrNull(run.error_code),
    error_message: stringOrNull(run.error_message),
  };
}

function buildPerformanceNodeSelectionCandidates(nodes: SubscriptionNodeSnapshotNode[]): PerformanceNodePreferenceNode[] {
  const seen = new Set<string>();
  const candidates: PerformanceNodePreferenceNode[] = [];
  for (const node of nodes) {
    const key = buildPerformanceNodeKey(node);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    candidates.push({
      key,
      name: node.name,
      region: node.region ?? null,
      type: node.type ?? null,
      match_identity: buildPerformanceNodeMatchIdentity(node),
    });
  }
  return candidates;
}

function resolvePerformanceNodeSelectionKeys(
  savedNodes: PerformanceNodePreferenceNode[],
  candidates: PerformanceNodePreferenceNode[],
): string[] {
  const candidatesByKey = new Map(candidates.map((node) => [node.key, node]));
  const candidatesByIdentity = new Map<string, PerformanceNodePreferenceNode[]>();
  for (const candidate of candidates) {
    const identity = performanceNodeMatchIdentity(candidate);
    const group = candidatesByIdentity.get(identity) || [];
    group.push(candidate);
    candidatesByIdentity.set(identity, group);
  }

  const selectedKeys: string[] = [];
  const seen = new Set<string>();
  for (const savedNode of savedNodes) {
    let candidate = candidatesByKey.get(savedNode.key);
    if (!candidate) {
      const identityMatches = candidatesByIdentity.get(performanceNodeMatchIdentity(savedNode)) || [];
      candidate = identityMatches.length === 1 ? identityMatches[0] : undefined;
    }
    if (!candidate || seen.has(candidate.key)) {
      continue;
    }
    seen.add(candidate.key);
    selectedKeys.push(candidate.key);
  }
  return selectedKeys;
}

function performanceNodeMatchIdentity(node: PerformanceNodePreferenceNode): string {
  return String(node.match_identity || '').trim() || buildPerformanceNodeMatchIdentity(node);
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return String(value);
}

function boolOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no') {
      return false;
    }
  }
  return Boolean(value);
}

function stabilityTierOrNull(value: unknown): StabilityTier | null {
  return optionalStabilityTier(value) ?? null;
}

function numberArrayOrEmpty(value: unknown): number[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v))
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toNumberArrayOrDefault(value: unknown): number[] {
  if (value === undefined || value === null) {
    return [];
  }
  return toNumberArray(value);
}

function toPerformanceNodeArray(value: unknown): PerformanceRunNode[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'selected_nodes/tested_nodes must be array');
  }
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        name: String(record.name || ''),
        region: record.region == null ? null : String(record.region),
        type: record.type == null ? null : String(record.type),
        status: record.status == null ? null : String(record.status),
        error_code: record.error_code == null ? null : String(record.error_code),
        connect_latency_samples_ms: toNumberArrayOrDefault(record.connect_latency_samples_ms),
        connect_latency_median_ms: numberOrNull(record.connect_latency_median_ms),
        proxy_http_latency_samples_ms: toNumberArrayOrDefault(record.proxy_http_latency_samples_ms),
        proxy_http_latency_median_ms: numberOrNull(record.proxy_http_latency_median_ms),
        download_mbps: numberOrNull(record.download_mbps),
      };
    })
    .filter((item) => item.name);
}

function toSubscriptionSnapshotNodeArray(value: unknown): SubscriptionNodeSnapshotNode[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'nodes must be array');
  }
  return value.map((item, index) => toSubscriptionSnapshotNode(item, index));
}

function toSubscriptionSnapshotNode(value: unknown, index: number): SubscriptionNodeSnapshotNode {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `nodes[${index}] must be object`);
  }
  const record = value as Record<string, unknown>;
  const name = optionalString(record.name);
  const type = optionalString(record.type);
  const rawUri = optionalString(record.raw_uri);
  const outbound = record.outbound;
  if (!name) {
    throw new HttpError(400, 'BAD_REQUEST', `nodes[${index}].name is required`);
  }
  if (!type) {
    throw new HttpError(400, 'BAD_REQUEST', `nodes[${index}].type is required`);
  }
  if (!rawUri) {
    throw new HttpError(400, 'BAD_REQUEST', `nodes[${index}].raw_uri is required`);
  }
  if (!outbound || typeof outbound !== 'object' || Array.isArray(outbound)) {
    throw new HttpError(400, 'BAD_REQUEST', `nodes[${index}].outbound must be object`);
  }
  return {
    name,
    region: record.region == null ? null : String(record.region),
    type,
    outbound: outbound as Record<string, unknown>,
    raw_uri: rawUri,
  };
}

function toUnsupportedSubscriptionNodeArray(value: unknown): SubscriptionNodeSnapshotUnsupportedNode[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'unsupported_nodes must be array');
  }
  return value
    .filter((item) => item && typeof item === 'object' && !Array.isArray(item))
    .map((item) => {
      const record = item as Record<string, unknown>;
      return {
        uri: String(record.uri || ''),
        reason: String(record.reason || ''),
      };
    })
    .filter((item) => item.uri || item.reason);
}

function performanceNodesOrEmpty(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>;
}

function toSafeStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function buildAdminPerformanceProbeRun(
  run: PerformanceRun,
  targets: PerformanceRunTarget[],
  includedProbeIds: ReadonlySet<string>,
): Record<string, unknown> {
  const targetGroups = new Map<string, PerformanceRunTarget[]>();
  for (const target of targets) {
    const rows = targetGroups.get(target.target_key) || [];
    rows.push(target);
    targetGroups.set(target.target_key, rows);
  }
  const targetSummaries = [...targetGroups.entries()].map(([targetKey, rows]) => {
    const values = rows
      .filter((target) => target.valid && target.download_mbps !== null && Number.isFinite(target.download_mbps))
      .map((target) => Number(target.download_mbps));
    return {
      target_key: targetKey,
      sample_count: rows.length,
      valid_sample_count: values.length,
      invalid_sample_count: rows.length - values.length,
      min_download_mbps: values.length > 0 ? Math.min(...values) : null,
      median_download_mbps: medianOrUndefined(values) ?? null,
      max_download_mbps: values.length > 0 ? Math.max(...values) : null,
      error_codes: [...new Set(rows.map((target) => target.error_code).filter(Boolean))],
    };
  });
  const probeId = run.probe_id || 'legacy-control';
  const participationState = includedProbeIds.has(probeId)
    ? '参与评分'
    : run.run_mode === 'shadow'
      ? '影子测试'
      : '未参与评分';
  return {
    id: run.id,
    job_id: run.job_id ?? null,
    probe_id: probeId,
    region_code: run.region_code ?? null,
    provider: run.provider ?? null,
    bandwidth_mbps: run.bandwidth_mbps ?? null,
    sampled_at: run.sampled_at,
    source: run.source,
    status: run.status,
    run_mode: run.run_mode || 'official',
    participation_state: participationState,
    test_profile: run.test_profile || 'legacy_single_target_v1',
    scoring_rule_version: run.scoring_rule_version || 'legacy_v1',
    config_version: Number(run.config_version || 0),
    calibration_status: run.calibration_status || 'not_required',
    calibration_mbps: numberOrNull(run.calibration_mbps),
    review_status: run.review_status || 'normal',
    review_reasons: (run.review_reasons || []).map(String),
    probe_ceiling:
      run.probe_id !== 'legacy-control'
      && Number(run.median_download_mbps || 0) >= 180,
    median_latency_ms: numberOrNull(run.median_latency_ms),
    median_download_mbps: numberOrNull(run.median_download_mbps),
    packet_loss_percent: numberOrNull(run.packet_loss_percent),
    selected_nodes: run.selected_nodes || [],
    tested_nodes: run.tested_nodes || [],
    target_summaries: targetSummaries,
    error_code: stringOrNull(run.error_code),
    error_message: sanitizeAdminPerformanceError(run.error_message),
  };
}

function sanitizeAdminPerformanceError(value: unknown): string | null {
  const normalized = stringOrNull(value);
  if (!normalized) return null;
  return normalized
    .replace(/https?:\/\/[^\s"']+/gi, '[redacted-url]')
    .replace(/\b(?:vless|trojan|ss|ssr|vmess):\/\/\S+/gi, '[redacted-node-uri]')
    .slice(0, 500);
}

function toObjectOrEmpty(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) {
    return {};
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'diagnostics must be object');
  }
  return value as Record<string, unknown>;
}

function medianOrUndefined(values: number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Number((((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2)));
  }
  return Number(sorted[mid].toFixed(2));
}

function normalizeAirportMutationError(error: unknown): unknown {
  if (error instanceof HttpError) {
    return error;
  }

  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const sqlMessage =
    typeof error === 'object' && error && 'sqlMessage' in error ? String(error.sqlMessage || '') : '';

  if (code === 'AIRPORT_SLUG_CONFLICT') {
    return new HttpError(409, 'AIRPORT_SLUG_CONFLICT', '机场 SEO URL Slug 已存在');
  }

  if (code === 'ER_DUP_ENTRY') {
    if (sqlMessage.includes('uk_airports_slug') || sqlMessage.includes('slug')) {
      return new HttpError(409, 'AIRPORT_SLUG_CONFLICT', '机场 SEO URL Slug 已存在');
    }
    return new HttpError(409, 'AIRPORT_NAME_CONFLICT', '机场名称已存在');
  }

  if (
    code === 'ER_BAD_FIELD_ERROR' &&
    (
      sqlMessage.includes('websites_json') ||
      sqlMessage.includes('tags_json') ||
      sqlMessage.includes('applicant_email') ||
      sqlMessage.includes('applicant_telegram') ||
      sqlMessage.includes('founded_on') ||
      sqlMessage.includes('airport_intro') ||
      sqlMessage.includes('test_account') ||
      sqlMessage.includes('test_password') ||
      sqlMessage.includes('slug') ||
      sqlMessage.includes('approved_airport_id')
    )
  ) {
    return new HttpError(
      500,
      'AIRPORT_SCHEMA_OUTDATED',
      '数据库 airports 表缺少必要字段，请重启后端或执行 schema 迁移后再试',
    );
  }

  return error;
}
