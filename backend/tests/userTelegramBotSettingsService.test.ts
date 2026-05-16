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
  assert.equal(calls[0]!.url, 'https://api.telegram.org/bot123456:abcdefghi/getMe');
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
