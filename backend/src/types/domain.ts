import type { FullRankingFilters } from '../../../shared/fullRankingFilters';
import type { MarketingPageKind } from '../../../shared/marketingAnalytics';
import type { HomeToolDownloadCta } from '../../../shared/toolDownloads';
import type { AirportHomeAdSlot } from '../../../shared/airportAds';

export type { MarketingPageKind } from '../../../shared/marketingAnalytics';

export type AirportStatus = 'normal' | 'risk' | 'down';
export type AirportStreamingSupport =
  | 'netflix'
  | 'chatgpt'
  | 'disney_plus'
  | 'hbo_max'
  | 'youtube_premium'
  | 'tiktok'
  | 'spotify';
export type AirportPaymentMethod =
  | 'wechat'
  | 'alipay'
  | 'usdt_trc20'
  | 'usdt_erc20'
  | 'usdt_bep20'
  | 'stripe_card'
  | 'paypal'
  | 'crypto_other'
  | 'unionpay';
export type AirportProfileClientKey =
  | 'self_built_client'
  | 'clash'
  | 'clash_verge'
  | 'clash_mi'
  | 'clash_party'
  | 'shadowrocket'
  | 'quantumult_x'
  | 'stash'
  | 'surge'
  | 'sing_box'
  | 'v2rayn'
  | 'v2rayng'
  | 'nekobox'
  | 'surfboard'
  | 'xiaohuojian'
  | 'openclash';
export type AirportProfileRegionKey =
  | 'hong_kong'
  | 'taiwan'
  | 'japan'
  | 'singapore'
  | 'united_states'
  | 'south_korea'
  | 'united_kingdom'
  | 'germany'
  | 'turkey'
  | 'argentina'
  | 'india';
export type AirportProfileLineType = 'iepl' | 'iplc' | 'cn2' | 'bgp' | 'relay';

export interface AirportProfilePlan {
  supports_monthly: boolean | null;
  supports_quarterly: boolean | null;
  supports_half_yearly: boolean | null;
  supports_annual: boolean | null;
  lowest_monthly_price: number | null;
  lowest_annual_monthly_price: number | null;
  has_trial_plan: boolean | null;
  has_lifetime_plan: boolean | null;
}

export interface AirportProfileTelegram {
  has_group: boolean | null;
  group_url: string | null;
  has_channel: boolean | null;
  channel_url: string | null;
  group_allows_speaking: boolean | null;
  group_member_count: number | null;
  recent_active_at: string | null;
  has_customer_service_bot: boolean | null;
  has_ticket_system: boolean | null;
}

export interface AirportProfileRegionInfo {
  has_residential: boolean | null;
  has_native_ip: boolean | null;
  line_types: AirportProfileLineType[];
}

export interface AirportProfileImportMethods {
  one_click_import: boolean | null;
  subscription_link: boolean | null;
  universal_subscription: boolean | null;
  qr_code_import: boolean | null;
  tutorials: boolean | null;
}

export interface AirportProfile {
  plan: AirportProfilePlan;
  telegram: AirportProfileTelegram;
  clients: Record<AirportProfileClientKey, boolean | null>;
  import_methods: AirportProfileImportMethods;
  regions: Record<AirportProfileRegionKey, AirportProfileRegionInfo>;
}
export type StabilityTier = 'stable' | 'minor_fluctuation' | 'volatile';
export type AirportApplicationReviewStatus = 'awaiting_payment' | 'pending' | 'reviewed' | 'rejected';
export type AirportApplicationPaymentStatus = 'unpaid' | 'paid';
export type RankingType = 'today' | 'stable' | 'value' | 'new' | 'risk';
export type ProbeSampleType = 'latency' | 'download' | 'availability';
export type ProbeScope = 'stability' | 'performance';
export type PerformanceRunStatus = 'success' | 'partial' | 'skipped' | 'failed';
export type PerformanceProbeId = 'legacy-control' | 'cn-shanghai' | 'cn-guangzhou';
export type PerformanceProbeType = 'legacy' | 'mainland';
export type PerformanceScoringRuleVersion = 'legacy_v1' | 'cn_dual_probe_v1';
export type PerformanceReviewStatus = 'normal' | 'needs_review' | 'suspicious';
export type PerformanceProbeJobStatus = 'queued' | 'leased' | 'completed' | 'failed' | 'expired';
export type PerformanceRunMode = 'shadow' | 'official';
export type PerformanceCalibrationStatus = 'not_required' | 'passed' | 'failed';
export type ManualJobKind = 'full' | 'stability' | 'performance' | 'network_coverage' | 'risk' | 'time_decay';
export type ManualJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type NewsStatus = 'draft' | 'published' | 'archived';
export type MonthlyReportStatus = 'draft' | 'published' | 'archived';
export type SchedulerTaskKey =
  | 'stability'
  | 'subscription_node_refresh'
  | 'performance'
  | 'network_coverage'
  | 'risk'
  | 'aggregate_recompute'
  | 'billing_listing_sync'
  | 'stability_resample_guard';
