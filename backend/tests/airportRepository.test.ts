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
        return [schemaChecks <= 11 ? [] : [{ 1: 1 }]];
      }
      return [[]];
    },
  } as never);

  await repository.ensureSchema();

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
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN manual_tags_json JSON NULL AFTER tags_json')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN auto_tags_json JSON NULL AFTER manual_tags_json')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE airports ADD COLUMN test_password VARCHAR(255) NULL AFTER test_account')),
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
});
