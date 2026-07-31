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
    home_slot: null,
    tracking_started_at: '2026-05-24 03:40:45',
    campaign_status: 'active',
    created_at: '2026-05-24 03:40:45',
    ...overrides,
  };
}

test('AirportAdCampaignRepository.ensureSchema backfills tracking start with the application timezone', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AirportAdCampaignRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('information_schema.COLUMNS') || sql.includes('information_schema.STATISTICS')) {
        return [[{ count: 1 }]];
      }
      return [[]];
    },
  } as never);

  await repository.ensureSchema(new Date('2026-07-31T21:35:00+08:00'));

  const backfill = calls.find((call) => call.sql.includes('SET tracking_started_at = ?'));
  assert.deepEqual(backfill?.params, [
    '2026-07-31 21:35:00',
    '2026-07-31 21:35:00',
    '2026-07-31 21:35:00',
  ]);
  assert.doesNotMatch(backfill?.sql || '', /NOW\(\)/);
});

test('AirportAdCampaignRepository.getPortalStats returns 30 newest daily rows and campaign-only totals', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AirportAdCampaignRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM airport_ad_campaigns') && sql.includes('applicant_account_id = ?')) {
        return [[{
          campaign_id: 101,
          tracking_started_at: '2026-07-01 00:00:00',
          ends_at: '2026-09-01 00:00:00',
        }]];
      }
      if (sql.includes('AS impressions') && !sql.includes('GROUP BY event_date')) {
        return [[{ impressions: 10, clicks: 5 }]];
      }
      if (sql.includes('GROUP BY event_date')) {
        return [[
          { event_date: '2026-07-31', impressions: 10, clicks: 2 },
          { event_date: '2026-07-30', impressions: 0, clicks: 3 },
        ]];
      }
      return [[]];
    },
  } as never);

  const firstPage = await repository.getPortalStats({
    campaign_id: 101,
    airport_id: 11,
    applicant_account_id: 3,
    application_id: 7,
    page: 1,
  }, new Date('2026-07-31T12:00:00+08:00'));
  const secondPage = await repository.getPortalStats({
    campaign_id: 101,
    airport_id: 11,
    applicant_account_id: 3,
    application_id: 7,
    page: 2,
  }, new Date('2026-07-31T12:00:00+08:00'));

  assert.equal(firstPage.tracking_started_on, '2026-07-01');
  assert.deepEqual(firstPage.summary, { impressions: 10, clicks: 5, ctr: 0.5 });
  assert.equal(firstPage.daily.length, 30);
  assert.deepEqual(firstPage.daily[0], { date: '2026-07-31', impressions: 10, clicks: 2, ctr: 0.2 });
  assert.deepEqual(firstPage.daily[1], { date: '2026-07-30', impressions: 0, clicks: 3, ctr: null });
  assert.equal(firstPage.daily[29]?.date, '2026-07-02');
  assert.deepEqual(firstPage.pagination, { page: 1, page_size: 30, total: 31, total_pages: 2 });
  assert.deepEqual(secondPage.daily, [{ date: '2026-07-01', impressions: 0, clicks: 0, ctr: null }]);
  assert.ok(calls.every((call) => !call.sql.includes('airport_id = ?') || call.sql.includes('applicant_account_id = ?')));
  const statsCalls = calls.filter((call) => call.sql.includes('FROM marketing_events'));
  assert.ok(statsCalls.every((call) => call.sql.includes('campaign_id = ?')));
});

test('AirportAdCampaignRepository.getPortalStats keeps untracked historical campaigns empty', async () => {
  const repository = new AirportAdCampaignRepository({
    query: async (sql: string) => {
      if (sql.includes('FROM airport_ad_campaigns')) {
        return [[{ campaign_id: 101, tracking_started_at: null, ends_at: '2026-06-01 00:00:00' }]];
      }
      throw new Error('marketing events must not be queried without an exact tracking boundary');
    },
  } as never);

  const result = await repository.getPortalStats({
    campaign_id: 101,
    airport_id: 11,
    applicant_account_id: 3,
    application_id: 7,
    page: 1,
  });

  assert.equal(result.tracking_started_on, null);
  assert.deepEqual(result.daily, []);
  assert.deepEqual(result.pagination, { page: 1, page_size: 30, total: 0, total_pages: 0 });
});

