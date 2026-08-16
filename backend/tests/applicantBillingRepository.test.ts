import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicantBillingRepository } from '../src/repositories/applicantBillingRepository';

test('ApplicantBillingRepository.ensureSchema allows USDT recharge orders', async () => {
  const calls: string[] = [];

  const repository = new ApplicantBillingRepository({
    query: async (sql: string) => {
      calls.push(sql);
      return [[]];
    },
  } as never);

  await repository.ensureSchema();

  assert.ok(calls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS applicant_recharge_orders')));
  assert.ok(calls.some((sql) => sql.includes("channel ENUM('alipay', 'wxpay', 'usdt') NOT NULL")));
  assert.ok(calls.some((sql) => sql.includes("MODIFY COLUMN channel ENUM('alipay', 'wxpay', 'usdt') NOT NULL")));
  assert.ok(calls.some((sql) => sql.includes("billing_status ENUM('billed', 'duplicate', 'free', 'insufficient_balance', 'unlisted', 'no_wallet')")));
});

test('ApplicantBillingRepository.backfillLegacyAirportWallets creates missing application account and wallet links', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const affectedRows = [2, 2, 1, 2];

  const repository = new ApplicantBillingRepository({
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ affectedRows: affectedRows[calls.length - 1] ?? 0 }];
    },
  } as never);

  const result = await repository.backfillLegacyAirportWallets();

  assert.deepEqual(result, {
    applicationsCreated: 2,
    accountsCreated: 2,
    walletsLinked: 1,
    walletsCreated: 2,
  });
  assert.equal(calls.length, 4);
  assert.match(calls[0]!.sql, /INSERT INTO airport_applications/);
  assert.match(calls[1]!.sql, /INSERT IGNORE INTO applicant_accounts/);
  assert.match(calls[2]!.sql, /UPDATE applicant_wallets wallet/);
  assert.match(calls[3]!.sql, /INSERT IGNORE INTO applicant_wallets/);
});

test('ApplicantBillingRepository.backfillLegacyAirportWallets is idempotent and skips airports with wallets', async () => {
  const calls: string[] = [];

  const repository = new ApplicantBillingRepository({
    execute: async (sql: string) => {
      calls.push(sql);
      return [{ affectedRows: 0 }];
    },
  } as never);

  await repository.backfillLegacyAirportWallets();

  const [applicationSql, accountSql, linkSql, walletSql] = calls;
  assert.match(applicationSql!, /LEFT JOIN applicant_wallets airport_wallet ON airport_wallet\.airport_id = a\.id/);
  assert.match(applicationSql!, /LEFT JOIN airport_applications existing_application ON existing_application\.approved_airport_id = a\.id/);
  assert.match(applicationSql!, /WHERE airport_wallet\.id IS NULL\s+AND existing_application\.id IS NULL/);

  assert.match(accountSql!, /INSERT IGNORE INTO applicant_accounts/);
  assert.match(accountSql!, /LEFT JOIN applicant_accounts existing_account ON existing_account\.application_id = ap\.id/);
  assert.match(accountSql!, /WHERE airport_wallet\.id IS NULL\s+AND existing_account\.id IS NULL/);

  assert.match(linkSql!, /SET wallet\.airport_id = a\.id/);
  assert.match(linkSql!, /WHERE wallet\.airport_id IS NULL\s+AND airport_wallet\.id IS NULL/);

  assert.match(walletSql!, /INSERT IGNORE INTO applicant_wallets/);
  assert.match(walletSql!, /LEFT JOIN applicant_wallets airport_wallet ON airport_wallet\.airport_id = a\.id/);
  assert.match(walletSql!, /LEFT JOIN applicant_wallets account_wallet ON account_wallet\.applicant_account_id = account\.id/);
  assert.match(walletSql!, /WHERE airport_wallet\.id IS NULL\s+AND account_wallet\.id IS NULL/);
});

test('ApplicantBillingRepository.backfillLegacyAirportWallets uses internal legacy account emails', async () => {
  const calls: string[] = [];

  const repository = new ApplicantBillingRepository({
    execute: async (sql: string) => {
      calls.push(sql);
      return [{ affectedRows: 0 }];
    },
  } as never);

  await repository.backfillLegacyAirportWallets();

  assert.match(calls[0]!, /CONCAT\('legacy-airport-', a\.id, '@gaterank\.local'\)/);
  assert.match(calls[1]!, /CONCAT\('legacy-airport-', a\.id, '@gaterank\.local'\)/);
  assert.doesNotMatch(calls[0]!, /a\.applicant_email/);
  assert.doesNotMatch(calls[1]!, /a\.applicant_email/);
});

