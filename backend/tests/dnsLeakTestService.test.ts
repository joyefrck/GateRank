import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DnsLeakTestService,
  DnsLeakTestServiceError,
} from '../src/services/dnsLeakTestService';
import {
  canonicalizeDnsLeakObservation,
  signDnsProbeCallback,
} from '../src/utils/dnsLeakProbeToken';
import type { DnsLeakObservation } from '../../shared/dnsLeakTest';
import type { IpCheckResult } from '../../shared/ipCheck';

const SESSION_SECRET = 'session-secret-at-least-thirty-two-characters';
const CALLBACK_SECRET = 'callback-secret-at-least-thirty-two-characters';
const SESSION_ID = '0123456789abcdef0123456789abcdef';
const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);

test('creates ten signed probe hosts and completes with deduplicated resolver evidence', async () => {
  let now = NOW;
  const service = createService(() => now);
  const started = await service.createSession('203.0.113.10');

  assert.equal(started.session_id, SESSION_ID);
  assert.equal(started.probe_hosts.length, 10);
  assert.equal(new Set(started.probe_hosts).size, 10);
  assert.ok(started.probe_hosts.every((host) => host.endsWith('.dns-test.gate-rank.com')));

  record(service, observation('event-one', 0, '8.8.8.8', true), now);
  record(service, observation('event-two', 0, '8.8.8.8', false), now);
  record(service, observation('event-three', 1, '1.1.1.1', false), now);

  let result = await service.getResult(SESSION_ID, '203.0.113.10');
  assert.equal(result.status, 'running');
  assert.equal(result.observed_probe_count, 2);
  assert.equal(result.resolvers.length, 2);
  assert.equal(result.resolvers.find((resolver) => resolver.ip === '8.8.8.8')?.observation_count, 1);
  assert.equal(result.dnssec_signal, 'observed');
  assert.equal(result.verdict, 'possible_leak');
  assert.equal(result.country_consistency, 'mismatched');

  now += 8_001;
  result = await service.getResult(SESSION_ID, '203.0.113.10');
  assert.equal(result.status, 'complete');
});

test('returns inconclusive after the deadline when no authoritative queries arrive', async () => {
  let now = NOW;
  const service = createService(() => now);
  await service.createSession('203.0.113.10');
  now += 8_001;

  const result = await service.getResult(SESSION_ID, '203.0.113.10');
  assert.equal(result.status, 'inconclusive');
  assert.equal(result.verdict, 'inconclusive');
  assert.equal(result.dnssec_signal, 'unknown');
});

test('binds result polling to the visitor and removes expired sessions', async () => {
  let now = NOW;
  const service = createService(() => now);
  await service.createSession('203.0.113.10');

  await assert.rejects(
    service.getResult(SESSION_ID, '203.0.113.11'),
    hasServiceCode('DNS_LEAK_TEST_SESSION_NOT_FOUND', 404),
  );
  now += 120_001;
  await assert.rejects(
    service.getResult(SESSION_ID, '203.0.113.10'),
    hasServiceCode('DNS_LEAK_TEST_SESSION_NOT_FOUND', 404),
  );
});

test('rejects invalid callback signatures, private resolver IPs, and replayed events', async () => {
  const service = createService(() => NOW);
  await service.createSession('203.0.113.10');
  const valid = observation('event-valid', 0, '8.8.8.8', false);
  const timestamp = String(Math.floor(NOW / 1000));

  assert.throws(
    () => service.recordObservation(valid, timestamp, '0'.repeat(64)),
    hasServiceCode('DNS_LEAK_TEST_INVALID_SIGNATURE', 401),
  );

  const invalidIp = observation('event-private', 0, '192.168.1.1', false);
  assert.throws(
    () => record(service, invalidIp, NOW),
    hasServiceCode('DNS_LEAK_TEST_INVALID_OBSERVATION', 400),
  );

  record(service, valid, NOW);
  assert.throws(
    () => record(service, valid, NOW),
    hasServiceCode('DNS_LEAK_TEST_REPLAYED_OBSERVATION', 409),
  );
});

test('stays explicitly unconfigured when required probe settings are absent', async () => {
  const service = new DnsLeakTestService({
    ipCheckService: { lookup: async () => ipResult('8.8.8.8', 'US') },
  });
  assert.equal(service.isConfigured(), false);
  await assert.rejects(
    service.createSession('203.0.113.10'),
    hasServiceCode('DNS_LEAK_TEST_NOT_CONFIGURED', 503),
  );
});

function createService(now: () => number): DnsLeakTestService {
  return new DnsLeakTestService({
    ipCheckService: {
      lookup: async (ip) => ip === '1.1.1.1'
        ? ipResult(ip, 'AU')
        : ipResult(ip, 'US'),
    },
    zone: 'dns-test.gate-rank.com',
    sessionSecret: SESSION_SECRET,
    callbackSecret: CALLBACK_SECRET,
    now,
    createSessionId: () => SESSION_ID,
  });
}

function record(service: DnsLeakTestService, value: DnsLeakObservation, now: number): void {
  const body = canonicalizeDnsLeakObservation(value);
  const timestamp = String(Math.floor(now / 1000));
  service.recordObservation(value, timestamp, signDnsProbeCallback(body, timestamp, CALLBACK_SECRET));
}

function observation(
  eventId: string,
  probeIndex: number,
  resolverIp: string,
  dnssecOk: boolean,
): DnsLeakObservation {
  return {
    event_id: eventId,
    session_id: SESSION_ID,
    probe_index: probeIndex,
    resolver_ip: resolverIp,
    query_type: 'A',
    dnssec_ok: dnssecOk,
    observed_at: new Date(NOW).toISOString(),
  };
}

function ipResult(ip: string, countryCode: string): IpCheckResult {
  return {
    ip,
    country: countryCode === 'AU' ? 'Australia' : 'United States',
    country_code: countryCode,
    region: '',
    region_name: '',
    city: '',
    postal_code: '',
    latitude: 0,
    longitude: 0,
    timezone: '',
    isp: countryCode === 'AU' ? 'Cloudflare' : 'Example Network',
    organization: countryCode === 'AU' ? 'Cloudflare, Inc.' : 'Example Network',
    asn: countryCode === 'AU' ? 'AS13335' : 'AS64500',
  };
}

function hasServiceCode(code: string, status: number) {
  return (error: unknown) => {
    assert.ok(error instanceof DnsLeakTestServiceError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  };
}
