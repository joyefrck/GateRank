import { Router } from 'express';
import { RANKING_TYPES } from '../config/scoring';
import { HttpError } from '../middleware/errorHandler';
import type {
  MarketingEventType,
  MarketingPageKind,
  MarketingPlacement,
  MarketingTargetKind,
} from '../types/domain';
import { hashPassword, createRandomPassword } from '../utils/password';
import { buildMarketingEventRecord } from '../utils/marketing';
import { getSiteOrigin } from '../utils/siteUrl';
import { dateDaysAgo, getDateInTimezone } from '../utils/time';
import type { AirportApplicationReviewStatus, AirportStatus } from '../types/domain';

interface PublicDeps {
  airportRepository: {
    getById(id: number): Promise<unknown | null>;
  };
  airportApplicationRepository: {
    create(input: {
      name: string;
      website: string;
      websites?: string[];
      status: AirportStatus;
      plan_price_month: number;
      has_trial: boolean;
      subscription_url?: string | null;
      applicant_email: string;
      applicant_telegram: string;
      founded_on: string;
      airport_intro: string;
      test_account: string;
      test_password: string;
    }): Promise<number>;
    hasBlockingEmail?(email: string): Promise<boolean>;
  };
  applicantAccountRepository?: {
    create(input: {
      application_id: number;
      email: string;
      password_hash: string;
      must_change_password?: boolean;
    }): Promise<number>;
  };
  applicantBillingRepository?: {
    ensureWalletForAccount(applicantAccountId: number, applicationId: number): Promise<unknown>;
  };
  applicationNotificationService?: {
    notifyNewAirportApplication(input: {
      applicationId: number;
      requestId: string;
      name: string;
      website: string;
      websites: string[];
      planPriceMonth: number;
      hasTrial: boolean;
      subscriptionUrl?: string | null;
      applicantEmail: string;
      applicantTelegram: string;
      foundedOn: string;
      airportIntro: string;
    }): Promise<void>;
  };
  mailService?: {
    sendApplicantCredentialsEmail(input: {
      to: string;
      airportName: string;
      portalEmail: string;
      initialPassword: string;
      portalLoginUrl: string;
    }): Promise<void>;
  };
  metricsRepository: {
    getByAirportAndDate(airportId: number, date: string): Promise<unknown | null>;
  };
  scoreRepository: {
    getByAirportAndDate(airportId: number, date: string): Promise<unknown | null>;
    getTrend(airportId: number, startDate: string, endDate: string): Promise<unknown[]>;
  };
  rankingRepository: {
    getRanking(date: string, listType: (typeof RANKING_TYPES)[number]): Promise<unknown[]>;
  };
  publicViewService: {
    getHomePageView(date: string): Promise<unknown>;
    getFullRankingView(date: string, page: number, pageSize: number): Promise<unknown>;
    getRiskMonitorView(date: string, page: number, pageSize: number): Promise<unknown>;
    getReportView(airportId: number, date: string): Promise<unknown | null>;
  };
  marketingRepository?: {
    insertMany(records: ReturnType<typeof buildMarketingEventRecord>[]): Promise<void>;
  };
}

const MARKETING_EVENT_TYPES: MarketingEventType[] = ['page_view', 'airport_impression', 'outbound_click'];
const MARKETING_PAGE_KINDS: MarketingPageKind[] = [
  'home',
  'full_ranking',
  'risk_monitor',
  'report',
  'methodology',
  'news',
  'apply',
  'publish_token_docs',
];
const MARKETING_PLACEMENTS: MarketingPlacement[] = [
  'home_card',
  'full_ranking_item',
  'risk_monitor_item',
  'report_header',
];
const MARKETING_TARGET_KINDS: MarketingTargetKind[] = ['website', 'subscription_url'];
const PUBLIC_PAGE_CACHE_TTL_MS = 30_000;

