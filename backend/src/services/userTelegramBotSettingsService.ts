import { randomBytes } from 'node:crypto';
import type { SystemSettingRecord } from '../repositories/systemSettingRepository';
import { HttpError } from '../middleware/errorHandler';

export interface UserTelegramBotSettingsInput {
  enabled?: boolean;
  bot_token?: string;
  api_base?: string;
  webhook_origin?: string;
  webhook_secret?: string;
}

export interface UserTelegramBotSettingsView {
  enabled: boolean;
  has_bot_token: boolean;
  bot_token_masked: string | null;
  bot_username: string | null;
  api_base: string;
  webhook_origin: string;
  has_webhook_secret: boolean;
  webhook_secret_masked: string | null;
  webhook_url: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export interface UserTelegramBotConfig {
  enabled: boolean;
  bot_token: string;
  bot_username: string | null;
  api_base: string;
  webhook_origin: string;
  webhook_secret: string;
}

interface UserTelegramBotSettingsServiceOptions {
  systemSettingRepository?: {
    getByKey(settingKey: string): Promise<SystemSettingRecord | null>;
    upsert(settingKey: string, value: unknown, updatedBy: string): Promise<void>;
  };
  fetchImpl?: typeof fetch;
}

interface TelegramGetMeResponse {
  ok?: boolean;
  result?: {
    id?: number;
    is_bot?: boolean;
    username?: string;
  };
  description?: string;
}

const USER_TELEGRAM_BOT_SETTING_KEY = 'user_telegram_bot';
export const DEFAULT_USER_TELEGRAM_API_BASE = 'https://api.telegram.org';
export const DEFAULT_USER_TELEGRAM_TIMEOUT_MS = 5000;

export class UserTelegramBotSettingsService {
  private readonly systemSettingRepository?: UserTelegramBotSettingsServiceOptions['systemSettingRepository'];
  private readonly fetchImpl: typeof fetch;

