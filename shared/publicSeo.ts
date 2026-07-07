import { PUBLIC_SITE_BRAND_NAME } from './publicBrand';
import {
  buildFullRankingStaticPath,
  getFullRankingFilterCount,
  getFullRankingSeoDecision,
  hasFullRankingFilters,
  type FullRankingFilters,
  type FullRankingStaticFilterRoute,
} from './fullRankingFilters';
import {
  AIRPORT_FILTER_CATALOG,
  AIRPORT_PAYMENT_FILTERS,
  AIRPORT_STREAMING_FILTERS,
  getAirportFilterLabel,
  type AirportPrimaryIndexableFilterCategory,
} from './airportFilterCatalog';
import type { AirportDealView } from './airportAds';

export interface PublicSeoText {
  title: string;
  description: string;
  keywords: string;
}

export const HOME_HERO_HIGHLIGHT_TEXT = '行业首创，每日更新';
export const HOME_HERO_SUPPORTING_TEXT =
  '基于公开监测数据，结合今日推荐、长期稳定、性价比、新入榜与风险预警五类榜单，帮助用户快速筛选值得关注的机场 VPN 与测评报告。';

export const HOME_SEO_CONTENT_SECTIONS: PublicHomeSeoContentSection[] = [
  {
    title: '机场榜 GateRank 是什么？',
    body: '机场榜 GateRank 是一个面向科学上网用户的机场 VPN 评测与排名平台。首页不是简单收集机场名称，而是把公开监测、官网状态、测速结果、价格信息、风险记录和历史表现整理成可对比的榜单。用户搜索机场推荐、VPN 推荐或梯子推荐时，往往需要先知道哪些服务仍在正常运营、哪些机场近期更稳定、哪些机场适合短期尝试。GateRank 的定位就是把这些分散信息放在同一个判断框架里，减少只看广告、只看低价或只看单次测速带来的误判。',
    facts: ['公开监测数据优先', '榜单每日更新', '推荐与风险并列展示'],
  },
  {
    title: 'GateRank 如何评测机场 VPN？',
    body: 'GateRank 评测机场 VPN 时，会把稳定性、性能、价格和风险拆开观察，再汇总成公开展示分数。稳定性关注 30 天可用率、连续健康天数和延迟波动；性能关注中位延迟、下载速度、丢包率与晚高峰表现；价格维度会结合月付、年付折算、试用和套餐门槛；风险维度则关注官网可访问性、SSL 状态、历史异常和投诉信号。这样做的目的不是替用户保证某个机场绝对可靠，而是让每一次机场推荐都有可追溯的指标依据。',
    facts: ['稳定性、性能、价格、风险分开观察', '晚高峰与长期趋势比单次测速更重要', '广告活动不进入 GateRank Score'],
    links: [
      { label: '查看测评方法', href: '/methodology', description: '理解评分规则、测速标准和风险扣分逻辑' },
      { label: '查看全量榜单', href: '/rankings/all', description: '按公开展示分数对比已收录机场' },
    ],
  },
  {
    title: '新手如何选择机场？',
    body: '新手选择机场时，不建议直接购买很长周期套餐。更稳妥的方式是先看今日推荐和长期稳定榜，确认官网仍可访问、近期没有明显风险预警，再优先选择支持试用、月付或短周期套餐的机场。支付方式也要按自己的风险承受能力判断：支付宝和微信更适合普通用户核对订单，USDT 更适合熟悉链上转账和售后规则的人。购买前还应确认客户端支持、订阅导入方式、常用地区节点和客服渠道，避免买完才发现设备或使用场景不匹配。',
    facts: ['先短周期验证，再考虑长期套餐', '不要只看低价或折扣力度', '客户端和节点地区要匹配自己的设备'],
  },
  {
    title: '机场推荐主要看哪些指标？',
    body: '一个值得进入推荐视野的机场，通常不是某一个指标特别亮眼，而是在多个指标上没有明显短板。可用率说明服务是否经常在线，延迟和丢包影响网页、游戏和视频会议体验，下载速度影响大文件和流媒体，价格决定长期使用成本，风险记录则帮助用户避开可能失联、跑路或售后异常的服务。GateRank 首页把今日推荐、长期稳定、性价比、新入榜和风险预警拆成不同入口，是为了让用户按需求进入，而不是把所有场景压成一个单一排名。',
    facts: ['可用率看持续在线能力', '延迟和丢包看日常体验', '风险记录决定是否需要回避'],
  },
  {
    title: '不同需求推荐入口',
    body: '不同用户搜索机场推荐时，真实需求并不一样。有人想找稳定机场，有人只关心便宜机场，有人需要 Netflix、ChatGPT 或常用客户端支持，也有人想先排除风险机场。首页底部这些入口用于把搜索意图分发到更长尾的页面，帮助 Google 和用户理解 GateRank 不只是一个榜单首页，而是覆盖评测方法、风险监测、优惠活动和细分筛选的机场 VPN 信息体系。',
    facts: ['按支付方式筛选', '按流媒体和 AI 工具筛选', '按风险与优惠场景分流'],
    links: [
      { label: '全部机场排名', href: '/rankings/all', description: '查看全部已上线机场评分排名' },
      { label: '跑路风险监测', href: '/risk-monitor', description: '优先排除已跑路和风险观察机场' },
      { label: '机场优惠码', href: '/deals', description: '查看活动折扣，但不把优惠当作唯一判断依据' },
      { label: '支付宝机场', href: buildFullRankingStaticPath('payment', 'alipay'), description: '筛选支持支付宝付款的机场服务' },
      { label: 'USDT 机场', href: buildFullRankingStaticPath('payment', 'usdt_trc20'), description: '筛选支持 USDT-TRC20 的机场服务' },
      { label: 'ChatGPT 机场', href: buildFullRankingStaticPath('streaming', 'chatgpt'), description: '筛选支持 AI 工具访问的机场服务' },
      { label: 'Netflix 机场', href: buildFullRankingStaticPath('streaming', 'netflix'), description: '筛选支持 Netflix 解锁的机场服务' },
    ],
  },
];

export const HOME_FAQ_ITEMS: PublicHomeFaqItem[] = [
  {
    question: '机场和 VPN 有什么区别？',
    answer: '机场通常指提供代理节点、订阅链接和多客户端导入方式的服务商，用户会通过 Clash、Shadowrocket、sing-box 等客户端使用；传统 VPN 更多是一套封装好的官方客户端。两者都可能用于科学上网，但配置方式、节点选择、稳定性和售后模式不同。',
  },
  {
    question: '机场推荐看价格还是稳定性？',
    answer: '价格只能说明使用成本，不能单独代表服务质量。更合理的判断顺序是先看稳定性、可用率、延迟、丢包和风险记录，再比较价格和套餐周期。特别便宜但长期波动或风险信号明显的机场，不适合作为长期主力。',
  },
  {
    question: '支持支付宝的机场安全吗？',
    answer: '支持支付宝只说明付款方式更适合普通用户核对订单，不等于机场本身一定安全。仍然需要结合官网状态、历史记录、近期投诉、退款规则、客服渠道和榜单表现判断，避免因为支付方便就忽略服务风险。',
  },
  {
    question: '支持 USDT 的机场适合谁？',
    answer: 'USDT 更适合熟悉链类型、到账确认、交易哈希和售后沟通的人。它可能提供更灵活的支付选择，但退款、汇率、转账手续费和地址核对都需要用户自己承担更多责任，新手不应只因为支持 USDT 就直接购买长期套餐。',
  },
  {
    question: '为什么晚高峰测试很重要？',
    answer: '很多机场在白天或低峰时段表现正常，但晚高峰更容易暴露拥塞、丢包、延迟抖动和流媒体不可用等问题。晚高峰测试能更接近日常真实使用压力，因此比单次低峰测速更适合判断机场是否能长期使用。',
  },
];

