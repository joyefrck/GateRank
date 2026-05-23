import test from 'node:test';
import assert from 'node:assert/strict';
import { AirportAdCampaignRepository } from '../src/repositories/airportAdCampaignRepository';

function createCampaignRow(overrides: Record<string, unknown> = {}) {
  return {
    campaign_id: 101,
    airport_id: 11,
    airport_name: '小米',
    airport_slug: 'xiaomi',
    website: 'https://www.xiaomi.com',
    plan_price_month: 18,
    has_trial: 1,
    streaming_support_json: '["netflix","chatgpt"]',
    payment_methods_json: '["usdt"]',
    coupon_code: 'NEW550',
    discount_title: '端午节大优惠码',
    discount_description: '这还是活动说明',
    applicable_plan: '所有',
    starts_at: '2026-05-24 03:40:45',
    ends_at: '2026-06-24 03:40:45',
    purchased_months: 1,
    billed_amount: 1000,
    is_stackable: 0,
    refund_supported: 0,
    discount_percent: 20,
    campaign_status: 'active',
    created_at: '2026-05-24 03:40:45',
    ...overrides,
  };
}

test('AirportAdCampaignRepository.getPortalStatus counts active campaigns, not distinct airports', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AirportAdCampaignRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('COUNT(*) AS active_count')) {
        return [[{ active_count: 1 }]];
      }
      if (sql.includes('WHERE campaign.airport_id = ?')) {
        return [[[createCampaignRow()]]][0];
      }
      return [[]];
    },
  } as never);

  const status = await repository.getPortalStatus(11, 1288.88, new Date('2026-05-24T04:00:00+08:00'));

  assert.equal(status.remaining_slots, 5);
  assert.equal(status.slot_limit, 6);
  assert.equal(status.monthly_price, 1288.88);
  assert.equal(status.active_campaign?.airport_name, '小米');
  assert.equal(status.campaigns.length, 1);
  assert.ok(calls.some((call) => call.sql.includes('COUNT(*) AS active_count')));
  assert.ok(!calls.some((call) => call.sql.includes('COUNT(DISTINCT airport_id)')));
});

test('AirportAdCampaignRepository.listActiveDeals excludes canceled campaigns in SQL filter', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AirportAdCampaignRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [[createCampaignRow({ campaign_id: 101, campaign_status: 'active' })]];
    },
  } as never);

  const deals = await repository.listActiveDeals(new Date('2026-05-24T04:00:00+08:00'));

  assert.equal(deals.length, 1);
  assert.equal(deals[0].campaign_id, 101);
  assert.ok(calls[0].sql.includes("campaign.status = 'active'"));
  assert.ok(calls[0].sql.includes('campaign.ends_at > ?'));
});

