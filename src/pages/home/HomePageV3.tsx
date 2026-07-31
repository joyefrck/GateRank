import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Globe,
  HelpCircle,
  Megaphone,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Tv,
  Zap,
} from 'lucide-react';

import { HOME_FAQ_ITEMS, buildHomeSeo } from '../../../shared/publicSeo';
import { PUBLIC_SITE_BRAND_NAME } from '../../../shared/publicBrand';
import { PUBLIC_TOOL_DEFINITIONS } from '../../../shared/publicTools';
import { getTagBadgeTone } from '../../components/TagBadge';
import {
  buildAbsoluteUrl,
  buildFullRankingHref,
  buildHomeHref,
  navigate,
  normalizeExternalHref,
  PageFrame,
  usePageSeo,
} from '../../site/publicSite';
import { createTrackedOutboundClickHandler, useMarketingImpression } from '../../site/marketing';

type AirportStatus = 'normal' | 'risk' | 'down';
type CardType = 'stable' | 'value' | 'risk' | 'new';
type HomeSectionKey = 'today_pick' | 'most_stable' | 'best_value' | 'new_entries' | 'risk_alerts';

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
  score_delta_vs_yesterday: ScoreDeltaView;
  details: Array<{ label: string; value: string }>;
  conclusion: string;
  report_url: string;
}

interface FullRankingItem {
  airport_id: number;
  rank: number;
  name: string;
  website: string;
  status: AirportStatus;
  tags: string[];
  founded_on?: string | null;
  plan_price_month: number;
  score: number | null;
  score_hidden?: boolean;
  score_delta_vs_yesterday: ScoreDeltaView;
  report_url?: string | null;
}

interface SponsoredDeal {
  campaign_id: number;
  airport_id: number;
  home_slot: 1 | 2 | 3 | 4;
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
  score_delta_vs_yesterday: ScoreDeltaView;
}

interface NewsUpdate {
  id: number;
  title: string;
  slug: string;
  href: string;
  published_at: string | null;
}

interface HomePageData {
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
  ranking_preview?: {
    total: number;
    items: FullRankingItem[];
  };
  sponsored_deals?: {
    total: number;
    display_limit: number;
    items: SponsoredDeal[];
  };
  news_updates?: NewsUpdate[];
  sections: Record<HomeSectionKey, {
    title: string;
    subtitle: string;
    items: HomeCardItem[];
  }>;
}

interface InitialDataEnvelope {
  kind: string;
  params?: { date?: string | null };
  payload: HomePageData;
}

const summaryConfig: Array<{
  key: Exclude<HomeSectionKey, 'today_pick'>;
  title: string;
  subtitle: string;
  href: string;
  icon: typeof TrendingUp;
  tone: string;
  hoverTone: string;
  risk?: boolean;
}> = [
  {
    key: 'new_entries',
    title: '新秀机场',
    subtitle: '潜力新晋 · 近期上榜',
    href: '/rankings/all',
    icon: TrendingUp,
    tone: 'bg-indigo-50 border-indigo-100 text-indigo-600',
    hoverTone: 'hover:border-indigo-200',
  },
  {
    key: 'best_value',
    title: '性价比最佳',
    subtitle: '大带宽 · 日常省钱',
    href: '/rankings/all',
    icon: Zap,
    tone: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    hoverTone: 'hover:border-emerald-200',
  },
  {
    key: 'most_stable',
    title: '长期稳定机场',
    subtitle: 'IEPL专线 · 不宕机',
    href: '/rankings/all',
    icon: ShieldCheck,
    tone: 'bg-sky-50 border-sky-100 text-sky-600',
    hoverTone: 'hover:border-sky-200',
  },
  {
    key: 'risk_alerts',
    title: '风险预警',
    subtitle: '避坑红榜 · 实时防封',
    href: '/risk-monitor',
    icon: AlertTriangle,
    tone: 'bg-rose-50 border-rose-100 text-rose-600',
    hoverTone: 'hover:border-rose-200',
    risk: true,
  },
];

const trustItems = [
  { title: '公正客观', body: '排名完全基于算法，彻底剔除所有外部广告包榜及恶意商业干预。', icon: ShieldCheck, tone: 'bg-orange-50 text-orange-600' },
  { title: '真实数据', body: '全球探针不间断巡航测速，丢包率延迟数据全景透明。', icon: TrendingUp, tone: 'bg-blue-50 text-blue-600' },
  { title: '持续更新', body: '每日重组测速基准计算，规避突发故障波动干扰。', icon: Zap, tone: 'bg-purple-50 text-purple-600' },
  { title: '隐私保护', body: '订阅规则与工具检测不保存用户敏感数据。', icon: ShieldCheck, tone: 'bg-teal-50 text-teal-600' },
  { title: '社区驱动', body: '汇合深度测试意见与风险舆情回执，共同防范跑路风险。', icon: CheckCircle2, tone: 'bg-rose-50 text-rose-600' },
];

