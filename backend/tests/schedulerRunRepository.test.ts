import test from 'node:test';
import assert from 'node:assert/strict';
import { SchedulerRunRepository } from '../src/repositories/schedulerRunRepository';

test('SchedulerRunRepository.ensureSchema creates scheduler runs table', async () => {
  const queries: string[] = [];

  const repository = new SchedulerRunRepository({
    query: async (sql: string) => {
      queries.push(sql);
      return [[]];
    },
    execute: async () => [{}],
  } as never);

  await repository.ensureSchema();

  assert.ok(queries.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS admin_scheduler_runs')));
});

test('SchedulerRunRepository.listByQuery maps rows and parses detail json', async () => {
  const repository = new SchedulerRunRepository({
    query: async (sql: string) => {
      if (sql.includes('COUNT(*) AS total')) {
        return [[{ total: 1 }]];
      }
      return [[{
        id: 1,
        task_key: 'stability',
        run_date: '2026-03-30',
        trigger_source: 'schedule',
        status: 'succeeded',
        started_at: '2026-03-30 00:00:00',
        finished_at: '2026-03-30 00:01:00',
        duration_ms: 60000,
        message: 'ok',
        detail_json: '{"summary":"ok"}',
        created_at: '2026-03-30 00:00:00',
      }]];
    },
    execute: async () => [{}],
  } as never);

  const result = await repository.listByQuery({ page: 1, pageSize: 20 });

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.task_key, 'stability');
  assert.equal(result.items[0]?.detail_json?.summary, 'ok');
});
