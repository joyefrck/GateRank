import React, { useMemo } from 'react';
import {
  ArrowRight,
  BadgeInfo,
  BrainCircuit,
  ChartColumnBig,
  Clock3,
  Gauge,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';

import {
  buildAbsoluteUrl,
  buildHomeHref,
  buildMethodologyHref,
  navigate,
  PageFrame,
  usePageSeo,
} from '../../site/publicSite';
import {
  decayTimeline,
  dimensionCards,
  exampleCase,
  heroStats,
  methodologyFaq,
  methodologySeo,
  methodologyStructuredData,
  riskPenaltyFlow,
  totalScoreParts,
  trustPrinciples,
} from './content';
import { PUBLIC_SITE_BRAND_NAME } from '../../../shared/publicBrand';

const sectionMotion = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.45, ease: 'easeOut' as const },
};

const sectionTitles = {
  formula: { index: '01', title: '先看总公式', subtitle: 'Final Score Framework' },
  dimensions: { index: '02', title: '四个维度怎么来', subtitle: 'S / P / C / R Breakdown' },
  risk: { index: '03', title: '风险为什么会拉低分', subtitle: 'Risk Penalty Logic' },
  decay: { index: '04', title: '为什么要做时间衰减', subtitle: 'Recency Weighted Score' },
  example: { index: '05', title: '一眼看懂的案例', subtitle: 'Worked Example' },
  trust: { index: '06', title: '为什么这套方法更可信', subtitle: 'Why This Is Convincing' },
  faq: { index: '07', title: 'FAQ / 误解澄清', subtitle: 'Common Questions' },
} as const;

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function buildStructuredData() {
  return methodologyStructuredData.map((item, index) => {
    if (index === 0) {
      return {
        ...item,
        url: buildAbsoluteUrl(buildMethodologyHref()),
      };
    }
    return {
      ...item,
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
          name: '测评方法',
          item: buildAbsoluteUrl(buildMethodologyHref()),
        },
      ],
    };
  });
}

function SectionHeading({
  index,
  title,
  subtitle,
}: {
  index: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-6 md:mb-8">
      <div className="inline-flex items-center gap-3 rounded-full border border-neutral-200 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-500">
        <span className="text-neutral-300">{index}</span>
        <span>{subtitle}</span>
      </div>
      <h2 className="mt-4 text-3xl md:text-4xl font-black tracking-tight text-neutral-900">{title}</h2>
    </div>
  );
}

