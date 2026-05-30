import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  Flame,
  Trophy,
  Banknote,
  Plus,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Search,
  Zap,
  ExternalLink,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  BarChart3,
  Clock,
  LogIn,
  KeyRound,
  CheckCircle2,
  Mail,
  CircleAlert,
  LogOut,
  Eye,
  EyeOff,
  Link2,
  Unlink,
  Send,
  Headphones,
} from 'lucide-react';
import { motion } from 'motion/react';

import { TagBadge, TagBadgeGroup, getTagBadgeTone } from './components/TagBadge';
import {
  buildAbsoluteUrl,
  buildDealsHref,
  buildFullRankingHref,
  buildHomeHref,
  buildMethodologyHref,
  buildPublishTokenDocsHref,
  buildRiskMonitorHref,
  buildQuery,
  navigate,
  PageFrame,
  usePageSeo,
} from './site/publicSite';
import {
  APPLY_SEO,
  buildAirportReportPath,
  buildFullRankingHeading,
  buildFullRankingSeo,
  buildHomeSeo,
  buildReportComparisonLinks,
  buildReportContentSections,
  buildReportContentSummary,
  buildReportSeo,
  buildReportStructuredData,
  buildReportTrendLabel,
  buildRiskMonitorSeo,
  formatAirportStatusLabel,
} from '../shared/publicSeo';
import {
  AIRPORT_CLIENT_FILTERS,
  AIRPORT_IMPORT_FILTERS,
  AIRPORT_LINE_FILTERS,
  AIRPORT_PAYMENT_FILTERS,
  AIRPORT_REGION_FILTERS,
  AIRPORT_STREAMING_FILTERS,
  getAirportFilterLabel,
  type AirportFilterCategory,
  type AirportFilterOption,
} from '../shared/airportFilterCatalog';
import {
  buildFullRankingQuery,
  cloneFullRankingFilters,
  EMPTY_FULL_RANKING_FILTERS,
  fullRankingFiltersEqual,
  getFullRankingFilterCount,
  getFullRankingSeoDecision,
  parseFullRankingFilters,
  type FullRankingFilters,
} from '../shared/fullRankingFilters';
import { MethodologyPage } from './pages/methodology/MethodologyPage';
import { DealsPage } from './pages/deals/DealsPage';
import { trackPageView } from './site/analytics';
import { getCapabilityIcon, type CapabilityIconCategory } from '../shared/capabilityIcons';
import {
  createTrackedOutboundClickHandler,
  flushMarketingEvents,
  type MarketingPageKind,
  type MarketingPlacement,
  trackMarketingPageView,
  useMarketingImpression,
} from './site/marketing';
import { PUBLIC_SITE_BRAND_NAME } from '../shared/publicBrand';
import {
  AIRPORT_AD_LOW_BALANCE_WARNING_THRESHOLD,
  AIRPORT_AD_MONTHLY_PRICE,
  type AirportDealView,
  type PortalAirportAdCampaignView,
  type PortalAirportAdStatus,
} from '../shared/airportAds';

const LazyPublishTokenDocsPage = lazy(async () => {
  const module = await import('./pages/publishTokenDocs/PublishTokenDocsPage');
  return { default: module.PublishTokenDocsPage };
});

const primaryCtaTextStyle: React.CSSProperties = {
  color: '#fff',
  WebkitTextFillColor: '#fff',
  forcedColorAdjust: 'none',
  colorScheme: 'light',
};

function XLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.656l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}

type CardType = 'stable' | 'value' | 'risk' | 'new';
type HomeSectionKey = 'today_pick' | 'most_stable' | 'best_value' | 'new_entries' | 'risk_alerts';
type StabilityTier = 'stable' | 'minor_fluctuation' | 'volatile';

interface CardDetail {
  label: string;
  value: string;
}

interface ScoreDeltaView {
  label: string;
  value: number | null;
}

interface HomeCardItem {
  type: CardType;
  airport_id: number;
  name: string;
  website: string;
  tags: string[];
  score: number | null;
  score_hidden?: boolean;
  score_hidden_reason?: 'insufficient_balance' | null;
  score_delta_vs_yesterday: ScoreDeltaView;
  stability_tier: StabilityTier;
  details: [CardDetail, CardDetail];
  conclusion: string;
  report_url: string;
}

interface HomeSection {
  title: string;
  subtitle: string;
  items: HomeCardItem[];
}

interface HomePageResponse {
  requested_date: string;
  date: string;
  resolved_from_fallback: boolean;
  fallback_notice: string | null;
  generated_at: string;
  hero: {
    report_time_at?: string | null;
    report_time_text: string;
    monitored_airports: number;
    realtime_tests: number;
  };
  sections: Record<HomeSectionKey, HomeSection>;
}

interface FullRankingItemResponse {
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

interface FullRankingPageResponse {
  date: string;
  generated_at: string;
  filters: FullRankingFilters;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: FullRankingItemResponse[];
}

interface RiskMonitorItemResponse extends FullRankingItemResponse {
  monitor_reason: 'down' | 'risk_watch';
  risk_penalty: number | null;
  risk_reasons: string[];
  risk_reason_summary: string;
  snapshot_is_stale: boolean;
}

interface RiskMonitorPageResponse {
  date: string;
  generated_at: string;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: RiskMonitorItemResponse[];
}

interface ReportViewResponse {
  requested_date: string;
  date: string;
  resolved_from_fallback: boolean;
  fallback_notice: string | null;
  airport: {
    id: number;
    slug: string;
    name: string;
    website: string;
    status: AirportStatus;
    tags: string[];
  };
  summary_card: {
    type: CardType;
    name: string;
    tags: string[];
    score: number | null;
    score_hidden?: boolean;
    score_hidden_reason?: 'insufficient_balance' | null;
    stability_tier: StabilityTier;
    details: [CardDetail, CardDetail];
    conclusion: string;
  };
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
    final_score: number | null;
    risk_penalty: number;
    domain_penalty: number;
    ssl_penalty: number;
    complaint_penalty: number;
    history_penalty: number;
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
  capabilities: {
    plan: {
      supports_monthly: boolean | null;
      supports_quarterly: boolean | null;
      supports_half_yearly: boolean | null;
      supports_annual: boolean | null;
      lowest_monthly_price: number | null;
      lowest_annual_monthly_price: number | null;
      has_trial_plan: boolean | null;
      has_lifetime_plan: boolean | null;
    };
    streaming: ReportCapabilityItem[];
    payment_methods: ReportCapabilityItem[];
    telegram: {
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
    };
    clients: ReportCapabilityItem[];
    import_methods: ReportCapabilityItem[];
    regions: Array<{
      key: string;
      label: string;
      node_count: number;
      line_types: string[];
      has_residential: boolean | null;
      has_native_ip: boolean | null;
    }>;
  };
}

interface ReportCapabilityItem {
  key: string;
  label: string;
}

type InitialPublicDataKind = 'home' | 'full_ranking' | 'risk_monitor' | 'deals';

interface InitialPublicDataEnvelope<T> {
  kind: InitialPublicDataKind;
  params?: {
    date?: string | null;
    page?: number | null;
    filters?: FullRankingFilters;
  };
  payload: T;
}

interface CardProps {
  type: CardType;
  variant?: 'default' | 'homeCompact';
  title?: string;
  name: string;
  website?: string;
  tags: string[];
  score: number | null;
  scoreDeltaVsYesterday?: ScoreDeltaView;
  stabilityTier: StabilityTier;
  showStabilityTier?: boolean;
  details: CardDetail[];
  conclusion: string;
  icon?: React.ReactNode;
  reportHref?: string;
  onOpen?: () => void;
  onWebsiteClick?: () => void;
}

interface RouteState {
  kind: 'home' | 'report' | 'apply' | 'portal' | 'full_ranking' | 'deals' | 'risk_monitor' | 'methodology' | 'publish_token_docs' | 'not_found';
  airportId?: number;
  airportSlug?: string;
  date?: string;
  page?: number;
  filters?: FullRankingFilters;
}

type AirportStatus = 'normal' | 'risk' | 'down';
type AirportStreamingSupport =
  | 'netflix'
  | 'chatgpt'
  | 'disney_plus'
  | 'hbo_max'
  | 'youtube_premium'
  | 'tiktok'
  | 'spotify';
type AirportPaymentMethod =
  | 'wechat'
  | 'alipay'
  | 'usdt_trc20'
  | 'usdt_erc20'
  | 'usdt_bep20'
  | 'stripe_card'
  | 'paypal'
  | 'crypto_other'
  | 'unionpay';
type AirportProfileClientKey =
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
type AirportProfileRegionKey =
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
type AirportProfileLineType = 'iepl' | 'iplc' | 'cn2' | 'bgp' | 'relay';
type PortalProfileTab = 'basic' | 'review' | 'plan' | 'telegram' | 'nodes' | 'clients' | 'import';

interface AirportProfilePlan {
  supports_monthly: boolean | null;
  supports_quarterly: boolean | null;
  supports_half_yearly: boolean | null;
  supports_annual: boolean | null;
  lowest_monthly_price: number | null;
  lowest_annual_monthly_price: number | null;
  has_trial_plan: boolean | null;
  has_lifetime_plan: boolean | null;
}

interface AirportProfileTelegram {
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

interface AirportProfileRegionInfo {
  has_residential: boolean | null;
  has_native_ip: boolean | null;
  line_types: AirportProfileLineType[];
}

interface AirportProfileImportMethods {
  one_click_import: boolean | null;
  subscription_link: boolean | null;
  universal_subscription: boolean | null;
  qr_code_import: boolean | null;
  tutorials: boolean | null;
}

interface AirportProfile {
  plan: AirportProfilePlan;
  telegram: AirportProfileTelegram;
  clients: Record<AirportProfileClientKey, boolean | null>;
  import_methods: AirportProfileImportMethods;
  regions: Record<AirportProfileRegionKey, AirportProfileRegionInfo>;
}

interface ApplicationFormState {
  name: string;
  websites: string[];
  plan_price_month: string;
  has_trial: boolean;
  streaming_support: AirportStreamingSupport[];
  payment_methods: AirportPaymentMethod[];
  payment_crypto_other: string;
  profile: AirportProfile;
  subscription_url: string;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
}

interface ApplicationSubmitResponse {
  application_id: number;
  review_status: 'awaiting_payment';
  portal_email: string;
  initial_password: string;
  portal_login_url: string;
}

interface ApplicationConfigResponse {
  application_fee_amount: number;
}

const AIRPORT_STREAMING_SUPPORT_OPTIONS: Array<{ value: AirportStreamingSupport; label: string }> = [
  { value: 'netflix', label: 'Netflix' },
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'disney_plus', label: 'Disney+' },
  { value: 'hbo_max', label: 'HBO Max' },
  { value: 'youtube_premium', label: 'YouTube Premium' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'spotify', label: 'Spotify' },
];

const AIRPORT_PAYMENT_METHOD_OPTIONS: Array<{ value: AirportPaymentMethod; label: string }> = [
  { value: 'wechat', label: '微信' },
  { value: 'alipay', label: '支付宝' },
  { value: 'usdt_trc20', label: 'USDT-TRC20' },
  { value: 'usdt_erc20', label: 'USDT-ERC20' },
  { value: 'usdt_bep20', label: 'USDT-BEP20' },
  { value: 'stripe_card', label: 'Stripe / 信用卡' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'crypto_other', label: '虚拟币其他币种' },
  { value: 'unionpay', label: '银联' },
];

const AIRPORT_PROFILE_CLIENT_OPTIONS: Array<{ value: AirportProfileClientKey; label: string }> = [
  { value: 'self_built_client', label: '自建客户端' },
  { value: 'clash', label: 'Clash' },
  { value: 'clash_verge', label: 'Clash Verge' },
  { value: 'clash_mi', label: 'Clash Mi' },
  { value: 'clash_party', label: 'Clash Party' },
  { value: 'shadowrocket', label: 'Shadowrocket' },
  { value: 'quantumult_x', label: 'Quantumult X' },
  { value: 'stash', label: 'Stash' },
  { value: 'surge', label: 'Surge' },
  { value: 'sing_box', label: 'Sing-box' },
  { value: 'v2rayn', label: 'V2rayN' },
  { value: 'v2rayng', label: 'V2rayNG' },
  { value: 'nekobox', label: 'NekoBox' },
  { value: 'surfboard', label: 'Surfboard' },
  { value: 'xiaohuojian', label: '小火箭' },
  { value: 'openclash', label: 'OpenClash' },
];

const AIRPORT_PROFILE_REGION_OPTIONS: Array<{ value: AirportProfileRegionKey; label: string }> = [
  { value: 'hong_kong', label: '香港' },
  { value: 'taiwan', label: '台湾' },
  { value: 'japan', label: '日本' },
  { value: 'singapore', label: '新加坡' },
  { value: 'united_states', label: '美国' },
  { value: 'south_korea', label: '韩国' },
  { value: 'united_kingdom', label: '英国' },
  { value: 'germany', label: '德国' },
  { value: 'turkey', label: '土耳其' },
  { value: 'argentina', label: '阿根廷' },
  { value: 'india', label: '印度' },
];

const AIRPORT_PROFILE_LINE_TYPE_OPTIONS: Array<{ value: AirportProfileLineType; label: string }> = [
  { value: 'iepl', label: 'IEPL' },
  { value: 'iplc', label: 'IPLC' },
  { value: 'cn2', label: 'CN2' },
  { value: 'bgp', label: 'BGP' },
  { value: 'relay', label: '中转' },
];

const PORTAL_PROFILE_TABS: Array<{ key: PortalProfileTab; label: string }> = [
  { key: 'basic', label: '基础信息' },
  { key: 'review', label: '申报信息' },
  { key: 'plan', label: '套餐信息' },
  { key: 'telegram', label: '电报信息' },
  { key: 'nodes', label: '节点覆盖' },
  { key: 'clients', label: '客户端支持' },
  { key: 'import', label: '导入教程' },
];

interface PortalAccountView {
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
}

interface PortalPaymentOrderView {
  out_trade_no: string;
  channel: PaymentChannel;
  amount: number;
  status: 'created' | 'paid' | 'failed' | 'expired';
  pay_type: string | null;
  pay_info: string | null;
  paid_at: string | null;
}

interface PortalWalletView {
  id: number;
  applicant_account_id: number;
  application_id: number;
  airport_id: number | null;
  airport_is_listed?: boolean | null;
  balance: number;
  auto_unlisted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PortalTelegramBotView {
  configured: boolean;
  enabled: boolean;
  bot_username: string | null;
  binding: null | {
    telegram_user_id: string;
    telegram_chat_id: string;
    telegram_username: string | null;
    telegram_first_name: string | null;
    telegram_last_name: string | null;
    bound_at: string;
  };
}

interface PortalRechargeOrderView {
  id: number;
  applicant_account_id?: number;
  out_trade_no: string;
  channel: PaymentChannel;
  amount: number;
  status: 'created' | 'paid' | 'failed' | 'expired' | 'canceled';
  pay_type: string | null;
  pay_info: string | null;
  paid_at: string | null;
  created_at: string;
}

interface PortalWalletTransactionView {
  id: number;
  transaction_type: 'recharge' | 'click_charge' | 'ad_campaign_charge' | 'adjustment';
  amount: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string;
  created_at: string;
}

interface PortalClickView {
  id: number;
  click_id: string;
  airport_id: number;
  airport_name: string | null;
  placement: string;
  target_kind: string;
  target_url: string;
  billing_status: 'billed' | 'duplicate' | 'free' | 'insufficient_balance' | 'unlisted' | 'no_wallet';
  billed_amount: number;
  occurred_at: string;
}

interface PortalApplicationView {
  id: number;
  name: string;
  website: string;
  websites: string[];
  approved_airport_id?: number | null;
  review_status: 'awaiting_payment' | 'pending' | 'reviewed' | 'rejected';
  payment_status: 'unpaid' | 'paid';
  plan_price_month: number;
  has_trial: boolean;
  streaming_support?: AirportStreamingSupport[];
  payment_methods?: AirportPaymentMethod[];
  payment_crypto_other?: string | null;
  profile?: AirportProfile;
  subscription_url: string | null;
  payment_amount: number | null;
  paid_at: string | null;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
  created_at: string;
  review_note?: string | null;
  reviewed_at?: string | null;
}

interface PortalViewResponse {
  account: PortalAccountView;
  application: PortalApplicationView;
  latest_payment_order: PortalPaymentOrderView | null;
  payment_fee_amount: number;
  payment_methods: PaymentChannel[];
  click_price: number;
  admin_telegram_username: string | null;
  recharge_amounts: number[];
  wallet: PortalWalletView;
  ad_status: PortalAirportAdStatus;
  telegram_bot: PortalTelegramBotView;
}

interface PortalAdCampaignFormState {
  months: number;
  coupon_code: string;
  discount_title: string;
  discount_description: string;
  applicable_plan: string;
  is_stackable: boolean;
  refund_supported: boolean;
  discount_percent: string;
}

interface PortalPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

type PaymentChannel = 'alipay' | 'wxpay' | 'usdt';

const PORTAL_BILLING_PAGE_SIZE = 20;

function createPortalAdCampaignForm(campaign?: AirportDealView | null, months = 1): PortalAdCampaignFormState {
  return {
    months,
    coupon_code: campaign?.coupon_code || '',
    discount_title: campaign?.discount_title || '',
    discount_description: campaign?.discount_description || '',
    applicable_plan: campaign?.applicable_plan || '',
    is_stackable: Boolean(campaign?.is_stackable),
    refund_supported: Boolean(campaign?.refund_supported),
    discount_percent: campaign?.discount_percent === null || campaign?.discount_percent === undefined
      ? ''
      : String(campaign.discount_percent),
  };
}

interface PortalLoginResponse {
  token: string;
  expires_at: string;
  account: PortalAccountView;
}

interface PortalTelegramLoginStartResponse {
  login_url: string;
  flow_id: string;
  poll_token: string;
  expires_at: string;
}

interface PortalEmailCodeResponse {
  ok: boolean;
  throttled: boolean;
  expires_at: string;
}

type PortalTelegramLoginCompleteResponse =
  | PortalLoginResponse
  | {
      status: 'pending' | 'failed' | 'expired' | 'consumed';
      error?: string;
    };

const sectionDisplayConfig: Record<
  HomeSectionKey,
  { icon: typeof Flame; color: string; bgClass: string }
> = {
  today_pick: { icon: Flame, color: 'text-orange-500', bgClass: 'bg-orange-500' },
  most_stable: { icon: Trophy, color: 'text-emerald-500', bgClass: 'bg-emerald-500' },
  best_value: { icon: Banknote, color: 'text-sky-500', bgClass: 'bg-sky-500' },
  new_entries: { icon: Plus, color: 'text-indigo-500', bgClass: 'bg-indigo-500' },
  risk_alerts: { icon: AlertTriangle, color: 'text-rose-500', bgClass: 'bg-rose-500' },
};

const sectionOrder: HomeSectionKey[] = [
  'today_pick',
  'new_entries',
  'most_stable',
  'best_value',
  'risk_alerts',
];

const reportCardInteractiveClass =
  'transform-gpu transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_18px_45px_rgba(15,23,42,0.10)] motion-reduce:transition-none motion-reduce:hover:translate-y-0';
const reportInnerTileInteractiveClass =
  'transition-[box-shadow,border-color,background-color] duration-200 ease-out hover:border-slate-200 hover:bg-white hover:shadow-sm motion-reduce:transition-none';
const reportAnchorSections = [
  { id: 'report-overview', label: '概览' },
  { id: 'report-content', label: '测评摘要' },
  { id: 'report-snapshot', label: '数据快照' },
  { id: 'report-capabilities', label: '服务能力' },
  { id: 'report-score', label: '评分拆解' },
  { id: 'report-metrics', label: '核心指标' },
  { id: 'report-trends', label: '趋势' },
  { id: 'report-plan-telegram', label: '套餐电报' },
  { id: 'report-conclusion', label: '结论建议' },
] as const;

const PORTAL_TOKEN_KEY = 'gaterank_portal_token';
const PORTAL_APPLICATION_PAYMENT_SECTION_ID = 'portal-application-payment-section';
const APPLICATION_PAYMENT_REQUIRED_MESSAGE = '请先支付入驻费，支付完成后再充值余额。';
type PortalTabKey = 'overview' | 'ad_campaign' | 'billing_guide' | 'recharge' | 'clicks' | 'transactions' | 'profile' | 'account_settings';
type PortalAdCampaignModalMode = 'closed' | 'create' | 'edit';
const portalNavItems: Array<{ key: PortalTabKey; label: string }> = [
  { key: 'overview', label: '账户概览' },
  { key: 'ad_campaign', label: '广告投放' },
  { key: 'billing_guide', label: '扣费说明' },
  { key: 'recharge', label: '充值' },
  { key: 'clicks', label: '访问记录' },
  { key: 'transactions', label: '扣费流水' },
  { key: 'profile', label: '资料' },
  { key: 'account_settings', label: '账号设置' },
];

function shouldRenderSection(sectionKey: HomeSectionKey, section: HomeSection): boolean {
  if (sectionKey === 'risk_alerts') {
    return section.items.length > 0;
  }
  return true;
}

function formatAirportStatus(status: AirportStatus): string {
  return formatAirportStatusLabel(status);
}

function formatMonitorReason(reason: RiskMonitorItemResponse['monitor_reason']): string {
  return reason === 'down' ? '管理员确认跑路' : '风险观察';
}

function getAirportStatusTone(status: AirportStatus): string {
  switch (status) {
    case 'normal':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'risk':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'down':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-neutral-200 bg-neutral-50 text-neutral-600';
  }
}

function formatCurrency(value: number): string {
  return `¥${formatMetric(value)}/月`;
}

function formatDateLabel(value?: string | null): string {
  if (!value) {
    return '-';
  }
  return value;
}

function formatDateTimeLabel(value?: string | null): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', { hour12: false });
}

function getAdCampaignStatusBadgeClass(status: PortalAirportAdCampaignView['status']): string {
  if (status === 'active') {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
  }
  if (status === 'expired') {
    return 'bg-amber-50 text-amber-700 border border-amber-200';
  }
  return 'bg-slate-50 text-slate-500 border border-slate-200';
}

function formatReportTimeFromNow(
  value?: string | null,
  now: Date = new Date(),
  fallback = '暂无更新',
): string {
  if (!value) {
    return fallback;
  }

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) {
    return fallback;
  }

  const diffMs = Math.max(0, now.getTime() - target.getTime());
  const diffMinutes = Math.floor(diffMs / (60 * 1000));

  if (diffMinutes < 1) {
    return '刚刚';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} 天前`;
}

function formatScoreLabel(value?: number | null): string {
  if (value === null || value === undefined) {
    return '暂不公开';
  }
  return formatMetric(value);
}

function formatScoreFixed2(value: number | null): string {
  if (value === null) {
    return '暂不公开';
  }
  return value.toFixed(2);
}

function formatScoreDelta(value: number | null): string {
  if (value === null) {
    return '--';
  }

  const rounded = Math.round(value * 100) / 100;
  if (rounded > 0) {
    return `+${rounded.toFixed(2)}`;
  }
  if (rounded < 0) {
    return rounded.toFixed(2);
  }
  return '0.00';
}

function getScoreDeltaTone(value: number | null): string {
  if (value === null) {
    return 'text-neutral-400';
  }
  if (value > 0) {
    return 'text-emerald-600';
  }
  if (value < 0) {
    return 'text-rose-600';
  }
  return 'text-neutral-500';
}

function getScoreDeltaToneOnDark(value: number | null): string {
  if (value === null) {
    return 'text-white/55';
  }
  if (value > 0) {
    return 'text-emerald-300';
  }
  if (value < 0) {
    return 'text-rose-300';
  }
  return 'text-white/70';
}

function buildOutboundAirportHref(
  airportId: number,
  target: 'website' | 'subscription_url',
  placement: MarketingPlacement,
): string {
  return `/api/v1/outbound/airports/${airportId}?target=${encodeURIComponent(target)}&placement=${encodeURIComponent(placement)}`;
}

function getStabilityTierLabel(tier: StabilityTier): string {
  switch (tier) {
    case 'stable':
      return '稳定';
    case 'minor_fluctuation':
      return '轻微波动';
    case 'volatile':
      return '异常波动';
  }
}

function getStabilityTierTone(tier: StabilityTier): string {
  switch (tier) {
    case 'stable':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'minor_fluctuation':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'volatile':
      return 'border-rose-200 bg-rose-50 text-rose-700';
  }
}

const ConclusionCard = ({
  type,
  variant = 'default',
  title,
  name,
  website,
  tags,
  score,
  scoreDeltaVsYesterday,
  stabilityTier,
  showStabilityTier = true,
  details,
  conclusion,
  icon,
  reportHref,
  onOpen,
  onWebsiteClick,
}: CardProps) => {
  const styles = {
    stable: 'border-emerald-500/30 bg-white shadow-[4px_4px_0px_0px_rgba(16,185,129,0.1)]',
    value: 'border-sky-500/30 bg-white shadow-[4px_4px_0px_0px_rgba(14,165,233,0.1)]',
    risk: 'border-rose-500/30 bg-white shadow-[4px_4px_0px_0px_rgba(244,63,94,0.1)]',
    new: 'border-sky-500/30 bg-white shadow-[4px_4px_0px_0px_rgba(14,165,233,0.1)]',
  };

  const scoreColors = {
    stable: 'text-emerald-600',
    value: 'text-sky-600',
    risk: 'text-rose-600',
    new: 'text-sky-600',
  };
  const isHomeCompact = variant === 'homeCompact';
  const hasHeading = Boolean(icon || title);
  const cardPadding = isHomeCompact ? 'p-4 md:p-5' : 'p-6 md:p-6';
  const headingMargin = isHomeCompact ? 'mb-3' : 'mb-5';
  const summaryMargin = isHomeCompact ? 'mb-4' : 'mb-5';
  const scoreSize = isHomeCompact ? 'text-2xl md:text-[28px]' : 'text-3xl';
  const tagSpacing = isHomeCompact ? 'gap-1.5 mt-2.5' : 'gap-2 mt-3';
  const detailGridSpacing = isHomeCompact ? 'gap-2 mb-4' : 'gap-3 mb-6';
  const detailPadding = isHomeCompact ? 'p-3' : 'p-4';
  const conclusionMargin = isHomeCompact ? 'mb-4' : 'mb-6';
  const conclusionText = isHomeCompact
    ? 'text-[13px] md:text-sm font-medium leading-5 md:leading-6 text-neutral-600 line-clamp-3 md:line-clamp-2 pl-3 border-l border-neutral-200'
    : 'text-[13px] md:text-sm font-medium leading-6 text-neutral-600 line-clamp-3 pl-4 border-l border-neutral-200';
  const primaryButtonText = isHomeCompact ? '查看报告' : '查看完整报告';
  const websiteButtonText = isHomeCompact ? '官网' : '打开官网';
  const primaryButtonClass = isHomeCompact
    ? 'w-full min-h-12 px-4 py-2.5 rounded-lg bg-neutral-900 text-white text-sm leading-none font-black uppercase tracking-[0.08em] flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors whitespace-nowrap cursor-pointer'
    : 'w-full min-h-11 px-4 py-3 rounded-lg bg-neutral-900 text-white text-[11px] md:text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2.5 hover:bg-neutral-800 transition-colors mt-auto relative z-10 cursor-pointer';
  const websiteButtonClass = isHomeCompact
    ? 'w-full min-h-12 px-4 py-2.5 rounded-lg border border-neutral-200 bg-white text-neutral-700 text-sm leading-none font-black uppercase tracking-[0.08em] flex items-center justify-center gap-2 hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 transition-colors whitespace-nowrap cursor-pointer'
    : 'w-full min-h-11 mt-3 px-4 py-3 rounded-lg bg-neutral-900 text-white text-[11px] md:text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2.5 shadow-[0_14px_32px_rgba(17,17,17,0.18)] hover:bg-neutral-800 transition-colors relative z-10 cursor-pointer';
  const websiteButtonStyle = isHomeCompact ? undefined : primaryCtaTextStyle;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`${cardPadding} rounded-xl border ${styles[type]} transition-all hover:translate-y-[-2px] hover:shadow-xl group h-full flex flex-col relative overflow-hidden`}
    >
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '10px 10px' }}
      />

      {hasHeading && (
        <div className={`flex items-start justify-between gap-4 ${headingMargin} relative z-10`}>
          <div className="flex items-center gap-3">
            {icon && (
              <div className="p-2 rounded-lg bg-neutral-900 text-white">
                {React.cloneElement(icon as React.ReactElement, { size: 18 })}
              </div>
            )}
            {title && <h3 className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-neutral-400">{title}</h3>}
          </div>
        </div>
      )}

      <div className={`${summaryMargin} relative z-10`}>
        <div className="flex items-start justify-between gap-4">
          <span className="font-black text-lg md:text-xl tracking-tight text-neutral-900 leading-tight pr-2">{name}</span>
          <div className="shrink-0 text-right">
            <div className="text-[10px] md:text-[11px] text-neutral-400 uppercase tracking-[0.16em] font-black mb-1">可靠性评分</div>
            <div className={`${scoreSize} font-black font-mono leading-none ${scoreColors[type]}`}>{formatScoreFixed2(score)}</div>
            {scoreDeltaVsYesterday && (
              <>
                <div className={`${isHomeCompact ? 'mt-1.5' : 'mt-2'} text-[10px] md:text-[11px] text-neutral-400 font-black tracking-[0.08em]`}>
                  {scoreDeltaVsYesterday.label}
                </div>
                <div className={`mt-1 text-sm md:text-[15px] font-black font-mono ${getScoreDeltaTone(scoreDeltaVsYesterday.value)}`}>
                  {formatScoreDelta(scoreDeltaVsYesterday.value)}
                </div>
              </>
            )}
          </div>
        </div>
        <div className={`flex flex-wrap ${tagSpacing}`}>
          {tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      </div>

      <div className={`grid grid-cols-2 ${detailGridSpacing} relative z-10`}>
        {details.map((detail, idx) => (
          <div key={`${detail.label}-${idx}`} className={`bg-neutral-50 ${detailPadding} rounded-lg border border-neutral-100`}>
            <div className="text-[11px] md:text-xs text-neutral-400 font-black uppercase tracking-[0.16em] mb-1">{detail.label}</div>
            <div className="text-[15px] md:text-base font-black font-mono text-neutral-800">{detail.value}</div>
          </div>
        ))}
      </div>

      <div className={`${conclusionMargin} relative z-10`}>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-1 h-3 bg-neutral-900" />
          <div className="text-[11px] md:text-xs text-neutral-900 uppercase tracking-[0.18em] font-black">监测结论</div>
          {showStabilityTier && type !== 'risk' && (
            <span className={`ml-auto inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] md:text-[11px] font-black tracking-[0.08em] ${getStabilityTierTone(stabilityTier)}`}>
              {getStabilityTierLabel(stabilityTier)}
            </span>
          )}
        </div>
        <p className={conclusionText}>{conclusion}</p>
      </div>

      <div className={`${isHomeCompact && website ? 'grid grid-cols-2 gap-2' : 'space-y-3'} mt-auto relative z-10`}>
        {isHomeCompact && reportHref ? (
          <a
            href={reportHref}
            className={primaryButtonClass}
            style={primaryCtaTextStyle}
          >
            {primaryButtonText}
            <ChevronRight className="w-3.5 h-3.5" />
          </a>
        ) : (
          <button
            type="button"
            className={primaryButtonClass}
            style={primaryCtaTextStyle}
            onClick={onOpen}
          >
            {primaryButtonText}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
        {website && (
          <a
            href={website}
            target="_blank"
            rel="noreferrer"
            onClick={onWebsiteClick}
            className={websiteButtonClass}
            style={websiteButtonStyle}
          >
            {websiteButtonText}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </motion.div>
  );
};

function MarketingImpressionWrapper({
  airportId,
  placement,
  pageKind,
  pagePath,
  dedupeKey,
  children,
}: {
  airportId: number;
  placement: MarketingPlacement;
  pageKind: MarketingPageKind;
  pagePath?: string;
  dedupeKey?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useMarketingImpression({
    ref,
    airportId,
    placement,
    pageKind,
    pagePath,
    dedupeKey,
  });

  return <div ref={ref}>{children}</div>;
}

const SectionHeader = ({
  icon: Icon,
  title,
  subtitle,
  color = 'text-black',
  bgClass = 'bg-neutral-900',
  extra,
}: {
  icon: typeof Flame;
  title: string;
  subtitle: string;
  color?: string;
  bgClass?: string;
  extra?: React.ReactNode;
}) => {
  const shadowMap: Record<string, string> = {
    'bg-orange-500': 'shadow-orange-500/20',
    'bg-emerald-500': 'shadow-emerald-500/20',
    'bg-sky-500': 'shadow-sky-500/20',
    'bg-indigo-500': 'shadow-indigo-500/20',
    'bg-rose-500': 'shadow-rose-500/20',
    'bg-neutral-900': 'shadow-neutral-900/20',
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7 md:mb-8">
      <div className="flex items-center gap-4 md:gap-5">
        <div className={`w-10 h-10 rounded-xl ${bgClass} flex items-center justify-center text-white shadow-xl ${shadowMap[bgClass] || ''} shrink-0`}>
          <Icon className="w-[18px] h-[18px]" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-black tracking-tight text-neutral-900">{title}</h2>
          <div className="flex items-center gap-2.5 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full bg-current ${color} animate-pulse`} />
            <p className="text-[10px] md:text-[11px] text-neutral-400 font-black uppercase tracking-[0.24em]">{subtitle}</p>
          </div>
        </div>
      </div>
      {extra && <div className="flex items-center">{extra}</div>}
    </div>
  );
};

