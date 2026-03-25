import type { SystemSettingRecord } from '../repositories/systemSettingRepository';
import { formatDateTimeInTimezoneIso } from '../utils/time';

export interface NewAirportApplicationNotificationInput {
  applicationId: number;
  requestId: string;
  name: string;
  website: string;
  websites: string[];
  planPriceMonth: number;
  hasTrial: boolean;
  subscriptionUrl?: string | null;
  applicantEmail: string;
  applicantTelegram: string;
  foundedOn: string;
  airportIntro: string;
}

export type NotificationDeliveryMode = 'telegram_chat' | 'webhook';

export interface TelegramChatSettingsInput {
  bot_token?: string;
  chat_id?: string;
  api_base?: string;
  timeout_ms?: number;
}

export interface WebhookNotificationSettingsInput {
  url?: string;
  bearer_token?: string;
  timeout_ms?: number;
}

export interface TelegramNotificationSettingsInput {
  enabled?: boolean;
  delivery_mode?: NotificationDeliveryMode;
  telegram_chat?: TelegramChatSettingsInput;
  webhook?: WebhookNotificationSettingsInput;
}

export interface TelegramNotificationSettingsView {
  enabled: boolean;
  delivery_mode: NotificationDeliveryMode;
  telegram_chat: {
    has_bot_token: boolean;
    bot_token_masked: string | null;
    chat_id: string;
    api_base: string;
    timeout_ms: number;
  };
  webhook: {
    has_bearer_token: boolean;
    bearer_token_masked: string | null;
    url: string;
    timeout_ms: number;
  };
  updated_at: string | null;
  updated_by: string | null;
}

interface TelegramNotificationServiceOptions {
  systemSettingRepository?: {
    getByKey(settingKey: string): Promise<SystemSettingRecord | null>;
    upsert(settingKey: string, value: unknown, updatedBy: string): Promise<void>;
  };
  fetchImpl?: typeof fetch;
}

interface TelegramSendMessageResponse {
  ok?: boolean;
  description?: string;
  error_code?: number;
}

interface TelegramChatConfig {
  bot_token: string;
  chat_id: string;
  api_base: string;
  timeout_ms: number;
}

interface WebhookNotificationConfig {
  url: string;
  bearer_token: string;
  timeout_ms: number;
}

interface NotificationConfig {
  enabled: boolean;
  delivery_mode: NotificationDeliveryMode;
  telegram_chat: TelegramChatConfig;
  webhook: WebhookNotificationConfig;
}

const TELEGRAM_SETTING_KEY = 'telegram_notifications';
export const DEFAULT_TELEGRAM_API_BASE = 'https://api.telegram.org';
export const DEFAULT_TELEGRAM_NOTIFY_TIMEOUT_MS = 5000;
export const DEFAULT_WEBHOOK_NOTIFY_TIMEOUT_MS = 5000;

export class TelegramSendError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export class TelegramNotificationService {
  private readonly systemSettingRepository?: TelegramNotificationServiceOptions['systemSettingRepository'];
  private readonly fetchImpl: typeof fetch;
  private readonly apiBase: string;

  constructor(options: TelegramNotificationServiceOptions = {}) {
    this.systemSettingRepository = options.systemSettingRepository;
    this.fetchImpl = options.fetchImpl || fetch;
    this.apiBase = (process.env.API_BASE || `http://127.0.0.1:${process.env.PORT || 8787}`).replace(
      /\/+$/,
      '',
    );
  }

  async getAdminSettings(): Promise<TelegramNotificationSettingsView> {
    const stored = await this.getStoredConfig();
    const effective = stored?.config || getEnvFallbackConfig();

    return {
      enabled: effective.enabled,
      delivery_mode: effective.delivery_mode,
      telegram_chat: {
        has_bot_token: effective.telegram_chat.bot_token.trim() !== '',
        bot_token_masked: maskToken(effective.telegram_chat.bot_token),
        chat_id: effective.telegram_chat.chat_id,
        api_base: effective.telegram_chat.api_base,
        timeout_ms: effective.telegram_chat.timeout_ms,
      },
      webhook: {
        has_bearer_token: effective.webhook.bearer_token.trim() !== '',
        bearer_token_masked: maskToken(effective.webhook.bearer_token),
        url: effective.webhook.url,
        timeout_ms: effective.webhook.timeout_ms,
      },
      updated_at: stored?.record.updated_at ? normalizeStoredUpdatedAt(stored.record.updated_at) : null,
      updated_by: stored?.record.updated_by || null,
    };
  }

