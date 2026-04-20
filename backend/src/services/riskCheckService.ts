import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import tls from 'node:tls';
import type { Airport, DailyMetrics } from '../types/domain';

interface RiskCheckDeps {
  airportRepository: {
    getById(id: number): Promise<Airport | null>;
  };
  metricsRepository: {
    getByAirportAndDate(airportId: number, date: string): Promise<DailyMetrics | null>;
    getLatestByAirportBeforeDate(airportId: number, date: string): Promise<DailyMetrics | null>;
    upsertDaily(input: DailyMetrics): Promise<void>;
  };
}

export class RiskCheckService {
  constructor(private readonly deps: RiskCheckDeps) {}

  async inspectAirportForDate(airportId: number, date: string): Promise<{ domain_ok: boolean; ssl_days_left: number | null }> {
    const airport = await this.deps.airportRepository.getById(airportId);
    if (!airport) {
      throw new Error(`airport ${airportId} not found`);
    }

    const [currentMetrics, latestMetrics] = await Promise.all([
      this.deps.metricsRepository.getByAirportAndDate(airportId, date),
      this.deps.metricsRepository.getLatestByAirportBeforeDate(airportId, date),
    ]);
    const base = currentMetrics || latestMetrics || createDefaultMetrics(airportId, date);
    const website = chooseWebsite(airport);
    const probe = await probeWebsite(website);

    await this.deps.metricsRepository.upsertDaily({
      ...base,
      airport_id: airportId,
      date,
      domain_ok: probe.domain_ok,
      ssl_days_left: probe.ssl_days_left,
    });

    return {
      domain_ok: probe.domain_ok,
      ssl_days_left: probe.ssl_days_left,
    };
  }
}

type AddressFamily = 4 | 6;

interface ResolvedAddress {
  address: string;
  family: AddressFamily;
}

interface WebsiteProbeDeps {
  resolveAddresses(url: URL): Promise<ResolvedAddress[]>;
  requestUrl(url: URL, address: ResolvedAddress, timeoutMs: number): Promise<boolean>;
  getSslDaysLeft(url: URL, address: ResolvedAddress, timeoutMs: number): Promise<number | null>;
}

const DEFAULT_PROBE_TIMEOUT_MS = 8000;

export async function probeWebsite(
  rawUrl: string,
  deps: Partial<WebsiteProbeDeps> = {},
): Promise<{ domain_ok: boolean; ssl_days_left: number | null }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { domain_ok: false, ssl_days_left: null };
  }

  const resolvedAddresses = deps.resolveAddresses || resolveAddresses;
  const requestUrl = deps.requestUrl || requestUrlByAddress;
  const getSslDaysLeftForAddress = deps.getSslDaysLeft || getSslDaysLeftByAddress;
  const addresses = (await resolvedAddresses(parsed).catch(() => [])).sort((left, right) => left.family - right.family);

  const httpReachable = await probeHttpReachability(parsed, addresses, requestUrl);
  const sslDaysLeft = await probeSslDaysLeft(parsed, addresses, getSslDaysLeftForAddress);

  return {
    domain_ok: httpReachable || sslDaysLeft !== null,
    ssl_days_left: sslDaysLeft,
  };
}

async function probeHttpReachability(
  parsed: URL,
  addresses: ResolvedAddress[],
  requestUrl: WebsiteProbeDeps['requestUrl'],
): Promise<boolean> {
  for (const candidate of buildHttpCandidates(parsed)) {
    for (const address of addresses) {
      if (await requestUrl(candidate, address, DEFAULT_PROBE_TIMEOUT_MS)) {
        return true;
      }
    }
  }
  return false;
}

async function probeSslDaysLeft(
  parsed: URL,
  addresses: ResolvedAddress[],
  getSslDaysLeft: WebsiteProbeDeps['getSslDaysLeft'],
): Promise<number | null> {
  if (parsed.protocol !== 'https:') {
    return null;
  }

  for (const address of addresses) {
    const sslDaysLeft = await getSslDaysLeft(parsed, address, DEFAULT_PROBE_TIMEOUT_MS);
    if (sslDaysLeft !== null) {
      return sslDaysLeft;
    }
  }

  return null;
}

async function resolveAddresses(parsed: URL): Promise<ResolvedAddress[]> {
  const resolved = await lookup(parsed.hostname, { all: true, verbatim: false });
  return resolved
    .map((item) => ({
      address: item.address,
      family: (item.family === 6 ? 6 : 4) as AddressFamily,
    }));
}

function buildHttpCandidates(parsed: URL): URL[] {
  const exact = new URL(parsed.toString());
  const root = new URL(`${parsed.protocol}//${parsed.host}/`);
  return exact.toString() === root.toString() ? [exact] : [exact, root];
}

async function requestUrlByAddress(url: URL, address: ResolvedAddress, timeoutMs: number): Promise<boolean> {
  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve) => {
    const request = client.request(
      {
        host: address.address,
        family: address.family,
        port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
        method: 'GET',
        path: `${url.pathname}${url.search}`,
        servername: url.hostname,
        rejectUnauthorized: false,
        headers: {
          Host: url.host,
          'User-Agent': 'GateRank-Risk-Check/1.0',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
        },
      },
      (response) => {
        response.resume();
        resolve(typeof response.statusCode === 'number');
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve(false);
    });
    request.on('error', () => {
      resolve(false);
    });
    request.end();
  });
}

async function getSslDaysLeftByAddress(
  url: URL,
  address: ResolvedAddress,
  timeoutMs: number,
): Promise<number | null> {
  const port = url.port ? Number(url.port) : 443;
  const host = url.hostname;

  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host: address.address,
        port,
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) {
          resolve(null);
          return;
        }
        const validTo = new Date(cert.valid_to);
        if (Number.isNaN(validTo.getTime())) {
          resolve(null);
          return;
        }
        const diffMs = validTo.getTime() - Date.now();
        resolve(Math.floor(diffMs / (24 * 60 * 60 * 1000)));
      },
    );

    socket.setTimeout(timeoutMs);
    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
    socket.on('error', () => {
      resolve(null);
    });
  });
}

function chooseWebsite(airport: Airport): string {
  const websites = airport.websites || [];
  for (const item of websites) {
    if (typeof item === 'string' && item.trim()) {
      return item.trim();
    }
  }
  if (airport.website && airport.website.trim()) {
    return airport.website.trim();
  }
  throw new Error(`airport ${airport.id} has no website configured`);
}

function createDefaultMetrics(airportId: number, date: string): DailyMetrics {
  return {
    airport_id: airportId,
    date,
    uptime_percent_30d: 0,
    uptime_percent_today: 0,
    latency_samples_ms: [],
    latency_mean_ms: null,
    latency_std_ms: null,
    latency_cv: null,
    download_samples_mbps: [],
    median_latency_ms: 999,
    median_download_mbps: 0,
    packet_loss_percent: 100,
    stable_days_streak: 0,
    is_stable_day: false,
    domain_ok: false,
    ssl_days_left: null,
    recent_complaints_count: 0,
    history_incidents: 0,
  };
}
