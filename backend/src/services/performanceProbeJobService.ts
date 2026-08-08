import { randomUUID } from 'node:crypto';

import { PERFORMANCE_PROBE_DEFINITIONS } from '../config/performanceProbes';
import { HttpError } from '../middleware/errorHandler';
import type {
  PerformanceProbeId,
  PerformanceProbeJob,
  PerformanceRunInput,
  PerformanceRunNode,
  PerformanceRunTarget,
  SubscriptionNodeSnapshot,
} from '../types/domain';

interface PerformanceProbeJobServiceDeps {
  jobRepository: {
    leaseNext(probeId: PerformanceProbeId, leaseOwner: string, leaseSeconds: number): Promise<PerformanceProbeJob | null>;
    getById(jobId: string): Promise<PerformanceProbeJob | null>;
    markCompleted(jobId: string, probeId: PerformanceProbeId, runId: number): Promise<boolean>;
  };
  snapshotRepository: {
    getById(snapshotId: number): Promise<SubscriptionNodeSnapshot | null>;
  };
  runRepository: {
    insert(input: PerformanceRunInput): Promise<number>;
  };
  targetRepository: {
    insertMany(targets: PerformanceRunTarget[]): Promise<void>;
  };
}

export class PerformanceProbeJobService {
  constructor(private readonly deps: PerformanceProbeJobServiceDeps) {}

  async leaseNextJob(probeId: PerformanceProbeId, workerId?: string): Promise<Record<string, unknown> | null> {
    const leaseOwner = sanitizeWorkerId(workerId) || `${probeId}:${randomUUID()}`;
    const job = await this.deps.jobRepository.leaseNext(probeId, leaseOwner, 900);
    if (!job) return null;
    const snapshot = await this.deps.snapshotRepository.getById(job.node_snapshot_id);
    if (!snapshot || snapshot.airport_id !== job.airport_id) {
      throw new HttpError(409, 'PROBE_JOB_SNAPSHOT_MISSING', 'Performance probe job snapshot is unavailable');
    }
    return {
      job_id: job.job_id,
      airport_id: job.airport_id,
      probe_id: job.probe_id,
      config_version: job.config_version,
      run_mode: job.include_in_result_snapshot ? 'official' : 'shadow',
      test_profile: job.test_profile,
      scoring_rule_version: job.scoring_rule_version,
      lease_expires_at: job.lease_expires_at,
      snapshot: {
        id: snapshot.id,
        captured_at: snapshot.captured_at,
        subscription_format: snapshot.subscription_format,
        parsed_nodes_count: snapshot.parsed_nodes_count,
        supported_nodes_count: snapshot.supported_nodes_count,
        nodes: snapshot.nodes,
      },
      calibration: buildCalibrationConfig(),
      speed_targets: buildSpeedTargets(),
    };
  }

  async submitRun(
    probeId: PerformanceProbeId,
    payload: Record<string, unknown>,
  ): Promise<{ run_id: number; job_id: string; duplicate: boolean }> {
    const jobId = mustString(payload.job_id, 'job_id');
    const job = await this.deps.jobRepository.getById(jobId);
    if (!job || job.probe_id !== probeId) {
      throw new HttpError(403, 'PROBE_JOB_FORBIDDEN', 'Performance probe job does not belong to this probe');
    }
    if (job.status === 'completed' && job.run_id !== null) {
      return { run_id: job.run_id, job_id: job.job_id, duplicate: true };
    }
    if (job.status !== 'leased') {
      throw new HttpError(409, 'PROBE_JOB_NOT_LEASED', 'Performance probe job is not leased');
    }

    const definition = PERFORMANCE_PROBE_DEFINITIONS.find((item) => item.probe_id === probeId);
    if (!definition) throw new HttpError(400, 'PROBE_UNKNOWN', 'Unknown performance probe');
    const calibrationStatus = calibrationStatusValue(payload.calibration_status);
    const calibrationMbps = optionalNumber(payload.calibration_mbps);
    if (calibrationStatus === 'passed' && calibrationMbps === null) {
      throw new HttpError(400, 'PROBE_RUN_INVALID', 'calibration_mbps is required for a passed calibration');
    }

    const input: PerformanceRunInput = {
      airport_id: job.airport_id,
      sampled_at: mustString(payload.sampled_at, 'sampled_at'),
      source: job.source,
      status: performanceStatusValue(payload.status),
      job_id: job.job_id,
      probe_id: job.probe_id,
      region_code: definition.region_code,
      provider: definition.provider,
      bandwidth_mbps: definition.bandwidth_mbps,
      run_mode: job.include_in_result_snapshot ? 'official' : 'shadow',
      test_profile: job.test_profile,
      scoring_rule_version: job.scoring_rule_version,
      config_version: job.config_version,
      calibration_status: calibrationStatus,
      calibration_mbps: calibrationMbps,
      subscription_format: optionalString(payload.subscription_format),
      parsed_nodes_count: optionalNumber(payload.parsed_nodes_count) || 0,
      supported_nodes_count: optionalNumber(payload.supported_nodes_count) || 0,
      selected_nodes: performanceNodes(payload.selected_nodes),
      tested_nodes: performanceNodes(payload.tested_nodes),
      available_nodes_count: optionalNumber(payload.available_nodes_count),
      unavailable_nodes_count: optionalNumber(payload.unavailable_nodes_count),
      node_availability_percent: optionalNumber(payload.node_availability_percent),
      node_unavailability_percent: optionalNumber(payload.node_unavailability_percent),
      latency_samples_ms: numberArray(payload.latency_samples_ms),
      latency_sampled_at: stringArray(payload.latency_sampled_at),
      download_samples_mbps: numberArray(payload.download_samples_mbps),
      packet_loss_percent: optionalNumber(payload.packet_loss_percent) ?? undefined,
      median_latency_ms: optionalNumber(payload.median_latency_ms),
      median_download_mbps: optionalNumber(payload.median_download_mbps),
      error_code: optionalString(payload.error_code),
      error_message: optionalString(payload.error_message),
      diagnostics: objectValue(payload.diagnostics),
    };
    const runId = await this.deps.runRepository.insert(input);
    const targets = targetRows(payload.target_results, runId);
    await this.deps.targetRepository.insertMany(targets);
    await this.deps.jobRepository.markCompleted(job.job_id, probeId, runId);
    return { run_id: runId, job_id: job.job_id, duplicate: false };
  }
}

