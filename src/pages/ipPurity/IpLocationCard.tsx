import { ipLocationDisplay, ipProviderBrand } from '../../../shared/ipLocationDisplay';
import { Clock3, MapPin, ShieldCheck } from 'lucide-react';
import type { IpPurityResult } from '../../../shared/ipPurity';

export function IpLocationCard({ result }: { result: IpPurityResult }) {
  const geo = result.geo;
  const code = geo?.country_code;
  const hasCountry = !!code && /^[A-Z]{2}$/.test(code) && !['ZZ', 'XX'].includes(code);
  const flag = hasCountry ? String.fromCodePoint(...Array.from(code, char => 127397 + char.charCodeAt(0))) : null;
  const location = ipLocationDisplay(geo);
  const brand = ipProviderBrand(geo);
  return <section aria-label="IP 位置摘要" aria-live="polite" className="mt-5 rounded-2xl border-2 border-neutral-800 bg-white px-4 py-3 shadow-[0_2px_0_#262626] lg:mt-6">
    <div className="flex items-start gap-2">
      {flag ? <span aria-hidden="true" className="text-lg leading-6">{flag}</span> : <MapPin aria-hidden="true" size={18} className="mt-0.5 shrink-0 text-neutral-400" />}
      <div className="min-w-0"><h2 style={{ fontSize: 16, lineHeight: '24px', margin: 0 }} className="break-words font-semibold">{location || '位置信息暂时不可用'}{brand ? ` — ${brand}` : ''}</h2>
        {geo?.isp && <p className="mt-0.5 break-words text-xs text-neutral-500">{geo.isp}</p>}
      </div>
    </div>
    <div className="mt-2 space-y-1.5 text-xs text-neutral-500">
      <p className="flex items-center gap-2"><Clock3 size={15} aria-hidden="true" /><span>查询时间：{new Date(result.checked_at).toLocaleString('zh-CN', { hour12: false })}</span></p>
      <div className="flex flex-wrap items-center gap-2"><ShieldCheck size={15} aria-hidden="true" /><span>置信度：</span><span className="flex gap-1" aria-hidden="true">{[0, 1, 2].map(index => <span key={index} className="h-1.5 w-8 rounded-full bg-neutral-200" />)}</span><span>数据源未提供</span></div>
    </div>
    <p className="mt-2 text-[11px] leading-4 text-neutral-400">位置来源：{geo?.source || 'ipwho.is'} · 可能复用 24 小时内缓存</p>
  </section>;
}
