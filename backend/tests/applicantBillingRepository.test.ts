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
    restored: 2,
    unlisted: 1,
    unchanged: 1,
    skipped: 1,
    notification_events: [],
  });
  assert.match(calls[1]!.sql!, /FROM applicant_wallets w/);
  assert.match(calls[1]!.sql!, /FOR UPDATE/);
  assert.deepEqual(
    calls.filter((call) => call.kind === 'execute').map((call) => call.params),
    [[101], [30, 1], [1], [102], [2], [103], [30, 3], [3]],
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
