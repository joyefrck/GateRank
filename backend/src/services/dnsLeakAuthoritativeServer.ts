import { randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import DNS from 'dns2';
import type { DnsLeakObservation } from '../../../shared/dnsLeakTest';
import { isPublicIpAddress } from '../utils/ipCheckTarget';
import {
  canonicalizeDnsLeakObservation,
  normalizeDnsZone,
  signDnsProbeCallback,
  verifyDnsProbeHostname,
} from '../utils/dnsLeakProbeToken';

const RCODE_NOERROR = 0;
const RCODE_NXDOMAIN = 3;
const RCODE_REFUSED = 5;
const DEFAULT_TTL_SECONDS = 60;
const DEFAULT_CALLBACK_TIMEOUT_MS = 3_000;
const CALLBACK_RETRY_DELAYS_MS = [0, 250, 1_000] as const;

interface DnsLeakAuthoritativeServerOptions {
  zone: string;
  publicIpv4: string;
  sessionSecret: string;
  callbackSecret: string;
  callbackUrl: string;
  callbackTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  createEventId?: () => string;
  delay?: (milliseconds: number) => Promise<void>;
  allowPrivateResolverIps?: boolean;
}

export interface DnsLeakProbeListenOptions {
  address?: string;
  port?: number;
}

export class DnsLeakAuthoritativeServer {
  private readonly zone: string;
  private readonly nameserver: string;
  private readonly publicIpv4: string;
  private readonly sessionSecret: string;
  private readonly callbackSecret: string;
  private readonly callbackUrl: string;
  private readonly callbackTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly createEventId: () => string;
  private readonly delay: (milliseconds: number) => Promise<void>;
  private readonly allowPrivateResolverIps: boolean;
  private readonly pendingCallbacks = new Set<Promise<void>>();
  private readonly server: DNS.DnsServer;

  constructor(options: DnsLeakAuthoritativeServerOptions) {
    this.zone = normalizeDnsZone(options.zone);
    this.nameserver = `ns1.${this.zone}`;
    if (isIP(options.publicIpv4) !== 4 || !isPublicIpAddress(options.publicIpv4)) {
      throw new Error('DNS_PROBE_PUBLIC_IPV4_INVALID');
    }
    if (options.sessionSecret.length < 32 || options.callbackSecret.length < 32) {
      throw new Error('DNS_LEAK_TEST_SECRET_TOO_SHORT');
    }
    const callbackUrl = new URL(options.callbackUrl);
    const isLocalHttp = callbackUrl.protocol === 'http:'
      && ['127.0.0.1', 'localhost', '::1'].includes(callbackUrl.hostname);
    if (callbackUrl.protocol !== 'https:' && !isLocalHttp) {
      throw new Error('DNS_PROBE_CALLBACK_URL_INVALID');
    }
    this.publicIpv4 = options.publicIpv4;
    this.sessionSecret = options.sessionSecret;
    this.callbackSecret = options.callbackSecret;
    this.callbackUrl = callbackUrl.toString();
    this.callbackTimeoutMs = positiveInteger(options.callbackTimeoutMs, DEFAULT_CALLBACK_TIMEOUT_MS);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.createEventId = options.createEventId ?? (() => randomBytes(16).toString('hex'));
    this.delay = options.delay ?? ((milliseconds) => (
      new Promise((resolve) => setTimeout(resolve, milliseconds))
    ));
    this.allowPrivateResolverIps = options.allowPrivateResolverIps === true;
    this.server = DNS.createServer({
      udp: true,
      tcp: true,
      maxConcurrent: 1_000,
      handle: (request, send, client) => {
        const response = this.buildResponse(request, resolveClientAddress(client));
        void send(response);
      },
    });
  }

  async listen(options: DnsLeakProbeListenOptions = {}): Promise<DNS.ServerAddresses> {
    const address = options.address || '0.0.0.0';
    const port = positiveInteger(options.port, 5353);
    return this.server.listen({
      udp: { address, port },
      tcp: { address, port },
    });
  }

  async close(): Promise<void> {
    await this.server.close();
    await this.waitForCallbacks();
  }

  addresses(): DNS.ServerAddresses {
    return this.server.addresses();
  }

  async waitForCallbacks(): Promise<void> {
    while (this.pendingCallbacks.size > 0) {
      await Promise.allSettled([...this.pendingCallbacks]);
    }
  }

  buildResponse(request: DNS.Packet, resolverIp: string): DNS.Packet {
    const response = DNS.Packet.createResponseFromRequest(request);
    response.header.aa = 1;
    response.header.ra = 0;
    response.header.rcode = RCODE_NOERROR;
    const question = request.questions[0];
    if (!question) {
      response.header.rcode = RCODE_REFUSED;
      return response;
    }

    const name = normalizeQueryName(question.name);
    if (name !== this.zone && !name.endsWith(`.${this.zone}`)) {
      response.header.rcode = RCODE_REFUSED;
      return response;
    }

    if (name === this.zone) {
      if (question.type === DNS.Packet.TYPE.SOA || question.type === DNS.Packet.TYPE.ANY) {
        response.answers.push(this.soaRecord());
      }
      if (question.type === DNS.Packet.TYPE.NS || question.type === DNS.Packet.TYPE.ANY) {
        response.answers.push(this.nsRecord());
      }
      if (response.answers.length === 0) {
        response.authorities.push(this.soaRecord());
      }
      return response;
    }

    if (name === this.nameserver) {
      if (question.type === DNS.Packet.TYPE.A || question.type === DNS.Packet.TYPE.ANY) {
        response.answers.push(new DNS.Packet.Resource({
          name: this.nameserver,
          type: DNS.Packet.TYPE.A,
          class: DNS.Packet.CLASS.IN,
          ttl: DEFAULT_TTL_SECONDS,
          address: this.publicIpv4,
        }));
      } else {
        response.authorities.push(this.soaRecord());
      }
      return response;
    }

    response.header.rcode = RCODE_NXDOMAIN;
    response.authorities.push(this.soaRecord());
    const token = verifyDnsProbeHostname(name, this.zone, this.sessionSecret, this.now());
    if (token && this.acceptResolverIp(resolverIp)) {
      const observation: DnsLeakObservation = {
        event_id: this.createEventId(),
        session_id: token.sessionId,
        probe_index: token.probeIndex,
        resolver_ip: normalizeIp(resolverIp),
        query_type: dnsTypeName(question.type),
        dnssec_ok: hasDnssecOkFlag(request),
        observed_at: new Date(this.now()).toISOString(),
      };
      this.enqueueCallback(observation);
    }
    return response;
  }

  private soaRecord(): DNS.Packet.Resource {
    return new DNS.Packet.Resource({
      name: this.zone,
      type: DNS.Packet.TYPE.SOA,
      class: DNS.Packet.CLASS.IN,
      ttl: DEFAULT_TTL_SECONDS,
      primary: this.nameserver,
      admin: `hostmaster.${this.zone}`,
      serial: Number(new Date(this.now()).toISOString().slice(0, 10).replaceAll('-', '')),
      refresh: 3_600,
      retry: 600,
      expiration: 86_400,
      minimum: DEFAULT_TTL_SECONDS,
    });
  }

  private nsRecord(): DNS.Packet.Resource {
    return new DNS.Packet.Resource({
      name: this.zone,
      type: DNS.Packet.TYPE.NS,
      class: DNS.Packet.CLASS.IN,
      ttl: DEFAULT_TTL_SECONDS,
      ns: this.nameserver,
      domain: this.nameserver,
    });
  }

  private acceptResolverIp(resolverIp: string): boolean {
    const normalized = normalizeIp(resolverIp);
    return this.allowPrivateResolverIps
      ? isIP(normalized) > 0
      : isPublicIpAddress(normalized);
  }

  private enqueueCallback(observation: DnsLeakObservation): void {
    const task = this.reportObservation(observation)
      .catch(() => {
        console.error('[dns-probe] observation callback failed after retries');
      })
      .finally(() => {
        this.pendingCallbacks.delete(task);
      });
    this.pendingCallbacks.add(task);
  }

  private async reportObservation(observation: DnsLeakObservation): Promise<void> {
    const body = canonicalizeDnsLeakObservation(observation);
    for (const [attempt, retryDelay] of CALLBACK_RETRY_DELAYS_MS.entries()) {
      if (retryDelay > 0) await this.delay(retryDelay);
      const timestamp = String(Math.floor(this.now() / 1000));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.callbackTimeoutMs);
      try {
        const response = await this.fetchImpl(this.callbackUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-dns-probe-timestamp': timestamp,
            'x-dns-probe-signature': signDnsProbeCallback(body, timestamp, this.callbackSecret),
          },
          body,
          signal: controller.signal,
        });
        if (response.status === 202 || response.status === 409) return;
        if (response.status >= 400 && response.status < 500) {
          throw new NonRetryableCallbackError();
        }
      } catch (error) {
        if (error instanceof NonRetryableCallbackError) throw error;
        if (attempt === CALLBACK_RETRY_DELAYS_MS.length - 1) throw error;
      } finally {
        clearTimeout(timeout);
      }
    }
  }
}

