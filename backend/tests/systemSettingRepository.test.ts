import test from 'node:test';
import assert from 'node:assert/strict';
import { SystemSettingRepository } from '../src/repositories/systemSettingRepository';

test('SystemSettingRepository.ensureSchema creates system settings table', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  let schemaChecks = 0;

  const repository = new SystemSettingRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM information_schema.COLUMNS')) {
        schemaChecks += 1;
        return [schemaChecks <= 4 ? [] : [{ 1: 1 }]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{}];
    },
  } as never);

  await repository.ensureSchema();

  assert.ok(
    calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS admin_system_settings')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE admin_system_settings ADD COLUMN value_json JSON NOT NULL AFTER setting_key')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE admin_system_settings ADD COLUMN updated_by VARCHAR(128) NOT NULL AFTER value_json')),
  );
});
