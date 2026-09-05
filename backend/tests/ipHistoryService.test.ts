import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IpHistoryService, parseRoutingHistory, parseAllocationHistory, parseOrganizationRecords } from '../src/services/ipHistoryService';
const ip = '162.225.42.226';
const timelines = [{ starttime: '2013-05-22T00:00:00', endtime: '2026-09-03T00:00:00' }];
test('routing retains historical origins, latest state and validates subnet membership', () => {
  const rows = parseRoutingHistory({ query_endtime: '2026-09-03T00:00:00', by_origin: [
    { origin: '7018', prefixes: [{ prefix: '162.224.0.0/12', timelines }] },
    { origin: '3352', prefixes: [{ prefix: '162.0.0.0/7', timelines: [{ starttime: '2007-01-01', endtime: '2007-02-01' }] }] },
    { origin: '123', prefixes: [{ prefix: '8.8.8.0/24', timelines }] },
  ] }, ip);
  assert.equal(rows.length, 2); assert.equal(rows[0].active, true); assert.equal(rows[1].active, false);
  assert.equal(rows[0].first_seen, '2013-05-22T00:00:00.000Z');
});
test('allocation ignores IANA aggregate and never copies current country into history', () => {
  const rows = parseAllocationHistory({ query_endtime: '2026-09-03T00:00:00', results: { ARIN: [{ resource: '162.224.0.0-162.239.255.255', timelines }], IANA: [{ resource: '162.0.0.0/8', timelines }] } }, ip);
  assert.equal(rows.length, 1); assert.equal(rows[0].country, null); assert.equal(rows[0].active, true);
});
test('IPv6 membership and malformed timeline handling', () => {
  const rows = parseRoutingHistory({ by_origin: [{ origin: '15169', prefixes: [{ prefix: '2001:4860::/32', timelines }, { prefix: '2606:4700::/32', timelines }, { prefix: '2001:4860::/32', timelines: [{ starttime: 'bad', endtime: 'bad' }] }] }] }, '2001:4860:4860::8888');
  assert.equal(rows.length, 1); assert.equal(rows[0].active, null);
});
test('organization only exposes network fields; dates are not invented', () => {
  const rows = parseOrganizationRecords({ records: [
    [{ key: 'CIDR', value: '162.224.0.0/12' }, { key: 'Organization', value: 'AT&amp;T' }, { key: 'RegDate', value: '2013-05-21' }, { key: 'Email', value: 'private@example.com' }],
    [{ key: 'OrgName', value: 'contact only' }],
  ] }, ip);
  assert.equal(rows.length, 1); assert.equal(rows[0].name, 'AT&T'); assert.equal(rows[0].last_seen, null);
  assert.ok(!JSON.stringify(rows).includes('private@example.com'));
});
test('lookup caches, merges concurrent requests, and independently degrades failed sources', async () => {
  let calls = 0;
  const service = new IpHistoryService(async url => {
    calls++; if (String(url).includes('/whois/')) return new Response('', { status: 503 });
    return Response.json({ status: 'ok', data: {} });
  });
  const [first, second] = await Promise.all([service.lookup(ip), service.lookup(ip)]);
  assert.equal(calls, 3); assert.deepEqual(first, second); assert.deepEqual(first.errors, ['whois']);
  assert.equal((await service.lookup(ip)).cached, true); assert.equal(calls, 3);
  await assert.rejects(service.lookup('127.0.0.1')); assert.equal(calls, 3);
});
test('timeout releases lookup and reports unavailable sections', async () => {
  const service = new IpHistoryService(async (_url, options) => new Promise<Response>((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('aborted')))), Date.now, 5);
  assert.equal((await service.lookup(ip)).errors.length, 3);
});

