import test from 'node:test';
import assert from 'node:assert/strict';
import { UserTelegramBotSettingsService } from '../src/services/userTelegramBotSettingsService';

test('UserTelegramBotSettingsService validates bot token and masks secrets', async () => {
  let stored: unknown = null;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const service = new UserTelegramBotSettingsService({
    systemSettingRepository: {
      getByKey: async () => stored
        ? {
            setting_key: 'user_telegram_bot',
            value_json: stored,
            updated_by: 'admin',
            created_at: '2026-05-16 10:00:00',
            updated_at: '2026-05-16 10:00:00',
          }
        : null,
      upsert: async (_key, value) => {
        stored = value;
      },
    },
    fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({
        ok: true,
        result: {
          id: 123,
          is_bot: true,
          username: 'gaterank_user_bot',
        },
      }), { status: 200 });
    },
  });

  const view = await service.updateAdminSettings({
    enabled: true,
    bot_token: '123456:abcdefghi',
    api_base: 'https://api.telegram.org/',
    webhook_origin: 'https://example.com/',
  }, 'admin');

  assert.equal(view.enabled, true);
  assert.equal(view.bot_username, 'gaterank_user_bot');
  assert.equal(view.bot_token_masked, '1234...fghi');
  assert.equal(view.webhook_origin, 'https://example.com');
  assert.equal(view.webhook_url?.startsWith('https://example.com/api/v1/telegram/user-bot/webhook/'), true);
  assert.equal(view.webhook_ready, true);
  assert.equal(view.webhook_origin_source, 'manual');
  assert.equal(calls[0]!.url, 'https://api.telegram.org/bot123456:abcdefghi/getMe');
  assert.equal(calls[1]!.url, 'https://api.telegram.org/bot123456:abcdefghi/setWebhook');
});

test('UserTelegramBotSettingsService syncWebhook posts Telegram webhook URL', async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const service = new UserTelegramBotSettingsService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'user_telegram_bot',
        value_json: {
          enabled: true,
          bot_token: '123456:abcdefghi',
          bot_username: 'gaterank_user_bot',
          api_base: 'https://api.telegram.org',
          webhook_origin: 'https://example.com',
          webhook_secret: 'secret-token',
          webhook_last_synced_at: '2026-05-16T10:00:00.000Z',
        },
        updated_by: 'admin',
        created_at: '2026-05-16 10:00:00',
        updated_at: '2026-05-16 10:00:00',
      }),
      upsert: async () => {},
    },
    fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body || '{}')) });
      return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
    },
  });

  const result = await service.syncWebhook();

  assert.equal(result.webhook_url, 'https://example.com/api/v1/telegram/user-bot/webhook/secret-token');
  assert.equal(calls[0]!.url, 'https://api.telegram.org/bot123456:abcdefghi/setWebhook');
  assert.deepEqual(calls[0]!.body, {
    url: 'https://example.com/api/v1/telegram/user-bot/webhook/secret-token',
    allowed_updates: ['message', 'callback_query'],
  });
});

test('UserTelegramBotSettingsService rejects enabled save without public webhook origin and does not save', async () => {
  let stored: unknown = null;
  const calls: string[] = [];
  const service = new UserTelegramBotSettingsService({
    systemSettingRepository: {
      getByKey: async (key) => {
        if (key === 'payment_gateway') {
          return null;
        }
        return stored
          ? {
              setting_key: 'user_telegram_bot',
              value_json: stored,
              updated_by: 'admin',
              created_at: '2026-05-16 10:00:00',
              updated_at: '2026-05-16 10:00:00',
            }
          : null;
      },
      upsert: async (_key, value) => {
        stored = value;
      },
    },
    fetchImpl: async (url: string | URL | Request) => {
      calls.push(String(url));
      return new Response(JSON.stringify({
        ok: true,
        result: {
          id: 123,
          is_bot: true,
          username: 'gaterank_user_bot',
        },
      }), { status: 200 });
    },
  });

  await assert.rejects(
    () => service.updateAdminSettings({
      enabled: true,
      bot_token: '123456:abcdefghi',
      request_origin: 'http://localhost:3000',
    }, 'admin'),
    /公网 HTTPS API 域名/,
  );

  assert.equal(stored, null);
  assert.deepEqual(calls, ['https://api.telegram.org/bot123456:abcdefghi/getMe']);
});

test('UserTelegramBotSettingsService infers webhook origin from payment gateway and syncs on save', async () => {
  let stored: unknown = null;
  const calls: Array<{ url: string; body: unknown }> = [];
  const service = new UserTelegramBotSettingsService({
    systemSettingRepository: {
      getByKey: async (key) => {
        if (key === 'payment_gateway') {
          return {
            setting_key: 'payment_gateway',
            value_json: {
              notify_origin: 'https://pay.gaterank.test/',
            },
            updated_by: 'admin',
            created_at: '2026-05-16 10:00:00',
            updated_at: '2026-05-16 10:00:00',
          };
        }
        return stored
          ? {
              setting_key: 'user_telegram_bot',
              value_json: stored,
              updated_by: 'admin',
              created_at: '2026-05-16 10:00:00',
              updated_at: '2026-05-16 10:00:00',
            }
          : null;
      },
      upsert: async (_key, value) => {
        stored = value;
      },
    },
    fetchImpl: async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : null });
      if (String(url).endsWith('/getMe')) {
        return new Response(JSON.stringify({
          ok: true,
          result: {
            id: 123,
            is_bot: true,
            username: 'gaterank_user_bot',
          },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
    },
  });

  const view = await service.updateAdminSettings({
    enabled: true,
    bot_token: '123456:abcdefghi',
  }, 'admin');

  assert.equal(view.webhook_origin, 'https://pay.gaterank.test');
  assert.equal(view.webhook_origin_source, 'payment_gateway');
  assert.equal(view.webhook_ready, true);
  assert.equal(calls[1]!.url, 'https://api.telegram.org/bot123456:abcdefghi/setWebhook');
  assert.match((calls[1]!.body as { url: string }).url, /^https:\/\/pay\.gaterank\.test\/api\/v1\/telegram\/user-bot\/webhook\//);
});

test('UserTelegramBotSettingsService rejects localhost webhook origin', async () => {
  const service = new UserTelegramBotSettingsService({
    systemSettingRepository: {
      getByKey: async () => null,
      upsert: async () => {
        throw new Error('should not save');
      },
    },
    fetchImpl: async () => new Response(JSON.stringify({
      ok: true,
      result: {
        id: 123,
        is_bot: true,
        username: 'gaterank_user_bot',
      },
    }), { status: 200 }),
  });

  await assert.rejects(
    () => service.updateAdminSettings({
      enabled: true,
      bot_token: '123456:abcdefghi',
      webhook_origin: 'http://localhost:8787',
    }, 'admin'),
    /公网 HTTPS API 域名/,
  );
});
