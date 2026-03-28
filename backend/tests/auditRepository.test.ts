import test from 'node:test';
import assert from 'node:assert/strict';
import { AuditRepository } from '../src/repositories/auditRepository';

test('AuditRepository.ensureSchema creates admin audit logs table', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  let schemaChecks = 0;

  const repository = new AuditRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM information_schema.COLUMNS')) {
        schemaChecks += 1;
        return [schemaChecks <= 5 ? [] : [{ 1: 1 }]];
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
    calls.some((call) => call.sql.includes('CREATE TABLE IF NOT EXISTS admin_audit_logs')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE admin_audit_logs ADD COLUMN actor VARCHAR(128) NOT NULL AFTER id')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE admin_audit_logs ADD COLUMN request_id VARCHAR(64) NOT NULL AFTER action')),
  );
  assert.ok(
    calls.some((call) => call.sql.includes('ALTER TABLE admin_audit_logs ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER payload_hash')),
  );
});