test('ApplicantBillingRepository.clearAutoUnlistedByAirportId clears stale auto-unlisted marker', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new ApplicantBillingRepository({
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  } as never);

  const affectedRows = await repository.clearAutoUnlistedByAirportId(83);

  assert.equal(affectedRows, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /SET auto_unlisted_at = NULL/);
  assert.match(calls[0]!.sql, /WHERE airport_id = \?/);
  assert.deepEqual(calls[0]!.params, [83]);
});

test('ApplicantBillingRepository.getWalletByAccountId exposes bound airport listing state', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new ApplicantBillingRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [[{
        id: 1,
        applicant_account_id: 2,
        application_id: 3,
        airport_id: 83,
        airport_is_listed: 0,
        balance: 20,
        auto_unlisted_at: null,
        low_balance_notified_at: null,
        created_at: '2026-05-16 10:00:00',
        updated_at: '2026-05-16 10:00:00',
      }]];
    },
  } as never);

  const wallet = await repository.getWalletByAccountId(2);

  assert.equal(wallet?.airport_id, 83);
  assert.equal(wallet?.airport_is_listed, false);
  assert.match(calls[0]!.sql, /LEFT JOIN airports a ON a\.id = w\.airport_id/);
  assert.deepEqual(calls[0]!.params, [2]);
});

test('ApplicantBillingRepository.countClicksForDate counts applicant clicks for one event date', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new ApplicantBillingRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [[{ total: 3 }]];
    },
  } as never);

  const total = await repository.countClicksForDate(2, '2026-05-16');

  assert.equal(total, 3);
  assert.match(calls[0]!.sql, /FROM outbound_click_records/);
  assert.match(calls[0]!.sql, /applicant_account_id = \?/);
  assert.match(calls[0]!.sql, /event_date = \?/);
  assert.doesNotMatch(calls[0]!.sql, /billing_status/);
  assert.deepEqual(calls[0]!.params, [2, '2026-05-16']);
});

test('ApplicantBillingRepository.listWalletTransactionsByAirportId filters multiple business consumption types', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new ApplicantBillingRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('COUNT(*)')) {
        return [[{ total: 2 }]];
      }
      return [[
        {
          id: 12,
          transaction_type: 'ad_campaign_charge',
          amount: -1200,
          balance_after: 98.8,
          reference_type: 'ad_campaign',
          reference_id: 'campaign-charge-1',
          description: '优惠活动投放扣费 ¥1200.00（1个月）',
          created_at: '2026-05-10 12:01:00',
        },
        {
          id: 11,
          transaction_type: 'click_charge',
          amount: -0.6,
          balance_after: 1298.8,
          reference_type: 'outbound_click',
          reference_id: 'click-1',
          description: '官网点击扣费',
          created_at: '2026-05-10 12:00:00',
        },
      ]];
    },
  } as never);

  const result = await repository.listWalletTransactionsByAirportId(
    83,
    3,
    5,
    ['click_charge', 'ad_campaign_charge'],
  );

  assert.equal(result.total, 2);
  assert.deepEqual(result.items.map((item) => item.transaction_type), ['ad_campaign_charge', 'click_charge']);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.sql, /t\.transaction_type IN \(\?, \?\)/);
    assert.doesNotMatch(call.sql, /transaction_type = \?/);
  }
  assert.deepEqual(calls[0]!.params, [83, 'click_charge', 'ad_campaign_charge']);
  assert.deepEqual(calls[1]!.params, [83, 'click_charge', 'ad_campaign_charge', 5, 10]);
});

