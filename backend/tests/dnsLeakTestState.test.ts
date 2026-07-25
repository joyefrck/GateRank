import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDnsResolverEvidenceRows,
  formatDnsAsnLabel,
  formatDnsCountryName,
  formatDnsLeakTestCopy,
  formatDnsQueryTypeLabel,
  resolveDnsLeakErrorMessage,
} from '../../src/pages/dnsLeakTest/dnsLeakTestState';
import type { DnsLeakTestResultResponse } from '../../shared/dnsLeakTest';

test('DNS resolver presentation localizes country, ASN, hits, and query types', () => {
  assert.equal(formatDnsCountryName('JP', 'Japan'), '日本');
  assert.equal(formatDnsCountryName('', 'Atlantis'), 'Atlantis');
  assert.equal(formatDnsCountryName('', ''), '地区未知');
  assert.equal(formatDnsAsnLabel('AS15169'), '自治系统编号 AS15169');
  assert.equal(formatDnsAsnLabel(''), '自治系统编号未知');
  assert.equal(formatDnsQueryTypeLabel('A'), 'A · IPv4 地址查询');
  assert.equal(formatDnsQueryTypeLabel('AAAA'), 'AAAA · IPv6 地址查询');
  assert.equal(formatDnsQueryTypeLabel('HTTPS'), 'HTTPS · HTTPS 服务参数查询');
  assert.equal(formatDnsQueryTypeLabel('TXT'), 'TXT · 其他 DNS 查询');

  const rows = buildDnsResolverEvidenceRows([
    {
      ip: '9.9.9.9',
      country: 'United States',
      country_code: 'US',
      isp: 'Quad9',
      organization: 'Quad9',
      asn: 'AS19281',
      dnssec_ok: true,
      query_types: ['A'],
      observation_count: 1,
    },
    {
      ip: '8.8.8.8',
      country: 'Japan',
      country_code: 'JP',
      isp: 'Google',
      organization: 'Google LLC',
      asn: 'AS15169',
      dnssec_ok: true,
      query_types: ['HTTPS', 'AAAA', 'A'],
      observation_count: 3,
    },
  ], 10);

  assert.deepEqual(rows[0], {
    ip: '8.8.8.8',
    location: '日本',
    network: 'Google LLC',
    asn: '自治系统编号 AS15169',
    asnValue: 'AS15169',
    observation: '命中 3/10 个测试域名',
    queryTypes: [
      'A · IPv4 地址查询',
      'AAAA · IPv6 地址查询',
      'HTTPS · HTTPS 服务参数查询',
    ],
  });
});

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
  assert.match(text, /8\.8\.8\.8 · 美国 · Google Public DNS · 自治系统编号 AS15169/);
  assert.match(text, /命中 10\/10 个测试域名/);
  assert.match(text, /A · IPv4 地址查询/);
  assert.match(text, /AAAA · IPv6 地址查询/);
  assert.match(text, /DoH：网页无法可靠判断/);
  assert.match(text, /不代表对 VPN 配置的绝对判定/);
});

test('DNS leak UI exposes stable messages for configuration and session failures', () => {
  assert.match(resolveDnsLeakErrorMessage('DNS_LEAK_TEST_NOT_CONFIGURED'), /尚未配置/);
  assert.match(resolveDnsLeakErrorMessage('DNS_LEAK_TEST_SESSION_NOT_FOUND'), /会话已过期/);
  assert.match(resolveDnsLeakErrorMessage('DNS_LEAK_TEST_RATE_LIMITED'), /过于频繁/);
});
