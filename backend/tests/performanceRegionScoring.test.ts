import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregatePerformanceRegions,
  scorePerformanceRegion,
} from '../src/services/performanceRegionScoring';
import type { PerformanceRegionScore } from '../src/types/domain';

test('mainland scoring reaches full speed at 160 Mbps and marks the 180 Mbps probe ceiling', () => {
  const atFullSpeed = scorePerformanceRegion({
    probe_id: 'cn-shanghai',
    scoring_rule_version: 'cn_dual_probe_v1',
    median_latency_ms: 60,
    median_download_mbps: 160,
    packet_loss_percent: 0,
  });
  const atCeiling = scorePerformanceRegion({
    probe_id: 'cn-shanghai',
    scoring_rule_version: 'cn_dual_probe_v1',
    median_latency_ms: 60,
    median_download_mbps: 180,
    packet_loss_percent: 0,
  });

  assert.equal(atFullSpeed.speed_score, 100);
  assert.equal(atFullSpeed.probe_ceiling, false);
  assert.equal(atCeiling.speed_score, 100);
  assert.equal(atCeiling.probe_ceiling, true);
  assert.equal(atCeiling.p, 100);
});

test('legacy scoring keeps the existing 300 Mbps full-speed threshold', () => {
  const at160 = scorePerformanceRegion({
    probe_id: 'legacy-control',
    scoring_rule_version: 'legacy_v1',
    median_latency_ms: 60,
    median_download_mbps: 160,
    packet_loss_percent: 0,
  });
  const at300 = scorePerformanceRegion({
    probe_id: 'legacy-control',
    scoring_rule_version: 'legacy_v1',
    median_latency_ms: 60,
    median_download_mbps: 300,
    packet_loss_percent: 0,
  });

  assert.equal(at160.speed_score, 51.72);
  assert.equal(at160.probe_ceiling, false);
  assert.equal(at300.speed_score, 100);
});

test('multi-region aggregation gives every region one equal vote', () => {
  const regions: PerformanceRegionScore[] = [
    {
      probe_id: 'cn-shanghai',
      scoring_rule_version: 'cn_dual_probe_v1',
      median_latency_ms: 60,
      median_download_mbps: 180,
      packet_loss_percent: 0,
      latency_score: 100,
      speed_score: 100,
      loss_score: 100,
      p: 100,
      probe_ceiling: true,
    },
    {
      probe_id: 'cn-guangzhou',
      scoring_rule_version: 'cn_dual_probe_v1',
      median_latency_ms: 200,
      median_download_mbps: 80,
      packet_loss_percent: 2,
      latency_score: 60,
      speed_score: 60,
      loss_score: 60,
      p: 60,
      probe_ceiling: false,
    },
  ];

  const combined = aggregatePerformanceRegions(regions);

  assert.equal(combined.latency_score, 80);
  assert.equal(combined.speed_score, 80);
  assert.equal(combined.loss_score, 80);
  assert.equal(combined.p, 80);
  assert.equal(combined.median_latency_ms, 130);
  assert.equal(combined.median_download_mbps, 130);
  assert.equal(combined.packet_loss_percent, 1);
  assert.deepEqual(combined.included_probe_ids, ['cn-guangzhou', 'cn-shanghai']);
  assert.equal(combined.rule_summary, 'cn_dual_probe_v1');
});

test('multi-region aggregation rejects an empty region set', () => {
  assert.throws(() => aggregatePerformanceRegions([]), /at least one performance region/);
});
