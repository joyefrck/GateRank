import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import { isIP } from 'node:net';
import { normalizeWebsiteUrl } from '../../../shared/websiteUrl';
import type { WebsiteProbeResult, WebsiteStatus } from '../../../shared/riskCheck';
import { isPublicIpAddress } from '../utils/ipCheckTarget';

export interface ResolvedAddress { address: string; family: 4 | 6 }
export interface HttpProbeResponse { status?: number; challenge?: boolean; location?: string; error_code?: string }
export interface TlsProbeResponse { days: number | null; authorized: boolean | null; error_code?: string }
export interface WebsiteProbeDeps {
  resolveAddresses(url: URL): Promise<ResolvedAddress[]>;
  requestUrl(url: URL, address: ResolvedAddress, timeoutMs: number, signal: AbortSignal): Promise<HttpProbeResponse>;
  getSslDaysLeft(url: URL, address: ResolvedAddress, timeoutMs: number, signal: AbortSignal): Promise<number | null | TlsProbeResponse>;
  totalTimeoutMs: number;
}

class ProbeError extends Error {
  constructor(readonly code: string, readonly configuration = false) { super(code); }
}
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const NETWORK_CODES = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'EPROTO', 'PROBE_TIMEOUT', 'NO_ADDRESSES']);
function errorCode(error: unknown): string {
  const code = (error as { code?: string })?.code;
  return typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'INTERNAL_ERROR';
}
function safeUrl(url: URL): string { return `${url.origin}${url.pathname}`; }
function publicAddress(address: string): boolean {
  // Only globally routable IPv6 unicast; reject transition/mapped ranges too.
  if (isIP(address) === 6 && (!/^[23][\da-f]{0,3}:/i.test(address) || /^2002:|^2001:(?:0:|:)/i.test(address))) return false;
  return isPublicIpAddress(address);
}
export function emptyProbeResult(status: WebsiteStatus = 'internal_error'): WebsiteProbeResult {
  return { domain_ok: null, ssl_days_left: null, status, checked_at: new Date().toISOString(),
    probe_location: '中心 API 检测点', target_url: null, final_url: null, ssl_target_url: null,
    tls_authorized: null, http_status: null, error_code: null, root_fallback: false,
    retried: false, duration_ms: 0, attempts: [] };
}