  async updateAdminSettings(
    input: TelegramNotificationSettingsInput,
    updatedBy: string,
  ): Promise<TelegramNotificationSettingsView> {
    if (!this.systemSettingRepository) {
      throw new Error('systemSettingRepository is not configured');
    }

    const nextConfig = await this.resolveConfig(input);
    await this.systemSettingRepository.upsert(TELEGRAM_SETTING_KEY, nextConfig, updatedBy);
    return this.getAdminSettings();
  }

  async sendTestMessage(input: TelegramNotificationSettingsInput = {}): Promise<void> {
    const config = await this.resolveConfig(input);
    if (config.delivery_mode === 'telegram_chat') {
      const telegramConfig = this.requireTelegramChatConfig(config.telegram_chat);
      await this.sendTelegramMessage(
        telegramConfig,
        [
          'GateRank Telegram 配置测试',
          `发送时间: ${formatDateTimeInTimezoneIso()}`,
          `Chat ID: ${telegramConfig.chat_id}`,
        ].join('\n'),
      );
      return;
    }

    const webhookConfig = this.requireWebhookConfig(config.webhook);
    await this.sendWebhookEvent(webhookConfig, {
      event: 'airport_application.test',
      occurred_at: formatDateTimeInTimezoneIso(),
      source: 'gaterank',
      delivery_mode: 'webhook',
      message: 'GateRank webhook 配置测试',
    });
  }

  async notifyNewAirportApplication(input: NewAirportApplicationNotificationInput): Promise<void> {
    const config = await this.resolveConfig();
    if (!config.enabled) {
      return;
    }

    if (config.delivery_mode === 'telegram_chat') {
      const telegramConfig = this.requireTelegramChatConfig(config.telegram_chat);
      await this.sendTelegramMessage(telegramConfig, buildApplicationMessage(input));
      return;
    }

    const webhookConfig = this.requireWebhookConfig(config.webhook);
    await this.sendWebhookEvent(
      webhookConfig,
      buildWebhookApplicationPayload(input, this.apiBase),
    );
  }

  private async resolveConfig(
    input: TelegramNotificationSettingsInput = {},
  ): Promise<NotificationConfig> {
    const stored = await this.getStoredConfig();
    const base = stored?.config || getEnvFallbackConfig();

    return {
      enabled: input.enabled ?? base.enabled,
      delivery_mode: input.delivery_mode ?? base.delivery_mode,
      telegram_chat: {
        bot_token:
          input.telegram_chat?.bot_token === undefined
            ? base.telegram_chat.bot_token
            : String(input.telegram_chat.bot_token).trim(),
        chat_id:
          input.telegram_chat?.chat_id === undefined
            ? base.telegram_chat.chat_id
            : String(input.telegram_chat.chat_id).trim(),
        api_base: normalizeApiBase(
          input.telegram_chat?.api_base === undefined
            ? base.telegram_chat.api_base
            : input.telegram_chat.api_base,
        ),
        timeout_ms: normalizeTimeoutMs(
          input.telegram_chat?.timeout_ms === undefined
            ? base.telegram_chat.timeout_ms
            : input.telegram_chat.timeout_ms,
        ),
      },
      webhook: {
        url:
          input.webhook?.url === undefined
            ? base.webhook.url
            : String(input.webhook.url).trim(),
        bearer_token:
          input.webhook?.bearer_token === undefined
            ? base.webhook.bearer_token
            : String(input.webhook.bearer_token).trim(),
        timeout_ms: normalizeWebhookTimeoutMs(
          input.webhook?.timeout_ms === undefined
            ? base.webhook.timeout_ms
            : input.webhook.timeout_ms,
        ),
      },
    };
  }

  private async getStoredConfig(): Promise<{
    record: SystemSettingRecord;
    config: NotificationConfig;
  } | null> {
    if (!this.systemSettingRepository) {
      return null;
    }

    const record = await this.systemSettingRepository.getByKey(TELEGRAM_SETTING_KEY);
    if (!record) {
      return null;
    }

    return {
      record,
      config: normalizeConfig(record.value_json),
    };
  }

  private requireTelegramChatConfig(config: TelegramChatConfig): TelegramChatConfig {
    if (config.bot_token.trim() === '') {
      throw new TelegramSendError('Telegram Bot Token 未配置');
    }
    if (config.chat_id.trim() === '') {
      throw new TelegramSendError('Telegram Chat ID 未配置');
    }
    return config;
  }

