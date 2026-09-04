import test from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { defaultRevenueQuery } from '../../shared/revenue';
import { RevenueRepository } from '../src/repositories/revenueRepository';
import { RevenueService } from '../src/services/revenueService';
import { seedRevenueFixture } from './fixtures/revenueFixture';
// Opt-in and always uses an isolated database; never reads application credentials.
test('revenue MySQL: manual exclusions, gateway receipts, renewals, reconciliation and historical collations', { skip: !process.env.GATERANK_REVENUE_TEST_PORT }, async t => {
  const database = `gaterank_revenue_test_${process.pid}_${Date.now()}`;
  const config = { host: '127.0.0.1', port: Number(process.env.GATERANK_REVENUE_TEST_PORT), user: 'root', password: '', decimalNumbers: true };
  const admin = mysql.createPool(config);
  await admin.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);
  const pool = mysql.createPool({ ...config, database });
  const repository = new RevenueRepository(pool), service = new RevenueService(repository);
  const query = { ...defaultRevenueQuery(new Date('2026-09-04T12:00:00Z')), date_from: '2026-09-01' };
  try {
    await seedRevenueFixture(pool); await repository.ensureSchema(); await repository.ensureSchema();
    await t.test('income counts only paid gateway entry fees and real debits, excludes manual flags/credits', async () => {
      const data = await service.overview(query);
      assert.equal(data.totals.amount_cents, 52060); assert.equal(data.totals.application_cents, 17000);
      assert.equal(data.totals.advertising_cents, 35000); assert.equal(data.totals.click_cents, 60);
      assert.equal(data.totals.record_count, 8); assert.equal(data.totals.click_count, 3);
      assert.equal(data.totals.advertising_count, 2); assert.equal(data.totals.entity_count, 3);
      assert.equal(data.previous.amount_cents, 1000); assert.equal(data.missing_payment_time_count, 1);
      assert.equal(data.placements.find(row => row.key === 'unknown')?.amount_cents, 30);
      assert.equal(data.top_five_share, 1);
    });
    await t.test('cash counts successful orders once, never recharge ledger rows or manual adjustments', async () => {
      const data = await service.overview({ ...query, view: 'receipts' });
      assert.equal(data.totals.amount_cents, 155000); assert.equal(data.totals.recharge_cents, 138000);
      assert.equal(data.totals.record_count, 6); assert.equal(data.missing_payment_time_count, 2);
      assert.equal(data.channels.reduce((sum, row) => sum + row.amount_cents, 0), 155000);
      assert.deepEqual(data.placements, []);
    });
    await t.test('all aggregations reconcile with each view and each granularity; empty periods filled', async () => {
      for (const view of ['income', 'receipts'] as const) for (const granularity of ['day', 'week', 'month'] as const) {
        const filtered = { ...query, view, granularity, page_size: 100 };
        const data = await service.overview(filtered);
        for (const rows of [data.trend, data.kinds, data.top_airports, (await service.airports(filtered)).items, (await service.periods(filtered)).items, (await service.transactions(filtered)).items]) {
          assert.equal(rows.reduce((sum, row) => sum + row.amount_cents, 0), data.totals.amount_cents);
        }
      }
      const empty = await service.overview({ ...query, date_from: '2026-07-01', date_to: '2026-07-03' });
      assert.equal(empty.totals.amount_cents, 0); assert.equal(empty.trend.length, 3); assert.equal(empty.top_five_share, 0);
    });
    await t.test('entity drill-down includes unlisted and unapproved records; paginates without duplicates', async () => {
      assert.equal((await service.overview({ ...query, entity: 'airport:2' })).totals.amount_cents, 5020);
      assert.equal((await service.overview({ ...query, entity: 'application:3' })).totals.amount_cents, 2000);
      assert.equal((await service.overview({ ...query, entity: 'application:4' })).totals.amount_cents, 0);
      const seen = new Set<string>();
      for (let page = 1; page <= 4; page++) for (const row of (await service.transactions({ ...query, page, page_size: 2 })).items) { assert.equal(seen.has(row.id), false); seen.add(row.id); }
      assert.equal(seen.size, 8);
      assert.equal((await service.transactions({ ...query, page: 999, page_size: 2 })).page, 4);
      const ascending = await service.transactions({ ...query, sort: 'amount', order: 'asc', page_size: 100 });
      assert.deepEqual(ascending.items.map(row => row.amount_cents), [10, 20, 30, 2000, 5000, 10000, 15000, 20000]);
      const chronological = await service.airports({ ...query, sort: 'time', order: 'desc' });
      assert.equal(chronological.items[0].key, 'airport:1');
      const options = await service.filters(query); assert.equal(options.length, 3); assert.ok(options.some(row => row.name.includes('未关联机场')));
    });
    await t.test('successful orders survive missing application metadata; one snapshot ignores concurrent writes', async () => {
      await pool.query("INSERT INTO application_payment_orders VALUES (99, 999, 'orphan-order', 'paid', 7, '2026-06-01', 'alipay')");
      const orphan = await service.transactions({ ...query, date_from: '2026-06-01', date_to: '2026-06-01' });
      assert.equal(orphan.items[0].amount_cents, 700); assert.equal(orphan.items[0].entity_key, 'application:999');
      assert.match(orphan.items[0].name, /申请 #999/);
      await repository.snapshot(async reader => {
        const before = await reader.totals(query);
        await pool.query("INSERT INTO application_payment_orders VALUES (100, 1, 'concurrent-order', 'paid', 1, '2026-09-03', 'alipay')");
        assert.equal((await reader.totals(query)).amount_cents, before.amount_cents);
      });
      assert.equal((await service.overview(query)).totals.amount_cents, 52160);
    });
  } finally { await pool.end(); await admin.query(`DROP DATABASE ${database}`); await admin.end(); }
});
