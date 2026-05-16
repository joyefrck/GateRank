import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { NextFunction, Request as ExpressRequest, Response } from 'express';
import { AddressInfo } from 'node:net';
import { createUserTelegramBotRoutes } from '../src/routes/userTelegramBotRoutes';

function createDeps(overrides: Record<string, unknown> = {}) {
  return {
    userTelegramBotSettingsService: {
      getConfig: async () => ({
        enabled: true,
        bot_token: '123456:abcdefghi',
        bot_username: 'gaterank_user_bot',
        api_base: 'https://api.telegram.org',
        webhook_origin: 'https://example.com',
        webhook_secret: 'secret-token',
      }),
    },
    applicantTelegramBindingRepository: {
      consumeBindToken: async () => ({
        id: 1,
        applicant_account_id: 1,
        telegram_user_id: '42',
        telegram_chat_id: '84',
        telegram_username: 'owner',
        telegram_first_name: 'Owner',
        telegram_last_name: null,
        bound_at: '2026-05-16T10:00:00+08:00',
        updated_at: '2026-05-16T10:00:00+08:00',
      }),
      getByTelegramUserId: async () => ({
        id: 1,
        applicant_account_id: 1,
        telegram_user_id: '42',
        telegram_chat_id: '84',
        telegram_username: 'owner',
        telegram_first_name: 'Owner',
        telegram_last_name: null,
        bound_at: '2026-05-16T10:00:00+08:00',
        updated_at: '2026-05-16T10:00:00+08:00',
      }),
      unbindApplicantAccount: async () => true,
    },
    applicantAccountRepository: {
      getById: async () => ({
        id: 1,
        application_id: 7,
        email: 'owner@example.com',
        password_hash: 'hash',
        must_change_password: false,
        last_login_at: null,
        created_at: '2026-05-16T10:00:00+08:00',
        updated_at: '2026-05-16T10:00:00+08:00',
      }),
    },
    airportApplicationRepository: {
      getById: async () => ({
        id: 7,
        name: 'Cloud Airport',
        review_status: 'reviewed',
        payment_status: 'paid',
      }),
    },
    applicantBillingRepository: {
      ensureWalletForAccount: async () => ({
        id: 1,
        applicant_account_id: 1,
        application_id: 7,
        airport_id: 9,
        airport_is_listed: true,
        balance: 120,
        auto_unlisted_at: null,
        created_at: '2026-05-16T10:00:00+08:00',
        updated_at: '2026-05-16T10:00:00+08:00',
      }),
      createRechargeOrder: async () => 1,
      getRechargeOrderByOutTradeNo: async (outTradeNo: string) => ({
        id: 1,
        applicant_account_id: 1,
        out_trade_no: outTradeNo,
        channel: 'alipay',
        amount: 100,
        status: 'created',
        gateway_trade_no: 'gw-1',
        pay_type: 'alipay',
        pay_info: 'https://pay.example.com/order',
        paid_at: null,
        created_at: '2026-05-16T10:00:00+08:00',
      }),
      listTransactions: async () => ({
        total: 1,
        items: [{
          id: 1,
          transaction_type: 'click_charge',
          amount: -0.6,
          balance_after: 119.4,
          reference_type: 'outbound_click',
          reference_id: 'click-1',
          description: '外链点击扣费 ¥0.60',
          created_at: '2026-05-16T10:00:00+08:00',
        }],
      }),
      listClicks: async () => ({
        total: 1,
        items: [{
          id: 1,
          click_id: 'click-1',
          airport_id: 9,
          airport_name: 'Cloud Airport',
          placement: 'home_card',
          target_kind: 'website',
          target_url: 'https://example.com',
          billing_status: 'billed',
          billed_amount: 0.6,
          occurred_at: '2026-05-16T10:00:00+08:00',
        }],
      }),
    },
    paymentGatewaySettingsService: {
      getConfig: async () => ({
        enabled: true,
        pid: 'pid',
        private_key: 'private',
        platform_public_key: 'public',
        notify_origin: 'https://api.example.com',
      }),
    },
    paymentGatewayService: {
      createOrder: async () => ({
        trade_no: 'gw-1',
        pay_type: 'alipay',
        pay_info: 'https://pay.example.com/order',
      }),
    },
    marketingSettingsService: {
      getConfig: async () => ({ click_charge_amount: 0.6 }),
    },
    ...overrides,
  };
}

