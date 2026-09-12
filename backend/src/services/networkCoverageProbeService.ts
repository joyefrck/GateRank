import { randomUUID } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import { HttpError } from '../middleware/errorHandler';
import { COVERAGE_PROBE_PROFILE, type CoverageProbeBatch, type CoverageProbeResult, type NetworkCoverageProbeRepository } from '../repositories/networkCoverageProbeRepository';
import type { PerformanceProbeJobRepository } from '../repositories/performanceProbeJobRepository';
import type { NetworkCoverageRunRepository } from '../repositories/networkCoverageRunRepository';
import type { PerformanceProbeDispatchService } from './performanceProbeDispatchService';
import type { PerformanceProbe, PerformanceProbeId, PerformanceProbeJob, SubscriptionNodeSnapshot } from '../types/domain';
import { buildPerformanceNodeKey } from '../utils/performanceNodeKey';
import { formatSqlDateTimeInTimezone, getDateInTimezone } from '../utils/time';

type Deps = {
  batchRepository: Pick<NetworkCoverageProbeRepository, 'insert' | 'get' | 'save' | 'hasNewerCompleted' | 'lockAirport'>;
  jobRepository: Pick<PerformanceProbeJobRepository, 'withTransaction' | 'create' | 'markCompleted'>;
  runRepository: Pick<NetworkCoverageRunRepository, 'insert'>;
  snapshotRepository: { getLatestByAirport(id: number): Promise<SubscriptionNodeSnapshot | null>; getById(id: number): Promise<SubscriptionNodeSnapshot | null> };
  probeRepository: { list(): Promise<PerformanceProbe[]> };
  airportRepository: { listAll(): Promise<Array<{ id: number; status?: string; is_listed?: boolean }>>; getById(id: number): Promise<{ subscription_url?: string | null } | null> };
  dispatchService: Pick<PerformanceProbeDispatchService, 'waitForJobs'>;
  recomputeService: { recomputeAirportForDate(date: string, id: number): Promise<unknown> };
};

export class NetworkCoverageProbeService {
  constructor(private readonly deps: Deps) {}

  async dispatchAirport(airportId: number, date: string, source: string): Promise<CoverageProbeBatch> {
    if (date !== getDateInTimezone()) throw new Error('网络覆盖只允许采集当天数据');
    const [snapshot, probes, airport] = await Promise.all([
      this.deps.snapshotRepository.getLatestByAirport(airportId), this.deps.probeRepository.list(), this.deps.airportRepository.getById(airportId),
    ]);
    if (!snapshot || !snapshot.nodes.length) throw new Error('没有可用节点快照，请先刷新订阅节点');
    if (!airport?.subscription_url || snapshot.subscription_url !== airport.subscription_url) throw new Error('订阅已变化，请先刷新节点快照');
    const active = probes.filter((p) => p.probe_type === 'mainland' && p.globally_enabled && p.token_configured);
    if (!active.length) throw new Error('没有已启用的大陆探针，网络覆盖未采集');
    const batch: CoverageProbeBatch = {
      id: 0, batch_key: randomUUID(), airport_id: airportId, date,
      sampled_at: formatSqlDateTimeInTimezone(new Date()), source, snapshot_id: snapshot.id,
      jobs: Object.fromEntries(active.map((p) => [p.probe_id, randomUUID()])), results: {}, status: 'pending', run_id: null,
    };
    await this.deps.jobRepository.withTransaction(async (connection) => {
      await this.deps.batchRepository.insert(batch, connection);
      for (const probe of active) {
        const created = await this.deps.jobRepository.create({
          job_id: batch.jobs[probe.probe_id]!, airport_id: airportId, probe_id: probe.probe_id,
          node_snapshot_id: snapshot.id, config_version: 0,
          test_enabled_snapshot: true, include_in_result_snapshot: true,
          test_profile: COVERAGE_PROBE_PROFILE, scoring_rule_version: 'network_coverage_v1',
          selected_node_keys: snapshot.nodes.map(buildPerformanceNodeKey), source,
          idempotency_key: `network-coverage:${batch.batch_key}:${probe.probe_id}`,
        }, connection);
        if (!created) throw new Error('网络覆盖任务创建冲突');
      }
    });
    return batch;
  }

  async collectAirport(airportId: number, date: string, source: string): Promise<void> {
    const batch = await this.dispatchAirport(airportId, date, source);
    await this.deps.dispatchService.waitForJobs(Object.values(batch.jobs), { timeoutMs: 60 * 60 * 1000 });
    const completed = await this.deps.batchRepository.get(batch.batch_key);
    if (completed?.status !== 'completed') throw new Error('大陆网络覆盖未形成完整结果，原成绩保留');
  }

  async dispatchAll(date: string, source: string): Promise<{ created: number; failures: number[] }> {
    const result = { created: 0, failures: [] as number[] };
    for (const airport of await this.deps.airportRepository.listAll()) {
      if (airport.status === 'down' || airport.is_listed === false) continue;
      try { await this.dispatchAirport(airport.id, date, source); result.created += 1; }
      catch { result.failures.push(airport.id); }
    }
    return result;
  }

