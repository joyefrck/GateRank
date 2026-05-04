import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield,
  Database,
  Bell,
  BarChart3,
  Newspaper,
  Activity,
  RefreshCw,
  LogOut,
  Plus,
  Search,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Trash2,
  X,
} from 'lucide-react';
import { TagBadgeGroup } from '../components/TagBadge';
import { NewsEditorPage, NewsListPage } from './news/NewsPages';
import { buildPublishTokenDocsHref } from '../site/publicSite';

type AirportStatus = 'normal' | 'risk' | 'down';
type StabilityTier = 'stable' | 'minor_fluctuation' | 'volatile';
type AirportApplicationReviewStatus = 'awaiting_payment' | 'pending' | 'reviewed' | 'rejected';
type ProbeSampleType = 'latency' | 'download' | 'availability';
type ProbeScope = 'stability' | 'performance';
type ManualJobKind = 'full' | 'stability' | 'performance' | 'risk' | 'time_decay';
type ManualJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';
type PublishTokenScope = 'news:create' | 'news:update' | 'news:publish' | 'news:archive' | 'news:upload';
type SchedulerTaskKey = 'stability' | 'performance' | 'risk' | 'aggregate_recompute';
type SchedulerRunStatus = 'running' | 'succeeded' | 'failed';
type SchedulerTriggerSource = 'schedule' | 'restart' | 'bootstrap_recover';

interface Airport {
  id: number;
  name: string;
  website: string;
  websites?: string[];
  status: AirportStatus;
  is_listed: boolean;
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
  created_at: string;
  total_score?: number | null;
  formula_total_score?: number | null;
  manual_total_score?: number | null;
  total_score_source?: 'manual' | 'formula' | null;
  price_score?: number | null;
  score_data_days?: number | null;
  wallet_id?: number | null;
  wallet_balance?: number | null;
}

interface AirportFormState {
  id?: number;
  name: string;
  websites: string[];
  status: AirportStatus;
  is_listed: boolean;
  plan_price_month: string;
  has_trial: boolean;
  subscription_url: string;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
  manual_tags: string[];
  wallet_id: number | null;
  wallet_balance: number | null;
}

interface AirportDashboardView {
  date: string;
  pipeline: {
    stage: 'ready' | 'metrics_pending_score' | 'samples_pending_aggregation' | 'empty';
    message: string | null;
    has_probe_samples: boolean;
    has_metrics: boolean;
    has_score: boolean;
    public_resolved_date: string | null;
    resolved_from_fallback: boolean;
  };
  base: Airport;
  stability: {
    uptime_percent_30d: number | null;
    uptime_percent_today: number | null;
    latency_samples_ms: number[];
    latency_mean_ms: number | null;
    latency_std_ms: number | null;
    latency_cv: number | null;
    effective_latency_cv: number | null;
    download_samples_mbps: number[];
    stable_days_streak: number | null;
    healthy_days_streak: number | null;
    is_stable_day: boolean | null;
    stability_tier: StabilityTier | null;
    s: number | null;
    uptime_score: number | null;
    stability_score: number | null;
    streak_score: number | null;
    stability_rule_version: string | null;
  };
  performance: {
    median_latency_ms: number | null;
    median_download_mbps: number | null;
    packet_loss_percent: number | null;
    p: number | null;
    latency_score: number | null;
    speed_score: number | null;
    loss_score: number | null;
    data_source_mode: string | null;
    cache_source_date: string | null;
    collect_status: string | null;
    last_sampled_at: string | null;
    last_source: string | null;
    subscription_format: string | null;
    parsed_nodes_count: number | null;
    supported_nodes_count: number | null;
    selected_nodes: Array<{ name: string; region?: string | null; type?: string | null }>;
    tested_nodes: Array<{
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
    }>;
    tested_nodes_count: number | null;
    error_code: string | null;
    error_message: string | null;
    latency_measurement: string | null;
    latency_probe_target: string | null;
    proxy_http_test_url: string | null;
    proxy_http_median_latency_ms: number | null;
    speed_measurement: string | null;
    speed_test_connections: number | null;
  };
  risk: {
    domain_ok: boolean | null;
    ssl_days_left: number | null;
    recent_complaints_count: number | null;
    history_incidents: number | null;
    domain_penalty: number | null;
    ssl_penalty: number | null;
    complaint_penalty: number | null;
    history_penalty: number | null;
    total_penalty: number | null;
    risk_penalty: number | null;
    r: number | null;
    risk_level: string | null;
  };
  time_decay: {
    date: string;
    recent_score_cache: number | null;
    historical_score_cache: number | null;
    score?: number | null;
    recent_score?: number | null;
    historical_score?: number | null;
    final_score?: number | null;
  };
}

