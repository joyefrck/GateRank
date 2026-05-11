import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { HttpError } from '../src/middleware/errorHandler';
import {
  buildEpusdtGmpayCreateUrl,
  normalizeEpusdtPaymentUrl,
  PaymentGatewayService,
  signWithMd5Secret,
} from '../src/services/paymentGatewayService';
import { buildRsaSignPayload, signWithRsaPrivateKey } from '../src/utils/rsaSignature';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 1024,
});

const paymentGatewayConfig = {
  enabled: true,
  pid: '28615',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  platform_public_key: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  notify_origin: '',
  application_fee_amount: 1000,
  usdt: {
    enabled: false,
    gateway_url: '',
    merchant_id: '',
    secret_key: '',
  },
};

const usdtGatewayConfig = {
  enabled: true,
  pid: '',
  private_key: '',
  platform_public_key: '',
  notify_origin: '',
  usdt: {
    enabled: true,
    gateway_url: 'https://pay-usdt.example.com/',
    merchant_id: '1000',
    secret_key: 'epay-secret',
  },
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

test('PaymentGatewayService queries an order and verifies the RSA response', async () => {
  const requestedBodies: string[] = [];
  const service = new PaymentGatewayService({
    paymentGatewaySettingsService: {
      getConfig: async () => paymentGatewayConfig,
    },
    fetchImpl: (async (_url, init) => {
      requestedBodies.push(String(init?.body || ''));
      const payload: Record<string, string | number> = {
        code: 0,
        msg: 'success',
        trade_no: '202605100001',
        out_trade_no: 'gr_7_test',
        api_trade_no: 'ali-202605100001',
        type: 'alipay',
        status: 1,
        pid: '28615',
        addtime: '2026-05-10 09:00:00',
        endtime: '2026-05-10 09:01:00',
        name: 'GateRank test',
        money: '10.00',
        param: '7',
        timestamp: '1778374860',
        sign_type: 'RSA',
      };
      payload.sign = signWithRsaPrivateKey(buildRsaSignPayload(payload), paymentGatewayConfig.private_key);
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch,
  });

  const result = await service.queryOrder('gr_7_test');

  assert.equal(result.out_trade_no, 'gr_7_test');
  assert.equal(result.trade_no, '202605100001');
  assert.equal(result.type, 'alipay');
  assert.equal(result.status, 1);
  assert.equal(result.money, 10);
  assert.match(requestedBodies[0], /out_trade_no=gr_7_test/);
  assert.match(requestedBodies[0], /sign_type=RSA/);
});

test('PaymentGatewayService creates USDT GMPay order with MD5 signature', async () => {
  const requestedUrls: string[] = [];
  const requestedBodies: Record<string, string | number>[] = [];
  const service = new PaymentGatewayService({
    paymentGatewaySettingsService: {
      getConfig: async () => usdtGatewayConfig,
    },
    fetchImpl: (async (url, init) => {
      requestedUrls.push(String(url));
      requestedBodies.push(JSON.parse(String(init?.body || '{}')) as Record<string, string | number>);
      return new Response(JSON.stringify({
        status_code: 200,
        message: 'success',
        data: {
          trade_id: 'gw-usdt-1',
          payment_url: 'http://8.217.193.194:8000/pay/gr_9_usdt',
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch,
  });

  const result = await service.createOrder({
    out_trade_no: 'gr_9_usdt',
    channel: 'usdt',
    name: 'GateRank test',
    money: 12.34,
    notify_url: 'https://api.example.com/api/v1/portal/payment-notify',
    return_url: 'https://www.example.com/portal',
    clientip: '127.0.0.1',
  });

  assert.equal(requestedUrls[0], 'https://pay-usdt.example.com/payments/gmpay/v1/order/create-transaction');
  assert.equal(requestedBodies[0].pid, '1000');
  assert.equal(requestedBodies[0].order_id, 'gr_9_usdt');
  assert.equal(requestedBodies[0].currency, 'cny');
  assert.equal(requestedBodies[0].token, 'usdt');
  assert.equal(requestedBodies[0].network, 'tron');
  assert.equal(requestedBodies[0].amount, 12.34);
  assert.equal(requestedBodies[0].notify_url, 'https://api.example.com/api/v1/portal/payment-notify');
  assert.equal(requestedBodies[0].redirect_url, 'https://www.example.com/portal');
  assert.equal(requestedBodies[0].name, 'GateRank test');
  assert.equal(requestedBodies[0].signature, signWithMd5Secret(requestedBodies[0], 'epay-secret'));
  assert.equal(result.trade_no, 'gw-usdt-1');
  assert.equal(result.pay_type, 'usdt');
  assert.equal(result.pay_info, 'https://pay-usdt.example.com/pay/gr_9_usdt');
});

test('PaymentGatewayService accepts EPUSDT gateway domain or legacy full payment endpoint', () => {
  assert.equal(
    buildEpusdtGmpayCreateUrl('https://pay-usdt.example.com/'),
    'https://pay-usdt.example.com/payments/gmpay/v1/order/create-transaction',
  );
  assert.equal(
    buildEpusdtGmpayCreateUrl('https://pay-usdt.example.com/payments/epay/v1/order/create-transaction'),
    'https://pay-usdt.example.com/payments/gmpay/v1/order/create-transaction',
  );
  assert.equal(
    buildEpusdtGmpayCreateUrl('https://pay-usdt.example.com/payments/gmpay/v1/order/create-transaction'),
    'https://pay-usdt.example.com/payments/gmpay/v1/order/create-transaction',
  );
  assert.equal(
    buildEpusdtGmpayCreateUrl('https://pay-usdt.example.com/submit.php'),
    'https://pay-usdt.example.com/payments/gmpay/v1/order/create-transaction',
  );
});

test('PaymentGatewayService normalizes EPUSDT cashier URL to configured gateway origin', () => {
  assert.equal(
    normalizeEpusdtPaymentUrl(
      'http://8.217.193.194:8000/pay/checkout-counter/202605111778433036814206',
      'https://www.443ds443.com/payments/epay/v1/order/create-transaction',
    ),
    'https://www.443ds443.com/pay/checkout-counter/202605111778433036814206',
  );
});

test('PaymentGatewayService surfaces USDT GMPay error responses', async () => {
  const service = new PaymentGatewayService({
    paymentGatewaySettingsService: {
      getConfig: async () => usdtGatewayConfig,
    },
    fetchImpl: (async () =>
      new Response(JSON.stringify({
        status_code: 400,
        message: 'invalid pid',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch,
  });

  await assert.rejects(
    () => service.createOrder({
      out_trade_no: 'gr_9_usdt',
      channel: 'usdt',
      name: 'GateRank test',
      money: 12.34,
      notify_url: 'https://api.example.com/api/v1/portal/payment-notify',
      return_url: 'https://www.example.com/portal',
      clientip: '127.0.0.1',
    }),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'PAYMENT_GATEWAY_CREATE_FAILED');
      assert.match(String(next.message || ''), /invalid pid/);
      return true;
    },
  );
});

test('PaymentGatewayService verifies USDT GMPay notification signatures', async () => {
  const service = new PaymentGatewayService({
    paymentGatewaySettingsService: {
      getConfig: async () => usdtGatewayConfig,
    },
  });
  const payload: Record<string, string> = {
    pid: '1000',
    trade_id: 'gw_1',
    order_id: 'gr_9_usdt',
    currency: 'cny',
    token: 'usdt',
    network: 'tron',
    amount: '12.34',
    status: 'success',
  };
  payload.signature = signWithMd5Secret(payload, 'epay-secret');

  assert.equal(await service.verifyNotificationPayload(payload, 'usdt'), true);
  assert.equal(await service.verifyNotificationPayload({ ...payload, amount: '99.00' }, 'usdt'), false);
});

test('PaymentGatewayService rejects active USDT order sync with clear unsupported query error', async () => {
  const service = new PaymentGatewayService({
    paymentGatewaySettingsService: {
      getConfig: async () => usdtGatewayConfig,
    },
  });

  await assert.rejects(
    () => service.queryOrder('gr_9_usdt', 'usdt'),
    (error: unknown) => {
      const next = error as { code?: string; message?: string };
      assert.equal(next.code, 'PAYMENT_GATEWAY_QUERY_NOT_SUPPORTED');
      assert.match(String(next.message || ''), /USDT/);
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