function buildCalibrationConfig(): Record<string, unknown> {
  return {
    target_key: 'mainland-calibration',
    url: process.env.PERFORMANCE_PROBE_CALIBRATION_URL || null,
    minimum_mbps: 160,
  };
}

function buildSpeedTargets(): Array<{ target_key: string; url: string }> {
  const raw = process.env.PERFORMANCE_PROBE_SPEED_TARGETS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const row = item as Record<string, unknown>;
      const targetKey = optionalString(row.target_key);
      const url = optionalString(row.url);
      return targetKey && url ? [{ target_key: targetKey, url }] : [];
    });
  } catch {
    return [];
  }
}

function targetRows(value: unknown, runId: number): PerformanceRunTarget[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new HttpError(400, 'PROBE_RUN_INVALID', 'target_results must be an array');
  return value.map((item, index) => {
    const row = objectValue(item);
    return {
      run_id: runId,
      node_key: mustString(row.node_key, `target_results[${index}].node_key`),
      target_key: mustString(row.target_key, `target_results[${index}].target_key`),
      bytes_downloaded: requiredNumber(row.bytes_downloaded, `target_results[${index}].bytes_downloaded`),
      duration_ms: requiredNumber(row.duration_ms, `target_results[${index}].duration_ms`),
      download_mbps: optionalNumber(row.download_mbps),
      http_status: optionalNumber(row.http_status),
      error_code: optionalString(row.error_code),
      valid: Boolean(row.valid),
    };
  });
}

function performanceNodes(value: unknown): PerformanceRunNode[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const row = objectValue(item);
    const name = optionalString(row.name);
    if (!name) return [];
    return [{
      name,
      region: optionalString(row.region),
      type: optionalString(row.type),
      status: optionalString(row.status),
      error_code: optionalString(row.error_code),
      connect_latency_samples_ms: numberArray(row.connect_latency_samples_ms),
      connect_latency_median_ms: optionalNumber(row.connect_latency_median_ms),
      proxy_http_latency_samples_ms: numberArray(row.proxy_http_latency_samples_ms),
      proxy_http_latency_median_ms: optionalNumber(row.proxy_http_latency_median_ms),
      proxy_http_request_failures: optionalNumber(row.proxy_http_request_failures),
      proxy_http_request_attempts: optionalNumber(row.proxy_http_request_attempts),
      proxy_http_request_failure_percent: optionalNumber(row.proxy_http_request_failure_percent),
      connect_failures: optionalNumber(row.connect_failures),
      connect_attempts: optionalNumber(row.connect_attempts),
      download_mbps: optionalNumber(row.download_mbps),
    }];
  });
}

function performanceStatusValue(value: unknown): PerformanceRunInput['status'] {
  if (value === 'success' || value === 'partial' || value === 'skipped' || value === 'failed') return value;
  throw new HttpError(400, 'PROBE_RUN_INVALID', 'status must be success|partial|skipped|failed');
}

function calibrationStatusValue(value: unknown): PerformanceRunInput['calibration_status'] {
  if (value === 'passed' || value === 'failed' || value === 'not_required') return value;
  throw new HttpError(400, 'PROBE_RUN_INVALID', 'calibration_status must be passed|failed|not_required');
}

function sanitizeWorkerId(value: string | undefined): string {
  return (value || '').replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 128);
}

function mustString(value: unknown, field: string): string {
  const normalized = optionalString(value);
  if (!normalized) throw new HttpError(400, 'PROBE_RUN_INVALID', `${field} is required`);
  return normalized;
}

function optionalString(value: unknown): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function requiredNumber(value: unknown, field: string): number {
  const parsed = optionalNumber(value);
  if (parsed === null) throw new HttpError(400, 'PROBE_RUN_INVALID', `${field} must be a finite number`);
  return parsed;
}

function optionalNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function numberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(optionalNumber).filter((item): item is number => item !== null);
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(optionalString).filter((item): item is string => item !== null);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
