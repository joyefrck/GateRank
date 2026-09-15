import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurnstileService } from '../src/services/turnstileService';

const env = { TURNSTILE_ENABLED: '1', TURNSTILE_SITE_KEY: 'public-test-key', TURNSTILE_SECRET_KEY: 'private-test-key', TURNSTILE_HOSTNAMES: 'gate-rank.com' };
const response = (payload: unknown, status = 200) => (async () => new Response(JSON.stringify(payload), { status })) as typeof fetch;
const valid = { success: true, hostname: 'gate-rank.com', action: 'portal_login' };

test('public config contains only enabled and site key', () => {
  assert.deepEqual(createTurnstileService(env).publicConfig(), { enabled: true, site_key: env.TURNSTILE_SITE_KEY });
});
test('production fails closed without configuration; development may explicitly disable', async () => {
  const service = createTurnstileService({ NODE_ENV: 'production' });
  assert.throws(() => service.publicConfig(), { code: 'TURNSTILE_UNAVAILABLE' });
  await assert.rejects(service.verify('token', 'portal_login'), { code: 'TURNSTILE_UNAVAILABLE' });
  const disabled = createTurnstileService({ TURNSTILE_ENABLED: '0' });
  assert.deepEqual(disabled.publicConfig(), { enabled: false, site_key: '' });
  await disabled.verify(undefined, 'portal_login');
});
test('missing, malformed and oversized tokens never call Cloudflare', async () => {
  let calls = 0;
  const service = createTurnstileService(env, (async () => { calls++; throw new Error(); }) as typeof fetch);
  for (const token of [undefined, null, '', ' ', 123, {}, [], 'a'.repeat(2049)]) {
    await assert.rejects(service.verify(token, 'portal_login'), { code: 'TURNSTILE_REQUIRED' });
  }
  assert.equal(calls, 0);
});
test('valid token uses fixed endpoint, server secret, request timeout and expected action', async () => {
  const service = createTurnstileService(env, (async (url, init) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    assert.deepEqual(JSON.parse(String(init?.body)), { secret: env.TURNSTILE_SECRET_KEY, response: 'token' });
    assert.ok(init?.signal);
    return new Response(JSON.stringify(valid));
  }) as typeof fetch);
  await service.verify('token', 'portal_login');
});
for (const [name, payload] of Object.entries({
  rejected: { success: false }, expired: { success: false, 'error-codes': ['timeout-or-duplicate'] },
  wrongHost: { ...valid, hostname: 'attacker.example' }, wrongAction: { ...valid, action: 'airport_apply' },
  missingHost: { success: true, action: 'portal_login' }, malformedHost: { ...valid, hostname: {} },
  notBoolean: { ...valid, success: 'true' },
})) {
  test(`rejects ${name}`, async () => {
    await assert.rejects(createTurnstileService(env, response(payload)).verify('token', 'portal_login'), { code: 'TURNSTILE_FAILED' });
  });
}
test('network, invalid JSON, HTTP error and malformed response fail closed', async () => {
  for (const fetcher of [response({}, 503), response(null), response([]),
    (async () => { throw new Error('network'); }) as typeof fetch,
    (async () => new Response('invalid-json')) as typeof fetch]) {
    await assert.rejects(createTurnstileService(env, fetcher).verify('token', 'portal_login'), { code: 'TURNSTILE_UNAVAILABLE' });
  }
});
test('reused token is rejected after its first successful verification', async () => {
  let consumed = false;
  const service = createTurnstileService(env, (async () => {
    const payload = consumed ? { success: false, 'error-codes': ['timeout-or-duplicate'] } : valid;
    consumed = true;
    return new Response(JSON.stringify(payload));
  }) as typeof fetch);
  await service.verify('single-use-token', 'portal_login');
  await assert.rejects(service.verify('single-use-token', 'portal_login'), { code: 'TURNSTILE_FAILED' });
});
