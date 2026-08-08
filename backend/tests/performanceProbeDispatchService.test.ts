import test from 'node:test';
import assert from 'node:assert/strict';

import { PerformanceProbeDispatchService } from '../src/services/performanceProbeDispatchService';
import type { PerformanceProbeJobInput } from '../src/types/domain';
import { buildPerformanceNodeKey } from '../src/utils/performanceNodeKey';

const snapshotNodes = [
  {
    name: 'HK-1',
    region: 'HK',
    type: 'vless',
    outbound: { type: 'vless', server: 'hk.example', server_port: 443 },
    raw_uri: 'vless://required-worker-config',
  },
  {
    name: 'JP-1',
    region: 'JP',
    type: 'trojan',
    outbound: { type: 'trojan', server: 'jp.example', server_port: 443 },
    raw_uri: 'trojan://required-worker-config',
  },
];

test('PerformanceProbeDispatchService creates enabled shadow jobs with identical selected nodes', async () => {
  const created: PerformanceProbeJobInput[] = [];
  const service = new PerformanceProbeDispatchService({
    airportRepository: {
      listAll: async () => [{ id: 9, name: 'Now', status: 'normal', is_listed: true }],
    },
    probeRepository: {
      list: async () => [
        probe('legacy-control', true),
        probe('cn-shanghai', true),
        probe('cn-guangzhou', true),
      ],
    },
    settingRepository: {
      getByAirport: async () => ({
        airport_id: 9,
        config_version: 3,
        settings: [
          { probe_id: 'legacy-control', test_enabled: true, include_in_result: true, updated_by: null, updated_at: null },
          { probe_id: 'cn-shanghai', test_enabled: true, include_in_result: false, updated_by: null, updated_at: null },
          { probe_id: 'cn-guangzhou', test_enabled: true, include_in_result: false, updated_by: null, updated_at: null },
        ],
      }),
    },
    snapshotRepository: {
      getLatestByAirport: async () => ({
        id: 12,
        airport_id: 9,
        captured_at: '2026-08-08T12:00:00+08:00',
        source: 'scheduler',
        subscription_url: null,
        subscription_format: 'plain',
        parsed_nodes_count: 2,
        supported_nodes_count: 2,
        nodes: snapshotNodes,
        unsupported_nodes: [],
        created_at: '2026-08-08T12:00:01+08:00',
      }),
    },
    preferenceRepository: {
      getByAirport: async () => ({
        airport_id: 9,
        selected_nodes: [{
          key: buildPerformanceNodeKey(snapshotNodes[0]),
          name: 'HK-1',
          region: 'HK',
          type: 'vless',
        }],
        updated_by: 'ops',
        updated_at: '2026-08-08T11:00:00+08:00',
      }),
    },
    jobRepository: {
      create: async (input) => {
        created.push(input);
        return true;
      },
    },
  });

  const result = await service.dispatchAll('2026-08-08', 'scheduler-performance');

  assert.equal(result.created, 2);
  assert.equal(result.shadow, 2);
  assert.equal(result.official, 0);
  assert.deepEqual(created.map((job) => [job.probe_id, job.include_in_result_snapshot]), [
    ['cn-shanghai', false],
    ['cn-guangzhou', false],
  ]);
  assert.deepEqual(created[0]?.selected_node_keys, created[1]?.selected_node_keys);
  assert.deepEqual(created[0]?.selected_node_keys, [buildPerformanceNodeKey(snapshotNodes[0])]);
});

test('PerformanceProbeDispatchService skips disabled regions and reports missing snapshots safely', async () => {
  const service = new PerformanceProbeDispatchService({
    airportRepository: {
      listAll: async () => [{ id: 9, name: 'Now', status: 'normal', is_listed: true }],
    },
    probeRepository: {
      list: async () => [probe('cn-shanghai', true), probe('cn-guangzhou', true)],
    },
    settingRepository: {
      getByAirport: async () => ({
        airport_id: 9,
        config_version: 1,
        settings: [
          { probe_id: 'legacy-control', test_enabled: true, include_in_result: true, updated_by: null, updated_at: null },
          { probe_id: 'cn-shanghai', test_enabled: false, include_in_result: false, updated_by: null, updated_at: null },
          { probe_id: 'cn-guangzhou', test_enabled: true, include_in_result: false, updated_by: null, updated_at: null },
        ],
      }),
    },
    snapshotRepository: { getLatestByAirport: async () => null },
    preferenceRepository: { getByAirport: async () => null },
    jobRepository: { create: async () => true },
  });

  const result = await service.dispatchAll('2026-08-08', 'scheduler-performance');
  assert.equal(result.created, 0);
  assert.deepEqual(result.failures, [{ airport_id: 9, airport_name: 'Now', error_code: 'node_snapshot_missing' }]);
  assert.doesNotMatch(JSON.stringify(result), /raw_uri|password|subscription/i);
});

function probe(probeId: 'legacy-control' | 'cn-shanghai' | 'cn-guangzhou', enabled: boolean) {
  const mainland = probeId !== 'legacy-control';
  return {
    probe_id: probeId,
    display_name: probeId,
    region_code: probeId,
    provider: mainland ? 'tencent-cloud' : 'gaterank',
    bandwidth_mbps: mainland ? 200 : null,
    probe_type: mainland ? 'mainland' as const : 'legacy' as const,
    test_profile: 'proxy_multi_target_v2',
    scoring_rule_version: mainland ? 'cn_dual_probe_v1' as const : 'legacy_v1' as const,
    globally_enabled: enabled,
    token_configured: mainland,
    token_last_rotated_at: null,
    last_seen_at: null,
    created_at: '2026-08-08T00:00:00+08:00',
    updated_at: '2026-08-08T00:00:00+08:00',
  };
}
