import test from 'node:test';
import assert from 'node:assert/strict';
import { AirportRepository } from '../src/repositories/airportRepository';

test('AirportRepository.ensureSchema adds missing JSON columns and backfills defaults', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  let schemaChecks = 0;

  const repository = new AirportRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM information_schema.COLUMNS')) {
        schemaChecks += 1;
        return [schemaChecks <= 22 ? [] : [{ 1: 1 }]];
      }
      return [[]];
    },
  } as never);

  await repository.ensureSchema();

  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN slug VARCHAR(160) NULL AFTER id')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN websites_json JSON NULL AFTER website')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN is_listed TINYINT(1) NOT NULL DEFAULT 1 AFTER status')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN tags_json JSON NULL AFTER subscription_url')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN applicant_email VARCHAR(255) NULL AFTER subscription_url')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN subscription_url_updated_at DATETIME NULL AFTER subscription_url')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes("ALTER TABLE airports ADD COLUMN subscription_url_updated_source ENUM('admin', 'portal') NULL AFTER subscription_url_updated_at")),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN manual_tags_json JSON NULL AFTER tags_json')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN auto_tags_json JSON NULL AFTER manual_tags_json')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN test_password VARCHAR(255) NULL AFTER test_account')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN streaming_support_json JSON NULL AFTER has_trial')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN payment_methods_json JSON NULL AFTER streaming_support_json')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN payment_crypto_other VARCHAR(255) NULL AFTER payment_methods_json')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN has_annual_plan TINYINT(1) NULL DEFAULT NULL AFTER payment_crypto_other')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN has_telegram_group TINYINT(1) NULL DEFAULT NULL AFTER has_annual_plan')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN telegram_allows_speaking TINYINT(1) NULL DEFAULT NULL AFTER has_telegram_group')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN has_lifetime_plan TINYINT(1) NULL DEFAULT NULL AFTER telegram_allows_speaking')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN airport_profile_json JSON NULL AFTER has_lifetime_plan')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('SET streaming_support_json = JSON_ARRAY()')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('SET payment_methods_json = JSON_ARRAY()')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('SET airport_profile_json = JSON_OBJECT()')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('SET is_listed = 1')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('SET websites_json = JSON_ARRAY(website)')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('SET tags_json = JSON_ARRAY()')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('SET manual_tags_json = tags_json')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('SET auto_tags_json = JSON_ARRAY()')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD UNIQUE KEY uk_airports_slug (slug)')),
  );
});

test('AirportRepository.update refreshes subscription url metadata only when url is written', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AirportRepository({
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  } as never);

  const subscriptionUpdated = await repository.update(7, {
    subscription_url: 'https://new-sub.example.com',
    subscription_url_updated_source: 'admin',
  } as any);
  const ordinaryUpdated = await repository.update(7, {
    plan_price_month: 1888,
  });

  assert.equal(subscriptionUpdated, true);
  assert.equal(ordinaryUpdated, true);
  assert.ok(calls[0]?.sql.includes('subscription_url = ?'));
  assert.ok(calls[0]?.sql.includes('subscription_url_updated_at = NOW()'));
  assert.ok(calls[0]?.sql.includes('subscription_url_updated_source = ?'));
  assert.deepEqual(calls[0]?.params, ['https://new-sub.example.com', 'admin', 7]);
  assert.equal(calls[1]?.sql.includes('subscription_url_updated_at = NOW()'), false);
  assert.deepEqual(calls[1]?.params, [1888, 7]);
});

