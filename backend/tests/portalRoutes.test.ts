import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'node:net';
import { createPortalRoutes } from '../src/routes/portalRoutes';
import { errorHandler } from '../src/middleware/errorHandler';
import { signApplicantToken } from '../src/utils/token';

test('POST /portal/payment-orders creates payment order from configured amount', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const createdOrders: Array<Record<string, unknown>> = [];

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
      },
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({ application_fee_amount: 1888 }),
      },
      paymentGatewayService: {
        createOrder: async () => ({
          trade_no: 'trade_1',
          pay_type: 'jump',
          pay_info: 'https://pay.example.com/jump',
        }),
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
      },
      body: JSON.stringify({ channel: 'alipay' }),
    });

    assert.equal(response.status, 201);
    assert.equal(createdOrders.length, 1);
    assert.equal(createdOrders[0].amount, 1888);
    assert.equal(createdOrders[0].channel, 'alipay');
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
      },
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
