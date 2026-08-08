import test from 'node:test';
import assert from 'node:assert/strict';

import { assessPerformanceEvidence, PerformanceAnomalyService } from '../src/services/performanceAnomalyService';
import type { PerformanceRun, PerformanceRunTarget } from '../src/types/domain';

test('180 Mbps mainland ceiling is a neutral flag, not anomaly evidence', () => {
  const result = assessPerformanceEvidence({
    run: run('cn-shanghai', 180),
    targets: [],
    sameDateRuns: [],
    previousReasons: [],
    degradedTargetKeys: [],
  });

  assert.deepEqual(result, { status: 'normal', reasons: [], flags: ['probe_ceiling'] });
});

test('target ratio over 3x with a high value above 100 requires review', () => {
  const result = assessPerformanceEvidence({
    run: run('cn-shanghai', 120),
    targets: [target('node-a', 'target-a', 120), target('node-a', 'target-b', 30)],
    sameDateRuns: [],
    previousReasons: [],
    degradedTargetKeys: [],
  });

  assert.equal(result.status, 'needs_review');
  assert.deepEqual(result.reasons, ['target_ratio_over_3x']);
});

test('cohort target degradation suppresses airport target-ratio evidence', () => {
  const result = assessPerformanceEvidence({
    run: run('cn-shanghai', 120),
    targets: [target('node-a', 'target-a', 120), target('node-a', 'target-b', 30)],
    sameDateRuns: [],
    previousReasons: [],
    degradedTargetKeys: ['target-b'],
  });

  assert.equal(result.status, 'normal');
  assert.deepEqual(result.reasons, ['cohort_target_degraded']);
});

test('two independent dimensions on one date are suspicious', () => {
  const current = run('cn-shanghai', 160, [{ name: 'HK', download_mbps: 160 }]);
  const result = assessPerformanceEvidence({
    run: current,
    targets: [target('node-a', 'target-a', 160), target('node-a', 'target-b', 40)],
    sameDateRuns: [current, run('cn-guangzhou', 40, [{ name: 'HK', download_mbps: 40 }])],
    previousReasons: [],
    degradedTargetKeys: [],
  });

  assert.equal(result.status, 'suspicious');
  assert.deepEqual(result.reasons, ['region_ratio_over_3x', 'target_ratio_over_3x']);
});

test('same evidence on consecutive dates promotes review to suspicious', () => {
  const result = assessPerformanceEvidence({
    run: run('legacy-control', 400),
    targets: [],
    sameDateRuns: [run('legacy-control', 400), run('cn-shanghai', 100)],
    previousReasons: ['legacy_mainland_ratio_over_3x'],
    degradedTargetKeys: [],
  });

  assert.equal(result.status, 'suspicious');
  assert.deepEqual(result.reasons, ['legacy_mainland_ratio_over_3x']);
});

test('failed calibration invalidates evidence without accusing the airport', () => {
  const result = assessPerformanceEvidence({
    run: { ...run('cn-shanghai', 999), calibration_status: 'failed' },
    targets: [target('node-a', 'target-a', 999), target('node-a', 'target-b', 1)],
    sameDateRuns: [],
    previousReasons: [],
    degradedTargetKeys: [],
  });

  assert.deepEqual(result, { status: 'normal', reasons: [], flags: ['calibration_failed'] });
});

test('PerformanceAnomalyService persists review fields without score or listing mutations', async () => {
  const writes: Array<{ kind: string; args: unknown[] }> = [];
  const current = run('cn-shanghai', 120);
  const service = new PerformanceAnomalyService({
    runRepository: {
      getById: async () => current,
      listByAirportAndDate: async (_airportId, date) => date === '2026-08-08' ? [current] : [],
      markReviewStatus: async (...args) => { writes.push({ kind: 'run_review', args }); },
    },
    targetRepository: {
      listByRun: async () => [target('node-a', 'target-a', 120), target('node-a', 'target-b', 30)],
      listByDate: async () => [],
    },
    metricsRepository: {
      patchPerformanceReviewStatus: async (...args) => { writes.push({ kind: 'metric_review', args }); },
    },
  });

  const assessment = await service.assessRun(current.id);

  assert.equal(assessment?.status, 'needs_review');
  assert.deepEqual(writes, [
    { kind: 'run_review', args: [2, 'needs_review', ['target_ratio_over_3x']] },
    { kind: 'metric_review', args: [9, '2026-08-08', 'needs_review'] },
  ]);
  assert.doesNotMatch(JSON.stringify(writes), /score|risk|listing|tag/i);
});

function run(
  probeId: 'legacy-control' | 'cn-shanghai' | 'cn-guangzhou',
  downloadMbps: number,
  testedNodes: Array<{ name: string; download_mbps: number }> = [],
): PerformanceRun {
  const mainland = probeId !== 'legacy-control';
  return {
    id: probeId === 'legacy-control' ? 1 : probeId === 'cn-shanghai' ? 2 : 3,
    airport_id: 9,
    sampled_at: '2026-08-08T12:00:00+08:00',
    sampled_date: '2026-08-08',
    source: 'test',
    status: 'success',
    job_id: null,
    probe_id: probeId,
    region_code: probeId,
    provider: mainland ? 'tencent-cloud' : 'gaterank',
    bandwidth_mbps: mainland ? 200 : null,
    run_mode: 'official',
    test_profile: 'proxy_multi_target_v2',
    scoring_rule_version: mainland ? 'cn_dual_probe_v1' : 'legacy_v1',
    config_version: 1,
    calibration_status: 'not_required',
    calibration_mbps: null,
    review_status: 'normal',
    review_reasons: [],
    subscription_format: null,
    parsed_nodes_count: 1,
    supported_nodes_count: 1,
    selected_nodes: [],
    tested_nodes: testedNodes.map((node) => ({ ...node, region: null, type: 'vless', status: 'ok' })),
    available_nodes_count: 1,
    unavailable_nodes_count: 0,
    node_availability_percent: 100,
    node_unavailability_percent: 0,
    median_latency_ms: 80,
    median_download_mbps: downloadMbps,
    packet_loss_percent: 0,
    error_code: null,
    error_message: null,
    diagnostics: {},
  };
}

function target(nodeKey: string, targetKey: string, downloadMbps: number): PerformanceRunTarget {
  return {
    run_id: 2,
    node_key: nodeKey,
    target_key: targetKey,
    bytes_downloaded: 1,
    duration_ms: 1,
    download_mbps: downloadMbps,
    http_status: 200,
    error_code: null,
    valid: true,
  };
}
