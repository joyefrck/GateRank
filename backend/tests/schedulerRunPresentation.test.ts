import test from 'node:test';
import assert from 'node:assert/strict';
import { presentSchedulerRun } from '../src/services/schedulerRunPresentation';
import type { SchedulerRun } from '../src/types/domain';

function createRun(overrides: Partial<SchedulerRun> = {}): SchedulerRun {
  return {
    id: 1,
    task_key: 'stability',
    run_date: '2026-08-05',
    trigger_source: 'schedule',
    status: 'failed',
    started_at: '2026-08-05T04:00:00+08:00',
    finished_at: '2026-08-05T04:21:19+08:00',
    duration_ms: 1_279_798,
    message: null,
    detail_json: null,
    created_at: '2026-08-05T04:00:00+08:00',
    ...overrides,
  };
}

test('presentSchedulerRun derives partial outcome from a legacy stability summary', () => {
  const summary = '60/61 succeeded, 1 failed; 网际快车 #43: The read operation timed out';
  const view = presentSchedulerRun(createRun({
    message: `稳定性采集失败：${summary}`,
    detail_json: { stage: 'stability', summary },
  }));

  assert.equal(view.outcome, 'partial');
  assert.deepEqual(view.result_summary, {
    total_count: 61,
    success_count: 60,
    failure_count: 1,
    skipped_count: 0,
    failures: [{
      airport_id: 43,
      airport_name: '网际快车',
      error: 'The read operation timed out',
    }],
    missing_failure_detail_count: 0,
  });
});

test('presentSchedulerRun preserves every structured subscription failure and redacts urls', () => {
  const view = presentSchedulerRun(createRun({
    task_key: 'subscription_node_refresh',
    message: '订阅节点更新失败：目标 3，成功 1，失败 2，跳过 0',
    detail_json: {
      stage: 'subscription_node_refresh',
      airport_count: 3,
      target_count: 3,
      success_count: 1,
      failure_count: 2,
      skipped_count: 0,
      failures: [
        { airport_id: 82, airport_name: 'dashbit比特冲刺', error: 'fetch https://sub.example.com/token failed' },
        { airport_id: 75, airport_name: '宇宙云', error: 'subscription_fetch_or_parse_failed' },
      ],
    },
  }));

  assert.equal(view.outcome, 'partial');
  assert.equal(view.result_summary?.failures.length, 2);
  assert.equal(view.result_summary?.failures[0]?.error, 'fetch [redacted-url] failed');
  assert.equal(view.result_summary?.missing_failure_detail_count, 0);
});

test('presentSchedulerRun reports missing historical failure details', () => {
  const summary = '58/60 succeeded, 2 failed; 闪狐云 #72: The read operation timed out';
  const view = presentSchedulerRun(createRun({
    message: `稳定性采集失败：${summary}`,
    detail_json: { stage: 'stability', summary },
  }));

  assert.equal(view.outcome, 'partial');
  assert.equal(view.result_summary?.failure_count, 2);
  assert.equal(view.result_summary?.failures.length, 1);
  assert.equal(view.result_summary?.missing_failure_detail_count, 1);
});

test('presentSchedulerRun maps resample counts to triggered airports', () => {
  const view = presentSchedulerRun(createRun({
    task_key: 'stability_resample_guard',
    detail_json: {
      stage: 'stability_resample_guard',
      checked_count: 61,
      flagged_count: 3,
      retested_count: 2,
      failures: [{ airport_id: 43, error: '网际快车 #43: timeout' }],
    },
  }));

  assert.equal(view.outcome, 'partial');
  assert.equal(view.result_summary?.total_count, 3);
  assert.equal(view.result_summary?.success_count, 2);
  assert.equal(view.result_summary?.failure_count, 1);
});

test('presentSchedulerRun keeps fully successful and fully failed outcomes distinct', () => {
  const succeeded = presentSchedulerRun(createRun({
    status: 'succeeded',
    detail_json: { stage: 'performance', airport_count: 61, success_count: 61, failure_count: 0, failures: [] },
  }));
  const failed = presentSchedulerRun(createRun({
    detail_json: { stage: 'performance', airport_count: 61, success_count: 0, failure_count: 61, failures: [] },
  }));

  assert.equal(succeeded.outcome, 'succeeded');
  assert.equal(failed.outcome, 'failed');
  assert.equal(failed.result_summary?.missing_failure_detail_count, 61);
});

test('presentSchedulerRun rejects contradictory counts and preserves non-batch status', () => {
  const contradictory = presentSchedulerRun(createRun({
    detail_json: { stage: 'stability', airport_count: 10, success_count: 9, failure_count: 2 },
  }));
  const aggregate = presentSchedulerRun(createRun({
    task_key: 'aggregate_recompute',
    detail_json: { aggregate: { status: 'failed' } },
  }));

  assert.equal(contradictory.outcome, 'failed');
  assert.equal(contradictory.result_summary, null);
  assert.equal(aggregate.outcome, 'failed');
  assert.equal(aggregate.result_summary, null);
});
