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
          subscription_url: null,
          applicant_email: 'paid@example.com',
          applicant_telegram: '@paid',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
          test_account: 'tester',
          test_password: 'secret',
          manual_tags_json: JSON.stringify([]),
          auto_tags_json: JSON.stringify([]),
          tags_json: JSON.stringify([]),
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
          paid_application_fee: 0,
          created_at: '2026-03-24 10:00:00',
        },
      ]];
    },
  } as never);

  const result = await repository.listByQuery({ page: 1, pageSize: 20 });

  assert.equal(result.total, 2);
  assert.equal(result.items[0]?.paid_application_fee, true);
  assert.equal(result.items[1]?.paid_application_fee, false);
  assert.ok(calls[1]?.sql.includes("paid_application.payment_status = 'paid'"));
  assert.ok(calls[1]?.sql.includes('paid_application.payment_amount > 0'));
});
