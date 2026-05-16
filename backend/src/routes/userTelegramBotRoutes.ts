import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { CLICK_CHARGE_AMOUNT, RECHARGE_AMOUNTS } from '../config/billing';
import { HttpError } from '../middleware/errorHandler';
import type { ApplicantAccount } from '../repositories/applicantAccountRepository';
import type {
  ApplicantClickView,
  ApplicantWalletView,
  PaginatedBillingRecords,
  RechargeOrderView,
  WalletTransactionView,
} from '../repositories/applicantBillingRepository';
import type { ApplicantTelegramBinding } from '../repositories/applicantTelegramBindingRepository';
import type { PaymentGatewayChannel, PaymentGatewayService } from '../services/paymentGatewayService';
import type { UserTelegramBotConfig, UserTelegramBotSettingsService } from '../services/userTelegramBotSettingsService';
import { getSiteOrigin } from '../utils/siteUrl';

interface UserTelegramBotDeps {
  userTelegramBotSettingsService: Pick<UserTelegramBotSettingsService, 'getConfig'>;
  applicantTelegramBindingRepository: {
    consumeBindToken(token: string, telegramUser: {
      telegram_user_id: string;
      telegram_chat_id: string;
      telegram_username?: string | null;
      telegram_first_name?: string | null;
      telegram_last_name?: string | null;
    }): Promise<ApplicantTelegramBinding | null>;
    getByTelegramUserId(telegramUserId: string): Promise<ApplicantTelegramBinding | null>;
    unbindApplicantAccount(applicantAccountId: number): Promise<boolean>;
  };
  applicantAccountRepository: {
    getById(id: number): Promise<ApplicantAccount | null>;
  };
  airportApplicationRepository: {
    getById(id: number): Promise<any>;
  };
  applicantBillingRepository: {
    ensureWalletForAccount(applicantAccountId: number, applicationId: number): Promise<ApplicantWalletView>;
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
    listTransactions(applicantAccountId: number, page?: number, pageSize?: number): Promise<PaginatedBillingRecords<WalletTransactionView>>;
    listClicks(applicantAccountId: number, page?: number, pageSize?: number): Promise<PaginatedBillingRecords<ApplicantClickView>>;
  };
  paymentGatewaySettingsService: {
    getConfig(): Promise<unknown>;
  };
  paymentGatewayService: Pick<PaymentGatewayService, 'createOrder'>;
  marketingSettingsService?: {
    getConfig(): Promise<{
      click_charge_amount?: number;
    }>;
  };
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id?: number;
  text?: string;
  chat?: { id?: number | string };
  from?: TelegramUser;
}

interface TelegramCallbackQuery {
  id?: string;
  data?: string;
  message?: TelegramMessage;
  from?: TelegramUser;
}