test('AirportAdCampaignRepository.listAdminStats returns filtered campaigns with validity and totals', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AirportAdCampaignRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('COUNT(*) AS total')) {
        return [[{ total: 1 }]];
      }
      if (sql.includes('WITH filtered_campaigns AS')) {
        return [[{
          campaign_id: 201,
          airport_id: 18,
          airport_name: 'YH',
          airport_slug: 'yh',
          coupon_code: 'SUMMER26',
          home_slot: 1,
          starts_at: '2026-07-31 10:00:00',
          ends_at: '2026-08-31 10:00:00',
          purchased_months: 1,
          campaign_status: 'active',
          tracking_started_at: '2026-07-31 10:00:00',
          created_at: '2026-07-31 10:00:00',
          impressions: 1284,
          clicks: 96,
        }]];
      }
      return [[]];
    },
  } as never);

  const result = await repository.listAdminStats({
    page: 1,
    keyword: 'YH',
    status: 'active',
    placement: 'home_1',
  }, new Date('2026-07-31T12:00:00+08:00'));

  assert.deepEqual(result.pagination, { page: 1, page_size: 20, total: 1, total_pages: 1 });
  assert.deepEqual(result.items[0], {
    campaign_id: 201,
    airport_id: 18,
    airport_name: 'YH',
    airport_slug: 'yh',
    coupon_code: 'SUMMER26',
    home_slot: 1,
    starts_at: '2026-07-31T10:00:00+08:00',
    ends_at: '2026-08-31T10:00:00+08:00',
    purchased_months: 1,
    status: 'active',
    tracking_started_on: '2026-07-31',
    summary: { impressions: 1284, clicks: 96, ctr: 0.0748 },
  });
  const countCall = calls.find((call) => call.sql.includes('COUNT(*) AS total'));
  const listCall = calls.find((call) => call.sql.includes('WITH filtered_campaigns AS'));
  assert.match(countCall?.sql || '', /airport\.name LIKE \?/);
  assert.match(countCall?.sql || '', /campaign\.status = 'active'/);
  assert.match(countCall?.sql || '', /campaign\.home_slot = \?/);
  assert.deepEqual(countCall?.params, ['%YH%', '%YH%', '2026-07-31 12:00:00', 1]);
  assert.deepEqual(listCall?.params?.slice(-3), [20, 0, '2026-07-31 12:00:00']);
});

test('AirportAdCampaignRepository.getAdminStats reuses campaign daily aggregation with admin metadata', async () => {
  const repository = new AirportAdCampaignRepository({
    query: async (sql: string) => {
      if (sql.includes('JOIN airports airport') && sql.includes('WHERE campaign.id = ?')) {
        return [[{
          campaign_id: 101,
          airport_id: 11,
          airport_name: '小米',
          airport_slug: 'xiaomi',
          coupon_code: 'NEW550',
          home_slot: null,
          starts_at: '2026-07-01 00:00:00',
          ends_at: '2026-09-01 00:00:00',
          purchased_months: 2,
          campaign_status: 'active',
          tracking_started_at: '2026-07-01 00:00:00',
        }]];
      }
      if (sql.includes('AS impressions') && !sql.includes('GROUP BY event_date')) {
        return [[{ impressions: 10, clicks: 5 }]];
      }
      if (sql.includes('GROUP BY event_date')) {
        return [[{ event_date: '2026-07-31', impressions: 10, clicks: 5 }]];
      }
      return [[]];
    },
  } as never);

  const result = await repository.getAdminStats(
    { campaign_id: 101, page: 1 },
    new Date('2026-07-31T12:00:00+08:00'),
  );

  assert.equal(result.airport_name, '小米');
  assert.equal(result.status, 'active');
  assert.equal(result.purchased_months, 2);
  assert.deepEqual(result.summary, { impressions: 10, clicks: 5, ctr: 0.5 });
  assert.deepEqual(result.daily[0], { date: '2026-07-31', impressions: 10, clicks: 5, ctr: 0.5 });
  assert.equal(result.daily.length, 30);
});

