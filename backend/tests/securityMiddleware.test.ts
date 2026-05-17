import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { AdminAuthService } from '../src/services/adminAuthService';
import { createAdminAuthRoutes } from '../src/routes/adminAuthRoutes';
import { adminAuth } from '../src/middleware/adminAuth';
import { corsAllowlist } from '../src/middleware/cors';
import { errorHandler } from '../src/middleware/errorHandler';
import { requestContext } from '../src/middleware/requestContext';
import { createPortalRoutes } from '../src/routes/portalRoutes';
import { signApplicantToken } from '../src/utils/token';

test('admin login sets HttpOnly cookie and adminAuth still accepts cookie and bearer tokens', async () => {
  const previous = snapshotEnv([
    'ADMIN_API_KEY',
    'ADMIN_UI_PASSWORD',
    'ADMIN_JWT_SECRET',
    'ADMIN_TOKEN_TTL_HOURS',
    'AUTH_COOKIE_SECURE',
  ]);
  process.env.ADMIN_API_KEY = 'admin-api-key';
  process.env.ADMIN_UI_PASSWORD = 'correct-password';
  process.env.ADMIN_JWT_SECRET = 'admin-cookie-secret';
  process.env.ADMIN_TOKEN_TTL_HOURS = '1';
  process.env.AUTH_COOKIE_SECURE = 'false';

  const app = express();
  app.use(express.json());
  app.use(requestContext);
  app.use('/admin', createAdminAuthRoutes(new AdminAuthService()));
  app.get('/admin/protected', adminAuth, (_req, res) => res.json({ ok: true }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const login = await fetch(`http://127.0.0.1:${port}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'correct-password' }),
    });
    assert.equal(login.status, 200);
    const loginBody = (await login.json()) as { token: string };
    const setCookie = getSingleSetCookie(login);
    assert.match(setCookie, /^gaterank_admin_token=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);

    const cookieAccess = await fetch(`http://127.0.0.1:${port}/admin/protected`, {
      headers: { Cookie: cookieHeader(setCookie) },
    });
    assert.equal(cookieAccess.status, 200);

    const bearerAccess = await fetch(`http://127.0.0.1:${port}/admin/protected`, {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    });
    assert.equal(bearerAccess.status, 200);

    const logout = await fetch(`http://127.0.0.1:${port}/admin/logout`, {
      method: 'POST',
      headers: { Cookie: cookieHeader(setCookie) },
    });
    assert.equal(logout.status, 200);
    assert.match(getSingleSetCookie(logout), /^gaterank_admin_token=;/);
    assert.match(getSingleSetCookie(logout), /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
  } finally {
    restoreEnv(previous);
    await closeServer(server);
  }
});

test('admin login rate limit returns existing JSON error shape after repeated failures', async () => {
  const previous = snapshotEnv([
    'ADMIN_API_KEY',
    'ADMIN_UI_PASSWORD',
    'ADMIN_JWT_SECRET',
    'ADMIN_LOGIN_RATE_LIMIT_MAX',
    'LOGIN_RATE_LIMIT_WINDOW_MS',
  ]);
  process.env.ADMIN_API_KEY = 'admin-api-key';
  process.env.ADMIN_UI_PASSWORD = 'correct-password';
  process.env.ADMIN_JWT_SECRET = 'admin-rate-limit-secret';
  process.env.ADMIN_LOGIN_RATE_LIMIT_MAX = '2';
  process.env.LOGIN_RATE_LIMIT_WINDOW_MS = '60000';

  const app = express();
  app.use(express.json());
  app.use(requestContext);
  app.use('/admin', createAdminAuthRoutes(new AdminAuthService()));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    for (const expectedStatus of [401, 401, 429]) {
      const response = await fetch(`http://127.0.0.1:${port}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password' }),
      });
      assert.equal(response.status, expectedStatus);
      if (expectedStatus === 429) {
        const body = (await response.json()) as { code: string; request_id: string };
        assert.equal(body.code, 'RATE_LIMITED');
        assert.ok(body.request_id);
      }
    }
  } finally {
    restoreEnv(previous);
    await closeServer(server);
  }
});

test('portal login sets HttpOnly cookie and portalAuth still accepts cookie and bearer tokens', async () => {
  const previous = snapshotEnv(['APPLICANT_PORTAL_JWT_SECRET', 'AUTH_COOKIE_SECURE']);
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-cookie-secret';
  process.env.AUTH_COOKIE_SECURE = 'false';
  const { token, expiresAt } = signApplicantToken('portal-cookie-secret', 1, 'user@example.com', 1);

  const app = express();
  app.use(express.json());
  app.use(requestContext);
  app.use(createPortalRoutes(createPortalDeps({
    applicantPortalAuthService: {
      login: async () => ({
        token,
        expires_at: expiresAt.toISOString(),
        account: createMockApplicantAccount(),
      }),
    },
  })));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const login = await fetch(`http://127.0.0.1:${port}/portal/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'password' }),
    });
    assert.equal(login.status, 200);
    const setCookie = getSingleSetCookie(login);
    assert.match(setCookie, /^gaterank_portal_token=/);
    assert.match(setCookie, /HttpOnly/i);

    const cookieAccess = await fetch(`http://127.0.0.1:${port}/portal/me`, {
      headers: { Cookie: cookieHeader(setCookie) },
    });
    assert.equal(cookieAccess.status, 200);

    const bearerAccess = await fetch(`http://127.0.0.1:${port}/portal/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(bearerAccess.status, 200);

    const logout = await fetch(`http://127.0.0.1:${port}/portal/logout`, {
      method: 'POST',
      headers: { Cookie: cookieHeader(setCookie) },
    });
    assert.equal(logout.status, 200);
    assert.match(getSingleSetCookie(logout), /^gaterank_portal_token=;/);
    assert.match(getSingleSetCookie(logout), /Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);
  } finally {
    restoreEnv(previous);
    await closeServer(server);
  }
});

