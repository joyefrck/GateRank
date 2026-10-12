import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createPublicRoutes } from '../src/routes/publicRoutes';
import { createPortalRoutes } from '../src/routes/portalRoutes';
import { createApplicationModerationService } from '../src/services/applicationModerationService';
import { createTurnstileService } from '../src/services/turnstileService';
import { HttpError, errorHandler } from '../src/middleware/errorHandler';
import { signApplicantToken } from '../src/utils/token';

const payload = {
  name: 'Example', website: 'https://example.com', websites: ['https://example.com'],
  plan_price_month: 12, has_trial: false, subscription_url: 'https://example.com/sub?token=private',
  applicant_email: 'owner@example.com', applicant_telegram: '@example', founded_on: '2025-01-01',
  airport_intro: '清晰的介绍', test_account: 'tester', test_password: 'private-password',
  email_code: '123456',
};
const account = { id: 1, application_id: 7, email: 'old@example.com', must_change_password: false };
function depsFor(sideEffects: string[], overrides: Record<string, unknown> = {}) {
  const mutation = (name: string, result: any = true) => async () => { sideEffects.push(name); return result; };
  return {
    turnstile: createTurnstileService({ TURNSTILE_ENABLED: '0' }),
    applicantAccountRepository: {
      getById: async () => account, getByEmail: async () => null,
      create: mutation('account', 1), updateEmail: mutation('email'),
    },
    airportApplicationRepository: {
      create: mutation('application', 7), hasBlockingEmail: async () => false,
      getById: async () => ({ ...payload, id: 7, payment_status: 'unpaid', approved_airport_id: 9 }),
      updateApplicantDraft: mutation('draft'), updateApplicantOperations: mutation('operations'),
    },
    applicantEmailChangeCodeRepository: { consume: mutation('consume-code', 'consumed') },
    applicantBillingRepository: { ensureWalletForAccount: mutation('wallet', {}) },
    airportRepository: { update: mutation('airport-sync') },
    applicationNotificationService: { notifyNewAirportApplication: mutation('telegram') },
    mailService: { sendApplicantCredentialsEmail: mutation('mail') },
    ...overrides,
  };
}
async function withServer(deps: any, callback: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json(), createPublicRoutes(deps), createPortalRoutes(deps), errorHandler);
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    await callback(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
}
function portalHeaders() {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'moderation-route-test-secret';
  const { token } = signApplicantToken('moderation-route-test-secret', 1, account.email, 1);
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

for (const decision of ['reject', 'review', 'unavailable']) {
  test(`${decision} prevents all public/draft/operations side effects, including email-code consumption`, async () => {
    const sideEffects: string[] = [];
    let calls = 0;
    const applicationModeration = createApplicationModerationService({ APPLICATION_MODERATION_ENABLED: '1', DEEPSEEK_API_KEY: 'test' }, (async () => {
      calls++;
      if (decision === 'unavailable') throw new Error('network');
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
        role: 'assistant', content: JSON.stringify({ decision, issues: [{ field: 'text_2', category: 'harassment', reason: '攻击性表达' }] }),
      } }] }));
    }) as typeof fetch);
    await withServer(depsFor(sideEffects, { applicationModeration }), async (base) => {
      for (const path of ['/airport-applications', '/portal/application', '/portal/application/operations']) {
        const res = await fetch(base + path, {
          method: path === '/airport-applications' ? 'POST' : 'PATCH', headers: portalHeaders(), body: JSON.stringify(payload),
        });
        const data = await res.json() as any;
        assert.equal(res.status, decision === 'unavailable' ? 503 : 422, `${path}: ${JSON.stringify(data)}`);
        assert.equal(data.code, decision === 'reject' ? 'APPLICATION_CONTENT_REJECTED' : decision === 'review' ? 'APPLICATION_CONTENT_REVIEW_REQUIRED' : 'APPLICATION_MODERATION_UNAVAILABLE');
        assert.deepEqual(sideEffects, []);
      }
    });
    assert.equal(calls, 3);
  });
}

test('Turnstile failure stops review and business even when client supplies an allow decision', async () => {
  const sideEffects: string[] = [];
  let modelCalls = 0;
  const turnstile = { publicConfig: () => ({ enabled: true, site_key: 'test' }), verify: async () => { throw new HttpError(400, 'TURNSTILE_FAILED', 'failed'); } };
  await withServer(depsFor(sideEffects, { turnstile, applicationModeration: { verify: async () => { modelCalls++; } } }), async (base) => {
    const res = await fetch(base + '/airport-applications', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, decision: 'allow', moderated: true }),
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json() as any).code, 'TURNSTILE_FAILED');
  });
  assert.equal(modelCalls, 0);
  assert.deepEqual(sideEffects, []);
});

test('review runs after Turnstile and before application/account/wallet/notifications; only validated text is passed', async () => {
  const sideEffects: string[] = [];
  const turnstile = { publicConfig: () => ({ enabled: true, site_key: 'test' }), verify: async () => { sideEffects.push('turnstile'); } };
  const applicationModeration = { verify: async (input: any) => {
    sideEffects.push('review');
    assert.deepEqual(input, { name: payload.name, airport_intro: payload.airport_intro });
  } };
  await withServer(depsFor(sideEffects, { turnstile, applicationModeration }), async (base) => {
    const res = await fetch(base + '/airport-applications', { method: 'POST', headers: portalHeaders(), body: JSON.stringify(payload) });
    assert.equal(res.status, 201);
    assert.equal((await res.json() as any).application_id, 7);
  });
  assert.deepEqual(sideEffects, ['turnstile', 'review', 'application', 'account', 'wallet', 'telegram', 'mail']);
});

test('IP total limiter prevents rotating emails from bypassing the review budget', async () => {
  const { createApplicationIpRateLimit } = await import('../src/middleware/rateLimit');
  const old = process.env.APPLICATION_IP_RATE_LIMIT_MAX;
  process.env.APPLICATION_IP_RATE_LIMIT_MAX = '2';
  const limiter = createApplicationIpRateLimit();
  if (old === undefined) delete process.env.APPLICATION_IP_RATE_LIMIT_MAX;
  else process.env.APPLICATION_IP_RATE_LIMIT_MAX = old;
  const app = express();
  let calls = 0;
  app.use(express.json());
  app.post('/submit', limiter, (_req, res) => { calls++; res.json({ ok: true }); });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/submit`;
    for (const [index, email] of ['a@example.com', 'b@example.com', 'c@example.com'].entries()) {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ applicant_email: email }) });
      assert.equal(res.status, index < 2 ? 200 : 429);
    }
    assert.equal(calls, 2);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
