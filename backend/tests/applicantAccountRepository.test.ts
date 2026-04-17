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
        return [schemaChecks <= 4 ? [] : [{ 1: 1 }]];
      }
      return [[]];
    },
  } as never);

  await repository.ensureSchema();

  assert.ok(calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS applicant_accounts')));
  assert.ok(calls.some((call) => call.sql.includes('ADD COLUMN password_hash VARCHAR(255) NOT NULL AFTER email')));
  assert.ok(calls.some((call) => call.sql.includes('ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 1 AFTER password_hash')));
});
