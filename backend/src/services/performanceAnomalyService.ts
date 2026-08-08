import type {
  PerformanceReviewStatus,
  PerformanceRun,
  PerformanceRunTarget,
} from '../types/domain';
import { dateDaysAgo } from '../utils/time';

export type PerformanceReviewReason =
  | 'target_ratio_over_3x'
  | 'region_ratio_over_3x'
  | 'legacy_mainland_ratio_over_3x'
  | 'cohort_target_degraded';

export type PerformanceEvidenceFlag = 'probe_ceiling' | 'calibration_failed';

export interface PerformanceEvidenceAssessment {
  status: PerformanceReviewStatus;
  reasons: PerformanceReviewReason[];
  flags: PerformanceEvidenceFlag[];
}

export interface PerformanceEvidenceInput {
  run: PerformanceRun;
  targets: PerformanceRunTarget[];
  sameDateRuns: PerformanceRun[];
  previousReasons: string[];
  degradedTargetKeys: string[];
}

interface PerformanceAnomalyServiceDeps {
  runRepository: {
    getById(runId: number): Promise<PerformanceRun | null>;
    listByAirportAndDate(airportId: number, date: string): Promise<PerformanceRun[]>;
    markReviewStatus(runId: number, status: PerformanceReviewStatus, reasons: string[]): Promise<void>;
  };
  targetRepository: {
    listByRun(runId: number): Promise<PerformanceRunTarget[]>;
    listByDate(date: string): Promise<Array<PerformanceRunTarget & { airport_id: number }>>;
  };
  metricsRepository: {
    patchPerformanceReviewStatus(
      airportId: number,
      date: string,
      status: PerformanceReviewStatus,
    ): Promise<void>;
  };
}

export class PerformanceAnomalyService {
  constructor(private readonly deps: PerformanceAnomalyServiceDeps) {}

  async assessRun(runId: number): Promise<PerformanceEvidenceAssessment | null> {
    const run = await this.deps.runRepository.getById(runId);
    if (!run) return null;
    const date = run.sampled_date || run.sampled_at.slice(0, 10);
    const [targets, sameDateRuns, previousRuns, cohortTargets] = await Promise.all([
      this.deps.targetRepository.listByRun(runId),
      this.deps.runRepository.listByAirportAndDate(run.airport_id, date),
      this.deps.runRepository.listByAirportAndDate(run.airport_id, dateDaysAgo(date, 1)),
      this.deps.targetRepository.listByDate(date),
    ]);
    const assessment = assessPerformanceEvidence({
      run,
      targets,
      sameDateRuns,
      previousReasons: previousRuns.flatMap((item) => item.review_reasons || []),
      degradedTargetKeys: findCohortDegradedTargetKeys(cohortTargets),
    });
    await this.deps.runRepository.markReviewStatus(runId, assessment.status, assessment.reasons);
    const dailyStatus = highestReviewStatus([
      assessment.status,
      ...sameDateRuns.map((item) => item.review_status || 'normal'),
    ]);
    await this.deps.metricsRepository.patchPerformanceReviewStatus(run.airport_id, date, dailyStatus);
    return assessment;
  }
}

const AIRPORT_EVIDENCE_REASONS = new Set<PerformanceReviewReason>([
  'target_ratio_over_3x',
  'region_ratio_over_3x',
  'legacy_mainland_ratio_over_3x',
]);

export function assessPerformanceEvidence(input: PerformanceEvidenceInput): PerformanceEvidenceAssessment {
  if (input.run.probe_id !== 'legacy-control' && input.run.calibration_status === 'failed') {
    return { status: 'normal', reasons: [], flags: ['calibration_failed'] };
  }

  const reasons = new Set<PerformanceReviewReason>();
  const flags = new Set<PerformanceEvidenceFlag>();
  if (
    input.run.probe_id !== 'legacy-control'
    && finiteNumber(input.run.median_download_mbps) !== null
    && Number(input.run.median_download_mbps) >= 180
  ) {
    flags.add('probe_ceiling');
  }

  assessTargetRatios(input.targets, new Set(input.degradedTargetKeys), reasons);
  assessRegionRatio([input.run, ...input.sameDateRuns], reasons);
  assessLegacyMainlandRatio([input.run, ...input.sameDateRuns], reasons);

  const sortedReasons = [...reasons].sort();
  const airportReasons = sortedReasons.filter((reason) => AIRPORT_EVIDENCE_REASONS.has(reason));
  const repeatedReason = airportReasons.some((reason) => input.previousReasons.includes(reason));
  const status: PerformanceReviewStatus = airportReasons.length >= 2 || repeatedReason
    ? 'suspicious'
    : airportReasons.length === 1 ? 'needs_review' : 'normal';
  return {
    status,
    reasons: sortedReasons,
    flags: [...flags].sort(),
  };
}

