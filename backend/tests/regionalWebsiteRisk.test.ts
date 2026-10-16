import assert from 'node:assert/strict';
import test from 'node:test';
import { RiskCheckService } from '../src/services/riskCheckService';
import { emptyProbeResult } from '../src/services/websiteProbe';
import type { WebsiteProbeResult } from '../../shared/riskCheck';

const central = { ...emptyProbeResult('service_error'), domain_ok: false, http_status: 418, error_code: 'HTTP_418', ssl_days_left: 88 };
const regional = (location: string, status = 200): WebsiteProbeResult => ({ ...central,
  probe_location: location, status: status === 200 ? 'accessible' : 'service_error',
  http_status: status, domain_ok: status === 200, error_code: status === 200 ? null : `HTTP_${status}` });
async function inspect(result: WebsiteProbeResult, regions: WebsiteProbeResult[]) {
  let saved: WebsiteProbeResult | undefined;
  let dispatched = 0;
  const service = new RiskCheckService({
    airportRepository: { getById: async () => ({ id: 42, website: 'https://example.com/' }) },
    metricsRepository: { getByAirportAndDate: async () => null, getLatestByAirportBeforeDate: async () => null },
    riskCheckRepository: { save: async (_id: number, _date: string, value: WebsiteProbeResult) => { saved = value; } },
    probe: async () => result,
    regionalProbe: async () => { dispatched++; return regions; },
  } as never);
  let error: unknown;
  try { await service.inspectAirportForDate(42, '2026-10-17'); } catch (e) { error = e; }
  return { saved: saved!, dispatched, error };
}
test('a Shanghai 2xx overrides center 418 and retains both observations', async () => {
  const { saved, error } = await inspect(central, [regional('上海'), regional('广州', 418)]);
  assert.equal(error, undefined);
  assert.equal(saved.domain_ok, true);
  assert.equal(saved.probe_location, '上海');
  assert.equal(saved.http_status, 200);
  assert.equal(saved.error_code, null);
  assert.equal(saved.observations?.length, 3);
  assert.equal(saved.observations?.[0].http_status, 418);
});
test('a Guangzhou 2xx can recover when Shanghai fails', async () => {
  const { saved } = await inspect(central, [regional('上海', 503), regional('广州')]);
  assert.equal(saved.domain_ok, true);
  assert.equal(saved.probe_location, '广州');
});
test('confirmed failures from all sites preserve the center failure', async () => {
  const { saved } = await inspect(central, [regional('上海', 503), regional('广州', 418)]);
  assert.equal(saved.domain_ok, false);
  assert.equal(saved.observations?.length, 3);
});
test('no regional response does not apply a single-site failure', async () => {
  const { saved, error } = await inspect(central, []);
  assert.equal(saved.domain_ok, null);
  assert.equal(saved.error_code, 'REGIONAL_RECHECK_UNAVAILABLE');
  assert.ok(error);
});
test('a regional execution failure cannot confirm website failure', async () => {
  const { saved } = await inspect(central, [emptyProbeResult('internal_error')]);
  assert.equal(saved.domain_ok, null);
});
for (const result of [regional('中心 API 检测点'), emptyProbeResult('config_error')]) {
  test(`center ${result.status} does not dispatch regional work`, async () => {
    assert.equal((await inspect(result, [])).dispatched, 0);
  });
}
test('verified WAF response does not become an origin failure when regions cannot respond', async () => {
  const result = { ...central, status: 'waf_challenge' as const, domain_ok: true, error_code: null };
  const { saved, dispatched } = await inspect(result, []);
  assert.equal(dispatched, 1);
  assert.equal(saved.domain_ok, true);
  assert.equal(saved.status, 'waf_challenge');
});
test('regional WAF evidence is accepted while retaining center generic 418', async () => {
  const result = { ...regional('上海', 418), status: 'waf_challenge' as const, domain_ok: true, error_code: null };
  const { saved } = await inspect(central, [result]);
  assert.equal(saved.domain_ok, true);
  assert.equal(saved.status,'waf_challenge');
});
test('a regional HTTP success cannot erase known center certificate expiry', async () => {
  const expired = { ...central, ssl_days_left: -2, tls_authorized: false, ssl_target_url: 'https://example.com/' };
  const remote = { ...regional('上海'), ssl_days_left: null, tls_authorized: null, ssl_target_url: 'https://example.com/' };
  const { saved } = await inspect(expired, [remote]);
  assert.equal(saved.domain_ok,true);
  assert.equal(saved.ssl_days_left,-2);
  assert.equal(saved.ssl_probe_location,'中心 API 检测点');
  assert.equal(saved.observations?.[1].ssl_days_left,null);
});
for (const status of ['challenge','restricted','tls_only'] as const) {
  test(`regional ${status} retains existing domain-reachability semantics`, async () => {
    const remote = { ...regional('上海'),status,domain_ok:true,http_status:status === 'tls_only' ? null : 403 };
    const { saved } = await inspect(central,[remote]);
    assert.equal(saved.domain_ok,true);
    assert.equal(saved.status,status);
  });
}
