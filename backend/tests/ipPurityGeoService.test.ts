import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IpPurityGeoService, parseFreeIpApi } from '../src/services/ipPurityGeoService';
import { ipLocationDisplay, ipProviderBrand } from '../../shared/ipLocationDisplay';
const ip = '174.137.48.247';
const body = { ipAddress: ip, countryCode: 'US', countryName: 'United States', cityName: 'Fremont', regionName: 'California', regionCode: 'CA', latitude: 37.5148, longitude: -121.913, asn: '25820', asnOrganization: 'IT7 Networks Inc', timeZones: ['America/Adak', 'America/Los_Angeles'] };
const geo = parseFreeIpApi(body, ip, '2026-09-05T00:00:00Z');
test('uses returned city, formats Chinese and verified brand, does not guess timezone', () => {
  assert.equal(ipLocationDisplay(geo), '美国 · 加利福尼亚州 · 弗里蒙特');
  assert.equal(ipProviderBrand(geo), '搬瓦工（BandwagonHost）');
  assert.equal(ipProviderBrand({ ...geo, asn: 'AS123' }), null);
  assert.equal(ipProviderBrand({ ...geo, isp: 'Other network' }), null);
  assert.equal(geo.timezone, '');
  assert.equal(ipLocationDisplay({ ...geo, city: 'Unknown City' }), '美国 · 加利福尼亚州 · Unknown City');
});
test('rejects wrong target, missing city and invalid coordinates', () => {
  for (const patch of [{ ipAddress: '8.8.8.8' }, { cityName: '' }, { latitude: 91 }, { longitude: null }, { countryCode: 'ZZ' }]) assert.throws(() => parseFreeIpApi({ ...body, ...patch }, ip, 'now'));
  assert.equal(parseFreeIpApi({ ...body, ipAddress: '2606:4700:0:0:0:0:0:1111' }, '2606:4700::1111', 'now').ip, '2606:4700::1111');
});
test('caches successes and coalesces queries without calling fallback', async () => {
  let calls = 0;
  const service = new IpPurityGeoService({ lookup: async () => { throw new Error('fallback should not run'); } }, async () => { calls++; return Response.json(body); });
  const [a, b] = await Promise.all([service.lookup(ip), service.lookup(ip)]);
  assert.equal(a.source, 'FreeIPAPI'); assert.deepEqual(a, b); assert.equal(calls, 1);
  assert.equal((await service.lookup(ip)).cached, true); assert.equal(calls, 1);
  await assert.rejects(service.lookup('127.0.0.1')); assert.equal(calls, 1);
});
test('429 triggers fallback and suppresses subsequent upstream requests', async () => {
  let calls = 0;
  const service = new IpPurityGeoService({ lookup: async value => ({ ...geo, ip: value, city: 'San Francisco' }) }, async () => { calls++; return new Response('', { status: 429 }); });
  const result = await service.lookup(ip);
  assert.equal(result.source, 'ipwho.is'); assert.equal(result.city, 'San Francisco');
  await service.lookup('8.8.8.8'); assert.equal(calls, 1);
});
test('timeout and invalid successful responses use fallback', async () => {
  const fallback = { lookup: async () => geo };
  const timeout = new IpPurityGeoService(fallback, async (_url, options) => new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('abort')))), Date.now, 5);
  assert.equal((await timeout.lookup(ip)).source, 'ipwho.is');
  const invalid = new IpPurityGeoService(fallback, async () => Response.json({ ...body, ipAddress: '8.8.8.8' }));
  assert.equal((await invalid.lookup(ip)).source, 'ipwho.is');
});
test('fallback cache expires early and primary can recover', async () => {
  let now = 100000; let calls = 0;
  const service = new IpPurityGeoService({ lookup: async () => geo }, async () => ++calls === 1 ? new Response('', { status: 503 }) : Response.json(body), () => now);
  assert.equal((await service.lookup(ip)).source, 'ipwho.is');
  now += 61000;
  assert.equal((await service.lookup(ip)).source, 'FreeIPAPI');
});
