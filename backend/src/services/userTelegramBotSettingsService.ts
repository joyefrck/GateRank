import { randomBytes } from 'node:crypto';
import type { SystemSettingRecord } from '../repositories/systemSettingRepository';
import { HttpError } from '../middleware/errorHandler';
import { loadBackendEnv } from '../utils/backendEnv';

export interface UserTelegramBotSettingsInput {
  enabled?: boolean;
  bot_token?: string;
  api_base?: string;
  webhook_origin?: string;
  webhook_secret?: string;
  request_origin?: string;
  templates?: Partial<Record<UserTelegramBotTemplateKey, Partial<UserTelegramBotTemplateConfigItem>>>;
}

export type UserTelegramBotTemplateKey =
  | 'low_balance_warning'
  | 'airport_auto_unlisted'
  | 'airport_online'
  | 'recharge_welcome';

export interface UserTelegramBotTemplateConfigItem {
  enabled: boolean;
  body: string;
}

export interface UserTelegramBotTemplateConfig {
  low_balance_warning: UserTelegramBotTemplateConfigItem;
  airport_auto_unlisted: UserTelegramBotTemplateConfigItem;
  airport_online: UserTelegramBotTemplateConfigItem;
  recharge_welcome: UserTelegramBotTemplateConfigItem;
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
  webhook_ready: boolean;
  webhook_origin_source: string | null;
  webhook_last_synced_at: string | null;
  webhook_last_error: string | null;
  templates: UserTelegramBotTemplateConfig;
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
  webhook_origin_source?: string | null;
  webhook_last_synced_at?: string | null;
  webhook_last_error?: string | null;
  templates: UserTelegramBotTemplateConfig;
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
const PAYMENT_GATEWAY_SETTING_KEY = 'payment_gateway';
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

    if (nextConfig.enabled) {
      const webhookOrigin = await this.resolveWebhookOrigin(nextConfig.webhook_origin, input.request_origin);
      nextConfig.webhook_origin = webhookOrigin.origin;
      nextConfig.webhook_origin_source = webhookOrigin.source;
      const webhookUrl = buildWebhookUrl(nextConfig);
      if (!webhookUrl) {
        throw new HttpError(409, 'USER_TELEGRAM_WEBHOOK_NOT_CONFIGURED', '请填写公网 HTTPS API 域名，例如 https://www.gaterank.cn');
      }
      try {
        await this.setWebhook(nextConfig, webhookUrl);
        await this.setBotCommands(nextConfig);
      } catch (error) {
        await this.recordWebhookError(nextConfig, error, updatedBy);
        throw error;
      }
      nextConfig.webhook_last_synced_at = new Date().toISOString();
      nextConfig.webhook_last_error = null;
    } else {
      nextConfig.webhook_last_error = null;
      if (nextConfig.webhook_origin) {
        nextConfig.webhook_origin_source = nextConfig.webhook_origin_source || 'manual';
      }
    }