test('AirportAdCampaignRepository.listAdminStats derives expired and canceled history states', async () => {
  const baseRow = {
    airport_id: 18,
    airport_name: 'YH',
    airport_slug: 'yh',
    coupon_code: 'SUMMER26',
    home_slot: null,
    starts_at: '2026-05-01 00:00:00',
    ends_at: '2026-07-01 00:00:00',
    purchased_months: 2,
    tracking_started_at: '2026-05-01 00:00:00',
    created_at: '2026-05-01 00:00:00',
    impressions: 0,
    clicks: 0,
  };
  const repository = new AirportAdCampaignRepository({
    query: async (sql: string) => {
      if (sql.includes('COUNT(*) AS total')) return [[{ total: 2 }]];
      if (sql.includes('WITH filtered_campaigns AS')) {
        return [[
          { ...baseRow, campaign_id: 302, campaign_status: 'canceled' },
          { ...baseRow, campaign_id: 301, campaign_status: 'active' },
        ]];
      }
      return [[]];
    },
  } as never);

  const result = await repository.listAdminStats(
    { page: 1, status: 'all', placement: 'all' },
    new Date('2026-07-31T12:00:00+08:00'),
  );

  assert.deepEqual(result.items.map((item) => item.status), ['canceled', 'expired']);
  assert.ok(result.items.every((item) => item.summary.ctr === null));
});

test('AirportAdCampaignRepository.getPortalStatus reports homepage availability without a global campaign cap', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AirportAdCampaignRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('WHERE campaign.airport_id = ?')) {
        return [[[createCampaignRow()]]][0];
      }
      return [[]];
    },
  } as never);

  const status = await repository.getPortalStatus(11, 1288.88, new Date('2026-05-24T04:00:00+08:00'));

  assert.equal('remaining_slots' in status, false);
  assert.equal('slot_limit' in status, false);
  assert.equal(status.monthly_price, 1288.88);
  assert.deepEqual(status.home_slot_monthly_prices, { 1: 1288.88, 2: 1288.88, 3: 1288.88, 4: 1288.88 });
  assert.deepEqual(status.home_slot_availability, { 1: true, 2: true, 3: true, 4: true });
  assert.equal(status.active_campaign?.airport_name, '小米');
  assert.equal(status.campaigns.length, 1);
  assert.ok(!calls.some((call) => call.sql.includes('COUNT(*) AS active_count')));
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
  assert.doesNotMatch(calls[0].sql, /LIMIT\s+6\b/);
});

test('AirportAdCampaignRepository.purchase allows an ordinary campaign after six active campaigns', async () => {
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
        return [[
          { id: 101 },
          { id: 102 },
          { id: 103 },
          { id: 104 },
          { id: 105 },
          { id: 106 },
          { id: 107 },
        ]];
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
  assert.ok(calls.some((call) => call.kind === 'execute' && call.sql?.includes('INSERT INTO airport_ad_campaigns') && call.params?.[11] === null && call.params?.[13] === 1200.25));
  assert.ok(calls.some((call) => call.kind === 'execute' && call.sql?.includes('INSERT INTO applicant_wallet_transactions') && call.params?.[4] === -1200.25));
  assert.ok(calls.some((call) => call.kind === 'execute' && call.sql?.includes('INSERT INTO airport_ad_campaigns')));
  assert.ok(!calls.some((call) => call.sql?.includes('SELECT id, airport_id, wallet_id') && call.sql?.includes('FOR UPDATE')));
  assert.ok(!calls.some((call) => call.kind === 'query' && call.sql?.includes('FROM airport_ad_campaigns') && call.sql?.includes('FOR UPDATE')));
  assert.ok(calls.some((call) => call.kind === 'commit'));
});

