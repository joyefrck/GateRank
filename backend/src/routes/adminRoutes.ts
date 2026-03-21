import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler';
import type { AirportStatus, DailyMetricsInput } from '../types/domain';
import { getDateInTimezone } from '../utils/time';

interface AdminDeps {
  airportRepository: {
    create(input: {
      name: string;
      website: string;
      status?: AirportStatus;
      plan_price_month: number;
      has_trial: boolean;
      tags?: string[];
    }): Promise<number>;
    update(
      id: number,
      input: {
        name?: string;
        website?: string;
        status?: AirportStatus;
        plan_price_month?: number;
        has_trial?: boolean;
        tags?: string[];
      },
    ): Promise<boolean>;
  };
  metricsRepository: {
    upsertDaily(input: DailyMetricsInput): Promise<void>;
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
  recomputeService: {
    recomputeForDate(date: string): Promise<{ recomputed: number }>;
  };
  auditRepository: {
    log(action: string, actor: string, requestId: string, payload: unknown): Promise<void>;
  };
}

export function createAdminRoutes(deps: AdminDeps): Router {
  const router = Router();

  router.post('/airports', async (req, res, next) => {
    try {
      const payload = req.body ?? {};
      const name = mustString(payload.name, 'name');
      const website = mustString(payload.website, 'website');
      const status = payload.status ? toStatus(payload.status) : 'normal';
      const planPriceMonth = mustNumber(payload.plan_price_month, 'plan_price_month');
      const hasTrial = Boolean(payload.has_trial);
      const tags = toStringArray(payload.tags || []);

      const airportId = await deps.airportRepository.create({
        name,
        website,
        status,
        plan_price_month: planPriceMonth,
        has_trial: hasTrial,
        tags,
      });

      await deps.auditRepository.log('create_airport', actorFromReq(req), req.requestId, payload);
      res.status(201).json({ airport_id: airportId });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/airports/:id', async (req, res, next) => {
    try {
      const airportId = toAirportId(req.params.id);
      const payload = req.body ?? {};
      const patch = {
        name: optionalString(payload.name, 'name'),
        website: optionalString(payload.website, 'website'),
        status: payload.status ? toStatus(payload.status) : undefined,
        plan_price_month:
          payload.plan_price_month === undefined
            ? undefined
            : mustNumber(payload.plan_price_month, 'plan_price_month'),
        has_trial: payload.has_trial === undefined ? undefined : Boolean(payload.has_trial),
        tags: payload.tags === undefined ? undefined : toStringArray(payload.tags),
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
      next(error);
    }
  });

  router.post('/metrics/daily', async (req, res, next) => {
    try {
      const payload = req.body ?? {};
      const input: DailyMetricsInput = {
        airport_id: toAirportId(payload.airport_id),
        date: parseDate(payload.date),
        uptime_percent_30d: mustNumber(payload.uptime_percent_30d, 'uptime_percent_30d'),
        median_latency_ms: mustNumber(payload.median_latency_ms, 'median_latency_ms'),
        median_download_mbps: mustNumber(payload.median_download_mbps, 'median_download_mbps'),
        packet_loss_percent: mustNumber(payload.packet_loss_percent, 'packet_loss_percent'),
        stable_days_streak: mustNumber(payload.stable_days_streak, 'stable_days_streak'),
        domain_ok: Boolean(payload.domain_ok),
        ssl_days_left: mustNumber(payload.ssl_days_left, 'ssl_days_left'),
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

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return mustString(value, fieldName);
}

function mustNumber(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be number`);
  }
  return num;
}

function toStatus(value: unknown): AirportStatus {
  if (value === 'normal' || value === 'risk' || value === 'down') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'status must be normal|risk|down');
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', 'tags must be array');
  }
  return value.map((v) => String(v));
}

function actorFromReq(req: { header(name: string): string | undefined }): string {
  return req.header('x-admin-actor') || 'admin';
}
