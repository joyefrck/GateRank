import React, { useRef, useState } from 'react';
import { Copy, ExternalLink, Sparkles } from 'lucide-react';

import type { AirportDealView } from '../../../shared/airportAds';
import { navigate, normalizeExternalHref } from '../../site/publicSite';
import { createTrackedOutboundClickHandler, useMarketingImpression } from '../../site/marketing';

interface DealCardProps {
  key?: React.Key;
  deal: AirportDealView;
  tone: string;
  pagePath: string;
  detailHref: string;
}

export function DealCard({ deal, tone, pagePath, detailHref }: DealCardProps) {
  const ref = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const websiteHref = normalizeExternalHref(deal.website);
  useMarketingImpression({
    airportId: deal.airport_id,
    campaignId: deal.campaign_id,
    pageKind: 'deals',
    placement: 'deal_card',
    pagePath,
    dedupeKey: `${pagePath}|deal_card|${deal.campaign_id}`,
    ref,
  });
  const outboundClick = createTrackedOutboundClickHandler({
    airportId: deal.airport_id,
    campaignId: deal.campaign_id,
    pageKind: 'deals',
    placement: 'deal_card',
    targetKind: 'website',
    targetUrl: websiteHref,
    pagePath,
  });

  const copyCoupon = async () => {
    try {
      await navigator.clipboard.writeText(deal.coupon_code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article ref={ref} className="relative rounded-2xl border border-slate-200 bg-white p-[22px] shadow-[0_8px_24px_rgba(15,23,42,0.035)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(15,23,42,0.07)]">
      <span className="absolute right-[18px] top-[18px] inline-flex h-[26px] items-center rounded-[7px] border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-500">广告</span>
      <div className="mb-[18px] flex items-center gap-3.5 pr-14">
        <div className={`grid h-[54px] w-[54px] shrink-0 place-items-center rounded-[13px] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] ${toneClass(tone)}`}>
          <Sparkles className="h-6 w-6" />
        </div>
        <h2 className="m-0 text-2xl font-black tracking-normal text-slate-950">
          <a href={detailHref} onClick={(event) => { event.preventDefault(); navigate(detailHref); }}>
            {deal.airport_name}
          </a>
        </h2>
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

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <button type="button" onClick={() => void copyCoupon()} className="inline-flex h-[38px] items-center justify-center gap-2 rounded-lg bg-neutral-950 px-2.5 text-[13px] font-black text-white">
          <Copy className="h-4 w-4" />
          {copied ? '已复制' : '复制优惠码'}
        </button>
        <a href={detailHref} onClick={(event) => { event.preventDefault(); navigate(detailHref); }} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-black text-slate-900">优惠详情</a>
        <a href={deal.report_url} onClick={(event) => { event.preventDefault(); navigate(deal.report_url); }} className="inline-flex h-[38px] items-center justify-center rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-black text-slate-900">查看测评</a>
        {websiteHref === '#' ? null : (
          <a href={websiteHref} target="_blank" onClick={outboundClick} rel="sponsored nofollow noreferrer noopener" className="inline-flex h-[38px] items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[13px] font-black text-slate-900">
            访问官网
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
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

function toneClass(tone: string): string {
  if (tone === 'indigo') return 'bg-[linear-gradient(135deg,#2563eb,#7c3aed)]';
  if (tone === 'purple') return 'bg-[linear-gradient(135deg,#7c3aed,#a78bfa)]';
  if (tone === 'orange') return 'bg-[linear-gradient(135deg,#f97316,#ef4444)]';
  if (tone === 'teal') return 'bg-[linear-gradient(135deg,#14b8a6,#22c55e)]';
  return 'bg-[linear-gradient(135deg,#1d4ed8,#38bdf8)]';
}

function formatDate(value: string): string {
  return value.slice(0, 10);
}