export function HomePageV3({ date }: { date?: string }) {
  const initialData = useMemo(() => readInitialData(date), [date]);
  const [data, setData] = useState<HomePageData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      setLoading(false);
      setError('');
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    void fetch(`${getApiBase()}/api/v1/pages/home${query}`, {
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const detail = await response.json().catch(() => null) as { message?: string } | null;
          throw new Error(detail?.message || `请求失败: ${response.status}`);
        }
        return response.json() as Promise<HomePageData>;
      })
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(
            reason instanceof TypeError || (reason instanceof Error && reason.message === 'Failed to fetch')
              ? '网络连接失败，请稍后重试。'
              : reason instanceof Error
                ? reason.message
                : '首页加载失败',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [date, initialData]);

  useEffect(() => {
    if (!data?.hero.report_time_at) return;
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, [data?.hero.report_time_at]);

  const resolvedDate = data?.date || date || '今日';
  const seo = buildHomeSeo(data ? {
    dateLabel: resolvedDate,
    monitoredAirports: data.hero.monitored_airports,
    realtimeTests: data.hero.realtime_tests,
  } : undefined);
  const structuredData = useMemo(() => [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: PUBLIC_SITE_BRAND_NAME,
      url: buildAbsoluteUrl('/'),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: seo.title,
      description: seo.description,
      url: buildAbsoluteUrl(buildHomeHref(date)),
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: (data?.ranking_preview?.items || []).map((item) => ({
          '@type': 'ListItem',
          position: item.rank,
          name: item.name,
          url: buildAbsoluteUrl(item.report_url || `/reports/${item.airport_id}`),
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: HOME_FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ], [data?.ranking_preview?.items, date, seo.description, seo.title]);

  usePageSeo({
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    canonicalPath: buildHomeHref(date),
    structuredData,
  });

  return (
    <PageFrame active="home">
      <div className="relative min-h-screen bg-[#fafafa] text-gray-800 selection:bg-indigo-500 selection:text-white">
        <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
        <HomeHero
          data={data}
          reportTime={formatRelativeTime(data?.hero.report_time_at, new Date(clock), data?.hero.report_time_text)}
        />
        <main className="relative z-10 space-y-6">
          {loading ? <PageState message="正在读取最新公开监测数据…" /> : null}
          {!loading && error ? <PageState message={error} tone="error" /> : null}
          {!loading && !error && data ? (
            <>
              <SponsoredDeals deals={data.sponsored_deals?.items || []} />
              <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
                  <div className="lg:col-span-8">
                    <RankingPreview
                      items={data.ranking_preview?.items || []}
                      date={data.date}
                    />
                  </div>
                  <HomeSidebar news={data.news_updates || []} />
                </div>
              </section>
              <SummaryBoards sections={data.sections} />
              <TrustSection />
              <FaqSection />
            </>
          ) : null}
        </main>
      </div>
    </PageFrame>
  );
}

function HomeHero({ data, reportTime }: { data: HomePageData | null; reportTime: string }) {
  return (
    <header
      className="relative overflow-hidden border-b border-gray-50 bg-white py-5 sm:py-6 md:py-7"
      style={{
        backgroundImage: 'linear-gradient(to right, rgba(0, 0, 0, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 0, 0, 0.03) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }}
    >
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#f0f0f0_1px,transparent_1px)] [background-size:20px_20px] opacity-70" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col justify-center lg:col-span-8"
          >
            <div className="space-y-2.5">
              <h1 className="font-sans text-xl font-black leading-tight tracking-tight text-gray-900 sm:text-2xl md:text-3xl lg:leading-[1.15]">
                机场榜：机场 <span className="inline-block font-extrabold text-black">VPN</span> 推荐与
                <span className="mt-0.5 block bg-gradient-to-r from-gray-500 via-gray-400 to-gray-300 bg-clip-text font-extrabold text-transparent drop-shadow-sm sm:mt-0 sm:inline">
                  可靠性榜单
                </span>
              </h1>
              <p className="max-w-2xl text-[13.5px] leading-relaxed text-gray-500 sm:text-[14.5px]">
                首页默认聚焦今日推荐，同时结合 <span className="font-semibold text-gray-800">长期稳定、性价比、新入榜与风险预警</span> 五类榜单，帮助用户从不同角度快速筛选。
              </p>
              {data?.resolved_from_fallback && data.fallback_notice ? (
                <p className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
                  <AlertTriangle className="h-4 w-4" /> {data.fallback_notice}
                </p>
              ) : null}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex h-full flex-col justify-end gap-3 lg:col-span-4 lg:items-end"
          >
            <div className="flex w-full min-w-[220px] flex-col gap-2 sm:w-auto">
              <MetricCard icon={Search} label="监测机场" value={`${formatNumber(data?.hero.monitored_airports || 0)}+`} badge="LIVE" tone="emerald" />
              <MetricCard icon={Zap} label="实时测速" value={`${formatNumber(data?.hero.realtime_tests || 0)}+`} badge="AUTO" tone="blue" />
              <div className="flex justify-end pt-1">
                <div className="inline-flex select-none items-center gap-2 rounded-full border border-gray-200/90 bg-white/90 px-3.5 py-1.5 shadow-sm backdrop-blur-sm">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[12px] font-medium text-gray-600">
                    报告时间：<strong className="px-0.5 font-mono text-[13px] font-black text-gray-900">{reportTime}</strong>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </header>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  badge,
  tone,
}: {
  icon: typeof Search;
  label: string;
  value: string;
  badge: string;
  tone: 'emerald' | 'blue';
}) {
  return (
    <div className="flex flex-1 items-center justify-between gap-2.5 rounded-xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.015)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex flex-col">
          <span className="mb-1 text-[11px] font-bold leading-none tracking-wider text-gray-400">{label}</span>
          <span className="font-mono text-[20px] font-black leading-none text-gray-900">{value}</span>
        </div>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-black tracking-wider ${tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{badge}</span>
    </div>
  );
}

function SponsoredDeals({ deals }: { deals: SponsoredDeal[] }) {
  const dealsBySlot = new Map(deals.map((deal) => [deal.home_slot, deal]));
  return (
    <section id="today-discovery-section" aria-labelledby="sponsored-deals-title" className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-2 border-b border-gray-100 pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <h2 id="sponsored-deals-title" className="text-[17px] font-black tracking-tight text-gray-900 sm:text-[18px]">商业合作专区</h2>
            <span className="flex items-center gap-1 rounded-md border border-amber-200/60 bg-amber-50 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-amber-700">
              <Sparkles className="h-3 w-3 text-amber-500" /> 广告展位
            </span>
            <span className="hidden text-[12px] font-medium text-gray-400 md:inline-block">独立于机场评分</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11.5px] font-bold text-gray-400">官方合作招商中</span>
            <RouteLink href="/apply" className="text-[11.5px] font-extrabold text-indigo-600 hover:text-indigo-800 hover:underline">申请入驻 &gt;</RouteLink>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => {
            const slot = (index + 1) as SponsoredDeal['home_slot'];
            const deal = dealsBySlot.get(slot);
            return deal
              ? <SponsoredDealCard key={deal.campaign_id} deal={deal} />
              : <SponsoredEmptySlot key={`empty-deal-${slot}`} slot={slot} />;
          })}
        </div>
        {deals.length === 0 ? <span className="sr-only">当前暂无有效广告</span> : null}
      </div>
    </section>
  );
}

function SponsoredDealCard({ deal }: { deal: SponsoredDeal; key?: React.Key }) {
  const ref = useRef<HTMLElement>(null);
  const websiteHref = normalizeExternalHref(deal.website);
  useMarketingImpression({
    airportId: deal.airport_id,
    campaignId: deal.campaign_id,
    pageKind: 'home',
    placement: 'deal_card',
    dedupeKey: `home|deal_card|${deal.campaign_id}`,
    ref,
  });
  return (
    <motion.article
      ref={ref}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group relative flex min-h-[225px] flex-col justify-between overflow-hidden rounded-[20px] border border-gray-200 bg-gradient-to-b from-slate-50/60 to-white p-[18px] shadow-sm transition-all duration-200 hover:border-indigo-300 hover:shadow-md"
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <AirportMark name={deal.name} />
            <div className="flex min-w-0 flex-col">
              <h3 className="truncate text-[14px] font-black leading-tight text-gray-900 transition-colors group-hover:text-indigo-600 sm:text-[15px]">{deal.name}</h3>
              <span className="mt-1 font-mono text-[11.5px] leading-none text-gray-400">{deal.tracking_days} 天观察</span>
            </div>
          </div>
          <span className="shrink-0 rounded border border-stone-200/80 bg-stone-100 px-1.5 py-0.5 text-[9.5px] font-black uppercase leading-none tracking-wider text-stone-600">AD 广告</span>
        </div>
        <p className="line-clamp-2 text-[12.5px] font-medium leading-relaxed text-gray-500">
          {deal.discount_title || '查看官网了解当前优惠活动。'}
        </p>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {deal.tags.slice(0, 2).map((tag) => <FeatureTag key={tag} tag={tag} bordered />)}
        </div>
      </div>
      <div className="mt-3 space-y-2.5 border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="block text-[10px] font-bold leading-none text-gray-400">起步月付</span>
            <span className="font-mono text-[15px] font-black text-indigo-600">¥{formatPrice(deal.plan_price_month)} <span className="text-[10.5px] font-normal text-gray-400">/起</span></span>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-amber-200/50 bg-amber-50 px-2 py-0.5">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-mono text-[12px] font-extrabold text-amber-700">{scoreLabel(deal.score, deal.score_hidden)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <RouteLink href={deal.report_url} className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-stone-900 bg-stone-900 px-2 py-2 text-center text-[12px] font-black leading-none text-white shadow-sm hover:bg-black">
            查看报告 <span className="text-[10px]">&gt;</span>
          </RouteLink>
          <a
            href={websiteHref}
            target="_blank"
            rel="nofollow sponsored noopener noreferrer"
            onClick={createTrackedOutboundClickHandler({
              airportId: deal.airport_id,
              campaignId: deal.campaign_id,
              pageKind: 'home',
              placement: 'deal_card',
              targetKind: 'website',
              targetUrl: websiteHref,
            })}
            className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-2 py-2 text-center text-[12px] font-bold leading-none text-gray-700 shadow-sm hover:bg-gray-50"
          >
            官网 <ExternalLink className="h-3 w-3 text-gray-400" />
          </a>
        </div>
      </div>
    </motion.article>
  );
}

function SponsoredEmptySlot({ slot }: { slot: SponsoredDeal['home_slot']; key?: React.Key }) {
  return (
    <RouteLink href="/apply" className="group relative flex min-h-[225px] flex-col items-center justify-between overflow-hidden rounded-[20px] border border-dashed border-gray-300 bg-gray-50/70 p-[18px] text-center transition-all hover:border-indigo-300 hover:bg-indigo-50/20">
      <div className="my-auto space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 transition-transform group-hover:scale-110"><Sparkles className="h-5 w-5" /></div>
        <span className="block text-[14px] font-extrabold text-gray-800">首页 {slot} 号广告位招募中</span>
      </div>
      <span className="w-full rounded-xl border border-gray-200 bg-white py-2 text-[12px] font-bold text-gray-700 transition-colors group-hover:border-stone-900 group-hover:bg-stone-900 group-hover:text-white">联系商务合作</span>
    </RouteLink>
  );
}

function RankingPreview({ items, date }: { items: FullRankingItem[]; date: string }) {
  return (
    <section id="gaterank-ranking-section" aria-labelledby="ranking-preview-title" className="space-y-6 rounded-[24px] border border-gray-100 bg-white p-5 shadow-[0_6px_24px_rgba(0,0,0,0.015)]">
      <div className="flex flex-col gap-3 border-b border-gray-50 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 id="ranking-preview-title" className="font-sans text-[19px] font-black tracking-tight text-gray-900 sm:text-[21px]">🏆 GateRank 排行榜</h2>
            <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-wide text-indigo-600">综合排名</span>
          </div>
          <p className="text-[13.5px] font-medium text-gray-500">排名每日更新，基于真实数据和客观多节点测速得出</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 py-12 text-center text-sm font-medium text-gray-400">综合榜暂无数据</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">GateRank 综合实力排行榜前十名</caption>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[12.5px] font-extrabold uppercase leading-none tracking-widest text-gray-500">
                  <th scope="col" className="w-14 whitespace-nowrap px-4 py-4 text-center">排名</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-4">机场名称</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-4">GateRank分</th>
                  <th scope="col" className="whitespace-nowrap px-4 py-4">月付价格</th>
                  <th scope="col" className="w-28 whitespace-nowrap px-4 py-4">观察时长</th>
                  <th scope="col" className="w-28 whitespace-nowrap px-4 py-4 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <AnimatePresence mode="popLayout">
                  {items.slice(0, 10).map((item, index) => <RankingTableRow key={item.airport_id} item={item} index={index} date={date} />)}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          <div className="hidden" data-testid="home-ranking-mobile" aria-hidden="true">
            {items.slice(0, 10).map((item, index) => <RankingMobileCard key={item.airport_id} item={item} index={index} date={date} />)}
          </div>
        </>
      )}
    </section>
  );
}

function RankingTableRow({ item, index, date }: { item: FullRankingItem; index: number; date: string; key?: React.Key }) {
  const href = item.report_url || `/reports/${item.airport_id}?date=${encodeURIComponent(date)}`;
  return (
    <motion.tr
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.02 }}
      className="group transition-colors hover:bg-gray-50/50"
    >
      <td className="px-4 py-4 text-center"><RankBadge rank={item.rank} /></td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <AirportMark name={item.name} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <RouteLink href={href} className="flex flex-wrap items-center gap-1.5 text-[14px] font-black tracking-tight text-gray-900 hover:text-indigo-600">{item.name}</RouteLink>
            <div className="flex max-w-[210px] flex-wrap gap-1 md:max-w-none md:gap-1.5">
              {item.tags.slice(0, 3).map((tag) => <FeatureTag key={tag} tag={tag} />)}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <Star className="h-[18px] w-[18px] fill-amber-300 text-amber-400" />
            <span className="font-mono text-[15.5px] font-black leading-none text-gray-800">{scoreLabel(item.score, item.score_hidden)}</span>
          </div>
          <div className="mt-1.5 flex w-full flex-col items-start border-t border-gray-100 pt-1.5">
            <span className="text-[11px] font-bold leading-normal text-gray-400">对比昨天</span>
            <Delta delta={item.score_delta_vs_yesterday} />
          </div>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="flex flex-col">
          <span className="font-mono text-[15.5px] font-black leading-none text-gray-900">¥{formatPrice(item.plan_price_month)}</span>
          <span className="mt-1 text-[11.5px] font-medium leading-none text-gray-500">起 / 月付</span>
        </div>
      </td>
      <td className="px-4 py-4"><span className="font-mono text-[14.5px] font-bold text-gray-700">{observationDays(item.founded_on, date, false)}</span></td>
      <td className="px-4 py-4">
        <div className="flex min-w-[105px] flex-col items-center justify-center gap-1.5">
          <RouteLink
            href={href}
            className="flex w-full items-center justify-center gap-1 rounded-xl border border-stone-900 bg-stone-900 px-3 py-1.5 text-center text-[12px] font-black leading-relaxed text-white shadow-sm transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-stone-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 motion-reduce:transform-none"
          >
            查看报告 <span className="text-[10px]">&gt;</span>
          </RouteLink>
          <a href={item.website} target="_blank" rel="nofollow noreferrer noopener" className="flex w-full items-center justify-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1 text-center text-[12px] font-bold leading-relaxed text-gray-700 shadow-sm hover:bg-gray-50">官网 <ExternalLink className="h-3 w-3 text-gray-400" /></a>
        </div>
      </td>
    </motion.tr>
  );
}

