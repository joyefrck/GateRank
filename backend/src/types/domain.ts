export type AirportStatus = 'normal' | 'risk' | 'down';
export type StabilityTier = 'stable' | 'minor_fluctuation' | 'volatile';
export type AirportApplicationReviewStatus = 'awaiting_payment' | 'pending' | 'reviewed' | 'rejected';
export type RankingType = 'today' | 'stable' | 'value' | 'new' | 'risk';
export type ProbeSampleType = 'latency' | 'download' | 'availability';
export type ProbeScope = 'stability' | 'performance';
export type PerformanceRunStatus = 'success' | 'partial' | 'skipped' | 'failed';
export type ManualJobKind = 'full' | 'stability' | 'performance' | 'risk' | 'time_decay';
export type ManualJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type NewsStatus = 'draft' | 'published' | 'archived';
export type SchedulerTaskKey = 'stability' | 'performance' | 'risk' | 'aggregate_recompute';
export type SchedulerRunStatus = 'running' | 'succeeded' | 'failed';
export type SchedulerTriggerSource = 'schedule' | 'restart' | 'bootstrap_recover';

export interface Airport {
  id: number;
  name: string;
  website: string;
  websites?: string[];
  status: AirportStatus;
  plan_price_month: number;
  has_trial: boolean;
  subscription_url?: string | null;
  applicant_email?: string | null;
  applicant_telegram?: string | null;
  founded_on?: string | null;
  airport_intro?: string | null;
  test_account?: string | null;
  test_password?: string | null;
  tags: string[];
  manual_tags?: string[];
  auto_tags?: string[];
  total_score?: number | null;
  created_at: string;
}

export interface AirportApplication {
  id: number;
  name: string;
  website: string;
  websites: string[];
  status: AirportStatus;
  plan_price_month: number;
  has_trial: boolean;
  subscription_url?: string | null;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
  approved_airport_id?: number | null;
  review_status: AirportApplicationReviewStatus;
  payment_status: 'unpaid' | 'paid';
  payment_amount: number | null;
  paid_at?: string | null;
  must_change_password?: boolean | null;
  review_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyMetrics {
  airport_id: number;
  date: string;
  uptime_percent_30d: number;
  uptime_percent_today?: number | null;
  latency_samples_ms?: number[];
  latency_mean_ms?: number | null;
  latency_std_ms?: number | null;
  latency_cv?: number | null;
  download_samples_mbps?: number[];
  median_latency_ms: number;
  median_download_mbps: number;
  packet_loss_percent: number;
  stable_days_streak: number;
  healthy_days_streak?: number | null;
  is_stable_day?: boolean | null;
  stability_tier?: StabilityTier | null;
  domain_ok: boolean;
  ssl_days_left: number | null;
  recent_complaints_count: number;
  history_incidents: number;
}

export interface DailyMetricsInput extends DailyMetrics {}

export type ScoreDetailValue = number | string | boolean | null;

export interface TimeSeriesScorePoint {
  date: string;
  score: number;
}

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
  details: Record<string, ScoreDetailValue>;
}