export interface PublicReportSeoView {
  date: string;
  airport: {
    name: string;
    slug: string;
    website: string;
    status: string;
  };
  summary_card: {
    score: number | null;
    score_hidden?: boolean;
    score_hidden_reason?: 'insufficient_balance' | null;
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
    stability_tier: string;
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
    streaming: Array<{ key: string; label: string }>;
    payment_methods: Array<{ key: string; label: string }>;
    telegram: {
      items: Array<{ key: string; label: string }>;
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
    clients: Array<{ key: string; label: string }>;
    import_methods: Array<{ key: string; label: string }>;
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

export interface PublicReportFaqItem {
  question: string;
  answer: string;
}

export interface PublicReportContentSection {
  title: string;
  body: string;
  facts: string[];
}

export interface PublicReportContentSummary {
  body: string;
  chips: string[];
}

export interface PublicReportComparisonLink {
  label: string;
  href: string;
}

export interface PublicDealsContentSection {
  title: string;
  body: string;
  facts: string[];
}

export interface PublicDealsFaqItem {
  question: string;
  answer: string;
}

export interface PublicHomeSeoLink {
  label: string;
  href: string;
  description: string;
}

export interface PublicHomeSeoContentSection {
  title: string;
  body: string;
  facts: string[];
  links?: PublicHomeSeoLink[];
}

export interface PublicHomeFaqItem {
  question: string;
  answer: string;
}

export interface PublicFullRankingTopicSection {
  title: string;
  body: string;
}

export interface PublicFullRankingTopicFaqItem {
  question: string;
  answer: string;
}

export interface PublicFullRankingTopicContent {
  route: FullRankingStaticFilterRoute;
  label: string;
  searchName: string;
  intro: string;
  sections: PublicFullRankingTopicSection[];
  faqItems: PublicFullRankingTopicFaqItem[];
}

export interface PublicMonthlyReportSeoView {
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
  published_at: string | null;
  updated_at: string;
}

export const PUBLIC_SEO_PATHS = {
  home: '/',
  fullRanking: '/rankings/all',
  monthlyReports: '/monthly-reports',
  deals: '/deals',
  methodology: '/methodology',
  apply: '/apply',
  riskMonitor: '/risk-monitor',
  forAi: '/for-ai',
} as const;

export const PUBLIC_SEO_STATIC_LASTMOD = '2026-05-17T00:00:00+08:00';
export const PUBLIC_DEALS_LASTMOD = '2026-05-26T00:00:00+08:00';

export interface PublicOgImage {
  path: string;
  alt: string;
  width: 1200;
  height: 630;
  type: 'image/png';
}

export const PUBLIC_CORE_OG_IMAGES = {
  home: {
    path: '/og/home-2026-airport-ranking.png',
    alt: '机场榜 GateRank 全球科学上网机场评测与排名平台分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  },
  fullRanking: {
    path: '/og/rankings-all.png',
    alt: 'GateRank 全量机场排行榜分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  },
  monthlyReports: {
    path: '/og/monthly-reports.png',
    alt: 'GateRank 机场 VPN 月度报告分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  },
  deals: {
    path: '/og/deals-coupons.png',
    alt: 'GateRank 机场优惠码大全分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  },
  riskMonitor: {
    path: '/og/risk-monitor.png',
    alt: 'GateRank 跑路机场监测分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  },
  methodology: {
    path: '/og/methodology.png',
    alt: 'GateRank 机场测评方法分享图',
    width: 1200,
    height: 630,
    type: 'image/png',
  },
} as const satisfies Record<string, PublicOgImage>;

export function getPublicOgImageForPath(canonicalPath: string): PublicOgImage | undefined {
  const pathname = normalizePublicSeoPath(canonicalPath);
  if (pathname === PUBLIC_SEO_PATHS.home) return PUBLIC_CORE_OG_IMAGES.home;
  if (pathname === PUBLIC_SEO_PATHS.fullRanking) return PUBLIC_CORE_OG_IMAGES.fullRanking;
  if (pathname === PUBLIC_SEO_PATHS.monthlyReports || pathname.startsWith(`${PUBLIC_SEO_PATHS.monthlyReports}/`)) {
    return PUBLIC_CORE_OG_IMAGES.monthlyReports;
  }
  if (pathname === PUBLIC_SEO_PATHS.deals) return PUBLIC_CORE_OG_IMAGES.deals;
  if (pathname === PUBLIC_SEO_PATHS.riskMonitor) return PUBLIC_CORE_OG_IMAGES.riskMonitor;
  if (pathname === PUBLIC_SEO_PATHS.methodology) return PUBLIC_CORE_OG_IMAGES.methodology;
  return undefined;
}

export function buildMonthlyReportsSeo(input?: { total?: number }): PublicSeoText {
  return {
    title: `2026机场推荐月度报告 | 机场排行榜、机场测评、稳定机场推荐与便宜机场推荐 | ${PUBLIC_SITE_BRAND_NAME}`,
    description:
      typeof input?.total === 'number'
        ? `${PUBLIC_SITE_BRAND_NAME} 月度报告总入口已发布 ${formatCount(input.total)} 篇，按月沉淀2026机场推荐、机场排行榜、机场测评、稳定机场推荐、便宜机场推荐与机场 VPN 风险观察。`
        : `${PUBLIC_SITE_BRAND_NAME} 月度报告总入口按月沉淀2026机场推荐、机场排行榜、机场测评、稳定机场推荐、便宜机场推荐与机场 VPN 风险观察。`,
    keywords: '机场推荐,2026机场推荐,机场排行榜,机场测评,稳定机场推荐,便宜机场推荐,机场VPN月度报告,机场VPN排名,科学上网机场,GateRank',
  };
}

export function buildMonthlyReportSeo(report: PublicMonthlyReportSeoView): PublicSeoText {
  const monthLabel = `${report.year}年${report.month}月`;
  return {
    title: report.seo_title || `${monthLabel}机场 VPN 月度报告：机场推荐、机场排名与跑路风险观察 | ${PUBLIC_SITE_BRAND_NAME}`,
    description:
      report.seo_description
      || report.excerpt
      || `${monthLabel} GateRank 机场 VPN 月度报告，复盘机场推荐、机场排名、科学上网机场测速、稳定性表现、全量榜单变化与跑路风险观察。`,
    keywords:
      report.seo_keywords
      || `${monthLabel}机场VPN月度报告,机场推荐,机场排名,机场VPN排名,科学上网机场,跑路机场,GateRank`,
  };
}

export function buildMonthlyReportPath(slug: string): string {
  return `${PUBLIC_SEO_PATHS.monthlyReports}/${encodeURIComponent(slug)}`;
}

function normalizePublicSeoPath(canonicalPath: string): string {
  const pathname = canonicalPath.split('?')[0].split('#')[0] || '/';
  if (pathname === '/') return pathname;
  return pathname.replace(/\/+$/, '');
}

export function buildHomeSeo(input?: {
  dateLabel?: string;
  monitoredAirports?: number;
  realtimeTests?: number;
}): PublicSeoText {
  return {
    title: `${PUBLIC_SITE_BRAND_NAME} | 机场 VPN 推荐、科学上网机场测评与可靠性榜单`,
    description:
      input && typeof input.monitoredAirports === 'number' && typeof input.realtimeTests === 'number'
        ? `${HOME_HERO_HIGHLIGHT_TEXT}。${input.dateLabel || '今日'} 机场 VPN 榜单基于公开监测数据生成，当前监测 ${formatCount(input.monitoredAirports)} 个机场、累计实时测速 ${formatCount(input.realtimeTests)} 次，覆盖今日推荐、长期稳定、性价比、新入榜与风险预警。`
        : `${HOME_HERO_HIGHLIGHT_TEXT}。${PUBLIC_SITE_BRAND_NAME} 基于公开监测数据提供今日推荐、长期稳定、性价比、新入榜与风险预警等多维机场 VPN 榜单。`,
    keywords: '机场榜GateRank,机场榜,机场推荐,机场VPN,机场VPN排名,VPN推荐,梯子推荐,科学上网,魔法,梯子,今日推荐机场,机场测评,稳定机场,风险预警,GateRank',
  };
}

export function buildFullRankingSeo(input?: {
  dateLabel?: string;
  total?: number;
  filters?: FullRankingFilters;
}): PublicSeoText {
  const decision = input?.filters ? getFullRankingSeoDecision(input.filters) : null;
  if (decision?.primaryCategory && decision.primaryValue && decision.primaryLabel) {
    const title = buildFullRankingFilteredTitle(decision.primaryCategory, decision.primaryLabel);
    return {
      title: `${title} | ${PUBLIC_SITE_BRAND_NAME}`,
      description:
        input && typeof input.total === 'number'
          ? `${input.dateLabel || '今日'} ${title}收录 ${formatCount(input.total)} 个匹配机场，按 GateRank 公开展示分数排序，展示官网入口、状态、价格、试用、支付、客户端、节点地区和测评报告。`
          : `${PUBLIC_SITE_BRAND_NAME} 提供${title}，帮助用户按支付方式、客户端类型、节点地区、线路和解锁能力筛选机场 VPN。`,
      keywords: `机场榜GateRank,${decision.primaryLabel}机场,机场排名,机场推荐,机场测评,机场VPN,GateRank`,
    };
  }
  if (input?.filters && hasFullRankingFilters(input.filters)) {
    const count = getFullRankingFilterCount(input.filters);
    return {
      title: `机场筛选结果 | 搜索与分类筛选 | ${PUBLIC_SITE_BRAND_NAME}`,
      description:
        input && typeof input.total === 'number'
          ? `${input.dateLabel || '今日'} 机场筛选结果命中 ${formatCount(input.total)} 个机场，当前使用 ${formatCount(count)} 个搜索或分类条件，覆盖支付方式、客户端类型、节点地区、线路、套餐和 Telegram 支持。`
          : `${PUBLIC_SITE_BRAND_NAME} 全量榜单支持按搜索词、支付方式、客户端类型、节点地区、线路、套餐和 Telegram 支持筛选机场 VPN。`,
      keywords: '机场榜GateRank,机场筛选,机场搜索,机场支付方式,机场客户端,机场节点地区,机场线路,GateRank',
    };
  }
  return {
    title: `全量机场榜单 | 全部已上线机场评分排名 | ${PUBLIC_SITE_BRAND_NAME}`,
    description:
      input && typeof input.total === 'number'
        ? `${input.dateLabel || '今日'} 全量榜单收录 ${formatCount(input.total)} 个已上线机场，按公开展示分数降序排列，支持分页查看官网入口、状态、标签、成立日期、月付价格、试用支持与测评报告。`
        : `${PUBLIC_SITE_BRAND_NAME} 全量榜单按公开展示分数降序展示全部已上线机场，包含官网入口、状态、标签、月付价格、试用支持和测评报告入口。`,
    keywords: '机场榜GateRank,全量榜单,机场排名,机场排行榜,机场推荐,机场测评,机场官网,风险机场,GateRank',
  };
}

export function buildFullRankingHeading(filters?: FullRankingFilters): string {
  const decision = filters ? getFullRankingSeoDecision(filters) : null;
  if (decision?.primaryCategory && decision.primaryLabel && !hasComplexFullRankingFilters(filters)) {
    return buildFullRankingFilteredTitle(decision.primaryCategory, decision.primaryLabel);
  }
  if (filters && hasFullRankingFilters(filters)) {
    return '机场搜索与筛选结果';
  }
  return '机场排行榜：全量机场 VPN 评分排名';
}

function buildFullRankingFilteredTitle(category: string, label: string): string {
  if (category === 'payment') {
    return `${label}${label.includes(' ') ? ' 的' : '的'}机场 VPN 推荐排名`;
  }
  if (category === 'client') {
    return `${label}${label.includes(' ') ? ' ' : ''}机场推荐`;
  }
  if (category === 'region') {
    return `${label}机场排行榜`;
  }
  if (category === 'line') {
    return `${label}机场排名`;
  }
  if (category === 'streaming') {
    return `${label}${label.includes(' ') ? ' ' : ''}机场推荐`;
  }
  return `${label}机场筛选`;
}

export function buildFullRankingTopicContent(filters: FullRankingFilters): PublicFullRankingTopicContent | null {
  const decision = getFullRankingSeoDecision(filters, 1);
  if (!decision.primaryCategory || !decision.primaryValue || !decision.primaryLabel || getFullRankingFilterCount(filters) !== 1) {
    return null;
  }
  const category = decision.primaryCategory;
  const value = decision.primaryValue;
  const baseLabel = getAirportFilterLabel(category, value);
  const label = decision.primaryLabel;
  const searchName = buildFullRankingTopicSearchName(category, label);
  const adjacent = buildFullRankingAdjacentLabel(category, value);
  return {
    route: { category, value },
    label,
    searchName,
    intro: `${searchName}不是简单的参数筛选页。本页会把支持 ${baseLabel} 相关能力的机场集中到一个可索引专题中，并继续按 GateRank 公开分数排序，方便用户同时核对官网状态、价格、试用、客户端、节点地区和测评报告。`,
    sections: [
      {
        title: `${baseLabel}机场怎么选`,
        body: `选择${searchName}时，优先确认该能力是否与自己的设备、付款习惯和使用场景匹配，再看近期稳定性、晚高峰表现、风险记录和售后入口。GateRank 的排序不是广告位排序，而是基于公开监测数据和榜单分数做横向对比。`,
      },
      {
        title: `${searchName}的优点和风险`,
        body: `${searchName}的价值在于降低用户筛选成本，但单一能力不能代表机场整体可靠。购买前仍要检查官网是否可访问、套餐周期是否过长、是否支持短周期试用，以及近期是否存在投诉、失联或明显性能波动。`,
      },
      {
        title: `${searchName}与 ${adjacent}对比`,
        body: `${searchName}适合明确需要 ${baseLabel} 的用户；${adjacent}则更适合需求不同或希望分散风险的人。建议先用本页筛出候选机场，再进入具体测评报告核对稳定性、延迟、丢包、价格和风险扣分。`,
      },
    ],
    faqItems: [
      {
        question: `${searchName}适合哪些用户？`,
        answer: `${searchName}适合已经明确需要 ${baseLabel} 能力，并希望在购买前先比较公开评分、价格、试用、客户端、节点和风险记录的用户。`,
      },
      {
        question: `${searchName}一定更安全吗？`,
        answer: `不一定。${baseLabel} 只代表一个筛选条件，不能替代稳定性、官网状态、投诉记录、历史异常和售后响应等综合判断。`,
      },
      {
        question: `GateRank 如何排序${searchName}？`,
        answer: `GateRank 会先筛出匹配 ${baseLabel} 的机场，再按公开展示分数排序。分数会综合稳定性、性能、价格和风险维度，并保留测评报告入口供进一步核对。`,
      },
    ],
  };
}

function buildFullRankingTopicSearchName(category: AirportPrimaryIndexableFilterCategory, label: string): string {
  if (category === 'payment') {
    return buildCapabilityTopicName(label);
  }
  if (category === 'region' || category === 'line') {
    return `${label}机场`;
  }
  return buildCapabilityTopicName(label);
}

function buildCapabilityTopicName(label: string): string {
  const cleanLabel = label.replace(/^支持\s*/, '').trim();
  return `${cleanLabel}${/[A-Za-z0-9]$/.test(cleanLabel) ? ' ' : ''}机场`;
}

function buildFullRankingAdjacentLabel(category: AirportPrimaryIndexableFilterCategory, value: string): string {
  if (category === 'payment' && value === 'alipay') {
    return 'USDT-TRC20 机场';
  }
  if (category === 'payment' && value !== 'alipay') {
    return '支付宝机场';
  }
  const options = AIRPORT_FILTER_CATALOG[category];
  const adjacent = options.find((item) => item.key !== value);
  return adjacent ? `${adjacent.label}机场` : '全量机场榜单';
}

function hasComplexFullRankingFilters(filters: FullRankingFilters | undefined): boolean {
  if (!filters) {
    return false;
  }
  const decision = getFullRankingSeoDecision(filters);
  return decision.primaryValue === null || getFullRankingFilterCount(filters) !== 1;
}

export function buildRiskMonitorSeo(input?: {
  dateLabel?: string;
  total?: number;
}): PublicSeoText {
  return {
    title: `跑路监测 | 已跑路与风险观察机场列表 | ${PUBLIC_SITE_BRAND_NAME}`,
    description:
      input && typeof input.total === 'number'
        ? `${input.dateLabel || '今日'} ${PUBLIC_SITE_BRAND_NAME} 跑路机场监测页收录 ${formatCount(input.total)} 个已确认跑路、风险观察与异常波动机场，结合评分变化、官网状态、测速数据和风险标签，帮助用户避开高风险机场 VPN 服务。`
        : `${PUBLIC_SITE_BRAND_NAME} 跑路机场监测页汇总已确认跑路、风险观察与异常波动机场，结合评分变化、官网状态、测速数据与风险标签，帮助用户避开高风险机场 VPN 服务。`,
    keywords: '机场榜GateRank,跑路监测,风险观察,机场风险,高风险机场,已跑路机场,GateRank',
  };
}

export function buildDealsSeo(input?: {
  activeDeals?: number;
}): PublicSeoText {
  return {
    title: `机场优惠码大全 | 机场折扣、活动优惠、免费试用与 USDT 支付 | ${PUBLIC_SITE_BRAND_NAME}`,
    description:
      typeof input?.activeDeals === 'number'
        ? `${PUBLIC_SITE_BRAND_NAME} 机场优惠码大全当前展示 ${formatCount(input.activeDeals)} 个机场广告活动，聚合机场折扣、免费试用、新用户优惠与 USDT 支付优惠。优惠信息不影响 GateRank Score。`
        : `${PUBLIC_SITE_BRAND_NAME} 机场优惠码大全聚合机场服务商发布的活动折扣、免费试用、新用户优惠与 USDT 支付优惠。优惠信息不影响 GateRank Score。`,
    keywords: '机场优惠码大全,机场优惠码,机场折扣,机场活动优惠,机场免费试用,USDT支付优惠,GateRank活动优惠,机场榜GateRank',
  };
}

export const DEALS_CONTENT_SECTIONS: PublicDealsContentSection[] = [
  {
    title: '什么是机场优惠码',
    body: '机场优惠码通常是服务商在新用户购买、续费、节日活动或指定套餐中提供的折扣凭证。它只能说明当前有商业活动，不能替代对稳定性、速度、风险记录和售后能力的判断。',
    facts: ['先确认适用套餐和时间范围', '再查看测评报告和风险记录', '优惠信息不影响 GateRank Score'],
  },
  {
    title: '机场优惠码和机场推荐有什么区别',
    body: '优惠码页面展示的是广告活动和公开折扣；机场推荐页面关注测评数据、排名、风险和长期表现。GateRank 不把广告投放、优惠码或活动折扣计入榜单排序。',
    facts: ['优惠码用于省钱', '推荐用于判断服务质量', '广告标识保持可见'],
  },
  {
    title: '如何判断机场折扣是否值得买',
    body: '判断折扣时应同时看原价、折后价、套餐周期、退款规则、试用支持和历史可用性。低价不一定代表更合适，长期套餐尤其需要先确认近期表现和风险信号。',
    facts: ['对比月付折后成本', '优先验证试用或短周期套餐', '关注退款和工单规则'],
  },
  {
    title: '新用户优惠、续费优惠、免费试用有什么区别',
    body: '新用户优惠通常限制首次购买；续费优惠面向已有账号；免费试用更适合先验证节点、客户端和解锁能力。三类活动的限制不同，购买前应以服务商页面和本页活动时间为准。',
    facts: ['新用户优惠看首单限制', '续费优惠看账号资格', '免费试用看流量和时长'],
  },
  {
    title: 'USDT 支付优惠需要注意什么',
    body: 'USDT 支付通常涉及链类型、到账确认、汇率、退款方式和订单备注。使用加密货币前，应确认服务商支持的网络、支付地址、订单有效期和售后处理方式。',
    facts: ['核对链类型和金额', '保留交易哈希', '确认退款是否支持原路返回'],
  },
];

export const DEALS_FAQ_ITEMS: PublicDealsFaqItem[] = [
  {
    question: 'GateRank 的机场优惠码会影响排名吗？',
    answer: '不会。优惠信息、广告投放和优惠码不影响 GateRank Score，也不影响榜单排序。',
  },
  {
    question: '机场优惠码过期了怎么办？',
    answer: '优惠码可能受活动时间、套餐类型和库存限制影响。若优惠码不可用，应以服务商官网结算页提示为准，并避免为了折扣购买不合适的长期套餐。',
  },
  {
    question: '只看折扣力度可以决定购买吗？',
    answer: '不建议只看折扣。建议同时查看测评报告、风险记录、近期稳定性、退款规则、试用支持和支付方式。',
  },
  {
    question: 'USDT 支付优惠一定更划算吗？',
    answer: '不一定。USDT 支付需要考虑网络手续费、汇率、到账确认时间和退款方式，适合能自行核对交易信息的用户。',
  },
];

export function buildDealsStructuredData(
  siteUrl: string,
  deals: AirportDealView[],
  canonicalPath: string = PUBLIC_SEO_PATHS.deals,
): Array<Record<string, unknown>> {
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, '');
  const seo = buildDealsSeo({ activeDeals: deals.length });
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: seo.title,
      description: seo.description,
      url: `${normalizedSiteUrl}${canonicalPath}`,
    },
    buildBreadcrumbJsonLd(normalizedSiteUrl, [
      ['今日推荐', '/'],
      ['活动优惠', canonicalPath],
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: deals.map((deal, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: buildDealOfferJsonLd(normalizedSiteUrl, deal),
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: DEALS_FAQ_ITEMS.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ];
}

export function buildReportSeo(input?: PublicReportSeoView): PublicSeoText {
  const airportName = input?.airport.name;
  const statusLabel = input ? formatAirportStatusLabel(input.airport.status) : undefined;
  const airportKeywords = airportName
    ? `${airportName}怎么样,${airportName}测评,${airportName}跑路,${airportName}官网,${airportName}机场测评,`
    : '';
  const searchName = airportName ? buildReportSearchName(airportName) : undefined;
  return {
    title: airportName
      ? `${searchName}怎么样？${searchName}测评、官网入口、稳定性与跑路风险分析 | ${PUBLIC_SITE_BRAND_NAME}`
      : `机场测评报告 | ${PUBLIC_SITE_BRAND_NAME}`,
    description:
      input && airportName && statusLabel
        ? buildReportDescription(input, airportName, statusLabel)
        : `${PUBLIC_SITE_BRAND_NAME} 测评报告页展示单个机场的榜单位置、评分拆解、关键指标与 30 天趋势。`,
    keywords: `${airportKeywords}机场榜GateRank,机场测评报告,机场评分,机场趋势,机场榜,机场推荐,机场官网,跑路风险,GateRank`,
  };
}

function buildReportDescription(view: PublicReportSeoView, airportName: string, statusLabel: string): string {
  const score = formatPublicScoreText(view);
  const trendLabel = buildReportTrendLabel(view);

  return `${buildReportSearchName(airportName)}测评包含评分${score}、状态${statusLabel}、官网入口、稳定性、下载速度${formatMetric(view.metrics.median_download_mbps)} Mbps、延迟${formatMetric(view.metrics.median_latency_ms)} ms、丢包率${formatMetric(view.metrics.packet_loss_percent)}%、${trendLabel}和跑路风险分析，帮助判断是否值得使用。`;
}

export function buildReportTrendLabel(view: PublicReportSeoView): string {
  const observedDays = getReportObservationDays(view);
  if (observedDays >= 30) {
    return '30 天趋势';
  }
  if (observedDays >= 2) {
    return `近 ${observedDays} 天趋势`;
  }
  return '近期趋势';
}

export function getReportObservationDays(view: PublicReportSeoView): number {
  return Math.max(
    view.trends.score_30d.length,
    view.trends.uptime_30d.length,
    view.trends.latency_30d.length,
    view.trends.download_30d.length,
  );
}

function buildReportTrendText(view: PublicReportSeoView): string {
  const scoreTrend = view.trends.score_30d;
  const trendLabel = buildReportTrendLabel(view);
  if (scoreTrend.length >= 2) {
    const first = scoreTrend[0]?.value;
    const last = scoreTrend[scoreTrend.length - 1]?.value;
    if (typeof first === 'number' && typeof last === 'number') {
      const delta = last - first;
      const direction = delta > 0 ? '上升' : delta < 0 ? '下降' : '持平';
      return `${trendLabel}${direction}`;
    }
  }
  return trendLabel;
}

export function buildReportFaqItems(view: PublicReportSeoView): PublicReportFaqItem[] {
  const airportName = view.airport.name;
  const statusLabel = formatAirportStatusLabel(view.airport.status);
  const riskAnswer = buildReportRiskAnswer(view);
  const planText = buildPlanSummaryText(view);
  const regionText = buildRegionSummaryText(view);
  const clientText = buildListSummary(view.capabilities.clients, '客户端未收录');
  const streamingText = buildListSummary(view.capabilities.streaming, '流媒体解锁能力未收录');
  const chatGptSupport = view.capabilities.streaming.some((item) => item.key === 'chatgpt' || /chatgpt/i.test(item.label));
  const trialText = formatNullableSupportText(view.capabilities.plan.has_trial_plan);

  return [
    {
      question: `${airportName}怎么样？`,
      answer: `${airportName} 当前公开总分${formatPublicScoreText(view)}，状态为${statusLabel}。GateRank 当前报告结论为：${view.summary_card.conclusion}`,
    },
    {
      question: `${airportName}测评怎么看？`,
      answer: `${airportName} 测评主要看榜单位置、稳定性 S=${formatMetric(view.score_breakdown.s)}、性能 P=${formatMetric(view.score_breakdown.p)}、价格 C=${formatMetric(view.score_breakdown.c)}、风险 R=${formatMetric(view.score_breakdown.r)}，以及 30 天可用率 ${formatMetric(view.metrics.uptime_percent_30d)}%、中位延迟 ${formatMetric(view.metrics.median_latency_ms)} ms、下载速率 ${formatMetric(view.metrics.median_download_mbps)} Mbps。`,
    },
    {
      question: `${airportName}官网是什么？`,
      answer: `${airportName} 在 GateRank 当前记录中的官网入口为 ${view.airport.website}。访问前建议同时查看本页的状态、风险惩罚、投诉记录和历史异常。`,
    },
    {
      question: `${airportName}跑路风险高吗？`,
      answer: riskAnswer,
    },
    {
      question: `${airportName}适合长期使用吗？`,
      answer: `${airportName} 当前公开总分${formatPublicScoreText(view)}，稳定性评级为${formatStabilityTierLabel(view.metrics.stability_tier)}，健康记录 ${view.metrics.healthy_days_streak} 天。是否长期使用仍建议结合官网可达性、30 天趋势、套餐价格和风险扣分一起判断。`,
    },
    {
      question: `${airportName}风险主要来自哪里？`,
      answer: `${airportName} 当前风险惩罚为 ${formatMetric(view.score_breakdown.risk_penalty)}，其中官网探测扣分 ${formatMetric(view.score_breakdown.domain_penalty)}、SSL 扣分 ${formatMetric(view.score_breakdown.ssl_penalty)}、投诉扣分 ${formatMetric(view.score_breakdown.complaint_penalty)}、历史异常扣分 ${formatMetric(view.score_breakdown.history_penalty)}。`,
    },
    {
      question: `${airportName}支持哪些套餐、客户端和地区？`,
      answer: `${airportName} 套餐情况：${planText}。客户端支持：${clientText}。节点覆盖：${regionText}。`,
    },
    {
      question: `${airportName}适合新手使用吗？`,
      answer: `${airportName} 当前客户端支持记录为 ${clientText}，导入方式为 ${buildListSummary(view.capabilities.import_methods, '导入方式未收录')}，试用记录为${trialText}。新手使用前建议先核对官网入口、教程和订阅导入方式。`,
    },
    {
      question: `${airportName}支持流媒体吗？`,
      answer: `${airportName} 当前流媒体和解锁能力记录为 ${streamingText}。这些能力来自公开资料与监测整理，具体节点在不同时间的可用性仍需以实际测试为准。`,
    },
    {
      question: `${airportName}支持 ChatGPT 和 AI 工具吗？`,
      answer: chatGptSupport
        ? `${airportName} 当前能力记录包含 ChatGPT，可作为 AI 工具访问场景的候选；仍建议结合延迟 ${formatMetric(view.metrics.median_latency_ms)} ms、丢包率 ${formatMetric(view.metrics.packet_loss_percent)}% 和近期趋势判断。`
        : `${airportName} 当前未收录 ChatGPT 支持记录，是否适合 AI 工具访问需要以官网说明和实际节点测试为准。`,
    },
    {
      question: `${airportName}速度怎么样？`,
      answer: `${airportName} 当前中位延迟为 ${formatMetric(view.metrics.median_latency_ms)} ms，下载速率为 ${formatMetric(view.metrics.median_download_mbps)} Mbps，丢包率为 ${formatMetric(view.metrics.packet_loss_percent)}%，可结合${buildReportTrendLabel(view)}继续观察。`,
    },
    {
      question: `${airportName}和其他机场相比有什么优势？`,
      answer: `${airportName} 当前公开总分${formatPublicScoreText(view)}，稳定性 S=${formatMetric(view.score_breakdown.s)}、性能 P=${formatMetric(view.score_breakdown.p)}、价格 C=${formatMetric(view.score_breakdown.c)}、风险 R=${formatMetric(view.score_breakdown.r)}。它的优势需要放到全量榜单、稳定榜和性价比筛选中横向比较。`,
    },
    {
      question: `选择${airportName}前要注意什么？`,
      answer: `选择${airportName}前，建议核对官网入口、当前状态${statusLabel}、风险惩罚 ${formatMetric(view.score_breakdown.risk_penalty)}、近期投诉 ${view.metrics.recent_complaints_count} 条、历史异常 ${view.metrics.history_incidents} 次、套餐价格和${buildReportTrendLabel(view)}，不要只按单次测速或单日分数决定长期使用。`,
    },
  ];
}

export function buildReportContentSections(view: PublicReportSeoView): PublicReportContentSection[] {
  const airportName = view.airport.name;
  const statusLabel = formatAirportStatusLabel(view.airport.status);
  const score = formatPublicScoreText(view);
  const trendText = buildReportTrendText(view);
  const trendLabel = buildReportTrendLabel(view);
  const scoreDeltaText = buildTrendDeltaText(view.trends.score_30d, '分');
  const uptimeTrendText = buildTrendDeltaText(view.trends.uptime_30d, '个百分点');
  const latencyTrendText = buildTrendDeltaText(view.trends.latency_30d, ' ms');
  const downloadTrendText = buildTrendDeltaText(view.trends.download_30d, ' Mbps');
  const planText = buildPlanSummaryText(view);
  const regionText = buildRegionSummaryText(view);
  const clientText = buildListSummary(view.capabilities.clients, '客户端未收录');
  const streamingText = buildListSummary(view.capabilities.streaming, '解锁能力未收录');
  const importText = buildListSummary(view.capabilities.import_methods, '导入方式未收录');
  const paymentText = buildListSummary(view.capabilities.payment_methods, '支付方式未收录');
  const telegramText = buildTelegramSummaryText(view);

  return [
    {
      title: '综合结论',
      body: `${airportName} 当前 GateRank 公开总分${score}，状态为${statusLabel}。本页把 ${airportName} 机场测评拆成评分、风险、稳定性、性能、套餐、节点和售后信息，适合在选择机场 VPN 前做事实核对。${view.summary_card.conclusion}`,
      facts: [
        `数据日期 ${view.date}`,
        `${trendLabel}${trendText.replace(trendLabel, '') || '持平'}`,
        `综合评级 ${buildScoreGradeText(view.summary_card.score)}`,
      ],
    },
    {
      title: '风险解读',
      body: `${airportName} 当前风险惩罚为 ${formatMetric(view.score_breakdown.risk_penalty)}，风险维度得分 R=${formatMetric(view.score_breakdown.r)}。细分来看，官网探测扣分 ${formatMetric(view.score_breakdown.domain_penalty)}，SSL 扣分 ${formatMetric(view.score_breakdown.ssl_penalty)}，投诉扣分 ${formatMetric(view.score_breakdown.complaint_penalty)}，历史异常扣分 ${formatMetric(view.score_breakdown.history_penalty)}；近期投诉 ${view.metrics.recent_complaints_count} 条，历史异常 ${view.metrics.history_incidents} 次。`,
      facts: [
        `状态 ${statusLabel}`,
        `风险惩罚 ${formatMetric(view.score_breakdown.risk_penalty)}`,
        `官网探测扣分 ${formatMetric(view.score_breakdown.domain_penalty)}`,
        `SSL 扣分 ${formatMetric(view.score_breakdown.ssl_penalty)}`,
      ],
    },
    {
      title: '稳定性与性能',
      body: `${airportName} 近 30 天可用率为 ${formatMetric(view.metrics.uptime_percent_30d)}%，稳定性评级为${formatStabilityTierLabel(view.metrics.stability_tier)}，健康记录 ${view.metrics.healthy_days_streak} 天。性能侧的中位延迟为 ${formatMetric(view.metrics.median_latency_ms)} ms，下载速率为 ${formatMetric(view.metrics.median_download_mbps)} Mbps，丢包率为 ${formatMetric(view.metrics.packet_loss_percent)}%。趋势上，评分${scoreDeltaText}，可用率${uptimeTrendText}，延迟${latencyTrendText}，下载${downloadTrendText}。`,
      facts: [
        `30 天可用率 ${formatMetric(view.metrics.uptime_percent_30d)}%`,
        `中位延迟 ${formatMetric(view.metrics.median_latency_ms)} ms`,
        `下载速率 ${formatMetric(view.metrics.median_download_mbps)} Mbps`,
        `丢包率 ${formatMetric(view.metrics.packet_loss_percent)}%`,
      ],
    },
    {
      title: '套餐与试用',
      body: `${airportName} 的套餐信息显示：${planText}。最低月付价格为 ${formatOptionalCurrencyText(view.capabilities.plan.lowest_monthly_price)}，最低年付折算月价为 ${formatOptionalCurrencyText(view.capabilities.plan.lowest_annual_monthly_price)}，支付方式当前记录为 ${paymentText}。`,
      facts: [
        `月付 ${formatNullableSupportText(view.capabilities.plan.supports_monthly)}`,
        `年付 ${formatNullableSupportText(view.capabilities.plan.supports_annual)}`,
        `试用 ${formatNullableSupportText(view.capabilities.plan.has_trial_plan)}`,
        `支付方式 ${paymentText}`,
      ],
    },
    {
      title: '节点、客户端与解锁',
      body: `${airportName} 当前节点覆盖记录为 ${regionText}。客户端支持记录为 ${clientText}，导入方式为 ${importText}，解锁能力包括 ${streamingText}。这些信息用于判断日常使用、跨区访问和新手配置成本，不代表所有节点在任意时间都保持同等表现。`,
      facts: [
        `地区 ${regionText}`,
        `客户端 ${clientText}`,
        `导入 ${importText}`,
        `解锁 ${streamingText}`,
      ],
    },
    {
      title: 'Telegram 与售后',
      body: `${airportName} 的售后与社区记录显示：${telegramText}。如果准备购买或续费，建议先核对官网入口、Telegram 活跃度、订阅可用性和本页风险记录，再决定是否长期使用。`,
      facts: [
        `Telegram 群 ${formatNullableSupportText(view.capabilities.telegram.has_group)}`,
        `Telegram 频道 ${formatNullableSupportText(view.capabilities.telegram.has_channel)}`,
        `客服 Bot ${formatNullableSupportText(view.capabilities.telegram.has_customer_service_bot)}`,
        `工单系统 ${formatNullableSupportText(view.capabilities.telegram.has_ticket_system)}`,
      ],
    },
    {
      title: '适合哪些用户',
      body: buildReportFitText(view),
      facts: [
        `稳定性 ${formatStabilityTierLabel(view.metrics.stability_tier)}`,
        `延迟 ${formatMetric(view.metrics.median_latency_ms)} ms`,
        `下载 ${formatMetric(view.metrics.median_download_mbps)} Mbps`,
        `解锁 ${streamingText}`,
      ],
    },
    {
      title: '选择前要注意什么',
      body: `选择 ${airportName} 前，建议重点核对当前评分是否持续、${trendLabel}是否稳定、官网入口是否可访问、延迟和丢包率是否异常、投诉与历史异常是否增加，以及套餐、退款、试用、USDT、流媒体和 AI 工具支持是否符合自己的使用场景。GateRank 分数只能作为辅助决策依据，不能替代用户自己的试用和判断。`,
      facts: [
        `近期投诉 ${view.metrics.recent_complaints_count} 条`,
        `历史异常 ${view.metrics.history_incidents} 次`,
        `支付方式 ${paymentText}`,
        `试用 ${formatNullableSupportText(view.capabilities.plan.has_trial_plan)}`,
      ],
    },
  ];
}

export function buildReportContentSummary(view: PublicReportSeoView): PublicReportContentSummary {
  const airportName = view.airport.name;
  const statusLabel = formatAirportStatusLabel(view.airport.status);
  return {
    body: `${airportName} 当前公开总分${formatPublicScoreText(view)}，状态为${statusLabel}。本页汇总风险、稳定性、性能、套餐、节点和售后事实；详细解读已折叠保留，可展开核对。`,
    chips: [
      `总分 ${formatPublicScoreText(view)}`,
      `状态 ${statusLabel}`,
      `风险惩罚 ${formatMetric(view.score_breakdown.risk_penalty)}`,
      `官网扣分 ${formatMetric(view.score_breakdown.domain_penalty)}`,
      `SSL 扣分 ${formatMetric(view.score_breakdown.ssl_penalty)}`,
      `30 天可用率 ${formatMetric(view.metrics.uptime_percent_30d)}%`,
      `中位延迟 ${formatMetric(view.metrics.median_latency_ms)} ms`,
      `试用 ${formatNullableSupportText(view.capabilities.plan.has_trial_plan)}`,
    ],
  };
}

export function buildReportComparisonLinks(view: PublicReportSeoView): PublicReportComparisonLink[] {
  const links: PublicReportComparisonLink[] = [
    { label: '机场推荐榜', href: PUBLIC_SEO_PATHS.fullRanking },
  ];

  if (typeof view.ranking.most_stable_rank === 'number') {
    links.push({ label: '稳定机场榜', href: PUBLIC_SEO_PATHS.fullRanking });
  }
  if (typeof view.ranking.best_value_rank === 'number') {
    links.push({ label: '性价比机场榜', href: PUBLIC_SEO_PATHS.fullRanking });
  }
  if (view.capabilities.payment_methods.some((item) => item.key === 'usdt_trc20')) {
    links.push({ label: '支持 USDT 的机场', href: buildFullRankingFilterHref('payment', 'usdt_trc20') });
  }
  if (view.capabilities.streaming.some((item) => item.key === 'netflix')) {
    links.push({ label: '支持流媒体的机场', href: buildFullRankingFilterHref('streaming', 'netflix') });
  }
  if (view.capabilities.streaming.some((item) => item.key === 'chatgpt')) {
    links.push({ label: '支持 AI 工具的机场', href: buildFullRankingFilterHref('streaming', 'chatgpt') });
  }

  return dedupeReportComparisonLinks(links).slice(0, 6);
}

export function buildReportStructuredData(
  siteUrl: string,
  canonicalPath: string,
  seo: PublicSeoText,
  view: PublicReportSeoView,
): Array<Record<string, unknown>> {
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: seo.title,
      description: seo.description,
      url: canonicalUrl,
      about: {
        '@type': 'Thing',
        name: view.airport.name,
        url: view.airport.website,
        additionalProperty: [
          buildPropertyValue('公开总分', formatPublicScoreText(view)),
          buildPropertyValue('状态', formatAirportStatusLabel(view.airport.status)),
          buildPropertyValue('数据日期', view.date),
          buildPropertyValue('30天可用率', `${formatMetric(view.metrics.uptime_percent_30d)}%`),
          buildPropertyValue('风险惩罚', formatMetric(view.score_breakdown.risk_penalty)),
          buildPropertyValue('官网探测扣分', formatMetric(view.score_breakdown.domain_penalty)),
          buildPropertyValue('SSL扣分', formatMetric(view.score_breakdown.ssl_penalty)),
          buildPropertyValue('投诉扣分', formatMetric(view.score_breakdown.complaint_penalty)),
          buildPropertyValue('历史异常扣分', formatMetric(view.score_breakdown.history_penalty)),
          buildPropertyValue('稳定性评级', formatStabilityTierLabel(view.metrics.stability_tier)),
          buildPropertyValue('中位延迟', `${formatMetric(view.metrics.median_latency_ms)} ms`),
          buildPropertyValue('下载速率', `${formatMetric(view.metrics.median_download_mbps)} Mbps`),
          buildPropertyValue('套餐信息', buildPlanSummaryText(view)),
          buildPropertyValue('节点地区', buildRegionSummaryText(view)),
          buildPropertyValue('客户端支持', buildListSummary(view.capabilities.clients, '客户端未收录')),
          buildPropertyValue('售后支持', buildTelegramSummaryText(view)),
        ],
      },
    },
    buildBreadcrumbJsonLd(siteUrl, [
      ['首页', '/'],
      [view.airport.name, canonicalPath],
    ]),
    buildReportRankingItemList(siteUrl, view),
    buildReportProductReviewJsonLd(siteUrl, canonicalPath, seo, view),
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: buildReportFaqItems(view).map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ];
}

export function buildReportProductReviewJsonLd(
  siteUrl: string,
  canonicalPath: string,
  seo: PublicSeoText,
  view: PublicReportSeoView,
): Record<string, unknown> {
  const canonicalUrl = `${siteUrl}${canonicalPath}`;
  const ratingValue = view.summary_card.score_hidden || view.summary_card.score === null
    ? null
    : formatMetric(view.summary_card.score);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: buildReportSearchName(view.airport.name),
    description: seo.description,
    url: canonicalUrl,
    category: '机场 VPN 服务',
    brand: {
      '@type': 'Brand',
      name: view.airport.name,
    },
    sameAs: view.airport.website,
    additionalProperty: [
      buildPropertyValue('GateRank算法评分说明', 'GateRank Score 是公开监测算法评分，不是用户评分或付费排名。'),
      buildPropertyValue('稳定性S', formatMetric(view.score_breakdown.s)),
      buildPropertyValue('性能P', formatMetric(view.score_breakdown.p)),
      buildPropertyValue('价格C', formatMetric(view.score_breakdown.c)),
      buildPropertyValue('风险R', formatMetric(view.score_breakdown.r)),
      buildPropertyValue('风险惩罚', formatMetric(view.score_breakdown.risk_penalty)),
      buildPropertyValue('近期趋势', buildReportTrendLabel(view)),
    ],
    review: {
      '@type': 'Review',
      author: {
        '@type': 'Organization',
        name: PUBLIC_SITE_BRAND_NAME,
      },
      name: `${view.airport.name} GateRank 算法测评`,
      reviewBody: `GateRank 算法评分基于公开监测数据生成，当前总分${formatPublicScoreText(view)}，状态${formatAirportStatusLabel(view.airport.status)}，稳定性 S=${formatMetric(view.score_breakdown.s)}，性能 P=${formatMetric(view.score_breakdown.p)}，价格 C=${formatMetric(view.score_breakdown.c)}，风险 R=${formatMetric(view.score_breakdown.r)}。该结论不是用户评价，也不是付费排名。`,
      datePublished: view.date,
      ...(ratingValue
        ? {
          reviewRating: {
            '@type': 'Rating',
            ratingValue,
            bestRating: '100',
            worstRating: '0',
          },
        }
        : {}),
    },
  };
}

export const METHODOLOGY_SEO: PublicSeoText = {
  title: `机场测评方法 | 评分规则、测速标准、风险扣分与推荐依据 | ${PUBLIC_SITE_BRAND_NAME}`,
  description: `${PUBLIC_SITE_BRAND_NAME} 方法页系统说明机场测评方法、机场评分规则与机场测速标准，拆解稳定性、性能、价格、风险扣分、阈值分段、时间衰减、每日重算和机场推荐依据，帮助理解机场 VPN 排名如何生成。`,
  keywords: '机场榜GateRank,机场测评方法,机场评分规则,机场测速标准,机场推荐依据,机场VPN排名,VPN机场测评,风险扣分,时间衰减,GateRank',
};

export const APPLY_SEO: PublicSeoText = {
  title: `申请入驻测试 | ${PUBLIC_SITE_BRAND_NAME}`,
  description: `${PUBLIC_SITE_BRAND_NAME} 申请入驻测试页用于提交机场基础信息、官网地址、测试账号、订阅资料与联系方式，供后台完成资料审核、支付确认、自动测速接入、流程管理和后续运营沟通。`,
  keywords: '机场榜GateRank,申请入驻测试,机场申请,机场收录,机场测试资料,GateRank',
};

export function buildReportPath(airportId: number, date?: string): string {
  return `/reports/${airportId}${buildQuery({ date })}`;
}

export function buildAirportReportPath(slug: string): string {
  return `/airports/${normalizeAirportSlug(slug)}`;
}

export function normalizeAirportSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 160)
    .replace(/-+$/g, '');
}

export function buildAirportSlugCandidate(input: { name?: string | null; website?: string | null }): string {
  const websiteSlug = slugFromWebsite(input.website || '');
  if (websiteSlug) {
    return websiteSlug;
  }
  return normalizeAirportSlug(input.name || '');
}

function slugFromWebsite(website: string): string {
  const raw = website.trim();
  if (!raw) {
    return '';
  }

  try {
    const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    const hostname = new URL(withProtocol).hostname
      .replace(/^www\./i, '')
      .replace(/\.$/, '');
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length >= 2) {
      return normalizeAirportSlug(parts.slice(0, -1).join('-'));
    }
    return normalizeAirportSlug(hostname);
  } catch {
    return normalizeAirportSlug(raw);
  }
}

function buildReportSearchName(airportName: string): string {
  return airportName.endsWith('机场') ? airportName : `${airportName}机场`;
}

function buildReportFitText(view: PublicReportSeoView): string {
  const airportName = view.airport.name;
  const stableText = formatStabilityTierLabel(view.metrics.stability_tier);
  const streamingText = buildListSummary(view.capabilities.streaming, '流媒体解锁能力未收录');
  const clientText = buildListSummary(view.capabilities.clients, '客户端未收录');
  const scoreText = formatPublicScoreText(view);
  const cautionText = getReportObservationDays(view) < 30
    ? `但当前${buildReportTrendLabel(view)}样本仍短于 30 天，长期可靠性需要继续跟踪。`
    : `同时仍需结合后续数据、官网状态和风险记录继续判断长期可靠性。`;

  return `${airportName} 更适合重视稳定性、低延迟、日常网页访问、流媒体或 AI 工具访问的用户。当前公开总分${scoreText}，稳定性评级为${stableText}，中位延迟 ${formatMetric(view.metrics.median_latency_ms)} ms，下载速率 ${formatMetric(view.metrics.median_download_mbps)} Mbps，丢包率 ${formatMetric(view.metrics.packet_loss_percent)}%，客户端支持记录为 ${clientText}，解锁能力记录为 ${streamingText}。${cautionText}`;
}

function buildFullRankingFilterHref(category: 'payment' | 'streaming', key: string): string {
  const catalog = category === 'payment' ? AIRPORT_PAYMENT_FILTERS : AIRPORT_STREAMING_FILTERS;
  const supported = catalog.some((item) => item.key === key);
  return supported ? buildFullRankingStaticPath(category, key) : PUBLIC_SEO_PATHS.fullRanking;
}

function dedupeReportComparisonLinks(links: PublicReportComparisonLink[]): PublicReportComparisonLink[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.label}|${link.href}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function formatAirportStatusLabel(status: string): string {
  if (status === 'normal') return '正常';
  if (status === 'risk') return '风险';
  if (status === 'down') return '跑路';
  return status;
}

export function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildListSummary(items: Array<{ label: string }>, emptyLabel: string, limit = 6): string {
  if (items.length === 0) {
    return emptyLabel;
  }
  const labels = items.slice(0, limit).map((item) => item.label);
  const suffix = items.length > limit ? `等 ${items.length} 项` : '';
  return `${labels.join('、')}${suffix}`;
}

function buildPlanSummaryText(view: PublicReportSeoView): string {
  const plan = view.capabilities.plan;
  const parts = [
    `月付${formatNullableSupportText(plan.supports_monthly)}`,
    `季付${formatNullableSupportText(plan.supports_quarterly)}`,
    `半年付${formatNullableSupportText(plan.supports_half_yearly)}`,
    `年付${formatNullableSupportText(plan.supports_annual)}`,
    `试用${formatNullableSupportText(plan.has_trial_plan)}`,
    `不限时套餐${formatNullableSupportText(plan.has_lifetime_plan)}`,
  ];
  return parts.join('，');
}

function buildRegionSummaryText(view: PublicReportSeoView): string {
  const regions = view.capabilities.regions;
  if (regions.length === 0) {
    return '节点地区未收录';
  }
  const labels = regions.slice(0, 5).map((region) => {
    const nodeCount = region.node_count > 0 ? ` ${region.node_count}节点` : '';
    const lineTypes = region.line_types.length > 0 ? ` ${region.line_types.join('/')}` : '';
    const nativeIp = region.has_native_ip ? ' 原生IP' : '';
    const residential = region.has_residential ? ' 家宽' : '';
    return `${region.label}${nodeCount}${lineTypes}${nativeIp}${residential}`;
  });
  return `${labels.join('、')}${regions.length > 5 ? `等 ${regions.length} 个地区` : ''}`;
}

function buildTelegramSummaryText(view: PublicReportSeoView): string {
  const telegram = view.capabilities.telegram;
  const memberText = telegram.group_member_count === null ? '群人数未收录' : `群人数 ${formatCount(telegram.group_member_count)} 人`;
  const activeText = telegram.recent_active_at ? `最近活跃 ${telegram.recent_active_at}` : '最近活跃时间未收录';
  return [
    `Telegram 群${formatNullableSupportText(telegram.has_group)}`,
    `频道${formatNullableSupportText(telegram.has_channel)}`,
    `群内发言${formatNullableSupportText(telegram.group_allows_speaking)}`,
    `客服 Bot ${formatNullableSupportText(telegram.has_customer_service_bot)}`,
    `工单系统${formatNullableSupportText(telegram.has_ticket_system)}`,
    memberText,
    activeText,
  ].join('，');
}

function buildTrendDeltaText(points: Array<{ value: number }>, unit: string): string {
  if (points.length < 2) {
    return '暂无足够 30 天趋势样本';
  }
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  if (typeof first !== 'number' || typeof last !== 'number') {
    return '暂无足够 30 天趋势样本';
  }
  const delta = last - first;
  if (delta > 0) {
    return `上升 ${formatMetric(delta)}${unit}`;
  }
  if (delta < 0) {
    return `下降 ${formatMetric(Math.abs(delta))}${unit}`;
  }
  return '持平';
}

function formatNullableSupportText(value: boolean | null | undefined): string {
  if (value === true) return '支持';
  if (value === false) return '不支持';
  return '未收录';
}

function formatOptionalCurrencyText(value: number | null | undefined): string {
  return value === null || value === undefined ? '未收录' : `¥${formatMetric(value)}`;
}

function formatStabilityTierLabel(tier: string): string {
  if (tier === 'stable') return '稳定';
  if (tier === 'minor_fluctuation') return '轻微波动';
  if (tier === 'unstable') return '波动';
  if (tier === 'unknown') return '未收录';
  return tier;
}

function formatPublicScoreText(view: PublicReportSeoView): string {
  return view.summary_card.score_hidden || view.summary_card.score === null
    ? '暂不公开'
    : `${formatMetric(view.summary_card.score)}/100`;
}

function buildScoreGradeText(score: number | null): string {
  if (score === null) return '暂不公开';
  if (score >= 90) return '优秀';
  if (score >= 80) return '稳健';
  if (score >= 70) return '可观察';
  if (score >= 60) return '谨慎';
  return '评级受限';
}

function buildReportRiskAnswer(view: PublicReportSeoView): string {
  const airportName = view.airport.name;
  const statusLabel = formatAirportStatusLabel(view.airport.status);
  const riskPenalty = formatMetric(view.score_breakdown.risk_penalty);
  const complaintCount = view.metrics.recent_complaints_count;
  const historyIncidents = view.metrics.history_incidents;

  if (view.airport.status === 'down') {
    return `${airportName} 当前状态为${statusLabel}，GateRank 已将其纳入高风险记录。当前风险惩罚为 ${riskPenalty}，近期投诉 ${complaintCount} 条，历史异常 ${historyIncidents} 次。`;
  }
  if (view.airport.status === 'risk') {
    return `${airportName} 当前状态为${statusLabel}，需要结合风险惩罚、近期投诉和历史异常判断。当前风险惩罚为 ${riskPenalty}，近期投诉 ${complaintCount} 条，历史异常 ${historyIncidents} 次。`;
  }
  return `${airportName} 当前状态为${statusLabel}，未被标记为跑路。当前风险惩罚为 ${riskPenalty}，近期投诉 ${complaintCount} 条，历史异常 ${historyIncidents} 次；这只是当前监测结果，不代表未来没有风险。`;
}

function buildPropertyValue(name: string, value: string): Record<string, string> {
  return {
    '@type': 'PropertyValue',
    name,
    value,
  };
}

function buildBreadcrumbJsonLd(siteUrl: string, items: Array<[string, string]>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name,
      item: `${siteUrl}${path}`,
    })),
  };
}

