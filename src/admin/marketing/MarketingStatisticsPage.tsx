import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';
import {
  AIRPORT_HOME_AD_SLOTS,
  type AdminAirportAdDerivedStatus,
  type AdminAirportAdPlacementFilter,
  type AdminAirportAdStatsListItem,
  type AdminAirportAdStatsListView,
  type AdminAirportAdStatsView,
  type AdminAirportAdStatusFilter,
} from '../../../shared/airportAds';
import { MarketingModuleTabs } from './MarketingModuleTabs';
import {
  buildAdminMarketingStatisticsSearch,
  readAdminMarketingStatisticsQuery,
  updateAdminMarketingStatisticsQuery,
} from './marketingStatisticsState';

type FetchJson = (path: string, init?: RequestInit) => Promise<unknown>;

export function MarketingStatisticsPage({
  routeSearch,
  fetchJson,
  onUpdateUrl,
  onNavigateTab,
}: {
  routeSearch: string;
  fetchJson: FetchJson;
  onUpdateUrl: (path: string, mode?: 'push' | 'replace') => void;
  onNavigateTab: (path: string) => void;
}) {
  const query = useMemo(() => readAdminMarketingStatisticsQuery(routeSearch), [routeSearch]);
  const [keywordInput, setKeywordInput] = useState(query.q);
  const [data, setData] = useState<AdminAirportAdStatsListView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedCampaign, setSelectedCampaign] = useState<AdminAirportAdStatsListItem | null>(null);
  const [detail, setDetail] = useState<AdminAirportAdStatsView | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailReloadKey, setDetailReloadKey] = useState(0);

  useEffect(() => setKeywordInput(query.q), [query.q]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      page: String(query.page),
      status: query.status,
      placement: query.placement,
    });
    if (query.q) params.set('q', query.q);
    setLoading(true);
    setError('');
    void fetchJson(`/api/v1/admin/marketing/ad-campaigns?${params.toString()}`)
      .then((payload) => {
        if (!active) return;
        const next = payload as AdminAirportAdStatsListView;
        setData(next);
        if (next.pagination.total_pages > 0 && query.page > next.pagination.total_pages) {
          updateUrl({ page: next.pagination.total_pages }, 'replace');
        }
      })
      .catch((reason) => {
        if (!active) return;
        setData(null);
        setError(reason instanceof Error ? reason.message : '营销统计加载失败');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchJson, query.page, query.placement, query.q, query.status, reloadKey]);

  useEffect(() => {
    if (!selectedCampaign) return;
    let active = true;
    setDetailLoading(true);
    setDetailError('');
    void fetchJson(`/api/v1/admin/marketing/ad-campaigns/${selectedCampaign.campaign_id}/stats?page=${detailPage}`)
      .then((payload) => {
        if (active) setDetail(payload as AdminAirportAdStatsView);
      })
      .catch((reason) => {
        if (active) setDetailError(reason instanceof Error ? reason.message : '每日统计加载失败');
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [detailPage, detailReloadKey, fetchJson, selectedCampaign]);

  const updateUrl = (
    patch: Partial<ReturnType<typeof readAdminMarketingStatisticsQuery>>,
    mode: 'push' | 'replace' = 'push',
  ) => {
    const next = updateAdminMarketingStatisticsQuery(query, patch);
    onUpdateUrl(`/admin/marketing-statistics${buildAdminMarketingStatisticsSearch(next)}`, mode);
  };

  const openDetail = (campaign: AdminAirportAdStatsListItem) => {
    setSelectedCampaign(campaign);
    setDetail(null);
    setDetailPage(1);
    setDetailError('');
  };

  const closeDetail = () => {
    if (detailLoading) return;
    setSelectedCampaign(null);
    setDetail(null);
    setDetailPage(1);
    setDetailError('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">营销模块</h2>
          <p className="mt-1 text-sm text-neutral-500">查看全部机场广告投放的累计表现与每日访问数据。</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded border border-neutral-300 px-3 py-2 text-sm"
          onClick={() => setReloadKey((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> 刷新
        </button>
      </div>

      <MarketingModuleTabs active="statistics" onNavigate={onNavigateTab} />

      <form
        className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(240px,1fr)_180px_180px]"
        onSubmit={(event) => {
          event.preventDefault();
          updateUrl({ q: keywordInput });
        }}
      >
        <label className="relative block">
          <span className="sr-only">搜索机场名称或优惠码</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            className="w-full rounded-xl border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-neutral-900"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="搜索机场名称或优惠码"
          />
        </label>
        <select
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
          value={query.status}
          onChange={(event) => updateUrl({ status: event.target.value as AdminAirportAdStatusFilter })}
          aria-label="投放状态"
        >
          <option value="all">全部状态</option>
          <option value="active">投放中</option>
          <option value="expired">已到期</option>
          <option value="canceled">已下架</option>
        </select>
        <select
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm"
          value={query.placement}
          onChange={(event) => updateUrl({ placement: event.target.value as AdminAirportAdPlacementFilter })}
          aria-label="投放位置"
        >
          <option value="all">全部位置</option>
          <option value="deal">普通优惠活动</option>
          {AIRPORT_HOME_AD_SLOTS.map((slot) => <option key={slot} value={`home_${slot}`}>首页 {slot} 号位</option>)}
        </select>
      </form>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button type="button" className="font-semibold underline" onClick={() => setReloadKey((value) => value + 1)}>重新加载</button>
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
              <tr>
                <th className="px-4 py-3">机场 / 优惠码</th>
                <th className="px-4 py-3">投放位置</th>
                <th className="px-4 py-3">申请有效期</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3 text-right">曝光</th>
                <th className="px-4 py-3 text-right">点击</th>
                <th className="px-4 py-3 text-right">CTR</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {loading && !data && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-neutral-500">正在加载营销统计...</td></tr>
              )}
              {!loading && !error && data?.items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-neutral-500">没有符合条件的投放记录</td></tr>
              )}
              {data?.items.map((item) => (
                <tr key={item.campaign_id} className="align-top">
                  <td className="px-4 py-4"><div className="font-semibold text-neutral-950">{item.airport_name}</div><div className="mt-1 text-xs text-neutral-500">{item.coupon_code}</div></td>
                  <td className="px-4 py-4">{formatPlacement(item.home_slot)}{item.home_slot !== null && <div className="mt-1 text-xs text-neutral-500">含活动优惠页</div>}</td>
                  <td className="px-4 py-4"><div>{formatDate(item.starts_at)} — {formatDate(item.ends_at)}</div><div className="mt-1 text-xs text-neutral-500">累计 {item.purchased_months} 个月</div></td>
                  <td className="px-4 py-4"><StatusBadge status={item.status} /></td>
                  <td className="px-4 py-4 text-right font-semibold">{formatCount(item.summary.impressions)}</td>
                  <td className="px-4 py-4 text-right font-semibold">{formatCount(item.summary.clicks)}</td>
                  <td className="px-4 py-4 text-right font-semibold">{formatCtr(item.summary.ctr)}</td>
                  <td className="px-4 py-4 text-right"><button type="button" className="font-semibold underline underline-offset-4" onClick={() => openDetail(item)}>每日统计</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 px-4 py-3 text-sm text-neutral-500">
          <span>共 {data?.pagination.total || 0} 条投放</span>
          <div className="flex items-center gap-2">
            <button type="button" className="rounded border border-neutral-300 px-3 py-2 disabled:opacity-40" disabled={loading || query.page <= 1} onClick={() => updateUrl({ page: query.page - 1 })}><ChevronLeft size={14} /></button>
            <span>{query.page} / {Math.max(1, data?.pagination.total_pages || 1)}</span>
            <button type="button" className="rounded border border-neutral-300 px-3 py-2 disabled:opacity-40" disabled={loading || !data || query.page >= data.pagination.total_pages} onClick={() => updateUrl({ page: query.page + 1 })}><ChevronRight size={14} /></button>
          </div>
        </div>
      </section>

      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 md:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="admin-marketing-stats-title" className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5 md:p-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">{selectedCampaign.airport_name} · {formatPlacement(selectedCampaign.home_slot)}</div>
                <h3 id="admin-marketing-stats-title" className="mt-2 text-2xl font-black">每日统计</h3>
                <p className="mt-2 text-sm text-neutral-500">优惠码 {selectedCampaign.coupon_code} · {formatDate(selectedCampaign.starts_at)} — {formatDate(selectedCampaign.ends_at)} · 累计 {selectedCampaign.purchased_months} 个月</p>
                <p className="mt-1 text-sm text-neutral-500">{detail?.tracking_started_on ? `精确统计始于 ${detail.tracking_started_on}` : '上线前历史无法精确归属到本条广告'}</p>
              </div>
              <button type="button" aria-label="关闭每日统计" className="rounded-full border border-neutral-300 p-2 disabled:opacity-40" onClick={closeDetail} disabled={detailLoading}><X size={18} /></button>
            </header>
            <div className="space-y-5 p-5 md:p-6">
              {detailError && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{detailError}</span><button type="button" className="font-semibold underline" onClick={() => setDetailReloadKey((value) => value + 1)}>重新加载</button></div>
              )}
              {detailLoading && !detail && <div className="rounded-xl bg-neutral-50 px-6 py-12 text-center text-sm text-neutral-500">正在加载访问统计...</div>}
              {detail && (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <MetricCard label="累计曝光" value={formatCount(detail.summary.impressions)} />
                    <MetricCard label="累计点击" value={formatCount(detail.summary.clicks)} />
                    <MetricCard label="总体点击率" value={formatCtr(detail.summary.ctr)} />
                  </div>
                  {detail.tracking_started_on === null ? (
                    <div className="rounded-xl border border-dashed border-neutral-300 px-6 py-12 text-center"><div className="font-semibold">暂无精确访问数据</div><p className="mt-2 text-sm text-neutral-500">该投放早于单条广告精确统计功能，历史事件不做猜测归属。</p></div>
                  ) : (
                    <>
                      <div className="overflow-hidden rounded-xl border border-neutral-200">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-neutral-50 text-neutral-500"><tr><th className="px-4 py-3">日期</th><th className="px-4 py-3 text-right">曝光</th><th className="px-4 py-3 text-right">点击</th><th className="px-4 py-3 text-right">点击率</th></tr></thead>
                          <tbody className="divide-y divide-neutral-100">{detail.daily.map((item) => <tr key={item.date}><td className="px-4 py-3">{item.date}</td><td className="px-4 py-3 text-right font-semibold">{formatCount(item.impressions)}</td><td className="px-4 py-3 text-right font-semibold">{formatCount(item.clicks)}</td><td className="px-4 py-3 text-right font-semibold">{formatCtr(item.ctr)}</td></tr>)}</tbody>
                        </table>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-500"><span>共 {detail.pagination.total} 天 · 每页 30 条</span><div className="flex items-center gap-2"><button type="button" className="rounded border border-neutral-300 px-3 py-2 disabled:opacity-40" disabled={detailLoading || detailPage <= 1} onClick={() => setDetailPage((page) => page - 1)}>上一页</button><span>{detailPage} / {Math.max(1, detail.pagination.total_pages)}</span><button type="button" className="rounded border border-neutral-300 px-3 py-2 disabled:opacity-40" disabled={detailLoading || detailPage >= detail.pagination.total_pages} onClick={() => setDetailPage((page) => page + 1)}>下一页</button></div></div>
                    </>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</div><div className="mt-3 text-3xl font-black">{value}</div></div>;
}

function StatusBadge({ status }: { status: AdminAirportAdDerivedStatus }) {
  const label = status === 'active' ? '投放中' : status === 'expired' ? '已到期' : '已下架';
  const theme = status === 'active' ? 'bg-emerald-50 text-emerald-700' : status === 'expired' ? 'bg-neutral-100 text-neutral-600' : 'bg-rose-50 text-rose-700';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${theme}`}>{label}</span>;
}

function formatPlacement(homeSlot: number | null): string {
  return homeSlot === null ? '普通优惠活动' : `首页 ${homeSlot} 号位`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

function formatCtr(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(2)}%`;
}
