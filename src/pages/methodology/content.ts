import { PUBLIC_SITE_BRAND_NAME } from '../../../shared/publicBrand';

const SCORE_WEIGHTS = {
  stability: { uptime: 0.5, stability: 0.3, streak: 0.2 },
  performance: { latency: 0.4, speed: 0.4, loss: 0.2 },
  cost: { price: 0.6, trial: 0.2, value: 0.2 },
  final: { s: 0.4, p: 0.3, c: 0.2, r: 0.1 },
  decay: { recent: 0.7, historical: 0.3 },
} as const;

const THRESHOLDS = {
  latencyMs: { good: 60, bad: 600, higherIsBetter: false },
  downloadMbps: { good: 300, bad: 10, higherIsBetter: true },
  packetLossPercent: { good: 0, bad: 5, higherIsBetter: false },
  priceMonth: { good: 10, bad: 80, higherIsBetter: false },
  valueRatio: { good: 50, bad: 0, higherIsBetter: true },
} as const;

const STABILITY_RULES = {
  uptimeBaseline: 95,
  streakCapDays: 30,
  maxLatencyCv: 0.2,
  trimMinSampleCount: 5,
  trimEdgeSampleCount: 1,
  effectiveMeanFloorMs: 10,
} as const;

const TIME_DECAY_LAMBDA = 0.1;

export const methodologySeo = {
  title: `测评方法 | 机场评分规则、权重与风险扣分说明 | ${PUBLIC_SITE_BRAND_NAME}`,
  description: `${PUBLIC_SITE_BRAND_NAME} 测评方法页公开解释机场评分规则，拆解稳定性、性能、价格、风险四个维度，以及时间衰减、风险扣分与最终分数如何计算。`,
  keywords: '机场榜GateRank,机场测评方法,机场评分规则,机场推荐依据,VPN机场测评,机场榜,GateRank',
} as const;

export const heroStats = [
  { label: '评分维度', value: '4', note: '稳定性 / 性能 / 价格 / 风险' },
  { label: '主公式', value: '0.4 + 0.3 + 0.2 + 0.1', note: '权重公开写死，不靠人工拍板' },
  { label: '更新频率', value: '每日', note: '最近数据权重更高，历史数据继续保留' },
] as const;

export const totalScoreParts = [
  {
    key: 's',
    label: 'S',
    title: '稳定性',
    weight: SCORE_WEIGHTS.final.s,
    percent: 40,
    description: '看可用率、波动和连续稳定天数，不让一次偶然测速决定全局。',
    accentClass: 'bg-emerald-500',
    softClass: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  },
  {
    key: 'p',
    label: 'P',
    title: '性能',
    weight: SCORE_WEIGHTS.final.p,
    percent: 30,
    description: '看中位延迟、下载速率和丢包，兼顾快与稳。',
    accentClass: 'bg-sky-500',
    softClass: 'bg-sky-50 border-sky-200 text-sky-800',
  },
  {
    key: 'c',
    label: 'C',
    title: '价格',
    weight: SCORE_WEIGHTS.final.c,
    percent: 20,
    description: '看月付、试用和速度价格比，防止“便宜但不值”。',
    accentClass: 'bg-amber-500',
    softClass: 'bg-amber-50 border-amber-200 text-amber-800',
  },
  {
    key: 'r',
    label: 'R',
    title: '风险',
    weight: SCORE_WEIGHTS.final.r,
    percent: 10,
    description: '看域名、SSL、投诉和历史异常，防止“快但危险”。',
    accentClass: 'bg-rose-500',
    softClass: 'bg-rose-50 border-rose-200 text-rose-800',
  },
] as const;

export const dimensionCards = [
  {
    code: 'S',
    title: '稳定性',
    summary: '优先回答“这个机场能不能稳定用”。',
    formula: 'S = 0.5 × UptimeScore + 0.3 × StabilityScore + 0.2 × StreakScore',
    bullets: [
      'UptimeScore 由当日或 30 天可用率换算，95% 以下迅速失分。',
      'StabilityScore 由稳健波动值 effective_latency_cv 计算，低延迟线路会做 10ms 均值地板保护。',
      'StreakScore 由连续稳定天数计算，30 天封顶。',
    ],
    accentClass: 'from-emerald-500/12 to-white',
    borderClass: 'border-emerald-200',
    badgeClass: 'bg-emerald-500 text-white',
  },
  {
    code: 'P',
    title: '性能',
    summary: '回答“这个机场在真实使用里够不够快”。',
    formula: 'P = 0.4 × LatencyScore + 0.4 × SpeedScore + 0.2 × LossScore',
    bullets: [
      'LatencyScore 用中位延迟计算，避免极端值污染结果。',
      'SpeedScore 用中位下载速率计算，不奖励偶发尖峰。',
      'LossScore 关注丢包率，稳定传输比跑分更重要。',
    ],
    accentClass: 'from-sky-500/12 to-white',
    borderClass: 'border-sky-200',
    badgeClass: 'bg-sky-500 text-white',
  },
  {
    code: 'C',
    title: '价格',
    summary: '回答“这个机场值不值这个价”。',
    formula: 'C = 0.6 × PriceScore + 0.2 × TrialScore + 0.2 × ValueScore',
    bullets: [
      'PriceScore 对低月付更友好，但不会让超低价自动登顶。',
      'TrialScore 只在支持试用时给满分，降低首次决策门槛。',
      'ValueScore 看速度价格比，让“贵但快”和“便宜但慢”都被校正。',
    ],
    accentClass: 'from-amber-500/12 to-white',
    borderClass: 'border-amber-200',
    badgeClass: 'bg-amber-500 text-white',
  },
  {
    code: 'R',
    title: '风险',
    summary: '回答“这个机场有没有明显的信任问题”。',
    formula: 'R = 100 - RiskPenalty',
    bullets: [
      '域名异常直接重罚，不让失联站点靠速度冲高分。',
      'SSL 到期或未知会逐级扣分，优先提醒基础设施问题。',
      '近期投诉和历史异常会累计惩罚，但都设上限避免无限放大。',
    ],
    accentClass: 'from-rose-500/12 to-white',
    borderClass: 'border-rose-200',
    badgeClass: 'bg-rose-500 text-white',
  },
] as const;

