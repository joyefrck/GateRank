import { useEffect, useRef, useState } from 'react';

interface AirportOption {
  id: number;
  name: string;
  is_listed: boolean;
  status: string;
}
export interface HomeRotationAirportOptions { items: AirportOption[]; total: number }

export function HomeRotationAirportPicker({ value, onChange, loadPage, disabled }: {
  value: number[];
  onChange: (ids: number[]) => void;
  loadPage: (page: number) => Promise<HomeRotationAirportOptions>;
  disabled?: boolean;
}) {
  const loader = useRef(loadPage);
  loader.current = loadPage;
  const [airports, setAirports] = useState<AirportOption[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    void (async () => {
      const options: AirportOption[] = [];
      for (let page = 1; ; page++) {
        const result = await loader.current(page);
        if (cancelled) return;
        options.push(...result.items);
        if (options.length >= result.total || !result.items.length) break;
      }
      if (!cancelled) setAirports(options);
    })().catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : '机场列表加载失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);

  const selected = new Set(value);
  const query = keyword.trim().toLocaleLowerCase();
  const filtered = airports.filter(airport => airport.name.toLocaleLowerCase().includes(query) || String(airport.id).includes(query));
  const available = (airport: AirportOption) => airport.is_listed && ['normal', 'risk'].includes(airport.status);
  return (
    <fieldset className="mb-6 min-w-0" disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold text-neutral-900">指定加入轮换的机场</legend>
      <p className="mb-3 text-sm leading-6 text-neutral-500">所选机场豁免费用、余额及节点数量门槛，与其他候选公平轮换。下架或停运时暂停展示。更改后请保存营销配置。</p>
      <div className="mb-3 flex flex-wrap gap-2" aria-label="已选轮换机场">
        {value.map(id => {
          const airport = airports.find(item => item.id === id);
          return <button key={id} type="button" onClick={() => onChange(value.filter(item => item !== id))}
            aria-label={`移除${airport?.name ?? `机场 #${id}`}`}
            className="min-h-10 max-w-full break-words rounded-xl border border-neutral-300 bg-neutral-50 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-900">
            {airport?.name ?? `机场 #${id}`}{airport && !available(airport) ? '（暂停展示）' : ''} <span aria-hidden="true">×</span>
          </button>;
        })}
        {!value.length && <span className="text-sm text-neutral-500">尚未指定机场，当前按普通条件筛选。</span>}
      </div>
      <input type="search" aria-label="搜索指定轮换机场" placeholder="搜索机场名称或 ID" value={keyword}
        onChange={event => setKeyword(event.target.value)}
        className="mb-2 w-full rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm outline-none focus:border-neutral-900" />
      {loading ? <p role="status" className="py-3 text-sm text-neutral-500">正在加载机场…</p> : error ?
        <div role="alert" className="text-sm text-red-600">{error} <button type="button" className="min-h-10 px-3 underline" onClick={() => setAttempt(current => current + 1)}>重试</button></div> :
        <div className="max-h-56 overflow-y-auto rounded-xl border border-neutral-200 p-2">
          {filtered.map(airport => <label key={airport.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-neutral-50">
            <input type="checkbox" checked={selected.has(airport.id)} disabled={!available(airport) && !selected.has(airport.id)}
              onChange={event => onChange(event.target.checked ? [...value, airport.id] : value.filter(id => id !== airport.id))}
              className="h-4 w-4 shrink-0 accent-neutral-900" />
            <span className="min-w-0 break-words text-neutral-800">{airport.name} <span className="text-neutral-400">#{airport.id}{!available(airport) ? ' · 暂停展示' : ''}</span></span>
          </label>)}
          {!filtered.length && <p className="px-3 py-3 text-sm text-neutral-500">没有匹配的机场</p>}
        </div>}
    </fieldset>
  );
}
