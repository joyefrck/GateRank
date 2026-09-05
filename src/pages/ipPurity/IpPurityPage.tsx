import { ipLocationDisplay } from '../../../shared/ipLocationDisplay';
import { IpLocationCard } from './IpLocationCard';
import { IpHistoryTables } from './IpHistoryTables';
import { nativeIpAssessment } from '../../../shared/nativeIp';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Loader2, Search } from 'lucide-react';
import { buildIpPuritySeo, DEFAULT_IP_PURITY_CONFIG, IP_PURITY_FAQ, type IpPurityResult } from '../../../shared/ipPurity';
import { buildAbsoluteUrl, PageFrame, usePageSeo } from '../../site/publicSite';

const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
const control = 'min-h-12 rounded-xl px-5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:opacity-50';
const badge = 'inline-flex min-h-9 items-center justify-center rounded-full border-2 px-4 py-1 text-sm font-bold shadow-[0_2px_0_#262626]';
const badgeTones = { green: 'border-green-950 bg-green-700 text-white', amber: 'border-amber-950 bg-amber-300 text-amber-950', red: 'border-red-950 bg-red-600 text-white', orange: 'border-orange-950 bg-orange-600 text-white', gray: 'border-neutral-300 bg-neutral-100 text-neutral-600' };

class LookupError extends Error { constructor(readonly code: string, message: string) { super(message); } }
async function requestLookup(query: string | undefined, signal: AbortSignal): Promise<IpPurityResult> {
  const response = await fetch(`${apiBase}/api/v1/tools/ip-purity-check`, {
    method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query === undefined ? {} : { query }), signal,
  });
  const data = await response.json();
  if (!response.ok) throw new LookupError(data.code || 'NETWORK', data.message || '检测暂时不可用，请重试。');
  return data;
}
export function IpPurityPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<IpPurityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  usePageSeo(buildIpPuritySeo(DEFAULT_IP_PURITY_CONFIG, buildAbsoluteUrl('/')));

  const run = useCallback(async (manualQuery?: string) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    let timedOut = false;
    const timer = window.setTimeout(() => { timedOut = true; controller.abort(); }, 18000);
    setLoading(true); setError(''); setResult(null);
    try {
      let data: IpPurityResult;
      try { data = await requestLookup(manualQuery, controller.signal); }
      catch (err) {
        if (manualQuery !== undefined || !(err instanceof LookupError) || err.code !== 'IP_PURITY_CLIENT_IP_REQUIRED') throw err;
        // Development/private reverse proxies may not expose a public visitor IP.
        const ipResponse = await fetch('https://api64.ipify.org?format=json', { signal: controller.signal, cache: 'no-store' });
        if (!ipResponse.ok) throw new Error('无法自动识别出口，请手动输入公网 IP。');
        const detected = await ipResponse.json();
        if (typeof detected.ip !== 'string' || !detected.ip) throw new Error('无法自动识别出口，请手动输入公网 IP。');
        data = await requestLookup(detected.ip, controller.signal);
      }
      if (request.current !== controller) return;
      setResult(data); setQuery(data.ip);
    } catch (err) {
      if (request.current !== controller || (controller.signal.aborted && !timedOut)) return;
      setError(timedOut ? '检测超时，请检查网络或重新检测。' : err instanceof LookupError ? err.message : '网络连接失败，请重试或手动输入公网 IP。');
    } finally {
      window.clearTimeout(timer);
      if (request.current === controller) setLoading(false);
    }
  }, []);
  useEffect(() => { void run(); return () => request.current?.abort(); }, [run]);
  const submit = (event: FormEvent) => { event.preventDefault(); if (!loading) void run(query.trim() || undefined); };
  return <PageFrame active="tools">
    <main className="mx-auto max-w-[1180px] px-5 py-6 text-neutral-950 md:px-8 md:py-9">
      <div className="grid items-start gap-6 border-b border-neutral-200 pb-7 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10">
      <header className="min-w-0 lg:pt-3">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">IP RISK INTELLIGENCE</p>
        <h1 className="mt-3 text-[clamp(28px,3vw,40px)] font-black leading-tight tracking-[-0.045em]">IP 纯净度检测<span className="text-indigo-600">.</span></h1>
        <p className="mt-3 text-sm leading-7 text-neutral-500">查询原生 IP、网络归属与历史记录，了解你的出口网络。</p>
        <form onSubmit={submit} aria-label="IP 纯净度查询" className="mt-5 flex gap-2">
          <label className="relative min-w-0 flex-1"><span className="sr-only">公网 IP 地址</span><Search size={19} className="absolute left-4 top-4 text-neutral-400" aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入 IP，留空查询当前出口" maxLength={64} disabled={loading} autoComplete="off" spellCheck={false} className="h-12 w-full rounded-xl border border-neutral-200 bg-white pl-12 pr-4 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 disabled:opacity-60" />
          </label>
          <button type="submit" disabled={loading} className={`${control} inline-flex items-center justify-center gap-2 bg-neutral-950 text-white hover:bg-neutral-800`}>
            {loading ? <Loader2 size={17} className="animate-spin motion-reduce:animate-none" /> : <Search size={17} />}{loading ? '查询中' : '查询'}
          </button>
        </form>
        <p className="mt-3 text-xs leading-6 text-neutral-400">支持公网 IPv4 / IPv6 · IP 将发送至数据源查询 · 结果仅供网络环境参考</p>
        {result && <IpLocationCard result={result} />}
      </header>
      <section className="min-w-0" aria-live="polite" aria-busy={loading}>
        {loading && <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-neutral-500"><Loader2 className="animate-spin motion-reduce:animate-none" size={22} />正在查询网络归属和历史记录…</div>}
        {error && <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800"><p>{error}</p><button type="button" onClick={() => void run(query.trim() || undefined)} className={`${control} mt-4 border border-rose-200`}>重新查询</button></div>}
        {result && <>
          <div>
            <section aria-label="网络信息">
              <h2 aria-hidden="true" className="invisible text-lg font-black">网络档案</h2>
              <dl className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 divide-y divide-neutral-200">
                {[
                  ['网络类型', result.risk?.hosting === true ? 'IDC机房 IP' : result.risk?.hosting === false ? '家庭宽带 IP' : '暂无数据'],
                  ['原生 IP', nativeIpAssessment(result.native).label],
                  ['归属地', ipLocationDisplay(result.geo) || '暂时不可用'],
                  ['ISP 服务商', result.geo?.isp], ['组织', result.geo?.organization], ['ASN', result.geo?.asn],
                  ['注册国家', result.native?.registered_country], ['定位国家', result.native?.location_country],
                ].map(([label, value]) => <div key={label} className="grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3 px-4 py-2.5 text-sm odd:bg-slate-50/80"><dt className="text-neutral-500">{label}</dt><dd className="break-words text-right font-semibold">{label === '原生 IP' || label === '网络类型' ? <span className={`${badge} ${label === '原生 IP' ? value === '原生 IP' ? badgeTones.green : value === '广播 IP' ? badgeTones.orange : value === '数据源存在分歧' ? badgeTones.amber : badgeTones.gray : result.risk?.hosting === true ? badgeTones.red : result.risk?.hosting === false ? badgeTones.green : badgeTones.gray}`}>{value || '暂无数据'}</span> : value || '暂无数据'}</dd></div>)}
              </dl>
              <p className="mt-4 text-xs leading-6 text-neutral-400">归属地来源：{result.geo?.source || 'ipwho.is'}</p>
              <details className="mt-3 rounded-xl bg-neutral-50 px-4 py-3 text-xs leading-6 text-neutral-500">
                <summary className="cursor-pointer font-semibold focus-visible:outline-indigo-500">查看判定依据与数据来源</summary>
                <p>{nativeIpAssessment(result.native).explanation}</p>
                <p className="mt-2">原生标签：<a href="https://ipok.io" target="_blank" rel="noreferrer" className="underline">IPOK</a> · 注册记录：<a href="https://stat.ripe.net/docs/data-api/api-endpoints/rir" target="_blank" rel="noreferrer" className="underline">RIPE NCC</a></p>
                {result.native?.prefix && <p>注册网段：{result.native.prefix} · {result.native.registry}</p>}
                {result.native?.registry_date && <p>注册数据日期：{result.native.registry_date.slice(0, 10)}</p>}
                {result.native && <p>证据查询时间：{new Date(result.native.checked_at).toLocaleString('zh-CN')}{result.native.cached ? ' · 含缓存' : ''}</p>}
                {result.native?.provider_cached_only && <p>IPOK 当前仅使用其已有上游缓存。</p>}
                {result.native?.ipok_error && <p>IPOK：{result.native.ipok_error === 'quota' ? '额度暂时用尽，使用注册地参考' : '查询暂时不可用，使用注册地参考'}。</p>}
                {result.native?.registry_error && <p>注册记录查询暂时不可用，已保留其他检测结果。</p>}
              </details>
            </section>
          </div>
        </>}
      </section>
      </div>
      {result && <section className="py-7" aria-label="IP 历史记录"><IpHistoryTables history={result.history} /></section>}
      <section className="mt-4 grid gap-8 border-b border-neutral-200 pb-10 md:grid-cols-[0.65fr_1.35fr]">
        <div><h2 className="text-2xl font-black">读懂检测结果</h2><p className="mt-3 text-sm leading-7 text-neutral-500">了解网络归属与历史记录。</p></div>
        <div className="divide-y divide-neutral-200">{IP_PURITY_FAQ.map(({ question, answer }) => <details key={question} className="group py-4 first:pt-0"><summary className="cursor-pointer py-2 text-sm font-bold focus-visible:outline-indigo-500">{question}</summary><p className="pb-2 pt-3 text-sm leading-7 text-neutral-500">{answer}</p></details>)}</div>
      </section>
      <nav aria-label="其他网络工具" className="flex flex-wrap gap-6 py-7 text-sm font-bold">{[['IP 地理位置查询', '/tools/ip-check'], ['DNS 泄漏检测', '/tools/dns-leak-test'], ['流媒体解锁检测', '/tools/streaming-check']].map(([label, href]) => <a key={href} href={href} className="inline-flex min-h-10 items-center gap-2 hover:text-indigo-600">{label}<ArrowUpRight size={16} /></a>)}</nav>
    </main>
  </PageFrame>;
}
