import { PUBLIC_SITE_BRAND_NAME } from '../../../shared/publicBrand';
import { METHODOLOGY_SEO } from '../../../shared/publicSeo';

const SCORE_WEIGHTS = {
  stability: { uptime: 0.5, stability: 0.3, streak: 0.2 },
  performance: { latency: 0.4, speed: 0.4, loss: 0.2 },
  cost: { price: 0.8, value: 0.2 },
  final: { s: 0.4, p: 0.3, c: 0.1, r: 0.2 },
  decay: { recent: 0.7, historical: 0.3 },
} as const;

const THRESHOLDS = {
  latencyMs: { good: 60, bad: 600, higherIsBetter: false },
  downloadMbps: { good: 300, bad: 10, higherIsBetter: true },
  packetLossPercent: { good: 0, bad: 5, higherIsBetter: false },
  valueRatio: { good: 50, bad: 0, higherIsBetter: true },
} as const;

const STABILITY_RULES = {
  uptimeBaseline: 95,
  minHealthyDailyUptimePercent: 95,
  minDailyUptimePercent: 99,
  streakCapDays: 30,
  maxLatencyCv: 0.2,
  maxMinorLatencyCv: 0.35,
  trimMinSampleCount: 6,
  trimMaxSampleCount: 1,
  latencyPenaltyBands: [
    { maxLatencyMs: 200, penalty: 0 },
    { maxLatencyMs: 300, penalty: 0.1 },
    { maxLatencyMs: 500, penalty: 0.25 },
    { maxLatencyMs: 800, penalty: 0.45 },
    { maxLatencyMs: 1200, penalty: 0.65 },
    { maxLatencyMs: 2000, penalty: 0.8 },
    { maxLatencyMs: Number.POSITIVE_INFINITY, penalty: 0.95 },
  ],
} as const;

const TIME_DECAY_LAMBDA = 0.1;

export const methodologySeo = METHODOLOGY_SEO;

export const heroStats = [
  { label: '评分维度', value: '4', note: '稳定性 / 性能 / 价格 / 风险' },
  { label: '主公式', value: 'S/P/C/R', note: '0.4 / 0.3 / 0.1 / 0.2 权重' },
  { label: '更新频率', value: '每日重算', note: '近期样本优先，历史表现保留' },
] as const;

