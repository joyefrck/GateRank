import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ExternalLink } from 'lucide-react';
import {
  buildAbsoluteUrl,
  buildMonthlyReportsHref,
  navigate,
  PageFrame,
  usePageSeo,
} from '../../site/publicSite';
import {
  buildMonthlyReportPath,
  buildMonthlyReportSeo,
  buildMonthlyReportsSeo,
} from '../../../shared/publicSeo';

interface MonthlyReportListItem {
  id: number;
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
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MonthlyReport extends MonthlyReportListItem {
  content_markdown: string;
  content_html: string;
}

interface MonthlyReportListView {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: MonthlyReportListItem[];
}

export function MonthlyReportsPage({ page = 1 }: { page?: number }) {
  const initial = readInitialData<MonthlyReportListView>('monthly_reports');
  const [view, setView] = useState<MonthlyReportListView | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState('');
  const seo = useMemo(() => buildMonthlyReportsSeo({ total: view?.total }), [view?.total]);

  usePageSeo({
    ...seo,
    canonicalPath: buildMonthlyReportsHref(page),
    structuredData: view ? [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: seo.title,
        description: seo.description,
        url: buildAbsoluteUrl(buildMonthlyReportsHref(page)),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: view.items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.title,
          url: buildAbsoluteUrl(buildMonthlyReportPath(item.slug)),
        })),
      },
    ] : undefined,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    apiFetch<MonthlyReportListView>(`/api/v1/monthly-reports?page=${page}&page_size=12`)
      .then((data) => {
        if (!cancelled) setView(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '月度报告加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page]);

  const groupedReports = useMemo(() => groupReportsByYear(view?.items || []), [view?.items]);
  const latestReport = groupedReports[0]?.items[0] || null;
  const latestMonthLabel = latestReport ? `${latestReport.year}.${String(latestReport.month).padStart(2, '0')}` : '-';

  return (
    <PageFrame active="monthly_reports">
      <main className="max-w-7xl mx-auto px-4 pt-10 md:pt-14 pb-10 text-neutral-950">
          <section className="relative overflow-hidden rounded-[32px] border border-neutral-200 bg-[linear-gradient(135deg,#0b3028_0%,#17483b_42%,#dfe9df_100%)] px-6 py-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.16)] md:px-10 md:py-12">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(255,255,255,0.28), transparent 35%)' }} />
            <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/80 backdrop-blur">
                  月度报告
                </div>
                <h1 className="mt-5 max-w-4xl text-[28px] font-black leading-[1.02] tracking-tight md:text-5xl md:leading-[0.95] lg:text-[56px]">
                  2026机场推荐月度报告
                  <span className="block text-[26px] leading-[1.06] text-white/45 md:text-4xl lg:text-[46px]">按月份追踪机场排行榜与测评结论</span>
                </h1>
                <p className="mt-5 max-w-3xl text-sm leading-7 text-white/72 md:text-base">
                  {seo.description}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <HeroMetric label="已发布月报" value={String(view?.total ?? 0)} />
                <HeroMetric label="最新月份" value={latestMonthLabel} />
                <HeroMetric label="当前分页" value={view ? `${view.page}/${view.total_pages}` : '-'} />
                <HeroMetric label="核心主题" value="机场推荐" />
              </div>
            </div>
          </section>

          {error && <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          {loading && !view ? <div className="mt-8 text-sm text-neutral-500">加载中...</div> : null}

          <section className="mt-12">
            <div className="flex flex-col gap-3 border-b border-neutral-200 pb-6 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-neutral-400">Reports Archive</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-neutral-900 md:text-3xl">按年份归档</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-neutral-500">
                  按年份分组、按月份降序排列。每行是一份独立月报，可快速查看当月机场推荐、机场排行榜变化、稳定性与价格观察。
                </p>
              </div>
              <div className="text-sm font-bold text-neutral-500">
                共 <span className="font-black text-neutral-900">{view?.total ?? 0}</span> 份月报
              </div>
            </div>
            <div className="grid gap-10 pt-8">
              {groupedReports.map((group) => (
                <section key={group.year} className="grid gap-4 md:grid-cols-[140px_minmax(0,1fr)]">
                  <div>
                    <div className="sticky top-24 text-5xl font-black tracking-tight text-neutral-900">{group.year}</div>
                    <div className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-neutral-400">{group.items.length} Reports</div>
                  </div>
                  <div className="border-t border-neutral-200">
                    {group.items.map((item) => <MonthlyReportRow key={item.id} item={item} />)}
                  </div>
                </section>
              ))}
            </div>
            {view && view.items.length === 0 ? <div className="pt-8 text-sm text-neutral-500">当前暂无已发布月度报告。</div> : null}
          </section>

          <section className="mt-12 border-t border-neutral-200 pt-8">
            <h2 className="text-2xl font-black">2026机场推荐、机场排行榜与机场测评索引</h2>
            <p className="mt-3 max-w-4xl text-[15px] leading-8 text-neutral-600">
              这个页面是 GateRank 月度报告总入口，用来把每月机场推荐结论、机场排行榜变化、机场测评样本、稳定机场推荐、便宜机场推荐、测速表现和跑路风险集中沉淀为可追踪的长期内容。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {['机场推荐', '2026机场推荐', '机场排行榜', '机场测评', '稳定机场推荐', '便宜机场推荐'].map((item) => (
                <span key={item} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-sm font-bold text-neutral-700">
                  {item}
                </span>
              ))}
            </div>
          </section>

          <section className="mt-10 border-t border-neutral-200 pt-8">
            <h2 className="text-2xl font-black">月度报告如何服务机场推荐搜索</h2>
            <p className="mt-3 max-w-4xl text-[15px] leading-8 text-neutral-600">
              每篇月报会把当月机场排行榜、全量榜单、测速稳定性、价格变化、支付方式、客户端兼容性和风险事件放在同一条时间线上，帮助需要机场推荐、稳定机场推荐或便宜机场推荐的用户先看趋势，再进入单个机场测评报告。
            </p>
          </section>

          {view && view.total_pages > 1 ? (
            <div className="flex items-center justify-between text-sm text-neutral-600">
              <button className="rounded border px-3 py-2 disabled:opacity-40" disabled={page <= 1} onClick={() => navigate(buildMonthlyReportsHref(page - 1))}>上一页</button>
              <span>{page} / {view.total_pages}</span>
              <button className="rounded border px-3 py-2 disabled:opacity-40" disabled={page >= view.total_pages} onClick={() => navigate(buildMonthlyReportsHref(page + 1))}>下一页</button>
            </div>
          ) : null}
      </main>
    </PageFrame>
  );
}

export function MonthlyReportDetailPage({ slug }: { slug: string }) {
  const initial = readInitialData<MonthlyReport>('monthly_report');
  const [report, setReport] = useState<MonthlyReport | null>(initial && initial.slug === slug ? initial : null);
  const [loading, setLoading] = useState(!report);
  const [error, setError] = useState('');
  const seo = report ? buildMonthlyReportSeo(report) : buildMonthlyReportsSeo();

  usePageSeo({
    ...seo,
    canonicalPath: report ? buildMonthlyReportPath(report.slug) : `/monthly-reports/${slug}`,
    structuredData: report ? [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: report.title,
        description: seo.description,
        url: buildAbsoluteUrl(buildMonthlyReportPath(report.slug)),
        datePublished: report.published_at,
        dateModified: report.updated_at,
      },
    ] : undefined,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    apiFetch<MonthlyReport>(`/api/v1/monthly-reports/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '月度报告加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <PageFrame active="monthly_reports">
      <main className="min-h-screen bg-white text-neutral-950">
        <section className="mx-auto grid w-[min(980px,calc(100vw-32px))] gap-6 py-10 md:py-14">
          {loading && !report ? <div className="text-sm text-neutral-500">加载中...</div> : null}
          {error ? <div className="rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
          {report ? (
            <>
              <header className="rounded-[28px] border border-neutral-200 bg-neutral-50 p-6 md:p-9">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-neutral-500">{report.year}-{String(report.month).padStart(2, '0')}</div>
                <h1 className="mt-4 text-4xl font-black leading-tight tracking-normal md:text-5xl">{report.h1 || report.title}</h1>
                <p className="mt-5 text-[16px] leading-8 text-neutral-600">{seo.description}</p>
              </header>
              {report.cover_image_url ? <img className="max-h-[460px] w-full rounded-3xl border border-neutral-200 object-cover" src={report.cover_image_url} alt={report.title} /> : null}
              <article
                className="monthly-report-react-content rounded-3xl border border-neutral-200 p-5 md:p-8"
                dangerouslySetInnerHTML={{ __html: report.content_html }}
              />
              <div className="grid gap-3 rounded-3xl border border-neutral-200 p-5 text-sm md:grid-cols-3">
                <RelatedLink href="/rankings/all" label="全量榜单" />
                <RelatedLink href="/risk-monitor" label="跑路监测" />
                <RelatedLink href="/methodology" label="测评方法" />
              </div>
            </>
          ) : null}
        </section>
      </main>
    </PageFrame>
  );
}

function MonthlyReportRow({ item }: { item: MonthlyReportListItem; key?: React.Key }) {
  const href = buildMonthlyReportPath(item.slug);
  const monthLabel = `${String(item.month).padStart(2, '0')}月`;
  return (
    <article className="group grid gap-4 border-b border-neutral-200 py-5 transition-colors hover:bg-neutral-50/80 md:grid-cols-[92px_minmax(0,1fr)_132px] md:items-center">
      <div>
        <div className="font-mono text-3xl font-black tracking-tight text-neutral-900">{monthLabel}</div>
        <div className="mt-1 text-xs font-bold text-neutral-400">{item.year}</div>
      </div>
      <div className="min-w-0">
        <h3 className="text-lg font-black tracking-tight text-neutral-950 md:text-xl">
          <a href={href} onClick={(event) => { event.preventDefault(); navigate(href); }} className="transition-colors group-hover:text-rose-600">
            {item.title}
          </a>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-7 text-neutral-500">{item.excerpt || item.seo_description}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-neutral-400">
          <span>机场推荐</span>
          <span>机场排行榜</span>
          <span>机场测评</span>
        </div>
      </div>
      <button className="inline-flex items-center justify-start gap-2 text-sm font-black text-neutral-900 transition-colors group-hover:text-rose-600 md:justify-end" onClick={() => navigate(href)}>
        查看月报 <ArrowRight size={14} />
      </button>
    </article>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-white/60">{label}</div>
      <div className="mt-2 text-2xl font-black leading-tight text-white md:text-3xl">{value}</div>
    </div>
  );
}

function groupReportsByYear(items: MonthlyReportListItem[]): Array<{ year: number; items: MonthlyReportListItem[] }> {
  const sorted = [...items].sort((a, b) => (b.year - a.year) || (b.month - a.month) || b.id - a.id);
  const groups: Array<{ year: number; items: MonthlyReportListItem[] }> = [];
  for (const item of sorted) {
    const current = groups[groups.length - 1];
    if (!current || current.year !== item.year) {
      groups.push({ year: item.year, items: [item] });
    } else {
      current.items.push(item);
    }
  }
  return groups;
}

function RelatedLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="inline-flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 font-black" href={href} onClick={(event) => { event.preventDefault(); navigate(href); }}>
      {label}
      <ExternalLink size={14} />
    </a>
  );
}

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include' });
  if (!response.ok) {
    const data = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(data?.message || `请求失败: ${response.status}`);
  }
  return await response.json() as T;
}

function readInitialData<T>(kind: string): T | null {
  const element = document.getElementById('__GATERANK_INITIAL_DATA__');
  if (!element?.textContent) return null;
  try {
    const envelope = JSON.parse(element.textContent) as { kind?: string; payload?: T };
    return envelope.kind === kind && envelope.payload ? envelope.payload : null;
  } catch {
    return null;
  }
}
