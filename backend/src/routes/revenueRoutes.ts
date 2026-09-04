import { Router } from 'express';
import { defaultRevenueQuery, validRevenueDate, type RevenueQuery } from '../../../shared/revenue';
import { HttpError } from '../middleware/errorHandler';
import type { RevenueService } from '../services/revenueService';
export function parseRevenueQuery(input: Record<string, unknown>, now = new Date()): RevenueQuery {
  const result = defaultRevenueQuery(now);
  const bad = (key: string): never => { throw new HttpError(400, 'BAD_REQUEST', `收入统计参数无效：${key}`); };
  for (const key of Object.keys(result) as (keyof RevenueQuery)[]) {
    const value = input[key]; if (value === undefined) continue;
    if (typeof value !== 'string') bad(key);
    const text = value as string;
    if (key === 'page' || key === 'page_size') {
      const number = Number(text);
      if (!/^\d+$/.test(text) || !Number.isSafeInteger(number) || number < 1 || number > (key === 'page_size' ? 100 : 1000000)) bad(key);
      result[key] = number;
    } else if (key === 'date_from' || key === 'date_to') {
      if (!validRevenueDate(text) || text < '2000-01-01' || text > defaultRevenueQuery(now).date_to) bad(key);
      result[key] = text;
    } else if (key === 'entity') {
      if (text && !/^(airport|application|account):[1-9]\d*$/.test(text)) bad(key);
      result.entity = text;
    } else {
      const allowed = { view: ['income', 'receipts'], granularity: ['day', 'week', 'month'], table: ['airports', 'periods', 'transactions'], sort: ['amount', 'name', 'time'], order: ['asc', 'desc'] };
      if (!allowed[key].includes(text)) bad(key);
      Object.assign(result, { [key]: text });
    }
  }
  if (result.date_from > result.date_to) bad('date_from / date_to');
  return result;
}
export function createRevenueRoutes(service: RevenueService): Router {
  const router = Router();
  for (const endpoint of ['overview', 'airports', 'periods', 'transactions', 'filters'] as const) {
    router.get(`/revenue/${endpoint}`, async (req, res, next) => {
      res.set('Cache-Control', 'no-store');
      try { res.json(await service[endpoint](parseRevenueQuery(req.query))); } catch (error) { next(error); }
    });
  }
  return router;
}
