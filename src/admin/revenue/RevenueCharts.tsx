import React, { useState } from 'react';
import { REVENUE_KIND_LABELS, type RevenueGroup, type RevenueKind, type RevenueView } from '../../../shared/revenue';
export const revenueMoney = (cents: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(cents / 100);
export const revenuePercent = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;
export const revenueColors = ['#171717', '#6366f1', '#94a3b8'];
export function RevenueTrend({ items, view }: { items: RevenueGroup[]; view: RevenueView }) {
  const [active, setActive] = useState<number | null>(null);
  const kinds: RevenueKind[] = view === 'income' ? ['application', 'click', 'advertising'] : ['application', 'recharge'];
  const amount = (row: RevenueGroup, kind: RevenueKind) => row[`${kind}_cents`];
  const maximum = Math.max(100, ...items.map(row => row.amount_cents));
  const x = (index: number) => 68 + index * 710 / Math.max(1, items.length - 1);
  const y = (value: number) => 204 - value * 164 / maximum;
  const selected = active !== null ? items[active] : null;
  return <section className="rounded-[20px] border border-neutral-200 bg-white p-4 md:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{view === 'income' ? '经营收入' : '实际收款'}趋势</h3><p className="mt-1 text-xs text-neutral-500">按北京时间汇总 · 空白日期补零</p></div>
      <div className="flex flex-wrap gap-3 text-xs text-neutral-500">{kinds.map((kind, i) => <span key={kind} className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: revenueColors[i] }} />{REVENUE_KIND_LABELS[kind]}</span>)}</div></div>
    <svg viewBox="0 0 810 240" className="mt-5 w-full" role="group" aria-label="收入趋势图，使用 Tab 查看各周期金额">
      {[0, 0.5, 1].map(ratio => <g key={ratio}><line x1="68" x2="778" y1={y(maximum * ratio)} y2={y(maximum * ratio)} stroke="#e5e5e5" strokeDasharray="4 5" /><text x="57" y={y(maximum * ratio) + 4} textAnchor="end" fontSize="11" fill="#737373">{(maximum * ratio / 100).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</text></g>)}
      {kinds.map((kind, color) => <polyline key={kind} fill="none" stroke={revenueColors[color]} strokeWidth="2.5" strokeLinejoin="round" points={items.map((item, index) => `${x(index)},${y(amount(item, kind))}`).join(' ')} />)}
      {items.map((item, index) => <g key={item.key}>
        {(index === 0 || index === items.length - 1 || index % Math.max(1, Math.ceil(items.length / 6)) === 0) && <text x={x(index)} y="230" textAnchor="middle" fill="#737373" fontSize="11">{item.key.slice(5)}</text>}
        {kinds.map((kind, color) => <circle key={kind} cx={x(index)} cy={y(amount(item, kind))} r={items.length === 1 ? 4 : 2} fill={revenueColors[color]} />)}
        <rect x={x(index) - Math.min(18, 355 / Math.max(1, items.length - 1))} y="30" width={Math.min(36, 710 / Math.max(1, items.length - 1))} height="180" fill={active === index ? '#6366f10b' : 'transparent'} tabIndex={0}
          aria-label={`${item.key}，合计 ${revenueMoney(item.amount_cents)}，${kinds.map(kind => `${REVENUE_KIND_LABELS[kind]} ${revenueMoney(amount(item, kind))}`).join('，')}`}
          onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} className="outline-none focus:stroke-indigo-500" />
      </g>)}
    </svg>
    <div className="min-h-8 text-xs text-neutral-500" aria-live="polite">{selected ? <span className="flex flex-wrap gap-x-4 gap-y-1"><b className="text-neutral-900">{selected.key}</b>{kinds.map(kind => <span key={kind}>{REVENUE_KIND_LABELS[kind]} {revenueMoney(amount(selected, kind))}</span>)}<b className="text-neutral-900">合计 {revenueMoney(selected.amount_cents)}</b></span> : '悬停或使用键盘查看各周期金额，完整数值见下方日期汇总。'}</div>
  </section>;
}
export function RevenueBreakdown({ title, subtitle, items, total, label = row => row.name, onSelect }: {
  title: string; subtitle?: string; items: RevenueGroup[]; total: number;
  label?: (row: RevenueGroup) => string; onSelect?: (row: RevenueGroup) => void;
}) {
  return <section className="min-w-0 rounded-[20px] border border-neutral-200 bg-white p-4 md:p-6"><h3 className="font-semibold">{title}</h3>{subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
    <div className="mt-5 space-y-4">{items.length ? items.map((item, index) => <div key={item.key}>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        {onSelect ? <button type="button" onClick={() => onSelect(item)} className="min-h-10 min-w-0 truncate text-left font-medium underline-offset-4 hover:underline focus-visible:outline-indigo-500" title={label(item)}>{index + 1}. {label(item)}</button> : <span className="min-w-0 truncate" title={label(item)}>{label(item)}</span>}
        <span className="shrink-0 text-right tabular-nums"><span className="font-semibold">{revenueMoney(item.amount_cents)}</span><span className="ml-2 text-xs text-neutral-400">{revenuePercent(total ? item.amount_cents / total : 0)}</span></span>
      </div><div className="h-1.5 overflow-hidden rounded-full bg-neutral-100"><div className="h-full rounded-full" style={{ width: `${total ? item.amount_cents / total * 100 : 0}%`, background: onSelect ? '#171717' : revenueColors[index % 3] }} /></div>
      {title === '点击来源位置' && <p className="mt-2 text-xs text-neutral-500">{item.click_count.toLocaleString()} 次计费 · 平均 {revenueMoney(item.click_count ? Math.round(item.amount_cents / item.click_count) : 0)} / 次</p>}
    </div>) : <p className="py-6 text-sm text-neutral-400">所选范围暂无数据</p>}</div>
  </section>;
}
