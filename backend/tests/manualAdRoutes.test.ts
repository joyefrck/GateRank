import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createAdminRoutes } from '../src/routes/adminRoutes';
import { adminAuth } from '../src/middleware/adminAuth';
import { errorHandler } from '../src/middleware/errorHandler';

const input = { airport_id: 1, home_slot: null, coupon_code: '', discount_title: '测试优惠', discount_description: '', applicable_plan: '', discount_percent: null, is_stackable: false, refund_supported: false, starts_at: '2026-10-01T00:00:00+08:00', ends_at: '2026-11-01T00:00:00+08:00' };
test('manual ad routes use admin authentication, validate before writes, audit and invalidate cache', async () => {
  const priorKey = process.env.ADMIN_API_KEY; process.env.ADMIN_API_KEY = 'manual-ad-unit-test-key';
  const saves: unknown[][] = [], cancels: unknown[][] = [], audits: string[] = [], lists: unknown[] = [];
  let clears = 0;
  const app = express(); app.use(express.json());
  app.use('/api/v1/admin', adminAuth, createAdminRoutes({
    airportRepository: { listByQuery: async () => ({ items: [{ id: 1, name: '测试机场', is_listed: true, status: 'normal' }], total: 1 }) },
    airportAdCampaignRepository: {
      listManualAds: async (query: unknown) => { lists.push(query); return { items: [], pagination: { page: 1, page_size: 20, total: 0, total_pages: 0 } }; },
      saveManualAd: async (...args: unknown[]) => { saves.push(args); return 10; },
      cancelManualAd: async (...args: unknown[]) => { cancels.push(args); },
    },
    auditRepository: { log: async (action: string) => { audits.push(action); } }, publicPageCache: { clear: () => { clears++; } },
  } as never)); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.on('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/admin/marketing/manual-ads`;
  const headers = { 'x-api-key': 'manual-ad-unit-test-key', 'Content-Type': 'application/json' };
  try {
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })).status, 401);
    assert.equal((await fetch(base, { method: 'POST', headers, body: JSON.stringify({ ...input, home_slot: 6 }) })).status, 400);
    assert.equal(saves.length, 0);
    assert.equal((await fetch(`${base}?status=scheduled&placement=home_5&page=2`, { headers })).status, 200);
    assert.deepEqual(lists[0], { page: 2, q: undefined, status: 'scheduled', placement: 'home_5' });
    assert.equal((await fetch(`${base}?status=invalid`, { headers })).status, 400);
    assert.equal((await fetch(`${base}?placement=home_6`, { headers })).status, 400);
    assert.equal((await fetch(`${base}/airports?q=测试`, { headers })).status, 200);
    const create = await fetch(base, { method: 'POST', headers, body: JSON.stringify(input) });
    assert.equal(create.status, 201); assert.deepEqual(await create.json(), { campaign_id: 10 });
    assert.equal((await fetch(`${base}/10`, { method: 'PATCH', headers, body: JSON.stringify(input) })).status, 200);
    assert.equal(saves[1][2], 10);
    assert.equal((await fetch(`${base}/10/cancel`, { method: 'POST', headers })).status, 200);
    assert.equal(cancels[0][0], 10);
    assert.deepEqual(audits, ['create_manual_ad', 'update_manual_ad', 'cancel_manual_ad']); assert.equal(clears, 3);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (priorKey === undefined) delete process.env.ADMIN_API_KEY; else process.env.ADMIN_API_KEY = priorKey;
  }
});