export function MethodologyPage() {
  const structuredData = useMemo(() => buildStructuredData(), []);

  usePageSeo({
    title: methodologySeo.title,
    description: methodologySeo.description,
    keywords: methodologySeo.keywords,
    canonicalPath: buildMethodologyHref(),
    structuredData,
  });

  return (
    <PageFrame active="methodology">
      <main className="max-w-7xl mx-auto px-4 pt-10 md:pt-14 pb-14 md:pb-20 space-y-16 md:space-y-24">
        <motion.section
          {...sectionMotion}
          className="relative overflow-hidden rounded-[36px] border border-neutral-200 bg-[linear-gradient(135deg,#faf7f2_0%,#ffffff_48%,#f3f4f6_100%)] px-6 py-8 md:px-10 md:py-12 text-neutral-900 shadow-[0_24px_70px_rgba(15,23,42,0.08)]"
        >
          <div className="absolute inset-0 opacity-100" style={{ backgroundImage: 'radial-gradient(circle at 14% 18%, rgba(245,158,11,0.12), transparent 24%), radial-gradient(circle at 74% 16%, rgba(14,165,233,0.1), transparent 22%), radial-gradient(circle at 84% 78%, rgba(16,185,129,0.09), transparent 22%)' }} />
          <div className="absolute inset-x-8 bottom-8 top-8 hidden rounded-[30px] border border-white/70 bg-white/35 blur-3xl md:block" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_420px] lg:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/90 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-600 shadow-sm backdrop-blur">
                <BrainCircuit className="h-3.5 w-3.5" />
                {PUBLIC_SITE_BRAND_NAME} Methodology
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl md:text-5xl lg:text-[58px] font-black leading-[0.95] tracking-tight text-neutral-900">
                我们不是拍脑袋推荐
                <span className="block text-neutral-400">而是按四个维度每天计算机场评分</span>
              </h1>
              <p className="mt-5 max-w-3xl text-sm md:text-base leading-7 text-neutral-600">
                这个页面公开说明 {PUBLIC_SITE_BRAND_NAME} 的机场测评方法、评分规则和风险扣分逻辑。你能直接看到总分怎么拆、风险怎么压分、历史数据为什么不会被立刻清空。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(buildHomeHref())}
                  className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-3 text-sm font-black text-white transition-transform hover:-translate-y-0.5"
                >
                  查看今日推荐
                  <ArrowRight className="h-4 w-4" />
                </button>
                <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/85 px-5 py-3 text-sm font-black text-neutral-600 shadow-sm backdrop-blur">
                  <BadgeInfo className="h-4 w-4" />
                  公式、权重、扣分口径全部公开
                </div>
              </div>
              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white/90 p-4 shadow-sm backdrop-blur">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">{item.label}</div>
                    <div className="mt-2 text-2xl font-black text-neutral-900">{item.value}</div>
                    <div className="mt-2 text-sm leading-6 text-neutral-600">{item.note}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-neutral-200 bg-[linear-gradient(180deg,#ffffff_0%,#f3f4f6_100%)] p-5 md:p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">Final Score</div>
                  <div className="mt-2 text-3xl md:text-4xl font-black text-neutral-900">0.4S + 0.3P + 0.2C + 0.1R</div>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-right shadow-sm">
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">核心原则</div>
                  <div className="mt-1 text-sm font-medium text-neutral-700">不是单一测速榜</div>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                {totalScoreParts.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${item.accentClass} text-sm font-black text-white`}>
                          {item.label}
                        </div>
                        <div>
                          <div className="text-sm font-black text-neutral-900">{item.title}</div>
                          <div className="text-xs uppercase tracking-[0.18em] text-neutral-400">{item.percent}% 权重</div>
                        </div>
                      </div>
                      <div className="text-lg font-black text-neutral-900">{item.weight.toFixed(1)}</div>
                    </div>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-100">
                      <div className={`h-full rounded-full ${item.accentClass}`} style={{ width: `${item.percent}%` }} />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-neutral-600">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <SectionHeading {...sectionTitles.formula} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[30px] border border-neutral-200 bg-white p-6 md:p-8 shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
              <div className="text-sm md:text-base leading-8 text-neutral-600">
                先理解一件事：{PUBLIC_SITE_BRAND_NAME} 的机场评分不是“谁跑得快谁第一”，而是把<span className="font-black text-neutral-900">稳定性、性能、价格、风险</span>四个维度拼成一个最终分。
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-4">
                {totalScoreParts.map((item) => (
                  <div key={item.key} className={`rounded-3xl border p-4 ${item.softClass}`}>
                    <div className="text-[11px] uppercase tracking-[0.18em] font-black">{item.label}</div>
                    <div className="mt-2 text-xl font-black">{item.title}</div>
                    <div className="mt-3 text-sm leading-6">占总分 {item.percent}%</div>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-[28px] bg-neutral-950 px-5 py-6 text-white">
                <div className="text-[11px] uppercase tracking-[0.18em] font-black text-white/50">公开主公式</div>
                <div className="mt-3 text-2xl md:text-[32px] font-black tracking-tight leading-tight">
                  FinalScore = 0.4S + 0.3P + 0.2C + 0.1R
                </div>
                <p className="mt-4 text-sm leading-7 text-white/68">
                  前三项是加分维度，最后一项是“把风险重新拉回来”的安全阀。这样做的结果是，快但危险的机场不会轻易靠单项数据冲榜。
                </p>
              </div>
            </div>

            <div className="rounded-[30px] border border-neutral-200 bg-neutral-50 p-6 md:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-900 text-white">
                  <ChartColumnBig className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-neutral-900">不是单一测速分</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] font-black text-neutral-400">Why It Matters</div>
                </div>
              </div>
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-sm font-black text-neutral-900">一次高速截图不能说明长期稳定</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">我们用中位值、波动系数和稳定天数，把短期高光与长期表现区分开。</p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-sm font-black text-neutral-900">低价也不能自动上榜</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">价格只占一部分，还要看速度价格比和基础风险，避免“便宜但不可靠”。</p>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <div className="text-sm font-black text-neutral-900">有风险要显式压分</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">域名异常、证书问题、投诉和历史异常都会形成可解释的惩罚项。</p>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <SectionHeading {...sectionTitles.dimensions} />
          <div className="grid gap-6 md:grid-cols-2">
            {dimensionCards.map((item) => (
              <section
                key={item.code}
                className={`rounded-[30px] border bg-[linear-gradient(180deg,var(--tw-gradient-from),var(--tw-gradient-to))] p-6 md:p-8 ${item.borderClass} ${item.accentClass}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${item.badgeClass}`}>
                      {item.code}
                    </div>
                    <h3 className="mt-4 text-2xl font-black tracking-tight text-neutral-900">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-neutral-600">{item.summary}</p>
                  </div>
                </div>
                <div className="mt-5 rounded-3xl border border-neutral-200 bg-white px-4 py-4 text-sm font-black leading-7 text-neutral-900">
                  {item.formula}
                </div>
                <div className="mt-5 space-y-3">
                  {item.bullets.map((bullet) => (
                    <div key={bullet} className="rounded-2xl border border-neutral-200 bg-white/85 px-4 py-3 text-sm leading-6 text-neutral-600">
                      {bullet}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <SectionHeading {...sectionTitles.risk} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="rounded-[32px] border border-rose-200 bg-[linear-gradient(180deg,rgba(244,63,94,0.06),rgba(255,255,255,1))] p-6 md:p-8">
              <div className="grid gap-4 md:grid-cols-4">
                {riskPenaltyFlow.map((item, index) => (
                  <div key={item.label} className="relative rounded-3xl border border-rose-100 bg-white p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-rose-500">Step {index + 1}</div>
                    <div className="mt-2 text-lg font-black text-neutral-900">{item.label}</div>
                    <div className="mt-3 text-sm leading-6 text-neutral-600">{item.detail}</div>
                    <div className="mt-4 inline-flex rounded-full bg-rose-500 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-white">
                      扣 {item.penalty}
                    </div>
                    {index < riskPenaltyFlow.length - 1 && (
                      <div className="hidden md:block absolute right-[-14px] top-1/2 -translate-y-1/2 text-rose-300">
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-[28px] border border-rose-200 bg-neutral-950 p-5 text-white">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50">Risk Output</div>
                <div className="mt-3 text-2xl md:text-3xl font-black">R = 100 - RiskPenalty</div>
                <p className="mt-3 text-sm leading-7 text-white/70">
                  风险项不是“给一个模糊印象分”，而是把可解释的异常转换为明确扣分。这样用户能知道自己到底是在为哪种风险买单。
                </p>
              </div>
            </div>

            <div className="rounded-[32px] border border-neutral-200 bg-neutral-50 p-6 md:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-500 text-white">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-neutral-900">为什么单列风险</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] font-black text-neutral-400">Independent Penalty</div>
                </div>
              </div>
              <div className="mt-6 space-y-4 text-sm leading-7 text-neutral-600">
                <p>如果把风险揉进其他维度，用户会很难分辨“是慢，还是不可信”。</p>
                <p>单列风险分后，一眼就能知道某个机场是因为速度掉分，还是因为域名、证书、投诉或历史异常掉分。</p>
                <p className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 font-medium text-neutral-900">
                  这也是页面更有说服力的关键：不给模糊印象，只给能追溯的扣分原因。
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <SectionHeading {...sectionTitles.decay} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-[32px] border border-neutral-200 bg-white p-6 md:p-8">
              <div className="rounded-[28px] border border-neutral-200 bg-neutral-50 p-5 md:p-6">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">先看关系，再看公式</div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-300">Step 1</div>
                    <div className="mt-2 text-lg font-black text-neutral-900">先算当天综合分</div>
                    <div className="mt-2 text-sm leading-6 text-neutral-600">
                      CurrentScore = 0.4S + 0.3P + 0.2C + 0.1R
                    </div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-300">Step 2</div>
                    <div className="mt-2 text-lg font-black text-neutral-900">再用 w 算历史分</div>
                    <div className="mt-2 text-sm leading-6 text-neutral-600">
                      `w` 只参与 HistoricalScore，越近的历史分权重越高。
                    </div>
                  </div>
                  <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                    <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-300">Step 3</div>
                    <div className="mt-2 text-lg font-black text-neutral-900">最后合成最终分</div>
                    <div className="mt-2 text-sm leading-6 text-neutral-600">
                      FinalScore = 0.7 × CurrentScore + 0.3 × HistoricalScore
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-[28px] border border-neutral-200 bg-neutral-950 p-5 text-white">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50">Decay Formula</div>
                <div className="mt-3 text-2xl md:text-3xl font-black">w = exp(-0.1 × days_diff)</div>
                <p className="mt-3 text-sm leading-7 text-white/70">
                  越新的数据权重越高，但历史分数不会被瞬间清零。这里的 `w` 只用于计算 HistoricalScore，不会直接乘在当天综合分外面。
                </p>
              </div>
              <div className="mt-6 rounded-[28px] border border-neutral-200 bg-neutral-50 p-5">
                <div className="text-sm font-black text-neutral-900">桥接关系</div>
                <p className="mt-3 text-sm leading-7 text-neutral-600">
                  很多人第一次看会误以为 `w` 是直接修正总分。不是。{PUBLIC_SITE_BRAND_NAME} 的做法是：
                  <span className="font-black text-neutral-900">先算当天总分</span>，
                  <span className="font-black text-neutral-900">再用 `w` 计算历史衰减分</span>，
                  最后再把这两部分按 70% / 30% 合成最终分。
                </p>
              </div>
              <div className="mt-6 space-y-4">
                {decayTimeline.map((item) => (
                  <div key={item.days} className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_80px] md:items-center">
                    <div className="text-sm font-black text-neutral-900">{item.days} 天前</div>
                    <div className="h-3 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full bg-neutral-900 transition-all" style={{ width: `${Math.max(item.weight * 100, 4)}%` }} />
                    </div>
                    <div className="text-sm font-medium text-neutral-500">权重 {item.weight.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-neutral-200 bg-neutral-50 p-6 md:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-900 text-white">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black text-neutral-900">为什么要保留历史</div>
                  <div className="text-[11px] uppercase tracking-[0.18em] font-black text-neutral-400">Historical Memory</div>
                </div>
              </div>
              <div className="mt-6 space-y-4 text-sm leading-7 text-neutral-600">
                <p>只看当天，会让一次活动测速或一次短时故障把榜单拉得过于极端。</p>
                <p>引入时间衰减后，最近表现最重要，但长期表现仍然会保留“记忆”，更接近真实使用体验。</p>
                <p className="rounded-2xl border border-neutral-200 bg-white px-4 py-4 font-medium text-neutral-900">
                  这也是 {PUBLIC_SITE_BRAND_NAME} 不做“今日跑分秀”的原因。
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <SectionHeading {...sectionTitles.example} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <div className="rounded-[32px] border border-neutral-200 bg-neutral-50 p-6 md:p-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">Demo Airport</div>
                  <div className="mt-2 text-2xl font-black tracking-tight text-neutral-900">{exampleCase.input.airportName}</div>
                </div>
                <div className="rounded-full bg-neutral-900 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white">
                  虚拟案例
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <MetricTile label="可用率" value={`${formatNumber(exampleCase.input.uptimePercent)}%`} />
                <MetricTile label="延迟波动 CV" value={formatNumber(exampleCase.input.latencyCv)} />
                <MetricTile label="单日分档" value={exampleCase.breakdown.stabilityTier} />
                <MetricTile label="连续健康天数" value={`${exampleCase.input.healthyDaysStreak} 天`} />
                <MetricTile label="中位延迟" value={`${exampleCase.input.medianLatencyMs} ms`} />
                <MetricTile label="下载速率" value={`${exampleCase.input.medianDownloadMbps} Mbps`} />
                <MetricTile label="丢包率" value={`${exampleCase.input.packetLossPercent}%`} />
                <MetricTile label="月付价格" value={`¥${exampleCase.input.priceMonth}`} />
                <MetricTile label="历史衰减分" value={formatNumber(exampleCase.input.historicalScore)} />
              </div>
            </div>

            <div className="rounded-[32px] border border-neutral-200 bg-white p-6 md:p-8">
              <div className="grid gap-4 md:grid-cols-2">
                <ScoreTile label="S 稳定性" value={exampleCase.breakdown.s} detail={`92 / 89 / 80 -> ${formatNumber(exampleCase.breakdown.s)}`} tone="emerald" />
                <ScoreTile label="P 性能" value={exampleCase.breakdown.p} detail={`95.93 / 72.41 / 88 -> ${formatNumber(exampleCase.breakdown.p)}`} tone="sky" />
                <ScoreTile label="C 价格" value={exampleCase.breakdown.c} detail={`88.57 / 100 / 24.44 -> ${formatNumber(exampleCase.breakdown.c)}`} tone="amber" />
                <ScoreTile label="R 风险" value={exampleCase.breakdown.r} detail={`风险罚分 ${formatNumber(exampleCase.breakdown.riskPenalty)} -> ${formatNumber(exampleCase.breakdown.r)}`} tone="rose" />
              </div>
              <div className="mt-6 rounded-[28px] border border-neutral-200 bg-neutral-950 p-5 text-white">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/50">How The Numbers Close</div>
                <div className="mt-3 space-y-3 text-sm leading-7 text-white/72">
                  <p>当日综合分 = 0.4 × {formatNumber(exampleCase.breakdown.s)} + 0.3 × {formatNumber(exampleCase.breakdown.p)} + 0.2 × {formatNumber(exampleCase.breakdown.c)} + 0.1 × {formatNumber(exampleCase.breakdown.r)} = <span className="font-black text-white">{formatNumber(exampleCase.breakdown.currentScore)}</span></p>
                  <p>最终分 = 0.7 × {formatNumber(exampleCase.breakdown.currentScore)} + 0.3 × {formatNumber(exampleCase.input.historicalScore)} = <span className="font-black text-white">{formatNumber(exampleCase.breakdown.finalScore)}</span></p>
                </div>
              </div>
              <div className="mt-6 rounded-[28px] border border-neutral-200 bg-neutral-50 p-5">
                <div className="text-sm font-black text-neutral-900">案例说明</div>
                <p className="mt-3 text-sm leading-7 text-neutral-600">
                  这个虚拟机场的性能和稳定性都不错，但因为存在 1 条近期投诉，风险分不是满分；同时历史衰减分只有 80.4，所以最终分也不会被当日表现直接推到极高位置。
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <SectionHeading {...sectionTitles.trust} />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {trustPrinciples.map((item, index) => (
              <div key={item.title} className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.04)]">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-300">0{index + 1}</div>
                <div className="mt-4 text-xl font-black tracking-tight text-neutral-900">{item.title}</div>
                <p className="mt-3 text-sm leading-7 text-neutral-600">{item.description}</p>
              </div>
            ))}
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <SectionHeading {...sectionTitles.faq} />
          <div className="grid gap-5">
            {methodologyFaq.map((item) => (
              <details key={item.question} className="group rounded-[28px] border border-neutral-200 bg-white px-5 py-5 shadow-[0_14px_40px_rgba(0,0,0,0.03)]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-900 text-white">
                      <HelpCircle className="h-4 w-4" />
                    </div>
                    <span className="text-base md:text-lg font-black tracking-tight text-neutral-900">{item.question}</span>
                  </div>
                  <div className="rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400 transition group-open:text-neutral-900">
                    展开
                  </div>
                </summary>
                <p className="pt-5 text-sm md:text-base leading-7 text-neutral-600">{item.answer}</p>
              </details>
            ))}
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <div className="rounded-[32px] border border-neutral-200 bg-neutral-950 px-6 py-8 md:px-8 md:py-10 text-white">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/60">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Methodology Note
                </div>
                <h2 className="mt-4 text-2xl md:text-4xl font-black tracking-tight">结论先行：我们更在意“长期可信”，而不是“一次看起来很猛”。</h2>
                <p className="mt-4 max-w-3xl text-sm md:text-base leading-7 text-white/70">
                  这就是 {PUBLIC_SITE_BRAND_NAME} 的机场评分规则。你可以先看榜单，再回到这里理解每一分是怎么来的；如果某个机场分数异常，你也能快速判断它是慢、贵，还是有真实风险。
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(buildHomeHref())}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-neutral-900 transition-transform hover:-translate-y-0.5"
              >
                回到榜单
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.section>
      </main>
    </PageFrame>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-4">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">{label}</div>
      <div className="mt-2 text-lg font-black text-neutral-900">{value}</div>
    </div>
  );
}

function ScoreTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: 'emerald' | 'sky' | 'amber' | 'rose';
}) {
  const toneMap = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
  } as const;

  const iconMap = {
    emerald: ShieldCheck,
    sky: Gauge,
    amber: Wallet,
    rose: ShieldAlert,
  } as const;

  const Icon = iconMap[tone];

  return (
    <div className={`rounded-[28px] border p-5 ${toneMap[tone]}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em]">{label}</div>
          <div className="mt-2 text-3xl font-black">{formatNumber(value)}</div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-current">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 text-sm leading-6 opacity-80">{detail}</div>
    </div>
  );
}