function getApiBase(): string {
  const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.replace(/\/+$/, '');
  }
  return '';
}

function setPortalToken(_token: string): void {
  localStorage.removeItem(PORTAL_TOKEN_KEY);
}

function clearPortalToken(): void {
  localStorage.removeItem(PORTAL_TOKEN_KEY);
}

function cleanPortalOAuthParams(params: URLSearchParams): void {
  let changed = false;
  for (const key of ['x_login_code', 'x_oauth', 'x_oauth_error']) {
    if (params.has(key)) {
      params.delete(key);
      changed = true;
    }
  }
  if (!changed) {
    return;
  }
  const query = params.toString();
  window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`, { credentials: 'include' });
  if (!response.ok) {
    const data = (await safeJson(response)) as { message?: string } | null;
    throw new Error(data?.message || `请求失败: ${response.status}`);
  }
  return (await safeJson(response)) as T;
}

async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${getApiBase()}${path}`, { ...init, credentials: 'include', headers });
  if (!response.ok) {
    const data = (await safeJson(response)) as { message?: string } | null;
    throw new Error(data?.message || `请求失败: ${response.status}`);
  }
  return (await safeJson(response)) as T;
}

async function portalApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`${getApiBase()}${path}`, { ...init, credentials: 'include', headers });
  if (response.status === 401) {
    clearPortalToken();
    throw new Error('登录已失效，请重新登录');
  }
  if (!response.ok) {
    const data = (await safeJson(response)) as { message?: string } | null;
    throw new Error(data?.message || `请求失败: ${response.status}`);
  }
  return (await safeJson(response)) as T;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getInitialPublicData<T>(
  kind: InitialPublicDataKind,
  matches: (envelope: InitialPublicDataEnvelope<T>) => boolean,
): T | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const element = document.getElementById('__GATERANK_INITIAL_DATA__');
  if (!element?.textContent) {
    return null;
  }

  try {
    const envelope = JSON.parse(element.textContent) as InitialPublicDataEnvelope<T>;
    if (envelope.kind !== kind || !matches(envelope)) {
      return null;
    }
    return envelope.payload;
  } catch {
    return null;
  }
}

function initialDateMatches(value: string | null | undefined, date: string | undefined): boolean {
  return (value ?? null) === (date ?? null);
}

function parseRoute(): RouteState {
  const path = window.location.pathname;
  const reportMatch = path.match(/^\/reports\/(\d+)$/);
  const airportMatch = path.match(/^\/airports\/([a-z0-9-]+)$/);
  const fullRankingMatch = path.match(/^\/rankings\/all\/?$/);
  const dealsMatch = path.match(/^\/deals\/?$/);
  const riskMonitorMatch = path.match(/^\/risk-monitor\/?$/);
  const params = new URLSearchParams(window.location.search);

  if (path === buildMethodologyHref() || path === `${buildMethodologyHref()}/`) {
    return {
      kind: 'methodology',
    };
  }

  if (path === buildPublishTokenDocsHref() || path === `${buildPublishTokenDocsHref()}/`) {
    return {
      kind: 'publish_token_docs',
    };
  }

  if (path === '/apply' || path === '/apply/') {
    return {
      kind: 'apply',
      date: params.get('date') || undefined,
    };
  }

  if (path === '/portal' || path === '/portal/') {
    return {
      kind: 'portal',
      date: params.get('date') || undefined,
    };
  }

  if (reportMatch) {
    return {
      kind: 'report',
      airportId: Number(reportMatch[1]),
      date: params.get('date') || undefined,
    };
  }

  if (airportMatch) {
    return {
      kind: 'report',
      airportSlug: airportMatch[1],
      date: params.get('date') || undefined,
    };
  }

  if (fullRankingMatch) {
    const page = Number(params.get('page') || '1');
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const date = normalizePublicListDate(params.get('date') || undefined);
    const filters = parseFullRankingFilters(params);
    canonicalizeCurrentPublicListUrl(buildFullRankingHref(date, safePage, filters));
    return {
      kind: 'full_ranking',
      date,
      page: safePage,
      filters,
    };
  }

  if (dealsMatch) {
    return {
      kind: 'deals',
    };
  }

  if (riskMonitorMatch) {
    const page = Number(params.get('page') || '1');
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const date = normalizePublicListDate(params.get('date') || undefined);
    canonicalizeCurrentPublicListUrl(buildRiskMonitorHref(date, safePage));
    return {
      kind: 'risk_monitor',
      date,
      page: safePage,
    };
  }

  if (path === '/' || path === '') {
    return {
      kind: 'home',
      date: params.get('date') || undefined,
    };
  }

  return {
    kind: 'not_found',
  };
}

function normalizePublicListDate(date: string | undefined): string | undefined {
  return date === todayInShanghai() ? undefined : date;
}

function canonicalizeCurrentPublicListUrl(canonicalPath: string): void {
  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (currentPath !== canonicalPath) {
    window.history.replaceState({}, '', canonicalPath);
  }
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildReportHref(airportId: number, date?: string): string {
  return `/reports/${airportId}${buildQuery({ date })}`;
}

function toMarketingPageKind(routeKind: RouteState['kind']): MarketingPageKind | null {
  if (routeKind === 'home') return 'home';
  if (routeKind === 'report') return 'report';
  if (routeKind === 'apply') return 'apply';
  if (routeKind === 'full_ranking') return 'full_ranking';
  if (routeKind === 'deals') return 'deals';
  if (routeKind === 'risk_monitor') return 'risk_monitor';
  if (routeKind === 'methodology') return 'methodology';
  if (routeKind === 'publish_token_docs') return 'publish_token_docs';
  return null;
}

function buildPageWindow(currentPage: number, totalPages: number): number[] {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  const pages: number[] = [];
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }
  return pages;
}

