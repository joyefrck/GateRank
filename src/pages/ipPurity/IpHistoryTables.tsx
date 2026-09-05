import type { IpHistoryResult, IpHistoryRow } from '../../../shared/ipHistory';

const countryNames = new Intl.DisplayNames(['zh-CN'], { type: 'region' });
const formatCountry = (code: string | null) => code ? `${countryNames.of(code) || code} (${code})` : '—';
const formatTime = (value: string | null) => value ? `${value.slice(0, 10)} ${value.slice(11, 16)}` : '—';
function Status({ active }: { active: boolean | null }) {
  return <span title={active === null ? '当前登记记录' : active ? '数据源最新观测仍存在' : '历史记录'} className={`mr-2 inline-block h-3 w-3 shrink-0 rounded-full border ${active === true ? 'border-green-800 bg-green-500' : active === false ? 'border-neutral-400 bg-neutral-200' : 'border-indigo-400 bg-indigo-100'}`} />;
}
export function IpHistoryTables({ history }: { history?: IpHistoryResult | null }) {
  const sections: { title: string; endpoint: string; rows: IpHistoryRow[]; first: string; last: string; description: string }[] = [
    { title: 'ASN 历史', endpoint: 'routing-history', rows: history?.asn ?? [], first: '首次观测', last: '最近观测', description: '自 2000 年起的 RIS 路由观测；绿色表示在数据源最新时间仍有记录，灰色表示历史记录。最多展示 100 条；国家取 ASN 当前注册信息，不代表历史时点的国家。' },
    { title: '企业登记记录', endpoint: 'whois', rows: history?.organizations ?? [], first: '登记日期', last: '记录更新', description: 'WHOIS 当前登记信息及记录日期，国家关联对应机构登记资料，不包含供应商独有的旧企业名称档案。' },
    { title: '注册地历史', endpoint: 'allocation-history', rows: history?.allocations ?? [], first: '首次观测', last: '最近观测', description: '区域注册局分配记录。国家按最近观测日期的注册局快照查询；IP 范围与 CIDR 都是网段表示方式。' },
  ];
  return <div className="space-y-7">
    {sections.map(section => <section key={section.endpoint} aria-label={section.title} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <h2 className="bg-indigo-50/70 px-5 py-5 text-lg font-black">{section.title}</h2>
      <div className="overflow-x-auto" role="region" aria-label={`${section.title}表格`} tabIndex={0}>
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-neutral-500"><tr>{[section.endpoint === 'routing-history' ? 'ASN' : section.endpoint === 'whois' ? '企业 / 网络名称' : '注册局', 'CIDR / IP 范围', section.endpoint === 'routing-history' ? '当前注册国家' : '国家', section.first, section.last].map(label => <th key={label} scope="col" className="whitespace-nowrap px-5 py-4 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-neutral-100">{section.rows.map((row, index) => <tr key={`${row.name}-${row.resource}-${index}`} className="odd:bg-white even:bg-slate-50/50">
            <td className="px-5 py-5"><span className="flex items-center font-semibold"><Status active={row.active} />{section.endpoint === 'routing-history' ? <a href={`https://stat.ripe.net/${encodeURIComponent(row.name)}`} className="text-indigo-600 underline underline-offset-4" target="_blank" rel="noreferrer">{row.name}</a> : row.name}</span>{row.info && <span className="mt-1 block text-xs text-neutral-400">{row.info}</span>}</td>
            <td className="px-5 py-5 font-mono text-xs text-neutral-600">{row.resource}</td><td className="px-5 py-5 text-neutral-600">{formatCountry(row.country)}</td>
            <td className="whitespace-nowrap px-5 py-5 text-neutral-500">{formatTime(row.first_seen)}</td><td className="whitespace-nowrap px-5 py-5 text-neutral-500">{formatTime(row.last_seen)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!section.rows.length && <p role="status" className="px-5 py-6 text-sm text-neutral-500">{!history || history.errors.includes(section.endpoint) ? '数据源暂时不可用，请稍后重新检测。' : '数据源暂无此 IP 的相关记录。'}</p>}
      <p className="border-t border-neutral-100 px-5 py-4 text-xs leading-6 text-neutral-400">{section.description} 时间为 UTC。来源：<a className="underline" href={`https://stat.ripe.net/docs/data-api/api-endpoints/${section.endpoint}`} target="_blank" rel="noreferrer">RIPE NCC</a>{history?.cached ? ' · 缓存结果' : ''}</p>
    </section>)}
  </div>;
}
