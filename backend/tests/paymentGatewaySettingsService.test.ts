import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  DEFAULT_APPLICATION_FEE_AMOUNT,
  PaymentGatewaySettingsService,
} from '../src/services/paymentGatewaySettingsService';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 1024,
});

const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privateRaw = stripPem(privatePem);
const publicRaw = stripPem(publicPem);

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
    private_key: privatePem,
    platform_public_key: publicPem,
    application_fee_amount: 1888,
  }, 'admin');

  assert.equal(view.enabled, true);
  assert.equal(view.pid, '10086');
  assert.equal(view.application_fee_amount, 1888);
  assert.equal(view.has_private_key, true);
  assert.ok(view.private_key_masked);
});

test('PaymentGatewaySettingsService accepts raw base64 keys from the gateway console', async () => {
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
    pid: '28615',
    private_key: privateRaw,
    platform_public_key: publicRaw,
    application_fee_amount: 1000,
  }, 'admin');

  assert.equal(view.enabled, true);
  assert.equal(view.has_private_key, true);
});

test('PaymentGatewaySettingsService rejects public key in private key field', async () => {
  const service = new PaymentGatewaySettingsService({
    systemSettingRepository: {
      getByKey: async () => null,
      upsert: async () => undefined,
    },
  });

  await assert.rejects(
    () => service.updateAdminSettings({
      enabled: true,
      pid: '28615',
      private_key: publicRaw,
      platform_public_key: publicRaw,
      application_fee_amount: 1000,
    }, 'admin'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'PAYMENT_GATEWAY_INVALID_PRIVATE_KEY');
      assert.match(String(next.message || ''), /不要填写商户公钥或平台公钥/);
      return true;
    },
  );
});

test('PaymentGatewaySettingsService rejects private key in platform public key field', async () => {
  const service = new PaymentGatewaySettingsService({
    systemSettingRepository: {
      getByKey: async () => null,
      upsert: async () => undefined,
    },
  });

  await assert.rejects(
    () => service.updateAdminSettings({
      enabled: true,
      pid: '28615',
      private_key: privateRaw,
      platform_public_key: privateRaw,
      application_fee_amount: 1000,
    }, 'admin'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'PAYMENT_GATEWAY_INVALID_PLATFORM_PUBLIC_KEY');
      assert.match(String(next.message || ''), /看起来是私钥/);
      return true;
    },
  );
});

function stripPem(value: string): string {
  return value
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
}
