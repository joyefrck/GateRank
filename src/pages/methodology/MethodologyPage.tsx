import React, { useMemo } from 'react';
import {
  ArrowRight,
  Check,
  Database,
  Eye,
  FileClock,
  HelpCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'motion/react';

import { ListPageHero } from '../../components/ListPageHero';
import {
  buildAbsoluteUrl,
  buildFullRankingHref,
  buildHomeHref,
  buildMethodologyHref,
  buildMonthlyReportsHref,
  PageFrame,
  usePageSeo,
} from '../../site/publicSite';
import { PUBLIC_SITE_BRAND_NAME } from '../../../shared/publicBrand';
import {
  dataPipeline,
  dimensionCards,
  methodologyFacts,
  methodologyFaq,
  methodologySeo,
  methodologyStructuredData,
  resultGuidance,
  transparencyBoundary,
  trustPrinciples,
} from './content';

const sectionMotion = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-72px' },
  transition: { duration: 0.4, ease: 'easeOut' as const },
};

const dimensionTone = {
  emerald: 'border-emerald-200 bg-emerald-50/55 text-emerald-700',
  sky: 'border-sky-200 bg-sky-50/55 text-sky-700',
  indigo: 'border-indigo-200 bg-indigo-50/55 text-indigo-700',
  amber: 'border-amber-200 bg-amber-50/55 text-amber-700',
  rose: 'border-rose-200 bg-rose-50/55 text-rose-700',
} as const;