test('ApplicantBillingRepository.addWalletBalanceAdjustment creates internal wallet before adjustment when missing', async () => {
  const calls: Array<{ kind: 'query' | 'execute' | 'begin' | 'commit' | 'rollback' | 'release'; sql?: string; params?: unknown[] }> = [];
  let walletLookupCount = 0;

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
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'execute', sql, params });
      return [{ affectedRows: 1 }];
    },
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'query', sql, params });
      if (sql.includes('FROM applicant_wallets') && sql.includes('WHERE airport_id = ?')) {
        walletLookupCount += 1;
        if (walletLookupCount === 1) {
          return [[]];
        }
        return [[{
          id: 99,
          applicant_account_id: 88,
          application_id: 77,
          airport_id: 5,
          balance: 0,
          auto_unlisted_at: null,
          created_at: '2026-05-09 10:00:00',
          updated_at: '2026-05-09 10:00:00',
        }]];
      }
      if (sql.includes('FROM airport_applications')) {
        return [[{ id: 77 }]];
      }
      if (sql.includes('FROM applicant_accounts')) {
        return [[{ id: 88 }]];
      }
      if (sql.includes('FROM applicant_wallets') && sql.includes('WHERE id = ?')) {
        return [[{
          id: 99,
          applicant_account_id: 88,
          application_id: 77,
          airport_id: 5,
          balance: 25.13,
          auto_unlisted_at: null,
          created_at: '2026-05-09 10:00:00',
          updated_at: '2026-05-09 10:01:00',
        }]];
      }
      return [[]];
    },
  };

  const repository = new ApplicantBillingRepository({
    getConnection: async () => connection,
  } as never);

  const wallet = await repository.addWalletBalanceAdjustment({
    airport_id: 5,
    amount: 25.129,
    description: '线下补款',
    reference_id: 'req-1',
  });

  assert.equal(wallet?.id, 99);
  assert.equal(wallet?.balance, 25.13);
  assert.deepEqual(
    calls.map((call) => call.kind),
    [
      'begin',
      'query',
      'execute',
      'query',
      'execute',
      'query',
      'execute',
      'execute',
      'query',
      'execute',
      'execute',
      'query',
      'commit',
      'release',
    ],
  );
  assert.match(calls[2]!.sql!, /INSERT INTO airport_applications/);
  assert.match(calls[4]!.sql!, /INSERT IGNORE INTO applicant_accounts/);
  assert.match(calls[4]!.sql!, /legacy-airport-/);
  assert.deepEqual(calls[4]!.params, [77, 5]);
  assert.match(calls[7]!.sql!, /INSERT IGNORE INTO applicant_wallets/);
  assert.match(calls[9]!.sql!, /UPDATE applicant_wallets\s+SET balance = \?/);
  assert.deepEqual(calls[9]!.params, [25.13, 99]);
  assert.match(calls[10]!.sql!, /INSERT INTO applicant_wallet_transactions/);
  assert.deepEqual(calls[10]!.params, [99, 88, 77, 5, 25.13, 25.13, 'req-1', '线下补款']);
});

test('ApplicantBillingRepository.addWalletBalanceAdjustment deducts from existing wallet', async () => {
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
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'execute', sql, params });
      return [{ affectedRows: 1 }];
    },
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'query', sql, params });
      if (sql.includes('FROM applicant_wallets') && sql.includes('WHERE airport_id = ?')) {
        return [[{
          id: 99,
          applicant_account_id: 88,
          application_id: 77,
          airport_id: 5,
          balance: 50,
          auto_unlisted_at: null,
          created_at: '2026-05-09 10:00:00',
          updated_at: '2026-05-09 10:00:00',
        }]];
      }
      if (sql.includes('FROM applicant_wallets') && sql.includes('WHERE id = ?')) {
        return [[{
          id: 99,
          applicant_account_id: 88,
          application_id: 77,
          airport_id: 5,
          balance: 37.65,
          auto_unlisted_at: null,
          created_at: '2026-05-09 10:00:00',
          updated_at: '2026-05-09 10:01:00',
        }]];
      }
      return [[]];
    },
  };

  const repository = new ApplicantBillingRepository({
    getConnection: async () => connection,
  } as never);

  const wallet = await repository.addWalletBalanceAdjustment({
    airport_id: 5,
    amount: -12.345,
    description: '后台扣减',
    reference_id: 'req-2',
  });

  assert.equal(wallet?.id, 99);
  assert.equal(wallet?.balance, 37.65);
  assert.match(calls[2]!.sql!, /UPDATE applicant_wallets\s+SET balance = \?/);
  assert.deepEqual(calls[2]!.params, [37.65, 99]);
  assert.match(calls[3]!.sql!, /INSERT INTO applicant_wallet_transactions/);
  assert.deepEqual(calls[3]!.params, [99, 88, 77, 5, -12.35, 37.65, 'req-2', '后台扣减']);
  assert.deepEqual(calls.map((call) => call.kind).slice(-2), ['commit', 'release']);
});

