import test from 'node:test';
import assert from 'node:assert/strict';
import { SchedulerRunRepository } from '../src/repositories/schedulerRunRepository';
import { SchedulerTaskRepository } from '../src/repositories/schedulerTaskRepository';

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
  assert.ok(queries.some((sql) => sql.includes('MODIFY COLUMN task_key') && sql.includes('subscription_node_refresh')));
  assert.ok(queries.some((sql) => sql.includes('MODIFY COLUMN task_key') && sql.includes('ad_expiry_reminder')));
});

test('scheduler task and run schemas accept the same task keys, including the 09:00 reminder', async () => {
  const queries: string[] = [];
  const pool = {
    query: async (sql: string) => { queries.push(sql); return [[]]; },
    execute: async () => [{}],
  };
  await new SchedulerTaskRepository(pool as never).ensureSchema();
  const repository = new SchedulerRunRepository(pool as never);
  await repository.ensureSchema();
  const enums = queries.filter((sql) => sql.includes('MODIFY COLUMN task_key'))
    .map((sql) => sql.match(/ENUM\([^)]+\)/)?.[0]);
  assert.equal(enums.length, 2);
  assert.equal(enums[0], enums[1]);
  const latest = await repository.listLatestByTaskKeys([]);
  assert.equal(latest.ad_expiry_reminder, null);
  assert.equal(latest.network_coverage, null);
});

test('SchedulerRunRepository.listByQuery maps rows and parses detail json', async () => {
  const repository = new SchedulerRunRepository({
    query: async (sql: string) => {
      if (sql.includes('COUNT(*) AS total')) {
        return [[{ total: 1 }]];
      }
      return [[{
        id: 1,
        task_key: 'billing_listing_sync',
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
  assert.equal(result.items[0]?.task_key, 'billing_listing_sync');
  assert.equal(result.items[0]?.detail_json?.summary, 'ok');
});

test('SchedulerRunRepository.getDailyStats retains latest run presentation inputs', async () => {
  const repository = new SchedulerRunRepository({
    query: async () => [[{
      run_date: '2026-08-05',
      task_key: 'stability',
      total_runs: 1,
      success_count: 0,
      failed_count: 1,
      total_duration_ms: 1000,
      last_status: 'failed',
      last_started_at: '2026-08-05 04:00:00',
      last_finished_at: '2026-08-05 04:00:01',
      last_message: '稳定性采集失败：60/61 succeeded, 1 failed',
      last_detail_json: JSON.stringify({
        stage: 'stability',
        summary: '60/61 succeeded, 1 failed',
      }),
    }]],
    execute: async () => [{}],
  } as never);

  const result = await repository.getDailyStats({
    dateFrom: '2026-08-05',
    dateTo: '2026-08-05',
  });
  const item = result[0] as unknown as Record<string, unknown>;

  assert.equal(item.last_message, '稳定性采集失败：60/61 succeeded, 1 failed');
  assert.deepEqual(item.last_detail_json, {
    stage: 'stability',
    summary: '60/61 succeeded, 1 failed',
  });
});
