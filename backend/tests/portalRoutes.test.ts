import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'node:net';
import { createPortalRoutes } from '../src/routes/portalRoutes';
import { errorHandler } from '../src/middleware/errorHandler';
import type { PaymentGatewayCreateOrderInput } from '../src/services/paymentGatewayService';
import type { PaymentReceivedNotificationInput } from '../src/services/telegramNotificationService';
import { hashPassword } from '../src/utils/password';
import { signApplicantToken } from '../src/utils/token';

function createMockBillingRepository(overrides: Record<string, unknown> = {}) {
  return {
    ensureWalletForAccount: async () => ({
      id: 1,
      applicant_account_id: 1,
      application_id: 7,
      airport_id: null,
      balance: 0,
      auto_unlisted_at: null,
      created_at: '2026-04-18T10:00:00+08:00',
      updated_at: '2026-04-18T10:00:00+08:00',
    }),
    getWalletByAccountId: async () => ({
      id: 1,
      applicant_account_id: 1,
      application_id: 7,
      airport_id: null,
      balance: 0,
      auto_unlisted_at: null,
      created_at: '2026-04-18T10:00:00+08:00',
      updated_at: '2026-04-18T10:00:00+08:00',
    }),
    createRechargeOrder: async () => 1,
    getRechargeOrderByOutTradeNo: async () => null,
    listRechargeOrders: async () => [],
    cancelRechargeOrder: async () => true,
    markRechargePaidAndCredit: async () => true,
    listTransactions: async () => [],
    listClicks: async () => [],
    ...overrides,
  };
}

function createMockApplicantAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    application_id: 7,
    email: 'user@example.com',
    password_hash: 'hash',
    must_change_password: false,
    last_login_at: null,
    x_user_id: null,
    x_username: null,
    x_display_name: null,
    x_bound_at: null,
    created_at: '2026-04-18T10:00:00+08:00',
    updated_at: '2026-04-18T10:00:00+08:00',
    ...overrides,
  };
}

