import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { HttpError } from '../src/middleware/errorHandler';
import { PaymentGatewayService } from '../src/services/paymentGatewayService';
import { buildRsaSignPayload, signWithRsaPrivateKey } from '../src/utils/rsaSignature';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 1024,
});

const paymentGatewayConfig = {
  enabled: true,
  pid: '28615',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  platform_public_key: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  application_fee_amount: 1000,
};

test('PaymentGatewayService surfaces non-json gateway responses', async () => {
  const service = new PaymentGatewayService({
    paymentGatewaySettingsService: {
      getConfig: async () => paymentGatewayConfig,
    },
    fetchImpl: (async () =>
      new Response('<html><body>502 Bad Gateway</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })) as typeof fetch,
  });

  await assert.rejects(
    () =>
      service.createOrder({
        out_trade_no: 'gr_1_test',
        channel: 'wxpay',
        name: 'GateRank test',
        money: 1000,
        notify_url: 'http://localhost:8787/api/v1/portal/payment-notify',
        return_url: 'http://localhost:3000/portal',
        clientip: '127.0.0.1',
      }),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'PAYMENT_GATEWAY_BAD_RESPONSE');
      assert.match(String(next.message || ''), /非 JSON 响应/);
      return true;
    },
  );
});

test('PaymentGatewayService surfaces unsigned gateway business errors before signature verification', async () => {
  const service = new PaymentGatewayService({
    paymentGatewaySettingsService: {
      getConfig: async () => paymentGatewayConfig,
    },
    fetchImpl: (async () =>
      new Response(JSON.stringify({
        code: -1,
        msg: '当前商户余额不足，无法完成支付，请商户登录用户中心充值余额',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch,
  });

  await assert.rejects(
    () =>
      service.createOrder({
        out_trade_no: 'gr_1_test',
        channel: 'alipay',
        name: 'GateRank test',
        money: 1000,
        notify_url: 'http://localhost:8787/api/v1/portal/payment-notify',
        return_url: 'http://localhost:3000/portal',
        clientip: '127.0.0.1',
      }),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'PAYMENT_GATEWAY_CREATE_FAILED');
      assert.match(String(next.message || ''), /商户余额不足/);
      return true;
    },
  );
});

test('PaymentGatewayService surfaces transport failures', async () => {
  const service = new PaymentGatewayService({
    paymentGatewaySettingsService: {
      getConfig: async () => paymentGatewayConfig,
    },
    fetchImpl: (async () => {
      const error = new Error('socket hang up') as Error & { code?: string };
      error.code = 'ECONNRESET';
      throw error;
    }) as typeof fetch,
  });

  await assert.rejects(
    () =>
      service.createOrder({
        out_trade_no: 'gr_1_test',
        channel: 'alipay',
        name: 'GateRank test',
        money: 1000,
        notify_url: 'http://localhost:8787/api/v1/portal/payment-notify',
        return_url: 'http://localhost:3000/portal',
        clientip: '127.0.0.1',
      }),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'PAYMENT_GATEWAY_UNAVAILABLE');
      assert.match(String(next.message || ''), /socket hang up/);
      return true;
    },
  );
});

test('PaymentGatewayService surfaces signing failures for invalid private key', async () => {
  const service = new PaymentGatewayService({
    paymentGatewaySettingsService: {
      getConfig: async () => ({
        ...paymentGatewayConfig,
        private_key: paymentGatewayConfig.platform_public_key,
      }),
    },
    fetchImpl: (async () => {
      throw new Error('not used');
    }) as typeof fetch,
  });

  await assert.rejects(
    () =>
      service.createOrder({
        out_trade_no: 'gr_1_test',
        channel: 'alipay',
        name: 'GateRank test',
        money: 1000,
        notify_url: 'http://localhost:8787/api/v1/portal/payment-notify',
        return_url: 'http://localhost:3000/portal',
        clientip: '127.0.0.1',
      }),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'PAYMENT_GATEWAY_SIGN_FAILED');
      assert.match(String(next.message || ''), /商户私钥/);
      return true;
    },
  );
});

test('PaymentGatewayService accepts raw base64 RSA keys from the gateway console', async () => {
  const privateKeyRaw = stripPem(paymentGatewayConfig.private_key);
  const publicKeyRaw = stripPem(paymentGatewayConfig.platform_public_key);
  const service = new PaymentGatewayService({
    paymentGatewaySettingsService: {
      getConfig: async () => ({
        ...paymentGatewayConfig,
        private_key: privateKeyRaw,
        platform_public_key: publicKeyRaw,
      }),
    },
    fetchImpl: (async () => {
      const payload: Record<string, string | number> = {
        code: 0,
        msg: 'success',
        trade_no: '202604180001',
        out_trade_no: 'gr_1_test',
        pay_type: 'alipay',
        pay_info: 'https://pay.example.com/jump',
      };
      payload.sign = signWithRsaPrivateKey(buildRsaSignPayload(payload), privateKeyRaw);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch,
  });

  const result = await service.createOrder({
    out_trade_no: 'gr_1_test',
    channel: 'alipay',
    name: 'GateRank test',
    money: 1000,
    notify_url: 'http://localhost:8787/api/v1/portal/payment-notify',
    return_url: 'http://localhost:3000/portal',
    clientip: '127.0.0.1',
  });

  assert.equal(result.trade_no, '202604180001');
  assert.equal(result.pay_type, 'alipay');
  assert.equal(result.pay_info, 'https://pay.example.com/jump');
});

function stripPem(value: string): string {
  return value
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
}
