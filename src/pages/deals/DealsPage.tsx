import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CircleHelp,
  Eye,
  Info,
  ListChecks,
  Scale,
  ShieldCheck,
  Sparkles,
  Tags,
  WalletCards,
} from 'lucide-react';

import { DEALS_CONTENT_SECTIONS, DEALS_FAQ_ITEMS, buildDealsSeo, buildDealsStructuredData } from '../../../shared/publicSeo';
import { ListPageHero } from '../../components/ListPageHero';
import { buildAbsoluteUrl, buildAirportDealDetailHref, buildDealsHref, PageFrame, usePageSeo } from '../../site/publicSite';
import { readDealsInitialData, shouldFetchDealsData, type DealsResponse } from './dealsInitialData';
import { DealCard } from './DealCard';

export function DealsPage() {
  const initialData = useMemo(() => readDealsInitialData(), []);
  const [data, setData] = useState<DealsResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');

  const seo = useMemo(() => buildDealsSeo({ activeDeals: data?.total ?? 0 }), [data?.total]);

  useEffect(() => {
    if (!shouldFetchDealsData(initialData)) {
      setData(initialData);
      setLoading(false);
      setError('');
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');
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
  }, [initialData]);

  const deals = useMemo(() => data?.items ?? [], [data?.items]);
  const structuredData = useMemo(
    () => buildDealsStructuredData(buildAbsoluteUrl('/').replace(/\/+$/, ''), deals, buildDealsHref()),
    [deals],
  );
  usePageSeo({
    ...seo,
    canonicalPath: buildDealsHref(),
    structuredData,
  });

  return (
    <PageFrame active="deals">
      <main className="bg-[radial-gradient(circle_at_85%_7%,rgba(37,99,235,0.08),transparent_25%),linear-gradient(180deg,#fff_0%,#fbfdff_58%,#fff_100%)] pb-4">
        <div className="mx-auto w-[min(1240px,calc(100%-64px))] pt-10 md:pt-14">
          <div className="mb-8">
            <ListPageHero
              eyebrow="Deals & Coupons"
              title="机场优惠码大全：活动折扣、免费试用与 USDT 支付优惠"
              subtitle=""
              description={seo.description}
              tone="orange"
              stats={[
                { label: '当前活动', value: `${deals.length}` },
                { label: '免费试用', value: `${deals.filter((deal) => deal.supports_trial).length}+` },
                { label: '支持 USDT', value: `${deals.filter((deal) => deal.supports_usdt).length}+` },
              ]}
            />
          </div>

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
                pagePath={buildDealsHref()}
                detailHref={buildAirportDealDetailHref(deal.airport_slug)}
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

          <DealsGuide />
          <DealsFaq />
        </div>
      </main>
    </PageFrame>
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

function DealsGuide() {
  const icons = [<Tags />, <BookOpenCheck />, <ListChecks />, <Sparkles />, <WalletCards />];
  return (
    <section className="mt-8 rounded-[18px] border border-slate-200 bg-white p-6" aria-label="机场优惠码指南">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Coupon Guide</div>
      <h2 className="mt-2 text-2xl font-black tracking-normal text-slate-950">机场优惠码和活动折扣怎么判断</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {DEALS_CONTENT_SECTIONS.map((section, index) => (
          <article key={section.title} className="rounded-[8px] border border-slate-200 bg-slate-50 p-5">
            <div className="grid grid-cols-[44px_1fr] gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-[8px] bg-white text-blue-600 [&>svg]:h-5 [&>svg]:w-5">{icons[index] || <Info />}</div>
              <div>
                <h3 className="text-lg font-black tracking-normal text-slate-950">{section.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{section.body}</p>
                <ul className="mt-3 grid gap-1.5 text-xs font-bold text-slate-500">
                  {section.facts.map((fact) => (
                    <li key={fact}>・{fact}</li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DealsFaq() {
  return (
    <section className="mt-8 rounded-[18px] border border-slate-200 bg-white p-6" aria-label="机场优惠码常见问题">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">FAQ</div>
      <h2 className="mt-2 text-2xl font-black tracking-normal text-slate-950">机场优惠码常见问题</h2>
      <div className="mt-5 grid gap-3">
        {DEALS_FAQ_ITEMS.map((item) => (
          <article key={item.question} className="grid grid-cols-[40px_1fr] gap-4 rounded-[8px] border border-slate-200 bg-slate-50 p-4">
            <div className="grid h-10 w-10 place-items-center rounded-[8px] bg-white text-slate-700">
              <CircleHelp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-normal text-slate-950">{item.question}</h3>
              <p className="mt-1.5 text-sm leading-7 text-slate-600">{item.answer}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
