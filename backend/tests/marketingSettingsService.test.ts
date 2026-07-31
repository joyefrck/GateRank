import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_AIRPORT_AD_MONTHLY_PRICE,
  DEFAULT_HOME_SECTION_LIMITS,
  DEFAULT_MARKETING_APPLICATION_FEE_AMOUNT,
  DEFAULT_MARKETING_CLICK_CHARGE_AMOUNT,
  DEFAULT_MARKETING_RECHARGE_AMOUNTS,
  MarketingSettingsService,
  createDefaultHomeAdSlotMonthlyPrices,
  createDefaultRankClickChargeAmounts,
  resolveClickChargeAmount,
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
  assert.deepEqual(view.rank_click_charge_amounts, createDefaultRankClickChargeAmounts());
  assert.equal(view.airport_ad_monthly_price, DEFAULT_AIRPORT_AD_MONTHLY_PRICE);
  assert.deepEqual(
    view.home_ad_slot_monthly_prices,
    createDefaultHomeAdSlotMonthlyPrices(),
  );
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
  assert.deepEqual(view.rank_click_charge_amounts, createDefaultRankClickChargeAmounts());
  assert.equal(view.airport_ad_monthly_price, DEFAULT_AIRPORT_AD_MONTHLY_PRICE);
  assert.deepEqual(
    view.home_ad_slot_monthly_prices,
    createDefaultHomeAdSlotMonthlyPrices(),
  );
  assert.deepEqual(view.recharge_amounts, DEFAULT_MARKETING_RECHARGE_AMOUNTS);
  assert.equal(view.admin_telegram_username, null);
  assert.deepEqual(view.home_section_limits, DEFAULT_HOME_SECTION_LIMITS);
});

test('MarketingSettingsService saves application, click fees, ad monthly price, recharge amounts, Telegram username and home section limits under marketing billing key', async () => {
  const { records, repository } = createSettingsRepository();
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  const view = await service.updateAdminSettings({
    application_fee_amount: 288.235,
    click_charge_amount: 1.256,
    rank_click_charge_amounts: { 1: 2.345, 2: null, 6: 0.75 },
    airport_ad_monthly_price: 1288.884,
    home_ad_slot_monthly_prices: { 1: 1688.884, 2: 1588.884, 3: 1488.884, 4: 1388.884 },
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
  assert.deepEqual(view.rank_click_charge_amounts, {
    1: 2.35,
    2: null,
    3: null,
    4: null,
    5: null,
    6: 0.75,
  });
  assert.equal(view.airport_ad_monthly_price, 1288.88);
  assert.deepEqual(view.home_ad_slot_monthly_prices, {
    1: 1688.88,
    2: 1588.88,
    3: 1488.88,
    4: 1388.88,
  });
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
    rank_click_charge_amounts: {
      1: 2.35,
      2: null,
      3: null,
      4: null,
      5: null,
      6: 0.75,
    },
    airport_ad_monthly_price: 1288.88,
    home_ad_slot_monthly_prices: {
      1: 1688.88,
      2: 1588.88,
      3: 1488.88,
      4: 1388.88,
    },
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
  assert.deepEqual(view.rank_click_charge_amounts, createDefaultRankClickChargeAmounts());
  assert.equal(view.airport_ad_monthly_price, DEFAULT_AIRPORT_AD_MONTHLY_PRICE);
  assert.deepEqual(
    view.home_ad_slot_monthly_prices,
    createDefaultHomeAdSlotMonthlyPrices(),
  );
  assert.deepEqual(view.recharge_amounts, DEFAULT_MARKETING_RECHARGE_AMOUNTS);
  assert.deepEqual(view.home_section_limits, DEFAULT_HOME_SECTION_LIMITS);
});

test('MarketingSettingsService partially updates and clears ranked click charges', async () => {
  const { repository } = createSettingsRepository({
    marketing_billing: {
      click_charge_amount: 0.6,
      rank_click_charge_amounts: { 1: 1.2, 2: 1.1 },
    },
  });
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  const preserved = await service.updateAdminSettings({ click_charge_amount: 0.7 }, 'admin');
  assert.equal(preserved.click_charge_amount, 0.7);
  assert.equal(preserved.rank_click_charge_amounts[1], 1.2);
  assert.equal(preserved.rank_click_charge_amounts[2], 1.1);

  const view = await service.updateAdminSettings({
    rank_click_charge_amounts: { 1: null, 6: 0.8 },
  }, 'admin');

  assert.deepEqual(view.rank_click_charge_amounts, {
    1: null,
    2: 1.1,
    3: null,
    4: null,
    5: null,
    6: 0.8,
  });
});

test('MarketingSettingsService uses the ordinary ad price as legacy homepage slot fallback', async () => {
  const { repository } = createSettingsRepository({
    marketing_billing: {
      airport_ad_monthly_price: 1288.88,
    },
  });
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  const view = await service.getAdminSettings();

  assert.deepEqual(view.home_ad_slot_monthly_prices, {
    1: 1288.88,
    2: 1288.88,
    3: 1288.88,
    4: 1288.88,
  });
});

test('MarketingSettingsService partially updates homepage slot monthly prices', async () => {
  const { repository } = createSettingsRepository({
    marketing_billing: {
      airport_ad_monthly_price: 1000,
      home_ad_slot_monthly_prices: { 1: 1500, 2: 1400, 3: 1300, 4: 1200 },
    },
  });
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  const view = await service.updateAdminSettings({
    home_ad_slot_monthly_prices: { 2: 1450.126, 4: 1250 },
  }, 'admin');

  assert.deepEqual(view.home_ad_slot_monthly_prices, {
    1: 1500,
    2: 1450.13,
    3: 1300,
    4: 1250,
  });
});

test('MarketingSettingsService rejects invalid ranked click charges and unsupported ranks', async () => {
  const { repository } = createSettingsRepository();
  const service = new MarketingSettingsService({ systemSettingRepository: repository });

  for (const rank_click_charge_amounts of [
    { 1: 0 },
    { 2: -1 },
    { 3: Number.NaN },
    { 7: 1 },
  ]) {
    await assert.rejects(
      () => service.updateAdminSettings({ rank_click_charge_amounts }, 'admin'),
      (error: unknown) => {
        const next = error as { code?: string; message?: string };
        assert.equal(next.code, 'BAD_REQUEST');
        assert.match(String(next.message || ''), /rank_click_charge_amounts/);
        return true;
      },
    );
  }
});

test('resolveClickChargeAmount uses configured top-six charge and otherwise falls back to default', () => {
  const config = {
    click_charge_amount: 0.6,
    rank_click_charge_amounts: { 1: 1.5, 6: 0.8 },
  };

  assert.equal(resolveClickChargeAmount(config, 1), 1.5);
  assert.equal(resolveClickChargeAmount(config, 6), 0.8);
  assert.equal(resolveClickChargeAmount(config, 2), 0.6);
  assert.equal(resolveClickChargeAmount(config, 7), 0.6);
  assert.equal(resolveClickChargeAmount(config, null), 0.6);
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

  await assert.rejects(
    () => service.updateAdminSettings({ airport_ad_monthly_price: -1 }, 'admin'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'BAD_REQUEST');
      assert.match(String(next.message || ''), /airport_ad_monthly_price/);
      return true;
    },
  );

  await assert.rejects(
    () => service.updateAdminSettings({ home_ad_slot_monthly_prices: { 3: 0 } }, 'admin'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'BAD_REQUEST');
      assert.match(String(next.message || ''), /home_ad_slot_monthly_prices\.3/);
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
