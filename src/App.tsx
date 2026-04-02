import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  Flame,
  Trophy,
  Banknote,
  Plus,
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
} from 'lucide-react';
import { motion } from 'motion/react';

import { TagBadge, TagBadgeGroup } from './components/TagBadge';
import {
  buildAbsoluteUrl,
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
import { trackPageView } from './site/analytics';
import { PUBLIC_SITE_BRAND_NAME } from '../shared/publicBrand';

const LazyMethodologyPage = lazy(async () => {
  const module = await import('./pages/methodology/MethodologyPage');
  return { default: module.MethodologyPage };
});

const LazyPublishTokenDocsPage = lazy(async () => {
  const module = await import('./pages/publishTokenDocs/PublishTokenDocsPage');
  return { default: module.PublishTokenDocsPage };
});

type CardType = 'stable' | 'value' | 'risk' | 'new';
type HomeSectionKey = 'today_pick' | 'most_stable' | 'best_value' | 'new_entries' | 'risk_alerts';

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
  score: number;
  score_delta_vs_yesterday: ScoreDeltaView;
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
  score_delta_vs_yesterday: ScoreDeltaView;
  score_date?: string | null;
  report_url?: string | null;
}

interface FullRankingPageResponse {
  date: string;
  generated_at: string;
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: FullRankingItemResponse[];
}

interface RiskMonitorItemResponse extends FullRankingItemResponse {
  monitor_reason: 'down' | 'risk_watch';
  risk_penalty: number | null;
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
    name: string;
    website: string;
    status: AirportStatus;
    tags: string[];
  };
  summary_card: {
    type: CardType;
    name: string;
    tags: string[];
    score: number;
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
    final_score: number;
    risk_penalty: number;
  };
  metrics: {
    uptime_percent_30d: number;
    median_latency_ms: number;
    median_download_mbps: number;
    packet_loss_percent: number;
    stable_days_streak: number;
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

interface CardProps {
  type: CardType;
  title?: string;
  name: string;
  website?: string;
  tags: string[];
  score: number;
  scoreDeltaVsYesterday?: ScoreDeltaView;
  details: CardDetail[];
  conclusion: string;
  icon?: React.ReactNode;
  onOpen?: () => void;
}

interface RouteState {
  kind: 'home' | 'report' | 'apply' | 'full_ranking' | 'risk_monitor' | 'methodology' | 'publish_token_docs';
  airportId?: number;
  date?: string;
  page?: number;
}

type AirportStatus = 'normal' | 'risk' | 'down';

interface ApplicationFormState {
  name: string;
  websites: string[];
  plan_price_month: string;
  has_trial: boolean;
  subscription_url: string;
  applicant_email: string;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
}

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
  'most_stable',
  'best_value',
  'new_entries',
  'risk_alerts',
];

function shouldRenderSection(sectionKey: HomeSectionKey, section: HomeSection): boolean {
  if (sectionKey === 'risk_alerts') {
    return section.items.length > 0;
  }
  return true;
}

function formatAirportStatus(status: AirportStatus): string {
  switch (status) {
    case 'normal':
      return '正常';
    case 'risk':
      return '风险';
    case 'down':
      return '跑路';
    default:
      return status;
  }
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
    return '待评分';
  }
  return formatMetric(value);
}

