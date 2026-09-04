import { defaultRevenueQuery, validRevenueDate, type RevenueQuery } from '../../../shared/revenue';
export function readRevenueQuery(search: string, now = new Date()): RevenueQuery {
  const base = defaultRevenueQuery(now), params = new URLSearchParams(search);
  const result = { ...base };
  for (const key of ['date_from', 'date_to'] as const) {
    const value = params.get(key); if (value && validRevenueDate(value) && value >= '2000-01-01' && value <= base.date_to) result[key] = value;
  }
  if (result.date_from > result.date_to) { result.date_from = base.date_from; result.date_to = base.date_to; }
  for (const [key, allowed] of Object.entries({ view: ['income', 'receipts'], granularity: ['day', 'week', 'month'], table: ['airports', 'periods', 'transactions'], sort: ['amount', 'name', 'time'], order: ['asc', 'desc'] })) {
    const value = params.get(key); if (value && allowed.includes(value)) Object.assign(result, { [key]: value });
  }
  const entity = params.get('entity') || '';
  if (/^(airport|application|account):[1-9]\d*$/.test(entity)) result.entity = entity;
  for (const key of ['page', 'page_size'] as const) {
    const value = Number(params.get(key));
    if (Number.isSafeInteger(value) && value > 0 && value <= (key === 'page_size' ? 100 : 1000000)) result[key] = value;
  }
  return result;
}
export function updateRevenueQuery(query: RevenueQuery, patch: Partial<RevenueQuery>): RevenueQuery {
  return { ...query, page: 1, ...patch };
}