interface TelegramUser {
  id?: number | string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

const RECHARGE_CALLBACK_PREFIX = 'gr_recharge:';

export function createUserTelegramBotRoutes(deps: UserTelegramBotDeps): Router {
  const router = Router();

  router.post('/telegram/user-bot/webhook/:secret', async (req, res, next) => {
    try {
      const config = await deps.userTelegramBotSettingsService.getConfig();
      if (!config.enabled || !config.webhook_secret || req.params.secret !== config.webhook_secret) {
        throw new HttpError(404, 'NOT_FOUND', 'telegram webhook not found');
      }
      await handleTelegramUpdate(deps, config, (req.body ?? {}) as TelegramUpdate, req);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function handleTelegramUpdate(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  update: TelegramUpdate,
  req: any,
): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(deps, config, update.callback_query, req);
    return;
  }
  if (update.message) {
    await handleMessage(deps, config, update.message, req);
  }
}

async function handleMessage(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  message: TelegramMessage,
  req: any,
): Promise<void> {
  const chatId = getChatId(message);
  const from = getTelegramUser(message.from);
  const text = String(message.text || '').trim();
  if (!chatId || !from) {
    return;
  }

  if (text.startsWith('/start')) {
    const token = text.split(/\s+/)[1] || '';
    if (!token) {
      const binding = await deps.applicantTelegramBindingRepository.getByTelegramUserId(from.userId);
      await sendTelegramMessage(
        config,
        chatId,
        binding
          ? `当前 Telegram 账号已绑定 GateRank 申请人账号。\n\n${buildHelpMessage()}`
          : '请先在 GateRank 申请人后台生成绑定链接，再从链接打开此 Bot。',
      );
      return;
    }
    const binding = await deps.applicantTelegramBindingRepository.consumeBindToken(token, {
      telegram_user_id: from.userId,
      telegram_chat_id: chatId,
      telegram_username: from.username,
      telegram_first_name: from.firstName,
      telegram_last_name: from.lastName,
    });
    await sendTelegramMessage(
      config,
      chatId,
      binding
        ? `绑定成功。\n\n${buildHelpMessage()}`
        : '绑定链接无效或已过期，请回到 GateRank 申请人后台重新生成绑定链接。',
    );
    return;
  }

  const context = await requireBoundContext(deps, config, from.userId, chatId);
  if (!context) {
    return;
  }

  if (text.startsWith('/balance')) {
    await sendBalanceMessage(deps, config, chatId, context.account);
    return;
  }
  if (text.startsWith('/transactions')) {
    await sendTransactionsMessage(deps, config, chatId, context.account.id);
    return;
  }
  if (text.startsWith('/clicks')) {
    await sendClicksMessage(deps, config, chatId, context.account.id);
    return;
  }
  if (text.startsWith('/recharge')) {
    await sendRechargeOptions(deps, config, chatId);
    return;
  }
  if (text.startsWith('/unbind')) {
    await unbindTelegramAccount(deps, config, chatId, context.account.id);
    return;
  }

  await sendTelegramMessage(config, chatId, buildHelpMessage());
}

async function handleCallbackQuery(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  query: TelegramCallbackQuery,
  req: any,
): Promise<void> {
  const from = getTelegramUser(query.from);
  const chatId = query.message ? getChatId(query.message) : '';
  if (!from || !chatId) {
    return;
  }
  await answerCallbackQuery(config, String(query.id || ''));
  const context = await requireBoundContext(deps, config, from.userId, chatId);
  if (!context) {
    return;
  }

  const data = String(query.data || '');
  if (!data.startsWith(RECHARGE_CALLBACK_PREFIX)) {
    return;
  }
  const [, amountText, channelText] = data.split(':');
  const amount = Number(amountText);
  const channel = toPaymentChannelOrNull(channelText);
  if (!RECHARGE_AMOUNTS.includes(amount as (typeof RECHARGE_AMOUNTS)[number]) || !channel) {
    await sendTelegramMessage(config, chatId, '充值选项无效，请重新发送 /recharge。');
    return;
  }
  await createTelegramRechargeOrder(deps, config, chatId, context.account, amount, channel, req);
}

async function requireBoundContext(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  telegramUserId: string,
  chatId: string,
): Promise<{ binding: ApplicantTelegramBinding; account: ApplicantAccount } | null> {
  const binding = await deps.applicantTelegramBindingRepository.getByTelegramUserId(telegramUserId);
  if (!binding) {
    await sendTelegramMessage(config, chatId, '此 Telegram 账号尚未绑定 GateRank 申请人账号。请先登录申请人后台完成绑定。');
    return null;
  }
  const account = await deps.applicantAccountRepository.getById(binding.applicant_account_id);
  if (!account) {
    await sendTelegramMessage(config, chatId, '绑定账号已失效，请在 GateRank 申请人后台重新绑定。');
    return null;
  }
  return { binding, account };
}

async function unbindTelegramAccount(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  chatId: string,
  applicantAccountId: number,
): Promise<void> {
  const removed = await deps.applicantTelegramBindingRepository.unbindApplicantAccount(applicantAccountId);
  await sendTelegramMessage(
    config,
    chatId,
    removed
      ? '已解绑当前 Telegram 账号。\n如需重新绑定，请回到 GateRank 申请人后台生成新的绑定链接。'
      : '当前 Telegram 账号没有可解绑的 GateRank 绑定记录。',
  );
}

function buildHelpMessage(): string {
  return [
    '可用命令：',
    '/balance - 查看账户余额、点击单价和上架状态',
    '/transactions - 查看最近 5 条扣费流水',
    '/clicks - 查看最近 5 条访问记录',
    '/recharge - 创建充值支付链接',
    '/unbind - 解绑当前 Telegram 账号',
  ].join('\n');
}

async function sendBalanceMessage(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  chatId: string,
  account: ApplicantAccount,
): Promise<void> {
  const [application, wallet, billingConfig] = await Promise.all([
    deps.airportApplicationRepository.getById(account.application_id),
    deps.applicantBillingRepository.ensureWalletForAccount(account.id, account.application_id),
    getBillingConfig(deps),
  ]);
  const listingStatus = wallet.airport_is_listed === false || wallet.auto_unlisted_at
    ? '欠费下架'
    : '正常';
  await sendTelegramMessage(
    config,
    chatId,
    [
      `机场：${application?.name || '-'}`,
      `账户余额：¥${formatMoney(wallet.balance)}`,
      `点击单价：¥${formatMoney(billingConfig.click_charge_amount)} / 次`,
      `上架状态：${listingStatus}`,
    ].join('\n'),
  );
}

async function sendTransactionsMessage(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  chatId: string,
  applicantAccountId: number,
): Promise<void> {
  const result = await deps.applicantBillingRepository.listTransactions(applicantAccountId, 1, 5);
  if (result.items.length === 0) {
    await sendTelegramMessage(config, chatId, '暂无扣费流水。');
    return;
  }
  await sendTelegramMessage(
    config,
    chatId,
    ['最近扣费流水：', ...result.items.map((item) => {
      const sign = Number(item.amount) >= 0 ? '+' : '';
      return `${formatDate(item.created_at)} ${formatTransactionType(item.transaction_type)} ${sign}¥${formatMoney(item.amount)}，余额 ¥${formatMoney(item.balance_after)}`;
    })].join('\n'),
  );
}

async function sendClicksMessage(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  chatId: string,
  applicantAccountId: number,
): Promise<void> {
  const result = await deps.applicantBillingRepository.listClicks(applicantAccountId, 1, 5);
  if (result.items.length === 0) {
    await sendTelegramMessage(config, chatId, '暂无访问记录。');
    return;
  }
  await sendTelegramMessage(
    config,
    chatId,
    ['最近访问记录：', ...result.items.map((item) => (
      `${formatDate(item.occurred_at)} ${item.airport_name || `#${item.airport_id}`} ${formatClickStatus(item.billing_status)} ¥${formatMoney(item.billed_amount)}`
    ))].join('\n'),
  );
}

async function sendRechargeOptions(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  chatId: string,
): Promise<void> {
  const methods = await getAvailablePaymentMethods(deps);
  if (methods.length === 0) {
    await sendTelegramMessage(config, chatId, '当前支付渠道尚未配置，请稍后再试或联系管理员。');
    return;
  }
  await sendTelegramMessage(
    config,
    chatId,
    '请选择充值金额和支付渠道：',
    {
      inline_keyboard: RECHARGE_AMOUNTS.map((amount) => methods.map((channel) => ({
        text: `¥${amount} ${formatPaymentChannel(channel)}`,
        callback_data: `${RECHARGE_CALLBACK_PREFIX}${amount}:${channel}`,
      }))),
    },
  );
}

async function createTelegramRechargeOrder(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  chatId: string,
  account: ApplicantAccount,
  amount: number,
  channel: PaymentGatewayChannel,
  req: any,
): Promise<void> {
  const application = await deps.airportApplicationRepository.getById(account.application_id);
  if (!application || application.review_status !== 'reviewed' || application.payment_status !== 'paid') {
    await sendTelegramMessage(config, chatId, '当前申请尚未审核通过或入驻费未支付，暂不能通过 Bot 充值。');
    return;
  }
  if (account.must_change_password) {
    await sendTelegramMessage(config, chatId, '首次登录后必须先在申请人后台修改密码，之后才能充值。');
    return;
  }
  const methods = await getAvailablePaymentMethods(deps);
  if (!methods.includes(channel)) {
    await sendTelegramMessage(config, chatId, '当前支付渠道不可用，请重新发送 /recharge。');
    return;
  }

  await deps.applicantBillingRepository.ensureWalletForAccount(account.id, account.application_id);
  const outTradeNo = `grt_${account.id}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  const apiOrigin = await getPaymentNotifyOrigin(deps, req);
  const gatewayOrder = await deps.paymentGatewayService.createOrder({
    out_trade_no: outTradeNo,
    channel,
    name: `GateRank 点击余额充值 #${account.id}`,
    money: amount,
    notify_url: `${apiOrigin}/api/v1/portal/recharge-notify`,
    return_url: `${getSiteOrigin(req)}/portal`,
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

  const order = await deps.applicantBillingRepository.getRechargeOrderByOutTradeNo(outTradeNo);
  const payInfo = order?.pay_info || gatewayOrder.pay_info || '';
  await sendTelegramMessage(
    config,
    chatId,
    /^https?:\/\//i.test(payInfo)
      ? `充值订单已创建：¥${formatMoney(amount)}\n支付渠道：${formatPaymentChannel(channel)}\n支付链接：${payInfo}`
      : `充值订单已创建：¥${formatMoney(amount)}\n支付渠道：${formatPaymentChannel(channel)}\n请回到申请人后台继续支付。`,
  );
}

async function getBillingConfig(deps: UserTelegramBotDeps): Promise<{ click_charge_amount: number }> {
  if (!deps.marketingSettingsService) {
    return { click_charge_amount: CLICK_CHARGE_AMOUNT };
  }
  const config = await deps.marketingSettingsService.getConfig();
  return { click_charge_amount: Number(config.click_charge_amount || CLICK_CHARGE_AMOUNT) };
}

async function getAvailablePaymentMethods(deps: UserTelegramBotDeps): Promise<PaymentGatewayChannel[]> {
  const config = await deps.paymentGatewaySettingsService.getConfig();
  const record = config && typeof config === 'object' && !Array.isArray(config) ? config as Record<string, unknown> : {};
  const methods: PaymentGatewayChannel[] = [];
  if (
    Boolean(record.enabled) &&
    String(record.pid || '').trim() &&
    String(record.private_key || '').trim() &&
    String(record.platform_public_key || '').trim()
  ) {
    methods.push('alipay', 'wxpay');
  }
  const usdt = record.usdt && typeof record.usdt === 'object' && !Array.isArray(record.usdt)
    ? record.usdt as Record<string, unknown>
    : {};
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

async function getPaymentNotifyOrigin(deps: UserTelegramBotDeps, req: any): Promise<string> {
  const config = await deps.paymentGatewaySettingsService.getConfig();
  const record = config && typeof config === 'object' && !Array.isArray(config) ? config as Record<string, unknown> : {};
  const fromSettings = String(record.notify_origin || '').trim();
  if (fromSettings) {
    return fromSettings.replace(/\/+$/, '');
  }
  const configured = String(process.env.PAYMENT_NOTIFY_ORIGIN || process.env.API_BASE || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return getSiteOrigin(req).replace(/\/+$/, '');
}

async function sendTelegramMessage(
  config: UserTelegramBotConfig,
  chatId: string,
  text: string,
  replyMarkup?: Record<string, unknown>,
): Promise<void> {
  if (!config.bot_token) {
    return;
  }
  await fetch(`${config.api_base}/bot${config.bot_token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
}

async function answerCallbackQuery(config: UserTelegramBotConfig, callbackQueryId: string): Promise<void> {
  if (!callbackQueryId || !config.bot_token) {
    return;
  }
  await fetch(`${config.api_base}/bot${config.bot_token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}

function getTelegramUser(user: TelegramUser | undefined): {
  userId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
} | null {
  const id = String(user?.id || '').trim();
  if (!id) {
    return null;
  }
  return {
    userId: id,
    username: stringOrNull(user?.username),
    firstName: stringOrNull(user?.first_name),
    lastName: stringOrNull(user?.last_name),
  };
}

function getChatId(message: TelegramMessage): string {
  return String(message.chat?.id || '').trim();
}

function toPaymentChannelOrNull(value: unknown): PaymentGatewayChannel | null {
  return value === 'alipay' || value === 'wxpay' || value === 'usdt' ? value : null;
}

function getClientIp(req: any): string {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (forwarded) {
    return forwarded;
  }
  return String(req.ip || '127.0.0.1').replace('::ffff:', '');
}

function stringOrNull(value: unknown): string | null {
  const text = String(value || '').trim();
  return text || null;
}

function formatMoney(value: number): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '0.00';
}

function formatDate(value: string): string {
  return String(value || '').replace('T', ' ').replace(/\+\d{2}:\d{2}$/, '');
}

function formatPaymentChannel(channel: PaymentGatewayChannel): string {
  if (channel === 'alipay') return '支付宝';
  if (channel === 'wxpay') return '微信';
  return 'USDT';
}

function formatTransactionType(type: string): string {
  if (type === 'recharge') return '充值';
  if (type === 'click_charge') return '点击扣费';
  if (type === 'adjustment') return '后台调整';
  return type || '-';
}

function formatClickStatus(status: string): string {
  if (status === 'billed') return '已扣费';
  if (status === 'duplicate') return '重复不扣费';
  if (status === 'insufficient_balance') return '余额不足';
  if (status === 'unlisted') return '未上架';
  if (status === 'no_wallet') return '无钱包';
  return status || '-';
}
