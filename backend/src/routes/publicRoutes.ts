import { Router } from 'express';
import { RANKING_TYPES } from '../config/scoring';
import { HttpError } from '../middleware/errorHandler';
import { dateDaysAgo, getDateInTimezone } from '../utils/time';

interface PublicDeps {
  airportRepository: {
    getById(id: number): Promise<unknown | null>;
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
}

export function createPublicRoutes(deps: PublicDeps): Router {
  const router = Router();

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

  return router;
}

function parseDateQuery(input: unknown): string {
  const date = String(input || getDateInTimezone());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'BAD_REQUEST', 'date must be YYYY-MM-DD');
  }
  return date;
}

function toAirportId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', `invalid airport id: ${value}`);
  }
  return id;
}
