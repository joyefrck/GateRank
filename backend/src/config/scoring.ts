import type { RankingType } from '../types/domain';

export const SHANGHAI_TIMEZONE = 'Asia/Shanghai';

export const SCORE_WEIGHTS = {
  stability: { uptime: 0.5, stability: 0.3, streak: 0.2 },
  performance: { latency: 0.4, speed: 0.4, loss: 0.2 },
  cost: { price: 0.6, trial: 0.2, value: 0.2 },
  final: { s: 0.4, p: 0.3, c: 0.2, r: 0.1 },
  decay: { recent: 0.7, historical: 0.3 },
} as const;

export const TIME_DECAY_LAMBDA = 0.1;
export const FINAL_ENGINE_WEIGHTS = {
  s: 0.4,
  p: 0.3,
  r: 0.2,
  c: 0.1,
} as const;

export const STABILITY_RULES = {
  uptimeBaseline: 95,
  minDailyUptimePercent: 99,
  maxLatencyCv: 0.2,
  streakCapDays: 30,
} as const;

export const THRESHOLDS = {
  uptime_percent_30d: { good: 99.95, bad: 95, higherIsBetter: true },
  stability_days_streak: { good: 60, bad: 0, higherIsBetter: true },
  latency_ms: { good: 60, bad: 600, higherIsBetter: false },
  download_mbps: { good: 300, bad: 10, higherIsBetter: true },
  packet_loss_percent: { good: 0, bad: 5, higherIsBetter: false },
  price_month: { good: 10, bad: 80, higherIsBetter: false },
  value_ratio: { good: 50, bad: 0, higherIsBetter: true },
  ssl_days_left: { good: 60, bad: 3, higherIsBetter: true },
} as const;

export const LIST_LIMIT = 50;
export const NEW_AIRPORT_DAYS = 30;
export const TODAY_MAX_RISK_PENALTY = 35;

export const RANKING_TYPES: RankingType[] = ['today', 'stable', 'value', 'new', 'risk'];
