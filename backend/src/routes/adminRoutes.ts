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
import {
  DEFAULT_APPLICATION_FEE_AMOUNT,
  type PaymentGatewaySettingsInput,
} from '../services/paymentGatewaySettingsService';
import type { SmtpSettingsInput, SmtpTemplateKey } from '../services/smtpSettingsService';
import type { SchedulerDailyStat } from '../repositories/schedulerRunRepository';
import type { AccessTokenScope } from '../utils/accessToken';
import type {
  AirportApplicationReviewStatus,
  AirportStatus,
  ManualJobKind,
  PerformanceRunNode,
  DailyMetricsInput,
  PerformanceRunInput,
  ProbeSampleInput,
  ProbeSampleType,
  ProbeScope,
  SchedulerRunStatus,
  SchedulerTaskKey,
} from '../types/domain';
import {
  computeEffectiveLatencyStats,
  computeLatencyStats,
  computeSScore,
  computeStabilityScore,
  computeStreakScore,
  computeUptimeScore,
  isStableDay,
} from '../utils/stability';
import { formatSqlDateTimeInTimezone, getDateInTimezone } from '../utils/time';

interface AdminDeps {
  airportRepository: {
    listByQuery(query: {
      keyword?: string;
      status?: AirportStatus;
      page?: number;
      pageSize?: number;
    }): Promise<{ items: unknown[]; total: number }>;
    getById(id: number): Promise<unknown | null>;
    create(input: {
      name: string;
      website: string;
      websites?: string[];
      status?: AirportStatus;
      plan_price_month: number;
      has_trial: boolean;
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
        name?: string;
        website?: string;
        websites?: string[];
        status?: AirportStatus;
        plan_price_month?: number;
        has_trial?: boolean;
        subscription_url?: string | null;
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
    getReportView(airportId: number, date: string): Promise<unknown | null>;
  };
  telegramNotificationService?: {
    getAdminSettings(): Promise<unknown>;
    updateAdminSettings(input: TelegramNotificationSettingsInput, updatedBy: string): Promise<unknown>;
    sendTestMessage(input: TelegramNotificationSettingsInput): Promise<void>;
  };
  mediaLibrarySettingsService?: {
    getAdminSettings(): Promise<unknown>;
    updateAdminSettings(input: MediaLibrarySettingsInput, updatedBy: string): Promise<unknown>;
  };
  paymentGatewaySettingsService?: {
    getAdminSettings(): Promise<unknown>;
    updateAdminSettings(input: PaymentGatewaySettingsInput, updatedBy: string): Promise<unknown>;
  };
  smtpSettingsService?: {
    getAdminSettings(): Promise<unknown>;
    updateAdminSettings(input: SmtpSettingsInput, updatedBy: string): Promise<unknown>;
  };
  mailService?: {
    sendTestMail(input: SmtpSettingsInput & { test_to: string }): Promise<void>;
    sendApplicationApprovedEmail(input: { to: string; airportName: string }): Promise<void>;
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
      const pageSize = toPositiveInt(req.query.page_size, 20);
      const keyword = optionalString(req.query.keyword);
      const reviewStatus = req.query.review_status
        ? toAirportApplicationReviewStatus(req.query.review_status)
        : undefined;
      const result = await deps.airportApplicationRepository.listByQuery({
        page,
        pageSize,
        keyword,
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
          plan_price_month: currentApplication.plan_price_month,
          has_trial: currentApplication.has_trial,
          subscription_url: currentApplication.subscription_url || null,
          applicant_email: currentApplication.applicant_email || null,
          applicant_telegram: currentApplication.applicant_telegram || null,
          founded_on: currentApplication.founded_on || null,
          airport_intro: currentApplication.airport_intro || null,
          test_account: currentApplication.test_account || null,
          test_password: currentApplication.test_password || null,
          tags: [],
        });
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
      const pageSize = toPositiveInt(req.query.page_size, 20);
      const keyword = optionalString(req.query.keyword);
      const status = req.query.status ? toStatus(req.query.status) : undefined;
      const result = await deps.airportRepository.listByQuery({ page, pageSize, keyword, status });
      const scoreRepository = deps.scoreRepository;
      const airports = result.items as Array<{ id?: number } & Record<string, unknown>>;
      let scoreMap = new Map<number, number>();

      if (scoreRepository.getLatestAvailableDate && scoreRepository.getPublicDisplayScoresByDate) {
        const latestDate = await scoreRepository.getLatestAvailableDate(getDateInTimezone());
        const airportIds = airports
          .map((item) => Number(item.id))
          .filter((id) => Number.isInteger(id) && id > 0);
        if (latestDate && airportIds.length > 0) {
          scoreMap = await scoreRepository.getPublicDisplayScoresByDate(airportIds, latestDate);
        }
      }

      res.json({
        page,
        page_size: pageSize,
        total: result.total,
        items: airports.map((item) => ({
          ...item,
          total_score: typeof item.id === 'number' ? scoreMap.get(item.id) ?? null : null,
        })),
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
      res.json(airport);
    } catch (error) {
      next(error);
    }
  });

  router.post('/airports', async (req, res, next) => {
    try {
      const payload = req.body ?? {};
      const name = mustString(payload.name, 'name');
      const websiteBundle = parseWebsiteFields(payload, true);
      const primaryWebsite = websiteBundle.website as string;
      const status = payload.status ? toStatus(payload.status) : 'normal';
      ensureDownConfirmed(status, payload.confirm_down);
      const planPriceMonth = mustNumber(payload.plan_price_month, 'plan_price_month');
      const hasTrial = Boolean(payload.has_trial);
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
        name,
        website: primaryWebsite,
        websites: websiteBundle.websites,
        status,
        plan_price_month: planPriceMonth,
        has_trial: hasTrial,
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
        name: optionalString(payload.name),
        website: websiteBundle.website,
        websites: websiteBundle.websites,
        status: nextStatus,
        plan_price_month:
          payload.plan_price_month === undefined
            ? undefined
            : mustNumber(payload.plan_price_month, 'plan_price_month'),
        has_trial: payload.has_trial === undefined ? undefined : Boolean(payload.has_trial),
        subscription_url:
          payload.subscription_url === undefined
            ? undefined
            : optionalString(payload.subscription_url) || null,
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

      const updated = await deps.airportRepository.update(airportId, patch);
      if (!updated) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found or no changes`);
      }

      await deps.auditRepository.log('update_airport', actorFromReq(req), req.requestId, {
        airport_id: airportId,
        patch,
      });
      res.json({ airport_id: airportId, updated: true });
    } catch (error) {
      next(normalizeAirportMutationError(error));
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

  router.get('/airports/:id/dashboard', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const date = parseDate(req.query.date);
      const [base, metrics, score, performanceRun, latestPerformanceRun, dayProbeSamples, latestAvailableScoreDate] = await Promise.all([
        deps.airportRepository.getById(airportId),
        deps.metricsRepository.getByAirportAndDate(airportId, date),
        deps.scoreRepository.getByAirportAndDate(airportId, date),
        deps.performanceRunRepository.getLatestByAirportAndDate(airportId, date),
        deps.performanceRunRepository.getLatestByAirportBeforeDate(airportId, date),
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
      const uptimeScore =
        numberOrNull(details.uptime_score) ?? computeUptimeScore(uptimePercentToday);
      const stabilityScore =
        numberOrNull(details.stability_score) ?? computeStabilityScore(effectiveLatencyCv);
      const streakScore =
        numberOrNull(details.streak_score) ??
        computeStreakScore(stableDaysStreak ?? 0);
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
      const performanceDataMode =
        performanceRun
          ? '当日实测'
          : hasPerformanceMetrics && latestPerformanceDate
            ? '历史缓存'
            : '无性能数据';

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
          total_score: finalEngineScore?.final_score ?? null,
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
          is_stable_day:
            boolOrNull(metricsObj.is_stable_day) ??
            isStableDay(uptimePercentToday, latencySamples),
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
          data_source_mode: performanceDataMode,
          cache_source_date: performanceRun ? null : latestPerformanceDate,
          collect_status: stringOrNull(latestPerformanceRunObj.status),
          last_sampled_at: stringOrNull(latestPerformanceRunObj.sampled_at),
          last_source: stringOrNull(latestPerformanceRunObj.source),
          subscription_format: stringOrNull(latestPerformanceRunObj.subscription_format),
          parsed_nodes_count: numberOrNull(latestPerformanceRunObj.parsed_nodes_count),
          supported_nodes_count: numberOrNull(latestPerformanceRunObj.supported_nodes_count),
          selected_nodes: performanceNodesOrEmpty(latestPerformanceRunObj.selected_nodes),
          tested_nodes: performanceNodesOrEmpty(latestPerformanceRunObj.tested_nodes),
          tested_nodes_count: performanceNodesOrEmpty(latestPerformanceRunObj.tested_nodes).length,
          error_code: stringOrNull(latestPerformanceRunObj.error_code),
          error_message: stringOrNull(latestPerformanceRunObj.error_message),
          latency_measurement: stringOrNull(performanceDiagnostics.latency_measurement),
          latency_probe_target: stringOrNull(performanceDiagnostics.latency_probe_target),
          proxy_http_test_url: stringOrNull(performanceDiagnostics.proxy_http_test_url),
          proxy_http_median_latency_ms: numberOrNull(
            performanceDiagnostics.proxy_http_median_latency_ms,
          ),
          speed_measurement: stringOrNull(performanceDiagnostics.speed_measurement),
          speed_test_connections: numberOrNull(performanceDiagnostics.speed_test_connections),
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
        ...(report as Record<string, unknown>),
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
      const airport = (await deps.airportRepository.getById(airportId)) as { status?: AirportStatus } | null;
      if (!airport) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }
      if (airport.status === 'down') {
        throw new HttpError(409, 'AIRPORT_DOWN_MANUAL_JOB_DISABLED', '已跑路机场已停止手动测评与风险体检');
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
        is_stable_day:
          optionalBoolean(payload.is_stable_day) ??
          isStableDay(derivedUptimePercentToday, latencySamples),
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

      for (const latency of input.latency_samples_ms || []) {
        await deps.probeSampleRepository.insertProbeSample({
          airport_id: input.airport_id,
          sampled_at: input.sampled_at,
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

function getSchedulerService(deps: AdminDeps): NonNullable<AdminDeps['schedulerService']> {
  if (!deps.schedulerService) {
    throw new Error('schedulerService is not configured');
  }
  return deps.schedulerService;
}

function parseDate(value: unknown): string {
  const date = String(value || getDateInTimezone());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'BAD_REQUEST', 'date must be YYYY-MM-DD');
  }
  return date;
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
  if (taskKey === 'stability' || taskKey === 'performance' || taskKey === 'risk' || taskKey === 'aggregate_recompute') {
    return taskKey;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'taskKey must be stability|performance|risk|aggregate_recompute');
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
    pid: payload.pid === undefined ? undefined : String(payload.pid ?? '').trim(),
    private_key:
      payload.private_key === undefined ? undefined : String(payload.private_key ?? '').trim(),
    platform_public_key:
      payload.platform_public_key === undefined
        ? undefined
        : String(payload.platform_public_key ?? '').trim(),
    application_fee_amount:
      payload.application_fee_amount === undefined
        ? DEFAULT_APPLICATION_FEE_AMOUNT
        : mustNumber(payload.application_fee_amount, 'application_fee_amount'),
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
  const keys: SmtpTemplateKey[] = ['applicant_credentials', 'application_approved'];
  const templates: NonNullable<SmtpSettingsInput['templates']> = {};

  for (const key of keys) {
    if (payload[key] === undefined) {
      continue;
    }
    const item = toPlainObject(payload[key], `templates.${key}`);
    templates[key] = {
      subject: item.subject === undefined ? undefined : String(item.subject ?? '').trim(),
      body: item.body === undefined ? undefined : String(item.body ?? '').trim(),
    };
  }

  return templates;
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
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return false;
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
  const downloadSamples = toNumberArrayOrDefault(payload.download_samples_mbps);
  const packetLossPercent = optionalNumber(payload.packet_loss_percent);
  const medianLatency = optionalNumber(payload.median_latency_ms) ?? medianOrUndefined(latencySamples);
  const medianDownload = optionalNumber(payload.median_download_mbps) ?? medianOrUndefined(downloadSamples);

  return {
    airport_id: toAirportId(payload.airport_id),
    sampled_at: mustDateTime(payload.sampled_at, 'sampled_at'),
    source: optionalString(payload.source) || 'cron-performance',
    status: toPerformanceRunStatus(payload.status),
    subscription_format: optionalString(payload.subscription_format) || null,
    parsed_nodes_count: optionalNumber(payload.parsed_nodes_count) ?? 0,
    supported_nodes_count: optionalNumber(payload.supported_nodes_count) ?? 0,
    selected_nodes: toPerformanceNodeArray(payload.selected_nodes),
    tested_nodes: toPerformanceNodeArray(payload.tested_nodes),
    latency_samples_ms: latencySamples,
    download_samples_mbps: downloadSamples,
    packet_loss_percent: packetLossPercent,
    median_latency_ms: medianLatency,
    median_download_mbps: medianDownload,
    error_code: optionalString(payload.error_code) || null,
    error_message: optionalString(payload.error_message) || null,
    diagnostics: toObjectOrEmpty(payload.diagnostics),
  };
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

function getPaymentGatewaySettingsService(deps: AdminDeps) {
  if (!deps.paymentGatewaySettingsService) {
    throw new Error('paymentGatewaySettingsService is not configured');
  }
  return deps.paymentGatewaySettingsService;
}

function getSmtpSettingsService(deps: AdminDeps) {
  if (!deps.smtpSettingsService) {
    throw new Error('smtpSettingsService is not configured');
  }
  return deps.smtpSettingsService;
}

function getMailService(deps: AdminDeps) {
  if (!deps.mailService) {
    throw new Error('mailService is not configured');
  }
  return deps.mailService;
}

function getAccessTokenService(deps: AdminDeps) {
  if (!deps.accessTokenService) {
    throw new Error('accessTokenService is not configured');
  }
  return deps.accessTokenService;
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

function performanceNodesOrEmpty(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => item && typeof item === 'object') as Array<Record<string, unknown>>;
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

  if (code === 'ER_DUP_ENTRY') {
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