test('AirportRepository.listByQuery maps paid application fee marker from paid nonzero applications', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AirportRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('COUNT(*)')) {
        return [[{ total: 2 }]];
      }
      return [[
        {
          id: 1,
          name: 'Paid Airport',
          website: 'https://paid.example.com',
          websites_json: JSON.stringify(['https://paid.example.com']),
          status: 'normal',
          is_listed: 1,
          plan_price_month: 10,
          has_trial: 1,
          streaming_support_json: JSON.stringify(['netflix', 'youtube_premium', 'spotify']),
          payment_methods_json: JSON.stringify(['wechat', 'usdt_trc20', 'paypal', 'crypto_other']),
          payment_crypto_other: 'TON',
          has_annual_plan: 1,
          has_telegram_group: 0,
          telegram_allows_speaking: null,
          has_lifetime_plan: 1,
          airport_profile_json: JSON.stringify({
            plan: {
              supports_monthly: true,
              supports_quarterly: false,
              lowest_monthly_price: 12.5,
            },
            telegram: { group_member_count: 1234 },
            clients: { self_built_client: true, clash: true, shadowrocket: false },
            import_methods: { subscription_link: true },
            regions: { hong_kong: { has_residential: true, line_types: ['iepl', 'cn2'] } },
          }),
          subscription_url: null,
          applicant_email: 'paid@example.com',
          applicant_account_email: 'login-paid@example.com',
          applicant_telegram: '@paid',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
          test_account: 'tester',
          test_password: 'secret',
          manual_tags_json: JSON.stringify([]),
          auto_tags_json: JSON.stringify([]),
          tags_json: JSON.stringify([]),
          application_id: 101,
          telegram_bot_bound: 1,
          paid_application_fee: 1,
          created_at: '2026-03-24 10:00:00',
        },
        {
          id: 2,
          name: 'Imported Airport',
          website: 'https://imported.example.com',
          websites_json: JSON.stringify(['https://imported.example.com']),
          status: 'normal',
          is_listed: 1,
          plan_price_month: 10,
          has_trial: 1,
          streaming_support_json: null,
          payment_methods_json: null,
          payment_crypto_other: null,
          subscription_url: null,
          applicant_email: 'imported@example.com',
          applicant_telegram: '@imported',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
          test_account: 'tester',
          test_password: 'secret',
          manual_tags_json: JSON.stringify([]),
          auto_tags_json: JSON.stringify([]),
          tags_json: JSON.stringify([]),
          application_id: null,
          telegram_bot_bound: 0,
          paid_application_fee: 0,
          created_at: '2026-03-24 10:00:00',
        },
      ]];
    },
  } as never);

  const result = await repository.listByQuery({ page: 1, pageSize: 20 });

  assert.equal(result.total, 2);
  assert.equal(result.items[0]?.application_id, 101);
  assert.equal(result.items[1]?.application_id, null);
  assert.equal(result.items[0]?.applicant_account_email, 'login-paid@example.com');
  assert.deepEqual(result.items[0]?.streaming_support, ['netflix', 'youtube_premium', 'spotify']);
  assert.deepEqual(result.items[0]?.payment_methods, ['wechat', 'usdt_trc20', 'paypal', 'crypto_other']);
  assert.equal(result.items[0]?.payment_crypto_other, 'TON');
  assert.equal(result.items[0]?.has_annual_plan, true);
  assert.equal(result.items[0]?.has_telegram_group, false);
  assert.equal(result.items[0]?.telegram_allows_speaking, null);
  assert.equal(result.items[0]?.has_lifetime_plan, true);
  assert.equal(result.items[0]?.profile?.plan.supports_monthly, true);
  assert.equal(result.items[0]?.profile?.plan.supports_quarterly, false);
  assert.equal(result.items[0]?.profile?.plan.lowest_monthly_price, 12.5);
  assert.equal(result.items[0]?.profile?.telegram.group_member_count, 1234);
  assert.equal(result.items[0]?.profile?.clients.self_built_client, true);
  assert.equal(result.items[0]?.profile?.clients.clash, true);
  assert.equal(result.items[0]?.profile?.clients.shadowrocket, false);
  assert.equal(result.items[0]?.profile?.import_methods.subscription_link, true);
  assert.equal(result.items[0]?.profile?.regions.hong_kong.has_residential, true);
  assert.deepEqual(result.items[0]?.profile?.regions.hong_kong.line_types, ['iepl', 'cn2']);
  assert.deepEqual(result.items[1]?.streaming_support, []);
  assert.deepEqual(result.items[1]?.payment_methods, []);
  assert.equal(result.items[1]?.payment_crypto_other, null);
  assert.equal(result.items[1]?.has_annual_plan, null);
  assert.equal(result.items[1]?.profile?.plan.supports_monthly, null);
  assert.deepEqual(result.items[1]?.profile?.regions.japan.line_types, []);
  assert.equal(result.items[0]?.telegram_bot_bound, true);
  assert.equal(result.items[1]?.telegram_bot_bound, false);
  assert.equal(result.items[0]?.paid_application_fee, true);
  assert.equal(result.items[1]?.paid_application_fee, false);
  assert.ok(calls[1]?.sql.includes('application.approved_airport_id = airports.id'));
  assert.ok(calls[1]?.sql.includes('JOIN applicant_accounts AS account'));
  assert.ok(calls[1]?.sql.includes('JOIN applicant_telegram_bindings AS bot_binding'));
  assert.ok(calls[1]?.sql.includes("paid_application.payment_status = 'paid'"));
  assert.ok(calls[1]?.sql.includes('paid_application.payment_amount > 0'));
});

