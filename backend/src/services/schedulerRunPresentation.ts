import type {
  SchedulerRun,
  SchedulerRunFailureDetail,
  SchedulerRunOutcome,
  SchedulerRunResultSummary,
  SchedulerRunView,
} from '../types/domain';

interface BatchCounts {
  total: number;
  success: number;
  failure: number;
  skipped: number;
}

export function presentSchedulerRun(run: SchedulerRun): SchedulerRunView {
  const resultSummary = buildResultSummary(run);
  return {
    ...run,
    outcome: resolveOutcome(run, resultSummary),
    result_summary: resultSummary,
  };
}

function buildResultSummary(run: SchedulerRun): SchedulerRunResultSummary | null {
  const counts = extractCounts(run);
  if (!counts || !validCounts(counts)) {
    return null;
  }
  const failures = extractFailures(run);
  return {
    total_count: counts.total,
    success_count: counts.success,
    failure_count: counts.failure,
    skipped_count: counts.skipped,
    failures: failures.slice(0, counts.failure),
    missing_failure_detail_count: Math.max(0, counts.failure - failures.length),
  };
}

function extractCounts(run: SchedulerRun): BatchCounts | null {
  const detail = run.detail_json || {};
  if (run.task_key === 'stability' || run.task_key === 'performance' || run.task_key === 'network_coverage') {
    const structured = toCounts(
      detail.airport_count,
      detail.success_count,
      detail.failure_count,
      0,
    );
    return structured || parseRatioCounts(readSummary(run));
  }
  if (run.task_key === 'subscription_node_refresh') {
    return toCounts(
      detail.airport_count,
      detail.success_count,
      detail.failure_count,
      detail.skipped_count ?? 0,
    );
  }
  if (run.task_key === 'risk') {
    const structured = toCounts(
      detail.total_count,
      detail.success_count,
      detail.failure_count,
      0,
    );
    return structured || parseSimpleCounts(readSummary(run));
  }
  if (run.task_key === 'stability_resample_guard') {
    const failures = Array.isArray(detail.failures) ? detail.failures.length : null;
    return toCounts(
      detail.flagged_count,
      detail.retested_count,
      detail.failure_count ?? failures,
      0,
    );
  }
  return null;
}

function extractFailures(run: SchedulerRun): SchedulerRunFailureDetail[] {
  const detail = run.detail_json || {};
  const structured = Array.isArray(detail.failures)
    ? detail.failures.map(toFailureDetail).filter((item): item is SchedulerRunFailureDetail => item !== null)
    : [];
  const legacy = parseLegacyFailure(readSummary(run));
  if (!legacy || structured.some((item) => item.airport_id === legacy.airport_id && item.error === legacy.error)) {
    return structured;
  }
  if (structured.some((item) => item.airport_id === legacy.airport_id)) {
    return structured;
  }
  return [...structured, legacy];
}

function toFailureDetail(value: unknown): SchedulerRunFailureDetail | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const airportId = toOptionalNonNegativeInteger(row.airport_id);
  const rawError = String(row.error || '').trim();
  if (!rawError) {
    return null;
  }
  const parsed = parseLegacyFailure(rawError);
  return {
    airport_id: airportId ?? parsed?.airport_id ?? null,
    airport_name: nonEmptyString(row.airport_name) || parsed?.airport_name || null,
    error: sanitizeSchedulerDetail(parsed?.error || rawError),
  };
}

function parseRatioCounts(value: string): BatchCounts | null {
  const match = value.match(/(\d+)\s*\/\s*(\d+)\s+succeeded,\s*(\d+)\s+failed/i);
  if (!match) {
    return null;
  }
  return toCounts(match[2], match[1], match[3], 0);
}

function parseSimpleCounts(value: string): BatchCounts | null {
  const match = value.match(/(\d+)\s+succeeded,\s*(\d+)\s+failed/i);
  if (!match) {
    return null;
  }
  const success = Number(match[1]);
  const failure = Number(match[2]);
  return toCounts(success + failure, success, failure, 0);
}

function parseLegacyFailure(value: string): SchedulerRunFailureDetail | null {
  const segment = value.includes(';') ? value.slice(value.lastIndexOf(';') + 1).trim() : value.trim();
  const match = segment.match(/^(.+?)\s+#(\d+):\s*(.+)$/);
  if (!match) {
    return null;
  }
  return {
    airport_id: Number(match[2]),
    airport_name: match[1].trim() || null,
    error: sanitizeSchedulerDetail(match[3]),
  };
}

function resolveOutcome(run: SchedulerRun, summary: SchedulerRunResultSummary | null): SchedulerRunOutcome {
  if (run.status === 'running') {
    return 'running';
  }
  if (!summary) {
    return run.status;
  }
  if (summary.success_count > 0 && summary.failure_count > 0) {
    return 'partial';
  }
  if (summary.success_count > 0 && summary.failure_count === 0) {
    return 'succeeded';
  }
  if (summary.success_count === 0 && summary.failure_count > 0) {
    return 'failed';
  }
  return run.status;
}

function readSummary(run: SchedulerRun): string {
  const summary = run.detail_json?.summary;
  return typeof summary === 'string' && summary.trim() ? summary : run.message || '';
}

function toCounts(total: unknown, success: unknown, failure: unknown, skipped: unknown): BatchCounts | null {
  const values = [total, success, failure, skipped].map(toNonNegativeInteger);
  if (values.some((value) => value === null)) {
    return null;
  }
  return {
    total: values[0] as number,
    success: values[1] as number,
    failure: values[2] as number,
    skipped: values[3] as number,
  };
}

function validCounts(counts: BatchCounts): boolean {
  return counts.total === counts.success + counts.failure + counts.skipped;
}

function toNonNegativeInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function toOptionalNonNegativeInteger(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return toNonNegativeInteger(value);
}

function nonEmptyString(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function sanitizeSchedulerDetail(value: string): string {
  return value.replace(/https?:\/\/[^\s"']+/gi, '[redacted-url]').slice(0, 500);
}
