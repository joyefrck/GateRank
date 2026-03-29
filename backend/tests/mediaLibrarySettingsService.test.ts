import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaLibrarySettingsService,
  type MediaLibrarySettingsInput,
} from '../src/services/mediaLibrarySettingsService';

test('MediaLibrarySettingsService returns default empty admin view', async () => {
  const service = new MediaLibrarySettingsService({
    systemSettingRepository: {
      getByKey: async () => null,
      upsert: async () => undefined,
    },
  });

  const view = await service.getAdminSettings();

  assert.equal(view.providers.pexels.enabled, false);
  assert.equal(view.providers.pexels.has_api_key, false);
  assert.equal(view.providers.pexels.api_key_masked, null);
  assert.equal(view.providers.pexels.timeout_ms, 8000);
  assert.equal(view.updated_at, null);
  assert.equal(view.updated_by, null);
});

test('MediaLibrarySettingsService saves and masks pexels key', async () => {
  let storedValue: MediaLibrarySettingsInput | null = null;
  const service = new MediaLibrarySettingsService({
    systemSettingRepository: {
      getByKey: async () => storedValue
        ? {
          setting_key: 'media_libraries',
          value_json: storedValue,
          updated_by: 'admin',
          created_at: '2026-03-29 10:00:00',
          updated_at: '2026-03-29 10:00:00',
        }
        : null,
      upsert: async (_settingKey, value) => {
        storedValue = value as MediaLibrarySettingsInput;
      },
    },
  });

  const view = await service.updateAdminSettings({
    providers: {
      pexels: {
        enabled: true,
        api_key: 'pexels-secret-key',
        timeout_ms: 9000,
      },
    },
  }, 'admin');

  assert.equal(view.providers.pexels.enabled, true);
  assert.equal(view.providers.pexels.has_api_key, true);
  assert.equal(view.providers.pexels.api_key_masked, 'pexe***-key');
  assert.equal(view.providers.pexels.timeout_ms, 9000);
});

test('MediaLibrarySettingsService clears key and normalizes invalid timeout', async () => {
  let storedValue: unknown = {
    providers: {
      pexels: {
        enabled: true,
        api_key: 'keep-me',
        timeout_ms: 6000,
      },
    },
  };

  const service = new MediaLibrarySettingsService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'media_libraries',
        value_json: storedValue,
        updated_by: 'admin',
        created_at: '2026-03-29 10:00:00',
        updated_at: '2026-03-29 10:00:00',
      }),
      upsert: async (_settingKey, value) => {
        storedValue = value;
      },
    },
  });

  await service.updateAdminSettings({
    providers: {
      pexels: {
        api_key: '',
        timeout_ms: 0,
      },
    },
  }, 'editor');

  const config = await service.getPexelsConfig();
  assert.equal(config.api_key, '');
  assert.equal(config.timeout_ms, 8000);
  assert.equal(config.enabled, true);
});