export interface SchedulerTask {
  task_key: SchedulerTaskKey;
  name: string;
  enabled: boolean;
  schedule_time: string;
  timezone: string;
  last_restarted_at: string | null;
  last_restarted_by: string | null;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface SchedulerRun {
  id: number;
  task_key: SchedulerTaskKey;
  run_date: string;
  trigger_source: SchedulerTriggerSource;
  status: SchedulerRunStatus;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  message: string | null;
  detail_json: Record<string, unknown> | null;
  created_at: string;
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

export interface PublicCardDetail {
  label: string;
  value: string;
}

export type PublicCardType = 'stable' | 'value' | 'risk' | 'new';

export interface ScoreDeltaView {
  label: string;
  value: number | null;
}

export interface PublicCardItem {
  type: PublicCardType;
  airport_id: number;
  name: string;
  website: string;
  tags: string[];
  score: number;
  score_delta_vs_yesterday: ScoreDeltaView;
  stability_tier: StabilityTier;
  details: [PublicCardDetail, PublicCardDetail];
  conclusion: string;
  report_url: string;
}

export interface HomeSectionView {
  title: string;
  subtitle: string;
  items: PublicCardItem[];
}

export interface HomePageView {
  requested_date: string;
  date: string;
  resolved_from_fallback: boolean;
  fallback_notice: string | null;
  generated_at: string;
  hero: {
    report_time_at: string | null;
    report_time_text: string;
    monitored_airports: number;
    realtime_tests: number;
  };
  sections: {
    today_pick: HomeSectionView;
    most_stable: HomeSectionView;
    best_value: HomeSectionView;
    new_entries: HomeSectionView;
    risk_alerts: HomeSectionView;
  };
}

export interface FullRankingItem {
  airport_id: number;
  rank: number;
  name: string;
  website: string;
  status: AirportStatus;
  tags: string[];
  founded_on?: string | null;
  plan_price_month: number;
  has_trial: boolean;
  airport_intro?: string | null;
  created_at: string;
  score: number | null;
  score_delta_vs_yesterday: ScoreDeltaView;
  score_date?: string | null;
  report_url?: string | null;
}

export interface FullRankingView {
  date: string;
  generated_at: string;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: FullRankingItem[];
}

export interface RiskMonitorItem extends FullRankingItem {
  monitor_reason: 'down' | 'risk_watch';
  risk_penalty: number | null;
}

export interface RiskMonitorView {
  date: string;
  generated_at: string;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: RiskMonitorItem[];
}

export interface ReportView {
  requested_date: string;
  date: string;
  resolved_from_fallback: boolean;
  fallback_notice: string | null;
  airport: Pick<Airport, 'id' | 'name' | 'website' | 'status' | 'tags'>;
  summary_card: Omit<PublicCardItem, 'airport_id' | 'report_url' | 'website' | 'score_delta_vs_yesterday'>;
  ranking: {
    today_pick_rank: number | null;
    most_stable_rank: number | null;
    best_value_rank: number | null;
    new_entries_rank: number | null;
    risk_alerts_rank: number | null;
  };
  score_breakdown: {
    s: number;
    p: number;
    c: number;
    r: number;
    final_score: number;
    risk_penalty: number;
  };
  metrics: {
    uptime_percent_30d: number;
    median_latency_ms: number;
    median_download_mbps: number;
    packet_loss_percent: number;
    stable_days_streak: number;
    healthy_days_streak: number;
    stability_tier: StabilityTier;
    recent_complaints_count: number;
    history_incidents: number;
  };
  trends: {
    score_30d: Array<{ date: string; value: number }>;
    uptime_30d: Array<{ date: string; value: number }>;
    latency_30d: Array<{ date: string; value: number }>;
    download_30d: Array<{ date: string; value: number }>;
  };
}

export type MarketingEventType = 'page_view' | 'airport_impression' | 'outbound_click';
export type MarketingGranularity = 'hour' | 'day' | 'week' | 'month';
export type MarketingSourceType =
  | 'google'
  | 'baidu'
  | 'x'
  | 'bing'
  | 'reddit'
  | 'telegram'
  | 'wechat'
  | 'direct_or_unknown'
  | 'other_referral';
export type MarketingPageKind =
  | 'home'
  | 'full_ranking'
  | 'risk_monitor'
  | 'report'
  | 'methodology'
  | 'news'
  | 'apply'
  | 'publish_token_docs';
export type MarketingPlacement = 'home_card' | 'full_ranking_item' | 'risk_monitor_item' | 'report_header';
export type MarketingTargetKind = 'website' | 'subscription_url';

export interface MarketingTrendPoint {
  period_start: string;
  page_views: number;
  unique_visitors: number;
  airport_impressions: number;
  outbound_clicks: number;
  ctr: number | null;
}

export interface MarketingOverviewView {
  date_from: string;
  date_to: string;
  granularity: MarketingGranularity;
  totals: {
    page_views: number;
    unique_visitors: number;
    airport_impressions: number;
    outbound_clicks: number;
    ctr: number | null;
  };
  trends: MarketingTrendPoint[];
  source_breakdown: MarketingSourceBreakdownItem[];
  country_breakdown: MarketingCountryBreakdownItem[];
  top_sources: MarketingSourceBreakdownItem[];
  top_countries: MarketingCountryBreakdownItem[];
  filters: {
    sources: MarketingSourceFilterItem[];
    countries: MarketingCountryFilterItem[];
  };
}

export interface MarketingSourceFilterItem {
  source_type: MarketingSourceType;
  source_label: string;
}

export interface MarketingCountryFilterItem {
  country_code: string;
  country_name: string;
}

export interface MarketingSourceBreakdownItem {
  source_type: MarketingSourceType;
  source_label: string;
  page_views: number;
  unique_visitors: number;
  airport_impressions: number;
  outbound_clicks: number;
  ctr: number | null;
  traffic_share: number | null;
}

export interface MarketingCountryBreakdownItem {
  country_code: string;
  country_name: string;
  page_views: number;
  unique_visitors: number;
  airport_impressions: number;
  outbound_clicks: number;
  ctr: number | null;
  traffic_share: number | null;
}

export interface MarketingPageStatsItem {
  page_path: string;
  page_kind: MarketingPageKind;
  page_views: number;
  unique_visitors: number;
  outbound_clicks: number;
  last_visited_at: string | null;
}

export interface MarketingAirportConversionItem {
  airport_id: number;
  airport_name: string;
  airport_impressions: number;
  outbound_clicks: number;
  ctr: number | null;
  primary_placement: MarketingPlacement | null;
  last_clicked_at: string | null;
}

export interface MarketingPlacementBreakdownItem {
  placement: MarketingPlacement | null;
  airport_impressions: number;
  outbound_clicks: number;
  ctr: number | null;
}

export interface MarketingTargetBreakdownItem {
  target_kind: MarketingTargetKind | null;
  outbound_clicks: number;
}

export interface MarketingAirportDetailView {
  airport_id: number;
  airport_name: string;
  date_from: string;
  date_to: string;
  granularity: MarketingGranularity;
  summary: {
    airport_impressions: number;
    outbound_clicks: number;
    ctr: number | null;
    site_click_share: number | null;
    last_clicked_at: string | null;
  };
  trends: MarketingTrendPoint[];
  placement_breakdown: MarketingPlacementBreakdownItem[];
  target_breakdown: MarketingTargetBreakdownItem[];
}

export interface ApiErrorBody {
  code: string;
  message: string;
  request_id: string;
}

export interface NewsArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_markdown: string;
  content_html: string;
  status: NewsStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsArticleListItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  status: NewsStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProbeSample {
  id: number;
  airport_id: number;
  sampled_at: string;
  sample_type: ProbeSampleType;
  probe_scope: ProbeScope;
  latency_ms: number | null;
  download_mbps: number | null;
  availability: boolean | null;
  source: string;
}

export interface ProbeSampleInput {
  airport_id: number;
  sampled_at: string;
  sample_type: ProbeSampleType;
  probe_scope?: ProbeScope;
  latency_ms?: number;
  download_mbps?: number;
  availability?: boolean;
  packet_loss_percent?: number;
  source?: string;
}

export interface PerformanceRunNode {
  name: string;
  region?: string | null;
  type?: string | null;
  status?: string | null;
  error_code?: string | null;
  connect_latency_samples_ms?: number[];
  connect_latency_median_ms?: number | null;
  proxy_http_latency_samples_ms?: number[];
  proxy_http_latency_median_ms?: number | null;
  download_mbps?: number | null;
}

export interface PerformanceRun {
  id: number;
  airport_id: number;
  sampled_at: string;
  source: string;
  status: PerformanceRunStatus;
  subscription_format: string | null;
  parsed_nodes_count: number;
  supported_nodes_count: number;
  selected_nodes: PerformanceRunNode[];
  tested_nodes: PerformanceRunNode[];
  median_latency_ms: number | null;
  median_download_mbps: number | null;
  packet_loss_percent: number | null;
  error_code: string | null;
  error_message: string | null;
  diagnostics: Record<string, unknown>;
}

export interface PerformanceRunInput {
  airport_id: number;
  sampled_at: string;
  source?: string;
  status: PerformanceRunStatus;
  subscription_format?: string | null;
  parsed_nodes_count?: number;
  supported_nodes_count?: number;
  selected_nodes?: PerformanceRunNode[];
  tested_nodes?: PerformanceRunNode[];
  latency_samples_ms?: number[];
  download_samples_mbps?: number[];
  packet_loss_percent?: number;
  median_latency_ms?: number | null;
  median_download_mbps?: number | null;
  error_code?: string | null;
  error_message?: string | null;
  diagnostics?: Record<string, unknown>;
}

export interface AdminAuthResponse {
  token: string;
  expires_at: string;
}

export interface ApplicantPortalSession {
  token: string;
  expires_at: string;
}

export interface ApplicantPortalView {
  account: {
    id: number;
    email: string;
    must_change_password: boolean;
    last_login_at: string | null;
  };
  application: AirportApplication;
  latest_payment_order?: {
    out_trade_no: string;
    channel: 'alipay' | 'wxpay';
    amount: number;
    status: 'created' | 'paid' | 'failed' | 'expired';
    pay_type: string | null;
    pay_info: string | null;
    paid_at: string | null;
  } | null;
  payment_fee_amount: number;
}

export interface ApplicationPaymentOrder {
  id: number;
  application_id: number;
  out_trade_no: string;
  gateway_trade_no: string | null;
  channel: 'alipay' | 'wxpay';
  amount: number;
  status: 'created' | 'paid' | 'failed' | 'expired';
  pay_type: string | null;
  pay_info: string | null;
  notify_payload_json: Record<string, unknown> | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ManualJob {
  id: number;
  airport_id: number;
  date: string;
  kind: ManualJobKind;
  status: ManualJobStatus;
  message: string | null;
  created_by: string;
  request_id: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}