function FullRankingFilterPanel({ date, filters }: { date?: string; filters: FullRankingFilters }) {
  const selectedLabels = buildSelectedFullRankingFilterLabels(filters);
  const goToFilters = (nextFilters: FullRankingFilters) => {
    navigate(buildFullRankingHref(date, 1, nextFilters));
  };

  return (
    <section className="mt-8 rounded-[24px] border border-neutral-200 bg-white px-4 py-5 shadow-[0_14px_40px_rgba(15,23,42,0.05)] md:px-6">
      <form
        className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_140px_112px]"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const next = cloneFullRankingFilters(filters);
          next.q = String(form.get('q') || '').trim();
          next.price_min = parsePriceInput(form.get('price_min'));
          next.price_max = parsePriceInput(form.get('price_max'));
          goToFilters(next);
        }}
      >
        <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 px-4">
          <Search className="h-4 w-4 text-neutral-400" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-neutral-800 outline-none placeholder:text-neutral-400"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="搜索机场名称、官网、标签或简介"
          />
        </label>
        <input
          className="min-h-12 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-semibold outline-none"
          name="price_min"
          inputMode="decimal"
          defaultValue={filters.price_min ?? ''}
          placeholder="最低月付"
        />
        <input
          className="min-h-12 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-sm font-semibold outline-none"
          name="price_max"
          inputMode="decimal"
          defaultValue={filters.price_max ?? ''}
          placeholder="最高月付"
        />
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-neutral-900 px-4 text-sm font-black text-white"
        >
          搜索
        </button>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {selectedLabels.length === 0 ? (
          <span className="text-sm font-semibold text-neutral-500">可按支付方式、客户端、节点地区、线路、套餐和 Telegram 支持筛选。</span>
        ) : (
          <>
            {selectedLabels.map((label) => (
              <span key={label} className="inline-flex min-h-9 items-center rounded-full bg-neutral-900 px-3 text-xs font-black text-white">
                {label}
              </span>
            ))}
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700"
              onClick={() => goToFilters(EMPTY_FULL_RANKING_FILTERS)}
            >
              <X className="h-3.5 w-3.5" />
              清空
            </button>
          </>
        )}
      </div>

      <div className="mt-5 grid gap-5">
        <FullRankingFilterGroup title="支付方式" category="payment" options={AIRPORT_PAYMENT_FILTERS} filters={filters} onChange={goToFilters} />
        <FullRankingFilterGroup title="客户端类型" category="client" options={AIRPORT_CLIENT_FILTERS} filters={filters} onChange={goToFilters} />
        <FullRankingFilterGroup title="节点地区" category="region" options={AIRPORT_REGION_FILTERS} filters={filters} onChange={goToFilters} />
        <FullRankingFilterGroup title="线路类型" category="line" options={AIRPORT_LINE_FILTERS} filters={filters} onChange={goToFilters} />
        <FullRankingFilterGroup title="流媒体与服务" category="streaming" options={AIRPORT_STREAMING_FILTERS} filters={filters} onChange={goToFilters} />
        <FullRankingFilterGroup title="导入方式" category="import" options={AIRPORT_IMPORT_FILTERS} filters={filters} onChange={goToFilters} />
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400">套餐与社群</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              ['trial', '支持试用', filters.trial],
              ['annual', '支持年付', filters.annual],
              ['lifetime', '不限时套餐', filters.lifetime],
              ['telegram', 'Telegram 群', filters.telegram],
            ].map(([key, label, value]) => (
              <button
                key={String(key)}
                type="button"
                className={`inline-flex min-h-10 max-w-full items-center rounded-full border px-3 text-sm font-black ${
                  value === true ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-neutral-50 text-neutral-600'
                }`}
                onClick={() => goToFilters(toggleBooleanFullRankingFilter(filters, key as 'trial' | 'annual' | 'lifetime' | 'telegram'))}
              >
                {String(label)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FullRankingFilterGroup({
  title,
  category,
  options,
  filters,
  onChange,
}: {
  title: string;
  category: AirportFilterCategory;
  options: AirportFilterOption[];
  filters: FullRankingFilters;
  onChange: (filters: FullRankingFilters) => void;
}) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.18em] text-neutral-400">{title}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const active = isFullRankingFilterActive(category, option.key, filters);
          return (
            <button
              key={option.key}
              type="button"
              className={`inline-flex min-h-10 max-w-full items-center rounded-full border px-3 text-sm font-black ${
                active ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-neutral-50 text-neutral-600'
              }`}
              onClick={() => onChange(toggleFullRankingFilterValue(filters, category, option.key))}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FullRankingCapabilitySummary({ item }: { item: FullRankingItemResponse }) {
  if (!item.capabilities) {
    return null;
  }
  const regions = item.capabilities.regions.slice(0, 4).map((region) => region.label);
  const capabilities = [
    ...item.capabilities.payment_methods.slice(0, 3).map((capability) => capability.label),
    ...item.capabilities.clients.slice(0, 3).map((capability) => capability.label),
    ...regions,
    item.capabilities.plan.supports_annual ? '年付' : '',
    item.capabilities.plan.has_lifetime_plan ? '不限时套餐' : '',
    item.capabilities.telegram.has_group ? 'Telegram 群' : '',
  ].filter(Boolean);

  if (capabilities.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {capabilities.slice(0, 10).map((label) => {
        const tone = getTagBadgeTone(label);
        return (
          <span key={label} className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-black ${tone.className}`}>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function isFullRankingFilterActive(category: AirportFilterCategory, value: string, filters: FullRankingFilters): boolean {
  return filters[category].includes(value);
}

function toggleFullRankingFilterValue(
  filters: FullRankingFilters,
  category: AirportFilterCategory,
  value: string,
): FullRankingFilters {
  const next = cloneFullRankingFilters(filters);
  next[category] = next[category].includes(value)
    ? next[category].filter((item) => item !== value)
    : [...next[category], value];
  return next;
}

function toggleBooleanFullRankingFilter(
  filters: FullRankingFilters,
  key: 'trial' | 'annual' | 'lifetime' | 'telegram',
): FullRankingFilters {
  const next = cloneFullRankingFilters(filters);
  next[key] = next[key] === true ? null : true;
  return next;
}

function buildSelectedFullRankingFilterLabels(filters: FullRankingFilters): string[] {
  const labels: string[] = [];
  if (filters.q) {
    labels.push(`搜索：${filters.q}`);
  }
  for (const category of ['payment', 'streaming', 'client', 'import', 'region', 'line'] as const) {
    labels.push(...filters[category].map((value) => getAirportFilterLabel(category, value)));
  }
  if (filters.trial !== null) labels.push(filters.trial ? '支持试用' : '无试用');
  if (filters.annual !== null) labels.push(filters.annual ? '支持年付' : '无年付');
  if (filters.lifetime !== null) labels.push(filters.lifetime ? '不限时套餐' : '无不限时套餐');
  if (filters.telegram !== null) labels.push(filters.telegram ? 'Telegram 群' : '无 Telegram 群');
  if (filters.price_min !== null || filters.price_max !== null) {
    labels.push(`月付 ${filters.price_min ?? '不限'}-${filters.price_max ?? '不限'}`);
  }
  return labels;
}

function parsePriceInput(value: FormDataEntryValue | null): number | null {
  const text = String(value || '').trim();
  if (!text) {
    return null;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function StatusPill({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4">
      <div className="text-[11px] md:text-xs text-neutral-400 font-black uppercase tracking-[0.18em] mb-2">{label}</div>
      <div className="text-base md:text-lg font-black text-neutral-900">{value ?? '-'}</div>
    </div>
  );
}

function PortalSectionCard({
  id,
  title,
  description,
  aside,
  children,
}: {
  id?: string;
  title: string;
  description: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="rounded-[30px] border border-slate-200/80 bg-white/90 p-5 md:p-7 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">Applicant Portal</div>
          <h2 className="mt-3 text-xl md:text-2xl font-black tracking-tight text-slate-950">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
        </div>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </motion.section>
  );
}

function PortalInfoCard({
  eyebrow,
  title,
  value,
  tone = 'neutral',
}: {
  eyebrow: string;
  title: string;
  value: string;
  tone?: 'neutral' | 'blue' | 'green' | 'amber' | 'red';
}) {
  const toneMap = {
    neutral: 'border-white/70 bg-white/80 text-slate-900',
    blue: 'border-sky-100 bg-sky-50/95 text-sky-950',
    green: 'border-emerald-100 bg-emerald-50/95 text-emerald-950',
    amber: 'border-amber-100 bg-amber-50/95 text-amber-950',
    red: 'border-rose-200 bg-rose-50/95 text-rose-950',
  };

  return (
    <div className={`rounded-[24px] border px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] ${toneMap[tone]}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{eyebrow}</div>
      <div className="mt-3 text-sm font-medium text-slate-500">{title}</div>
      <div className={`mt-2 break-words text-2xl font-black tracking-tight ${tone === 'red' ? 'text-rose-700' : 'text-slate-950'}`}>{value}</div>
    </div>
  );
}

function PortalLoginEmailCard({
  email,
  onChangeClick,
}: {
  email: string;
  onChangeClick: () => void;
}) {
  return (
    <div className="rounded-[24px] border border-sky-100 bg-sky-50/95 px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Login Email</div>
          <div className="mt-3 text-sm font-medium text-slate-500">登录邮箱</div>
          <div className="mt-2 whitespace-nowrap text-[12px] font-black leading-6 text-slate-950 md:text-sm">{email}</div>
        </div>
        <button
          type="button"
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-sky-50 hover:shadow-lg hover:shadow-sky-500/25"
          onClick={onChangeClick}
        >
          <Mail className="h-4 w-4" />
          修改账号
        </button>
      </div>
    </div>
  );
}

function PortalMetricTile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'blue' | 'green' | 'amber';
}) {
  const toneMap = {
    neutral: 'border-slate-200 bg-slate-50/90',
    blue: 'border-sky-100 bg-sky-50/90',
    green: 'border-emerald-100 bg-emerald-50/90',
    amber: 'border-amber-100 bg-amber-50/90',
  };

  return (
    <div className={`flex min-h-[122px] min-w-0 flex-col justify-between rounded-[24px] border px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] ${toneMap[tone]}`}>
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-4 break-all text-lg font-black leading-snug tracking-tight text-slate-950">{value}</div>
    </div>
  );
}

function PortalReadOnlyBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{value || '-'}</div>
    </div>
  );
}

function PortalDataTable({
  title,
  headers,
  rows,
  emptyText,
  pagination,
}: {
  title: string;
  headers: string[];
  rows: React.ReactNode[][];
  emptyText: string;
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
}) {
  const totalPages = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;
  const firstItemNo = pagination && pagination.total > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const lastItemNo = pagination ? Math.min(pagination.total, pagination.page * pagination.pageSize) : 0;

  return (
    <div className="mt-6 rounded-[24px] border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-black text-slate-950">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              {headers.map((header) => (
                <th key={header} className="whitespace-nowrap px-4 py-3 text-left text-xs font-black uppercase tracking-[0.14em]">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={headers.length}>{emptyText}</td>
              </tr>
            ) : rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`} className="border-t border-slate-100">
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${rowIndex}-${cellIndex}`} className="whitespace-nowrap px-4 py-3 text-slate-700">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && pagination.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <div>
            共 {pagination.total} 条，当前 {firstItemNo}-{lastItemNo} 条
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-black text-slate-600 disabled:opacity-40"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
            >
              上一页
            </button>
            <span className="min-w-16 text-center font-black text-slate-700">
              {pagination.page} / {totalPages}
            </span>
            <button
              type="button"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-black text-slate-600 disabled:opacity-40"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentBrandArtwork({
  tone,
  className = '',
}: {
  tone: 'alipay' | 'wechat' | 'usdt';
  className?: string;
}) {
  if (tone === 'usdt') {
    return (
      <div
        aria-hidden="true"
        className={`flex h-full w-full items-center justify-center rounded-full bg-emerald-500 text-lg font-black text-white ${className}`}
      >
        T
      </div>
    );
  }
  const src = tone === 'alipay' ? '/alipay_logo.png' : '/wechat_logo.png';
  const scaleClass = tone === 'alipay' ? 'scale-[1.06]' : 'scale-[0.98]';

  return (
    <img
      aria-hidden="true"
      src={src}
      alt=""
      className={`block h-full w-full object-contain ${scaleClass} ${className}`}
    />
  );
}

function PaymentMethodCard({
  title,
  tone,
  icon,
  busy,
  disabled,
  buttonLabel,
  onClick,
}: {
  title: string;
  tone: 'alipay' | 'wechat' | 'usdt';
  icon: React.ReactNode;
  busy: boolean;
  disabled: boolean;
  buttonLabel: string;
  onClick: () => void;
}) {
  const palette = tone === 'alipay'
    ? {
        shell: 'border-sky-200 bg-[linear-gradient(135deg,#1677ff_0%,#1153d4_100%)]',
        logoShell: 'rounded-[28px] border border-white/25 bg-white p-3',
        cta: 'bg-white text-sky-700 hover:bg-sky-50',
      }
    : tone === 'wechat'
      ? {
        shell: 'border-emerald-200 bg-[linear-gradient(135deg,#1cb85b_0%,#169b49_100%)]',
        logoShell: 'rounded-full border border-white/25 bg-white p-3.5',
        cta: 'bg-white text-emerald-700 hover:bg-emerald-50',
      }
      : {
        shell: 'border-teal-200 bg-[linear-gradient(135deg,#0f766e_0%,#115e59_100%)]',
        logoShell: 'rounded-full border border-white/25 bg-white p-3.5',
        cta: 'bg-white text-teal-700 hover:bg-teal-50',
      };

  return (
    <motion.div
      whileHover={disabled ? undefined : { y: -4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={`w-full rounded-[24px] border p-4 text-left text-white shadow-[0_18px_40px_rgba(15,23,42,0.10)] ${disabled ? 'opacity-60' : ''} ${palette.shell}`}
    >
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden shadow-[0_12px_24px_rgba(15,23,42,0.12)] ${palette.logoShell}`}>
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[32px] font-black leading-none tracking-tight md:text-[36px]">{title}</div>
          </div>
        </div>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black tracking-[0.04em] shadow-[0_12px_26px_rgba(15,23,42,0.16)] transition disabled:opacity-60 ${palette.cta}`}
          >
            {busy ? '创建中...' : buttonLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function PortalCollapsedApplicationSummary({
  application,
  onEdit,
}: {
  application: PortalApplicationView;
  onEdit: () => void;
}) {
  return (
    <PortalSectionCard
      title="申请资料"
      description="支付前先聚焦完成支付。资料默认收起，这里仅保留关键摘要；如需修改，可通过弹窗编辑完整信息。"
      aside={(
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-[12px] font-black tracking-[0.04em] text-cyan-700 shadow-sm hover:bg-cyan-100"
          onClick={onEdit}
        >
          编辑资料
        </button>
      )}
    >
      <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
        <PortalMetricTile label="机场名称" value={application.name} tone="blue" />
        <PortalMetricTile label="月付价格" value={`¥${formatMetric(application.plan_price_month)}`} tone="amber" />
        <PortalMetricTile label="试用支持" value={application.has_trial ? '支持' : '不支持'} tone="green" />
        <PortalMetricTile label="申请邮箱" value={application.applicant_email} />
      </div>
    </PortalSectionCard>
  );
}

function PortalApplicationEditModal({
  open,
  canEdit,
  currentLoginEmail,
  applicationForm,
  setApplicationForm,
  applicationEmailCode,
  setApplicationEmailCode,
  setApplicationEmailCodeStatus,
  sendingApplicationEmailCode,
  applicationEmailCodeStatus,
  savingApplication,
  error,
  onClose,
  onSendApplicationEmailCode,
  onSubmit,
}: {
  open: boolean;
  canEdit: boolean;
  currentLoginEmail: string;
  applicationForm: ApplicationFormState;
  setApplicationForm: React.Dispatch<React.SetStateAction<ApplicationFormState>>;
  applicationEmailCode: string;
  setApplicationEmailCode: (value: string) => void;
  setApplicationEmailCodeStatus: (value: string) => void;
  sendingApplicationEmailCode: boolean;
  applicationEmailCodeStatus: string;
  savingApplication: boolean;
  error: string;
  onClose: () => void;
  onSendApplicationEmailCode: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  if (!open || !canEdit) {
    return null;
  }

  const isChangingLoginEmail = applicationForm.applicant_email.trim() !== currentLoginEmail.trim();

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[90vh] rounded-[28px] border border-neutral-200 bg-white shadow-[0_32px_120px_-40px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col">
        <div className="border-b border-neutral-200 px-6 py-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">Applicant Portal</div>
            <h3 className="text-2xl font-bold tracking-tight text-slate-950">编辑申请资料</h3>
            <p className="text-sm text-neutral-500">支付前可修改完整资料，保存后会同步回页面摘要区。</p>
          </div>
          <button
            type="button"
            className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6 overscroll-contain">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <PublicFormField label="机场名称">
              <input
                className={portalDisabledInputClass}
                value={applicationForm.name}
                disabled
              />
            </PublicFormField>
            <PublicFormField label="月付价格">
              <input
                className={portalInputClass}
                type="number"
                min="0"
                step="0.01"
                value={applicationForm.plan_price_month}
                onChange={(e) => setApplicationForm((current) => ({ ...current, plan_price_month: e.target.value }))}
                required
              />
            </PublicFormField>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-neutral-900">官网地址</div>
                <div className="mt-1 text-xs text-neutral-500">至少保留一个官网地址，支持多个备用网址。</div>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-neutral-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-neutral-700"
                onClick={() => setApplicationForm((current) => ({ ...current, websites: [...current.websites, ''] }))}
              >
                <Plus className="h-3.5 w-3.5" />
                添加官网
              </button>
            </div>
            <div className="space-y-3">
              {applicationForm.websites.map((website, index) => (
                <div key={`portal-modal-website-${index}`} className="flex items-center gap-3">
                  <input
                    className={portalInputClass}
                    value={website}
                    onChange={(e) => setApplicationForm((current) => ({
                      ...current,
                      websites: updateUrlListItem(current.websites, index, e.target.value),
                    }))}
                    placeholder="https://example.com"
                    required
                  />
                  <button
                    type="button"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm disabled:opacity-40"
                    disabled={applicationForm.websites.length === 1}
                    onClick={() => setApplicationForm((current) => ({
                      ...current,
                      websites: removeUrlListItem(current.websites, index),
                    }))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <PublicFormField label="申请邮箱">
              <input
                className={portalInputClass}
                type="email"
                value={applicationForm.applicant_email}
                onChange={(e) => {
                  setApplicationForm((current) => ({ ...current, applicant_email: e.target.value }));
                  setApplicationEmailCode('');
                  setApplicationEmailCodeStatus('');
                }}
                required
              />
            </PublicFormField>
            <PublicFormField label="Telegram">
              <input
                className={portalInputClass}
                value={applicationForm.applicant_telegram}
                onChange={(e) => setApplicationForm((current) => ({ ...current, applicant_telegram: e.target.value }))}
                required
              />
            </PublicFormField>
            <PublicFormField label="成立时间">
              <input
                className={portalInputClass}
                type="date"
                value={applicationForm.founded_on}
                onChange={(e) => setApplicationForm((current) => ({ ...current, founded_on: e.target.value }))}
                required
              />
            </PublicFormField>
            <PublicFormField label="订阅链接" hint="可选。">
              <input
                className={portalInputClass}
                value={applicationForm.subscription_url}
                onChange={(e) => setApplicationForm((current) => ({ ...current, subscription_url: e.target.value }))}
                placeholder="https://subscribe.example.com"
              />
            </PublicFormField>
          </div>

          {isChangingLoginEmail && (
            <div className="rounded-[24px] border border-sky-100 bg-sky-50/80 px-5 py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-sm font-black text-sky-950">正在修改登录邮箱</div>
                  <div className="mt-2 text-sm leading-6 text-sky-800">
                    新邮箱会成为申请人后台登录账号，保存前必须校验新邮箱验证码。
                  </div>
                  {applicationEmailCodeStatus && (
                    <div className="mt-2 text-xs font-bold text-sky-700">{applicationEmailCodeStatus}</div>
                  )}
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 py-2 text-sm font-black text-sky-700 shadow-sm disabled:opacity-50"
                  onClick={onSendApplicationEmailCode}
                  disabled={sendingApplicationEmailCode}
                >
                  <Mail className="h-4 w-4" />
                  {sendingApplicationEmailCode ? '发送中...' : '发送验证码'}
                </button>
              </div>
              <div className="mt-4">
                <PublicFormField label="新邮箱验证码">
                  <input
                    className={portalInputClass}
                    inputMode="numeric"
                    value={applicationEmailCode}
                    onChange={(e) => setApplicationEmailCode(e.target.value)}
                    placeholder="6 位验证码"
                    required={isChangingLoginEmail}
                  />
                </PublicFormField>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3">
            <input
              id="portal-modal-has-trial"
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-cyan-700"
              checked={applicationForm.has_trial}
              onChange={(e) => setApplicationForm((current) => ({ ...current, has_trial: e.target.checked }))}
            />
            <label htmlFor="portal-modal-has-trial" className="text-sm font-medium text-slate-900">
              支持试用
            </label>
          </div>

          <PublicFormField label="机场简介">
            <textarea
              className={`${portalInputClass} min-h-32`}
              value={applicationForm.airport_intro}
              onChange={(e) => setApplicationForm((current) => ({ ...current, airport_intro: e.target.value }))}
              required
            />
          </PublicFormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <PublicFormField label="测试账号">
              <input
                className={portalInputClass}
                value={applicationForm.test_account}
                onChange={(e) => setApplicationForm((current) => ({ ...current, test_account: e.target.value }))}
                required
              />
            </PublicFormField>
            <PublicFormField label="测试密码">
              <input
                className={portalInputClass}
                value={applicationForm.test_password}
                onChange={(e) => setApplicationForm((current) => ({ ...current, test_password: e.target.value }))}
                required
              />
            </PublicFormField>
          </div>

          <div className="sticky bottom-0 -mx-6 px-6 py-4 border-t border-neutral-200 bg-white/95 backdrop-blur flex items-center justify-end gap-3">
            <button
              type="button"
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-black tracking-[0.04em] text-neutral-700"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className={portalPrimaryButtonClass}
              disabled={savingApplication}
            >
              {savingApplication ? '保存中...' : '保存申请资料'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PortalPasswordRequiredModal({
  open,
  onClose,
  onGoToPassword,
}: {
  open: boolean;
  onClose: () => void;
  onGoToPassword: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_32px_120px_-40px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-amber-700">Password Required</div>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">请先修改密码</h3>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-slate-900"
            onClick={onClose}
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-[22px] border border-amber-100 bg-amber-50 px-4 py-4">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="text-sm leading-7 text-amber-800">
            当前账号仍处于首次登录阶段。完成密码修改后，才能充值余额或创建支付订单。
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
            onClick={onGoToPassword}
          >
            去修改密码
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            稍后再说
          </button>
        </div>
      </div>
    </div>
  );
}

function PortalEmailChangeModal({
  open,
  currentEmail,
  newEmail,
  code,
  sendingCode,
  submitting,
  status,
  error,
  onNewEmailChange,
  onCodeChange,
  onSendCode,
  onClose,
  onSubmit,
}: {
  open: boolean;
  currentEmail: string;
  newEmail: string;
  code: string;
  sendingCode: boolean;
  submitting: boolean;
  status: string;
  error: string;
  onNewEmailChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onSendCode: () => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_32px_120px_-40px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">Login Email</div>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">修改账号</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">当前登录邮箱：{currentEmail}</p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-slate-900"
            onClick={onClose}
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <PublicFormField label="新登录邮箱">
            <input
              className={portalInputClass}
              type="email"
              value={newEmail}
              onChange={(e) => onNewEmailChange(e.target.value)}
              placeholder="new@example.com"
              required
            />
          </PublicFormField>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <PublicFormField label="邮箱验证码">
              <input
                className={portalInputClass}
                inputMode="numeric"
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                placeholder="6 位验证码"
                required
              />
            </PublicFormField>
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 shadow-sm disabled:opacity-50"
              onClick={onSendCode}
              disabled={sendingCode}
            >
              <Mail className="h-4 w-4" />
              {sendingCode ? '发送中...' : '发送验证码'}
            </button>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700" role="alert">
              {error}
            </div>
          )}

          {status && (
            <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-800">
              {status}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <button
              type="button"
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-neutral-300 bg-white px-5 py-3 text-sm font-black tracking-[0.04em] text-neutral-700"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="submit"
              className={portalPrimaryButtonClass}
              disabled={submitting}
            >
              {submitting ? '修改中...' : '确认修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PortalAdCampaignModal({
  open,
  mode,
  applicationName,
  adStatus,
  walletBalance,
  form,
  submitting,
  onFormChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: Exclude<PortalAdCampaignModalMode, 'closed'>;
  applicationName: string;
  adStatus: PortalAirportAdStatus;
  walletBalance: number;
  form: PortalAdCampaignFormState;
  submitting: boolean;
  onFormChange: React.Dispatch<React.SetStateAction<PortalAdCampaignFormState>>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  if (!open) {
    return null;
  }

  const isEdit = mode === 'edit';
  const monthlyPrice = adStatus.monthly_price || AIRPORT_AD_MONTHLY_PRICE;
  const chargeAmount = monthlyPrice * form.months;
  const balanceAfter = walletBalance - chargeAmount;
  const lowBalanceThreshold = adStatus.low_balance_warning_threshold || AIRPORT_AD_LOW_BALANCE_WARNING_THRESHOLD;
  const hasNegativeBalanceAfterCharge = chargeAmount > 0 && balanceAfter < 0;
  const monthOptions = isEdit ? [0, ...adStatus.allowed_months] : adStatus.allowed_months;
  const canSubmit = Boolean(
    form.coupon_code.trim()
      && form.discount_title.trim()
      && form.discount_description.trim()
      && form.applicable_plan.trim()
      && !hasNegativeBalanceAfterCharge
      && !submitting,
  );
  const submitText = submitting
    ? '提交中'
    : isEdit
      ? form.months > 0 ? '保存并续投' : '保存修改'
      : '确认扣费并上架';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_32px_120px_-40px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-700">Ad Campaign</div>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              {isEdit ? '修改投放' : '新建投放'}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {isEdit ? '默认只保存文案，不扣费；选择延时时长后才会按月扣费。' : '填写活动素材并选择投放月份，扣费成功后立即上架。'}
            </p>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-slate-900"
            onClick={onClose}
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <PortalInfoCard eyebrow="Price" title="固定月费" value={`¥${formatMetric(monthlyPrice)} / 月`} tone="blue" />
            <PortalInfoCard eyebrow={isEdit ? 'Extend' : 'Months'} title={isEdit ? '延时时长' : '本次投放'} value={form.months === 0 ? '不要延时' : `${form.months} 个月`} tone="green" />
            <PortalInfoCard eyebrow="Balance" title="扣费后余额" value={`¥${formatMetric(balanceAfter)}`} tone={hasNegativeBalanceAfterCharge ? 'red' : chargeAmount > 0 && balanceAfter < lowBalanceThreshold ? 'amber' : 'green'} />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{isEdit ? '延时时长' : '投放时长'}</label>
                <div className="mt-3 flex flex-wrap gap-2">
                  {monthOptions.map((months) => (
                    <button
                      key={months}
                      type="button"
                      className={`rounded-full px-4 py-2 text-sm font-black ${form.months === months ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                      onClick={() => onFormChange((current) => ({ ...current, months }))}
                    >
                      {months === 0 ? '不要延时' : `${months}个月`}
                    </button>
                  ))}
                </div>
              </div>

              <PortalAdField label="优惠码">
                <input value={form.coupon_code} onChange={(event) => onFormChange((current) => ({ ...current, coupon_code: event.target.value }))} className={portalInputClass} maxLength={64} placeholder="例如 NEW220" required />
              </PortalAdField>
              <PortalAdField label="活动标题">
                <input value={form.discount_title} onChange={(event) => onFormChange((current) => ({ ...current, discount_title: event.target.value }))} className={portalInputClass} maxLength={128} placeholder="例如 新用户首单 8 折" required />
              </PortalAdField>
              <PortalAdField label="折扣说明">
                <textarea value={form.discount_description} onChange={(event) => onFormChange((current) => ({ ...current, discount_description: event.target.value }))} className={`${portalInputClass} min-h-24 py-3`} maxLength={800} placeholder="补齐卡片中的折扣说明，前台会原样展示。" required />
              </PortalAdField>
              <PortalAdField label="适用套餐">
                <input value={form.applicable_plan} onChange={(event) => onFormChange((current) => ({ ...current, applicable_plan: event.target.value }))} className={portalInputClass} maxLength={128} placeholder="例如 月付 / 季付" required />
              </PortalAdField>
              <PortalAdField label="折扣百分比">
                <input value={form.discount_percent} onChange={(event) => onFormChange((current) => ({ ...current, discount_percent: event.target.value }))} className={portalInputClass} inputMode="decimal" placeholder="选填，用于“折扣最高”排序，例如 20" />
              </PortalAdField>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                  <input type="checkbox" checked={form.is_stackable} onChange={(event) => onFormChange((current) => ({ ...current, is_stackable: event.target.checked }))} />
                  可叠加
                </label>
                <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">
                  <input type="checkbox" checked={form.refund_supported} onChange={(event) => onFormChange((current) => ({ ...current, refund_supported: event.target.checked }))} />
                  支持退款
                </label>
              </div>
            </div>

            <div className="h-fit rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-700">Preview</div>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-lg font-black text-slate-950">{applicationName}</div>
                <div className="mt-3 text-sm text-slate-600">优惠码：<span className="font-black text-blue-700">{form.coupon_code || '待填写'}</span></div>
                <div className="mt-2 text-sm text-slate-600">折扣说明：{form.discount_description || '待填写'}</div>
                <div className="mt-2 text-sm text-slate-600">适用套餐：{form.applicable_plan || '待填写'}</div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between"><span>当前余额</span><strong>¥{formatMetric(walletBalance)}</strong></div>
                <div className="flex justify-between"><span>本次扣费</span><strong>¥{formatMetric(chargeAmount)}</strong></div>
                <div className={`flex justify-between ${hasNegativeBalanceAfterCharge ? 'text-rose-700' : ''}`}>
                  <span>扣费后余额</span>
                  <strong>¥{formatMetric(balanceAfter)}</strong>
                </div>
              </div>
              {hasNegativeBalanceAfterCharge && (
                <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold leading-6 text-rose-700">
                  余额不足，请先充值后再投放。
                </div>
              )}
              <button
                type="submit"
                disabled={!canSubmit}
                className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitText}
              </button>
              <p className="mt-3 text-xs leading-6 text-slate-500">
                {chargeAmount > 0
                  ? `扣费后如余额低于 ¥${formatMetric(lowBalanceThreshold)}，系统会要求二次确认。`
                  : '本次只保存文案，不扣除余额，也不会延长到期时间。'}
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

const portalInputClass = 'w-full rounded-[20px] border border-slate-200 bg-white/95 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100';
const portalDisabledInputClass = 'w-full cursor-not-allowed rounded-[20px] border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-400 opacity-75 outline-none shadow-none';
const portalPrimaryButtonClass = 'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-[linear-gradient(135deg,#0f8db3_0%,#0f766e_100%)] px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_32px_rgba(15,118,110,0.18)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-cyan-700/20 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50';
const portalActionButtonBaseClass = 'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-black shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50';
const portalBindButtonBaseClass = `${portalActionButtonBaseClass} h-11 w-[132px] rounded-full px-5 py-2.5 text-sm`;
const portalTelegramBindButtonClass = `${portalBindButtonBaseClass} bg-sky-600 text-white hover:bg-sky-700 hover:shadow-sky-500/25`;
const portalXBindButtonClass = `${portalBindButtonBaseClass} bg-slate-950 text-white hover:bg-slate-800 hover:shadow-slate-900/25`;
const portalUnbindButtonClass = `${portalBindButtonBaseClass} border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 hover:shadow-rose-500/10`;
const portalSidebarRechargeButtonClass = `${portalActionButtonBaseClass} h-9 rounded-full px-3 text-sm text-sky-600 hover:bg-sky-50 hover:text-sky-700 hover:shadow-sky-500/10 focus:outline-none focus:ring-2 focus:ring-sky-200`;
const portalRechargeChannelButtonBaseClass = `${portalActionButtonBaseClass} h-10 w-full rounded-2xl px-3 text-xs text-white`;
const portalLoginButtonBaseClass = `${portalActionButtonBaseClass} h-12 rounded-2xl px-5 text-sm uppercase tracking-[0.18em]`;
const portalLoginSubmitButtonClass = `${portalLoginButtonBaseClass} w-[132px] bg-[linear-gradient(135deg,#0f8db3_0%,#0f766e_100%)] text-white hover:shadow-cyan-700/20`;
const portalLoginXButtonClass = `${portalLoginButtonBaseClass} w-[160px] border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:shadow-slate-900/10`;
const portalLoginTelegramButtonClass = `${portalLoginButtonBaseClass} w-[184px] border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 hover:shadow-sky-500/20`;

function TrendPanel({
  icon: Icon,
  title,
  items,
  suffix = '',
}: {
  icon: typeof ShieldCheck;
  title: string;
  items: Array<{ date: string; value: number }>;
  suffix?: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-neutral-900 text-white flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-sm font-black text-neutral-900">{title}</div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 font-black">Recent 30 Days</div>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-neutral-500">暂无趋势数据</div>
      ) : (
        <div className="space-y-2">
          {items.slice(-8).map((item) => (
            <div key={`${title}-${item.date}`} className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-2 text-sm">
              <span className="font-medium text-neutral-500">{item.date}</span>
              <span className="font-black text-neutral-900">{`${formatMetric(item.value)}${suffix}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center text-sm text-neutral-500">
      {message}
    </div>
  );
}

function ListPageHero({
  eyebrow,
  title,
  subtitle,
  description,
  stats,
  tone = 'default',
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  stats: Array<{ label: string; value: React.ReactNode }>;
  tone?: 'default' | 'alert';
}) {
  const isAlert = tone === 'alert';
  const sectionClassName = isAlert
    ? 'relative overflow-hidden rounded-[32px] border border-neutral-200 bg-[linear-gradient(135deg,#3f0f19_0%,#1f172a_34%,#f7f2f4_100%)] px-6 py-8 md:px-10 md:py-12 text-white shadow-[0_30px_80px_rgba(15,23,42,0.16)]'
    : 'relative overflow-hidden rounded-[32px] border border-neutral-200 bg-[linear-gradient(135deg,#111827_0%,#0f172a_38%,#f8fafc_100%)] px-6 py-8 md:px-10 md:py-12 text-white shadow-[0_30px_80px_rgba(15,23,42,0.16)]';
  const overlayStyle = isAlert
    ? {
        backgroundImage:
          'radial-gradient(circle at top left, rgba(251,113,133,0.34), transparent 34%), radial-gradient(circle at bottom right, rgba(255,255,255,0.22), transparent 30%)',
      }
    : { backgroundImage: 'radial-gradient(circle at top left, rgba(255,255,255,0.28), transparent 35%)' };
  const eyebrowClassName = isAlert
    ? 'inline-flex items-center gap-2 rounded-full border border-rose-200/20 bg-rose-200/8 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-rose-50/88 backdrop-blur'
    : 'inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/80 backdrop-blur';
  const statCardClassName = isAlert
    ? 'rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur'
    : 'rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur';
  const statLabelClassName = isAlert
    ? 'text-[11px] uppercase tracking-[0.18em] text-rose-50/62 font-black'
    : 'text-[11px] uppercase tracking-[0.18em] text-white/60 font-black';
  const subtitleClassName = isAlert ? 'block text-rose-50/42' : 'block text-white/45';

  return (
    <section className={sectionClassName}>
      <div className="absolute inset-0 opacity-20" style={overlayStyle} />
      <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
        <div>
          <div className={eyebrowClassName}>
            {eyebrow}
          </div>
          <h1 className="mt-5 max-w-4xl text-3xl md:text-5xl lg:text-[56px] font-black leading-[0.95] tracking-tight">
            {title}
            <span className={subtitleClassName}>{subtitle}</span>
          </h1>
          <p className="mt-5 max-w-3xl text-sm md:text-base leading-7 text-white/72">
            {description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((item) => (
            <div key={item.label} className={statCardClassName}>
              <div className={statLabelClassName}>{item.label}</div>
              <div className="mt-2 text-3xl font-black text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomePage({ date }: { date?: string }) {
  const initialData = useMemo(
    () => getInitialPublicData<HomePageResponse>(
      'home',
      (envelope) => initialDateMatches(envelope.params?.date, date),
    ),
    [date],
  );
  const [data, setData] = useState<HomePageResponse | null>(() => initialData);
  const [loading, setLoading] = useState(() => !initialData);
  const [error, setError] = useState('');
  const [reportTimeNow, setReportTimeNow] = useState(() => Date.now());

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      setError('');
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');

    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    void apiFetch<HomePageResponse>(`/api/v1/pages/home${query}`)
      .then((next) => {
        if (active) {
          setData(next);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setData(null);
          setError(err instanceof Error ? err.message : '首页加载失败');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [date, initialData]);

  useEffect(() => {
    if (!data?.hero.report_time_at) {
      return undefined;
    }

    setReportTimeNow(Date.now());
    const timer = window.setInterval(() => {
      setReportTimeNow(Date.now());
    }, 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [data?.hero.report_time_at]);

  const homeDate = data?.date || date || '今日';
  const reportTimeText = formatReportTimeFromNow(
    data?.hero.report_time_at ?? null,
    new Date(reportTimeNow),
    data?.hero.report_time_text ?? '暂无更新',
  );
  const homepageSeo = buildHomeSeo(data ? {
    dateLabel: homeDate,
    monitoredAirports: data.hero.monitored_airports,
    realtimeTests: data.hero.realtime_tests,
  } : undefined);
  const homepageTitle = homepageSeo.title;
  const homepageDescription = homepageSeo.description;
  const homepageStructuredData = useMemo(
    () => [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: PUBLIC_SITE_BRAND_NAME,
        url: buildAbsoluteUrl('/'),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: homepageTitle,
        description: homepageDescription,
        url: buildAbsoluteUrl(buildHomeHref(date)),
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: (data?.sections.today_pick.items || []).map((item, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: item.name,
            url: buildAbsoluteUrl(item.report_url),
          })),
        },
      },
    ],
    [data, date, homepageDescription, homepageTitle],
  );

  usePageSeo({
    title: homepageTitle,
    description: homepageDescription,
    keywords: homepageSeo.keywords,
    canonicalPath: buildHomeHref(date),
    structuredData: homepageStructuredData,
  });

  return (
    <PageFrame active="home">
      <header className="max-w-7xl mx-auto px-4 pt-8 md:pt-10 pb-5 md:pb-6 text-center">
        <h1 className="text-[34px] md:text-5xl lg:text-[56px] font-black tracking-tight mb-3 leading-[0.95] text-neutral-900">
          机场榜：机场 VPN 推荐与<span className="text-neutral-400">可靠性榜单</span>
        </h1>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 text-neutral-500">
          <p className="text-[13px] md:text-sm font-medium tracking-tight leading-7">
            首页默认聚焦今日推荐，同时结合长期稳定、性价比、新入榜与风险预警五类榜单，帮助用户从不同角度快速筛选值得关注的机场 VPN 与测评报告。
          </p>
          <div className="hidden md:block w-px h-4 bg-neutral-200" />
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-5">
            <div className="flex items-center gap-2 text-[11px] md:text-xs font-black uppercase tracking-[0.18em]">
              <span className="text-neutral-300"><Search className="w-3.5 h-3.5" /></span>
              <span className="text-neutral-400">监测机场</span>
              <span className="text-neutral-900 font-mono">{formatNumber(data?.hero.monitored_airports || 0)}+</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] md:text-xs font-black uppercase tracking-[0.18em]">
              <span className="text-neutral-300"><Zap className="w-3.5 h-3.5" /></span>
              <span className="text-neutral-400">实时测速</span>
              <span className="text-neutral-900 font-mono">{formatNumber(data?.hero.realtime_tests || 0)}+</span>
            </div>
          </div>
        </div>
        {data?.resolved_from_fallback && data.fallback_notice ? (
          <div className="mt-4 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[11px] md:text-xs font-black tracking-[0.12em] text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              {data.fallback_notice}
            </div>
          </div>
        ) : null}
      </header>

      <main className="max-w-7xl mx-auto px-4 space-y-12 md:space-y-14 flex-grow">
        {loading && <EmptySection message="正在加载最新榜单..." />}
        {error && !loading && <EmptySection message={error} />}

        {!loading && !error && data && sectionOrder.map((sectionKey) => {
          const section = data.sections[sectionKey];
          if (!shouldRenderSection(sectionKey, section)) {
            return null;
          }
          const display = sectionDisplayConfig[sectionKey];
          const extra = sectionKey === 'today_pick'
            ? (
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-neutral-50 border border-neutral-200 text-[11px] md:text-xs font-black text-neutral-500 tracking-[0.18em] uppercase">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                报告时间：{reportTimeText}
              </div>
            )
            : undefined;

          return (
            <section id={sectionKey} key={sectionKey}>
              <SectionHeader
                icon={display.icon}
                title={section.title}
                subtitle={section.subtitle}
                color={display.color}
                bgClass={display.bgClass}
                extra={extra}
              />
              {section.items.length === 0 ? (
                <EmptySection message="当前板块暂无足够数据可展示。" />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {section.items.map((item) => (
                    <div key={`${sectionKey}-${item.airport_id}`}>
                      <MarketingImpressionWrapper
                        airportId={item.airport_id}
                        placement="home_card"
                        pageKind="home"
                        dedupeKey={`home|${sectionKey}|${item.airport_id}`}
                      >
                        <ConclusionCard
                          type={item.type}
                          variant="homeCompact"
                          name={item.name}
                          website={buildOutboundAirportHref(item.airport_id, 'website', 'home_card')}
                          tags={item.tags}
                          score={item.score}
                          scoreDeltaVsYesterday={item.score_delta_vs_yesterday}
                          stabilityTier={item.stability_tier}
                          showStabilityTier={false}
                          details={item.details}
                          conclusion={item.conclusion}
                          reportHref={item.report_url}
                          onWebsiteClick={createTrackedOutboundClickHandler({
                            airportId: item.airport_id,
                            pageKind: 'home',
                            placement: 'home_card',
                            targetKind: 'website',
                            targetUrl: item.website,
                          })}
                        />
                      </MarketingImpressionWrapper>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </PageFrame>
  );
}

function FullRankingPage({
  date,
  page = 1,
  filters = EMPTY_FULL_RANKING_FILTERS,
}: {
  date?: string;
  page?: number;
  filters?: FullRankingFilters;
}) {
  const initialData = useMemo(
    () => getInitialPublicData<FullRankingPageResponse>(
      'full_ranking',
      (envelope) => (
        initialDateMatches(envelope.params?.date, date) &&
        Number(envelope.params?.page || 1) === Math.max(1, page || 1) &&
        fullRankingFiltersEqual(envelope.params?.filters || EMPTY_FULL_RANKING_FILTERS, filters)
      ),
    ),
    [date, page, filters],
  );
  const [data, setData] = useState<FullRankingPageResponse | null>(() => initialData);
  const [loading, setLoading] = useState(() => !initialData);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      setError('');
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');

    const filterQuery = buildFullRankingQuery(filters, {
      date,
      page: page > 1 ? page : undefined,
    });

    void apiFetch<FullRankingPageResponse>(`/api/v1/pages/full-ranking${filterQuery}`)
      .then((next) => {
        if (active) {
          setData(next);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setData(null);
          setError(err instanceof Error ? err.message : '全量榜单加载失败');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [date, page, filters, initialData]);

  const rankingDate = data?.date || date || '今日';
  const safePage = data?.page || page || 1;
  const totalPages = data?.total_pages || 1;
  const visiblePages = buildPageWindow(safePage, totalPages);
  const activeFilters = data?.filters || filters;
  const fullRankingSeo = buildFullRankingSeo(data ? { dateLabel: rankingDate, total: data.total, filters: activeFilters } : { filters: activeFilters });
  const rankingHeading = buildFullRankingHeading(activeFilters);
  const selectedFilterCount = getFullRankingFilterCount(activeFilters);
  const seoDecision = getFullRankingSeoDecision(activeFilters, safePage);
  const canonicalPage = getFullRankingFilterCount(seoDecision.canonicalFilters) > 0 ? 1 : safePage;
  const seoTitle = fullRankingSeo.title;
  const seoDescription = fullRankingSeo.description;
  const seoStructuredData = useMemo(
    () => ([
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: seoTitle,
        description: seoDescription,
        url: buildAbsoluteUrl(buildFullRankingHref(date, safePage, activeFilters)),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: '今日推荐',
            item: buildAbsoluteUrl(buildHomeHref()),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: '全量榜单',
            item: buildAbsoluteUrl(buildFullRankingHref(date, safePage, activeFilters)),
          },
        ],
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListOrder: 'https://schema.org/ItemListOrderDescending',
        numberOfItems: (data?.items || []).filter((item) => Boolean(item.report_url)).length,
        itemListElement: (data?.items || [])
          .filter((item) => Boolean(item.report_url))
          .map((item) => ({
            '@type': 'ListItem',
            position: item.rank,
            name: item.name,
            url: buildAbsoluteUrl(item.report_url as string),
          })),
      },
    ]),
    [activeFilters, data, date, safePage, seoDescription, seoTitle],
  );

  usePageSeo({
    title: seoTitle,
    description: seoDescription,
    keywords: fullRankingSeo.keywords,
    robots: seoDecision.robots,
    canonicalPath: buildFullRankingHref(date, canonicalPage, seoDecision.canonicalFilters),
    structuredData: seoStructuredData,
  });

  return (
    <PageFrame active="full_ranking">
      <main className="max-w-7xl mx-auto px-4 pt-10 md:pt-14 pb-10">
        <ListPageHero
          eyebrow="全量榜单"
          title={rankingHeading}
          subtitle=""
          description={seoDescription}
          stats={[
            { label: '收录机场', value: formatNumber(data?.total || 0) },
            { label: '当前分页', value: `${safePage}/${totalPages}` },
            { label: '已选筛选', value: selectedFilterCount },
            { label: '数据说明', value: <div className="text-sm font-semibold leading-6 text-white/78">仅展示 normal 与 risk 状态机场</div> },
          ]}
        />

        <FullRankingFilterPanel date={date} filters={activeFilters} />

        <section className="mt-10 rounded-[28px] border border-neutral-200 bg-white px-5 py-6 md:px-7 md:py-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-neutral-100 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Ranking Overview</div>
              <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight text-neutral-900">全量榜单列表</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-neutral-500">
                默认每页 20 条。点击官网可在新窗口打开机场主页，点击测评报告可继续查看该机场在稳定性、性能、价格与风险维度的完整说明。
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
              当前结果范围：第 <span className="font-black text-neutral-900">{safePage}</span> 页，共 <span className="font-black text-neutral-900">{totalPages}</span> 页
            </div>
          </div>

          <div className="mt-8">
            {loading && <EmptySection message="正在加载全量榜单..." />}
            {error && !loading && <EmptySection message={error} />}

            {!loading && !error && data && data.items.length === 0 && (
              <EmptySection message="当前日期暂无可展示的机场榜单数据。" />
            )}

            {!loading && !error && data && data.items.length > 0 && (
              <>
                <ol className="space-y-5">
                  {data.items.map((item) => (
                    <li key={`${item.airport_id}-${item.rank}`}>
                      <MarketingImpressionWrapper
                        airportId={item.airport_id}
                        placement="full_ranking_item"
                        pageKind="full_ranking"
                        dedupeKey={`full_ranking|${item.airport_id}|${item.rank}|${safePage}|${buildFullRankingQuery(activeFilters)}`}
                      >
                        <article className="grid gap-5 rounded-[28px] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-[0_20px_55px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_65px_rgba(15,23,42,0.08)] lg:grid-cols-[132px_minmax(0,1fr)_240px] lg:items-start">
                          <div className="rounded-2xl border border-neutral-200 bg-neutral-950 px-4 py-5 text-white">
                            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/55">Rank</div>
                            <div className="mt-2 text-4xl font-black tracking-tight">#{item.rank}</div>
                            <div className="mt-5 border-t border-white/10 pt-4">
                              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/55">Score</div>
                            <div className={`mt-2 text-3xl font-black ${item.score === null ? 'text-white/72' : 'text-emerald-300'}`}>
                              {formatScoreLabel(item.score)}
                            </div>
                            <div className="mt-2 text-[11px] font-black tracking-[0.08em] text-white/55">
                              {item.score_delta_vs_yesterday.label}
                            </div>
                            <div className={`mt-1 text-sm font-black font-mono ${getScoreDeltaToneOnDark(item.score_delta_vs_yesterday.value)}`}>
                              {formatScoreDelta(item.score_delta_vs_yesterday.value)}
                            </div>
                            {item.score_date && (
                              <div className="mt-2 text-[11px] font-semibold tracking-[0.08em] text-white/55">
                                <div>评分日期</div>
                                <div className="mt-1 font-mono text-white/70">{item.score_date}</div>
                              </div>
                            )}
                            </div>
                          </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-2xl font-black tracking-tight text-neutral-900">{item.name}</h3>
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${getAirportStatusTone(item.status)}`}>
                              {formatAirportStatus(item.status)}
                            </span>
                          </div>

                          <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-600">
                            {item.airport_intro?.trim() || '该机场已进入正式榜单，当前公开页提供官网入口、标签、成立日期、价格与试用支持信息，便于用户快速完成横向比较。'}
                          </p>

                          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">成立日期</dt>
                              <dd className="mt-1 font-semibold text-neutral-800">{formatDateLabel(item.founded_on)}</dd>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">月付价格</dt>
                              <dd className="mt-1 font-semibold text-neutral-800">{formatCurrency(item.plan_price_month)}</dd>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">试用支持</dt>
                              <dd className="mt-1 font-semibold text-neutral-800">{item.has_trial ? '支持试用' : '暂不支持'}</dd>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">收录日期</dt>
                              <dd className="mt-1 font-semibold text-neutral-800">{item.created_at}</dd>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">公开分数</dt>
                              <dd className="mt-1 font-semibold text-neutral-800">{formatScoreLabel(item.score)}</dd>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">{item.score_delta_vs_yesterday.label}</dt>
                              <dd className={`mt-1 font-semibold ${getScoreDeltaTone(item.score_delta_vs_yesterday.value)}`}>
                                {formatScoreDelta(item.score_delta_vs_yesterday.value)}
                              </dd>
                            </div>
                          </dl>

                          <TagBadgeGroup tags={item.tags} size="sm" className="mt-5" />
                          <FullRankingCapabilitySummary item={item} />
                        </div>

                        <div className="flex flex-col gap-3 rounded-[24px] border border-neutral-200 bg-white p-4 lg:sticky lg:top-24">
                          <div className="rounded-2xl bg-neutral-50 px-4 py-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">操作入口</div>
                            <p className="mt-2 text-sm leading-6 text-neutral-500">先访问官网，再结合本站测评报告完成判断，能更快对照风险与稳定性变化。</p>
                          </div>
                          <a
                            href={buildOutboundAirportHref(item.airport_id, 'website', 'full_ranking_item')}
                            target="_blank"
                            rel="noreferrer"
                            onClick={createTrackedOutboundClickHandler({
                              airportId: item.airport_id,
                              pageKind: 'full_ranking',
                              placement: 'full_ranking_item',
                              targetKind: 'website',
                              targetUrl: item.website,
                            })}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_32px_rgba(17,17,17,0.18)] transition hover:bg-neutral-800"
                            style={primaryCtaTextStyle}
                          >
                            打开官网
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {item.report_url ? (
                            <a
                              href={item.report_url}
                              data-event="ranking_report_click"
                              data-airport-id={item.airport_id}
                              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900"
                            >
                              查看测评报告
                              <ChevronRight className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="inline-flex min-h-12 cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">
                              暂无测评报告
                            </span>
                          )}
                        </div>
                        </article>
                      </MarketingImpressionWrapper>
                    </li>
                  ))}
                </ol>

                <nav
                  className="mt-8 flex flex-col gap-4 rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4 md:flex-row md:items-center md:justify-between"
                  aria-label="全量榜单分页"
                >
                  <div className="text-sm text-neutral-500">
                    第 <span className="font-black text-neutral-900">{safePage}</span> 页，共 <span className="font-black text-neutral-900">{totalPages}</span> 页
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={safePage <= 1}
                      onClick={() => navigate(buildFullRankingHref(date, safePage - 1, activeFilters))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </button>
                    {visiblePages.map((pageNumber) => (
                      <button
                        key={`page-${pageNumber}`}
                        type="button"
                        className={`min-h-11 min-w-11 rounded-full px-4 py-2 text-sm font-black transition ${
                          pageNumber === safePage
                            ? 'bg-neutral-900 text-white shadow-lg'
                            : 'border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-900 hover:text-neutral-900'
                        }`}
                        onClick={() => navigate(buildFullRankingHref(date, pageNumber, activeFilters))}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={safePage >= totalPages}
                      onClick={() => navigate(buildFullRankingHref(date, safePage + 1, activeFilters))}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </nav>
              </>
            )}
          </div>
        </section>
      </main>
    </PageFrame>
  );
}

function RiskMonitorPage({ date, page = 1 }: { date?: string; page?: number }) {
  const initialData = useMemo(
    () => getInitialPublicData<RiskMonitorPageResponse>(
      'risk_monitor',
      (envelope) => (
        initialDateMatches(envelope.params?.date, date) &&
        Number(envelope.params?.page || 1) === Math.max(1, page || 1)
      ),
    ),
    [date, page],
  );
  const [data, setData] = useState<RiskMonitorPageResponse | null>(() => initialData);
  const [loading, setLoading] = useState(() => !initialData);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      setError('');
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');

    const query = buildQuery({
      date,
      page: page > 1 ? page : undefined,
    });

    void apiFetch<RiskMonitorPageResponse>(`/api/v1/pages/risk-monitor${query}`)
      .then((next) => {
        if (active) {
          setData(next);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setData(null);
          setError(err instanceof Error ? err.message : '跑路监测加载失败');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [date, page, initialData]);

  const rankingDate = data?.date || date || '今日';
  const safePage = data?.page || page || 1;
  const totalPages = data?.total_pages || 1;
  const visiblePages = buildPageWindow(safePage, totalPages);
  const riskMonitorSeo = buildRiskMonitorSeo(data ? { dateLabel: rankingDate, total: data.total } : undefined);
  const seoTitle = riskMonitorSeo.title;
  const seoDescription = riskMonitorSeo.description;
  const seoStructuredData = useMemo(
    () => ([
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: seoTitle,
        description: seoDescription,
        url: buildAbsoluteUrl(buildRiskMonitorHref(date, safePage)),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: '今日推荐',
            item: buildAbsoluteUrl(buildHomeHref()),
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: '跑路监测',
            item: buildAbsoluteUrl(buildRiskMonitorHref(date, safePage)),
          },
        ],
      },
    ]),
    [date, safePage, seoDescription, seoTitle],
  );

  usePageSeo({
    title: seoTitle,
    description: seoDescription,
    keywords: riskMonitorSeo.keywords,
    canonicalPath: buildRiskMonitorHref(date, safePage),
    structuredData: seoStructuredData,
  });

  return (
    <PageFrame active="risk_monitor">
      <main className="max-w-7xl mx-auto px-4 pt-10 md:pt-14 pb-10">
        <ListPageHero
          eyebrow="跑路监测"
          title="跑路机场监测：高风险机场名单与机场跑路预警"
          subtitle=""
          description="本页只展示两类对象：管理员后台已确认跑路的机场，以及标签命中“风险观察”的机场。已跑路机场会从每日测评、自动调度与手动任务中全部排除，仅保留风险留档展示。"
          tone="alert"
          stats={[
            { label: '监测对象', value: formatNumber(data?.total || 0) },
            { label: '当前分页', value: `${safePage}/${totalPages}` },
            { label: '默认页容量', value: data?.page_size || 20 },
            { label: '收录规则', value: <div className="text-sm font-semibold leading-6 text-white/78">仅包含“已跑路”或“风险观察”</div> },
          ]}
        />

        <section className="mt-10 rounded-[28px] border border-neutral-200 bg-white px-5 py-6 md:px-7 md:py-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-4 border-b border-neutral-100 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Risk Monitor</div>
              <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tight text-neutral-900">跑路监测列表</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-neutral-500">
                默认每页 20 条。管理员确认跑路的机场会优先显示，其次展示命中“风险观察”的机场。若存在历史测评快照，仍可继续查看旧报告用于风险回溯。
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
              当前结果范围：第 <span className="font-black text-neutral-900">{safePage}</span> 页，共 <span className="font-black text-neutral-900">{totalPages}</span> 页
            </div>
          </div>

          <div className="mt-8">
            {loading && <EmptySection message="正在加载跑路监测..." />}
            {error && !loading && <EmptySection message={error} />}

            {!loading && !error && data && data.items.length === 0 && (
              <EmptySection message="当前日期暂无需展示的跑路监测对象。" />
            )}

            {!loading && !error && data && data.items.length > 0 && (
              <>
                <ol className="space-y-5">
                  {data.items.map((item) => (
                    <li key={`${item.airport_id}-${item.rank}`}>
                      <MarketingImpressionWrapper
                        airportId={item.airport_id}
                        placement="risk_monitor_item"
                        pageKind="risk_monitor"
                        dedupeKey={`risk_monitor|${item.airport_id}|${item.rank}|${safePage}`}
                      >
                        <article className="grid gap-5 rounded-[28px] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#fff7f7_100%)] p-5 shadow-[0_20px_55px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_65px_rgba(15,23,42,0.08)] lg:grid-cols-[132px_minmax(0,1fr)_240px] lg:items-start">
                        <div className="rounded-2xl border border-neutral-200 bg-neutral-950 px-4 py-5 text-white">
                          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/55">Rank</div>
                          <div className="mt-2 text-4xl font-black tracking-tight">#{item.rank}</div>
                          <div className="mt-5 border-t border-white/10 pt-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/55">Score</div>
                            <div className={`mt-2 text-3xl font-black ${item.score === null ? 'text-white/72' : 'text-rose-300'}`}>
                              {formatScoreLabel(item.score)}
                            </div>
                            <div className="mt-2 text-[11px] font-black tracking-[0.08em] text-white/55">
                              {item.score_delta_vs_yesterday.label}
                            </div>
                            <div className={`mt-1 text-sm font-black font-mono ${getScoreDeltaToneOnDark(item.score_delta_vs_yesterday.value)}`}>
                              {formatScoreDelta(item.score_delta_vs_yesterday.value)}
                            </div>
                            {item.score_date && (
                              <div className="mt-2 text-[11px] font-semibold tracking-[0.08em] text-white/55">
                                快照日期 {item.score_date}
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-2xl font-black tracking-tight text-neutral-900">{item.name}</h3>
                            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${getAirportStatusTone(item.status)}`}>
                              {formatAirportStatus(item.status)}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-rose-700">
                              {formatMonitorReason(item.monitor_reason)}
                            </span>
                          </div>

                          <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-600">
                            {item.monitor_reason === 'down'
                              ? '该机场已由管理员确认进入跑路状态，系统已停止其日常测评、调度与手动任务，仅保留风险留档展示。'
                              : item.risk_reason_summary || '该机场当前命中“风险观察”标签，仍需用户结合官网状态、订阅可用性与历史波动继续判断。'}
                          </p>
                          {item.snapshot_is_stale && item.score_date ? (
                            <p className="mt-2 max-w-3xl text-xs leading-6 text-amber-700">
                              当前说明基于 {item.score_date} 快照，非实时探测结果。
                            </p>
                          ) : null}

                          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">成立日期</dt>
                              <dd className="mt-1 font-semibold text-neutral-800">{formatDateLabel(item.founded_on)}</dd>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">月付价格</dt>
                              <dd className="mt-1 font-semibold text-neutral-800">{formatCurrency(item.plan_price_month)}</dd>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">风险快照</dt>
                              <dd className="mt-1 font-semibold text-neutral-800">
                                {item.score_date
                                  ? `${item.score_date}${item.snapshot_is_stale ? '（非实时）' : ''}`
                                  : '暂无快照'}
                              </dd>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">风险扣分</dt>
                              <dd className="mt-1 font-semibold text-neutral-800">{item.risk_penalty === null ? '-' : formatMetric(item.risk_penalty)}</dd>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">试用支持</dt>
                              <dd className="mt-1 font-semibold text-neutral-800">{item.has_trial ? '支持试用' : '暂不支持'}</dd>
                            </div>
                          </dl>

                          <TagBadgeGroup tags={item.tags} size="sm" className="mt-5" />
                        </div>

                          <div className="flex flex-col gap-3 rounded-[24px] border border-neutral-200 bg-white p-4 lg:sticky lg:top-24">
                            <div className="rounded-2xl bg-neutral-50 px-4 py-4">
                              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">风险操作</div>
                            <p className="mt-2 text-sm leading-6 text-neutral-500">
                              {item.monitor_reason === 'down'
                                ? '已跑路对象默认不再产生新的当日评分快照。'
                                : item.snapshot_is_stale && item.score_date
                                  ? `先核查官网与订阅，再决定是否查看历史测评报告。当前说明基于 ${item.score_date} 快照，非实时探测结果。`
                                  : '先核查官网与订阅，再决定是否查看历史测评报告。'}
                            </p>
                          </div>
                          <a
                            href={buildOutboundAirportHref(item.airport_id, 'website', 'risk_monitor_item')}
                            target="_blank"
                            rel="noreferrer"
                            onClick={createTrackedOutboundClickHandler({
                              airportId: item.airport_id,
                              pageKind: 'risk_monitor',
                              placement: 'risk_monitor_item',
                              targetKind: 'website',
                              targetUrl: item.website,
                            })}
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-[0_14px_32px_rgba(17,17,17,0.18)] transition hover:bg-neutral-800"
                            style={primaryCtaTextStyle}
                          >
                            打开官网
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900 disabled:cursor-not-allowed disabled:border-neutral-100 disabled:bg-neutral-50 disabled:text-neutral-400"
                            disabled={!item.report_url}
                            onClick={() => {
                              if (item.report_url) {
                                navigate(item.report_url);
                              }
                            }}
                          >
                            {item.report_url ? '查看历史测评' : '暂无历史测评'}
                            {item.report_url && <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        </article>
                      </MarketingImpressionWrapper>
                    </li>
                  ))}
                </ol>

                <nav
                  className="mt-8 flex flex-col gap-4 rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4 md:flex-row md:items-center md:justify-between"
                  aria-label="跑路监测分页"
                >
                  <div className="text-sm text-neutral-500">
                    第 <span className="font-black text-neutral-900">{safePage}</span> 页，共 <span className="font-black text-neutral-900">{totalPages}</span> 页
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={safePage <= 1}
                      onClick={() => navigate(buildRiskMonitorHref(date, safePage - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      上一页
                    </button>
                    {visiblePages.map((pageNumber) => (
                      <button
                        key={`risk-page-${pageNumber}`}
                        type="button"
                        className={`min-h-11 min-w-11 rounded-full px-4 py-2 text-sm font-black transition ${
                          pageNumber === safePage
                            ? 'bg-neutral-900 text-white shadow-lg'
                            : 'border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-900 hover:text-neutral-900'
                        }`}
                        onClick={() => navigate(buildRiskMonitorHref(date, pageNumber))}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={safePage >= totalPages}
                      onClick={() => navigate(buildRiskMonitorHref(date, safePage + 1))}
                    >
                      下一页
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </nav>
              </>
            )}
          </div>
        </section>
      </main>
    </PageFrame>
  );
}

function ReportPage({ airportId, airportSlug, date }: { airportId?: number; airportSlug?: string; date?: string }) {
  const [data, setData] = useState<ReportViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    const reportIdentifier = airportSlug || airportId;
    if (!reportIdentifier) {
      setData(null);
      setError('报告加载失败');
      setLoading(false);
      return () => {
        active = false;
      };
    }

    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    void apiFetch<ReportViewResponse>(`/api/v1/airports/${reportIdentifier}/report-view${query}`)
      .then((next) => {
        if (active) {
          setData(next);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setData(null);
          setError(err instanceof Error ? err.message : '报告加载失败');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [airportId, airportSlug, date]);

  const rankPairs = useMemo(() => {
    if (!data) {
      return [];
    }
    return [
      { label: '今日推荐', value: data.ranking.today_pick_rank },
      { label: '长期稳定', value: data.ranking.most_stable_rank },
      { label: '性价比', value: data.ranking.best_value_rank },
      { label: '新入榜', value: data.ranking.new_entries_rank },
      { label: '风险预警', value: data.ranking.risk_alerts_rank },
    ];
  }, [data]);

  const reportSeo = useMemo(() => buildReportSeo(data || undefined), [data]);
  const reportTitle = reportSeo.title;
  const reportDescription = reportSeo.description;
  const reportCanonicalPath = data ? buildAirportReportPath(data.airport.slug) : airportSlug ? buildAirportReportPath(airportSlug) : buildReportHref(airportId || 0, date);
  const reportStructuredData = useMemo(
    () => {
      if (data) {
        const siteUrl = buildAbsoluteUrl('/').replace(/\/+$/, '');
        return buildReportStructuredData(siteUrl, reportCanonicalPath, reportSeo, data);
      }
      return [
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: reportTitle,
          description: reportDescription,
          url: buildAbsoluteUrl(reportCanonicalPath),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: '今日推荐',
              item: buildAbsoluteUrl(buildHomeHref()),
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: airportSlug ? `机场 ${airportSlug}` : `机场 ${airportId}`,
              item: buildAbsoluteUrl(reportCanonicalPath),
            },
          ],
        },
      ];
    },
    [airportId, airportSlug, data, reportCanonicalPath, reportDescription, reportSeo, reportTitle],
  );

  usePageSeo({
    title: reportTitle,
    description: reportDescription,
    keywords: reportSeo.keywords,
    canonicalPath: reportCanonicalPath,
    structuredData: reportStructuredData,
  });

  return (
    <PageFrame active="full_ranking">
      <main id="report-top" className="bg-transparent">
        <div className="mx-auto max-w-7xl px-4 py-3 md:py-4">
          {data && (
            <div className="mb-3 flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[0.12em] text-neutral-400 md:text-xs">
              <span>报告日期：{data.date}</span>
              {data.resolved_from_fallback && data.fallback_notice ? (
                <span className="inline-flex min-w-0 items-center gap-1.5 text-amber-700">
                  <span className="text-neutral-300">·</span>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {data.fallback_notice}
                </span>
              ) : null}
            </div>
          )}

        {loading && <EmptySection message="正在加载完整报告..." />}
        {error && !loading && <EmptySection message={error} />}

        {!loading && !error && data && (
          <>
            <ReportFixedNav />
            <ReportContentV2 data={data} rankPairs={rankPairs} />
          </>
        )}
        </div>
      </main>
    </PageFrame>
  );
}

function scrollToReportAnchor(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function ReportFixedNav() {
  return (
    <nav
      aria-label="报告页面导航"
      className="fixed right-2 top-1/2 z-40 hidden w-20 -translate-y-1/2 flex-col gap-0.5 rounded-[8px] border border-slate-200 bg-white/95 p-1.5 text-[11px] font-black text-slate-500 shadow-[0_14px_34px_rgba(15,23,42,0.12)] backdrop-blur xl:flex"
    >
      {reportAnchorSections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          onClick={(event) => {
            event.preventDefault();
            scrollToReportAnchor(section.id);
          }}
          className="rounded-[6px] px-1.5 py-1.5 text-center leading-tight transition hover:bg-slate-100 hover:text-slate-950"
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}

function ReportContentV2({
  data,
  rankPairs,
}: {
  data: ReportViewResponse;
  rankPairs: Array<{ label: string; value: number | null }>;
}) {
  return (
    <div className="space-y-7 md:space-y-8">
      <MarketingImpressionWrapper
        airportId={data.airport.id}
        placement="report_header"
        pageKind="report"
        dedupeKey={`report|${data.airport.id}`}
      >
        <ReportHeroV2 data={data} />
      </MarketingImpressionWrapper>

      <ReportContentNarrative data={data} />
      <ReportSnapshotGrid data={data} />
      <ReportCapabilitiesSection data={data} />
      <ReportScoreBreakdown data={data} />
      <ReportCoreMetrics data={data} />
      <ReportTrendSection data={data} />
      <ReportPlanTelegramSection data={data} />
      <ReportConclusion data={data} rankPairs={rankPairs} />
    </div>
  );
}

function ReportHeroV2({ data }: { data: ReportViewResponse }) {
  const searchName = data.airport.name.endsWith('机场') ? data.airport.name : `${data.airport.name}机场`;
  return (
    <section id="report-overview" className={`scroll-mt-36 grid gap-6 rounded-[8px] border border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_54%,#eef6ff_100%)] p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_320px] md:p-8 lg:grid-cols-[minmax(0,1fr)_380px] ${reportCardInteractiveClass}`}>
      <div className="min-w-0">
        <div className="mb-4 text-xs font-bold text-slate-500">
          <a
            href={buildHomeHref()}
            onClick={(event) => {
              event.preventDefault();
              navigate(buildHomeHref());
            }}
            className="transition hover:text-slate-950"
          >
            首页
          </a>
          <span className="px-1.5 text-slate-300">/</span>
          {data.airport.name}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
            {searchName}测评：官网入口、稳定性、速度与跑路风险分析
          </h1>
          <span className={`rounded-full border px-3 py-1 text-xs font-black ${getAirportStatusTone(data.airport.status)}`}>
            {formatAirportStatus(data.airport.status)}
          </span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          基于 GateRank 全球节点监测数据，从稳定性、性能、价格与风险四个维度综合评估。
          本页展示 {data.airport.name} 的综合评分、服务能力、关键指标与 {buildReportTrendLabel(data)}，帮助判断是否适合作为机场 VPN 选择。
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.airport.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
          <ReportTag label={data.capabilities.plan.has_trial_plan ? '免费试用' : '试用未收录'} tone="green" />
          <ReportTag label={data.capabilities.plan.lowest_monthly_price === null ? '价格未收录' : `¥${formatMetric(data.capabilities.plan.lowest_monthly_price)}/月起`} tone="blue" />
          <ReportTag label={getStabilityTierLabel(data.metrics.stability_tier)} tone="emerald" />
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={buildOutboundAirportHref(data.airport.id, 'website', 'report_header')}
            target="_blank"
            rel="noreferrer"
            onClick={createTrackedOutboundClickHandler({
              airportId: data.airport.id,
              pageKind: 'report',
              placement: 'report_header',
              targetKind: 'website',
              targetUrl: data.airport.website,
            })}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[8px] bg-slate-950 px-5 text-sm font-black text-white shadow-sm transition hover:bg-slate-800"
            style={primaryCtaTextStyle}
          >
            访问官网
            <ExternalLink className="h-4 w-4" />
          </a>
          <a
            href={buildMethodologyHref()}
            onClick={(event) => {
              event.preventDefault();
              navigate(buildMethodologyHref());
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-[8px] border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
          >
            测评方法
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
      <ReportScoreCard data={data} />
    </section>
  );
}

function ReportContentNarrative({ data }: { data: ReportViewResponse }) {
  const sections = buildReportContentSections(data);
  const summary = buildReportContentSummary(data);

  return (
    <section id="report-content" className={`scroll-mt-36 rounded-[8px] border border-slate-200 bg-white p-5 ${reportCardInteractiveClass}`}>
      <ReportSectionTitle title={`${data.airport.name} 测评摘要`} />
      <div className={`mt-4 rounded-[8px] border border-blue-100 bg-[#f8fbff] p-4 ${reportInnerTileInteractiveClass}`}>
        <p className="text-sm leading-8 text-slate-600 md:text-[15px]">{summary.body}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {summary.chips.map((chip) => (
            <span key={chip} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
              {chip}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {sections.map((section) => (
          <details key={section.title} className={`min-w-0 rounded-[8px] border border-slate-200 bg-slate-50 px-4 py-3 ${reportInnerTileInteractiveClass}`}>
            <summary className="cursor-pointer text-sm font-black tracking-tight text-slate-950 md:text-[15px]">{section.title}</summary>
            <p className="mt-3 text-sm leading-8 text-slate-600">{section.body}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {section.facts.map((fact) => (
                <span key={fact} className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">
                  {fact}
                </span>
              ))}
            </div>
          </details>
        ))}
      </div>
      <ReportComparisonLinks data={data} />
    </section>
  );
}

function ReportComparisonLinks({ data }: { data: ReportViewResponse }) {
  const links = buildReportComparisonLinks(data);
  if (links.length === 0) {
    return null;
  }
  return (
    <div className={`mt-4 rounded-[8px] border border-slate-200 bg-white p-4 ${reportInnerTileInteractiveClass}`}>
      <h3 className="text-sm font-black text-slate-950">继续对比更多机场</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={`${link.label}-${link.href}`}
            href={link.href}
            className="inline-flex min-h-8 items-center rounded-full border border-blue-100 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:border-blue-200 hover:bg-white"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function ReportScoreCard({ data }: { data: ReportViewResponse }) {
  if (data.summary_card.score_hidden || data.summary_card.score === null) {
    return (
      <aside className={`rounded-[8px] border border-slate-200 bg-white p-6 text-center shadow-sm ${reportCardInteractiveClass}`}>
        <div className="text-sm font-black text-slate-800">GateRank Score</div>
        <div className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">暂不公开</div>
        <div className="mt-4 text-sm font-black text-amber-600">余额不足，公开总分暂不展示</div>
      </aside>
    );
  }
  const score = Math.max(0, Math.min(100, data.summary_card.score));
  return (
    <aside className={`rounded-[8px] border border-slate-200 bg-white p-6 text-center shadow-sm ${reportCardInteractiveClass}`}>
      <div className="text-sm font-black text-slate-800">GateRank Score</div>
      <div className="mt-3 flex items-end justify-center gap-2">
        <span className="text-5xl font-black tracking-tight text-slate-950 md:text-6xl">{formatMetric(data.summary_card.score)}</span>
        <span className="pb-2 text-sm font-bold text-slate-500">/100</span>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${score}%` }} />
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600">
        <span>综合评级：</span>
        <span className="font-black text-emerald-600">{getScoreGrade(data.summary_card.score)}</span>
      </div>
    </aside>
  );
}

function ReportSnapshotGrid({ data }: { data: ReportViewResponse }) {
  return (
    <section id="report-snapshot" className="scroll-mt-36 grid grid-cols-2 gap-3 md:grid-cols-5">
      <ReportMetricTile icon={ShieldCheck} label="状态" value={formatAirportStatus(data.airport.status)} tone="green" />
      <ReportMetricTile icon={Clock} label="数据日期" value={data.date} tone="blue" />
      <ReportMetricTile icon={CheckCircle2} label="健康记录" value={`${data.metrics.healthy_days_streak} 天`} tone="rose" />
      <ReportMetricTile icon={Zap} label="稳定性" value={getStabilityTierLabel(data.metrics.stability_tier)} tone="cyan" />
    </section>
  );
}

function ReportCapabilitiesSection({ data }: { data: ReportViewResponse }) {
  return (
    <section id="report-capabilities" className="scroll-mt-36">
      <ReportSectionTitle title="服务能力详情" />
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
        <ReportCapabilityGroup className="lg:col-span-1" title="解锁能力" icon={Zap} items={data.capabilities.streaming} category="streaming" />
        <ReportCapabilityGroup className="lg:col-span-1" title="支付方式" icon={Banknote} items={data.capabilities.payment_methods} category="payment" />
        <ReportCapabilityGroup
          className="lg:col-span-1"
          title="售后支持"
          icon={Headphones}
          items={data.capabilities.telegram.items}
          category="support"
          footnote={formatTelegramFootnote(data)}
        />
        <ReportRegionGroup className="lg:col-span-1" regions={data.capabilities.regions} />
        <ReportCapabilityGroup className="lg:col-span-1" title="客户端支持" icon={ShieldCheck} items={data.capabilities.clients} category="client" />
        <ReportCapabilityGroup className="lg:col-span-1" title="新手引导" icon={ArrowRight} items={data.capabilities.import_methods} category="import" />
      </div>
    </section>
  );
}

function ReportScoreBreakdown({ data }: { data: ReportViewResponse }) {
  const scores = [
    { label: '稳定性 (S)', value: data.score_breakdown.s, color: 'bg-emerald-500', suffix: 'S' },
    { label: '性能 (P)', value: data.score_breakdown.p, color: 'bg-blue-500', suffix: 'P' },
    { label: '价格 (C)', value: data.score_breakdown.c, color: 'bg-orange-500', suffix: 'C' },
    { label: '风险 (R)', value: data.score_breakdown.r, color: 'bg-purple-500', suffix: 'R' },
    { label: '最终分', value: data.score_breakdown.final_score, color: 'bg-emerald-500', suffix: '' },
  ];
  return (
    <section id="report-score" className="scroll-mt-36">
      <ReportSectionTitle title="评分拆解" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {scores.map((item) => (
          <ReportScoreMetric key={item.label} {...item} />
        ))}
      </div>
    </section>
  );
}

function ReportCoreMetrics({ data }: { data: ReportViewResponse }) {
  return (
    <section id="report-metrics" className="scroll-mt-36">
      <ReportSectionTitle title="核心监测指标" />
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <ReportTrendMetric title="30天可用率" value={`${formatMetric(data.metrics.uptime_percent_30d)}%`} points={data.trends.uptime_30d} color="#22c55e" />
        <ReportTrendMetric title="平均延迟" value={`${formatMetric(data.metrics.median_latency_ms)} ms`} points={data.trends.latency_30d} color="#0ea5e9" />
        <ReportTrendMetric title="下载速率" value={`${formatMetric(data.metrics.median_download_mbps)} Mbps`} points={data.trends.download_30d} color="#f97316" />
        <ReportTrendMetric title="丢包率" value={`${formatMetric(data.metrics.packet_loss_percent)}%`} points={[]} color="#8b5cf6" />
      </div>
    </section>
  );
}

function ReportTrendSection({ data }: { data: ReportViewResponse }) {
  return (
    <section id="report-trends" className="scroll-mt-36">
      <ReportSectionTitle title={buildReportTrendLabel(data)} />
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <ReportTrendCard title="评分趋势" points={data.summary_card.score_hidden ? [] : data.trends.score_30d} color="#22c55e" hidden={data.summary_card.score_hidden} />
        <ReportTrendCard title="可用率趋势" points={data.trends.uptime_30d} color="#0ea5e9" suffix="%" />
        <ReportTrendCard title="延迟趋势 (ms)" points={data.trends.latency_30d} color="#64748b" suffix=" ms" />
        <ReportTrendCard title="下载速率趋势 (Mbps)" points={data.trends.download_30d} color="#f97316" suffix=" Mbps" />
      </div>
    </section>
  );
}

function ReportPlanTelegramSection({ data }: { data: ReportViewResponse }) {
  const plan = data.capabilities.plan;
  const telegram = data.capabilities.telegram;
  const planItems: ReportInfoItem[] = [
    { label: '月付套餐', value: formatNullableSupport(plan.supports_monthly) },
    { label: '季付套餐', value: formatNullableSupport(plan.supports_quarterly) },
    { label: '半年付套餐', value: formatNullableSupport(plan.supports_half_yearly) },
    { label: '年付套餐', value: formatNullableSupport(plan.supports_annual) },
    { label: '试用套餐', value: formatNullableSupport(plan.has_trial_plan) },
    { label: '不限时套餐', value: formatNullableSupport(plan.has_lifetime_plan) },
    { label: '最低月付价格', value: formatOptionalCurrency(plan.lowest_monthly_price) },
    { label: '最低年付折算月价', value: formatOptionalCurrency(plan.lowest_annual_monthly_price) },
  ];
  const telegramItems: ReportInfoItem[] = [
    { label: 'Telegram 群', value: formatNullableSupport(telegram.has_group) },
    { label: 'Telegram 群链接', value: telegram.group_url || '未设置', href: telegram.group_url || null },
    { label: 'Telegram 频道', value: formatNullableSupport(telegram.has_channel) },
    { label: 'Telegram 频道链接', value: telegram.channel_url || '未设置', href: telegram.channel_url || null },
    { label: '群内发言权限', value: formatNullableSupport(telegram.group_allows_speaking) },
    { label: '客服 Bot', value: formatNullableSupport(telegram.has_customer_service_bot) },
    { label: '工单系统', value: formatNullableSupport(telegram.has_ticket_system) },
    { label: '群人数', value: telegram.group_member_count === null ? '未设置' : `${formatNumber(telegram.group_member_count)} 人` },
    { label: '最近活跃时间', value: telegram.recent_active_at || '未设置' },
  ];

  return (
    <section id="report-plan-telegram" className="grid scroll-mt-36 gap-3 lg:grid-cols-2">
      <ReportInfoPanel title="套餐信息" items={planItems} />
      <ReportInfoPanel title="电报信息" items={telegramItems} />
    </section>
  );
}

interface ReportInfoItem {
  label: string;
  value: string;
  href?: string | null;
}

function ReportInfoPanel({ title, items }: { title: string; items: ReportInfoItem[] }) {
  return (
    <div className={`rounded-[8px] border border-slate-200 bg-white p-5 ${reportCardInteractiveClass}`}>
      <ReportSectionTitle title={title} />
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className={`min-w-0 rounded-[8px] border border-transparent bg-slate-50 px-3 py-3 ${reportInnerTileInteractiveClass}`}>
            <dt className="text-xs font-bold text-slate-500">{item.label}</dt>
            <dd className="mt-1 min-w-0 text-sm font-black text-slate-950">
              {item.href ? (
                <a
                  href={normalizeExternalHref(item.href)}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-blue-600 underline decoration-blue-200 underline-offset-4 hover:text-blue-800"
                >
                  {item.value}
                </a>
              ) : (
                <span className="break-words">{item.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ReportConclusion({
  data,
  rankPairs,
}: {
  data: ReportViewResponse;
  rankPairs: Array<{ label: string; value: number | null }>;
}) {
  return (
    <section id="report-conclusion" className={`scroll-mt-36 rounded-[8px] border border-slate-200 bg-white p-5 ${reportCardInteractiveClass}`}>
      <ReportSectionTitle title="结论与建议" />
      <p className="mt-4 text-sm leading-7 text-slate-600">
        本次评测数据显示 {data.airport.name} 当前公开总分{formatReportPublicScore(data)}，
        状态为 {formatAirportStatus(data.airport.status)}，稳定性评级为 {getStabilityTierLabel(data.metrics.stability_tier)}。
        建议结合官网可达性、近期投诉、风险惩罚和 30 天趋势一起判断，不仅按单次测速决定是否长期使用。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {rankPairs.map((item) => {
          const tone = getTagBadgeTone(item.label);
          return (
            <span key={item.label} className={`rounded-full border px-3 py-1 text-xs font-black ${tone.className}`}>
              {item.label} {item.value ? `#${item.value}` : '未入榜'}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function ReportSectionTitle({ title }: { title: string }) {
  return <h2 className="text-xl font-black tracking-tight text-slate-950">{title}</h2>;
}

function ReportTag({ label, tone }: { label: string; tone: 'green' | 'blue' | 'emerald' }) {
  const classes = {
    green: 'border-emerald-300/90 bg-[linear-gradient(135deg,#ecfdf5_0%,#d1fae5_55%,#a7f3d0_100%)] text-emerald-900 shadow-[0_10px_24px_-18px_rgba(5,150,105,0.82)]',
    blue: 'border-blue-300/90 bg-[linear-gradient(135deg,#eff6ff_0%,#dbeafe_55%,#bfdbfe_100%)] text-blue-900 shadow-[0_10px_24px_-18px_rgba(37,99,235,0.82)]',
    emerald: 'border-teal-300/90 bg-[linear-gradient(135deg,#f0fdfa_0%,#ccfbf1_55%,#99f6e4_100%)] text-teal-900 shadow-[0_10px_24px_-18px_rgba(13,148,136,0.82)]',
  };
  return <span className={`rounded-full border px-3 py-1 text-xs font-black ${classes[tone]}`}>{label}</span>;
}

function ReportMetricTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  tone: 'green' | 'blue' | 'rose' | 'cyan' | 'red';
}) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    rose: 'bg-rose-50 text-rose-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className={`group flex min-h-[88px] items-center gap-3 rounded-[8px] border border-slate-200 bg-white p-4 shadow-sm ${reportCardInteractiveClass}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] transition-[background-color,box-shadow] duration-200 group-hover:bg-white group-hover:shadow-sm ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold text-slate-500">{label}</div>
        <div className="mt-1 truncate text-base font-black text-slate-950">{value}</div>
      </div>
    </div>
  );
}

function ReportCapabilityGroup({
  title,
  icon: Icon,
  items,
  category,
  footnote,
  className = '',
}: {
  title: string;
  icon: typeof ShieldCheck;
  items: ReportCapabilityItem[];
  category: CapabilityIconCategory;
  footnote?: string | null;
  className?: string;
}) {
  return (
    <div className={`rounded-[8px] border border-slate-200 bg-white p-4 ${reportCardInteractiveClass} ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-black text-slate-950">{title}</h3>
      </div>
      <div className="space-y-2">
        {items.length > 0 ? items.map((item) => (
          <CapabilityLine key={item.key} capabilityKey={item.key} label={item.label} category={category} />
        )) : <EmptyCapabilityLine />}
      </div>
      {footnote ? <div className="mt-3 text-xs font-bold text-slate-400">{footnote}</div> : null}
    </div>
  );
}

function ReportRegionGroup({ regions, className = '' }: { regions: ReportViewResponse['capabilities']['regions']; className?: string }) {
  return (
    <div className={`rounded-[8px] border border-slate-200 bg-white p-4 ${reportCardInteractiveClass} ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-black text-slate-950">节点覆盖</h3>
      </div>
      <div className="space-y-2">
        {regions.length > 0 ? regions.slice(0, 5).map((region) => (
          <CapabilityLine
            key={region.key}
            capabilityKey={region.key}
            category="region"
            label={formatReportRegionLabel(region)}
          />
        )) : <EmptyCapabilityLine />}
      </div>
      {regions.length > 5 ? <div className="mt-3 text-xs font-bold text-slate-400">另有 {regions.length - 5} 个地区</div> : null}
    </div>
  );
}

function formatReportRegionLabel(region: ReportViewResponse['capabilities']['regions'][number]): string {
  const parts = [region.label];
  if (region.node_count > 0) {
    parts.push(`${region.node_count} 节点`);
  }
  if (region.line_types.length > 0) {
    parts.push(region.line_types.join('/'));
  }
  return parts.join(' · ');
}

function CapabilityIcon({ capabilityKey, category }: { capabilityKey: string; category: CapabilityIconCategory }) {
  const icon = getCapabilityIcon(capabilityKey, category);
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[8px] border text-[13px] font-black leading-none"
      style={{ backgroundColor: icon.bg, borderColor: icon.border, color: icon.color }}
      aria-hidden="true"
    >
      {icon.kind === 'svg' ? (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" focusable="false">
          <path d={icon.path} />
        </svg>
      ) : (
        icon.mark
      )}
    </span>
  );
}

function CapabilityLine({
  capabilityKey,
  label,
  category,
}: {
  key?: React.Key;
  capabilityKey: string;
  label: string;
  category: CapabilityIconCategory;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 rounded-[8px] border border-transparent bg-slate-50 px-2.5 py-2 text-sm ${reportInnerTileInteractiveClass}`}>
      <span className="flex min-w-0 items-center gap-2">
        <CapabilityIcon capabilityKey={capabilityKey} category={category} />
        <span className="min-w-0 truncate font-bold text-slate-700">{label}</span>
      </span>
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
    </div>
  );
}

function EmptyCapabilityLine() {
  return <div className={`rounded-[8px] border border-transparent bg-slate-50 px-3 py-2 text-sm font-bold text-slate-400 ${reportInnerTileInteractiveClass}`}>未收录</div>;
}

function ReportScoreMetric({
  label,
  value,
  color,
  suffix,
}: {
    key?: React.Key;
    label: string;
    value: number | null;
    color: string;
    suffix: string;
  }) {
    const width = value === null ? 0 : Math.max(0, Math.min(100, value));
    return (
    <div className={`rounded-[8px] border border-slate-200 bg-white p-4 ${reportCardInteractiveClass}`}>
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
          <span className="text-2xl font-black text-slate-950">{value === null ? '暂不公开' : formatMetric(value)}</span>
        {suffix ? <span className="text-sm font-black text-slate-400">{suffix}</span> : null}
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ReportTrendMetric({
  title,
  value,
  points,
  color,
}: {
  title: string;
  value: string;
  points: Array<{ date: string; value: number }>;
  color: string;
}) {
  return (
    <div className={`rounded-[8px] border border-slate-200 bg-white p-4 ${reportCardInteractiveClass}`}>
      <div className="text-xs font-bold text-slate-500">{title}</div>
      <div className="mt-2 text-xl font-black text-slate-950">{value}</div>
      <div className="mt-3 h-12">
        <Sparkline points={points} color={color} />
      </div>
    </div>
  );
}

function ReportTrendCard({
  title,
  points,
  color,
  suffix = '',
  hidden = false,
}: {
  title: string;
  points: Array<{ date: string; value: number }>;
  color: string;
  suffix?: string;
  hidden?: boolean;
}) {
  const latest = points[points.length - 1];
  return (
    <div className={`rounded-[8px] border border-slate-200 bg-white p-4 ${reportCardInteractiveClass}`}>
      <div className="text-sm font-black text-slate-950">{title}</div>
      <div className="mt-1 text-xs font-bold text-slate-400">{points[0]?.date || '-'} 至 {latest?.date || '-'}</div>
      <div className="mt-4 h-24">
        <Sparkline points={points} color={color} fill />
      </div>
      <div className="mt-3 text-sm font-black text-slate-700">
        最新：{hidden ? '暂不公开' : latest ? `${formatMetric(latest.value)}${suffix}` : '暂无数据'}
      </div>
    </div>
  );
}

function formatReportPublicScore(data: ReportViewResponse): string {
  return data.summary_card.score_hidden || data.summary_card.score === null
    ? '暂不公开'
    : `${formatMetric(data.summary_card.score)} / 100`;
}

function Sparkline({
  points,
  color,
  fill = false,
}: {
  points: Array<{ date: string; value: number }>;
  color: string;
  fill?: boolean;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-full items-center justify-center rounded-[8px] bg-slate-50 text-xs font-bold text-slate-400">
        暂无趋势
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const chartPoints = points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100;
    const y = 92 - ((point.value - min) / range) * 76;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const areaPoints = `0,100 ${chartPoints.join(' ')} 100,100`;

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
      {fill ? <polygon points={areaPoints} fill={color} opacity="0.12" /> : null}
      <polyline points={chartPoints.join(' ')} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function getScoreGrade(score: number): string {
  if (score >= 85) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '观察';
  return '高风险';
}

function formatNullableSupport(value: boolean | null | undefined): string {
  if (value === true) return '支持';
  if (value === false) return '不支持';
  return '未设置';
}

function formatOptionalCurrency(value: number | null | undefined): string {
  return value === null || value === undefined ? '未设置' : `¥${formatMetric(value)}`;
}

function normalizeExternalHref(value: string): string {
  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function formatTelegramFootnote(data: ReportViewResponse): string | null {
  const { group_member_count, recent_active_at } = data.capabilities.telegram;
  if (group_member_count && recent_active_at) {
    return `${formatNumber(group_member_count)} 人 · ${recent_active_at}`;
  }
  if (group_member_count) {
    return `${formatNumber(group_member_count)} 人`;
  }
  return recent_active_at;
}

function ApplicationPage() {
  const [form, setForm] = useState<ApplicationFormState>(() => createApplicationForm());
  const [error, setError] = useState('');
  const [successPayload, setSuccessPayload] = useState<ApplicationSubmitResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showOfficialNotice, setShowOfficialNotice] = useState(true);
  const [applicationFeeAmount, setApplicationFeeAmount] = useState<number | null>(null);
  const [applicationFeeError, setApplicationFeeError] = useState('');

  usePageSeo({
    title: APPLY_SEO.title,
    description: APPLY_SEO.description,
    keywords: APPLY_SEO.keywords,
    canonicalPath: '/apply',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: APPLY_SEO.title,
      description: APPLY_SEO.description,
      url: buildAbsoluteUrl('/apply'),
    },
  });

  useEffect(() => {
    let active = true;
    void apiFetch<ApplicationConfigResponse>('/api/v1/application-config')
      .then((config) => {
        if (!active) return;
        setApplicationFeeAmount(config.application_fee_amount);
        setApplicationFeeError('');
      })
      .catch((err) => {
        if (!active) return;
        setApplicationFeeError(err instanceof Error ? err.message : '入驻费读取失败');
      });
    return () => {
      active = false;
    };
  }, []);

  if (successPayload) {
    return (
      <div className="min-h-screen bg-white font-sans relative">
        <div
          className="fixed inset-0 opacity-[0.015] pointer-events-none z-0"
          style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-10 md:py-14">
          <header className="mb-10 md:mb-12">
            <h1 className="text-4xl md:text-6xl font-black tracking-tight text-neutral-900">
              申请入驻测试
            </h1>
            <p className="mt-5 max-w-4xl text-lg leading-9 text-neutral-600">
              提交后会立即创建你的个人后台账号。首次登录需要修改密码，完成支付后申请才会进入后台待审批列表。
            </p>
          </header>

          <section className="rounded-[2rem] border border-emerald-200 bg-emerald-50/70 p-6 md:p-10">
            <div className="flex items-start gap-3 md:gap-4">
              <CheckCircle2 className="mt-1 h-7 w-7 text-emerald-600" />
              <div>
                <div className="text-2xl font-black text-emerald-900">申请已提交，个人后台账号已开通</div>
                <p className="mt-3 max-w-4xl text-base leading-8 text-emerald-800">
                  初始密码只会在这里展示一次，同时系统也会发送到你的邮箱。请尽快登录个人后台修改密码并完成支付。
                </p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
              <StatusPill label="申请编号" value={`#${successPayload.application_id}`} />
              <StatusPill label="当前状态" value="待支付" />
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
              <ReadonlyCredentialField label="登录邮箱" value={successPayload.portal_email} />
              <ReadonlyCredentialField label="初始密码" value={successPayload.initial_password} />
              <ReadonlyCredentialField label="登录地址" value={successPayload.portal_login_url} />
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                className="portal-login-primary-link inline-flex min-h-14 items-center justify-center gap-3 rounded-[1.4rem] bg-neutral-900 px-7 py-3 text-base font-black text-white shadow-[0_14px_32px_rgba(17,17,17,0.18)] transition hover:bg-neutral-800"
                href={successPayload.portal_login_url}
                target="_blank"
                rel="noreferrer"
              >
                前往个人后台
                <ArrowRight className="h-5 w-5" />
              </a>
              <button
                type="button"
                className="inline-flex min-h-14 items-center gap-3 rounded-[1.4rem] border border-emerald-200 bg-white/70 px-7 py-3 text-base font-black text-neutral-700"
                onClick={() => {
                  navigate('/portal');
                }}
              >
                当前窗口打开后台
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const websites = normalizeUrlList(form.websites);
    if (!form.name.trim()) {
      setError('请填写机场名称');
      return;
    }
    if (websites.length === 0) {
      setError('至少填写一个官网链接');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessPayload(null);

    try {
      const result = await apiRequest<ApplicationSubmitResponse>('/api/v1/airport-applications', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          website: websites[0],
          websites,
          plan_price_month: Number(form.plan_price_month || 0),
          has_trial: form.has_trial,
          subscription_url: form.subscription_url.trim() || null,
          applicant_email: form.applicant_email.trim(),
          applicant_telegram: form.applicant_telegram.trim(),
          founded_on: form.founded_on,
          airport_intro: form.airport_intro.trim(),
          test_account: form.test_account.trim(),
          test_password: form.test_password,
        }),
      });
      setForm(createApplicationForm());
      setSuccessPayload(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans relative">
      {showOfficialNotice && (
        <OfficialApplicationNoticeModal
          feeAmount={applicationFeeAmount}
          error={applicationFeeError}
          onConfirm={() => setShowOfficialNotice(false)}
        />
      )}
      <div
        className="fixed inset-0 opacity-[0.015] pointer-events-none z-0"
        style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-200 bg-white text-sm font-black uppercase tracking-[0.14em]"
            onClick={() => window.close()}
          >
            <ArrowLeft className="w-4 h-4" />
            关闭页面
          </button>
          <a
            href="/"
            className="text-[11px] md:text-xs font-black uppercase tracking-[0.18em] text-neutral-400 hover:text-neutral-900"
          >
            返回首页
          </a>
        </div>

        <header className="mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
            {PUBLIC_SITE_BRAND_NAME} Application
          </div>
          <h1 className="mt-5 text-3xl md:text-5xl font-black tracking-tight text-neutral-900">
            申请入驻测试
          </h1>
          <p className="mt-4 max-w-2xl text-sm md:text-base leading-7 text-neutral-600">
            提交后会立即创建你的个人后台账号。首次登录需要修改密码，完成支付后申请才会进入后台待审批列表。
          </p>
        </header>

        <form onSubmit={submit} className="space-y-6">
          <section className="rounded-3xl border border-neutral-200 bg-neutral-50/70 p-5 md:p-6 space-y-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">机场基础信息</div>
              <p className="mt-2 text-sm text-neutral-500">字段和后台新增机场保持一致，第一条官网会作为主官网。</p>
            </div>

            <PublicFormField label="机场名称" hint="用于后台待审核列表与后续正式录入识别。">
              <input
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="机场官方名称"
                required
              />
            </PublicFormField>

            <PublicFormField label="月付价格" hint="单位按元处理，用于初步判断套餐档位。">
              <input
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                type="number"
                min="0"
                step="0.01"
                value={form.plan_price_month}
                onChange={(e) => setForm({ ...form, plan_price_month: e.target.value })}
                placeholder="例如：15"
                required
              />
            </PublicFormField>

            <div className="rounded-2xl border border-neutral-300 bg-white px-4 py-4">
              <div className="text-sm font-medium text-neutral-900">试用支持</div>
              <p className="mt-1 text-sm text-neutral-500">如果当前支持试用，后台审核时可以更快完成体验确认。</p>
              <label className="mt-4 inline-flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-300"
                  checked={form.has_trial}
                  onChange={(e) => setForm({ ...form, has_trial: e.target.checked })}
                />
                支持试用
              </label>
            </div>

            <div className="space-y-4">
              {form.websites.map((website, index) => (
                <div key={`public-website-${index}`}>
                  <PublicFormField
                    label={index === 0 ? '主官网链接' : `备用网址 ${index}`}
                    hint={index === 0 ? '建议填写当前主站地址。' : '备用网址会一起进入后台详情。'}
                  >
                    <div className="space-y-3">
                      <input
                        className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                        value={website}
                        onChange={(e) => setForm({
                          ...form,
                          websites: updateUrlListItem(form.websites, index, e.target.value),
                        })}
                        placeholder="https://example.com"
                        required={index === 0}
                      />
                      <button
                        type="button"
                        className="rounded-2xl border border-neutral-300 px-3 py-3 text-sm text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={form.websites.length === 1}
                        onClick={() => setForm({
                          ...form,
                          websites: removeUrlListItem(form.websites, index),
                        })}
                      >
                        删除该链接
                      </button>
                    </div>
                  </PublicFormField>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="w-full rounded-2xl border border-dashed border-neutral-400 px-4 py-3 text-sm font-medium text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
              onClick={() => setForm({ ...form, websites: [...form.websites, ''] })}
            >
              继续添加官网链接
            </button>

            <PublicFormField label="订阅链接" hint="如果和官网不同，单独填写更方便后台快速验证。">
              <input
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                value={form.subscription_url}
                onChange={(e) => setForm({ ...form, subscription_url: e.target.value })}
                placeholder="https://example.com/subscribe"
              />
            </PublicFormField>
          </section>

          <section className="rounded-3xl border border-neutral-200 bg-white p-5 md:p-6 space-y-5">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">申请与测试信息</div>
              <p className="mt-2 text-sm text-neutral-500">以下字段为必填，审核人员会用来联系和验证测试环境。</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <PublicFormField label="申请人联系方式邮箱" hint="用于审核结果通知。">
                <input
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                  type="email"
                  value={form.applicant_email}
                  onChange={(e) => setForm({ ...form, applicant_email: e.target.value })}
                  placeholder="contact@example.com"
                  required
                />
              </PublicFormField>

              <PublicFormField label="联系 Telegram 账号" hint="请填写可直接联系的账号。">
                <input
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                  value={form.applicant_telegram}
                  onChange={(e) => setForm({ ...form, applicant_telegram: e.target.value })}
                  placeholder="@telegram"
                  required
                />
              </PublicFormField>
            </div>

            <PublicFormField label="机场成立日期" hint="用于辅助判断服务成熟度。">
              <input
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                type="date"
                max={todayInShanghai()}
                value={form.founded_on}
                onChange={(e) => setForm({ ...form, founded_on: e.target.value })}
                required
              />
            </PublicFormField>

            <PublicFormField label="机场基本介绍" hint="简要说明定位、地区、线路特色或服务亮点。">
              <textarea
                className="min-h-32 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                value={form.airport_intro}
                onChange={(e) => setForm({ ...form, airport_intro: e.target.value })}
                placeholder="请介绍机场特色、主要节点地区、适用人群等。"
                required
              />
            </PublicFormField>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <PublicFormField label="测试账号" hint="后台审核会使用该账号登录验证。">
                <input
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={form.test_account}
                  onChange={(e) => setForm({ ...form, test_account: e.target.value })}
                  placeholder="测试账号"
                  required
                />
              </PublicFormField>

              <PublicFormField label="测试密码" hint="仅后台详情可见。">
                <input
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={form.test_password}
                  onChange={(e) => setForm({ ...form, test_password: e.target.value })}
                  placeholder="测试密码"
                  required
                />
              </PublicFormField>
            </div>
          </section>

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              className="min-h-12 rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-black uppercase tracking-[0.18em] text-white disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? '提交中...' : '提交申请'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OfficialApplicationNoticeModal({
  feeAmount,
  error,
  onConfirm,
}: {
  feeAmount: number | null;
  error: string;
  onConfirm: () => void;
}) {
  const feeText = feeAmount === null ? '' : formatMetric(feeAmount);

  return (
    <div className="fixed inset-0 z-[999] flex min-h-[100dvh] items-start justify-center overflow-y-auto bg-neutral-950/45 px-4 py-8 backdrop-blur-sm sm:items-center sm:py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="application-official-notice-title"
        className="my-auto w-full max-w-lg rounded-[1.75rem] border border-neutral-200 bg-white p-5 shadow-[0_28px_80px_rgba(15,23,42,0.24)] sm:p-6 md:p-7"
      >
        <div className="flex items-center gap-4 border-b border-neutral-100 pb-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-900 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 id="application-official-notice-title" className="min-w-0 text-xl font-black tracking-tight text-neutral-950 sm:text-2xl">
            友情提示
          </h2>
        </div>

        <div className="mt-5 space-y-4">
          <p className="rounded-2xl border border-neutral-100 bg-neutral-50 px-4 py-3 text-sm leading-7 text-neutral-700 sm:text-[15px] sm:leading-8">
            {feeAmount === null
              ? '正在读取入驻费配置，请稍候。'
              : <>机场榜坚持独立、公正收录，入驻可获得测速、展示与后台管理服务。入驻费{feeText}元，仅限USDT支付，请仔细考虑！</>}
          </p>
          <div className="text-right text-sm font-black text-neutral-900">机场榜GateRank官方</div>
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              入驻费读取失败，请刷新页面后再申请。
            </div>
          )}
        </div>

        <button
          type="button"
          className="mt-6 inline-flex w-full min-h-12 cursor-pointer items-center justify-center rounded-2xl bg-neutral-900 px-5 py-3 text-sm font-black text-white transition hover:bg-neutral-800 disabled:cursor-wait disabled:bg-neutral-400"
          disabled={feeAmount === null}
          onClick={onConfirm}
        >
          {feeAmount === null ? '正在读取费用' : '我已知晓，继续申请'}
        </button>
      </section>
    </div>
  );
}

function PortalPage() {
  const createEmptyPortalPage = <T,>(): PortalPaginatedResponse<T> => ({
    items: [],
    total: 0,
    page: 1,
    page_size: PORTAL_BILLING_PAGE_SIZE,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [view, setView] = useState<PortalViewResponse | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoginPasswordVisible, setIsLoginPasswordVisible] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [xOAuthAction, setXOAuthAction] = useState<'' | 'login' | 'bind' | 'unbind'>('');
  const [telegramLoginAction, setTelegramLoginAction] = useState(false);
  const [telegramLoginStatus, setTelegramLoginStatus] = useState('');
  const [telegramBindAction, setTelegramBindAction] = useState<'' | 'bind' | 'unbind'>('');
  const [creatingChannel, setCreatingChannel] = useState<'' | PaymentChannel>('');
  const [creatingRecharge, setCreatingRecharge] = useState('');
  const [cancelingRechargeOrder, setCancelingRechargeOrder] = useState('');
  const [portalTab, setPortalTab] = useState<PortalTabKey>('overview');
  const [rechargeOrders, setRechargeOrders] = useState<PortalPaginatedResponse<PortalRechargeOrderView>>(
    () => createEmptyPortalPage<PortalRechargeOrderView>(),
  );
  const [walletTransactions, setWalletTransactions] = useState<PortalPaginatedResponse<PortalWalletTransactionView>>(
    () => createEmptyPortalPage<PortalWalletTransactionView>(),
  );
  const [clickRecords, setClickRecords] = useState<PortalPaginatedResponse<PortalClickView>>(
    () => createEmptyPortalPage<PortalClickView>(),
  );
  const [applicationForm, setApplicationForm] = useState<ApplicationFormState>(createApplicationForm());
  const [adCampaignForm, setAdCampaignForm] = useState<PortalAdCampaignFormState>(createPortalAdCampaignForm());
  const [adCampaignModalMode, setAdCampaignModalMode] = useState<PortalAdCampaignModalMode>('closed');
  const [editingAdCampaign, setEditingAdCampaign] = useState<PortalAirportAdCampaignView | null>(null);
  const [refreshingAdCampaignStatus, setRefreshingAdCampaignStatus] = useState(false);
  const [submittingAdCampaign, setSubmittingAdCampaign] = useState(false);
  const [cancelingAdCampaignId, setCancelingAdCampaignId] = useState<number | null>(null);
  const [applicationEmailCode, setApplicationEmailCode] = useState('');
  const [sendingApplicationEmailCode, setSendingApplicationEmailCode] = useState(false);
  const [applicationEmailCodeStatus, setApplicationEmailCodeStatus] = useState('');
  const [savingApplication, setSavingApplication] = useState(false);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [isApplicationOperationsEditing, setIsApplicationOperationsEditing] = useState(false);
  const [applicationProfileTab, setApplicationProfileTab] = useState<PortalProfileTab>('basic');
  const [isPasswordRequiredModalOpen, setIsPasswordRequiredModalOpen] = useState(false);
  const [isEmailChangeModalOpen, setIsEmailChangeModalOpen] = useState(false);
  const [newLoginEmail, setNewLoginEmail] = useState('');
  const [emailChangeCode, setEmailChangeCode] = useState('');
  const [sendingEmailChangeCode, setSendingEmailChangeCode] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailChangeStatus, setEmailChangeStatus] = useState('');
  const [emailChangeError, setEmailChangeError] = useState('');
  const passwordChangeRedirectTimerRef = useRef<number | null>(null);
  const telegramLoginRunRef = useRef(0);

  usePageSeo({
    title: `申请人后台 | ${PUBLIC_SITE_BRAND_NAME}`,
    description: 'GateRank 申请人后台用于首次改密、完成支付并查看审批状态。',
    keywords: 'GateRank,申请人后台,支付,审批状态',
    canonicalPath: '/portal',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `申请人后台 | ${PUBLIC_SITE_BRAND_NAME}`,
      description: 'GateRank 申请人后台用于首次改密、完成支付并查看审批状态。',
      url: buildAbsoluteUrl('/portal'),
    },
  });

  const loadView = async (billingPages?: Partial<Record<'recharge' | 'transactions' | 'clicks', number>>) => {
    setLoading(true);
    setError('');
    try {
      let data = await portalApiRequest<PortalViewResponse>('/api/v1/portal/me');
      data = await syncPendingApplicationPayment(data);
      setView(data);
      setLoginEmail(data.account.email);
      await loadPortalBillingData(billingPages);
    } catch (err) {
      clearPortalToken();
      setView(null);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadPortalBillingData = async (
    pages: Partial<Record<'recharge' | 'transactions' | 'clicks', number>> = {},
  ) => {
    const rechargePage = pages.recharge ?? rechargeOrders.page;
    const transactionsPage = pages.transactions ?? walletTransactions.page;
    const clicksPage = pages.clicks ?? clickRecords.page;
    let [orders, transactions, clicks] = await Promise.all([
      portalApiRequest<PortalPaginatedResponse<PortalRechargeOrderView>>(`/api/v1/portal/recharge-orders?page=${rechargePage}&page_size=${PORTAL_BILLING_PAGE_SIZE}`),
      portalApiRequest<PortalPaginatedResponse<PortalWalletTransactionView>>(`/api/v1/portal/wallet-transactions?page=${transactionsPage}&page_size=${PORTAL_BILLING_PAGE_SIZE}`),
      portalApiRequest<PortalPaginatedResponse<PortalClickView>>(`/api/v1/portal/clicks?page=${clicksPage}&page_size=${PORTAL_BILLING_PAGE_SIZE}`),
    ]);
    orders = await syncPendingRechargeOrders(orders);
    setRechargeOrders(orders);
    setWalletTransactions(transactions);
    setClickRecords(clicks);
  };

  const syncPendingApplicationPayment = async (portalView: PortalViewResponse): Promise<PortalViewResponse> => {
    const order = portalView.latest_payment_order;
    if (!order || order.status !== 'created') {
      return portalView;
    }
    try {
      return await portalApiRequest<PortalViewResponse>(
        `/api/v1/portal/payment-orders/${encodeURIComponent(order.out_trade_no)}/sync`,
        { method: 'POST' },
      );
    } catch (err) {
      console.warn('[portal] failed to sync application payment order', err);
      return portalView;
    }
  };

  const syncPendingRechargeOrders = async (
    orders: PortalPaginatedResponse<PortalRechargeOrderView>,
  ): Promise<PortalPaginatedResponse<PortalRechargeOrderView>> => {
    const pendingOrders = orders.items.filter((item) => item.status === 'created');
    if (pendingOrders.length === 0) {
      return orders;
    }
    const synced = await Promise.all(pendingOrders.map(async (order) => {
      try {
        const data = await portalApiRequest<{
          recharge_order: PortalRechargeOrderView | null;
          wallet: PortalWalletView | null;
        }>(
          `/api/v1/portal/recharge-orders/${encodeURIComponent(order.out_trade_no)}/sync`,
          { method: 'POST' },
        );
        if (data.wallet) {
          setView((current) => current ? { ...current, wallet: data.wallet as PortalWalletView } : current);
        }
        return data.recharge_order;
      } catch (err) {
        console.warn('[portal] failed to sync recharge order', err);
        return null;
      }
    }));
    const syncedByOrderNo = new Map(
      synced.filter(Boolean).map((item) => [item!.out_trade_no, item!]),
    );
    return {
      items: orders.items.map((item) => syncedByOrderNo.get(item.out_trade_no) || item),
      total: orders.total,
      page: orders.page,
      page_size: orders.page_size,
    };
  };

  useEffect(() => {
    void initializePortal();
  }, []);

  useEffect(() => {
    setApplicationForm(createPortalApplicationForm(view?.application));
    setApplicationEmailCode('');
    setApplicationEmailCodeStatus('');
  }, [view]);

  useEffect(() => {
    return () => {
      telegramLoginRunRef.current += 1;
      if (passwordChangeRedirectTimerRef.current !== null) {
        window.clearTimeout(passwordChangeRedirectTimerRef.current);
      }
    };
  }, []);

  const resetPortalSession = (options?: { keepSuccess?: boolean }) => {
    if (passwordChangeRedirectTimerRef.current !== null) {
      window.clearTimeout(passwordChangeRedirectTimerRef.current);
      passwordChangeRedirectTimerRef.current = null;
    }
    clearPortalToken();
    setIsApplicationModalOpen(false);
    setIsPasswordRequiredModalOpen(false);
    setIsEmailChangeModalOpen(false);
    setView(null);
    setRechargeOrders(createEmptyPortalPage<PortalRechargeOrderView>());
    setCancelingRechargeOrder('');
    setWalletTransactions(createEmptyPortalPage<PortalWalletTransactionView>());
    setClickRecords(createEmptyPortalPage<PortalClickView>());
    setAdCampaignForm(createPortalAdCampaignForm());
    setAdCampaignModalMode('closed');
    setEditingAdCampaign(null);
    setSubmittingAdCampaign(false);
    setCancelingAdCampaignId(null);
    setPortalTab('overview');
    setLoading(false);
    setLoginPassword('');
    setIsLoginPasswordVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setXOAuthAction('');
    telegramLoginRunRef.current += 1;
    setTelegramLoginAction(false);
    setTelegramLoginStatus('');
    setTelegramBindAction('');
    setApplicationEmailCode('');
    setApplicationEmailCodeStatus('');
    setSendingApplicationEmailCode(false);
    setNewLoginEmail('');
    setEmailChangeCode('');
    setEmailChangeStatus('');
    setEmailChangeError('');
    setSendingEmailChangeCode(false);
    setChangingEmail(false);
    setError('');
    if (!options?.keepSuccess) {
      setSuccess('');
    }
  };

  const initializePortal = async () => {
    const params = new URLSearchParams(window.location.search);
    const xLoginCode = params.get('x_login_code');
    const xOAuthStatus = params.get('x_oauth');
    const xOAuthError = params.get('x_oauth_error');
    cleanPortalOAuthParams(params);

    if (xOAuthError) {
      setError(xOAuthError);
    }
    if (xOAuthStatus === 'bound') {
      setSuccess('X 登录已绑定。');
    }

    if (xLoginCode) {
      setLoading(true);
      setError('');
      setSuccess('');
      try {
        const data = await apiRequest<PortalLoginResponse>('/api/v1/portal/x-oauth/login/complete', {
          method: 'POST',
          body: JSON.stringify({ code: xLoginCode }),
        });
        setPortalToken(data.token);
        setLoginEmail(data.account.email);
        setSuccess('已通过 X 登录。');
      } catch (err) {
        clearPortalToken();
        setView(null);
        setError(err instanceof Error ? err.message : 'X 登录失败');
        setLoading(false);
        return;
      }
    }

    await loadView();
  };

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoggingIn(true);
    setError('');
    setSuccess('');
    try {
      const data = await apiRequest<PortalLoginResponse>('/api/v1/portal/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      setPortalToken(data.token);
      setLoginPassword('');
      setIsLoginPasswordVisible(false);
      await loadView();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoggingIn(false);
    }
  };

  const startXLogin = async () => {
    setXOAuthAction('login');
    setError('');
    setSuccess('');
    try {
      const data = await apiRequest<{ authorization_url: string }>('/api/v1/portal/x-oauth/login/start', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      window.location.href = data.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : '发起 X 登录失败');
      setXOAuthAction('');
    }
  };

  const startTelegramLogin = async () => {
    const runId = telegramLoginRunRef.current + 1;
    telegramLoginRunRef.current = runId;
    setTelegramLoginAction(true);
    setTelegramLoginStatus('正在生成 Telegram 登录链接...');
    setError('');
    setSuccess('');
    try {
      const flow = await apiRequest<PortalTelegramLoginStartResponse>('/api/v1/portal/telegram-login/start', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      window.open(flow.login_url, '_blank', 'noopener,noreferrer');
      setTelegramLoginStatus('请在 Telegram 中点击 Bot 的开始按钮，页面会自动完成登录。');

      const expiresAt = new Date(flow.expires_at).getTime();
      while (Date.now() < expiresAt) {
        await wait(2000);
        if (telegramLoginRunRef.current !== runId) {
          return;
        }

        const data = await apiRequest<PortalTelegramLoginCompleteResponse>('/api/v1/portal/telegram-login/complete', {
          method: 'POST',
          body: JSON.stringify({
            flow_id: flow.flow_id,
            poll_token: flow.poll_token,
          }),
        });
        if ('token' in data) {
          setPortalToken(data.token);
          setLoginEmail(data.account.email);
          setSuccess('已通过 Telegram 登录。');
          setTelegramLoginStatus('');
          await loadView();
          return;
        }
        if (data.status === 'pending') {
          setTelegramLoginStatus(data.error || '等待 Telegram 确认中...');
          continue;
        }
        throw new Error(data.error || 'Telegram 登录失败，请重新发起登录');
      }
      throw new Error('Telegram 登录链接已过期，请重新发起登录');
    } catch (err) {
      if (telegramLoginRunRef.current === runId) {
        clearPortalToken();
        setView(null);
        setError(err instanceof Error ? err.message : 'Telegram 登录失败');
      }
    } finally {
      if (telegramLoginRunRef.current === runId) {
        setTelegramLoginAction(false);
        setTelegramLoginStatus('');
      }
    }
  };

  const startXBind = async () => {
    setXOAuthAction('bind');
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<{ authorization_url: string }>('/api/v1/portal/x-oauth/bind/start', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      window.location.href = data.authorization_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : '发起 X 绑定失败');
      setXOAuthAction('');
    }
  };

  const unbindX = async () => {
    setXOAuthAction('unbind');
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<PortalViewResponse>('/api/v1/portal/x-oauth/unbind', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setView(data);
      setSuccess('X 登录已解除绑定。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '解除 X 绑定失败');
    } finally {
      setXOAuthAction('');
    }
  };

  const startTelegramBind = async () => {
    setTelegramBindAction('bind');
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<{ binding_url: string; expires_at: string }>('/api/v1/portal/telegram-bind/start', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      window.open(data.binding_url, '_blank', 'noopener,noreferrer');
      setSuccess('Telegram 绑定链接已打开，请在 10 分钟内点击 Bot 的开始按钮完成绑定。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成 Telegram 绑定链接失败');
    } finally {
      setTelegramBindAction('');
    }
  };

  const unbindTelegram = async () => {
    setTelegramBindAction('unbind');
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<PortalViewResponse>('/api/v1/portal/telegram-bind/unbind', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setView(data);
      setSuccess('Telegram Bot 绑定已解除。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '解除 Telegram 绑定失败');
    } finally {
      setTelegramBindAction('');
    }
  };

  const sendEmailCodeForAddress = async (
    email: string,
    options: {
      setSending: (value: boolean) => void;
      setStatus: (value: string) => void;
      setError?: (value: string) => void;
    },
  ) => {
    const targetEmail = email.trim();
    const setRequestError = options.setError ?? setError;
    options.setStatus('');
    if (!targetEmail) {
      setRequestError('请先填写新邮箱');
      return;
    }
    options.setSending(true);
    options.setError?.('');
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<PortalEmailCodeResponse>('/api/v1/portal/account/email-code', {
        method: 'POST',
        body: JSON.stringify({ email: targetEmail }),
      });
      options.setStatus(data.throttled
        ? '验证码已发送，请稍后再试；60 秒内不会重复发送。'
        : '验证码已发送，请查看新邮箱。');
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : '发送验证码失败');
    } finally {
      options.setSending(false);
    }
  };

  const sendAccountEmailCode = async () => {
    await sendEmailCodeForAddress(newLoginEmail, {
      setSending: setSendingEmailChangeCode,
      setStatus: setEmailChangeStatus,
      setError: setEmailChangeError,
    });
  };

  const sendApplicationEmailCode = async () => {
    await sendEmailCodeForAddress(applicationForm.applicant_email, {
      setSending: setSendingApplicationEmailCode,
      setStatus: setApplicationEmailCodeStatus,
    });
  };

  const submitAccountEmailChange = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetEmail = newLoginEmail.trim();
    if (!targetEmail) {
      setEmailChangeError('请填写新邮箱');
      return;
    }
    if (!emailChangeCode.trim()) {
      setEmailChangeError('请填写邮箱验证码');
      return;
    }

    setChangingEmail(true);
    setEmailChangeError('');
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<PortalViewResponse>('/api/v1/portal/account/email', {
        method: 'PATCH',
        body: JSON.stringify({
          email: targetEmail,
          code: emailChangeCode.trim(),
        }),
      });
      setView(data);
      setLoginEmail(data.account.email);
      setIsEmailChangeModalOpen(false);
      setSuccess('登录邮箱已更新，请使用新邮箱重新登录。');
      passwordChangeRedirectTimerRef.current = window.setTimeout(() => {
        setLoginEmail(data.account.email);
        resetPortalSession({ keepSuccess: true });
      }, 1000);
    } catch (err) {
      setEmailChangeError(err instanceof Error ? err.message : '修改登录邮箱失败');
    } finally {
      setChangingEmail(false);
    }
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setChangingPassword(true);
    setError('');
    setSuccess('');
    try {
      await portalApiRequest<PortalViewResponse>('/api/v1/portal/password/change', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setSuccess('密码已更新，请使用新密码重新登录。');
      setCurrentPassword('');
      setNewPassword('');
      passwordChangeRedirectTimerRef.current = window.setTimeout(() => {
        resetPortalSession({ keepSuccess: true });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改密码失败');
    } finally {
      setChangingPassword(false);
    }
  };

  const createPaymentOrder = async (channel: PaymentChannel) => {
    const pendingWindow = typeof window !== 'undefined'
      ? window.open('', '_blank')
      : null;
    if (pendingWindow) {
      pendingWindow.document.write('<!doctype html><title>正在跳转支付...</title><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:24px;color:#0f172a">正在跳转到支付页面，请稍候...</body>');
      pendingWindow.document.close();
    }

    setCreatingChannel(channel);
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<{
        payment_order: PortalPaymentOrderView | null;
        application: PortalViewResponse;
      }>('/api/v1/portal/payment-orders', {
        method: 'POST',
        body: JSON.stringify({ channel }),
      });
      setView(data.application);
      const payInfo = data.payment_order?.pay_info || '';
      if (/^https?:\/\//i.test(payInfo)) {
        if (pendingWindow) {
          pendingWindow.location.href = payInfo;
          setSuccess(`${formatPaymentChannelLabel(channel)}支付页已打开，请在新页面完成支付。`);
        } else {
          window.location.href = payInfo;
        }
      } else {
        if (pendingWindow && !pendingWindow.closed) {
          pendingWindow.close();
        }
        setSuccess('支付订单已创建，请使用上方最近支付链接继续支付。');
      }
    } catch (err) {
      if (pendingWindow && !pendingWindow.closed) {
        renderPendingPaymentWindowError(pendingWindow, err);
      }
      setError(err instanceof Error ? err.message : '创建支付订单失败');
    } finally {
      setCreatingChannel('');
      await loadView();
    }
  };

  const createRechargeOrder = async (amount: number, channel: PaymentChannel) => {
    if (redirectToApplicationPaymentIfRequired()) {
      return;
    }
    if (view?.account.must_change_password) {
      setIsPasswordRequiredModalOpen(true);
      return;
    }

    const pendingWindow = typeof window !== 'undefined'
      ? window.open('', '_blank')
      : null;
    if (pendingWindow) {
      pendingWindow.document.write('<!doctype html><title>正在跳转支付...</title><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:24px;color:#0f172a">正在跳转到支付页面，请稍候...</body>');
      pendingWindow.document.close();
    }

    setCreatingRecharge(`${amount}-${channel}`);
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<{
        recharge_order: PortalRechargeOrderView | null;
        wallet: PortalWalletView | null;
      }>('/api/v1/portal/recharge-orders', {
        method: 'POST',
        body: JSON.stringify({ amount, channel }),
      });
      setRechargeOrders((current) => data.recharge_order
        ? {
            ...current,
            page: 1,
            total: current.items.some((item) => item.out_trade_no === data.recharge_order?.out_trade_no)
              ? current.total
              : current.total + 1,
            items: [
              data.recharge_order,
              ...current.items.filter((item) => item.out_trade_no !== data.recharge_order?.out_trade_no),
            ].slice(0, current.page_size),
          }
        : current);
      const payInfo = data.recharge_order?.pay_info || '';
      if (/^https?:\/\//i.test(payInfo)) {
        if (pendingWindow) {
          pendingWindow.location.href = payInfo;
          setSuccess('充值支付页已打开，请在新页面完成支付。');
        } else {
          window.location.href = payInfo;
        }
      } else {
        if (pendingWindow && !pendingWindow.closed) {
          pendingWindow.close();
        }
        setSuccess('充值订单已创建，请使用最近充值订单继续支付。');
      }
    } catch (err) {
      if (pendingWindow && !pendingWindow.closed) {
        renderPendingPaymentWindowError(pendingWindow, err);
      }
      setError(err instanceof Error ? err.message : '创建充值订单失败');
    } finally {
      setCreatingRecharge('');
      await loadView({ recharge: 1 });
    }
  };

  const continueRechargePayment = (order: PortalRechargeOrderView) => {
    if (redirectToApplicationPaymentIfRequired()) {
      return;
    }
    const payInfo = order.pay_info || '';
    setError('');
    setSuccess('');
    if (/^https?:\/\//i.test(payInfo)) {
      window.open(payInfo, '_blank', 'noopener,noreferrer');
      setSuccess('充值支付页已打开，请在新页面完成支付。');
      return;
    }
    setError('当前充值订单没有可继续支付的链接，请取消后重新创建充值订单。');
  };

  const cancelRechargeOrder = async (order: PortalRechargeOrderView) => {
    setCancelingRechargeOrder(order.out_trade_no);
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<{ recharge_order: PortalRechargeOrderView | null }>(
        `/api/v1/portal/recharge-orders/${encodeURIComponent(order.out_trade_no)}/cancel`,
        { method: 'POST' },
      );
      if (data.recharge_order) {
        setRechargeOrders((current) => ({
          ...current,
          items: current.items.map((item) => (
            item.out_trade_no === data.recharge_order?.out_trade_no ? data.recharge_order : item
          )),
        }));
      }
      setSuccess('充值订单已取消');
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消充值订单失败');
    } finally {
      setCancelingRechargeOrder('');
    }
  };

  const saveApplication = async (event: React.FormEvent) => {
    event.preventDefault();
    const websites = normalizeUrlList(applicationForm.websites);
    if (websites.length === 0) {
      setError('至少填写一个官网地址');
      return;
    }
    const targetApplicantEmail = applicationForm.applicant_email.trim();
    const willChangeLoginEmail = Boolean(view && targetApplicantEmail !== view.account.email);
    if (willChangeLoginEmail && !applicationEmailCode.trim()) {
      setError('修改登录邮箱需要填写新邮箱验证码');
      return;
    }

    setSavingApplication(true);
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<PortalViewResponse>('/api/v1/portal/application', {
        method: 'PATCH',
        body: JSON.stringify({
          name: (view?.application.name || applicationForm.name).trim(),
          website: websites[0],
          websites,
          plan_price_month: Number(applicationForm.plan_price_month || 0),
          has_trial: applicationForm.has_trial,
          subscription_url: applicationForm.subscription_url.trim(),
          applicant_email: targetApplicantEmail,
          applicant_telegram: applicationForm.applicant_telegram.trim(),
          founded_on: applicationForm.founded_on,
          airport_intro: applicationForm.airport_intro.trim(),
          test_account: applicationForm.test_account.trim(),
          test_password: applicationForm.test_password,
          ...(willChangeLoginEmail ? { email_code: applicationEmailCode.trim() } : {}),
        }),
      });
      setView(data);
      setLoginEmail(data.account.email);
      setSuccess(willChangeLoginEmail ? '申请资料已保存，登录邮箱已更新，请使用新邮箱重新登录。' : '申请资料已保存');
      setIsApplicationModalOpen(false);
      setApplicationEmailCode('');
      setApplicationEmailCodeStatus('');
      if (willChangeLoginEmail) {
        passwordChangeRedirectTimerRef.current = window.setTimeout(() => {
          setLoginEmail(data.account.email);
          resetPortalSession({ keepSuccess: true });
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存申请资料失败');
    } finally {
      setSavingApplication(false);
    }
  };

  const saveApplicationOperations = async (event: React.FormEvent) => {
    event.preventDefault();
    const websites = normalizeUrlList(applicationForm.websites);
    if (websites.length === 0) {
      setError('至少填写一个官网地址');
      return;
    }

    setSavingApplication(true);
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<PortalViewResponse>('/api/v1/portal/application/operations', {
        method: 'PATCH',
        body: JSON.stringify({
          website: websites[0],
          websites,
          name: (view?.application.name || applicationForm.name).trim(),
          plan_price_month: Number(applicationForm.plan_price_month || 0),
          has_trial: applicationForm.has_trial,
          streaming_support: applicationForm.streaming_support,
          payment_methods: applicationForm.payment_methods,
          payment_crypto_other: applicationForm.payment_methods.includes('crypto_other')
            ? applicationForm.payment_crypto_other.trim()
            : null,
          profile: normalizeAirportProfile(applicationForm.profile),
          subscription_url: applicationForm.subscription_url.trim(),
          applicant_telegram: applicationForm.applicant_telegram.trim(),
          founded_on: applicationForm.founded_on,
          airport_intro: applicationForm.airport_intro.trim(),
          test_account: applicationForm.test_account.trim(),
          test_password: applicationForm.test_password,
        }),
      });
      setView(data);
      setApplicationForm(createPortalApplicationForm(data.application));
      setIsApplicationOperationsEditing(false);
      setApplicationProfileTab('basic');
      setSuccess('运营资料已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存运营资料失败');
    } finally {
      setSavingApplication(false);
    }
  };

  const openApplicationOperationsEditor = () => {
    setApplicationForm(createPortalApplicationForm(view?.application));
    setApplicationProfileTab('basic');
    setError('');
    setSuccess('');
    setIsApplicationOperationsEditing(true);
  };

  const cancelApplicationOperationsEdit = () => {
    setApplicationForm(createPortalApplicationForm(view?.application));
    setApplicationProfileTab('basic');
    setError('');
    setIsApplicationOperationsEditing(false);
  };

  const logout = async () => {
    try {
      await portalApiRequest('/api/v1/portal/logout', { method: 'POST' });
    } catch {
      // Keep logout local even if the session is already expired or the network is unavailable.
    }
    resetPortalSession();
  };

  const openApplicationModal = () => {
    setApplicationForm(createPortalApplicationForm(view?.application));
    setApplicationEmailCode('');
    setApplicationEmailCodeStatus('');
    setError('');
    setSuccess('');
    setIsApplicationModalOpen(true);
  };

  const closeApplicationModal = () => {
    setApplicationForm(createPortalApplicationForm(view?.application));
    setApplicationEmailCode('');
    setApplicationEmailCodeStatus('');
    setError('');
    setIsApplicationModalOpen(false);
  };

  const openEmailChangeModal = () => {
    setNewLoginEmail('');
    setEmailChangeCode('');
    setEmailChangeStatus('');
    setEmailChangeError('');
    setError('');
    setSuccess('');
    setIsEmailChangeModalOpen(true);
  };

  const closeEmailChangeModal = () => {
    setNewLoginEmail('');
    setEmailChangeCode('');
    setEmailChangeStatus('');
    setEmailChangeError('');
    setError('');
    setIsEmailChangeModalOpen(false);
  };

  const refreshAdCampaignStatus = async (): Promise<PortalAirportAdStatus | null> => {
    setRefreshingAdCampaignStatus(true);
    setError('');
    try {
      const nextStatus = await portalApiRequest<PortalAirportAdStatus>('/api/v1/portal/ad-campaign');
      setView((current) => current
        ? {
            ...current,
            ad_status: nextStatus,
          }
        : current);
      return nextStatus;
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新广告投放配置失败');
      setSuccess('');
      return null;
    } finally {
      setRefreshingAdCampaignStatus(false);
    }
  };

  const openCreateAdCampaignModal = async () => {
    if (!view) return;
    if (redirectToApplicationPaymentIfRequired()) {
      return;
    }
    if (view.account.must_change_password) {
      setIsPasswordRequiredModalOpen(true);
      return;
    }
    if (view.application.review_status !== 'reviewed') {
      setError('申请审核通过后才能投放广告');
      setSuccess('');
      return;
    }
    if (!view.application.approved_airport_id) {
      setError('当前申请尚未绑定已审核机场');
      setSuccess('');
      return;
    }
    const latestAdStatus = await refreshAdCampaignStatus();
    if (!latestAdStatus) {
      return;
    }
    if (latestAdStatus.remaining_slots <= 0) {
      setError('当前 6 个广告位已满，空位释放后可继续投放');
      setSuccess('');
      return;
    }
    setAdCampaignForm(createPortalAdCampaignForm(null, 1));
    setEditingAdCampaign(null);
    setAdCampaignModalMode('create');
    setError('');
    setSuccess('');
  };

  const openEditAdCampaignModal = async (campaign: PortalAirportAdCampaignView) => {
    const latestAdStatus = await refreshAdCampaignStatus();
    if (!latestAdStatus) {
      return;
    }
    const latestCampaign = latestAdStatus.campaigns.find((item) => item.campaign_id === campaign.campaign_id) || campaign;
    setAdCampaignForm(createPortalAdCampaignForm(latestCampaign, 0));
    setEditingAdCampaign(latestCampaign);
    setAdCampaignModalMode('edit');
    setError('');
    setSuccess('');
  };

  const closeAdCampaignModal = () => {
    if (submittingAdCampaign) {
      return;
    }
    setAdCampaignModalMode('closed');
    setEditingAdCampaign(null);
    setAdCampaignForm(createPortalAdCampaignForm());
  };

  const submitAdCampaign = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!view) return;
    const isEdit = adCampaignModalMode === 'edit' && Boolean(editingAdCampaign);
    if (adCampaignModalMode === 'closed') {
      return;
    }
    if (redirectToApplicationPaymentIfRequired()) {
      return;
    }
    if (view.account.must_change_password) {
      setIsPasswordRequiredModalOpen(true);
      return;
    }
    if (view.application.review_status !== 'reviewed') {
      setError('申请审核通过后才能投放广告');
      setSuccess('');
      return;
    }
    if (!view.application.approved_airport_id) {
      setError('当前申请尚未绑定已审核机场');
      setSuccess('');
      return;
    }
    if (!isEdit && view.ad_status.remaining_slots <= 0) {
      setError('当前 6 个广告位已满，空位释放后可继续投放');
      setSuccess('');
      return;
    }

    const chargeAmount = (view.ad_status.monthly_price || AIRPORT_AD_MONTHLY_PRICE) * adCampaignForm.months;
    const balanceAfter = view.wallet.balance - chargeAmount;
    const warningThreshold = view.ad_status.low_balance_warning_threshold || AIRPORT_AD_LOW_BALANCE_WARNING_THRESHOLD;
    if (chargeAmount > 0 && balanceAfter < 0) {
      setError('余额不足，请先充值后再投放');
      setSuccess('');
      return;
    }
    if (chargeAmount > 0 && balanceAfter < warningThreshold) {
      const confirmed = window.confirm('余额不足可能影响机场评分展示。请确认！');
      if (!confirmed) {
        return;
      }
    }

    setSubmittingAdCampaign(true);
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<{
        campaign: AirportDealView;
        ad_status: PortalAirportAdStatus;
        wallet: PortalWalletView | null;
      }>(
        isEdit
          ? `/api/v1/portal/ad-campaign/${encodeURIComponent(String(editingAdCampaign!.campaign_id))}`
          : '/api/v1/portal/ad-campaign',
        {
        method: isEdit ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...(isEdit ? { extend_months: adCampaignForm.months } : { months: adCampaignForm.months }),
          coupon_code: adCampaignForm.coupon_code,
          discount_title: adCampaignForm.discount_title,
          discount_description: adCampaignForm.discount_description,
          applicable_plan: adCampaignForm.applicable_plan,
          is_stackable: adCampaignForm.is_stackable,
          refund_supported: adCampaignForm.refund_supported,
          discount_percent: adCampaignForm.discount_percent === '' ? null : Number(adCampaignForm.discount_percent),
        }),
        },
      );
      setView((current) => current
        ? {
            ...current,
            wallet: data.wallet || current.wallet,
            ad_status: data.ad_status,
          }
        : current);
      setAdCampaignForm(createPortalAdCampaignForm(data.campaign));
      setAdCampaignModalMode('closed');
      setEditingAdCampaign(null);
      setSuccess(isEdit
        ? adCampaignForm.months > 0 ? '广告投放已更新并续期。' : '广告投放文案已保存。'
        : '广告投放已扣费并上架。');
      await loadPortalBillingData({ transactions: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : '广告投放失败');
    } finally {
      setSubmittingAdCampaign(false);
    }
  };

  const cancelAdCampaign = async (campaign: PortalAirportAdCampaignView) => {
    if (!view || !campaign.is_active) {
      return;
    }
    const confirmed = window.confirm('提前下架不退款，请谨慎操作。正常情况下到期后会自然下架');
    if (!confirmed) {
      return;
    }

    setCancelingAdCampaignId(campaign.campaign_id);
    setError('');
    setSuccess('');
    try {
      const data = await portalApiRequest<{
        ad_status: PortalAirportAdStatus;
        wallet: PortalWalletView | null;
      }>(
        `/api/v1/portal/ad-campaign/${encodeURIComponent(String(campaign.campaign_id))}/cancel`,
        { method: 'POST' },
      );
      setView((current) => current
        ? {
            ...current,
            wallet: data.wallet || current.wallet,
            ad_status: data.ad_status,
          }
        : current);
      setSuccess('广告投放已下架。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '广告投放下架失败');
    } finally {
      setCancelingAdCampaignId(null);
    }
  };

  const switchPortalTab = (tab: PortalTabKey) => {
    if ((tab === 'recharge' || tab === 'ad_campaign') && redirectToApplicationPaymentIfRequired()) {
      return;
    }
    if ((tab === 'recharge' || tab === 'ad_campaign') && view?.account.must_change_password) {
      setIsPasswordRequiredModalOpen(true);
      return;
    }
    setPortalTab(tab);
  };

  const scrollToApplicationPaymentSection = () => {
    window.setTimeout(() => {
      document
        .getElementById(PORTAL_APPLICATION_PAYMENT_SECTION_ID)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const redirectToApplicationPaymentIfRequired = () => {
    if (view?.application.payment_status === 'paid') {
      return false;
    }
    setError(APPLICATION_PAYMENT_REQUIRED_MESSAGE);
    setSuccess('');
    setPortalTab('overview');
    scrollToApplicationPaymentSection();
    return true;
  };

  const goToPasswordChange = () => {
    setIsPasswordRequiredModalOpen(false);
    setPortalTab('account_settings');
    window.setTimeout(() => {
      document.getElementById('portal-password-change-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const changePortalBillingPage = (
    kind: 'recharge' | 'transactions' | 'clicks',
    nextPage: number,
  ) => {
    setError('');
    void loadPortalBillingData({ [kind]: nextPage }).catch((err) => {
      setError(err instanceof Error ? err.message : '分页数据加载失败');
    });
  };

  const renderApplicationDetailsSection = (portalView: PortalViewResponse) => {
    const application = portalView.application;
    const hasApprovedAirport = Boolean(application.approved_airport_id);
    const visibleWebsiteCount = normalizeUrlList(applicationForm.websites).length || application.websites.length || 1;
    const paymentLockedMessage = application.payment_status === 'paid'
      ? '已支付，运营资料可继续维护；基础申请信息已锁定。'
      : '未支付，运营资料和基础申请信息仍可维护。';
    const updateProfilePlan = <K extends keyof AirportProfilePlan>(key: K, value: AirportProfilePlan[K]) => {
      setApplicationForm((current) => {
        const nextProfile = {
          ...current.profile,
          plan: { ...current.profile.plan, [key]: value },
        };
        return {
          ...current,
          plan_price_month: key === 'lowest_monthly_price' ? (value === null ? '' : String(value)) : current.plan_price_month,
          has_trial: key === 'has_trial_plan' ? value === true : current.has_trial,
          profile: nextProfile,
        };
      });
    };
    const updateProfileClient = (key: AirportProfileClientKey, value: boolean | null) => {
      setApplicationForm((current) => ({
        ...current,
        profile: { ...current.profile, clients: { ...current.profile.clients, [key]: value } },
      }));
    };
    const updateProfileTelegram = <K extends keyof AirportProfileTelegram>(key: K, value: AirportProfileTelegram[K]) => {
      setApplicationForm((current) => ({
        ...current,
        profile: { ...current.profile, telegram: { ...current.profile.telegram, [key]: value } },
      }));
    };
    const updateImportMethod = <K extends keyof AirportProfileImportMethods>(key: K, value: AirportProfileImportMethods[K]) => {
      setApplicationForm((current) => ({
        ...current,
        profile: { ...current.profile, import_methods: { ...current.profile.import_methods, [key]: value } },
      }));
    };
    const updateRegion = <K extends keyof AirportProfileRegionInfo>(
      regionKey: AirportProfileRegionKey,
      key: K,
      value: AirportProfileRegionInfo[K],
    ) => {
      setApplicationForm((current) => ({
        ...current,
        profile: {
          ...current.profile,
          regions: {
            ...current.profile.regions,
            [regionKey]: { ...current.profile.regions[regionKey], [key]: value },
          },
        },
      }));
    };

    return (
      <PortalSectionCard
        title="资料"
        description={paymentLockedMessage}
        aside={(
          <div className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] ${hasApprovedAirport ? 'border border-emerald-100 bg-emerald-50 text-emerald-700' : 'border border-sky-100 bg-sky-50 text-sky-700'}`}>
            {hasApprovedAirport ? '资料已生效' : '资料待审核'}
          </div>
        )}
      >
        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          <PortalMetricTile label="机场名称" value={application.name} tone="blue" />
          <PortalMetricTile label="月付价格" value={`¥${formatMetric(application.plan_price_month)}`} tone="amber" />
          <PortalMetricTile label="试用支持" value={application.has_trial ? '支持' : '不支持'} tone="green" />
          <PortalMetricTile label="官网数量" value={`${visibleWebsiteCount} 个`} />
        </div>

        {isApplicationOperationsEditing ? (
          <form onSubmit={saveApplicationOperations}>
            <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fcff_0%,#ffffff_100%)] p-5 shadow-[0_18px_42px_rgba(15,23,42,0.04)]">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">Operations</div>
                  <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">修改运营资料</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    只修改运营字段。保存后会更新当前资料。
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                  onClick={cancelApplicationOperationsEdit}
                >
                  取消修改
                </button>
              </div>

              <div className="mt-5 flex gap-2 overflow-x-auto border-b border-slate-100 pb-2">
                {PORTAL_PROFILE_TABS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-black transition ${
                      applicationProfileTab === item.key ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                    onClick={() => setApplicationProfileTab(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {applicationProfileTab === 'basic' && (
                <div className="mt-5 space-y-5">
                  <PublicFormField label="机场名称">
                    <input
                      className={portalDisabledInputClass}
                      value={applicationForm.name}
                      disabled
                    />
                  </PublicFormField>
                  <PublicFormField label="解锁能力">
                    <PortalCheckboxPillGroup
                      options={AIRPORT_STREAMING_SUPPORT_OPTIONS}
                      value={applicationForm.streaming_support}
                      onChange={(streamingSupport) => setApplicationForm((current) => ({ ...current, streaming_support: streamingSupport }))}
                    />
                  </PublicFormField>
                  <PublicFormField label="支付方式">
                    <PortalCheckboxPillGroup
                      options={AIRPORT_PAYMENT_METHOD_OPTIONS}
                      value={applicationForm.payment_methods}
                      onChange={(paymentMethods) => setApplicationForm((current) => ({ ...current, payment_methods: paymentMethods }))}
                    />
                    {applicationForm.payment_methods.includes('crypto_other') && (
                      <input
                        className={`${portalInputClass} mt-3`}
                        value={applicationForm.payment_crypto_other}
                        onChange={(e) => setApplicationForm((current) => ({ ...current, payment_crypto_other: e.target.value }))}
                        placeholder="填写其他虚拟币币种"
                      />
                    )}
                  </PublicFormField>
                </div>
              )}

              {applicationProfileTab === 'review' && (
                <div className="mt-5 space-y-5">
                  <div className="space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm font-black text-slate-950">官网列表</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">至少保留一个官网地址，支持多个备用网址。</div>
                      </div>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
                        onClick={() => setApplicationForm((current) => ({ ...current, websites: [...current.websites, ''] }))}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        添加官网
                      </button>
                    </div>
                    <div className="space-y-3">
                      {applicationForm.websites.map((website, index) => (
                        <div key={`portal-operations-website-${index}`} className="flex items-center gap-3">
                          <input
                            className={portalInputClass}
                            value={website}
                            onChange={(e) => setApplicationForm((current) => ({
                              ...current,
                              websites: updateUrlListItem(current.websites, index, e.target.value),
                            }))}
                            placeholder="https://example.com"
                            required
                          />
                          <button
                            type="button"
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm disabled:opacity-40"
                            disabled={applicationForm.websites.length === 1}
                            onClick={() => setApplicationForm((current) => ({
                              ...current,
                              websites: removeUrlListItem(current.websites, index),
                            }))}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-5">
                    <PublicFormField label="订阅链接" hint="可选。">
                      <input
                        className={portalInputClass}
                        value={applicationForm.subscription_url}
                        onChange={(e) => setApplicationForm((current) => ({ ...current, subscription_url: e.target.value }))}
                        placeholder="https://subscribe.example.com"
                      />
                    </PublicFormField>
                    <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                      <PublicFormField label="Telegram">
                        <input
                          className={portalInputClass}
                          value={applicationForm.applicant_telegram}
                          onChange={(e) => setApplicationForm((current) => ({ ...current, applicant_telegram: e.target.value }))}
                          required
                        />
                      </PublicFormField>
                      <PublicFormField label="成立时间">
                        <input
                          className={portalInputClass}
                          type="date"
                          value={applicationForm.founded_on}
                          onChange={(e) => setApplicationForm((current) => ({ ...current, founded_on: e.target.value }))}
                          required
                        />
                      </PublicFormField>
                      <PublicFormField label="测试账号">
                        <input
                          className={portalInputClass}
                          value={applicationForm.test_account}
                          onChange={(e) => setApplicationForm((current) => ({ ...current, test_account: e.target.value }))}
                          required
                        />
                      </PublicFormField>
                      <PublicFormField label="测试密码">
                        <input
                          className={portalInputClass}
                          value={applicationForm.test_password}
                          onChange={(e) => setApplicationForm((current) => ({ ...current, test_password: e.target.value }))}
                          required
                        />
                      </PublicFormField>
                    </div>
                  </div>
                  <PublicFormField label="机场简介">
                    <textarea
                      className={`${portalInputClass} min-h-28`}
                      value={applicationForm.airport_intro}
                      onChange={(e) => setApplicationForm((current) => ({ ...current, airport_intro: e.target.value }))}
                      required
                    />
                  </PublicFormField>
                </div>
              )}

              {applicationProfileTab === 'plan' && (
                <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <PortalNullableBooleanRadioGroup label="是否支持月付" name="portal_supports_monthly" value={applicationForm.profile.plan.supports_monthly} onChange={(value) => updateProfilePlan('supports_monthly', value)} />
                  <PortalNullableBooleanRadioGroup label="是否支持季付" name="portal_supports_quarterly" value={applicationForm.profile.plan.supports_quarterly} onChange={(value) => updateProfilePlan('supports_quarterly', value)} />
                  <PortalNullableBooleanRadioGroup label="是否支持半年付" name="portal_supports_half_yearly" value={applicationForm.profile.plan.supports_half_yearly} onChange={(value) => updateProfilePlan('supports_half_yearly', value)} />
                  <PortalNullableBooleanRadioGroup label="是否支持年付" name="portal_supports_annual" value={applicationForm.profile.plan.supports_annual} onChange={(value) => updateProfilePlan('supports_annual', value)} />
                  <PortalNullableBooleanRadioGroup label="是否支持试用" name="portal_has_trial_plan" value={applicationForm.profile.plan.has_trial_plan} onChange={(value) => updateProfilePlan('has_trial_plan', value)} />
                  <PortalNullableBooleanRadioGroup label="是否有不限时套餐" name="portal_has_lifetime_plan" value={applicationForm.profile.plan.has_lifetime_plan} onChange={(value) => updateProfilePlan('has_lifetime_plan', value)} />
                  <PublicFormField label="最低月付价格">
                    <input
                      className={portalInputClass}
                      type="number"
                      min="0"
                      step="0.01"
                      value={applicationForm.profile.plan.lowest_monthly_price ?? ''}
                      onChange={(e) => updateProfilePlan('lowest_monthly_price', parseOptionalNumberInput(e.target.value))}
                      required
                    />
                  </PublicFormField>
                  <PublicFormField label="最低年付折算月价">
                    <input
                      className={portalInputClass}
                      type="number"
                      min="0"
                      step="0.01"
                      value={applicationForm.profile.plan.lowest_annual_monthly_price ?? ''}
                      onChange={(e) => updateProfilePlan('lowest_annual_monthly_price', parseOptionalNumberInput(e.target.value))}
                    />
                  </PublicFormField>
                </div>
              )}

              {applicationProfileTab === 'telegram' && (
                <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <PortalNullableBooleanRadioGroup label="是否有 Telegram 群" name="portal_profile_has_group" value={applicationForm.profile.telegram.has_group} onChange={(value) => updateProfileTelegram('has_group', value)} />
                  <PortalNullableBooleanRadioGroup label="是否有 Telegram 频道" name="portal_profile_has_channel" value={applicationForm.profile.telegram.has_channel} onChange={(value) => updateProfileTelegram('has_channel', value)} />
                  <PortalNullableBooleanRadioGroup label="群是否允许发言" name="portal_profile_group_allows_speaking" value={applicationForm.profile.telegram.group_allows_speaking} onChange={(value) => updateProfileTelegram('group_allows_speaking', value)} />
                  <PortalNullableBooleanRadioGroup label="是否有客服 Bot" name="portal_profile_has_customer_service_bot" value={applicationForm.profile.telegram.has_customer_service_bot} onChange={(value) => updateProfileTelegram('has_customer_service_bot', value)} />
                  <PortalNullableBooleanRadioGroup label="是否有工单系统" name="portal_profile_has_ticket_system" value={applicationForm.profile.telegram.has_ticket_system} onChange={(value) => updateProfileTelegram('has_ticket_system', value)} />
                  <PublicFormField label="Telegram 群链接">
                    <input
                      className={portalInputClass}
                      value={applicationForm.profile.telegram.group_url || ''}
                      onChange={(e) => updateProfileTelegram('group_url', e.target.value || null)}
                    />
                  </PublicFormField>
                  <PublicFormField label="Telegram 频道链接">
                    <input
                      className={portalInputClass}
                      value={applicationForm.profile.telegram.channel_url || ''}
                      onChange={(e) => updateProfileTelegram('channel_url', e.target.value || null)}
                    />
                  </PublicFormField>
                  <PublicFormField label="群人数">
                    <input
                      className={portalInputClass}
                      type="number"
                      min="0"
                      step="1"
                      value={applicationForm.profile.telegram.group_member_count ?? ''}
                      onChange={(e) => updateProfileTelegram('group_member_count', normalizeOptionalInteger(e.target.value))}
                    />
                  </PublicFormField>
                  <PublicFormField label="最近活跃时间">
                    <input
                      className={portalInputClass}
                      type="date"
                      value={applicationForm.profile.telegram.recent_active_at || ''}
                      onChange={(e) => updateProfileTelegram('recent_active_at', e.target.value || null)}
                    />
                  </PublicFormField>
                </div>
              )}

              {applicationProfileTab === 'nodes' && (
                <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200 bg-white">
                  <table className="w-full min-w-[1080px] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[120px]" />
                      <col className="w-[260px]" />
                      <col className="w-[260px]" />
                      <col />
                    </colgroup>
                    <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      <tr>
                        <th className="px-5 py-3">地区</th>
                        <th className="px-5 py-3">家宽节点</th>
                        <th className="px-5 py-3">原生 IP</th>
                        <th className="px-5 py-3">线路属性</th>
                      </tr>
                    </thead>
                    <tbody>
                      {AIRPORT_PROFILE_REGION_OPTIONS.map((region) => (
                        <tr key={region.value} className="h-[68px] border-t border-slate-100 align-middle">
                          <td className="px-5 py-3 font-black text-slate-900">
                            <span className="block whitespace-nowrap">{region.label}</span>
                          </td>
                          <td className="px-5 py-3 align-middle">
                            <PortalCompactBooleanRadioGroup
                              name={`portal-region-${region.value}-residential`}
                              value={applicationForm.profile.regions[region.value].has_residential}
                              onChange={(value) => updateRegion(region.value, 'has_residential', value)}
                            />
                          </td>
                          <td className="px-5 py-3 align-middle">
                            <PortalCompactBooleanRadioGroup
                              name={`portal-region-${region.value}-native`}
                              value={applicationForm.profile.regions[region.value].has_native_ip}
                              onChange={(value) => updateRegion(region.value, 'has_native_ip', value)}
                            />
                          </td>
                          <td className="px-5 py-3 align-middle">
                            <PortalCompactCheckboxPillGroup
                              options={AIRPORT_PROFILE_LINE_TYPE_OPTIONS}
                              value={applicationForm.profile.regions[region.value].line_types}
                              onChange={(lineTypes) => updateRegion(region.value, 'line_types', lineTypes)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {applicationProfileTab === 'clients' && (
                <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
                  {AIRPORT_PROFILE_CLIENT_OPTIONS.map((client) => (
                    <React.Fragment key={client.value}>
                      <PortalNullableBooleanRadioGroup
                        label={client.value === 'self_built_client' ? '是否自建客户端' : `是否支持 ${client.label}`}
                        name={`portal-client-${client.value}`}
                        value={applicationForm.profile.clients[client.value]}
                        onChange={(value) => updateProfileClient(client.value, value)}
                      />
                    </React.Fragment>
                  ))}
                </div>
              )}

              {applicationProfileTab === 'import' && (
                <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <PortalNullableBooleanRadioGroup label="是否提供一键导入" name="portal_import_one_click" value={applicationForm.profile.import_methods.one_click_import} onChange={(value) => updateImportMethod('one_click_import', value)} />
                  <PortalNullableBooleanRadioGroup label="是否提供订阅链接" name="portal_import_subscription" value={applicationForm.profile.import_methods.subscription_link} onChange={(value) => updateImportMethod('subscription_link', value)} />
                  <PortalNullableBooleanRadioGroup label="是否支持通用订阅" name="portal_import_universal" value={applicationForm.profile.import_methods.universal_subscription} onChange={(value) => updateImportMethod('universal_subscription', value)} />
                  <PortalNullableBooleanRadioGroup label="是否支持二维码导入" name="portal_import_qr" value={applicationForm.profile.import_methods.qr_code_import} onChange={(value) => updateImportMethod('qr_code_import', value)} />
                  <PortalNullableBooleanRadioGroup label="是否提供教程" name="portal_import_tutorials" value={applicationForm.profile.import_methods.tutorials} onChange={(value) => updateImportMethod('tutorials', value)} />
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                <button
                  type="button"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black tracking-[0.04em] text-slate-700 shadow-sm transition hover:bg-slate-50"
                  onClick={cancelApplicationOperationsEdit}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className={portalPrimaryButtonClass}
                  disabled={savingApplication}
                >
                  {savingApplication ? '保存中...' : '保存运营资料'}
                </button>
              </div>
            </section>
          </form>
        ) : (
          <section className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fcff_0%,#ffffff_100%)] p-5 shadow-[0_18px_42px_rgba(15,23,42,0.04)]">
            <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">Operations</div>
                <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">运营资料</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  当前展示的是已提交资料。点击修改后才会进入编辑状态。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-cyan-200 bg-white px-4 py-2 text-sm font-black text-cyan-700 shadow-sm transition hover:bg-cyan-50"
                  onClick={openApplicationOperationsEditor}
                >
                  修改资料
                </button>
                {application.payment_status !== 'paid' && (
                  <button
                    type="button"
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50"
                    onClick={openApplicationModal}
                  >
                    编辑基础申请资料
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
              <PortalReadOnlyBlock label="月付价格" value={`¥${formatMetric(application.plan_price_month)}`} />
              <PortalReadOnlyBlock label="试用支持" value={application.has_trial ? '支持' : '不支持'} />
              <PortalReadOnlyBlock label="官网列表" value={application.websites.join('\n')} />
              <PortalReadOnlyBlock label="订阅链接" value={application.subscription_url || '-'} />
              <PortalReadOnlyBlock label="测试账号" value={application.test_account} />
              <PortalReadOnlyBlock label="测试密码" value={application.test_password} />
              <PortalReadOnlyBlock label="资料状态" value={hasApprovedAirport ? '已生效' : '待审核'} />
              <PortalReadOnlyBlock
                label="解锁能力"
                value={formatSelectedLabels(application.streaming_support, AIRPORT_STREAMING_SUPPORT_OPTIONS)}
              />
              <PortalReadOnlyBlock
                label="支付方式"
                value={formatSelectedLabels(application.payment_methods, AIRPORT_PAYMENT_METHOD_OPTIONS)}
              />
              <PortalReadOnlyBlock
                label="客户端支持"
                value={formatSelectedLabels(
                  AIRPORT_PROFILE_CLIENT_OPTIONS
                    .filter((client) => application.profile?.clients?.[client.value] === true)
                    .map((client) => client.value),
                  AIRPORT_PROFILE_CLIENT_OPTIONS,
                )}
              />
              <PortalReadOnlyBlock
                label="一键导入"
                value={formatNullableBooleanLabel(application.profile?.import_methods?.one_click_import ?? null)}
              />
            </div>
          </section>
        )}

        <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6">
          <PortalReadOnlyBlock label="申请邮箱 / 登录邮箱" value={application.applicant_email} />
          <PortalReadOnlyBlock label="Telegram" value={application.applicant_telegram} />
          <PortalReadOnlyBlock label="成立时间" value={formatDateLabel(application.founded_on)} />
          <PortalReadOnlyBlock label="提交时间" value={application.created_at} />
          <PortalReadOnlyBlock label="支付状态" value={formatPortalPaymentStatus(application.payment_status)} />
          <PortalReadOnlyBlock label="审核状态" value={formatPortalReviewStatus(application.review_status)} />
          <PortalReadOnlyBlock label="支付时间" value={application.paid_at || '-'} />
          <PortalReadOnlyBlock label="审核时间" value={application.reviewed_at || '-'} />
          <PortalReadOnlyBlock label="审核备注" value={application.review_note || '-'} />
          <div className="xl:col-span-2">
            <PortalReadOnlyBlock label="机场简介" value={application.airport_intro} />
          </div>
        </section>
      </PortalSectionCard>
    );
  };

  const renderOnboardingGuide = (portalView: PortalViewResponse) => {
    const isPaymentStepActive = !portalView.account.must_change_password && portalView.application.payment_status !== 'paid';
    const isReviewStepActive = portalView.application.payment_status === 'paid' && portalView.application.review_status === 'pending';
    const isRejected = portalView.application.review_status === 'rejected';

    const steps = [
      {
        number: '01',
        title: '修改密码',
        description: '首次登录先完成账号改密，之后才能创建入驻支付订单。',
        state: portalView.account.must_change_password ? 'active' : 'done',
        icon: KeyRound,
      },
      {
        number: '02',
        title: '支付入驻费用',
        description: `支付一次性入驻费用 ¥${formatMetric(portalView.payment_fee_amount)}，支付结果会自动同步。`,
        state: portalView.application.payment_status === 'paid' ? 'done' : isPaymentStepActive ? 'active' : 'locked',
        icon: Banknote,
      },
      {
        number: '03',
        title: '一个工作日内系统审批',
        description: isRejected ? '当前申请未通过审批，请根据审核备注调整资料或联系管理员。' : '支付完成后进入待审批队列，通常一个工作日内完成处理。',
        state: isRejected ? 'rejected' : portalView.application.review_status === 'reviewed' ? 'done' : isReviewStepActive ? 'active' : 'locked',
        icon: Clock,
      },
    ];

    return (
      <PortalSectionCard
        title="入驻引导"
        description="按照下方步骤完成账号安全、入驻支付和系统审批。"
        aside={<div className="rounded-full border border-cyan-100 bg-cyan-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700">Getting Started</div>}
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = step.state === 'active';
            const isDone = step.state === 'done';
            const isStepRejected = step.state === 'rejected';
            const shellClass = isActive
              ? 'border-cyan-200 bg-cyan-50/95 shadow-[0_14px_36px_rgba(8,145,178,0.12)]'
              : isDone
                ? 'border-emerald-100 bg-emerald-50/95'
                : isStepRejected
                  ? 'border-rose-100 bg-rose-50/95'
                  : 'border-slate-200 bg-white';
            const badgeClass = isActive
              ? 'bg-cyan-600 text-white'
              : isDone
                ? 'bg-emerald-600 text-white'
                : isStepRejected
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 text-slate-500';
            const label = isActive ? '当前步骤' : isDone ? '已完成' : isStepRejected ? '未通过' : '待完成';

            return (
              <div key={step.number} className={`rounded-[24px] border px-5 py-5 ${shellClass}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-black ${badgeClass}`}>
                    {isDone ? <CheckCircle2 className="h-5 w-5" /> : step.number}
                  </div>
                  <div className="rounded-full border border-white/80 bg-white/80 px-3 py-1 text-[11px] font-black text-slate-600">
                    {label}
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${isStepRejected ? 'text-rose-600' : isDone ? 'text-emerald-600' : isActive ? 'text-cyan-700' : 'text-slate-400'}`} />
                  <div className="text-base font-black text-slate-950">{step.title}</div>
                </div>
                <p className="mt-3 text-sm leading-7 text-slate-600">{step.description}</p>
              </div>
            );
          })}
        </div>
      </PortalSectionCard>
    );
  };

  const renderRechargeSection = (portalView: PortalViewResponse) => {
    const paymentMethods = getPortalPaymentMethods(portalView);
    return (
      <PortalSectionCard
        title="余额充值"
        description={`充值余额用于 GateRank 到机场链接的真实点击扣费。当前点击单价为 ${formatMetric(portalView.click_price)} 元/次。`}
        aside={<div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">余额 ¥{formatMetric(portalView.wallet.balance)}</div>}
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {portalView.recharge_amounts.map((amount) => (
          <div key={amount} className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Recharge</div>
            <div className="mt-2 text-3xl font-black text-slate-950">¥{formatMetric(amount)}</div>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
              {paymentMethods.map((channel) => (
                <button
                  key={`${amount}-${channel}`}
                  type="button"
                  className={getRechargeButtonClass(channel)}
                  disabled={Boolean(creatingRecharge)}
                  onClick={() => void createRechargeOrder(amount, channel)}
                >
                  {creatingRecharge === `${amount}-${channel}` ? '处理中' : formatPaymentChannelLabel(channel)}
                </button>
              ))}
            </div>
          </div>
        ))}
        </div>

        <PortalDataTable
        title="最近充值订单"
        emptyText="暂无充值订单"
        headers={['订单号', '渠道', '金额', '状态', '创建时间', '操作']}
        rows={rechargeOrders.items.map((item) => [
          item.out_trade_no,
          formatPaymentChannelLabel(item.channel),
          `¥${formatMetric(item.amount)}`,
          formatRechargeStatus(item.status),
          formatDateTimeLabel(item.created_at),
          item.status === 'created' ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-full bg-sky-600 px-3 py-1.5 text-xs font-black text-white hover:bg-sky-700"
                onClick={() => continueRechargePayment(item)}
              >
                继续支付
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                disabled={cancelingRechargeOrder === item.out_trade_no}
                onClick={() => void cancelRechargeOrder(item)}
              >
                {cancelingRechargeOrder === item.out_trade_no ? '取消中' : '取消'}
              </button>
            </div>
          ) : '-',
        ])}
        pagination={{
          total: rechargeOrders.total,
          page: rechargeOrders.page,
          pageSize: rechargeOrders.page_size,
          onPageChange: (page) => changePortalBillingPage('recharge', page),
        }}
        />
      </PortalSectionCard>
    );
  };

  const renderAdCampaignSection = (portalView: PortalViewResponse) => {
    const adStatus = portalView.ad_status;
    const campaigns = adStatus.campaigns || [];
    const soldOut = adStatus.remaining_slots <= 0;
    const canCreateCampaign = !soldOut;

    return (
      <PortalSectionCard
        title="广告投放"
        description="活动优惠专区总共 6 个广告位，先到先得。购买成功后立即上架，优惠信息不影响 GateRank Score。"
        aside={(
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">
              剩余 {adStatus.remaining_slots} / {adStatus.slot_limit}
            </div>
            <button
              type="button"
              disabled={refreshingAdCampaignStatus}
              onClick={() => void openCreateAdCampaignModal()}
              className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {refreshingAdCampaignStatus ? '刷新中' : '新建投放'}
            </button>
          </div>
        )}
      >
        {soldOut && (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            当前 6 个广告位已满，空位释放后可继续投放。
          </div>
        )}

        <PortalDataTable
          title="已投放广告"
          emptyText="暂无已投放广告"
          headers={['优惠码', '展示期', '累计投放', '状态', '操作']}
          rows={campaigns.map((campaign) => [
            <span className="font-black text-blue-700">{campaign.coupon_code}</span>,
            <span>{formatDateTimeLabel(campaign.starts_at)} 至 {formatDateTimeLabel(campaign.ends_at)}</span>,
            <span>{campaign.purchased_months} 个月 / ¥{formatMetric(campaign.billed_amount)}</span>,
            <span className={`rounded-full px-3 py-1 text-xs font-black ${getAdCampaignStatusBadgeClass(campaign.status)}`}>
              {campaign.status_label}
            </span>,
            campaign.is_active ? (
              <div className="flex flex-nowrap items-center gap-2 whitespace-nowrap">
                <button
                  type="button"
                  disabled={refreshingAdCampaignStatus}
                  onClick={() => void openEditAdCampaignModal(campaign)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {refreshingAdCampaignStatus ? '刷新中' : '修改'}
                </button>
                <button
                  type="button"
                  disabled={cancelingAdCampaignId === campaign.campaign_id}
                  onClick={() => void cancelAdCampaign(campaign)}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancelingAdCampaignId === campaign.campaign_id ? '下架中' : '下架'}
                </button>
              </div>
            ) : (
              <span className="text-xs font-black text-slate-400">
                {campaign.status === 'canceled' ? '已下架' : '已到期'}
              </span>
            ),
          ])}
        />
      </PortalSectionCard>
    );
  };

  const renderClicksSection = () => (
    <PortalSectionCard
      title="访问记录"
      description="这里展示从 GateRank 跳转到机场链接的服务端真实记录，包含扣费、重复点击和余额不足免费放行状态。"
    >
      <PortalDataTable
        title="最近点击"
        emptyText="暂无点击记录"
        headers={['时间', '机场', '来源位', '目标', '扣费状态', '金额']}
        rows={clickRecords.items.map((item) => [
          formatDateTimeLabel(item.occurred_at),
          item.airport_name || `#${item.airport_id}`,
          formatPortalPlacement(item.placement),
          item.target_kind === 'subscription_url' ? '订阅链接' : '官网',
          formatClickBillingStatus(item.billing_status),
          `¥${formatMetric(item.billed_amount)}`,
        ])}
        pagination={{
          total: clickRecords.total,
          page: clickRecords.page,
          pageSize: clickRecords.page_size,
          onPageChange: (page) => changePortalBillingPage('clicks', page),
        }}
      />
    </PortalSectionCard>
  );

  const renderTransactionsSection = () => (
    <PortalSectionCard
      title="扣费流水"
      description="充值入账和点击扣费都会写入余额流水，用于和访问记录相互核对。"
    >
      <PortalDataTable
        title="余额流水"
        emptyText="暂无余额流水"
        headers={['时间', '类型', '金额', '余额', '说明']}
        rows={walletTransactions.items.map((item) => [
          formatDateTimeLabel(item.created_at),
          formatTransactionType(item.transaction_type),
          `${item.amount >= 0 ? '+' : ''}¥${formatMetric(item.amount)}`,
          `¥${formatMetric(item.balance_after)}`,
          item.description,
        ])}
        pagination={{
          total: walletTransactions.total,
          page: walletTransactions.page,
          pageSize: walletTransactions.page_size,
          onPageChange: (page) => changePortalBillingPage('transactions', page),
        }}
      />
    </PortalSectionCard>
  );

  const renderBillingGuideSection = (portalView: PortalViewResponse) => {
    const guideItems = [
      {
        title: '当前点击单价',
        value: `¥${formatMetric(portalView.click_price)} / 次`,
        description: '每次有效跳转从点击余额中扣除一次点击费用。',
        tone: 'blue' as const,
      },
      {
        title: '计费对象',
        value: '官网链接',
        description: '从 GateRank 页面跳转到机场官网的真实访问会进入计费判断，订阅链接不扣费。',
        tone: 'green' as const,
      },
      {
        title: '重复访问',
        value: '24 小时不重复扣费',
        description: '同一访客在 24 小时内重复点击同一机场链接，只记录访问，不重复扣费。',
        tone: 'amber' as const,
      },
    ];

    return (
      <PortalSectionCard
        title="扣费说明"
        description="这里说明点击余额的扣费规则、重复访问处理和余额不足时的总分展示状态。"
        aside={<div className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Billing Rules</div>}
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {guideItems.map((item) => (
            <div key={item.title}>
              <PortalInfoCard
                eyebrow="Rule"
                title={item.title}
                value={item.value}
                tone={item.tone}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
          {guideItems.map((item) => (
            <div key={`${item.title}-description`} className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
              <div className="text-sm font-black text-slate-950">{item.title}</div>
              <div className="mt-2 text-sm leading-7 text-slate-600">{item.description}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[24px] border border-rose-100 bg-rose-50/90 px-5 py-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <div>
              <div className="text-sm font-black text-rose-900">余额不足与总分展示</div>
              <div className="mt-2 text-sm leading-7 text-rose-800">
                当余额不足以支付一次点击时，官网跳转仍可正常访问且不会扣费；机场仍保留在 GateRank 并继续参与监测评分，但公开综合总分暂不展示，榜单会排在余额正常机场之后。充值后余额恢复到单次点击价以上，可自动恢复。
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-black text-white"
            onClick={() => switchPortalTab('recharge')}
          >
            去充值
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
            onClick={() => setPortalTab('clicks')}
          >
            查看访问记录
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50"
            onClick={() => setPortalTab('transactions')}
          >
            查看扣费流水
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </PortalSectionCard>
    );
  };

  const renderTelegramBotSection = (portalView: PortalViewResponse) => {
    const bot = portalView.telegram_bot;
    const bindingLabel = bot.binding
      ? bot.binding.telegram_username
        ? `@${bot.binding.telegram_username}`
        : bot.binding.telegram_first_name || bot.binding.telegram_user_id
      : '未绑定';

    return (
      <PortalSectionCard
        title="绑定 Telegram Bot"
        description="绑定一次后，可以在 Telegram 接收通知、查询余额和扣费流水，也可以在登录页直接使用 Telegram 登录申请人后台。"
        aside={bot.binding ? (
          <div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Bound</div>
        ) : (
          <div className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Not Bound</div>
        )}
      >
        <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-black text-slate-950">
              {!bot.configured
                ? '管理员尚未配置用户服务 Bot'
                : bot.binding
                  ? bindingLabel
                  : bot.bot_username
                    ? `@${bot.bot_username}`
                    : '用户服务 Bot'}
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              {!bot.configured
                ? '配置完成后，这里会显示绑定入口。'
                : bot.binding
                    ? `绑定时间：${formatDateTimeLabel(bot.binding.bound_at)}`
                    : '点击绑定会打开 Telegram，一次性链接 10 分钟内有效；绑定后可直接使用 Telegram 登录。'}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {bot.configured && (
              <button
                type="button"
                className={portalTelegramBindButtonClass}
                onClick={() => void startTelegramBind()}
                disabled={Boolean(telegramBindAction)}
              >
                <Send className="h-4 w-4" />
                {telegramBindAction === 'bind' ? '生成中...' : bot.binding ? '重新绑定' : '绑定电报'}
              </button>
            )}
            {bot.binding && (
              <button
                type="button"
                className={portalUnbindButtonClass}
                onClick={() => void unbindTelegram()}
                disabled={Boolean(telegramBindAction)}
              >
                <Unlink className="h-4 w-4" />
                {telegramBindAction === 'unbind' ? '处理中...' : '解除绑定'}
              </button>
            )}
          </div>
        </div>
      </PortalSectionCard>
    );
  };

  const renderAccountSettingsSection = (portalView: PortalViewResponse) => {
    const boundXLabel = portalView.account.x?.username
      ? `@${portalView.account.x.username}`
      : portalView.account.x?.display_name || portalView.account.x?.user_id || '已绑定';

    return (
      <div className="space-y-5">
        <PortalSectionCard
          title="账号设置"
          description="管理申请人后台登录方式。修改密码后需要使用新密码重新登录。"
          aside={<div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">Security</div>}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <PortalLoginEmailCard email={portalView.account.email} onChangeClick={openEmailChangeModal} />
            <PortalInfoCard
              eyebrow="X Login"
              title="X 登录"
              value={portalView.account.x ? boundXLabel : '未绑定'}
              tone={portalView.account.x ? 'green' : 'amber'}
            />
          </div>
        </PortalSectionCard>

        <PortalSectionCard
          id="portal-password-change-section"
          title="修改密码"
          description="输入当前密码和新密码。保存后当前登录状态会退出，请重新登录。"
        >
          <form onSubmit={changePassword} className="space-y-5">
            <PublicFormField label="当前密码">
              <input
                className={portalInputClass}
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </PublicFormField>
            <PublicFormField label="新密码" hint="至少 8 位。">
              <input
                className={portalInputClass}
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </PublicFormField>
            <button
              type="submit"
              className={portalPrimaryButtonClass}
              disabled={changingPassword}
            >
              <KeyRound className="h-4 w-4" />
              {changingPassword ? '提交中...' : '保存新密码'}
            </button>
          </form>
        </PortalSectionCard>

        {renderTelegramBotSection(portalView)}

        <PortalSectionCard
          title="绑定 X 登录"
          description="绑定后可以在登录页直接使用 X 登录申请人后台。系统只保存 X 用户身份，不保存访问凭证。"
          aside={portalView.account.x ? (
            <div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Bound</div>
          ) : (
            <div className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Not Bound</div>
          )}
        >
          <div className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-slate-50/80 px-5 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-black text-slate-950">
                {portalView.account.x ? boundXLabel : '尚未绑定 X 账号'}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                {portalView.account.x?.bound_at
                  ? `绑定时间：${portalView.account.x.bound_at}`
                  : '绑定会跳转到 X 授权页，授权完成后自动回到申请人后台。'}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={portalXBindButtonClass}
                onClick={() => void startXBind()}
                disabled={Boolean(xOAuthAction)}
              >
                <Link2 className="h-4 w-4" />
                {xOAuthAction === 'bind' ? '跳转中...' : portalView.account.x ? '重新绑定' : '绑定 X'}
              </button>
              {portalView.account.x && (
                <button
                  type="button"
                  className={portalUnbindButtonClass}
                  onClick={() => void unbindX()}
                  disabled={Boolean(xOAuthAction)}
                >
                  <Unlink className="h-4 w-4" />
                  {xOAuthAction === 'unbind' ? '处理中...' : '解除绑定'}
                </button>
              )}
            </div>
          </div>
        </PortalSectionCard>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) {
      return <div className="text-sm text-neutral-500">加载中...</div>;
    }

    if (!view) {
      return (
        <PortalSectionCard
          title="登录"
          description="使用提交申请时填写的邮箱和系统发放的初始密码登录。首次登录后需要先修改密码。"
        >
          <form onSubmit={login} className="max-w-3xl space-y-5">
            <PublicFormField label="邮箱">
              <input
                className={portalInputClass}
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="contact@example.com"
                required
              />
            </PublicFormField>
            <PublicFormField label="密码">
              <div className="relative">
                <input
                  className={`${portalInputClass} pr-12`}
                  type={isLoginPasswordVisible ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="输入密码"
                  required
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  onClick={() => setIsLoginPasswordVisible((current) => !current)}
                  aria-label={isLoginPasswordVisible ? '隐藏密码' : '显示密码'}
                  title={isLoginPasswordVisible ? '隐藏密码' : '显示密码'}
                >
                  {isLoginPasswordVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </PublicFormField>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
              <button
                type="submit"
                className={portalLoginSubmitButtonClass}
                disabled={loggingIn}
              >
                <LogIn className="h-4 w-4" />
                {loggingIn ? '登录中...' : '登录后台'}
              </button>
              <button
                type="button"
                className={portalLoginXButtonClass}
                onClick={() => void startXLogin()}
                disabled={Boolean(xOAuthAction) || telegramLoginAction}
              >
                <XLogo className="h-4 w-4" />
                {xOAuthAction === 'login' ? '跳转中...' : '使用 X 登录'}
              </button>
              <button
                type="button"
                className={portalLoginTelegramButtonClass}
                onClick={() => void startTelegramLogin()}
                disabled={telegramLoginAction || Boolean(xOAuthAction)}
              >
                <Send className="h-4 w-4" />
                {telegramLoginAction ? '等待确认...' : '使用电报登录'}
              </button>
            </div>
            {telegramLoginStatus && (
              <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-semibold leading-6 text-sky-800">
                {telegramLoginStatus}
              </div>
            )}
          </form>
        </PortalSectionCard>
      );
    }

    let stageSection: React.ReactNode;
    if (view.account.must_change_password) {
      stageSection = (
        <div id="portal-password-change-section" className="scroll-mt-8">
          <PortalSectionCard
            title="首次改密"
            description="首次登录必须修改密码。修改完成后才能创建支付订单。你也可以先确认并补充申请资料，再完成改密。"
            aside={<div className="rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">First Login</div>}
          >
            <form onSubmit={changePassword} className="space-y-5">
              <div className="flex items-start gap-3 rounded-[24px] border border-amber-100 bg-amber-50 px-4 py-4">
                <KeyRound className="mt-0.5 h-5 w-5 text-amber-700" />
                <div className="text-sm leading-7 text-amber-800">
                  当前账号仍处于首次登录阶段，你可以先确认并补充申请资料，再完成改密和支付。
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PortalLoginEmailCard email={view.account.email} onChangeClick={openEmailChangeModal} />
                <PortalInfoCard eyebrow="Current Stage" title="当前阶段" value="首次改密" tone="amber" />
              </div>
              <PublicFormField label="当前密码">
                <input
                  className={portalInputClass}
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </PublicFormField>
              <PublicFormField label="新密码" hint="至少 8 位。">
                <input
                  className={portalInputClass}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </PublicFormField>
              <button
                type="submit"
                className={portalPrimaryButtonClass}
                disabled={changingPassword}
              >
                <KeyRound className="h-4 w-4" />
                {changingPassword ? '提交中...' : '保存新密码'}
              </button>
            </form>
          </PortalSectionCard>
        </div>
      );
    } else if (view.application.review_status === 'awaiting_payment' && view.application.payment_status !== 'paid') {
      stageSection = (
        <PortalSectionCard
          id={PORTAL_APPLICATION_PAYMENT_SECTION_ID}
          title="支付入驻费用"
          description="支付完成并通过网关回调后，申请会自动进入后台待审批列表。你也可以先继续补充资料，再发起支付。"
        >
          <div className="space-y-5">
            <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#f8fcff_0%,#ffffff_100%)] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-700">Service Overview</div>
                  <div className="mt-2 text-sm font-medium text-slate-500">关于入驻服务，相关信息如下：</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-700">费用标准</div>
                  <div className="mt-1 whitespace-nowrap text-3xl font-black tracking-tight text-slate-950">¥{formatMetric(view.payment_fee_amount)}</div>
                </div>
              </div>
              <div className="mt-4 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                <div className="text-sm leading-7 text-slate-700">
                  入驻费为一次性费用。入驻通过后，后续从 GateRank 跳转到机场链接按点击余额扣费。
                </div>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
                  <div><span className="font-black text-slate-900">费用类型：</span>一次性入驻费</div>
                  <div><span className="font-black text-slate-900">测试频率：</span>每日自动化测评与数据更新</div>
                  <div><span className="font-black text-slate-900">费用标准：</span>¥{formatMetric(view.payment_fee_amount)}</div>
                </div>
              </div>
              <div className="mt-4 text-sm leading-7 text-slate-600">支付完成后自动进入后台待审批状态，支付结果会同步到当前页面。</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {getPortalPaymentMethods(view).map((channel) => {
                const tone = getPaymentCardTone(channel);
                return (
                  <div key={channel}>
                    <PaymentMethodCard
                      title={`${formatPaymentChannelLabel(channel)}支付`}
                      tone={tone}
                      icon={<PaymentBrandArtwork tone={tone} className="h-full w-full" />}
                      busy={creatingChannel === channel}
                      disabled={Boolean(creatingChannel)}
                      buttonLabel={`立即使用${formatPaymentChannelLabel(channel)}支付`}
                      onClick={() => void createPaymentOrder(channel)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </PortalSectionCard>
      );
    } else {
      stageSection = (
        <PortalSectionCard
          title="申请状态"
          description="这里会展示你的支付和审批进度。审批逻辑与后台保持一致。"
          aside={<div className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">{formatPortalReviewStatus(view.application.review_status)}</div>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <PortalInfoCard eyebrow="Application" title="申请编号" value={`#${view.application.id}`} tone="blue" />
            <PortalInfoCard eyebrow="Airport" title="机场名称" value={view.application.name} />
            <PortalInfoCard eyebrow="Payment" title="支付状态" value={formatPortalPaymentStatus(view.application.payment_status)} tone="green" />
            <PortalInfoCard eyebrow="Review" title="审批状态" value={formatPortalReviewStatus(view.application.review_status)} tone="amber" />
          </div>
        </PortalSectionCard>
      );
    }

    if (portalTab === 'recharge') {
      return renderRechargeSection(view);
    }
    if (portalTab === 'ad_campaign') {
      return renderAdCampaignSection(view);
    }
    if (portalTab === 'clicks') {
      return renderClicksSection();
    }
    if (portalTab === 'transactions') {
      return renderTransactionsSection();
    }
    if (portalTab === 'billing_guide') {
      return renderBillingGuideSection(view);
    }
    if (portalTab === 'profile') {
      return renderApplicationDetailsSection(view);
    }
    if (portalTab === 'account_settings') {
      return renderAccountSettingsSection(view);
    }

    const listingStatus = getPortalListingStatus(view.wallet);
    const accountOverviewSection = (
      <PortalSectionCard
        title="账户概览"
        description="集中查看机场、账户余额、点击单价和当前上架状态。"
        aside={(
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-500">
            审批状态：{formatPortalReviewStatus(view.application.review_status)}
          </div>
        )}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <PortalInfoCard eyebrow="Airport" title="机场名称" value={view.application.name} tone="blue" />
          <PortalInfoCard eyebrow="Balance" title="账户余额" value={`¥${formatMetric(view.wallet.balance)}`} tone={view.wallet.balance >= view.click_price ? 'green' : 'amber'} />
          <PortalInfoCard eyebrow="Click Price" title="点击单价" value={`¥${formatMetric(view.click_price)} / 次`} tone="blue" />
          <PortalInfoCard eyebrow="Listing" title="上架状态" value={listingStatus.label} tone={listingStatus.tone} />
        </div>
        {view.admin_telegram_username && (
          <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-sky-100 bg-sky-50 text-sky-700 shadow-[0_8px_24px_rgba(14,165,233,0.12)]">
                <Headphones className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Support</div>
                <div className="mt-1 text-sm font-black text-slate-950">系统管理员客服</div>
              </div>
            </div>
            <a
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700 transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-sky-500/25 md:w-auto"
              href={buildTelegramResolveUrl(view.admin_telegram_username)}
            >
              <Send className="h-4 w-4" />
              <span className="break-all">@{view.admin_telegram_username}</span>
            </a>
          </div>
        )}
      </PortalSectionCard>
    );
    const isApplicationApproved = view.application.review_status === 'reviewed';

    return (
      <div className="space-y-6">
        {isApplicationApproved ? (
          <>
            {accountOverviewSection}
            {renderTelegramBotSection(view)}
          </>
        ) : (
          <>
            {renderOnboardingGuide(view)}
            {stageSection}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4fbff_0%,#ffffff_42%,#f4fff8_100%)] font-sans relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-[-120px] top-[-80px] h-72 w-72 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="absolute right-[-120px] top-20 h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'linear-gradient(#0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)', backgroundSize: '36px 36px' }}
        />
      </div>

      <div className={`relative z-10 mx-auto px-4 py-8 md:py-12 ${view ? 'max-w-6xl' : 'max-w-4xl'}`}>
        <div className="mb-8 flex items-center justify-between gap-4 flex-wrap">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/85 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-700 shadow-sm">
            {PUBLIC_SITE_BRAND_NAME} Portal
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="text-[11px] md:text-xs font-black uppercase tracking-[0.18em] text-slate-500 hover:text-slate-900">
              返回首页
            </a>
            {view && (
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                退出
              </button>
            )}
          </div>
        </div>

        <section className={view ? 'grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]' : 'space-y-5'}>
          {view && (
            <aside className="h-fit rounded-[30px] border border-slate-200/80 bg-white/90 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.06)] lg:sticky lg:top-6">
              <div className="rounded-[24px] border border-slate-100 bg-slate-50 px-4 py-4">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-700">Account</div>
                <div className="mt-2 break-all text-sm font-black text-slate-950">{view.account.email}</div>
                <div className="mt-3 text-3xl font-black text-slate-950">¥{formatMetric(view.wallet.balance)}</div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black ${view.wallet.balance >= view.click_price ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {view.wallet.balance >= view.click_price ? '余额可用' : '余额不足'}
                  </div>
                  <button
                    type="button"
                    className={portalSidebarRechargeButtonClass}
                    onClick={() => switchPortalTab('recharge')}
                  >
                    <Banknote className="h-4 w-4" />
                    充值
                  </button>
                </div>
              </div>
              <nav className="mt-4 space-y-2">
                {portalNavItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-black transition ${portalTab === item.key ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                    onClick={() => switchPortalTab(item.key)}
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ))}
              </nav>
            </aside>
          )}
          <div className="min-w-0 space-y-5">
          {success && (
            <div className="flex items-start gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50/95 px-4 py-4 text-sm text-emerald-700 shadow-[0_12px_30px_rgba(16,185,129,0.08)]">
              <CheckCircle2 className="mt-0.5 h-4 w-4" />
              <div>{success}</div>
            </div>
          )}
          {error && (
            <div className="flex items-start gap-3 rounded-[24px] border border-rose-200 bg-rose-50/95 px-4 py-4 text-sm text-rose-700 shadow-[0_12px_30px_rgba(244,63,94,0.08)]">
              <CircleAlert className="mt-0.5 h-4 w-4" />
              <div>{error}</div>
            </div>
          )}
          {renderContent()}
          </div>
        </section>
      </div>
      <PortalApplicationEditModal
        open={isApplicationModalOpen}
        canEdit={Boolean(view && view.application.payment_status !== 'paid')}
        currentLoginEmail={view?.account.email || ''}
        applicationForm={applicationForm}
        setApplicationForm={setApplicationForm}
        applicationEmailCode={applicationEmailCode}
        setApplicationEmailCode={setApplicationEmailCode}
        setApplicationEmailCodeStatus={setApplicationEmailCodeStatus}
        sendingApplicationEmailCode={sendingApplicationEmailCode}
        applicationEmailCodeStatus={applicationEmailCodeStatus}
        savingApplication={savingApplication}
        error={error}
        onClose={closeApplicationModal}
        onSendApplicationEmailCode={() => void sendApplicationEmailCode()}
        onSubmit={saveApplication}
      />
      <PortalEmailChangeModal
        open={isEmailChangeModalOpen}
        currentEmail={view?.account.email || ''}
        newEmail={newLoginEmail}
        code={emailChangeCode}
        sendingCode={sendingEmailChangeCode}
        submitting={changingEmail}
        status={emailChangeStatus}
        error={emailChangeError}
        onNewEmailChange={(value) => {
          setNewLoginEmail(value);
          setEmailChangeCode('');
          setEmailChangeStatus('');
          setEmailChangeError('');
        }}
        onCodeChange={(value) => {
          setEmailChangeCode(value);
          setEmailChangeError('');
        }}
        onSendCode={() => void sendAccountEmailCode()}
        onClose={closeEmailChangeModal}
        onSubmit={submitAccountEmailChange}
      />
      {view && adCampaignModalMode !== 'closed' && (
        <PortalAdCampaignModal
          open
          mode={adCampaignModalMode}
          applicationName={view.application.name}
          adStatus={view.ad_status}
          walletBalance={view.wallet.balance}
          form={adCampaignForm}
          submitting={submittingAdCampaign}
          onFormChange={setAdCampaignForm}
          onClose={closeAdCampaignModal}
          onSubmit={(event) => void submitAdCampaign(event)}
        />
      )}
      <PortalPasswordRequiredModal
        open={isPasswordRequiredModalOpen}
        onClose={() => setIsPasswordRequiredModalOpen(false)}
        onGoToPassword={goToPasswordChange}
      />
    </div>
  );
}

function ReadonlyCredentialField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">{label}</div>
      <div className="mt-2 break-all text-sm font-medium text-neutral-900">{value}</div>
    </div>
  );
}

function PortalAdField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function formatPortalReviewStatus(status: PortalApplicationView['review_status']): string {
  switch (status) {
    case 'awaiting_payment':
      return '待支付';
    case 'pending':
      return '待审批';
    case 'reviewed':
      return '已审核';
    case 'rejected':
      return '已驳回';
    default:
      return status;
  }
}

function formatPortalPaymentStatus(status: PortalApplicationView['payment_status']): string {
  return status === 'paid' ? '已支付' : '未支付';
}

function getPortalPaymentMethods(view: PortalViewResponse): PaymentChannel[] {
  return Array.isArray(view.payment_methods) ? view.payment_methods : ['alipay', 'wxpay'];
}

function getPortalListingStatus(wallet: PortalWalletView): { label: string; tone: 'green' | 'amber' } {
  if (wallet.airport_is_listed === true) {
    return { label: '正常', tone: 'green' };
  }
  if (wallet.airport_is_listed === false) {
    return { label: '已下架', tone: 'amber' };
  }
  if (wallet.auto_unlisted_at) {
    return { label: '总分暂不公开', tone: 'amber' };
  }
  return { label: '正常', tone: 'green' };
}

function formatPaymentChannelLabel(channel: PaymentChannel): string {
  if (channel === 'alipay') {
    return '支付宝';
  }
  if (channel === 'wxpay') {
    return '微信';
  }
  return 'USDT';
}

function renderPendingPaymentWindowError(targetWindow: Window, error: unknown): void {
  const message = error instanceof Error ? error.message : '创建支付订单失败，请返回页面重试。';
  targetWindow.document.open();
  targetWindow.document.write(`<!doctype html><title>支付创建失败</title><body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:24px;color:#0f172a"><h1 style="font-size:18px;margin:0 0 12px">支付创建失败</h1><p style="line-height:1.7;color:#475569">${escapeHtml(message)}</p><p style="line-height:1.7;color:#64748b">请返回 GateRank 页面检查错误提示后重试。</p></body>`);
  targetWindow.document.close();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getPaymentCardTone(channel: PaymentChannel): 'alipay' | 'wechat' | 'usdt' {
  if (channel === 'alipay') {
    return 'alipay';
  }
  if (channel === 'wxpay') {
    return 'wechat';
  }
  return 'usdt';
}

function getRechargeButtonClass(channel: PaymentChannel): string {
  if (channel === 'alipay') {
    return `${portalRechargeChannelButtonBaseClass} bg-sky-600 hover:bg-sky-700 hover:shadow-sky-500/25`;
  }
  if (channel === 'wxpay') {
    return `${portalRechargeChannelButtonBaseClass} bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-500/25`;
  }
  return `${portalRechargeChannelButtonBaseClass} bg-teal-700 hover:bg-teal-800 hover:shadow-teal-500/25`;
}

function formatRechargeStatus(status: PortalRechargeOrderView['status']): string {
  switch (status) {
    case 'paid':
      return '已支付';
    case 'failed':
      return '失败';
    case 'expired':
      return '已过期';
    case 'canceled':
      return '已取消';
    default:
      return '待支付';
  }
}

function formatClickBillingStatus(status: PortalClickView['billing_status']): string {
  switch (status) {
    case 'billed':
      return '已扣费';
    case 'duplicate':
      return '24小时重复不扣费';
    case 'free':
      return '余额不足免费放行';
    case 'insufficient_balance':
      return '余额不足';
    case 'unlisted':
      return '已下架';
    case 'no_wallet':
      return '未绑定钱包';
    default:
      return status;
  }
}

function formatTransactionType(type: PortalWalletTransactionView['transaction_type']): string {
  switch (type) {
    case 'recharge':
      return '充值';
    case 'click_charge':
      return '点击扣费';
    case 'ad_campaign_charge':
      return '广告投放';
    default:
      return '调整';
  }
}

function buildTelegramResolveUrl(username: string): string {
  return `tg://resolve?domain=${encodeURIComponent(username)}`;
}

function formatPortalPlacement(value: string): string {
  switch (value) {
    case 'home_card':
      return '首页卡片';
    case 'full_ranking_item':
      return '完整榜单';
    case 'risk_monitor_item':
      return '风险监控';
    case 'report_header':
      return '报告页';
    case 'deal_card':
      return '活动优惠';
    default:
      return value;
  }
}

function PublicFormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-medium text-neutral-900">{label}</div>
        {hint && <div className="mt-1 text-xs text-neutral-500">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function PortalCheckboxPillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T[];
  onChange: (value: T[]) => void;
}) {
  const selected = new Set(value);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={`rounded-full border px-3 py-2 text-xs font-black transition ${
              active ? 'border-cyan-600 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => onChange(active ? value.filter((item) => item !== option.value) : [...value, option.value])}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PortalCompactCheckboxPillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T[];
  onChange: (value: T[]) => void;
}) {
  const selected = new Set(value);
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap py-1">
      {options.map((option) => {
        const active = selected.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={`inline-flex h-9 shrink-0 items-center justify-center rounded-full border px-4 text-xs font-black transition ${
              active ? 'border-cyan-600 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => onChange(active ? value.filter((item) => item !== option.value) : [...value, option.value])}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PortalCompactBooleanRadioGroup({
  name,
  value,
  onChange,
}: {
  name: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <div className="inline-flex h-10 items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 p-1">
      {[
        { label: '是', value: true },
        { label: '否', value: false },
        { label: '未设置', value: null },
      ].map((option) => {
        const active = value === option.value;
        return (
          <button
            key={`${name}-${option.label}`}
            type="button"
            className={`inline-flex h-8 min-w-[56px] items-center justify-center rounded-full px-3 text-xs font-black transition ${
              active ? 'bg-white text-cyan-700 shadow-sm ring-1 ring-cyan-100' : 'text-slate-500 hover:bg-white/70 hover:text-slate-800'
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PortalNullableBooleanRadioGroup({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-4">
      <div className="text-sm font-black text-slate-950">{label}</div>
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm font-black text-slate-700">
        {[
          { label: '是', value: true },
          { label: '否', value: false },
          { label: '未设置', value: null },
        ].map((option) => (
          <label key={`${name}-${option.label}`} className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name={name}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function formatNullableBooleanLabel(value: boolean | null): string {
  if (value === true) return '是';
  if (value === false) return '否';
  return '未设置';
}

function formatSelectedLabels<T extends string>(
  value: T[] | undefined,
  options: Array<{ value: T; label: string }>,
): string {
  const labels = (value || [])
    .map((item) => options.find((option) => option.value === item)?.label)
    .filter(Boolean);
  return labels.length > 0 ? labels.join('、') : '-';
}

function createDefaultAirportProfile(): AirportProfile {
  return {
    plan: {
      supports_monthly: null,
      supports_quarterly: null,
      supports_half_yearly: null,
      supports_annual: null,
      lowest_monthly_price: null,
      lowest_annual_monthly_price: null,
      has_trial_plan: null,
      has_lifetime_plan: null,
    },
    telegram: {
      has_group: null,
      group_url: null,
      has_channel: null,
      channel_url: null,
      group_allows_speaking: null,
      group_member_count: null,
      recent_active_at: null,
      has_customer_service_bot: null,
      has_ticket_system: null,
    },
    clients: Object.fromEntries(AIRPORT_PROFILE_CLIENT_OPTIONS.map((item) => [item.value, null])) as Record<
      AirportProfileClientKey,
      boolean | null
    >,
    import_methods: {
      one_click_import: null,
      subscription_link: null,
      universal_subscription: null,
      qr_code_import: null,
      tutorials: null,
    },
    regions: Object.fromEntries(
      AIRPORT_PROFILE_REGION_OPTIONS.map((item) => [item.value, {
        has_residential: null,
        has_native_ip: null,
        line_types: [],
      }]),
    ) as Record<AirportProfileRegionKey, AirportProfileRegionInfo>,
  };
}

function normalizeAirportProfile(
  value: unknown,
  planPriceMonth?: number | null,
  hasTrial?: boolean | null,
): AirportProfile {
  const defaults = createDefaultAirportProfile();
  if (!value || typeof value !== 'object') {
    if (planPriceMonth !== undefined && planPriceMonth !== null) {
      defaults.plan.lowest_monthly_price = planPriceMonth;
    }
    if (hasTrial !== undefined && hasTrial !== null) {
      defaults.plan.has_trial_plan = hasTrial;
    }
    return defaults;
  }
  const input = value as Partial<AirportProfile>;
  const plan = (input.plan || {}) as Partial<AirportProfilePlan>;
  const telegram = (input.telegram || {}) as Partial<AirportProfileTelegram>;
  const clients = (input.clients || {}) as Partial<Record<AirportProfileClientKey, boolean | null>>;
  const importMethods = (input.import_methods || {}) as Partial<AirportProfileImportMethods>;
  const regions = (input.regions || {}) as Partial<Record<AirportProfileRegionKey, Partial<AirportProfileRegionInfo>>>;
  const profile: AirportProfile = {
    plan: {
      supports_monthly: normalizeNullableBoolean(plan.supports_monthly),
      supports_quarterly: normalizeNullableBoolean(plan.supports_quarterly),
      supports_half_yearly: normalizeNullableBoolean(plan.supports_half_yearly),
      supports_annual: normalizeNullableBoolean(plan.supports_annual),
      lowest_monthly_price: normalizeOptionalNumber(plan.lowest_monthly_price),
      lowest_annual_monthly_price: normalizeOptionalNumber(plan.lowest_annual_monthly_price),
      has_trial_plan: normalizeNullableBoolean(plan.has_trial_plan),
      has_lifetime_plan: normalizeNullableBoolean(plan.has_lifetime_plan),
    },
    telegram: {
      has_group: normalizeNullableBoolean(telegram.has_group),
      group_url: normalizeOptionalString(telegram.group_url),
      has_channel: normalizeNullableBoolean(telegram.has_channel),
      channel_url: normalizeOptionalString(telegram.channel_url),
      group_allows_speaking: normalizeNullableBoolean(telegram.group_allows_speaking),
      group_member_count: normalizeOptionalInteger(telegram.group_member_count),
      recent_active_at: normalizeOptionalString(telegram.recent_active_at),
      has_customer_service_bot: normalizeNullableBoolean(telegram.has_customer_service_bot),
      has_ticket_system: normalizeNullableBoolean(telegram.has_ticket_system),
    },
    clients: Object.fromEntries(
      AIRPORT_PROFILE_CLIENT_OPTIONS.map((item) => [item.value, normalizeNullableBoolean(clients[item.value])]),
    ) as Record<AirportProfileClientKey, boolean | null>,
    import_methods: {
      one_click_import: normalizeNullableBoolean(importMethods.one_click_import),
      subscription_link: normalizeNullableBoolean(importMethods.subscription_link),
      universal_subscription: normalizeNullableBoolean(importMethods.universal_subscription),
      qr_code_import: normalizeNullableBoolean(importMethods.qr_code_import),
      tutorials: normalizeNullableBoolean(importMethods.tutorials),
    },
    regions: Object.fromEntries(
      AIRPORT_PROFILE_REGION_OPTIONS.map((item) => {
        const region = regions[item.value] || defaults.regions[item.value];
        return [item.value, {
          has_residential: normalizeNullableBoolean(region.has_residential),
          has_native_ip: normalizeNullableBoolean(region.has_native_ip),
          line_types: normalizeAirportOptionValues(region.line_types, AIRPORT_PROFILE_LINE_TYPE_OPTIONS),
        }];
      }),
    ) as Record<AirportProfileRegionKey, AirportProfileRegionInfo>,
  };
  if (profile.plan.lowest_monthly_price === null && planPriceMonth !== undefined && planPriceMonth !== null) {
    profile.plan.lowest_monthly_price = planPriceMonth;
  }
  if (profile.plan.has_trial_plan === null && hasTrial !== undefined && hasTrial !== null) {
    profile.plan.has_trial_plan = hasTrial;
  }
  return profile;
}

function createApplicationForm(): ApplicationFormState {
  return {
    name: '',
    websites: [''],
    plan_price_month: '',
    has_trial: false,
    streaming_support: [],
    payment_methods: [],
    payment_crypto_other: '',
    profile: createDefaultAirportProfile(),
    subscription_url: '',
    applicant_email: '',
    applicant_telegram: '',
    founded_on: '',
    airport_intro: '',
    test_account: '',
    test_password: '',
  };
}

function createPortalApplicationForm(
  application?: PortalApplicationView | null,
): ApplicationFormState {
  if (!application) {
    return createApplicationForm();
  }

  return {
    name: application.name || '',
    websites: application.websites && application.websites.length > 0
      ? application.websites
      : application.website
        ? [application.website]
        : [''],
    plan_price_month: String(application.plan_price_month ?? ''),
    has_trial: Boolean(application.has_trial),
    streaming_support: normalizeAirportOptionValues(application.streaming_support, AIRPORT_STREAMING_SUPPORT_OPTIONS),
    payment_methods: normalizeAirportOptionValues(application.payment_methods, AIRPORT_PAYMENT_METHOD_OPTIONS),
    payment_crypto_other: application.payment_crypto_other || '',
    profile: normalizeAirportProfile(application.profile, application.plan_price_month, application.has_trial),
    subscription_url: application.subscription_url || '',
    applicant_email: application.applicant_email || '',
    applicant_telegram: application.applicant_telegram || '',
    founded_on: application.founded_on || '',
    airport_intro: application.airport_intro || '',
    test_account: application.test_account || '',
    test_password: application.test_password || '',
  };
}

function normalizeUrlList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function updateUrlListItem(values: string[], index: number, nextValue: string): string[] {
  return values.map((value, currentIndex) => (currentIndex === index ? nextValue : value));
}

function removeUrlListItem(values: string[], index: number): string[] {
  const nextValues = values.filter((_, currentIndex) => currentIndex !== index);
  return nextValues.length > 0 ? nextValues : [''];
}

function normalizeAirportOptionValues<T extends string>(
  value: unknown,
  options: Array<{ value: T; label: string }>,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const allowed = new Set(options.map((option) => option.value));
  return [...new Set(value.map(String).filter((item): item is T => allowed.has(item as T)))];
}

function normalizeNullableBoolean(value: boolean | null | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed || null;
}

function normalizeOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeOptionalInteger(value: unknown): number | null {
  const parsed = normalizeOptionalNumber(value);
  return parsed === null ? null : Math.floor(parsed);
}

function parseOptionalNumberInput(value: string): number | null {
  return normalizeOptionalNumber(value);
}

function todayInShanghai(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function App() {
  const [route, setRoute] = useState<RouteState>(() => parseRoute());

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      trackPageView();
      const marketingPageKind = toMarketingPageKind(route.kind);
      if (marketingPageKind) {
        trackMarketingPageView(marketingPageKind);
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [route]);

  useEffect(() => {
    const flush = () => flushMarketingEvents();
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  if (route.kind === 'report' && (route.airportId || route.airportSlug)) {
    return <ReportPage airportId={route.airportId} airportSlug={route.airportSlug} date={route.date} />;
  }

  if (route.kind === 'apply') {
    return <ApplicationPage />;
  }

  if (route.kind === 'portal') {
    return <PortalPage />;
  }

  if (route.kind === 'methodology') {
    return <MethodologyPage />;
  }

  if (route.kind === 'publish_token_docs') {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LazyPublishTokenDocsPage />
      </Suspense>
    );
  }

  if (route.kind === 'full_ranking') {
    return <FullRankingPage date={route.date} page={route.page} filters={route.filters} />;
  }

  if (route.kind === 'deals') {
    return <DealsPage />;
  }

  if (route.kind === 'risk_monitor') {
    return <RiskMonitorPage date={route.date} page={route.page} />;
  }

  if (route.kind === 'home') {
    return <HomePage date={route.date} />;
  }

  return <NotFoundPage />;
}

function NotFoundPage() {
  usePageSeo({
    title: '页面不存在 | 机场榜GateRank',
    description: '当前访问的 GateRank 页面不存在，请返回首页、全量榜单或跑路监测页面继续查看机场 VPN 测评与风险信息。',
    keywords: 'GateRank,机场榜,404,页面不存在,机场VPN,机场测评',
    canonicalPath: '/404',
    robots: 'noindex,follow',
  });

  return (
    <PageFrame active="home">
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-4 py-24">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-neutral-500">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          404 Not Found
        </div>
        <h1 className="text-3xl font-black tracking-normal text-neutral-950 md:text-5xl">页面不存在</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-neutral-600">
          这个地址没有对应的公开页面。你可以返回首页查看今日推荐，或进入全量榜单和跑路监测继续筛选机场服务。
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate('/', { scrollToTop: true })}
            className="inline-flex h-11 items-center justify-center rounded-lg bg-neutral-950 px-5 text-sm font-black text-white"
          >
            返回首页
          </button>
          <button
            type="button"
            onClick={() => navigate('/rankings/all', { scrollToTop: true })}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-200 bg-white px-5 text-sm font-black text-neutral-800"
          >
            全量榜单
          </button>
          <button
            type="button"
            onClick={() => navigate('/risk-monitor', { scrollToTop: true })}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-neutral-200 bg-white px-5 text-sm font-black text-neutral-800"
          >
            跑路监测
          </button>
        </div>
      </main>
    </PageFrame>
  );
}

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
        <div className="rounded-full border border-neutral-200 bg-neutral-50 px-5 py-2 text-sm font-medium text-neutral-500">
          正在加载页面
        </div>
      </div>
    </div>
  );
}
