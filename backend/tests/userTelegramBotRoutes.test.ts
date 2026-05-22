import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { NextFunction, Request as ExpressRequest, Response } from 'express';
import { AddressInfo } from 'node:net';
import { TELEGRAM_LOGIN_START_PREFIX } from '../src/repositories/applicantTelegramLoginFlowRepository';
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
      countClicksForDate: async () => 3,
    },
    paymentGatewaySettingsService: {
      getConfig: async () => ({
        enabled: true,
        pid: 'pid',
        private_key: 'private',
        platform_public_key: 'public',
        epay: { enabled: true },
        usdt: {
          enabled: false,
          gateway_url: '',
          merchant_id: '',
          secret_key: '',
        },
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
      getConfig: async () => ({ click_charge_amount: 0.6, recharge_amounts: [100, 300, 500, 1000] }),
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
  assert.match(String(telegramCalls[0]!.body.text), /上架状态：正常/);
});

test('user telegram webhook reports listed airport as normal even with stale auto-unlisted marker', async () => {
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
        ensureWalletForAccount: async () => ({
          id: 1,
          applicant_account_id: 1,
          application_id: 7,
          airport_id: 9,
          airport_is_listed: true,
          balance: 9913.4,
          auto_unlisted_at: '2026-05-16T10:00:00+08:00',
          created_at: '2026-05-16T10:00:00+08:00',
          updated_at: '2026-05-16T10:00:00+08:00',
        }),
      },
    }), async (port) => {
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

  const text = String(telegramCalls[0]!.body.text);
  assert.match(text, /账户余额：¥9913\.40/);
  assert.match(text, /上架状态：正常/);
  assert.doesNotMatch(text, /欠费下架/);
});

test('user telegram webhook reports explicitly unlisted airport as removed', async () => {
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
        ensureWalletForAccount: async () => ({
          id: 1,
          applicant_account_id: 1,
          application_id: 7,
          airport_id: 9,
          airport_is_listed: false,
          balance: 9913.4,
          auto_unlisted_at: null,
          created_at: '2026-05-16T10:00:00+08:00',
          updated_at: '2026-05-16T10:00:00+08:00',
        }),
      },
    }), async (port) => {
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

  assert.match(String(telegramCalls[0]!.body.text), /上架状态：已下架/);
});

