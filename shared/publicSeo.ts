import { PUBLIC_SITE_BRAND_NAME } from './publicBrand';
import {
  getFullRankingFilterCount,
  getFullRankingSeoDecision,
  hasFullRankingFilters,
  type FullRankingFilters,
} from './fullRankingFilters';
import { AIRPORT_PAYMENT_FILTERS, AIRPORT_STREAMING_FILTERS } from './airportFilterCatalog';
import type { AirportDealView } from './airportAds';

export interface PublicSeoText {
  title: string;
  description: string;
  keywords: string;
}

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

export const PUBLIC_SEO_PATHS = {
  home: '/',
  fullRanking: '/rankings/all',
  deals: '/deals',
  methodology: '/methodology',
  apply: '/apply',
  riskMonitor: '/risk-monitor',
  forAi: '/for-ai',
} as const;

export const PUBLIC_SEO_STATIC_LASTMOD = '2026-05-17T00:00:00+08:00';
export const PUBLIC_DEALS_LASTMOD = '2026-05-26T00:00:00+08:00';

export function buildHomeSeo(input?: {
  dateLabel?: string;
  monitoredAirports?: number;
  realtimeTests?: number;
}): PublicSeoText {
  return {
    title: `${PUBLIC_SITE_BRAND_NAME} | 机场 VPN 推荐、科学上网机场测评与可靠性榜单`,
    description:
      input && typeof input.monitoredAirports === 'number' && typeof input.realtimeTests === 'number'
        ? `${input.dateLabel || '今日'} 机场 VPN 榜单已更新，当前监测 ${formatCount(input.monitoredAirports)} 个机场、累计实时测速 ${formatCount(input.realtimeTests)} 次，覆盖今日推荐、长期稳定、性价比、新入榜与风险预警，适合查找 VPN、科学上网、魔法与梯子相关机场参考。`
        : `${PUBLIC_SITE_BRAND_NAME} 提供今日推荐、长期稳定、性价比与风险预警等多维机场 VPN 榜单，帮助用户快速筛选值得关注的 VPN、科学上网、魔法和梯子测评报告。`,
    keywords: '机场榜GateRank,机场榜,机场推荐,机场VPN,VPN,科学上网,魔法,梯子,今日推荐机场,机场测评,稳定机场,风险预警,GateRank',
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
          ? `${input.dateLabel || '今日'} ${title}收录 ${formatCount(input.total)} 个匹配机场，按公开展示分数排序，展示官网入口、状态、价格、试用、支付、客户端、节点地区和测评报告。`
          : `${PUBLIC_SITE_BRAND_NAME} 提供${title}，帮助用户按支付方式、客户端类型、节点地区和线路能力筛选机场 VPN。`,
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
    return `${label}的机场 VPN 排名`;
  }
  if (category === 'client') {
    return `${label}机场推荐`;
  }
  if (category === 'region') {
    return `${label}机场排行榜`;
  }
  if (category === 'line') {
    return `${label}机场排名`;
  }
  if (category === 'streaming') {
    return `${label}机场推荐`;
  }
  return `${label}机场筛选`;
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
  return supported ? `${PUBLIC_SEO_PATHS.fullRanking}${buildQuery({ [category]: key })}` : PUBLIC_SEO_PATHS.fullRanking;
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
