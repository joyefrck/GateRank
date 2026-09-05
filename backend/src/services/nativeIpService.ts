import { BlockList, isIP } from 'node:net';
import type { NativeIpEvidence, NativeLookupError, NativeProviderVerdict } from '../../../shared/nativeIp';
import { normalizePurityIp } from './ipPurityService';

type RecordValue = Record<string, unknown>;
interface RegistryEvidence { registered_country: string | null; registry: string | null; prefix: string | null; registry_date: string | null }
interface ProviderEvidence { provider_type: NativeProviderVerdict; provider_checked_at: string | null; provider_cached_only: boolean }
interface Options { fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number; ipokDailyLimit?: number }
class LookupError extends Error { constructor(readonly code: NativeLookupError) { super(code); } }

export class NativeIpService {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly timeout: number;
  private readonly limit: number;
  private readonly cache = new Map<string, { value: unknown; at: number; ttl: number }>();
  private day = '';
  private used = 0;
  private active = 0;
  private cooldown = new Map<string, number>();
  constructor(options: Options = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.timeout = options.timeoutMs ?? 4500;
    this.limit = options.ipokDailyLimit ?? 15;
  }
  async lookup(value: string): Promise<NativeIpEvidence> {
    const ip = normalizePurityIp(value);
    const empty: NativeIpEvidence = { provider_type: null, provider_checked_at: null, provider_cached_only: false, registered_country: null, registry: null, prefix: null, registry_date: null, ipok_error: null, registry_error: null, checked_at: new Date(this.now()).toISOString(), cached: false };
    if (this.active >= 4) return { ...empty, ipok_error: 'busy', registry_error: 'busy' };
    this.active++;
    try {
      const [provider, registry] = await Promise.allSettled([
        this.cached<ProviderEvidence>(`ipok:${ip}`, 3600000, async () => {
          const today = new Date(this.now()).toISOString().slice(0, 10);
          if (today !== this.day) { this.day = today; this.used = 0; }
          if (this.used >= this.limit) throw new LookupError('quota');
          this.used++;
          const data = await this.json(`https://ipok.io/api/ip?ip=${encodeURIComponent(ip)}`, 'ipok');
          if (normalizePurityIp(object(data.geo).ip) !== ip || !['native', 'broadcast', 'unknown'].includes(String(data.nativeType))) throw new LookupError('unavailable');
          return { provider_type: data.nativeType as NativeProviderVerdict, provider_checked_at: date(data.fetchedAt), provider_cached_only: data.upstream === 'cached-only' };
        }),
        this.cached<RegistryEvidence>(`rir:${ip}`, 86400000, async () => {
          const body = await this.json(`https://stat.ripe.net/data/rir/data.json?resource=${encodeURIComponent(ip)}&lod=2`, 'ripe');
          if (body.status !== 'ok') throw new LookupError('unavailable');
          const data = object(body.data);
          if (normalizePurityIp(String(data.resource || '').split('/')[0]) !== ip) throw new LookupError('unavailable');
          return parseRegistryEvidence(data, ip);
        }),
      ]);
      return { ...empty,
        ...(provider.status === 'fulfilled' ? provider.value.value : { ipok_error: failure(provider.reason) }),
        ...(registry.status === 'fulfilled' ? registry.value.value : { registry_error: failure(registry.reason) }),
        cached: (provider.status === 'fulfilled' && provider.value.cached) || (registry.status === 'fulfilled' && registry.value.cached),
        checked_at: new Date(Math.min(provider.status === 'fulfilled' ? provider.value.at : this.now(), registry.status === 'fulfilled' ? registry.value.at : this.now())).toISOString(),
      };
    } finally { this.active--; }
  }
  private async cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<{ value: T; cached: boolean; at: number }> {
    const existing = this.cache.get(key);
    if (existing && this.now() - existing.at < existing.ttl) return { value: structuredClone(existing.value) as T, cached: true, at: existing.at };
    this.cache.delete(key);
    const value = await load();
    while (this.cache.size >= 2000) this.cache.delete(this.cache.keys().next().value!);
    const at = this.now(); this.cache.set(key, { value, ttl, at });
    return { value, cached: false, at };
  }
  private async json(url: string, provider: string): Promise<RecordValue> {
    if ((this.cooldown.get(provider) ?? 0) > this.now()) throw new LookupError('quota');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetchImpl(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
      if (response.status === 429) {
        const seconds = Number(response.headers.get('retry-after'));
        this.cooldown.set(provider, this.now() + Math.max(60, Math.min(86400, Number.isFinite(seconds) ? seconds : 60)) * 1000);
        throw new LookupError('quota');
      }
      if (!response.ok) throw new LookupError('unavailable');
      return object(await response.json());
    } catch (error) {
      if (error instanceof LookupError) throw error;
      throw new LookupError(controller.signal.aborted ? 'timeout' : 'unavailable');
    } finally { clearTimeout(timer); }
  }
}
export function parseRegistryEvidence(data: RecordValue, ip: string): RegistryEvidence {
  const rows = (Array.isArray(data.rirs) ? data.rirs : []).map(object).filter((row) => {
    if (!['ALLOCATED', 'ASSIGNED', 'LEGACY'].includes(String(row.status).toUpperCase())) return false;
    const [address, prefix] = String(row.resource || '').split('/');
    const version = isIP(address); const bits = Number(prefix);
    if (!version || version !== isIP(ip) || !prefix || !Number.isInteger(bits) || bits < 0 || bits > (version === 4 ? 32 : 128)) return false;
    try { const block = new BlockList(); block.addSubnet(address, bits, version === 4 ? 'ipv4' : 'ipv6'); return block.check(ip, version === 4 ? 'ipv4' : 'ipv6'); } catch { return false; }
  }).sort((a, b) => Number(String(b.resource).split('/')[1]) - Number(String(a.resource).split('/')[1]));
  const best = rows[0];
  if (!best) return { registered_country: null, registry: null, prefix: null, registry_date: date(data.latest) };
  const equallySpecific = rows.filter((row) => String(row.resource).split('/')[1] === String(best.resource).split('/')[1]);
  const countries = new Set(equallySpecific.map((row) => country(row.country)));
  return { registered_country: countries.size === 1 ? country(best.country) : null, registry: typeof best.rir === 'string' ? best.rir : null, prefix: String(best.resource), registry_date: date(data.latest) };
}
function object(value: unknown): RecordValue { return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}; }
function country(value: unknown): string | null { return typeof value === 'string' && /^[A-Z]{2}$/.test(value) && !['ZZ', 'EU', 'AP'].includes(value) ? value : null; }
function date(value: unknown): string | null { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value.endsWith('Z') || /[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`).toISOString() : null; }
function failure(error: unknown): NativeLookupError { return error instanceof LookupError ? error.code : 'unavailable'; }
