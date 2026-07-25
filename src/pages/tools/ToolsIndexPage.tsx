import {
  Download,
  MapPin,
  Network,
  Tv2,
  type LucideIcon,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import {
  PUBLIC_TOOL_DEFINITIONS,
  PUBLIC_TOOLS_INDEX_PATH,
  PUBLIC_TOOLS_INDEX_SEO,
  type PublicToolKey,
} from '../../../shared/publicTools';
import {
  buildAbsoluteUrl,
  navigate,
  PageFrame,
  usePageSeo,
} from '../../site/publicSite';

const TOOL_ICONS: Record<PublicToolKey, LucideIcon> = {
  download: Download,
  streaming_check: Tv2,
  ip_check: MapPin,
  dns_leak_test: Network,
};

export function ToolsIndexPage() {
  const reduceMotion = useReducedMotion();

  usePageSeo({
    ...PUBLIC_TOOLS_INDEX_SEO,
    canonicalPath: PUBLIC_TOOLS_INDEX_PATH,
    structuredData: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: PUBLIC_TOOLS_INDEX_SEO.title,
        description: PUBLIC_TOOLS_INDEX_SEO.description,
        url: buildAbsoluteUrl(PUBLIC_TOOLS_INDEX_PATH),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: PUBLIC_TOOL_DEFINITIONS.map((tool, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: tool.label,
          url: buildAbsoluteUrl(tool.href),
        })),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '今日推荐', item: buildAbsoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: '工具', item: buildAbsoluteUrl(PUBLIC_TOOLS_INDEX_PATH) },
        ],
      },
    ],
  });

  return (
    <PageFrame active="tools">
      <main className="w-full text-slate-950">
        <section className="relative grid min-h-[min(640px,calc(100svh-72px))] w-full overflow-hidden border-b border-emerald-100 bg-[radial-gradient(circle_at_82%_46%,rgba(20,184,166,0.16),transparent_28%),linear-gradient(135deg,#f8fffe_0%,#fff_55%,#ecfdf5_100%)] px-6 py-14 md:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)] md:items-center md:gap-16 md:px-[max(24px,calc((100vw-1180px)/2))] md:py-24">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="max-w-[720px]"
          >
            <div className="text-xs font-black uppercase tracking-[0.2em] text-teal-700">GateRank Network Toolkit</div>
            <h1 className="mt-4 max-w-[680px] text-[clamp(44px,7vw,82px)] font-black leading-[0.98] tracking-[-0.055em] text-teal-950">
              网络检测与科学上网工具箱
            </h1>
            <p className="mt-7 max-w-[650px] text-base leading-8 text-slate-600 md:text-xl md:leading-9">
              从客户端安装到出口网络验证，把常用工具集中在一个清晰入口。所有检测只在进入对应页面后按当前规则运行。
            </p>
            <a href="#tools-index-list" className="mt-8 inline-flex min-h-12 items-center gap-3 border-b-2 border-teal-700 text-sm font-black tracking-[0.06em] text-teal-700">
              查看全部工具
              <span aria-hidden="true">↓</span>
            </a>
          </motion.div>

          <div className="relative mx-auto mt-10 grid aspect-square w-[min(330px,84vw)] place-items-center text-teal-700 md:mt-0 md:w-[min(430px,42vw)]" aria-hidden="true">
            <div className="absolute inset-[12%] rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.20),rgba(20,184,166,0.04)_58%,transparent_60%)]" />
            <motion.div
              className="absolute inset-[10%] rounded-[48%_52%_50%_50%] border border-teal-700/30"
              animate={reduceMotion ? undefined : { rotate: 360 }}
              transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
            >
              <span className="absolute left-[10%] top-[27%] h-3.5 w-3.5 rounded-full bg-teal-700 shadow-[0_0_0_10px_rgba(20,184,166,0.10)]" />
              <span className="absolute bottom-[24%] right-[8%] h-3.5 w-3.5 rounded-full bg-teal-700 shadow-[0_0_0_10px_rgba(20,184,166,0.10)]" />
            </motion.div>
            <motion.div
              className="absolute inset-x-[4%] inset-y-[24%] rounded-full border border-teal-700/25"
              animate={reduceMotion ? undefined : { rotate: -360 }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
            />
            <div className="relative z-10 grid h-[118px] w-[118px] place-items-center rounded-full bg-teal-950 text-5xl font-black text-white shadow-[0_28px_70px_rgba(15,118,110,0.22)]">4</div>
            <strong className="absolute bottom-[12%] text-[11px] tracking-[0.25em]">AVAILABLE TOOLS</strong>
          </div>
        </section>

        <section id="tools-index-list" className="mx-auto grid w-[min(1180px,calc(100vw-32px))] border-b border-slate-200 py-16 md:grid-cols-2 md:py-24" aria-label="GateRank 工具列表">
          {PUBLIC_TOOL_DEFINITIONS.map((tool, index) => {
            const Icon = TOOL_ICONS[tool.key];
            return (
              <motion.a
                key={tool.key}
                href={tool.href}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(tool.href, { scrollToTop: true });
                }}
                whileHover={reduceMotion ? undefined : { y: -4 }}
                className="group relative grid min-h-[280px] grid-cols-[auto_minmax(0,1fr)] grid-rows-[1fr_auto] gap-6 border-t border-slate-200 p-7 transition-[background-color,box-shadow] duration-200 hover:z-10 hover:bg-teal-50 hover:shadow-[0_22px_50px_rgba(15,118,110,0.10)] focus-visible:z-10 focus-visible:bg-teal-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 md:p-12 md:odd:border-r md:[&:nth-child(n+3)]:border-b"
              >
                <span className="pt-1 text-xs font-black tracking-[0.12em] text-slate-400">0{index + 1}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-teal-700">
                    <Icon className="h-4 w-4" />
                    {tool.eyebrow}
                  </span>
                  <strong className="mt-4 text-[clamp(27px,3vw,38px)] leading-none tracking-[-0.035em]">{tool.label}</strong>
                  <span className="mt-5 max-w-[460px] text-sm leading-7 text-slate-500">{tool.summary}</span>
                </span>
                <span className="col-start-2 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
                  <span className="inline-flex items-center gap-2 text-xs font-black text-emerald-700">
                    <i className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_5px_rgba(16,185,129,0.12)]" />
                    可用
                  </span>
                  <span className="flex flex-wrap gap-2 md:justify-end">
                    {tool.features.map((feature) => (
                      <em key={feature} className="text-[11px] font-extrabold not-italic text-slate-500">{feature}</em>
                    ))}
                  </span>
                </span>
                <span className="absolute right-7 top-7 text-2xl text-teal-700 transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1" aria-hidden="true">↗</span>
              </motion.a>
            );
          })}
        </section>

        <section className="mx-auto w-[min(900px,calc(100vw-32px))] py-16 text-center md:py-24">
          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-teal-700">Data boundary</span>
          <h2 className="mt-3 text-[clamp(28px,4vw,44px)] font-black tracking-[-0.035em]">检测数据沿用现有处理方式</h2>
          <p className="mx-auto mt-5 max-w-[720px] text-[15px] leading-8 text-slate-500">
            工具中心本身不发起网络检测。下载、IP、流媒体与 DNS 功能继续使用各自现有接口、隐私说明、缓存策略和结果边界。
          </p>
        </section>
      </main>
    </PageFrame>
  );
}
