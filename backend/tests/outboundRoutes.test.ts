import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'node:net';
import { createOutboundRoutes } from '../src/routes/outboundRoutes';
import { errorHandler } from '../src/middleware/errorHandler';

test('GET /outbound/airports/:id records click and redirects with GateRank source params', async () => {
  const processed: Array<Record<string, unknown>> = [];
  const app = express();
  app.use(
    createOutboundRoutes({
      airportRepository: {
        getById: async () => ({
          id: 9,
          name: 'Cloud Airport',
          website: 'https://airport.example.com/path?foo=bar',
          status: 'normal',
          is_listed: true,
          plan_price_month: 10,
          has_trial: false,
          tags: [],
          created_at: '2026-05-04',
        }),
      },
      applicantBillingRepository: {
        processOutboundClick: async (input) => {
          processed.push(input);
          return {
            status: 'billed',
            billed_amount: 1,
            airport_name: 'Cloud Airport',
            balance_after: 9,
          };
        },
      },
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/outbound/airports/9?target=website&placement=home_card`, {
      redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(processed.length, 1);
    assert.equal(processed[0].airport_id, 9);
    assert.equal(processed[0].target_kind, 'website');
    assert.equal(processed[0].placement, 'home_card');
    const location = response.headers.get('location') || '';
    const redirected = new URL(location);
    assert.equal(redirected.origin, 'https://airport.example.com');
    assert.equal(redirected.searchParams.get('foo'), 'bar');
    assert.equal(redirected.searchParams.get('utm_source'), 'gaterank');
    assert.equal(redirected.searchParams.get('utm_medium'), 'referral');
    assert.equal(redirected.searchParams.get('utm_campaign'), 'paid_click');
    assert.match(redirected.searchParams.get('gr_click_id') || '', /^[0-9a-f-]{36}$/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /outbound/airports/:id redirects bare website domains as https URLs', async () => {
  const app = express();
  app.use(
    createOutboundRoutes({
      airportRepository: {
        getById: async () => ({
          id: 4,
          name: 'Xiaomi',
          website: 'www.xiaomi.com',
          status: 'normal',
          is_listed: true,
          plan_price_month: 25,
          has_trial: true,
          tags: [],
          created_at: '2026-05-04',
        }),
      },
      applicantBillingRepository: {
        processOutboundClick: async () => ({
          status: 'billed',
          billed_amount: 1,
          airport_name: 'Xiaomi',
          balance_after: 9,
        }),
      },
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/outbound/airports/4?target=website&placement=full_ranking_item`, {
      redirect: 'manual',
    });

    assert.equal(response.status, 302);
    const location = response.headers.get('location') || '';
    const redirected = new URL(location);
    assert.equal(redirected.origin, 'https://www.xiaomi.com');
    assert.equal(redirected.searchParams.get('utm_source'), 'gaterank');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /outbound/airports/:id does not redirect when balance is insufficient', async () => {
  const app = express();
  app.use(
    createOutboundRoutes({
      airportRepository: {
        getById: async () => ({
          id: 9,
          name: 'Cloud Airport',
          website: 'https://airport.example.com/',
          status: 'normal',
          is_listed: true,
          plan_price_month: 10,
          has_trial: false,
          tags: [],
          created_at: '2026-05-04',
        }),
      },
      applicantBillingRepository: {
        processOutboundClick: async () => ({
          status: 'insufficient_balance',
          billed_amount: 0,
          airport_name: 'Cloud Airport',
          balance_after: 0,
        }),
      },
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/outbound/airports/9?target=website&placement=home_card`, {
      redirect: 'manual',
    });

    assert.equal(response.status, 402);
    assert.equal(response.headers.get('location'), null);
    const body = await response.text();
    assert.match(body, /暂不可访问/);
    assert.doesNotMatch(body, /点击计费标准/);
    assert.doesNotMatch(body, /¥1\.00 \/ 次/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
