import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Info, ShieldAlert } from 'lucide-react';

import {
  buildAirportDealDetailFaqItems,
  buildAirportDealDetailSeo,
  buildAirportDealDetailStructuredData,
} from '../../../shared/publicSeo';
import type { AirportDealDetailView } from '../../../shared/airportAds';
import { getAirportFilterLabel } from '../../../shared/airportFilterCatalog';
import {
  buildAbsoluteUrl,
  buildAirportDealDetailHref,
  buildDealsHref,
  navigate,
  normalizeExternalHref,
  PageFrame,
  usePageSeo,
} from '../../site/publicSite';
import { DealCard } from './DealCard';
import { readDealDetailInitialData, shouldFetchDealDetailData } from './dealDetailInitialData';

export function DealDetailPage({ slug }: { slug: string }) {
  const initialData = useMemo(() => readDealDetailInitialData(slug), [slug]);
  const [data, setData] = useState<AirportDealDetailView | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!shouldFetchDealDetailData(initialData)) {
      setData(initialData);
      setLoading(false);
      setError('');
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');
    fetch(`/api/v1/pages/deals/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`请求失败: ${response.status}`);
        return await response.json() as AirportDealDetailView;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((reason: unknown) => {
        if (active) {
          setData(null);
          setError(reason instanceof Error ? reason.message : '机场优惠页面加载失败');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialData, slug]);

  const canonicalPath = buildAirportDealDetailHref(slug);
  const seo = useMemo(() => data
    ? buildAirportDealDetailSeo(data, Number(data.generated_at.slice(0, 4)))
    : {
      title: '机场优惠码与活动信息 | 机场榜GateRank',
      description: '查询机场优惠码、活动期限、适用套餐与测评信息。',
      keywords: '机场优惠码,机场优惠,机场折扣,GateRank',
    }, [data]);
  const structuredData = useMemo(() => data
    ? buildAirportDealDetailStructuredData(
      buildAbsoluteUrl('/').replace(/\/+$/, ''),
      data,
      Number(data.generated_at.slice(0, 4)),
    )
    : [], [data]);
  usePageSeo({
    ...seo,
    canonicalPath,
    robots: data ? undefined : 'noindex,follow',
    structuredData,
  });

  if (loading) {
    return <PageFrame active="deals"><main className="mx-auto min-h-[60vh] max-w-5xl px-6 py-20 text-slate-500">正在加载机场优惠信息</main></PageFrame>;
  }
  if (error || !data) {
    return <PageFrame active="deals"><main className="mx-auto min-h-[60vh] max-w-5xl px-6 py-20 text-rose-700">{error || '机场优惠页面不存在'}</main></PageFrame>;
  }

  const detailHref = buildAirportDealDetailHref(data.airport.slug);
  const websiteHref = normalizeExternalHref(data.airport.website);
  const paymentMethods = data.airport.payment_methods.length > 0
    ? data.airport.payment_methods.map((method) => getAirportFilterLabel('payment', method)).join('、')
    : '暂未收录';
  const faqItems = buildAirportDealDetailFaqItems(data);

  return (
    <PageFrame active="deals">
      <main className="bg-[radial-gradient(circle_at_85%_7%,rgba(249,115,22,0.09),transparent_25%),linear-gradient(180deg,#fff_0%,#fffaf5_58%,#fff_100%)] pb-10">
        <div className="mx-auto w-[min(1240px,calc(100%-64px))] pt-10 md:pt-14">
          <section className="rounded-[18px] bg-[linear-gradient(135deg,#431407_0%,#c2410c_48%,#fed7aa_100%)] p-7 text-white md:p-10">
            <nav className="text-sm text-orange-100" aria-label="面包屑">
              <a href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }}>首页</a>
              <span className="px-2">/</span>
              <a href={buildDealsHref()} onClick={(event) => { event.preventDefault(); navigate(buildDealsHref()); }}>活动优惠</a>
              <span className="px-2">/</span>
              {data.airport.name}
            </nav>
            <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-orange-100">Airport Deals</div>
                <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">{data.airport.name}优惠码与最新优惠活动</h1>
                <p className="mt-4 max-w-3xl text-base leading-8 text-orange-50">{seo.description}</p>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                <HeroMetric label="有效活动" value={String(data.active_deals.length)} />
                <HeroMetric label="月付价格" value={data.airport.plan_price_month > 0 ? `¥${data.airport.plan_price_month}` : '未收录'} />
                <HeroMetric label="试用支持" value={data.airport.has_trial ? '支持' : '不支持'} />
              </dl>
            </div>
          </section>

          <RiskNotice status={data.airport.status} airportName={data.airport.name} />

          <section className="mt-8" aria-labelledby="active-deals-heading">
            <h2 id="active-deals-heading" className="text-2xl font-black text-slate-950">{data.airport.name}有效优惠码与折扣</h2>
            {data.active_deals.length > 0 ? (
              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                {data.active_deals.map((deal, index) => (
                  <DealCard
                    key={deal.campaign_id}
                    deal={deal}
                    tone={['orange', 'purple', 'blue', 'teal'][index % 4]}
                    pagePath={detailHref}
                    detailHref={detailHref}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-orange-200 bg-white px-6 py-12 text-center">
                <Info className="mx-auto h-7 w-7 text-orange-500" />
                <h3 className="mt-3 text-xl font-black text-slate-950">当前暂无有效优惠码</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">本页会保留并在新活动生效后自动更新，请勿继续使用已经过期的优惠码。</p>
              </div>
            )}
          </section>

          <section className="mt-8 rounded-[18px] border border-slate-200 bg-white p-6">
            <h2 className="text-2xl font-black text-slate-950">购买前先核对服务能力与风险</h2>
            <dl className="mt-5 grid gap-4 md:grid-cols-3">
              <InfoItem label="机场状态" value={formatStatus(data.airport.status)} />
              <InfoItem label="支付方式" value={paymentMethods} />
              <InfoItem label="机场简介" value={data.airport.airport_intro || '暂未收录机场简介。'} />
            </dl>
            <div className="mt-5 flex flex-wrap gap-3">
              <a href={`/airports/${encodeURIComponent(data.airport.slug)}`} onClick={(event) => { event.preventDefault(); navigate(`/airports/${encodeURIComponent(data.airport.slug)}`); }} className="inline-flex min-h-11 items-center rounded-lg bg-slate-950 px-5 text-sm font-black text-white">查看测评报告</a>
              {websiteHref === '#' ? null : <a href={websiteHref} target="_blank" rel="sponsored nofollow noreferrer noopener" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-5 text-sm font-black text-slate-900">访问官网<ExternalLink className="h-4 w-4" /></a>}
            </div>
          </section>

          <section className="mt-8 rounded-[18px] border border-slate-200 bg-white p-6">
            <h2 className="text-2xl font-black text-slate-950">{data.airport.name}优惠码怎么使用</h2>
            <p className="mt-3 text-sm leading-8 text-slate-600">复制仍在有效期内的优惠码，在服务商结算页面选择适用套餐后填写。提交订单前再次核对折后金额、活动期限、退款与叠加规则。优惠信息不影响 GateRank Score。</p>
          </section>

          <section className="mt-8 rounded-[18px] border border-slate-200 bg-white p-6">
            <h2 className="text-2xl font-black text-slate-950">{data.airport.name}优惠码常见问题</h2>
            <div className="mt-5 grid gap-3">
              {faqItems.map((item) => <article key={item.question} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><h3 className="font-black text-slate-950">{item.question}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{item.answer}</p></article>)}
            </div>
          </section>
        </div>
      </main>
    </PageFrame>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/20 bg-white/10 px-2 py-4"><dt className="text-[11px] font-bold text-orange-100">{label}</dt><dd className="mt-1 text-lg font-black">{value}</dd></div>;
}

function RiskNotice({ status, airportName }: { status: AirportDealDetailView['airport']['status']; airportName: string }) {
  if (status === 'normal') return null;
  const down = status === 'down';
  return <section className={`mt-6 flex gap-3 rounded-xl border px-5 py-4 ${down ? 'border-rose-300 bg-rose-50 text-rose-800' : 'border-amber-300 bg-amber-50 text-amber-800'}`}>{down ? <ShieldAlert className="h-5 w-5 shrink-0" /> : <AlertTriangle className="h-5 w-5 shrink-0" />}<div><strong>{airportName}{down ? '当前已标记为跑路' : '当前处于风险观察'}</strong><p className="mt-1 text-sm">请勿仅因优惠信息购买，先核对风险记录、官网和订阅可用性。</p></div></section>;
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><dt className="text-xs font-black text-slate-500">{label}</dt><dd className="mt-2 text-sm leading-7 text-slate-800">{value}</dd></div>;
}

function formatStatus(status: AirportDealDetailView['airport']['status']): string {
  if (status === 'down') return '已跑路';
  if (status === 'risk') return '风险观察';
  return '正常';
}