test('ApplicantBillingRepository.addWalletBalanceAdjustment rejects deductions below zero', async () => {
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
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'execute', sql, params });
      return [{ affectedRows: 1 }];
    },
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'query', sql, params });
      if (sql.includes('FROM applicant_wallets') && sql.includes('WHERE airport_id = ?')) {
        return [[{
          id: 99,
          applicant_account_id: 88,
          application_id: 77,
          airport_id: 5,
          balance: 10,
          auto_unlisted_at: null,
          created_at: '2026-05-09 10:00:00',
          updated_at: '2026-05-09 10:00:00',
        }]];
      }
      return [[]];
    },
  };

  const repository = new ApplicantBillingRepository({
    getConnection: async () => connection,
  } as never);

  await assert.rejects(
    () => repository.addWalletBalanceAdjustment({
      airport_id: 5,
      amount: -10.01,
      description: '后台扣减',
      reference_id: 'req-3',
    }),
    (error: unknown) => typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'AIRPORT_WALLET_BALANCE_INSUFFICIENT',
  );

  assert.deepEqual(calls.map((call) => call.kind), ['begin', 'query', 'rollback', 'release']);
});

test('ApplicantBillingRepository.syncListingStatusByBalance reconciles listing and auto-unlisted flags', async () => {
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
    query: async (sql: string) => {
      calls.push({ kind: 'query', sql });
      return [[
        { wallet_id: 1, airport_id: 101, balance: 1, auto_unlisted_at: '2026-05-09 10:00:00', is_listed: 1 },
        { wallet_id: 2, airport_id: 102, balance: 0, auto_unlisted_at: null, is_listed: 1 },
        { wallet_id: 3, airport_id: 103, balance: 1, auto_unlisted_at: '2026-05-09 10:00:00', is_listed: 0 },
        { wallet_id: 4, airport_id: 104, balance: 0, auto_unlisted_at: '2026-05-09 10:00:00', is_listed: 0 },
        { wallet_id: 5, airport_id: 105, balance: 1, auto_unlisted_at: null, is_listed: null },
      ]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'execute', sql, params });
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new ApplicantBillingRepository({
    getConnection: async () => connection,
  } as never);

  const result = await repository.syncListingStatusByBalance(0.6);

	  assert.deepEqual(result, {
	    checked: 5,
	    restored: 3,
	    unlisted: 1,
	    unchanged: 0,
	    skipped: 1,
	    notification_events: [],
	  });
  assert.match(calls[1]!.sql!, /FROM applicant_wallets w/);
  assert.match(calls[1]!.sql!, /FOR UPDATE/);
	  assert.deepEqual(
	    calls.filter((call) => call.kind === 'execute').map((call) => call.params),
	    [[101], [30, 1], [1], [2], [103], [30, 3], [3], [104]],
	  );
	  assert.ok(
	    calls
	      .filter((call) => call.kind === 'execute')
	      .every((call) => !/SET is_listed = 0/.test(call.sql || '')),
	  );
	  assert.deepEqual(calls.map((call) => call.kind).slice(-2), ['commit', 'release']);
	});

