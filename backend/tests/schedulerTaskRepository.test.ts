import test from 'node:test';
import assert from 'node:assert/strict';
import { SchedulerTaskRepository } from '../src/repositories/schedulerTaskRepository';

test('SchedulerTaskRepository.ensureSchema creates tasks table and seeds defaults', async () => {
  const queries: string[] = [];
  const executes: string[] = [];

  const repository = new SchedulerTaskRepository({
    query: async (sql: string) => {
      queries.push(sql);
      return [[]];
    },
    execute: async (sql: string) => {
      executes.push(sql);
      return [{}];
    },
  } as never);

  await repository.ensureSchema();

  assert.ok(queries.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS admin_scheduler_tasks')));
  assert.equal(executes.filter((sql) => sql.includes('INSERT IGNORE INTO admin_scheduler_tasks')).length, 4);
});
