import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MARKETING_APPLICATION_FEE_AMOUNT,
  DEFAULT_MARKETING_CLICK_CHARGE_AMOUNT,
  MarketingSettingsService,
} from '../src/services/marketingSettingsService';

function createSettingsRepository(initial: Record<string, unknown> = {}) {
  const records = new Map<string, unknown>(Object.entries(initial));
  return {
    records,
    repository: {
      getByKey: async (settingKey: string) => {
        if (!records.has(settingKey)) {
          return null;
        }
        return {
          setting_key: settingKey,
          value_json: records.get(settingKey),
          updated_by: 'admin',
          created_at: '2026-05-10 08:00:00',
          updated_at: '2026-05-10 08:00:00',
        };
      },
      upsert: async (settingKey: string, value: unknown) => {
        records.set(settingKey, value);
      },
    },
  };
}

test('MarketingSettingsService returns defaults when no settings exist', async () => {
  const { repository } = createSettingsRepository();
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  const view = await service.getAdminSettings();

  assert.equal(view.application_fee_amount, DEFAULT_MARKETING_APPLICATION_FEE_AMOUNT);
  assert.equal(view.click_charge_amount, DEFAULT_MARKETING_CLICK_CHARGE_AMOUNT);
  assert.equal(view.admin_telegram_username, null);
});

test('MarketingSettingsService falls back to legacy payment gateway application fee', async () => {
  const { repository } = createSettingsRepository({
    payment_gateway: {
      application_fee_amount: 88.888,
    },
  });
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  const view = await service.getAdminSettings();

  assert.equal(view.application_fee_amount, 88.89);
  assert.equal(view.click_charge_amount, DEFAULT_MARKETING_CLICK_CHARGE_AMOUNT);
  assert.equal(view.admin_telegram_username, null);
});

test('MarketingSettingsService saves application, click fees and Telegram username under marketing billing key', async () => {
  const { records, repository } = createSettingsRepository();
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  const view = await service.updateAdminSettings({
    application_fee_amount: 288.235,
    click_charge_amount: 1.256,
    admin_telegram_username: 'https://t.me/GateRank_Admin',
  }, 'admin');

  assert.equal(view.application_fee_amount, 288.24);
  assert.equal(view.click_charge_amount, 1.26);
  assert.equal(view.admin_telegram_username, 'GateRank_Admin');
  assert.deepEqual(records.get('marketing_billing'), {
    application_fee_amount: 288.24,
    click_charge_amount: 1.26,
    admin_telegram_username: 'GateRank_Admin',
  });
});

test('MarketingSettingsService rejects non-positive amounts on update', async () => {
  const { repository } = createSettingsRepository();
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  await assert.rejects(
    () => service.updateAdminSettings({ click_charge_amount: 0 }, 'admin'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'BAD_REQUEST');
      assert.match(String(next.message || ''), /click_charge_amount/);
      return true;
    },
  );
});

test('MarketingSettingsService rejects invalid Telegram username on update', async () => {
  const { repository } = createSettingsRepository();
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  await assert.rejects(
    () => service.updateAdminSettings({ admin_telegram_username: 'https://t.me/invalid-user' }, 'admin'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'BAD_REQUEST');
      assert.match(String(next.message || ''), /admin_telegram_username/);
      return true;
    },
  );
});
