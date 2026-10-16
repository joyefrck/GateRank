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
  regionalProbe?: (airportId: number, website: string) => Promise<WebsiteProbeResult[]>;
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
    if ((result.domain_ok === false || result.status === 'waf_challenge') && this.deps.regionalProbe) {
      let regions: WebsiteProbeResult[] = [];
      try { regions = await this.deps.regionalProbe(airportId, website); } catch { /* Preserve diagnostic without applying a single-site failure. */ }
      const observations = [result, ...regions].map(({ observations: _nested, ...observation }) => observation);
      const recovered = regions.find((item) => item.status === 'accessible' && item.domain_ok === true)
        || [result, ...regions].find((item) => item.status === 'waf_challenge' && item.domain_ok === true)
        || regions.find((item) => item.domain_ok === true);
      if (recovered) {
        const certificate = recovered.ssl_days_left === null && result.ssl_days_left !== null
          && result.ssl_target_url !== null && result.ssl_target_url === recovered.ssl_target_url
          ? { ssl_days_left: result.ssl_days_left, tls_authorized: result.tls_authorized,
            ssl_target_url: result.ssl_target_url, ssl_probe_location: result.probe_location } : {};
        result = { ...recovered, ...certificate, observations };
      }
      else if (regions.length === 2 && regions.every((item) => item.domain_ok === false)) result = { ...result, observations };
      else result = { ...result, domain_ok: null, status: 'internal_error', error_code: 'REGIONAL_RECHECK_UNAVAILABLE', observations };
    }
    await this.deps.riskCheckRepository.save(airportId, date, result, current || previous);
    const summary = `${WEBSITE_STATUS_LABELS[result.status]}${result.http_status ? `（HTTP ${result.http_status}）` : ''}`;
    if (result.domain_ok === null) throw new Error(`${summary}：${result.error_code || 'UNKNOWN_ERROR'}；已有风险指标未覆盖`);
    return { domain_ok: result.domain_ok, ssl_days_left: result.ssl_days_left, summary };
  }
}
