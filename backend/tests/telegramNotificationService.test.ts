import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TelegramSendError,
  TelegramNotificationService,
  type NewAirportApplicationNotificationInput,
} from '../src/services/telegramNotificationService';

const sampleApplication: NewAirportApplicationNotificationInput = {
  applicationId: 7,
  requestId: 'req-1',
  name: 'Cloud Airport',
  website: 'https://example.com',
  websites: ['https://example.com', 'https://mirror.example.com'],
  planPriceMonth: 10,
  hasTrial: true,
  subscriptionUrl: 'https://example.com/sub',
  applicantEmail: 'contact@example.com',
  applicantTelegram: '@cloud',
  foundedOn: '2025-01-01',
  airportIntro: 'intro',
};

test('TelegramNotificationService uses stored DB config before env fallback', async () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChat = process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN = 'env-token';
  process.env.TELEGRAM_CHAT_ID = 'env-chat';

  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const service = new TelegramNotificationService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'telegram_notifications',
        value_json: {
          enabled: true,
          bot_token: 'db-token',
          chat_id: 'db-chat',
          api_base: 'https://api.telegram.org',
          timeout_ms: 5000,
        },
        updated_by: 'admin',
        created_at: '2026-03-25 10:00:00',
        updated_at: '2026-03-25 10:00:00',
      }),
      upsert: async () => undefined,
    },
    fetchImpl: async (url, init) => {
      calls.push({
        url: String(url),
        body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });

  try {
    await service.notifyNewAirportApplication(sampleApplication);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.telegram.org/botdb-token/sendMessage');
    assert.equal(calls[0].body.chat_id, 'db-chat');
  } finally {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    process.env.TELEGRAM_CHAT_ID = originalChat;
  }
});

test('TelegramNotificationService treats legacy stored config without enabled as active when credentials exist', async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const service = new TelegramNotificationService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'telegram_notifications',
        value_json: {
          bot_token: 'legacy-token',
          chat_id: 'legacy-chat',
          api_base: 'https://api.telegram.org',
          timeout_ms: 5000,
        },
        updated_by: 'admin',
        created_at: '2026-03-25 10:00:00',
        updated_at: '2026-03-25 10:00:00',
      }),
      upsert: async () => undefined,
    },
    fetchImpl: async (url, init) => {
      calls.push({
        url: String(url),
        body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });

  await service.notifyNewAirportApplication(sampleApplication);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.telegram.org/botlegacy-token/sendMessage');
  assert.equal(calls[0].body.chat_id, 'legacy-chat');
});

