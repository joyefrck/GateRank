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

function createMockUserTelegramBotTemplates() {
  return {
    low_balance_warning: { enabled: true, body: 'low balance' },
    airport_auto_unlisted: { enabled: true, body: 'offline' },
    airport_online: { enabled: true, body: 'online' },
    recharge_welcome: { enabled: true, body: 'welcome' },
  };
}

function createMockBillingRepository(overrides: Record<string, unknown> = {}) {
  return {
    ensureWalletForAccount: async () => ({
      id: 1,
      applicant_account_id: 1,
      application_id: 7,
      airport_id: null,
      airport_is_listed: null,
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
      airport_is_listed: null,
      balance: 0,
      auto_unlisted_at: null,
      created_at: '2026-04-18T10:00:00+08:00',
      updated_at: '2026-04-18T10:00:00+08:00',
    }),
    createRechargeOrder: async () => 1,
    getRechargeOrderByOutTradeNo: async () => null,
    listRechargeOrders: async () => ({ items: [], total: 0 }),
    cancelRechargeOrder: async () => true,
    markRechargePaidAndCredit: async () => true,
    listTransactions: async () => ({ items: [], total: 0 }),
    listClicks: async () => ({ items: [], total: 0 }),
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

function createMockAirportDeal(overrides: Record<string, unknown> = {}) {
  return {
    campaign_id: 99,
    airport_id: 11,
    airport_name: '星云机场',
    airport_slug: 'nebula',
    website: 'https://nebula.example.com',
    report_url: '/airports/nebula',
    coupon_code: 'NEW220',
    discount_title: '新用户优惠',
    discount_description: '新用户首单 8 折',
    applicable_plan: '月付 / 季付',
    starts_at: '2026-05-24T10:00:00+08:00',
    ends_at: '2026-06-24T10:00:00+08:00',
    purchased_months: 1,
    billed_amount: 1000,
    is_stackable: false,
    refund_supported: true,
    supports_trial: true,
    supports_usdt: true,
    supports_streaming: true,
    supports_ai: true,
    low_price_plan: true,
    discount_percent: 20,
    created_at: '2026-05-24T10:00:00+08:00',
    ...overrides,
  };
}

test('GET /portal/me returns marketing billing fees', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
        updatePassword: async () => true,
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
          applicant_email: 'user@example.com',
          applicant_telegram: '@cloud',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
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
        getConfig: async () => ({
          enabled: true,
          pid: '28615',
          private_key: 'private-key',
          platform_public_key: 'public-key',
          epay: { enabled: true },
          usdt: {
            enabled: false,
            gateway_url: '',
            merchant_id: '',
            secret_key: '',
          },
        }),
      },
      marketingSettingsService: {
        getConfig: async () => ({
          application_fee_amount: 456,
          click_charge_amount: 2.5,
          recharge_amounts: [88, 188, 288],
          admin_telegram_username: 'gaterank_admin',
        }),
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
    const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
    const response = await fetch(`http://127.0.0.1:${port}/portal/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const data = (await response.json()) as {
      payment_fee_amount: number;
      payment_methods: string[];
      click_price: number;
      recharge_amounts: number[];
      admin_telegram_username: string | null;
    };
    assert.equal(data.payment_fee_amount, 456);
    assert.deepEqual(data.payment_methods, ['alipay', 'wxpay']);
    assert.equal(data.click_price, 2.5);
    assert.deepEqual(data.recharge_amounts, [88, 188, 288]);
    assert.equal(data.admin_telegram_username, 'gaterank_admin');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /portal/me exposes remaining ad slots based on active campaign count', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount({ application_id: 7 }),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({
          id: 7,
          name: '小米',
          website: 'https://www.xiaomi.com',
          websites: ['https://www.xiaomi.com'],
          approved_airport_id: 11,
          review_status: 'reviewed',
          payment_status: 'paid',
          payment_amount: 100,
          applicant_email: 'user@example.com',
          applicant_telegram: '@xiaomi',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
          created_at: '2026-04-18 10:00:00',
        }),
        markPaid: async () => true,
      },
      airportRepository: {
        getById: async () => ({
          id: 11,
          slug: 'xiaomi',
          name: '小米',
          website: 'https://www.xiaomi.com',
          websites: ['https://www.xiaomi.com'],
          status: 'normal',
          is_listed: true,
          plan_price_month: 18,
          has_trial: true,
          tags: [],
          created_at: '2026-04-18T10:00:00+08:00',
        }),
        update: async () => true,
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => null,
        markPaid: async () => true,
        expireOpenOrdersByApplicationId: async () => 0,
      },
      applicantBillingRepository: createMockBillingRepository({
        ensureWalletForAccount: async () => ({
          id: 1,
          applicant_account_id: 1,
          application_id: 7,
          airport_id: 11,
          airport_is_listed: true,
          balance: 95.2,
          auto_unlisted_at: null,
          created_at: '2026-04-18T10:00:00+08:00',
          updated_at: '2026-04-18T10:00:00+08:00',
        }),
      }),
      airportAdCampaignRepository: {
        getPortalStatus: async (_airportId, monthlyPrice) => ({
          active_campaign: createMockAirportDeal({ airport_name: '小米' }),
          campaigns: [{
            ...createMockAirportDeal({ airport_name: '小米' }),
            status: 'active',
            status_label: '投放中',
            is_active: true,
          }],
          remaining_slots: 5,
          slot_limit: 6,
          monthly_price: monthlyPrice ?? 1000,
          low_balance_warning_threshold: 100,
          allowed_months: [1, 2, 3, 6, 12],
        }),
        purchase: async () => {
          throw new Error('not used');
        },
        update: async () => {
          throw new Error('not used');
        },
        cancel: async () => {
          throw new Error('not used');
        },
      },
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: { getConfig: async () => ({ epay: { enabled: true } }) },
      marketingSettingsService: {
        getConfig: async () => ({
          application_fee_amount: 300,
          click_charge_amount: 1,
          airport_ad_monthly_price: 1288.88,
        }),
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
    const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
    const response = await fetch(`http://127.0.0.1:${port}/portal/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as { ad_status: { remaining_slots: number; slot_limit: number; monthly_price: number; campaigns: unknown[] } };

    assert.equal(response.status, 200);
    assert.equal(data.ad_status.remaining_slots, 5);
    assert.equal(data.ad_status.slot_limit, 6);
    assert.equal(data.ad_status.monthly_price, 1288.88);
    assert.equal(data.ad_status.campaigns.length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /portal/wallet returns configured recharge amounts', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
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
      applicantBillingRepository: createMockBillingRepository(),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({}),
      },
      marketingSettingsService: {
        getConfig: async () => ({
          application_fee_amount: 456,
          click_charge_amount: 2.5,
          recharge_amounts: [120, 240],
        }),
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
    const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
    const response = await fetch(`http://127.0.0.1:${port}/portal/wallet`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const data = (await response.json()) as { recharge_amounts: number[]; click_price: number };
    assert.deepEqual(data.recharge_amounts, [120, 240]);
    assert.equal(data.click_price, 2.5);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/ad-campaign purchases another campaign when the same airport already has an active ad', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const app = express();
  app.use(express.json());

  let purchaseInput: Record<string, unknown> | null = null;
  let cacheCleared = false;
  app.use(createPortalRoutes({
    applicantAccountRepository: {
      getById: async () => createMockApplicantAccount({ application_id: 7 }),
      updatePassword: async () => true,
    },
    airportApplicationRepository: {
      getById: async () => ({
        id: 7,
        name: '星云机场',
        website: 'https://nebula.example.com',
        websites: ['https://nebula.example.com'],
        approved_airport_id: 11,
        review_status: 'reviewed',
        payment_status: 'paid',
        payment_amount: 100,
        applicant_email: 'user@example.com',
        applicant_telegram: '@nebula',
        founded_on: '2025-01-01',
        airport_intro: 'intro',
        created_at: '2026-04-18 10:00:00',
      }),
      markPaid: async () => true,
    },
    airportRepository: {
      getById: async () => ({
        id: 11,
        slug: 'nebula',
        name: '星云机场',
        website: 'https://nebula.example.com',
        websites: ['https://nebula.example.com'],
        status: 'normal',
        is_listed: true,
        plan_price_month: 18,
        has_trial: true,
        tags: [],
        created_at: '2026-04-18T10:00:00+08:00',
      }),
      update: async () => true,
    },
    applicationPaymentOrderRepository: {
      create: async () => 1,
      getLatestByApplicationId: async () => null,
      getByOutTradeNo: async () => null,
      markPaid: async () => true,
      expireOpenOrdersByApplicationId: async () => 0,
    },
    applicantBillingRepository: createMockBillingRepository({
      getWalletByAccountId: async () => ({
        id: 1,
        applicant_account_id: 1,
        application_id: 7,
        airport_id: 11,
        balance: 500,
        auto_unlisted_at: null,
        created_at: '2026-04-18T10:00:00+08:00',
        updated_at: '2026-04-18T10:00:00+08:00',
      }),
    }),
    airportAdCampaignRepository: {
      getPortalStatus: async (_airportId, monthlyPrice) => ({
        active_campaign: createMockAirportDeal(),
        campaigns: [],
        remaining_slots: 5,
        slot_limit: 6,
        monthly_price: monthlyPrice ?? 1000,
        low_balance_warning_threshold: 100,
        allowed_months: [1, 2, 3, 6, 12],
      }),
      purchase: async (input) => {
        purchaseInput = input;
        return createMockAirportDeal({
          airport_id: input.airport_id,
          coupon_code: input.coupon_code,
          discount_title: input.discount_title,
          discount_description: input.discount_description,
          applicable_plan: input.applicable_plan,
          purchased_months: input.months,
          is_stackable: input.is_stackable,
          refund_supported: input.refund_supported,
          discount_percent: input.discount_percent,
        });
      },
      update: async () => {
        throw new Error('not used');
      },
      cancel: async () => {
        throw new Error('not used');
      },
    },
    applicantPortalAuthService: {
      login: async () => {
        throw new Error('not used');
      },
    },
    paymentGatewaySettingsService: { getConfig: async () => ({ epay: { enabled: true } }) },
    marketingSettingsService: {
      getConfig: async () => ({
        application_fee_amount: 300,
        click_charge_amount: 1,
        airport_ad_monthly_price: 1288.88,
      }),
    },
    paymentGatewayService: {
      createOrder: async () => {
        throw new Error('not used');
      },
      verifyNotificationPayload: async () => true,
    },
    publicPageCache: {
      clear: () => {
        cacheCleared = true;
      },
    },
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
    const response = await fetch(`http://127.0.0.1:${port}/portal/ad-campaign`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        months: 1,
        coupon_code: 'NEW220',
        discount_title: '新用户优惠',
        discount_description: '新用户首单 8 折',
        applicable_plan: '月付 / 季付',
        is_stackable: false,
        refund_supported: true,
        discount_percent: 20,
      }),
    });
    const data = (await response.json()) as { campaign: { campaign_id: number }; ad_status: { remaining_slots: number; slot_limit: number } };
    assert.equal(response.status, 201);
    assert.equal(data.campaign.campaign_id, 99);
    assert.equal(data.ad_status.remaining_slots, 5);
    assert.equal(data.ad_status.slot_limit, 6);
    const capturedPurchase = purchaseInput as unknown as Record<string, unknown>;
    assert.equal(capturedPurchase.airport_id, 11);
    assert.equal(capturedPurchase.applicant_account_id, 1);
    assert.equal(capturedPurchase.application_id, 7);
    assert.equal(capturedPurchase.monthly_price, 1288.88);
    assert.equal(capturedPurchase.coupon_code, 'NEW220');
    assert.equal(cacheCleared, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('PATCH /portal/ad-campaign/:campaignId edits an active campaign without extending or charging', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const app = express();
  app.use(express.json());

  let updateInput: Record<string, unknown> | null = null;
  let cacheCleared = false;
  app.use(createPortalRoutes({
    applicantAccountRepository: {
      getById: async () => createMockApplicantAccount({ application_id: 7 }),
      updatePassword: async () => true,
    },
    airportApplicationRepository: {
      getById: async () => ({
        id: 7,
        name: '星云机场',
        website: 'https://nebula.example.com',
        websites: ['https://nebula.example.com'],
        approved_airport_id: 11,
        review_status: 'reviewed',
        payment_status: 'paid',
        payment_amount: 100,
        applicant_email: 'user@example.com',
        applicant_telegram: '@nebula',
        founded_on: '2025-01-01',
        airport_intro: 'intro',
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
    applicantBillingRepository: createMockBillingRepository({
      getWalletByAccountId: async () => ({
        id: 1,
        applicant_account_id: 1,
        application_id: 7,
        airport_id: 11,
        balance: 500,
        auto_unlisted_at: null,
        created_at: '2026-04-18T10:00:00+08:00',
        updated_at: '2026-04-18T10:00:00+08:00',
      }),
    }),
    airportAdCampaignRepository: {
      getPortalStatus: async (_airportId, monthlyPrice) => ({
        active_campaign: createMockAirportDeal(),
        campaigns: [],
        remaining_slots: 6,
        slot_limit: 6,
        monthly_price: monthlyPrice ?? 1000,
        low_balance_warning_threshold: 100,
        allowed_months: [1, 2, 3, 6, 12],
      }),
      purchase: async () => {
        throw new Error('not used');
      },
      update: async (input) => {
        updateInput = input;
        return createMockAirportDeal({
          campaign_id: input.campaign_id,
          coupon_code: input.coupon_code,
          discount_title: input.discount_title,
          discount_description: input.discount_description,
          applicable_plan: input.applicable_plan,
          is_stackable: input.is_stackable,
          refund_supported: input.refund_supported,
          discount_percent: input.discount_percent,
        });
      },
      cancel: async () => {
        throw new Error('not used');
      },
    },
    applicantPortalAuthService: {
      login: async () => {
        throw new Error('not used');
      },
    },
    paymentGatewaySettingsService: { getConfig: async () => ({ epay: { enabled: true } }) },
    marketingSettingsService: {
      getConfig: async () => ({
        application_fee_amount: 300,
        click_charge_amount: 1,
        airport_ad_monthly_price: 1288.88,
      }),
    },
    paymentGatewayService: {
      createOrder: async () => {
        throw new Error('not used');
      },
      verifyNotificationPayload: async () => true,
    },
    publicPageCache: {
      clear: () => {
        cacheCleared = true;
      },
    },
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
    const response = await fetch(`http://127.0.0.1:${port}/portal/ad-campaign/99`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extend_months: 0,
        coupon_code: 'EDIT550',
        discount_title: '修改文案',
        discount_description: '只改说明',
        applicable_plan: '所有套餐',
        is_stackable: true,
        refund_supported: false,
        discount_percent: 15,
      }),
    });
    const data = (await response.json()) as { campaign: { coupon_code: string } };
    assert.equal(response.status, 200);
    assert.equal(data.campaign.coupon_code, 'EDIT550');
    const capturedUpdate = updateInput as unknown as Record<string, unknown>;
    assert.equal(capturedUpdate.campaign_id, 99);
    assert.equal(capturedUpdate.extend_months, 0);
    assert.equal(capturedUpdate.monthly_price, 1288.88);
    assert.equal(capturedUpdate.airport_id, 11);
    assert.equal(capturedUpdate.applicant_account_id, 1);
    assert.equal(cacheCleared, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('PATCH /portal/ad-campaign/:campaignId forwards extension months for paid renewal', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const app = express();
  app.use(express.json());

  let updateInput: Record<string, unknown> | null = null;
  app.use(createPortalRoutes({
    applicantAccountRepository: {
      getById: async () => createMockApplicantAccount({ application_id: 7 }),
      updatePassword: async () => true,
    },
    airportApplicationRepository: {
      getById: async () => ({
        id: 7,
        name: '星云机场',
        website: 'https://nebula.example.com',
        websites: ['https://nebula.example.com'],
        approved_airport_id: 11,
        review_status: 'reviewed',
        payment_status: 'paid',
        payment_amount: 100,
        applicant_email: 'user@example.com',
        applicant_telegram: '@nebula',
        founded_on: '2025-01-01',
        airport_intro: 'intro',
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
    airportAdCampaignRepository: {
      getPortalStatus: async (_airportId, monthlyPrice) => ({
        active_campaign: createMockAirportDeal(),
        campaigns: [],
        remaining_slots: 6,
        slot_limit: 6,
        monthly_price: monthlyPrice ?? 1000,
        low_balance_warning_threshold: 100,
        allowed_months: [1, 2, 3, 6, 12],
      }),
      purchase: async () => {
        throw new Error('not used');
      },
      update: async (input) => {
        updateInput = input;
        return createMockAirportDeal({
          campaign_id: input.campaign_id,
          purchased_months: 2,
          billed_amount: 2000,
        });
      },
      cancel: async () => {
        throw new Error('not used');
      },
    },
    applicantPortalAuthService: {
      login: async () => {
        throw new Error('not used');
      },
    },
    paymentGatewaySettingsService: { getConfig: async () => ({ epay: { enabled: true } }) },
    marketingSettingsService: {
      getConfig: async () => ({
        application_fee_amount: 300,
        click_charge_amount: 1,
        airport_ad_monthly_price: 1288.88,
      }),
    },
    paymentGatewayService: {
      createOrder: async () => {
        throw new Error('not used');
      },
      verifyNotificationPayload: async () => true,
    },
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
    const response = await fetch(`http://127.0.0.1:${port}/portal/ad-campaign/99`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        extend_months: 1,
        coupon_code: 'NEW220',
        discount_title: '续投',
        discount_description: '延长一个月',
        applicable_plan: '月付',
        is_stackable: false,
        refund_supported: true,
        discount_percent: 20,
      }),
    });
    assert.equal(response.status, 200);
    const capturedUpdate = updateInput as unknown as Record<string, unknown>;
    assert.equal(capturedUpdate.extend_months, 1);
    assert.equal(capturedUpdate.monthly_price, 1288.88);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/ad-campaign/:campaignId/cancel marks campaign canceled without refund', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const app = express();
  app.use(express.json());

  let cancelInput: Record<string, unknown> | null = null;
  let cacheCleared = false;
  app.use(createPortalRoutes({
    applicantAccountRepository: {
      getById: async () => createMockApplicantAccount({ application_id: 7 }),
      updatePassword: async () => true,
    },
    airportApplicationRepository: {
      getById: async () => ({
        id: 7,
        name: '星云机场',
        website: 'https://nebula.example.com',
        websites: ['https://nebula.example.com'],
        approved_airport_id: 11,
        review_status: 'reviewed',
        payment_status: 'paid',
        payment_amount: 100,
        applicant_email: 'user@example.com',
        applicant_telegram: '@nebula',
        founded_on: '2025-01-01',
        airport_intro: 'intro',
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
    applicantBillingRepository: createMockBillingRepository({
      getWalletByAccountId: async () => ({
        id: 1,
        applicant_account_id: 1,
        application_id: 7,
        airport_id: 11,
        balance: 500,
        auto_unlisted_at: null,
        created_at: '2026-04-18T10:00:00+08:00',
        updated_at: '2026-04-18T10:00:00+08:00',
      }),
    }),
    airportAdCampaignRepository: {
      getPortalStatus: async () => ({
        active_campaign: null,
        campaigns: [{
          ...createMockAirportDeal({ campaign_id: 99 }),
          status: 'canceled',
          status_label: '已下架',
          is_active: false,
        }],
        remaining_slots: 6,
        slot_limit: 6,
        monthly_price: 1000,
        low_balance_warning_threshold: 100,
        allowed_months: [1, 2, 3, 6, 12],
      }),
      purchase: async () => {
        throw new Error('not used');
      },
      update: async () => {
        throw new Error('not used');
      },
      cancel: async (input) => {
        cancelInput = input;
        return true;
      },
    },
    applicantPortalAuthService: {
      login: async () => {
        throw new Error('not used');
      },
    },
    paymentGatewaySettingsService: { getConfig: async () => ({ epay: { enabled: true } }) },
    paymentGatewayService: {
      createOrder: async () => {
        throw new Error('not used');
      },
      verifyNotificationPayload: async () => true,
    },
    publicPageCache: {
      clear: () => {
        cacheCleared = true;
      },
    },
  }));
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
    const response = await fetch(`http://127.0.0.1:${port}/portal/ad-campaign/99/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as {
      ad_status: { remaining_slots: number; campaigns: Array<{ status: string; status_label: string; is_active: boolean }> };
      wallet: { balance: number };
    };

    assert.equal(response.status, 200);
    const capturedCancel = cancelInput as unknown as Record<string, unknown>;
    assert.equal(capturedCancel.campaign_id, 99);
    assert.equal(capturedCancel.airport_id, 11);
    assert.equal(capturedCancel.applicant_account_id, 1);
    assert.equal(capturedCancel.application_id, 7);
    assert.equal(cacheCleared, true);
    assert.equal(data.wallet.balance, 500);
    assert.equal(data.ad_status.remaining_slots, 6);
    assert.equal(data.ad_status.campaigns[0].status, 'canceled');
    assert.equal(data.ad_status.campaigns[0].status_label, '已下架');
    assert.equal(data.ad_status.campaigns[0].is_active, false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /portal/me hides epay methods when epay switch is disabled', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
        updatePassword: async () => true,
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
          applicant_email: 'user@example.com',
          applicant_telegram: '@cloud',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
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
        getConfig: async () => ({
          enabled: true,
          pid: '28615',
          private_key: 'private-key',
          platform_public_key: 'public-key',
          epay: { enabled: false },
          usdt: {
            enabled: true,
            gateway_url: 'https://pay-usdt.example.com',
            merchant_id: '1000',
            secret_key: 'secret',
          },
        }),
      },
      marketingSettingsService: {
        getConfig: async () => ({
          application_fee_amount: 456,
          click_charge_amount: 2.5,
          admin_telegram_username: null,
        }),
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
    const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
    const response = await fetch(`http://127.0.0.1:${port}/portal/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await response.json()) as { payment_methods: string[] };
    assert.equal(response.status, 200);
    assert.deepEqual(data.payment_methods, ['usdt']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /portal/me returns current airport listing state', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({
          id: 7,
          name: 'Cloud Airport',
          website: 'https://example.com',
          websites: ['https://example.com'],
          review_status: 'reviewed',
          payment_status: 'paid',
          payment_amount: 456,
          applicant_email: 'user@example.com',
          applicant_telegram: '@cloud',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
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
      applicantBillingRepository: createMockBillingRepository({
        ensureWalletForAccount: async () => ({
          id: 1,
          applicant_account_id: 1,
          application_id: 7,
          airport_id: 83,
          airport_is_listed: false,
          balance: 20,
          auto_unlisted_at: null,
          created_at: '2026-04-18T10:00:00+08:00',
          updated_at: '2026-04-18T10:00:00+08:00',
        }),
      }),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({}),
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
    const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
    const response = await fetch(`http://127.0.0.1:${port}/portal/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const data = (await response.json()) as {
      wallet: {
        airport_id: number | null;
        airport_is_listed: boolean | null;
        auto_unlisted_at: string | null;
      };
    };
    assert.equal(data.wallet.airport_id, 83);
    assert.equal(data.wallet.airport_is_listed, false);
    assert.equal(data.wallet.auto_unlisted_at, null);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /portal/me hydrates approved airport operations into applicant profile', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({
          id: 7,
          name: '小米',
          website: 'https://application.example.com',
          websites: ['https://application.example.com'],
          approved_airport_id: 42,
          review_status: 'reviewed',
          payment_status: 'paid',
          payment_amount: 456,
          applicant_email: 'user@example.com',
          applicant_telegram: '@application',
          founded_on: '2025-01-01',
          airport_intro: 'application intro',
          plan_price_month: 1000,
          has_trial: true,
          streaming_support: [],
          payment_methods: [],
          payment_crypto_other: null,
          profile: {},
          subscription_url: null,
          test_account: 'application-user',
          test_password: 'application-pass',
          created_at: '2026-04-18 10:00:00',
        }),
        markPaid: async () => true,
      },
      airportRepository: {
        getById: async (id) => ({
          id,
          name: '小米',
          website: 'https://mi.example.com',
          websites: ['https://mi.example.com', 'https://backup.mi.example.com'],
          status: 'normal',
          is_listed: true,
          plan_price_month: 1888,
          has_trial: false,
          streaming_support: ['netflix', 'chatgpt', 'youtube_premium'],
          payment_methods: ['wechat', 'alipay', 'usdt_trc20'],
          payment_crypto_other: null,
          profile: {
            plan: {
              supports_monthly: true,
              supports_quarterly: null,
              supports_half_yearly: null,
              supports_annual: true,
              lowest_monthly_price: 1888,
              lowest_annual_monthly_price: 1200,
              has_trial_plan: false,
              has_lifetime_plan: null,
            },
            regions: {
              hong_kong: {
                has_residential: true,
                has_native_ip: false,
                line_types: ['iepl', 'iplc'],
              },
            },
            clients: { clash: true },
            import_methods: { one_click_import: true },
          } as any,
          subscription_url: 'https://subscribe.mi.example.com',
          applicant_telegram: '@mi',
          founded_on: '2024-12-01',
          airport_intro: 'airport intro',
          test_account: 'airport-user',
          test_password: 'airport-pass',
          tags: [],
          created_at: '2026-04-18 10:00:00',
        } as any),
        update: async () => true,
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
        getConfig: async () => ({}),
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
    const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
    const response = await fetch(`http://127.0.0.1:${port}/portal/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    const data = (await response.json()) as {
      application: {
        website: string;
        websites: string[];
        plan_price_month: number;
        has_trial: boolean;
        streaming_support: string[];
        payment_methods: string[];
        subscription_url: string | null;
        applicant_email: string;
        applicant_telegram: string;
        airport_intro: string;
        test_account: string;
        profile: {
          plan: { supports_annual: boolean | null; lowest_monthly_price: number | null };
          clients: { clash: boolean | null };
          import_methods: { one_click_import: boolean | null };
          regions: { hong_kong: { has_residential: boolean | null; line_types: string[] } };
        };
      };
    };
    assert.equal(data.application.website, 'https://mi.example.com');
    assert.deepEqual(data.application.websites, ['https://mi.example.com', 'https://backup.mi.example.com']);
    assert.equal(data.application.plan_price_month, 1888);
    assert.equal(data.application.has_trial, false);
    assert.deepEqual(data.application.streaming_support, ['netflix', 'chatgpt', 'youtube_premium']);
    assert.deepEqual(data.application.payment_methods, ['wechat', 'alipay', 'usdt_trc20']);
    assert.equal(data.application.subscription_url, 'https://subscribe.mi.example.com');
    assert.equal(data.application.applicant_email, 'user@example.com');
    assert.equal(data.application.applicant_telegram, '@mi');
    assert.equal(data.application.airport_intro, 'airport intro');
    assert.equal(data.application.test_account, 'airport-user');
    assert.equal(data.application.profile.plan.supports_annual, true);
    assert.equal(data.application.profile.plan.lowest_monthly_price, 1888);
    assert.equal(data.application.profile.clients.clash, true);
    assert.equal(data.application.profile.import_methods.one_click_import, true);
    assert.equal(data.application.profile.regions.hong_kong.has_residential, true);
    assert.deepEqual(data.application.profile.regions.hong_kong.line_types, ['iepl', 'iplc']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/telegram-bind/start creates Telegram deep link before review or payment', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({
          id: 7,
          name: 'Cloud Airport',
          website: 'https://example.com',
          websites: ['https://example.com'],
          review_status: 'awaiting_payment',
          payment_status: 'unpaid',
          payment_amount: 456,
          applicant_email: 'user@example.com',
          applicant_telegram: '@cloud',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
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
      applicantTelegramBindingRepository: {
        createBindToken: async () => ({
          token: 'bind-token',
          expires_at: '2026-05-16T10:10:00.000Z',
        }),
        getByApplicantAccountId: async () => null,
        unbindApplicantAccount: async () => false,
      },
      userTelegramBotSettingsService: {
        getConfig: async () => ({
          enabled: true,
          bot_token: '123456:abcdefghi',
          bot_username: 'gaterank_user_bot',
          api_base: 'https://api.telegram.org',
          webhook_origin: 'https://example.com',
          webhook_secret: 'secret-token',
          webhook_last_synced_at: '2026-05-16T10:00:00.000Z',
          templates: createMockUserTelegramBotTemplates(),
        }),
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({}),
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
    const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
    const response = await fetch(`http://127.0.0.1:${port}/portal/telegram-bind/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 201);
    const data = (await response.json()) as { binding_url: string; expires_at: string };
    assert.equal(data.binding_url, 'https://t.me/gaterank_user_bot?start=bind-token');
    assert.equal(data.expires_at, '2026-05-16T10:10:00.000Z');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/telegram-bind/start requires webhook-ready user bot config', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({
          id: 7,
          name: 'Cloud Airport',
          website: 'https://example.com',
          websites: ['https://example.com'],
          review_status: 'reviewed',
          payment_status: 'paid',
          payment_amount: 456,
          applicant_email: 'user@example.com',
          applicant_telegram: '@cloud',
          founded_on: '2025-01-01',
          airport_intro: 'intro',
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
      applicantTelegramBindingRepository: {
        createBindToken: async () => {
          throw new Error('not used');
        },
        getByApplicantAccountId: async () => null,
        unbindApplicantAccount: async () => false,
      },
      userTelegramBotSettingsService: {
        getConfig: async () => ({
          enabled: true,
          bot_token: '123456:abcdefghi',
          bot_username: 'gaterank_user_bot',
          api_base: 'https://api.telegram.org',
          webhook_origin: '',
          webhook_secret: 'secret-token',
          webhook_last_synced_at: '2026-05-16T10:00:00.000Z',
          templates: createMockUserTelegramBotTemplates(),
        }),
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({}),
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
    const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
    const response = await fetch(`http://127.0.0.1:${port}/portal/telegram-bind/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 409);
    const data = (await response.json()) as { message: string };
    assert.match(data.message, /Webhook/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET portal billing lists return paginated data and safe defaults', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const calls: Array<{ kind: string; page?: number; pageSize?: number }> = [];
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
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
        listRechargeOrders: async (_accountId: number, page?: number, pageSize?: number) => {
          calls.push({ kind: 'recharge', page, pageSize });
          return {
            total: 21,
            items: [{
              id: 1,
              applicant_account_id: 1,
              out_trade_no: 'grr_1',
              gateway_trade_no: null,
              channel: 'usdt',
              amount: 100,
              status: 'created',
              pay_type: null,
              pay_info: null,
              paid_at: null,
              created_at: '2026-05-10T10:00:00+08:00',
            }],
          };
        },
        listClicks: async (_accountId: number, page?: number, pageSize?: number) => {
          calls.push({ kind: 'clicks', page, pageSize });
          return { total: 0, items: [] };
        },
        listTransactions: async (_accountId: number, page?: number, pageSize?: number) => {
          calls.push({ kind: 'transactions', page, pageSize });
          return { total: 0, items: [] };
        },
      }),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({}),
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
    const auth = { Authorization: `Bearer ${token}` };
    const rechargeResponse = await fetch(`http://127.0.0.1:${port}/portal/recharge-orders?page=2&page_size=20`, { headers: auth });
    const clicksResponse = await fetch(`http://127.0.0.1:${port}/portal/clicks?page=bad&page_size=bad`, { headers: auth });
    const transactionsResponse = await fetch(`http://127.0.0.1:${port}/portal/wallet-transactions?page=3&page_size=200`, { headers: auth });

    assert.equal(rechargeResponse.status, 200);
    assert.equal(clicksResponse.status, 200);
    assert.equal(transactionsResponse.status, 200);
    assert.deepEqual(await rechargeResponse.json(), {
      items: [{
        id: 1,
        applicant_account_id: 1,
        out_trade_no: 'grr_1',
        gateway_trade_no: null,
        channel: 'usdt',
        amount: 100,
        status: 'created',
        pay_type: null,
        pay_info: null,
        paid_at: null,
        created_at: '2026-05-10T10:00:00+08:00',
      }],
      total: 21,
      page: 2,
      page_size: 20,
    });
    assert.deepEqual(calls, [
      { kind: 'recharge', page: 2, pageSize: 20 },
      { kind: 'clicks', page: 1, pageSize: 20 },
      { kind: 'transactions', page: 3, pageSize: 100 },
    ]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

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

test('POST /portal/telegram-login/start creates Telegram bot login link', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
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
      },
      applicantTelegramLoginFlowRepository: {
        create: async () => ({
          flow_id: 'flow-1',
          start_token: 'gr_login_flow-1_token',
          poll_token: 'poll-token',
          expires_at: '2026-05-04T12:10:00.000Z',
        }),
        consumeForLogin: async () => {
          throw new Error('not used');
        },
      },
      userTelegramBotSettingsService: {
        getConfig: async () => ({
          enabled: true,
          bot_token: '123456:abcdefghi',
          bot_username: 'GateGankzhuli2026_bot',
          api_base: 'https://api.telegram.org',
          webhook_origin: 'https://gate-rank.com',
          webhook_secret: 'secret-token',
          webhook_last_synced_at: '2026-05-16T13:22:18.000Z',
          webhook_last_error: null,
          templates: createMockUserTelegramBotTemplates(),
        }),
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
    const response = await fetch(`http://127.0.0.1:${port}/portal/telegram-login/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await response.json() as {
      login_url: string;
      flow_id: string;
      poll_token: string;
      expires_at: string;
    };

    assert.equal(response.status, 201);
    assert.equal(data.login_url, 'https://t.me/GateGankzhuli2026_bot?start=gr_login_flow-1_token');
    assert.equal(data.flow_id, 'flow-1');
    assert.equal(data.poll_token, 'poll-token');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/telegram-login/start requires webhook-ready user bot config', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
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
      },
      applicantTelegramLoginFlowRepository: {
        create: async () => {
          throw new Error('not used');
        },
        consumeForLogin: async () => {
          throw new Error('not used');
        },
      },
      userTelegramBotSettingsService: {
        getConfig: async () => ({
          enabled: true,
          bot_token: '123456:abcdefghi',
          bot_username: 'GateGankzhuli2026_bot',
          api_base: 'https://api.telegram.org',
          webhook_origin: 'https://gate-rank.com',
          webhook_secret: 'secret-token',
          webhook_last_synced_at: null,
          webhook_last_error: null,
          templates: createMockUserTelegramBotTemplates(),
        }),
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
    const response = await fetch(`http://127.0.0.1:${port}/portal/telegram-login/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await response.json() as { message: string };

    assert.equal(response.status, 409);
    assert.match(data.message, /用户服务 Bot 尚未完成 Webhook 配置/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/telegram-login/complete consumes completed flow for portal token', async () => {
  const account = createMockApplicantAccount();
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async (id) => {
          assert.equal(id, 1);
          return account;
        },
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
          token: 'telegram-portal-token',
          expires_at: '2026-05-04T12:00:00.000Z',
          account,
        }),
      },
      applicantTelegramLoginFlowRepository: {
        create: async () => {
          throw new Error('not used');
        },
        consumeForLogin: async (flowId, pollToken) => {
          assert.equal(flowId, 'flow-1');
          assert.equal(pollToken, 'poll-token');
          return { status: 'completed', applicant_account_id: 1 };
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

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/telegram-login/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flow_id: 'flow-1', poll_token: 'poll-token' }),
    });
    const data = await response.json() as { token: string; account: { email: string } };

    assert.equal(response.status, 200);
    assert.equal(data.token, 'telegram-portal-token');
    assert.equal(data.account.email, 'user@example.com');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/telegram-login/complete returns failed status for unbound Telegram user', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
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
      },
      applicantTelegramLoginFlowRepository: {
        create: async () => {
          throw new Error('not used');
        },
        consumeForLogin: async () => ({
          status: 'failed',
          failure_reason: '该 Telegram 账号尚未绑定申请人后台，请先使用邮箱登录后绑定 Telegram。',
        }),
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
    const response = await fetch(`http://127.0.0.1:${port}/portal/telegram-login/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flow_id: 'flow-1', poll_token: 'poll-token' }),
    });
    const data = await response.json() as { status: string; error: string };

    assert.equal(response.status, 200);
    assert.equal(data.status, 'failed');
    assert.match(data.error, /尚未绑定申请人后台/);
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

test('POST /portal/account/email-code sends code to verified new email', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const sentCodes: Array<{ to: string; code: string; expiresInMinutes: number }> = [];
  const createdCodes: Array<{ accountId: number; email: string; code: string }> = [];
  const account = createMockApplicantAccount();

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => account,
        getByEmail: async () => null,
        updatePassword: async () => true,
        updateEmail: async () => true,
      },
      applicantEmailChangeCodeRepository: {
        getCooldownRecord: async () => null,
        create: async (accountId, email, code) => {
          createdCodes.push({ accountId, email, code });
          return {
            id: 1,
            applicant_account_id: accountId,
            email,
            expires_at: '2026-05-17T18:10:00+08:00',
            consumed_at: null,
            created_at: '2026-05-17T18:00:00+08:00',
          };
        },
        consume: async () => 'invalid',
      },
      airportApplicationRepository: {
        getById: async () => ({ id: 7, name: 'Cloud Airport' }),
        updateApplicantEmail: async () => true,
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
      mailService: {
        sendLowBalanceWarningEmail: async () => undefined,
        sendAirportAutoUnlistedEmail: async () => undefined,
        sendAirportOnlineEmail: async () => undefined,
        sendApplicantEmailChangeCodeEmail: async (input) => {
          sentCodes.push(input);
        },
      },
    }),
  );
  app.use(errorHandler);

  const { token } = signApplicantToken('portal-test-secret', 1, 'user@example.com', 1);
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/account/email-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: 'new@example.com' }),
    });

    assert.equal(response.status, 201);
    assert.equal(createdCodes.length, 1);
    assert.equal(createdCodes[0].accountId, 1);
    assert.equal(createdCodes[0].email, 'new@example.com');
    assert.match(createdCodes[0].code, /^\d{6}$/);
    assert.deepEqual(sentCodes, [{
      to: 'new@example.com',
      code: createdCodes[0].code,
      expiresInMinutes: 10,
    }]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('PATCH /portal/account/email consumes code and updates account plus application email', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const consumedCodes: Array<{ accountId: number; email: string; code: string }> = [];
  const applicationEmailUpdates: Array<{ id: number; email: string }> = [];
  const accountEmailUpdates: Array<{ id: number; email: string }> = [];
  const account = createMockApplicantAccount();
  const application: any = {
    id: 7,
    name: 'Cloud Airport',
    website: 'https://example.com',
    websites: ['https://example.com'],
    review_status: 'awaiting_payment',
    payment_status: 'unpaid',
    payment_amount: null,
    applicant_email: 'user@example.com',
    applicant_telegram: '@cloud',
    founded_on: '2025-01-01',
    airport_intro: 'intro',
    created_at: '2026-04-18 10:00:00',
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
          accountEmailUpdates.push({ id, email });
          account.email = email;
          return true;
        },
      },
      applicantEmailChangeCodeRepository: {
        getCooldownRecord: async () => null,
        create: async () => {
          throw new Error('not used');
        },
        consume: async (accountId, email, code) => {
          consumedCodes.push({ accountId, email, code });
          return 'consumed';
        },
      },
      airportApplicationRepository: {
        getById: async () => application,
        updateApplicantEmail: async (id, email) => {
          applicationEmailUpdates.push({ id, email });
          application.applicant_email = email;
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
    const response = await fetch(`http://127.0.0.1:${port}/portal/account/email`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: 'new@example.com', code: '123456' }),
    });
    const data = await response.json() as { account: { email: string }; application: { applicant_email: string } };

    assert.equal(response.status, 200);
    assert.deepEqual(consumedCodes, [{ accountId: 1, email: 'new@example.com', code: '123456' }]);
    assert.deepEqual(applicationEmailUpdates, [{ id: 7, email: 'new@example.com' }]);
    assert.deepEqual(accountEmailUpdates, [{ id: 1, email: 'new@example.com' }]);
    assert.equal(data.account.email, 'new@example.com');
    assert.equal(data.application.applicant_email, 'new@example.com');
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
        getConfig: async () => ({
          enabled: true,
          pid: '28615',
          private_key: 'private-key',
          platform_public_key: 'public-key',
          epay: { enabled: true },
          usdt: {
            enabled: false,
            gateway_url: '',
            merchant_id: '',
            secret_key: '',
          },
        }),
      },
      marketingSettingsService: {
        getConfig: async () => ({ application_fee_amount: 1888, click_charge_amount: 2.5 }),
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

test('POST /portal/payment-orders requires explicit notify origin before creating gateway order', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const previousApiBase = process.env.API_BASE;
  const previousPaymentNotifyOrigin = process.env.PAYMENT_NOTIFY_ORIGIN;
  delete process.env.API_BASE;
  delete process.env.PAYMENT_NOTIFY_ORIGIN;
  let expiredOrders = 0;
  let gatewayCreateCalls = 0;

  const app = express();
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
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => null,
        markPaid: async () => true,
        expireOpenOrdersByApplicationId: async () => {
          expiredOrders += 1;
          return 0;
        },
      },
      applicantBillingRepository: createMockBillingRepository(),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({
          enabled: true,
          notify_origin: '',
          pid: '28615',
          private_key: 'private-key',
          platform_public_key: 'public-key',
          epay: { enabled: true },
          usdt: {
            enabled: false,
            gateway_url: '',
            merchant_id: '',
            secret_key: '',
          },
        }),
      },
      marketingSettingsService: {
        getConfig: async () => ({ application_fee_amount: 1888, click_charge_amount: 2.5 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          gatewayCreateCalls += 1;
          throw new Error('payment gateway should not be called');
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
    const body = (await response.json()) as { code: string };

    assert.equal(response.status, 409);
    assert.equal(body.code, 'PAYMENT_NOTIFY_ORIGIN_NOT_CONFIGURED');
    assert.equal(expiredOrders, 0);
    assert.equal(gatewayCreateCalls, 0);
  } finally {
    if (previousApiBase === undefined) {
      delete process.env.API_BASE;
    } else {
      process.env.API_BASE = previousApiBase;
    }
    if (previousPaymentNotifyOrigin === undefined) {
      delete process.env.PAYMENT_NOTIFY_ORIGIN;
    } else {
      process.env.PAYMENT_NOTIFY_ORIGIN = previousPaymentNotifyOrigin;
    }
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/payment-orders rejects alipay when epay switch is disabled', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const createdOrders: Array<Record<string, unknown>> = [];
  let expireCalls = 0;
  let gatewayCreateCalls = 0;

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount({ application_id: 7 }),
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
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => null,
        markPaid: async () => true,
        expireOpenOrdersByApplicationId: async () => {
          expireCalls += 1;
          return 0;
        },
      },
      applicantBillingRepository: createMockBillingRepository(),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({
          enabled: true,
          pid: '28615',
          private_key: 'private-key',
          platform_public_key: 'public-key',
          epay: { enabled: false },
          usdt: {
            enabled: true,
            gateway_url: 'https://pay-usdt.example.com',
            merchant_id: '1000',
            secret_key: 'secret',
          },
        }),
      },
      marketingSettingsService: {
        getConfig: async () => ({ application_fee_amount: 1888, click_charge_amount: 2.5 }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          gatewayCreateCalls += 1;
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
      },
      body: JSON.stringify({ channel: 'alipay' }),
    });
    const body = await response.json() as { code: string; message: string };

    assert.equal(response.status, 409);
    assert.equal(body.code, 'PAYMENT_METHOD_NOT_ENABLED');
    assert.match(body.message, /支付方式/);
    assert.equal(expireCalls, 0);
    assert.equal(createdOrders.length, 0);
    assert.equal(gatewayCreateCalls, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/payment-orders creates USDT payment order', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const createdOrders: Array<Record<string, unknown>> = [];
  const gatewayOrders: PaymentGatewayCreateOrderInput[] = [];

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount({ application_id: 7 }),
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
          out_trade_no: 'gr_7_usdt',
          gateway_trade_no: null,
          channel: 'usdt',
          amount: 1888,
          status: 'created',
          pay_type: 'usdt',
          pay_info: 'https://pay-usdt.example.com/pay/grr_1_usdt',
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
        getConfig: async () => ({
          enabled: true,
          notify_origin: 'https://notify.gaterank.test',
          usdt: {
            enabled: true,
            gateway_url: 'https://pay-usdt.example.com',
            merchant_id: '1000',
            secret_key: 'secret',
          },
        }),
      },
      marketingSettingsService: {
        getConfig: async () => ({ application_fee_amount: 1888, click_charge_amount: 2.5 }),
      },
      paymentGatewayService: {
        createOrder: async (input) => {
          gatewayOrders.push(input);
          return {
            trade_no: '',
            pay_type: 'usdt',
            pay_info: 'https://pay-usdt.example.com/pay/grr_1_usdt',
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
      },
      body: JSON.stringify({ channel: 'usdt' }),
    });

    assert.equal(response.status, 201);
    assert.equal(createdOrders[0].channel, 'usdt');
    assert.equal(gatewayOrders[0].channel, 'usdt');
    assert.equal(gatewayOrders[0].notify_url, 'https://notify.gaterank.test/api/v1/portal/payment-notify');
  } finally {
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

test('POST /portal/payment-notify verifies USDT callback with order channel', async () => {
  const verifiedChannels: string[] = [];
  const paidOrders: Array<Record<string, unknown>> = [];

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
        markPaid: async () => true,
      },
      applicationPaymentOrderRepository: {
        create: async () => 1,
        getLatestByApplicationId: async () => null,
        getByOutTradeNo: async () => ({
          id: 1,
          application_id: 7,
          out_trade_no: 'gr_7_usdt',
          gateway_trade_no: null,
          channel: 'usdt',
          amount: 1000,
          status: 'created',
          pay_type: 'usdt',
          pay_info: 'https://pay-usdt.example.com/pay/gr_7_usdt',
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
        getConfig: async () => ({}),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async (_payload, channel) => {
          verifiedChannels.push(String(channel));
          return true;
        },
      },
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/payment-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: 'gr_7_usdt',
        trade_id: 'trade_usdt_1',
        status: 'success',
        signature: 'valid-signature',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'ok');
    assert.deepEqual(verifiedChannels, ['usdt']);
    assert.equal(paidOrders.length, 1);
    assert.equal(paidOrders[0].gateway_trade_no, 'trade_usdt_1');
    assert.equal(paidOrders[0].pay_type, 'usdt');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/recharge-orders creates USDT recharge order', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const rechargeOrders: Array<Record<string, unknown>> = [];
  const gatewayOrders: PaymentGatewayCreateOrderInput[] = [];

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount({ id: 1, application_id: 7 }),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({ id: 7, name: 'Cloud Airport', payment_status: 'paid' }),
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
        createRechargeOrder: async (input: Record<string, unknown>) => {
          rechargeOrders.push(input);
          return 1;
        },
        getRechargeOrderByOutTradeNo: async () => ({
          id: 1,
          applicant_account_id: 1,
          out_trade_no: 'grr_1_usdt',
          gateway_trade_no: null,
          channel: 'usdt',
          amount: 750,
          status: 'created',
          pay_type: 'usdt',
          pay_info: 'https://pay-usdt.example.com/pay/gr_7_usdt',
          paid_at: null,
          created_at: '2026-04-18T10:00:00+08:00',
        }),
      }),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({
          enabled: true,
          notify_origin: 'https://notify.gaterank.test',
          usdt: {
            enabled: true,
            gateway_url: 'https://pay-usdt.example.com',
            merchant_id: '1000',
            secret_key: 'secret',
          },
        }),
      },
      marketingSettingsService: {
        getConfig: async () => ({
          application_fee_amount: 300,
          click_charge_amount: 1,
          recharge_amounts: [750, 1200],
        }),
      },
      paymentGatewayService: {
        createOrder: async (input) => {
          gatewayOrders.push(input);
          return {
            trade_no: '',
            pay_type: 'usdt',
            pay_info: 'https://pay-usdt.example.com/pay/gr_7_usdt',
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
    const response = await fetch(`http://127.0.0.1:${port}/portal/recharge-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount: 750, channel: 'usdt' }),
    });

    assert.equal(response.status, 201);
    assert.equal(rechargeOrders[0].amount, 750);
    assert.equal(rechargeOrders[0].channel, 'usdt');
    assert.equal(gatewayOrders[0].channel, 'usdt');
    assert.equal(gatewayOrders[0].money, 750);
    assert.equal(gatewayOrders[0].notify_url, 'https://notify.gaterank.test/api/v1/portal/recharge-notify');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/recharge-orders requires paid application fee before recharge', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  let gatewayCreateCalls = 0;
  let rechargeCreateCalls = 0;
  let walletEnsureCalls = 0;

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount({ id: 1, application_id: 7 }),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({ id: 7, name: 'Cloud Airport', payment_status: 'unpaid' }),
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
        ensureWalletForAccount: async () => {
          walletEnsureCalls += 1;
          return {
            id: 1,
            applicant_account_id: 1,
            application_id: 7,
            airport_id: null,
            balance: 0,
            auto_unlisted_at: null,
            created_at: '2026-04-18T10:00:00+08:00',
            updated_at: '2026-04-18T10:00:00+08:00',
          };
        },
        createRechargeOrder: async () => {
          rechargeCreateCalls += 1;
          return 1;
        },
      }),
      applicantPortalAuthService: {
        login: async () => {
          throw new Error('not used');
        },
      },
      paymentGatewaySettingsService: {
        getConfig: async () => ({}),
      },
      paymentGatewayService: {
        createOrder: async () => {
          gatewayCreateCalls += 1;
          return {
            trade_no: '',
            pay_type: 'usdt',
            pay_info: 'https://pay-usdt.example.com/pay/grr_1_usdt',
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
    const response = await fetch(`http://127.0.0.1:${port}/portal/recharge-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount: 300, channel: 'usdt' }),
    });
    const body = await response.json() as { code: string; message: string };

    assert.equal(response.status, 409);
    assert.equal(body.code, 'APPLICATION_PAYMENT_REQUIRED');
    assert.equal(body.message, '请先支付入驻费，支付完成后再充值余额');
    assert.equal(gatewayCreateCalls, 0);
    assert.equal(rechargeCreateCalls, 0);
    assert.equal(walletEnsureCalls, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('POST /portal/recharge-orders rejects amount outside marketing recharge settings', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  let gatewayCreateCalls = 0;

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount({ id: 1, application_id: 7 }),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => ({ id: 7, name: 'Cloud Airport', payment_status: 'paid' }),
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
        getConfig: async () => ({
          enabled: true,
          usdt: {
            enabled: true,
            gateway_url: 'https://pay-usdt.example.com',
            merchant_id: '1000',
            secret_key: 'secret',
          },
        }),
      },
      marketingSettingsService: {
        getConfig: async () => ({
          application_fee_amount: 300,
          click_charge_amount: 1,
          recharge_amounts: [750],
        }),
      },
      paymentGatewayService: {
        createOrder: async () => {
          gatewayCreateCalls += 1;
          throw new Error('payment gateway should not be called');
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
    const response = await fetch(`http://127.0.0.1:${port}/portal/recharge-orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount: 300, channel: 'usdt' }),
    });
    const body = (await response.json()) as { code: string; message: string };

    assert.equal(response.status, 400);
    assert.equal(body.code, 'BAD_REQUEST');
    assert.match(body.message, /amount must be one of 750/);
    assert.equal(gatewayCreateCalls, 0);
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

test('POST /portal/recharge-notify credits USDT recharge order on GMPay callback', async () => {
  const creditedOrders: Array<Record<string, unknown>> = [];

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
          out_trade_no: 'grr_1_usdt',
          channel: 'usdt',
          amount: 300,
          status: 'created',
          pay_type: 'usdt',
          pay_info: 'https://pay-usdt.example.com/pay/grr_1_usdt',
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
        getConfig: async () => ({}),
      },
      paymentGatewayService: {
        createOrder: async () => {
          throw new Error('not used');
        },
        verifyNotificationPayload: async (_payload, channel) => channel === 'usdt',
      },
    }),
  );

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/portal/recharge-notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: 'grr_1_usdt',
        trade_id: 'trade_usdt_recharge_1',
        status: 'success',
        signature: 'valid-signature',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'ok');
    assert.equal(creditedOrders.length, 1);
    assert.equal(creditedOrders[0].outTradeNo, 'grr_1_usdt');
    assert.equal(creditedOrders[0].gateway_trade_no, 'trade_usdt_recharge_1');
    assert.equal(creditedOrders[0].pay_type, 'usdt');
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
  const consumedCodes: Array<Record<string, unknown>> = [];
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
      applicantEmailChangeCodeRepository: {
        getCooldownRecord: async () => null,
        create: async () => {
          throw new Error('not used');
        },
        consume: async (accountId, email, code) => {
          consumedCodes.push({ accountId, email, code });
          return 'consumed';
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
        email_code: '123456',
      }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(consumedCodes, [{ accountId: 1, email: 'owner@example.com', code: '123456' }]);
    assert.equal(updatedDrafts.length, 1);
    assert.equal(updatedDrafts[0].name, 'Cloud Airport');
    assert.deepEqual(updatedDrafts[0].websites, ['https://example.com', 'https://mirror.example.com']);
    assert.equal(updatedEmails.length, 1);
    assert.equal(updatedEmails[0].email, 'owner@example.com');
    const data = (await response.json()) as {
      account: { email: string };
      application: { name: string; applicant_email: string; plan_price_month: number; websites: string[] };
    };
    assert.equal(data.account.email, 'owner@example.com');
    assert.equal(data.application.name, 'Cloud Airport');
    assert.equal(data.application.applicant_email, 'owner@example.com');
    assert.equal(data.application.plan_price_month, 1888);
    assert.deepEqual(data.application.websites, ['https://example.com', 'https://mirror.example.com']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('PATCH /portal/application rejects login email changes without verification code', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  let updateDraftCalls = 0;
  let updateEmailCalls = 0;

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
        getByEmail: async () => null,
        updatePassword: async () => true,
        updateEmail: async () => {
          updateEmailCalls += 1;
          return true;
        },
      },
      applicantEmailChangeCodeRepository: {
        getCooldownRecord: async () => null,
        create: async () => {
          throw new Error('not used');
        },
        consume: async () => {
          throw new Error('not used');
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
        updateApplicantDraft: async () => {
          updateDraftCalls += 1;
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
    const data = await response.json() as { code: string; message: string };

    assert.equal(response.status, 400);
    assert.equal(data.code, 'BAD_REQUEST');
    assert.match(data.message, /email_code/);
    assert.equal(updateDraftCalls, 0);
    assert.equal(updateEmailCalls, 0);
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

test('PATCH /portal/application/operations updates paid operations and syncs approved airport', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const updatedApplications: Array<Record<string, unknown>> = [];
  const updatedAirports: Array<Record<string, unknown>> = [];
  let cacheClears = 0;
  const application: any = {
    id: 7,
    name: 'Cloud Airport',
    website: 'https://example.com',
    websites: ['https://example.com'],
    approved_airport_id: 42,
    review_status: 'reviewed',
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
  };
  const approvedAirport: any = {
    id: 42,
    name: 'Cloud Airport',
    website: 'https://example.com',
    websites: ['https://example.com'],
    status: 'normal',
    is_listed: true,
    plan_price_month: 1000,
    has_trial: true,
    subscription_url: 'https://subscribe.example.com',
    test_account: 'tester',
    test_password: 'secret',
    tags: [],
    created_at: '2026-04-18 10:00:00',
    profile: {
      plan: {
        supports_monthly: true,
        supports_quarterly: null,
        supports_half_yearly: null,
        supports_annual: null,
        lowest_monthly_price: 1000,
        lowest_annual_monthly_price: null,
        has_trial_plan: true,
        has_lifetime_plan: null,
      },
    },
  };

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => application,
        updateApplicantOperations: async (id, input) => {
          updatedApplications.push({ id, ...input });
          Object.assign(application, input, {
            website: input.website,
            websites: input.websites,
          });
          return true;
        },
        markPaid: async () => true,
      },
      airportRepository: {
        getById: async () => approvedAirport,
        update: async (id, input) => {
          updatedAirports.push({ id, ...input });
          Object.assign(approvedAirport, input);
          return true;
        },
      },
      publicPageCache: {
        clear: () => {
          cacheClears += 1;
        },
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
    const response = await fetch(`http://127.0.0.1:${port}/portal/application/operations`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Injected Name',
        applicant_email: 'attacker@example.com',
        websites: ['https://new.example.com', 'https://backup.example.com'],
        plan_price_month: 1888,
        has_trial: false,
        streaming_support: ['netflix', 'chatgpt'],
        payment_methods: ['wechat', 'crypto_other'],
        payment_crypto_other: 'USDC',
        profile: {
          plan: { supports_monthly: true, supports_annual: true },
          clients: { clash: true },
          import_methods: { one_click_import: true },
        },
        subscription_url: 'https://subscribe-new.example.com',
        applicant_telegram: '@cloudpro',
        founded_on: '2024-12-01',
        airport_intro: 'updated intro',
        test_account: 'tester-new',
        test_password: 'secret-new',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(updatedApplications.length, 1);
    assert.equal(updatedApplications[0].id, 7);
    assert.equal(updatedApplications[0].name, 'Cloud Airport');
    assert.deepEqual(updatedApplications[0].websites, ['https://new.example.com', 'https://backup.example.com']);
    assert.deepEqual(updatedApplications[0].streaming_support, ['netflix', 'chatgpt']);
    assert.deepEqual(updatedApplications[0].payment_methods, ['wechat', 'crypto_other']);
    assert.equal(updatedApplications[0].payment_crypto_other, 'USDC');
    assert.equal(updatedApplications[0].applicant_telegram, '@cloudpro');
    assert.equal(updatedApplications[0].founded_on, '2024-12-01');
    assert.equal(updatedApplications[0].airport_intro, 'updated intro');
    assert.equal(updatedAirports.length, 1);
    assert.equal(updatedAirports[0].id, 42);
    assert.equal(updatedAirports[0].name, 'Cloud Airport');
    assert.deepEqual(updatedAirports[0].websites, ['https://new.example.com', 'https://backup.example.com']);
    assert.equal(updatedAirports[0].plan_price_month, 1888);
    assert.equal(updatedAirports[0].has_trial, false);
    assert.deepEqual(updatedAirports[0].streaming_support, ['netflix', 'chatgpt']);
    assert.deepEqual(updatedAirports[0].payment_methods, ['wechat', 'crypto_other']);
    assert.equal(updatedAirports[0].payment_crypto_other, 'USDC');
    assert.equal(updatedAirports[0].subscription_url, 'https://subscribe-new.example.com');
    assert.equal(updatedAirports[0].applicant_telegram, '@cloudpro');
    assert.equal(updatedAirports[0].founded_on, '2024-12-01');
    assert.equal(updatedAirports[0].airport_intro, 'updated intro');
    assert.equal(updatedAirports[0].test_account, 'tester-new');
    assert.equal(updatedAirports[0].test_password, 'secret-new');
    assert.equal((updatedAirports[0].profile as any).plan.supports_annual, true);
    assert.equal((updatedAirports[0].profile as any).plan.lowest_monthly_price, 1888);
    assert.equal((updatedAirports[0].profile as any).plan.has_trial_plan, false);
    assert.equal((updatedAirports[0].profile as any).clients.clash, true);
    assert.equal((updatedAirports[0].profile as any).import_methods.one_click_import, true);
    assert.equal(cacheClears, 1);
    const data = (await response.json()) as {
      application: {
        name: string;
        applicant_email: string;
        plan_price_month: number;
        has_trial: boolean;
        websites: string[];
      };
    };
    assert.equal(data.application.name, 'Cloud Airport');
    assert.equal(data.application.applicant_email, 'user@example.com');
    assert.equal(data.application.plan_price_month, 1888);
    assert.equal(data.application.has_trial, false);
    assert.deepEqual(data.application.websites, ['https://new.example.com', 'https://backup.example.com']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('PATCH /portal/application/operations updates application without airport sync before approval', async () => {
  process.env.APPLICANT_PORTAL_JWT_SECRET = 'portal-test-secret';
  const updatedApplications: Array<Record<string, unknown>> = [];
  let airportUpdateCalls = 0;
  let cacheClears = 0;
  const application: any = {
    id: 7,
    name: 'Cloud Airport',
    website: 'https://example.com',
    websites: ['https://example.com'],
    approved_airport_id: null,
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
  };

  const app = express();
  app.use(express.json());
  app.use(
    createPortalRoutes({
      applicantAccountRepository: {
        getById: async () => createMockApplicantAccount(),
        updatePassword: async () => true,
      },
      airportApplicationRepository: {
        getById: async () => application,
        updateApplicantOperations: async (id, input) => {
          updatedApplications.push({ id, ...input });
          Object.assign(application, input, {
            website: input.website,
            websites: input.websites,
          });
          return true;
        },
        markPaid: async () => true,
      },
      airportRepository: {
        update: async () => {
          airportUpdateCalls += 1;
          return true;
        },
      },
      publicPageCache: {
        clear: () => {
          cacheClears += 1;
        },
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
    const response = await fetch(`http://127.0.0.1:${port}/portal/application/operations`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: 'Cloud Airport Pro',
        websites: ['https://new.example.com'],
        plan_price_month: 1888,
        has_trial: false,
        streaming_support: ['netflix'],
        payment_methods: ['wechat'],
        profile: { clients: { clash: true } },
        subscription_url: 'https://subscribe-new.example.com',
        applicant_telegram: '@cloudpro',
        founded_on: '2024-12-01',
        airport_intro: 'updated intro',
        test_account: 'tester-new',
        test_password: 'secret-new',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(updatedApplications.length, 1);
    assert.equal(airportUpdateCalls, 0);
    assert.equal(cacheClears, 0);
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
