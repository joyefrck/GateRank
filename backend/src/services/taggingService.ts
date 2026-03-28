import type { Airport, DailyMetrics, ScoreBreakdown } from '../types/domain';
import { sortDisplayTags } from '../utils/tags';

const TAG_RULES = {
  longTermStable: {
    stabilityScoreMin: 80,
    stableDaysStreakMin: 14,
    riskScoreMin: 75,
  },
  beginnerFriendly: {
    displayScoreMin: 65,
    riskScoreMin: 75,
  },
  valueForMoney: {
    priceScoreMin: 75,
    performanceScoreMin: 65,
  },
  highPerformance: {
    performanceScoreMin: 80,
  },
  premium: {
    displayScoreMin: 75,
  },
  riskWatch: {
    riskScoreMaxExclusive: 70,
  },
  newcomer: {
    trackingDaysMaxExclusive: 45,
    displayScoreMin: 65,
  },
  notRecommended: {
    riskScoreMaxExclusive: 60,
    historyIncidentsSignificant: 3,
  },
} as const;

export interface GenerateAirportTagsInput {
  date: string;
  airport: Airport;
  metrics: DailyMetrics | null;
  score: ScoreBreakdown | null;
  priceMedian: number;
}

export function generateAirportTags(input: GenerateAirportTagsInput): string[] {
  const { date, airport, metrics, score, priceMedian } = input;
  if (!metrics || !score) {
    return ['不推荐'];
  }

  const riskScore = score.r;
  const stabilityScore = Number(score.details.stability_score ?? score.s);
  const priceScore = Number(score.details.price_score ?? score.c);
  const performanceScore = score.p;
  const displayScore = Number(score.details.total_score ?? score.final_score);
  const recentRiskEvents = metrics.recent_complaints_count;
  const trackingDays = getTrackingDays(airport.created_at, date);

  const isNotRecommended =
    riskScore < TAG_RULES.notRecommended.riskScoreMaxExclusive ||
    airport.status === 'down' ||
    metrics.history_incidents >= TAG_RULES.notRecommended.historyIncidentsSignificant;

  if (isNotRecommended) {
    return ['不推荐'];
  }

  const tags = new Set<string>();

  if (
    stabilityScore >= TAG_RULES.longTermStable.stabilityScoreMin &&
    metrics.stable_days_streak >= TAG_RULES.longTermStable.stableDaysStreakMin &&
    riskScore >= TAG_RULES.longTermStable.riskScoreMin
  ) {
    tags.add('长期稳定');
  }

  const reasonablePrice = Number.isFinite(priceMedian) && priceMedian > 0 ? priceMedian : airport.plan_price_month;
  if (
    displayScore >= TAG_RULES.beginnerFriendly.displayScoreMin &&
    riskScore >= TAG_RULES.beginnerFriendly.riskScoreMin &&
    (airport.has_trial || airport.plan_price_month <= reasonablePrice)
  ) {
    tags.add('新手友好');
  }

  if (
    priceScore >= TAG_RULES.valueForMoney.priceScoreMin &&
    performanceScore >= TAG_RULES.valueForMoney.performanceScoreMin
  ) {
    tags.add('性价比高');
  }

  if (performanceScore >= TAG_RULES.highPerformance.performanceScoreMin) {
    tags.add('高性能');
  }

  if (
    displayScore >= TAG_RULES.premium.displayScoreMin &&
    airport.plan_price_month > reasonablePrice
  ) {
    tags.add('高端路线');
  }

  if (
    riskScore < TAG_RULES.riskWatch.riskScoreMaxExclusive ||
    recentRiskEvents > 0
  ) {
    tags.add('风险观察');
  }

  if (
    trackingDays < TAG_RULES.newcomer.trackingDaysMaxExclusive &&
    displayScore >= TAG_RULES.newcomer.displayScoreMin
  ) {
    tags.add('新入榜');
  }

  if (tags.size === 0) {
    tags.add('观察中');
  }

  return sortTags(tags);
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
}

function getTrackingDays(createdAt: string, date: string): number {
  const start = Date.parse(`${createdAt}T00:00:00.000Z`);
  const end = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 0;
  }
  const diff = Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(0, diff);
}

function sortTags(tags: Set<string>): string[] {
  return sortDisplayTags([...tags]);
}