function buildDealOfferJsonLd(siteUrl: string, deal: AirportDealView): Record<string, unknown> {
  const websiteUrl = normalizeExternalHref(deal.website);
  const reportUrl = `${siteUrl}${deal.report_url}`;
  return {
    '@type': 'Offer',
    name: `${deal.airport_name} ${deal.discount_title || '机场优惠码'}`,
    description: deal.discount_description,
    url: reportUrl,
    validFrom: deal.starts_at,
    validThrough: deal.ends_at,
    availability: 'https://schema.org/InStock',
    seller: {
      '@type': 'Organization',
      name: deal.airport_name,
      url: websiteUrl,
    },
    category: '机场优惠码',
    itemOffered: {
      '@type': 'Service',
      name: deal.airport_name,
      url: reportUrl,
      provider: {
        '@type': 'Organization',
        name: deal.airport_name,
        url: websiteUrl,
      },
    },
  };
}

function normalizeExternalHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function buildReportRankingItemList(siteUrl: string, view: PublicReportSeoView): Record<string, unknown> {
  const rankingPairs: Array<[string, number | null]> = [
    ['今日推荐', view.ranking.today_pick_rank],
    ['长期稳定', view.ranking.most_stable_rank],
    ['性价比', view.ranking.best_value_rank],
    ['新入榜', view.ranking.new_entries_rank],
    ['风险预警', view.ranking.risk_alerts_rank],
  ];
  const rankingItems = rankingPairs.filter((item): item is [string, number] => typeof item[1] === 'number');

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${view.airport.name} 榜单位置`,
    numberOfItems: rankingItems.length,
    itemListElement: rankingItems.map(([name, rank], index) => ({
      '@type': 'ListItem',
      position: rank,
      name,
      item: `${siteUrl}${buildAirportReportPath(view.airport.slug)}`,
      additionalType: index === 0 ? 'today_pick' : undefined,
    })),
  };
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
