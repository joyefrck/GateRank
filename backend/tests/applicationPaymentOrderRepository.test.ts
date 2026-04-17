import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicationPaymentOrderRepository } from '../src/repositories/applicationPaymentOrderRepository';

test('ApplicationPaymentOrderRepository.ensureSchema creates table and adds gateway fields', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  let schemaChecks = 0;

  const repository = new ApplicationPaymentOrderRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM information_schema.COLUMNS')) {
        schemaChecks += 1;
        return [schemaChecks <= 5 ? [] : [{ 1: 1 }]];
      }
      return [[]];
    },
  } as never);

  await repository.ensureSchema();

  assert.ok(calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS application_payment_orders')));
  assert.ok(calls.some((call) => call.sql.includes('ADD COLUMN gateway_trade_no VARCHAR(64) NULL AFTER out_trade_no')));
  assert.ok(calls.some((call) => call.sql.includes('ADD COLUMN notify_payload_json JSON NULL AFTER pay_info')));
});
