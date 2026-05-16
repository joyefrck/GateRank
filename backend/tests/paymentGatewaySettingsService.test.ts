import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { PaymentGatewaySettingsService } from '../src/services/paymentGatewaySettingsService';

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
  assert.equal(view.epay.enabled, false);
  assert.equal(view.has_private_key, false);
});

test('PaymentGatewaySettingsService saves epay switch and masks keys', async () => {
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
    epay: { enabled: true },
    pid: '10086',
    private_key: privatePem,
    platform_public_key: publicPem,
  }, 'admin');

  assert.equal(view.enabled, true);
  assert.equal(view.epay.enabled, true);
  assert.equal(view.pid, '10086');
  assert.equal(view.has_private_key, true);
  assert.ok(view.private_key_masked);
  assert.equal(view.usdt.enabled, false);
  assert.equal('payment_type' in view.usdt, false);

  const disabled = await service.updateAdminSettings({
    epay: { enabled: false },
  }, 'admin');

  assert.equal(disabled.epay.enabled, false);
  assert.equal((await service.getConfig()).epay.enabled, false);
});

test('PaymentGatewaySettingsService saves masks preserves and clears USDT secret', async () => {
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

  const saved = await service.updateAdminSettings({
    enabled: true,
    notify_origin: 'https://gate-rank.com/',
    usdt: {
      enabled: true,
      gateway_url: 'https://pay.example.com/',
      merchant_id: '1000',
      secret_key: 'secret-1234567890',
    },
  }, 'admin');

  assert.equal(saved.usdt.enabled, true);
  assert.equal(saved.usdt.gateway_url, 'https://pay.example.com');
  assert.equal(saved.usdt.merchant_id, '1000');
  assert.equal(saved.usdt.has_secret_key, true);
  assert.ok(saved.usdt.secret_key_masked);
  assert.equal(saved.notify_origin, 'https://gate-rank.com');
  assert.equal(saved.notify_urls?.application_payment, 'https://gate-rank.com/api/v1/portal/payment-notify');
  assert.equal(saved.notify_urls?.recharge, 'https://gate-rank.com/api/v1/portal/recharge-notify');
  assert.equal((await service.getConfig()).notify_origin, 'https://gate-rank.com');

  const preserved = await service.updateAdminSettings({
    usdt: {
      merchant_id: '1001',
    },
  }, 'admin');

  assert.equal(preserved.usdt.merchant_id, '1001');
  assert.equal(preserved.usdt.has_secret_key, true);

  const cleared = await service.updateAdminSettings({
    enabled: false,
    usdt: {
      enabled: false,
      secret_key: '',
    },
  }, 'admin');

  assert.equal(cleared.usdt.enabled, false);
  assert.equal(cleared.usdt.has_secret_key, false);
});

test('PaymentGatewaySettingsService rejects invalid notify origin', async () => {
  const service = new PaymentGatewaySettingsService({
    systemSettingRepository: {
      getByKey: async () => null,
      upsert: async () => undefined,
    },
  });

  await assert.rejects(
    () => service.updateAdminSettings({
      notify_origin: 'gate-rank.com/api/v1/portal/payment-notify',
    }, 'admin'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'PAYMENT_GATEWAY_NOTIFY_ORIGIN_INVALID');
      assert.match(String(next.message || ''), /回调地址/);
      return true;
    },
  );
});

test('PaymentGatewaySettingsService normalizes legacy USDT gateway endpoint to base URL', async () => {
  const service = new PaymentGatewaySettingsService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'payment_gateway',
        value_json: {
          enabled: true,
          usdt: {
            enabled: true,
            gateway_url: 'https://pay.example.com/payments/epay/v1/order/create-transaction',
            merchant_id: '1000',
            secret_key: 'secret-1234567890',
          },
        },
        updated_by: 'admin',
        created_at: '2026-04-18 10:00:00',
        updated_at: '2026-04-18 10:00:00',
      }),
      upsert: async () => undefined,
    },
  });

  const view = await service.getAdminSettings();
  assert.equal(view.usdt.gateway_url, 'https://pay.example.com');
});

test('PaymentGatewaySettingsService keeps legacy epay enabled when RSA config is complete', async () => {
  const service = new PaymentGatewaySettingsService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'payment_gateway',
        value_json: {
          enabled: true,
          pid: '28615',
          private_key: privateRaw,
          platform_public_key: publicRaw,
        },
        updated_by: 'admin',
        created_at: '2026-04-18 10:00:00',
        updated_at: '2026-04-18 10:00:00',
      }),
      upsert: async () => undefined,
    },
  });

  const view = await service.getAdminSettings();
  assert.equal(view.epay.enabled, true);
  assert.equal((await service.getConfig()).epay.enabled, true);
});

test('PaymentGatewaySettingsService rejects incomplete enabled epay config', async () => {
  const service = new PaymentGatewaySettingsService({
    systemSettingRepository: {
      getByKey: async () => null,
      upsert: async () => undefined,
    },
  });

  await assert.rejects(
    () => service.updateAdminSettings({
      enabled: true,
      epay: { enabled: true },
      pid: '28615',
      private_key: '',
      platform_public_key: publicRaw,
    }, 'admin'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'PAYMENT_GATEWAY_PRIVATE_KEY_REQUIRED');
      assert.match(String(next.message || ''), /商户私钥/);
      return true;
    },
  );
});

test('PaymentGatewaySettingsService rejects incomplete enabled USDT config', async () => {
  const service = new PaymentGatewaySettingsService({
    systemSettingRepository: {
      getByKey: async () => null,
      upsert: async () => undefined,
    },
  });

  await assert.rejects(
    () => service.updateAdminSettings({
      enabled: true,
      usdt: {
        enabled: true,
        gateway_url: 'https://pay.example.com',
        merchant_id: '1000',
        secret_key: '',
      },
    }, 'admin'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'PAYMENT_GATEWAY_USDT_SECRET_REQUIRED');
      assert.match(String(next.message || ''), /通信密钥/);
      return true;
    },
  );
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
  }, 'admin');

  assert.equal(view.enabled, true);
  assert.equal(view.has_private_key, true);
});

test('PaymentGatewaySettingsService preserves legacy application fee without exposing it', async () => {
  let storedValue: unknown = {
    enabled: false,
    pid: 'old-pid',
    private_key: privateRaw,
    platform_public_key: publicRaw,
    application_fee_amount: 588,
  };
  const service = new PaymentGatewaySettingsService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'payment_gateway',
        value_json: storedValue,
        updated_by: 'admin',
        created_at: '2026-04-18 10:00:00',
        updated_at: '2026-04-18 10:00:00',
      }),
      upsert: async (_settingKey, value) => {
        storedValue = value;
      },
    },
  });

  const view = await service.updateAdminSettings({ pid: 'new-pid' }, 'admin');

  assert.equal(view.pid, 'new-pid');
  assert.equal('application_fee_amount' in view, false);
  assert.equal((storedValue as { application_fee_amount?: number }).application_fee_amount, 588);
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