class NonRetryableCallbackError extends Error {}

function resolveClientAddress(
  client: Parameters<DNS.DnsHandler>[2],
): string {
  if ('address' in client && typeof client.address === 'string') {
    return client.address;
  }
  if ('proxyAddress' in client && typeof client.proxyAddress === 'string') {
    return client.proxyAddress;
  }
  if ('remoteAddress' in client && typeof client.remoteAddress === 'string') {
    return client.remoteAddress;
  }
  return '';
}

function normalizeQueryName(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

function normalizeIp(value: string): string {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized.startsWith('::ffff:') ? normalized.slice('::ffff:'.length) : normalized;
}

function hasDnssecOkFlag(request: DNS.Packet): boolean {
  return request.additionals.some((record) => (
    record.type === DNS.Packet.TYPE.EDNS
    && (
      (record as DNS.Packet.Resource & { doFlag?: boolean }).doFlag === true
      || Boolean(record.ttl & 0x8000)
    )
  ));
}

function dnsTypeName(type: number): string {
  const names: Record<number, string> = {
    [DNS.Packet.TYPE.A]: 'A',
    [DNS.Packet.TYPE.NS]: 'NS',
    [DNS.Packet.TYPE.SOA]: 'SOA',
    [DNS.Packet.TYPE.AAAA]: 'AAAA',
    65: 'HTTPS',
    [DNS.Packet.TYPE.ANY]: 'ANY',
  };
  return names[type] || `TYPE${type}`;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
