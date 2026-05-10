import test from 'node:test';
import assert from 'node:assert/strict';
import { AirportApplicationRepository } from '../src/repositories/airportApplicationRepository';

test('AirportApplicationRepository.ensureSchema creates table and backfills website arrays', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  let schemaChecks = 0;

  const repository = new AirportApplicationRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM information_schema.COLUMNS')) {
        schemaChecks += 1;
        return [schemaChecks <= 21 ? [] : [{ 1: 1 }]];
      }
      return [[]];
    },
  } as never);

  await repository.ensureSchema();

  assert.ok(
    calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS airport_applications')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airport_applications ADD COLUMN applicant_email VARCHAR(255) NOT NULL AFTER subscription_url')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airport_applications ADD COLUMN approved_airport_id BIGINT UNSIGNED NULL AFTER test_password')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes("ENUM('awaiting_payment', 'pending', 'reviewed', 'rejected') NOT NULL DEFAULT 'awaiting_payment'")),
  );
  assert.ok(
    calls.some((call) => call.sql.includes("ALTER TABLE airport_applications ADD COLUMN payment_status ENUM('unpaid', 'paid') NOT NULL DEFAULT 'unpaid' AFTER review_status")),
  );
  assert.ok(
    calls.some((call) => call.sql.includes("MODIFY COLUMN review_status") && call.sql.includes("ENUM('awaiting_payment', 'pending', 'reviewed', 'rejected')")),
  );
  assert.ok(
    calls.some((call) => call.sql.includes("MODIFY COLUMN payment_status") && call.sql.includes("ENUM('unpaid', 'paid')")),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('SET websites_json = JSON_ARRAY(website)')),
  );
});

test('AirportApplicationRepository.listByQuery filters by payment status', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AirportApplicationRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('COUNT(*)')) {
        return [[{ total: 1 }]];
      }
      return [[{
        id: 7,
        name: 'Cloud Airport',
        website: 'https://example.com',
        websites_json: JSON.stringify(['https://example.com']),
        status: 'normal',
        plan_price_month: 10,
        has_trial: 1,
        subscription_url: 'https://example.com/sub',
        applicant_email: 'contact@example.com',
        applicant_telegram: '@cloud',
        founded_on: '2025-01-01',
        airport_intro: 'intro',
        test_account: 'tester',
        test_password: 'secret',
        approved_airport_id: null,
        review_status: 'pending',
        payment_status: 'paid',
        payment_amount: 1000,
        paid_at: '2026-03-24 10:05:00',
        must_change_password: 0,
        review_note: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: '2026-03-24 10:00:00',
        updated_at: '2026-03-24 10:00:00',
      }]];
    },
  } as never);

  const result = await repository.listByQuery({
    keyword: 'cloud',
    paymentStatus: 'paid',
    reviewStatus: 'pending',
    page: 2,
    pageSize: 20,
  });

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.payment_status, 'paid');
  assert.ok(calls[0]?.sql.includes('review_status = ?'));
  assert.ok(calls[0]?.sql.includes('payment_status = ?'));
  assert.deepEqual(calls[0]?.params, ['pending', 'paid', '%cloud%', '%cloud%', '%cloud%', '%cloud%', '%cloud%']);
  assert.deepEqual(calls[1]?.params, ['pending', 'paid', '%cloud%', '%cloud%', '%cloud%', '%cloud%', '%cloud%', 20, 20]);
});

test('AirportApplicationRepository.deleteUnpaid deletes application-related records in a transaction', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const connection = {
    beginTransaction: async () => {
      calls.push({ sql: 'BEGIN' });
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM airport_applications') && sql.includes('FOR UPDATE')) {
        return [[{ id: 7 }]];
      }
      if (sql.includes('FROM applicant_accounts')) {
        return [[{ id: 11 }]];
      }
      if (sql.includes('DELETE FROM airport_applications')) {
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    },
    commit: async () => {
      calls.push({ sql: 'COMMIT' });
    },
    rollback: async () => {
      calls.push({ sql: 'ROLLBACK' });
    },
    release: () => {
      calls.push({ sql: 'RELEASE' });
    },
  };
  const repository = new AirportApplicationRepository({
    getConnection: async () => connection,
  } as never);

  const deleted = await repository.deleteUnpaid(7);

  assert.equal(deleted, true);
  assert.equal(calls[0]?.sql, 'BEGIN');
  assert.ok(calls.some((call) => call.sql.includes("payment_status = 'unpaid'") && call.sql.includes('FOR UPDATE')));
  assert.ok(calls.some((call) => call.sql.includes('DELETE FROM applicant_x_oauth_flows')));
  assert.ok(calls.some((call) => call.sql.includes('DELETE FROM applicant_recharge_orders')));
  assert.ok(calls.some((call) => call.sql.includes('DELETE FROM applicant_wallets WHERE application_id = ?')));
  assert.ok(calls.some((call) => call.sql.includes('DELETE FROM applicant_accounts WHERE application_id = ?')));
  assert.ok(calls.some((call) => call.sql.includes('DELETE FROM application_payment_orders WHERE application_id = ?')));
  assert.equal(calls.at(-2)?.sql, 'COMMIT');
  assert.equal(calls.at(-1)?.sql, 'RELEASE');
});

test('AirportApplicationRepository.deleteUnpaid returns false when application is paid or missing', async () => {
  const calls: string[] = [];
  const connection = {
    beginTransaction: async () => {
      calls.push('BEGIN');
    },
    execute: async () => [[]],
    commit: async () => {
      calls.push('COMMIT');
    },
    rollback: async () => {
      calls.push('ROLLBACK');
    },
    release: () => {
      calls.push('RELEASE');
    },
  };
  const repository = new AirportApplicationRepository({
    getConnection: async () => connection,
  } as never);

  const deleted = await repository.deleteUnpaid(7);

  assert.equal(deleted, false);
  assert.deepEqual(calls, ['BEGIN', 'ROLLBACK', 'RELEASE']);
});