async function withServer(deps: ReturnType<typeof createDeps>, fn: (port: number) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createUserTelegramBotRoutes(deps as never));
  app.use((err: { status?: number; message?: string }, _req: ExpressRequest, res: Response, _next: NextFunction) => {
    res.status(err.status || 500).json({ error: err.message || 'error' });
  });
  const server = app.listen(0);
  try {
    await fn((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('user telegram webhook rejects invalid secret', async () => {
  await withServer(createDeps(), async (port) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/wrong`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(response.status, 404);
  });
});

test('user telegram webhook replies balance for bound user', async () => {
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };
  try {
    await withServer(createDeps(), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: '/balance',
            chat: { id: 84 },
            from: { id: 42, username: 'owner' },
          },
        }),
      });
      assert.equal(response.status, 200);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(telegramCalls[0]!.url, 'https://api.telegram.org/bot123456:abcdefghi/sendMessage');
  assert.match(String(telegramCalls[0]!.body.text), /账户余额：¥120\.00/);
  assert.match(String(telegramCalls[0]!.body.text), /点击单价：¥0\.60 \/ 次/);
});

test('user telegram webhook replies help when bound user sends bare start', async () => {
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };
  try {
    await withServer(createDeps(), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: '/start',
            chat: { id: 84 },
            from: { id: 42, username: 'owner' },
          },
        }),
      });
      assert.equal(response.status, 200);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const text = String(telegramCalls[0]!.body.text);
  assert.match(text, /当前 Telegram 账号已绑定 GateRank 申请人账号/);
  assert.match(text, /\/balance - 查看账户余额、点击单价和上架状态/);
  assert.doesNotMatch(text, /生成绑定链接/);
});

test('user telegram webhook asks unbound user to generate link on bare start', async () => {
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };
  try {
    await withServer(createDeps({
      applicantTelegramBindingRepository: {
        ...createDeps().applicantTelegramBindingRepository,
        getByTelegramUserId: async () => null,
      },
    }), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: '/start',
            chat: { id: 84 },
            from: { id: 42, username: 'owner' },
          },
        }),
      });
      assert.equal(response.status, 200);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(String(telegramCalls[0]!.body.text), /请先在 GateRank 申请人后台生成绑定链接/);
});

test('user telegram webhook replies localized help for unknown text', async () => {
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };
  try {
    await withServer(createDeps(), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: '你好',
            chat: { id: 84 },
            from: { id: 42, username: 'owner' },
          },
        }),
      });
      assert.equal(response.status, 200);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const text = String(telegramCalls[0]!.body.text);
  assert.match(text, /\/balance - 查看账户余额、点击单价和上架状态/);
  assert.match(text, /\/transactions - 查看最近 5 条扣费流水/);
  assert.match(text, /\/clicks - 查看最近 5 条访问记录/);
  assert.match(text, /\/recharge - 创建充值支付链接/);
  assert.match(text, /\/unbind - 解绑当前 Telegram 账号/);
});

test('user telegram webhook unbinds current telegram account', async () => {
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const unboundApplicantIds: number[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };
  try {
    await withServer(createDeps({
      applicantTelegramBindingRepository: {
        ...createDeps().applicantTelegramBindingRepository,
        unbindApplicantAccount: async (applicantAccountId: number) => {
          unboundApplicantIds.push(applicantAccountId);
          return true;
        },
      },
    }), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: '/unbind',
            chat: { id: 84 },
            from: { id: 42, username: 'owner' },
          },
        }),
      });
      assert.equal(response.status, 200);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(unboundApplicantIds, [1]);
  assert.match(String(telegramCalls[0]!.body.text), /已解绑当前 Telegram 账号/);
});

test('user telegram webhook creates recharge order from callback', async () => {
  const createdOrders: Array<{ amount: number; channel: string }> = [];
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };

  try {
    await withServer(createDeps({
      applicantBillingRepository: {
        ...createDeps().applicantBillingRepository,
        createRechargeOrder: async (input: { amount: number; channel: string }) => {
          createdOrders.push({ amount: input.amount, channel: input.channel });
          return 1;
        },
      },
    }), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query: {
            id: 'cb-1',
            data: 'gr_recharge:100:alipay',
            message: { chat: { id: 84 } },
            from: { id: 42, username: 'owner' },
          },
        }),
      });
      assert.equal(response.status, 200);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(createdOrders, [{ amount: 100, channel: 'alipay' }]);
  assert.ok(telegramCalls.some((call) => call.url.endsWith('/answerCallbackQuery')));
  assert.ok(telegramCalls.some((call) => String(call.body.text || '').includes('https://pay.example.com/order')));
});