  constructor(options: UserTelegramBotSettingsServiceOptions = {}) {
    this.systemSettingRepository = options.systemSettingRepository;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async getAdminSettings(): Promise<UserTelegramBotSettingsView> {
    const stored = await this.getStoredConfig();
    return toAdminView(stored?.config || getDefaultConfig(), stored?.record || null);
  }

  async updateAdminSettings(
    input: UserTelegramBotSettingsInput,
    updatedBy: string,
  ): Promise<UserTelegramBotSettingsView> {
    if (!this.systemSettingRepository) {
      throw new Error('systemSettingRepository is not configured');
    }

    const nextConfig = await this.resolveConfig(input);
    if (nextConfig.enabled || nextConfig.bot_token) {
      const botIdentity = await this.fetchBotIdentity(nextConfig);
      nextConfig.bot_username = botIdentity.username;
    } else {
      nextConfig.bot_username = null;
    }

    await this.systemSettingRepository.upsert(USER_TELEGRAM_BOT_SETTING_KEY, nextConfig, updatedBy);
    return this.getAdminSettings();
  }

  async getConfig(): Promise<UserTelegramBotConfig> {
    const stored = await this.getStoredConfig();
    return stored?.config || getDefaultConfig();
  }

  async syncWebhook(): Promise<{ ok: true; webhook_url: string }> {
    const config = await this.requireRunnableConfig();
    const webhookUrl = buildWebhookUrl(config);
    if (!webhookUrl) {
      throw new HttpError(409, 'USER_TELEGRAM_WEBHOOK_NOT_CONFIGURED', '请先填写 Webhook Origin 和 Secret');
    }
    const response = await this.fetchImpl(`${config.api_base}/bot${config.bot_token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
      }),
      signal: AbortSignal.timeout(DEFAULT_USER_TELEGRAM_TIMEOUT_MS),
    });
    const raw = await safeReadJson(response);
    if (!response.ok || raw?.ok !== true) {
      throw new HttpError(
        response.ok ? 400 : 502,
        'USER_TELEGRAM_WEBHOOK_SYNC_FAILED',
        String(raw?.description || `Telegram setWebhook failed: HTTP ${response.status}`),
      );
    }
    return { ok: true, webhook_url: webhookUrl };
  }

  private async resolveConfig(input: UserTelegramBotSettingsInput): Promise<UserTelegramBotConfig> {
    const stored = await this.getStoredConfig();
    const base = stored?.config || getDefaultConfig();
    const webhookSecret = input.webhook_secret === undefined
      ? base.webhook_secret || randomBytes(18).toString('base64url')
      : String(input.webhook_secret || '').trim();

    return {
      enabled: input.enabled === undefined ? base.enabled : Boolean(input.enabled),
      bot_token: input.bot_token === undefined ? base.bot_token : String(input.bot_token || '').trim(),
      bot_username: base.bot_username,
      api_base: normalizeApiBase(input.api_base === undefined ? base.api_base : input.api_base),
      webhook_origin: normalizeOrigin(input.webhook_origin === undefined ? base.webhook_origin : input.webhook_origin),
      webhook_secret: webhookSecret || randomBytes(18).toString('base64url'),
    };
  }

  private async fetchBotIdentity(config: UserTelegramBotConfig): Promise<{ username: string }> {
    if (!config.bot_token) {
      throw new HttpError(400, 'USER_TELEGRAM_BOT_TOKEN_REQUIRED', '请先填写用户服务 Bot Token');
    }
    const response = await this.fetchImpl(`${config.api_base}/bot${config.bot_token}/getMe`, {
      method: 'POST',
      signal: AbortSignal.timeout(DEFAULT_USER_TELEGRAM_TIMEOUT_MS),
    });
    const raw = await safeReadJson(response) as TelegramGetMeResponse | null;
    if (!response.ok || raw?.ok !== true || !raw.result?.is_bot || !raw.result.username) {
      throw new HttpError(
        response.ok ? 400 : 502,
        'USER_TELEGRAM_BOT_VALIDATE_FAILED',
        String(raw?.description || `Telegram getMe failed: HTTP ${response.status}`),
      );
    }
    return { username: raw.result.username };
  }

  private async requireRunnableConfig(): Promise<UserTelegramBotConfig> {
    const config = await this.getConfig();
    if (!config.enabled) {
      throw new HttpError(409, 'USER_TELEGRAM_BOT_DISABLED', '用户服务 Bot 未启用');
    }
    if (!config.bot_token || !config.bot_username) {
      throw new HttpError(409, 'USER_TELEGRAM_BOT_NOT_CONFIGURED', '用户服务 Bot 尚未配置完成');
    }
    if (!config.webhook_origin || !config.webhook_secret) {
      throw new HttpError(409, 'USER_TELEGRAM_WEBHOOK_NOT_CONFIGURED', '请先填写 Webhook Origin 和 Secret');
    }
    return config;
  }

  private async getStoredConfig(): Promise<{
    record: SystemSettingRecord;
    config: UserTelegramBotConfig;
  } | null> {
    if (!this.systemSettingRepository) {
      return null;
    }
    const record = await this.systemSettingRepository.getByKey(USER_TELEGRAM_BOT_SETTING_KEY);
    if (!record) {
      return null;
    }
    return {
      record,
      config: normalizeConfig(record.value_json),
    };
  }
}

export function buildWebhookUrl(config: UserTelegramBotConfig): string | null {
  if (!config.webhook_origin || !config.webhook_secret) {
    return null;
  }
  return `${config.webhook_origin.replace(/\/+$/, '')}/api/v1/telegram/user-bot/webhook/${encodeURIComponent(config.webhook_secret)}`;
}

function toAdminView(config: UserTelegramBotConfig, record: SystemSettingRecord | null): UserTelegramBotSettingsView {
  return {
    enabled: config.enabled,
    has_bot_token: config.bot_token.trim() !== '',
    bot_token_masked: maskSecret(config.bot_token),
    bot_username: config.bot_username || null,
    api_base: config.api_base,
    webhook_origin: config.webhook_origin,
    has_webhook_secret: config.webhook_secret.trim() !== '',
    webhook_secret_masked: maskSecret(config.webhook_secret),
    webhook_url: buildWebhookUrl(config),
    updated_at: record?.updated_at || null,
    updated_by: record?.updated_by || null,
  };
}

function getDefaultConfig(): UserTelegramBotConfig {
  return {
    enabled: false,
    bot_token: '',
    bot_username: null,
    api_base: DEFAULT_USER_TELEGRAM_API_BASE,
    webhook_origin: '',
    webhook_secret: '',
  };
}

function normalizeConfig(value: unknown): UserTelegramBotConfig {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    enabled: Boolean(record.enabled),
    bot_token: stringOrEmpty(record.bot_token),
    bot_username: stringOrNull(record.bot_username),
    api_base: normalizeApiBase(record.api_base),
    webhook_origin: normalizeOrigin(record.webhook_origin),
    webhook_secret: stringOrEmpty(record.webhook_secret),
  };
}

function normalizeApiBase(value: unknown): string {
  const text = String(value || DEFAULT_USER_TELEGRAM_API_BASE).trim().replace(/\/+$/, '');
  return text || DEFAULT_USER_TELEGRAM_API_BASE;
}

function normalizeOrigin(value: unknown): string {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (!text) {
    return '';
  }
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    return url.origin;
  } catch {
    return '';
  }
}

function maskSecret(value: string): string | null {
  if (!value) {
    return null;
  }
  if (value.length <= 8) {
    return '****';
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function stringOrEmpty(value: unknown): string {
  return value === undefined || value === null ? '' : String(value).trim();
}

function stringOrNull(value: unknown): string | null {
  const text = stringOrEmpty(value);
  return text || null;
}

async function safeReadJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
