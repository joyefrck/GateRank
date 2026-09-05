import type { IpHistoryResult } from '../../../shared/ipHistory';
import type { NativeIpEvidence } from '../../../shared/nativeIp';
import { isIP } from 'node:net';
import type { IpPurityFailure, IpPurityResult, IpPurityRisk } from '../../../shared/ipPurity';
import type { IpPurityGeo } from '../../../shared/ipPurity';
import { isPublicIpAddress } from '../utils/ipCheckTarget';
import { HttpError } from '../middleware/errorHandler';

export function normalizePurityIp(value: unknown): string {
  if (typeof value !== 'string' || !isPublicIpAddress(value.trim())) {
    throw new HttpError(400, 'IP_PURITY_INVALID_QUERY', '请输入有效的公网 IPv4 或 IPv6 地址。');
  }
  const ip = value.trim().toLowerCase();
  if (isIP(ip) !== 6) return ip;
  const normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  if (!/^[23]/.test(normalized) || !isPublicIpAddress(normalized)) {
    throw new HttpError(400, 'IP_PURITY_INVALID_QUERY', '请输入有效的公网 IPv4 或 IPv6 地址。');
  }
  return normalized;
}
class RiskError extends Error {
  constructor(readonly reason: IpPurityFailure) { super(reason); }
}
interface Options {
  geoService: { lookup(ip: string): Promise<IpPurityGeo> };
  historyService?: { lookup(ip: string): Promise<IpHistoryResult> };
  nativeService?: { lookup(ip: string): Promise<NativeIpEvidence> };
  fetchImpl?: typeof fetch;
  apiKey?: string;
  now?: () => number;
  timeoutMs?: number;
  cacheTtlMs?: number;
  dailyLimit?: number;
}
export class IpPurityService {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly ttl: number;
  private readonly dailyLimit: number;
  private readonly cache = new Map<string, IpPurityRisk>();
  private readonly pending = new Map<string, Promise<IpPurityResult>>();
  private day = '';
  private used = 0;
  private cooldownUntil = 0;
  constructor(private readonly options: Options) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.apiKey = options.apiKey ?? process.env.IP_PURITY_API_KEY?.trim() ?? '';
    this.timeoutMs = bounded(options.timeoutMs ?? process.env.IP_PURITY_TIMEOUT_MS, 5000, 100, 10000);
    this.ttl = bounded(options.cacheTtlMs ?? process.env.IP_PURITY_CACHE_TTL_MS, 3600000, 1, 3600000);
    this.dailyLimit = bounded(options.dailyLimit ?? process.env.IP_PURITY_DAILY_LIMIT, this.apiKey ? 1000 : 100, 1, 1000000);
  }
  async lookup(value: string): Promise<IpPurityResult> {
    const ip = normalizePurityIp(value);
    const existing = this.pending.get(ip);
    if (existing) return structuredClone(await existing);
    if (this.pending.size >= 32) throw new HttpError(429, 'IP_PURITY_BUSY', '检测繁忙，请稍后重试。');
    const promise = this.performLookup(ip);
    this.pending.set(ip, promise);
    try { return structuredClone(await promise); }
    finally { this.pending.delete(ip); }
  }
  private async performLookup(ip: string): Promise<IpPurityResult> {
    const [geo, risk, native, history] = await Promise.allSettled([this.options.geoService.lookup(ip), this.lookupRisk(ip), this.options.nativeService?.lookup(ip) ?? Promise.resolve(null), this.options.historyService?.lookup(ip) ?? Promise.resolve(null)]);
    return {
      ip,
      history: history.status === 'fulfilled' ? history.value : null,
      native: native.status === 'fulfilled' && native.value ? { ...native.value, location_country: geo.status === 'fulfilled' && /^[A-Z]{2}$/.test(geo.value.country_code) && geo.value.country_code !== 'ZZ' ? geo.value.country_code : null } : null,
      checked_at: new Date(this.now()).toISOString(),
      geo: geo.status === 'fulfilled' ? geo.value : null,
      risk: risk.status === 'fulfilled' ? risk.value : null,
      risk_error: risk.status === 'fulfilled' ? null : risk.reason instanceof RiskError ? risk.reason.reason : 'unavailable',
    };
  }
  private async lookupRisk(ip: string): Promise<IpPurityRisk> {
    const cached = this.cache.get(ip);
    if (cached && this.now() - Date.parse(cached.checked_at) < this.ttl) return { ...cached, cached: true };
    this.cache.delete(ip);
    const day = new Date(this.now()).toISOString().slice(0, 10);
    if (this.day !== day) { this.day = day; this.used = 0; }
    if (this.now() < this.cooldownUntil || this.used >= this.dailyLimit) throw new RiskError('quota');
    this.used += 1;
    const url = new URL(`https://proxycheck.io/v3/${encodeURIComponent(ip)}`);
    if (this.apiKey) url.searchParams.set('key', this.apiKey);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, { headers: { Accept: 'application/json' }, signal: controller.signal, redirect: 'error' });
      if (response.status === 429) { this.cooldownUntil = this.now() + 60000; throw new RiskError('quota'); }
      if (!response.ok) throw new RiskError('unavailable');
      const data = object(await response.json());
      if (data.status !== 'ok' && data.status !== 'warning') throw new RiskError('unavailable');
      // Providers may spell IPv6 addresses differently; compare canonical public IPs.
      const key = Object.keys(data).find((key) => {
        try { return normalizePurityIp(key) === ip; } catch { return false; }
      });
      const detections = object(object(key ? data[key] : null).detections);
      const result: IpPurityRisk = {
        score: typeof detections.risk === 'number' && Number.isFinite(detections.risk) && detections.risk >= 0 && detections.risk <= 100 ? detections.risk : null,
        proxy: boolean(detections.proxy), vpn: boolean(detections.vpn), tor: boolean(detections.tor), hosting: boolean(detections.hosting),
        checked_at: new Date(this.now()).toISOString(), cached: false,
      };
      if (result.score === null && [result.proxy, result.vpn, result.tor, result.hosting].every((flag) => flag === null)) throw new RiskError('unavailable');
      while (this.cache.size >= 2000) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(ip, result);
      return { ...result };
    } catch (error) {
      if (error instanceof RiskError) throw error;
      throw new RiskError(controller.signal.aborted ? 'timeout' : 'unavailable');
    } finally { clearTimeout(timer); }
  }
}
function object(value: unknown): Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function boolean(value: unknown): boolean | null { return typeof value === 'boolean' ? value : null; }
function bounded(value: unknown, fallback: number, min: number, max: number): number { const n = Number(value); return Number.isFinite(n) && n >= min ? Math.min(max, Math.floor(n)) : fallback; }
