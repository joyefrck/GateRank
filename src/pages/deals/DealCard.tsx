import React, { useRef, useState } from 'react';
import { ArrowRight, Check, Copy, ExternalLink, Sparkles } from 'lucide-react';

import type { AirportDealView } from '../../../shared/airportAds';
import { navigate, normalizeExternalHref } from '../../site/publicSite';
import { createTrackedOutboundClickHandler, useMarketingImpression } from '../../site/marketing';

interface DealCardProps {
  key?: React.Key;
  deal: AirportDealView;
  tone: string;
  pagePath: string;
  detailHref: string;
  showDetailAction?: boolean;
}

export function DealCard({ deal, tone, pagePath, detailHref, showDetailAction = true }: DealCardProps) {
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
        <DealField label="优惠码">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-7 items-center rounded-lg bg-blue-50 px-2.5 font-black text-blue-700">{deal.coupon_code}</span>
            <button
              type="button"
              onClick={() => void copyCoupon()}
              aria-label={copied ? '优惠码已复制' : '复制优惠码'}
              title={copied ? '优惠码已复制' : '复制优惠码'}
              className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </span>
        </DealField>
        <DealField label="折扣说明">{deal.discount_description}</DealField>
        <DealField label="适用套餐">{deal.applicable_plan}</DealField>
        <DealField label="活动时间">{formatDate(deal.starts_at)} ～ {formatDate(deal.ends_at)}</DealField>
      </ul>

      <div className="my-4 h-px bg-slate-200" />

      <ul className="m-0 grid list-none gap-2 p-0">
        <SupportRow label="是否可叠加" ok={deal.is_stackable} yes="可叠加" no="不可叠加" />
        <SupportRow label="是否支持退款" ok={deal.refund_supported} yes="支持" no="不支持" />
      </ul>

      <div className={`mt-4 grid grid-cols-2 gap-y-1.5 border-t border-slate-200 pt-4 ${showDetailAction ? 'sm:grid-cols-[minmax(130px,1.15fr)_minmax(90px,.8fr)_minmax(76px,.65fr)]' : 'sm:grid-cols-2'} sm:gap-y-0`}>
        {showDetailAction ? (
          <a
            href={detailHref}
            onClick={(event) => { event.preventDefault(); navigate(detailHref); }}
            className="group col-span-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-900 bg-stone-900 px-3 text-[13px] font-black text-white shadow-[0_8px_18px_rgba(23,23,23,0.14)] transition duration-200 hover:-translate-y-0.5 hover:bg-stone-800 hover:shadow-[0_12px_24px_rgba(23,23,23,0.18)] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2 motion-reduce:transform-none sm:col-span-1"
          >
            优惠详情
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        ) : null}
        <a
          href={deal.report_url}
          onClick={(event) => { event.preventDefault(); navigate(deal.report_url); }}
          className={`inline-flex h-10 items-center justify-center px-2 text-[13px] font-black text-slate-600 transition hover:text-slate-950 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 ${showDetailAction ? 'sm:border-l sm:border-slate-200' : ''} ${!showDetailAction && websiteHref === '#' ? 'col-span-2' : ''}`}
        >
          查看测评
        </a>
        {websiteHref === '#' ? null : (
          <a
            href={websiteHref}
            target="_blank"
            onClick={outboundClick}
            rel="sponsored nofollow noreferrer noopener"
            className="inline-flex h-10 items-center justify-center gap-1 border-l border-slate-200 px-2 text-[13px] font-black text-slate-600 transition hover:text-slate-950 focus-visible:rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            官网
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
