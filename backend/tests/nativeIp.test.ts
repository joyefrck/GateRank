import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeIpService, parseRegistryEvidence } from '../src/services/nativeIpService';
import { nativeIpAssessment, type NativeIpResult } from '../../shared/nativeIp';
import { IpPurityService } from '../src/services/ipPurityService';
import type { IpCheckResult } from '../../shared/ipCheck';
const ip = '162.225.42.226';
const registry = { resource: `${ip}/32`, latest: '2026-09-03T00:00:00', rirs: [{ resource: '162.224.0.0/12', country: 'US', status: 'ALLOCATED', rir: 'ARIN' }] };
const fixtureFetch: typeof fetch = async (input) => String(input).includes('ipok.io') ? Response.json({ geo: { ip }, nativeType: 'unknown', fetchedAt: '2026-09-04T00:00:00Z', upstream: 'cached-only' }) : Response.json({ status: 'ok', data: registry });

test('real source shapes produce registry evidence and explicitly qualified native tendency', async () => {
  const service = new NativeIpService({ fetchImpl: fixtureFetch });
  const evidence = await service.lookup(ip);
  assert.equal(evidence.provider_type, 'unknown');
  assert.equal(evidence.registered_country, 'US');
  assert.equal(evidence.prefix, '162.224.0.0/12');
  assert.equal(evidence.provider_cached_only, true);
  assert.equal(nativeIpAssessment({ ...evidence, location_country: 'US' }).label, '原生 IP');
  assert.equal(nativeIpAssessment({ ...evidence, location_country: 'JP' }).label, '广播 IP');
  assert.equal(nativeIpAssessment({ ...evidence, location_country: null }).label, '证据不足');
});
test('direct verdict, unknown and contradictory sources remain distinct', async () => {
  const evidence = await new NativeIpService({ fetchImpl: fixtureFetch }).lookup(ip);
  const result: NativeIpResult = { ...evidence, location_country: 'US', provider_type: 'native' };
  assert.equal(nativeIpAssessment(result).label, '原生 IP');
  assert.equal(nativeIpAssessment({ ...result, provider_type: 'broadcast' }).label, '数据源存在分歧');
  assert.equal(nativeIpAssessment({ ...result, location_country: 'JP' }).label, '数据源存在分歧');
  assert.match(nativeIpAssessment({ ...result, provider_type: 'broadcast', location_country: 'JP' }).label, /广播 IP/);
  assert.equal(nativeIpAssessment(null).label, '暂时无法判定');
});
test('registry selects most specific containing allocation and rejects unrelated or conflicting countries', () => {
  assert.equal(parseRegistryEvidence({ ...registry, rirs: [...registry.rirs, { resource: `${ip}/32`, country: 'JP', status: 'ASSIGNED', rir: 'ARIN' }] }, ip).registered_country, 'JP');
  assert.equal(parseRegistryEvidence({ ...registry, rirs: [{ resource: '8.8.8.0/24', country: 'US', status: 'ALLOCATED' }] }, ip).registered_country, null);
  assert.equal(parseRegistryEvidence({ ...registry, rirs: [...registry.rirs, { ...registry.rirs[0], country: 'JP' }] }, ip).registered_country, null);
  assert.equal(parseRegistryEvidence({ rirs: [{ resource: '2606:4700::/32', country: 'US', status: 'ALLOCATED' }] }, '2606:4700:4700::1111').registered_country, 'US');
});
test('unknown and invalid provider payloads never turn into native tags', async () => {
  for (const payload of [{ nativeType: 'native', geo: { ip: '8.8.8.8' } }, { nativeType: true, geo: { ip } }, null]) {
    const service = new NativeIpService({ fetchImpl: async (url, init) => String(url).includes('ipok.io') ? Response.json(payload) : fixtureFetch(url, init) });
    const evidence = await service.lookup(ip);
    assert.equal(evidence.provider_type, null); assert.equal(evidence.ipok_error, 'unavailable');
    assert.equal(evidence.registered_country, 'US');
  }
});
test('provider quota and independent caches preserve registry lookup', async () => {
  let requests = 0; let time = Date.UTC(2026, 8, 5);
  const service = new NativeIpService({ ipokDailyLimit: 1, now: () => time, fetchImpl: async (url, init) => { requests++; return fixtureFetch(url, init); } });
  const first = await service.lookup(ip);
  const cached = await service.lookup(ip);
  assert.equal(requests, 2); assert.equal(cached.cached, true); assert.equal(cached.checked_at, first.checked_at);
  time += 3600001;
  const exhausted = await service.lookup(ip);
  assert.equal(exhausted.ipok_error, 'quota'); assert.equal(exhausted.registered_country, 'US'); assert.equal(requests, 2);
  time += 86400000;
  assert.equal((await service.lookup(ip)).ipok_error, null); assert.equal(requests, 4);
});
test('timeout and 429 are explicit and do not erase independent evidence', async () => {
  const service = new NativeIpService({ timeoutMs: 10, fetchImpl: async (url, init) => String(url).includes('ipok.io') ? new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('abort')))) : fixtureFetch(url, init) });
  const result = await service.lookup(ip);
  assert.equal(result.ipok_error, 'timeout'); assert.equal(result.registered_country, 'US');
  const limited = new NativeIpService({ fetchImpl: async () => new Response('', { status: 429, headers: { 'retry-after': '60' } }) });
  assert.equal((await limited.lookup(ip)).registry_error, 'quota');
});
test('purity API combines native evidence with geolocation, independently from risk score', async () => {
  const service = new IpPurityService({ geoService: { lookup: async () => ({ ip, country_code: 'US' } as IpCheckResult) }, nativeService: new NativeIpService({ fetchImpl: fixtureFetch }), fetchImpl: async () => Response.json({ status: 'ok', [ip]: { detections: { risk: 100 } } }) });
  const result = await service.lookup(ip);
  assert.equal(result.native?.registered_country, 'US'); assert.equal(result.risk?.score, 100);
  assert.match(nativeIpAssessment(result.native).label, /原生 IP/);
});
