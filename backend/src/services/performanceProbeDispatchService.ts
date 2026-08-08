import { randomUUID } from 'node:crypto';

import type {
  AirportPerformanceProbeSettingsView,
  PerformanceNodePreference,
  PerformanceProbe,
  PerformanceProbeJobInput,
  SubscriptionNodeSnapshot,
  SubscriptionNodeSnapshotNode,
} from '../types/domain';
import { buildPerformanceNodeKey } from '../utils/performanceNodeKey';

interface PerformanceProbeDispatchDeps {
  airportRepository: {
    listAll(): Promise<Array<{ id: number; name?: string; status?: string; is_listed?: boolean }>>;
  };
  probeRepository: {
    list(): Promise<PerformanceProbe[]>;
  };
  settingRepository: {
    getByAirport(airportId: number): Promise<AirportPerformanceProbeSettingsView>;
  };
  snapshotRepository: {
    getLatestByAirport(airportId: number): Promise<SubscriptionNodeSnapshot | null>;
  };
  preferenceRepository: {
    getByAirport(airportId: number): Promise<PerformanceNodePreference | null>;
  };
  jobRepository: {
    create(input: PerformanceProbeJobInput): Promise<boolean>;
  };
}

export interface PerformanceProbeDispatchResult {
  created: number;
  shadow: number;
  official: number;
  failures: Array<{ airport_id: number; airport_name: string; error_code: string }>;
}

export class PerformanceProbeDispatchService {
  constructor(private readonly deps: PerformanceProbeDispatchDeps) {}

  async dispatchAll(date: string, source: string): Promise<PerformanceProbeDispatchResult> {
    const airports = await this.deps.airportRepository.listAll();
    const total = emptyResult();
    for (const airport of airports) {
      if (airport.status === 'down' || airport.is_listed === false) continue;
      try {
        const result = await this.dispatchAirport(airport.id, date, source, airport.name || `#${airport.id}`);
        mergeResult(total, result);
      } catch {
        mergeResult(total, failureResult(
          airport.id,
          airport.name || `#${airport.id}`,
          'dispatch_failed',
        ));
      }
    }
    return total;
  }

  async dispatchAirport(
    airportId: number,
    date: string,
    source: string,
    airportName = `#${airportId}`,
  ): Promise<PerformanceProbeDispatchResult> {
    const [settingsView, probes] = await Promise.all([
      this.deps.settingRepository.getByAirport(airportId),
      this.deps.probeRepository.list(),
    ]);
    const settingByProbe = new Map(settingsView.settings.map((setting) => [setting.probe_id, setting]));
    const activeProbes = probes.filter((probe) => {
      const setting = settingByProbe.get(probe.probe_id);
      return probe.probe_type === 'mainland' && probe.globally_enabled && setting?.test_enabled;
    });
    if (activeProbes.length === 0) return emptyResult();

    const [snapshot, preference] = await Promise.all([
      this.deps.snapshotRepository.getLatestByAirport(airportId),
      this.deps.preferenceRepository.getByAirport(airportId),
    ]);
    if (!snapshot) return failureResult(airportId, airportName, 'node_snapshot_missing');
    const selectedNodeKeys = resolveSelectedNodeKeys(snapshot.nodes, preference);
    if (selectedNodeKeys.length === 0) return failureResult(airportId, airportName, 'selected_nodes_empty');

    const result = emptyResult();
    for (const probe of activeProbes) {
      const setting = settingByProbe.get(probe.probe_id)!;
      const input: PerformanceProbeJobInput = {
        job_id: randomUUID(),
        airport_id: airportId,
        probe_id: probe.probe_id,
        node_snapshot_id: snapshot.id,
        config_version: settingsView.config_version,
        test_enabled_snapshot: true,
        include_in_result_snapshot: setting.include_in_result,
        test_profile: probe.test_profile,
        scoring_rule_version: probe.scoring_rule_version,
        selected_node_keys: selectedNodeKeys,
        source,
        idempotency_key: `${date}:${airportId}:${probe.probe_id}:${source}:${settingsView.config_version}`,
      };
      if (await this.deps.jobRepository.create(input)) {
        result.created += 1;
        if (setting.include_in_result) result.official += 1;
        else result.shadow += 1;
      }
    }
    return result;
  }
}

function resolveSelectedNodeKeys(
  nodes: SubscriptionNodeSnapshotNode[],
  preference: PerformanceNodePreference | null,
): string[] {
  const nodeKeys = new Map(nodes.map((node) => [buildPerformanceNodeKey(node), node]));
  const preferred = (preference?.selected_nodes || [])
    .map((node) => node.key)
    .filter((key) => nodeKeys.has(key));
  if (preferred.length > 0) return [...new Set(preferred)];

  const eligible = [...nodeKeys.entries()]
    .filter(([, node]) => !isInformationalNode(node.name))
    .sort(([left], [right]) => left.localeCompare(right));
  const byRegion = new Map<string, string[]>();
  for (const [key, node] of eligible) {
    const region = (node.region || 'OTHER').toUpperCase();
    const existing = byRegion.get(region) || [];
    existing.push(key);
    byRegion.set(region, existing);
  }
  return [...byRegion.keys()].sort().slice(0, 6).map((region) => byRegion.get(region)![0]);
}

function isInformationalNode(name: string): boolean {
  return /(官网|网站|剩余|流量|到期|套餐|公告|通知|倍率|客服|群组|更新订阅|使用说明)/i.test(name);
}

function emptyResult(): PerformanceProbeDispatchResult {
  return { created: 0, shadow: 0, official: 0, failures: [] };
}

function failureResult(airportId: number, airportName: string, errorCode: string): PerformanceProbeDispatchResult {
  return {
    ...emptyResult(),
    failures: [{ airport_id: airportId, airport_name: airportName, error_code: errorCode }],
  };
}

function mergeResult(target: PerformanceProbeDispatchResult, source: PerformanceProbeDispatchResult): void {
  target.created += source.created;
  target.shadow += source.shadow;
  target.official += source.official;
  target.failures.push(...source.failures);
}
