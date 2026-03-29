import test from 'node:test';
import assert from 'node:assert/strict';
import { AccessTokenRepository } from '../src/repositories/accessTokenRepository';

test('AccessTokenRepository.ensureSchema creates access token table', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  let schemaChecks = 0;

  const repository = new AccessTokenRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM information_schema.COLUMNS')) {
        schemaChecks += 1;
        return [schemaChecks <= 10 ? [] : [{ 1: 1 }]];
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
    calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS admin_access_tokens')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE admin_access_tokens ADD COLUMN token_hash CHAR(64) NOT NULL AFTER description')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE admin_access_tokens ADD COLUMN last_used_ip VARCHAR(64) NULL AFTER last_used_at')),
  );
});
