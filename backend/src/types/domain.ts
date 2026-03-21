export type AirportStatus = 'normal' | 'risk' | 'down';
export type RankingType = 'today' | 'stable' | 'value' | 'new' | 'risk';

export interface Airport {
  id: number;
  name: string;
  website: string;
  status: AirportStatus;
  plan_price_month: number;
  has_trial: boolean;
  tags: string[];
  created_at: string;
}

export interface DailyMetrics {
  airport_id: number;
  date: string;
  uptime_percent_30d: number;
  median_latency_ms: number;
  median_download_mbps: number;
  packet_loss_percent: number;
  stable_days_streak: number;
  domain_ok: boolean;
  ssl_days_left: number;
  recent_complaints_count: number;
  history_incidents: number;
}

export interface DailyMetricsInput extends DailyMetrics {}

export interface ScoreBreakdown {
  s: number;
  p: number;
  c: number;
  r: number;
  risk_penalty: number;
  score: number;
  recent_score: number;
  historical_score: number;
  final_score: number;
  details: Record<string, number>;
}

export interface AirportScoreDaily extends ScoreBreakdown {
  airport_id: number;
  date: string;
}

export interface RankingItem {
  airport_id: number;
  rank: number;
  name: string;
  status: AirportStatus;
  tags: string[];
  score: number;
  key_metrics: {
    uptime_percent_30d: number;
    median_latency_ms: number;
    median_download_mbps: number;
    packet_loss_percent: number;
  };
}

export interface ApiErrorBody {
  code: string;
  message: string;
  request_id: string;
}