export type SchedulerRunStatus = 'running' | 'succeeded' | 'failed';
export type SchedulerRunOutcome = SchedulerRunStatus | 'partial';
export type SchedulerTriggerSource = 'schedule' | 'restart' | 'bootstrap_recover';

export interface Airport {
  id: number;
  application_id?: number | null;
  slug?: string;
  name: string;
  website: string;
  websites?: string[];
  status: AirportStatus;
  is_listed: boolean;
  plan_price_month: number;
  has_trial: boolean;
  streaming_support?: AirportStreamingSupport[];
  payment_methods?: AirportPaymentMethod[];
  payment_crypto_other?: string | null;
  has_annual_plan?: boolean | null;
  has_telegram_group?: boolean | null;
  telegram_allows_speaking?: boolean | null;
  has_lifetime_plan?: boolean | null;
  profile?: AirportProfile;
  subscription_url?: string | null;
  subscription_url_updated_at?: string | null;
  subscription_url_updated_source?: 'admin' | 'portal' | null;
  applicant_email?: string | null;
  applicant_account_email?: string | null;
  applicant_telegram?: string | null;
  founded_on?: string | null;
  airport_intro?: string | null;
  test_account?: string | null;
  test_password?: string | null;
  tags: string[];
  manual_tags?: string[];
  auto_tags?: string[];
  total_score?: number | null;
  telegram_bot_bound?: boolean;
  paid_application_fee?: boolean;
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
  streaming_support?: AirportStreamingSupport[];
  payment_methods?: AirportPaymentMethod[];
  payment_crypto_other?: string | null;
  profile?: AirportProfile;
  subscription_url?: string | null;
  subscription_url_updated_at?: string | null;
  subscription_url_updated_source?: 'admin' | 'portal' | null;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
  approved_airport_id?: number | null;
  review_status: AirportApplicationReviewStatus;
  payment_status: AirportApplicationPaymentStatus;
  payment_amount: number | null;
  paid_at?: string | null;
  must_change_password?: boolean | null;
  review_note?: string | null;
  admin_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  email_replies?: AirportApplicationEmailReply[];
  created_at: string;
  updated_at: string;
}

