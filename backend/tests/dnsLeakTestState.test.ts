import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDnsLeakTestCopy, resolveDnsLeakErrorMessage } from '../../src/pages/dnsLeakTest/dnsLeakTestState';
import type { DnsLeakTestResultResponse } from '../../shared/dnsLeakTest';

test('DNS leak copy output keeps evidence and capability boundaries explicit', () => {
  const result: DnsLeakTestResultResponse = {
    status: 'complete',
    checked_at: '2026-07-25T12:00:08.000Z',
    observed_probe_count: 10,
    total_probes: 10,
    network: {
      ip: '9.9.9.9',
      country: 'United States',
      country_code: 'US',
      isp: 'Quad9',
      organization: 'Quad9',
      asn: 'AS19281',
    },
    resolvers: [{
      ip: '8.8.8.8',
      country: 'United States',
      country_code: 'US',
      isp: 'Google',
      organization: 'Google Public DNS',
      asn: 'AS15169',
      dnssec_ok: true,
      query_types: ['A', 'AAAA'],
      observation_count: 10,
    }],
    verdict: 'no_obvious_leak',
    country_consistency: 'matched',
    dnssec_signal: 'observed',
    doh: 'not_detectable',
    dot: 'not_detectable',
  };

  const text = formatDnsLeakTestCopy(result);
  assert.match(text, /未发现明显异常/);
  assert.match(text, /8\.8\.8\.8 · United States · Google Public DNS · AS15169/);
  assert.match(text, /DoH：网页无法可靠判断/);
  assert.match(text, /不代表对 VPN 配置的绝对判定/);
});

test('DNS leak UI exposes stable messages for configuration and session failures', () => {
  assert.match(resolveDnsLeakErrorMessage('DNS_LEAK_TEST_NOT_CONFIGURED'), /尚未配置/);
  assert.match(resolveDnsLeakErrorMessage('DNS_LEAK_TEST_SESSION_NOT_FOUND'), /会话已过期/);
  assert.match(resolveDnsLeakErrorMessage('DNS_LEAK_TEST_RATE_LIMITED'), /过于频繁/);
});