test('POST /portal/x-oauth/login/complete exchanges handoff code for portal token', async () => {
  const account = createMockApplicantAccount({ x_user_id: 'x-123', x_username: 'gaterank' });
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => account,
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => null,
        markPaid: async () => true,
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => null,
        markPaid: async () => true,
        expireOpenOrdersByApplicationId: async () => 0,
      },
      applicantBillingRepository: createMockBillingRepository(),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
        createSession: async () => ({
          token: 'portal-token',
          expires_at: '2026-05-04T12:00:00.000Z',
          account,
        }),
      },
      applicantXOAuthService: {
        startBind: async () => {
          throw new Error('not used');
        },
        startLogin: async () => {
          throw new Error('not used');
        },
        handleCallback: async () => {
          throw new Error('not used');
        },
        consumeLoginHandoff: async (code) => {
          assert.equal(code, 'handoff-code');
          return account;
        },
        unbind: async () => undefined,
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 1000 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async () => true,
      },
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/x-oauth/login/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'handoff-code' }),
    });
    const data = await response.json() as { token: string; account: { x: { username: string } } };

    assert.equal(response.status, 200);
    assert.equal(data.token, 'portal-token');
    assert.equal(data.account.x.username, 'gaterank');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/password/change verifies current password and clears first-login flag', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const passwordHash = await hashPassword('CurrentPass8');
  const account = createMockApplicantAccount({
    password_hash: passwordHash,
    must_change_password: true,
  });
  const updates: Array<{ id: number; mustChangePassword: boolean }> = [];

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => account,
        updatePassword: async (id, nextPasswordHash, mustChangePassword) => {
          updates.push({ id, mustChangePassword });
          account.password_hash = nextPasswordHash;
          account.must_change_password = mustChangePassword;
          return true;
        },
      },
      airportApplicationRepository: {
        getById: async () => ({
          id: 7,
          name: 'Cloud Airport',
          website: 'https://example.com',
          websites: ['https://example.com'],
          review_status: 'awaiting_payment',
          payment_status: 'unpaid',
          payment_amount: null,
          paid_at: null,
          applicant_email: 'user@example.com',
          applicant_telegram: '@cloud',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
          plan_price_month: 1000,
          has_trial: true,
          subscription_url: 'https://subscribe.example.com',
          test_account: 'tester',
          test_password: 'secret',
          created_at: '2026-04-18 10:00:00',
        }),
        markPaid: async () => true,
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => null,
        markPaid: async () => true,
        expireOpenOrdersByApplicationId: async () => 0,
      },
      applicantBillingRepository: createMockBillingRepository(),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 1000 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async () => true,
      },
    }),
  );
  app.use(errorHandler);

  const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const badResponse = await fetch(`http://127.0.0.1:${port}/portal/password/change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password: 'WrongPass8',
        new_password: 'NextPass888',
      }),
    });
    assert.equal(badResponse.status, 401);
    assert.equal(updates.length, 0);

    const okResponse = await fetch(`http://127.0.0.1:${port}/portal/password/change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password: 'CurrentPass8',
        new_password: 'NextPass888',
      }),
    });
    const data = await okResponse.json() as { account: { must_change_password: boolean } };

    assert.equal(okResponse.status, 200);
    assert.deepEqual(updates, [{ id: 1, mustChangePassword: false }]);
    assert.equal(data.account.must_change_password, false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/payment-orders creates payment order from configured amount', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const previousApiBase = process.env.API_BASE;
  process.env.API_BASE = 'https://api.gaterank.test';
  const createdOrders: Array<Record<string, unknown>> = [];
  const gatewayOrders: PaymentGatewayCreateOrderInput[] = [];

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => ({
          id: 1,
          application_id: 7,
          email: 'user@example.com',
          password_hash: 'hash',
          must_change_password: false,
          last_login_at: null,
          created_at: '2026-04-18T10:00:00+08:00',
          updated_at: '2026-04-18T10:00:00+08:00',
        }),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({
          id: 7,
          name: 'Cloud Airport',
          website: 'https://example.com',
          review_status: 'awaiting_payment',
          payment_status: 'unpaid',
          payment_amount: null,
          applicant_email: 'user@example.com',
          applicant_telegram: '@cloud',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
          created_at: '2026-04-18 10:00:00',
        }),
        markPaid: async () => true,
      },
      applicationPaymentOrderRepository: {
        create: async (input) => {
          createdOrders.push(input as Record<string, unknown>);
          return 1;
        },
        getLatestByApplicationId: async () => ({
          id: 1,
          application_id: 7,
          out_trade_no: 'gr_7_1',
          gateway_trade_no: 'trade_1',
          channel: 'alipay',
          amount: 1888,
          status: 'created',
          pay_type: 'jump',
          pay_info: 'https://pay.example.com/jump',
          notify_payload_json: null,
          paid_at: null,
          created_at: '2026-04-18T10:00:00+08:00',
          updated_at: '2026-04-18T10:00:00+08:00',
        }),
        getByOutTradeNo: async () => null,
        markPaid: async () => true,
        expireOpenOrdersByApplicationId: async () => 1,
      },
      applicantBillingRepository: createMockBillingRepository(),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 1888 }),
      },
      paymentGatewayService: {
        createOrder: async (input) => {
          gatewayOrders.push(input);
          return {
            trade_no: 'trade_1',
            pay_type: 'jump',
            pay_info: 'https://pay.example.com/jump',
          };
        },
        verifyNotificationPayload: async () => true,
      },
    }),
  );
  app.use(errorHandler);

  const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/payment-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Origin: 'http://localhost:3000',
      },
      body: JSON.stringify({ channel: 'alipay' }),
    });

    assert.equal(response.status, 201);
    assert.equal(createdOrders.length, 1);
    assert.equal(gatewayOrders.length, 1);
    assert.equal(createdOrders[0].amount, 1888);
    assert.equal(createdOrders[0].channel, 'alipay');
    assert.equal(gatewayOrders[0].return_url, 'http://localhost:3000/portal');
    assert.equal(gatewayOrders[0].notify_url, 'https://api.gaterank.test/api/v1/portal/payment-notify');
  } finally {
    if (previousApiBase === undefined) {
      delete process.env.API_BASE;
    } else {
      process.env.API_BASE = previousApiBase;
    }
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/payment-notify marks payment as paid on valid callback', async () => {
  const paidOrders: Array<Record<string, unknown>> = [];
  const paidApplications: Array<Record<string, unknown>> = [];
  const paymentNotifications: PaymentReceivedNotificationInput[] = [];

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => null,
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({
          id: 7,
          name: 'Cloud Airport',
        }),
        markPaid: async (id, amount, paidAt) => {
          paidApplications.push({ id, amount, paidAt });
          return true;
        },
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => ({
          id: 1,
          application_id: 7,
          out_trade_no: 'gr_7_1',
          gateway_trade_no: 'trade_1',
          channel: 'alipay',
          amount: 1000,
          status: 'created',
          pay_type: 'jump',
          pay_info: 'https://pay.example.com/jump',
          notify_payload_json: null,
          paid_at: null,
          created_at: '2026-04-18T10:00:00+08:00',
          updated_at: '2026-04-18T10:00:00+08:00',
        }),
        markPaid: async (outTradeNo, input) => {
          paidOrders.push({ outTradeNo, ...input });
          return true;
        },
        expireOpenOrdersByApplicationId: async () => 0,
      },
      applicantBillingRepository: createMockBillingRepository(),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 1000 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async () => true,
      },
      applicationNotificationService: {
        notifyPaymentReceived: async (input) => {
          paymentNotifications.push(input);
        },
      },
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/payment-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        out_trade_no: 'gr_7_1',
        trade_no: 'trade_1',
        trade_status: 'TRADE_SUCCESS',
        type: 'alipay',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'success');
    assert.equal(paidOrders.length, 1);
    assert.equal(paidApplications.length, 1);
    assert.equal(paidApplications[0].id, 7);
    assert.equal(paidApplications[0].amount, 1000);
    assert.equal(paymentNotifications.length, 1);
    assert.equal(paymentNotifications[0].paymentType, 'application_fee_paid');
    assert.equal(paymentNotifications[0].airportName, 'Cloud Airport');
    assert.equal(paymentNotifications[0].amount, 1000);
    assert.equal(paymentNotifications[0].outTradeNo, 'gr_7_1');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/recharge-notify credits recharge order on valid callback', async () => {
  const creditedOrders: Array<Record<string, unknown>> = [];
  const paymentNotifications: PaymentReceivedNotificationInput[] = [];

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount({ id: 1, application_id: 7 }),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({
          id: 7,
          name: 'Cloud Airport',
        }),
        markPaid: async () => true,
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => null,
        markPaid: async () => true,
        expireOpenOrdersByApplicationId: async () => 0,
      },
      applicantBillingRepository: createMockBillingRepository({
        getRechargeOrderByOutTradeNo: async () => ({
          id: 3,
          applicant_account_id: 1,
          out_trade_no: 'grr_1_1',
          channel: 'wxpay',
          amount: 300,
          status: 'created',
          pay_type: 'jump',
          pay_info: 'https://pay.example.com/recharge',
          paid_at: null,
          created_at: '2026-04-18T10:00:00+08:00',
        }),
        markRechargePaidAndCredit: async (outTradeNo: string, input: Record<string, unknown>) => {
          creditedOrders.push({ outTradeNo, ...input });
          return true;
        },
      }),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 300 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async () => true,
      },
      applicationNotificationService: {
        notifyPaymentReceived: async (input) => {
          paymentNotifications.push(input);
        },
      },
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/recharge-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        out_trade_no: 'grr_1_1',
        trade_no: 'trade_recharge_1',
        trade_status: 'TRADE_SUCCESS',
        type: 'wxpay',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'success');
    assert.equal(creditedOrders.length, 1);
    assert.equal(creditedOrders[0].outTradeNo, 'grr_1_1');
    assert.equal(creditedOrders[0].gateway_trade_no, 'trade_recharge_1');
    assert.equal(paymentNotifications.length, 1);
    assert.equal(paymentNotifications[0].paymentType, 'wallet_recharge_paid');
    assert.equal(paymentNotifications[0].airportName, 'Cloud Airport');
    assert.equal(paymentNotifications[0].amount, 300);
    assert.equal(paymentNotifications[0].outTradeNo, 'grr_1_1');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/payment-notify skips payment notification on duplicate callback', async () => {
  const paymentNotifications: PaymentReceivedNotificationInput[] = [];
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => null,
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({ id: 7, name: 'Cloud Airport' }),
        markPaid: async () => false,
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => ({
          id: 1,
          application_id: 7,
          out_trade_no: 'gr_7_1',
          gateway_trade_no: 'trade_1',
          channel: 'alipay',
          amount: 1000,
          status: 'paid',
          pay_type: 'jump',
          pay_info: 'https://pay.example.com/jump',
          notify_payload_json: null,
          paid_at: '2026-04-18T10:00:00+08:00',
          created_at: '2026-04-18T10:00:00+08:00',
          updated_at: '2026-04-18T10:00:00+08:00',
        }),
        markPaid: async () => false,
        expireOpenOrdersByApplicationId: async () => 0,
      },
      applicantBillingRepository: createMockBillingRepository(),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 1000 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async () => true,
      },
      applicationNotificationService: {
        notifyPaymentReceived: async (input) => {
          paymentNotifications.push(input);
        },
      },
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/payment-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        out_trade_no: 'gr_7_1',
        trade_no: 'trade_1',
        trade_status: 'TRADE_SUCCESS',
        type: 'alipay',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'success');
    assert.equal(paymentNotifications.length, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/recharge-notify keeps success response when payment notification fails', async () => {
  const creditedOrders: Array<Record<string, unknown>> = [];
  const originalConsoleError = console.error;
  const consoleErrors: unknown[][] = [];
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount({ id: 1, application_id: 7 }),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({ id: 7, name: 'Cloud Airport' }),
        markPaid: async () => true,
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => null,
        markPaid: async () => true,
        expireOpenOrdersByApplicationId: async () => 0,
      },
      applicantBillingRepository: createMockBillingRepository({
        getRechargeOrderByOutTradeNo: async () => ({
          id: 3,
          applicant_account_id: 1,
          out_trade_no: 'grr_1_1',
          channel: 'wxpay',
          amount: 300,
          status: 'created',
          pay_type: 'jump',
          pay_info: 'https://pay.example.com/recharge',
          paid_at: null,
          created_at: '2026-04-18T10:00:00+08:00',
        }),
        markRechargePaidAndCredit: async (outTradeNo: string, input: Record<string, unknown>) => {
          creditedOrders.push({ outTradeNo, ...input });
          return true;
        },
      }),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 300 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async () => true,
      },
      applicationNotificationService: {
        notifyPaymentReceived: async () => {
          throw new Error('telegram unavailable');
        },
      },
    }),
  );

  const server = app.listen(0);
  try {
    console.error = (...args: unknown[]) => {
      consoleErrors.push(args);
    };
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/recharge-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        out_trade_no: 'grr_1_1',
        trade_no: 'trade_recharge_1',
        trade_status: 'TRADE_SUCCESS',
        type: 'wxpay',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'success');
    assert.equal(creditedOrders.length, 1);
    assert.equal(consoleErrors.length, 1);
    assert.equal(consoleErrors[0][0], '[telegram] failed to notify payment received');
  } finally {
    console.error = originalConsoleError;
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/recharge-orders/:outTradeNo/cancel cancels own pending recharge order', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const canceledOrders: Array<{ applicantAccountId: number; outTradeNo: string }> = [];

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => ({
          id: 1,
          application_id: 7,
          email: 'user@example.com',
          password_hash: 'hash',
          must_change_password: false,
          last_login_at: null,
          created_at: '2026-04-18T10:00:00+08:00',
          updated_at: '2026-04-18T10:00:00+08:00',
        }),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => null,
        markPaid: async () => true,
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => null,
        markPaid: async () => true,
        expireOpenOrdersByApplicationId: async () => 0,
      },
      applicantBillingRepository: createMockBillingRepository({
        getRechargeOrderByOutTradeNo: async (outTradeNo: string) => ({
          id: 3,
          applicant_account_id: 1,
          out_trade_no: outTradeNo,
          channel: 'alipay',
          amount: 100,
          status: canceledOrders.length > 0 ? 'canceled' : 'created',
          pay_type: 'jump',
          pay_info: 'https://pay.example.com/recharge',
          paid_at: null,
          created_at: '2026-04-18T10:00:00+08:00',
        }),
        cancelRechargeOrder: async (applicantAccountId: number, outTradeNo: string) => {
          canceledOrders.push({ applicantAccountId, outTradeNo });
          return true;
        },
      }),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 300 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async () => true,
      },
    }),
  );
  app.use(errorHandler);

  const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/recharge-orders/grr_1_1/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json() as { recharge_order: { status: string } };

    assert.equal(response.status, 200);
    assert.deepEqual(canceledOrders, [{ applicantAccountId: 1, outTradeNo: 'grr_1_1' }]);
    assert.equal(body.recharge_order.status, 'canceled');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('PATCH /portal/application updates unpaid applicant details and syncs login email', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const updatedDrafts: Array<Record<string, unknown>> = [];
  const updatedEmails: Array<Record<string, unknown>> = [];
  const application: any = {
    id: 7,
    name: 'Cloud Airport',
    website: 'https://example.com',
    websites: ['https://example.com'],
    review_status: 'awaiting_payment' as const,
    payment_status: 'unpaid' as const,
    payment_amount: null,
    paid_at: null,
    applicant_email: 'user@example.com',
    applicant_telegram: '@cloud',
    founded_on: '2025-01-01',
    airport_intro: 'intro',
    plan_price_month: 1000,
    has_trial: true,
    subscription_url: 'https://subscribe.example.com',
    test_account: 'tester',
    test_password: 'secret',
    created_at: '2026-04-18 10:00:00',
  };
  const account = {
    id: 1,
    application_id: 7,
    email: 'user@example.com',
    password_hash: 'hash',
    must_change_password: false,
    last_login_at: null,
    created_at: '2026-04-18T10:00:00+08:00',
    updated_at: '2026-04-18T10:00:00+08:00',
  };

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => account,
        getByEmail: async (email) => (email === account.email ? account : null),
        updatePassword: async () => true,
        updateEmail: async (id, email) => {
          updatedEmails.push({ id, email });
          account.email = email;
          application.applicant_email = email;
          return true;
        },
      },
      airportApplicationRepository: {
        getById: async () => application,
        updateApplicantDraft: async (id, input) => {
          updatedDrafts.push({ id, ...input });
          Object.assign(application, input, {
            website: input.website,
            websites: input.websites || [input.website],
          });
          return true;
        },
        markPaid: async () => true,
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => null,
        markPaid: async () => true,
        expireOpenOrdersByApplicationId: async () => 0,
      },
      applicantBillingRepository: createMockBillingRepository(),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 1000 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async () => true,
      },
    }),
  );
  app.use(errorHandler);

  const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/application`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Cloud Airport Pro',
        websites: ['https://example.com', 'https://mirror.example.com'],
        plan_price_month: 1888,
        has_trial: false,
        subscription_url: 'https://subscribe-new.example.com',
        applicant_email: 'owner@example.com',
        applicant_telegram: '@cloudpro',
        founded_on: '2024-12-01',
        airport_intro: 'updated intro',
        test_account: 'tester-new',
        test_password: 'secret-new',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(updatedDrafts.length, 1);
    assert.equal(updatedDrafts[0].name, 'Cloud Airport Pro');
    assert.deepEqual(updatedDrafts[0].websites, ['https://example.com', 'https://mirror.example.com']);
    assert.equal(updatedEmails.length, 1);
    assert.equal(updatedEmails[0].email, 'owner@example.com');
    const data = (await response.json()) as {
      account: { email: string };
      application: { name: string; applicant_email: string; plan_price_month: number; websites: string[] };
    };
    assert.equal(data.account.email, 'owner@example.com');
    assert.equal(data.application.name, 'Cloud Airport Pro');
    assert.equal(data.application.applicant_email, 'owner@example.com');
    assert.equal(data.application.plan_price_month, 1888);
    assert.deepEqual(data.application.websites, ['https://example.com', 'https://mirror.example.com']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('PATCH /portal/application rejects changes after payment', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => ({
          id: 1,
          application_id: 7,
          email: 'user@example.com',
          password_hash: 'hash',
          must_change_password: false,
          last_login_at: null,
          created_at: '2026-04-18T10:00:00+08:00',
          updated_at: '2026-04-18T10:00:00+08:00',
        }),
        getByEmail: async () => null,
        updatePassword: async () => true,
        updateEmail: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({
          id: 7,
          name: 'Cloud Airport',
          website: 'https://example.com',
          websites: ['https://example.com'],
          review_status: 'pending',
          payment_status: 'paid',
          payment_amount: 1000,
          paid_at: '2026-04-18 11:00:00',
          applicant_email: 'user@example.com',
          applicant_telegram: '@cloud',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
          plan_price_month: 1000,
          has_trial: true,
          subscription_url: 'https://subscribe.example.com',
          test_account: 'tester',
          test_password: 'secret',
          created_at: '2026-04-18 10:00:00',
        }),
        updateApplicantDraft: async () => true,
        markPaid: async () => true,
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => null,
        markPaid: async () => true,
        expireOpenOrdersByApplicationId: async () => 0,
      },
      applicantBillingRepository: createMockBillingRepository(),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 1000 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async () => true,
      },
    }),
  );
  app.use(errorHandler);

  const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/application`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Cloud Airport Pro',
        websites: ['https://example.com'],
        plan_price_month: 1888,
        has_trial: false,
        subscription_url: 'https://subscribe-new.example.com',
        applicant_email: 'owner@example.com',
        applicant_telegram: '@cloudpro',
        founded_on: '2024-12-01',
        airport_intro: 'updated intro',
        test_account: 'tester-new',
        test_password: 'secret-new',
      }),
    });

    assert.equal(response.status, 409);
    const data = (await response.json()) as { code: string; message: string };
    assert.equal(data.code, 'PORTAL_APPLICATION_LOCKED');
    assert.match(data.message, /不能再修改申请资料/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/payment-orders/:outTradeNo/sync marks paid order and notifies Telegram', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const account = createMockApplicantAccount();
  const application: any = {
    id: 7,
    name: '回调及通知测试',
    website: 'https://example.com',
    websites: ['https://example.com'],
    review_status: 'awaiting_payment',
    payment_status: 'unpaid',
    payment_amount: null,
    paid_at: null,
    applicant_email: 'user@example.com',
    applicant_telegram: '@cloud',
    founded_on: '2025-01-01',
    airport_intro: 'intro',
    plan_price_month: 1000,
    has_trial: true,
    subscription_url: 'https://subscribe.example.com',
    test_account: 'tester',
    test_password: 'secret',
    created_at: '2026-04-18 10:00:00',
  };
  const order: any = {
    id: 10,
    application_id: 7,
    out_trade_no: 'gr_7_sync',
    gateway_trade_no: '202605100001',
    channel: 'alipay',
    amount: 10,
    status: 'created',
    pay_type: 'jump',
    pay_info: 'https://pay.example.com',
    notify_payload_json: null,
    paid_at: null,
    created_at: '2026-05-10T09:00:00+08:00',
    updated_at: '2026-05-10T09:00:00+08:00',
  };
  const notifications: PaymentReceivedNotificationInput[] = [];

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => account,
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => application,
        markPaid: async (_id, amount, paidAt) => {
          application.payment_status = 'paid';
          application.review_status = 'pending';
          application.payment_amount = amount;
          application.paid_at = paidAt;
          return true;
        },
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => order as any,
        getByOutTradeNo: async () => order as any,
        markPaid: async (_outTradeNo, input) => {
          order.status = 'paid';
          order.gateway_trade_no = input.gateway_trade_no || order.gateway_trade_no;
          order.pay_type = input.pay_type || order.pay_type;
          order.pay_info = input.pay_info || order.pay_info;
          order.paid_at = input.paid_at;
          return true;
        },
        expireOpenOrdersByApplicationId: async () => 0,
      },
      applicantBillingRepository: createMockBillingRepository(),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 10 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async () => true,
        queryOrder: async () => ({
          code: 0,
          msg: 'success',
          trade_no: '202605100001',
          out_trade_no: 'gr_7_sync',
          api_trade_no: 'ali-202605100001',
          type: 'alipay',
          status: 1,
          pid: '28615',
          addtime: '2026-05-10 09:00:00',
          endtime: '2026-05-10 09:01:00',
          name: 'GateRank test',
          money: 10,
          param: '7',
          raw: {
            code: 0,
            trade_no: '202605100001',
            out_trade_no: 'gr_7_sync',
            type: 'alipay',
            status: 1,
          },
        }),
      },
      applicationNotificationService: {
        notifyPaymentReceived: async (input) => {
          notifications.push(input);
        },
      },
    }),
  );
  app.use(errorHandler);

  const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/payment-orders/gr_7_sync/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json() as { application: { payment_status: string; review_status: string } };

    assert.equal(response.status, 200);
    assert.equal(data.application.payment_status, 'paid');
    assert.equal(data.application.review_status, 'pending');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].paymentType, 'application_fee_paid');
    assert.equal(notifications[0].airportName, '回调及通知测试');
    assert.equal(notifications[0].amount, 10);
    assert.equal(notifications[0].outTradeNo, 'gr_7_sync');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/recharge-orders/:outTradeNo/sync credits paid recharge and notifies Telegram', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const account = createMockApplicantAccount();
  const application: any = {
    id: 7,
    name: '充值同步测试机场',
    website: 'https://example.com',
    websites: ['https://example.com'],
    review_status: 'reviewed',
    payment_status: 'paid',
    payment_amount: 10,
    paid_at: '2026-05-10 09:00:00',
    applicant_email: 'user@example.com',
    applicant_telegram: '@cloud',
    founded_on: '2025-01-01',
    airport_intro: 'intro',
    plan_price_month: 1000,
    has_trial: true,
    subscription_url: 'https://subscribe.example.com',
    test_account: 'tester',
    test_password: 'secret',
    created_at: '2026-04-18 10:00:00',
  };
  const rechargeOrder: any = {
    id: 3,
    applicant_account_id: 1,
    out_trade_no: 'grr_1_sync',
    gateway_trade_no: '202605100002',
    channel: 'wxpay',
    amount: 100,
    status: 'created',
    pay_type: 'jump',
    pay_info: 'https://pay.example.com',
    notify_payload_json: null,
    paid_at: null,
    created_at: '2026-05-10T09:00:00+08:00',
  };
  const notifications: PaymentReceivedNotificationInput[] = [];

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => account,
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => application,
        markPaid: async () => true,
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => null,
        markPaid: async () => true,
        expireOpenOrdersByApplicationId: async () => 0,
      },
      applicantBillingRepository: createMockBillingRepository({
        getRechargeOrderByOutTradeNo: async () => rechargeOrder,
        markRechargePaidAndCredit: async (_outTradeNo: string, input: { paid_at: string }) => {
          rechargeOrder.status = 'paid';
          rechargeOrder.paid_at = input.paid_at;
          return true;
        },
      }),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 10 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async () => true,
        queryOrder: async () => ({
          code: 0,
          msg: 'success',
          trade_no: '202605100002',
          out_trade_no: 'grr_1_sync',
          api_trade_no: 'wx-202605100002',
          type: 'wxpay',
          status: 1,
          pid: '28615',
          addtime: '2026-05-10 09:00:00',
          endtime: '2026-05-10 09:01:00',
          name: 'GateRank test',
          money: 100,
          param: '1',
          raw: {
            code: 0,
            trade_no: '202605100002',
            out_trade_no: 'grr_1_sync',
            type: 'wxpay',
            status: 1,
          },
        }),
      },
      applicationNotificationService: {
        notifyPaymentReceived: async (input) => {
          notifications.push(input);
        },
      },
    }),
  );
  app.use(errorHandler);

  const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/recharge-orders/grr_1_sync/sync`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json() as { recharge_order: { status: string; paid_at: string } };

    assert.equal(response.status, 200);
    assert.equal(data.recharge_order.status, 'paid');
    assert.equal(data.recharge_order.paid_at, '2026-05-10 09:01:00');
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].paymentType, 'wallet_recharge_paid');
    assert.equal(notifications[0].airportName, '充值同步测试机场');
    assert.equal(notifications[0].amount, 100);
    assert.equal(notifications[0].outTradeNo, 'grr_1_sync');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
