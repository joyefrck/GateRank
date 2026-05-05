import test from 'node:test';
import assert from 'node:assert/strict';
import { XOAuthSettingsService } from '../src/services/xOAuthSettingsService';
import type { SystemSettingRecord } from '../src/repositories/systemSettingRepository';

function createSettingsRepository(initialValue: unknown = null) {
  let record: SystemSettingRecord | null = initialValue
    ? {
      setting_key: 'x_oauth',
      value_json: initialValue,
      updated_by: 'admin',
      created_at: '2026-05-05 10:00:00',
      updated_at: '2026-05-05 10:00:00',
    }
    : null;

  return {
    get record() {
      return record;
    },
    getByKey: async (settingKey: string) => (record?.setting_key === settingKey ? record : null),
    upsert: async (settingKey: string, value: unknown, updatedBy: string) => {
      record = {
        setting_key: settingKey,
        value_json: value,
        updated_by: updatedBy,
        created_at: record?.created_at || '2026-05-05 10:00:00',
        updated_at: '2026-05-05 10:01:00',
      };
    },
  };
}

test('XOAuthSettingsService saves and masks admin-managed X OAuth credentials', async () => {
  const repository = createSettingsRepository();
  const service = new XOAuthSettingsService({ systemSettingRepository: repository });

  const view = await service.updateAdminSettings({
    enabled: true,
    client_id: 'client-id',
    client_secret: 'super-secret-value',
    redirect_uri: 'http://127.0.0.1:3000/api/v1/portal/x-oauth/callback',
    authorize_url: 'https://twitter.com/i/oauth2/authorize',
    token_url: 'https://api.x.com/2/oauth2/token',
    me_url: 'https://api.x.com/2/users/me',
    scope: 'tweet.read users.read',
    code_challenge_method: 'plain',
  }, 'tester');

  assert.equal(view.enabled, true);
  assert.equal(view.client_id, 'client-id');
  assert.equal(view.has_client_secret, true);
  assert.equal(view.client_secret_masked, 'super-***-value');
  assert.equal(view.updated_by, 'tester');

  const runtime = await service.getConfig();
  assert.equal(runtime.clientId, 'client-id');
  assert.equal(runtime.clientSecret, 'super-secret-value');
  assert.equal(runtime.scope, 'tweet.read users.read');
  assert.equal(runtime.codeChallengeMethod, 'plain');
});

test('XOAuthSettingsService keeps existing secret when update omits client_secret', async () => {
  const repository = createSettingsRepository({
    enabled: true,
    client_id: 'old-client',
    client_secret: 'old-secret',
    redirect_uri: 'https://example.com/api/v1/portal/x-oauth/callback',
    authorize_url: 'https://twitter.com/i/oauth2/authorize',
    token_url: 'https://api.x.com/2/oauth2/token',
    me_url: 'https://api.x.com/2/users/me',
    scope: 'tweet.read users.read',
    code_challenge_method: 'plain',
  });
  const service = new XOAuthSettingsService({ systemSettingRepository: repository });

  await service.updateAdminSettings({
    enabled: true,
    client_id: 'new-client',
    redirect_uri: 'https://example.com/api/v1/portal/x-oauth/callback',
  }, 'tester');

  const runtime = await service.getConfig();
  assert.equal(runtime.clientId, 'new-client');
  assert.equal(runtime.clientSecret, 'old-secret');
});

test('XOAuthSettingsService clears existing secret when client_secret is empty', async () => {
  const repository = createSettingsRepository({
    enabled: false,
    client_id: 'client-id',
    client_secret: 'old-secret',
    redirect_uri: 'https://example.com/api/v1/portal/x-oauth/callback',
    authorize_url: 'https://twitter.com/i/oauth2/authorize',
    token_url: 'https://api.x.com/2/oauth2/token',
    me_url: 'https://api.x.com/2/users/me',
    scope: 'tweet.read users.read',
    code_challenge_method: 'plain',
  });
  const service = new XOAuthSettingsService({ systemSettingRepository: repository });

  await service.updateAdminSettings({ client_secret: '' }, 'tester');

  const view = await service.getAdminSettings();
  const runtime = await service.getConfig();
  assert.equal(view.has_client_secret, false);
  assert.equal(runtime.clientSecret, '');
});
