import test from 'node:test';
import assert from 'node:assert/strict';

import { PerformanceProbeJobService } from '../src/services/performanceProbeJobService';
import type { PerformanceProbeJob, PerformanceRunInput, PerformanceRunTarget } from '../src/types/domain';

const leasedJob: PerformanceProbeJob = {
  job_id: 'job-1',
  airport_id: 9,
  probe_id: 'cn-shanghai',
  node_snapshot_id: 12,
  config_version: 3,
  test_enabled_snapshot: true,
  include_in_result_snapshot: false,
  selected_node_keys: [],
  test_profile: 'mainland_multi_target_v1',
  scoring_rule_version: 'cn_dual_probe_v1',
  source: 'manual-performance',
  status: 'leased',
  lease_owner: 'worker-a',
  lease_expires_at: '2026-08-08T12:15:00+08:00',
  attempts: 1,
  idempotency_key: 'key-1',
  run_id: null,
  created_at: '2026-08-08T12:00:00+08:00',
  updated_at: '2026-08-08T12:00:00+08:00',
  completed_at: null,
};

const acceptedPayload = {
  job_id: leasedJob.job_id,
  sampled_at: '2026-08-08T12:01:00+08:00',
  status: 'success',
  calibration_status: 'passed',
  calibration_mbps: 188,
  target_results: [{
    node_key: 'node-a',
    target_key: 'target-a',
    bytes_downloaded: 1_000_000,
    duration_ms: 1000,
    download_mbps: 80,
    http_status: 200,
    error_code: null,
    valid: true,
  }],
};

test('PerformanceProbeJobService leases only the reusable snapshot payload', async () => {
  const service = new PerformanceProbeJobService({
    jobRepository: {
      leaseNext: async () => leasedJob,
      getById: async () => leasedJob,
      markCompleted: async () => true,
    },
    snapshotRepository: {
      getById: async () => ({
        id: 12,
        airport_id: 9,
        captured_at: '2026-08-08T11:50:00+08:00',
        source: 'scheduler',
        subscription_url: 'https://subscription.example/secret',
        subscription_format: 'plain',
        parsed_nodes_count: 1,
        supported_nodes_count: 1,
        nodes: [{
          name: 'node-a',
          region: null,
          type: 'vless',
          outbound: { type: 'vless', server: 'node.example', server_port: 443 },
          raw_uri: 'vless://required-by-worker',
        }],
        unsupported_nodes: [],
        created_at: '2026-08-08T11:50:01+08:00',
      }),
    },
    runRepository: { insert: async () => 44 },
    targetRepository: { insertMany: async () => undefined },
  });

  const payload = await service.leaseNextJob('cn-shanghai', 'worker-a');
  const serialized = JSON.stringify(payload);

  assert.match(serialized, /node\.example/);
  assert.doesNotMatch(serialized, /subscription\.example/);
  assert.equal(payload?.run_mode, 'shadow');
  assert.equal(payload?.scoring_rule_version, 'cn_dual_probe_v1');
});

test('PerformanceProbeJobService derives structured run identity from the leased job', async () => {
  const insertedRuns: PerformanceRunInput[] = [];
  let insertedTargets: PerformanceRunTarget[] = [];
  let completed: unknown[] = [];
  const service = new PerformanceProbeJobService({
    jobRepository: {
      leaseNext: async () => leasedJob,
      getById: async () => leasedJob,
      markCompleted: async (...args) => {
        completed = args;
        return true;
      },
    },
    snapshotRepository: { getById: async () => null },
    runRepository: {
      insert: async (input) => {
        insertedRuns.push(input);
        return 44;
      },
    },
    targetRepository: {
      insertMany: async (targets) => {
        insertedTargets = targets;
      },
    },
  });

  const result = await service.submitRun('cn-shanghai', {
    job_id: 'job-1',
    sampled_at: '2026-08-08T12:00:00+08:00',
    status: 'success',
    calibration_status: 'passed',
    calibration_mbps: 200,
    median_download_mbps: 120,
    target_results: [{
      node_key: 'node-a',
      target_key: 'target-a',
      bytes_downloaded: 5000000,
      duration_ms: 333,
      download_mbps: 120,
      http_status: 200,
      valid: true,
    }],
  });

  assert.equal(result.run_id, 44);
  assert.equal(insertedRuns[0]?.probe_id, 'cn-shanghai');
  assert.equal(insertedRuns[0]?.run_mode, 'shadow');
  assert.equal(insertedRuns[0]?.config_version, 3);
  assert.equal(insertedTargets[0]?.run_id, 44);
  assert.deepEqual(completed, ['job-1', 'cn-shanghai', 44]);
});

test('PerformanceProbeJobService returns the original run for a completed duplicate', async () => {
  let inserts = 0;
  const service = new PerformanceProbeJobService({
    jobRepository: {
      leaseNext: async () => null,
      getById: async () => ({ ...leasedJob, status: 'completed', run_id: 44 }),
      markCompleted: async () => true,
    },
    snapshotRepository: { getById: async () => null },
    runRepository: {
      insert: async () => {
        inserts += 1;
        return 45;
      },
    },
    targetRepository: { insertMany: async () => undefined },
  });

  const result = await service.submitRun('cn-shanghai', { job_id: 'job-1' });
  assert.deepEqual(result, { run_id: 44, job_id: 'job-1', duplicate: true });
  assert.equal(inserts, 0);
});