  async submitRun(job: PerformanceProbeJob, payload: Record<string, unknown>): Promise<{ run_id: number; job_id: string; duplicate: boolean }> {
    if (!['leased', 'completed'].includes(job.status)) throw new HttpError(409, 'PROBE_JOB_NOT_LEASED', 'Coverage job is not leased');
    const batchKey = job.idempotency_key.split(':')[1];
    const snapshot = await this.deps.snapshotRepository.getById(job.node_snapshot_id);
    if (!snapshot || snapshot.airport_id !== job.airport_id) throw new HttpError(409, 'PROBE_JOB_SNAPSHOT_MISSING', 'Coverage snapshot is unavailable');
    const outcome = await this.deps.jobRepository.withTransaction(async (connection) => {
      // Serialize publication across batches as well as between the two probes.
      await this.deps.batchRepository.lockAirport(job.airport_id, connection);
      const batch = await this.deps.batchRepository.get(batchKey, connection, true);
      if (!batch || batch.jobs[job.probe_id] !== job.job_id || batch.snapshot_id !== snapshot.id) {
        throw new HttpError(403, 'PROBE_JOB_FORBIDDEN', 'Coverage job does not belong to this batch');
      }
      const duplicate = Boolean(batch.results[job.probe_id]);
      if (!duplicate) batch.results[job.probe_id] = validateResult(payload, snapshot, batch.date);
      if (batch.status === 'pending' && Object.keys(batch.jobs).every((id) => batch.results[id as PerformanceProbeId])) {
        if (Object.values(batch.results).some((r) => r.status !== 'success')) batch.status = 'failed';
        else if (await this.deps.batchRepository.hasNewerCompleted(batch, connection)) batch.status = 'superseded';
        else await this.publish(batch, snapshot, connection);
      }
      await this.deps.batchRepository.save(batch, connection);
      // For coverage profiles run_id references the coverage batch, never a P run.
      if (!await this.deps.jobRepository.markCompleted(job.job_id, job.probe_id, batch.id, connection)) {
        throw new HttpError(409, 'PROBE_JOB_COMPLETION_CONFLICT', 'Coverage completion failed');
      }
      return { batch, duplicate };
    });
    if (outcome.batch.status === 'completed') {
      await this.deps.recomputeService.recomputeAirportForDate(outcome.batch.date, job.airport_id);
    }
    return { run_id: outcome.batch.id, job_id: job.job_id, duplicate: outcome.duplicate };
  }

  private async publish(batch: CoverageProbeBatch, snapshot: SubscriptionNodeSnapshot, connection: PoolConnection): Promise<void> {
    const regional = Object.entries(batch.results);
    const byProbe = regional.map(([probeId, result]) => ({ probeId, result, nodes: new Map(result.nodes.map((n) => [n.key, n])) }));
    const nodes = snapshot.nodes.map((node) => {
      const key = buildPerformanceNodeKey(node);
      const healthy = byProbe.some((probe) => probe.nodes.get(key)?.healthy);
      return { key, name: safeName(node.name), type: node.type, healthy,
        error_code: healthy ? null : 'all_mainland_probes_failed' };
    });
    const run = await this.deps.runRepository.insert({
      airport_id: batch.airport_id, sampled_at: batch.sampled_at, sampled_date: batch.date,
      source: batch.source, status: 'success', subscription_format: snapshot.subscription_format,
      unsupported_nodes_count: snapshot.unsupported_nodes.length, nodes,
      diagnostics: {
        health_check: 'mainland_proxy_http_any_success_v1', batch_id: batch.id,
        node_snapshot_id: snapshot.id, probe_ids: Object.keys(batch.jobs),
        regional_results: byProbe.map(({ probeId, result, nodes: results }) => ({
          probe_id: probeId, sampled_at: result.sampled_at, status: result.status,
          healthy_nodes_count: result.nodes.filter((n) => n.healthy).length,
          detected_nodes_count: result.nodes.length,
          nodes: nodes.map((n) => ({ ...n, healthy: results.get(n.key)!.healthy, error_code: results.get(n.key)!.error_code })),
        })),
      },
    }, connection);
    batch.run_id = run.id;
    batch.status = 'completed';
  }
}

function validateResult(payload: Record<string, unknown>, snapshot: SubscriptionNodeSnapshot, date: string): CoverageProbeResult {
  const invalid = () => new HttpError(400, 'COVERAGE_RESULT_INVALID', '网络覆盖结果必须包含本轮全部节点的真实检查结果');
  const sampledAt = String(payload.sampled_at || '');
  if (!Number.isFinite(Date.parse(sampledAt)) || getDateInTimezone('Asia/Shanghai', new Date(sampledAt)) !== date) throw invalid();
  if (payload.status === 'failed') return { status: 'failed', sampled_at: sampledAt, nodes: [] };
  if (payload.status !== 'success' || !Array.isArray(payload.nodes)) throw invalid();
  const expected = new Set(snapshot.nodes.map(buildPerformanceNodeKey));
  const seen = new Set<string>();
  const nodes = payload.nodes.map((item) => {
    if (!item || typeof item !== 'object') throw invalid();
    const row = item as Record<string, unknown>;
    const key = String(row.key || '');
    if (!expected.has(key) || seen.has(key) || typeof row.healthy !== 'boolean') throw invalid();
    seen.add(key);
    return { key, healthy: row.healthy, error_code: row.healthy ? null : safeError(row.error_code) };
  });
  if (seen.size !== expected.size) throw invalid();
  return { sampled_at: sampledAt, status: 'success', nodes };
}

function safeError(value: unknown): string {
  const code = String(value || '').split(':')[0];
  return ['tcp_unreachable', 'proxy_ssl_eof', 'proxy_connection_reset', 'proxy_http_timeout', 'proxy_start_failed', 'proxy_http_failed', 'proxy_check_failed'].includes(code) ? code : 'proxy_check_failed';
}
function safeName(name: string): string {
  return /:\/\/|(?:password|token|secret|uuid)\s*[:=]/i.test(name) ? '[redacted-node]' : name.slice(0, 512);
}
