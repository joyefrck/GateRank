import { resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { IpCheckErrorCode, IpCheckResult } from '../../../shared/ipCheck';
import { isPublicIpAddress } from '../utils/ipCheckTarget';

export interface IpCheckService {
  lookup(query: string): Promise<IpCheckResult>;
}

export class IpCheckServiceError extends Error {
  constructor(
    public readonly code: IpCheckErrorCode,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'IpCheckServiceError';
  }
}

interface IpGeolocationServiceOptions {
  baseUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  resolveDomain?: (domain: string) => Promise<string[]>;
}

interface IpWhoIsResponse {
  ip?: unknown;
  success?: unknown;
  country?: unknown;
  country_code?: unknown;
  region?: unknown;
  region_code?: unknown;
  city?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  postal?: unknown;
  connection?: {
    asn?: unknown;
    org?: unknown;
    isp?: unknown;
  } | null;
  timezone?: {
    id?: unknown;
  } | null;
}

interface CacheEntry {
  expiresAt: number;
  result: IpCheckResult;
}

export class IpGeolocationService implements IpCheckService {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly cacheTtlMs: number;
  private readonly cacheMaxEntries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly resolveDomain: (domain: string) => Promise<string[]>;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: IpGeolocationServiceOptions = {}) {
    this.baseUrl = (
      options.baseUrl
      ?? process.env.IP_CHECK_UPSTREAM_BASE_URL?.trim()
      ?? 'https://ipwho.is'
    ).replace(/\/+$/, '');
    this.timeoutMs = positiveNumber(
      options.timeoutMs ?? process.env.IP_CHECK_UPSTREAM_TIMEOUT_MS,
      5000,
    );
    this.cacheTtlMs = positiveNumber(
      options.cacheTtlMs ?? process.env.IP_CHECK_CACHE_TTL_MS,
      86_400_000,
    );
    this.cacheMaxEntries = positiveInteger(
      options.cacheMaxEntries ?? process.env.IP_CHECK_CACHE_MAX_ENTRIES,
      2000,
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.resolveDomain = options.resolveDomain ?? resolveDomainAddresses;
  }

  async lookup(query: string): Promise<IpCheckResult> {
    const cached = this.cache.get(query);
    if (cached) {
      if (cached.expiresAt > this.now()) {
        return { ...cached.result };
      }
      this.cache.delete(query);
    }

    let upstreamQuery = query;
    if (isIP(query) === 0) {
      let addresses: string[];
      try {
        addresses = await this.resolveDomain(query);
      } catch {
        throw new IpCheckServiceError('IP_CHECK_LOOKUP_FAILED', 422);
      }
      upstreamQuery = addresses.find(isPublicIpAddress) ?? '';
      if (!upstreamQuery) {
        throw new IpCheckServiceError('IP_CHECK_LOOKUP_FAILED', 422);
      }
    }

    const url = new URL(`/${encodeURIComponent(upstreamQuery)}`, this.baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (response.status === 429) {
        throw new IpCheckServiceError('IP_CHECK_RATE_LIMITED', 429);
      }
      if (!response.ok) {
        throw new IpCheckServiceError('IP_CHECK_UPSTREAM_ERROR', 502);
      }

      let data: IpWhoIsResponse;
      try {
        data = await response.json() as IpWhoIsResponse;
      } catch {
        throw new IpCheckServiceError('IP_CHECK_UPSTREAM_ERROR', 502);
      }
      if (data.success !== true) {
        throw new IpCheckServiceError('IP_CHECK_LOOKUP_FAILED', 422);
      }

      const latitude = finiteNumber(data.latitude);
      const longitude = finiteNumber(data.longitude);
      const ip = asString(data.ip);
      if (latitude === null || longitude === null || !ip) {
        throw new IpCheckServiceError('IP_CHECK_UPSTREAM_ERROR', 502);
      }

      const result: IpCheckResult = {
        ip,
        country: asString(data.country),
        country_code: asString(data.country_code),
        region: asString(data.region_code),
        region_name: asString(data.region),
        city: asString(data.city),
        postal_code: asString(data.postal),
        latitude,
        longitude,
        timezone: asString(data.timezone?.id),
        isp: asString(data.connection?.isp),
        organization: asString(data.connection?.org),
        asn: normalizeAsn(data.connection?.asn),
      };

      while (this.cache.size >= this.cacheMaxEntries) {
        const oldestKey = this.cache.keys().next().value;
        if (typeof oldestKey !== 'string') break;
        this.cache.delete(oldestKey);
      }
      this.cache.set(query, {
        expiresAt: this.now() + this.cacheTtlMs,
        result: { ...result },
      });

      return result;
    } catch (error) {
      if (error instanceof IpCheckServiceError) {
        throw error;
      }
      if (isAbortError(error)) {
        throw new IpCheckServiceError('IP_CHECK_UPSTREAM_TIMEOUT', 504);
      }
      throw new IpCheckServiceError('IP_CHECK_UPSTREAM_ERROR', 502);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function positiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveInteger(value: unknown, fallback: number): number {
  return Math.max(1, Math.floor(positiveNumber(value, fallback)));
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAsn(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `AS${Math.trunc(value)}`;
  }
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  if (!normalized) return '';
  if (/^AS\d+$/i.test(normalized)) return normalized.toUpperCase();
  if (/^\d+$/.test(normalized)) return `AS${normalized}`;
  return normalized;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function resolveDomainAddresses(domain: string): Promise<string[]> {
  const results = await Promise.allSettled([
    resolve4(domain),
    resolve6(domain),
  ]);
  return results.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
}
