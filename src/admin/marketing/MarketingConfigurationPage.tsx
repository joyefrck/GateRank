import React, { useEffect, useRef, useState } from 'react';
import { Plus, RefreshCw, Search, X } from 'lucide-react';
import { AIRPORT_HOME_AD_SLOTS } from '../../../shared/airportAds';
import type { ManualAdInput, ManualAdList, ManualAdStatus, ManualAdView } from '../../../shared/manualAds';
import { MarketingModuleTabs } from './MarketingModuleTabs';

type FetchJson = (path: string, init?: RequestInit) => Promise<unknown>;
const inputClass = 'min-h-10 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/20 disabled:bg-neutral-100';
const secondaryClass = 'inline-flex min-h-10 shrink-0 whitespace-nowrap items-center justify-center gap-2 rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40';
const primaryClass = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40';
const statusLabels: Record<ManualAdStatus, string> = { scheduled: '待投放', active: '投放中', expired: '已到期', canceled: '已下架' };

function beijingInput(value: string | Date) {
  return new Date(new Date(value).getTime() + 8 * 3600_000).toISOString().slice(0, 16);
}
function displayDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}
function placement(ad: ManualAdView) { return ad.home_slot ? `首页 ${ad.home_slot} 号位` : '普通优惠活动'; }
function message(reason: unknown) { return reason instanceof Error ? reason.message : '操作失败，请重试'; }

