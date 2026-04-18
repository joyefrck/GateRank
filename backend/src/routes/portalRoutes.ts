import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { HttpError } from '../middleware/errorHandler';
import { portalAuth } from '../middleware/portalAuth';
import type { ApplicantAccount } from '../repositories/applicantAccountRepository';
import type { ApplicationPaymentOrder } from '../repositories/applicationPaymentOrderRepository';
import { verifyPassword, hashPassword } from '../utils/password';
import { getSiteOrigin } from '../utils/siteUrl';
import { formatSqlDateTimeInTimezone, getDateInTimezone } from '../utils/time';
import {
  buildGatewayTrace,
  isPaymentSuccessNotification,
  type PaymentGatewayService,
} from '../services/paymentGatewayService';

interface PortalDeps {
  applicantAccountRepository: {
    getById(id: number): Promise<ApplicantAccount | null>;
    getByEmail?(email: string): Promise<ApplicantAccount | null>;
    updatePassword(id: number, passwordHash: string, mustChangePassword: boolean): Promise<boolean>;
    updateEmail?(id: number, email: string): Promise<boolean>;
  };
  airportApplicationRepository: {
    getById(id: number): Promise<any>;
    updateApplicantDraft?(
      id: number,
      input: {
        name: string;
        website: string;
        websites?: string[];
        plan_price_month: number;
        has_trial: boolean;
        subscription_url?: string | null;
        applicant_email: string;
        applicant_telegram: string;
        founded_on: string;
        airport_intro: string;
        test_account: string;
        test_password: string;
      },
    ): Promise<boolean>;
    markPaid(id: number, paymentAmount: number, paidAt: string): Promise<boolean>;
  };
  applicationPaymentOrderRepository: {
    create(input: {
      application_id: number;
      out_trade_no: string;
      channel: 'alipay' | 'wxpay';
      amount: number;
      gateway_trade_no?: string | null;
      pay_type?: string | null;
      pay_info?: string | null;
    }): Promise<number>;
    getLatestByApplicationId(applicationId: number): Promise<ApplicationPaymentOrder | null>;
    getByOutTradeNo(outTradeNo: string): Promise<ApplicationPaymentOrder | null>;
    markPaid(
      outTradeNo: string,
      input: {
        gateway_trade_no?: string | null;
        pay_type?: string | null;
        pay_info?: string | null;
        notify_payload_json?: Record<string, unknown> | null;
        paid_at: string;
      },
    ): Promise<boolean>;
  };
  applicantPortalAuthService: {
    login(email: string, password: string): Promise<{
      token: string;
      expires_at: string;
      account: ApplicantAccount;
    }>;
  };
  paymentGatewaySettingsService: {
    getConfig(): Promise<{ application_fee_amount: number }>;
  };
  paymentGatewayService: Pick<PaymentGatewayService, 'createOrder' | 'verifyNotificationPayload'>;
}

