import type { Airport, DailyMetrics } from '../types/domain';
import type { WebsiteProbeResult } from '../../../shared/riskCheck';
import { WEBSITE_STATUS_LABELS } from '../../../shared/riskCheck';
import { probeWebsite, emptyProbeResult } from './websiteProbe';
export { probeWebsite } from './websiteProbe';

interface RiskCheckDeps {
  airportRepository: { getById(id: number): Promise<Airport | null> };
  metricsRepository: {
    getByAirportAndDate(airportId: number, date: string): Promise<DailyMetrics | null>;
    getLatestByAirportBeforeDate(airportId: number, date: string): Promise<DailyMetrics | null>;
  };
  riskCheckRepository: {
    save(airportId: number, date: string, result: WebsiteProbeResult, base: DailyMetrics | null): Promise<void>;
  };
  probe?: typeof probeWebsite;
}

export class RiskCheckService {
  constructor(private readonly deps: RiskCheckDeps) {}

  async inspectAirportForDate(airportId: number, date: string): Promise<{ domain_ok: boolean; ssl_days_left: number | null; summary: string }> {
    const airport = await this.deps.airportRepository.getById(airportId);
    if (!airport) throw new Error(`airport ${airportId} not found`);
    const [current, previous] = await Promise.all([
      this.deps.metricsRepository.getByAirportAndDate(airportId, date),
      this.deps.metricsRepository.getLatestByAirportBeforeDate(airportId, date),
    ]);
    const website = (airport.websites || []).find((item) => typeof item === 'string' && item.trim())?.trim()
      || airport.website?.trim() || '';
    let result: WebsiteProbeResult;
    try { result = await (this.deps.probe || probeWebsite)(website); }
    catch { result = { ...emptyProbeResult(), error_code: 'INTERNAL_ERROR' }; }
    await this.deps.riskCheckRepository.save(airportId, date, result, current || previous);
    const summary = `${WEBSITE_STATUS_LABELS[result.status]}${result.http_status ? `（HTTP ${result.http_status}）` : ''}`;
    if (result.domain_ok === null) throw new Error(`${summary}：${result.error_code || 'UNKNOWN_ERROR'}；已有风险指标未覆盖`);
    return { domain_ok: result.domain_ok, ssl_days_left: result.ssl_days_left, summary };
  }
}
