import test from 'node:test';
import assert from 'node:assert/strict';
import { NetworkCoverageProbeService } from '../src/services/networkCoverageProbeService';
import { COVERAGE_PROBE_PROFILE, type CoverageProbeBatch } from '../src/repositories/networkCoverageProbeRepository';
import type { NetworkCoverageRunInput, PerformanceProbeJob, PerformanceProbeJobInput, SubscriptionNodeSnapshot } from '../src/types/domain';
import { buildPerformanceNodeKey } from '../src/utils/performanceNodeKey';
import { getDateInTimezone } from '../src/utils/time';

function fixture(options: { duplicateNodes?: boolean; differentUri?: boolean; waitFails?: boolean } = {}) {
  const date = getDateInTimezone();
  const nodes = ['香港', '日本', '台湾'].map((name) => ({ name, type: 'vless', region: null, raw_uri: `vless://secret-${name}`, outbound: { server: 'example.com', server_port: 443 } }));
  if (options.duplicateNodes) nodes.push({ ...nodes[0] }, { ...nodes[1] });
  if (options.differentUri) nodes.push({ ...nodes[0], raw_uri: 'vless://another-secret' });
  const snapshot = { id: 10, airport_id: 61, nodes, unsupported_nodes: [], subscription_format: 'clash_yaml', subscription_url: 'https://subscription.example/secret' } as unknown as SubscriptionNodeSnapshot;
  let batch: CoverageProbeBatch;
  const jobs: PerformanceProbeJobInput[] = [];
  const writes: NetworkCoverageRunInput[] = [];
  let recomputed = 0;
  let newer = false;
  const failedJobs: string[] = [];
  let committed = false;
  const service = new NetworkCoverageProbeService({
    batchRepository: {
      insert: async (input) => { input.id = 1; batch = structuredClone(input); },
      get: async () => structuredClone(batch),
      save: async (input) => { batch = structuredClone(input); },
      lockAirport: async () => undefined,
      hasNewerCompleted: async () => newer,
    },
    jobRepository: {
      withTransaction: async (fn) => { committed = false; const result = await fn({} as never); committed = true; return result; },
      create: async (input) => { jobs.push(input); return true; },
      markCompleted: async () => true,
      markFailed: async (id: string) => { failedJobs.push(id); return true; },
    },
    runRepository: { insert: async (input) => { writes.push(input); return { id: 50 } as never; } },
    snapshotRepository: { getLatestByAirport: async () => snapshot, getById: async () => snapshot },
    probeRepository: { list: async () => [
      { probe_id: 'legacy-control', probe_type: 'legacy', globally_enabled: true, token_configured: true },
      { probe_id: 'cn-shanghai', probe_type: 'mainland', globally_enabled: true, token_configured: true },
      { probe_id: 'cn-guangzhou', probe_type: 'mainland', globally_enabled: true, token_configured: true },
    ] as never },
    airportRepository: { listAll: async () => [{ id: 61 }], getById: async () => ({ subscription_url: 'https://subscription.example/secret' }) },
    dispatchService: { waitForJobs: async () => {
      if (options.waitFails) {
        await service.submitRun({ ...jobs[0], status: 'leased' } as PerformanceProbeJob, {
          status: 'failed', sampled_at: `${date}T12:00:00+08:00`, nodes: [],
        });
        throw new Error('地区性能任务失败');
      }
      return { total: 2, completed: 2, failed: 0, pending: 0 };
    } },
    recomputeService: { recomputeAirportForDate: async () => { recomputed++; } },
  });
  const payload = (health: boolean[]) => ({
    status: 'success', sampled_at: `${date}T12:00:00+08:00`,
    nodes: nodes.map((node, i) => ({ key: buildPerformanceNodeKey(node), healthy: health[i], error_code: 'tcp_unreachable:secret' })),
  });
  const submit = (i: number, body: Record<string, unknown>) => service.submitRun({ ...jobs[i], status: 'leased' } as PerformanceProbeJob, body);
  return { service, jobs, writes, payload, submit, date, failedJobs, committed: () => committed, batch: () => batch!, recomputed: () => recomputed, newer: () => { newer = true; } };
}

test('coverage deduplicates immutable snapshots through dispatch and publication, preserving distinct same-name nodes', async () => {
  const f = fixture({ duplicateNodes: true, differentUri: true });
  await f.service.dispatchAirport(61, f.date, 'manual-network-coverage:1');
  assert.equal(f.jobs[0].selected_node_keys.length, 4);
  const raw = f.payload([true, false, true, true, false, true]);
  const payload = { ...raw, nodes: [...new Map(raw.nodes.map((n) => [n.key, n])).values()] };
  await f.submit(0, payload);
  await f.submit(1, payload);
  assert.equal(f.writes[0].nodes?.length, 4);
  assert.equal(f.writes[0].nodes?.filter((n) => n.name === '香港').length, 2);
  const regional = f.writes[0].diagnostics?.regional_results as Array<{ detected_nodes_count: number }>;
  assert.ok(regional.every((r) => r.detected_nodes_count === 4));
});

test('invalid coverage results commit failed job and batch before returning HTTP 400', async () => {
  const f = fixture();
  await f.service.dispatchAirport(61, f.date, 'manual-network-coverage:1');
  await assert.rejects(f.submit(0, { ...f.payload([true, true, true]), nodes: [] }), { code: 'COVERAGE_RESULT_INVALID' });
  assert.equal(f.committed(), true);
  assert.deepEqual(f.failedJobs, [f.jobs[0].job_id]);
  assert.equal(f.batch().status, 'failed');
  assert.equal(f.batch().error_code, 'COVERAGE_RESULT_INVALID');
  await f.submit(1, f.payload([true, true, true]));
  assert.equal(f.writes.length, 0);
  assert.equal(f.recomputed(), 0);
});

test('collector failure finishes immediately and manual collection reports the coverage reason', async () => {
  const f = fixture();
  await f.service.dispatchAirport(61, f.date, 'manual-network-coverage:1');
  await f.submit(0, { ...f.payload([]), status: 'failed', nodes: [] });
  assert.equal(f.batch().status, 'failed');
  assert.deepEqual(f.failedJobs, [f.jobs[0].job_id]);
  const g = fixture({ waitFails: true });
  await assert.rejects(g.service.collectAirport(61, g.date, 'manual-network-coverage:2'), /网络覆盖采集失败.*原成绩保留/);
});

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
  assert.equal(f.batch().status, 'failed'); assert.equal(f.writes.length, 0);
  const g = fixture(); await g.service.dispatchAirport(61, g.date, 'manual-network-coverage:2');
  g.newer(); await g.submit(0, g.payload([true, true, true])); await g.submit(1, g.payload([true, true, true]));
  assert.equal(g.batch().status, 'superseded'); assert.equal(g.writes.length, 0);
});