export const totalScoreParts = [
  {
    key: 's',
    label: 'S',
    title: '稳定性',
    weight: SCORE_WEIGHTS.final.s,
    percent: 40,
    description: '综合可用率、稳健波动值和连续健康天数，降低偶发测速对结论的影响。',
    accentClass: 'bg-emerald-500',
    softClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  {
    key: 'p',
    label: 'P',
    title: '性能',
    weight: SCORE_WEIGHTS.final.p,
    percent: 30,
    description: '使用中位延迟、下载速率和代理请求失败率，衡量真实连接体验而非单次峰值。',
    accentClass: 'bg-sky-500',
    softClass: 'bg-sky-50 border-sky-200 text-sky-800',
  },
  {
    key: 'c',
    label: 'C',
    title: '价格',
    weight: SCORE_WEIGHTS.final.c,
    percent: 10,
    description: '结合月付价格档位和速度价格比，校正低价与高价的价值差异。',
    accentClass: 'bg-amber-500',
    softClass: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  {
    key: 'r',
    label: 'R',
    title: '风险',
    weight: SCORE_WEIGHTS.final.r,
    percent: 20,
    description: '纳入域名、SSL、投诉与历史异常，避免高性能样本掩盖信任风险。',
    accentClass: 'bg-rose-500',
    softClass: 'bg-rose-50 border-rose-200 text-rose-800',
  },
] as const;

export const dimensionCards = [
  {
    code: 'S',
    title: '稳定性',
    summary: '判断机场是否具备持续可用、波动可控的基础质量。',
    formula: 'S = 0.5 × UptimeScore + 0.3 × StabilityScore + 0.2 × StreakScore',
    bullets: [
      'UptimeScore 由当日或 30 天可用率换算，低于 95% 后快速失分。',
      'StabilityScore 使用阶梯化 effective_latency_cv：200ms 内不扣分，超过后按延迟区间温和递增。',
      '单日状态分为稳定 / 轻微波动 / 异常波动，只有异常波动会打断连续健康记录。',
      'StreakScore 使用连续健康天数计算，30 天封顶。',
    ],
    accentClass: 'from-emerald-500/12 to-white',
    borderClass: 'border-emerald-200',
    badgeClass: 'bg-emerald-500 text-white',
  },
  {
    code: 'P',
    title: '性能',
    summary: '衡量连接响应、吞吐能力和传输质量的综合表现。',
    formula: 'P = 0.4 × LatencyScore + 0.4 × SpeedScore + 0.2 × LossScore',
    bullets: [
      'LatencyScore 使用中位延迟，削弱极端样本对测速结论的污染。',
      'SpeedScore 使用中位下载速率，不把偶发峰值等同于长期性能。',
      'LossScore 关注代表节点通过本地代理访问探测 URL 时的请求失败比例，不使用 ICMP ping 结果。',
    ],
    accentClass: 'from-sky-500/12 to-white',
    borderClass: 'border-sky-200',
    badgeClass: 'bg-sky-500 text-white',
  },
  {
    code: 'C',
    title: '价格',
    summary: '把月付价格档位和速度价格比放在同一价值框架内。',
    formula: 'C = 0.8 × PriceScore + 0.2 × ValueScore',
    bullets: [
      'PriceScore 采用三档：1-30 元为 100 分，30-50 元为 80 分，50 元以上为 60 分。',
      'ValueScore 使用速度价格比，让高价高性能和低价低性能都得到校正。',
    ],
    accentClass: 'from-amber-500/12 to-white',
    borderClass: 'border-amber-200',
    badgeClass: 'bg-amber-500 text-white',
  },
  {
    code: 'R',
    title: '风险',
    summary: '把可解释的信任风险转化为独立扣分信号。',
    formula: 'R = 100 - RiskPenalty',
    bullets: [
      '域名异常直接重罚，避免失联或不可访问站点依靠历史性能维持高分。',
      'SSL 未知、临期或过期会逐级扣分，提示基础设施维护风险。',
      '近期投诉和历史异常会累计惩罚，并通过封顶机制避免无限放大。',
    ],
    accentClass: 'from-rose-500/12 to-white',
    borderClass: 'border-rose-200',
    badgeClass: 'bg-rose-500 text-white',
  },
] as const;

export const riskPenaltyFlow = [
  { label: '域名异常', detail: 'domain_ok = false', penalty: '30 分' },
  { label: 'SSL 风险', detail: '未知 / 临期 / 已过期', penalty: '5 / 10 / 20 / 30 分' },
  { label: '近期投诉', detail: 'recent_complaints_count × 3', penalty: '最高 15 分' },
  { label: '历史异常', detail: 'history_incidents × 10', penalty: '最高 30 分' },
] as const;

export const decayTimeline = [1, 7, 14, 30].map((days) => ({
  days,
  weight: round2(Math.exp(-TIME_DECAY_LAMBDA * days)),
}));

export const trustPrinciples = [
  {
    title: '公式公开',
    description: '总分权重、子项公式、阈值分段和风险扣分规则均按固定口径执行。',
  },
  {
    title: '每日重算',
    description: '分数随采样数据每日更新，近期表现优先，历史表现保留权重。',
  },
  {
    title: '风险单列',
    description: '域名、证书、投诉和历史异常独立呈现，便于区分性能问题与信任问题。',
  },
  {
    title: '反单指标偏见',
    description: '不以单次测速、单一低价或单日状态决定推荐，优先观察多维均衡性。',
  },
] as const;

export const methodologyFaq = [
  {
    question: '低价机场一定高分吗？',
    answer: '不会。价格只占总分 10%，并且 PriceScore 只按 1-30 元、30-50 元、50 元以上三档计算；如果稳定性、性能或风险表现较弱，低价不会单独决定推荐位置。',
  },
  {
    question: '测速快就一定推荐吗？',
    answer: '不会。性能占总分 30%，中位延迟、下载速率和代理请求失败率只是一组信号；当可用率、波动或风险项明显偏弱时，最终分数仍会被拉低。',
  },
  {
    question: '首页的“波动天数”是不是等于登录失败天数？',
    answer: '不是。首页只把“异常波动”计入波动天数；如果当天仍可正常登录，但延迟存在轻微抖动，会标记为“轻微波动”，不会打断连续健康记录。',
  },
  {
    question: '为什么新机场可能排不高？',
    answer: '因为历史样本不足时，时间衰减后的最终分会更保守。GateRank 会让近期表现被及时反映，但不会让短期样本直接覆盖长期可信度。',
  },
  {
    question: '风险分低代表已经跑路了吗？',
    answer: '不一定。风险分低代表域名、证书、投诉或历史异常等信号需要关注；只有状态、可访问性和历史记录进一步恶化时，才会进入更强风险预警。',
  },
  {
    question: 'GateRank 的机场推荐依据是什么？',
    answer: '推荐依据来自稳定性、性能、价格、风险四个维度的综合评分，并结合每日重算和历史时间衰减。页面展示的是评分口径，不是付费推广排序。',
  },
  {
    question: '为什么要使用阈值分段和线性插值？',
    answer: '阈值分段用于定义“优秀”和“较差”的边界，线性插值用于处理边界之间的连续变化。这样比简单二元判断更平滑，也更适合长期榜单。',
  },
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeLinear(
  value: number,
  good: number,
  bad: number,
  higherIsBetter: boolean,
): number {
  if (higherIsBetter) {
    if (value >= good) return 100;
    if (value <= bad) return 0;
    return clamp(((value - bad) / (good - bad)) * 100, 0, 100);
  }

  if (value <= good) return 100;
  if (value >= bad) return 0;
  return clamp(((bad - value) / (bad - good)) * 100, 0, 100);
}

function computeUptimeScore(uptimePercent: number): number {
  return round2(clamp((uptimePercent - STABILITY_RULES.uptimeBaseline) * 20, 0, 100));
}

function computeStabilityScore(latencyCv: number): number {
  return round2(clamp(100 - latencyCv * 100, 0, 100));
}

function computeEffectiveLatencyCv(samples: number[]): number {
  const normalized = samples.slice().sort((left, right) => left - right);
  const evaluated =
    normalized.length >= STABILITY_RULES.trimMinSampleCount
      ? normalized.slice(0, normalized.length - STABILITY_RULES.trimMaxSampleCount)
      : normalized;
  return round2(average(evaluated.map((sample) => latencyPenalty(sample))));
}

function latencyPenalty(sampleMs: number): number {
  for (const band of STABILITY_RULES.latencyPenaltyBands) {
    if (sampleMs <= band.maxLatencyMs) {
      return band.penalty;
    }
  }
  return 0.95;
}

function computeStreakScore(stableDaysStreak: number): number {
  return round2(clamp((stableDaysStreak / STABILITY_RULES.streakCapDays) * 100, 0, 100));
}

function calcPriceScore(priceMonth: number): number {
  if (!Number.isFinite(priceMonth) || priceMonth <= 0) {
    return 60;
  }
  if (priceMonth <= 30) {
    return 100;
  }
  if (priceMonth <= 50) {
    return 80;
  }
  return 60;
}

function describeStabilityTier(uptimePercent: number, latencyCv: number | null): '稳定' | '轻微波动' | '异常波动' {
  if (
    uptimePercent >= STABILITY_RULES.minDailyUptimePercent &&
    latencyCv !== null &&
    latencyCv <= STABILITY_RULES.maxLatencyCv
  ) {
    return '稳定';
  }
  if (
    uptimePercent >= STABILITY_RULES.minHealthyDailyUptimePercent &&
    latencyCv !== null &&
    latencyCv <= STABILITY_RULES.maxMinorLatencyCv
  ) {
    return '轻微波动';
  }
  return '异常波动';
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calcSslPenalty(sslDaysLeft: number | null): number {
  if (sslDaysLeft === null) {
    return 5;
  }
  if (sslDaysLeft < 0) {
    return 30;
  }
  if (sslDaysLeft < 7) {
    return 20;
  }
  if (sslDaysLeft < 15) {
    return 10;
  }
  if (sslDaysLeft < 30) {
    return 5;
  }
  return 0;
}

function calcComplaintPenalty(recentComplaintsCount: number): number {
  return Math.min(Math.max(recentComplaintsCount, 0) * 3, 15);
}

function calcHistoryPenalty(historyIncidents: number): number {
  return Math.min(Math.max(historyIncidents, 0) * 10, 30);
}

const exampleInput = {
  airportName: 'Nebula Air',
  uptimePercent: 99.6,
  latencyCv: computeEffectiveLatencyCv([82, 88, 79, 84, 83]),
  healthyDaysStreak: 24,
  medianLatencyMs: 82,
  medianDownloadMbps: 220,
  packetLossPercent: 0.6,
  priceMonth: 18,
  domainOk: true,
  sslDaysLeft: 45,
  recentComplaintsCount: 1,
  historyIncidents: 0,
  historicalScore: 80.4,
} as const;

const uptimeScore = computeUptimeScore(exampleInput.uptimePercent);
const stabilityScore = computeStabilityScore(exampleInput.latencyCv);
const streakScore = computeStreakScore(exampleInput.healthyDaysStreak);
const s = round2(
  uptimeScore * SCORE_WEIGHTS.stability.uptime +
    stabilityScore * SCORE_WEIGHTS.stability.stability +
    streakScore * SCORE_WEIGHTS.stability.streak,
);

const latencyScore = round2(
  normalizeLinear(
    exampleInput.medianLatencyMs,
    THRESHOLDS.latencyMs.good,
    THRESHOLDS.latencyMs.bad,
    THRESHOLDS.latencyMs.higherIsBetter,
  ),
);
const speedScore = round2(
  normalizeLinear(
    exampleInput.medianDownloadMbps,
    THRESHOLDS.downloadMbps.good,
    THRESHOLDS.downloadMbps.bad,
    THRESHOLDS.downloadMbps.higherIsBetter,
  ),
);
const lossScore = round2(
  normalizeLinear(
    exampleInput.packetLossPercent,
    THRESHOLDS.packetLossPercent.good,
    THRESHOLDS.packetLossPercent.bad,
    THRESHOLDS.packetLossPercent.higherIsBetter,
  ),
);
const p = round2(
  latencyScore * SCORE_WEIGHTS.performance.latency +
    speedScore * SCORE_WEIGHTS.performance.speed +
    lossScore * SCORE_WEIGHTS.performance.loss,
);

const priceScore = calcPriceScore(exampleInput.priceMonth);
const valueRatio = round2(exampleInput.medianDownloadMbps / exampleInput.priceMonth);
const valueScore = round2(
  normalizeLinear(
    valueRatio,
    THRESHOLDS.valueRatio.good,
    THRESHOLDS.valueRatio.bad,
    THRESHOLDS.valueRatio.higherIsBetter,
  ),
);
const c = round2(
  priceScore * SCORE_WEIGHTS.cost.price +
    valueScore * SCORE_WEIGHTS.cost.value,
);

const domainPenalty = exampleInput.domainOk ? 0 : 30;
const sslPenalty = calcSslPenalty(exampleInput.sslDaysLeft);
const complaintPenalty = calcComplaintPenalty(exampleInput.recentComplaintsCount);
const historyPenalty = calcHistoryPenalty(exampleInput.historyIncidents);
const riskPenalty = round2(domainPenalty + sslPenalty + complaintPenalty + historyPenalty);
const r = round2(clamp(100 - riskPenalty, 0, 100));

const currentScore = round2(
  s * SCORE_WEIGHTS.final.s +
    p * SCORE_WEIGHTS.final.p +
    c * SCORE_WEIGHTS.final.c +
    r * SCORE_WEIGHTS.final.r,
);

const finalScore = round2(
  currentScore * SCORE_WEIGHTS.decay.recent +
    exampleInput.historicalScore * SCORE_WEIGHTS.decay.historical,
);
const stabilityTier = describeStabilityTier(exampleInput.uptimePercent, exampleInput.latencyCv);

export const exampleCase = {
  input: exampleInput,
  breakdown: {
    stabilityTier,
    uptimeScore,
    stabilityScore,
    streakScore,
    latencyScore,
    speedScore,
    lossScore,
    priceScore,
    valueRatio,
    valueScore,
    domainPenalty,
    sslPenalty,
    complaintPenalty,
    historyPenalty,
    riskPenalty,
    s,
    p,
    c,
    r,
    currentScore,
    finalScore,
  },
} as const;

export const methodologyStructuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: methodologySeo.title,
    description: methodologySeo.description,
    about: ['机场测评方法', '机场评分规则', '机场测速标准', '风险扣分', '时间衰减', '机场推荐依据'],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: '今日推荐',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '测评方法',
      },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: methodologyFaq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  },
] as const;