test('CORS allowlist reflects trusted origins with credentials and does not wildcard unknown origins', async () => {
  const previous = snapshotEnv(['CORS_ALLOWED_ORIGINS', 'VITE_SITE_URL']);
  process.env.CORS_ALLOWED_ORIGINS = 'https://admin.gaterank.test';
  process.env.VITE_SITE_URL = 'https://gate-rank.com';

  const app = express();
  app.disable('x-powered-by');
  app.use(corsAllowlist);
  app.get('/ok', (_req, res) => res.json({ ok: true }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const allowed = await fetch(`http://127.0.0.1:${port}/ok`, {
      headers: { Origin: 'https://admin.gaterank.test' },
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://admin.gaterank.test');
    assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
    assert.match(allowed.headers.get('vary') || '', /Origin/);

    const unknown = await fetch(`http://127.0.0.1:${port}/ok`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    assert.equal(unknown.status, 200);
    assert.equal(unknown.headers.get('access-control-allow-origin'), null);
    assert.notEqual(unknown.headers.get('access-control-allow-origin'), '*');

    const sameOrigin = await fetch(`http://127.0.0.1:${port}/ok`);
    assert.equal(sameOrigin.status, 200);
    assert.equal(sameOrigin.headers.get('access-control-allow-origin'), null);
    assert.equal(sameOrigin.headers.get('x-powered-by'), null);
  } finally {
    restoreEnv(previous);
    await closeServer(server);
  }
});

function createPortalDeps(overrides: Record<string, unknown> = {}) {
  return {
    applicantAccountRepository: {
      getById: async () => createMockApplicantAccount(),
      updatePassword: async () => true,
      touchLogin: async () => true,
    },
    airportApplicationRepository: {
      getById: async () => ({
        id: 7,
        name: 'Cloud Airport',
        website: 'https://example.com',
        websites: ['https://example.com'],
        review_status: 'awaiting_payment',
        payment_status: 'unpaid',
        payment_amount: null,
        applicant_email: 'user@example.com',
        applicant_telegram: '@cloud',
        founded_on: '2025-01-01',
        airport_intro: 'intro',
        created_at: '2026-04-18 10:00:00',
      }),
      markPaid: async () => true,
    },
    applicationPaymentOrderRepository: {
      create: async () => 1,
      getLatestByApplicationId: async () => null,
      getByOutTradeNo: async () => null,
      markPaid: async () => true,
      expireOpenOrdersByApplicationId: async () => 0,
    },
    applicantBillingRepository: {
      ensureWalletForAccount: async () => ({
        id: 1,
        applicant_account_id: 1,
        application_id: 7,
        airport_id: null,
        airport_is_listed: null,
        balance: 0,
        auto_unlisted_at: null,
        created_at: '2026-04-18T10:00:00+08:00',
        updated_at: '2026-04-18T10:00:00+08:00',
      }),
      getWalletByAccountId: async () => null,
      createRechargeOrder: async () => 1,
      getRechargeOrderByOutTradeNo: async () => null,
      listRechargeOrders: async () => ({ items: [], total: 0 }),
      cancelRechargeOrder: async () => true,
      markRechargePaidAndCredit: async () => true,
      listTransactions: async () => ({ items: [], total: 0 }),
      listClicks: async () => ({ items: [], total: 0 }),
    },
    applicantPortalAuthService: {
      login: async () => {
        throw new Error('not configured');
      },
    },
    paymentGatewaySettingsService: {
      getConfig: async () => ({
        enabled: true,
        pid: '28615',
        private_key: 'private-key',
        platform_public_key: 'public-key',
        epay: { enabled: true },
        usdt: { enabled: false, gateway_url: '', merchant_id: '', secret_key: '' },
      }),
    },
    marketingSettingsService: {
      getConfig: async () => ({
        application_fee_amount: 456,
        click_charge_amount: 2.5,
        admin_telegram_username: 'gaterank_admin',
      }),
    },
    paymentGatewayService: {
      createOrder: async () => {
        throw new Error('not used');
      },
      verifyNotificationPayload: async () => true,
    },
    ...overrides,
  } as any;
}

function createMockApplicantAccount() {
  return {
    id: 1,
    application_id: 7,
    email: 'user@example.com',
    password_hash: 'hash',
    must_change_password: false,
    last_login_at: null,
    x_user_id: null,
    x_username: null,
    x_display_name: null,
    x_bound_at: null,
    created_at: '2026-04-18T10:00:00+08:00',
    updated_at: '2026-04-18T10:00:00+08:00',
  };
}

function getSingleSetCookie(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie?.()[0] || response.headers.get('set-cookie') || '';
}

function cookieHeader(setCookie: string): string {
  return setCookie.split(';')[0];
}

function snapshotEnv(names: string[]): Record<string, string | undefined> {
  return Object.fromEntries(names.map((name) => [name, process.env[name]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const [name, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}