test('ASN country validates identity, excludes unknown and rejects contradictory countries', async () => {
  const { parseAsnCountry } = await import('../src/services/ipHistoryService');
  const data = { resource: '7018', rirs: [{ resource: '7018', status: 'ASSIGNED', country: 'US' }] };
  assert.equal(parseAsnCountry(data, 'AS7018'), 'US');
  assert.equal(parseAsnCountry(data, 'AS9498'), null);
  assert.equal(parseAsnCountry({ ...data, rirs: [...data.rirs, { ...data.rirs[0], country: 'IN' }] }, 'AS7018'), null);
});
test('enterprise country is joined by organization identity and registry, never unrelated contacts', () => {
  const records = [
    [{ key: 'CIDR', value: '162.224.0.0/12' }, { key: 'Organization', value: 'AT&T (AEL-360)' }, { key: 'source', value: 'ARIN' }],
    [{ key: 'OrgId', value: 'OTHER' }, { key: 'Country', value: 'GB' }, { key: 'source', value: 'ARIN' }],
    [{ key: 'OrgId', value: 'AEL-360' }, { key: 'Country', value: 'US' }, { key: 'source', value: 'ARIN' }],
  ];
  assert.equal(parseOrganizationRecords({ records }, ip)[0].country, 'US');
  assert.equal(parseOrganizationRecords({ records: records.slice(0, 2) }, ip)[0].country, null);
});
test('lookup enriches each historical ASN using its own current registration country', async () => {
  const service = new IpHistoryService(async input => {
    const url = new URL(String(input));
    if (url.pathname.includes('/routing-history/')) return Response.json({ status: 'ok', data: { by_origin: ['7018', '9498'].map(origin => ({ origin, prefixes: [{ prefix: '162.224.0.0/12', timelines }] })) } });
    if (url.pathname.includes('/rir/')) {
      const asn = url.searchParams.get('resource')!.replace('AS', '');
      return Response.json({ status: 'ok', data: { resource: asn, rirs: [{ resource: asn, status: 'ASSIGNED', country: asn === '7018' ? 'US' : 'IN' }] } });
    }
    return Response.json({ status: 'ok', data: {} });
  });
  const result = await service.lookup(ip);
  assert.deepEqual(result.asn.map(row => row.country), ['US', 'IN']);
});

test('allocation country matches the exact range, registry and historical snapshot', async () => {
  const { parseAllocationCountry } = await import('../src/services/ipHistoryService');
  const row = parseAllocationHistory({ results: { ARIN: [{ resource: '162.224.0.0-162.239.255.255', timelines }] } }, ip)[0];
  const record = { rir: 'ARIN', resource: '162.224.0.0/12', status: 'ALLOCATED', country: 'US', first_time: '2026-09-03', last_time: '2026-09-03' };
  assert.equal(parseAllocationCountry({ rirs: [record] }, row), 'US');
  for (const change of [{ rir: 'APNIC' }, { resource: '162.0.0.0/8' }, { first_time: '2026-09-04' }, { last_time: '2026-09-02' }]) {
    assert.equal(parseAllocationCountry({ rirs: [{ ...record, ...change }] }, row), null);
  }
  assert.equal(parseAllocationCountry({ rirs: [record, { ...record, country: 'GB' }] }, row), null);
  assert.equal(parseAllocationCountry({ rirs: [{ ...record, resource: '2001:4860::/32' }] }, { ...row, resource: '2001:4860:0:0:0:0:0:0-2001:4860:ffff:ffff:ffff:ffff:ffff:ffff' }), 'US');
});
test('allocation enrichment queries the historical day and keeps dates unchanged', async () => {
  const service = new IpHistoryService(async input => {
    const url = new URL(String(input));
    if (url.pathname.includes('/allocation-history/')) return Response.json({ status: 'ok', data: { results: { ARIN: [{ resource: '162.224.0.0-162.239.255.255', timelines }] } } });
    if (url.pathname.includes('/rir/')) {
      assert.equal(url.searchParams.get('starttime'), '2026-09-03T00:00:00');
      assert.equal(url.searchParams.get('endtime'), '2026-09-03T00:00:00');
      return Response.json({ status: 'ok', data: { rirs: [{ rir: 'ARIN', resource: '162.224.0.0/12', status: 'ALLOCATED', country: 'US', first_time: '2026-09-03', last_time: '2026-09-03' }] } });
    }
    return Response.json({ status: 'ok', data: {} });
  });
  const result = await service.lookup(ip);
  assert.equal(result.allocations[0].country, 'US');
  assert.equal(result.allocations[0].first_seen, '2013-05-22T00:00:00.000Z');
});