export function createPortalRoutes(deps: PortalDeps): Router {
  const router = Router();

  router.post('/portal/login', async (req, res, next) => {
    try {
      const payload = toPlainObject(req.body ?? {}, 'body');
      const email = mustEmail(payload.email, 'email');
      const password = mustString(payload.password, 'password');
      const auth = await deps.applicantPortalAuthService.login(email, password);
      res.json({
        token: auth.token,
        expires_at: auth.expires_at,
        account: {
          id: auth.account.id,
          email: auth.account.email,
          must_change_password: auth.account.must_change_password,
          last_login_at: auth.account.last_login_at,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/portal/me', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      res.json(await buildPortalView(deps, session.applicant_id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/password/change', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      const payload = toPlainObject(req.body ?? {}, 'body');
      const currentPassword = mustString(payload.current_password, 'current_password');
      const newPassword = mustString(payload.new_password, 'new_password');

      if (newPassword.length < 8) {
        throw new HttpError(400, 'BAD_REQUEST', 'new_password 至少 8 位');
      }

      const passwordValid = await verifyPassword(currentPassword, account.password_hash);
      if (!passwordValid) {
        throw new HttpError(401, 'UNAUTHORIZED', '当前密码错误');
      }

      const passwordHash = await hashPassword(newPassword);
      await deps.applicantAccountRepository.updatePassword(account.id, passwordHash, false);
      res.json(await buildPortalView(deps, session.applicant_id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/payment-orders', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      const application = await requireApplication(deps, account.application_id);
      const payload = toPlainObject(req.body ?? {}, 'body');
      const channel = toPaymentChannel(payload.channel);

      if (account.must_change_password) {
        throw new HttpError(409, 'PASSWORD_CHANGE_REQUIRED', '首次登录后必须先修改密码');
      }
      if (application.payment_status === 'paid' || application.review_status !== 'awaiting_payment') {
        throw new HttpError(409, 'PAYMENT_NOT_REQUIRED', '当前申请无需再次支付');
      }

      const paymentConfig = await deps.paymentGatewaySettingsService.getConfig();
      const amount = Number(paymentConfig.application_fee_amount || 1000);
      const outTradeNo = `gr_${application.id}_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const apiOrigin = getRequestOrigin(req);
      const siteOrigin = getSiteOrigin(req);
      const notifyUrl = `${apiOrigin}/api/v1/portal/payment-notify`;
      const returnUrl = `${siteOrigin}/portal`;
      const gatewayOrder = await deps.paymentGatewayService.createOrder({
        out_trade_no: outTradeNo,
        channel,
        name: `GateRank 申请入驻服务 #${application.id}`,
        money: amount,
        notify_url: notifyUrl,
        return_url: returnUrl,
        clientip: getClientIp(req),
        method: 'jump',
        param: String(application.id),
      });

      await deps.applicationPaymentOrderRepository.create({
        application_id: application.id,
        out_trade_no: outTradeNo,
        channel,
        amount,
        gateway_trade_no: gatewayOrder.trade_no || null,
        pay_type: gatewayOrder.pay_type || null,
        pay_info: gatewayOrder.pay_info || null,
      });

      const latest = await deps.applicationPaymentOrderRepository.getLatestByApplicationId(application.id);
      res.status(201).json({
        payment_order: latest,
        application: await buildPortalView(deps, session.applicant_id),
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/portal/application', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      const application = await requireApplication(deps, account.application_id);
      if (application.payment_status === 'paid') {
        throw new HttpError(409, 'PORTAL_APPLICATION_LOCKED', '支付完成后不能再修改申请资料');
      }

      const payload = toPlainObject(req.body ?? {}, 'body');
      const websiteBundle = parseWebsiteFields(payload, true);
      const foundedOn = mustDate(payload.founded_on, 'founded_on');
      const today = getDateInTimezone();
      if (foundedOn > today) {
        throw new HttpError(400, 'BAD_REQUEST', 'founded_on cannot be in the future');
      }

      const applicantEmail = mustEmail(payload.applicant_email, 'applicant_email');
      if (deps.applicantAccountRepository.getByEmail && applicantEmail !== account.email) {
        const existing = await deps.applicantAccountRepository.getByEmail(applicantEmail);
        if (existing && existing.id !== account.id) {
          throw new HttpError(
            409,
            'AIRPORT_APPLICATION_EMAIL_CONFLICT',
            '该邮箱已有进行中或已通过的申请，请更换其他邮箱',
          );
        }
      }

      const input = {
        name: mustString(payload.name, 'name'),
        website: websiteBundle.website,
        websites: websiteBundle.websites,
        plan_price_month: mustNonNegativeNumber(payload.plan_price_month, 'plan_price_month'),
        has_trial: Boolean(payload.has_trial),
        subscription_url: optionalString(payload.subscription_url) || null,
        applicant_email: applicantEmail,
        applicant_telegram: mustString(payload.applicant_telegram, 'applicant_telegram'),
        founded_on: foundedOn,
        airport_intro: mustString(payload.airport_intro, 'airport_intro'),
        test_account: mustString(payload.test_account, 'test_account'),
        test_password: mustString(payload.test_password, 'test_password'),
      };

      if (!deps.airportApplicationRepository.updateApplicantDraft) {
        throw new Error('airportApplicationRepository.updateApplicantDraft is not configured');
      }
      await deps.airportApplicationRepository.updateApplicantDraft(application.id, input);

      if (applicantEmail !== account.email) {
        if (!deps.applicantAccountRepository.updateEmail) {
          throw new Error('applicantAccountRepository.updateEmail is not configured');
        }
        await deps.applicantAccountRepository.updateEmail(account.id, applicantEmail);
      }

      res.json(await buildPortalView(deps, session.applicant_id));
    } catch (error) {
      next(normalizePortalApplicationMutationError(error));
    }
  });

  router.post('/portal/logout', portalAuth, async (_req, res) => {
    res.json({ ok: true });
  });

  router.post('/portal/payment-notify', async (req, res) => {
    const payload = toNotificationPayload(req.body, req.query);
    const outTradeNo = String(payload.out_trade_no || '').trim();
    if (!outTradeNo) {
      res.status(400).send('fail');
      return;
    }

    const verified = await deps.paymentGatewayService.verifyNotificationPayload(payload);
    if (!verified) {
      res.status(400).send('fail');
      return;
    }

    if (!isPaymentSuccessNotification(payload)) {
      res.send('success');
      return;
    }

    const order = await deps.applicationPaymentOrderRepository.getByOutTradeNo(outTradeNo);
    if (!order) {
      res.status(404).send('fail');
      return;
    }

    const paidAt = formatSqlDateTimeInTimezone(new Date(), 'Asia/Shanghai');
    await deps.applicationPaymentOrderRepository.markPaid(outTradeNo, {
      gateway_trade_no: stringOrNull(payload.trade_no),
      pay_type: stringOrNull(payload.type) || order.pay_type,
      pay_info: buildGatewayTrace(payload),
      notify_payload_json: payload,
      paid_at: paidAt,
    });
    await deps.airportApplicationRepository.markPaid(order.application_id, Number(order.amount), paidAt);

    res.send('success');
  });

  return router;
}

async function buildPortalView(deps: PortalDeps, applicantId: number) {
  const account = await requireApplicantAccount(deps, applicantId);
  const application = await requireApplication(deps, account.application_id);
  const [latestPaymentOrder, paymentConfig] = await Promise.all([
    deps.applicationPaymentOrderRepository.getLatestByApplicationId(application.id),
    deps.paymentGatewaySettingsService.getConfig(),
  ]);

  return {
    account: {
      id: account.id,
      email: account.email,
      must_change_password: account.must_change_password,
      last_login_at: account.last_login_at,
    },
    application,
    latest_payment_order: latestPaymentOrder
      ? {
          out_trade_no: latestPaymentOrder.out_trade_no,
          channel: latestPaymentOrder.channel,
          amount: latestPaymentOrder.amount,
          status: latestPaymentOrder.status,
          pay_type: latestPaymentOrder.pay_type,
          pay_info: latestPaymentOrder.pay_info,
          paid_at: latestPaymentOrder.paid_at,
        }
      : null,
    payment_fee_amount: Number(paymentConfig.application_fee_amount || 1000),
  };
}

async function requireApplicantAccount(deps: PortalDeps, applicantId: number) {
  const account = await deps.applicantAccountRepository.getById(applicantId);
  if (!account) {
    throw new HttpError(401, 'UNAUTHORIZED', '登录已失效，请重新登录');
  }
  return account;
}

async function requireApplication(deps: PortalDeps, applicationId: number) {
  const application = await deps.airportApplicationRepository.getById(applicationId);
  if (!application) {
    throw new HttpError(404, 'AIRPORT_APPLICATION_NOT_FOUND', `application ${applicationId} not found`);
  }
  return application;
}

function toNotificationPayload(
  body: unknown,
  query: unknown,
): Record<string, unknown> {
  return {
    ...toLooseObject(query),
    ...toLooseObject(body),
  };
}

function toLooseObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function toPlainObject(value: unknown, fieldName: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be object`);
  }
  return value as Record<string, unknown>;
}

function mustString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return String(value).trim();
}

function mustEmail(value: unknown, fieldName: string): string {
  const email = mustString(value, fieldName);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be valid email`);
  }
  return email;
}

function mustNonNegativeNumber(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be non-negative number`);
  }
  return num;
}

function mustDate(value: unknown, fieldName: string): string {
  const date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be YYYY-MM-DD`);
  }
  return date;
}

function toStringArray(value: unknown, fieldName = 'items'): string[] {
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be array`);
  }
  return value.map((v) => String(v));
}

function parseWebsiteFields(
  payload: Record<string, unknown>,
  required: boolean,
): { website: string; websites: string[] } {
  const primaryWebsite = optionalString(payload.website);
  const websiteItems = payload.websites === undefined ? undefined : toStringArray(payload.websites, 'websites');
  const normalized = [primaryWebsite || '', ...(websiteItems || [])]
    .map((value) => value.trim())
    .filter(Boolean);
  const websites = [...new Set(normalized)];

  if (required && websites.length === 0) {
    throw new HttpError(400, 'BAD_REQUEST', 'website or websites is required');
  }

  return {
    website: websites[0],
    websites,
  };
}

function toPaymentChannel(value: unknown): 'alipay' | 'wxpay' {
  if (value === 'alipay' || value === 'wxpay') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'channel must be alipay|wxpay');
}

function requireApplicantSession(req: any): { applicant_id: number; email: string } {
  if (!req.applicantSession) {
    throw new HttpError(401, 'UNAUTHORIZED', '登录已失效，请重新登录');
  }
  return req.applicantSession;
}

function getClientIp(req: any): string {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) {
    return forwarded;
  }
  return String(req.ip || '127.0.0.1').replace('::ffff:', '');
}

function getRequestOrigin(req: any): string {
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0];
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0];
  return `${proto}://${host}`;
}

function stringOrNull(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const result = String(value).trim();
  return result ? result : null;
}

function normalizePortalApplicationMutationError(error: unknown): unknown {
  if (error instanceof HttpError) {
    return error;
  }

  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  if (code === 'ER_DUP_ENTRY') {
    return new HttpError(
      409,
      'AIRPORT_APPLICATION_EMAIL_CONFLICT',
      '该邮箱已有进行中或已通过的申请，请更换其他邮箱',
    );
  }

  return error;
}
