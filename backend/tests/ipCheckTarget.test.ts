import test from 'node:test';
import assert from 'node:assert/strict';
import { isPublicIpAddress, normalizeIpCheckTarget } from '../src/utils/ipCheckTarget';

test('normalizes public IP addresses and domains', () => {
  assert.equal(normalizeIpCheckTarget(' 8.8.8.8 '), '8.8.8.8');
  assert.equal(normalizeIpCheckTarget('2001:4860:4860::8888'), '2001:4860:4860::8888');
  assert.equal(normalizeIpCheckTarget('Example.COM'), 'example.com');
  assert.equal(normalizeIpCheckTarget('bücher.de'), 'xn--bcher-kva.de');
});

test('rejects URLs, ports, local names and non-public IP addresses', () => {
  for (const value of [
    '',
    'https://example.com',
    'example.com:443',
    'localhost',
    'router.local',
    '127.0.0.1',
    '10.0.0.1',
    '100.64.0.1',
    '169.254.1.1',
    '172.16.0.1',
    '192.168.0.1',
    '198.51.100.1',
    '203.0.113.1',
    '::1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
  ]) {
    assert.throws(() => normalizeIpCheckTarget(value), /IP_CHECK_INVALID_QUERY/);
  }
  assert.equal(isPublicIpAddress('8.8.8.8'), true);
  assert.equal(isPublicIpAddress('2001:4860:4860::8888'), true);
});
