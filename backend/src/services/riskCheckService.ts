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
    const domainOk = await checkHttpOk(website);
    const sslDaysLeft = await getSslDaysLeft(website);

    await this.deps.metricsRepository.upsertDaily({
      ...base,
      airport_id: airportId,
      date,
      domain_ok: domainOk,
      ssl_days_left: sslDaysLeft,
    });

    return {
      domain_ok: domainOk,
      ssl_days_left: sslDaysLeft,
    };
  }
}

async function checkHttpOk(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'GateRank-Risk-Check/1.0' },
      signal: AbortSignal.timeout(8000),
    });
    return [200, 301, 302, 403].includes(response.status);
  } catch {
    return false;
  }
}

async function getSslDaysLeft(url: string): Promise<number | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') {
    return null;
  }

  const port = parsed.port ? Number(parsed.port) : 443;
  const host = parsed.hostname;
  return new Promise((resolve) => {
    const socket = tls.connect(
      {
        host,
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

    socket.setTimeout(8000);
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
