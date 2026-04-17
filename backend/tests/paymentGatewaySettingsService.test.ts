import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_APPLICATION_FEE_AMOUNT,
  PaymentGatewaySettingsService,
} from '../src/services/paymentGatewaySettingsService';

test('PaymentGatewaySettingsService returns default view', async () => {
  const service = new PaymentGatewaySettingsService({
    systemSettingRepository: {
      getByKey: async () => null,
      upsert: async () => undefined,
    },
  });

  const view = await service.getAdminSettings();
  assert.equal(view.enabled, false);
  assert.equal(view.application_fee_amount, DEFAULT_APPLICATION_FEE_AMOUNT);
  assert.equal(view.has_private_key, false);
});

test('PaymentGatewaySettingsService saves and masks keys', async () => {
  let storedValue: unknown = null;
  const service = new PaymentGatewaySettingsService({
    systemSettingRepository: {
      getByKey: async () => storedValue
        ? {
          setting_key: 'payment_gateway',
          value_json: storedValue,
          updated_by: 'admin',
          created_at: '2026-04-18 10:00:00',
          updated_at: '2026-04-18 10:00:00',
        }
        : null,
      upsert: async (_settingKey, value) => {
        storedValue = value;
      },
    },
  });

  const view = await service.updateAdminSettings({
    enabled: true,
    pid: '10086',
    private_key: '-----BEGIN PRIVATE KEY-----abcdef1234567890-----END PRIVATE KEY-----',
    platform_public_key: '-----BEGIN PUBLIC KEY-----abcdef-----END PUBLIC KEY-----',
    application_fee_amount: 1888,
  }, 'admin');

  assert.equal(view.enabled, true);
  assert.equal(view.pid, '10086');
  assert.equal(view.application_fee_amount, 1888);
  assert.equal(view.has_private_key, true);
  assert.ok(view.private_key_masked);
});
