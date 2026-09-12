import test from 'node:test';
import assert from 'node:assert/strict';
import { NetworkCoverageProbeService } from '../src/services/networkCoverageProbeService';
import { COVERAGE_PROBE_PROFILE, type CoverageProbeBatch } from '../src/repositories/networkCoverageProbeRepository';
import type { NetworkCoverageRunInput, PerformanceProbeJob, PerformanceProbeJobInput, SubscriptionNodeSnapshot } from '../src/types/domain';
import { buildPerformanceNodeKey } from '../src/utils/performanceNodeKey';
import { getDateInTimezone } from '../src/utils/time';

function fixture() {
  const date = getDateInTimezone();
  const nodes = ['香港', '日本', '台湾'].map((name) => ({ name, type: 'vless', region: null, raw_uri: `vless://secret-${name}`, outbound: { server: 'example.com', server_port: 443 } }));
  const snapshot = { id: 10, airport_id: 61, nodes, unsupported_nodes: [], subscription_format: 'clash_yaml', subscription_url: 'https://subscription.example/secret' } as unknown as SubscriptionNodeSnapshot;
  let batch: CoverageProbeBatch;
  const jobs: PerformanceProbeJobInput[] = [];
  const writes: NetworkCoverageRunInput[] = [];
  let recomputed = 0;
  let newer = false;
  const service = new NetworkCoverageProbeService({
    batchRepository: {
      insert: async (input) => { input.id = 1; batch = structuredClone(input); },
      get: async () => structuredClone(batch),
      save: async (input) => { batch = structuredClone(input); },
      lockAirport: async () => undefined,
      hasNewerCompleted: async () => newer,
    },
    jobRepository: {
      withTransaction: async (fn) => fn({} as never),
      create: async (input) => { jobs.push(input); return true; },
      markCompleted: async () => true,
    },
    runRepository: { insert: async (input) => { writes.push(input); return { id: 50 } as never; } },
    snapshotRepository: { getLatestByAirport: async () => snapshot, getById: async () => snapshot },
    probeRepository: { list: async () => [
      { probe_id: 'legacy-control', probe_type: 'legacy', globally_enabled: true, token_configured: true },
      { probe_id: 'cn-shanghai', probe_type: 'mainland', globally_enabled: true, token_configured: true },
      { probe_id: 'cn-guangzhou', probe_type: 'mainland', globally_enabled: true, token_configured: true },
    ] as never },
    airportRepository: { listAll: async () => [{ id: 61 }], getById: async () => ({ subscription_url: 'https://subscription.example/secret' }) },
    dispatchService: { waitForJobs: async () => ({ total: 2, completed: 2, failed: 0, pending: 0 }) },
    recomputeService: { recomputeAirportForDate: async () => { recomputed++; } },
  });
  const payload = (health: boolean[]) => ({
    status: 'success', sampled_at: `${date}T12:00:00+08:00`,
    nodes: nodes.map((node, i) => ({ key: buildPerformanceNodeKey(node), healthy: health[i], error_code: 'tcp_unreachable:secret' })),
  });
  const submit = (i: number, body: Record<string, unknown>) => service.submitRun({ ...jobs[i], status: 'leased' } as PerformanceProbeJob, body);
  return { service, jobs, writes, payload, submit, date, batch: () => batch!, recomputed: () => recomputed, newer: () => { newer = true; } };
}

test('coverage dispatch pins all nodes on mainland probes and only publishes the complete union', async () => {
  const f = fixture();
  await f.service.dispatchAirport(61, f.date, 'manual-network-coverage:1');
  assert.equal(f.jobs.length, 2);
  assert.ok(f.jobs.every((j) => j.test_profile === COVERAGE_PROBE_PROFILE && j.selected_node_keys.length === 3));
  await f.submit(0, f.payload([true, false, false]));
  assert.equal(f.writes.length, 0);
  assert.equal(f.recomputed(), 0);
  await f.submit(1, f.payload([false, true, false]));
  assert.deepEqual(f.writes[0].nodes?.map((n) => n.healthy), [true, true, false]);
  assert.equal(f.writes[0].status, 'success');
  assert.equal(f.batch().status, 'completed');
  assert.equal(f.recomputed(), 1);
  assert.doesNotMatch(JSON.stringify(f.writes), /secret|raw_uri|outbound/);
  assert.equal((f.writes[0].diagnostics?.regional_results as unknown[]).length, 2);
  const duplicate = await f.submit(1, f.payload([true, true, true]));
  assert.equal(duplicate.duplicate, true);
  assert.equal(f.writes.length, 1);
});

test('coverage rejects omitted, duplicated and foreign nodes without publishing', async () => {
  const f = fixture(); await f.service.dispatchAirport(61, f.date, 'manual-network-coverage:1');
  const good = f.payload([true, true, true]);
  for (const nodes of [good.nodes.slice(1), [...good.nodes, good.nodes[0]], [{ ...good.nodes[0], key: 'forged' }, ...good.nodes.slice(1)]]) {
    await assert.rejects(f.submit(0, { ...good, nodes }), /全部节点/);
  }
  assert.deepEqual(f.batch().results, {});
  assert.equal(f.writes.length, 0);
  const forged = { ...f.jobs[0], job_id: 'forged', status: 'leased' } as PerformanceProbeJob;
  await assert.rejects(f.service.submitRun(forged, good), /does not belong/);
});

test('collector failure preserves N while a completed all-unhealthy measurement legitimately scores zero', async () => {
  const f = fixture(); await f.service.dispatchAirport(61, f.date, 'manual-network-coverage:1');
  await f.submit(0, { ...f.payload([]), status: 'failed', nodes: [] });
  await f.submit(1, f.payload([true, true, true]));
  assert.equal(f.batch().status, 'failed'); assert.equal(f.writes.length, 0);
  const g = fixture(); await g.service.dispatchAirport(61, g.date, 'manual-network-coverage:2');
  await g.submit(0, g.payload([false, false, false])); await g.submit(1, g.payload([false, false, false]));
  assert.equal(g.writes.length, 1); assert.ok(g.writes[0].nodes?.every((n) => !n.healthy));
});

test('late older batches and mismatched measurement dates cannot overwrite current coverage', async () => {
  const f = fixture(); await f.service.dispatchAirport(61, f.date, 'manual-network-coverage:1');
  await assert.rejects(f.submit(0, { ...f.payload([true, true, true]), sampled_at: '2020-01-01T12:00:00+08:00' }), /全部节点/);
  f.newer(); await f.submit(0, f.payload([true, true, true])); await f.submit(1, f.payload([true, true, true]));
  assert.equal(f.batch().status, 'superseded'); assert.equal(f.writes.length, 0);
});