  private requireWebhookConfig(config: WebhookNotificationConfig): WebhookNotificationConfig {
    if (config.url.trim() === '') {
      throw new TelegramSendError('Webhook URL 未配置');
    }
    if (config.bearer_token.trim() === '') {
      throw new TelegramSendError('Webhook Bearer Token 未配置');
    }
    return config;
  }

  private async sendTelegramMessage(
    config: TelegramChatConfig,
    text: string,
  ): Promise<void> {
    const response = await this.fetchImpl(`${config.api_base}/bot${config.bot_token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: config.chat_id,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(config.timeout_ms),
    });

    if (!response.ok) {
      const detail = await safeReadTelegramError(response);
      throw new TelegramSendError(detail.message, detail.status);
    }

    const data = (await response.json()) as TelegramSendMessageResponse;
    if (!data.ok) {
      throw new TelegramSendError(normalizeTelegramDescription(data.description || 'unknown error'));
    }
  }

  private async sendWebhookEvent(
    config: WebhookNotificationConfig,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const response = await this.fetchImpl(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.bearer_token}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(config.timeout_ms),
    });

    if (!response.ok) {
      const detail = await safeReadResponseText(response);
      throw new TelegramSendError(
        `Webhook 转发失败：HTTP ${response.status}${detail ? ` ${detail}` : ''}`,
        response.status >= 400 && response.status < 500 ? 400 : response.status,
      );
    }
  }
}

function buildApplicationMessage(input: NewAirportApplicationNotificationInput): string {
  const lines = [
    'GateRank 收到新的机场申请',
    `申请 ID: #${input.applicationId}`,
    `提交时间: ${formatDateTimeInTimezoneIso()}`,
    `名称: ${input.name}`,
    `官网: ${input.website}`,
    `备用网址: ${input.websites.slice(1).join(', ') || '无'}`,
    `月付价格: ${input.planPriceMonth}`,
    `提供试用: ${input.hasTrial ? '是' : '否'}`,
    `订阅链接: ${input.subscriptionUrl || '未填写'}`,
    `申请邮箱: ${input.applicantEmail}`,
    `申请 Telegram: ${input.applicantTelegram}`,
    `成立时间: ${input.foundedOn}`,
    `简介: ${summarize(input.airportIntro, 160)}`,
    `请求 ID: ${input.requestId}`,
  ];

  return lines.join('\n');
}

function buildWebhookApplicationPayload(
  input: NewAirportApplicationNotificationInput,
  apiBase: string,
): Record<string, unknown> {
  return {
    event: 'airport_application.created',
    occurred_at: formatDateTimeInTimezoneIso(),
    source: 'gaterank',
    application: {
      id: input.applicationId,
      name: input.name,
      website: input.website,
      websites: input.websites,
      plan_price_month: input.planPriceMonth,
      has_trial: input.hasTrial,
      subscription_url: input.subscriptionUrl || null,
      applicant_email: input.applicantEmail,
      applicant_telegram: input.applicantTelegram,
      founded_on: input.foundedOn,
      airport_intro: input.airportIntro,
    },
    links: {
      api_url: `${apiBase}/api/v1/admin/airport-applications/${input.applicationId}`,
    },
  };
}

function getEnvFallbackConfig(): NotificationConfig {
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || '').trim();

  return {
    enabled: botToken !== '' && chatId !== '',
    delivery_mode: 'telegram_chat',
    telegram_chat: {
      bot_token: botToken,
      chat_id: chatId,
      api_base: normalizeApiBase(process.env.TELEGRAM_API_BASE),
      timeout_ms: normalizeTimeoutMs(process.env.TELEGRAM_NOTIFY_TIMEOUT_MS),
    },
    webhook: {
      url: '',
      bearer_token: '',
      timeout_ms: DEFAULT_WEBHOOK_NOTIFY_TIMEOUT_MS,
    },
  };
}

