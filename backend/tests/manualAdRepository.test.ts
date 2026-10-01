import test from 'node:test';
import assert from 'node:assert/strict';
import { AirportAdCampaignRepository } from '../src/repositories/airportAdCampaignRepository';
import type { ManualAdInput } from '../../shared/manualAds';

const input: ManualAdInput = { airport_id: 1, home_slot: 1, coupon_code: '', discount_title: '国庆优惠', discount_description: '', applicable_plan: '', discount_percent: null, is_stackable: false, refund_supported: false, starts_at: '2026-10-02T00:00:00+08:00', ends_at: '2026-11-02T00:00:00+08:00' };
function harness(options: { occupied?: boolean; missing?: boolean; ineligible?: boolean } = {}) {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const events: string[] = [];
  const connection = {
    beginTransaction: async () => { events.push('begin'); }, commit: async () => { events.push('commit'); }, rollback: async () => { events.push('rollback'); }, release: () => { events.push('release'); },
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('airport_ad_campaign_write_lock')) { events.push('lock'); return [[{ id: 1 }]]; }
      if (sql.includes('FROM airports')) return [options.ineligible ? [] : [{ id: 1 }]];
      if (sql.includes("campaign_source = 'admin'")) return [options.missing ? [] : [{ id: 5, airport_id: 1, home_slot: 1 }]];
      if (sql.includes('home_slot = ?')) return [options.occupied ? [{ id: 9, home_slot: 1 }] : []];
      if (sql.includes('MAX(display_order)')) return [[{ max_order: 4 }]];
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => { calls.push({ sql, params }); return [{ insertId: 10, affectedRows: options.missing ? 0 : 1 }]; },
  };
  const repo = new AirportAdCampaignRepository({ getConnection: async () => connection } as never);
  return { repo, calls, events };
}
test('manual save serializes writes and inserts a free campaign without touching wallets', async () => {
  const { repo, calls, events } = harness();
  assert.equal(await repo.saveManualAd(input, 'admin'), 10);
  assert.deepEqual(events, ['begin', 'lock', 'commit', 'release']);
  assert.ok(calls.every(call => !/applicant_wallet/.test(call.sql)));
  const insert = calls.find(call => call.sql.includes('INSERT INTO airport_ad_campaigns'))!;
  assert.match(insert.sql, /NULL, NULL, NULL, 'admin', 0, 0/);
  const conflict = calls.find(call => call.sql.includes('home_slot = ?'))!;
  assert.match(conflict.sql, /starts_at < \?/); assert.match(conflict.sql, /ends_at > \?/);
  assert.deepEqual(conflict.params, [1, '2026-11-02 00:00:00', '2026-10-02 00:00:00']);
});
test('manual conflicting reservation rolls back before any campaign or wallet write', async () => {
  const { repo, calls, events } = harness({ occupied: true });
  await assert.rejects(repo.saveManualAd(input, 'admin'), /已有投放/);
  assert.deepEqual(events, ['begin', 'lock', 'rollback', 'release']);
  assert.ok(!calls.some(call => call.sql.includes('INSERT') || call.sql.includes('UPDATE applicant_wallet')));
});
test('manual editor excludes itself from overlap check and preserves billing and tracking', async () => {
  const { repo, calls } = harness(); await repo.saveManualAd(input, 'admin', 5);
  const conflict = calls.find(call => call.sql.includes('home_slot = ?'))!;
  assert.match(conflict.sql, /AND id <> \?/); assert.equal(conflict.params?.at(-1), 5);
  const update = calls.find(call => call.sql.includes('UPDATE airport_ad_campaigns'))!;
  assert.doesNotMatch(update.sql, /SET.*billed_amount|tracking_started_at|wallet/);
});
test('manual editor rejects merchant or missing record without writes', async () => {
  const { repo, events } = harness({ missing: true }); await assert.rejects(repo.saveManualAd(input, 'admin', 5), /不存在/);
  assert.deepEqual(events, ['begin', 'lock', 'rollback', 'release']);
});
test('manual editor prevents attribution changes', async () => {
  const { repo } = harness(); await assert.rejects(repo.saveManualAd({ ...input, airport_id: 2 }, 'admin', 5), /不能更换机场/);
});
test('manual save rejects a hidden or down airport', async () => {
  const { repo } = harness({ ineligible: true }); await assert.rejects(repo.saveManualAd(input, 'admin'), /已公开/);
});
test('manual cancel scopes source and preserves historical records without wallet writes', async () => {
  const { repo, calls, events } = harness(); await repo.cancelManualAd(5, 'admin');
  const update = calls.find(call => call.sql.includes('UPDATE airport_ad_campaigns'))!;
  assert.match(update.sql, /campaign_source = 'admin'/); assert.match(update.sql, /status = 'canceled'/);
  assert.deepEqual(events, ['begin', 'lock', 'commit', 'release']);
});