function formatScoreFixed2(value: number): string {
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

const ConclusionCard = ({
  type,
  title,
  name,
  website,
  tags,
  score,
  scoreDeltaVsYesterday,
  details,
  conclusion,
  icon,
  onOpen,
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`p-6 md:p-6 rounded-xl border ${styles[type]} transition-all hover:translate-y-[-2px] hover:shadow-xl group h-full flex flex-col relative overflow-hidden`}
    >
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '10px 10px' }}
      />

      <div className="flex items-start justify-between gap-4 mb-5 relative z-10">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="p-2 rounded-lg bg-neutral-900 text-white">
              {React.cloneElement(icon as React.ReactElement, { size: 18 })}
            </div>
          )}
          {title && <h3 className="text-xs md:text-sm font-black uppercase tracking-[0.2em] text-neutral-400">{title}</h3>}
        </div>
      </div>

      <div className="mb-5 relative z-10">
        <div className="flex items-start justify-between gap-4">
          <span className="font-black text-lg md:text-xl tracking-tight text-neutral-900 leading-tight pr-2">{name}</span>
          <div className="shrink-0 text-right">
            <div className="text-[10px] md:text-[11px] text-neutral-400 uppercase tracking-[0.16em] font-black mb-1">可靠性评分</div>
            <div className={`text-3xl font-black font-mono leading-none ${scoreColors[type]}`}>{formatScoreFixed2(score)}</div>
            {scoreDeltaVsYesterday && (
              <>
                <div className="mt-2 text-[10px] md:text-[11px] text-neutral-400 font-black tracking-[0.08em]">
                  {scoreDeltaVsYesterday.label}
                </div>
                <div className={`mt-1 text-sm md:text-[15px] font-black font-mono ${getScoreDeltaTone(scoreDeltaVsYesterday.value)}`}>
                  {formatScoreDelta(scoreDeltaVsYesterday.value)}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
        {details.map((detail, idx) => (
          <div key={`${detail.label}-${idx}`} className="bg-neutral-50 p-4 rounded-lg border border-neutral-100">
            <div className="text-[11px] md:text-xs text-neutral-400 font-black uppercase tracking-[0.16em] mb-1">{detail.label}</div>
            <div className="text-[15px] md:text-base font-black font-mono text-neutral-800">{detail.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 relative z-10">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-1 h-3 bg-neutral-900" />
          <div className="text-[11px] md:text-xs text-neutral-900 uppercase tracking-[0.18em] font-black">监测结论</div>
        </div>
        <p className="text-[13px] md:text-sm font-medium leading-6 text-neutral-600 line-clamp-3 pl-4 border-l border-neutral-200">{conclusion}</p>
      </div>

      <button
        type="button"
        className="w-full min-h-11 px-4 py-3 rounded-lg bg-neutral-900 text-white text-[11px] md:text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2.5 hover:bg-neutral-800 transition-colors mt-auto relative z-10"
        onClick={onOpen}
      >
        查看完整报告
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noreferrer"
          className="w-full min-h-11 mt-3 px-4 py-3 rounded-lg border border-neutral-200 bg-white text-neutral-700 text-[11px] md:text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2.5 hover:border-neutral-900 hover:text-neutral-900 transition-colors relative z-10"
        >
          打开官网
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </motion.div>
  );
};

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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 mb-10">
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

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBase()}${path}`);
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
  const response = await fetch(`${getApiBase()}${path}`, { ...init, headers });
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

function parseRoute(): RouteState {
  const path = window.location.pathname;
  const reportMatch = path.match(/^\/reports\/(\d+)$/);
  const fullRankingMatch = path.match(/^\/rankings\/all\/?$/);
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

  if (path === '/apply') {
    return {
      kind: 'apply',
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

  if (fullRankingMatch) {
    const page = Number(params.get('page') || '1');
    return {
      kind: 'full_ranking',
      date: params.get('date') || undefined,
      page: Number.isFinite(page) && page > 0 ? page : 1,
    };
  }

  if (riskMonitorMatch) {
    const page = Number(params.get('page') || '1');
    return {
      kind: 'risk_monitor',
      date: params.get('date') || undefined,
      page: Number.isFinite(page) && page > 0 ? page : 1,
    };
  }

  return {
    kind: 'home',
    date: params.get('date') || undefined,
  };
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

function buildPageWindow(currentPage: number, totalPages: number): number[] {
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, currentPage + 2);
  const pages: number[] = [];
  for (let page = start; page <= end; page += 1) {
    pages.push(page);
  }
  return pages;
}

function StatusPill({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-4">
      <div className="text-[11px] md:text-xs text-neutral-400 font-black uppercase tracking-[0.18em] mb-2">{label}</div>
      <div className="text-base md:text-lg font-black text-neutral-900">{value ?? '-'}</div>
    </div>
  );
}

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

function HomePage({ date }: { date?: string }) {
  const [data, setData] = useState<HomePageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportTimeNow, setReportTimeNow] = useState(() => Date.now());

  useEffect(() => {
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
  }, [date]);

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
  const homepageTitle = `${PUBLIC_SITE_BRAND_NAME} | 机场 VPN 推荐、科学上网机场测评与可靠性榜单`;
  const homepageDescription = data
    ? `${homeDate} 机场 VPN 榜单已更新，当前监测 ${formatNumber(data.hero.monitored_airports)} 个机场、累计实时测速 ${formatNumber(data.hero.realtime_tests)} 次，覆盖今日推荐、长期稳定、性价比、新入榜与风险预警，适合查找 VPN、科学上网、魔法与梯子相关机场参考。`
    : `${PUBLIC_SITE_BRAND_NAME} 提供今日推荐、长期稳定、性价比与风险预警等多维机场 VPN 榜单，帮助用户快速筛选值得关注的 VPN、科学上网、魔法和梯子测评报告。`;
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
    keywords: `机场榜GateRank,机场榜,机场推荐,机场VPN,VPN,科学上网,魔法,梯子,今日推荐机场,机场测评,稳定机场,风险预警,GateRank`,
    canonicalPath: buildHomeHref(date),
    structuredData: homepageStructuredData,
  });

  return (
    <PageFrame active="home">
      <header className="max-w-7xl mx-auto px-4 pt-10 md:pt-14 pb-10 md:pb-12 text-center">
        <h1 className="text-[34px] md:text-5xl lg:text-[56px] font-black tracking-tight mb-4 leading-[0.95] text-neutral-900">
          {homeDate} 机场 VPN 推荐与<span className="text-neutral-400">可靠性榜单</span>
        </h1>
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-3 md:gap-6 text-neutral-500 mb-6">
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
        <div className="flex justify-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {data?.resolved_from_fallback && data.fallback_notice ? (
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[11px] md:text-xs font-black tracking-[0.12em] text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                {data.fallback_notice}
              </div>
            ) : null}
            <a
              href={buildMethodologyHref()}
              onClick={(event) => {
                event.preventDefault();
                navigate(buildMethodologyHref());
              }}
              className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-[11px] md:text-xs font-black uppercase tracking-[0.18em] text-neutral-600 transition-colors hover:border-neutral-900 hover:text-neutral-900"
            >
              查看测评方法
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 space-y-16 flex-grow">
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
                      <ConclusionCard
                        type={item.type}
                        name={item.name}
                        website={item.website}
                        tags={item.tags}
                        score={item.score}
                        scoreDeltaVsYesterday={item.score_delta_vs_yesterday}
                        details={item.details}
                        conclusion={item.conclusion}
                        onOpen={() => navigate(item.report_url)}
                      />
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

function FullRankingPage({ date, page = 1 }: { date?: string; page?: number }) {
  const [data, setData] = useState<FullRankingPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    const query = buildQuery({
      date,
      page: page > 1 ? page : undefined,
    });

    void apiFetch<FullRankingPageResponse>(`/api/v1/pages/full-ranking${query}`)
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
  }, [date, page]);

  const rankingDate = data?.date || date || '今日';
  const safePage = data?.page || page || 1;
  const totalPages = data?.total_pages || 1;
  const visiblePages = buildPageWindow(safePage, totalPages);
  const seoTitle = `${rankingDate} 全量机场榜单 | 全部已上线机场评分排名 | ${PUBLIC_SITE_BRAND_NAME}`;
  const seoDescription = data
    ? `${rankingDate} 全量榜单收录 ${formatNumber(data.total)} 个已上线机场，按公开展示分数降序排列，支持分页查看官网、状态、标签、成立日期、月付价格、试用支持与测评报告。`
    : `${PUBLIC_SITE_BRAND_NAME} 全量榜单按公开展示分数降序展示全部已上线机场，包含官网、状态、标签、月付价格、试用支持和测评报告入口。`;
  const seoStructuredData = useMemo(
    () => ([
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: seoTitle,
        description: seoDescription,
        url: buildAbsoluteUrl(buildFullRankingHref(date, safePage)),
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
            item: buildAbsoluteUrl(buildFullRankingHref(date, safePage)),
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
    [data, date, safePage, seoDescription, seoTitle],
  );

  usePageSeo({
    title: seoTitle,
    description: seoDescription,
    keywords: '机场榜GateRank,全量榜单,机场排名,机场推荐,机场测评,机场官网,风险机场,GateRank',
    canonicalPath: buildFullRankingHref(date, safePage),
    structuredData: seoStructuredData,
  });

  return (
    <PageFrame active="full_ranking">
      <main className="max-w-7xl mx-auto px-4 pt-10 md:pt-14 pb-10">
        <section className="relative overflow-hidden rounded-[32px] border border-neutral-200 bg-[linear-gradient(135deg,#111827_0%,#0f172a_38%,#f8fafc_100%)] px-6 py-8 md:px-10 md:py-12 text-white shadow-[0_30px_80px_rgba(15,23,42,0.16)]">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(255,255,255,0.28), transparent 35%)' }} />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/80 backdrop-blur">
                全量榜单
              </div>
              <h1 className="mt-5 max-w-4xl text-3xl md:text-5xl lg:text-[56px] font-black leading-[0.95] tracking-tight">
                {rankingDate} 全部已上线机场
                <span className="block text-white/45">按公开展示分数降序排列</span>
              </h1>
              <p className="mt-5 max-w-3xl text-sm md:text-base leading-7 text-white/72">
                这里汇总所有已上线机场，并统一展示官网、运行状态、标签、成立日期、月付价格、试用支持、公开分数与测评报告入口。风险机场会保留显著标识，方便用户和 AI 检索系统快速判断。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-black">收录机场</div>
                <div className="mt-2 text-3xl font-black text-white">{formatNumber(data?.total || 0)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-black">当前分页</div>
                <div className="mt-2 text-3xl font-black text-white">{safePage}/{totalPages}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-black">默认页容量</div>
                <div className="mt-2 text-3xl font-black text-white">{data?.page_size || 20}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-black">数据说明</div>
                <div className="mt-2 text-sm font-semibold leading-6 text-white/78">仅展示 normal 与 risk 状态机场</div>
              </div>
            </div>
          </div>
        </section>

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
                                评分日期 {item.score_date}
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
                            {item.airport_intro?.trim() || '该机场已进入正式榜单，当前公开页展示官网、标签、成立日期、价格与试用支持信息，便于用户快速完成横向比较。'}
                          </p>

                          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">官网链接</dt>
                              <dd className="mt-1 break-all font-semibold text-neutral-800">{item.website}</dd>
                            </div>
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
                        </div>

                        <div className="flex flex-col gap-3 rounded-[24px] border border-neutral-200 bg-white p-4 lg:sticky lg:top-24">
                          <div className="rounded-2xl bg-neutral-50 px-4 py-4">
                            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">操作入口</div>
                            <p className="mt-2 text-sm leading-6 text-neutral-500">先访问官网，再结合本站测评报告完成判断，能更快对照风险与稳定性变化。</p>
                          </div>
                          <a
                            href={item.website}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-neutral-800"
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
                            {item.report_url ? '查看测评报告' : '暂无测评报告'}
                            {item.report_url && <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </article>
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
                      onClick={() => navigate(buildFullRankingHref(data.date, safePage - 1))}
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
                        onClick={() => navigate(buildFullRankingHref(data.date, pageNumber))}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={safePage >= totalPages}
                      onClick={() => navigate(buildFullRankingHref(data.date, safePage + 1))}
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
  const [data, setData] = useState<RiskMonitorPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
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
  }, [date, page]);

  const rankingDate = data?.date || date || '今日';
  const safePage = data?.page || page || 1;
  const totalPages = data?.total_pages || 1;
  const visiblePages = buildPageWindow(safePage, totalPages);
  const seoTitle = `${rankingDate} 跑路监测 | 已跑路与风险观察机场列表 | ${PUBLIC_SITE_BRAND_NAME}`;
  const seoDescription = data
    ? `${rankingDate} 跑路监测当前收录 ${formatNumber(data.total)} 个机场，覆盖管理员确认跑路与命中风险观察标签的对象，默认将已跑路机场置顶展示。`
    : `${PUBLIC_SITE_BRAND_NAME} 跑路监测页汇总管理员确认跑路与命中风险观察标签的机场，帮助用户快速识别高风险对象。`;
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
    keywords: '机场榜GateRank,跑路监测,风险观察,机场风险,高风险机场,已跑路机场,GateRank',
    canonicalPath: buildRiskMonitorHref(date, safePage),
    structuredData: seoStructuredData,
  });

  return (
    <PageFrame active="risk_monitor">
      <main className="max-w-7xl mx-auto px-4 pt-10 md:pt-14 pb-10">
        <section className="relative overflow-hidden rounded-[32px] border border-rose-200 bg-[linear-gradient(135deg,#3f0d18_0%,#111827_42%,#fff1f2_100%)] px-6 py-8 md:px-10 md:py-12 text-white shadow-[0_30px_80px_rgba(127,29,29,0.18)]">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(255,255,255,0.24), transparent 35%)' }} />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/80 backdrop-blur">
                跑路监测
              </div>
              <h1 className="mt-5 max-w-4xl text-3xl md:text-5xl lg:text-[56px] font-black leading-[0.95] tracking-tight">
                {rankingDate} 高风险机场监测列表
                <span className="block text-white/50">已跑路置顶，风险观察同步纳入</span>
              </h1>
              <p className="mt-5 max-w-3xl text-sm md:text-base leading-7 text-white/72">
                本页只展示两类对象：管理员后台已确认跑路的机场，以及标签命中“风险观察”的机场。已跑路机场会从每日测评、自动调度与手动任务中全部排除，仅保留风险留档展示。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-black">监测对象</div>
                <div className="mt-2 text-3xl font-black text-white">{formatNumber(data?.total || 0)}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-black">当前分页</div>
                <div className="mt-2 text-3xl font-black text-white">{safePage}/{totalPages}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-black">默认页容量</div>
                <div className="mt-2 text-3xl font-black text-white">{data?.page_size || 20}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/60 font-black">收录规则</div>
                <div className="mt-2 text-sm font-semibold leading-6 text-white/78">仅包含“已跑路”或“风险观察”</div>
              </div>
            </div>
          </div>
        </section>

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
                              : '该机场当前命中“风险观察”标签，仍需用户结合官网状态、订阅可用性与历史波动继续判断。'}
                          </p>

                          <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
                            <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                              <dt className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">官网链接</dt>
                              <dd className="mt-1 break-all font-semibold text-neutral-800">{item.website}</dd>
                            </div>
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
                              <dd className="mt-1 font-semibold text-neutral-800">{item.score_date || '暂无快照'}</dd>
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
                            <p className="mt-2 text-sm leading-6 text-neutral-500">先核查官网与订阅，再决定是否查看历史测评报告。已跑路对象默认不再产生新的当日评分快照。</p>
                          </div>
                          <a
                            href={item.website}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-white transition hover:bg-neutral-800"
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
                      onClick={() => navigate(buildRiskMonitorHref(data.date, safePage - 1))}
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
                        onClick={() => navigate(buildRiskMonitorHref(data.date, pageNumber))}
                      >
                        {pageNumber}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                      disabled={safePage >= totalPages}
                      onClick={() => navigate(buildRiskMonitorHref(data.date, safePage + 1))}
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

function ReportPage({ airportId, date }: { airportId: number; date?: string }) {
  const [data, setData] = useState<ReportViewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    void apiFetch<ReportViewResponse>(`/api/v1/airports/${airportId}/report-view${query}`)
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
  }, [airportId, date]);

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

  const reportTitle = data
    ? `${data.airport.name} 测评报告 | ${PUBLIC_SITE_BRAND_NAME}`
    : `机场测评报告 | ${PUBLIC_SITE_BRAND_NAME}`;
  const reportDescription = data
    ? `${data.airport.name} 当前公开分数 ${formatMetric(data.summary_card.score)}，状态为${formatAirportStatus(data.airport.status)}。报告包含榜单位置、评分拆解、关键指标与 30 天趋势。`
    : `${PUBLIC_SITE_BRAND_NAME} 测评报告页展示单个机场的榜单位置、评分拆解、关键指标与 30 天趋势。`;
  const reportStructuredData = useMemo(
    () => ([
      {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: reportTitle,
        description: reportDescription,
        url: buildAbsoluteUrl(buildReportHref(airportId, date)),
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
            name: data?.airport.name || `机场 ${airportId}`,
            item: buildAbsoluteUrl(buildReportHref(airportId, date)),
          },
        ],
      },
    ]),
    [airportId, data, date, reportDescription, reportTitle],
  );

  usePageSeo({
    title: reportTitle,
    description: reportDescription,
    keywords: '机场榜GateRank,机场测评报告,机场评分,机场趋势,机场榜,GateRank',
    canonicalPath: buildReportHref(airportId, date),
    structuredData: reportStructuredData,
  });

  return (
    <div className="min-h-screen bg-white relative">
      <div
        className="fixed inset-0 opacity-[0.015] pointer-events-none z-0"
        style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-200 bg-white text-sm font-black uppercase tracking-[0.14em]"
            onClick={() => window.history.length > 1 ? window.history.back() : navigate('/')}
          >
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </button>
          {data && (
            <div className="flex flex-col items-end gap-2">
              <div className="text-[11px] md:text-xs font-black uppercase tracking-[0.18em] text-neutral-400">
                报告日期：{data.date}
              </div>
              {data.resolved_from_fallback && data.fallback_notice ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-black tracking-[0.12em] text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {data.fallback_notice}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {loading && <EmptySection message="正在加载完整报告..." />}
        {error && !loading && <EmptySection message={error} />}

        {!loading && !error && data && (
          <div className="space-y-10">
            <header className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] gap-6 items-start">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xl">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-400 font-black">Full Report</div>
                    <h1 className="text-3xl md:text-5xl font-black tracking-tight text-neutral-900">{data.airport.name}</h1>
                  </div>
                </div>
                <p className="text-sm md:text-base text-neutral-600 leading-7 max-w-2xl">
                  基于稳定性、性能、价格和风险维度生成的当前报告视图。下方卡片与首页口径保持一致，便于用户从推荐列表进入后继续查看原因与趋势。
                </p>
                <a
                  href={buildMethodologyHref()}
                  onClick={(event) => {
                    event.preventDefault();
                    navigate(buildMethodologyHref());
                  }}
                  className="mt-5 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-600 transition-colors hover:border-neutral-900 hover:text-neutral-900"
                >
                  查看测评方法
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
                <div className="mt-5 flex flex-wrap gap-2">
                  {data.airport.tags.map((tag) => (
                    <TagBadge key={tag} tag={tag} />
                  ))}
                  <span className={`px-3 py-1 rounded-sm border text-[11px] font-black uppercase tracking-[0.16em] ${getAirportStatusTone(data.airport.status)}`}>
                    {formatAirportStatus(data.airport.status)}
                  </span>
                  <a href={data.airport.website} target="_blank" rel="noreferrer" className="px-3 py-1 rounded-sm border border-neutral-200 text-[11px] font-black uppercase tracking-[0.16em] text-neutral-600">
                    官网
                  </a>
                </div>
              </div>

              <ConclusionCard
                type={data.summary_card.type}
                title="完整报告"
                name={data.summary_card.name}
                tags={data.summary_card.tags}
                score={data.summary_card.score}
                details={data.summary_card.details}
                conclusion={data.summary_card.conclusion}
              />
            </header>

            <section className="space-y-4">
              <SectionHeader
                icon={BarChart3}
                title="榜单位置"
                subtitle="Ranking Snapshot"
                color="text-neutral-900"
                bgClass="bg-neutral-900"
              />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {rankPairs.map((item) => (
                  <div key={item.label}>
                    <StatusPill label={item.label} value={item.value ? `#${item.value}` : '-'} />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader
                icon={ShieldCheck}
                title="关键指标"
                subtitle="Metrics Snapshot"
                color="text-emerald-500"
                bgClass="bg-emerald-500"
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatusPill label="30 天可用率" value={`${formatMetric(data.metrics.uptime_percent_30d)}%`} />
                <StatusPill label="中位延迟" value={`${formatMetric(data.metrics.median_latency_ms)} ms`} />
                <StatusPill label="下载速率" value={`${formatMetric(data.metrics.median_download_mbps)} Mbps`} />
                <StatusPill label="丢包率" value={`${formatMetric(data.metrics.packet_loss_percent)}%`} />
                <StatusPill label="稳定记录" value={`${data.metrics.stable_days_streak} 天`} />
                <StatusPill label="近期投诉" value={data.metrics.recent_complaints_count} />
                <StatusPill label="历史异常" value={data.metrics.history_incidents} />
                <StatusPill label="状态" value={formatAirportStatus(data.airport.status)} />
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader
                icon={Clock}
                title="评分拆解"
                subtitle="Score Breakdown"
                color="text-sky-500"
                bgClass="bg-sky-500"
              />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatusPill label="稳定性 S" value={formatMetric(data.score_breakdown.s)} />
                <StatusPill label="性能 P" value={formatMetric(data.score_breakdown.p)} />
                <StatusPill label="价格 C" value={formatMetric(data.score_breakdown.c)} />
                <StatusPill label="风险 R" value={formatMetric(data.score_breakdown.r)} />
                <StatusPill label="最终分" value={formatMetric(data.score_breakdown.final_score)} />
                <StatusPill label="风险惩罚" value={formatMetric(data.score_breakdown.risk_penalty)} />
              </div>
            </section>

            <section className="space-y-4">
              <SectionHeader
                icon={Zap}
                title="30 天趋势"
                subtitle="Recent Trend"
                color="text-indigo-500"
                bgClass="bg-indigo-500"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TrendPanel icon={BarChart3} title="最终评分" items={data.trends.score_30d} />
                <TrendPanel icon={ShieldCheck} title="可用率" items={data.trends.uptime_30d} suffix="%" />
                <TrendPanel icon={Clock} title="延迟" items={data.trends.latency_30d} suffix=" ms" />
                <TrendPanel icon={Zap} title="下载速率" items={data.trends.download_30d} suffix=" Mbps" />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicationPage() {
  const [form, setForm] = useState<ApplicationFormState>(() => createApplicationForm());
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  usePageSeo({
    title: `申请入驻测试 | ${PUBLIC_SITE_BRAND_NAME}`,
    description: `${PUBLIC_SITE_BRAND_NAME} 申请入驻测试页用于提交机场基础信息、测试资料与联系方式，供后台审核与后续联系使用。`,
    keywords: '机场榜GateRank,申请入驻测试,机场申请,机场收录,机场测试资料,GateRank',
    canonicalPath: '/apply',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: `申请入驻测试 | ${PUBLIC_SITE_BRAND_NAME}`,
      description: `${PUBLIC_SITE_BRAND_NAME} 申请入驻测试页用于提交机场基础信息、测试资料与联系方式，供后台审核与后续联系使用。`,
      url: buildAbsoluteUrl('/apply'),
    },
  });

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
    setSuccessMessage('');

    try {
      await apiRequest('/api/v1/airport-applications', {
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
      setSuccessMessage('申请已提交，我们会在后台审核后尽快联系你。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans relative">
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
            填写基础信息和测试资料后，申请会进入后台待审核列表。我们会使用你提供的测试账号进行核验，不会直接加入正式机场榜单。
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
          {successMessage && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{successMessage}</div>}

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

function createApplicationForm(): ApplicationFormState {
  return {
    name: '',
    websites: [''],
    plan_price_month: '',
    has_trial: false,
    subscription_url: '',
    applicant_email: '',
    applicant_telegram: '',
    founded_on: '',
    airport_intro: '',
    test_account: '',
    test_password: '',
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
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [route]);

  if (route.kind === 'report' && route.airportId) {
    return <ReportPage airportId={route.airportId} date={route.date} />;
  }

  if (route.kind === 'apply') {
    return <ApplicationPage />;
  }

  if (route.kind === 'methodology') {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LazyMethodologyPage />
      </Suspense>
    );
  }

  if (route.kind === 'publish_token_docs') {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LazyPublishTokenDocsPage />
      </Suspense>
    );
  }

  if (route.kind === 'full_ranking') {
    return <FullRankingPage date={route.date} page={route.page} />;
  }

  if (route.kind === 'risk_monitor') {
    return <RiskMonitorPage date={route.date} page={route.page} />;
  }

  return <HomePage date={route.date} />;
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
