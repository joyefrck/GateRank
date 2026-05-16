import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicantAccountRepository } from '../src/repositories/applicantAccountRepository';

test('ApplicantAccountRepository.ensureSchema creates table and adds password columns', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  let schemaChecks = 0;

  const repository = new ApplicantAccountRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM information_schema.COLUMNS')) {
        schemaChecks += 1;
        return [schemaChecks <= 8 ? [] : [{ 1: 1 }]];
      }
      if (sql.includes('FROM information_schema.STATISTICS')) {
        return [[]];
      }
      return [[]];
    },
  } as never);

  await repository.ensureSchema();

  assert.ok(calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS applicant_accounts')));
  assert.ok(calls.some((call) => call.sql.includes('ADD COLUMN password_hash VARCHAR(255) NOT NULL AFTER email')));
  assert.ok(calls.some((call) => call.sql.includes('ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 1 AFTER password_hash')));
  assert.ok(calls.some((call) => call.sql.includes('ADD COLUMN x_user_id VARCHAR(64) NULL AFTER last_login_at')));
  assert.ok(calls.some((call) => call.sql.includes('ADD UNIQUE KEY uk_applicant_accounts_x_user_id (x_user_id)')));
});

test('ApplicantAccountRepository.getByAirportId finds account through approved application', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new ApplicantAccountRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [[{
        id: 22,
        application_id: 7,
        email: 'owner@example.com',
        password_hash: 'scrypt$salt$hash',
        must_change_password: 0,
        last_login_at: null,
        x_user_id: null,
        x_username: null,
        x_display_name: null,
        x_bound_at: null,
        created_at: '2026-05-01 10:00:00',
        updated_at: '2026-05-01 10:00:00',
      }]];
    },
  } as never);

  const account = await repository.getByAirportId(1);

  assert.equal(account?.id, 22);
  assert.equal(account?.application_id, 7);
  assert.equal(account?.email, 'owner@example.com');
  assert.equal(account?.must_change_password, false);
  assert.ok(calls[0]?.sql.includes('FROM airport_applications AS application'));
  assert.ok(calls[0]?.sql.includes('JOIN applicant_accounts AS account'));
  assert.deepEqual(calls[0]?.params, [1]);
});

test('ApplicantAccountRepository.getByAirportId returns null when no approved application account exists', async () => {
  const repository = new ApplicantAccountRepository({
    query: async () => [[]],
  } as never);

  const account = await repository.getByAirportId(404);

  assert.equal(account, null);
});
