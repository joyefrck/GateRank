import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Bot,
  Copy,
  ExternalLink,
  Eye,
  Info,
  Scale,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { buildDealsSeo } from '../../../shared/publicSeo';
import type { AirportDealView } from '../../../shared/airportAds';
import { buildAbsoluteUrl, buildDealsHref, navigate, PageFrame, usePageSeo } from '../../site/publicSite';
import { createTrackedOutboundClickHandler, trackMarketingPageView } from '../../site/marketing';

interface DealsResponse {
  items: AirportDealView[];
  total: number;
}

export function DealsPage() {
  const initialData = useMemo(() => readInitialDealsData(), []);
  const [data, setData] = useState<DealsResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState('');

  const seo = useMemo(() => buildDealsSeo({ activeDeals: data?.total ?? 0 }), [data?.total]);
  usePageSeo({
    ...seo,
    canonicalPath: buildDealsHref(),
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: seo.title,
      description: seo.description,
      url: buildAbsoluteUrl(buildDealsHref()),
    },
  });

  useEffect(() => {
    trackMarketingPageView('deals', buildDealsHref());
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch('/api/v1/pages/deals')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`请求失败: ${response.status}`);
        }
        return (await response.json()) as DealsResponse;
      })
      .then((payload) => {
        if (active) {
          setData(payload);
          setError('');
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : '活动优惠加载失败');
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
  }, []);

  const deals = useMemo(() => data?.items ?? [], [data?.items]);

  const copyCoupon = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(''), 1800);
    } catch {
      setCopiedCode('');
    }
  };

  return (
    <PageFrame active="deals">
      <main className="bg-[radial-gradient(circle_at_85%_7%,rgba(37,99,235,0.08),transparent_25%),linear-gradient(180deg,#fff_0%,#fbfdff_58%,#fff_100%)] pb-4">
        <div className="mx-auto w-[min(1240px,calc(100%-64px))] pt-8">
          <div className="mb-8 flex items-center justify-center gap-2 rounded-[10px] border border-blue-200 bg-blue-50 px-[18px] py-3.5 text-center text-[15px] text-blue-900">
            <Info className="h-5 w-5" />
            <strong>重要说明：</strong>
            <span>本页用于展示优惠活动与优惠码，不代表 GateRank 测评推荐。请结合测评报告、风险记录与自身需求独立判断。</span>
          </div>

          {error && <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          {loading && <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">正在加载活动优惠</div>}

          <section id="deals" className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3" aria-label="机场优惠卡片">
            {deals.map((deal, index) => (
              <DealCard
                key={deal.campaign_id}
                deal={deal}
                tone={['blue', 'indigo', 'purple', 'orange', 'teal', 'purple'][index % 6]}
                copied={copiedCode === deal.coupon_code}
                onCopy={() => void copyCoupon(deal.coupon_code)}
              />
            ))}
            {!loading && deals.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500">当前暂无活动。</div>
            )}
          </section>

          <section className="mt-8 grid overflow-hidden rounded-[18px] border border-slate-200 bg-white lg:grid-cols-3" aria-label="广告透明原则">
            <TrustCard icon={<Eye />} title="广告标识透明" body="所有商业合作内容均明确标注“广告”，保障信息透明与知情权。" />
            <TrustCard icon={<Scale />} title="不卖排名" body="我们不出售排名或提供榜单位置，坚持独立客观的测评原则。" />
            <TrustCard icon={<ShieldCheck />} title="优惠信息独立于评分" body="优惠活动不影响 GateRank Score，评分仅基于真实使用数据与监测结果。" />
          </section>
        </div>
      </main>
    </PageFrame>
  );
}

