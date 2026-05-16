import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { APPLICATION_FEE_AMOUNT, CLICK_CHARGE_AMOUNT, RECHARGE_AMOUNTS } from '../config/billing';
import { HttpError } from '../middleware/errorHandler';
import { portalAuth } from '../middleware/portalAuth';
import type { ApplicantAccount } from '../repositories/applicantAccountRepository';
import type { ApplicantTelegramBinding } from '../repositories/applicantTelegramBindingRepository';
import type { ApplicationPaymentOrder } from '../repositories/applicationPaymentOrderRepository';
import type {
  ApplicantClickView,
  ApplicantWalletView,
  BillingMailNotificationEvent,
  PaginatedBillingRecords,
  RechargeCreditResult,
  RechargeOrderView,
  WalletTransactionView,
} from '../repositories/applicantBillingRepository';
import { sendBillingMailNotificationsSafely, type BillingMailService } from '../services/billingMailNotificationService';
import {
  sendUserTelegramBotBillingNotificationsSafely,
  sendUserTelegramBotRechargeWelcomeSafely,
  type UserTelegramBotBillingNotificationService,
} from '../services/userTelegramBotMessageService';
import { verifyPassword, hashPassword } from '../utils/password';
import { getSiteOrigin } from '../utils/siteUrl';
import { formatSqlDateTimeInTimezone, getDateInTimezone } from '../utils/time';
import {
  buildGatewayTrace,
  isPaymentQueryPaid,
  isPaymentSuccessNotification,
  type PaymentGatewayService,
  type PaymentGatewayQueryOrderResult,
  type PaymentGatewayChannel,
} from '../services/paymentGatewayService';
import type { PaymentReceivedNotificationInput } from '../services/telegramNotificationService';
import {
  isUserTelegramBotConfigReady,
  type UserTelegramBotConfig,
} from '../services/userTelegramBotSettingsService';

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
    ): Promise<boolean | RechargeCreditResult>;
    markPaid(id: number, paymentAmount: number, paidAt: string): Promise<boolean>;
  };
  applicationPaymentOrderRepository: {
    create(input: {
      application_id: number;
      out_trade_no: string;
      channel: PaymentGatewayChannel;
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
    ): Promise<boolean | RechargeCreditResult>;
    expireOpenOrdersByApplicationId(applicationId: number): Promise<number>;
  };
  applicantBillingRepository: {
    ensureWalletForAccount(applicantAccountId: number, applicationId: number): Promise<ApplicantWalletView>;
    getWalletByAccountId(applicantAccountId: number): Promise<ApplicantWalletView | null>;
    createRechargeOrder(input: {
      applicant_account_id: number;
      out_trade_no: string;
      channel: PaymentGatewayChannel;
      amount: number;
      gateway_trade_no?: string | null;
      pay_type?: string | null;
      pay_info?: string | null;
    }): Promise<number>;
    getRechargeOrderByOutTradeNo(outTradeNo: string): Promise<RechargeOrderView | null>;
    listRechargeOrders(
      applicantAccountId: number,
      page?: number,
      pageSize?: number,
    ): Promise<PaginatedBillingRecords<RechargeOrderView>>;
    cancelRechargeOrder(applicantAccountId: number, outTradeNo: string): Promise<boolean>;
    markRechargePaidAndCredit(
      outTradeNo: string,
      input: {
        gateway_trade_no?: string | null;
        pay_type?: string | null;
        pay_info?: string | null;
        notify_payload_json?: Record<string, unknown> | null;
        paid_at: string;
        click_charge_amount?: number;
      },
    ): Promise<boolean | RechargeCreditResult>;
    listTransactions(
      applicantAccountId: number,
      page?: number,
      pageSize?: number,
    ): Promise<PaginatedBillingRecords<WalletTransactionView>>;
    listClicks(
      applicantAccountId: number,
      page?: number,
      pageSize?: number,
    ): Promise<PaginatedBillingRecords<ApplicantClickView>>;
  };
  applicantPortalAuthService: {
    login(email: string, password: string): Promise<{
      token: string;
      expires_at: string;
      account: ApplicantAccount;
    }>;
    createSession?(account: ApplicantAccount): Promise<{
      token: string;
      expires_at: string;
      account: ApplicantAccount;
    }>;
  };
  applicantXOAuthService?: {
    startBind(applicantAccountId: number): Promise<{ authorization_url: string; expires_at: string }>;
    startLogin(): Promise<{ authorization_url: string; expires_at: string }>;
    handleCallback(input: { state: string; code: string }): Promise<{
      flow_type: 'bind' | 'login';
      handoff_code: string | null;
    }>;
    consumeLoginHandoff(handoffCode: string): Promise<ApplicantAccount>;
    unbind(applicantAccountId: number): Promise<void>;
    getReturnOrigin?(): Promise<string | null>;
  };
  applicantTelegramBindingRepository?: {
    createBindToken(applicantAccountId: number): Promise<{ token: string; expires_at: string }>;
    getByApplicantAccountId(applicantAccountId: number): Promise<ApplicantTelegramBinding | null>;
    unbindApplicantAccount(applicantAccountId: number): Promise<boolean>;
  };
  userTelegramBotSettingsService?: {
    getConfig(): Promise<UserTelegramBotConfig>;
  };
  paymentGatewaySettingsService: {
    getConfig(): Promise<unknown>;
  };
  marketingSettingsService?: {
    getConfig(): Promise<{
      application_fee_amount: number;
      click_charge_amount?: number;
      admin_telegram_username?: string | null;
    }>;
  };
  paymentGatewayService: Pick<PaymentGatewayService, 'createOrder' | 'verifyNotificationPayload'> & {
    queryOrder?: PaymentGatewayService['queryOrder'];
  };
  applicationNotificationService?: {
    notifyPaymentReceived(input: PaymentReceivedNotificationInput): Promise<void>;
  };
  mailService?: BillingMailService;
  userTelegramBotMessageService?: UserTelegramBotBillingNotificationService;
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
        account: toPortalAccountView(auth.account),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/x-oauth/login/start', async (_req, res, next) => {
    try {
      res.status(201).json(await requireApplicantXOAuthService(deps).startLogin());
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/x-oauth/login/complete', async (req, res, next) => {
    try {
      const payload = toPlainObject(req.body ?? {}, 'body');
      const account = await requireApplicantXOAuthService(deps).consumeLoginHandoff(mustString(payload.code, 'code'));
      if (!deps.applicantPortalAuthService.createSession) {
        throw new Error('applicantPortalAuthService.createSession is not configured');
      }
      const auth = await deps.applicantPortalAuthService.createSession(account);
      res.json({
        token: auth.token,
        expires_at: auth.expires_at,
        account: toPortalAccountView(auth.account),
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

  router.post('/portal/x-oauth/bind/start', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      res.status(201).json(await requireApplicantXOAuthService(deps).startBind(session.applicant_id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/x-oauth/unbind', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      await requireApplicantXOAuthService(deps).unbind(session.applicant_id);
      res.json(await buildPortalView(deps, session.applicant_id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/telegram-bind/start', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      const application = await requireApplication(deps, account.application_id);
      if (application.review_status !== 'reviewed') {
        throw new HttpError(409, 'TELEGRAM_BIND_REVIEW_REQUIRED', '申请审核通过后才能绑定 Telegram Bot');
      }
      const config = await requireUserTelegramBotSettingsService(deps).getConfig();
      if (!isUserTelegramBotConfigReady(config)) {
        throw new HttpError(409, 'USER_TELEGRAM_BOT_NOT_CONFIGURED', '用户服务 Bot 尚未完成 Webhook 配置');
      }
      const bindToken = await requireApplicantTelegramBindingRepository(deps).createBindToken(account.id);
      res.status(201).json({
        binding_url: `https://t.me/${config.bot_username}?start=${encodeURIComponent(bindToken.token)}`,
        expires_at: bindToken.expires_at,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/telegram-bind/unbind', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      await requireApplicantTelegramBindingRepository(deps).unbindApplicantAccount(session.applicant_id);
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
      await requirePaymentChannelAvailable(deps, channel);

      const marketingConfig = await getMarketingBillingConfig(deps);
      const amount = Number(marketingConfig.application_fee_amount);
      const outTradeNo = `gr_${application.id}_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const apiOrigin = await getPaymentNotifyOrigin(deps, req);
      const siteOrigin = getSiteOrigin(req);
      const notifyUrl = `${apiOrigin}/api/v1/portal/payment-notify`;
      const returnUrl = `${siteOrigin}/portal`;
      await deps.applicationPaymentOrderRepository.expireOpenOrdersByApplicationId(application.id);
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

  router.get('/portal/wallet', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      const marketingConfig = await getMarketingBillingConfig(deps);
      res.json({
        wallet: await deps.applicantBillingRepository.ensureWalletForAccount(account.id, account.application_id),
        recharge_amounts: RECHARGE_AMOUNTS,
        click_price: marketingConfig.click_charge_amount,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/portal/recharge-orders', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const { page, pageSize } = parsePagination(req.query);
      const result = await deps.applicantBillingRepository.listRechargeOrders(session.applicant_id, page, pageSize);
      res.json({ items: result.items, total: result.total, page, page_size: pageSize });
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/recharge-orders', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      if (account.must_change_password) {
        throw new HttpError(409, 'PASSWORD_CHANGE_REQUIRED', '首次登录后必须先修改密码');
      }
      const application = await requireApplication(deps, account.application_id);
      if (application.payment_status !== 'paid') {
        throw new HttpError(409, 'APPLICATION_PAYMENT_REQUIRED', '请先支付入驻费，支付完成后再充值余额');
      }
      const payload = toPlainObject(req.body ?? {}, 'body');
      const channel = toPaymentChannel(payload.channel);
      const amount = toRechargeAmount(payload.amount);
      await requirePaymentChannelAvailable(deps, channel);
      await deps.applicantBillingRepository.ensureWalletForAccount(account.id, account.application_id);
      const outTradeNo = `grr_${account.id}_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const apiOrigin = await getPaymentNotifyOrigin(deps, req);
      const siteOrigin = getSiteOrigin(req);
      const gatewayOrder = await deps.paymentGatewayService.createOrder({
        out_trade_no: outTradeNo,
        channel,
        name: `GateRank 点击余额充值 #${account.id}`,
        money: amount,
        notify_url: `${apiOrigin}/api/v1/portal/recharge-notify`,
        return_url: `${siteOrigin}/portal`,
        clientip: getClientIp(req),
        method: 'jump',
        param: String(account.id),
      });

      await deps.applicantBillingRepository.createRechargeOrder({
        applicant_account_id: account.id,
        out_trade_no: outTradeNo,
        channel,
        amount,
        gateway_trade_no: gatewayOrder.trade_no || null,
        pay_type: gatewayOrder.pay_type || null,
        pay_info: gatewayOrder.pay_info || null,
      });

      res.status(201).json({
        recharge_order: await deps.applicantBillingRepository.getRechargeOrderByOutTradeNo(outTradeNo),
        wallet: await deps.applicantBillingRepository.getWalletByAccountId(account.id),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/recharge-orders/:outTradeNo/cancel', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const order = await deps.applicantBillingRepository.getRechargeOrderByOutTradeNo(String(req.params.outTradeNo || ''));
      if (!order || order.applicant_account_id !== session.applicant_id) {
        throw new HttpError(404, 'RECHARGE_ORDER_NOT_FOUND', '充值订单不存在');
      }
      if (order.status !== 'created') {
        throw new HttpError(409, 'RECHARGE_ORDER_NOT_CANCELABLE', '当前充值订单不能取消');
      }

      await deps.applicantBillingRepository.cancelRechargeOrder(session.applicant_id, order.out_trade_no);
      res.json({
        recharge_order: await deps.applicantBillingRepository.getRechargeOrderByOutTradeNo(order.out_trade_no),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/payment-orders/:outTradeNo/sync', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      const order = await deps.applicationPaymentOrderRepository.getByOutTradeNo(String(req.params.outTradeNo || ''));
      if (!order || order.application_id !== account.application_id) {
        throw new HttpError(404, 'PAYMENT_ORDER_NOT_FOUND', '支付订单不存在');
      }
      await syncApplicationPaymentOrder(deps, order);
      res.json(await buildPortalView(deps, session.applicant_id));
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/recharge-orders/:outTradeNo/sync', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const order = await deps.applicantBillingRepository.getRechargeOrderByOutTradeNo(String(req.params.outTradeNo || ''));
      if (!order || order.applicant_account_id !== session.applicant_id) {
        throw new HttpError(404, 'RECHARGE_ORDER_NOT_FOUND', '充值订单不存在');
      }
      await syncRechargeOrder(deps, order);
      res.json({
        recharge_order: await deps.applicantBillingRepository.getRechargeOrderByOutTradeNo(order.out_trade_no),
        wallet: await deps.applicantBillingRepository.getWalletByAccountId(session.applicant_id),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/portal/clicks', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const { page, pageSize } = parsePagination(req.query);
      const result = await deps.applicantBillingRepository.listClicks(session.applicant_id, page, pageSize);
      res.json({ items: result.items, total: result.total, page, page_size: pageSize });
    } catch (error) {
      next(error);
    }
  });

  router.get('/portal/wallet-transactions', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const { page, pageSize } = parsePagination(req.query);
      const result = await deps.applicantBillingRepository.listTransactions(session.applicant_id, page, pageSize);
      res.json({ items: result.items, total: result.total, page, page_size: pageSize });
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

  router.get('/portal/x-oauth/callback', async (req, res) => {
    const siteOrigin = await getXOAuthReturnOrigin(deps, req);
    try {
      const error = stringOrNull(req.query.error);
      if (error) {
        throw new HttpError(400, 'X_OAUTH_DECLINED', 'X 授权已取消');
      }
      const state = mustString(req.query.state, 'state');
      const code = mustString(req.query.code, 'code');
      const result = await requireApplicantXOAuthService(deps).handleCallback({ state, code });
      const redirectUrl = new URL('/portal', siteOrigin);
      if (result.flow_type === 'bind') {
        redirectUrl.searchParams.set('x_oauth', 'bound');
      } else if (result.handoff_code) {
        redirectUrl.searchParams.set('x_login_code', result.handoff_code);
      }
      res.redirect(302, redirectUrl.toString());
    } catch (error) {
      const redirectUrl = new URL('/portal', siteOrigin);
      redirectUrl.searchParams.set('x_oauth_error', error instanceof Error ? error.message : 'X 授权失败');
      res.redirect(302, redirectUrl.toString());
    }
  });

  router.post('/portal/payment-notify', async (req, res) => {
    const payload = toNotificationPayload(req.body, req.query);
    const outTradeNo = getNotificationOutTradeNo(payload);
    if (!outTradeNo) {
      res.status(400).send('fail');
      return;
    }

    const order = await deps.applicationPaymentOrderRepository.getByOutTradeNo(outTradeNo);
    if (!order) {
      res.status(404).send('fail');
      return;
    }

    const verified = await deps.paymentGatewayService.verifyNotificationPayload(payload, order.channel);
    if (!verified) {
      res.status(400).send('fail');
      return;
    }

    if (!isPaymentSuccessNotification(payload)) {
      res.send(getNotificationSuccessResponse(order.channel));
      return;
    }

    const paidAt = formatSqlDateTimeInTimezone(new Date(), 'Asia/Shanghai');
    await deps.applicationPaymentOrderRepository.markPaid(outTradeNo, {
      gateway_trade_no: getNotificationGatewayTradeNo(payload),
      pay_type: getNotificationPayType(payload, order.channel, order.pay_type || order.channel),
      pay_info: buildGatewayTrace(payload),
      notify_payload_json: payload,
      paid_at: paidAt,
    });
    const markedApplicationPaid = await deps.airportApplicationRepository.markPaid(
      order.application_id,
      Number(order.amount),
      paidAt,
    );
    if (markedApplicationPaid) {
      await notifyPaymentReceivedSafely(deps, {
        paymentType: 'application_fee_paid',
        applicationId: order.application_id,
        amount: Number(order.amount),
        outTradeNo,
        gatewayTradeNo: getNotificationGatewayTradeNo(payload) || order.gateway_trade_no,
        channel: getNotificationPayType(payload, order.channel, order.channel),
        paidAt,
      });
    }

    res.send(getNotificationSuccessResponse(order.channel));
  });

  router.post('/portal/recharge-notify', async (req, res) => {
    const payload = toNotificationPayload(req.body, req.query);
    const outTradeNo = getNotificationOutTradeNo(payload);
    if (!outTradeNo) {
      res.status(400).send('fail');
      return;
    }

    const order = await deps.applicantBillingRepository.getRechargeOrderByOutTradeNo(outTradeNo);
    if (!order) {
      res.status(404).send('fail');
      return;
    }

    const verified = await deps.paymentGatewayService.verifyNotificationPayload(payload, order.channel);
    if (!verified) {
      res.status(400).send('fail');
      return;
    }

    if (!isPaymentSuccessNotification(payload)) {
      res.send(getNotificationSuccessResponse(order.channel));
      return;
    }

    const paidAt = formatSqlDateTimeInTimezone(new Date(), 'Asia/Shanghai');
    const marketingConfig = await getMarketingBillingConfig(deps);
    const creditResult = normalizeRechargeCreditResult(
      await deps.applicantBillingRepository.markRechargePaidAndCredit(outTradeNo, {
      gateway_trade_no: getNotificationGatewayTradeNo(payload),
      pay_type: getNotificationPayType(payload, order.channel, order.pay_type || order.channel),
      pay_info: buildGatewayTrace(payload),
      notify_payload_json: payload,
      paid_at: paidAt,
      click_charge_amount: marketingConfig.click_charge_amount,
      }),
    );
    await sendBillingMailNotificationsSafely(deps.mailService, creditResult.notification_events);
    await sendUserTelegramBotBillingNotificationsSafely(
      deps.userTelegramBotMessageService,
      creditResult.notification_events,
    );
    if (creditResult.credited) {
      await sendRechargeWelcomeForOrder(deps, order.applicant_account_id, Number(order.amount));
      await notifyPaymentReceivedSafely(deps, {
        paymentType: 'wallet_recharge_paid',
        applicantAccountId: order.applicant_account_id,
        amount: Number(order.amount),
        outTradeNo,
        gatewayTradeNo: getNotificationGatewayTradeNo(payload),
        channel: getNotificationPayType(payload, order.channel, order.channel),
        paidAt,
      });
    }

    res.send(getNotificationSuccessResponse(order.channel));
  });

  return router;
}

async function syncApplicationPaymentOrder(deps: PortalDeps, order: ApplicationPaymentOrder): Promise<boolean> {
  if (order.status === 'paid') {
    return false;
  }
  const queryResult = await queryGatewayOrder(deps, order.out_trade_no, order.channel);
  if (!isPaymentQueryPaid(queryResult)) {
    return false;
  }
  assertGatewayOrderMatches(order.out_trade_no, Number(order.amount), queryResult);
  const paidAt = normalizeGatewayPaidAt(queryResult.endtime);
  await deps.applicationPaymentOrderRepository.markPaid(order.out_trade_no, {
    gateway_trade_no: queryResult.trade_no || order.gateway_trade_no,
    pay_type: queryResult.type || order.pay_type,
    pay_info: buildGatewayTrace(queryResult.raw),
    notify_payload_json: queryResult.raw,
    paid_at: paidAt,
  });
  const markedApplicationPaid = await deps.airportApplicationRepository.markPaid(
    order.application_id,
    Number(order.amount),
    paidAt,
  );
  if (markedApplicationPaid) {
    await notifyPaymentReceivedSafely(deps, {
      paymentType: 'application_fee_paid',
      applicationId: order.application_id,
      amount: Number(order.amount),
      outTradeNo: order.out_trade_no,
      gatewayTradeNo: queryResult.trade_no || order.gateway_trade_no,
      channel: queryResult.type || order.channel,
      paidAt,
    });
  }
  return markedApplicationPaid;
}

async function syncRechargeOrder(deps: PortalDeps, order: RechargeOrderView): Promise<boolean> {
  if (order.status === 'paid') {
    return false;
  }
  const queryResult = await queryGatewayOrder(deps, order.out_trade_no, order.channel);
  if (!isPaymentQueryPaid(queryResult)) {
    return false;
  }
  assertGatewayOrderMatches(order.out_trade_no, Number(order.amount), queryResult);
  const paidAt = normalizeGatewayPaidAt(queryResult.endtime);
  const marketingConfig = await getMarketingBillingConfig(deps);
  const creditResult = normalizeRechargeCreditResult(
    await deps.applicantBillingRepository.markRechargePaidAndCredit(order.out_trade_no, {
    gateway_trade_no: queryResult.trade_no || order.gateway_trade_no,
    pay_type: queryResult.type || order.pay_type,
    pay_info: buildGatewayTrace(queryResult.raw),
    notify_payload_json: queryResult.raw,
    paid_at: paidAt,
    click_charge_amount: marketingConfig.click_charge_amount,
    }),
  );
  await sendBillingMailNotificationsSafely(deps.mailService, creditResult.notification_events);
  await sendUserTelegramBotBillingNotificationsSafely(
    deps.userTelegramBotMessageService,
    creditResult.notification_events,
  );
  if (creditResult.credited) {
    await sendRechargeWelcomeForOrder(deps, order.applicant_account_id, Number(order.amount));
    await notifyPaymentReceivedSafely(deps, {
      paymentType: 'wallet_recharge_paid',
      applicantAccountId: order.applicant_account_id,
      amount: Number(order.amount),
      outTradeNo: order.out_trade_no,
      gatewayTradeNo: queryResult.trade_no || null,
      channel: queryResult.type || order.channel,
      paidAt,
    });
  }
  return creditResult.credited;
}

function normalizeRechargeCreditResult(value: boolean | RechargeCreditResult): RechargeCreditResult {
  if (typeof value === 'boolean') {
    return {
      credited: value,
      notification_events: [],
    };
  }
  return {
    credited: Boolean(value.credited),
    notification_events: Array.isArray(value.notification_events)
      ? value.notification_events as BillingMailNotificationEvent[]
      : [],
  };
}

async function sendRechargeWelcomeForOrder(
  deps: PortalDeps,
  applicantAccountId: number,
  amount: number,
): Promise<void> {
  if (!deps.userTelegramBotMessageService) {
    return;
  }
  const account = await deps.applicantAccountRepository.getById(applicantAccountId);
  if (!account) {
    return;
  }
  const [application, wallet] = await Promise.all([
    deps.airportApplicationRepository.getById(account.application_id),
    deps.applicantBillingRepository.getWalletByAccountId(applicantAccountId),
  ]);
  await sendUserTelegramBotRechargeWelcomeSafely(deps.userTelegramBotMessageService, {
    applicantAccountId,
    airportName: String(application?.name || '-'),
    applicantEmail: account.email,
    rechargeAmount: amount,
    balance: Number(wallet?.balance || 0),
  });
}

async function queryGatewayOrder(
  deps: PortalDeps,
  outTradeNo: string,
  channel: PaymentGatewayChannel,
): Promise<PaymentGatewayQueryOrderResult> {
  if (!deps.paymentGatewayService.queryOrder) {
    throw new HttpError(503, 'PAYMENT_GATEWAY_QUERY_NOT_CONFIGURED', '支付网关查单未配置');
  }
  return deps.paymentGatewayService.queryOrder(outTradeNo, channel);
}

function assertGatewayOrderMatches(
  outTradeNo: string,
  expectedAmount: number,
  queryResult: PaymentGatewayQueryOrderResult,
): void {
  if (queryResult.out_trade_no !== outTradeNo) {
    throw new HttpError(409, 'PAYMENT_GATEWAY_ORDER_MISMATCH', '支付网关返回订单号与本地订单不一致');
  }
  if (Math.abs(Number(queryResult.money) - expectedAmount) > 0.001) {
    throw new HttpError(409, 'PAYMENT_GATEWAY_AMOUNT_MISMATCH', '支付网关返回金额与本地订单不一致');
  }
}

function normalizeGatewayPaidAt(value: string | null): string {
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value || '')
    ? String(value)
    : formatSqlDateTimeInTimezone(new Date(), 'Asia/Shanghai');
}

async function buildPortalView(deps: PortalDeps, applicantId: number) {
  const account = await requireApplicantAccount(deps, applicantId);
  const application = await requireApplication(deps, account.application_id);
  const [latestPaymentOrder, marketingConfig, wallet, paymentMethods, telegramBot] = await Promise.all([
    deps.applicationPaymentOrderRepository.getLatestByApplicationId(application.id),
    getMarketingBillingConfig(deps),
    deps.applicantBillingRepository.ensureWalletForAccount(account.id, account.application_id),
    getAvailablePaymentMethods(deps),
    buildTelegramBotView(deps, account.id),
  ]);

  return {
    account: {
      ...toPortalAccountView(account),
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
    payment_fee_amount: Number(marketingConfig.application_fee_amount),
    payment_methods: paymentMethods,
    click_price: Number(marketingConfig.click_charge_amount),
    admin_telegram_username: marketingConfig.admin_telegram_username,
    recharge_amounts: RECHARGE_AMOUNTS,
    wallet,
    telegram_bot: telegramBot,
  };
}

async function buildTelegramBotView(deps: PortalDeps, applicantAccountId: number): Promise<{
  configured: boolean;
  enabled: boolean;
  bot_username: string | null;
  binding: null | {
    telegram_user_id: string;
    telegram_chat_id: string;
    telegram_username: string | null;
    telegram_first_name: string | null;
    telegram_last_name: string | null;
    bound_at: string;
  };
}> {
  const [config, binding] = await Promise.all([
    deps.userTelegramBotSettingsService?.getConfig?.() ?? Promise.resolve(null),
    deps.applicantTelegramBindingRepository?.getByApplicantAccountId?.(applicantAccountId) ?? Promise.resolve(null),
  ]);
  return {
    configured: Boolean(config && isUserTelegramBotConfigReady(config)),
    enabled: Boolean(config?.enabled),
    bot_username: config?.bot_username || null,
    binding: binding
      ? {
          telegram_user_id: binding.telegram_user_id,
          telegram_chat_id: binding.telegram_chat_id,
          telegram_username: binding.telegram_username,
          telegram_first_name: binding.telegram_first_name,
          telegram_last_name: binding.telegram_last_name,
          bound_at: binding.bound_at,
        }
      : null,
  };
}

async function getMarketingBillingConfig(deps: PortalDeps): Promise<{
  application_fee_amount: number;
  click_charge_amount: number;
  admin_telegram_username: string | null;
}> {
  if (!deps.marketingSettingsService) {
    return {
      application_fee_amount: APPLICATION_FEE_AMOUNT,
      click_charge_amount: CLICK_CHARGE_AMOUNT,
      admin_telegram_username: null,
    };
  }
  const config = await deps.marketingSettingsService.getConfig();
  return {
    application_fee_amount: Number(config.application_fee_amount || APPLICATION_FEE_AMOUNT),
    click_charge_amount: Number(config.click_charge_amount || CLICK_CHARGE_AMOUNT),
    admin_telegram_username: config.admin_telegram_username ?? null,
  };
}

function toPortalAccountView(account: ApplicantAccount) {
  return {
    id: account.id,
    email: account.email,
    must_change_password: account.must_change_password,
    last_login_at: account.last_login_at,
    x: account.x_user_id
      ? {
          user_id: account.x_user_id,
          username: account.x_username,
          display_name: account.x_display_name,
          bound_at: account.x_bound_at,
        }
      : null,
  };
}

async function requireApplicantAccount(deps: PortalDeps, applicantId: number) {
  const account = await deps.applicantAccountRepository.getById(applicantId);
  if (!account) {
    throw new HttpError(401, 'UNAUTHORIZED', '登录已失效，请重新登录');
  }
  return account;
}

function requireApplicantXOAuthService(deps: PortalDeps): NonNullable<PortalDeps['applicantXOAuthService']> {
  if (!deps.applicantXOAuthService) {
    throw new HttpError(503, 'X_OAUTH_NOT_CONFIGURED', 'X 登录尚未配置，请联系管理员');
  }
  return deps.applicantXOAuthService;
}

function requireApplicantTelegramBindingRepository(
  deps: PortalDeps,
): NonNullable<PortalDeps['applicantTelegramBindingRepository']> {
  if (!deps.applicantTelegramBindingRepository) {
    throw new HttpError(503, 'USER_TELEGRAM_BINDING_NOT_CONFIGURED', 'Telegram 绑定服务尚未配置');
  }
  return deps.applicantTelegramBindingRepository;
}

function requireUserTelegramBotSettingsService(
  deps: PortalDeps,
): NonNullable<PortalDeps['userTelegramBotSettingsService']> {
  if (!deps.userTelegramBotSettingsService) {
    throw new HttpError(503, 'USER_TELEGRAM_BOT_NOT_CONFIGURED', '用户服务 Bot 尚未配置');
  }
  return deps.userTelegramBotSettingsService;
}

async function requireApplication(deps: PortalDeps, applicationId: number) {
  const application = await deps.airportApplicationRepository.getById(applicationId);
  if (!application) {
    throw new HttpError(404, 'AIRPORT_APPLICATION_NOT_FOUND', `application ${applicationId} not found`);
  }
  return application;
}

async function notifyPaymentReceivedSafely(
  deps: PortalDeps,
  input: Omit<PaymentReceivedNotificationInput, 'airportName'> & { airportName?: string },
): Promise<void> {
  if (!deps.applicationNotificationService) {
    return;
  }

  try {
    const application = input.applicationId != null
      ? await deps.airportApplicationRepository.getById(input.applicationId)
      : await getApplicationByApplicantAccountId(deps, Number(input.applicantAccountId));

    await deps.applicationNotificationService.notifyPaymentReceived({
      ...input,
      airportName: input.airportName || application?.name || '-',
      applicationId: input.applicationId ?? application?.id ?? null,
    });
  } catch (error) {
    console.error('[telegram] failed to notify payment received', {
      paymentType: input.paymentType,
      outTradeNo: input.outTradeNo,
      error,
    });
  }
}

async function getApplicationByApplicantAccountId(deps: PortalDeps, applicantAccountId: number) {
  const account = await deps.applicantAccountRepository.getById(applicantAccountId);
  if (!account) {
    return null;
  }
  return deps.airportApplicationRepository.getById(account.application_id);
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

async function getAvailablePaymentMethods(deps: PortalDeps): Promise<PaymentGatewayChannel[]> {
  const config = await deps.paymentGatewaySettingsService.getConfig();
  const record = toLooseObject(config);
  const methods: PaymentGatewayChannel[] = [];
  const epay = toLooseObject(record.epay);
  if (
    Boolean(record.enabled) &&
    Boolean(epay.enabled) &&
    String(record.pid || '').trim() &&
    String(record.private_key || '').trim() &&
    String(record.platform_public_key || '').trim()
  ) {
    methods.push('alipay', 'wxpay');
  }

  const usdt = toLooseObject(record.usdt);
  if (
    Boolean(record.enabled) &&
    Boolean(usdt.enabled) &&
    String(usdt.gateway_url || '').trim() &&
    String(usdt.merchant_id || '').trim() &&
    String(usdt.secret_key || '').trim()
  ) {
    methods.push('usdt');
  }

  return methods;
}

async function requirePaymentChannelAvailable(
  deps: PortalDeps,
  channel: PaymentGatewayChannel,
): Promise<void> {
  const methods = await getAvailablePaymentMethods(deps);
  if (!methods.includes(channel)) {
    throw new HttpError(409, 'PAYMENT_METHOD_NOT_ENABLED', '该支付方式未启用或配置不完整');
  }
}

function toPaymentChannel(value: unknown): PaymentGatewayChannel {
  if (value === 'alipay' || value === 'wxpay' || value === 'usdt') {
    return value;
  }
  throw new HttpError(400, 'BAD_REQUEST', 'channel must be alipay|wxpay|usdt');
}

function getNotificationOutTradeNo(payload: Record<string, unknown>): string {
  return String(payload.out_trade_no || payload.order_id || '').trim();
}

function getNotificationGatewayTradeNo(payload: Record<string, unknown>): string | null {
  return stringOrNull(payload.trade_no) || stringOrNull(payload.trade_id);
}

function getNotificationPayType(
  payload: Record<string, unknown>,
  channel: PaymentGatewayChannel,
  fallback: string,
): string {
  if (channel === 'usdt') {
    return 'usdt';
  }
  return stringOrNull(payload.type) || fallback;
}

function getNotificationSuccessResponse(channel: PaymentGatewayChannel): string {
  return channel === 'usdt' ? 'ok' : 'success';
}

function toRechargeAmount(value: unknown): number {
  const amount = Number(value);
  if (!RECHARGE_AMOUNTS.includes(amount as (typeof RECHARGE_AMOUNTS)[number])) {
    throw new HttpError(400, 'BAD_REQUEST', `amount must be one of ${RECHARGE_AMOUNTS.join('|')}`);
  }
  return amount;
}

function parsePagination(query: Record<string, unknown>): { page: number; pageSize: number } {
  return {
    page: parsePositiveInt(query.page, 1, 1000000),
    pageSize: parsePositiveInt(query.page_size, 20, 100),
  };
}

function parsePositiveInt(value: unknown, fallback: number, max: number): number {
  const num = Number(value || fallback);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.min(max, Math.max(1, Math.floor(num)));
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

async function getPaymentNotifyOrigin(deps: PortalDeps, req: any): Promise<string> {
  const config = toLooseObject(await deps.paymentGatewaySettingsService.getConfig());
  const fromSettings = String(config.notify_origin || '').trim();
  if (fromSettings) {
    return fromSettings.replace(/\/+$/, '');
  }

  const configured = String(process.env.PAYMENT_NOTIFY_ORIGIN || process.env.API_BASE || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return getRequestOrigin(req).replace(/\/+$/, '');
}

async function getXOAuthReturnOrigin(deps: PortalDeps, req: any): Promise<string> {
  const origin = await deps.applicantXOAuthService?.getReturnOrigin?.();
  if (origin) {
    return origin;
  }
  return getSiteOrigin(req);
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
