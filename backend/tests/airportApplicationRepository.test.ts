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
        return [schemaChecks <= 16 ? [] : [{ 1: 1 }]];
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
    calls.some((call) => call.sql.includes('SET websites_json = JSON_ARRAY(website)')),
  );
});
