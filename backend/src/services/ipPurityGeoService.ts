import type { IpCheckResult } from '../../../shared/ipCheck';
import type { IpPurityGeo } from '../../../shared/ipPurity';
import { normalizePurityIp } from './ipPurityService';

export class IpPurityGeoService {
  private cache = new Map<string, { at: number; value: IpPurityGeo }>();
  private pending = new Map<string, Promise<IpPurityGeo>>();
  private requests: number[] = [];
  private cooldown = 0;
  constructor(private readonly fallback: { lookup(ip: string): Promise<IpCheckResult> }, private readonly fetchImpl: typeof fetch = fetch, private readonly now = Date.now, private readonly timeoutMs = 4000) {}
  async lookup(value: string): Promise<IpPurityGeo> {
    const ip = normalizePurityIp(value);
    const cached = this.cache.get(ip);
    if (cached && this.now() - cached.at < (cached.value.source === 'FreeIPAPI' ? 86400000 : 60000)) return { ...cached.value, cached: true };
    const pending = this.pending.get(ip); if (pending) return { ...await pending };
    const task = this.load(ip); this.pending.set(ip, task);
    try { return { ...await task }; } finally { this.pending.delete(ip); }
  }
  private async load(ip: string): Promise<IpPurityGeo> {
    let value: IpPurityGeo;
    try {
      this.requests = this.requests.filter(time => time > this.now() - 60000);
      if (this.requests.length >= 55 || this.now() < this.cooldown) throw new Error('limited');
      this.requests.push(this.now());
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(`https://free.freeipapi.com/api/json/${encodeURIComponent(ip)}`, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
        if (response.status === 429) this.cooldown = this.now() + 60000;
        if (!response.ok) throw new Error('upstream');
        value = parseFreeIpApi(await response.json(), ip, new Date(this.now()).toISOString());
      } finally { clearTimeout(timer); }
    } catch {
      value = { ...await this.fallback.lookup(ip), source: 'ipwho.is', checked_at: new Date(this.now()).toISOString(), cached: false };
    }
    while (this.cache.size >= 1000) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(ip, { at: this.now(), value }); return value;
  }
}
export function parseFreeIpApi(input: unknown, ip: string, checkedAt: string): IpPurityGeo {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('invalid');
  const d = input as Record<string, unknown>;
  const text = (v: unknown) => typeof v === 'string' ? v.trim().slice(0, 300) : '';
  const country = text(d.countryCode);
  if (normalizePurityIp(d.ipAddress) !== ip || !/^[A-Z]{2}$/.test(country) || ['ZZ', 'XX'].includes(country) || !text(d.cityName)) throw new Error('incomplete');
  if (typeof d.latitude !== 'number' || !Number.isFinite(d.latitude) || Math.abs(d.latitude) > 90 || typeof d.longitude !== 'number' || !Number.isFinite(d.longitude) || Math.abs(d.longitude) > 180) throw new Error('coordinates');
  const asn = String(d.asn ?? '').replace(/^AS/i, '');
  return { ip, country: text(d.countryName), country_code: country, region: text(d.regionCode), region_name: text(d.regionName), city: text(d.cityName), postal_code: text(d.zipCode), latitude: d.latitude, longitude: d.longitude,
    // timeZones lists every timezone in the country, not the target city's timezone.
    timezone: '', isp: text(d.asnOrganization), organization: text(d.asnOrganization), asn: /^\d+$/.test(asn) ? `AS${asn}` : '', source: 'FreeIPAPI', checked_at: checkedAt, cached: false };
}