export interface AirportApplicationEmailReply {
  id: number;
  application_id: number;
  to_email: string;
  reply_body: string;
  sent_by: string;
  sent_at: string;
  created_at: string;
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
  packet_loss_measurement?: string | null;
  performance_latency_score?: number | null;
  performance_speed_score?: number | null;
  performance_loss_score?: number | null;
  performance_score?: number | null;
  performance_rule_summary?: string | null;
  performance_included_probe_ids?: string[];
  performance_review_status?: PerformanceReviewStatus | null;
  performance_pending_probe_ids?: string[];
  available_nodes_count?: number | null;
  unavailable_nodes_count?: number | null;
  node_availability_percent?: number | null;
  node_unavailability_percent?: number | null;
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

export interface PerformanceRegionMeasurement {
  probe_id: PerformanceProbeId;
  scoring_rule_version: PerformanceScoringRuleVersion;
  median_latency_ms: number;
  median_download_mbps: number;
  packet_loss_percent: number;
}

export interface PerformanceRegionScore extends PerformanceRegionMeasurement {
  latency_score: number;
  speed_score: number;
  loss_score: number;
  p: number;
  probe_ceiling: boolean;
}

export interface PerformanceAggregate {
  median_latency_ms: number;
  median_download_mbps: number;
  packet_loss_percent: number;
  latency_score: number;
  speed_score: number;
  loss_score: number;
  p: number;
  included_probe_ids: PerformanceProbeId[];
  rule_summary: string;
}

export interface PerformanceProbe {
  probe_id: PerformanceProbeId;
  display_name: string;
  region_code: string;
  provider: string;
  bandwidth_mbps: number | null;
  probe_type: PerformanceProbeType;
  test_profile: string;
  scoring_rule_version: PerformanceScoringRuleVersion;
  globally_enabled: boolean;
  token_configured: boolean;
  token_last_rotated_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AirportPerformanceProbeSetting {
  probe_id: PerformanceProbeId;
  test_enabled: boolean;
  include_in_result: boolean;
  updated_by: string | null;
  updated_at: string | null;
}

export interface AirportPerformanceProbeSettingsView {
  airport_id: number;
  config_version: number;
  settings: AirportPerformanceProbeSetting[];
}

export interface AirportPerformanceProbeSettingsInput {
  airport_id: number;
  expected_config_version: number;
  updated_by: string;
  settings: Array<Pick<
    AirportPerformanceProbeSetting,
    'probe_id' | 'test_enabled' | 'include_in_result'
  >>;
}

export interface PerformanceProbeJob {
  job_id: string;
  airport_id: number;
  probe_id: PerformanceProbeId;
  node_snapshot_id: number;
  config_version: number;
  test_enabled_snapshot: boolean;
  include_in_result_snapshot: boolean;
  test_profile: string;
  scoring_rule_version: PerformanceScoringRuleVersion;
  selected_node_keys: string[];
  source: string;
  status: PerformanceProbeJobStatus;
  lease_owner: string | null;
  lease_expires_at: string | null;
  attempts: number;
  idempotency_key: string;
  run_id: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface PerformanceProbeJobInput {
  job_id: string;
  airport_id: number;
  probe_id: PerformanceProbeId;
  node_snapshot_id: number;
  config_version: number;
  test_enabled_snapshot: boolean;
  include_in_result_snapshot: boolean;
  test_profile: string;
  scoring_rule_version: PerformanceScoringRuleVersion;
  selected_node_keys: string[];
  source: string;
  idempotency_key: string;
}

export interface PerformanceRunTarget {
  run_id: number;
  node_key: string;
  target_key: string;
  bytes_downloaded: number;
  duration_ms: number;
  download_mbps: number | null;
  http_status: number | null;
  error_code: string | null;
  valid: boolean;
  created_at?: string;
}

export type ScoreDetailValue = number | string | boolean | null;

export interface TimeSeriesScorePoint {
  date: string;
  score: number;
}

export interface ScoreBreakdown {
  s: number;
  p: number;
  n?: number | null;
  c: number;
  r: number;
  risk_penalty: number;
  score: number;
  recent_score: number;
  historical_score: number;
  final_score: number;
  details: Record<string, ScoreDetailValue>;
}

export type NetworkCoverageRunStatus = 'success' | 'partial' | 'skipped' | 'failed';

export interface NetworkCoverageRunNode {
  key: string;
  name: string;
  type: string | null;
  healthy: boolean;
  error_code: string | null;
  region_code: string;
  region_name: string;
  region_group: 'core' | 'extended' | 'unknown';
}

export interface NetworkCoverageRun {
  id: number;
  airport_id: number;
  sampled_at: string;
  sampled_date: string;
  source: string;
  status: NetworkCoverageRunStatus;
  subscription_format: string | null;
  detected_nodes_count: number;
  healthy_nodes_count: number;
  unhealthy_nodes_count: number;
  unsupported_nodes_count: number;
  unknown_healthy_nodes_count: number;
  healthy_node_rate: number;
  core_regions: string[];
  extended_regions: string[];
  region_counts: Record<string, number>;
  max_region_code: string | null;
  max_region_share: number;
  node_count_score: number;
  core_coverage_score: number;
  extended_coverage_score: number;
  region_score: number;
  health_rate_score: number;
  balance_score: number;
  score_n: number;
  rule_version: string;
  nodes: NetworkCoverageRunNode[];
  error_code: string | null;
  error_message: string | null;
  diagnostics: Record<string, unknown>;
  created_at: string;
}

export interface NetworkCoverageRunInput {
  airport_id: number;
  sampled_at: string;
  sampled_date: string;
  source: string;
  status: NetworkCoverageRunStatus;
  subscription_format?: string | null;
  unsupported_nodes_count?: number;
  nodes?: Array<{
    key: string;
    name: string;
    type?: string | null;
    healthy: boolean;
    error_code?: string | null;
  }>;
  error_code?: string | null;
  error_message?: string | null;
  diagnostics?: Record<string, unknown>;
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

export interface SchedulerRunFailureDetail {
  airport_id: number | null;
  airport_name: string | null;
  error: string;
}

export interface SchedulerRunResultSummary {
  total_count: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  failures: SchedulerRunFailureDetail[];
  missing_failure_detail_count: number;
}

export interface SchedulerRunStageSummary {
  central_collection: SchedulerRunResultSummary | null;
  regional_dispatch: SchedulerRunResultSummary | null;
  regional_job_count: number;
}

export interface SchedulerRunView extends SchedulerRun {
  outcome: SchedulerRunOutcome;
  result_summary: SchedulerRunResultSummary | null;
  stage_summary: SchedulerRunStageSummary | null;
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
  score: number | null;
  score_hidden?: boolean;
  score_hidden_reason?: 'insufficient_balance' | null;
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

export interface HomeSponsoredDealView {
  campaign_id: number;
  airport_id: number;
  home_slot: AirportHomeAdSlot;
  name: string;
  website: string;
  report_url: string;
  discount_title: string;
  discount_description: string;
  coupon_code: string;
  plan_price_month: number;
  tracking_days: number;
  tags: string[];
  score: number | null;
  score_hidden: boolean;
  score_hidden_reason: 'insufficient_balance' | null;
  score_delta_vs_yesterday: ScoreDeltaView;
}

export interface HomeNewsUpdateView {
  id: number;
  title: string;
  slug: string;
  href: string;
  published_at: string | null;
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
  tool_download_cta: HomeToolDownloadCta;
  ranking_preview?: {
    total: number;
    items: FullRankingItem[];
  };
  sponsored_deals?: {
    total: number;
    display_limit: number;
    items: HomeSponsoredDealView[];
  };
  news_updates?: HomeNewsUpdateView[];
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
  score_hidden?: boolean;
  score_hidden_reason?: 'insufficient_balance' | null;
  score_delta_vs_yesterday: ScoreDeltaView;
  score_date?: string | null;
  report_url?: string | null;
  capabilities?: {
    payment_methods: ReportCapabilityItem[];
    streaming: ReportCapabilityItem[];
    clients: ReportCapabilityItem[];
    import_methods: ReportCapabilityItem[];
    regions: Array<{
      key: string;
      label: string;
      line_types: ReportCapabilityItem[];
      has_residential: boolean | null;
      has_native_ip: boolean | null;
    }>;
    plan: {
      supports_annual: boolean | null;
      has_lifetime_plan: boolean | null;
    };
    telegram: {
      has_group: boolean | null;
      group_allows_speaking: boolean | null;
    };
  };
}

export interface FullRankingView {
  date: string;
  score_rule_version?: 'v1_spcr' | 'v2_spncr';
  generated_at: string;
  filters?: FullRankingFilters;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  tool_download_cta: HomeToolDownloadCta;
  items: FullRankingItem[];
}

export interface RiskMonitorItem extends FullRankingItem {
  monitor_reason: 'down' | 'risk_watch';
  risk_penalty: number | null;
  risk_reasons: string[];
  risk_reason_summary: string;
  snapshot_is_stale: boolean;
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

export interface ReportCapabilityItem {
  key: string;
  label: string;
}

export interface ReportCapabilityRegion {
  key: string;
  label: string;
  node_count: number;
  line_types: string[];
  has_residential: boolean | null;
  has_native_ip: boolean | null;
}

export interface ReportCapabilityPlan {
  supports_monthly: boolean | null;
  supports_quarterly: boolean | null;
  supports_half_yearly: boolean | null;
  supports_annual: boolean | null;
  lowest_monthly_price: number | null;
  lowest_annual_monthly_price: number | null;
  has_trial_plan: boolean | null;
  has_lifetime_plan: boolean | null;
}

export interface ReportCapabilityTelegram {
  items: ReportCapabilityItem[];
  has_group: boolean | null;
  group_url: string | null;
  has_channel: boolean | null;
  channel_url: string | null;
  group_allows_speaking: boolean | null;
  group_member_count: number | null;
  recent_active_at: string | null;
  has_customer_service_bot: boolean | null;
  has_ticket_system: boolean | null;
}

export interface ReportCapabilities {
  plan: ReportCapabilityPlan;
  streaming: ReportCapabilityItem[];
  payment_methods: ReportCapabilityItem[];
  telegram: ReportCapabilityTelegram;
  clients: ReportCapabilityItem[];
  import_methods: ReportCapabilityItem[];
  regions: ReportCapabilityRegion[];
}

export interface ReportView {
  requested_date: string;
  date: string;
  score_rule_version: 'v1_spcr' | 'v2_spncr';
  resolved_from_fallback: boolean;
  fallback_notice: string | null;
  performance_under_review: boolean;
  tool_download_cta: HomeToolDownloadCta;
  airport: Pick<Airport, 'id' | 'name' | 'website' | 'status' | 'tags'> & { slug: string };
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
    n: number | null;
    c: number;
    r: number;
    final_score: number | null;
    risk_penalty: number;
    domain_penalty: number;
    ssl_penalty: number;
    complaint_penalty: number;
    history_penalty: number;
  };
  network_coverage: {
    sampled_date: string;
    rule_version: string;
    detected_nodes_count: number;
    healthy_nodes_count: number;
    unsupported_nodes_count: number;
    unknown_healthy_nodes_count: number;
    healthy_node_rate: number;
    core_regions: string[];
    extended_regions: string[];
    max_region_code: string | null;
    max_region_share: number;
    node_count_score: number;
    region_score: number;
    health_rate_score: number;
    balance_score: number;
  } | null;
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
    packet_loss_30d: Array<{ date: string; value: number }>;
  };
  capabilities: ReportCapabilities;
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
export type MarketingPlacement = 'home_card' | 'full_ranking_item' | 'risk_monitor_item' | 'report_header' | 'deal_card' | 'news_article';
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
  category_id: number | null;
  is_featured: boolean;
  is_recommended: boolean;
  recommend_weight: number;
  status: NewsStatus;
  published_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  category: NewsCategorySummary | null;
  topics: NewsTopicSummary[];
}

export interface NewsArticleListItem {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  category_id: number | null;
  is_featured: boolean;
  is_recommended: boolean;
  recommend_weight: number;
  status: NewsStatus;
  published_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
  category: NewsCategorySummary | null;
  topics: NewsTopicSummary[];
}

export interface MonthlyReport {
  id: number;
  year: number;
  month: number;
  slug: string;
  title: string;
  h1: string;
  excerpt: string;
  content_markdown: string;
  content_html: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  cover_image_url: string;
  og_image_url: string;
  og_image_alt: string;
  status: MonthlyReportStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonthlyReportListItem {
  id: number;
  year: number;
  month: number;
  slug: string;
  title: string;
  h1: string;
  excerpt: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  cover_image_url: string;
  og_image_url: string;
  og_image_alt: string;
  status: MonthlyReportStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsCategorySummary {
  id: number;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  is_active?: boolean;
  updated_at?: string | null;
}

export interface NewsTopicSummary {
  id: number;
  name: string;
  slug: string;
  description: string;
  seo_title?: string;
  seo_description?: string;
  h1?: string;
  intro?: string;
  cover_image_url?: string;
  accent_color?: string;
  faq_items?: Array<{ question: string; answer: string }>;
  sort_order: number;
  is_active?: boolean;
  updated_at?: string | null;
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
  proxy_http_request_failures?: number | null;
  proxy_http_request_attempts?: number | null;
  proxy_http_request_failure_percent?: number | null;
  connect_failures?: number | null;
  connect_attempts?: number | null;
  download_mbps?: number | null;
}

export interface PerformanceRun {
  id: number;
  airport_id: number;
  sampled_at: string;
  sampled_date?: string;
  source: string;
  status: PerformanceRunStatus;
  job_id?: string | null;
  probe_id?: PerformanceProbeId;
  region_code?: string | null;
  provider?: string | null;
  bandwidth_mbps?: number | null;
  run_mode?: PerformanceRunMode;
  test_profile?: string;
  scoring_rule_version?: PerformanceScoringRuleVersion;
  config_version?: number;
  calibration_status?: PerformanceCalibrationStatus;
  calibration_mbps?: number | null;
  review_status?: PerformanceReviewStatus;
  review_reasons?: string[];
  subscription_format: string | null;
  parsed_nodes_count: number;
  supported_nodes_count: number;
  selected_nodes: PerformanceRunNode[];
  tested_nodes: PerformanceRunNode[];
  available_nodes_count: number | null;
  unavailable_nodes_count: number | null;
  node_availability_percent: number | null;
  node_unavailability_percent: number | null;
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
  sampled_date?: string;
  source?: string;
  status: PerformanceRunStatus;
  job_id?: string | null;
  probe_id?: PerformanceProbeId;
  region_code?: string | null;
  provider?: string | null;
  bandwidth_mbps?: number | null;
  run_mode?: PerformanceRunMode;
  test_profile?: string;
  scoring_rule_version?: PerformanceScoringRuleVersion;
  config_version?: number;
  calibration_status?: PerformanceCalibrationStatus;
  calibration_mbps?: number | null;
  review_status?: PerformanceReviewStatus;
  review_reasons?: string[];
  subscription_format?: string | null;
  parsed_nodes_count?: number;
  supported_nodes_count?: number;
  selected_nodes?: PerformanceRunNode[];
  tested_nodes?: PerformanceRunNode[];
  available_nodes_count?: number | null;
  unavailable_nodes_count?: number | null;
  node_availability_percent?: number | null;
  node_unavailability_percent?: number | null;
  latency_samples_ms?: number[];
  latency_sampled_at?: string[];
  download_samples_mbps?: number[];
  packet_loss_percent?: number;
  median_latency_ms?: number | null;
  median_download_mbps?: number | null;
  error_code?: string | null;
  error_message?: string | null;
  diagnostics?: Record<string, unknown>;
}

export interface SubscriptionNodeSnapshotNode {
  name: string;
  region?: string | null;
  type: string;
  outbound: Record<string, unknown>;
  raw_uri: string;
}

export interface SubscriptionNodeSnapshotUnsupportedNode {
  uri: string;
  reason: string;
}

export interface SubscriptionNodeSnapshot {
  id: number;
  airport_id: number;
  captured_at: string;
  source: string;
  subscription_url: string | null;
  subscription_format: string | null;
  parsed_nodes_count: number;
  supported_nodes_count: number;
  region_counts?: Record<string, number>;
  nodes: SubscriptionNodeSnapshotNode[];
  unsupported_nodes: SubscriptionNodeSnapshotUnsupportedNode[];
  created_at: string;
}

export interface SubscriptionNodeSnapshotInput {
  airport_id: number;
  captured_at: string;
  source?: string;
  subscription_url?: string | null;
  subscription_format?: string | null;
  parsed_nodes_count?: number;
  supported_nodes_count?: number;
  nodes: SubscriptionNodeSnapshotNode[];
  unsupported_nodes?: SubscriptionNodeSnapshotUnsupportedNode[];
}

export interface PerformanceNodePreferenceNode {
  key: string;
  name: string;
  region?: string | null;
  type?: string | null;
  match_identity?: string | null;
}

export interface PerformanceNodePreference {
  airport_id: number;
  selected_nodes: PerformanceNodePreferenceNode[];
  updated_by: string;
  updated_at: string;
}

export interface PerformanceNodePreferenceInput {
  airport_id: number;
  selected_nodes: PerformanceNodePreferenceNode[];
  updated_by: string;
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
    x: {
      user_id: string;
      username: string | null;
      display_name: string | null;
      bound_at: string | null;
    } | null;
  };
  application: AirportApplication;
  latest_payment_order?: {
    out_trade_no: string;
    channel: 'alipay' | 'wxpay' | 'usdt';
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
  channel: 'alipay' | 'wxpay' | 'usdt';
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
