import test from 'node:test';
import assert from 'node:assert/strict';
import { IpPurityService, normalizePurityIp } from '../src/services/ipPurityService';
import { riskLevel } from '../../shared/ipPurity';
import type { IpCheckResult } from '../../shared/ipCheck';

const geoService = { lookup: async (ip: string) => ({ ip, country: 'US' } as IpCheckResult) };
const response = (risk: unknown = 0, extra = {}, ip = '8.8.8.8') => Response.json({ status: 'ok', [ip]: { detections: { risk, proxy: false, vpn: true, ...extra }, operator: { secret_unused_field: 'not forwarded' } } });

test('validates public IP only and canonicalizes IPv6', () => {
  assert.equal(normalizePurityIp(' 8.8.8.8 '), '8.8.8.8');
  assert.equal(normalizePurityIp('2606:4700:0000:0000:0000:0000:0000:1111'), '2606:4700::1111');
  for (const invalid of ['localhost', 'example.com', '10.0.0.1', '127.0.0.1', '2001:0db8::1', '::2', '::ffff:8.8.8.8', 'https://8.8.8.8', '8.8.8.8,1.1.1.1', null]) assert.throws(() => normalizePurityIp(invalid));
});
test('preserves zero, false, unknown signals and only returns selected data', async () => {
  const service = new IpPurityService({ geoService, fetchImpl: async () => response() });
  const data = await service.lookup('8.8.8.8');
  assert.equal(data.risk?.score, 0);
  assert.equal(data.risk?.proxy, false);
  assert.equal(data.risk?.vpn, true);
  assert.equal(data.risk?.tor, null);
  assert.equal(data.risk?.hosting, null);
  assert.equal(JSON.stringify(data).includes('secret_unused_field'), false);
  assert.deepEqual(riskLevel(null), { label: '暂无评分', tone: 'unknown' });
  assert.equal(riskLevel(0).tone, 'low');
  assert.equal(riskLevel(25).tone, 'low');
  assert.equal(riskLevel(26).tone, 'medium');
  assert.equal(riskLevel(51).tone, 'high');
});
test('does not coerce missing, malformed or out-of-range risk to low risk', async () => {
  for (const value of [null, '', '0', -1, 101]) {
    const result = await new IpPurityService({ geoService, fetchImpl: async () => response(value, { proxy: 'false' }) }).lookup('8.8.8.8');
    assert.equal(result.risk?.score, null);
    assert.equal(result.risk?.proxy, null);
  }
});
test('deduplicates in-flight queries, caches without mutation and expires by timestamp', async () => {
  let calls = 0; let now = Date.UTC(2026, 8, 5);
  const service = new IpPurityService({ geoService, now: () => now, cacheTtlMs: 100, fetchImpl: async () => { calls++; return response(); } });
  const [a, b] = await Promise.all([service.lookup('8.8.8.8'), service.lookup('8.8.8.8')]);
  a.risk!.score = 99;
  assert.equal(b.risk!.score, 0);
  assert.equal(calls, 1);
  const cached = await service.lookup('8.8.8.8');
  assert.equal(cached.risk?.cached, true);
  assert.equal(cached.risk?.score, 0);
  now += 101;
  assert.equal((await service.lookup('8.8.8.8')).risk?.cached, false);
  assert.equal(calls, 2);
});
test('budget stops new upstream requests but preserves cached results and resets next UTC day', async () => {
  let calls = 0; let now = Date.UTC(2026, 8, 5);
  const service = new IpPurityService({ geoService, now: () => now, dailyLimit: 1, fetchImpl: async () => { calls++; return response(); } });
  await service.lookup('8.8.8.8');
  assert.equal((await service.lookup('1.1.1.1')).risk_error, 'quota');
  assert.equal((await service.lookup('8.8.8.8')).risk?.cached, true);
  assert.equal(calls, 1);
  now += 86400000;
  assert.equal((await service.lookup('8.8.8.8')).risk_error, null);
  assert.equal(calls, 2);
});
test('upstream failures are partial results and errors are not cached', async () => {
  let calls = 0;
  const service = new IpPurityService({ geoService, fetchImpl: async () => ++calls === 1 ? new Response('invalid', { status: 502 }) : response() });
  const first = await service.lookup('8.8.8.8');
  assert.equal(first.risk_error, 'unavailable');
  assert.equal(first.geo?.ip, '8.8.8.8');
  assert.equal((await service.lookup('8.8.8.8')).risk_error, null);
});
test('timeout and quota are explicit and risk survives a geolocation failure', async () => {
  const timeout = new IpPurityService({ geoService, timeoutMs: 100, fetchImpl: async (_url, options) => new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted')))) });
  assert.equal((await timeout.lookup('8.8.8.8')).risk_error, 'timeout');
  const quota = new IpPurityService({ geoService, fetchImpl: async () => new Response('', { status: 429 }) });
  assert.equal((await quota.lookup('8.8.8.8')).risk_error, 'quota');
  const noGeo = new IpPurityService({ geoService: { lookup: async () => { throw new Error('geo failed'); } }, fetchImpl: async () => response() });
  const result = await noGeo.lookup('8.8.8.8');
  assert.equal(result.geo, null); assert.equal(result.risk?.score, 0);
});
test('unexpected, cross-IP and error payloads never become successful scores', async () => {
  for (const data of [null, [], { status: 'ok' }, { status: 'error' }, { status: 'ok', '1.1.1.1': { detections: { risk: 0 } } }]) {
    const service = new IpPurityService({ geoService, fetchImpl: async () => Response.json(data) });
    assert.equal((await service.lookup('8.8.8.8')).risk_error, 'unavailable');
  }
});
test('secret key remains upstream-only and IPv6 keys compare canonically', async () => {
  let url = '';
  const service = new IpPurityService({ geoService, apiKey: 'test-only-key', fetchImpl: async (input) => { url = String(input); return response(25, {}, '2606:4700:0:0:0:0:0:1111'); } });
  const result = await service.lookup('2606:4700::1111');
  assert.equal(result.risk?.score, 25);
  assert.equal(new URL(url).searchParams.get('key'), 'test-only-key');
  assert.equal(JSON.stringify(result).includes('test-only-key'), false);
});