test('AirportRepository.listByQuery supports application id keyword and listed filter', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AirportRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('COUNT(*)')) {
        return [[{ total: 0 }]];
      }
      return [[]];
    },
  } as never);

  const result = await repository.listByQuery({
    keyword: '#101',
    isListed: false,
    page: 1,
    pageSize: 20,
  });

  assert.equal(result.total, 0);
  assert.ok(calls[0]?.sql.includes('is_listed = ?'));
  assert.ok(calls[0]?.sql.includes('keyword_application.id = ?'));
  assert.deepEqual(calls[0]?.params, [0, '%#101%', '%#101%', '%#101%', 101]);
  assert.deepEqual(calls[1]?.params, [0, '%#101%', '%#101%', '%#101%', 101, 20, 0]);
});

test('AirportRepository.listByQuery supports score and balance sorting before pagination', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AirportRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('COUNT(*)')) {
        return [[{ total: 0 }]];
      }
      return [[]];
    },
  } as never);

  await repository.listByQuery({
    page: 2,
    pageSize: 10,
    sortBy: 'score',
    sortOrder: 'asc',
    scoreDate: '2026-05-20',
  });

  assert.ok(calls[1]?.sql.includes('LEFT JOIN airport_scores_daily AS sort_score'));
  assert.ok(calls[1]?.sql.includes('sort_score.date = ?'));
  assert.ok(calls[1]?.sql.includes('ORDER BY COALESCE('));
  assert.ok(calls[1]?.sql.includes('ASC, airports.id DESC'));
  assert.deepEqual(calls[1]?.params, ['2026-05-20', 10, 10]);

  calls.length = 0;
  await repository.listByQuery({
    page: 1,
    pageSize: 20,
    sortBy: 'balance',
    sortOrder: 'desc',
  });

  assert.ok(calls[1]?.sql.includes('FROM applicant_wallets'));
  assert.ok(calls[1]?.sql.includes('GROUP BY airport_id'));
  assert.ok(calls[1]?.sql.includes('ORDER BY sort_wallet.wallet_balance IS NULL ASC, sort_wallet.wallet_balance DESC'));
  assert.deepEqual(calls[1]?.params, [20, 0]);
});

test('AirportRepository.listLatestApprovedApplicationAirports reads paid reviewed listed airports by latest application time', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AirportRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [[
        {
          id: 61,
          name: '极速云机场',
          website: 'https://fast.example.com',
          websites_json: JSON.stringify(['https://fast.example.com']),
          status: 'normal',
          is_listed: 1,
          plan_price_month: 15.99,
          has_trial: 0,
          subscription_url: 'https://fast.example.com/sub',
          applicant_email: 'fast@example.com',
          applicant_telegram: '@fast',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
          test_account: 'tester',
          test_password: 'secret',
          manual_tags_json: JSON.stringify([]),
          auto_tags_json: JSON.stringify(['新入榜']),
          tags_json: JSON.stringify(['新入榜']),
          application_id: 61,
          paid_application_fee: 1,
          created_at: '2026-05-11 10:00:00',
        },
      ]];
    },
  } as never);

  const result = await repository.listLatestApprovedApplicationAirports(6);

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 61);
  assert.equal(result[0]?.application_id, 61);
  assert.equal(result[0]?.name, '极速云机场');
  assert.equal(result[0]?.paid_application_fee, true);
  assert.deepEqual(calls[0]?.params, [6]);
  assert.ok(calls[0]?.sql.includes("application.review_status = 'reviewed'"));
  assert.ok(calls[0]?.sql.includes("application.payment_status = 'paid'"));
  assert.ok(calls[0]?.sql.includes('application.approved_airport_id IS NOT NULL'));
  assert.ok(calls[0]?.sql.includes('airports.is_listed = 1'));
  assert.ok(calls[0]?.sql.includes("airports.status <> 'down'"));
  assert.ok(calls[0]?.sql.includes('COALESCE(application.reviewed_at, application.updated_at, application.created_at) DESC'));
});
