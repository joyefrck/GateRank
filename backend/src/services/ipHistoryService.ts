import { BlockList, isIP } from 'node:net';
import type { IpHistoryResult, IpHistoryRow } from '../../../shared/ipHistory';
import { normalizePurityIp } from './ipPurityService';

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const str = (v: unknown): string => typeof v === 'string' ? v.slice(0, 300) : '';
const date = (v: unknown): string | null => {
  const s = str(v); const time = Date.parse(/Z$|[+-]\d\d:\d\d$/.test(s) ? s : `${s}Z`);
  return s && Number.isFinite(time) ? new Date(time).toISOString() : null;
};
function contains(resource: string, ip: string): boolean {
  const version = isIP(ip); const family = version === 4 ? 'ipv4' : 'ipv6';
  try {
    const block = new BlockList();
    if (resource.includes('/')) {
      const [address, bits] = resource.split('/');
      if (isIP(address) !== version || !/^\d+$/.test(bits)) return false;
      block.addSubnet(address, Number(bits), family);
    } else {
      const [start, end] = resource.split(/\s*-\s*/);
      if (isIP(start) !== version || isIP(end) !== version) return false;
      block.addRange(start, end, family);
    }
    return block.check(ip, family);
  } catch { return false; }
}
function interval(value: unknown, end: unknown) {
  const times = arr(value).map(obj).map(t => ({ start: date(t.starttime), end: date(t.endtime) }))
    .filter((t): t is { start: string; end: string } => !!t.start && !!t.end && t.start <= t.end);
  const first = times.map(t => t.start).sort()[0] ?? null;
  const last = times.map(t => t.end).sort().at(-1) ?? null;
  const boundary = date(end);
  return { first_seen: first, last_seen: last, active: last && boundary ? last >= boundary : null };
}
export function parseRoutingHistory(data: Obj, ip: string): IpHistoryRow[] {
  return arr(data.by_origin).flatMap(origin => {
    const o = obj(origin); const asn = String(o.origin ?? '');
    if (!/^\d{1,10}$/.test(asn)) return [];
    return arr(o.prefixes).flatMap(prefix => {
      const p = obj(prefix); const resource = str(p.prefix);
      if (!contains(resource, ip)) return [];
      const times = interval(p.timelines, data.query_endtime);
      return times.first_seen ? [{ name: `AS${asn}`, resource, info: null, country: null, ...times }] : [];
    });
  }).sort((a, b) => Number(b.active) - Number(a.active) || (b.last_seen ?? '').localeCompare(a.last_seen ?? '')).slice(0, 100);
}
export function parseAllocationHistory(data: Obj, ip: string): IpHistoryRow[] {
  return Object.entries(obj(data.results)).flatMap(([registry, records]) => {
    if (!['ARIN', 'RIPE NCC', 'RIPE', 'APNIC', 'LACNIC', 'AFRINIC'].includes(registry.toUpperCase())) return [];
    return arr(records).flatMap(record => {
      const r = obj(record); const resource = str(r.resource);
      if (!contains(resource, ip)) return [];
      const times = interval(r.timelines, data.query_endtime);
      return times.first_seen ? [{ name: registry, resource, country: /^[A-Z]{2}$/.test(str(r.country)) ? str(r.country) : null, info: str(r.status) || null, ...times }] : [];
    });
  }).sort((a, b) => (b.last_seen ?? '').localeCompare(a.last_seen ?? '')).slice(0, 100);
}
const validCountry = (value: unknown): string | null => /^[A-Z]{2}$/.test(str(value)) && !['ZZ', 'EU', 'AP'].includes(str(value)) ? str(value) : null;
function addressNumber(address: string): bigint {
  if (isIP(address) === 4) return address.split('.').reduce((n, part) => (n << 8n) + BigInt(part), 0n);
  if (isIP(address) !== 6 || address.includes('.')) throw new Error('address');
  const halves = address.split('::');
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const groups = halves.length === 1 ? left : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  return groups.reduce((n, part) => (n << 16n) + BigInt(`0x${part}`), 0n);
}
function resourceBounds(resource: string): string {
  if (resource.includes('/')) {
    const [address, length] = resource.split('/'); const version = isIP(address); const bits = Number(length);
    const width = version === 4 ? 32 : 128;
    if (!version || !/^\d+$/.test(length) || bits < 0 || bits > width) throw new Error('prefix');
    const hostBits = BigInt(width - bits); const start = (addressNumber(address) >> hostBits) << hostBits;
    return `${version}:${start}:${start + (1n << hostBits) - 1n}`;
  }
  const [start, end] = resource.split(/\s*-\s*/);
  if (!isIP(start) || isIP(start) !== isIP(end)) throw new Error('range');
  return `${isIP(start)}:${addressNumber(start)}:${addressNumber(end)}`;
}
export function parseAllocationCountry(data: Obj, row: IpHistoryRow): string | null {
  if (!row.last_seen) return null;
  const day = row.last_seen.slice(0, 10);
  const countries = new Set(arr(data.rirs).map(obj).filter(record => {
    if (str(record.rir).toUpperCase().replace(' NCC', '') !== row.name.toUpperCase().replace(' NCC', '')) return false;
    if (!['ALLOCATED', 'ASSIGNED', 'LEGACY'].includes(str(record.status).toUpperCase())) return false;
    const first = date(record.first_time); const last = date(record.last_time);
    if (!first || !last || first.slice(0, 10) > day || last.slice(0, 10) < day) return false;
    try { return resourceBounds(str(record.resource)) === resourceBounds(row.resource); } catch { return false; }
  }).map(record => validCountry(record.country)));
  return countries.size === 1 ? [...countries][0] : null;
}
export function parseAsnCountry(data: Obj, asn: string): string | null {
  const number = asn.replace(/^AS/i, '');
  if (String(data.resource).replace(/^AS/i, '') !== number) return null;
  const countries = new Set(arr(data.rirs).map(obj)
    .filter(row => String(row.resource).replace(/^AS/i, '') === number && ['ASSIGNED', 'ALLOCATED', 'LEGACY'].includes(str(row.status).toUpperCase()))
    .map(row => validCountry(row.country)));
  return countries.size === 1 ? [...countries][0] : null;
}
export function parseOrganizationRecords(data: Obj, ip: string): IpHistoryRow[] {
  const records = arr(data.records).map(record => new Map(arr(record).map(obj).map(r => [str(r.key).toLowerCase(), str(r.value)])));
  return records.flatMap(fields => {
    const resource = fields.get('cidr') || fields.get('inetnum') || fields.get('inet6num') || fields.get('netrange') || '';
    if (!resource.split(',').some(prefix => contains(prefix.trim(), ip))) return [];
    const name = fields.get('organization') || fields.get('org-name') || fields.get('netname') || fields.get('descr');
    if (!name || name.includes('NON-RIPE-NCC')) return [];
    const organizationId = fields.get('org') || fields.get('organization')?.match(/\(([^()]+)\)$/)?.[1];
    const linked = organizationId ? records.filter(record => (record.get('orgid') || record.get('organisation')) === organizationId && record.get('source') === fields.get('source')) : [];
    const linkedCountries = new Set(linked.map(record => validCountry(record.get('country'))));
    const organizationCountry = linkedCountries.size === 1 ? [...linkedCountries][0] : null;
    return [{ name: name.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'"), resource,
      country: validCountry(fields.get('country')) || organizationCountry,
      info: fields.get('source') || null, first_seen: date(fields.get('regdate') || fields.get('created')),
      last_seen: date(fields.get('updated') || fields.get('last-modified')), active: null }];
  }).slice(0, 100);
}
export class IpHistoryService {
  private cache = new Map<string, { at: number; value: IpHistoryResult }>();
  private pending = new Map<string, Promise<IpHistoryResult>>();
  private cooldown = 0;
  constructor(private readonly fetchImpl: typeof fetch = fetch, private readonly now = Date.now, private readonly timeoutMs = 7000) {}
  async lookup(value: string): Promise<IpHistoryResult> {
    const ip = normalizePurityIp(value);
    const cached = this.cache.get(ip);
    if (cached && this.now() - cached.at < (cached.value.errors.length ? 60000 : 3600000)) return structuredClone({ ...cached.value, cached: true });
    const pending = this.pending.get(ip); if (pending) return structuredClone(await pending);
    if (this.pending.size >= 1 || this.now() < this.cooldown) return { asn: [], organizations: [], allocations: [], errors: ['routing-history', 'whois', 'allocation-history'], checked_at: new Date(this.now()).toISOString(), cached: false };
    const promise = this.load(ip); this.pending.set(ip, promise);
    try { return structuredClone(await promise); } finally { this.pending.delete(ip); }
  }
  private async enrichCountries(result: IpHistoryResult, ip: string): Promise<void> {
    const names = [...new Set(result.asn.map(row => row.name))];
    const allocations = result.allocations.filter(row => !row.country && row.last_seen);
    if (!names.length && !allocations.length) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(this.timeoutMs, 5000));
    const queue = [
      ...allocations.slice(0, 16).map(row => ({ resource: ip, row })),
      ...names.slice(0, 32).map(resource => ({ resource, row: null as IpHistoryRow | null })),
    ];
    try {
      await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
        while (queue.length && !controller.signal.aborted && this.now() >= this.cooldown) {
          const task = queue.shift()!;
          try {
            const url = new URL('https://stat.ripe.net/data/rir/data.json');
            url.searchParams.set('resource', task.resource); url.searchParams.set('lod', '2');
            if (task.row?.last_seen) {
              const day = task.row.last_seen.slice(0, 10) + 'T00:00:00';
              url.searchParams.set('starttime', day); url.searchParams.set('endtime', day);
            }
            const response = await this.fetchImpl(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
            if (response.status === 429) this.cooldown = this.now() + 60000;
            if (!response.ok) continue;
            const body = obj(await response.json());
            if (body.status === 'ok') {
              if (task.row) task.row.country = parseAllocationCountry(obj(body.data), task.row);
              else for (const row of result.asn.filter(row => row.name === task.resource)) row.country = parseAsnCountry(obj(body.data), task.resource);
            }
          } catch { /* Preserve the routing history when country lookup fails. */ }
        }
      }));
    } finally { clearTimeout(timer); }
    if (result.asn.some(row => !row.country)) result.errors.push('asn-country');
    if (result.allocations.some(row => !row.country)) result.errors.push('allocation-country');
  }
  private async load(ip: string): Promise<IpHistoryResult> {
    const endpoints = ['routing-history', 'whois', 'allocation-history'] as const;
    const responses = await Promise.allSettled(endpoints.map(async endpoint => {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const url = new URL(`https://stat.ripe.net/data/${endpoint}/data.json`);
        url.searchParams.set('resource', ip);
        if (endpoint !== 'whois') url.searchParams.set('starttime', '2000-01-01T00:00:00');
        if (endpoint === 'routing-history') url.searchParams.set('max_rows', '100');
        const response = await this.fetchImpl(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
        if (response.status === 429) this.cooldown = this.now() + 60000;
        if (!response.ok) throw new Error('upstream');
        const body = obj(await response.json());
        if (body.status !== 'ok') throw new Error('upstream');
        const data = obj(body.data);
        return data;
      } finally { clearTimeout(timer); }
    }));
    const data = (index: number): Obj => { const response = responses[index]; return response.status === 'fulfilled' ? response.value : {}; };
    const result: IpHistoryResult = {
      asn: parseRoutingHistory(data(0), ip), organizations: parseOrganizationRecords(data(1), ip), allocations: parseAllocationHistory(data(2), ip),
      errors: endpoints.filter((_, i) => responses[i].status === 'rejected'), checked_at: new Date(this.now()).toISOString(), cached: false,
    };
    await this.enrichCountries(result, ip);
    while (this.cache.size >= 500) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(ip, { at: this.now(), value: result }); return result;
  }
}
