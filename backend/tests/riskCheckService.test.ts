import assert from 'node:assert/strict';
import test from 'node:test';
import { probeWebsite } from '../src/services/riskCheckService';

const addresses = [{ address: '8.8.8.8', family: 4 as const }];
const base = {
  resolveAddresses: async () => addresses,
  requestUrl: async () => ({ status: 200 }),
  getSslDaysLeft: async () => 74,
};

test('bare website is normalized and fragment is never sent', async () => {
  const seen: string[] = [];
  const result = await probeWebsite('www.example.com/signup?ref=private#/route', {
    ...base, requestUrl: async (url: URL) => { seen.push(url.href); return { status: 200 }; },
  } as never);
  assert.equal(result.domain_ok, true);
  assert.deepEqual(seen, ['https://www.example.com/signup?ref=private']);
  assert.doesNotMatch(JSON.stringify(result), /private|ref=|#\/route/);
});

for (const [response, status, ok] of [
  [{ status: 200 }, 'accessible', true],
  [{ status: 403, challenge: true }, 'challenge', true],
  [{ status: 403 }, 'restricted', true],
  [{ status: 401 }, 'restricted', true],
  [{ status: 429 }, 'restricted', true],
  [{ status: 503 }, 'service_error', false],
  [{ status: 522 }, 'service_error', false],
] as const) {
  test(`HTTP ${response.status} maps to ${status}, independent of readable TLS certificate`, async () => {
    let requests = 0;
    const result = await probeWebsite('https://example.com/', {
      ...base, requestUrl: async () => { requests++; return response; },
    } as never);
    assert.equal(result.domain_ok, ok);
    assert.equal(result.ssl_days_left, 74);
    assert.equal(result.status, status);
    assert.equal(requests, ok ? 1 : 2);
  });
}

test('root recovery keeps original failure evidence', async () => {
  const result = await probeWebsite('https://example.com/login', {
    ...base, requestUrl: async (url: URL) => ({ status: url.pathname === '/' ? 200 : 404 }),
  } as never);
  assert.equal(result.domain_ok, true);
  assert.equal(result.root_fallback, true);
  assert.ok(result.attempts.some((a) => a.http_status === 404));
});

test('TLS-only and total network failure remain distinct', async () => {
  for (const days of [74, null]) {
    const result = await probeWebsite('https://example.com', {
      ...base, requestUrl: async () => ({ error_code: 'ETIMEDOUT' }), getSslDaysLeft: async () => days,
    } as never);
    assert.equal(result.status, days === null ? 'unreachable' : 'tls_only');
    assert.equal(result.domain_ok, days !== null);
    assert.equal(result.retried, true);
  }
});

test('a later timeout cannot hide a confirmed HTTP 5xx behind TLS', async () => {
  let calls = 0;
  const result = await probeWebsite('https://example.com/', {
    ...base, requestUrl: async () => ++calls === 1 ? { status: 502 } : { error_code: 'ECONNRESET' },
  } as never);
  assert.equal(result.status, 'service_error');
  assert.equal(result.domain_ok, false);
});

test('redirects resolve and pin each host, record sanitized final target', async () => {
  const hosts: string[] = [];
  const result = await probeWebsite('https://example.com/', {
    ...base,
    resolveAddresses: async (url: URL) => { hosts.push(url.hostname); return addresses; },
    requestUrl: async (url: URL) => url.hostname === 'example.com'
      ? { status: 302, location: 'https://other.example/login?token=secret' } : { status: 200 },
  } as never);
  assert.equal(result.domain_ok, true);
  assert.equal(result.final_url, 'https://other.example/login');
  assert.ok(hosts.includes('other.example'));
  assert.doesNotMatch(JSON.stringify(result), /secret/);
});

for (const address of ['127.0.0.1', '10.0.0.2', '169.254.169.254', '::1', '::ffff:7f00:1', 'fc00::1']) {
  test(`no HTTP or TLS connection to non-public address ${address}`, async () => {
    let connected = 0;
    const result = await probeWebsite('https://example.com/', {
      ...base,
      resolveAddresses: async () => [{ address, family: address.includes(':') ? 6 : 4 }],
      requestUrl: async () => { connected++; return { status: 200 }; },
      getSslDaysLeft: async () => { connected++; return 74; },
    } as never);
    assert.equal(result.status, 'config_error');
    assert.equal(result.domain_ok, null);
    assert.equal(connected, 0);
  });
}

test('private redirect target and invalid scheme cannot be converted into root success', async () => {
  for (const location of ['http://127.0.0.1/private', 'file:///etc/passwd']) {
    const result = await probeWebsite('https://example.com/login', {
      ...base,
      resolveAddresses: async (url: URL) => [{ address: url.hostname === '127.0.0.1' ? '127.0.0.1' : '8.8.8.8', family: 4 }],
      requestUrl: async () => ({ status: 302, location }),
    } as never);
    assert.equal(result.status, 'config_error');
    assert.equal(result.domain_ok, null);
  }
});

test('redirect loop is a service error, not TLS-only success', async () => {
  const result = await probeWebsite('https://example.com/', {
    ...base, requestUrl: async () => ({ status: 302, location: '/' }),
  } as never);
  assert.equal(result.domain_ok, false);
  assert.equal(result.error_code, 'REDIRECT_LOOP');
});

test('global deadline bounds a resolver that never settles', async () => {
  const started = Date.now();
  const result = await probeWebsite('https://example.com/', {
    ...base, resolveAddresses: async () => new Promise(() => {}), totalTimeoutMs: 25,
  } as never);
  assert.equal(result.status, 'unreachable');
  assert.ok(Date.now() - started < 1000);
});

test('invalid input returns configuration error without DNS', async () => {
  let resolved = false;
  const result = await probeWebsite('javascript:alert(1)', {
    ...base, resolveAddresses: async () => { resolved = true; return addresses; },
  } as never);
  assert.equal(result.status, 'config_error');
  assert.equal(result.domain_ok, null);
  assert.equal(resolved, false);
});

test('redirect chain is bounded to five jumps', async () => {
  let count = 0;
  const result = await probeWebsite('https://example.com/', {
    ...base, requestUrl: async () => ({ status: 302, location: `/hop-${++count}` }),
  } as never);
  assert.equal(result.domain_ok, false);
  assert.equal(result.error_code, 'REDIRECT_LIMIT');
  assert.equal(count, 6);
});

test('TLS expired certificate is preserved for independent SSL penalty', async () => {
  const result = await probeWebsite('https://example.com', {
    ...base, getSslDaysLeft: async () => ({ days: -2, authorized: false, error_code: 'TLS_CERTIFICATE_UNTRUSTED' }),
  } as never);
  assert.equal(result.domain_ok, true);
  assert.equal(result.ssl_days_left, -2);
  assert.equal(result.tls_authorized, false);
});

test('ordinary HTTP site does not request TLS', async () => {
  const result = await probeWebsite('http://example.com/', {
    ...base, getSslDaysLeft: async () => { assert.fail('TLS must not run'); },
  } as never);
  assert.equal(result.domain_ok, true);
  assert.equal(result.ssl_days_left, null);
});

test('DNS failure gets a bounded second lookup and remains distinct from configuration failure', async () => {
  let calls = 0;
  const result = await probeWebsite('https://example.com/', {
    ...base, resolveAddresses: async () => { calls++; throw Object.assign(new Error('not found'), { code: 'ENOTFOUND' }); },
  } as never);
  assert.equal(result.status, 'unreachable');
  assert.equal(result.domain_ok, false);
  assert.equal(calls, 2);
});