    await this.systemSettingRepository.upsert(USER_TELEGRAM_BOT_SETTING_KEY, nextConfig, updatedBy);
    return this.getAdminSettings();
  }

  async getConfig(): Promise<UserTelegramBotConfig> {
    const stored = await this.getStoredConfig();
    return stored?.config || getDefaultConfig();
  }

  async syncWebhook(updatedBy = 'system'): Promise<{ ok: true; webhook_url: string }> {
    const config = await this.requireRunnableConfig();
    const webhookUrl = buildWebhookUrl(config);
    if (!webhookUrl) {
      throw new HttpError(409, 'USER_TELEGRAM_WEBHOOK_NOT_CONFIGURED', '请先填写 Webhook Origin 和 Secret');
    }
    try {
      await this.setWebhook(config, webhookUrl);
      await this.setBotCommands(config);
      await this.systemSettingRepository?.upsert(USER_TELEGRAM_BOT_SETTING_KEY, {
        ...config,
        webhook_last_synced_at: new Date().toISOString(),
        webhook_last_error: null,
      }, updatedBy);
      return { ok: true, webhook_url: webhookUrl };
    } catch (error) {
      await this.recordWebhookError(config, error, updatedBy);
      throw error;
    }
  }

  private async setWebhook(config: UserTelegramBotConfig, webhookUrl: string): Promise<void> {
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
        400,
        'USER_TELEGRAM_WEBHOOK_SYNC_FAILED',
        String(raw?.description || `Telegram setWebhook failed: HTTP ${response.status}`),
      );
    }
  }

  private async setBotCommands(config: UserTelegramBotConfig): Promise<void> {
    const response = await this.fetchImpl(`${config.api_base}/bot${config.bot_token}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: getUserTelegramBotCommands(),
      }),
      signal: AbortSignal.timeout(DEFAULT_USER_TELEGRAM_TIMEOUT_MS),
    });
    const raw = await safeReadJson(response);
    if (!response.ok || raw?.ok !== true) {
      throw new HttpError(
        400,
        'USER_TELEGRAM_COMMANDS_SYNC_FAILED',
        String(raw?.description || `Telegram setMyCommands failed: HTTP ${response.status}`),
      );
    }
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
      webhook_origin_source: base.webhook_origin_source || null,
      webhook_last_synced_at: base.webhook_last_synced_at || null,
      webhook_last_error: base.webhook_last_error || null,
      templates: normalizeTemplates(input.templates, base.templates),
    };
  }

  private async resolveWebhookOrigin(
    configuredOrigin: string,
    requestOrigin: string | undefined,
  ): Promise<{ origin: string; source: string }> {
    const env = loadBackendEnv();
    const candidates: Array<{ value: string; source: string; required?: boolean }> = [
      { value: configuredOrigin, source: 'manual', required: configuredOrigin.trim() !== '' },
      { value: await this.getPaymentNotifyOrigin(), source: 'payment_gateway' },
      { value: process.env.PAYMENT_NOTIFY_ORIGIN || env.PAYMENT_NOTIFY_ORIGIN || '', source: 'PAYMENT_NOTIFY_ORIGIN' },
      { value: process.env.API_BASE || env.API_BASE || '', source: 'API_BASE' },
      { value: process.env.VITE_SITE_URL || env.VITE_SITE_URL || '', source: 'VITE_SITE_URL' },
      { value: requestOrigin || '', source: 'request_origin' },
    ];

    for (const candidate of candidates) {
      const normalized = normalizeOrigin(candidate.value);
      if (!normalized) {
        if (candidate.required) {
          throw new HttpError(400, 'USER_TELEGRAM_WEBHOOK_ORIGIN_INVALID', 'Webhook Origin 必须是公网 HTTPS API 域名，例如 https://www.gaterank.cn');
        }
        continue;
      }
      if (isPublicHttpsOrigin(normalized)) {
        return { origin: normalized, source: candidate.source };
      }
      if (candidate.required) {
        throw new HttpError(400, 'USER_TELEGRAM_WEBHOOK_ORIGIN_INVALID', 'Webhook Origin 必须是公网 HTTPS API 域名，例如 https://www.gaterank.cn');
      }
    }

    throw new HttpError(409, 'USER_TELEGRAM_WEBHOOK_ORIGIN_REQUIRED', '请填写公网 HTTPS API 域名，例如 https://www.gaterank.cn');
  }

  private async getPaymentNotifyOrigin(): Promise<string> {
    if (!this.systemSettingRepository) {
      return '';
    }
    const record = await this.systemSettingRepository.getByKey(PAYMENT_GATEWAY_SETTING_KEY);
    const value = record?.value_json;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return '';
    }
    return stringOrEmpty((value as Record<string, unknown>).notify_origin);
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
        400,
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
    if (!isPublicHttpsOrigin(config.webhook_origin)) {
      throw new HttpError(409, 'USER_TELEGRAM_WEBHOOK_ORIGIN_INVALID', 'Webhook Origin 必须是公网 HTTPS API 域名，例如 https://www.gaterank.cn');
    }
    return config;
  }

  private async recordWebhookError(
    config: UserTelegramBotConfig,
    error: unknown,
    updatedBy: string,
  ): Promise<void> {
    if (!this.systemSettingRepository) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error || 'Webhook 同步失败');
    await this.systemSettingRepository.upsert(USER_TELEGRAM_BOT_SETTING_KEY, {
      ...config,
      webhook_last_error: message,
    }, updatedBy);
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
    webhook_ready: isUserTelegramBotConfigReady(config),
    webhook_origin_source: config.webhook_origin_source || null,
    webhook_last_synced_at: config.webhook_last_synced_at || null,
    webhook_last_error: config.webhook_last_error || null,
    templates: config.templates,
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
    webhook_origin_source: null,
    webhook_last_synced_at: null,
    webhook_last_error: null,
    templates: getDefaultTemplates(),
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
    webhook_origin_source: stringOrNull(record.webhook_origin_source),
    webhook_last_synced_at: stringOrNull(record.webhook_last_synced_at),
    webhook_last_error: stringOrNull(record.webhook_last_error),
    templates: normalizeTemplates(record.templates),
  };
}

function getDefaultTemplates(): UserTelegramBotTemplateConfig {
  return {
    low_balance_warning: {
      enabled: true,
      body: [
        '余额提醒：{{airport_name}} 当前账户余额为 ¥{{current_balance}}，已低于 {{threshold_amount}} 元。',
        '',
        '为避免影响 GateRank 展示和跳转服务，建议及时充值。',
      ].join('\n'),
    },
    airport_auto_unlisted: {
      enabled: true,
      body: [
        '下线提醒：{{airport_name}} 因账户余额不足，已暂时从 GateRank 下线。',
        '',
        '当前余额：¥{{current_balance}}。充值后余额足够时，系统会自动恢复上线。',
      ].join('\n'),
    },
    airport_online: {
      enabled: true,
      body: [
        '上线通知：{{airport_name}} 已恢复上线。',
        '',
        '当前余额：¥{{current_balance}}，可以继续在 GateRank 正常展示并接收跳转访问。',
      ].join('\n'),
    },
    recharge_welcome: {
      enabled: true,
      body: [
        '充值成功，欢迎继续使用 GateRank 👏',
        '',
        '机场：{{airport_name}}',
        '本次充值：¥{{recharge_amount}}',
        '当前余额：¥{{current_balance}}',
      ].join('\n'),
    },
  };
}

function normalizeTemplates(
  value: unknown,
  fallback: UserTelegramBotTemplateConfig = getDefaultTemplates(),
): UserTelegramBotTemplateConfig {
  const record = toObject(value);
  const defaults = getDefaultTemplates();
  return {
    low_balance_warning: normalizeTemplateItem(
      record.low_balance_warning,
      fallback.low_balance_warning || defaults.low_balance_warning,
    ),
    airport_auto_unlisted: normalizeTemplateItem(
      record.airport_auto_unlisted,
      fallback.airport_auto_unlisted || defaults.airport_auto_unlisted,
    ),
    airport_online: normalizeTemplateItem(
      record.airport_online,
      fallback.airport_online || defaults.airport_online,
    ),
    recharge_welcome: normalizeTemplateItem(
      record.recharge_welcome,
      fallback.recharge_welcome || defaults.recharge_welcome,
    ),
  };
}

function normalizeTemplateItem(
  value: unknown,
  fallback: UserTelegramBotTemplateConfigItem,
): UserTelegramBotTemplateConfigItem {
  const record = toObject(value);
  return {
    enabled: boolOrDefault(record.enabled, fallback.enabled),
    body: stringOrEmpty(record.body) || fallback.body,
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

function isPublicHttpsOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      return false;
    }
    return !isLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return true;
  }
  if (host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
    return true;
  }
  if (/^10\./.test(host) || /^192\.168\./.test(host)) {
    return true;
  }
  const private172 = host.match(/^172\.(\d{1,2})\./);
  return Boolean(private172 && Number(private172[1]) >= 16 && Number(private172[1]) <= 31);
}

export function isUserTelegramBotConfigReady(config: UserTelegramBotConfig): boolean {
  return Boolean(
    config.enabled &&
    config.bot_token.trim() &&
    config.bot_username &&
    config.webhook_origin &&
    config.webhook_secret &&
    config.webhook_last_synced_at &&
    !config.webhook_last_error,
  );
}

export function getUserTelegramBotCommands(): Array<{ command: string; description: string }> {
  return [
    { command: 'start', description: '查看绑定状态' },
    { command: 'balance', description: '账户余额/单价/上架状态' },
    { command: 'transactions', description: '查看最近 5 条扣费流水' },
    { command: 'clicks', description: '查看最近 5 条访问记录' },
    { command: 'today', description: '查看今日访问量' },
    { command: 'recharge', description: '创建充值支付链接' },
    { command: 'unbind', description: '解绑 Telegram 账号' },
  ];
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

function toObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boolOrDefault(value: unknown, fallback: boolean): boolean {
  return value === undefined ? fallback : Boolean(value);
}

async function safeReadJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