test('ApplicantBillingRepository.syncListingStatusByBalance emits low balance notification once', async () => {
  const executes: Array<{ sql: string; params?: unknown[] }> = [];
  const connection = {
    beginTransaction: async () => undefined,
    commit: async () => undefined,
    rollback: async () => undefined,
    release: () => undefined,
    query: async () => [[
      {
        wallet_id: 7,
        airport_id: 107,
        airport_name: 'Cloud Airport',
        applicant_email: 'owner@example.com',
        balance: 18.5,
        auto_unlisted_at: null,
        low_balance_notified_at: null,
        is_listed: 1,
      },
    ]],
    execute: async (sql: string, params?: unknown[]) => {
      executes.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new ApplicantBillingRepository({
    getConnection: async () => connection,
  } as never);

  const result = await repository.syncListingStatusByBalance(1);

  assert.equal(result.unlisted, 0);
  assert.equal(result.unchanged, 1);
  assert.equal(result.notification_events.length, 1);
  assert.deepEqual(result.notification_events[0], {
    type: 'low_balance_warning',
    to: 'owner@example.com',
    airportName: 'Cloud Airport',
    balance: 18.5,
    thresholdAmount: 30,
  });
	  assert.match(executes[0]!.sql, /low_balance_notified_at = NOW/);
	  assert.deepEqual(executes[0]!.params, [7]);
	});

test('ApplicantBillingRepository.processOutboundClick allows free redirect when balance is insufficient', async () => {
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
      return [[{
        airport_id: 5,
        airport_name: 'Cloud Airport',
        is_listed: 1,
        applicant_email: 'owner@example.com',
        applicant_account_id: 12,
        application_id: 13,
        wallet_id: 14,
        balance: 0.4,
        auto_unlisted_at: null,
        low_balance_notified_at: null,
      }]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'execute', sql, params });
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new ApplicantBillingRepository({
    getConnection: async () => connection,
  } as never);

  const result = await repository.processOutboundClick({
    click_id: 'click-1',
    airport_id: 5,
    placement: 'full_ranking_item',
    target_kind: 'website',
    target_url: 'https://airport.example.com',
    visitor_hash: 'visitor',
    session_hash: 'session',
    occurred_at: '2026-05-21 12:00:00',
    event_date: '2026-05-21',
    click_charge_amount: 1,
  });

  assert.equal(result.status, 'free');
  assert.equal(result.billed_amount, 0);
  assert.equal(result.balance_after, 0.4);
  assert.deepEqual(result.notification_events, []);
  assert.ok(calls.some((call) => /billing_status/.test(call.sql || '') && call.params?.includes('free')));
  assert.ok(calls.every((call) => !call.params?.includes('insufficient_balance')));
  assert.ok(calls.every((call) => !/SET auto_unlisted_at = COALESCE/.test(call.sql || '')));
  assert.ok(calls.every((call) => !/SET is_listed = 0/.test(call.sql || '')));
});

test('ApplicantBillingRepository.processOutboundClick does not mark billing restriction after balance drops low', async () => {
  const calls: Array<{ kind: 'query' | 'execute' | 'begin' | 'commit' | 'rollback' | 'release'; sql?: string; params?: unknown[] }> = [];
  let queryCount = 0;
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
      queryCount += 1;
      if (queryCount === 1) {
        return [[{
          airport_id: 5,
          airport_name: 'Cloud Airport',
          is_listed: 1,
          applicant_email: 'owner@example.com',
          applicant_account_id: 12,
          application_id: 13,
          wallet_id: 14,
          balance: 1.2,
          auto_unlisted_at: null,
          low_balance_notified_at: '2026-05-20 10:00:00',
        }]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ kind: 'execute', sql, params });
      return [{ affectedRows: 1 }];
    },
  };
  const repository = new ApplicantBillingRepository({
    getConnection: async () => connection,
  } as never);

  const result = await repository.processOutboundClick({
    click_id: 'click-2',
    airport_id: 5,
    placement: 'full_ranking_item',
    target_kind: 'website',
    target_url: 'https://airport.example.com',
    visitor_hash: 'visitor',
    session_hash: 'session',
    occurred_at: '2026-05-21 12:00:00',
    event_date: '2026-05-21',
    click_charge_amount: 1,
  });

  assert.equal(result.status, 'billed');
  assert.equal(result.balance_after, 0.2);
  assert.deepEqual(result.notification_events, []);
  assert.ok(calls.some((call) => /SET balance = \?/.test(call.sql || '') && call.params?.[0] === 0.2));
  assert.ok(calls.every((call) => !/SET auto_unlisted_at = COALESCE/.test(call.sql || '')));
});

test('ApplicantBillingRepository.getPublicScoreVisibilityByAirportIds hides missing and insufficient wallets', async () => {
  const repository = new ApplicantBillingRepository({
    query: async (sql: string, params?: unknown[]) => {
      assert.match(sql, /FROM applicant_wallets/);
      assert.deepEqual(params, [1, 2, 3]);
      return [[
        { airport_id: 1, balance: 0.5 },
        { airport_id: 2, balance: 3 },
      ]];
    },
  } as never);

  const result = await repository.getPublicScoreVisibilityByAirportIds([1, 2, 3], 1);

  assert.deepEqual(result.get(1), {
    score_hidden: true,
    score_hidden_reason: 'insufficient_balance',
  });
  assert.deepEqual(result.get(2), {
    score_hidden: false,
    score_hidden_reason: null,
  });
  assert.deepEqual(result.get(3), {
    score_hidden: true,
    score_hidden_reason: 'insufficient_balance',
  });
});
