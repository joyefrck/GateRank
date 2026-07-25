import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import {
  DNS_LEAK_TEST_DURATION_MS,
  DNS_LEAK_TEST_SESSION_TTL_MS,
  DNS_LEAK_TEST_TOTAL_PROBES,
  assessDnsLeak,
  compareDnsLeakResolvers,
  deriveDnssecSignal,
  sortDnsQueryTypes,
  type DnsLeakNetworkInfo,
  type DnsLeakObservation,
  type DnsLeakResolverInfo,
  type DnsLeakTestResultResponse,
  type DnsLeakTestStartResponse,
} from '../../../shared/dnsLeakTest';
import type { IpCheckResult } from '../../../shared/ipCheck';
import { isPublicIpAddress } from '../utils/ipCheckTarget';
import {
  buildDnsProbeHostname,
  canonicalizeDnsLeakObservation,
  normalizeDnsZone,
  verifyDnsProbeCallback,
} from '../utils/dnsLeakProbeToken';
import type { IpCheckService } from './ipGeolocationService';

const DEFAULT_MAX_SESSIONS = 5_000;
const MAX_OBSERVATIONS_PER_SESSION = 200;
const MAX_RESOLVERS_PER_SESSION = 32;
const EVENT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const SESSION_ID_PATTERN = /^[a-f0-9]{32}$/;
const QUERY_TYPE_PATTERN = /^[A-Z0-9]{1,12}$/;

export type DnsLeakTestServiceErrorCode =
  | 'DNS_LEAK_TEST_NOT_CONFIGURED'
  | 'DNS_LEAK_TEST_CLIENT_IP_REQUIRED'
  | 'DNS_LEAK_TEST_SESSION_NOT_FOUND'
  | 'DNS_LEAK_TEST_INVALID_OBSERVATION'
  | 'DNS_LEAK_TEST_INVALID_SIGNATURE'
  | 'DNS_LEAK_TEST_REPLAYED_OBSERVATION';

export class DnsLeakTestServiceError extends Error {
  constructor(
    public readonly code: DnsLeakTestServiceErrorCode,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'DnsLeakTestServiceError';
  }
}

interface DnsLeakTestServiceOptions {
  ipCheckService: IpCheckService;
  zone?: string;
  sessionSecret?: string;
  callbackSecret?: string;
  now?: () => number;
  createSessionId?: () => string;
  maxSessions?: number;
  allowPrivateResolverIps?: boolean;
}

interface DnsLeakSession {
  id: string;
  visitorIp: string;
  createdAt: number;
  completeAfter: number;
  expiresAt: number;
  networkPromise: Promise<DnsLeakNetworkInfo>;
  observations: Map<string, DnsLeakObservation>;
  eventIds: Set<string>;
  resolverLookups: Map<string, Promise<DnsLeakNetworkInfo>>;
}

export class DnsLeakTestService {
  private readonly ipCheckService: IpCheckService;
  private readonly zone: string | null;
  private readonly sessionSecret: string;
  private readonly callbackSecret: string;
  private readonly now: () => number;
  private readonly createSessionId: () => string;
  private readonly maxSessions: number;
  private readonly allowPrivateResolverIps: boolean;
  private readonly sessions = new Map<string, DnsLeakSession>();

  constructor(options: DnsLeakTestServiceOptions) {
    this.ipCheckService = options.ipCheckService;
    this.zone = normalizeOptionalZone(options.zone);
    this.sessionSecret = String(options.sessionSecret || '');
    this.callbackSecret = String(options.callbackSecret || '');
    this.now = options.now ?? Date.now;
    this.createSessionId = options.createSessionId ?? (() => randomBytes(16).toString('hex'));
    this.maxSessions = positiveInteger(options.maxSessions, DEFAULT_MAX_SESSIONS);
    this.allowPrivateResolverIps = options.allowPrivateResolverIps === true;
  }

  isConfigured(): boolean {
    return Boolean(
      this.zone
      && this.sessionSecret.length >= 32
      && this.callbackSecret.length >= 32,
    );
  }

