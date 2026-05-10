import test from 'node:test';
import assert from 'node:assert/strict';
import { SchedulerTaskRepository } from '../src/repositories/schedulerTaskRepository';

test('SchedulerTaskRepository.ensureSchema creates tasks table and seeds defaults', async () => {
  const queries: string[] = [];
  const executes: Array<{ sql: string; params?: unknown[] }> = [];

  const repository = new SchedulerTaskRepository({
    query: async (sql: string) => {
      queries.push(sql);
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      executes.push({ sql, params });
      return [{}];
    },
  } as never);

  await repository.ensureSchema();

  assert.ok(queries.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS admin_scheduler_tasks')));
  assert.ok(queries.some((sql) => sql.includes('MODIFY COLUMN task_key') && sql.includes('billing_listing_sync')));
  assert.equal(executes.filter((call) => call.sql.includes('INSERT IGNORE INTO admin_scheduler_tasks')).length, 5);
  assert.ok(executes.some((call) => call.params?.[0] === 'billing_listing_sync' && call.params?.[2] === 0 && call.params?.[3] === '03:00'));
});
