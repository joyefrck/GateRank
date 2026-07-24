import type { IpCheckErrorCode, IpCheckResult } from '../../../shared/ipCheck';

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
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface IpApiProResponse {
  status?: unknown;
  query?: unknown;
  country?: unknown;
  countryCode?: unknown;
  region?: unknown;
  regionName?: unknown;
  city?: unknown;
  zip?: unknown;
  lat?: unknown;
  lon?: unknown;
  timezone?: unknown;
  isp?: unknown;
  org?: unknown;
  as?: unknown;
}

const IP_API_FIELDS = [
  'status',
  'message',
  'country',
  'countryCode',
  'region',
  'regionName',
  'city',
  'zip',
  'lat',
  'lon',
  'timezone',
  'isp',
  'org',
  'as',
  'query',
].join(',');

export class IpGeolocationService implements IpCheckService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: IpGeolocationServiceOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.IP_API_PRO_KEY?.trim() ?? '';
    this.baseUrl = (options.baseUrl ?? process.env.IP_API_PRO_BASE_URL?.trim() ?? 'https://pro.ip-api.com').replace(/\/+$/, '');
    this.timeoutMs = positiveNumber(options.timeoutMs ?? process.env.IP_CHECK_UPSTREAM_TIMEOUT_MS, 5000);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async lookup(query: string): Promise<IpCheckResult> {
    if (!this.apiKey) {
      throw new IpCheckServiceError('IP_CHECK_NOT_CONFIGURED', 503);
    }

    const url = new URL(`/json/${encodeURIComponent(query)}`, this.baseUrl);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('fields', IP_API_FIELDS);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new IpCheckServiceError('IP_CHECK_UPSTREAM_ERROR', 502);
      }

      let data: IpApiProResponse;
      try {
        data = await response.json() as IpApiProResponse;
      } catch {
        throw new IpCheckServiceError('IP_CHECK_UPSTREAM_ERROR', 502);
      }
      if (data.status !== 'success') {
        throw new IpCheckServiceError('IP_CHECK_LOOKUP_FAILED', 422);
      }

      const latitude = finiteNumber(data.lat);
      const longitude = finiteNumber(data.lon);
      if (latitude === null || longitude === null || !asString(data.query)) {
        throw new IpCheckServiceError('IP_CHECK_UPSTREAM_ERROR', 502);
      }

      return {
        ip: asString(data.query),
        country: asString(data.country),
        country_code: asString(data.countryCode),
        region: asString(data.region),
        region_name: asString(data.regionName),
        city: asString(data.city),
        postal_code: asString(data.zip),
        latitude,
        longitude,
        timezone: asString(data.timezone),
        isp: asString(data.isp),
        organization: asString(data.org),
        asn: asString(data.as),
      };
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

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