function normalizeConfig(value: unknown): NotificationConfig {
  const record = toObject(value);
  if (!('delivery_mode' in record) && !('telegram_chat' in record) && !('webhook' in record)) {
    const legacyBotToken = stringOrEmpty(record.bot_token);
    const legacyChatId = stringOrEmpty(record.chat_id);
    return {
      enabled:
        record.enabled === undefined
          ? legacyBotToken !== '' && legacyChatId !== ''
          : boolOrDefault(record.enabled, false),
      delivery_mode: 'telegram_chat',
      telegram_chat: {
        bot_token: legacyBotToken,
        chat_id: legacyChatId,
        api_base: normalizeApiBase(record.api_base),
        timeout_ms: normalizeTimeoutMs(record.timeout_ms),
      },
      webhook: {
        url: '',
        bearer_token: '',
        timeout_ms: DEFAULT_WEBHOOK_NOTIFY_TIMEOUT_MS,
      },
    };
  }

  const telegramChat = toObject(record.telegram_chat);
  const webhook = toObject(record.webhook);
  return {
    enabled: boolOrDefault(record.enabled, false),
    delivery_mode: normalizeDeliveryMode(record.delivery_mode),
    telegram_chat: {
      bot_token: stringOrEmpty(telegramChat.bot_token),
      chat_id: stringOrEmpty(telegramChat.chat_id),
      api_base: normalizeApiBase(telegramChat.api_base),
      timeout_ms: normalizeTimeoutMs(telegramChat.timeout_ms),
    },
    webhook: {
      url: stringOrEmpty(webhook.url),
      bearer_token: stringOrEmpty(webhook.bearer_token),
      timeout_ms: normalizeWebhookTimeoutMs(webhook.timeout_ms),
    },
  };
}

function normalizeDeliveryMode(value: unknown): NotificationDeliveryMode {
  return value === 'webhook' ? 'webhook' : 'telegram_chat';
}

function normalizeApiBase(value: unknown): string {
  const raw = String(value || '').trim();
  return (raw || DEFAULT_TELEGRAM_API_BASE).replace(/\/+$/, '');
}

function normalizeTimeoutMs(value: unknown): number {
  const timeout = Number(value);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return DEFAULT_TELEGRAM_NOTIFY_TIMEOUT_MS;
  }
  return Math.round(timeout);
}

function normalizeWebhookTimeoutMs(value: unknown): number {
  const timeout = Number(value);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return DEFAULT_WEBHOOK_NOTIFY_TIMEOUT_MS;
  }
  return Math.round(timeout);
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function stringOrEmpty(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function boolOrDefault(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
      return false;
    }
  }
  return fallback;
}

function maskToken(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
}

function normalizeStoredUpdatedAt(value: unknown): string {
  if (value instanceof Date) {
    const rawAsUtc = [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-')
      + `T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}:${String(value.getSeconds()).padStart(2, '0')}Z`;
    return formatDateTimeInTimezoneIso(new Date(rawAsUtc));
  }
  const raw = String(value || '').trim();
  const sqlMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  if (sqlMatch) {
    return formatDateTimeInTimezoneIso(new Date(`${sqlMatch[1]}T${sqlMatch[2]}Z`));
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateTimeInTimezoneIso(parsed);
  }
  return raw;
}

function summarize(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, limit - 1))}…`;
}

async function safeReadResponseText(response: Response): Promise<string> {
  try {
    return (await response.text()).trim();
  } catch {
    return '';
  }
}

async function safeReadTelegramError(
  response: Response,
): Promise<{ message: string; status: number }> {
  try {
    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed) {
      const parsed = JSON.parse(trimmed) as TelegramSendMessageResponse;
      if (parsed?.description) {
        return {
          message: normalizeTelegramDescription(parsed.description),
          status: response.status === 403 ? 400 : response.status,
        };
      }
      return {
        message: `telegram sendMessage failed: HTTP ${response.status} ${trimmed}`,
        status: response.status >= 400 && response.status < 500 ? 400 : response.status,
      };
    }
  } catch {
    // fallback below
  }

  const detail = await safeReadResponseText(response);
  return {
    message: `telegram sendMessage failed: HTTP ${response.status}${detail ? ` ${detail}` : ''}`,
    status: response.status >= 400 && response.status < 500 ? 400 : response.status,
  };
}

function normalizeTelegramDescription(description: string): string {
  const normalized = description.trim();
  if (normalized.includes("bots can't send messages to bots")) {
    return 'Telegram 拒绝发送：当前 Chat ID 指向的是一个 bot。请填写你自己的用户或群组 chat id，而不是 bot 自己的 id。';
  }
  if (normalized.toLowerCase().includes('chat not found')) {
    return 'Telegram 拒绝发送：chat id 不存在，或 bot 还没有和该用户/群组建立会话。';
  }
  if (normalized.toLowerCase().includes('bot was blocked by the user')) {
    return 'Telegram 拒绝发送：目标用户已屏蔽该 bot。';
  }
  return `Telegram 拒绝发送：${normalized}`;
}