export async function probeWebsite(rawUrl: string, overrides: Partial<WebsiteProbeDeps> = {}): Promise<WebsiteProbeResult> {
  const began = Date.now();
  const result = emptyProbeResult();
  const budget = Math.max(1, Math.min(overrides.totalTimeoutMs ?? 30000, 30000));
  const deadline = began + budget;
  const controller = new AbortController();
  const deps = { resolveAddresses, requestUrl: requestUrlByAddress, getSslDaysLeft: getSslDaysLeftByAddress, ...overrides };
  const resolutionCache = new Map<string, Promise<ResolvedAddress[]>>();
  const finish = () => { controller.abort(); result.duration_ms = Date.now() - began; return result; };
  async function bounded<T>(work: (signal: AbortSignal, ms: number) => Promise<T>): Promise<T> {
    const ms = Math.min(8000, deadline - Date.now());
    if (ms <= 0) throw new ProbeError('PROBE_TIMEOUT');
    const operation = new AbortController();
    const abort = () => operation.abort();
    controller.signal.addEventListener('abort', abort, { once: true });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([work(operation.signal, ms), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { operation.abort(); reject(new ProbeError('PROBE_TIMEOUT')); }, ms);
      })]);
    } finally { clearTimeout(timer); operation.abort(); controller.signal.removeEventListener('abort', abort); }
  }
  async function resolve(url: URL, round: number): Promise<ResolvedAddress[]> {
    if (!resolutionCache.has(url.hostname)) {
      const promise = (async () => {
        try {
          const addresses = await bounded(() => deps.resolveAddresses(url));
          if (addresses.length === 0) throw new ProbeError('NO_ADDRESSES');
          if (addresses.some((a) => !publicAddress(a.address))) throw new ProbeError('NON_PUBLIC_TARGET', true);
          result.attempts.push({ stage: 'dns', url: safeUrl(url), round, http_status: null, error_code: null });
          return [...addresses].sort((a, b) => a.family - b.family);
        } catch (error) {
          result.attempts.push({ stage: 'dns', url: safeUrl(url), round, http_status: null, error_code: errorCode(error) });
          throw error;
        }
      })();
      resolutionCache.set(url.hostname, promise);
    }
    return resolutionCache.get(url.hostname)!;
  }
  type Outcome = { status: WebsiteStatus; url: URL; code: string | null; http: number | null };
  async function walk(start: URL, round: number): Promise<Outcome> {
    let url = new URL(start.href);
    const visited = new Set<string>();
    for (let hop = 0; hop <= 5; hop++) {
      if (visited.has(url.href)) return { status: 'service_error', url, code: 'REDIRECT_LOOP', http: null };
      visited.add(url.href);
      const addresses = await resolve(url, round);
      let response: HttpProbeResponse = { error_code: 'CONNECTION_FAILED' };
      for (const address of addresses) {
        try { response = await bounded((signal, ms) => deps.requestUrl(url, address, ms, signal)); }
        catch (error) {
          const code = errorCode(error);
          if (!NETWORK_CODES.has(code)) throw error;
          response = { error_code: code };
        }
        result.attempts.push({ stage: 'http', url: safeUrl(url), round, http_status: response.status ?? null, error_code: response.error_code ?? null });
        if (response.status !== undefined) break;
      }
      if (response.status === undefined) return { status: 'unreachable', url, code: response.error_code ?? 'CONNECTION_FAILED', http: null };
      if (response.challenge) return { status: 'challenge', url, code: null, http: response.status };
      if (REDIRECTS.has(response.status)) {
        if (!response.location) return { status: 'service_error', url, code: 'REDIRECT_NO_LOCATION', http: response.status };
        if (hop === 5) return { status: 'service_error', url, code: 'REDIRECT_LIMIT', http: response.status };
        try { url = new URL(normalizeWebsiteUrl(new URL(response.location, url).href)); url.hash = ''; }
        catch { throw new ProbeError('INVALID_REDIRECT', true); }
        continue;
      }
      const status: WebsiteStatus = response.status >= 200 && response.status < 300 ? 'accessible'
        : [401, 403, 429].includes(response.status) ? 'restricted' : 'service_error';
      return { status, url, code: status === 'service_error' ? `HTTP_${response.status}` : null, http: response.status };
    }
    throw new ProbeError('INTERNAL_ERROR');
  }
  async function inspectTls(url: URL): Promise<void> {
    if (url.protocol !== 'https:') return;
    result.ssl_target_url = safeUrl(url);
    const addresses = await resolve(url, 1);
    for (const address of addresses) {
      let tlsResult: TlsProbeResponse;
      try {
        const value = await bounded((signal, ms) => deps.getSslDaysLeft(url, address, ms, signal));
        tlsResult = typeof value === 'object' && value !== null ? value : { days: typeof value === 'number' ? value : null, authorized: null };
      } catch (error) {
        const code = errorCode(error);
        if (!NETWORK_CODES.has(code)) throw error;
        tlsResult = { days: null, authorized: null, error_code: code };
      }
      result.attempts.push({ stage: 'tls', url: safeUrl(url), round: 1, http_status: null, error_code: tlsResult.error_code ?? (tlsResult.days === null ? 'TLS_UNAVAILABLE' : null) });
      if (tlsResult.days !== null) {
        result.ssl_days_left = tlsResult.days;
        result.tls_authorized = tlsResult.authorized;
        return;
      }
    }
  }
  let tlsWork: Promise<void> | undefined;
  let tlsError: unknown;
  try {
    let parsed: URL;
    try { parsed = new URL(normalizeWebsiteUrl(rawUrl)); parsed.hash = ''; }
    catch { throw new ProbeError('INVALID_WEBSITE_URL', true); }
    result.target_url = safeUrl(parsed);
    // TLS describes the configured host, not the origin hidden behind a CDN.
    tlsWork = inspectTls(parsed).catch((error) => { tlsError = error; });
    let outcome: Outcome | undefined;
    let lastFailure: Outcome | undefined;
    for (let round = 1; round <= 2; round++) {
      if (round === 2) { result.retried = true; resolutionCache.clear(); }
      const root = new URL('/', parsed);
      const candidates = parsed.href === root.href ? [parsed] : [parsed, root];
      for (const candidate of candidates) {
        try { outcome = await walk(candidate, round); }
        catch (error) {
          if (error instanceof ProbeError && error.configuration) throw error;
          const code = errorCode(error);
          if (!NETWORK_CODES.has(code)) throw error;
          outcome = { status: 'unreachable', url: candidate, code, http: null };
        }
        if (['accessible', 'challenge', 'restricted'].includes(outcome.status)) {
          result.root_fallback = candidate !== parsed;
          break;
        }
        // Retain explicit server/redirect failure when a later request times out.
        if (!lastFailure || outcome.status === 'service_error') lastFailure = outcome;
      }
      if (outcome && ['accessible', 'challenge', 'restricted'].includes(outcome.status)) break;
      if (Date.now() >= deadline || (lastFailure?.http && lastFailure.http < 500)) break;
    }
    await tlsWork;
    if (tlsError && (!(tlsError instanceof ProbeError) || tlsError.configuration) && !NETWORK_CODES.has(errorCode(tlsError))) throw tlsError;
    if (!outcome || !['accessible', 'challenge', 'restricted'].includes(outcome.status)) outcome = lastFailure ?? outcome;
    if (!outcome) throw new ProbeError('INTERNAL_ERROR');
    result.status = outcome.status === 'unreachable' && result.ssl_days_left !== null ? 'tls_only' : outcome.status;
    result.domain_ok = ['accessible', 'challenge', 'restricted', 'tls_only'].includes(result.status);
    result.final_url = safeUrl(outcome.url);
    result.http_status = outcome.http;
    result.error_code = outcome.code;
  } catch (error) {
    result.status = error instanceof ProbeError && error.configuration ? 'config_error' : 'internal_error';
    result.error_code = errorCode(error);
    result.domain_ok = null;
    controller.abort();
    await tlsWork;
  }
  return finish();
}