test('AirportAdCampaignRepository.purchase allows another active campaign for the same airport when slots remain', async () => {
  const calls: Array<{ kind: 'query' | 'execute' | 'begin' | 'commit' | 'rollback' | 'release'; sql?: string; params?: unknown[] }> = [];
  const wallet = {
    id: 55,
    applicant_account_id: 3,
    application_id: 7,
    airport_id: 11,
    balance: 3000,
  };
  const connection = {
    beginTransaction: async () => {
      calls.push({ kind: 'begin' });
    },
    commit: async () => {
      calls.push({ kind: 'commit' });
    },
    rollback: async () => {
      calls.push({ kind: 'rollback' });
    },
    release: () => {
      calls.push({ kind: 'release' });
    },
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'query', sql, params });
      if (sql.includes('SELECT id') && sql.includes('FROM airport_ad_campaigns') && sql.includes('FOR UPDATE')) {
        return [[{ id: 101 }]];
      }
      if (sql.includes('FROM applicant_wallets') && sql.includes('FOR UPDATE')) {
        return [[wallet]];
      }
      if (sql.includes('SELECT MAX(display_order)')) {
        return [[{ max_order: 1 }]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'execute', sql, params });
      if (sql.includes('INSERT INTO airport_ad_campaigns')) {
        return [{ insertId: 202 }];
      }
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new AirportAdCampaignRepository({
    getConnection: async () => connection,
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'query', sql, params });
      if (sql.includes('WHERE campaign.airport_id = ?')) {
        return [[createCampaignRow({ campaign_id: 202, coupon_code: 'SECOND550' })]];
      }
      return [[]];
    },
  } as never);

  const campaign = await repository.purchase({
    airport_id: 11,
    applicant_account_id: 3,
    application_id: 7,
    months: 1,
    monthly_price: 1200.25,
    coupon_code: 'SECOND550',
    discount_title: '第二条投放',
    discount_description: '同机场第二条活动',
    applicable_plan: '所有',
    is_stackable: false,
    refund_supported: false,
    discount_percent: 10,
  }, new Date('2026-05-24T04:00:00+08:00'));

  assert.equal(campaign.campaign_id, 202);
  assert.equal(campaign.coupon_code, 'SECOND550');
  assert.ok(calls.some((call) => call.kind === 'execute' && call.sql?.includes('UPDATE applicant_wallets SET balance = ? WHERE id = ?') && call.params?.[0] === 1799.75));
  assert.ok(calls.some((call) => call.kind === 'execute' && call.sql?.includes('INSERT INTO airport_ad_campaigns') && call.params?.[12] === 1200.25));
  assert.ok(calls.some((call) => call.kind === 'execute' && call.sql?.includes('INSERT INTO applicant_wallet_transactions') && call.params?.[4] === -1200.25));
  assert.ok(calls.some((call) => call.kind === 'execute' && call.sql?.includes('INSERT INTO airport_ad_campaigns')));
  assert.ok(!calls.some((call) => call.sql?.includes('SELECT id, airport_id, wallet_id') && call.sql?.includes('FOR UPDATE')));
  assert.ok(calls.some((call) => call.kind === 'commit'));
});

test('AirportAdCampaignRepository.update charges configured monthly price for renewals', async () => {
  const calls: Array<{ kind: 'query' | 'execute' | 'begin' | 'commit' | 'rollback' | 'release'; sql?: string; params?: unknown[] }> = [];
  const wallet = {
    id: 55,
    applicant_account_id: 3,
    application_id: 7,
    airport_id: 11,
    balance: 2900,
  };
  const connection = {
    beginTransaction: async () => {
      calls.push({ kind: 'begin' });
    },
    commit: async () => {
      calls.push({ kind: 'commit' });
    },
    rollback: async () => {
      calls.push({ kind: 'rollback' });
    },
    release: () => {
      calls.push({ kind: 'release' });
    },
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'query', sql, params });
      if (sql.includes('SELECT id, airport_id, wallet_id') && sql.includes('FOR UPDATE')) {
        return [[{
          id: 101,
          airport_id: 11,
          wallet_id: 55,
          starts_at: '2026-05-24 04:00:00',
          ends_at: '2026-06-24 04:00:00',
          purchased_months: 1,
          billed_amount: 1000,
          display_order: 1,
        }]];
      }
      if (sql.includes('FROM applicant_wallets') && sql.includes('FOR UPDATE')) {
        return [[wallet]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'execute', sql, params });
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new AirportAdCampaignRepository({
    getConnection: async () => connection,
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'query', sql, params });
      if (sql.includes('WHERE campaign.airport_id = ?')) {
        return [[createCampaignRow({
          campaign_id: 101,
          coupon_code: 'RENEW550',
          purchased_months: 4,
          billed_amount: 3401.5,
        })]];
      }
      return [[]];
    },
  } as never);

  const campaign = await repository.update({
    campaign_id: 101,
    airport_id: 11,
    applicant_account_id: 3,
    application_id: 7,
    extend_months: 3,
    monthly_price: 800.5,
    coupon_code: 'RENEW550',
    discount_title: '续投',
    discount_description: '延长三个月',
    applicable_plan: '所有',
    is_stackable: false,
    refund_supported: false,
    discount_percent: 10,
  }, new Date('2026-05-24T04:00:00+08:00'));

  assert.equal(campaign.campaign_id, 101);
  assert.ok(calls.some((call) => call.kind === 'execute' && call.sql?.includes('UPDATE applicant_wallets SET balance = ? WHERE id = ?') && call.params?.[0] === 498.5));
  assert.ok(calls.some((call) => call.kind === 'execute' && call.sql?.includes('billed_amount = billed_amount + ?') && call.params?.[8] === 2401.5));
  assert.ok(calls.some((call) => call.kind === 'execute' && call.sql?.includes('INSERT INTO applicant_wallet_transactions') && call.params?.[4] === -2401.5));
  assert.ok(calls.some((call) => call.kind === 'commit'));
});