export function createPublicRoutes(deps: PublicDeps): Router {
  const router = Router();
  const pageCache = createTimedPromiseCache(PUBLIC_PAGE_CACHE_TTL_MS);

  router.post('/airport-applications', async (req, res, next) => {
    try {
      const payload = (req.body ?? {}) as Record<string, unknown>;
      const websiteBundle = parseWebsiteFields(payload, true);
      const foundedOn = mustDate(payload.founded_on, 'founded_on');
      const today = getDateInTimezone();
      if (foundedOn > today) {
        throw new HttpError(400, 'BAD_REQUEST', 'founded_on cannot be in the future');
      }

      const applicantEmail = mustEmail(payload.applicant_email, 'applicant_email');
      const emailBlocked = await deps.airportApplicationRepository.hasBlockingEmail?.(applicantEmail);
      if (emailBlocked) {
        throw new HttpError(
          409,
          'AIRPORT_APPLICATION_EMAIL_CONFLICT',
          '该邮箱已有进行中或已通过的申请，请直接登录个人后台处理',
        );
      }

      const applicationInput = {
        name: mustString(payload.name, 'name'),
        website: websiteBundle.website,
        websites: websiteBundle.websites,
        status: 'normal' as const,
        plan_price_month: mustNonNegativeNumber(payload.plan_price_month, 'plan_price_month'),
        has_trial: Boolean(payload.has_trial),
        subscription_url: optionalString(payload.subscription_url) || null,
        applicant_email: applicantEmail,
        applicant_telegram: mustString(payload.applicant_telegram, 'applicant_telegram'),
        founded_on: foundedOn,
        airport_intro: mustString(payload.airport_intro, 'airport_intro'),
        test_account: mustString(payload.test_account, 'test_account'),
        test_password: mustString(payload.test_password, 'test_password'),
      };

      const applicationId = await deps.airportApplicationRepository.create(applicationInput);
      const initialPassword = createRandomPassword();
      const passwordHash = await hashPassword(initialPassword);
      if (!deps.applicantAccountRepository) {
        throw new Error('applicantAccountRepository is not configured');
      }
      const applicantAccountId = await deps.applicantAccountRepository.create({
        application_id: applicationId,
        email: applicantEmail,
        password_hash: passwordHash,
        must_change_password: true,
      });
      await deps.applicantBillingRepository?.ensureWalletForAccount(applicantAccountId, applicationId);

      const portalLoginUrl = buildPortalLoginUrl(req);

      try {
        await deps.applicationNotificationService?.notifyNewAirportApplication({
          applicationId,
          requestId: req.requestId || 'unknown',
          name: applicationInput.name,
          website: applicationInput.website,
          websites: applicationInput.websites || [applicationInput.website],
          planPriceMonth: applicationInput.plan_price_month,
          hasTrial: applicationInput.has_trial,
          subscriptionUrl: applicationInput.subscription_url,
          applicantEmail: applicationInput.applicant_email,
          applicantTelegram: applicationInput.applicant_telegram,
          foundedOn: applicationInput.founded_on,
          airportIntro: applicationInput.airport_intro,
        });
      } catch (error) {
        console.error('[telegram] failed to notify new airport application', {
          applicationId,
          requestId: req.requestId || 'unknown',
          error,
        });
      }

      try {
        await deps.mailService?.sendApplicantCredentialsEmail({
          to: applicantEmail,
          airportName: applicationInput.name,
          portalEmail: applicantEmail,
          initialPassword,
          portalLoginUrl,
        });
      } catch (error) {
        console.error('[mail] failed to send applicant credentials email', {
          applicationId,
          requestId: req.requestId || 'unknown',
          error,
        });
      }

      res.status(201).json({
        application_id: applicationId,
        review_status: 'awaiting_payment' satisfies AirportApplicationReviewStatus,
        portal_email: applicantEmail,
        initial_password: initialPassword,
        portal_login_url: portalLoginUrl,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/marketing/events', async (req, res, next) => {
    try {
      if (!deps.marketingRepository) {
        throw new Error('marketingRepository is not configured');
      }
      const body = (req.body ?? {}) as Record<string, unknown>;
      if (!Array.isArray(body.events) || body.events.length === 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'events must be a non-empty array');
      }
      if (body.events.length > 50) {
        throw new HttpError(400, 'BAD_REQUEST', 'events cannot exceed 50 items per request');
      }

      const records = body.events.map((item, index) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          throw new HttpError(400, 'BAD_REQUEST', `events[${index}] must be object`);
        }
        return buildMarketingEventRecord(req, validateMarketingEventPayload(item as Record<string, unknown>, index));
      });

      await deps.marketingRepository.insertMany(records);
      res.status(201).json({ inserted: records.length });
    } catch (error) {
      next(error);
    }
  });

  router.get('/pages/home', async (req, res, next) => {
    try {
      const date = parseDateQuery(req.query.date);
      const data = await pageCache.getOrLoad(
        `home:${date}`,
        () => deps.publicViewService.getHomePageView(date),
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.get('/pages/full-ranking', async (req, res, next) => {
    try {
      const date = parseDateQuery(req.query.date);
      const page = toPositiveInt(req.query.page, 1);
      const pageSize = 20;
      const data = await pageCache.getOrLoad(
        `full-ranking:${date}:${page}:${pageSize}`,
        () => deps.publicViewService.getFullRankingView(date, page, pageSize),
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.get('/pages/risk-monitor', async (req, res, next) => {
    try {
      const date = parseDateQuery(req.query.date);
      const page = toPositiveInt(req.query.page, 1);
      const pageSize = 20;
      const data = await pageCache.getOrLoad(
        `risk-monitor:${date}:${page}:${pageSize}`,
        () => deps.publicViewService.getRiskMonitorView(date, page, pageSize),
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.get('/rankings', async (req, res, next) => {
    try {
      const type = String(req.query.type || 'today');
      if (!RANKING_TYPES.includes(type as (typeof RANKING_TYPES)[number])) {
        throw new HttpError(400, 'BAD_REQUEST', `Unsupported ranking type: ${type}`);
      }

      const date = parseDateQuery(req.query.date);
      const data = await deps.rankingRepository.getRanking(
        date,
        type as (typeof RANKING_TYPES)[number],
      );
      res.json({ type, date, items: data });
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/score-trend', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const airport = await deps.airportRepository.getById(airportId);
      if (!airport) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }

      const days = Number(req.query.days || 30);
      const boundedDays = Number.isFinite(days) ? Math.min(365, Math.max(1, days)) : 30;
      const endDate = getDateInTimezone();
      const startDate = dateDaysAgo(endDate, boundedDays - 1);
      const trend = await deps.scoreRepository.getTrend(airportId, startDate, endDate);

      res.json({ airport_id: airportId, start_date: startDate, end_date: endDate, items: trend });
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/report', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const date = parseDateQuery(req.query.date);

      const [airport, metrics, score] = await Promise.all([
        deps.airportRepository.getById(airportId),
        deps.metricsRepository.getByAirportAndDate(airportId, date),
        deps.scoreRepository.getByAirportAndDate(airportId, date),
      ]);

      if (!airport) {
        throw new HttpError(404, 'AIRPORT_NOT_FOUND', `airport ${airportId} not found`);
      }
      if (!metrics || !score) {
        throw new HttpError(
          404,
          'REPORT_NOT_FOUND',
          `report not found for airport ${airportId} date ${date}`,
        );
      }

      res.json({ airport, date, metrics, score });
    } catch (error) {
      next(error);
    }
  });

  router.get('/airports/:id/report-view', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const date = parseDateQuery(req.query.date);

      const data = await deps.publicViewService.getReportView(airportId, date);
      if (!data) {
        throw new HttpError(
          404,
          'REPORT_NOT_FOUND',
          `report view not found for airport ${airportId} date ${date}`,
        );
      }

      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function buildPortalLoginUrl(req: {
  protocol?: string;
  headers?: Record<string, unknown>;
}): string {
  return `${getSiteOrigin(req)}/portal`;
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

function mustNonNegativeNumber(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be non-negative number`);
  }
  return num;
}

function mustDate(value: unknown, fieldName: string): string {
  const date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be YYYY-MM-DD`);
  }
  return date;
}

function mustEmail(value: unknown, fieldName: string): string {
  const email = mustString(value, fieldName);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be valid email`);
  }
  return email;
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
): { website: string; websites: string[] } {
  const primaryWebsite = optionalString(payload.website);
  const websiteItems = payload.websites === undefined ? undefined : toStringArray(payload.websites, 'websites');
  const normalized = [primaryWebsite || '', ...(websiteItems || [])]
    .map((value) => value.trim())
    .filter(Boolean);
  const websites = [...new Set(normalized)];

  if (required && websites.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'website or websites is required');
  }

  return {
    website: websites[0],
    websites,
  };
}

function parseDateQuery(input: unknown): string {
  const date = String(input || getDateInTimezone());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'BAD_REQUEST', 'date must be YYYY-MM-DD');
  }
  return date;
}

function toPositiveInt(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : fallback;
}

function toAirportId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', `invalid airport id: ${value}`);
  }
  return id;
}

function validateMarketingEventPayload(
  payload: Record<string, unknown>,
  index: number,
): {
  occurred_at?: string;
  event_type: MarketingEventType;
  page_path: string;
  page_kind: MarketingPageKind;
  referrer_path?: string | null;
  external_referrer_host?: string | null;
  airport_id?: number | null;
  placement?: MarketingPlacement | null;
  target_kind?: MarketingTargetKind | null;
  target_url?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  client_session_id?: string | null;
} {
  const eventType = String(payload.event_type || '') as MarketingEventType;
  if (!MARKETING_EVENT_TYPES.includes(eventType)) {
    throw new HttpError(400, 'BAD_REQUEST', `events[${index}].event_type is invalid`);
  }

  const pageKind = String(payload.page_kind || '') as MarketingPageKind;
  if (!MARKETING_PAGE_KINDS.includes(pageKind)) {
    throw new HttpError(400, 'BAD_REQUEST', `events[${index}].page_kind is invalid`);
  }

  const pagePath = mustString(payload.page_path, `events[${index}].page_path`);
  const occurredAt = payload.occurred_at === undefined ? undefined : mustIsoDateTime(payload.occurred_at, `events[${index}].occurred_at`);
  const referrerPath = payload.referrer_path === undefined || payload.referrer_path === null
    ? null
    : mustString(payload.referrer_path, `events[${index}].referrer_path`);
  const externalReferrerHost = payload.external_referrer_host === undefined || payload.external_referrer_host === null
    ? null
    : mustString(payload.external_referrer_host, `events[${index}].external_referrer_host`);
  const clientSessionId = payload.client_session_id === undefined || payload.client_session_id === null
    ? null
    : mustString(payload.client_session_id, `events[${index}].client_session_id`);
  const utmSource = payload.utm_source === undefined || payload.utm_source === null
    ? null
    : mustString(payload.utm_source, `events[${index}].utm_source`);
  const utmMedium = payload.utm_medium === undefined || payload.utm_medium === null
    ? null
    : mustString(payload.utm_medium, `events[${index}].utm_medium`);
  const utmCampaign = payload.utm_campaign === undefined || payload.utm_campaign === null
    ? null
    : mustString(payload.utm_campaign, `events[${index}].utm_campaign`);
  const utmContent = payload.utm_content === undefined || payload.utm_content === null
    ? null
    : mustString(payload.utm_content, `events[${index}].utm_content`);
  const utmTerm = payload.utm_term === undefined || payload.utm_term === null
    ? null
    : mustString(payload.utm_term, `events[${index}].utm_term`);

  const airportId = payload.airport_id === undefined || payload.airport_id === null
    ? null
    : mustPositiveInt(payload.airport_id, `events[${index}].airport_id`);
  const placement = payload.placement === undefined || payload.placement === null
    ? null
    : mustMarketingPlacement(payload.placement, `events[${index}].placement`);
  const targetKind = payload.target_kind === undefined || payload.target_kind === null
    ? null
    : mustMarketingTargetKind(payload.target_kind, `events[${index}].target_kind`);
  const targetUrl = payload.target_url === undefined || payload.target_url === null
    ? null
    : mustString(payload.target_url, `events[${index}].target_url`);

  if (eventType === 'airport_impression') {
    if (!airportId) {
      throw new HttpError(400, 'BAD_REQUEST', `events[${index}].airport_id is required for airport_impression`);
    }
    if (!placement) {
      throw new HttpError(400, 'BAD_REQUEST', `events[${index}].placement is required for airport_impression`);
    }
  }

  if (eventType === 'outbound_click') {
    if (!airportId) {
      throw new HttpError(400, 'BAD_REQUEST', `events[${index}].airport_id is required for outbound_click`);
    }
    if (!placement) {
      throw new HttpError(400, 'BAD_REQUEST', `events[${index}].placement is required for outbound_click`);
    }
    if (!targetKind) {
      throw new HttpError(400, 'BAD_REQUEST', `events[${index}].target_kind is required for outbound_click`);
    }
    if (!targetUrl) {
      throw new HttpError(400, 'BAD_REQUEST', `events[${index}].target_url is required for outbound_click`);
    }
  }

  return {
    occurred_at: occurredAt,
    event_type: eventType,
    page_path: pagePath,
    page_kind: pageKind,
    referrer_path: referrerPath,
    external_referrer_host: externalReferrerHost,
    airport_id: airportId,
    placement,
    target_kind: targetKind,
    target_url: targetUrl,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    utm_content: utmContent,
    utm_term: utmTerm,
    client_session_id: clientSessionId,
  };
}

function mustIsoDateTime(value: unknown, fieldName: string): string {
  const text = mustString(value, fieldName);
  if (Number.isNaN(Date.parse(text))) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be valid ISO datetime`);
  }
  return text;
}

function mustPositiveInt(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be positive integer`);
  }
  return num;
}

function mustMarketingPlacement(value: unknown, fieldName: string): MarketingPlacement {
  const text = String(value || '') as MarketingPlacement;
  if (!MARKETING_PLACEMENTS.includes(text)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} is invalid`);
  }
  return text;
}

function mustMarketingTargetKind(value: unknown, fieldName: string): MarketingTargetKind {
  const text = String(value || '') as MarketingTargetKind;
  if (!MARKETING_TARGET_KINDS.includes(text)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} is invalid`);
  }
  return text;
}

function createTimedPromiseCache(ttlMs: number): {
  getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T>;
} {
  const cache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

  return {
    getOrLoad<T>(key: string, loader: () => Promise<T>): Promise<T> {
      const now = Date.now();
      const cached = cache.get(key);
      if (cached && cached.expiresAt > now) {
        return cached.promise as Promise<T>;
      }

      const promise = loader().catch((error) => {
        const current = cache.get(key);
        if (current?.promise === promise) {
          cache.delete(key);
        }
        throw error;
      });

      cache.set(key, {
        expiresAt: now + ttlMs,
        promise,
      });
      return promise;
    },
  };
}