test('TelegramNotificationService falls back to env config when DB config is absent', async () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChat = process.env.TELEGRAM_CHAT_ID;
  const originalApiBase = process.env.TELEGRAM_API_BASE;
  process.env.TELEGRAM_BOT_TOKEN = 'env-token';
  process.env.TELEGRAM_CHAT_ID = 'env-chat';
  process.env.TELEGRAM_API_BASE = 'https://proxy.telegram.local';

  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const service = new TelegramNotificationService({
    systemSettingRepository: {
      getByKey: async () => null,
      upsert: async () => undefined,
    },
    fetchImpl: async (url, init) => {
      calls.push({
        url: String(url),
        body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    },
  });

  try {
    await service.notifyNewAirportApplication(sampleApplication);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://proxy.telegram.local/botenv-token/sendMessage');
    assert.equal(calls[0].body.chat_id, 'env-chat');
  } finally {
    process.env.TELEGRAM_BOT_TOKEN = originalToken;
    process.env.TELEGRAM_CHAT_ID = originalChat;
    process.env.TELEGRAM_API_BASE = originalApiBase;
  }
});

test('TelegramNotificationService sends webhook notifications when webhook mode is enabled', async () => {
  const originalApiBase = process.env.API_BASE;
  process.env.API_BASE = 'https://gaterank.example.com/';

  const calls: Array<{
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }> = [];
  const service = new TelegramNotificationService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'telegram_notifications',
        value_json: {
          enabled: true,
          delivery_mode: 'webhook',
          telegram_chat: {
            bot_token: '',
            chat_id: '',
            api_base: 'https://api.telegram.org',
            timeout_ms: 5000,
          },
          webhook: {
            url: 'https://bot.example.com/hooks/gaterank',
            bearer_token: 'webhook-secret',
            timeout_ms: 7000,
          },
        },
        updated_by: 'admin',
        created_at: '2026-03-25 10:00:00',
        updated_at: '2026-03-25 10:00:00',
      }),
      upsert: async () => undefined,
    },
    fetchImpl: async (_url, init) => {
      calls.push({
        url: String(_url),
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
      });
      return new Response(null, { status: 200 });
    },
  });

  try {
    await service.notifyNewAirportApplication(sampleApplication);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://bot.example.com/hooks/gaterank');
    assert.equal(calls[0].headers.authorization, 'Bearer webhook-secret');
    assert.equal(calls[0].body.event, 'airport_application.created');
    assert.equal(calls[0].body.source, 'gaterank');
    assert.deepEqual(calls[0].body.links, {
      api_url: 'https://gaterank.example.com/api/v1/admin/airport-applications/7',
    });
    assert.deepEqual(calls[0].body.application, {
      id: 7,
      name: 'Cloud Airport',
      website: 'https://example.com',
      websites: ['https://example.com', 'https://mirror.example.com'],
      plan_price_month: 10,
      has_trial: true,
      subscription_url: 'https://example.com/sub',
      applicant_email: 'contact@example.com',
      applicant_telegram: '@cloud',
      founded_on: '2025-01-01',
      airport_intro: 'intro',
    });
  } finally {
    process.env.API_BASE = originalApiBase;
  }
});

test('TelegramNotificationService sends webhook test requests without persisting', async () => {
  const calls: Array<{
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  }> = [];
  const service = new TelegramNotificationService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'telegram_notifications',
        value_json: {
          enabled: true,
          delivery_mode: 'webhook',
          telegram_chat: {
            bot_token: '',
            chat_id: '',
            api_base: 'https://api.telegram.org',
            timeout_ms: 5000,
          },
          webhook: {
            url: 'https://bot.example.com/hooks/gaterank',
            bearer_token: 'saved-token',
            timeout_ms: 5000,
          },
        },
        updated_by: 'admin',
        created_at: '2026-03-25 10:00:00',
        updated_at: '2026-03-25 10:00:00',
      }),
      upsert: async () => undefined,
    },
    fetchImpl: async (_url, init) => {
      calls.push({
        url: String(_url),
        headers: Object.fromEntries(new Headers(init?.headers).entries()),
        body: JSON.parse(String(init?.body || '{}')) as Record<string, unknown>,
      });
      return new Response(null, { status: 200 });
    },
  });

  await service.sendTestMessage({
    delivery_mode: 'webhook',
    webhook: {
      url: 'https://override.example.com/webhook',
      bearer_token: 'override-token',
      timeout_ms: 6000,
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://override.example.com/webhook');
  assert.equal(calls[0].headers.authorization, 'Bearer override-token');
  assert.equal(calls[0].body.event, 'airport_application.test');
  assert.equal(calls[0].body.delivery_mode, 'webhook');
  assert.equal(calls[0].body.message, 'GateRank webhook 配置测试');
});

test('TelegramNotificationService maps bot chat id errors to actionable message', async () => {
  const service = new TelegramNotificationService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'telegram_notifications',
        value_json: {
          enabled: true,
          bot_token: 'db-token',
          chat_id: '123456',
          api_base: 'https://api.telegram.org',
          timeout_ms: 5000,
        },
        updated_by: 'admin',
        created_at: '2026-03-25 10:00:00',
        updated_at: '2026-03-25 10:00:00',
      }),
      upsert: async () => undefined,
    },
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error_code: 403,
          description: "Forbidden: bots can't send messages to bots",
        }),
        { status: 403 },
      ),
  });

  await assert.rejects(
    () => service.sendTestMessage(),
    (error: unknown) => {
      assert.ok(error instanceof TelegramSendError);
      assert.match(error.message, /Chat ID 指向的是一个 bot/);
      return true;
    },
  );
});
