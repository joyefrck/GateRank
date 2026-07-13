import { randomInt, randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { APPLICATION_FEE_AMOUNT, CLICK_CHARGE_AMOUNT, RECHARGE_AMOUNTS } from '../config/billing';
import { HttpError } from '../middleware/errorHandler';
import { portalAuth } from '../middleware/portalAuth';
import { createPortalLoginFlowRateLimit, createPortalLoginRateLimit } from '../middleware/rateLimit';
import type { ApplicantAccount } from '../repositories/applicantAccountRepository';
import type { ApplicantEmailChangeCodeRepository } from '../repositories/applicantEmailChangeCodeRepository';
import type { ApplicantTelegramBinding } from '../repositories/applicantTelegramBindingRepository';
import type { ApplicantTelegramLoginFlowRepository } from '../repositories/applicantTelegramLoginFlowRepository';
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
import { resolveAvailablePaymentMethods } from '../services/paymentMethodAvailability';
import {
  CLICK_CHARGE_RANKS,
  createDefaultRankClickChargeAmounts,
  type RankClickChargeAmounts,
} from '../services/marketingSettingsService';
import { PORTAL_AUTH_COOKIE, clearAuthCookie, setAuthCookie } from '../utils/authCookies';
import type { UpdateAirportInput } from '../repositories/airportRepository';
import type { Airport, AirportPaymentMethod, AirportProfile, AirportStreamingSupport } from '../types/domain';
import { createDefaultAirportProfile, normalizeAirportProfile, parseAirportProfilePayload } from '../utils/airportProfile';
import {
  AIRPORT_AD_LOW_BALANCE_WARNING_THRESHOLD,
  AIRPORT_AD_MONTHLY_PRICE,
  type AirportDealView,
  type PortalAirportAdStatus,
} from '../../../shared/airportAds';

interface PortalDeps {
  applicantAccountRepository: {
    getById(id: number): Promise<ApplicantAccount | null>;
    getByEmail?(email: string): Promise<ApplicantAccount | null>;
    updatePassword(id: number, passwordHash: string, mustChangePassword: boolean): Promise<boolean>;
    updateEmail?(id: number, email: string): Promise<boolean>;
  };
  applicantEmailChangeCodeRepository?: Pick<
    ApplicantEmailChangeCodeRepository,
    'getCooldownRecord' | 'create' | 'consume'
  >;
  airportApplicationRepository: {
    getById(id: number): Promise<any>;
    updateApplicantEmail?(id: number, applicantEmail: string): Promise<boolean>;
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
    updateApplicantOperations?(
      id: number,
      input: ApplicantApplicationOperationsInput,
    ): Promise<boolean | RechargeCreditResult>;
    markPaid(id: number, paymentAmount: number, paidAt: string): Promise<boolean>;
  };
  airportRepository?: {
    getById?(id: number): Promise<Airport | null>;
    update(id: number, input: UpdateAirportInput): Promise<boolean>;
  };
  publicPageCache?: {
    clear(): void;
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
  airportAdCampaignRepository?: {
    getPortalStatus(airportId: number | null, monthlyPrice?: number): Promise<PortalAirportAdStatus>;
    purchase(input: {
      airport_id: number;
      applicant_account_id: number;
      application_id: number;
      months: number;
      monthly_price: number;
      coupon_code: string;
      discount_title: string;
      discount_description: string;
      applicable_plan: string;
      is_stackable: boolean;
      refund_supported: boolean;
      discount_percent: number | null;
    }): Promise<AirportDealView>;
    update(input: {
      campaign_id: number;
      airport_id: number;
      applicant_account_id: number;
      application_id: number;
      extend_months: number;
      monthly_price: number;
      coupon_code: string;
      discount_title: string;
      discount_description: string;
      applicable_plan: string;
      is_stackable: boolean;
      refund_supported: boolean;
      discount_percent: number | null;
    }): Promise<AirportDealView>;
    cancel(input: {
      campaign_id: number;
      airport_id: number;
      applicant_account_id: number;
      application_id: number;
    }): Promise<boolean>;
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
  applicantTelegramLoginFlowRepository?: Pick<ApplicantTelegramLoginFlowRepository, 'create' | 'consumeForLogin'>;
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
      rank_click_charge_amounts?: Partial<RankClickChargeAmounts>;
      airport_ad_monthly_price?: number;
      recharge_amounts?: number[];
      admin_telegram_username?: string | null;
    }>;
  };
  paymentGatewayService: Pick<PaymentGatewayService, 'createOrder' | 'verifyNotificationPayload'> & {
    queryOrder?: PaymentGatewayService['queryOrder'];
  };
  applicationNotificationService?: {
    notifyPaymentReceived(input: PaymentReceivedNotificationInput): Promise<void>;
  };
  mailService?: BillingMailService & {
    sendApplicantEmailChangeCodeEmail?(input: {
      to: string;
      code: string;
      expiresInMinutes: number;
    }): Promise<void>;
  };
  userTelegramBotMessageService?: UserTelegramBotBillingNotificationService;
}

interface ApplicantApplicationOperationsInput {
  name: string;
  website: string;
  websites: string[];
  plan_price_month: number;
  has_trial: boolean;
  streaming_support: AirportStreamingSupport[];
  payment_methods: AirportPaymentMethod[];
  payment_crypto_other: string | null;
  profile: AirportProfile;
  profile_from_payload: boolean;
  subscription_url?: string | null;
  subscription_url_updated_source?: 'admin' | 'portal' | null;
  applicant_telegram: string;
  founded_on: string;
  airport_intro: string;
  test_account: string;
  test_password: string;
}

export function createPortalRoutes(deps: PortalDeps): Router {
  const router = Router();
  const portalLoginRateLimit = createPortalLoginRateLimit();
  const portalLoginFlowRateLimit = createPortalLoginFlowRateLimit();

  router.post('/portal/login', portalLoginRateLimit, async (req, res, next) => {
    try {
      const payload = toPlainObject(req.body ?? {}, 'body');
      const email = mustEmail(payload.email, 'email');
      const password = mustString(payload.password, 'password');
      const auth = await deps.applicantPortalAuthService.login(email, password);
      setPortalAuthCookie(res, req, auth.token, auth.expires_at);
      res.json({
        token: auth.token,
        expires_at: auth.expires_at,
        account: toPortalAccountView(auth.account),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/x-oauth/login/start', portalLoginFlowRateLimit, async (_req, res, next) => {
    try {
      res.status(201).json(await requireApplicantXOAuthService(deps).startLogin());
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/x-oauth/login/complete', portalLoginFlowRateLimit, async (req, res, next) => {
    try {
      const payload = toPlainObject(req.body ?? {}, 'body');
      const account = await requireApplicantXOAuthService(deps).consumeLoginHandoff(mustString(payload.code, 'code'));
      if (!deps.applicantPortalAuthService.createSession) {
        throw new Error('applicantPortalAuthService.createSession is not configured');
      }
      const auth = await deps.applicantPortalAuthService.createSession(account);
      setPortalAuthCookie(res, req, auth.token, auth.expires_at);
      res.json({
        token: auth.token,
        expires_at: auth.expires_at,
        account: toPortalAccountView(auth.account),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/telegram-login/start', portalLoginFlowRateLimit, async (_req, res, next) => {
    try {
      const config = await requireUserTelegramBotSettingsService(deps).getConfig();
      if (!isUserTelegramBotConfigReady(config) || !config.bot_username) {
        throw new HttpError(409, 'USER_TELEGRAM_BOT_NOT_CONFIGURED', '用户服务 Bot 尚未完成 Webhook 配置');
      }
      const flow = await requireApplicantTelegramLoginFlowRepository(deps).create();
      res.status(201).json({
        login_url: `https://t.me/${config.bot_username}?start=${encodeURIComponent(flow.start_token)}`,
        flow_id: flow.flow_id,
        poll_token: flow.poll_token,
        expires_at: flow.expires_at,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/telegram-login/complete', portalLoginFlowRateLimit, async (req, res, next) => {
    try {
      const payload = toPlainObject(req.body ?? {}, 'body');
      const result = await requireApplicantTelegramLoginFlowRepository(deps).consumeForLogin(
        mustString(payload.flow_id, 'flow_id'),
        mustString(payload.poll_token, 'poll_token'),
      );
      if (!result) {
        throw new HttpError(401, 'TELEGRAM_LOGIN_CODE_INVALID', 'Telegram 登录凭证无效，请重新登录');
      }
      if (result.status !== 'completed') {
        res.json({
          status: result.status,
          error: result.failure_reason || telegramLoginStatusMessage(result.status),
        });
        return;
      }
      const account = await deps.applicantAccountRepository.getById(result.applicant_account_id);
      if (!account) {
        throw new HttpError(401, 'TELEGRAM_ACCOUNT_NOT_BOUND', '该 Telegram 账号尚未绑定申请人后台，请先使用邮箱登录后绑定');
      }
      if (!deps.applicantPortalAuthService.createSession) {
        throw new Error('applicantPortalAuthService.createSession is not configured');
      }
      const auth = await deps.applicantPortalAuthService.createSession(account);
      setPortalAuthCookie(res, req, auth.token, auth.expires_at);
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

  router.post('/portal/account/email-code', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      const payload = toPlainObject(req.body ?? {}, 'body');
      const email = mustEmail(payload.email, 'email');
      await assertApplicantEmailCanBeUsed(deps, account, email);

      const codeRepository = requireApplicantEmailChangeCodeRepository(deps);
      const cooldownRecord = await codeRepository.getCooldownRecord(account.id, email);
      if (cooldownRecord) {
        res.json({
          ok: true,
          throttled: true,
          expires_at: cooldownRecord.expires_at,
        });
        return;
      }

      const code = createEmailVerificationCode();
      const record = await codeRepository.create(account.id, email, code);
      await requireApplicantEmailCodeMailService(deps).sendApplicantEmailChangeCodeEmail({
        to: email,
        code,
        expiresInMinutes: 10,
      });
      res.status(201).json({
        ok: true,
        throttled: false,
        expires_at: record.expires_at,
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/portal/account/email', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      const payload = toPlainObject(req.body ?? {}, 'body');
      const email = mustEmail(payload.email, 'email');
      const code = mustString(payload.code, 'code');
      await assertApplicantEmailCanBeUsed(deps, account, email);
      await consumeApplicantEmailChangeCode(deps, account.id, email, code);

      if (!deps.airportApplicationRepository.updateApplicantEmail) {
        throw new Error('airportApplicationRepository.updateApplicantEmail is not configured');
      }
      if (!deps.applicantAccountRepository.updateEmail) {
        throw new Error('applicantAccountRepository.updateEmail is not configured');
      }
      await deps.airportApplicationRepository.updateApplicantEmail(account.application_id, email);
      await deps.applicantAccountRepository.updateEmail(account.id, email);
      res.json(await buildPortalView(deps, session.applicant_id));
    } catch (error) {
      next(normalizePortalApplicationMutationError(error));
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
      const apiOrigin = await getPaymentNotifyOrigin(deps);
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
        recharge_amounts: marketingConfig.recharge_amounts,
        click_price: marketingConfig.click_charge_amount,
        rank_click_charge_amounts: marketingConfig.rank_click_charge_amounts,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/portal/ad-campaign', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      const application = await requireApplication(deps, account.application_id);
      const airportId = Number(application.approved_airport_id || 0) || null;
      const marketingConfig = await getMarketingBillingConfig(deps);
      res.json(await requireAirportAdCampaignRepository(deps).getPortalStatus(
        airportId,
        marketingConfig.airport_ad_monthly_price,
      ));
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/ad-campaign', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      if (account.must_change_password) {
        throw new HttpError(409, 'PASSWORD_CHANGE_REQUIRED', '首次登录后必须先修改密码');
      }
      const application = await requireApplication(deps, account.application_id);
      if (application.payment_status !== 'paid' || application.review_status !== 'reviewed') {
        throw new HttpError(409, 'AIRPORT_AD_APPLICATION_NOT_READY', '申请通过并支付后才能投放广告');
      }
      const airportId = Number(application.approved_airport_id || 0);
      if (!airportId) {
        throw new HttpError(409, 'AIRPORT_AD_AIRPORT_NOT_APPROVED', '当前申请尚未绑定已审核机场');
      }
      if (deps.airportRepository?.getById) {
        const airport = await deps.airportRepository.getById(airportId);
        if (!airport) {
          throw new HttpError(404, 'AIRPORT_NOT_FOUND', '机场不存在');
        }
      }
      const payload = toPlainObject(req.body ?? {}, 'body');
      const months = mustAdMonths(payload.months);
      const marketingConfig = await getMarketingBillingConfig(deps);
      const discountPercent = payload.discount_percent === undefined || payload.discount_percent === null || payload.discount_percent === ''
        ? null
        : mustDiscountPercent(payload.discount_percent);
      const campaign = await requireAirportAdCampaignRepository(deps).purchase({
        airport_id: airportId,
        applicant_account_id: account.id,
        application_id: account.application_id,
        months,
        monthly_price: marketingConfig.airport_ad_monthly_price,
        coupon_code: mustBoundedString(payload.coupon_code, 'coupon_code', 64),
        discount_title: mustBoundedString(payload.discount_title, 'discount_title', 128),
        discount_description: mustBoundedString(payload.discount_description, 'discount_description', 800),
        applicable_plan: mustBoundedString(payload.applicable_plan, 'applicable_plan', 128),
        is_stackable: Boolean(payload.is_stackable),
        refund_supported: Boolean(payload.refund_supported),
        discount_percent: discountPercent,
      });
      deps.publicPageCache?.clear();
      res.status(201).json({
        campaign,
        ad_status: await requireAirportAdCampaignRepository(deps).getPortalStatus(
          airportId,
          marketingConfig.airport_ad_monthly_price,
        ),
        wallet: await deps.applicantBillingRepository.getWalletByAccountId(account.id),
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/portal/ad-campaign/:campaignId', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      if (account.must_change_password) {
        throw new HttpError(409, 'PASSWORD_CHANGE_REQUIRED', '首次登录后必须先修改密码');
      }
      const application = await requireApplication(deps, account.application_id);
      if (application.payment_status !== 'paid' || application.review_status !== 'reviewed') {
        throw new HttpError(409, 'AIRPORT_AD_APPLICATION_NOT_READY', '申请通过并支付后才能修改广告');
      }
      const airportId = Number(application.approved_airport_id || 0);
      if (!airportId) {
        throw new HttpError(409, 'AIRPORT_AD_AIRPORT_NOT_APPROVED', '当前申请尚未绑定已审核机场');
      }
      const campaignId = Number(req.params.campaignId);
      if (!Number.isInteger(campaignId) || campaignId <= 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'campaignId must be positive integer');
      }
      const payload = toPlainObject(req.body ?? {}, 'body');
      const extendMonths = mustAdExtendMonths(payload.extend_months);
      const marketingConfig = await getMarketingBillingConfig(deps);
      const discountPercent = payload.discount_percent === undefined || payload.discount_percent === null || payload.discount_percent === ''
        ? null
        : mustDiscountPercent(payload.discount_percent);
      const campaign = await requireAirportAdCampaignRepository(deps).update({
        campaign_id: campaignId,
        airport_id: airportId,
        applicant_account_id: account.id,
        application_id: account.application_id,
        extend_months: extendMonths,
        monthly_price: marketingConfig.airport_ad_monthly_price,
        coupon_code: mustBoundedString(payload.coupon_code, 'coupon_code', 64),
        discount_title: mustBoundedString(payload.discount_title, 'discount_title', 128),
        discount_description: mustBoundedString(payload.discount_description, 'discount_description', 800),
        applicable_plan: mustBoundedString(payload.applicable_plan, 'applicable_plan', 128),
        is_stackable: Boolean(payload.is_stackable),
        refund_supported: Boolean(payload.refund_supported),
        discount_percent: discountPercent,
      });
      deps.publicPageCache?.clear();
      res.json({
        campaign,
        ad_status: await requireAirportAdCampaignRepository(deps).getPortalStatus(
          airportId,
          marketingConfig.airport_ad_monthly_price,
        ),
        wallet: await deps.applicantBillingRepository.getWalletByAccountId(account.id),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/portal/ad-campaign/:campaignId/cancel', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      if (account.must_change_password) {
        throw new HttpError(409, 'PASSWORD_CHANGE_REQUIRED', '首次登录后必须先修改密码');
      }
      const application = await requireApplication(deps, account.application_id);
      if (application.payment_status !== 'paid' || application.review_status !== 'reviewed') {
        throw new HttpError(409, 'AIRPORT_AD_APPLICATION_NOT_READY', '申请通过并支付后才能下架广告');
      }
      const airportId = Number(application.approved_airport_id || 0);
      if (!airportId) {
        throw new HttpError(409, 'AIRPORT_AD_AIRPORT_NOT_APPROVED', '当前申请尚未绑定已审核机场');
      }
      const campaignId = Number(req.params.campaignId);
      if (!Number.isInteger(campaignId) || campaignId <= 0) {
        throw new HttpError(400, 'BAD_REQUEST', 'campaignId must be positive integer');
      }

      await requireAirportAdCampaignRepository(deps).cancel({
        campaign_id: campaignId,
        airport_id: airportId,
        applicant_account_id: account.id,
        application_id: account.application_id,
      });
      const marketingConfig = await getMarketingBillingConfig(deps);
      deps.publicPageCache?.clear();
      res.json({
        ad_status: await requireAirportAdCampaignRepository(deps).getPortalStatus(
          airportId,
          marketingConfig.airport_ad_monthly_price,
        ),
        wallet: await deps.applicantBillingRepository.getWalletByAccountId(account.id),
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
      const marketingConfig = await getMarketingBillingConfig(deps);
      const amount = toRechargeAmount(payload.amount, marketingConfig.recharge_amounts);
      await requirePaymentChannelAvailable(deps, channel);
      await deps.applicantBillingRepository.ensureWalletForAccount(account.id, account.application_id);
      const outTradeNo = `grr_${account.id}_${Date.now()}_${randomUUID().slice(0, 8)}`;
      const apiOrigin = await getPaymentNotifyOrigin(deps);
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
      const emailWillChange = applicantEmail !== account.email;
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
      if (emailWillChange) {
        await consumeApplicantEmailChangeCode(
          deps,
          account.id,
          applicantEmail,
          mustString(payload.email_code, 'email_code'),
        );
      }

      const input = {
        name: application.name,
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

      if (emailWillChange) {
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

  router.patch('/portal/application/operations', portalAuth, async (req, res, next) => {
    try {
      const session = requireApplicantSession(req);
      const account = await requireApplicantAccount(deps, session.applicant_id);
      const application = await requireApplication(deps, account.application_id);
      const payload = toPlainObject(req.body ?? {}, 'body');
      const input = parseApplicantApplicationOperationsPayload(payload);
      input.name = application.name;

      if (!deps.airportApplicationRepository.updateApplicantOperations) {
        throw new Error('airportApplicationRepository.updateApplicantOperations is not configured');
      }
      const updated = await deps.airportApplicationRepository.updateApplicantOperations(application.id, input);
      if (!updated) {
        throw new HttpError(409, 'PORTAL_APPLICATION_UPDATE_FAILED', '申请资料未更新，请刷新后重试');
      }

      await syncApprovedAirportOperations(deps, application, input);

      res.json(await buildPortalView(deps, session.applicant_id));
    } catch (error) {
      next(normalizePortalApplicationMutationError(error));
    }
  });

  router.post('/portal/logout', portalAuth, async (req, res) => {
    clearAuthCookie(res, req, PORTAL_AUTH_COOKIE);
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
  const portalApplication = await resolvePortalApplicationView(deps, application);
  const approvedAirportId = Number(portalApplication.approved_airport_id || application.approved_airport_id || 0) || null;
  const adStatus = deps.airportAdCampaignRepository
    ? await deps.airportAdCampaignRepository.getPortalStatus(
      approvedAirportId,
      marketingConfig.airport_ad_monthly_price,
    )
    : {
        active_campaign: null,
        campaigns: [],
        remaining_slots: 0,
        slot_limit: 6,
        monthly_price: marketingConfig.airport_ad_monthly_price,
        low_balance_warning_threshold: AIRPORT_AD_LOW_BALANCE_WARNING_THRESHOLD,
        allowed_months: [1, 2, 3, 6, 12],
      };

  return {
    account: {
      ...toPortalAccountView(account),
    },
    application: portalApplication,
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
    rank_click_charge_amounts: marketingConfig.rank_click_charge_amounts,
    admin_telegram_username: marketingConfig.admin_telegram_username,
    recharge_amounts: marketingConfig.recharge_amounts,
    wallet,
    ad_status: adStatus,
    telegram_bot: telegramBot,
  };
}

async function resolvePortalApplicationView(deps: PortalDeps, application: any): Promise<any> {
  const approvedAirportId = Number(application.approved_airport_id || 0);
  if (!approvedAirportId || !deps.airportRepository?.getById) {
    return application;
  }
  const airport = await deps.airportRepository.getById(approvedAirportId);
  if (!airport) {
    return application;
  }
  return mergeApprovedAirportOperations(application, airport);
}

function mergeApprovedAirportOperations(application: any, airport: Airport): any {
  const websites = Array.isArray(airport.websites) && airport.websites.length > 0
    ? airport.websites
    : airport.website
      ? [airport.website]
      : application.websites;
  const planPriceMonth = Number(airport.plan_price_month);
  return {
    ...application,
    name: airport.name || application.name,
    website: websites[0] || application.website,
    websites,
    plan_price_month: Number.isFinite(planPriceMonth) ? planPriceMonth : application.plan_price_month,
    has_trial: Boolean(airport.has_trial),
    streaming_support: airport.streaming_support || [],
    payment_methods: airport.payment_methods || [],
    payment_crypto_other: airport.payment_crypto_other ?? null,
    profile: normalizeAirportProfile(airport.profile || application.profile || createDefaultAirportProfile()),
    subscription_url: airport.subscription_url ?? null,
    applicant_telegram: airport.applicant_telegram || application.applicant_telegram,
    founded_on: airport.founded_on || application.founded_on,
    airport_intro: airport.airport_intro || application.airport_intro,
    test_account: airport.test_account || application.test_account,
    test_password: airport.test_password || application.test_password,
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

function parseApplicantApplicationOperationsPayload(
  payload: Record<string, unknown>,
): ApplicantApplicationOperationsInput {
  const websiteBundle = parseWebsiteFields(payload, true);
  const foundedOn = mustDate(payload.founded_on, 'founded_on');
  const today = getDateInTimezone();
  if (foundedOn > today) {
    throw new HttpError(400, 'BAD_REQUEST', 'founded_on cannot be in the future');
  }
  const planPriceMonth = mustNonNegativeNumber(payload.plan_price_month, 'plan_price_month');
  const hasTrial = Boolean(payload.has_trial);
  const profileFromPayload = payload.profile !== undefined;
  const profile = normalizeApplicantOperationsProfile(
    profileFromPayload ? parseAirportProfilePayload(payload.profile) : createDefaultAirportProfile(),
    planPriceMonth,
    hasTrial,
  );
  const paymentMethods = toAirportPaymentMethodArray(payload.payment_methods ?? []);
  const input: ApplicantApplicationOperationsInput = {
    name: mustString(payload.name, 'name'),
    website: websiteBundle.website,
    websites: websiteBundle.websites,
    plan_price_month: planPriceMonth,
    has_trial: hasTrial,
    streaming_support: toAirportStreamingSupportArray(payload.streaming_support ?? []),
    payment_methods: paymentMethods,
    payment_crypto_other: paymentMethods.includes('crypto_other') ? optionalString(payload.payment_crypto_other) || null : null,
    profile,
    profile_from_payload: profileFromPayload,
    applicant_telegram: mustString(payload.applicant_telegram, 'applicant_telegram'),
    founded_on: foundedOn,
    airport_intro: mustString(payload.airport_intro, 'airport_intro'),
    test_account: mustString(payload.test_account, 'test_account'),
    test_password: mustString(payload.test_password, 'test_password'),
  };
  if (Object.hasOwn(payload, 'subscription_url')) {
    input.subscription_url = optionalString(payload.subscription_url) || null;
    input.subscription_url_updated_source = 'portal';
  }
  return input;
}

function normalizeApplicantOperationsProfile(
  profile: AirportProfile,
  planPriceMonth: number,
  hasTrial: boolean,
): AirportProfile {
  const normalized = normalizeAirportProfile(profile);
  return {
    ...normalized,
    plan: {
      ...normalized.plan,
      lowest_monthly_price: planPriceMonth,
      has_trial_plan: hasTrial,
    },
  };
}

async function syncApprovedAirportOperations(
  deps: PortalDeps,
  application: { approved_airport_id?: number | null },
  input: ApplicantApplicationOperationsInput,
): Promise<void> {
  const approvedAirportId = Number(application.approved_airport_id || 0);
  if (!approvedAirportId) {
    return;
  }
  if (!deps.airportRepository) {
    throw new Error('airportRepository is not configured');
  }

  const airport = deps.airportRepository.getById
    ? await deps.airportRepository.getById(approvedAirportId)
    : null;
  const profile = input.profile_from_payload
    ? input.profile
    : buildSyncedAirportProfile(airport?.profile ?? createDefaultAirportProfile(), input);

  const patch: UpdateAirportInput = {
    name: input.name,
    website: input.website,
    websites: input.websites,
    plan_price_month: input.plan_price_month,
    has_trial: input.has_trial,
    streaming_support: input.streaming_support,
    payment_methods: input.payment_methods,
    payment_crypto_other: input.payment_crypto_other,
    applicant_telegram: input.applicant_telegram,
    founded_on: input.founded_on,
    airport_intro: input.airport_intro,
    test_account: input.test_account,
    test_password: input.test_password,
    profile,
  };
  if (input.subscription_url !== undefined) {
    patch.subscription_url = input.subscription_url;
    patch.subscription_url_updated_source = 'portal';
  }

  const updated = await deps.airportRepository.update(approvedAirportId, patch);
  if (!updated) {
    throw new HttpError(409, 'PORTAL_AIRPORT_SYNC_FAILED', '正式机场资料未同步，请联系管理员');
  }
  deps.publicPageCache?.clear();
}

function buildSyncedAirportProfile(
  profile: AirportProfile,
  input: ApplicantApplicationOperationsInput,
): AirportProfile {
  return {
    ...profile,
    plan: {
      ...profile.plan,
      lowest_monthly_price: input.plan_price_month,
      has_trial_plan: input.has_trial,
    },
  };
}

async function getMarketingBillingConfig(deps: PortalDeps): Promise<{
  application_fee_amount: number;
  click_charge_amount: number;
  rank_click_charge_amounts: RankClickChargeAmounts;
  airport_ad_monthly_price: number;
  recharge_amounts: number[];
  admin_telegram_username: string | null;
}> {
  if (!deps.marketingSettingsService) {
    return {
      application_fee_amount: APPLICATION_FEE_AMOUNT,
      click_charge_amount: CLICK_CHARGE_AMOUNT,
      rank_click_charge_amounts: createDefaultRankClickChargeAmounts(),
      airport_ad_monthly_price: AIRPORT_AD_MONTHLY_PRICE,
      recharge_amounts: [...RECHARGE_AMOUNTS],
      admin_telegram_username: null,
    };
  }
  const config = await deps.marketingSettingsService.getConfig();
  const rechargeAmounts = Array.isArray(config.recharge_amounts) && config.recharge_amounts.length > 0
    ? config.recharge_amounts.map(Number).filter((amount) => Number.isInteger(amount) && amount > 0)
    : [...RECHARGE_AMOUNTS];
  return {
    application_fee_amount: Number(config.application_fee_amount || APPLICATION_FEE_AMOUNT),
    click_charge_amount: Number(config.click_charge_amount || CLICK_CHARGE_AMOUNT),
    rank_click_charge_amounts: normalizeRankClickChargeAmounts(config.rank_click_charge_amounts),
    airport_ad_monthly_price: Number(config.airport_ad_monthly_price || AIRPORT_AD_MONTHLY_PRICE),
    recharge_amounts: rechargeAmounts.length > 0 ? rechargeAmounts : [...RECHARGE_AMOUNTS],
    admin_telegram_username: config.admin_telegram_username ?? null,
  };
}

function normalizeRankClickChargeAmounts(
  value: Partial<RankClickChargeAmounts> | undefined,
): RankClickChargeAmounts {
  const result = createDefaultRankClickChargeAmounts();
  for (const rank of CLICK_CHARGE_RANKS) {
    const amount = Number(value?.[rank]);
    result[rank] = Number.isFinite(amount) && amount > 0 ? Number(amount.toFixed(2)) : null;
  }
  return result;
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

function requireApplicantEmailChangeCodeRepository(
  deps: PortalDeps,
): NonNullable<PortalDeps['applicantEmailChangeCodeRepository']> {
  if (!deps.applicantEmailChangeCodeRepository) {
    throw new Error('applicantEmailChangeCodeRepository is not configured');
  }
  return deps.applicantEmailChangeCodeRepository;
}

function requireApplicantEmailCodeMailService(
  deps: PortalDeps,
): NonNullable<PortalDeps['mailService']> & {
  sendApplicantEmailChangeCodeEmail(input: {
    to: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<void>;
} {
  if (!deps.mailService?.sendApplicantEmailChangeCodeEmail) {
    throw new Error('mailService.sendApplicantEmailChangeCodeEmail is not configured');
  }
  return deps.mailService as NonNullable<PortalDeps['mailService']> & {
    sendApplicantEmailChangeCodeEmail(input: {
      to: string;
      code: string;
      expiresInMinutes: number;
    }): Promise<void>;
  };
}

function requireApplicantTelegramLoginFlowRepository(
  deps: PortalDeps,
): NonNullable<PortalDeps['applicantTelegramLoginFlowRepository']> {
  if (!deps.applicantTelegramLoginFlowRepository) {
    throw new HttpError(503, 'USER_TELEGRAM_LOGIN_NOT_CONFIGURED', 'Telegram 登录服务尚未配置');
  }
  return deps.applicantTelegramLoginFlowRepository;
}

function requireAirportAdCampaignRepository(
  deps: PortalDeps,
): NonNullable<PortalDeps['airportAdCampaignRepository']> {
  if (!deps.airportAdCampaignRepository) {
    throw new Error('airportAdCampaignRepository is not configured');
  }
  return deps.airportAdCampaignRepository;
}

function requireUserTelegramBotSettingsService(
  deps: PortalDeps,
): NonNullable<PortalDeps['userTelegramBotSettingsService']> {
  if (!deps.userTelegramBotSettingsService) {
    throw new HttpError(503, 'USER_TELEGRAM_BOT_NOT_CONFIGURED', '用户服务 Bot 尚未配置');
  }
  return deps.userTelegramBotSettingsService;
}

async function assertApplicantEmailCanBeUsed(
  deps: PortalDeps,
  account: ApplicantAccount,
  email: string,
): Promise<void> {
  if (email === account.email) {
    throw new HttpError(400, 'APPLICANT_EMAIL_UNCHANGED', '新邮箱不能与当前登录邮箱相同');
  }
  if (!deps.applicantAccountRepository.getByEmail) {
    return;
  }
  const existing = await deps.applicantAccountRepository.getByEmail(email);
  if (existing && existing.id !== account.id) {
    throw new HttpError(
      409,
      'AIRPORT_APPLICATION_EMAIL_CONFLICT',
      '该邮箱已有进行中或已通过的申请，请更换其他邮箱',
    );
  }
}

async function consumeApplicantEmailChangeCode(
  deps: PortalDeps,
  applicantAccountId: number,
  email: string,
  code: string,
): Promise<void> {
  const result = await requireApplicantEmailChangeCodeRepository(deps).consume(applicantAccountId, email, code);
  if (result === 'consumed') {
    return;
  }
  if (result === 'expired') {
    throw new HttpError(400, 'APPLICANT_EMAIL_CODE_EXPIRED', '邮箱验证码已过期，请重新获取');
  }
  if (result === 'already_consumed') {
    throw new HttpError(400, 'APPLICANT_EMAIL_CODE_CONSUMED', '邮箱验证码已使用，请重新获取');
  }
  throw new HttpError(400, 'APPLICANT_EMAIL_CODE_INVALID', '邮箱验证码不正确');
}

function createEmailVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

function telegramLoginStatusMessage(status: 'pending' | 'failed' | 'expired' | 'consumed'): string {
  if (status === 'pending') {
    return '请在 Telegram 中点击 Bot 的开始按钮完成登录';
  }
  if (status === 'expired') {
    return 'Telegram 登录链接已过期，请重新发起登录';
  }
  if (status === 'consumed') {
    return 'Telegram 登录凭证已使用，请重新登录';
  }
  return 'Telegram 登录失败，请重新发起登录';
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

function mustBoundedString(value: unknown, fieldName: string, maxLength: number): string {
  const text = mustString(value, fieldName);
  if (text.length > maxLength) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be at most ${maxLength} characters`);
  }
  return text;
}

function mustAdMonths(value: unknown): number {
  const months = Number(value);
  if (![1, 2, 3, 6, 12].includes(months)) {
    throw new HttpError(400, 'BAD_REQUEST', 'months must be one of 1,2,3,6,12');
  }
  return months;
}

function mustAdExtendMonths(value: unknown): number {
  const months = Number(value);
  if (![0, 1, 2, 3, 6, 12].includes(months)) {
    throw new HttpError(400, 'BAD_REQUEST', 'extend_months must be one of 0,1,2,3,6,12');
  }
  return months;
}

function mustDiscountPercent(value: unknown): number {
  const percent = Number(value);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new HttpError(400, 'BAD_REQUEST', 'discount_percent must be between 0 and 100');
  }
  return Number(percent.toFixed(2));
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

function toAirportStreamingSupportArray(value: unknown): AirportStreamingSupport[] {
  return toEnumArray(value, 'streaming_support', [
    'netflix',
    'chatgpt',
    'disney_plus',
    'hbo_max',
    'youtube_premium',
    'tiktok',
    'spotify',
  ]);
}

function toAirportPaymentMethodArray(value: unknown): AirportPaymentMethod[] {
  return toEnumArray(value, 'payment_methods', [
    'wechat',
    'alipay',
    'usdt_trc20',
    'usdt_erc20',
    'usdt_bep20',
    'stripe_card',
    'paypal',
    'crypto_other',
    'unionpay',
  ]);
}

function toEnumArray<T extends string>(value: unknown, fieldName: string, allowedValues: readonly T[]): T[] {
  const items = toStringArray(value, fieldName)
    .map((item) => item.trim())
    .filter(Boolean);
  const allowed = new Set(allowedValues);
  const invalid = items.find((item) => !allowed.has(item as T));
  if (invalid) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} contains unsupported value: ${invalid}`);
  }
  return [...new Set(items as T[])];
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
  return resolveAvailablePaymentMethods(config);
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

function toRechargeAmount(value: unknown, allowedAmounts: number[]): number {
  const amount = Number(value);
  if (!allowedAmounts.includes(amount)) {
    throw new HttpError(400, 'BAD_REQUEST', `amount must be one of ${allowedAmounts.join('|')}`);
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

function setPortalAuthCookie(res: Response, req: Request, token: string, expiresAt: string): void {
  setAuthCookie(res, req, PORTAL_AUTH_COOKIE, token, expiresAt);
}

function getClientIp(req: any): string {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) {
    return forwarded;
  }
  return String(req.ip || '127.0.0.1').replace('::ffff:', '');
}

async function getPaymentNotifyOrigin(deps: PortalDeps): Promise<string> {
  const config = toLooseObject(await deps.paymentGatewaySettingsService.getConfig());
  const fromSettings = normalizeExplicitPaymentNotifyOrigin(config.notify_origin);
  if (fromSettings) {
    return fromSettings;
  }

  const configured = normalizeExplicitPaymentNotifyOrigin(process.env.PAYMENT_NOTIFY_ORIGIN || process.env.API_BASE);
  if (configured) {
    return configured;
  }
  throw new HttpError(
    409,
    'PAYMENT_NOTIFY_ORIGIN_NOT_CONFIGURED',
    '支付回调 Origin 未配置，请设置 PAYMENT_NOTIFY_ORIGIN、API_BASE 或后台支付回调地址',
  );
}

function normalizeExplicitPaymentNotifyOrigin(value: unknown): string {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  if (!raw) {
    return '';
  }
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
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