interface AirportApplication {
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

interface ProbeSample {
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

type DashboardTab = 'base' | 'stability' | 'performance' | 'risk' | 'time_decay';

interface ManualJobRecord {
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

interface TelegramSettingsView {
  enabled: boolean;
  delivery_mode: 'telegram_chat' | 'webhook';
  telegram_chat: {
    has_bot_token: boolean;
    bot_token_masked: string | null;
    chat_id: string;
    api_base: string;
    timeout_ms: number;
  };
  webhook: {
    has_bearer_token: boolean;
    bearer_token_masked: string | null;
    url: string;
    timeout_ms: number;
  };
  updated_at: string | null;
  updated_by: string | null;
}

interface TelegramSettingsFormState {
  enabled: boolean;
  delivery_mode: 'telegram_chat' | 'webhook';
  telegram_chat: {
    bot_token: string;
    chat_id: string;
    api_base: string;
    timeout_ms: string;
  };
  webhook: {
    url: string;
    bearer_token: string;
    timeout_ms: string;
  };
}

type SystemSettingsTab = 'notifications' | 'payment_gateway' | 'smtp' | 'media_libraries' | 'publish_tokens';

type MarketingGranularity = 'hour' | 'day' | 'week' | 'month';
type MarketingRangePreset = 'day' | 'week' | 'month' | 'custom';
type MarketingAirportSortBy = 'ctr' | 'clicks' | 'impressions' | 'last_clicked_at';
type MarketingSortOrder = 'asc' | 'desc';
type MarketingSourceType = 'google' | 'baidu' | 'x' | 'bing' | 'reddit' | 'telegram' | 'wechat' | 'direct_or_unknown' | 'other_referral';
type MarketingPageKind = 'home' | 'full_ranking' | 'risk_monitor' | 'report' | 'methodology' | 'news' | 'apply' | 'publish_token_docs';
type MarketingPlacement = 'home_card' | 'full_ranking_item' | 'risk_monitor_item' | 'report_header';
type MarketingTargetKind = 'website' | 'subscription_url';

interface MarketingTrendPoint {
  period_start: string;
  page_views: number;
  unique_visitors: number;
  airport_impressions: number;
  outbound_clicks: number;
  ctr: number | null;
}

interface MarketingOverviewResponse {
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

interface MarketingSourceFilterItem {
  source_type: MarketingSourceType;
  source_label: string;
}

interface MarketingCountryFilterItem {
  country_code: string;
  country_name: string;
}

interface MarketingSourceBreakdownItem {
  source_type: MarketingSourceType;
  source_label: string;
  page_views: number;
  unique_visitors: number;
  airport_impressions: number;
  outbound_clicks: number;
  ctr: number | null;
  traffic_share: number | null;
}

interface MarketingCountryBreakdownItem {
  country_code: string;
  country_name: string;
  page_views: number;
  unique_visitors: number;
  airport_impressions: number;
  outbound_clicks: number;
  ctr: number | null;
  traffic_share: number | null;
}

interface MarketingPageStatsItem {
  page_path: string;
  page_kind: MarketingPageKind;
  page_views: number;
  unique_visitors: number;
  outbound_clicks: number;
  last_visited_at: string | null;
}

interface MarketingPagesResponse {
  date_from: string;
  date_to: string;
  items: MarketingPageStatsItem[];
}

interface MarketingAirportConversionItem {
  airport_id: number;
  airport_name: string;
  airport_impressions: number;
  outbound_clicks: number;
  ctr: number | null;
  primary_placement: MarketingPlacement | null;
  last_clicked_at: string | null;
}

interface MarketingAirportsResponse {
  date_from: string;
  date_to: string;
  sort_by: MarketingAirportSortBy;
  sort_order: MarketingSortOrder;
  keyword: string;
  items: MarketingAirportConversionItem[];
}

interface MarketingPlacementBreakdownItem {
  placement: MarketingPlacement | null;
  airport_impressions: number;
  outbound_clicks: number;
  ctr: number | null;
}

interface MarketingTargetBreakdownItem {
  target_kind: MarketingTargetKind | null;
  outbound_clicks: number;
}

interface MarketingAirportDetailResponse {
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

const MARKETING_AIRPORTS_PAGE_SIZE = 20;

interface PaymentGatewaySettingsView {
  enabled: boolean;
  pid: string;
  has_private_key: boolean;
  private_key_masked: string | null;
  platform_public_key: string;
  application_fee_amount: number;
  updated_at: string | null;
  updated_by: string | null;
}

interface PaymentGatewaySettingsFormState {
  enabled: boolean;
  pid: string;
  private_key: string;
  platform_public_key: string;
  application_fee_amount: string;
}

interface SmtpSettingsView {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  has_password: boolean;
  password_masked: string | null;
  from_name: string;
  from_email: string;
  reply_to: string;
  templates: SmtpTemplateMap;
  updated_at: string | null;
  updated_by: string | null;
}

type SmtpTemplateKey = 'applicant_credentials' | 'application_approved';

interface SmtpTemplateItem {
  subject: string;
  body: string;
}

interface SmtpTemplateMap {
  applicant_credentials: SmtpTemplateItem;
  application_approved: SmtpTemplateItem;
}

interface SmtpSettingsFormState {
  enabled: boolean;
  host: string;
  port: string;
  secure: boolean;
  username: string;
  password: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  test_to: string;
  templates: SmtpTemplateMap;
}

interface MediaLibrarySettingsView {
  providers: {
    pexels: {
      enabled: boolean;
      has_api_key: boolean;
      api_key_masked: string | null;
      timeout_ms: number;
    };
  };
  updated_at: string | null;
  updated_by: string | null;
}

interface MediaLibrarySettingsFormState {
  providers: {
    pexels: {
      enabled: boolean;
      api_key: string;
      timeout_ms: string;
    };
  };
}

interface PublishTokenView {
  id: number;
  name: string;
  description: string;
  token_masked: string;
  scopes: PublishTokenScope[];
  status: 'active' | 'revoked';
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface PublishTokenListView {
  items: PublishTokenView[];
}

interface PublishTokenCreateResponse {
  token: PublishTokenView;
  plain_token: string;
}

interface PublishTokenCreateFormState {
  name: string;
  description: string;
  expires_at: string;
  scopes: PublishTokenScope[];
}

interface SchedulerRunRecord {
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

interface SchedulerTaskView {
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
  description: string;
  next_run_at: string | null;
  is_running: boolean;
  latest_run: SchedulerRunRecord | null;
}

interface SchedulerTaskListView {
  items: SchedulerTaskView[];
}

interface SchedulerRunsResponse {
  page: number;
  page_size: number;
  total: number;
  items: SchedulerRunRecord[];
}

interface SchedulerDailyStat {
  run_date: string;
  task_key: SchedulerTaskKey;
  total_runs: number;
  success_count: number;
  failed_count: number;
  total_duration_ms: number;
  last_status: SchedulerRunStatus;
  last_started_at: string | null;
  last_finished_at: string | null;
}

interface SchedulerDailyStatsResponse {
  date_from: string;
  date_to: string;
  items: SchedulerDailyStat[];
}

const PUBLISH_TOKEN_SCOPES: Array<{ value: PublishTokenScope; label: string; description: string }> = [
  { value: 'news:create', label: '创建文章', description: '允许创建新闻草稿或直接发文。' },
  { value: 'news:update', label: '更新文章', description: '允许修改已有新闻内容。' },
  { value: 'news:publish', label: '发布文章', description: '允许将文章直接发布上线。' },
  { value: 'news:archive', label: '归档文章', description: '允许下线或归档文章。' },
  { value: 'news:upload', label: '上传图片', description: '允许上传正文或封面图片。' },
];

const DEFAULT_PUBLISH_TOKEN_SCOPES = PUBLISH_TOKEN_SCOPES.map((item) => item.value);

const TOKEN_KEY = 'gaterank_admin_token';
const ADMIN_DEFAULT_PATH = '/admin/marketing';
const SMTP_TEMPLATE_ORDER: SmtpTemplateKey[] = ['applicant_credentials', 'application_approved'];
const SMTP_TEMPLATE_SCENARIOS: Record<
  SmtpTemplateKey,
  {
    title: string;
    trigger: string;
    description: string;
    variables: string[];
    sampleValues: Record<string, string>;
  }
> = {
  applicant_credentials: {
    title: '申请账号凭证邮件',
    trigger: '用户提交入驻申请并创建申请人后台账号后发送。',
    description: '用于告知申请人后台登录邮箱、初始密码和登录地址。',
    variables: ['{{airport_name}}', '{{portal_email}}', '{{initial_password}}', '{{portal_login_url}}', '{{applicant_email}}', '{{site_name}}'],
    sampleValues: {
      airport_name: '大象网络',
      portal_email: 'owner@example.com',
      initial_password: 'Passw0rd!',
      portal_login_url: 'https://gaterank.example.com/portal',
      applicant_email: 'owner@example.com',
      site_name: 'GateRank',
    },
  },
  application_approved: {
    title: '审批通过邮件',
    trigger: '管理员审批通过申请后发送。',
    description: '用于通知申请人申请已审核通过。',
    variables: ['{{airport_name}}', '{{applicant_email}}', '{{site_name}}'],
    sampleValues: {
      airport_name: '大象网络',
      applicant_email: 'owner@example.com',
      site_name: 'GateRank',
    },
  },
};

function getApiBase(): string {
  const fromEnv = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE;
  if (fromEnv && fromEnv.trim()) {
    return fromEnv.replace(/\/+$/, '');
  }
  return '';
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBase()}${path}`, { ...init, headers });
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    if (window.location.pathname !== '/admin/login') {
      window.history.pushState({}, '', '/admin/login');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    throw new Error('登录已过期，请重新登录');
  }

  if (!response.ok) {
    const data = (await safeJson(response)) as { message?: string };
    throw new Error(data?.message || `请求失败: ${response.status}`);
  }

  return safeJson(response);
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function AdminApp() {
  const [path, setPath] = useState(window.location.pathname);
  const [adminToken, setAdminToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  useEffect(() => {
    if (path === '/admin') {
      window.history.replaceState({}, '', ADMIN_DEFAULT_PATH);
      setPath(ADMIN_DEFAULT_PATH);
    }
  }, [path]);

  const navigate = (to: string) => {
    window.history.pushState({}, '', to);
    setPath(to);
  };

  if (path === '/admin/login') {
    return (
      <LoginPage
        onLoggedIn={(token) => {
          setAdminToken(token);
          navigate(ADMIN_DEFAULT_PATH);
        }}
      />
    );
  }

  if (!adminToken) {
    return (
      <LoginPage
        onLoggedIn={(token) => {
          setAdminToken(token);
          navigate(ADMIN_DEFAULT_PATH);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="bg-white border-b border-neutral-200 px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 font-bold tracking-tight">
          <span className="w-8 h-8 rounded bg-neutral-900 text-white flex items-center justify-center"><Shield size={16} /></span>
          GateRank Admin
        </div>
        <div className="flex items-center gap-2">
          <a
            className="text-sm px-3 py-1.5 rounded border border-neutral-300 bg-white"
            href="/"
            target="_blank"
            rel="noreferrer"
          >
            前台首页
          </a>
          <button
            className="text-sm px-3 py-1.5 rounded bg-neutral-900 text-white"
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              setAdminToken(null);
              navigate('/admin/login');
            }}
          >
            <span className="inline-flex items-center gap-2"><LogOut size={14} />退出</span>
          </button>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-6 grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)] gap-6">
        <aside className="bg-white rounded-xl border border-neutral-200 p-3 h-fit">
          <NavItem icon={<BarChart3 size={14} />} active={path.startsWith('/admin/marketing')} onClick={() => navigate('/admin/marketing')} label="营销" />
          <NavItem icon={<Database size={14} />} active={path.startsWith('/admin/airports')} onClick={() => navigate('/admin/airports')} label="机场管理" />
          <NavItem icon={<Shield size={14} />} active={path.startsWith('/admin/applications')} onClick={() => navigate('/admin/applications')} label="入驻申请" />
          <NavItem icon={<Newspaper size={14} />} active={path.startsWith('/admin/news')} onClick={() => navigate('/admin/news')} label="News" />
          <NavItem icon={<Activity size={14} />} active={path.startsWith('/admin/scheduler')} onClick={() => navigate('/admin/scheduler')} label="任务调度" />
          <NavItem icon={<Bell size={14} />} active={path.startsWith('/admin/settings')} onClick={() => navigate('/admin/settings')} label="系统设置" />
        </aside>

        <main className="bg-white rounded-xl border border-neutral-200 p-6">
          {path === '/admin/airports' && <AirportsPage onOpenAirport={(id) => navigate(`/admin/airports/${id}/data`)} />}
          {path === '/admin/applications' && <ApplicationsPage onOpenAirports={() => navigate('/admin/airports')} />}
          {path === '/admin/news' && <NewsListPage onCreate={() => navigate('/admin/news/new')} onEdit={(id) => navigate(`/admin/news/${id}`)} />}
          {path === '/admin/marketing' && <MarketingPage />}
          {(path === '/admin/news/new' || path.match(/^\/admin\/news\/\d+$/)) && (
            <NewsEditorPage
              articleId={path === '/admin/news/new' ? undefined : Number(path.split('/')[3])}
              onBack={() => navigate('/admin/news')}
              onNavigateToArticle={(id) => navigate(`/admin/news/${id}`)}
            />
          )}
          {path === '/admin/scheduler' && <SchedulerPage />}
          {path === '/admin/settings' && <SystemSettingsPage />}
          {path.match(/^\/admin\/airports\/\d+\/data$/) && (
            <AirportDataPage airportId={Number(path.split('/')[3])} onBack={() => navigate('/admin/airports')} />
          )}
        </main>
      </div>
    </div>
  );
}

function NavItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm ${active ? 'bg-neutral-900 text-white' : 'hover:bg-neutral-100'}`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function LoginPage({ onLoggedIn }: { onLoggedIn: (token: string) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = (await apiFetch('/api/v1/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      })) as { token: string };
      localStorage.setItem(TOKEN_KEY, result.token);
      onLoggedIn(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
        <h1 className="text-xl font-bold">管理后台登录</h1>
        <p className="text-sm text-neutral-500">输入管理员密码获取后台访问令牌</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
          placeholder="管理员密码"
          required
        />
        {error && <div className="text-sm text-rose-600">{error}</div>}
        <button disabled={loading} className="w-full bg-neutral-900 text-white rounded px-3 py-2">
          {loading ? '登录中...' : '登录'}
        </button>
      </form>
    </div>
  );
}

function SchedulerPage() {
  const defaultDateTo = today();
  const defaultDateFrom = shiftDate(defaultDateTo, -6);
  const [tasks, setTasks] = useState<SchedulerTaskView[]>([]);
  const [runs, setRuns] = useState<SchedulerRunRecord[]>([]);
  const [dailyStats, setDailyStats] = useState<SchedulerDailyStat[]>([]);
  const [scheduleDrafts, setScheduleDrafts] = useState<Partial<Record<SchedulerTaskKey, string>>>({});
  const [taskFilter, setTaskFilter] = useState<'all' | SchedulerTaskKey>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SchedulerRunStatus>('all');
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [runPage, setRunPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [taskActionState, setTaskActionState] = useState<{ taskKey: SchedulerTaskKey; action: 'toggle' | 'restart' } | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadTasks = async () => {
    const response = (await apiFetch('/api/v1/admin/scheduler/tasks')) as SchedulerTaskListView;
    setTasks(response.items || []);
    setScheduleDrafts((current) => {
      const next = { ...current };
      for (const task of response.items || []) {
        if (!next[task.task_key]) {
          next[task.task_key] = task.schedule_time;
        }
      }
      return next;
    });
  };

  const loadStatsAndRuns = async () => {
    const query = new URLSearchParams();
    query.set('date_from', dateFrom);
    query.set('date_to', dateTo);
    if (taskFilter !== 'all') {
      query.set('task_key', taskFilter);
    }

    const runQuery = new URLSearchParams(query);
    if (statusFilter !== 'all') {
      runQuery.set('status', statusFilter);
    }
    runQuery.set('page', String(runPage));
    runQuery.set('page_size', '20');

    const [statsResponse, runsResponse] = await Promise.all([
      apiFetch(`/api/v1/admin/scheduler/daily-stats?${query.toString()}`) as Promise<SchedulerDailyStatsResponse>,
      apiFetch(`/api/v1/admin/scheduler/runs?${runQuery.toString()}`) as Promise<SchedulerRunsResponse>,
    ]);

    setDailyStats(statsResponse.items || []);
    setRuns(runsResponse.items || []);
    return runsResponse;
  };

  const refreshAll = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadTasks(), loadStatsAndRuns()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '调度数据加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError('');
      try {
        await loadStatsAndRuns();
      } catch (err) {
        setError(err instanceof Error ? err.message : '调度数据加载失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [taskFilter, statusFilter, dateFrom, dateTo, runPage]);

  const patchTask = async (taskKey: SchedulerTaskKey, payload: Record<string, unknown>, successMessage: string) => {
    setTaskActionState({ taskKey, action: 'toggle' });
    setNotice('');
    setError('');
    try {
      await apiFetch(`/api/v1/admin/scheduler/tasks/${taskKey}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await loadTasks();
      setNotice(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : '任务更新失败');
    } finally {
      setTaskActionState(null);
    }
  };

  const restartTask = async (taskKey: SchedulerTaskKey) => {
    setTaskActionState({ taskKey, action: 'restart' });
    setNotice('');
    setError('');
    try {
      await apiFetch(`/api/v1/admin/scheduler/tasks/${taskKey}/restart`, {
        method: 'POST',
      });
      await refreshAll();
      setNotice(`${formatSchedulerTaskLabel(taskKey)}已重载并执行完成`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重启调度器失败');
    } finally {
      setTaskActionState(null);
    }
  };

  const saveScheduleTime = async (task: SchedulerTaskView) => {
    const draft = scheduleDrafts[task.task_key];
    if (!draft || draft === task.schedule_time) {
      return;
    }
    await patchTask(task.task_key, { schedule_time: draft }, `${task.name}执行时间已更新`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">任务调度</h2>
          <p className="mt-1 text-sm text-neutral-500">统一管理稳定性采集、性能采集、风险体检和聚合重算四个全局任务。所有时间均按上海时间（UTC+08:00）显示。</p>
        </div>
        <button
          type="button"
          className="px-3 py-2 rounded border border-neutral-300 text-sm inline-flex items-center gap-2 bg-white"
          onClick={() => void refreshAll()}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          刷新
        </button>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold">任务列表</h3>
          <p className="mt-1 text-sm text-neutral-500">支持开启、关闭和重启调度器。点击“重启调度器”会立即执行一次真实任务；修改时间后会立即重载当前任务。</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {tasks.map((task) => {
            const isTaskBusy = taskActionState?.taskKey === task.task_key;
            const isToggleBusy = isTaskBusy && taskActionState?.action === 'toggle';
            const isRestartBusy = isTaskBusy && taskActionState?.action === 'restart';
            return (
            <div
              key={task.task_key}
              className="rounded-[28px] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfb_100%)] p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)] space-y-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">Scheduler Task</div>
                  <div className="mt-2 text-[28px] leading-none font-black tracking-tight text-neutral-900">{task.name}</div>
                  <div className="mt-3 max-w-2xl text-sm leading-7 text-neutral-500">{task.description}</div>
                </div>
                <div className={`inline-flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap ${
                  task.enabled
                    ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                    : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200'
                }`}>
                  {task.enabled ? '已开启' : '已关闭'}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 text-sm">
                <div>
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">每日执行时间</div>
                  <input
                    type="time"
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-base shadow-sm"
                    value={scheduleDrafts[task.task_key] || task.schedule_time}
                    onChange={(event) => {
                      const value = event.target.value;
                      setScheduleDrafts((current) => ({ ...current, [task.task_key]: value }));
                    }}
                    onBlur={() => void saveScheduleTime(task)}
                  />
                </div>
                <ReadField label="下次执行" value={formatDateTimeLabel(task.next_run_at)} />
                <ReadField label="调度状态" value={task.is_running ? '运行中' : '空闲'} />
                <ReadField label="最近重载" value={formatDateTimeLabel(task.last_restarted_at)} />
              </div>

              <div className="rounded-3xl border border-neutral-200 bg-neutral-50 px-5 py-4 text-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">最近一次执行</div>
                <div className="mt-2 font-medium text-neutral-900">
                  {task.latest_run
                    ? `${formatSchedulerRunStatus(task.latest_run.status)} / ${formatSchedulerTrigger(task.latest_run.trigger_source)} / ${formatDateTimeLabel(task.latest_run.started_at)}`
                    : '暂无执行记录'}
                </div>
                {task.latest_run?.message && (
                  <div className="mt-2 leading-6 text-neutral-500">{task.latest_run.message}</div>
                )}
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  className={`px-4 py-2.5 rounded-2xl text-sm font-semibold transition-colors ${
                    task.enabled
                      ? 'bg-neutral-900 text-white hover:bg-neutral-800'
                      : 'border border-neutral-300 bg-white hover:bg-neutral-50'
                  } ${isTaskBusy ? 'cursor-not-allowed opacity-60' : ''}`}
                  onClick={() => void patchTask(task.task_key, { enabled: !task.enabled }, `${task.name}${task.enabled ? '已关闭' : '已开启'}`)}
                  disabled={isTaskBusy}
                >
                  {isToggleBusy ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin" />
                      处理中...
                    </span>
                  ) : task.enabled ? '关闭调度' : '开启调度'}
                </button>
                <button
                  type="button"
                  className={`px-4 py-2.5 rounded-2xl border border-neutral-300 bg-white text-sm font-semibold hover:bg-neutral-50 transition-colors ${isTaskBusy ? 'cursor-not-allowed opacity-60' : ''}`}
                  onClick={() => void restartTask(task.task_key)}
                  disabled={isTaskBusy}
                >
                  {isRestartBusy ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshCw size={14} className="animate-spin" />
                      执行中...
                    </span>
                  ) : '重启调度器'}
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold">每日调度统计</h3>
            <p className="mt-1 text-sm text-neutral-500">默认展示最近 7 天，统计按执行日志聚合生成。</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select className="rounded border border-neutral-300 px-3 py-2 text-sm" value={taskFilter} onChange={(event) => { setTaskFilter(event.target.value as 'all' | SchedulerTaskKey); setRunPage(1); }}>
              <option value="all">全部任务</option>
              <option value="stability">稳定性采集</option>
              <option value="performance">性能采集</option>
              <option value="risk">风险体检</option>
              <option value="aggregate_recompute">聚合重算</option>
            </select>
            <input type="date" className="rounded border border-neutral-300 px-3 py-2 text-sm" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setRunPage(1); }} />
            <input type="date" className="rounded border border-neutral-300 px-3 py-2 text-sm" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setRunPage(1); }} />
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">日期</th>
                <th className="px-4 py-3 text-left font-medium">任务</th>
                <th className="px-4 py-3 text-left font-medium">执行次数</th>
                <th className="px-4 py-3 text-left font-medium">成功</th>
                <th className="px-4 py-3 text-left font-medium">失败</th>
                <th className="px-4 py-3 text-left font-medium">最后状态</th>
                <th className="px-4 py-3 text-left font-medium">累计耗时</th>
              </tr>
            </thead>
            <tbody>
              {dailyStats.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-neutral-500" colSpan={7}>暂无调度统计</td>
                </tr>
              )}
              {dailyStats.map((item) => (
                <tr key={`${item.run_date}-${item.task_key}`} className="border-t border-neutral-200">
                  <td className="px-4 py-3">{item.run_date}</td>
                  <td className="px-4 py-3">{formatSchedulerTaskLabel(item.task_key)}</td>
                  <td className="px-4 py-3">{item.total_runs}</td>
                  <td className="px-4 py-3 text-emerald-700">{item.success_count}</td>
                  <td className="px-4 py-3 text-rose-700">{item.failed_count}</td>
                  <td className="px-4 py-3">{formatSchedulerRunStatus(item.last_status)}</td>
                  <td className="px-4 py-3">{formatDuration(item.total_duration_ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold">执行日志</h3>
            <p className="mt-1 text-sm text-neutral-500">支持按任务、日期和状态筛选调度执行记录。</p>
          </div>
          <select className="rounded border border-neutral-300 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as 'all' | SchedulerRunStatus); setRunPage(1); }}>
            <option value="all">全部状态</option>
            <option value="running">运行中</option>
            <option value="succeeded">成功</option>
            <option value="failed">失败</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">开始时间</th>
                <th className="px-4 py-3 text-left font-medium">任务</th>
                <th className="px-4 py-3 text-left font-medium">触发来源</th>
                <th className="px-4 py-3 text-left font-medium">状态</th>
                <th className="px-4 py-3 text-left font-medium">耗时</th>
                <th className="px-4 py-3 text-left font-medium">结果</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-neutral-500" colSpan={6}>暂无执行日志</td>
                </tr>
              )}
              {runs.map((run) => (
                <tr key={run.id} className="border-t border-neutral-200 align-top">
                  <td className="px-4 py-3">{formatDateTimeLabel(run.started_at || run.created_at)}</td>
                  <td className="px-4 py-3">{formatSchedulerTaskLabel(run.task_key)}</td>
                  <td className="px-4 py-3">{formatSchedulerTrigger(run.trigger_source)}</td>
                  <td className="px-4 py-3">{formatSchedulerRunStatus(run.status)}</td>
                  <td className="px-4 py-3">{formatDuration(run.duration_ms)}</td>
                  <td className="px-4 py-3 text-neutral-600">{run.message || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button type="button" className="px-3 py-2 rounded border border-neutral-300 text-sm" onClick={() => setRunPage((current) => Math.max(1, current - 1))} disabled={runPage <= 1}>上一页</button>
          <div className="text-sm text-neutral-500">第 {runPage} 页</div>
          <button type="button" className="px-3 py-2 rounded border border-neutral-300 text-sm" onClick={() => setRunPage((current) => current + 1)} disabled={runs.length < 20}>下一页</button>
        </div>
      </section>
    </div>
  );
}

function MarketingPage() {
  const [rangePreset, setRangePreset] = useState<MarketingRangePreset>('day');
  const [dateFrom, setDateFrom] = useState(() => today());
  const [dateTo, setDateTo] = useState(() => today());
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [overview, setOverview] = useState<MarketingOverviewResponse | null>(null);
  const [pagesData, setPagesData] = useState<MarketingPagesResponse | null>(null);
  const [airportsData, setAirportsData] = useState<MarketingAirportsResponse | null>(null);
  const [airportPage, setAirportPage] = useState(1);
  const [selectedAirportId, setSelectedAirportId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<MarketingAirportDetailResponse | null>(null);
  const [isAirportDetailOpen, setIsAirportDetailOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const isCustomRange = rangePreset === 'custom';
  const isSingleDayRange = dateFrom === dateTo;
  const effectiveGranularity: MarketingGranularity = isSingleDayRange ? 'hour' : 'day';

  useEffect(() => {
    if (rangePreset === 'custom') {
      return;
    }
    const currentDate = today();
    const nextDateFrom = getMarketingPresetDateFrom(rangePreset, currentDate);
    setDateFrom(nextDateFrom);
    setDateTo(currentDate);
  }, [rangePreset]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      granularity: effectiveGranularity,
      date_from: dateFrom,
      date_to: dateTo,
    });
    const airportParams = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      sort_by: 'clicks',
      sort_order: 'desc',
    });
    if (keyword) {
      airportParams.set('keyword', keyword);
    }

    void Promise.all([
      apiFetch(`/api/v1/admin/marketing/overview?${params.toString()}`) as Promise<MarketingOverviewResponse>,
      apiFetch(`/api/v1/admin/marketing/pages?${params.toString()}`) as Promise<MarketingPagesResponse>,
      apiFetch(`/api/v1/admin/marketing/airports?${airportParams.toString()}`) as Promise<MarketingAirportsResponse>,
    ])
      .then(([nextOverview, nextPages, nextAirports]) => {
        if (!active) {
          return;
        }
        setOverview(nextOverview);
        setPagesData(nextPages);
        setAirportsData(nextAirports);
        setSelectedAirportId((current) => {
          if (current && nextAirports.items.some((item) => item.airport_id === current)) {
            return current;
          }
          return null;
        });
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setOverview(null);
        setPagesData(null);
        setAirportsData(null);
        setSelectedAirportId(null);
        setError(err instanceof Error ? err.message : '营销数据加载失败');
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [dateFrom, dateTo, effectiveGranularity, keyword]);

  useEffect(() => {
    if (!isAirportDetailOpen || !selectedAirportId) {
      setSelectedDetail(null);
      setDetailError('');
      return;
    }

    let active = true;
    setDetailLoading(true);
    setDetailError('');
    const params = new URLSearchParams({
      granularity: effectiveGranularity,
      date_from: dateFrom,
      date_to: dateTo,
    });
    void apiFetch(`/api/v1/admin/marketing/airports/${selectedAirportId}?${params.toString()}`)
      .then((detail) => {
        if (active) {
          setSelectedDetail(detail as MarketingAirportDetailResponse);
        }
      })
      .catch((err) => {
        if (active) {
          setSelectedDetail(null);
          setDetailError(err instanceof Error ? err.message : '机场详情加载失败');
        }
      })
      .finally(() => {
        if (active) {
          setDetailLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [dateFrom, dateTo, effectiveGranularity, isAirportDetailOpen, selectedAirportId]);

  const trendItems = overview?.trends || [];
  const trendGranularity = overview?.granularity || effectiveGranularity;
  const pageItems = pagesData?.items || [];
  const airportItems = airportsData?.items || [];
  const sourceBreakdown = overview?.top_sources || [];
  const countryBreakdown = overview?.top_countries || [];
  const airportPageCount = Math.max(1, Math.ceil(airportItems.length / MARKETING_AIRPORTS_PAGE_SIZE));
  const currentAirportPage = Math.min(airportPage, airportPageCount);
  const pagedAirportItems = useMemo(() => {
    const startIndex = (currentAirportPage - 1) * MARKETING_AIRPORTS_PAGE_SIZE;
    return airportItems.slice(startIndex, startIndex + MARKETING_AIRPORTS_PAGE_SIZE);
  }, [airportItems, currentAirportPage]);
  const activeAirportSummary = selectedAirportId ? airportItems.find((item) => item.airport_id === selectedAirportId) || null : null;

  useEffect(() => {
    setAirportPage(1);
  }, [dateFrom, dateTo, keyword]);

  useEffect(() => {
    if (airportPage > airportPageCount) {
      setAirportPage(airportPageCount);
    }
  }, [airportPage, airportPageCount]);

  useEffect(() => {
    if (!isAirportDetailOpen) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAirportDetailOpen]);

  useEffect(() => {
    if (!isAirportDetailOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAirportDetailOpen(false);
        setSelectedAirportId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAirportDetailOpen]);

  const openAirportDetail = (airportId: number) => {
    setSelectedAirportId(airportId);
    setIsAirportDetailOpen(true);
  };

  const closeAirportDetail = () => {
    setIsAirportDetailOpen(false);
    setSelectedAirportId(null);
    setSelectedDetail(null);
    setDetailError('');
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold">营销</h2>
            <p className="mt-1 text-sm text-neutral-500">统计 GateRank 公共站访问量、机场曝光、外链点击与点击转化率。</p>
          </div>
          <button
            type="button"
            className="px-3 py-2 rounded border border-neutral-300 text-sm"
            onClick={() => {
              const currentDate = today();
              setRangePreset('day');
              setDateFrom(currentDate);
              setDateTo(currentDate);
              setKeyword('');
              setKeywordInput('');
            }}
          >
            恢复默认
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[auto_auto_auto_minmax(0,1fr)]">
          <select className="rounded border border-neutral-300 px-3 py-2 text-sm" value={rangePreset} onChange={(event) => setRangePreset(event.target.value as MarketingRangePreset)}>
            <option value="day">按天</option>
            <option value="week">按周</option>
            <option value="month">按月</option>
            <option value="custom">自定义</option>
          </select>
          <input
            type="date"
            className={`rounded border px-3 py-2 text-sm ${isCustomRange ? 'border-neutral-300' : 'border-neutral-200 bg-neutral-100 text-neutral-500'}`}
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            disabled={!isCustomRange}
          />
          <input
            type="date"
            className={`rounded border px-3 py-2 text-sm ${isCustomRange ? 'border-neutral-300' : 'border-neutral-200 bg-neutral-100 text-neutral-500'}`}
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            disabled={!isCustomRange}
          />
          <div className="flex min-w-0 gap-2">
            <input
              className="min-w-0 w-full rounded border border-neutral-300 px-3 py-2 text-sm"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="搜索机场"
            />
            <button type="button" className="shrink-0 whitespace-nowrap rounded bg-neutral-900 px-3 py-2 text-sm text-white" onClick={() => setKeyword(keywordInput.trim())}>筛选</button>
          </div>
        </div>
        {isSingleDayRange && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
            单日范围已自动切换为按小时展示趋势。
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MarketingMetricCard label="总访问 PV" value={loading ? '...' : formatCountValue(overview?.totals.page_views)} hint={`${dateFrom} ~ ${dateTo}`} tone="traffic" />
        <MarketingMetricCard label="估算 UV" value={loading ? '...' : formatCountValue(overview?.totals.unique_visitors)} hint="匿名 visitor hash 去重" tone="visitors" />
        <MarketingMetricCard label="机场曝光" value={loading ? '...' : formatCountValue(overview?.totals.airport_impressions)} hint="卡片 / 条目 / 报告头部" tone="impressions" />
        <MarketingMetricCard label="外链点击" value={loading ? '...' : formatCountValue(overview?.totals.outbound_clicks)} hint="跳转官网或订阅链接" tone="clicks" />
        <MarketingMetricCard label="整体 CTR" value={loading ? '...' : formatRatioValue(overview?.totals.ctr)} hint="外链点击 / 机场曝光" tone="ctr" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-semibold">外部来源</h3>
              <p className="mt-1 text-sm text-neutral-500">按来源平台或 referrer host 聚合识别站外引流表现。</p>
            </div>
            <div className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600">
              来源数：{formatCountValue(overview?.filters.sources.length)}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <MarketingMetricCard
              label="Top 来源"
              value={sourceBreakdown[0]?.source_label || '-'}
              hint={sourceBreakdown[0] ? `PV ${formatCountValue(sourceBreakdown[0].page_views)} / 占比 ${formatRatioValue(sourceBreakdown[0].traffic_share)}` : '暂无识别来源'}
              tone="traffic"
            />
            <MarketingMetricCard
              label="直达流量"
              value={formatRatioValue(overview?.source_breakdown.find((item) => item.source_type === 'direct_or_unknown')?.traffic_share ?? null)}
              hint="按 page_view 占比估算"
              tone="default"
            />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">来源</th>
                  <th className="px-4 py-3 text-left font-medium">PV</th>
                  <th className="px-4 py-3 text-left font-medium">UV</th>
                  <th className="px-4 py-3 text-left font-medium">点击</th>
                  <th className="px-4 py-3 text-left font-medium">占比</th>
                </tr>
              </thead>
              <tbody>
                {sourceBreakdown.length === 0 && !loading && (
                  <tr>
                    <td className="px-4 py-6 text-neutral-500" colSpan={5}>当前区间暂无可识别来源数据</td>
                  </tr>
                )}
                {sourceBreakdown.map((item) => (
                  <tr key={`${item.source_type}-${item.source_label}`} className="border-t border-neutral-200">
                    <td className="px-4 py-3">{item.source_label}</td>
                    <td className="px-4 py-3">{formatCountValue(item.page_views)}</td>
                    <td className="px-4 py-3">{formatCountValue(item.unique_visitors)}</td>
                    <td className="px-4 py-3">{formatCountValue(item.outbound_clicks)}</td>
                    <td className="px-4 py-3">{formatRatioValue(item.traffic_share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-semibold">访问国家</h3>
              <p className="mt-1 text-sm text-neutral-500">按服务端识别到的访问国家聚合查看流量来源地域。</p>
            </div>
            <div className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-600">
              国家数：{formatCountValue(overview?.filters.countries.length)}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <MarketingMetricCard
              label="Top 国家"
              value={countryBreakdown[0] ? `${countryBreakdown[0].country_name} (${countryBreakdown[0].country_code})` : '-'}
              hint={countryBreakdown[0] ? `PV ${formatCountValue(countryBreakdown[0].page_views)} / 占比 ${formatRatioValue(countryBreakdown[0].traffic_share)}` : '暂无国家识别数据'}
              tone="visitors"
            />
            <MarketingMetricCard
              label="未知国家"
              value={formatRatioValue(overview?.country_breakdown.find((item) => item.country_code === 'ZZ')?.traffic_share ?? null)}
              hint="按 page_view 占比估算"
              tone="default"
            />
          </div>
          <div className="overflow-x-auto rounded-2xl border border-neutral-200">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">国家</th>
                  <th className="px-4 py-3 text-left font-medium">PV</th>
                  <th className="px-4 py-3 text-left font-medium">UV</th>
                  <th className="px-4 py-3 text-left font-medium">点击</th>
                  <th className="px-4 py-3 text-left font-medium">占比</th>
                </tr>
              </thead>
              <tbody>
                {countryBreakdown.length === 0 && !loading && (
                  <tr>
                    <td className="px-4 py-6 text-neutral-500" colSpan={5}>当前区间暂无国家识别数据</td>
                  </tr>
                )}
                {countryBreakdown.map((item) => (
                  <tr key={item.country_code} className="border-t border-neutral-200">
                    <td className="px-4 py-3">{item.country_name} ({item.country_code})</td>
                    <td className="px-4 py-3">{formatCountValue(item.page_views)}</td>
                    <td className="px-4 py-3">{formatCountValue(item.unique_visitors)}</td>
                    <td className="px-4 py-3">{formatCountValue(item.outbound_clicks)}</td>
                    <td className="px-4 py-3">{formatRatioValue(item.traffic_share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4 xl:col-span-3">
          <div>
            <h3 className="text-base font-semibold">趋势区</h3>
            <p className="mt-1 text-sm text-neutral-500">左侧按访问和点击展示趋势，右侧补充区间内每个时间桶的明细值。</p>
          </div>
          <MarketingTrendChart items={trendItems} />
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4 xl:col-span-2">
          <div>
            <h3 className="text-base font-semibold">趋势明细</h3>
            <p className="mt-1 text-sm text-neutral-500">支持快速核对每个时间桶的 PV、曝光、点击和 CTR。</p>
          </div>
          <div className="max-h-[320px] overflow-auto rounded-2xl border border-neutral-200">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">时间</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">PV</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">曝光</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">点击</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-medium">CTR</th>
                </tr>
              </thead>
              <tbody>
                {trendItems.length === 0 && !loading && (
                  <tr>
                    <td className="px-4 py-6 text-neutral-500" colSpan={5}>当前区间暂无营销趋势数据</td>
                  </tr>
                )}
                {trendItems.map((item) => (
                  <tr key={item.period_start} className="border-t border-neutral-200">
                    <td className="px-4 py-3">{formatMarketingPeriodLabel(item.period_start, trendGranularity, dateFrom, dateTo)}</td>
                    <td className="px-4 py-3">{formatCountValue(item.page_views)}</td>
                    <td className="px-4 py-3">{formatCountValue(item.airport_impressions)}</td>
                    <td className="px-4 py-3">{formatCountValue(item.outbound_clicks)}</td>
                    <td className="px-4 py-3">{formatRatioValue(item.ctr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold">热门页面</h3>
            <p className="mt-1 text-sm text-neutral-500">按页面路径聚合展示访问量，并补充页面上发生的机场外链点击。</p>
          </div>
          <div className="text-sm text-neutral-500">页面数：{formatCountValue(pageItems.length)}</div>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">页面类型</th>
                <th className="px-4 py-3 text-left font-medium">路径</th>
                <th className="px-4 py-3 text-left font-medium">PV</th>
                <th className="px-4 py-3 text-left font-medium">UV</th>
                <th className="px-4 py-3 text-left font-medium">相关点击</th>
                <th className="px-4 py-3 text-left font-medium">最近访问</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 && !loading && (
                <tr>
                  <td className="px-4 py-6 text-neutral-500" colSpan={6}>暂无页面访问统计</td>
                </tr>
              )}
              {pageItems.map((item) => (
                <tr key={`${item.page_kind}-${item.page_path}`} className="border-t border-neutral-200">
                  <td className="px-4 py-3">{formatMarketingPageKind(item.page_kind)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-700">{item.page_path}</td>
                  <td className="px-4 py-3">{formatCountValue(item.page_views)}</td>
                  <td className="px-4 py-3">{formatCountValue(item.unique_visitors)}</td>
                  <td className="px-4 py-3">{formatCountValue(item.outbound_clicks)}</td>
                  <td className="px-4 py-3">{formatDateTimeInBeijing(item.last_visited_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[30px] border border-neutral-200 bg-white p-5 space-y-4 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.28)]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-base font-semibold">机场转化表</h3>
            <p className="mt-1 text-sm text-neutral-500">按曝光、点击和 CTR 查看每个机场在站内导流表现，通过右侧按钮打开居中详情页。</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-sm text-neutral-500">
            <div>机场数：{formatCountValue(airportItems.length)}</div>
            <div>每页 {MARKETING_AIRPORTS_PAGE_SIZE} 条</div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-[26px] border border-neutral-200">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">机场</th>
                <th className="px-4 py-3 text-left font-medium">曝光</th>
                <th className="px-4 py-3 text-left font-medium">点击</th>
                <th className="px-4 py-3 text-left font-medium">CTR</th>
                <th className="px-4 py-3 text-left font-medium">主要来源位</th>
                <th className="px-4 py-3 text-left font-medium">最近点击</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {airportItems.length === 0 && !loading && (
                <tr>
                  <td className="px-4 py-6 text-neutral-500" colSpan={7}>暂无机场转化数据</td>
                </tr>
              )}
              {pagedAirportItems.map((item) => (
                <tr key={item.airport_id} className="border-t border-neutral-200 hover:bg-neutral-50/70">
                  <td className="px-4 py-3 font-medium text-neutral-900">{item.airport_name}</td>
                  <td className="px-4 py-3">{formatCountValue(item.airport_impressions)}</td>
                  <td className="px-4 py-3">{formatCountValue(item.outbound_clicks)}</td>
                  <td className="px-4 py-3">{formatRatioValue(item.ctr)}</td>
                  <td className="px-4 py-3">{formatMarketingPlacement(item.primary_placement)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDateTimeInBeijing(item.last_clicked_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:border-sky-300 hover:bg-sky-100"
                      onClick={() => openAirportDetail(item.airport_id)}
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-2xl border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => setAirportPage((current) => Math.max(1, current - 1))}
            disabled={currentAirportPage <= 1}
          >
            上一页
          </button>
          <div className="text-sm text-neutral-500">
            第 {currentAirportPage} / {airportPageCount} 页
          </div>
          <button
            type="button"
            className="rounded-2xl border border-neutral-300 px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => setAirportPage((current) => Math.min(airportPageCount, current + 1))}
            disabled={currentAirportPage >= airportPageCount}
          >
            下一页
          </button>
        </div>
      </section>

      {isAirportDetailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-md" onClick={closeAirportDetail}>
          <div
            className="relative flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/80 bg-white/90 shadow-[0_42px_140px_-52px_rgba(15,23,42,0.5)] backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="机场详情"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.18))]" />
            <div className="relative flex max-h-[88vh] flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-neutral-200/80 bg-white/72 px-6 py-5 backdrop-blur-sm">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">Airport Detail</div>
                  <h3 className="text-2xl font-bold tracking-tight text-neutral-950">单机场详情</h3>
                  <p className="text-sm text-neutral-500">查看趋势、来源位分布和点击目标拆分，作为机场导流表现的二级详情页。</p>
                </div>
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-neutral-500 transition hover:text-neutral-900"
                  onClick={closeAirportDetail}
                >
                  <X size={16} />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 overscroll-contain">
                {detailError && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {detailError}
                  </div>
                )}

                {detailLoading && (
                  <div className="rounded-[28px] border border-neutral-200 bg-neutral-50/90 px-5 py-10 text-sm text-neutral-500">
                    正在加载机场详情...
                  </div>
                )}

                {!detailLoading && !selectedDetail && !detailError && (
                  <div className="rounded-[28px] border border-neutral-200 bg-neutral-50/90 px-5 py-10 text-sm text-neutral-500">
                    当前没有可查看的机场详情。
                  </div>
                )}

                {selectedDetail && !detailLoading && (
                  <div className="space-y-5">
                    <section className="rounded-[28px] border border-neutral-200 bg-white/82 p-5 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.18)]">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="text-sm font-semibold text-neutral-950">{selectedDetail.airport_name}</div>
                          <div className="mt-1 text-sm text-neutral-500">{selectedDetail.date_from} ~ {selectedDetail.date_to} / {formatGranularityLabel(selectedDetail.granularity)}</div>
                        </div>
                        <div className="rounded-full border border-sky-200 bg-white/70 px-3 py-1 text-xs font-medium text-sky-700">
                          {activeAirportSummary ? `主要来源位：${formatMarketingPlacement(activeAirportSummary.primary_placement)}` : '营销详情'}
                        </div>
                      </div>
                    </section>

                    <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <MarketingMetricCard label="曝光" value={formatCountValue(selectedDetail.summary.airport_impressions)} tone="traffic" />
                      <MarketingMetricCard label="点击" value={formatCountValue(selectedDetail.summary.outbound_clicks)} tone="visitors" />
                      <MarketingMetricCard label="CTR" value={formatRatioValue(selectedDetail.summary.ctr)} tone="impressions" />
                      <MarketingMetricCard label="站内点击占比" value={formatRatioValue(selectedDetail.summary.site_click_share)} tone="clicks" />
                    </section>

                    <section className="rounded-[28px] border border-neutral-200 bg-white/84 p-5 space-y-4 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.22)]">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <div className="text-base font-semibold text-neutral-950">该机场趋势</div>
                          <p className="mt-1 text-sm text-neutral-500">结合访问、曝光和点击，快速核对当前筛选区间内的转化变化。</p>
                        </div>
                        <div className="text-xs text-neutral-500">最近点击：{formatDateTimeInBeijing(selectedDetail.summary.last_clicked_at)}</div>
                      </div>
                      <MarketingTrendChart items={selectedDetail.trends} />
                    </section>

                    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      <div className="rounded-[28px] border border-neutral-200 bg-white/84 p-4 space-y-3 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.22)]">
                        <div className="text-sm font-semibold text-neutral-900">来源位分析</div>
                        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
                          <table className="min-w-full text-sm">
                            <thead className="bg-neutral-50 text-neutral-600">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">来源位</th>
                                <th className="px-3 py-2 text-left font-medium">曝光</th>
                                <th className="px-3 py-2 text-left font-medium">点击</th>
                                <th className="px-3 py-2 text-left font-medium">CTR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedDetail.placement_breakdown.map((item) => (
                                <tr key={item.placement || 'unknown'} className="border-t border-neutral-200">
                                  <td className="px-3 py-2">{formatMarketingPlacement(item.placement)}</td>
                                  <td className="px-3 py-2">{formatCountValue(item.airport_impressions)}</td>
                                  <td className="px-3 py-2">{formatCountValue(item.outbound_clicks)}</td>
                                  <td className="px-3 py-2">{formatRatioValue(item.ctr)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-neutral-200 bg-white/84 p-4 space-y-3 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.22)]">
                        <div className="text-sm font-semibold text-neutral-900">目标链接拆分</div>
                        <div className="overflow-x-auto rounded-2xl border border-neutral-200">
                          <table className="min-w-full text-sm">
                            <thead className="bg-neutral-50 text-neutral-600">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">目标类型</th>
                                <th className="px-3 py-2 text-left font-medium">点击</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedDetail.target_breakdown.length === 0 && (
                                <tr>
                                  <td className="px-3 py-4 text-neutral-500" colSpan={2}>暂无目标链接点击数据</td>
                                </tr>
                              )}
                              {selectedDetail.target_breakdown.map((item) => (
                                <tr key={item.target_kind || 'unknown'} className="border-t border-neutral-200">
                                  <td className="px-3 py-2">{formatMarketingTargetKind(item.target_kind)}</td>
                                  <td className="px-3 py-2">{formatCountValue(item.outbound_clicks)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type MarketingMetricCardTone = 'default' | 'traffic' | 'visitors' | 'impressions' | 'clicks' | 'ctr';

const marketingMetricCardThemes: Record<
  MarketingMetricCardTone,
  {
    shell: string;
    wash: string;
    accent: string;
    glowPrimary: string;
    glowSecondary: string;
    label: string;
    value: string;
    hint: string;
  }
> = {
  default: {
    shell: 'border-neutral-200 bg-white shadow-[0_18px_40px_-32px_rgba(15,23,42,0.2)]',
    wash: 'from-white via-white to-neutral-50/90',
    accent: 'from-transparent via-white/40 to-transparent',
    glowPrimary: 'bg-neutral-200/40',
    glowSecondary: 'bg-white/70',
    label: 'text-neutral-400',
    value: 'text-neutral-900',
    hint: 'text-neutral-500',
  },
  traffic: {
    shell: 'border-sky-200/80 bg-white/75 shadow-[0_24px_60px_-34px_rgba(14,165,233,0.5)] backdrop-blur-xl',
    wash: 'from-sky-50/95 via-white/80 to-cyan-50/85',
    accent: 'from-sky-400/28 via-cyan-300/12 to-transparent',
    glowPrimary: 'bg-sky-300/35',
    glowSecondary: 'bg-cyan-200/30',
    label: 'text-sky-900/45',
    value: 'text-slate-900',
    hint: 'text-slate-600/80',
  },
  visitors: {
    shell: 'border-emerald-200/80 bg-white/75 shadow-[0_24px_60px_-34px_rgba(16,185,129,0.42)] backdrop-blur-xl',
    wash: 'from-emerald-50/95 via-white/78 to-teal-50/88',
    accent: 'from-emerald-400/24 via-teal-300/12 to-transparent',
    glowPrimary: 'bg-emerald-300/30',
    glowSecondary: 'bg-teal-200/28',
    label: 'text-emerald-900/45',
    value: 'text-slate-900',
    hint: 'text-slate-600/80',
  },
  impressions: {
    shell: 'border-cyan-200/80 bg-white/75 shadow-[0_24px_60px_-34px_rgba(6,182,212,0.46)] backdrop-blur-xl',
    wash: 'from-cyan-50/95 via-white/78 to-sky-50/86',
    accent: 'from-cyan-400/24 via-sky-300/12 to-transparent',
    glowPrimary: 'bg-cyan-300/32',
    glowSecondary: 'bg-sky-200/28',
    label: 'text-cyan-900/45',
    value: 'text-slate-900',
    hint: 'text-slate-600/80',
  },
  clicks: {
    shell: 'border-amber-200/80 bg-white/75 shadow-[0_24px_60px_-34px_rgba(245,158,11,0.42)] backdrop-blur-xl',
    wash: 'from-amber-50/95 via-white/80 to-orange-50/85',
    accent: 'from-amber-400/26 via-orange-300/12 to-transparent',
    glowPrimary: 'bg-amber-300/32',
    glowSecondary: 'bg-orange-200/28',
    label: 'text-amber-900/45',
    value: 'text-slate-900',
    hint: 'text-slate-600/80',
  },
  ctr: {
    shell: 'border-rose-200/80 bg-white/75 shadow-[0_24px_60px_-34px_rgba(244,63,94,0.34)] backdrop-blur-xl',
    wash: 'from-rose-50/95 via-white/80 to-orange-50/84',
    accent: 'from-rose-400/24 via-orange-300/12 to-transparent',
    glowPrimary: 'bg-rose-300/30',
    glowSecondary: 'bg-orange-200/26',
    label: 'text-rose-900/45',
    value: 'text-slate-900',
    hint: 'text-slate-600/80',
  },
};

function MarketingMetricCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: MarketingMetricCardTone;
}) {
  const theme = marketingMetricCardThemes[tone];
  return (
    <div className={`group relative overflow-hidden rounded-[26px] border p-4 transition-all duration-300 ${theme.shell}`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${theme.wash}`} />
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${theme.accent}`} />
      <div className={`pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full blur-3xl ${theme.glowPrimary}`} />
      <div className={`pointer-events-none absolute -bottom-8 left-0 h-20 w-28 rounded-full blur-2xl ${theme.glowSecondary}`} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.62),rgba(255,255,255,0.18)_38%,rgba(255,255,255,0.08)_65%,rgba(255,255,255,0.3))]" />
      <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent" />
      <div className="relative">
        <div className={`text-[11px] font-black uppercase tracking-[0.18em] ${theme.label}`}>{label}</div>
        <div className={`mt-3 text-2xl font-black tracking-tight ${theme.value}`}>{value}</div>
        {hint && <div className={`mt-2 text-xs ${theme.hint}`}>{hint}</div>}
      </div>
    </div>
  );
}

function MarketingTrendChart({
  items,
  compact = false,
}: {
  items: MarketingTrendPoint[];
  compact?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className={`rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 text-sm text-neutral-500 ${compact ? 'px-4 py-8' : 'px-5 py-16'}`}>
        当前区间暂无可展示的趋势数据。
      </div>
    );
  }

  const width = 640;
  const height = compact ? 180 : 260;
  const padding = 24;
  const maxValue = Math.max(
    1,
    ...items.flatMap((item) => [item.page_views, item.airport_impressions, item.outbound_clicks]),
  );
  const xStep = items.length > 1 ? (width - padding * 2) / (items.length - 1) : 0;
  const buildPoint = (value: number, index: number) => {
    const x = items.length === 1 ? width / 2 : padding + xStep * index;
    const y = height - padding - ((value || 0) / maxValue) * (height - padding * 2);
    return {
      x,
      y: Math.max(padding, Math.min(height - padding, y)),
    };
  };
  const buildSeriesPoints = (selector: (item: MarketingTrendPoint) => number) =>
    items.map((item, index) => buildPoint(selector(item), index));
  const buildPolyline = (selector: (item: MarketingTrendPoint) => number) =>
    buildSeriesPoints(selector)
      .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(' ');
  const renderMarkers = (selector: (item: MarketingTrendPoint) => number, color: string) =>
    buildSeriesPoints(selector).map((point, index) => (
      <circle
        key={`${color}-${items[index]?.period_start || index}`}
        cx={point.x}
        cy={point.y}
        r={items.length === 1 ? 6 : 4}
        fill={color}
        stroke="#ffffff"
        strokeWidth="2"
      />
    ));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-neutral-900" />访问 PV</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" />机场曝光</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />外链点击</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-neutral-50/70">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[220px] min-w-[640px] w-full">
          <polyline fill="none" stroke="#171717" strokeWidth="3" points={buildPolyline((item) => item.page_views)} />
          <polyline fill="none" stroke="#0ea5e9" strokeWidth="3" points={buildPolyline((item) => item.airport_impressions)} />
          <polyline fill="none" stroke="#10b981" strokeWidth="3" points={buildPolyline((item) => item.outbound_clicks)} />
          {renderMarkers((item) => item.page_views, '#171717')}
          {renderMarkers((item) => item.airport_impressions, '#0ea5e9')}
          {renderMarkers((item) => item.outbound_clicks, '#10b981')}
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs text-neutral-500 md:grid-cols-4">
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">时间桶数：<span className="font-semibold text-neutral-900">{items.length}</span></div>
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">峰值 PV：<span className="font-semibold text-neutral-900">{formatCountValue(Math.max(...items.map((item) => item.page_views)))}</span></div>
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">峰值曝光：<span className="font-semibold text-neutral-900">{formatCountValue(Math.max(...items.map((item) => item.airport_impressions)))}</span></div>
        <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2">峰值点击：<span className="font-semibold text-neutral-900">{formatCountValue(Math.max(...items.map((item) => item.outbound_clicks)))}</span></div>
      </div>
    </div>
  );
}

function SystemSettingsPage() {
  const [activeTab, setActiveTab] = useState<SystemSettingsTab>('notifications');
  const [refreshTick, setRefreshTick] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">系统设置</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {activeTab === 'notifications'
              ? '通知设置支持 Telegram 直发和 Webhook 转发，保存后立即生效。'
              : activeTab === 'payment_gateway'
                ? '支付配置用于申请人后台下单和支付回调验签，申请金额默认 1000 元但可在这里调整。'
                : activeTab === 'smtp'
                  ? 'SMTP 配置用于发送申请账号凭证邮件和审批通过邮件。'
                : activeTab === 'media_libraries'
                  ? '图库设置用于托管第三方图库访问凭证，当前新闻封面搜索使用 Pexels。'
                  : '发布令牌用于给第三方系统或 AI 开放受限发文能力，令牌明文只会展示一次。'}
          </p>
        </div>
        <button className="px-3 py-2 rounded border text-sm" onClick={() => setRefreshTick((value) => value + 1)}>
          刷新
        </button>
      </div>

      <div className="inline-flex rounded-2xl border border-neutral-200 bg-white p-1">
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium ${activeTab === 'notifications' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
          onClick={() => setActiveTab('notifications')}
        >
          通知设置
        </button>
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium ${activeTab === 'payment_gateway' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
          onClick={() => setActiveTab('payment_gateway')}
        >
          支付配置
        </button>
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium ${activeTab === 'smtp' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
          onClick={() => setActiveTab('smtp')}
        >
          邮件配置
        </button>
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium ${activeTab === 'media_libraries' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
          onClick={() => setActiveTab('media_libraries')}
        >
          图库设置
        </button>
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium ${activeTab === 'publish_tokens' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
          onClick={() => setActiveTab('publish_tokens')}
        >
          发布令牌
        </button>
      </div>

      {activeTab === 'notifications'
        ? <NotificationSettingsTab refreshTick={refreshTick} />
        : activeTab === 'payment_gateway'
          ? <PaymentGatewaySettingsTab refreshTick={refreshTick} />
          : activeTab === 'smtp'
            ? <SmtpSettingsTab refreshTick={refreshTick} />
        : activeTab === 'media_libraries'
          ? <MediaLibrarySettingsTab refreshTick={refreshTick} />
          : <PublishTokensSettingsTab refreshTick={refreshTick} />}
    </div>
  );
}

function NotificationSettingsTab({ refreshTick }: { refreshTick: number }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState<TelegramSettingsView | null>(null);
  const [clearBotToken, setClearBotToken] = useState(false);
  const [clearWebhookBearerToken, setClearWebhookBearerToken] = useState(false);
  const [form, setForm] = useState<TelegramSettingsFormState>({
    enabled: false,
    delivery_mode: 'telegram_chat',
    telegram_chat: {
      bot_token: '',
      chat_id: '',
      api_base: 'https://api.telegram.org',
      timeout_ms: '5000',
    },
    webhook: {
      url: '',
      bearer_token: '',
      timeout_ms: '5000',
    },
  });

  const applyView = (view: TelegramSettingsView) => {
    setSettings(view);
    setForm({
      enabled: view.enabled,
      delivery_mode: view.delivery_mode,
      telegram_chat: {
        bot_token: '',
        chat_id: view.telegram_chat.chat_id || '',
        api_base: view.telegram_chat.api_base || 'https://api.telegram.org',
        timeout_ms: String(view.telegram_chat.timeout_ms || 5000),
      },
      webhook: {
        url: view.webhook.url || '',
        bearer_token: '',
        timeout_ms: String(view.webhook.timeout_ms || 5000),
      },
    });
    setClearBotToken(false);
    setClearWebhookBearerToken(false);
  };

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = (await apiFetch('/api/v1/admin/system-settings/telegram')) as TelegramSettingsView;
      applyView(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, [refreshTick]);

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      enabled: form.enabled,
      delivery_mode: form.delivery_mode,
      telegram_chat: {
        chat_id: form.telegram_chat.chat_id.trim(),
        api_base: form.telegram_chat.api_base.trim() || 'https://api.telegram.org',
        timeout_ms: Number(form.telegram_chat.timeout_ms || 5000),
      },
      webhook: {
        url: form.webhook.url.trim(),
        timeout_ms: Number(form.webhook.timeout_ms || 5000),
      },
    };

    if (clearBotToken) {
      (payload.telegram_chat as Record<string, unknown>).bot_token = '';
    } else if (form.telegram_chat.bot_token.trim()) {
      (payload.telegram_chat as Record<string, unknown>).bot_token = form.telegram_chat.bot_token.trim();
    }

    if (clearWebhookBearerToken) {
      (payload.webhook as Record<string, unknown>).bearer_token = '';
    } else if (form.webhook.bearer_token.trim()) {
      (payload.webhook as Record<string, unknown>).bearer_token = form.webhook.bearer_token.trim();
    }

    return payload;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = (await apiFetch('/api/v1/admin/system-settings/telegram', {
        method: 'PATCH',
        body: JSON.stringify(buildPayload()),
      })) as TelegramSettingsView;
      applyView(data);
      setSuccess('申请通知配置已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch('/api/v1/admin/system-settings/telegram/test', {
        method: 'POST',
        body: JSON.stringify(buildPayload()),
      });
      setSuccess(form.delivery_mode === 'telegram_chat' ? 'Telegram 测试消息已发送' : 'Webhook 测试请求已发送');
    } catch (err) {
      setError(err instanceof Error ? err.message : '测试发送失败');
    } finally {
      setTesting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">通知设置</div>
        <p className="mt-1 text-sm text-neutral-500">用于接收新的机场入驻申请提醒。测试不会持久化当前输入的密钥变更。</p>
      </div>

      {loading && <div className="text-sm text-neutral-500">加载中...</div>}

      {!loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReadField label="当前发送模式" value={form.delivery_mode === 'telegram_chat' ? 'Telegram 直发' : 'Webhook 转发'} />
            <ReadField label="最近更新人" value={valueOrDash(settings?.updated_by)} />
            <ReadField label="最近更新时间" value={formatDateTimeInBeijing(settings?.updated_at)} />
            <ReadField label="Telegram Token" value={settings?.telegram_chat.has_bot_token ? `已配置 (${settings?.telegram_chat.bot_token_masked || '-'})` : '未配置'} />
            <ReadField label="Telegram Chat ID" value={valueOrDash(settings?.telegram_chat.chat_id)} />
            <ReadField label="Webhook Bearer" value={settings?.webhook.has_bearer_token ? `已配置 (${settings?.webhook.bearer_token_masked || '-'})` : '未配置'} />
            <ReadField label="Webhook URL" value={valueOrDash(settings?.webhook.url)} />
          </div>

          <div className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4">
            <div className="text-sm font-medium text-neutral-900">启用开关</div>
            <p className="mt-1 text-sm text-neutral-500">关闭后不会自动推送新申请通知，但仍可手动发送测试消息。</p>
            <label className="mt-4 inline-flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              启用申请通知
            </label>
          </div>

          <div className="rounded-2xl border border-neutral-300 bg-white px-4 py-4 space-y-3">
            <div className="text-sm font-medium text-neutral-900">发送模式</div>
            <p className="text-sm text-neutral-500">Telegram 直发适合用户、群组、频道；如果目标是另一个 bot，请改用 Webhook 转发。</p>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  name="delivery_mode"
                  checked={form.delivery_mode === 'telegram_chat'}
                  onChange={() => setForm({ ...form, delivery_mode: 'telegram_chat' })}
                />
                Telegram 直发
              </label>
              <label className="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  type="radio"
                  name="delivery_mode"
                  checked={form.delivery_mode === 'webhook'}
                  onChange={() => setForm({ ...form, delivery_mode: 'webhook' })}
                />
                Webhook 转发
              </label>
            </div>
          </div>

          {form.delivery_mode === 'telegram_chat' && (
            <>
              <div className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4">
                <div className="text-sm font-medium text-neutral-900">Telegram 直发说明</div>
                <p className="mt-1 text-sm text-neutral-500">适合直接发给用户、群组、频道。如果目标是另一个 bot，这种方式不可用，请切换到 Webhook 转发。</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Bot Token"
                  hint={settings?.telegram_chat.has_bot_token ? '已配置，留空则不修改；如需删除，请勾选下方“清空已保存 Token”。' : '未配置时请直接输入新的 Bot Token。'}
                >
                  <div className="space-y-2">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      type="password"
                      placeholder={settings?.telegram_chat.has_bot_token ? '已配置，留空则不修改' : '输入新的 Bot Token'}
                      value={form.telegram_chat.bot_token}
                      onChange={(e) => {
                        setClearBotToken(false);
                        setForm({
                          ...form,
                          telegram_chat: { ...form.telegram_chat, bot_token: e.target.value },
                        });
                      }}
                    />
                    {settings?.telegram_chat.has_bot_token && (
                      <div className="text-xs text-neutral-500">当前已保存：{settings.telegram_chat.bot_token_masked}</div>
                    )}
                  </div>
                </FormField>

                <FormField label="Chat ID" hint="例如群组 chat id 通常是 -100 开头。">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    placeholder="-1001234567890"
                    value={form.telegram_chat.chat_id}
                    onChange={(e) => setForm({
                      ...form,
                      telegram_chat: { ...form.telegram_chat, chat_id: e.target.value },
                    })}
                  />
                </FormField>

                <FormField label="API Base" hint="默认使用官方 Telegram API 地址。">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    placeholder="https://api.telegram.org"
                    value={form.telegram_chat.api_base}
                    onChange={(e) => setForm({
                      ...form,
                      telegram_chat: { ...form.telegram_chat, api_base: e.target.value },
                    })}
                  />
                </FormField>

                <FormField label="超时(ms)" hint="请求 Telegram API 的超时控制。">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    type="number"
                    min="1"
                    step="1"
                    value={form.telegram_chat.timeout_ms}
                    onChange={(e) => setForm({
                      ...form,
                      telegram_chat: { ...form.telegram_chat, timeout_ms: e.target.value },
                    })}
                  />
                </FormField>
              </div>

              {settings?.telegram_chat.has_bot_token && (
                <label className="inline-flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300"
                    checked={clearBotToken}
                    onChange={(e) => {
                      setClearBotToken(e.target.checked);
                      if (e.target.checked) {
                        setForm({
                          ...form,
                          telegram_chat: { ...form.telegram_chat, bot_token: '' },
                        });
                      }
                    }}
                  />
                  清空已保存 Bot Token
                </label>
              )}
            </>
          )}

          {form.delivery_mode === 'webhook' && (
            <>
              <div className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4">
                <div className="text-sm font-medium text-neutral-900">Webhook 转发说明</div>
                <p className="mt-1 text-sm text-neutral-500">如果你的 bot 需要接收事件，请让 GateRank 调用你控制的 Webhook，再由你的 bot 自己处理这条请求。</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Webhook URL" hint="GateRank 会向这个地址 POST 申请通知事件。">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    placeholder="https://example.com/webhooks/gaterank"
                    value={form.webhook.url}
                    onChange={(e) => setForm({
                      ...form,
                      webhook: { ...form.webhook, url: e.target.value },
                    })}
                  />
                </FormField>

                <FormField
                  label="Bearer Token"
                  hint={settings?.webhook.has_bearer_token ? '已配置，留空则不修改；如需删除，请勾选下方“清空已保存 Bearer Token”。' : '用于 Authorization: Bearer ... 鉴权。'}
                >
                  <div className="space-y-2">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      type="password"
                      placeholder={settings?.webhook.has_bearer_token ? '已配置，留空则不修改' : '输入新的 Bearer Token'}
                      value={form.webhook.bearer_token}
                      onChange={(e) => {
                        setClearWebhookBearerToken(false);
                        setForm({
                          ...form,
                          webhook: { ...form.webhook, bearer_token: e.target.value },
                        });
                      }}
                    />
                    {settings?.webhook.has_bearer_token && (
                      <div className="text-xs text-neutral-500">当前已保存：{settings.webhook.bearer_token_masked}</div>
                    )}
                  </div>
                </FormField>

                <FormField label="超时(ms)" hint="请求 Webhook 的超时控制。">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    type="number"
                    min="1"
                    step="1"
                    value={form.webhook.timeout_ms}
                    onChange={(e) => setForm({
                      ...form,
                      webhook: { ...form.webhook, timeout_ms: e.target.value },
                    })}
                  />
                </FormField>
              </div>

              {settings?.webhook.has_bearer_token && (
                <label className="inline-flex items-center gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-neutral-300"
                    checked={clearWebhookBearerToken}
                    onChange={(e) => {
                      setClearWebhookBearerToken(e.target.checked);
                      if (e.target.checked) {
                        setForm({
                          ...form,
                          webhook: { ...form.webhook, bearer_token: '' },
                        });
                      }
                    }}
                  />
                  清空已保存 Bearer Token
                </label>
              )}
            </>
          )}

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

          <div className="flex items-center justify-end gap-3">
            <button className="px-4 py-2.5 rounded-2xl border border-neutral-300 text-sm font-medium disabled:opacity-50" disabled={testing} onClick={() => void sendTest()}>
              {testing ? '发送中...' : form.delivery_mode === 'telegram_chat' ? '发送 Telegram 测试消息' : '发送 Webhook 测试请求'}
            </button>
            <button className="px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-medium disabled:opacity-50" disabled={saving} onClick={() => void save()}>
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function PaymentGatewaySettingsTab({ refreshTick }: { refreshTick: number }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState<PaymentGatewaySettingsView | null>(null);
  const [clearPrivateKey, setClearPrivateKey] = useState(false);
  const [form, setForm] = useState<PaymentGatewaySettingsFormState>({
    enabled: false,
    pid: '',
    private_key: '',
    platform_public_key: '',
    application_fee_amount: '1000',
  });

  const applyView = (view: PaymentGatewaySettingsView) => {
    setSettings(view);
    setForm({
      enabled: view.enabled,
      pid: view.pid || '',
      private_key: '',
      platform_public_key: view.platform_public_key || '',
      application_fee_amount: String(view.application_fee_amount || 1000),
    });
    setClearPrivateKey(false);
  };

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = (await apiFetch('/api/v1/admin/system-settings/payment-gateway')) as PaymentGatewaySettingsView;
      applyView(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, [refreshTick]);

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload: Record<string, unknown> = {
        enabled: form.enabled,
        pid: form.pid.trim(),
        platform_public_key: form.platform_public_key.trim(),
        application_fee_amount: Number(form.application_fee_amount || 1000),
      };
      if (clearPrivateKey) {
        payload.private_key = '';
      } else if (form.private_key.trim()) {
        payload.private_key = form.private_key.trim();
      }
      const data = (await apiFetch('/api/v1/admin/system-settings/payment-gateway', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })) as PaymentGatewaySettingsView;
      applyView(data);
      setSuccess('支付配置已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">支付配置</div>
        <p className="mt-1 text-sm text-neutral-500">申请人后台创建支付订单时会读取这里的金额、商户号和密钥配置。</p>
      </div>

      {loading && <div className="text-sm text-neutral-500">加载中...</div>}

      {!loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReadField label="最近更新人" value={valueOrDash(settings?.updated_by)} />
            <ReadField label="最近更新时间" value={formatDateTimeInBeijing(settings?.updated_at)} />
            <ReadField label="商户号 PID" value={valueOrDash(settings?.pid)} />
            <ReadField label="商户私钥" value={settings?.has_private_key ? `已配置 (${settings?.private_key_masked || '-'})` : '未配置'} />
            <ReadField label="申请金额" value={settings ? `¥${settings.application_fee_amount}` : '-'} />
          </div>

          <div className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4">
            <label className="inline-flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              启用支付
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="商户号 PID">
              <input
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                value={form.pid}
                onChange={(e) => setForm({ ...form, pid: e.target.value })}
                placeholder="输入商户号"
              />
            </FormField>
            <FormField label="申请金额 (元)" hint="默认 1000 元，后续新建支付订单按这里的金额创建。">
              <input
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                type="number"
                min="0.01"
                step="0.01"
                value={form.application_fee_amount}
                onChange={(e) => setForm({ ...form, application_fee_amount: e.target.value })}
              />
            </FormField>
            <FormField
              label="商户私钥"
              hint={settings?.has_private_key
                ? '已配置，留空则不修改；如需删除请勾选下方清空。请填写平台生成时返回的商户私钥，不要填写商户公钥或平台公钥。'
                : '用于 RSA 下单签名。请填写平台生成时返回的商户私钥，不要填写商户公钥或平台公钥。'}
            >
              <div className="space-y-2">
                <textarea
                  className="min-h-40 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                  value={form.private_key}
                  onChange={(e) => {
                    setClearPrivateKey(false);
                    setForm({ ...form, private_key: e.target.value });
                  }}
                  placeholder={settings?.has_private_key ? '已配置，留空则不修改' : '粘贴商户私钥，支持平台原始密钥串或 PEM'}
                />
                {settings?.has_private_key && (
                  <div className="text-xs text-neutral-500">当前已保存：{settings.private_key_masked}</div>
                )}
              </div>
            </FormField>
            <FormField label="平台公钥" hint="用于验证 V2 下单返回和异步通知签名。请填写支付平台后台显示的平台公钥，不要填写商户公钥或商户私钥。">
              <textarea
                className="min-h-40 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                value={form.platform_public_key}
                onChange={(e) => setForm({ ...form, platform_public_key: e.target.value })}
                placeholder="粘贴平台公钥，支持平台原始密钥串或 PEM"
              />
            </FormField>
          </div>

          {settings?.has_private_key && (
            <label className="inline-flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300"
                checked={clearPrivateKey}
                onChange={(e) => {
                  setClearPrivateKey(e.target.checked);
                  if (e.target.checked) {
                    setForm({ ...form, private_key: '' });
                  }
                }}
              />
              清空已保存商户私钥
            </label>
          )}

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

          <div className="flex items-center justify-end">
            <button className="px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-medium disabled:opacity-50" disabled={saving} onClick={() => void save()}>
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function getDefaultSmtpTemplates(): SmtpTemplateMap {
  return {
    applicant_credentials: {
      subject: 'GateRank 申请后台账号已开通 - {{airport_name}}',
      body: [
        '您好，{{airport_name}} 的申请已提交成功。',
        '',
        '登录邮箱：{{portal_email}}',
        '初始密码：{{initial_password}}',
        '登录地址：{{portal_login_url}}',
        '',
        '首次登录后请立即修改密码，然后完成支付并等待审批。',
      ].join('\n'),
    },
    application_approved: {
      subject: 'GateRank 审批通过通知 - {{airport_name}}',
      body: [
        '您好，{{airport_name}} 的 GateRank 入驻申请已审批通过。',
        '',
        '后续如需补充资料，请联系管理员。',
      ].join('\n'),
    },
  };
}

function cloneSmtpTemplates(templates?: SmtpTemplateMap | null): SmtpTemplateMap {
  const defaults = getDefaultSmtpTemplates();
  return {
    applicant_credentials: {
      subject: templates?.applicant_credentials?.subject || defaults.applicant_credentials.subject,
      body: templates?.applicant_credentials?.body || defaults.applicant_credentials.body,
    },
    application_approved: {
      subject: templates?.application_approved?.subject || defaults.application_approved.subject,
      body: templates?.application_approved?.body || defaults.application_approved.body,
    },
  };
}

function renderSmtpTemplatePreview(template: SmtpTemplateItem, values: Record<string, string>): SmtpTemplateItem {
  const render = (text: string) => text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => values[key] ?? '');
  return {
    subject: render(template.subject),
    body: render(template.body),
  };
}

function summarizeTemplateBody(body: string): string {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (compact.length <= 80) {
    return compact || '-';
  }
  return `${compact.slice(0, 80)}...`;
}

function SmtpSettingsTab({ refreshTick }: { refreshTick: number }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState<SmtpSettingsView | null>(null);
  const [clearPassword, setClearPassword] = useState(false);
  const [templateEditorKey, setTemplateEditorKey] = useState<SmtpTemplateKey | null>(null);
  const [templateDraft, setTemplateDraft] = useState<SmtpTemplateItem>({ subject: '', body: '' });
  const [form, setForm] = useState<SmtpSettingsFormState>({
    enabled: false,
    host: '',
    port: '465',
    secure: true,
    username: '',
    password: '',
    from_name: 'GateRank',
    from_email: '',
    reply_to: '',
    test_to: '',
    templates: getDefaultSmtpTemplates(),
  });

  const applyView = (view: SmtpSettingsView) => {
    setSettings(view);
    setForm({
      enabled: view.enabled,
      host: view.host || '',
      port: String(view.port || 465),
      secure: view.secure,
      username: view.username || '',
      password: '',
      from_name: view.from_name || 'GateRank',
      from_email: view.from_email || '',
      reply_to: view.reply_to || '',
      test_to: '',
      templates: cloneSmtpTemplates(view.templates),
    });
    setClearPassword(false);
  };

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = (await apiFetch('/api/v1/admin/system-settings/smtp')) as SmtpSettingsView;
      applyView(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, [refreshTick]);

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      enabled: form.enabled,
      host: form.host.trim(),
      port: Number(form.port || 465),
      secure: form.secure,
      username: form.username.trim(),
      from_name: form.from_name.trim(),
      from_email: form.from_email.trim(),
      reply_to: form.reply_to.trim(),
      templates: cloneSmtpTemplates(form.templates),
    };
    if (clearPassword) {
      payload.password = '';
    } else if (form.password.trim()) {
      payload.password = form.password.trim();
    }
    return payload;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = (await apiFetch('/api/v1/admin/system-settings/smtp', {
        method: 'PATCH',
        body: JSON.stringify(buildPayload()),
      })) as SmtpSettingsView;
      applyView(data);
      setSuccess('SMTP 配置已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch('/api/v1/admin/system-settings/smtp/test', {
        method: 'POST',
        body: JSON.stringify({
          ...buildPayload(),
          test_to: form.test_to.trim(),
        }),
      });
      setSuccess('测试邮件已发送');
    } catch (err) {
      setError(err instanceof Error ? err.message : '测试发送失败');
    } finally {
      setTesting(false);
    }
  };

  const openTemplateEditor = (key: SmtpTemplateKey) => {
    setTemplateEditorKey(key);
    setTemplateDraft({ ...form.templates[key] });
  };

  const closeTemplateEditor = () => {
    setTemplateEditorKey(null);
    setTemplateDraft({ subject: '', body: '' });
  };

  const applyTemplateDraft = () => {
    if (!templateEditorKey) {
      return;
    }
    setForm({
      ...form,
      templates: {
        ...form.templates,
        [templateEditorKey]: {
          subject: templateDraft.subject.trim(),
          body: templateDraft.body.trim(),
        },
      },
    });
    closeTemplateEditor();
  };

  const activeScenario = templateEditorKey ? SMTP_TEMPLATE_SCENARIOS[templateEditorKey] : null;
  const templatePreview = templateEditorKey && activeScenario
    ? renderSmtpTemplatePreview(templateDraft, activeScenario.sampleValues)
    : null;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">邮件配置</div>
        <p className="mt-1 text-sm text-neutral-500">用于发送账号凭证邮件和审批通过邮件。</p>
      </div>

      {loading && <div className="text-sm text-neutral-500">加载中...</div>}

      {!loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReadField label="最近更新人" value={valueOrDash(settings?.updated_by)} />
            <ReadField label="最近更新时间" value={formatDateTimeInBeijing(settings?.updated_at)} />
            <ReadField label="SMTP Host" value={valueOrDash(settings?.host)} />
            <ReadField label="密码" value={settings?.has_password ? `已配置 (${settings?.password_masked || '-'})` : '未配置'} />
          </div>

          <div className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4">
            <label className="inline-flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              启用 SMTP 发信
            </label>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            启用 SMTP 发信后，`Host / 端口 / 账号 / 密码 / 发件邮箱` 为必填；`发件人名称` 和 `Reply-To` 为选填。
            `Reply-To` 用于指定“收件人点击回复时，邮件会回到哪个地址”。
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Host" hint="SMTP 服务器地址。启用发信后必填，例如 `smtp.exmail.qq.com`。">
              <input className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="smtp.exmail.qq.com" />
            </FormField>
            <FormField label="端口" hint="SMTP 服务端口。启用发信后必填，常见为 `465` 或 `587`。">
              <input className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900" type="number" min="1" step="1" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} placeholder="465" />
            </FormField>
            <FormField label="账号" hint="SMTP 登录账号。启用发信后必填，通常填写完整邮箱地址或服务商给的用户名。">
              <input className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="noreply@example.com" />
            </FormField>
            <FormField label="密码" hint={settings?.has_password ? '启用发信后必填。当前已配置，留空则不修改；如需删除请勾选下方清空。' : 'SMTP 登录密码或授权码。启用发信后必填。'}>
              <div className="space-y-2">
                <input
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                  type="password"
                  placeholder="输入 SMTP 密码或授权码"
                  value={form.password}
                  onChange={(e) => {
                    setClearPassword(false);
                    setForm({ ...form, password: e.target.value });
                  }}
                />
                {settings?.has_password && (
                  <div className="text-xs text-neutral-500">当前已保存：{settings.password_masked}</div>
                )}
              </div>
            </FormField>
            <FormField label="发件人名称" hint="收件箱里展示的发件人名称。选填，不填时默认使用 `GateRank`。">
              <input className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900" value={form.from_name} onChange={(e) => setForm({ ...form, from_name: e.target.value })} placeholder="GateRank" />
            </FormField>
            <FormField label="发件邮箱" hint="真正写入邮件 `From` 的地址。启用发信后必填，建议与 SMTP 账号保持一致。">
              <input className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900" type="email" value={form.from_email} onChange={(e) => setForm({ ...form, from_email: e.target.value })} placeholder="noreply@example.com" />
            </FormField>
            <FormField label="Reply-To" hint="收件人点击“回复”时，邮件将回到这个地址。选填；不填时默认回复到发件邮箱。">
              <input className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900" type="email" value={form.reply_to} onChange={(e) => setForm({ ...form, reply_to: e.target.value })} placeholder="support@example.com" />
            </FormField>
            <FormField label="连接方式" hint="大多数邮箱服务建议开启。`465` 通常配合勾选，`587` 视服务商要求决定。">
              <label className="inline-flex items-center gap-3 text-sm font-medium pt-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-neutral-300"
                  checked={form.secure}
                  onChange={(e) => setForm({ ...form, secure: e.target.checked })}
                />
                使用 TLS / Secure
              </label>
            </FormField>
          </div>

          {settings?.has_password && (
            <label className="inline-flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300"
                checked={clearPassword}
                onChange={(e) => {
                  setClearPassword(e.target.checked);
                  if (e.target.checked) {
                    setForm({ ...form, password: '' });
                  }
                }}
              />
              清空已保存 SMTP 密码
            </label>
          )}

          <FormField label="测试收件人邮箱" hint="仅在点击“发送测试邮件”时必填。测试发送会使用当前表单里的配置，不依赖是否已保存。">
            <input className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900" type="email" value={form.test_to} onChange={(e) => setForm({ ...form, test_to: e.target.value })} placeholder="test@example.com" />
          </FormField>

          <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 space-y-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">邮件场景与模板</div>
              <p className="mt-1 text-sm text-neutral-500">
                以下场景会触发系统邮件。模板支持变量替换，修改后需要点击下方“保存配置”才会正式生效。
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {SMTP_TEMPLATE_ORDER.map((key) => {
                const scenario = SMTP_TEMPLATE_SCENARIOS[key];
                const template = form.templates[key];
                return (
                  <div key={key} className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-neutral-900">{scenario.title}</div>
                        <div className="mt-1 text-sm text-neutral-500">{scenario.description}</div>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
                        onClick={() => openTemplateEditor(key)}
                      >
                        编辑模板
                      </button>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                      <div className="font-medium text-neutral-900">触发时机</div>
                      <div className="mt-1">{scenario.trigger}</div>
                    </div>
                    <ReadField label="邮件主题" value={template.subject} />
                    <ReadField label="正文摘要" value={summarizeTemplateBody(template.body)} />
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400">可用变量</div>
                      <div className="flex flex-wrap gap-2">
                        {scenario.variables.map((variable) => (
                          <span
                            key={variable}
                            className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700"
                          >
                            {variable}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

          <div className="flex items-center justify-end gap-3">
            <button className="px-4 py-2.5 rounded-2xl border border-neutral-300 text-sm font-medium disabled:opacity-50" disabled={testing} onClick={() => void sendTest()}>
              {testing ? '发送中...' : '发送测试邮件'}
            </button>
            <button className="px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-medium disabled:opacity-50" disabled={saving} onClick={() => void save()}>
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </>
      )}

      {templateEditorKey && activeScenario && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] rounded-[28px] border border-neutral-200 bg-white shadow-[0_32px_120px_-40px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col">
            <div className="border-b border-neutral-200 px-6 py-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-bold tracking-tight">{activeScenario.title}</h3>
                <p className="text-sm text-neutral-500">{activeScenario.trigger}</p>
              </div>
              <button
                type="button"
                className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
                onClick={closeTemplateEditor}
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6 overscroll-contain">
              <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">模板编辑</div>
                  <p className="mt-1 text-sm text-neutral-500">支持纯文本和变量替换，变量会在发送时注入真实内容。</p>
                </div>
                <FormField label="邮件主题">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    value={templateDraft.subject}
                    onChange={(e) => setTemplateDraft({ ...templateDraft, subject: e.target.value })}
                  />
                </FormField>
                <FormField label="邮件正文" hint="纯文本模板，换行会按原样保留。">
                  <textarea
                    className="min-h-[220px] w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    value={templateDraft.body}
                    onChange={(e) => setTemplateDraft({ ...templateDraft, body: e.target.value })}
                  />
                </FormField>
              </section>

              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">可用变量</div>
                    <p className="mt-1 text-sm text-neutral-500">{activeScenario.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeScenario.variables.map((variable) => (
                      <span
                        key={variable}
                        className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700"
                      >
                        {variable}
                      </span>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4">
                    <div className="text-sm font-medium text-neutral-900">示例变量值</div>
                    <div className="mt-3 grid gap-2">
                      {Object.entries(activeScenario.sampleValues).map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-4 text-sm">
                          <code className="rounded bg-white px-2 py-1 text-xs">{`{{${key}}}`}</code>
                          <span className="text-right text-neutral-600 break-all">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 space-y-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">预览效果</div>
                    <p className="mt-1 text-sm text-neutral-500">以下预览使用示例变量渲染，仅用于确认模板内容。</p>
                  </div>
                  <ReadField label="预览主题" value={templatePreview?.subject || '-'} />
                  <ReadField label="预览正文" value={templatePreview?.body || '-'} />
                </div>
              </section>
            </div>

            <div className="border-t border-neutral-200 px-6 py-4 flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-2xl border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50"
                onClick={closeTemplateEditor}
              >
                取消
              </button>
              <button
                type="button"
                className="rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white"
                onClick={applyTemplateDraft}
              >
                应用模板修改
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MediaLibrarySettingsTab({ refreshTick }: { refreshTick: number }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState<MediaLibrarySettingsView | null>(null);
  const [clearPexelsApiKey, setClearPexelsApiKey] = useState(false);
  const [form, setForm] = useState<MediaLibrarySettingsFormState>({
    providers: {
      pexels: {
        enabled: false,
        api_key: '',
        timeout_ms: '8000',
      },
    },
  });

  const applyView = (view: MediaLibrarySettingsView) => {
    setSettings(view);
    setForm({
      providers: {
        pexels: {
          enabled: view.providers.pexels.enabled,
          api_key: '',
          timeout_ms: String(view.providers.pexels.timeout_ms || 8000),
        },
      },
    });
    setClearPexelsApiKey(false);
  };

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = (await apiFetch('/api/v1/admin/system-settings/media-libraries')) as MediaLibrarySettingsView;
      applyView(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, [refreshTick]);

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      providers: {
        pexels: {
          enabled: form.providers.pexels.enabled,
          timeout_ms: Number(form.providers.pexels.timeout_ms || 8000),
        },
      },
    };

    if (clearPexelsApiKey) {
      ((payload.providers as Record<string, unknown>).pexels as Record<string, unknown>).api_key = '';
    } else if (form.providers.pexels.api_key.trim()) {
      ((payload.providers as Record<string, unknown>).pexels as Record<string, unknown>).api_key = form.providers.pexels.api_key.trim();
    }

    return payload;
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const data = (await apiFetch('/api/v1/admin/system-settings/media-libraries', {
        method: 'PATCH',
        body: JSON.stringify(buildPayload()),
      })) as MediaLibrarySettingsView;
      applyView(data);
      setSuccess('图库配置已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">图库设置</div>
        <p className="mt-1 text-sm text-neutral-500">统一管理第三方图库访问凭证。当前新闻封面搜索仅接入 Pexels，但配置结构已为后续扩展预留。</p>
      </div>

      {loading && <div className="text-sm text-neutral-500">加载中...</div>}

      {!loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ReadField label="Pexels 状态" value={form.providers.pexels.enabled ? '已启用' : '已禁用'} />
            <ReadField label="最近更新人" value={valueOrDash(settings?.updated_by)} />
            <ReadField label="最近更新时间" value={formatDateTimeInBeijing(settings?.updated_at)} />
            <ReadField label="Pexels API Key" value={settings?.providers.pexels.has_api_key ? `已配置 (${settings.providers.pexels.api_key_masked || '-'})` : '未配置'} />
          </div>

          <div className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4">
            <div className="text-sm font-medium text-neutral-900">Pexels 图库</div>
            <p className="mt-1 text-sm text-neutral-500">用于新闻编辑页的第三方封面搜索与导入。关闭后，现有“从图库选择封面”入口仍显示，但调用会被拒绝。</p>
            <label className="mt-4 inline-flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300"
                checked={form.providers.pexels.enabled}
                onChange={(e) => setForm({
                  providers: {
                    pexels: {
                      ...form.providers.pexels,
                      enabled: e.target.checked,
                    },
                  },
                })}
              />
              启用 Pexels 图库
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Pexels API Key"
              hint={settings?.providers.pexels.has_api_key ? '已配置，留空则不修改；如需删除，请勾选下方“清空已保存 API Key”。' : '请输入新的 Pexels API Key。'}
            >
              <div className="space-y-2">
                <input
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                  type="password"
                  placeholder={settings?.providers.pexels.has_api_key ? '已配置，留空则不修改' : '输入新的 Pexels API Key'}
                  value={form.providers.pexels.api_key}
                  onChange={(e) => {
                    setClearPexelsApiKey(false);
                    setForm({
                      providers: {
                        pexels: {
                          ...form.providers.pexels,
                          api_key: e.target.value,
                        },
                      },
                    });
                  }}
                />
                {settings?.providers.pexels.has_api_key && (
                  <div className="text-xs text-neutral-500">当前已保存：{settings.providers.pexels.api_key_masked}</div>
                )}
              </div>
            </FormField>

            <FormField label="超时(ms)" hint="请求 Pexels API 的超时控制。">
              <input
                className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                type="number"
                min="1"
                step="1"
                value={form.providers.pexels.timeout_ms}
                onChange={(e) => setForm({
                  providers: {
                    pexels: {
                      ...form.providers.pexels,
                      timeout_ms: e.target.value,
                    },
                  },
                })}
              />
            </FormField>
          </div>

          {settings?.providers.pexels.has_api_key && (
            <label className="inline-flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300"
                checked={clearPexelsApiKey}
                onChange={(e) => {
                  setClearPexelsApiKey(e.target.checked);
                  if (e.target.checked) {
                    setForm({
                      providers: {
                        pexels: {
                          ...form.providers.pexels,
                          api_key: '',
                        },
                      },
                    });
                  }
                }}
              />
              清空已保存 API Key
            </label>
          )}

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

          <div className="flex items-center justify-end gap-3">
            <button className="px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-medium disabled:opacity-50" disabled={saving} onClick={() => void save()}>
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function PublishTokensSettingsTab({ refreshTick }: { refreshTick: number }) {
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState('');
  const [items, setItems] = useState<PublishTokenView[]>([]);
  const [form, setForm] = useState<PublishTokenCreateFormState>(() => createPublishTokenForm());
  const [createResult, setCreateResult] = useState<PublishTokenCreateResponse | null>(null);
  const publishApiBase = useMemo(() => `${getDisplayApiBase()}/api/v1/publish`, []);

  const fetchTokens = async () => {
    setLoading(true);
    setError('');
    try {
      const data = (await apiFetch('/api/v1/admin/system-settings/publish-tokens')) as PublishTokenListView;
      setItems((data.items || []).filter((item) => item.status === 'active'));
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载发布令牌失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTokens();
  }, [refreshTick]);

  const toggleScope = (scope: PublishTokenScope) => {
    setForm((current) => ({
      ...current,
      scopes: current.scopes.includes(scope)
        ? current.scopes.filter((item) => item !== scope)
        : [...current.scopes, scope],
    }));
  };

  const createToken = async () => {
    setCreating(true);
    setError('');
    setSuccess('');
    setCopied('');
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        scopes: form.scopes,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };
      const data = (await apiFetch('/api/v1/admin/system-settings/publish-tokens', {
        method: 'POST',
        body: JSON.stringify(payload),
      })) as PublishTokenCreateResponse;
      setCreateResult(data);
      setItems((current) => [data.token, ...current.filter((item) => item.id !== data.token.id)]);
      setForm(createPublishTokenForm());
      setSuccess('发布令牌已创建，明文仅展示这一次。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建发布令牌失败');
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (token: PublishTokenView) => {
    if (token.status === 'revoked') {
      return;
    }
    if (!window.confirm(`确认吊销令牌「${token.name}」？吊销后无法恢复。`)) {
      return;
    }

    setRevokingId(token.id);
    setError('');
    setSuccess('');
    try {
      const data = (await apiFetch(`/api/v1/admin/system-settings/publish-tokens/${token.id}/revoke`, {
        method: 'POST',
      })) as PublishTokenView;
      setItems((current) => current.filter((item) => item.id !== data.id));
      setSuccess(`令牌「${token.name}」已吊销`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '吊销失败');
    } finally {
      setRevokingId(null);
    }
  };

  const copyPlainToken = async () => {
    if (!createResult?.plain_token || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createResult.plain_token);
      setCopied('已复制到剪贴板');
    } catch {
      setCopied('复制失败，请手动复制');
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">发布令牌</div>
        <p className="mt-1 text-sm text-neutral-500">用于给第三方系统或 AI 开放受限发文能力。令牌只支持 Bearer 调用，明文只在创建成功时返回一次。</p>
      </div>

      {loading && <div className="text-sm text-neutral-500">加载中...</div>}

      {!loading && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm font-medium text-neutral-900">服务说明</div>
                <button
                  type="button"
                  className="rounded-2xl border border-neutral-300 px-4 py-2 text-sm font-medium"
                  onClick={() => window.open(buildPublishTokenDocsHref(), '_blank', 'noopener,noreferrer')}
                >
                  查看详细说明
                </button>
              </div>
              <div className="text-sm leading-6 text-neutral-500">
                令牌是系统级服务令牌，不复用后台全局 `x-api-key`。每个令牌都支持独立吊销、过期控制和最后使用时间记录。
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ReadField label="当前令牌数量" value={items.length} />
                <ReadField label="可用作用域" value={PUBLISH_TOKEN_SCOPES.length} />
                <ReadField label="封面字段" value="cover_image_url" />
                <ReadField label="发布模式" value="publish_mode = draft | publish" />
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-4 space-y-3">
              <div className="text-sm font-medium text-neutral-900">最短调用示例</div>
              <pre className="overflow-x-auto rounded-xl bg-neutral-950 px-4 py-3 text-xs leading-6 text-neutral-100">{`curl -X POST '${publishApiBase}/news' \\
  -H 'Authorization: Bearer <publish_token>' \\
  -H 'Content-Type: application/json' \\
  -d '{"title":"新文章","content_markdown":"# Hello","publish_mode":"draft"}'`}</pre>
              <pre className="overflow-x-auto rounded-xl bg-neutral-950 px-4 py-3 text-xs leading-6 text-neutral-100">{`curl -X POST '${publishApiBase}/news/123/publish' \\
  -H 'Authorization: Bearer <publish_token>' \\
  -H 'Content-Type: application/json' \\
  -d '{}'`}</pre>
              <div className="text-xs leading-6 text-neutral-500">
                `cover_image_url` 是封面地址字段。
                `draft` 表示创建草稿，不在前台公开；
                `publish` 表示创建后立即发布到前台。
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-300 bg-white px-4 py-4 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-medium text-neutral-900">创建令牌</div>
                <p className="mt-1 text-sm text-neutral-500">默认使用“新闻全量管理”预设，你也可以手动取消某些 scope。</p>
              </div>
              <button
                type="button"
                className="rounded-2xl border border-neutral-300 px-4 py-2 text-sm font-medium"
                onClick={() => setForm((current) => ({ ...current, scopes: [...DEFAULT_PUBLISH_TOKEN_SCOPES] }))}
              >
                应用全量管理预设
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="令牌名称" hint="建议按来源系统或用途命名，例如 Openclaw 自动推文。">
                <input
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                  placeholder="Openclaw 自动推文"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </FormField>

              <FormField label="过期时间" hint="留空表示长期有效，建议给第三方令牌设置生命周期。">
                <input
                  className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                />
              </FormField>
            </div>

            <FormField label="用途描述" hint="仅用于后台展示和审计说明，不会暴露给第三方调用方。">
              <textarea
                className="min-h-24 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                placeholder="用于 Openclaw / AI 自动抓取后发稿"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </FormField>

            <FormField label="作用域" hint="勾选越多权限面越大。直接发文至少需要“创建文章 + 发布文章”。">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PUBLISH_TOKEN_SCOPES.map((scope) => (
                  <label key={scope.value} className="rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm">
                    <span className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-neutral-300"
                        checked={form.scopes.includes(scope.value)}
                        onChange={() => toggleScope(scope.value)}
                      />
                      <span>
                        <span className="block font-medium text-neutral-900">{scope.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-neutral-500">{scope.description}</span>
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </FormField>

            <div className="flex items-center justify-end gap-3">
              <button
                className="px-4 py-2.5 rounded-2xl border border-neutral-300 text-sm font-medium"
                onClick={() => {
                  setForm(createPublishTokenForm());
                  setCreateResult(null);
                  setCopied('');
                }}
              >
                重置表单
              </button>
              <button
                className="px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-medium disabled:opacity-50"
                disabled={creating}
                onClick={() => void createToken()}
              >
                {creating ? '创建中...' : '创建发布令牌'}
              </button>
            </div>
          </div>

          {createResult && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-medium text-emerald-900">新令牌已生成</div>
                  <p className="mt-1 text-sm text-emerald-800">请立即复制保存，刷新页面后不会再次显示明文。</p>
                </div>
                <button
                  className="rounded-2xl border border-emerald-400 px-4 py-2 text-sm font-medium text-emerald-900"
                  onClick={() => void copyPlainToken()}
                >
                  复制明文令牌
                </button>
              </div>
              <div className="rounded-xl bg-white px-4 py-3 font-mono text-sm break-all text-neutral-900">
                {createResult.plain_token}
              </div>
              {copied && <div className="text-sm text-emerald-800">{copied}</div>}
            </div>
          )}

          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          {success && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-medium text-neutral-900">已创建令牌</div>
                <p className="mt-1 text-sm text-neutral-500">令牌明文不会再次返回，变更权限请吊销后重新创建。</p>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-6 text-sm text-neutral-500">
                还没有创建任何发布令牌。
              </div>
            ) : (
              items.map((token) => (
                <div key={token.id} className="rounded-2xl border border-neutral-300 bg-white px-4 py-4 space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1">
                      <div className="text-base font-semibold text-neutral-900">{token.name}</div>
                      <div className="text-sm text-neutral-500">{token.description || '未填写用途描述'}</div>
                    </div>
                    <button
                      className="rounded-2xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-50"
                      disabled={token.status === 'revoked' || revokingId === token.id}
                      onClick={() => void revokeToken(token)}
                    >
                      {revokingId === token.id ? '吊销中...' : token.status === 'revoked' ? '已吊销' : '吊销令牌'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <ReadField label="Token 标识" value={token.token_masked} />
                    <ReadField label="状态" value={token.status === 'active' ? '生效中' : '已吊销'} />
                    <ReadField label="创建人" value={valueOrDash(token.created_by)} />
                    <ReadField label="作用域" value={formatScopeSummary(token.scopes)} />
                    <ReadField label="创建时间" value={formatDateTimeInBeijing(token.created_at)} />
                    <ReadField label="最后使用时间" value={formatDateTimeInBeijing(token.last_used_at)} />
                    <ReadField label="最后使用 IP" value={valueOrDash(token.last_used_ip)} />
                    <ReadField label="过期时间" value={formatDateTimeInBeijing(token.expires_at)} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {token.scopes.map((scope) => (
                      <span key={scope} className="rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs text-neutral-700">
                        {formatPublishScopeLabel(scope)}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}

function AirportsPage({ onOpenAirport }: { onOpenAirport: (id: number) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<Airport[]>([]);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<'' | AirportStatus>('');
  const [editing, setEditing] = useState<AirportFormState | null>(null);
  const [manualTagInput, setManualTagInput] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceDescription, setBalanceDescription] = useState('');
  const [balanceSaving, setBalanceSaving] = useState(false);
  const [balanceError, setBalanceError] = useState('');
  const [balanceMessage, setBalanceMessage] = useState('');

  const fetchList = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (keyword) query.set('keyword', keyword);
      if (status) query.set('status', status);
      const data = (await apiFetch(`/api/v1/admin/airports?${query.toString()}`)) as { items: Airport[] };
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchList();
  }, []);

  useEffect(() => {
    setManualTagInput(editing ? formatTagInput(editing.manual_tags) : '');
    setBalanceAmount('');
    setBalanceDescription('');
    setBalanceError('');
    setBalanceMessage('');
  }, [editing?.id ?? (editing ? 'new' : 'none')]);

  const saveAirport = async () => {
    if (!editing) return;
    const websites = normalizeUrlList(editing.websites);
    const manualTags = parseTagInput(manualTagInput);
    if (!editing.name.trim()) {
      setFormError('请填写机场名称');
      return;
    }
    if (websites.length === 0) {
      setFormError('至少填写一个官网链接');
      return;
    }
    const confirmDown = editing.status === 'down';
    if (
      confirmDown &&
      !window.confirm('确认将该机场标记为“已跑路”？确认后它会从自动调度、手动任务和每日测评中全部排除。')
    ) {
      return;
    }

    const body = {
      name: editing.name.trim(),
      website: websites[0],
      websites,
      status: editing.status,
      is_listed: editing.is_listed,
      plan_price_month: Number(editing.plan_price_month || 0),
      has_trial: Boolean(editing.has_trial),
      subscription_url: editing.subscription_url.trim() || null,
      applicant_email: editing.applicant_email.trim() || null,
      applicant_telegram: editing.applicant_telegram.trim() || null,
      founded_on: editing.founded_on || null,
      airport_intro: editing.airport_intro.trim() || null,
      test_account: editing.test_account.trim() || null,
      test_password: editing.test_password || null,
      manual_tags: manualTags,
      confirm_down: confirmDown || undefined,
    };

    setSaving(true);
    setFormError('');
    try {
      if (!editing.id) {
        await apiFetch('/api/v1/admin/airports', { method: 'POST', body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/v1/admin/airports/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }

      setEditing(null);
      await fetchList();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const addWalletBalance = async () => {
    if (!editing?.id) return;
    if (!editing.wallet_id) {
      setBalanceError('该机场未绑定申请人钱包，不能添加余额');
      return;
    }
    const amount = Number(balanceAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setBalanceError('请输入大于 0 的加款金额');
      return;
    }

    setBalanceSaving(true);
    setBalanceError('');
    setBalanceMessage('');
    try {
      const data = (await apiFetch(`/api/v1/admin/airports/${editing.id}/wallet/adjustments`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          description: balanceDescription.trim() || null,
        }),
      })) as { wallet: { id: number; balance: number } };
      setEditing({
        ...editing,
        wallet_id: data.wallet.id,
        wallet_balance: data.wallet.balance,
      });
      setBalanceAmount('');
      setBalanceDescription('');
      setBalanceMessage('余额已添加');
      await fetchList();
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : '添加余额失败');
    } finally {
      setBalanceSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold">机场管理</h2>
        <button
          className="px-3 py-2 rounded bg-neutral-900 text-white text-sm"
          onClick={() => {
            setFormError('');
            setEditing(createAirportForm());
          }}
        >
          <span className="inline-flex items-center gap-2"><Plus size={14} />新增机场</span>
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-neutral-400" />
          <input
            className="border rounded pl-7 pr-3 py-2 text-sm"
            placeholder="搜索名称 / 官网 / 备用网址"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <select className="border rounded px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as '' | AirportStatus)}>
          <option value="">全部状态</option>
          <option value="normal">正常</option>
          <option value="risk">风险</option>
          <option value="down">跑路</option>
        </select>
        <button className="px-3 py-2 text-sm rounded border" onClick={() => void fetchList()}>查询</button>
      </div>

      {error && <div className="text-sm text-rose-600">{error}</div>}
      {loading ? <div className="text-sm text-neutral-500">加载中...</div> : (
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-[1500px] table-fixed text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="w-[12%] text-left px-4 py-3">名称</th>
                <th className="w-[7%] text-left px-4 py-3">网站</th>
                <th className="w-[7%] text-left px-4 py-3">状态</th>
                <th className="w-[7%] text-left px-4 py-3">是否上架</th>
                <th className="w-[7%] text-left px-4 py-3">月价</th>
                <th className="w-[7%] text-left px-4 py-3">总分</th>
                <th className="w-[7%] text-left px-4 py-3">试用</th>
                <th className="w-[8%] text-left px-4 py-3">订阅链接</th>
                <th className="w-[8%] text-left px-4 py-3">用户余额</th>
                <th className="w-[20%] text-left px-4 py-3">标签</th>
                <th className="sticky right-0 z-20 w-[10%] text-left px-4 py-3 bg-neutral-50 border-l border-neutral-200 shadow-[-8px_0_16px_-12px_rgba(0,0,0,0.18)]">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-neutral-100 align-middle">
                  <td className="px-4 py-3">
                    <div className="font-medium whitespace-nowrap">{it.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap">{hasAirportWebsite(it) ? '有' : '无'}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatAirportStatus(it.status)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatAirportListedStatus(it.is_listed)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{it.plan_price_month}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{valueOrDash(it.total_score)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{it.has_trial ? '是' : '否'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {it.subscription_url ? '有' : '无'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatMoneyOrDash(it.wallet_balance)}</td>
                  <td className="px-4 py-3">
                    <TagBadgeGroup tags={it.tags || []} size="sm" />
                  </td>
                  <td className="sticky right-0 z-10 px-4 py-3 bg-white border-l border-neutral-200 shadow-[-8px_0_16px_-12px_rgba(0,0,0,0.14)]">
                    <div className="flex items-center gap-3 whitespace-nowrap">
                      <button className="underline" onClick={() => {
                        setFormError('');
                        setEditing(toAirportForm(it));
                      }}>编辑</button>
                      <button className="underline" onClick={() => onOpenAirport(it.id)}>数据台</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[88vh] rounded-[28px] border border-neutral-200 bg-white shadow-[0_32px_120px_-40px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col">
            <div className="border-b border-neutral-200 px-6 py-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-bold tracking-tight">{editing.id ? '编辑机场' : '新增机场'}</h3>
                <p className="text-sm text-neutral-500">字段标题、分组和辅助说明已拆清楚。第一条官网会作为主域名用于列表展示与搜索。</p>
              </div>
              <button
                type="button"
                className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
                onClick={() => setEditing(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6 overscroll-contain">
              <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">基础信息</div>
                  <p className="mt-1 text-sm text-neutral-500">先把识别信息填完整，再补上价格、状态与是否支持试用。</p>
                </div>

                <FormField label="机场名称" hint="用于管理列表、数据台标题与榜单识别。">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    placeholder="例如：大象网络"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                </FormField>

                <FormField label="月付价格" hint="用于性价比计算，单位按元处理。">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    placeholder="例如：10"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.plan_price_month}
                    onChange={(e) => setEditing({ ...editing, plan_price_month: e.target.value })}
                  />
                </FormField>

                <FormField label="运行状态" hint="控制榜单与管理列表的状态展示。">
                  <select
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    value={editing.status}
                    onChange={(e) => setEditing({ ...editing, status: e.target.value as AirportStatus })}
                  >
                    <option value="normal">正常</option>
                    <option value="risk">风险</option>
                    <option value="down">跑路</option>
                  </select>
                </FormField>

                <FormField label="上架状态" hint="控制是否出现在所有公开页面；下架后仅管理后台可见。">
                  <select
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    value={editing.is_listed ? 'listed' : 'unlisted'}
                    onChange={(e) => setEditing({ ...editing, is_listed: e.target.value === 'listed' })}
                  >
                    <option value="listed">上架</option>
                    <option value="unlisted">下架</option>
                  </select>
                </FormField>

                <div className="rounded-2xl border border-neutral-300 bg-white px-4 py-4">
                  <div className="text-sm font-medium text-neutral-900">试用支持</div>
                  <p className="mt-1 text-sm text-neutral-500">用于新手友好类标签判断，也方便运营快速筛选。</p>
                  <label className="mt-4 inline-flex items-center gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-neutral-300"
                      checked={editing.has_trial}
                      onChange={(e) => setEditing({ ...editing, has_trial: e.target.checked })}
                    />
                    支持试用
                  </label>
                </div>

                <FormField label="人工标签" hint="多个标签用逗号、顿号、空格或换行分隔。系统自动标签会单独计算，这里只维护人工标签。">
                  <textarea
                    className="min-h-[96px] w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    placeholder="例如：老牌机场, 流媒体友好, 备用线路多"
                    value={manualTagInput}
                    onChange={(e) => setManualTagInput(e.target.value)}
                  />
                </FormField>
              </section>

              <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">联系与审核信息</div>
                  <p className="mt-1 text-sm text-neutral-500">这些字段与入驻申请保持一致，正式机场创建后也可在这里维护。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="联系邮箱" hint="用于运营联系或回查申请记录。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      placeholder="contact@example.com"
                      type="email"
                      value={editing.applicant_email}
                      onChange={(e) => setEditing({ ...editing, applicant_email: e.target.value })}
                    />
                  </FormField>

                  <FormField label="Telegram" hint="用于快速联系机场运营方。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      placeholder="@telegram"
                      value={editing.applicant_telegram}
                      onChange={(e) => setEditing({ ...editing, applicant_telegram: e.target.value })}
                    />
                  </FormField>

                  <FormField label="成立日期" hint="可选，沿用入驻申请的成立时间。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      type="date"
                      value={editing.founded_on}
                      onChange={(e) => setEditing({ ...editing, founded_on: e.target.value })}
                    />
                  </FormField>

                  <FormField label="测试账号" hint="审核或排障时可用的账号。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      placeholder="测试账号"
                      value={editing.test_account}
                      onChange={(e) => setEditing({ ...editing, test_account: e.target.value })}
                    />
                  </FormField>

                  <FormField label="测试密码" hint="为空则表示不更新或暂未提供。">
                    <input
                      className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                      type="text"
                      placeholder="测试密码"
                      value={editing.test_password}
                      onChange={(e) => setEditing({ ...editing, test_password: e.target.value })}
                    />
                  </FormField>
                </div>

                <FormField label="机场基本介绍" hint="用于保存服务定位、节点特色或补充说明。">
                  <textarea
                    className="min-h-28 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    placeholder="介绍机场特色、节点地区、适用人群等。"
                    value={editing.airport_intro}
                    onChange={(e) => setEditing({ ...editing, airport_intro: e.target.value })}
                  />
                </FormField>
              </section>

              {editing.id && (
                <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">余额管理</div>
                    <p className="mt-1 text-sm text-neutral-500">为该机场绑定的申请人钱包添加余额。</p>
                  </div>
                  <ReadField label="当前用户余额" value={formatMoneyOrDash(editing.wallet_balance)} />
                  {!editing.wallet_id ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      该机场未绑定申请人钱包，不能添加余额。
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <FormField label="本次加款金额" hint="只支持增加余额，不能直接覆盖余额。">
                        <input
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="例如：100"
                          value={balanceAmount}
                          onChange={(e) => setBalanceAmount(e.target.value)}
                        />
                      </FormField>
                      <FormField label="备注" hint="可选，不填写时系统会自动记录为后台加款。">
                        <input
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                          placeholder="例如：线下补款"
                          value={balanceDescription}
                          onChange={(e) => setBalanceDescription(e.target.value)}
                        />
                      </FormField>
                      {balanceError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{balanceError}</div>}
                      {balanceMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{balanceMessage}</div>}
                      <button
                        type="button"
                        className="rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                        disabled={balanceSaving}
                        onClick={() => void addWalletBalance()}
                      >
                        {balanceSaving ? '添加中...' : '添加余额'}
                      </button>
                    </div>
                  )}
                </section>
              )}

              <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">官网配置</div>
                  <p className="mt-1 text-sm text-neutral-500">支持多个域名，方便录入主站与备用网址。第一条会自动作为主官网。</p>
                </div>

                <div className="space-y-4">
                  {editing.websites.map((website, index) => (
                    <div key={`website-${index}`}>
                      <FormField
                        label={index === 0 ? '主官网链接' : `备用网址 ${index}`}
                        hint={index === 0 ? '建议填写当前主站地址。' : '备用网址会一并保存，方便应对域名切换。'}
                      >
                        <div className="space-y-3">
                          <input
                            className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                            placeholder="https://example.com"
                            value={website}
                            onChange={(e) => setEditing({
                              ...editing,
                              websites: updateListItem(editing.websites, index, e.target.value),
                            })}
                          />
                          <button
                            type="button"
                            className="rounded-2xl border border-neutral-300 px-3 py-3 text-sm text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={editing.websites.length === 1}
                            onClick={() => setEditing({
                              ...editing,
                              websites: removeListItem(editing.websites, index),
                            })}
                          >
                            <span className="inline-flex items-center gap-2"><Trash2 size={14} />删除</span>
                          </button>
                        </div>
                      </FormField>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="w-full rounded-2xl border border-dashed border-neutral-400 px-4 py-3 text-sm font-medium text-neutral-700 hover:border-neutral-900 hover:text-neutral-900"
                  onClick={() => setEditing({ ...editing, websites: [...editing.websites, ''] })}
                >
                  <span className="inline-flex items-center gap-2"><Plus size={14} />继续添加官网链接</span>
                </button>

                <FormField label="订阅链接" hint="可选。如果和官网不同，单独录入更方便运营排查。">
                  <input
                    className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                    placeholder="https://example.com/subscribe"
                    value={editing.subscription_url}
                    onChange={(e) => setEditing({ ...editing, subscription_url: e.target.value })}
                  />
                </FormField>
              </section>

              {formError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>}
            </div>

            <div className="border-t border-neutral-200 px-6 py-5 flex items-center justify-end gap-3 bg-white">
              <button className="px-4 py-2.5 rounded-2xl border border-neutral-300 text-sm font-medium" onClick={() => setEditing(null)}>
                取消
              </button>
              <button
                className="px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-medium disabled:opacity-50"
                disabled={saving}
                onClick={() => void saveAirport()}
              >
                {saving ? '保存中...' : '保存机场'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApplicationsPage({ onOpenAirports }: { onOpenAirports: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [items, setItems] = useState<AirportApplication[]>([]);
  const [keyword, setKeyword] = useState('');
  const [reviewStatus, setReviewStatus] = useState<'' | AirportApplicationReviewStatus>('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<AirportApplication | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailSuccess, setDetailSuccess] = useState('');
  const [reviewAction, setReviewAction] = useState<'reviewed' | 'rejected'>('reviewed');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [markPaidSaving, setMarkPaidSaving] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (keyword) query.set('keyword', keyword);
      if (reviewStatus) query.set('review_status', reviewStatus);
      const data = (await apiFetch(`/api/v1/admin/airport-applications?${query.toString()}`)) as {
        items: AirportApplication[];
      };
      setItems(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetailError('');
    setDetailSuccess('');
    setSelected(null);
    setReviewNote('');
    setReviewAction('reviewed');
    try {
      const data = (await apiFetch(`/api/v1/admin/airport-applications/${id}`)) as AirportApplication;
      setSelected(data);
      setReviewAction(data.review_status === 'rejected' ? 'rejected' : 'reviewed');
      setReviewNote(data.review_note || '');
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : '详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const submitReview = async () => {
    if (!selectedId || !selected) return;
    if (selected.review_status !== 'pending') {
      setDetailError('该申请已处理，不能再次修改');
      return;
    }
    setReviewSaving(true);
    setDetailError('');
    setDetailSuccess('');
    try {
      const data = (await apiFetch(`/api/v1/admin/airport-applications/${selectedId}/review`, {
        method: 'PATCH',
        body: JSON.stringify({
          review_status: reviewAction,
          review_note: reviewNote.trim() || null,
        }),
      })) as AirportApplication;
      setSelected(data);
      await fetchList();
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : '审核失败');
    } finally {
      setReviewSaving(false);
    }
  };

  const markApplicationPaid = async () => {
    if (!selectedId || !selected) return;
    if (selected.review_status !== 'awaiting_payment' || selected.payment_status === 'paid') {
      setDetailError('当前申请状态不支持改为已支付');
      return;
    }
    const confirmed = window.confirm('改为已支付后，该申请会进入待审核，并关闭当前未完成的支付订单。是否继续？');
    if (!confirmed) return;

    setMarkPaidSaving(true);
    setDetailError('');
    setDetailSuccess('');
    try {
      const data = (await apiFetch(`/api/v1/admin/airport-applications/${selectedId}/mark-paid`, {
        method: 'PATCH',
      })) as AirportApplication;
      setSelected(data);
      setReviewAction(data.review_status === 'rejected' ? 'rejected' : 'reviewed');
      setReviewNote(data.review_note || '');
      setDetailSuccess('已改为已支付，订单已关闭');
      await fetchList();
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : '更新支付状态失败');
    } finally {
      setMarkPaidSaving(false);
    }
  };

  useEffect(() => {
    void fetchList();
  }, []);

  const isReviewLocked = selected?.review_status !== 'pending';
  const canMarkPaid = selected?.review_status === 'awaiting_payment' && selected.payment_status !== 'paid';
  const reviewLockMessage = selected?.review_status === 'awaiting_payment'
    ? '该申请当前处于待支付状态。可先改为已支付，系统会自动推进到待审核。'
    : '该申请已处理，审核结果不能再次修改。';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">入驻申请</h2>
          <p className="mt-1 text-sm text-neutral-500">公开申请会先进入待支付，支付成功后才会进入待审批列表。</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-neutral-400" />
          <input
            className="border rounded pl-7 pr-3 py-2 text-sm"
            placeholder="搜索机场 / 邮箱 / Telegram / 官网"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>
        <select
          className="border rounded px-3 py-2 text-sm"
          value={reviewStatus}
          onChange={(e) => setReviewStatus(e.target.value as '' | AirportApplicationReviewStatus)}
        >
          <option value="">全部状态</option>
          <option value="awaiting_payment">待支付</option>
          <option value="pending">待审核</option>
          <option value="reviewed">已审核</option>
          <option value="rejected">已驳回</option>
        </select>
        <button className="px-3 py-2 text-sm rounded border" onClick={() => void fetchList()}>查询</button>
      </div>

      {error && <div className="text-sm text-rose-600">{error}</div>}
      {loading ? (
        <div className="text-sm text-neutral-500">加载中...</div>
      ) : (
        <div className="overflow-x-auto rounded border border-neutral-200">
          <table className="w-full min-w-[1340px] table-fixed text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="w-[15%] text-left px-4 py-3">机场名称</th>
                <th className="w-[15%] text-left px-4 py-3">邮箱</th>
                <th className="w-[11%] text-left px-4 py-3">Telegram</th>
                <th className="w-[10%] text-left px-4 py-3">成立日期</th>
                <th className="w-[10%] text-left px-4 py-3">支付状态</th>
                <th className="w-[10%] text-left px-4 py-3">已支付金额</th>
                <th className="w-[10%] text-left px-4 py-3">审批状态</th>
                <th className="w-[11%] text-left px-4 py-3">提交时间</th>
                <th className="w-[8%] text-left px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-neutral-100 align-middle">
                  <td className="px-4 py-3">
                    <div className="font-medium whitespace-nowrap">{item.name}</div>
                    <div className="mt-1 text-xs text-neutral-500 truncate" title={item.website}>{item.website}</div>
                  </td>
                  <td className="px-4 py-3 truncate" title={item.applicant_email}>{item.applicant_email}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.applicant_telegram}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.founded_on}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.payment_status === 'paid' ? '已支付' : '未支付'}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatMoneyOrDash(item.payment_amount)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatApplicationReviewStatus(item.review_status)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{item.created_at}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button className="underline" onClick={() => void openDetail(item.id)}>查看详情</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-neutral-500">
                    当前没有匹配的申请记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] rounded-[28px] border border-neutral-200 bg-white shadow-[0_32px_120px_-40px_rgba(0,0,0,0.55)] overflow-hidden flex flex-col">
            <div className="border-b border-neutral-200 px-6 py-5 flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-2xl font-bold tracking-tight">申请详情</h3>
                <p className="text-sm text-neutral-500">查看申请资料并执行审核或驳回。</p>
              </div>
              <button
                type="button"
                className="w-10 h-10 rounded-full border border-neutral-200 flex items-center justify-center text-neutral-500 hover:text-neutral-900"
                onClick={() => {
                  setSelectedId(null);
                  setSelected(null);
                  setDetailError('');
                  setDetailSuccess('');
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 space-y-6 overscroll-contain">
              {detailLoading && <div className="text-sm text-neutral-500">详情加载中...</div>}
              {detailError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{detailError}</div>}
              {detailSuccess && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{detailSuccess}</div>}

              {selected && (
                <>
                  <section className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5 space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">基础信息</div>
                      <p className="mt-1 text-sm text-neutral-500">公开申请中提交的机场字段。</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ReadField label="机场名称" value={selected.name} />
                      <ReadField label="运行状态" value={`${formatAirportStatus(selected.status)} / ${formatApplicationReviewStatus(selected.review_status)}`} />
                      <ReadField label="月付价格" value={selected.plan_price_month} />
                      <ReadField label="试用支持" value={selected.has_trial ? '是' : '否'} />
                      <ReadField label="支付状态" value={selected.payment_status === 'paid' ? '已支付' : '未支付'} />
                      <ReadField label="支付金额" value={formatMoneyOrDash(selected.payment_amount)} />
                      <ReadField label="订阅链接" value={valueOrDash(selected.subscription_url)} />
                      <ReadField label="成立日期" value={selected.founded_on} />
                      <ReadField label="支付时间" value={valueOrDash(selected.paid_at)} />
                      <ReadField label="首次改密" value={selected.must_change_password == null ? '-' : selected.must_change_password ? '未完成' : '已完成'} />
                    </div>
                    <ReadField label="官网列表" value={formatWebsiteList(selected.websites, selected.website)} />
                  </section>

                  <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">申请与测试信息</div>
                      <p className="mt-1 text-sm text-neutral-500">仅详情页展示测试账号与密码。</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ReadField label="联系邮箱" value={selected.applicant_email} />
                      <ReadField label="Telegram" value={selected.applicant_telegram} />
                      <ReadField label="测试账号" value={selected.test_account} />
                      <ReadField label="测试密码" value={selected.test_password} />
                    </div>
                    <ReadField label="机场基本介绍" value={selected.airport_intro} />
                  </section>

                  <section className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">审核处理</div>
                      <p className="mt-1 text-sm text-neutral-500">支付处理与审核处理分开执行。只有已支付且处于待审核状态的申请才允许审批。</p>
                    </div>
                    {isReviewLocked && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {reviewLockMessage}
                      </div>
                    )}
                    {canMarkPaid && (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                        <div className="text-sm text-sky-900">
                          后台可直接补录为已支付。提交后会自动进入待审核，并关闭当前未完成的支付订单。
                        </div>
                        <button
                          type="button"
                          className="rounded-2xl border border-sky-300 px-3 py-2 text-sm font-medium text-sky-900 disabled:opacity-50"
                          disabled={markPaidSaving}
                          onClick={() => void markApplicationPaid()}
                        >
                          {markPaidSaving ? '处理中...' : '改为已支付'}
                        </button>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField label="审核动作" hint="只支持标记为已审核或已驳回。">
                        <select
                          className="w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                          value={reviewAction}
                          disabled={isReviewLocked}
                          onChange={(e) => setReviewAction(e.target.value as 'reviewed' | 'rejected')}
                        >
                          <option value="reviewed">已审核</option>
                          <option value="rejected">已驳回</option>
                        </select>
                      </FormField>
                      <FormField label="当前审核信息" hint="后台返回的最新审核状态。">
                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6">
                          <div>状态：{formatApplicationReviewStatus(selected.review_status)}</div>
                          <div>处理人：{valueOrDash(selected.reviewed_by)}</div>
                          <div>处理时间：{valueOrDash(selected.reviewed_at)}</div>
                          <div>正式机场 ID：{valueOrDash(selected.approved_airport_id)}</div>
                        </div>
                      </FormField>
                    </div>
                    {selected.approved_airport_id && (
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <div className="text-sm text-emerald-800">
                          已生成正式机场 #{selected.approved_airport_id}，可前往机场管理继续维护资料。
                        </div>
                        <button
                          type="button"
                          className="rounded-2xl border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-900"
                          onClick={onOpenAirports}
                        >
                          前往机场管理
                        </button>
                      </div>
                    )}
                    <FormField label="审核备注" hint="可选，适合记录核验结果或补充说明。">
                      <textarea
                        className="min-h-28 w-full rounded-2xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-neutral-900"
                        value={reviewNote}
                        disabled={isReviewLocked}
                        onChange={(e) => setReviewNote(e.target.value)}
                        placeholder="可选备注"
                      />
                    </FormField>
                  </section>
                </>
              )}
            </div>

            <div className="border-t border-neutral-200 px-6 py-5 flex items-center justify-end gap-3 bg-white">
              <button
                className="px-4 py-2.5 rounded-2xl border border-neutral-300 text-sm font-medium"
                onClick={() => {
                  setSelectedId(null);
                  setSelected(null);
                  setDetailError('');
                  setDetailSuccess('');
                }}
              >
                关闭
              </button>
              <button
                className="px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-medium disabled:opacity-50"
                disabled={reviewSaving || markPaidSaving || !selected || isReviewLocked}
                onClick={() => void submitReview()}
              >
                {reviewSaving ? '提交中...' : selected?.review_status === 'awaiting_payment' ? '待支付' : isReviewLocked ? '已处理' : '保存审核结果'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AirportDataPage({ airportId, onBack }: { airportId: number; onBack: () => void }) {
  const [date, setDate] = useState(today());
  const [dashboard, setDashboard] = useState<AirportDashboardView | null>(null);
  const [recentStabilitySamples, setRecentStabilitySamples] = useState<ProbeSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<DashboardTab>('base');
  const [message, setMessage] = useState('');
  const [samplesError, setSamplesError] = useState('');
  const [job, setJob] = useState<ManualJobRecord | null>(null);
  const [jobMessage, setJobMessage] = useState('');
  const [jobTone, setJobTone] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [manualTotalScoreInput, setManualTotalScoreInput] = useState('');
  const [manualTotalScoreSaving, setManualTotalScoreSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    setSamplesError('');
    try {
      const data = (await apiFetch(
        `/api/v1/admin/airports/${airportId}/dashboard?date=${date}`,
      )) as AirportDashboardView;
      setDashboard(data);
      await loadSamplesOnly();
    } catch (err) {
      setDashboard(null);
      setError(err instanceof Error ? err.message : '加载失败');
      setRecentStabilitySamples([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSamplesOnly = async () => {
    try {
      const samples = (await apiFetch(
        `/api/v1/admin/airports/${airportId}/probe-samples?latest=1&limit=20&scope=stability`,
      )) as { items: ProbeSample[] };
      setRecentStabilitySamples(
        (samples.items || []).filter((item) => item.sample_type === 'availability' || item.sample_type === 'latency'),
      );
      setSamplesError('');
    } catch (err) {
      setRecentStabilitySamples([]);
      setSamplesError(err instanceof Error ? err.message : '采样加载失败');
    } finally {
      // no-op
    }
  };

  useEffect(() => {
    setJob(null);
    setJobMessage('');
    setJobTone('neutral');
    void load();
  }, [airportId, date]);

  useEffect(() => {
    const totalScore = dashboard?.base.total_score;
    setManualTotalScoreInput(totalScore === null || totalScore === undefined ? '' : String(totalScore));
  }, [dashboard?.date, dashboard?.base.id, dashboard?.base.total_score]);

  useEffect(() => {
    if (!job || (job.status !== 'queued' && job.status !== 'running')) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const nextJob = (await apiFetch(`/api/v1/admin/manual-jobs/${job.id}`)) as ManualJobRecord;
          setJob(nextJob);
          if (nextJob.status === 'queued') {
            setJobTone('neutral');
            setJobMessage(nextJob.message || '任务已创建，等待执行');
            return;
          }
          if (nextJob.status === 'running') {
            setJobTone('neutral');
            setJobMessage(nextJob.message || '任务执行中...');
            return;
          }
          if (nextJob.status === 'succeeded') {
            setJobTone('success');
            setJobMessage(nextJob.message || '任务执行完成');
            await load();
            return;
          }
          setJobTone('error');
          setJobMessage(nextJob.message || '任务执行失败');
        } catch (err) {
          setJobTone('error');
          setJobMessage(err instanceof Error ? err.message : '任务状态查询失败');
        }
      })();
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [job, airportId, date]);

  const createManualJob = async (kind: ManualJobKind) => {
    try {
      setMessage('');
      const nextJob = (await apiFetch(`/api/v1/admin/airports/${airportId}/manual-jobs`, {
        method: 'POST',
        body: JSON.stringify({ kind, date }),
      })) as ManualJobRecord;
      setJob(nextJob);
      setJobTone('neutral');
      setJobMessage(nextJob.message || '任务已创建，等待执行');
    } catch (err) {
      setJobTone('error');
      setJobMessage(err instanceof Error ? err.message : '执行失败');
    }
  };

  const saveManualTotalScore = async () => {
    if (!dashboard) return;
    const trimmed = manualTotalScoreInput.trim();
    const parsed = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      setError('总分必须是 0 到 100 之间的数字');
      return;
    }

    setManualTotalScoreSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/v1/admin/airports/${airportId}/scores/${date}/manual-total-score`, {
        method: 'PATCH',
        body: JSON.stringify({ total_score: Math.round(parsed * 100) / 100 }),
      });
      setMessage('总分已保存为人工覆盖');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '总分保存失败');
    } finally {
      setManualTotalScoreSaving(false);
    }
  };

  const clearManualTotalScore = async () => {
    if (!dashboard) return;
    setManualTotalScoreSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/v1/admin/airports/${airportId}/scores/${date}/manual-total-score`, {
        method: 'PATCH',
        body: JSON.stringify({ total_score: null }),
      });
      setMessage('已恢复公式分');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '恢复公式分失败');
    } finally {
      setManualTotalScoreSaving(false);
    }
  };

  const moveDate = (offsetDays: number) => {
    setDate((current) => shiftDate(current, offsetDays));
  };

  const tabs = useMemo(() => [
    { key: 'base', label: '基础信息' },
    { key: 'stability', label: '稳定性数据（S）' },
    { key: 'performance', label: '性能数据（P）' },
    { key: 'risk', label: '风险数据（R）' },
    { key: 'time_decay', label: '时间维度（衰减）' },
  ] as const, []);

  const hasStabilityData = useMemo(() => {
    if (!dashboard) return false;
    const d = dashboard.stability;
    if ((d.latency_samples_ms || []).length > 0) return true;
    return [
      d.uptime_percent_today,
      d.uptime_percent_30d,
      d.latency_mean_ms,
      d.latency_std_ms,
      d.latency_cv,
      d.stable_days_streak,
      d.is_stable_day,
      d.s,
      d.uptime_score,
      d.stability_score,
      d.streak_score,
    ]
      .some((v) => v !== null && v !== undefined);
  }, [dashboard]);

  const hasPerformanceData = useMemo(() => {
    if (!dashboard) return false;
    const d = dashboard.performance;
    if (d.collect_status || d.error_code || d.error_message) return true;
    return [
      d.median_latency_ms,
      d.median_download_mbps,
      d.packet_loss_percent,
      d.p,
      d.latency_score,
      d.speed_score,
      d.loss_score,
    ].some((v) => v !== null && v !== undefined);
  }, [dashboard]);

  const hasRiskData = useMemo(() => {
    if (!dashboard) return false;
    const d = dashboard.risk;
    return [
      d.domain_ok,
      d.ssl_days_left,
      d.recent_complaints_count,
      d.history_incidents,
      d.domain_penalty,
      d.ssl_penalty,
      d.complaint_penalty,
      d.history_penalty,
      d.total_penalty,
      d.risk_penalty,
      d.r,
      d.risk_level,
    ]
      .some((v) => v !== null && v !== undefined);
  }, [dashboard]);

  const hasTimeDecayData = useMemo(() => {
    if (!dashboard) return false;
    const d = dashboard.time_decay;
    return [d.date, d.recent_score_cache, d.historical_score_cache, d.score, d.recent_score, d.historical_score, d.final_score]
      .some((v) => v !== null && v !== undefined);
  }, [dashboard]);
  const showStabilityContent = Boolean(
    dashboard && (hasStabilityData || dashboard.pipeline.stage === 'samples_pending_aggregation'),
  );

  const isTodayDate = date === today();
  const jobPending = job?.status === 'queued' || job?.status === 'running';
  const jobToneClass = jobTone === 'error'
    ? 'border border-rose-200 bg-rose-50 text-rose-700'
    : jobTone === 'success'
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border border-sky-200 bg-sky-50 text-sky-700';
  const currentTabAction = useMemo(() => {
    if (tab === 'base') {
      return {
        title: '手动重跑',
        description: isTodayDate
          ? '会顺序执行稳定性采集、性能采集、风险体检，再聚合并重算当前机场当日数据。'
          : '当前为历史日期，仅基于已有样本重新聚合并重算当前机场当日数据。',
        buttonLabel: '重跑当前机场当日全链路',
        kind: 'full' as const,
      };
    }
    if (tab === 'stability') {
      return {
        title: '稳定性手动执行',
        description: isTodayDate
          ? '立即重新采集稳定性样本，并在完成后聚合与重算当前机场。'
          : '当前为历史日期，不触发实时采集，仅重算已有稳定性相关数据。',
        buttonLabel: isTodayDate ? '重新采集并重算稳定性' : '重算已有稳定性数据',
        kind: 'stability' as const,
      };
    }
    if (tab === 'performance') {
      return {
        title: '性能手动执行',
        description: isTodayDate
          ? '立即重新拉取订阅并执行性能采样，随后聚合与重算当前机场。'
          : '当前为历史日期，不触发实时采集，仅重算已有性能相关数据。',
        buttonLabel: isTodayDate ? '重新采集并重算性能' : '重算已有性能数据',
        kind: 'performance' as const,
      };
    }
    if (tab === 'risk') {
      return {
        title: '风险手动执行',
        description: isTodayDate
          ? '立即重新检查官网可用性与 SSL 剩余天数，并重算当前机场风险分。'
          : '当前为历史日期，不触发实时体检，仅重算已有风险相关数据。',
        buttonLabel: isTodayDate ? '重新体检并重算风险' : '重算已有风险数据',
        kind: 'risk' as const,
      };
    }
    return {
      title: '时间维度手动执行',
      description: '仅重算当前机场在所选日期下的衰减分与榜单位置，不触发任何采集。',
      buttonLabel: '重算当前机场衰减分',
      kind: 'time_decay' as const,
    };
  }, [tab, isTodayDate]);
  const pipelineToneClass = dashboard?.pipeline.stage === 'ready'
    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
    : dashboard?.pipeline.stage === 'empty'
      ? 'border border-neutral-200 bg-neutral-50 text-neutral-600'
      : 'border border-amber-200 bg-amber-50 text-amber-700';
  const manualActionsDisabled = dashboard?.base.status === 'down';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <button className="px-3 py-1.5 rounded border text-sm inline-flex items-center gap-2" onClick={onBack}>
            <ArrowLeft size={14} />
            返回列表
          </button>
          <h2 className="text-lg font-bold">机场数据工作台 {dashboard?.base ? `- ${dashboard.base.name}` : `#${airportId}`}</h2>
        </div>
        <div className="flex items-center gap-2">
          <a
            className="px-3 py-1.5 rounded border text-sm inline-flex items-center gap-2 bg-white"
            href={`/reports/${airportId}?date=${date}`}
            target="_blank"
            rel="noreferrer"
          >
            用户端预览
          </a>
          <button
            type="button"
            className="px-2 py-1.5 rounded border text-sm inline-flex items-center gap-1"
            onClick={() => moveDate(-1)}
          >
            <ChevronLeft size={14} />
            前一天
          </button>
          <input type="date" className="border rounded px-2 py-1.5 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
          <button
            type="button"
            className="px-2 py-1.5 rounded border text-sm inline-flex items-center gap-1"
            onClick={() => moveDate(1)}
          >
            后一天
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {message && <div className="text-sm text-emerald-700">{message}</div>}
      {jobMessage && <div className={`rounded-2xl px-4 py-3 text-sm ${jobToneClass}`}>{jobMessage}</div>}
      {loading && <div className="text-sm text-neutral-500">加载中...</div>}
      {!isTodayDate && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          当前为历史日期。稳定性、性能和风险页的手动按钮会退化为仅重算已有数据，不会触发实时采集。
        </div>
      )}
      {dashboard?.pipeline.message ? (
        <div className={`rounded-2xl px-4 py-3 text-sm ${pipelineToneClass}`}>
          {dashboard.pipeline.message}
        </div>
      ) : null}
      {manualActionsDisabled && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          当前机场已被管理员标记为跑路，手动任务与实时体检入口已禁用。
        </div>
      )}

      <div className="flex gap-2 border-b pb-2">
        {tabs.map((t) => (
          <button key={t.key} className={`px-3 py-1.5 rounded text-sm ${tab === t.key ? 'bg-neutral-900 text-white' : 'bg-neutral-100'}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      <ManualJobActionCard
        title={currentTabAction.title}
        description={manualActionsDisabled ? '已跑路机场不允许再触发任何手动任务。' : currentTabAction.description}
        buttonLabel={currentTabAction.buttonLabel}
        disabled={jobPending || manualActionsDisabled}
        onRun={() => void createManualJob(currentTabAction.kind)}
      />

      {tab === 'base' && dashboard?.base && (
        <div className="space-y-4">
          <div className="rounded border border-neutral-200 bg-white p-4">
            <div className="text-sm font-semibold text-neutral-900">总分公式</div>
            <div className="mt-2 text-xs text-neutral-500 whitespace-pre-wrap">
              {'w = exp(-0.1 * days_diff)\n'}
              {'S = 时间衰减加权后的稳定性分\n'}
              {'P = 时间衰减加权后的性能分\n'}
              {'R = 时间衰减加权后的风险分\n'}
              {'C = clamp(100 - 月价, 0, 100)\n'}
              {'有效数据天数 = min(S序列天数, P序列天数)\n'}
              {'冷启动系数 = min(有效数据天数 / 7, 1)\n'}
              {'总分 = (0.4*S + 0.3*P + 0.2*R + 0.1*C) * 冷启动系数'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <ReadField label="名称" value={dashboard.base.name} />
            <ReadField label="官网" value={formatWebsiteList(dashboard.base.websites, dashboard.base.website)} />
            <ReadField label="状态" value={dashboard.base.status} />
            <ReadField label="月价" value={dashboard.base.plan_price_month} />
            <TotalScoreField
              value={manualTotalScoreInput}
              displayScore={dashboard.base.total_score ?? null}
              formulaScore={dashboard.base.formula_total_score ?? null}
              manualScore={dashboard.base.manual_total_score ?? null}
              source={dashboard.base.total_score_source ?? null}
              disabled={manualTotalScoreSaving || !dashboard.pipeline.has_score}
              saving={manualTotalScoreSaving}
              onChange={setManualTotalScoreInput}
              onSave={() => void saveManualTotalScore()}
              onClear={() => void clearManualTotalScore()}
            />
            <ReadField label="价格评分 (C)" value={valueOrDash(dashboard.base.price_score)} />
            <ReadField label="试用" value={dashboard.base.has_trial ? '是' : '否'} />
            <ReadField label="有效数据天数" value={valueOrDash(dashboard.base.score_data_days)} />
            <ReadField label="订阅链接" value={dashboard.base.subscription_url || '-'} />
            <ReadField label="标签" value={<TagBadgeGroup tags={dashboard.base.tags || []} size="sm" />} />
            <ReadField label="人工标签" value={<TagBadgeGroup tags={dashboard.base.manual_tags || []} size="sm" />} />
            <ReadField label="系统标签" value={<TagBadgeGroup tags={dashboard.base.auto_tags || []} size="sm" />} />
          </div>
        </div>
      )}

      {tab === 'stability' && (
        showStabilityContent && dashboard ? (
          <div className="space-y-4">
            {dashboard.pipeline.stage === 'samples_pending_aggregation' ? (
              <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                当日样本已经入库，但每日稳定性指标尚未生成；下面先展示最近采样时间线，聚合完成后卡片数值会自动恢复。
              </div>
            ) : null}
            <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-semibold text-neutral-900">稳定性判定</div>
              <div className="mt-1 text-xs text-neutral-500 whitespace-pre-wrap">
                {'三档规则：`stable = uptime >= 99% 且 effective_latency_cv <= 0.20`；`minor_fluctuation = uptime >= 95% 且 effective_latency_cv <= 0.35`；其余为 `volatile`。\n'}
                {'首页健康记录会累计 stable + minor_fluctuation；严格稳定记录只累计 stable。原始 `latency_cv` 仅用于诊断，判定仍使用去极值后的 effective_latency_cv。'}
              </div>
            </div>

            {hasStabilityData ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <ReadField label="今日可用率 (uptime_percent_today)" value={valueOrDash(dashboard.stability.uptime_percent_today)} />
                <ReadField label="30天可用率 (uptime_percent_30d)" value={valueOrDash(dashboard.stability.uptime_percent_30d)} />
                <ReadField label="延迟均值ms (latency_mean_ms)" value={valueOrDash(dashboard.stability.latency_mean_ms)} />
                <ReadField label="延迟标准差ms (latency_std_ms)" value={valueOrDash(dashboard.stability.latency_std_ms)} />
                <ReadField label="延迟CV-原始 (latency_cv)" value={valueOrDash(dashboard.stability.latency_cv)} />
                <ReadField label="延迟CV-判定 (effective_latency_cv)" value={valueOrDash(dashboard.stability.effective_latency_cv)} />
                <ReadField label="稳定性分档 (stability_tier)" value={dashboard.stability.stability_tier || '-'} />
                <ReadField label="是否稳定日 (is_stable_day)" value={dashboard.stability.is_stable_day === null ? '-' : dashboard.stability.is_stable_day ? '是' : '否'} />
                <ReadField label="连续稳定天数 (stable_days_streak)" value={valueOrDash(dashboard.stability.stable_days_streak)} />
                <ReadField label="连续健康天数 (healthy_days_streak)" value={valueOrDash(dashboard.stability.healthy_days_streak)} />
                <ReadField label="延迟采样ms (latency_samples_ms)" value={valueOrDash((dashboard.stability.latency_samples_ms || []).join(', ') || '-')} />
                <ReadField label="规则版本 (stability_rule_version)" value={dashboard.stability.stability_rule_version || '-'} />
              </div>
            ) : null}

            <div className="rounded border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">评分公式</div>
              <div className="mt-2 text-xs text-neutral-500 whitespace-pre-wrap">
                {'UptimeScore = clamp((Uptime% - 95) * 20, 0, 100)\n'}
                {'StabilityScore = clamp(100 - effective_latency_cv * 100, 0, 100)\n'}
                {'StreakScore = min(healthy_days_streak / 30 * 100, 100)\n'}
                {'S = 0.5 * UptimeScore + 0.3 * StabilityScore + 0.2 * StreakScore'}
              </div>
            </div>

            {hasStabilityData ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <ReadField label="可用率评分 (uptime_score)" value={valueOrDash(dashboard.stability.uptime_score)} />
                <ReadField label="稳定评分 (stability_score)" value={valueOrDash(dashboard.stability.stability_score)} />
                <ReadField label="连稳评分 (streak_score)" value={valueOrDash(dashboard.stability.streak_score)} />
                <ReadField label="稳定性总分 (S)" value={valueOrDash(dashboard.stability.s)} />
              </div>
            ) : null}

            <div className="rounded border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-neutral-900">最近 20 次稳定性采样时间线</div>
                  <div className="mt-1 text-xs text-neutral-500">展示最近的 availability / latency 样本，便于核对 cron 上报与日内波动。</div>
                </div>
                <button
                  type="button"
                  className="rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700"
                  onClick={() => void loadSamplesOnly()}
                >
                  刷新采样
                </button>
              </div>
              {samplesError && <div className="mt-3 text-xs text-rose-600">{samplesError}</div>}
              {recentStabilitySamples.length === 0 ? (
                <div className="mt-3 text-sm text-neutral-500">暂无采样记录</div>
              ) : (
                <div className="mt-4 space-y-2">
                  {recentStabilitySamples.map((sample) => (
                    <div key={sample.id} className="flex items-center justify-between gap-4 rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-900">{formatProbeSampleLabel(sample)}</div>
                        <div className="mt-1 text-xs text-neutral-500">
                          {formatSampleTime(sample.sampled_at)}
                          {' · '}
                          {sample.source || '-'}
                        </div>
                      </div>
                      <div className="shrink-0 font-mono text-xs text-neutral-700">
                        {formatProbeSampleValue(sample)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : <div className="text-sm text-neutral-500">当日暂无数据</div>
      )}

      {tab === 'performance' && (
        hasPerformanceData && dashboard ? (
          <div className="space-y-4">
            <div className="rounded border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">评分公式</div>
              <div className="mt-2 text-xs text-neutral-500 whitespace-pre-wrap">
                {'median_latency_ms 使用“节点建连延迟”，不是代理后访问第三方网页的完整耗时。\n'}
                {'median_download_mbps 使用多连接并发下载测速，比单连接更接近 Speedtest。\n'}
                {'LatencyScore = clamp((600 - median_latency_ms) / (600 - 60) * 100, 0, 100)\n'}
                {'SpeedScore = clamp((median_download_mbps - 10) / (300 - 10) * 100, 0, 100)\n'}
                {'LossScore = clamp((5 - packet_loss_percent) / (5 - 0) * 100, 0, 100)\n'}
                {'P = 0.4 * LatencyScore + 0.4 * SpeedScore + 0.2 * LossScore'}
              </div>
            </div>

            <div className="rounded border border-neutral-200 bg-neutral-50 p-4">
              <div className="text-sm font-semibold text-neutral-900">最近一次性能采集</div>
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <ReadField label="采集状态" value={valueOrDash(dashboard.performance.collect_status)} />
              <ReadField label="数据来源" value={valueOrDash(dashboard.performance.data_source_mode)} />
              <ReadField label="缓存来源日期" value={valueOrDash(dashboard.performance.cache_source_date)} />
              <ReadField label="最近采集时间" value={formatDateTimeInBeijing(dashboard.performance.last_sampled_at)} />
              <ReadField label="来源" value={valueOrDash(dashboard.performance.last_source)} />
              <ReadField label="订阅格式" value={valueOrDash(dashboard.performance.subscription_format)} />
              <ReadField label="延迟口径" value={valueOrDash(dashboard.performance.latency_measurement)} />
              <ReadField label="延迟探测目标" value={valueOrDash(dashboard.performance.latency_probe_target)} />
              <ReadField label="测速口径" value={valueOrDash(dashboard.performance.speed_measurement)} />
              <ReadField label="测速并发连接数" value={valueOrDash(dashboard.performance.speed_test_connections)} />
                <ReadField label="解析节点数" value={valueOrDash(dashboard.performance.parsed_nodes_count)} />
                <ReadField label="可用节点数" value={valueOrDash(dashboard.performance.supported_nodes_count)} />
                <ReadField label="实测节点数" value={valueOrDash(dashboard.performance.tested_nodes_count)} />
                <ReadField
                  label="已选节点"
                  value={valueOrDash(
                    (dashboard.performance.selected_nodes || []).map((node) => node.name).join(', ') || '-',
                  )}
                />
                <ReadField label="错误码" value={valueOrDash(dashboard.performance.error_code)} />
                <ReadField label="错误摘要" value={valueOrDash(dashboard.performance.error_message)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <ReadField label="节点建连延迟中位数 (median_latency_ms)" value={valueOrDash(dashboard.performance.median_latency_ms)} />
              <ReadField label="代理HTTP延迟中位数（诊断）" value={valueOrDash(dashboard.performance.proxy_http_median_latency_ms)} />
              <ReadField label="代理HTTP探测URL（诊断）" value={valueOrDash(dashboard.performance.proxy_http_test_url)} />
              <ReadField label="下载中位数 (median_download_mbps)" value={valueOrDash(dashboard.performance.median_download_mbps)} />
              <ReadField label="丢包率 (packet_loss_percent)" value={valueOrDash(dashboard.performance.packet_loss_percent)} />
              <ReadField label="性能总分 (P)" value={valueOrDash(dashboard.performance.p)} />
              <ReadField label="延迟评分 (latency_score)" value={valueOrDash(dashboard.performance.latency_score)} />
              <ReadField label="下载评分 (speed_score)" value={valueOrDash(dashboard.performance.speed_score)} />
              <ReadField label="丢包评分 (loss_score)" value={valueOrDash(dashboard.performance.loss_score)} />
            </div>

            {(dashboard.performance.tested_nodes || []).length > 0 ? (
              <div className="rounded border border-neutral-200 bg-white p-4">
                <div className="text-sm font-semibold text-neutral-900">节点明细</div>
                <div className="mt-4 space-y-3">
                  {dashboard.performance.tested_nodes.map((node) => (
                    <div key={node.name} className="rounded border border-neutral-200 bg-neutral-50 p-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <ReadField label="节点" value={valueOrDash(node.name)} />
                        <ReadField label="区域" value={valueOrDash(node.region)} />
                        <ReadField label="类型" value={valueOrDash(node.type)} />
                        <ReadField label="状态" value={valueOrDash(node.status)} />
                        <ReadField label="建连延迟中位数" value={valueOrDash(node.connect_latency_median_ms)} />
                        <ReadField label="下载速度" value={valueOrDash(node.download_mbps)} />
                        <ReadField label="代理HTTP延迟中位数" value={valueOrDash(node.proxy_http_latency_median_ms)} />
                        <ReadField label="错误码" value={valueOrDash(node.error_code)} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

          </div>
        ) : <div className="text-sm text-neutral-500">当日暂无数据</div>
      )}

      {tab === 'risk' && (
        hasRiskData && dashboard ? (
          <div className="space-y-4">
            <div className="rounded border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">评分公式</div>
              <div className="mt-2 text-xs text-neutral-500 whitespace-pre-wrap">
                {'DomainPenalty = domain_ok ? 0 : 30\n'}
                {'SslPenalty = ssl_days_left 为 null 时记 5；< 0 记 30；< 7 记 20；< 15 记 10；< 30 记 5；其余记 0\n'}
                {'ComplaintPenalty = min(recent_complaints_count * 3, 15)\n'}
                {'HistoryPenalty = min(history_incidents * 10, 30)\n'}
                {'RiskPenalty = DomainPenalty + SslPenalty + ComplaintPenalty + HistoryPenalty\n'}
                {'R = clamp(100 - RiskPenalty, 0, 100)'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <ReadField label="域名是否正常 (domain_ok)" value={valueOrDash(dashboard.risk.domain_ok)} />
              <ReadField label="SSL剩余天数 (ssl_days_left)" value={valueOrDash(dashboard.risk.ssl_days_left)} />
              <ReadField label="投诉数量 (recent_complaints_count)" value={valueOrDash(dashboard.risk.recent_complaints_count)} />
              <ReadField label="历史异常 (history_incidents)" value={valueOrDash(dashboard.risk.history_incidents)} />
              <ReadField label="域名惩罚 (domain_penalty)" value={valueOrDash(dashboard.risk.domain_penalty)} />
              <ReadField label="SSL惩罚 (ssl_penalty)" value={valueOrDash(dashboard.risk.ssl_penalty)} />
              <ReadField label="投诉惩罚 (complaint_penalty)" value={valueOrDash(dashboard.risk.complaint_penalty)} />
              <ReadField label="历史惩罚 (history_penalty)" value={valueOrDash(dashboard.risk.history_penalty)} />
              <ReadField label="总惩罚 (total_penalty)" value={valueOrDash(dashboard.risk.total_penalty)} />
              <ReadField label="风险惩罚 (risk_penalty)" value={valueOrDash(dashboard.risk.risk_penalty)} />
              <ReadField label="风险评分 (R)" value={valueOrDash(dashboard.risk.r)} />
              <ReadField label="风险等级 (risk_level)" value={valueOrDash(dashboard.risk.risk_level)} />
            </div>

          </div>
        ) : <div className="text-sm text-neutral-500">当日暂无数据</div>
      )}

      {tab === 'time_decay' && (
        hasTimeDecayData && dashboard ? (
          <div className="space-y-4">
            <div className="rounded border border-neutral-200 bg-white p-4">
              <div className="text-sm font-semibold text-neutral-900">评分公式</div>
              <div className="mt-2 text-xs text-neutral-500 whitespace-pre-wrap">
                {'w = exp(-lambda * days_diff)\n'}
                {'lambda = 0.1\n'}
                {'HistoricalScore = Σ(score_i * w_i) / Σ(w_i)，仅统计当前日期之前的每日 score\n'}
                {'FinalScore = Σ(score_i * w_i) / Σ(w_i)，统计历史序列 + 当日 score\n'}
                {'days_diff = 当前日期 - 样本日期（按天）'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <ReadField label="日期 (date)" value={valueOrDash(dashboard.time_decay.date || dashboard.date)} />
              <ReadField label="原始综合分 (score)" value={valueOrDash(dashboard.time_decay.score)} />
              <ReadField label="近期评分缓存 (recent_score_cache)" value={valueOrDash(dashboard.time_decay.recent_score_cache)} />
              <ReadField label="历史评分缓存 (historical_score_cache)" value={valueOrDash(dashboard.time_decay.historical_score_cache)} />
              <ReadField label="近期评分 (recent_score)" value={valueOrDash(dashboard.time_decay.recent_score)} />
              <ReadField label="历史衰减评分 (historical_score)" value={valueOrDash(dashboard.time_decay.historical_score)} />
              <ReadField label="最终衰减评分 (final_score)" value={valueOrDash(dashboard.time_decay.final_score)} />
            </div>

          </div>
        ) : <div className="text-sm text-neutral-500">当日暂无数据</div>
      )}
    </div>
  );
}

function ManualJobActionCard({
  title,
  description,
  buttonLabel,
  disabled,
  onRun,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  disabled: boolean;
  onRun: () => void;
}) {
  return (
    <div className="rounded border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="text-sm font-semibold text-neutral-900">{title}</div>
          <div className="text-xs leading-6 text-neutral-500">{description}</div>
        </div>
        <button
          type="button"
          className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={disabled}
          onClick={onRun}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function TotalScoreField({
  value,
  displayScore,
  formulaScore,
  manualScore,
  source,
  disabled,
  saving,
  onChange,
  onSave,
  onClear,
}: {
  value: string;
  displayScore: number | null;
  formulaScore: number | null;
  manualScore: number | null;
  source: 'manual' | 'formula' | null;
  disabled: boolean;
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const hasManualScore = manualScore !== null && manualScore !== undefined;

  return (
    <div className="border rounded p-3 bg-neutral-50">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-neutral-500">总分</div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${source === 'manual' ? 'bg-amber-100 text-amber-700' : 'bg-neutral-200 text-neutral-600'}`}>
          {source === 'manual' ? '人工覆盖' : source === 'formula' ? '公式分' : '无评分'}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          className="min-w-0 flex-1 rounded border border-neutral-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-neutral-900 disabled:bg-neutral-100"
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50"
          disabled={disabled}
          onClick={onSave}
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
      <div className="mt-2 space-y-1 text-xs text-neutral-500">
        <div>当前展示：{valueOrDash(displayScore)}</div>
        <div>公式分：{valueOrDash(formulaScore)}</div>
      </div>
      {hasManualScore && (
        <button
          type="button"
          className="mt-3 rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 disabled:opacity-50"
          disabled={saving}
          onClick={onClear}
        >
          恢复公式分
        </button>
      )}
      {source === null && (
        <div className="mt-2 text-xs text-amber-700">当前日期没有评分记录，暂不能修改总分。</div>
      )}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border rounded p-3 bg-neutral-50">
      <div className="text-xs text-neutral-500">{label}</div>
      {typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? (
        <div className="mt-1 whitespace-pre-wrap break-all font-mono text-sm">{String(value)}</div>
      ) : (
        <div className="mt-2">{value}</div>
      )}
    </div>
  );
}

function FormField({
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

function createPublishTokenForm(): PublishTokenCreateFormState {
  return {
    name: '',
    description: '',
    expires_at: '',
    scopes: [...DEFAULT_PUBLISH_TOKEN_SCOPES],
  };
}

function getDisplayApiBase(): string {
  const fromEnv = getApiBase();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }
  return window.location.origin.replace(/\/+$/, '');
}

function formatPublishScopeLabel(scope: PublishTokenScope): string {
  return PUBLISH_TOKEN_SCOPES.find((item) => item.value === scope)?.label || scope;
}

function formatScopeSummary(scopes: PublishTokenScope[]): string {
  if (scopes.length === 0) {
    return '-';
  }
  return scopes.map((scope) => formatPublishScopeLabel(scope)).join(' / ');
}

function formatSchedulerTaskLabel(taskKey: SchedulerTaskKey): string {
  if (taskKey === 'stability') return '稳定性采集';
  if (taskKey === 'performance') return '性能采集';
  if (taskKey === 'risk') return '风险体检';
  return '聚合重算';
}

function formatSchedulerRunStatus(status: SchedulerRunStatus): string {
  if (status === 'running') return '运行中';
  if (status === 'succeeded') return '成功';
  return '失败';
}

function formatSchedulerTrigger(trigger: SchedulerTriggerSource): string {
  if (trigger === 'schedule') return '定时触发';
  if (trigger === 'restart') return '重启触发';
  return '启动恢复';
}

function formatDateTimeLabel(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  const label = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
  return `${label} UTC+08:00`;
}

function formatDuration(value: number | null | undefined): string {
  if (!value || value <= 0) {
    return '-';
  }
  if (value < 1000) {
    return `${value} ms`;
  }
  if (value < 60_000) {
    return `${(value / 1000).toFixed(1)} s`;
  }
  return `${(value / 60_000).toFixed(1)} min`;
}

function valueOrDash(value: string | number | boolean | null | undefined): string | number {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return value;
}

function formatMoneyOrDash(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return '-';
  }
  return `¥${Number(value).toFixed(2)}`;
}

function today(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function shiftDate(dateString: string, offsetDays: number): string {
  if (!dateString) return dateString;
  const [year, month, day] = dateString.split('-').map((part) => Number(part));
  if (!year || !month || !day) return dateString;
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

function getMarketingPresetDateFrom(preset: MarketingRangePreset, dateTo: string): string {
  if (preset === 'day') {
    return dateTo;
  }
  if (preset === 'week') {
    return shiftDate(dateTo, -6);
  }
  return shiftDate(dateTo, -29);
}

function createAirportForm(): AirportFormState {
  return {
    name: '',
    websites: [''],
    status: 'normal',
    is_listed: true,
    plan_price_month: '',
    has_trial: false,
    subscription_url: '',
    applicant_email: '',
    applicant_telegram: '',
    founded_on: '',
    airport_intro: '',
    test_account: '',
    test_password: '',
    manual_tags: [],
    wallet_id: null,
    wallet_balance: null,
  };
}

function toAirportForm(airport: Airport): AirportFormState {
  return {
    id: airport.id,
    name: airport.name,
    websites: normalizeUrlList(airport.websites?.length ? airport.websites : [airport.website]),
    status: airport.status,
    is_listed: airport.is_listed,
    plan_price_month: String(airport.plan_price_month ?? ''),
    has_trial: airport.has_trial,
    subscription_url: airport.subscription_url || '',
    applicant_email: airport.applicant_email || '',
    applicant_telegram: airport.applicant_telegram || '',
    founded_on: airport.founded_on || '',
    airport_intro: airport.airport_intro || '',
    test_account: airport.test_account || '',
    test_password: airport.test_password || '',
    manual_tags: airport.manual_tags || airport.tags || [],
    wallet_id: airport.wallet_id ?? null,
    wallet_balance: airport.wallet_balance ?? null,
  };
}

function hasAirportWebsite(airport: Airport): boolean {
  return normalizeUrlList([...(airport.websites || []), airport.website || '']).length > 0;
}

function parseTagInput(value: string): string[] {
  return [...new Set(
    value
      .split(/[\n,，、\s]+/g)
      .map((item) => item.trim())
      .filter(Boolean),
  )];
}

function formatTagInput(tags: string[]): string {
  return tags.join(', ');
}

function normalizeUrlList(values: string[]): string[] {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  return unique;
}

function updateListItem(values: string[], index: number, nextValue: string): string[] {
  return values.map((value, currentIndex) => (currentIndex === index ? nextValue : value));
}

function removeListItem(values: string[], index: number): string[] {
  const nextValues = values.filter((_, currentIndex) => currentIndex !== index);
  return nextValues.length > 0 ? nextValues : [''];
}

function formatWebsiteList(websites?: string[], primaryWebsite?: string): string {
  const all = normalizeUrlList([...(websites || []), primaryWebsite || '']);
  return all.length > 0 ? all.join('\n') : '-';
}

function formatAirportStatus(status: AirportStatus): string {
  if (status === 'normal') {
    return '正常';
  }
  if (status === 'risk') {
    return '风险';
  }
  return '跑路';
}

function formatAirportListedStatus(isListed: boolean): string {
  return isListed ? '上架' : '下架';
}

function formatApplicationReviewStatus(status: AirportApplicationReviewStatus): string {
  if (status === 'awaiting_payment') {
    return '待支付';
  }
  if (status === 'pending') {
    return '待审核';
  }
  if (status === 'reviewed') {
    return '已审核';
  }
  return '已驳回';
}

function formatProbeSampleLabel(sample: ProbeSample): string {
  if (sample.sample_type === 'availability') {
    return '官网可用性';
  }
  if (sample.sample_type === 'latency') {
    return 'TCP 延迟';
  }
  return '下载测速';
}

function formatProbeSampleValue(sample: ProbeSample): string {
  if (sample.sample_type === 'availability') {
    return sample.availability ? '可用' : '不可用';
  }
  if (sample.sample_type === 'latency') {
    return sample.latency_ms === null ? '-' : `${sample.latency_ms} ms`;
  }
  return sample.download_mbps === null ? '-' : `${sample.download_mbps} Mbps`;
}

function formatSampleTime(value: string): string {
  return formatDateTimeInBeijing(value);
}

function formatDateTimeInBeijing(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }
  const trimmed = value.trim();
  const sqlDateTimeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  const dateOnlyMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  const normalizedValue = sqlDateTimeMatch
    ? `${sqlDateTimeMatch[1]}T${sqlDateTimeMatch[2]}+08:00`
    : dateOnlyMatch
      ? `${dateOnlyMatch[1]}T00:00:00+08:00`
      : trimmed;
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Asia/Shanghai',
  });
}

function formatCountValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatRatioValue(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }
  return `${(value * 100).toFixed(2)}%`;
}

function formatGranularityLabel(value: MarketingGranularity): string {
  if (value === 'hour') {
    return '按小时';
  }
  if (value === 'week') {
    return '按周';
  }
  if (value === 'month') {
    return '按月';
  }
  return '按天';
}

function formatMarketingPeriodLabel(
  value: string,
  granularity: MarketingGranularity,
  dateFrom: string,
  dateTo: string,
): string {
  if (granularity === 'hour') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/);
    if (match) {
      return dateFrom === dateTo ? match[2] : `${match[1]} ${match[2]}`;
    }
  }
  return value;
}

function formatMarketingPageKind(value: MarketingPageKind): string {
  if (value === 'home') return '首页';
  if (value === 'full_ranking') return '全量榜单';
  if (value === 'risk_monitor') return '风险监测';
  if (value === 'report') return '机场报告';
  if (value === 'methodology') return '测评方法';
  if (value === 'news') return 'News';
  if (value === 'apply') return '申请页';
  return '发布文档';
}

function formatMarketingPlacement(value: MarketingPlacement | null): string {
  if (value === 'home_card') return '首页卡片';
  if (value === 'full_ranking_item') return '全量榜单条目';
  if (value === 'risk_monitor_item') return '风险榜条目';
  if (value === 'report_header') return '报告头部';
  return '-';
}

function formatMarketingTargetKind(value: MarketingTargetKind | null): string {
  if (value === 'website') return '官网';
  if (value === 'subscription_url') return '订阅链接';
  return '-';
}