export function MarketingConfigurationPage({ fetchJson, onNavigateTab }: { fetchJson: FetchJson; onNavigateTab: (path: string) => void }) {
  const [data, setData] = useState<ManualAdList | null>(null);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [position, setPosition] = useState('all');
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editor, setEditor] = useState<ManualAdView | 'new' | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ManualAdView | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const query = new URLSearchParams({ page: String(page), q, status, placement: position });
    void fetchJson(`/api/v1/admin/marketing/manual-ads?${query}`).then(payload => {
      if (!active) return;
      const result = payload as ManualAdList;
      if (result.pagination.total_pages > 0 && page > result.pagination.total_pages) setPage(result.pagination.total_pages);
      setData(result);
    }).catch(reason => { if (active) { setError(message(reason)); setData(null); } }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchJson, page, q, status, position, reload]);

  const cancel = async () => {
    if (!cancelTarget || canceling) return;
    setCanceling(true); setCancelError('');
    try {
      await fetchJson(`/api/v1/admin/marketing/manual-ads/${cancelTarget.campaign_id}/cancel`, { method: 'POST' });
      setNotice('广告已下架'); setCancelTarget(null); setReload(value => value + 1);
    } catch (reason) { setCancelError(message(reason)); }
    finally { setCanceling(false); }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-bold">营销模块</h2><p className="mt-1 text-sm text-neutral-500">手动配置首页广告与优惠活动，免费投放并统计访问表现。</p></div>
      <button className={secondaryClass} disabled={loading} onClick={() => setReload(value => value + 1)}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} />刷新</button>
    </div>
    <MarketingModuleTabs active="configuration" onNavigate={onNavigateTab} />
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-neutral-500">首页投放同时展示在活动优惠页；同一广告位的投放时间不能重叠。</div><button className={primaryClass} onClick={() => { setNotice(''); setEditor('new'); }}><Plus size={16} />新增投放</button></div>
    {notice && <div role="status" className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    <form className="grid gap-3 md:grid-cols-[minmax(180px,1fr)_140px_160px_auto]" onSubmit={event => { event.preventDefault(); setPage(1); setQ(keyword.trim()); }}>
      <label className="relative"><span className="sr-only">搜索机场名称或优惠码</span><Search className="pointer-events-none absolute left-3 top-3 text-neutral-400" size={16} /><input className={`${inputClass} pl-9`} value={keyword} onChange={event => setKeyword(event.target.value)} placeholder="搜索机场名称或优惠码" /></label>
      <select aria-label="投放状态" className={inputClass} value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="all">全部状态</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select aria-label="投放位置" className={inputClass} value={position} onChange={event => { setPosition(event.target.value); setPage(1); }}><option value="all">全部位置</option><option value="deal">普通优惠活动</option>{AIRPORT_HOME_AD_SLOTS.map(slot => <option key={slot} value={`home_${slot}`}>首页 {slot} 号位</option>)}</select>
      <button className={secondaryClass} type="submit">搜索</button>
    </form>
    <div className="overflow-x-auto rounded-[18px] border border-neutral-200" aria-busy={loading}>
      <table className="w-full min-w-[840px] text-left text-sm"><thead className="bg-neutral-50 text-xs text-neutral-500"><tr>{['机场 / 优惠内容', '投放位置', '投放时间（北京时间）', '状态', '最近操作人', '操作'].map(label => <th className="px-4 py-3 font-semibold" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-neutral-100">
        {loading ? <tr><td colSpan={6} className="px-4 py-12 text-center text-neutral-500">正在加载投放…</td></tr> : error ? <tr><td colSpan={6} className="px-4 py-12 text-center"><p role="alert" className="mb-3 text-rose-700">{error}</p><button className={secondaryClass} onClick={() => setReload(value => value + 1)}>重新加载</button></td></tr> : !data?.items.length ? <tr><td colSpan={6} className="px-4 py-12 text-center text-neutral-500">暂无符合条件的手动投放</td></tr> : data.items.map(ad => <tr key={ad.campaign_id}>
          <td className="max-w-[240px] px-4 py-4"><div className="font-semibold">{ad.airport_name}</div><div className="mt-1 break-words">{ad.discount_title}</div><div className="mt-1 text-xs text-neutral-500">优惠码：{ad.coupon_code || '无'}</div></td>
          <td className="px-4 py-4"><div>{placement(ad)}</div>{ad.home_slot && <div className="mt-1 text-xs text-neutral-500">含活动优惠页</div>}</td>
          <td className="px-4 py-4"><div>{displayDate(ad.starts_at)}</div><div className="mt-1 text-neutral-500">至 {displayDate(ad.ends_at)}</div></td>
          <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ad.status === 'active' ? 'bg-emerald-50 text-emerald-700' : ad.status === 'scheduled' ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-600'}`}>{statusLabels[ad.status]}</span></td>
          <td className="px-4 py-4 text-neutral-500">{ad.updated_by || '—'}</td>
          <td className="px-4 py-4">{ad.status !== 'canceled' ? <div className="flex gap-3"><button className="min-h-10 font-medium underline-offset-4 hover:underline focus-visible:outline" onClick={() => setEditor(ad)}>编辑</button><button className="min-h-10 text-rose-700 underline-offset-4 hover:underline focus-visible:outline" onClick={() => { setCancelError(''); setCancelTarget(ad); }}>下架</button></div> : '—'}</td>
        </tr>)}
      </tbody></table>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-neutral-500"><span>共 {data?.pagination.total || 0} 条手动投放</span><div className="flex items-center gap-3"><button className={secondaryClass} disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>上一页</button><span>{page} / {Math.max(1, data?.pagination.total_pages || 0)}</span><button className={secondaryClass} disabled={loading || page >= (data?.pagination.total_pages || 0)} onClick={() => setPage(value => value + 1)}>下一页</button></div></div>
    {editor && <Modal title={editor === 'new' ? '新增手动投放' : '编辑手动投放'} busy={busy} onClose={() => setEditor(null)}><AdEditor initial={editor === 'new' ? null : editor} fetchJson={fetchJson} onBusy={setBusy} onSaved={() => { setEditor(null); setNotice('广告配置已保存'); setReload(value => value + 1); }} onClose={() => setEditor(null)} /></Modal>}
    {cancelTarget && <Modal title="下架广告" busy={canceling} onClose={() => setCancelTarget(null)}><p className="text-sm leading-6 text-neutral-600">下架“{cancelTarget.airport_name} · {cancelTarget.discount_title}”后，该广告停止展示，历史访问统计保留。</p>{cancelError && <p className="mt-3 text-sm text-rose-700" role="alert">{cancelError}</p>}<div className="mt-6 flex justify-end gap-3"><button className={secondaryClass} disabled={canceling} onClick={() => setCancelTarget(null)}>取消</button><button className={primaryClass} disabled={canceling} onClick={() => void cancel()}>{canceling ? '正在下架…' : '确认下架'}</button></div></Modal>}
  </div>;
}

function Modal({ title, busy, onClose, children }: { title: string; busy: boolean; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef({ busy, onClose }); latest.current = { busy, onClose };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !latest.current.busy) { event.preventDefault(); latest.current.onClose(); }
      if (event.key === 'Tab') {
        const elements: HTMLElement[] = Array.from<HTMLElement>(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []);
        const first = elements[0], last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('keydown', keydown); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="manual-ad-dialog-title" className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[20px] border border-neutral-200 bg-white p-5 outline-none sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><h3 id="manual-ad-dialog-title" className="text-lg font-bold">{title}</h3><button className={secondaryClass} aria-label="关闭弹窗" disabled={busy} onClick={onClose}><X size={18} /></button></div>{children}</div></div>;
}

function AdEditor({ initial, fetchJson, onBusy, onSaved, onClose }: { initial: ManualAdView | null; fetchJson: FetchJson; onBusy: (value: boolean) => void; onSaved: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ airport_id: initial?.airport_id || 0, home_slot: String(initial?.home_slot || ''), coupon_code: initial?.coupon_code || '', discount_title: initial?.discount_title || '', discount_description: initial?.discount_description || '', applicable_plan: initial?.applicable_plan || '', discount_percent: initial?.discount_percent == null ? '' : String(initial.discount_percent), is_stackable: initial?.is_stackable || false, refund_supported: initial?.refund_supported || false, starts_at: beijingInput(initial?.starts_at || new Date()), ends_at: beijingInput(initial?.ends_at || new Date(Date.now() + 30 * 86400_000)) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [airportKeyword, setAirportKeyword] = useState('');
  const [airportQuery, setAirportQuery] = useState('');
  const [airportPage, setAirportPage] = useState(1);
  const [airports, setAirports] = useState<{ id: number; name: string; eligible: boolean }[]>([]);
  const [airportTotal, setAirportTotal] = useState(0);
  const [airportLoading, setAirportLoading] = useState(false);
  const [airportError, setAirportError] = useState('');
  const [selectedAirport, setSelectedAirport] = useState(initial?.airport_name || '');
  const [airportReload, setAirportReload] = useState(0);
  useEffect(() => {
    if (initial) return;
    let active = true; setAirportLoading(true); setAirportError('');
    const query = new URLSearchParams({ q: airportQuery, page: String(airportPage) });
    void fetchJson(`/api/v1/admin/marketing/manual-ads/airports?${query}`).then(payload => {
      if (!active) return;
      const result = payload as { items: typeof airports; total: number };
      setAirports(result.items); setAirportTotal(result.total);
    }).catch(reason => { if (active) { setAirports([]); setAirportError(message(reason)); } }).finally(() => { if (active) setAirportLoading(false); });
    return () => { active = false; };
  }, [airportQuery, airportPage, airportReload, fetchJson, initial]);
  const set = (key: keyof typeof form, value: string | number | boolean) => setForm(current => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return; setError('');
    if (!form.airport_id) { setError('请选择机场'); return; }
    if (form.ends_at <= form.starts_at) { setError('结束时间必须晚于开始时间'); return; }
    const input: ManualAdInput = { ...form, home_slot: form.home_slot ? Number(form.home_slot) as ManualAdInput['home_slot'] : null, discount_percent: form.discount_percent ? Number(form.discount_percent) : null, starts_at: `${form.starts_at}:00+08:00`, ends_at: `${form.ends_at}:00+08:00` };
    setSaving(true); onBusy(true);
    try { await fetchJson(`/api/v1/admin/marketing/manual-ads${initial ? `/${initial.campaign_id}` : ''}`, { method: initial ? 'PATCH' : 'POST', body: JSON.stringify(input) }); onSaved(); }
    catch (reason) { setError(message(reason)); }
    finally { setSaving(false); onBusy(false); }
  };
  return <form className="space-y-4" onSubmit={event => void submit(event)}>
    <fieldset disabled={saving} className="space-y-4 disabled:opacity-70">
      {initial ? <div className="rounded-xl bg-neutral-50 p-3 text-sm"><span className="font-semibold">{initial.airport_name} · {placement(initial)}</span><p className="mt-1 text-xs text-neutral-500">机场与投放位置固定；更换时请下架后新增。</p></div> : <div className="space-y-2"><label htmlFor="manual-airport-search" className="block text-sm font-medium">选择机场 <span className="text-rose-600">*</span></label><div className="flex gap-2"><input id="manual-airport-search" className={inputClass} placeholder="输入机场名称" value={airportKeyword} onChange={event => setAirportKeyword(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setAirportQuery(airportKeyword.trim()); setAirportPage(1); } }} /><button type="button" className={secondaryClass} onClick={() => { setAirportQuery(airportKeyword.trim()); setAirportPage(1); }}>查找</button></div><select aria-label="选择机场" className={inputClass} value={form.airport_id} disabled={airportLoading} onChange={event => { const id = Number(event.target.value); set('airport_id', id); setSelectedAirport(airports.find(item => item.id === id)?.name || ''); }}><option value={0}>{airportLoading ? '正在加载机场…' : '请选择机场'}</option>{form.airport_id > 0 && !airports.some(item => item.id === form.airport_id) && <option value={form.airport_id}>{selectedAirport}</option>}{airports.map(item => <option key={item.id} value={item.id} disabled={!item.eligible}>{item.name}{item.eligible ? '' : '（未公开或已停服）'}</option>)}</select>{airportError && <div role="alert" className="text-sm text-rose-700">{airportError}<button type="button" className="ml-2 underline" onClick={() => setAirportReload(value => value + 1)}>重试</button></div>}<div className="flex items-center justify-between text-xs text-neutral-500"><span>仅可选择已公开且未停服的机场</span><div className="flex items-center gap-2"><button type="button" className="min-h-10 px-2 disabled:opacity-40" disabled={airportLoading || airportPage <= 1} onClick={() => setAirportPage(value => value - 1)}>上一页</button><span>{airportPage} / {Math.max(1, Math.ceil(airportTotal / 30))}</span><button type="button" className="min-h-10 px-2 disabled:opacity-40" disabled={airportLoading || airportPage * 30 >= airportTotal} onClick={() => setAirportPage(value => value + 1)}>下一页</button></div></div></div>}
      {!initial && <label className="block text-sm font-medium">投放位置<select className={`${inputClass} mt-1.5`} value={form.home_slot} onChange={event => set('home_slot', event.target.value)}><option value="">普通优惠活动</option>{AIRPORT_HOME_AD_SLOTS.map(slot => <option value={slot} key={slot}>首页 {slot} 号位（含活动优惠页）</option>)}</select></label>}
      <label className="block text-sm font-medium">优惠标题 <span className="text-rose-600">*</span><input className={`${inputClass} mt-1.5`} value={form.discount_title} required maxLength={128} onChange={event => set('discount_title', event.target.value)} placeholder="例如：国庆优惠 · 全场八折" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">优惠码<input className={`${inputClass} mt-1.5`} maxLength={64} value={form.coupon_code} onChange={event => set('coupon_code', event.target.value)} placeholder="可选，无需优惠码时留空" /></label><label className="block text-sm font-medium">适用套餐<input className={`${inputClass} mt-1.5`} maxLength={128} value={form.applicable_plan} onChange={event => set('applicable_plan', event.target.value)} placeholder="例如：所有套餐" /></label></div>
      <label className="block text-sm font-medium">优惠说明<textarea className={`${inputClass} mt-1.5 min-h-24 resize-y`} maxLength={10000} value={form.discount_description} onChange={event => set('discount_description', event.target.value)} placeholder="活动内容与使用条件" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">开始时间（北京时间）<input type="datetime-local" className={`${inputClass} mt-1.5 min-w-0`} required min="2000-01-01T00:00" max="2099-12-31T23:59" value={form.starts_at} onInput={event => set('starts_at', event.currentTarget.value)} onChange={event => set('starts_at', event.target.value)} /></label><label className="block text-sm font-medium">结束时间（北京时间）<input type="datetime-local" className={`${inputClass} mt-1.5 min-w-0`} required min="2000-01-01T00:00" max="2099-12-31T23:59" value={form.ends_at} onInput={event => set('ends_at', event.currentTarget.value)} onChange={event => set('ends_at', event.target.value)} /></label></div>
      <div className="grid gap-2 sm:grid-cols-2"><label className="block text-sm font-medium">优惠百分比（可选）<input type="number" min="0.01" max="100" step="0.01" className={`${inputClass} mt-1.5`} value={form.discount_percent} onChange={event => set('discount_percent', event.target.value)} placeholder="填 20 表示减免 20%" /></label><div className="flex flex-wrap items-center gap-x-5 text-sm"><label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={form.is_stackable} onChange={event => set('is_stackable', event.target.checked)} />可叠加优惠</label><label className="flex min-h-10 items-center gap-2"><input type="checkbox" checked={form.refund_supported} onChange={event => set('refund_supported', event.target.checked)} />支持退款</label></div></div>
    </fieldset>
    {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4"><span className="text-xs text-neutral-500">管理员免费投放，不扣除商家余额。</span><div className="flex gap-3"><button type="button" className={secondaryClass} disabled={saving} onClick={onClose}>取消</button><button type="submit" className={primaryClass} disabled={saving}>{saving ? '保存中…' : '保存投放'}</button></div></div>
  </form>;
}
