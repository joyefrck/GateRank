import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { defaultRevenueQuery, revenuePeriod, revenuePeriods, revenueSearch, revenueToday, validRevenueDate, revenuePresetRanges } from '../../shared/revenue';
import { readRevenueQuery, updateRevenueQuery } from '../../src/admin/revenue/revenueState';
import { parseRevenueQuery, createRevenueRoutes } from '../src/routes/revenueRoutes';
import { previousRevenueQuery, fillRevenuePeriods, type RevenueService } from '../src/services/revenueService';
import { adminAuth } from '../src/middleware/adminAuth';
import { errorHandler } from '../src/middleware/errorHandler';
import { revenueSource } from '../src/repositories/revenueRepository';
const now = new Date('2026-09-04T04:00:00Z');
test('Shanghai dates, leap days, Monday weeks and cross-year periods', () => {
  assert.equal(revenueToday(new Date('2026-12-31T16:00:00Z')), '2027-01-01');
  assert.equal(validRevenueDate('2026-02-29'), false); assert.equal(validRevenueDate('2024-02-29'), true);
  assert.equal(revenuePeriod('2026-09-06', 'week'), '2026-08-31');
  assert.deepEqual(revenuePeriods({ date_from: '2025-12-30', date_to: '2026-01-02', granularity: 'month' }), ['2025-12-01', '2026-01-01']);
  assert.deepEqual(revenuePeriods({ date_from: '2026-09-04', date_to: '2026-09-08', granularity: 'week' }), ['2026-08-31', '2026-09-07']);
});
test('strict query validation rejects invalid dates, nested inputs and SQL-like selectors', () => {
  for (const input of [{ date_from: '2026-02-30' }, { date_from: '2026-09-04', date_to: '2026-09-01' }, { entity: 'airport:1 OR 1=1' }, { sort: 'DROP TABLE' }, { view: ['income'] }, { page_size: '101' }, { page: 'NaN' }, { granularity: 'year' }, { date_to: '2027-01-01' }]) assert.throws(() => parseRevenueQuery(input, now));
  assert.equal(parseRevenueQuery({ entity: 'application:3' }, now).entity, 'application:3');
});
test('URL state restores view, dates, filtering, pagination and sorting; filter changes reset page', () => {
  const query = { ...defaultRevenueQuery(now), entity: 'airport:8', view: 'receipts' as const, granularity: 'week' as const, page: 4, table: 'transactions' as const, sort: 'time' as const };
  assert.deepEqual(readRevenueQuery(`?${revenueSearch(query)}`, now), query);
  assert.equal(updateRevenueQuery(query, { entity: 'airport:9' }).page, 1);
  assert.deepEqual(readRevenueQuery('?date_from=bad&date_to=bad&view=bad&page=-1', now), defaultRevenueQuery(now));
});
test('equal-length previous range and zero-filled periods preserve dates', () => {
  const query = { ...defaultRevenueQuery(now), date_from: '2026-09-01', date_to: '2026-09-04' };
  const previous = previousRevenueQuery(query);
  assert.equal(previous.date_from, '2026-08-28'); assert.equal(previous.date_to, '2026-08-31');
  assert.equal(fillRevenuePeriods(query, []).length, 4); assert.equal(fillRevenuePeriods(query, [])[0].amount_cents, 0);
});
test('statistics relation uses a source whitelist, does not use manual paid flags and binds filters', () => {
  const query = { ...defaultRevenueQuery(now), entity: 'airport:7' };
  const income = revenueSource(query), receipts = revenueSource({ ...query, view: 'receipts' });
  assert.match(income.sql, /transaction_type IN \('click_charge', 'ad_campaign_charge'\)/);
  assert.doesNotMatch(income.sql, /payment_status|balance_after|SUM\(.*balance/);
  assert.doesNotMatch(receipts.sql, /applicant_wallet_transactions/);
  assert.equal(income.params.at(-1), 'airport:7'); assert.doesNotMatch(income.sql, /airport:7/);
});
test('admin authentication, no-store, validation and all five routes', async () => {
  const prior = process.env.ADMIN_API_KEY; process.env.ADMIN_API_KEY = 'revenue-unit-test-key';
  const received: unknown[] = [];
  const stub = Object.fromEntries(['overview', 'airports', 'periods', 'transactions', 'filters'].map(key => [key, async (query: unknown) => { received.push(query); return { endpoint: key }; }])) as unknown as RevenueService;
  const app = express(); app.use('/api/v1/admin', adminAuth, createRevenueRoutes(stub)); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const root = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/admin/revenue`;
  try {
    assert.equal((await fetch(`${root}/overview`)).status, 401);
    for (const endpoint of ['overview', 'airports', 'periods', 'transactions', 'filters']) {
      const response = await fetch(`${root}/${endpoint}`, { headers: { 'x-api-key': 'revenue-unit-test-key' } });
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal(((await response.json()) as { endpoint: string }).endpoint, endpoint);
    }
    assert.equal((await fetch(`${root}/overview?date_from=bad`, { headers: { 'x-api-key': 'revenue-unit-test-key' } })).status, 400);
    assert.equal(received.length, 5);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); if (prior === undefined) delete process.env.ADMIN_API_KEY; else process.env.ADMIN_API_KEY = prior; }
});

test('default recent month and extended presets use calendar months in Shanghai', () => {
  const ranges = revenuePresetRanges(now);
  assert.deepEqual(ranges.recent, { date_from: '2026-08-04', date_to: '2026-09-04' });
  assert.deepEqual(ranges.quarter, { date_from: '2026-06-04', date_to: '2026-09-04' });
  assert.deepEqual(ranges.half_year, { date_from: '2026-03-04', date_to: '2026-09-04' });
  assert.deepEqual(ranges.year_to_date, { date_from: '2026-01-01', date_to: '2026-09-04' });
  assert.equal(defaultRevenueQuery(now).date_from, ranges.recent.date_from);
  assert.equal(readRevenueQuery('', now).date_from, ranges.recent.date_from);
  assert.equal(parseRevenueQuery({}, now).date_from, ranges.recent.date_from);
  assert.equal(revenuePresetRanges(new Date('2026-03-31T12:00:00Z')).recent.date_from, '2026-02-28');
  assert.equal(revenuePresetRanges(new Date('2024-03-31T12:00:00Z')).recent.date_from, '2024-02-29');
  const newYear = revenuePresetRanges(new Date('2026-12-31T16:00:00Z'));
  assert.deepEqual(newYear.year_to_date, { date_from: '2027-01-01', date_to: '2027-01-01' });
  assert.equal(newYear.half_year.date_from, '2026-07-01');
});
