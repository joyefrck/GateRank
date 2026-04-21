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

test('ApplicationPaymentOrderRepository.expireOpenOrdersByApplicationId expires created and failed orders', async () => {
  const executed: Array<{ sql: string; params?: unknown[] }> = [];

  const repository = new ApplicationPaymentOrderRepository({
    execute: async (sql: string, params?: unknown[]) => {
      executed.push({ sql, params });
      return [{ affectedRows: 3 }];
    },
  } as never);

  const affectedRows = await repository.expireOpenOrdersByApplicationId(9);

  assert.equal(affectedRows, 3);
  assert.equal(executed.length, 1);
  assert.match(executed[0]!.sql, /SET status = 'expired'/);
  assert.match(executed[0]!.sql, /status IN \('created', 'failed'\)/);
  assert.deepEqual(executed[0]!.params, [9]);
});
