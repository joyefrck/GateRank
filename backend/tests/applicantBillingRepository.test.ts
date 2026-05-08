import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicantBillingRepository } from '../src/repositories/applicantBillingRepository';

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
