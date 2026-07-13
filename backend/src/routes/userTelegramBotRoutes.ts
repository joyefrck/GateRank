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
import { TELEGRAM_LOGIN_START_PREFIX } from '../repositories/applicantTelegramLoginFlowRepository';
import type { PaymentGatewayChannel, PaymentGatewayService } from '../services/paymentGatewayService';
import { resolveAvailablePaymentMethods } from '../services/paymentMethodAvailability';
import {
  CLICK_CHARGE_RANKS,
  createDefaultRankClickChargeAmounts,
  type RankClickChargeAmounts,
} from '../services/marketingSettingsService';
import type { UserTelegramBotConfig, UserTelegramBotSettingsService } from '../services/userTelegramBotSettingsService';
import { getSiteOrigin } from '../utils/siteUrl';
import { getDateInTimezone } from '../utils/time';

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
  applicantTelegramLoginFlowRepository?: {
    completeByStartToken(
      startToken: string,
      applicantAccountId: number,
      telegramUserId: string,
    ): Promise<'completed' | 'expired' | 'invalid'>;
    failByStartToken(
      startToken: string,
      reason: string,
      telegramUserId?: string | null,
    ): Promise<'failed' | 'expired' | 'invalid'>;
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
    countClicksForDate(applicantAccountId: number, eventDate: string): Promise<number>;
  };
  paymentGatewaySettingsService: {
    getConfig(): Promise<unknown>;
  };
  paymentGatewayService: Pick<PaymentGatewayService, 'createOrder'>;
  marketingSettingsService?: {
    getConfig(): Promise<{
      click_charge_amount?: number;
      rank_click_charge_amounts?: Partial<RankClickChargeAmounts>;
      recharge_amounts?: number[];
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
          ? `当前 Telegram 账号已绑定 GateRank 申请人账号。\n${buildCommandMenuHint()}`
          : '请先在 GateRank 申请人后台生成绑定链接，再从链接打开此 Bot。',
      );
      return;
    }
    if (token.startsWith(TELEGRAM_LOGIN_START_PREFIX)) {
      await handleTelegramLoginStart(deps, config, chatId, from.userId, token);
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
        ? `绑定成功。\n${buildCommandMenuHint()}`
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
  if (text.startsWith('/today')) {
    await sendTodayClicksMessage(deps, config, chatId, context.account.id);
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

  await sendTelegramMessage(config, chatId, `暂不支持这条消息。\n${buildCommandMenuHint()}`);
}

async function handleTelegramLoginStart(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  chatId: string,
  telegramUserId: string,
  token: string,
): Promise<void> {
  if (!deps.applicantTelegramLoginFlowRepository) {
    await sendTelegramMessage(config, chatId, 'Telegram 登录服务尚未配置，请稍后再试。');
    return;
  }

  const binding = await deps.applicantTelegramBindingRepository.getByTelegramUserId(telegramUserId);
  if (!binding) {
    const reason = '该 Telegram 账号尚未绑定申请人后台，请先使用邮箱登录后绑定 Telegram。';
    const status = await deps.applicantTelegramLoginFlowRepository.failByStartToken(token, reason, telegramUserId);
    await sendTelegramMessage(config, chatId, telegramLoginReplyForStatus(status, reason));
    return;
  }

  const account = await deps.applicantAccountRepository.getById(binding.applicant_account_id);
  if (!account) {
    const reason = '绑定账号已失效，请在 GateRank 申请人后台重新绑定 Telegram。';
    const status = await deps.applicantTelegramLoginFlowRepository.failByStartToken(token, reason, telegramUserId);
    await sendTelegramMessage(config, chatId, telegramLoginReplyForStatus(status, reason));
    return;
  }

  const status = await deps.applicantTelegramLoginFlowRepository.completeByStartToken(
    token,
    account.id,
    telegramUserId,
  );
  await sendTelegramMessage(config, chatId, telegramLoginReplyForStatus(status, 'Telegram 登录已确认，请回到 GateRank 申请人后台继续。'));
}

function telegramLoginReplyForStatus(
  status: 'completed' | 'failed' | 'expired' | 'invalid',
  successOrFailureMessage: string,
): string {
  if (status === 'completed' || status === 'failed') {
    return successOrFailureMessage;
  }
  if (status === 'expired') {
    return 'Telegram 登录链接已过期，请回到 GateRank 申请人后台重新发起登录。';
  }
  return 'Telegram 登录链接无效，请回到 GateRank 申请人后台重新发起登录。';
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
  const billingConfig = await getBillingConfig(deps);
  if (!billingConfig.recharge_amounts.includes(amount) || !channel) {
    await sendTelegramMessage(config, chatId, '充值选项无效，请重新发送 /recharge。');
    return;
  }
  try {
    await createTelegramRechargeOrder(deps, config, chatId, context.account, amount, channel, req);
  } catch (error) {
    console.error('[telegram-user-bot] failed to create recharge order', {
      telegramUserId: from.userId,
      applicantAccountId: context.account.id,
      amount,
      channel,
      error,
    });
    await sendTelegramMessage(
      config,
      chatId,
      `充值订单创建失败：${formatTelegramErrorMessage(error)} 请稍后重试或联系管理员。`,
    );
  }
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

function buildCommandMenuHint(): string {
  return '输入 / 可选择查询余额、流水、访问记录或充值。';
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
  const listingStatus = formatTelegramListingStatus(wallet);
  await sendTelegramMessage(
    config,
    chatId,
    [
      `机场：${application?.name || '-'}`,
      `账户余额：¥${formatMoney(wallet.balance)}`,
      `默认点击单价：¥${formatMoney(billingConfig.click_charge_amount)} / 次`,
      '评分前六名点击费：',
      ...CLICK_CHARGE_RANKS.map((rank) => {
        const configuredAmount = billingConfig.rank_click_charge_amounts[rank];
        const effectiveAmount = configuredAmount ?? billingConfig.click_charge_amount;
        return `第${rank}名：¥${formatMoney(effectiveAmount)} / 次${configuredAmount === null ? '（默认价）' : '（定制价）'}`;
      }),
      `上架状态：${listingStatus}`,
    ].join('\n'),
  );
}

function formatTelegramListingStatus(wallet: ApplicantWalletView): string {
  if (wallet.airport_is_listed === true) {
    return '正常';
  }
  if (wallet.airport_is_listed === false) {
    return '已下架';
  }
  if (wallet.auto_unlisted_at) {
    return '总分暂不公开';
  }
  return '正常';
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

async function sendTodayClicksMessage(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  chatId: string,
  applicantAccountId: number,
): Promise<void> {
  const eventDate = getDateInTimezone('Asia/Shanghai');
  const total = await deps.applicantBillingRepository.countClicksForDate(applicantAccountId, eventDate);
  await sendTelegramMessage(
    config,
    chatId,
    [
      `今日访问量：${total} 次`,
      `统计日期：${eventDate}`,
      '口径：当前绑定账号名下的访问记录',
    ].join('\n'),
  );
}

async function sendRechargeOptions(
  deps: UserTelegramBotDeps,
  config: UserTelegramBotConfig,
  chatId: string,
): Promise<void> {
  const [methods, billingConfig] = await Promise.all([
    getAvailablePaymentMethods(deps),
    getBillingConfig(deps),
  ]);
  if (methods.length === 0) {
    await sendTelegramMessage(config, chatId, '当前支付渠道尚未配置，请稍后再试或联系管理员。');
    return;
  }
  await sendTelegramMessage(
    config,
    chatId,
    '请选择充值金额和支付渠道：',
    {
      inline_keyboard: billingConfig.recharge_amounts.map((amount) => methods.map((channel) => ({
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
  const hasPaymentUrl = /^https?:\/\//i.test(payInfo);
  await sendTelegramMessage(
    config,
    chatId,
    hasPaymentUrl
      ? `充值订单已创建：¥${formatMoney(amount)}\n支付渠道：${formatPaymentChannel(channel)}\n支付链接：${payInfo}`
      : `充值订单已创建：¥${formatMoney(amount)}\n支付渠道：${formatPaymentChannel(channel)}\n请回到申请人后台继续支付。`,
    hasPaymentUrl
      ? {
          inline_keyboard: [[{
            text: `打开 ${formatPaymentChannel(channel)} 支付`,
            url: payInfo,
          }]],
        }
      : undefined,
  );
}

async function getBillingConfig(deps: UserTelegramBotDeps): Promise<{
  click_charge_amount: number;
  rank_click_charge_amounts: RankClickChargeAmounts;
  recharge_amounts: number[];
}> {
  if (!deps.marketingSettingsService) {
    return {
      click_charge_amount: CLICK_CHARGE_AMOUNT,
      rank_click_charge_amounts: createDefaultRankClickChargeAmounts(),
      recharge_amounts: [...RECHARGE_AMOUNTS],
    };
  }
  const config = await deps.marketingSettingsService.getConfig();
  const rechargeAmounts = Array.isArray(config.recharge_amounts) && config.recharge_amounts.length > 0
    ? config.recharge_amounts.map(Number).filter((amount) => Number.isInteger(amount) && amount > 0)
    : [...RECHARGE_AMOUNTS];
  return {
    click_charge_amount: Number(config.click_charge_amount || CLICK_CHARGE_AMOUNT),
    rank_click_charge_amounts: normalizeRankClickChargeAmounts(config.rank_click_charge_amounts),
    recharge_amounts: rechargeAmounts.length > 0 ? rechargeAmounts : [...RECHARGE_AMOUNTS],
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

async function getAvailablePaymentMethods(deps: UserTelegramBotDeps): Promise<PaymentGatewayChannel[]> {
  const config = await deps.paymentGatewaySettingsService.getConfig();
  return resolveAvailablePaymentMethods(config);
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

function formatTelegramErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return '支付网关暂时不可用';
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
  if (status === 'free') return '余额不足免费放行';
  if (status === 'insufficient_balance') return '余额不足';
  if (status === 'unlisted') return '未上架';
  if (status === 'no_wallet') return '无钱包';
  return status || '-';
}