test('AirportAdCampaignRepository.purchase rejects an occupied homepage slot before charging the wallet', async () => {
  const calls: Array<{ kind: string; sql?: string }> = [];
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
    query: async (sql: string) => {
      calls.push({ kind: 'query', sql });
      if (sql.includes('SELECT id') && sql.includes('FROM airport_ad_campaigns') && !sql.includes('home_slot = ?')) {
        return [[{ id: 101 }]];
      }
      if (sql.includes('home_slot = ?')) {
        return [[{ id: 101, home_slot: 2 }]];
      }
      return [[]];
    },
    execute: async (sql: string) => {
      calls.push({ kind: 'execute', sql });
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new AirportAdCampaignRepository({
    getConnection: async () => connection,
  } as never);

  await assert.rejects(
    () => repository.purchase({
      airport_id: 11,
      applicant_account_id: 3,
      application_id: 7,
      months: 1,
      monthly_price: 1888,
      home_slot: 2,
      coupon_code: 'HOME2',
      discount_title: '首页二号位',
      discount_description: '首页投放',
      applicable_plan: '所有',
      is_stackable: false,
      refund_supported: false,
      discount_percent: 10,
    }, new Date('2026-05-24T04:00:00+08:00')),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'AIRPORT_HOME_AD_SLOT_OCCUPIED');
      assert.match(String(next.message || ''), /首页 2 号位/);
      return true;
    },
  );

  assert.ok(calls.some((call) => call.kind === 'rollback'));
  assert.ok(!calls.some((call) => call.sql?.includes('applicant_wallets')));
  assert.ok(!calls.some((call) => call.kind === 'commit'));
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

test('AirportAdCampaignRepository.renew restarts an expired campaign and initializes exact tracking', async () => {
  const calls: Array<{ kind: string; sql?: string; params?: unknown[] }> = [];
  const connection = {
    beginTransaction: async () => calls.push({ kind: 'begin' }),
    commit: async () => calls.push({ kind: 'commit' }),
    rollback: async () => calls.push({ kind: 'rollback' }),
    release: () => calls.push({ kind: 'release' }),
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'query', sql, params });
      if (sql.includes('FROM airport_ad_campaigns') && sql.includes('FOR UPDATE')) {
        return [[{
          id: 101,
          airport_id: 11,
          wallet_id: 55,
          starts_at: '2026-05-01 10:00:00',
          ends_at: '2026-06-01 10:00:00',
          purchased_months: 1,
          billed_amount: 1000,
          display_order: 1,
          home_slot: null,
          tracking_started_at: null,
        }]];
      }
      if (sql.includes('FROM applicant_wallets') && sql.includes('FOR UPDATE')) {
        return [[{ id: 55, applicant_account_id: 3, application_id: 7, airport_id: 11, balance: 3000 }]];
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
    query: async (sql: string) => {
      if (sql.includes('WHERE campaign.id = ?')) {
        return [[createCampaignRow({
          starts_at: '2026-07-31 10:00:00',
          ends_at: '2026-09-30 10:00:00',
          purchased_months: 3,
          billed_amount: 1500,
          tracking_started_at: '2026-07-31 10:00:00',
        })]];
      }
      return [[]];
    },
  } as never);

  const campaign = await repository.renew({
    campaign_id: 101,
    airport_id: 11,
    applicant_account_id: 3,
    application_id: 7,
    months: 2,
    monthly_price: 250,
  }, new Date('2026-07-31T10:00:00+08:00'));

  assert.equal(campaign.campaign_id, 101);
  const update = calls.find((call) => call.kind === 'execute' && call.sql?.includes('tracking_started_at = COALESCE'));
  assert.ok(update);
  assert.equal(update.params?.[0], '2026-07-31 10:00:00');
  assert.equal(update.params?.[2], '2026-07-31 10:00:00');
  assert.equal(update.params?.[3], 2);
  assert.equal(update.params?.[4], 500);
  assert.ok(calls.some((call) => call.sql?.includes('UPDATE applicant_wallets SET balance = ?') && call.params?.[0] === 2500));
  assert.ok(calls.some((call) => call.sql?.includes('INSERT INTO applicant_wallet_transactions') && call.params?.[4] === -500));
  assert.ok(calls.some((call) => call.kind === 'commit'));
});

test('AirportAdCampaignRepository.renew rejects canceled or non-owned campaigns without charging', async () => {
  const calls: Array<{ kind: string; sql?: string }> = [];
  const connection = {
    beginTransaction: async () => calls.push({ kind: 'begin' }),
    commit: async () => calls.push({ kind: 'commit' }),
    rollback: async () => calls.push({ kind: 'rollback' }),
    release: () => calls.push({ kind: 'release' }),
    query: async (sql: string) => {
      calls.push({ kind: 'query', sql });
      return [[]];
    },
    execute: async (sql: string) => {
      calls.push({ kind: 'execute', sql });
      return [{ affectedRows: 0 }];
    },
  };
  const repository = new AirportAdCampaignRepository({ getConnection: async () => connection } as never);

  await assert.rejects(
    () => repository.renew({
      campaign_id: 101,
      airport_id: 11,
      applicant_account_id: 3,
      application_id: 7,
      months: 1,
      monthly_price: 1000,
    }),
    (error: unknown) => (error as { code?: string }).code === 'AIRPORT_AD_CAMPAIGN_NOT_RENEWABLE',
  );
  assert.ok(calls.some((call) => call.kind === 'rollback'));
  assert.ok(!calls.some((call) => call.sql?.includes('applicant_wallets')));
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