export const riskPenaltyFlow = [
  { label: '域名异常', detail: 'domain_ok = false', penalty: '30 分' },
  { label: 'SSL 风险', detail: '未知 / 即将过期 / 已过期', penalty: '5 / 10 / 20 / 30 分' },
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
    description: '权重、阈值、风险扣分都在代码里写明，不靠人工临时改口径。',
  },
  {
    title: '每日重算',
    description: '分数会随着当天采样更新，不让过期高光数据长期占便宜。',
  },
  {
    title: '风险单列',
    description: '速度再快，如果域名、证书或投诉有问题，也会被明确压分。',
  },
  {
    title: '反单指标偏见',
    description: '不是看一次测速谁最快，而是看稳定、性能、价格、风险是否均衡。',
  },
] as const;

export const methodologyFaq = [
  {
    question: '低价机场一定高分吗？',
    answer: '不会。价格只占总分的一部分，而且还要结合速度价格比和试用支持；如果稳定性、性能或风险很差，低价也救不了总分。',
  },
  {
    question: '测速快就一定推荐吗？',
    answer: '不会。性能只占 30%，如果可用率差、波动大或风险项明显，最终分数仍然会被拉低。',
  },
  {
    question: '为什么新机场可能排不高？',
    answer: '因为历史样本不足，时间衰减后的最终分会更保守；这是为了避免新机场靠短期表现直接冲榜。',
  },
  {
    question: '风险分低代表已经跑路了吗？',
    answer: '不一定。风险分是在提示潜在信任问题；只有在状态、域名和历史异常进一步恶化时，才会进入更强预警。',
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
      ? normalized.slice(
          STABILITY_RULES.trimEdgeSampleCount,
          normalized.length - STABILITY_RULES.trimEdgeSampleCount,
        )
      : normalized;
  const mean = average(evaluated);
  const std = standardDeviation(evaluated, mean);
  return round2(std / Math.max(mean, STABILITY_RULES.effectiveMeanFloorMs));
}

function computeStreakScore(stableDaysStreak: number): number {
  return round2(clamp((stableDaysStreak / STABILITY_RULES.streakCapDays) * 100, 0, 100));
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[], meanValue: number): number {
  if (values.length <= 1) {
    return 0;
  }
  const variance =
    values.reduce((sum, value) => sum + (value - meanValue) ** 2, 0) / values.length;
  return Math.sqrt(variance);
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
  stableDaysStreak: 24,
  medianLatencyMs: 82,
  medianDownloadMbps: 220,
  packetLossPercent: 0.6,
  priceMonth: 18,
  hasTrial: true,
  domainOk: true,
  sslDaysLeft: 45,
  recentComplaintsCount: 1,
  historyIncidents: 0,
  historicalScore: 80.4,
} as const;

const uptimeScore = computeUptimeScore(exampleInput.uptimePercent);
const stabilityScore = computeStabilityScore(exampleInput.latencyCv);
const streakScore = computeStreakScore(exampleInput.stableDaysStreak);
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

const priceScore = round2(
  normalizeLinear(
    exampleInput.priceMonth,
    THRESHOLDS.priceMonth.good,
    THRESHOLDS.priceMonth.bad,
    THRESHOLDS.priceMonth.higherIsBetter,
  ),
);
const trialScore = exampleInput.hasTrial ? 100 : 0;
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
    trialScore * SCORE_WEIGHTS.cost.trial +
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

export const exampleCase = {
  input: exampleInput,
  breakdown: {
    uptimeScore,
    stabilityScore,
    streakScore,
    latencyScore,
    speedScore,
    lossScore,
    priceScore,
    trialScore,
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
    about: ['机场测评方法', '机场评分规则', '风险扣分'],
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
] as const;