async function resolveAddresses(url: URL): Promise<ResolvedAddress[]> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return [{ address: host, family: isIP(host) as 4 | 6 }];
  return (await lookup(host, { all: true, verbatim: false })).map((item) => ({ address: item.address, family: item.family === 6 ? 6 : 4 }));
}

function requestUrlByAddress(url: URL, address: ResolvedAddress, timeoutMs: number, signal: AbortSignal): Promise<HttpProbeResponse> {
  return new Promise((resolve) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.request({ host: address.address, family: address.family,
      port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
      method: 'GET', path: `${url.pathname}${url.search}`, servername: url.hostname.replace(/^\[|\]$/g, ''),
      // Read HTTP evidence even for expired certificates; certificate trust is reported separately.
      rejectUnauthorized: false, signal,
      headers: { Host: url.host, 'User-Agent': 'GateRank-Risk-Check/1.0', Accept: 'text/html,application/xhtml+xml' },
    }, (response) => {
      resolve({ status: response.statusCode, challenge: response.headers['cf-mitigated'] === 'challenge', location: response.headers.location });
      // Headers are enough; never download an unbounded body or run challenge scripts.
      response.destroy(); request.destroy();
    });
    const timer = setTimeout(() => request.destroy(new ProbeError('ETIMEDOUT')), timeoutMs);
    request.once('close', () => clearTimeout(timer));
    request.on('error', (error) => resolve({ error_code: signal.aborted ? 'PROBE_TIMEOUT' : errorCode(error) }));
    request.end();
  });
}

function getSslDaysLeftByAddress(url: URL, address: ResolvedAddress, timeoutMs: number, signal: AbortSignal): Promise<TlsProbeResponse> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host: address.address, port: url.port ? Number(url.port) : 443,
      servername: url.hostname.replace(/^\[|\]$/g, ''), rejectUnauthorized: false });
    const abort = () => socket.destroy(new ProbeError('PROBE_TIMEOUT'));
    signal.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => socket.destroy(new ProbeError('ETIMEDOUT')), timeoutMs);
    socket.once('close', () => { clearTimeout(timer); signal.removeEventListener('abort', abort); });
    socket.once('secureConnect', () => {
      const expiry = Date.parse(socket.getPeerCertificate().valid_to);
      resolve({ days: Number.isFinite(expiry) ? Math.floor((expiry - Date.now()) / 86400000) : null,
        authorized: socket.authorized, error_code: socket.authorized ? undefined : 'TLS_CERTIFICATE_UNTRUSTED' });
      socket.destroy();
    });
    socket.on('error', (error) => resolve({ days: null, authorized: null, error_code: errorCode(error) }));
    if (signal.aborted) abort();
  });
}