function DealCard({ deal, tone, copied, onCopy }: { key?: React.Key; deal: AirportDealView; tone: string; copied: boolean; onCopy: () => void }) {
  const websiteHref = normalizeExternalHref(deal.website);
  const outboundClick = createTrackedOutboundClickHandler({
    airportId: deal.airport_id,
    pageKind: 'deals',
    placement: 'deal_card',
    targetKind: 'website',
    targetUrl: websiteHref,
    pagePath: buildDealsHref(),
  });
  return (
    <article className="relative rounded-2xl border border-slate-200 bg-white p-[22px] shadow-[0_8px_24px_rgba(15,23,42,0.035)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(15,23,42,0.07)]">
      <span className="absolute right-[18px] top-[18px] inline-flex h-[26px] items-center rounded-[7px] border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-500">广告</span>
      <div className="mb-[18px] flex items-center gap-3.5 pr-14">
        <div className={`grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[13px] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] ${toneClass(tone)}`}>
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="m-0 text-2xl font-black tracking-normal text-slate-950">{deal.airport_name}</h2>
      </div>

      <ul className="m-0 grid list-none gap-2.5 p-0">
        <DealField label="优惠码"><span className="inline-flex h-7 items-center rounded-lg bg-blue-50 px-2.5 font-black text-blue-700">{deal.coupon_code}</span></DealField>
        <DealField label="折扣说明">{deal.discount_description}</DealField>
        <DealField label="适用套餐">{deal.applicable_plan}</DealField>
        <DealField label="活动时间">{formatDate(deal.starts_at)} ～ {formatDate(deal.ends_at)}</DealField>
      </ul>

      <div className="my-4 h-px bg-slate-200" />

      <ul className="m-0 grid list-none gap-2 p-0">
        <SupportRow label="是否可叠加" ok={deal.is_stackable} yes="可叠加" no="不可叠加" />
        <SupportRow label="是否支持退款" ok={deal.refund_supported} yes="支持" no="不支持" />
      </ul>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-[1.15fr_0.9fr_0.9fr]">
        <button type="button" onClick={onCopy} className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg bg-neutral-950 px-2.5 text-[13px] font-black text-white">
          <Copy className="h-4 w-4" />
          {copied ? '已复制' : '复制优惠码'}
        </button>
        <a href={deal.report_url} onClick={(event) => { event.preventDefault(); navigate(deal.report_url); }} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-black text-slate-900">查看测评</a>
        <a href={websiteHref} target="_blank" onClick={outboundClick} rel="nofollow noreferrer noopener" className="inline-flex h-[38px] items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-black text-slate-900">
          访问官网
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-4 grid gap-1 border-t border-slate-200 pt-3.5 text-xs text-slate-500">
        <span>◇ 本活动不影响 GateRank Score</span>
      </div>
    </article>
  );
}

function DealField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[112px_1fr] items-start gap-3 text-sm">
      <span className="flex items-center gap-1.5 whitespace-nowrap font-black text-slate-600">◎ {label}</span>
      <span className="font-semibold text-slate-800">{children}</span>
    </li>
  );
}

function SupportRow({ label, ok, yes = '支持', no = '不支持' }: { label: string; ok: boolean; yes?: string; no?: string }) {
  return (
    <li className="flex items-center justify-between gap-3.5 text-sm text-slate-700">
      <span className="inline-flex items-center gap-1.5 font-black">♙ {label}</span>
      <span className={`inline-flex h-6 min-w-16 items-center justify-center rounded-full border px-2 text-xs font-black ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{ok ? yes : no}</span>
    </li>
  );
}

function TrustCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] items-center gap-[22px] border-b border-slate-200 p-8 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-blue-50 text-blue-600 [&>svg]:h-[38px] [&>svg]:w-[38px]">{icon}</div>
      <div>
        <h3 className="m-0 text-[22px] font-black tracking-normal text-slate-950">{title}</h3>
        <p className="m-0 mt-1.5 text-[15px] leading-7 text-slate-500">{body}</p>
      </div>
    </div>
  );
}

function toneClass(tone: string): string {
  if (tone === 'indigo') return 'bg-[linear-gradient(135deg,#2563eb,#7c3aed)]';
  if (tone === 'purple') return 'bg-[linear-gradient(135deg,#7c3aed,#a78bfa)]';
  if (tone === 'orange') return 'bg-[linear-gradient(135deg,#f97316,#ef4444)]';
  if (tone === 'teal') return 'bg-[linear-gradient(135deg,#14b8a6,#22c55e)]';
  return 'bg-[linear-gradient(135deg,#1d4ed8,#38bdf8)]';
}

function normalizeExternalHref(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '#';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}

function readInitialDealsData(): DealsResponse | null {
  const element = document.getElementById('__GATERANK_INITIAL_DATA__');
  if (!element?.textContent) {
    return null;
  }
  try {
    const envelope = JSON.parse(element.textContent) as { kind?: string; payload?: DealsResponse };
    return envelope.kind === 'deals' && envelope.payload ? envelope.payload : null;
  } catch {
    return null;
  }
}