function assessTargetRatios(
  targets: PerformanceRunTarget[],
  degradedTargetKeys: Set<string>,
  reasons: Set<PerformanceReviewReason>,
): void {
  const byNode = new Map<string, PerformanceRunTarget[]>();
  for (const target of targets) {
    if (!target.valid || finiteNumber(target.download_mbps) === null) continue;
    const list = byNode.get(target.node_key) || [];
    list.push(target);
    byNode.set(target.node_key, list);
  }
  for (const nodeTargets of byNode.values()) {
    if (nodeTargets.length < 2) continue;
    const sorted = nodeTargets.slice().sort((left, right) => Number(left.download_mbps) - Number(right.download_mbps));
    const slowest = sorted[0];
    const fastest = sorted[sorted.length - 1];
    const low = Number(slowest.download_mbps);
    const high = Number(fastest.download_mbps);
    if (high <= 100 || low <= 0 || high / low <= 3) continue;
    if (degradedTargetKeys.has(slowest.target_key)) {
      reasons.add('cohort_target_degraded');
    } else {
      reasons.add('target_ratio_over_3x');
    }
  }
}

function assessRegionRatio(runs: PerformanceRun[], reasons: Set<PerformanceReviewReason>): void {
  const shanghai = latestRun(runs, 'cn-shanghai');
  const guangzhou = latestRun(runs, 'cn-guangzhou');
  if (!shanghai || !guangzhou) return;
  const shanghaiNodes = nodeDownloads(shanghai);
  const guangzhouNodes = nodeDownloads(guangzhou);
  for (const [nodeName, shanghaiMbps] of shanghaiNodes) {
    const guangzhouMbps = guangzhouNodes.get(nodeName);
    if (guangzhouMbps === undefined) continue;
    if (ratioQualifies(shanghaiMbps, guangzhouMbps, 100)) {
      reasons.add('region_ratio_over_3x');
      return;
    }
  }
}

function assessLegacyMainlandRatio(runs: PerformanceRun[], reasons: Set<PerformanceReviewReason>): void {
  const legacy = latestRun(runs, 'legacy-control');
  if (!legacy) return;
  const legacyMbps = finiteNumber(legacy.median_download_mbps);
  const mainlandValues = ['cn-shanghai', 'cn-guangzhou']
    .map((probeId) => latestRun(runs, probeId as 'cn-shanghai' | 'cn-guangzhou'))
    .map((run) => finiteNumber(run?.median_download_mbps))
    .filter((value): value is number => value !== null);
  if (legacyMbps === null || mainlandValues.length === 0) return;
  const mainlandMbps = median(mainlandValues);
  if (legacyMbps > 300 && mainlandMbps > 0 && legacyMbps / mainlandMbps > 3) {
    reasons.add('legacy_mainland_ratio_over_3x');
  }
}

function latestRun(
  runs: PerformanceRun[],
  probeId: 'legacy-control' | 'cn-shanghai' | 'cn-guangzhou',
): PerformanceRun | null {
  return runs
    .filter((run) => run.probe_id === probeId && run.status === 'success')
    .sort((left, right) => right.sampled_at.localeCompare(left.sampled_at))[0] || null;
}

function nodeDownloads(run: PerformanceRun): Map<string, number> {
  const values = new Map<string, number>();
  for (const node of run.tested_nodes) {
    const mbps = finiteNumber(node.download_mbps);
    const name = node.name.trim().toLowerCase();
    if (name && mbps !== null) values.set(name, mbps);
  }
  return values;
}

function ratioQualifies(left: number, right: number, highThreshold: number): boolean {
  const high = Math.max(left, right);
  const low = Math.min(left, right);
  return high > highThreshold && low > 0 && high / low > 3;
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return value !== null && value !== undefined && Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function median(values: number[]): number {
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function findCohortDegradedTargetKeys(
  targets: Array<PerformanceRunTarget & { airport_id: number }>,
): string[] {
  const byNode = new Map<string, Array<PerformanceRunTarget & { airport_id: number }>>();
  for (const target of targets) {
    if (!target.valid || finiteNumber(target.download_mbps) === null) continue;
    const key = `${target.airport_id}:${target.run_id}:${target.node_key}`;
    const list = byNode.get(key) || [];
    list.push(target);
    byNode.set(key, list);
  }
  const degradedAirports = new Map<string, Set<number>>();
  for (const nodeTargets of byNode.values()) {
    if (nodeTargets.length < 2) continue;
    const sorted = nodeTargets.slice().sort((left, right) => Number(left.download_mbps) - Number(right.download_mbps));
    const slowest = sorted[0];
    const fastest = sorted[sorted.length - 1];
    if (!ratioQualifies(Number(slowest.download_mbps), Number(fastest.download_mbps), 100)) continue;
    const airports = degradedAirports.get(slowest.target_key) || new Set<number>();
    airports.add(slowest.airport_id);
    degradedAirports.set(slowest.target_key, airports);
  }
  return [...degradedAirports.entries()]
    .filter(([, airports]) => airports.size >= 3)
    .map(([targetKey]) => targetKey)
    .sort();
}

function highestReviewStatus(statuses: PerformanceReviewStatus[]): PerformanceReviewStatus {
  if (statuses.includes('suspicious')) return 'suspicious';
  if (statuses.includes('needs_review')) return 'needs_review';
  return 'normal';
}