  async createSession(visitorIp: string): Promise<DnsLeakTestStartResponse> {
    this.assertConfigured();
    const normalizedVisitorIp = normalizeIp(visitorIp);
    if (!normalizedVisitorIp || normalizedVisitorIp === 'unknown') {
      throw new DnsLeakTestServiceError('DNS_LEAK_TEST_CLIENT_IP_REQUIRED', 422);
    }
    this.cleanupExpiredSessions();
    while (this.sessions.size >= this.maxSessions) {
      const oldestSessionId = this.sessions.keys().next().value;
      if (typeof oldestSessionId !== 'string') break;
      this.sessions.delete(oldestSessionId);
    }

    const createdAt = this.now();
    const completeAfter = createdAt + DNS_LEAK_TEST_DURATION_MS;
    const expiresAt = createdAt + DNS_LEAK_TEST_SESSION_TTL_MS;
    const id = this.createSessionId();
    if (!SESSION_ID_PATTERN.test(id) || this.sessions.has(id)) {
      throw new Error('DNS_LEAK_TEST_INVALID_SESSION_ID');
    }
    const session: DnsLeakSession = {
      id,
      visitorIp: normalizedVisitorIp,
      createdAt,
      completeAfter,
      expiresAt,
      networkPromise: this.lookupNetwork(normalizedVisitorIp),
      observations: new Map(),
      eventIds: new Set(),
      resolverLookups: new Map(),
    };
    this.sessions.set(id, session);

    return {
      session_id: id,
      expires_at: new Date(expiresAt).toISOString(),
      complete_after: new Date(completeAfter).toISOString(),
      total_probes: DNS_LEAK_TEST_TOTAL_PROBES,
      probe_hosts: Array.from({ length: DNS_LEAK_TEST_TOTAL_PROBES }, (_, probeIndex) => (
        buildDnsProbeHostname({
          sessionId: id,
          probeIndex,
          expiresAt,
        }, this.zone!, this.sessionSecret)
      )),
    };
  }

  async getResult(sessionId: string, visitorIp: string): Promise<DnsLeakTestResultResponse> {
    this.assertConfigured();
    this.cleanupExpiredSessions();
    const session = this.sessions.get(String(sessionId || ''));
    if (!session || session.visitorIp !== normalizeIp(visitorIp)) {
      throw new DnsLeakTestServiceError('DNS_LEAK_TEST_SESSION_NOT_FOUND', 404);
    }

    const observations = [...session.observations.values()];
    const resolverGroups = groupObservationsByResolver(observations);
    const resolvers = await Promise.all([...resolverGroups.entries()].map(async ([resolverIp, items]) => {
      const network = await this.getResolverNetwork(session, resolverIp);
      return {
        ...network,
        dnssec_ok: items.some((item) => item.dnssec_ok),
        query_types: sortDnsQueryTypes(items.map((item) => item.query_type)),
        observation_count: new Set(items.map((item) => item.probe_index)).size,
      } satisfies DnsLeakResolverInfo;
    }));
    resolvers.sort(compareDnsLeakResolvers);

    const network = await session.networkPromise;
    const assessment = assessDnsLeak(network.country_code, resolvers);
    const observedProbeCount = new Set(observations.map((item) => item.probe_index)).size;
    const isFinished = observedProbeCount >= DNS_LEAK_TEST_TOTAL_PROBES || this.now() >= session.completeAfter;
    const status = isFinished
      ? observations.length > 0 ? 'complete' : 'inconclusive'
      : 'running';

    return {
      status,
      checked_at: new Date(this.now()).toISOString(),
      observed_probe_count: observedProbeCount,
      total_probes: DNS_LEAK_TEST_TOTAL_PROBES,
      network,
      resolvers,
      verdict: assessment.verdict,
      country_consistency: assessment.country_consistency,
      dnssec_signal: deriveDnssecSignal(observations),
      doh: 'not_detectable',
      dot: 'not_detectable',
    };
  }

  recordObservation(
    input: unknown,
    timestamp: string,
    signature: string,
  ): void {
    this.assertConfigured();
    this.cleanupExpiredSessions();
    const observation = parseObservation(input, this.now(), this.allowPrivateResolverIps);
    const canonicalBody = canonicalizeDnsLeakObservation(observation);
    if (!verifyDnsProbeCallback(
      canonicalBody,
      timestamp,
      signature,
      this.callbackSecret,
      this.now(),
    )) {
      throw new DnsLeakTestServiceError('DNS_LEAK_TEST_INVALID_SIGNATURE', 401);
    }

    const session = this.sessions.get(observation.session_id);
    if (!session) {
      throw new DnsLeakTestServiceError('DNS_LEAK_TEST_SESSION_NOT_FOUND', 404);
    }
    if (session.eventIds.has(observation.event_id)) {
      throw new DnsLeakTestServiceError('DNS_LEAK_TEST_REPLAYED_OBSERVATION', 409);
    }
    if (session.eventIds.size >= MAX_OBSERVATIONS_PER_SESSION) {
      return;
    }
    const resolverAlreadyObserved = [...session.observations.values()]
      .some((item) => item.resolver_ip === observation.resolver_ip);
    if (!resolverAlreadyObserved && session.resolverLookups.size >= MAX_RESOLVERS_PER_SESSION) {
      return;
    }
    session.eventIds.add(observation.event_id);
    session.observations.set(observation.event_id, observation);
    if (!session.resolverLookups.has(observation.resolver_ip)) {
      session.resolverLookups.set(
        observation.resolver_ip,
        this.lookupNetwork(observation.resolver_ip),
      );
    }
  }

