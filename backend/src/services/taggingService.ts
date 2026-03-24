import type { Airport, DailyMetrics, ScoreBreakdown } from '../types/domain';

const TAG_ORDER = [
  '不推荐',
  '风险观察',
  '新入榜',
  '长期稳定',
  '新手友好',
  '性价比高',
  '高性能',
  '高端路线',
] as const;

const TAG_RULES = {
  longTermStable: {
    stabilityScoreMin: 85,
    stableDaysStreakMin: 30,
    riskScoreMin: 80,
  },
  beginnerFriendly: {
    finalScoreMin: 80,
    riskScoreMin: 80,
  },
  valueForMoney: {
    priceScoreMin: 80,
    performanceScoreMin: 70,
  },
  highPerformance: {
    performanceScoreMin: 85,
  },
  premium: {
    finalScoreMin: 85,
  },
  riskWatch: {
    riskScoreMaxExclusive: 70,
  },
  newcomer: {
    trackingDaysMaxExclusive: 30,
    recentScoreMin: 80,
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
  const finalScore = score.final_score;
  const recentScore = score.recent_score;
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
    finalScore >= TAG_RULES.beginnerFriendly.finalScoreMin &&
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
    finalScore >= TAG_RULES.premium.finalScoreMin &&
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
    recentScore >= TAG_RULES.newcomer.recentScoreMin
  ) {
    tags.add('新入榜');
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
  return [...tags].sort((a, b) => tagIndex(a) - tagIndex(b));
}

function tagIndex(tag: string): number {
  const idx = TAG_ORDER.indexOf(tag as (typeof TAG_ORDER)[number]);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}