function RankingMobileCard({ item, index, date }: { item: FullRankingItem; index: number; date: string; key?: React.Key }) {
  const href = item.report_url || `/reports/${item.airport_id}?date=${encodeURIComponent(date)}`;
  return (
    <article className="rounded-2xl border border-gray-100 bg-gray-50/40 p-3">
      <div className="flex items-start gap-3">
        <RankBadge rank={item.rank || index + 1} />
        <AirportMark name={item.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-black text-gray-900">{item.name}</h3>
              <div className="mt-1.5 flex flex-wrap gap-1">{item.tags.slice(0, 2).map((tag) => <FeatureTag key={tag} tag={tag} />)}</div>
            </div>
            <div className="text-right">
              <strong className="font-mono text-base text-gray-900">{scoreLabel(item.score, item.score_hidden)}</strong>
              <Delta delta={item.score_delta_vs_yesterday} />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-white px-3 py-2 text-[11px] text-gray-500">
            <span>¥{formatPrice(item.plan_price_month)}/月 · {observationDays(item.founded_on, date, true)}</span>
            <RouteLink href={href} className="font-black text-gray-900">查看报告 <ArrowRight className="inline h-3 w-3" /></RouteLink>
          </div>
        </div>
      </div>
    </article>
  );
}

function HomeSidebar({ news }: { news: NewsUpdate[] }) {
  return (
    <aside className="space-y-6 lg:col-span-4" aria-label="工具与最新动态">
      <section className="relative overflow-hidden rounded-[24px] bg-indigo-950 p-6 text-white shadow-md">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-indigo-500/10 blur-xl" />
        <div className="absolute bottom-0 left-6 h-32 w-32 rounded-full bg-violet-500/10 blur-xl" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-amber-300"><Sparkles className="h-4 w-4" /><span>EXCELLENCE IN CONSOLIDATION</span></div>
          <h2 className="font-sans text-[19px] font-black leading-tight tracking-tight sm:text-[20px]">探索更多优质机场</h2>
          <p className="text-[13px] leading-relaxed text-indigo-100">想快速找出适合特定需求的高阶中转网络么？寻找配有电竞游戏级别优化、4K Netflix HDR高流控或双向原生 IP 的高级套餐通道。</p>
          <RouteLink href="/rankings/all" className="flex w-fit items-center gap-1 rounded-xl border border-white/10 bg-white/10 px-[18px] py-2.5 text-[13px] font-bold text-indigo-200 transition-all hover:bg-white hover:text-black">立即探索 <ChevronRight className="h-3.5 w-3.5" /></RouteLink>
        </div>
      </section>

      <section className="space-y-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-50 pb-3">
          <h2 className="flex items-center gap-2 font-sans text-[16px] font-black tracking-tight text-gray-900 sm:text-[17px]"><Briefcase className="h-[18px] w-[18px] text-indigo-500" />实用工具</h2>
          <RouteLink href="/tools" className="text-[12.5px] font-bold text-gray-400 hover:text-indigo-600">更多工具</RouteLink>
        </div>
        <div className="space-y-3.5">
          {PUBLIC_TOOL_DEFINITIONS.slice(0, 4).map((tool) => {
            const Icon = tool.key === 'download' ? Download : tool.key === 'streaming_check' ? Tv : tool.key === 'ip_check' ? Globe : ShieldAlert;
            const iconTone = tool.key === 'download'
              ? 'text-blue-500'
              : tool.key === 'streaming_check'
                ? 'text-purple-500'
                : tool.key === 'ip_check'
                  ? 'text-emerald-500'
                  : 'text-amber-500';
            return (
              <RouteLink key={tool.key} href={tool.href} className="group flex items-center justify-between gap-3 rounded-xl border border-gray-800 p-2.5 transition-all hover:border-gray-300 hover:bg-gray-50/50">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-100 bg-gray-50"><Icon className={`h-5 w-5 ${iconTone}`} /></span>
                  <span className="flex min-w-0 flex-col">
                    <strong className="text-[13.5px] font-bold text-gray-800 transition-colors group-hover:text-indigo-600">{tool.label}</strong>
                    <span className="mt-0.5 truncate text-[11.5px] font-medium leading-normal text-gray-500">{tool.summary}</span>
                  </span>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-indigo-600" />
              </RouteLink>
            );
          })}
        </div>
      </section>

      <section id="announcement-dynamics-section" className="space-y-4 rounded-[24px] border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-50 pb-3">
          <h2 className="flex items-center gap-2 font-sans text-[16px] font-black tracking-tight text-gray-900 sm:text-[17px]"><Megaphone className="h-[18px] w-[18px] text-indigo-500" />公告与动态</h2>
          <a href="/news" className="flex items-center gap-0.5 text-[12.5px] font-bold text-gray-400 hover:text-indigo-600">更多 <ChevronRight className="h-3 w-3" /></a>
        </div>
        {news.length === 0 ? (
          <p className="rounded-xl bg-gray-50 p-4 text-xs text-gray-400">暂无已发布 News</p>
        ) : (
          <ol className="space-y-1.5 divide-y divide-gray-50">
            {news.slice(0, 5).map((item) => (
              <li key={item.id} className="group py-2.5 first:pt-0 last:pb-0">
                <a href={item.href} className="flex items-center justify-between gap-2.5 text-[13px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                    <span className="truncate font-semibold leading-relaxed text-gray-700 transition-colors group-hover:text-indigo-600">{item.title}</span>
                  </span>
                  <time dateTime={item.published_at || undefined} className="whitespace-nowrap font-mono text-[11px] text-gray-400">{formatNewsDate(item.published_at, true)}</time>
                </a>
              </li>
            ))}
          </ol>
        )}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-2.5 text-center text-[11.5px] font-bold leading-normal text-gray-500">测速物理中转每日清晨 6 点重算评分</div>
      </section>
    </aside>
  );
}

function SummaryBoards({ sections }: { sections: HomePageData['sections'] }) {
  return (
    <section aria-label="分类榜单摘要" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {summaryConfig.map((config) => {
          const Icon = config.icon;
          const items = sections[config.key]?.items?.slice(0, 4) || [];
          return (
            <article key={config.key} className={`group flex flex-col justify-between rounded-[24px] border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md ${config.hoverTone}`}>
              <div>
                <div className="mb-3.5 flex items-center justify-between border-b border-gray-100 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`rounded-xl border p-2 ${config.tone}`}><Icon className="h-[18px] w-[18px]" /></span>
                    <div>
                      <h2 className="font-sans text-[16px] font-black leading-tight tracking-tight text-gray-900">{config.title}</h2>
                      <span className={`text-[11px] font-semibold ${config.risk ? 'text-rose-500' : 'text-gray-400'}`}>{config.subtitle}</span>
                    </div>
                  </div>
                  <RouteLink href={config.href} aria-label={`查看更多${config.title}`} className="flex items-center gap-0.5 text-[12px] font-bold text-gray-400 hover:text-indigo-600">更多 <ChevronRight className="h-3.5 w-3.5" /></RouteLink>
                </div>
                {items.length === 0 ? (
                  <p className="rounded-xl bg-gray-50 p-4 text-center text-xs text-gray-400">当前没有可展示数据</p>
                ) : (
                  <ol className="space-y-2">
                    {items.map((item, index) => (
                      <li key={item.airport_id}>
                        <RouteLink href={item.report_url} className={`group/item flex items-center justify-between gap-2.5 rounded-xl border border-transparent p-2 transition-all ${config.risk ? 'bg-rose-50/30 hover:border-rose-200 hover:bg-rose-50/70' : 'bg-gray-50/60 hover:border-gray-200 hover:bg-white hover:shadow-sm'}`}>
                          <span className="flex min-w-0 flex-1 items-center gap-2.5">
                            <SummaryRank index={index} risk={config.risk} />
                            <AirportMark name={item.name} compact />
                            <span className="min-w-0">
                              <strong className="block truncate text-[13.5px] font-black text-gray-800">{item.name}</strong>
                              <span className={`block truncate text-[10.5px] font-medium ${config.risk ? 'text-rose-500/90' : 'text-gray-400'}`}>{item.details?.[0]?.value || item.conclusion}</span>
                            </span>
                          </span>
                          {config.risk ? (
                            <span className="shrink-0 rounded-lg bg-rose-600 px-2 py-0.5 text-[10.5px] font-extrabold text-white">风险</span>
                          ) : (
                            <span className="flex shrink-0 items-center gap-1 rounded-lg border border-amber-200/60 bg-amber-50 px-2 py-0.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /><span className="font-mono text-[12px] font-extrabold text-amber-800">{scoreLabel(item.score, item.score_hidden)}</span></span>
                          )}
                        </RouteLink>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section aria-labelledby="home-trust-title" className="mx-auto max-w-7xl border-t border-gray-100 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="space-y-8">
        <div className="space-y-1.5 text-center">
          <span className="block text-xs font-bold uppercase tracking-widest text-indigo-600">Core Philosophy</span>
          <h2 id="home-trust-title" className="font-sans text-2xl font-black tracking-tight text-gray-900">为什么选择 GateRank?</h2>
          <p className="text-xs font-medium text-gray-400">秉承彻底客观与硬核实测立场，全力维护航路透明</p>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {trustItems.map(({ title, body, icon: Icon, tone }) => (
            <article key={title} className="flex flex-col items-center space-y-2 rounded-[24px] border border-gray-100 bg-white p-5 text-center">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl shadow-sm ${tone}`}><Icon className="h-5 w-5" /></span>
              <h3 className="font-sans text-sm font-black text-gray-900">{title}</h3>
              <p className="pt-1 text-[11px] font-medium leading-relaxed text-gray-400">{body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIds, setOpenIds] = useState<string[]>(['0']);
  const [activeCategory, setActiveCategory] = useState('全部');
  const categories = ['全部', '机场选购', '线路技术', '流媒体与AI', '安全隐私'];
  const faqItems = HOME_FAQ_ITEMS.map((item, index) => ({
    ...item,
    id: String(index),
    category: categories[(index % (categories.length - 1)) + 1],
  }));
  const visibleItems = activeCategory === '全部' ? faqItems : faqItems.filter((item) => item.category === activeCategory);

  return (
    <section aria-labelledby="home-faq-title" className="border-t border-gray-100/80 bg-gradient-to-b from-white to-gray-50/50 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-[11.5px] font-bold text-indigo-700"><HelpCircle className="h-3.5 w-3.5 text-indigo-600" /><span>常见问题 FAQ & SEO 指南</span></div>
            <h2 id="home-faq-title" className="font-sans text-xl font-black tracking-tight text-gray-900 md:text-2xl">常见问题与翻墙选购指南</h2>
            <p className="text-xs font-medium text-gray-500 md:text-sm">解答机场选择、专线技术、流媒体解锁与网络安全避坑技巧</p>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((category) => (
              <button key={category} type="button" onClick={() => setActiveCategory(category)} className={`cursor-pointer whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${activeCategory === category ? 'bg-gray-900 text-white shadow-sm' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>{category}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 items-start gap-3.5 md:grid-cols-2">
          {visibleItems.map((item) => {
            const open = openIds.includes(item.id);
            return (
              <article key={item.question} className={`overflow-hidden rounded-2xl border bg-white transition-all ${open ? 'border-indigo-200/90 shadow-sm' : 'border-gray-200/80 hover:border-gray-300'}`}>
                <button type="button" onClick={() => setOpenIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} className="group flex w-full cursor-pointer items-center justify-between gap-3 p-4 text-left">
                  <span className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-[11px] font-black text-indigo-600">Q</span>
                    <span className="text-[13.5px] font-extrabold leading-snug text-gray-800 transition-colors group-hover:text-indigo-600">{item.question}</span>
                  </span>
                  <span className={`shrink-0 rounded-lg p-1 text-gray-400 transition-transform ${open ? 'rotate-180 bg-gray-100 text-gray-700' : ''}`}><ChevronDown className="h-4 w-4" /></span>
                </button>
                <AnimatePresence initial={false}>
                  {open ? (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }}>
                      <p className="border-t border-gray-100 bg-gray-50/40 px-4 pb-4 pt-3 text-xs font-normal leading-relaxed text-gray-600">{item.answer}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeatureTag({ tag, bordered = false }: { tag: string; bordered?: boolean; key?: React.Key }) {
  const tone = getTagBadgeTone(tag);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-[10px] font-black tracking-wide ${tone.className} ${bordered ? 'border' : 'border border-transparent'}`}>
      <span className={`h-1 w-1 shrink-0 rounded-full ${tone.dotClassName}`} />
      {tag}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const tone = rank === 1
    ? 'border-amber-300 bg-amber-400 text-white'
    : rank === 2
      ? 'border-slate-300 bg-slate-400 text-white'
      : rank === 3
        ? 'border-orange-300 bg-orange-400 text-white'
        : 'border-transparent bg-transparent text-gray-500';
  return <span className={`mx-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[13.5px] font-black ${tone}`}>{rank}</span>;
}

function SummaryRank({ index, risk }: { index: number; risk?: boolean }) {
  const tone = risk
    ? 'bg-rose-100 text-rose-700'
    : index === 0
      ? 'bg-amber-400 text-white'
      : index === 1
        ? 'bg-slate-400 text-white'
        : index === 2
          ? 'bg-amber-700 text-white'
          : 'bg-gray-100 text-gray-500';
  return <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-black ${tone}`}>{index + 1}</span>;
}

function AirportMark({ name, compact = false }: { name: string; compact?: boolean }) {
  const hue = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360;
  const size = compact ? 'h-[30px] w-[30px] rounded-lg text-[11px]' : 'h-9 w-9 rounded-xl text-xs';
  return <span className={`flex shrink-0 items-center justify-center font-black text-white shadow-sm ${size}`} style={{ background: `linear-gradient(135deg, hsl(${hue} 72% 56%), hsl(${(hue + 30) % 360} 72% 44%))` }} aria-hidden="true">{name.trim().charAt(0).toUpperCase() || 'G'}</span>;
}

function Delta({ delta }: { delta: ScoreDeltaView }) {
  if (delta.value === null) return <span className="mt-0.5 block font-mono text-[12px] font-black leading-none text-gray-400">—</span>;
  return <span className={`mt-0.5 block font-mono text-[12px] font-black leading-none ${delta.value > 0 ? 'text-emerald-600' : delta.value < 0 ? 'text-rose-500' : 'text-gray-400'}`}>{delta.value > 0 ? '+' : ''}{delta.value.toFixed(2)}</span>;
}

function PageState({ message, tone = 'neutral' }: { message: string; tone?: 'neutral' | 'error' }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`mx-auto my-8 max-w-7xl rounded-2xl border p-8 text-center text-sm font-bold ${tone === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-gray-200 bg-white text-gray-500'}`}>
      {tone === 'error' ? <AlertTriangle className="mx-auto mb-3 h-6 w-6" /> : <Zap className="mx-auto mb-3 h-6 w-6 animate-pulse motion-reduce:animate-none" />}
      {message}
    </div>
  );
}

function RouteLink({ href, onClick, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        navigate(href, { scrollToTop: true });
      }}
      {...props}
    />
  );
}

function readInitialData(date?: string): HomePageData | null {
  if (typeof document === 'undefined') return null;
  const element = document.getElementById('__GATERANK_INITIAL_DATA__');
  if (!element?.textContent) return null;
  try {
    const envelope = JSON.parse(element.textContent) as InitialDataEnvelope;
    if (envelope.kind !== 'home' || (envelope.params?.date ?? null) !== (date ?? null)) return null;
    return envelope.payload;
  } catch {
    return null;
  }
}

function getApiBase(): string {
  const value = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_BASE;
  return value?.trim().replace(/\/+$/, '') || '';
}

function scoreLabel(value: number | null, hidden?: boolean): string {
  if (hidden || value === null) return '未公开';
  return value.toFixed(2);
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return Number.isInteger(value) ? value.toFixed(1) : value.toFixed(2);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function observationDays(foundedOn: string | null | undefined, date: string, compact: boolean): string {
  if (!foundedOn) return compact ? '观察 —' : '--';
  const founded = new Date(`${foundedOn}T00:00:00+08:00`);
  const target = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(founded.getTime()) || Number.isNaN(target.getTime())) return compact ? '观察 —' : '--';
  const days = Math.max(0, Math.floor((target.getTime() - founded.getTime()) / 86_400_000));
  return compact ? `观察 ${days} 天` : `${days} 天`;
}

function formatRelativeTime(value: string | null | undefined, now: Date, fallback = '暂无更新'): string {
  if (!value) return fallback;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return fallback;
  const minutes = Math.max(0, Math.floor((now.getTime() - target.getTime()) / 60_000));
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function formatNewsDate(value: string | null, compact = false): string {
  if (!value) return '待更新';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '待更新';
  return new Intl.DateTimeFormat('zh-CN', compact ? { month: '2-digit', day: '2-digit' } : { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
