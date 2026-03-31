import { Router } from 'express';
import { RANKING_TYPES } from '../config/scoring';
import { HttpError } from '../middleware/errorHandler';
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
}

export function createPublicRoutes(deps: PublicDeps): Router {
  const router = Router();

  router.post('/airport-applications', async (req, res, next) => {
    try {
      const payload = (req.body ?? {}) as Record<string, unknown>;
      const websiteBundle = parseWebsiteFields(payload, true);
      const foundedOn = mustDate(payload.founded_on, 'founded_on');
      const today = getDateInTimezone();
      if (foundedOn > today) {
        throw new HttpError(400, 'BAD_REQUEST', 'founded_on cannot be in the future');
      }

      const applicationInput = {
        name: mustString(payload.name, 'name'),
        website: websiteBundle.website,
        websites: websiteBundle.websites,
        status: 'normal' as const,
        plan_price_month: mustNonNegativeNumber(payload.plan_price_month, 'plan_price_month'),
        has_trial: Boolean(payload.has_trial),
        subscription_url: optionalString(payload.subscription_url) || null,
        applicant_email: mustEmail(payload.applicant_email, 'applicant_email'),
        applicant_telegram: mustString(payload.applicant_telegram, 'applicant_telegram'),
        founded_on: foundedOn,
        airport_intro: mustString(payload.airport_intro, 'airport_intro'),
        test_account: mustString(payload.test_account, 'test_account'),
        test_password: mustString(payload.test_password, 'test_password'),
      };

      const applicationId = await deps.airportApplicationRepository.create(applicationInput);

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

      res.status(201).json({
        application_id: applicationId,
        review_status: 'pending' satisfies AirportApplicationReviewStatus,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/pages/home', async (req, res, next) => {
    try {
      const date = parseDateQuery(req.query.date);
      const data = await deps.publicViewService.getHomePageView(date);
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
      const data = await deps.publicViewService.getFullRankingView(date, page, pageSize);
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
      const data = await deps.publicViewService.getRiskMonitorView(date, page, pageSize);
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