test('user telegram webhook replies command menu hint when bound user sends bare start', async () => {
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
  assert.match(text, /输入 \/ 可选择查询余额、流水、访问记录或充值/);
  assert.doesNotMatch(text, /\/balance - /);
  assert.doesNotMatch(text, /\/today - /);
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

test('user telegram webhook confirms bind with command menu hint', async () => {
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const consumedTokens: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };
  try {
    await withServer(createDeps({
      applicantTelegramBindingRepository: {
        ...createDeps().applicantTelegramBindingRepository,
        consumeBindToken: async (token: string) => {
          consumedTokens.push(token);
          return {
            id: 1,
            applicant_account_id: 1,
            telegram_user_id: '42',
            telegram_chat_id: '84',
            telegram_username: 'owner',
            telegram_first_name: 'Owner',
            telegram_last_name: null,
            bound_at: '2026-05-16T10:00:00+08:00',
            updated_at: '2026-05-16T10:00:00+08:00',
          };
        },
      },
    }), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: '/start bind-token',
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

  assert.deepEqual(consumedTokens, ['bind-token']);
  const text = String(telegramCalls[0]!.body.text);
  assert.match(text, /绑定成功/);
  assert.match(text, /输入 \/ 可选择查询余额、流水、访问记录或充值/);
  assert.doesNotMatch(text, /\/balance - /);
  assert.doesNotMatch(text, /\/recharge - /);
});

test('user telegram webhook completes Telegram login start token for bound user', async () => {
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const completed: Array<{ token: string; applicantAccountId: number; telegramUserId: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };
  try {
    await withServer(createDeps({
      applicantTelegramBindingRepository: {
        ...createDeps().applicantTelegramBindingRepository,
        consumeBindToken: async () => {
          throw new Error('bind token should not be consumed');
        },
      },
      applicantTelegramLoginFlowRepository: {
        completeByStartToken: async (token: string, applicantAccountId: number, telegramUserId: string) => {
          completed.push({ token, applicantAccountId, telegramUserId });
          return 'completed';
        },
        failByStartToken: async () => {
          throw new Error('not used');
        },
      },
    }), async (port) => {
      const token = `${TELEGRAM_LOGIN_START_PREFIX}flow_token`;
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: `/start ${token}`,
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

  assert.deepEqual(completed, [{
    token: `${TELEGRAM_LOGIN_START_PREFIX}flow_token`,
    applicantAccountId: 1,
    telegramUserId: '42',
  }]);
  assert.match(String(telegramCalls[0]!.body.text), /Telegram 登录已确认/);
});

test('user telegram webhook fails Telegram login start token for unbound user', async () => {
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const failed: Array<{ token: string; reason: string; telegramUserId: string | null | undefined }> = [];
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
        consumeBindToken: async () => {
          throw new Error('bind token should not be consumed');
        },
      },
      applicantTelegramLoginFlowRepository: {
        completeByStartToken: async () => {
          throw new Error('not used');
        },
        failByStartToken: async (token: string, reason: string, telegramUserId?: string | null) => {
          failed.push({ token, reason, telegramUserId });
          return 'failed';
        },
      },
    }), async (port) => {
      const token = `${TELEGRAM_LOGIN_START_PREFIX}flow_token`;
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: `/start ${token}`,
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

  assert.equal(failed.length, 1);
  assert.equal(failed[0]!.token, `${TELEGRAM_LOGIN_START_PREFIX}flow_token`);
  assert.equal(failed[0]!.telegramUserId, '42');
  assert.match(failed[0]!.reason, /尚未绑定申请人后台/);
  assert.match(String(telegramCalls[0]!.body.text), /尚未绑定申请人后台/);
});

test('user telegram webhook replies today visit count for bound user', async () => {
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const countInputs: Array<{ applicantAccountId: number; eventDate: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };
  try {
    await withServer(createDeps({
      applicantBillingRepository: {
        ...createDeps().applicantBillingRepository,
        countClicksForDate: async (applicantAccountId: number, eventDate: string) => {
          countInputs.push({ applicantAccountId, eventDate });
          return 8;
        },
      },
    }), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: '/today',
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

  assert.equal(countInputs.length, 1);
  assert.equal(countInputs[0]!.applicantAccountId, 1);
  assert.match(countInputs[0]!.eventDate, /^\d{4}-\d{2}-\d{2}$/);
  const text = String(telegramCalls[0]!.body.text);
  assert.match(text, /今日访问量：8 次/);
  assert.match(text, /统计日期：\d{4}-\d{2}-\d{2}/);
  assert.match(text, /口径：当前绑定账号名下的访问记录/);
});

test('user telegram webhook asks unbound user to bind before today visit count', async () => {
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
            text: '/today',
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

  assert.match(String(telegramCalls[0]!.body.text), /此 Telegram 账号尚未绑定 GateRank 申请人账号/);
});

test('user telegram webhook sends recharge inline keyboard from command menu entry', async () => {
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };
  try {
    await withServer(createDeps({
      marketingSettingsService: {
        getConfig: async () => ({ click_charge_amount: 0.6, recharge_amounts: [200, 800] }),
      },
    }), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: '/recharge',
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

  assert.match(String(telegramCalls[0]!.body.text), /请选择充值金额和支付渠道/);
  const replyMarkup = telegramCalls[0]!.body.reply_markup as {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
  assert.deepEqual(replyMarkup.inline_keyboard[0], [
    { text: '¥200 支付宝', callback_data: 'gr_recharge:200:alipay' },
    { text: '¥200 微信', callback_data: 'gr_recharge:200:wxpay' },
  ]);
  assert.deepEqual(replyMarkup.inline_keyboard[1], [
    { text: '¥800 支付宝', callback_data: 'gr_recharge:800:alipay' },
    { text: '¥800 微信', callback_data: 'gr_recharge:800:wxpay' },
  ]);
});

test('user telegram webhook sends only USDT recharge options when epay switch is disabled', async () => {
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };
  try {
    await withServer(createDeps({
      paymentGatewaySettingsService: {
        getConfig: async () => ({
          enabled: true,
          pid: 'pid',
          private_key: 'private',
          platform_public_key: 'public',
          epay: { enabled: false },
          usdt: {
            enabled: true,
            gateway_url: 'https://pay-usdt.example.com',
            merchant_id: '1000',
            secret_key: 'secret',
          },
          notify_origin: 'https://api.example.com',
        }),
      },
    }), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            text: '/recharge',
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

  const replyMarkup = telegramCalls[0]!.body.reply_markup as {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
  assert.deepEqual(replyMarkup.inline_keyboard[0], [
    { text: '¥100 USDT', callback_data: 'gr_recharge:100:usdt' },
  ]);
});

test('user telegram webhook replies command menu hint for unknown text', async () => {
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
  assert.match(text, /暂不支持这条消息/);
  assert.match(text, /输入 \/ 可选择查询余额、流水、访问记录或充值/);
  assert.doesNotMatch(text, /\/balance - /);
  assert.doesNotMatch(text, /\/transactions - /);
  assert.doesNotMatch(text, /\/recharge - /);
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
      marketingSettingsService: {
        getConfig: async () => ({ click_charge_amount: 0.6, recharge_amounts: [250] }),
      },
    }), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query: {
            id: 'cb-1',
            data: 'gr_recharge:250:alipay',
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

  assert.deepEqual(createdOrders, [{ amount: 250, channel: 'alipay' }]);
  assert.ok(telegramCalls.some((call) => call.url.endsWith('/answerCallbackQuery')));
  assert.ok(telegramCalls.some((call) => String(call.body.text || '').includes('https://pay.example.com/order')));
});

test('user telegram webhook rejects recharge callback amount outside marketing settings', async () => {
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
      marketingSettingsService: {
        getConfig: async () => ({ click_charge_amount: 0.6, recharge_amounts: [250] }),
      },
    }), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query: {
            id: 'cb-stale-amount',
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

  assert.deepEqual(createdOrders, []);
  assert.ok(telegramCalls.some((call) => call.url.endsWith('/answerCallbackQuery')));
  assert.ok(telegramCalls.some((call) => String(call.body.text || '').includes('充值选项无效')));
});

test('user telegram webhook rejects stale epay recharge callback when epay switch is disabled', async () => {
  const createdOrders: Array<{ amount: number; channel: string }> = [];
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };

  try {
    await withServer(createDeps({
      paymentGatewaySettingsService: {
        getConfig: async () => ({
          enabled: true,
          pid: 'pid',
          private_key: 'private',
          platform_public_key: 'public',
          epay: { enabled: false },
          usdt: {
            enabled: true,
            gateway_url: 'https://pay-usdt.example.com',
            merchant_id: '1000',
            secret_key: 'secret',
          },
          notify_origin: 'https://api.example.com',
        }),
      },
      applicantBillingRepository: {
        ...createDeps().applicantBillingRepository,
        createRechargeOrder: async (input: { amount: number; channel: string }) => {
          createdOrders.push({ amount: input.amount, channel: input.channel });
          return 1;
        },
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('stale epay callback should not create gateway order');
        },
      },
    }), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query: {
            id: 'cb-epay-disabled',
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

  assert.deepEqual(createdOrders, []);
  assert.ok(telegramCalls.some((call) => call.url.endsWith('/answerCallbackQuery')));
  assert.ok(telegramCalls.some((call) => String(call.body.text || '').includes('当前支付渠道不可用')));
});

test('user telegram webhook creates USDT recharge order with payment url button', async () => {
  const createdOrders: Array<{ amount: number; channel: string }> = [];
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };

  try {
    await withServer(createDeps({
      paymentGatewaySettingsService: {
        getConfig: async () => ({
          enabled: true,
          pid: 'pid',
          private_key: 'private',
          platform_public_key: 'public',
          epay: { enabled: false },
          usdt: {
            enabled: true,
            gateway_url: 'https://pay-usdt.example.com',
            merchant_id: '1000',
            secret_key: 'secret',
          },
          notify_origin: 'https://api.example.com',
        }),
      },
      applicantBillingRepository: {
        ...createDeps().applicantBillingRepository,
        createRechargeOrder: async (input: { amount: number; channel: string }) => {
          createdOrders.push({ amount: input.amount, channel: input.channel });
          return 1;
        },
        getRechargeOrderByOutTradeNo: async (outTradeNo: string) => ({
          id: 1,
          applicant_account_id: 1,
          out_trade_no: outTradeNo,
          channel: 'usdt',
          amount: 100,
          status: 'created',
          gateway_trade_no: 'gw-usdt-1',
          pay_type: 'usdt',
          pay_info: 'https://pay-usdt.example.com/pay/grt_1_usdt',
          paid_at: null,
          created_at: '2026-05-16T10:00:00+08:00',
        }),
      },
      paymentGatewayService: {
        createOrder: async () => ({
          trade_no: 'gw-usdt-1',
          pay_type: 'usdt',
          pay_info: 'https://pay-usdt.example.com/pay/grt_1_usdt',
        }),
      },
    }), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query: {
            id: 'cb-usdt',
            data: 'gr_recharge:100:usdt',
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

  assert.deepEqual(createdOrders, [{ amount: 100, channel: 'usdt' }]);
  const paymentMessage = telegramCalls.find((call) => String(call.body.text || '').includes('充值订单已创建'));
  assert.ok(paymentMessage);
  assert.match(String(paymentMessage!.body.text), /支付渠道：USDT/);
  assert.match(String(paymentMessage!.body.text), /https:\/\/pay-usdt\.example\.com\/pay\/grt_1_usdt/);
  assert.deepEqual(paymentMessage!.body.reply_markup, {
    inline_keyboard: [[{
      text: '打开 USDT 支付',
      url: 'https://pay-usdt.example.com/pay/grt_1_usdt',
    }]],
  });
});

test('user telegram webhook sends failure message when USDT gateway order creation fails', async () => {
  const createdOrders: Array<{ amount: number; channel: string }> = [];
  const telegramCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const loggedErrors: unknown[][] = [];
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    telegramCalls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  };
  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };

  try {
    await withServer(createDeps({
      paymentGatewaySettingsService: {
        getConfig: async () => ({
          enabled: true,
          pid: 'pid',
          private_key: 'private',
          platform_public_key: 'public',
          epay: { enabled: false },
          usdt: {
            enabled: true,
            gateway_url: 'https://pay-usdt.example.com',
            merchant_id: '1000',
            secret_key: 'secret',
          },
          notify_origin: 'https://api.example.com',
        }),
      },
      applicantBillingRepository: {
        ...createDeps().applicantBillingRepository,
        createRechargeOrder: async (input: { amount: number; channel: string }) => {
          createdOrders.push({ amount: input.amount, channel: input.channel });
          return 1;
        },
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('EPUSDT 下单失败');
        },
      },
    }), async (port) => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/v1/telegram/user-bot/webhook/secret-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query: {
            id: 'cb-usdt-fail',
            data: 'gr_recharge:100:usdt',
            message: { chat: { id: 84 } },
            from: { id: 42, username: 'owner' },
          },
        }),
      });
      assert.equal(response.status, 200);
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }

  assert.deepEqual(createdOrders, []);
  assert.equal(loggedErrors.length, 1);
  assert.ok(telegramCalls.some((call) => call.url.endsWith('/answerCallbackQuery')));
  const failureMessage = telegramCalls.find((call) => String(call.body.text || '').includes('充值订单创建失败'));
  assert.ok(failureMessage);
  assert.match(String(failureMessage!.body.text), /EPUSDT 下单失败/);
});
