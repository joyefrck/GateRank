import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'node:net';
import { createOutboundRoutes } from '../src/routes/outboundRoutes';
import { errorHandler } from '../src/middleware/errorHandler';

const outboundRankingDeps = {
  scoreRepository: {
    getPublicBillingRankByDate: async () => null,
  },
};

test('GET /outbound/airports/:id records click and redirects with GateRank source params', async () => {
  const processed: Array<Record<string, unknown>> = [];
  const app = express();
  app.use(
    createOutboundRoutes({
      ...outboundRankingDeps,
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
            billed_amount: 2.5,
            airport_name: 'Cloud Airport',
            balance_after: 9,
          };
        },
      },
      marketingSettingsService: {
        getConfig: async () => ({ click_charge_amount: 2.5 }),
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
    assert.equal(processed[0].click_charge_amount, 2.5);
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

test('GET /outbound/airports/:id applies ranked click charges and reads updated settings on every request', async () => {
  const chargedAmounts: number[] = [];
  let rank = 1;
  let firstRankAmount = 1.2;
  const app = express();
  app.use(
    createOutboundRoutes({
      airportRepository: {
        getById: async () => ({
          id: 9,
          name: 'Ranked Airport',
          website: 'https://ranked.example.com/',
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
          chargedAmounts.push(Number(input.click_charge_amount));
          return {
            status: 'billed',
            billed_amount: Number(input.click_charge_amount),
            airport_name: 'Ranked Airport',
            balance_after: 9,
          };
        },
      },
      marketingSettingsService: {
        getConfig: async () => ({
          click_charge_amount: 0.6,
          rank_click_charge_amounts: { 1: firstRankAmount },
        }),
      },
      scoreRepository: {
        getPublicBillingRankByDate: async (_airportId, _date, defaultAmount) => {
          assert.equal(defaultAmount, 0.6);
          return rank;
        },
      },
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    await fetch(`http://127.0.0.1:${port}/outbound/airports/9?target=website&placement=home_card`, { redirect: 'manual' });
    firstRankAmount = 1.8;
    await fetch(`http://127.0.0.1:${port}/outbound/airports/9?target=website&placement=report_header`, { redirect: 'manual' });
    await fetch(`http://127.0.0.1:${port}/outbound/airports/9?target=website&placement=risk_monitor_item`, { redirect: 'manual' });
    rank = 2;
    await fetch(`http://127.0.0.1:${port}/outbound/airports/9?target=website&placement=news_article`, { redirect: 'manual' });
    rank = 7;
    await fetch(`http://127.0.0.1:${port}/outbound/airports/9?target=website&placement=full_ranking_item`, { redirect: 'manual' });

    assert.deepEqual(chargedAmounts, [1.2, 1.8, 1.8, 0.6, 0.6]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /outbound/airports/:id does not charge when billing rank lookup fails', async () => {
  let processed = false;
  const app = express();
  app.use(
    createOutboundRoutes({
      airportRepository: {
        getById: async () => ({
          id: 9,
          name: 'Ranked Airport',
          website: 'https://ranked.example.com/',
          status: 'normal',
          is_listed: true,
          plan_price_month: 10,
          has_trial: false,
          tags: [],
          created_at: '2026-05-04',
        }),
      },
      applicantBillingRepository: {
        processOutboundClick: async () => {
          processed = true;
          throw new Error('must not charge');
        },
      },
      marketingSettingsService: {
        getConfig: async () => ({ click_charge_amount: 0.6, rank_click_charge_amounts: { 1: 1.2 } }),
      },
      scoreRepository: {
        getPublicBillingRankByDate: async () => {
          throw new Error('ranking unavailable');
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
    assert.equal(response.status, 500);
    assert.equal(processed, false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /outbound/airports/:id redirects bare website domains as https URLs', async () => {
  const app = express();
  app.use(
    createOutboundRoutes({
      ...outboundRankingDeps,
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

test('GET /outbound/airports/:id redirects subscription links without billing', async () => {
  const processed: Array<Record<string, unknown>> = [];
  const app = express();
  app.use(
    createOutboundRoutes({
      ...outboundRankingDeps,
      airportRepository: {
        getById: async () => ({
          id: 6,
          name: 'Subscribe Airport',
          website: 'https://airport.example.com/',
          subscription_url: 'https://subscribe.example.com/path?plan=monthly',
          status: 'normal',
          is_listed: true,
          plan_price_month: 12,
          has_trial: false,
          tags: [],
          created_at: '2026-05-04',
        }),
      },
      applicantBillingRepository: {
        processOutboundClick: async (input) => {
          processed.push(input);
          return {
            status: 'insufficient_balance',
            billed_amount: 0,
            airport_name: 'Subscribe Airport',
            balance_after: 0,
          };
        },
      },
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/outbound/airports/6?target=subscription_url&placement=home_card`, {
      redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(processed.length, 0);
    const location = response.headers.get('location') || '';
    const redirected = new URL(location);
    assert.equal(redirected.origin, 'https://subscribe.example.com');
    assert.equal(redirected.searchParams.get('plan'), 'monthly');
    assert.equal(redirected.searchParams.get('utm_source'), 'gaterank');
    assert.equal(redirected.searchParams.get('utm_medium'), 'referral');
    assert.equal(redirected.searchParams.get('utm_campaign'), 'subscription_referral');
    assert.match(redirected.searchParams.get('gr_click_id') || '', /^[0-9a-f-]{36}$/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /outbound/airports/:id redirects when balance is insufficient', async () => {
  const app = express();
  app.use(
    createOutboundRoutes({
      ...outboundRankingDeps,
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
          status: 'free',
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

    assert.equal(response.status, 302);
    const location = response.headers.get('location') || '';
    const redirected = new URL(location);
    assert.equal(redirected.origin, 'https://airport.example.com');
    assert.equal(redirected.searchParams.get('utm_source'), 'gaterank');
    assert.equal(redirected.searchParams.get('utm_campaign'), 'paid_click');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /outbound/airports/:id accepts news article placement for paid links', async () => {
  const processed: Array<Record<string, unknown>> = [];
  const app = express();
  app.use(
    createOutboundRoutes({
      ...outboundRankingDeps,
      airportRepository: {
        getById: async () => ({
          id: 12,
          name: 'News Airport',
          website: 'https://news-airport.example.com/',
          status: 'normal',
          is_listed: true,
          plan_price_month: 18,
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
            airport_name: 'News Airport',
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
    const response = await fetch(`http://127.0.0.1:${port}/outbound/airports/12?target=website&placement=news_article`, {
      redirect: 'manual',
    });

    assert.equal(response.status, 302);
    assert.equal(processed[0]?.placement, 'news_article');
    assert.equal(processed[0]?.target_kind, 'website');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /outbound/airports/:id rejects invalid placement', async () => {
  const app = express();
  app.use(
    createOutboundRoutes({
      ...outboundRankingDeps,
      airportRepository: {
        getById: async () => ({
          id: 12,
          name: 'News Airport',
          website: 'https://news-airport.example.com/',
          status: 'normal',
          is_listed: true,
          plan_price_month: 18,
          has_trial: false,
          tags: [],
          created_at: '2026-05-04',
        }),
      },
      applicantBillingRepository: {
        processOutboundClick: async () => ({
          status: 'billed',
          billed_amount: 1,
          airport_name: 'News Airport',
          balance_after: 9,
        }),
      },
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/outbound/airports/12?target=website&placement=bad`, {
      redirect: 'manual',
    });

    assert.equal(response.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
