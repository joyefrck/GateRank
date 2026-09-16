import type { Airport, DailyMetrics, ScoreBreakdown } from '../types/domain';
import { effectiveComponent } from '../services/scoreComponents';
import { hasActiveRiskReasons } from './risk';

export type HomeSummarySection = 'most_stable' | 'best_value';

export interface HomeSummaryCandidate {
  airport: Pick<Airport, 'is_listed' | 'status' | 'tags'>;
  metrics: Pick<DailyMetrics, 'stable_days_streak' | 'domain_ok' | 'ssl_days_left' | 'recent_complaints_count' | 'history_incidents'>;
  score: Pick<ScoreBreakdown, 's' | 'p' | 'c' | 'r' | 'details'>;
}

/** Same stability/price detail scale as the existing airport tag rules. */
export function isHomeSummaryEligible(candidate: HomeSummaryCandidate, section: HomeSummarySection): boolean {
  const { airport, metrics, score } = candidate;
  const stability = score.details.stability_score ?? effectiveComponent(score, 's');
  const price = score.details.price_score ?? effectiveComponent(score, 'c');
  const risk = effectiveComponent(score, 'r');
  const performance = effectiveComponent(score, 'p');
  const atLeast = (value: unknown, minimum: number) => typeof value === 'number' && Number.isFinite(value) && value >= minimum;
  if (!airport.is_listed || airport.status !== 'normal' ||
      airport.tags.some(tag => tag === '风险观察' || tag === '不推荐') ||
      !atLeast(stability, 80) || !atLeast(metrics.stable_days_streak, 14) || !atLeast(risk, 75) ||
      hasActiveRiskReasons({ metrics, score: { ...score, r: risk } })) return false;
  return section === 'most_stable' || (atLeast(price, 75) && atLeast(performance, 65));
}
