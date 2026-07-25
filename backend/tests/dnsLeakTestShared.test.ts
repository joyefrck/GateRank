import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessDnsLeak,
  deriveDnssecSignal,
  type DnsLeakResolverInfo,
} from '../../shared/dnsLeakTest';
import {
  buildDnsProbeHostname,
  signDnsProbeCallback,
  verifyDnsProbeCallback,
  verifyDnsProbeHostname,
} from '../src/utils/dnsLeakProbeToken';

const SESSION_SECRET = 'session-secret-at-least-thirty-two-characters';
const CALLBACK_SECRET = 'callback-secret-at-least-thirty-two-characters';
const SESSION_ID = '0123456789abcdef0123456789abcdef';
const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);

test('DNS probe hostnames round-trip and reject tampering or expiry', () => {
  const hostname = buildDnsProbeHostname({
    sessionId: SESSION_ID,
    probeIndex: 4,
    expiresAt: NOW + 120_000,
  }, 'dns-test.gate-rank.com', SESSION_SECRET);

  assert.deepEqual(verifyDnsProbeHostname(hostname, 'dns-test.gate-rank.com.', SESSION_SECRET, NOW), {
    sessionId: SESSION_ID,
    probeIndex: 4,
    expiresAt: NOW + 120_000,
  });
  assert.equal(verifyDnsProbeHostname(hostname.replace('.4.', '.5.'), 'dns-test.gate-rank.com', SESSION_SECRET, NOW), null);
  assert.equal(verifyDnsProbeHostname(hostname, 'dns-test.gate-rank.com', SESSION_SECRET, NOW + 121_000), null);
  assert.equal(verifyDnsProbeHostname(hostname, 'other.example.com', SESSION_SECRET, NOW), null);
});

test('DNS probe callback signatures enforce freshness and exact body integrity', () => {
  const timestamp = String(Math.floor(NOW / 1000));
  const body = JSON.stringify({ event_id: 'event-1', session_id: SESSION_ID });
  const signature = signDnsProbeCallback(body, timestamp, CALLBACK_SECRET);

  assert.equal(verifyDnsProbeCallback(body, timestamp, signature, CALLBACK_SECRET, NOW), true);
  assert.equal(verifyDnsProbeCallback(`${body} `, timestamp, signature, CALLBACK_SECRET, NOW), false);
  assert.equal(verifyDnsProbeCallback(body, timestamp, signature, CALLBACK_SECRET, NOW + 61_000), false);
});

test('DNS leak assessment reports matching, mismatching, and incomplete country evidence', () => {
  assert.deepEqual(assessDnsLeak('JP', [resolver('JP')]), {
    verdict: 'no_obvious_leak',
    country_consistency: 'matched',
  });
  assert.deepEqual(assessDnsLeak('JP', [resolver('JP'), resolver('US')]), {
    verdict: 'possible_leak',
    country_consistency: 'mismatched',
  });
  assert.deepEqual(assessDnsLeak('JP', [resolver('')]), {
    verdict: 'inconclusive',
    country_consistency: 'unknown',
  });
  assert.deepEqual(assessDnsLeak('', [resolver('JP')]), {
    verdict: 'inconclusive',
    country_consistency: 'unknown',
  });
});

test('DNSSEC signal reflects authoritative DO observations without overclaiming validation', () => {
  assert.equal(deriveDnssecSignal([]), 'unknown');
  assert.equal(deriveDnssecSignal([{ dnssec_ok: false }]), 'not_observed');
  assert.equal(deriveDnssecSignal([{ dnssec_ok: false }, { dnssec_ok: true }]), 'observed');
});

function resolver(countryCode: string): DnsLeakResolverInfo {
  return {
    ip: '8.8.8.8',
    country: countryCode ? 'Example' : '',
    country_code: countryCode,
    isp: 'Example DNS',
    organization: 'Example DNS',
    asn: 'AS64500',
    dnssec_ok: false,
    query_types: ['A'],
    observation_count: 1,
  };
}