  private getResolverNetwork(
    session: DnsLeakSession,
    resolverIp: string,
  ): Promise<DnsLeakNetworkInfo> {
    const existing = session.resolverLookups.get(resolverIp);
    if (existing) return existing;
    const lookup = this.lookupNetwork(resolverIp);
    session.resolverLookups.set(resolverIp, lookup);
    return lookup;
  }

  private async lookupNetwork(ip: string): Promise<DnsLeakNetworkInfo> {
    try {
      return mapIpCheckResult(await this.ipCheckService.lookup(ip));
    } catch {
      return unknownNetwork(ip);
    }
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new DnsLeakTestServiceError('DNS_LEAK_TEST_NOT_CONFIGURED', 503);
    }
  }

  private cleanupExpiredSessions(): void {
    const now = this.now();
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt <= now) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

function parseObservation(
  value: unknown,
  now: number,
  allowPrivateResolverIps: boolean,
): DnsLeakObservation {
  if (!value || typeof value !== 'object') {
    throw new DnsLeakTestServiceError('DNS_LEAK_TEST_INVALID_OBSERVATION', 400);
  }
  const input = value as Record<string, unknown>;
  const observation: DnsLeakObservation = {
    event_id: String(input.event_id || ''),
    session_id: String(input.session_id || ''),
    probe_index: Number(input.probe_index),
    resolver_ip: normalizeIp(input.resolver_ip),
    query_type: String(input.query_type || '').trim().toUpperCase(),
    dnssec_ok: input.dnssec_ok === true,
    observed_at: String(input.observed_at || ''),
  };
  const observedAt = Date.parse(observation.observed_at);
  if (
    !EVENT_ID_PATTERN.test(observation.event_id)
    || !SESSION_ID_PATTERN.test(observation.session_id)
    || !Number.isInteger(observation.probe_index)
    || observation.probe_index < 0
    || observation.probe_index >= DNS_LEAK_TEST_TOTAL_PROBES
    || (allowPrivateResolverIps
      ? isIP(observation.resolver_ip) === 0
      : !isPublicIpAddress(observation.resolver_ip))
    || !QUERY_TYPE_PATTERN.test(observation.query_type)
    || typeof input.dnssec_ok !== 'boolean'
    || !Number.isFinite(observedAt)
    || observedAt < now - DNS_LEAK_TEST_SESSION_TTL_MS
    || observedAt > now + 60_000
  ) {
    throw new DnsLeakTestServiceError('DNS_LEAK_TEST_INVALID_OBSERVATION', 400);
  }
  return observation;
}

function groupObservationsByResolver(
  observations: DnsLeakObservation[],
): Map<string, DnsLeakObservation[]> {
  const groups = new Map<string, DnsLeakObservation[]>();
  for (const observation of observations) {
    const items = groups.get(observation.resolver_ip) ?? [];
    items.push(observation);
    groups.set(observation.resolver_ip, items);
  }
  return groups;
}

function mapIpCheckResult(result: IpCheckResult): DnsLeakNetworkInfo {
  return {
    ip: result.ip,
    country: result.country,
    country_code: result.country_code.trim().toUpperCase(),
    isp: result.isp,
    organization: result.organization,
    asn: result.asn,
  };
}

function unknownNetwork(ip: string): DnsLeakNetworkInfo {
  return {
    ip,
    country: '',
    country_code: '',
    isp: '',
    organization: '',
    asn: '',
  };
}

function normalizeIp(value: unknown): string {
  const text = String(value || '').trim().toLowerCase();
  return text.startsWith('::ffff:') ? text.slice('::ffff:'.length) : text;
}

function normalizeOptionalZone(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return normalizeDnsZone(value);
  } catch {
    return null;
  }
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
