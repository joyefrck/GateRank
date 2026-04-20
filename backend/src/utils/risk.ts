import type { DailyMetrics, ScoreBreakdown, ScoreDetailValue } from '../types/domain';

export type RiskReasonCode =
  | 'domain_unreachable'
  | 'ssl_warning'
  | 'recent_complaints'
  | 'history_incidents'
  | 'low_r_score';

type RiskMetricsLike = Pick<
  DailyMetrics,
  'domain_ok' | 'ssl_days_left' | 'recent_complaints_count' | 'history_incidents'
>;

type RiskScoreLike = Pick<ScoreBreakdown, 'r' | 'details'>;

interface DeriveRiskReasonOptions {
  metrics?: Partial<RiskMetricsLike> | null;
  score?: Partial<RiskScoreLike> | null;
}

const RISK_REASON_LABELS: Record<RiskReasonCode, string> = {
  domain_unreachable: '官网失联',
  ssl_warning: 'SSL 告警',
  recent_complaints: '近期投诉记录',
  history_incidents: '历史异常记录',
  low_r_score: '风险分偏低',
};

export function deriveRiskReasonCodes(options: DeriveRiskReasonOptions): RiskReasonCode[] {
  const metrics = options.metrics || {};
  const score = options.score || {};
  const reasons: RiskReasonCode[] = [];

  if (metrics.domain_ok === false) {
    reasons.push('domain_unreachable');
  }

  if (
    getPenalty(score.details, 'ssl_penalty') > 0 ||
    hasSslWarning(metrics.ssl_days_left)
  ) {
    reasons.push('ssl_warning');
  }

  if (
    Number(metrics.recent_complaints_count || 0) > 0 ||
    getPenalty(score.details, 'complaint_penalty') > 0
  ) {
    reasons.push('recent_complaints');
  }

  if (
    Number(metrics.history_incidents || 0) > 0 ||
    getPenalty(score.details, 'history_penalty') > 0
  ) {
    reasons.push('history_incidents');
  }

  if (reasons.length === 0 && typeof score.r === 'number' && Number.isFinite(score.r) && score.r < 70) {
    reasons.push('low_r_score');
  }

  return reasons;
}

export function hasActiveRiskReasons(options: DeriveRiskReasonOptions): boolean {
  return deriveRiskReasonCodes(options).length > 0;
}

export function buildRiskReasonSummary(options: DeriveRiskReasonOptions): string {
  const metrics = options.metrics || {};
  const reasons = deriveRiskReasonCodes(options);
  if (reasons.length === 0) {
    return '当前未发现仍在生效的风险原因。';
  }

  const labels = reasons.map((reason) => formatRiskReasonLabel(reason, metrics));
  const joined = joinLabels(labels);

  if (reasons.includes('domain_unreachable')) {
    if (reasons.length === 1) {
      return '官网当前不可访问，当前风险主要来自官网失联。';
    }
    return `官网当前不可访问，且仍存在${joinedWithout(labels, '官网失联')}。`;
  }

  if (metrics.domain_ok === true) {
    return `官网已恢复访问，当前风险主要来自${joined}。`;
  }

  return `当前风险主要来自${joined}。`;
}

function formatRiskReasonLabel(
  reason: RiskReasonCode,
  metrics: Partial<RiskMetricsLike>,
): string {
  if (reason === 'recent_complaints') {
    const count = Number(metrics.recent_complaints_count || 0);
    return count > 0 ? `近期投诉 ${count} 条` : RISK_REASON_LABELS[reason];
  }
  if (reason === 'history_incidents') {
    const count = Number(metrics.history_incidents || 0);
    return count > 0 ? `历史异常 ${count} 次` : RISK_REASON_LABELS[reason];
  }
  return RISK_REASON_LABELS[reason];
}

function getPenalty(
  details: Record<string, ScoreDetailValue> | null | undefined,
  key: 'ssl_penalty' | 'complaint_penalty' | 'history_penalty',
): number {
  const value = details?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function hasSslWarning(sslDaysLeft: number | null | undefined): boolean {
  if (sslDaysLeft === null) {
    return true;
  }
  if (sslDaysLeft === undefined) {
    return false;
  }
  return sslDaysLeft < 30;
}

function joinLabels(labels: string[]): string {
  if (labels.length === 0) {
    return '';
  }
  if (labels.length === 1) {
    return labels[0];
  }
  if (labels.length === 2) {
    return `${labels[0]}与${labels[1]}`;
  }
  return `${labels.slice(0, -1).join('、')}与${labels[labels.length - 1]}`;
}

function joinedWithout(labels: string[], labelToExclude: string): string {
  return joinLabels(labels.filter((label) => label !== labelToExclude));
}
