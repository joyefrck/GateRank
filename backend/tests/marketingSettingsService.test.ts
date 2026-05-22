import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HOME_SECTION_LIMITS,
  DEFAULT_MARKETING_APPLICATION_FEE_AMOUNT,
  DEFAULT_MARKETING_CLICK_CHARGE_AMOUNT,
  DEFAULT_MARKETING_RECHARGE_AMOUNTS,
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
  assert.deepEqual(view.recharge_amounts, DEFAULT_MARKETING_RECHARGE_AMOUNTS);
  assert.equal(view.admin_telegram_username, null);
  assert.deepEqual(view.home_section_limits, DEFAULT_HOME_SECTION_LIMITS);
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
  assert.deepEqual(view.recharge_amounts, DEFAULT_MARKETING_RECHARGE_AMOUNTS);
  assert.equal(view.admin_telegram_username, null);
  assert.deepEqual(view.home_section_limits, DEFAULT_HOME_SECTION_LIMITS);
});

test('MarketingSettingsService saves application, click fees, recharge amounts, Telegram username and home section limits under marketing billing key', async () => {
  const { records, repository } = createSettingsRepository();
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  const view = await service.updateAdminSettings({
    application_fee_amount: 288.235,
    click_charge_amount: 1.256,
    recharge_amounts: [500, 100, 300],
    admin_telegram_username: 'https://t.me/GateRank_Admin',
    home_section_limits: {
      today_pick: 6,
      most_stable: 4,
      best_value: 5,
      new_entries: 8,
      risk_alerts: 2,
    },
  }, 'admin');

  assert.equal(view.application_fee_amount, 288.24);
  assert.equal(view.click_charge_amount, 1.26);
  assert.deepEqual(view.recharge_amounts, [100, 300, 500]);
  assert.equal(view.admin_telegram_username, 'GateRank_Admin');
  assert.deepEqual(view.home_section_limits, {
    today_pick: 6,
    most_stable: 4,
    best_value: 5,
    new_entries: 8,
    risk_alerts: 2,
  });
  assert.deepEqual(records.get('marketing_billing'), {
    application_fee_amount: 288.24,
    click_charge_amount: 1.26,
    recharge_amounts: [100, 300, 500],
    admin_telegram_username: 'GateRank_Admin',
    home_section_limits: {
      today_pick: 6,
      most_stable: 4,
      best_value: 5,
      new_entries: 8,
      risk_alerts: 2,
    },
  });
});

test('MarketingSettingsService keeps default home section limits for legacy marketing billing records', async () => {
  const { repository } = createSettingsRepository({
    marketing_billing: {
      application_fee_amount: 288,
      click_charge_amount: 1.5,
      admin_telegram_username: 'GateRank_Admin',
    },
  });
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  const view = await service.getAdminSettings();

  assert.equal(view.application_fee_amount, 288);
  assert.equal(view.click_charge_amount, 1.5);
  assert.deepEqual(view.recharge_amounts, DEFAULT_MARKETING_RECHARGE_AMOUNTS);
  assert.deepEqual(view.home_section_limits, DEFAULT_HOME_SECTION_LIMITS);
});

test('MarketingSettingsService rejects invalid recharge amounts on update', async () => {
  const { repository } = createSettingsRepository();
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  for (const recharge_amounts of [
    [],
    [100, 100],
    [0, 100],
    [99.5, 100],
    [10, 20, 30, 40, 50, 60, 70, 80, 90],
  ]) {
    await assert.rejects(
      () => service.updateAdminSettings({ recharge_amounts }, 'admin'),
      (error: unknown) => {
        const next = error as { code?: string; message?: string };
        assert.equal(next.code, 'BAD_REQUEST');
        assert.match(String(next.message || ''), /recharge_amounts/);
        return true;
      },
    );
  }
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

test('MarketingSettingsService rejects invalid home section limits on update', async () => {
  const { repository } = createSettingsRepository();
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  await assert.rejects(
    () => service.updateAdminSettings({ home_section_limits: { today_pick: 0 } }, 'admin'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'BAD_REQUEST');
      assert.match(String(next.message || ''), /home_section_limits\.today_pick/);
      return true;
    },
  );

  await assert.rejects(
    () => service.updateAdminSettings({ home_section_limits: { most_stable: 13 } }, 'admin'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'BAD_REQUEST');
      assert.match(String(next.message || ''), /home_section_limits\.most_stable/);
      return true;
    },
  );

  await assert.rejects(
    () => service.updateAdminSettings({ home_section_limits: { best_value: 2.5 } }, 'admin'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'BAD_REQUEST');
      assert.match(String(next.message || ''), /home_section_limits\.best_value/);
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