function buildStructuredData() {
  return methodologyStructuredData.map((item) => {
    if (item['@type'] === 'TechArticle') {
      return {
        ...item,
        url: buildAbsoluteUrl(buildMethodologyHref()),
      };
    }
    if (item['@type'] !== 'BreadcrumbList') {
      return item;
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
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-600">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] text-neutral-950 md:text-4xl">{title}</h2>
      {description ? <p className="mt-4 text-sm leading-7 text-neutral-600 md:text-base">{description}</p> : null}
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
      <main className="mx-auto max-w-7xl space-y-20 px-4 pb-20 pt-8 md:space-y-28 md:pb-28 md:pt-12">
        <ListPageHero
          eyebrow="GateRank Methodology"
          title="我们如何评估"
          subtitle="一个机场"
          description={`${PUBLIC_SITE_BRAND_NAME} 通过持续采样、多维信号和历史记录，判断一个服务是否具备长期使用价值。本页解释评估原则、数据来源与结果解读方式；模型参数、阈值与计算细节属于内部方法，不对外披露。`}
          tone="sky"
          stats={[
            ...methodologyFacts.map((item) => ({
              label: item.value,
              value: <div className="text-sm font-semibold leading-6 text-white/78">{item.label}</div>,
            })),
            {
              label: '公开范围',
              value: <div className="text-sm font-semibold leading-6 text-white/78">原则公开 · 参数保留</div>,
            },
          ]}
        />

        <motion.section {...sectionMotion}>
          <SectionHeading
            eyebrow="Evaluation Framework"
            title="五维评估框架"
            description="五个维度分别回答不同问题。它们共同构成判断依据，但任何一个单项都不能独立决定推荐。"
          />
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {dimensionCards.map((item) => (
              <article key={item.code} className="group rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl border text-base font-black ${dimensionTone[item.tone]}`}>
                    {item.code}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-300">{item.eyebrow}</span>
                </div>
                <h3 className="mt-6 text-xl font-black text-neutral-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-neutral-600">{item.description}</p>
                <p className="mt-5 border-t border-neutral-100 pt-4 text-xs leading-6 text-neutral-500">{item.detail}</p>
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <SectionHeading
            eyebrow="Evidence Pipeline"
            title="数据如何形成结果"
            description="从采样到公开结论，每一步都有明确职责。流程公开，但不会暴露可被复制或针对性优化的内部实现。"
          />
          <div className="mt-8 grid gap-0 overflow-hidden rounded-2xl border border-neutral-200 bg-white md:grid-cols-4">
            {dataPipeline.map((item, index) => (
              <article
                key={item.index}
                className={`relative p-6 ${index === 0 ? '' : 'border-t border-neutral-200 md:border-l md:border-t-0'}`}
              >
                <div className="font-mono text-xs font-black tracking-[0.18em] text-indigo-600">{item.index}</div>
                <h3 className="mt-5 text-lg font-black text-neutral-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-neutral-600">{item.description}</p>
                {index < dataPipeline.length - 1 ? (
                  <ArrowRight className="absolute -right-3 top-7 z-10 hidden h-6 w-6 rounded-full border border-neutral-200 bg-white p-1 text-neutral-400 md:block" />
                ) : null}
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <SectionHeading
            eyebrow="Reading The Score"
            title="如何理解 GateRank 结果"
            description="公开分数是决策线索，不是对未来服务的保证。阅读时应同时关注趋势、证据完整度与风险状态。"
          />
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {resultGuidance.map((item, index) => (
              <article key={item.title} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-950 text-xs font-black text-white">
                  {index + 1}
                </div>
                <h3 className="mt-5 text-xl font-black text-neutral-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-neutral-600">{item.description}</p>
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <SectionHeading
            eyebrow="Transparency Boundary"
            title="透明度边界"
            description="我们公开足以帮助用户判断的证据，同时保留可能被用于复制模型、操纵数据或针对性优化的实现细节。"
          />
          <div className="mt-8 grid overflow-hidden rounded-2xl border border-neutral-200 bg-white lg:grid-cols-2">
            <BoundaryColumn
              icon={Eye}
              eyebrow="Public"
              title="我们公开"
              description="用户可以核对结果来自什么信息，以及报告对应哪个时间与规则版本。"
              items={transparencyBoundary.publicItems}
            />
            <BoundaryColumn
              icon={LockKeyhole}
              eyebrow="Protected"
              title="我们保留"
              description="这些内容只用于内部评分、质量控制与抗操纵，不进入公开页面或机器可读数据。"
              items={transparencyBoundary.privateItems}
              protectedColumn
            />
          </div>
          <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/70 px-5 py-4 text-sm leading-7 text-indigo-950">
            保留内部参数并不影响结果可追溯性：用户仍可查看数据日期、趋势、风险来源类别和历史报告，
            但无法直接复制或反向实现评分模型。
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <SectionHeading
            eyebrow="Trust Principles"
            title="我们坚持的评测原则"
          />
          <div className="mt-8 grid gap-x-8 gap-y-0 border-y border-neutral-200 md:grid-cols-2 lg:grid-cols-3">
            {trustPrinciples.map((item, index) => (
              <article
                key={item.title}
                className={`grid grid-cols-[36px_minmax(0,1fr)] gap-4 py-6 ${index > 0 ? 'border-t border-neutral-200 md:border-t-0' : ''} ${index >= 2 ? 'md:border-t' : ''} ${index >= 3 ? 'lg:border-t' : ''}`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
                  {index === 0 ? <Database className="h-4 w-4" /> : index === 4 ? <FileClock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </div>
                <div>
                  <h3 className="text-base font-black text-neutral-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <SectionHeading eyebrow="Common Questions" title="FAQ / 常见问题" />
          <div className="mt-8 divide-y divide-neutral-200 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            {methodologyFaq.map((item) => (
              <details key={item.question} className="group px-5 py-5 open:bg-neutral-50/70 md:px-6">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
                  <div className="flex items-center gap-3">
                    <HelpCircle className="h-5 w-5 shrink-0 text-indigo-600" />
                    <span className="text-base font-black text-neutral-950 md:text-lg">{item.question}</span>
                  </div>
                  <span className="text-xs font-black text-neutral-400 transition group-open:rotate-45" aria-hidden="true">＋</span>
                </summary>
                <p className="max-w-4xl pb-1 pt-5 text-sm leading-7 text-neutral-600 md:text-base">{item.answer}</p>
              </details>
            ))}
          </div>
        </motion.section>

        <motion.section {...sectionMotion}>
          <div className="rounded-2xl bg-neutral-950 px-6 py-8 text-white md:px-10 md:py-10">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-white/45">Methodology Note</div>
                <h2 className="mt-4 text-2xl font-black tracking-[-0.025em] md:text-4xl">
                  长期可信，比单次高性能样本更重要。
                </h2>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65 md:text-base">
                  先看综合排名，再结合报告日期、趋势和风险状态做判断。GateRank 提供证据，不替用户承诺未来。
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={buildFullRankingHref()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-black text-neutral-950 transition hover:-translate-y-0.5 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  查看机场排行
                  <ArrowRight className="h-4 w-4" />
                </a>
                <a
                  href={buildMonthlyReportsHref()}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 py-3 text-sm font-black text-white/75 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  查看最新报告
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </motion.section>
      </main>
    </PageFrame>
  );
}

function BoundaryColumn({
  icon: Icon,
  eyebrow,
  title,
  description,
  items,
  protectedColumn = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  items: readonly string[];
  protectedColumn?: boolean;
}) {
  return (
    <article className={`p-6 md:p-8 ${protectedColumn ? 'border-t border-neutral-200 bg-neutral-50 lg:border-l lg:border-t-0' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${protectedColumn ? 'bg-neutral-950 text-white' : 'bg-indigo-600 text-white'}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">{eyebrow}</div>
          <h3 className="mt-1 text-xl font-black text-neutral-950">{title}</h3>
        </div>
      </div>
      <p className="mt-5 text-sm leading-7 text-neutral-600">{description}</p>
      <ul className="mt-6 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm leading-6 text-neutral-700">
            <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${protectedColumn ? 'bg-neutral-200 text-neutral-700' : 'bg-indigo-100 text-indigo-700'}`}>
              <Check className="h-3 w-3" />
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