test('PerformanceProbeJobService recomputes only after a complete official upload', async () => {
  const calls: string[] = [];
  const service = new PerformanceProbeJobService({
    jobRepository: {
      leaseNext: async () => null,
      getById: async () => ({ ...leasedJob, include_in_result_snapshot: true }),
      markCompleted: async () => true,
    },
    snapshotRepository: { getById: async () => null },
    runRepository: { insert: async () => 45 },
    targetRepository: { insertMany: async () => undefined },
    aggregationService: {
      aggregateAirportForDate: async (airportId, date) => {
        calls.push(`aggregate:${airportId}:${date}`);
        return { aggregated: 1, pending_probe_ids: [] };
      },
    },
    recomputeService: {
      recomputeAirportForDate: async (date, airportId) => {
        calls.push(`recompute:${airportId}:${date}`);
        return { recomputed: 1 };
      },
    },
  });

  await service.submitRun('cn-shanghai', {
    job_id: 'job-1',
    sampled_at: '2026-08-08T12:00:00+08:00',
    status: 'success',
    calibration_status: 'passed',
    calibration_mbps: 180,
  });

  assert.deepEqual(calls, ['aggregate:9:2026-08-08', 'recompute:9:2026-08-08']);
});

test('PerformanceProbeJobService stores run and targets atomically before finalizing', async () => {
  const events: string[] = [];
  const transactionConnection = { marker: 'transaction' };
  const service = new PerformanceProbeJobService({
    jobRepository: {
      leaseNext: async () => null,
      getById: async () => ({ ...leasedJob, include_in_result_snapshot: true }),
      withTransaction: async (work) => {
        events.push('transaction:start');
        const result = await work(transactionConnection as never);
        events.push('transaction:commit');
        return result;
      },
      markCompleted: async (_jobId, _probeId, runId) => {
        events.push(`job:complete:${runId}`);
        return true;
      },
    },
    snapshotRepository: { getById: async () => null },
    runRepository: {
      getByJobId: async () => null,
      insert: async (_input, executor) => {
        assert.equal(executor, transactionConnection);
        events.push('run:insert');
        return 44;
      },
    },
    targetRepository: {
      insertMany: async (targets, executor) => {
        assert.equal(executor, transactionConnection);
        assert.equal(targets[0]?.run_id, 44);
        events.push('targets:insert');
      },
    },
    performanceAnomalyService: {
      assessRun: async () => events.push('anomaly:assess'),
    },
    aggregationService: {
      aggregateAirportForDate: async () => {
        events.push('aggregate');
        return { aggregated: 1 };
      },
    },
    recomputeService: {
      recomputeAirportForDate: async () => {
        events.push('recompute');
        return { recomputed: 1 };
      },
    },
  });

  const result = await service.submitRun('cn-shanghai', acceptedPayload);

  assert.deepEqual(result, { run_id: 44, job_id: leasedJob.job_id, duplicate: false });
  assert.deepEqual(events, [
    'transaction:start',
    'run:insert',
    'targets:insert',
    'transaction:commit',
    'anomaly:assess',
    'aggregate',
    'recompute',
    'job:complete:44',
  ]);
});

test('PerformanceProbeJobService leaves the leased job retryable when evidence transaction fails', async () => {
  let completed = false;
  let rolledBack = false;
  const service = new PerformanceProbeJobService({
    jobRepository: {
      leaseNext: async () => null,
      getById: async () => leasedJob,
      withTransaction: async (work) => {
        try {
          return await work({} as never);
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      },
      markCompleted: async () => {
        completed = true;
        return true;
      },
    },
    snapshotRepository: { getById: async () => null },
    runRepository: {
      getByJobId: async () => null,
      insert: async () => 44,
    },
    targetRepository: {
      insertMany: async () => {
        throw new Error('target_write_failed');
      },
    },
  });

  await assert.rejects(service.submitRun('cn-shanghai', acceptedPayload), /target_write_failed/);
  assert.equal(rolledBack, true);
  assert.equal(completed, false);
});

test('PerformanceProbeJobService resumes finalization from persisted evidence after retry', async () => {
  const events: string[] = [];
  let inserted = false;
  const service = new PerformanceProbeJobService({
    jobRepository: {
      leaseNext: async () => null,
      getById: async () => ({ ...leasedJob, include_in_result_snapshot: true }),
      markCompleted: async () => {
        events.push('job:complete');
        return true;
      },
    },
    snapshotRepository: { getById: async () => null },
    runRepository: {
      getByJobId: async () => ({
        id: 44,
        status: 'success',
        sampled_at: '2026-08-08T12:01:00+08:00',
        sampled_date: '2026-08-08',
        calibration_status: 'passed',
      } as never),
      insert: async () => {
        inserted = true;
        return 45;
      },
    },
    targetRepository: { insertMany: async () => undefined },
    performanceAnomalyService: {
      assessRun: async () => events.push('anomaly:assess'),
    },
    aggregationService: {
      aggregateAirportForDate: async () => {
        events.push('aggregate');
        return { aggregated: 0, pending_probe_ids: ['cn-guangzhou'] };
      },
    },
  });

  const result = await service.submitRun('cn-shanghai', acceptedPayload);

  assert.deepEqual(result, { run_id: 44, job_id: leasedJob.job_id, duplicate: true });
  assert.equal(inserted, false);
  assert.deepEqual(events, ['anomaly:assess', 'aggregate', 'job:complete']);
});
