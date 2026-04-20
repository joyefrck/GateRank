import assert from 'node:assert/strict';
import test from 'node:test';
import { probeWebsite } from '../src/services/riskCheckService';

test('probeWebsite treats the domain as reachable when the root path responds', async () => {
  const requestedPaths: string[] = [];

  const result = await probeWebsite('https://uuone.acysa.de/login', {
    resolveAddresses: async () => [
      { address: '2001:db8::1', family: 6 },
      { address: '47.83.184.42', family: 4 },
    ],
    requestUrl: async (url, address) => {
      requestedPaths.push(`${url.pathname}|ipv${address.family}`);
      return url.pathname === '/' && address.family === 4;
    },
    getSslDaysLeft: async () => null,
  });

  assert.deepEqual(requestedPaths, ['/login|ipv4', '/login|ipv6', '/|ipv4']);
  assert.deepEqual(result, {
    domain_ok: true,
    ssl_days_left: null,
  });
});

test('probeWebsite keeps the domain reachable when HTTP probing fails but TLS succeeds', async () => {
  const result = await probeWebsite('https://uuone.acysa.de/login', {
    resolveAddresses: async () => [{ address: '47.83.184.42', family: 4 }],
    requestUrl: async () => false,
    getSslDaysLeft: async () => 84,
  });

  assert.deepEqual(result, {
    domain_ok: true,
    ssl_days_left: 84,
  });
});

test('probeWebsite marks the domain unreachable only when HTTP and TLS both fail', async () => {
  const result = await probeWebsite('https://uuone.acysa.de/login', {
    resolveAddresses: async () => [{ address: '47.83.184.42', family: 4 }],
    requestUrl: async () => false,
    getSslDaysLeft: async () => null,
  });

  assert.deepEqual(result, {
    domain_ok: false,
    ssl_days_left: null,
  });
});
