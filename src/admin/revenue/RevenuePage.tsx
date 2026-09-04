import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { defaultRevenueQuery, revenueSearch, revenueToday, revenuePresetRanges, REVENUE_DATE_PRESETS, type RevenueDatePreset, REVENUE_CHANNEL_LABELS, REVENUE_KIND_LABELS,
  type RevenueGroup, type RevenueOverview, type RevenuePage as Page, type RevenueQuery, type RevenueTable, type RevenueTotals, type RevenueTransaction } from '../../../shared/revenue';
import { readRevenueQuery, updateRevenueQuery } from './revenueState';
import { RevenueTrend, RevenueBreakdown, revenueMoney, revenuePercent } from './RevenueCharts';
const control = 'min-h-10 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50';
const tables: { key: RevenueTable; label: string }[] = [{ key: 'airports', label: '机场汇总' }, { key: 'periods', label: '日期汇总' }, { key: 'transactions', label: '交易明细' }];
const placementLabels: Record<string, string> = { home_card: '首页卡片', full_ranking_item: '全量榜单', risk_monitor_item: '风险监测', report_header: '机场报告', deal_card: '优惠活动', news_article: '资讯文章', unknown: '未知位置', home: '首页', home_ranking: '首页榜单', full_ranking: '全量榜单', report: '机场报告', deals: '活动优惠', home_new: '首页新入驻', home_hot: '首页热门' };
function Metric({ label, value, previous, count = false, prominent = false }: { label: string; value: number; previous: number; count?: boolean; prominent?: boolean }) {
  const change = previous ? (value - previous) / previous : null;
  return <section className={`min-w-0 rounded-[20px] border p-5 ${prominent ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white'}`}>
    <p className={`text-sm ${prominent ? 'text-neutral-300' : 'text-neutral-500'}`}>{label}</p><p className="mt-3 truncate text-2xl font-semibold tracking-tight tabular-nums xl:text-3xl" title={count ? String(value) : revenueMoney(value)}>{count ? value.toLocaleString() : revenueMoney(value)}</p>
    <p className={`mt-4 flex items-center gap-1 text-xs ${prominent ? 'text-neutral-300' : 'text-neutral-500'}`}>{change === null ? '无可比基数' : <>{change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change > 0 ? '+' : ''}{(change * 100).toFixed(1)}% <span className="ml-1">较上一等长区间</span></>}</p>
  </section>;
}
export function RevenuePage({ routeSearch, fetchJson, onUpdateUrl }: {
  routeSearch: string; fetchJson: (path: string, init?: RequestInit) => Promise<unknown>;
  onUpdateUrl: (path: string, mode?: 'push' | 'replace') => void;
}) {
  const query = useMemo(() => readRevenueQuery(routeSearch), [routeSearch]);
  const [overview, setOverview] = useState<RevenueOverview | null>(null);
  const [detail, setDetail] = useState<Page<RevenueGroup | RevenueTransaction> | null>(null);
  const [options, setOptions] = useState<{ key: string; name: string }[]>([]);
  const [keyword, setKeyword] = useState('');
  const [preferredPreset, setPreferredPreset] = useState<RevenueDatePreset>('recent');
  const [dates, setDates] = useState({ from: query.date_from, to: query.date_to });
  const [reload, setReload] = useState(0), [loading, setLoading] = useState(true), [detailLoading, setDetailLoading] = useState(true);
  const [error, setError] = useState(''), [detailError, setDetailError] = useState('');
  const update = (patch: Partial<RevenueQuery>) => onUpdateUrl(`/admin/revenue?${revenueSearch(updateRevenueQuery(query, patch))}`);
  const summarySearch = revenueSearch({ ...query, page: 1, table: 'airports', sort: 'amount', order: 'desc' });
  const detailSearch = revenueSearch(query);
  useEffect(() => setDates({ from: query.date_from, to: query.date_to }), [query.date_from, query.date_to]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setError(''); setOverview(null);
    void Promise.all([
      fetchJson(`/api/v1/admin/revenue/overview?${summarySearch}`, { signal: controller.signal }),
      fetchJson(`/api/v1/admin/revenue/filters?${summarySearch}`, { signal: controller.signal }),
    ]).then(([data, filters]) => { if (active) { setOverview(data as RevenueOverview); setOptions(filters as typeof options); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '收入统计加载失败'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [fetchJson, summarySearch, reload]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setDetailLoading(true); setDetailError(''); setDetail(null);
    void fetchJson(`/api/v1/admin/revenue/${query.table}?${detailSearch}`, { signal: controller.signal })
      .then(data => { if (active) setDetail(data as typeof detail); })
      .catch(reason => { if (active) setDetailError(reason instanceof Error ? reason.message : '明细加载失败'); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [fetchJson, detailSearch, reload]);
  const ranges = revenuePresetRanges();
  const matchesRange = (key: RevenueDatePreset) => ranges[key].date_from === query.date_from && ranges[key].date_to === query.date_to;
  const selectedPreset = matchesRange(preferredPreset) ? preferredPreset : REVENUE_DATE_PRESETS.find(item => matchesRange(item.key))?.key || '';
  const preset = (key: RevenueDatePreset) => {
    setPreferredPreset(key);
    update(ranges[key]);
  };
  const clear = () => { setKeyword(''); setPreferredPreset('recent'); onUpdateUrl(`/admin/revenue?${revenueSearch(defaultRevenueQuery())}`); };
  const columns: { key: keyof RevenueTotals; label: string; count?: boolean }[] = query.view === 'income'
    ? [{ key: 'amount_cents', label: '经营总收入' }, { key: 'application_cents', label: '入驻费收入' }, { key: 'click_cents', label: '点击收入' }, { key: 'advertising_cents', label: '广告收入' }]
    : [{ key: 'amount_cents', label: '实际总收款' }, { key: 'application_cents', label: '入驻收款' }, { key: 'recharge_cents', label: '充值收款' }, { key: 'record_count', label: '成功支付笔数', count: true }];
  const filteredOptions = options.filter(option => option.name.toLowerCase().includes(keyword.trim().toLowerCase()) || option.key === query.entity);
  const total = overview?.totals;
  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-1 text-xs font-medium tracking-widest text-neutral-400">REVENUE ANALYTICS</p><h2 className="text-2xl font-bold tracking-tight">收入统计</h2><p className="mt-2 text-sm text-neutral-500">按机场与日期，了解收入构成与资金到账。</p></div>
      <div className="flex items-center gap-3"><span className="text-xs text-neutral-400">{overview ? `更新于 ${new Date(overview.updated_at).toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}` : '北京时间'}</span><button type="button" onClick={() => setReload(value => value + 1)} disabled={loading || detailLoading} className={`${control} inline-flex items-center gap-2`}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />刷新</button></div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-xl bg-neutral-100 p-1" aria-label="统计口径">{(['income', 'receipts'] as const).map(view => <button type="button" key={view} aria-pressed={query.view === view} onClick={() => update({ view })} className={`min-h-10 rounded-lg px-5 text-sm font-medium focus-visible:outline-indigo-500 ${query.view === view ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>{view === 'income' ? '经营收入' : '实际收款'}</button>)}</div><p className="text-xs text-neutral-500">两种口径独立统计，请勿相加</p></div>
    <section aria-label="收入筛选" className="rounded-[20px] border border-neutral-200 bg-neutral-50/60 p-4">
      <form className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap" onSubmit={event => { event.preventDefault(); if (dates.from <= dates.to) update({ date_from: dates.from, date_to: dates.to }); }}>
        <label className="col-span-2 grid gap-1.5 text-xs text-neutral-500 sm:col-auto">快捷日期<select className={control} value={selectedPreset} onChange={event => preset(event.target.value as RevenueDatePreset)}><option value="" disabled>自定义日期</option>{REVENUE_DATE_PRESETS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        <label className="grid min-w-0 gap-1.5 text-xs text-neutral-500">开始日期<input aria-label="开始日期" type="date" required min="2000-01-01" max={dates.to} value={dates.from} onChange={event => setDates(value => ({ ...value, from: event.target.value }))} className={`${control} min-w-0 w-full`} /></label>
        <label className="grid min-w-0 gap-1.5 text-xs text-neutral-500">结束日期<input aria-label="结束日期" type="date" required min={dates.from} max={revenueToday()} value={dates.to} onChange={event => setDates(value => ({ ...value, to: event.target.value }))} className={`${control} min-w-0 w-full`} /></label>
        <button className="min-h-10 rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-indigo-500" type="submit">应用日期</button>
        <label className="grid gap-1.5 text-xs text-neutral-500">汇总粒度<select value={query.granularity} onChange={event => update({ granularity: event.target.value as RevenueQuery['granularity'] })} className={control}><option value="day">按日</option><option value="week">按周</option><option value="month">按月</option></select></label>
      </form>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap"><label className="relative min-w-0 flex-1"><Search size={15} className="absolute left-3 top-3 text-neutral-400" /><input aria-label="搜索机场或申请" value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="搜索机场或申请" className={`${control} w-full pl-9`} /></label>
        <label className="min-w-0 flex-1"><span className="sr-only">选择机场</span><select aria-label="选择机场" className={`${control} w-full`} value={query.entity} onChange={event => update({ entity: event.target.value })}><option value="">全部机场 / 申请</option>{query.entity && !filteredOptions.some(option => option.key === query.entity) && <option value={query.entity}>已选 {query.entity}（本期无记录）</option>}{filteredOptions.map(option => <option value={option.key} key={option.key}>{option.name}</option>)}</select></label>
        <button type="button" onClick={clear} className="min-h-10 px-2 text-sm text-neutral-500 underline-offset-4 hover:underline">重置筛选</button>
      </div>
    </section>
    <p className="border-l-2 border-neutral-300 pl-3 text-xs leading-6 text-neutral-500">{query.view === 'income' ? '经营收入 = 成功支付的入驻费 + 点击实际扣费 + 广告购买及续费扣费。' : '实际收款 = 成功支付的入驻费 + 支付渠道成功充值。'} 后台手动加款、人工标记付款和钱包调整均不计入。广告按扣费日期统计。</p>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button type="button" className="ml-3 min-h-10 underline" onClick={() => setReload(value => value + 1)}>重试</button></div>}
    {loading && <div role="status" aria-label="正在加载收入统计" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-36 animate-pulse rounded-[20px] bg-neutral-100" />)}</div>}
    {overview && total && <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{columns.map((column, index) => <div key={column.key} className="min-w-0"><Metric label={column.label} value={total[column.key]} previous={overview.previous[column.key]} count={column.count} prominent={index === 0} /></div>)}</div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-5 border-y border-neutral-100 py-5 sm:grid-cols-3 xl:grid-cols-6">{[
        ['贡献机场 / 申请', total.entity_count.toLocaleString()], ['单机场 / 申请平均贡献', revenueMoney(total.entity_count ? Math.round(total.amount_cents / total.entity_count) : 0)],
        ...(query.view === 'income' ? [['计费点击数', total.click_count.toLocaleString()], ['平均点击收入', revenueMoney(total.click_count ? Math.round(total.click_cents / total.click_count) : 0)], ['广告扣费笔数', total.advertising_count.toLocaleString()]] : [['充值笔数', String(overview.kinds.find(row => row.key === 'recharge')?.record_count || 0)], ['入驻支付笔数', String(overview.kinds.find(row => row.key === 'application')?.record_count || 0)], ['平均每笔收款', revenueMoney(total.record_count ? Math.round(total.amount_cents / total.record_count) : 0)]]),
        ['前五贡献占比', revenuePercent(overview.top_five_share)],
      ].map(([label, value]) => <div key={label}><p className="text-xs text-neutral-500">{label}</p><p className="mt-2 text-lg font-semibold tabular-nums">{value}</p></div>)}</div>
      {overview.missing_payment_time_count > 0 && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">有 {overview.missing_payment_time_count} 笔成功订单缺少付款时间，无法归属日期，未纳入统计。此提示覆盖当前机场范围内全部历史记录。</p>}
      {!total.record_count && <p className="text-sm text-neutral-500">所选范围暂无收入记录，可以调整日期或机场筛选。</p>}
      <RevenueTrend items={overview.trend} view={query.view} />
      <div className="grid gap-5 xl:grid-cols-2"><div className="space-y-5"><RevenueBreakdown title={query.view === 'income' ? '收入构成' : '收款构成'} items={overview.kinds} total={total.amount_cents} label={row => REVENUE_KIND_LABELS[row.key] || row.name} />
        {query.view === 'receipts' ? <RevenueBreakdown title="支付渠道" subtitle="按成功订单的支付渠道统计，金额为人民币计价" items={overview.channels} total={total.amount_cents} label={row => REVENUE_CHANNEL_LABELS[row.key] || row.name} /> : <RevenueBreakdown title="点击来源位置" subtitle="按已扣费点击记录追溯，无法关联时归入未知位置" items={overview.placements} total={total.click_cents} label={row => placementLabels[row.key] || row.name} />}
      </div><RevenueBreakdown title="机场贡献排行" subtitle="前 10 名 · 点击名称查看该机场数据" items={overview.top_airports} total={total.amount_cents} onSelect={row => update({ entity: row.key })} /></div>
    </>}
    <section className="overflow-hidden rounded-[20px] border border-neutral-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 p-4"><div className="flex flex-wrap gap-1">{tables.map(table => <button type="button" key={table.key} aria-pressed={query.table === table.key} onClick={() => update({ table: table.key, sort: table.key === 'transactions' || table.key === 'periods' ? 'time' : 'amount', order: 'desc' })} className={`min-h-10 rounded-lg px-3 text-sm font-medium focus-visible:outline-indigo-500 ${query.table === table.key ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500'}`}>{table.label}</button>)}</div>
        <div className="flex gap-2"><select aria-label="排序字段" className={control} value={query.sort} onChange={event => update({ sort: event.target.value as RevenueQuery['sort'] })}><option value="amount">按金额</option><option value="name">按名称 / 日期</option><option value="time">按时间</option></select><select aria-label="排序方向" className={control} value={query.order} onChange={event => update({ order: event.target.value as RevenueQuery['order'] })}><option value="desc">降序</option><option value="asc">升序</option></select></div>
      </div>
      {detailError && <p role="alert" className="p-5 text-sm text-red-700">{detailError}<button type="button" className="ml-3 min-h-10 underline" onClick={() => setReload(value => value + 1)}>重试明细</button></p>}
      {detailLoading ? <p role="status" className="p-8 text-center text-sm text-neutral-400">正在加载明细…</p> : detail && <>
        <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-left text-sm"><thead className="bg-neutral-50 text-xs text-neutral-500"><tr>{(query.table === 'transactions' ? ['时间（北京时间）', '机场 / 申请', '类型', '金额', '订单 / 流水编号'] : [query.table === 'airports' ? '机场 / 申请' : '日期区间起点', '总金额', '入驻费', query.view === 'income' ? '点击收入' : '充值收款', ...(query.view === 'income' ? ['广告收入'] : []), '交易笔数']).map(label => <th key={label} scope="col" className="whitespace-nowrap px-5 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-neutral-100">{detail.items.map(row => 'kind' in row ? <tr key={row.id} className="hover:bg-neutral-50/60"><td className="whitespace-nowrap px-5 py-4 text-neutral-500">{row.occurred_at.slice(0, 19).replace('T', ' ')}</td><td className="px-5 py-4"><button type="button" onClick={() => update({ entity: row.entity_key })} className="min-h-10 text-left font-medium hover:underline">{row.name}</button></td><td className="px-5 py-4">{REVENUE_KIND_LABELS[row.kind]}</td><td className="px-5 py-4 font-semibold tabular-nums">{revenueMoney(row.amount_cents)}</td><td className="px-5 py-4 text-xs text-neutral-500">{row.reference}</td></tr>
            : <tr key={row.key} className="hover:bg-neutral-50/60"><td className="px-5 py-4">{query.table === 'airports' ? <button type="button" onClick={() => update({ entity: row.key, table: 'transactions', sort: 'time' })} className="min-h-10 text-left font-medium hover:underline">{row.name}</button> : <span className="font-medium">{row.name}</span>}</td><td className="px-5 py-4 font-semibold tabular-nums">{revenueMoney(row.amount_cents)}</td><td className="px-5 py-4 tabular-nums">{revenueMoney(row.application_cents)}</td><td className="px-5 py-4 tabular-nums">{revenueMoney(query.view === 'income' ? row.click_cents : row.recharge_cents)}</td>{query.view === 'income' && <td className="px-5 py-4 tabular-nums">{revenueMoney(row.advertising_cents)}</td>}<td className="px-5 py-4 tabular-nums">{row.record_count}</td></tr>)}</tbody>
        </table>{!detail.items.length && <p className="p-8 text-center text-sm text-neutral-400">所选范围暂无明细</p>}</div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 px-5 py-4 text-xs text-neutral-500"><span>共 {detail.total.toLocaleString()} 条 · 第 {detail.page} / {Math.max(1, Math.ceil(detail.total / detail.page_size))} 页</span><div className="flex gap-2"><button type="button" className={`${control} inline-flex items-center gap-1`} disabled={detail.page <= 1} onClick={() => update({ page: detail.page - 1 })}><ChevronLeft size={15} />上一页</button><button type="button" className={`${control} inline-flex items-center gap-1`} disabled={detail.page * detail.page_size >= detail.total} onClick={() => update({ page: detail.page + 1 })}>下一页<ChevronRight size={15} /></button></div></div>
      </>}
    </section>
  </div>;
}
