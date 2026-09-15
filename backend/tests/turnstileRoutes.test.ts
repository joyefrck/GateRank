import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createPublicRoutes } from '../src/routes/publicRoutes';
import { createPortalRoutes } from '../src/routes/portalRoutes';
import { createTurnstileService } from '../src/services/turnstileService';
import { errorHandler } from '../src/middleware/errorHandler';

const paths = ['/airport-applications', '/portal/login', '/portal/x-oauth/login/start', '/portal/telegram-login/start'];
const config = { TURNSTILE_ENABLED: '1', TURNSTILE_SITE_KEY: 'site-test', TURNSTILE_SECRET_KEY: 'secret-test' };
for (const token of [undefined, 'forged-token']) {
  test(`all entry points reject ${token ? 'forged' : 'missing'} tokens before any business side effects`, async () => {
    let sideEffects = 0;
    const business = () => { sideEffects++; throw new Error('business must not execute'); };
    const turnstile = createTurnstileService(config, (async () => new Response(JSON.stringify({ success: false }))) as typeof fetch);
    const deps = {
      turnstile,
      airportApplicationRepository: { create: business, hasBlockingEmail: business },
      applicantPortalAuthService: { login: business },
      applicantXOAuthService: { startLogin: business },
      userTelegramBotSettingsService: { getConfig: business },
    };
    const app = express();
    app.use(express.json(), createPublicRoutes(deps as any), createPortalRoutes(deps as any), errorHandler);
    const server = app.listen(0, '127.0.0.1');
    try {
      await new Promise<void>((resolve) => server.once('listening', resolve));
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      for (const path of paths) {
        const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turnstile_token: token }) });
        assert.equal(res.status, 400, path);
        assert.equal((await res.json() as any).code, token ? 'TURNSTILE_FAILED' : 'TURNSTILE_REQUIRED', path);
      }
      const res = await fetch(base + '/security/turnstile');
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await res.json(), { enabled: true, site_key: config.TURNSTILE_SITE_KEY });
      assert.equal(sideEffects, 0);
    } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
  });
}

test('application limiting isolates applicants sharing a reverse proxy and normalizes email', async () => {
  const { createApplicationRateLimit } = await import('../src/middleware/rateLimit');
  const previous = process.env.APPLICATION_RATE_LIMIT_MAX;
  process.env.APPLICATION_RATE_LIMIT_MAX = '1';
  const limiter = createApplicationRateLimit();
  if (previous === undefined) delete process.env.APPLICATION_RATE_LIMIT_MAX;
  else process.env.APPLICATION_RATE_LIMIT_MAX = previous;
  const app = express();
  app.use(express.json());
  app.post('/apply', limiter, (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/apply`;
    const send = (email: string) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ applicant_email: email }) });
    assert.equal((await send('alice@example.com')).status, 200);
    assert.equal((await send('bob@example.com')).status, 200);
    assert.equal((await send(' ALICE@example.com ')).status, 429);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