test('AirportAdCampaignRepository.cancel marks active campaign canceled without wallet writes', async () => {
  const calls: Array<{ kind: 'query' | 'execute' | 'begin' | 'commit' | 'rollback' | 'release'; sql?: string; params?: unknown[] }> = [];
  const connection = {
    beginTransaction: async () => {
      calls.push({ kind: 'begin' });
    },
    commit: async () => {
      calls.push({ kind: 'commit' });
    },
    rollback: async () => {
      calls.push({ kind: 'rollback' });
    },
    release: () => {
      calls.push({ kind: 'release' });
    },
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'query', sql, params });
      if (sql.includes('SELECT id, airport_id, wallet_id') && sql.includes('FROM airport_ad_campaigns')) {
        return [[{
          id: 101,
          airport_id: 11,
          wallet_id: 55,
          starts_at: '2026-05-24 03:40:45',
          ends_at: '2026-06-24 03:40:45',
          purchased_months: 1,
          billed_amount: 1000,
          display_order: 1,
        }]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'execute', sql, params });
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new AirportAdCampaignRepository({
    getConnection: async () => connection,
  } as never);

  const canceled = await repository.cancel({
    campaign_id: 101,
    airport_id: 11,
    applicant_account_id: 3,
    application_id: 7,
  }, new Date('2026-05-24T04:00:00+08:00'));

  assert.equal(canceled, true);
  assert.ok(calls.some((call) => call.kind === 'execute' && call.sql?.includes("SET status = 'canceled'")));
  assert.ok(!calls.some((call) => call.sql?.includes('applicant_wallets')));
  assert.ok(!calls.some((call) => call.sql?.includes('applicant_wallet_transactions')));
  assert.ok(calls.some((call) => call.kind === 'commit'));
  assert.ok(!calls.some((call) => call.kind === 'rollback'));
  assert.ok(calls.some((call) => call.kind === 'release'));
});

test('AirportAdCampaignRepository.cancel rejects expired, canceled, or non-owned campaigns', async () => {
  const calls: Array<{ kind: 'query' | 'execute' | 'begin' | 'commit' | 'rollback' | 'release'; sql?: string; params?: unknown[] }> = [];
  const connection = {
    beginTransaction: async () => {
      calls.push({ kind: 'begin' });
    },
    commit: async () => {
      calls.push({ kind: 'commit' });
    },
    rollback: async () => {
      calls.push({ kind: 'rollback' });
    },
    release: () => {
      calls.push({ kind: 'release' });
    },
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'query', sql, params });
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'execute', sql, params });
      return [{ affectedRows: 0 }];
    },
  };
  const repository = new AirportAdCampaignRepository({
    getConnection: async () => connection,
  } as never);

  await assert.rejects(
    () => repository.cancel({
      campaign_id: 101,
      airport_id: 11,
      applicant_account_id: 3,
      application_id: 7,
    }, new Date('2026-05-24T04:00:00+08:00')),
    /投放不存在、已过期或不属于当前机场/,
  );

  assert.ok(!calls.some((call) => call.kind === 'execute' && call.sql?.includes("SET status = 'canceled'")));
  assert.ok(calls.some((call) => call.kind === 'rollback'));
  assert.ok(!calls.some((call) => call.kind === 'commit'));
  assert.ok(calls.some((call) => call.kind === 'release'));
});
