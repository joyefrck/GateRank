import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'node:net';
import { createPortalRoutes } from '../src/routes/portalRoutes';
import { errorHandler } from '../src/middleware/errorHandler';
import type { PaymentGatewayCreateOrderInput } from '../src/services/paymentGatewayService';
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

test('POST /portal/payment-orders creates payment order from configured amount', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
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
    assert.match(String(gatewayOrders[0].notify_url || ''), /\/api\/v1\/portal\/payment-notify$/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/payment-notify marks payment as paid on valid callback', async () => {
  const paidOrders: Array<Record<string, unknown>> = [];
  const paidApplications: Array<Record<string, unknown>> = [];

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
        getById: async () => null,
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
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/recharge-notify credits recharge order on valid callback', async () => {
  const creditedOrders: Array<Record<string, unknown>> = [];

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
        getRechargeOrderByOutTradeNo: async () => ({
          id: 3,
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
  } finally {
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
  const application = {
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
