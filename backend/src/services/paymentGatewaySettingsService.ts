import type { SystemSettingRecord } from '../repositories/systemSettingRepository';
import { HttpError } from '../middleware/errorHandler';
import { canParseRsaPrivateKey, canParseRsaPublicKey } from '../utils/rsaSignature';
import { formatDateTimeInTimezoneIso } from '../utils/time';

export interface PaymentGatewaySettingsInput {
  enabled?: boolean;
  epay?: PaymentGatewayEpaySettingsInput;
  pid?: string;
  private_key?: string;
  platform_public_key?: string;
  notify_origin?: string;
  usdt?: PaymentGatewayUsdtSettingsInput;
}

export interface PaymentGatewayEpaySettingsInput {
  enabled?: boolean;
}

export interface PaymentGatewayUsdtSettingsInput {
  enabled?: boolean;
  gateway_url?: string;
  merchant_id?: string;
  secret_key?: string;
}

export interface PaymentGatewaySettingsView {
  enabled: boolean;
  pid: string;
  has_private_key: boolean;
  private_key_masked: string | null;
  platform_public_key: string;
  notify_origin: string;
  notify_urls: {
    application_payment: string;
    recharge: string;
  } | null;
  epay: PaymentGatewayEpaySettingsView;
  usdt: PaymentGatewayUsdtSettingsView;
  updated_at: string | null;
  updated_by: string | null;
}

export interface PaymentGatewayConfig {
  enabled: boolean;
  pid: string;
  private_key: string;
  platform_public_key: string;
  notify_origin: string;
  epay: PaymentGatewayEpayConfig;
  usdt: PaymentGatewayUsdtConfig;
}

export interface PaymentGatewayEpaySettingsView {
  enabled: boolean;
}

export interface PaymentGatewayEpayConfig {
  enabled: boolean;
}

export interface PaymentGatewayUsdtSettingsView {
  enabled: boolean;
  gateway_url: string;
  merchant_id: string;
  has_secret_key: boolean;
  secret_key_masked: string | null;
}

export interface PaymentGatewayUsdtConfig {
  enabled: boolean;
  gateway_url: string;
  merchant_id: string;
  secret_key: string;
}

interface PaymentGatewaySettingsServiceOptions {
  systemSettingRepository?: {
    getByKey(settingKey: string): Promise<SystemSettingRecord | null>;
    upsert(settingKey: string, value: unknown, updatedBy: string): Promise<void>;
  };
}

const PAYMENT_GATEWAY_SETTING_KEY = 'payment_gateway';

export class PaymentGatewaySettingsService {
  private readonly systemSettingRepository?: PaymentGatewaySettingsServiceOptions['systemSettingRepository'];

  constructor(options: PaymentGatewaySettingsServiceOptions = {}) {
    this.systemSettingRepository = options.systemSettingRepository;
  }

  async getAdminSettings(): Promise<PaymentGatewaySettingsView> {
    const stored = await this.getStoredConfig();
    const effective = stored?.config || getDefaultConfig();

    return {
      enabled: effective.enabled,
      pid: effective.pid,
      has_private_key: effective.private_key.trim() !== '',
      private_key_masked: maskPrivateKey(effective.private_key),
      platform_public_key: effective.platform_public_key,
      notify_origin: effective.notify_origin,
      notify_urls: buildNotifyUrls(effective.notify_origin),
      epay: {
        enabled: effective.epay.enabled,
      },
      usdt: {
        enabled: effective.usdt.enabled,
        gateway_url: effective.usdt.gateway_url,
        merchant_id: effective.usdt.merchant_id,
        has_secret_key: effective.usdt.secret_key.trim() !== '',
        secret_key_masked: maskSecret(effective.usdt.secret_key),
      },
      updated_at: stored?.record.updated_at ? normalizeStoredUpdatedAt(stored.record.updated_at) : null,
      updated_by: stored?.record.updated_by || null,
    };
  }

  async updateAdminSettings(
    input: PaymentGatewaySettingsInput,
    updatedBy: string,
  ): Promise<PaymentGatewaySettingsView> {
    if (!this.systemSettingRepository) {
      throw new Error('systemSettingRepository is not configured');
    }

    const stored = await this.getStoredConfig();
    const nextConfig = await this.resolveConfig(input);
    validatePaymentGatewayConfig(nextConfig, input);
    await this.systemSettingRepository.upsert(
      PAYMENT_GATEWAY_SETTING_KEY,
      preserveLegacyApplicationFee(nextConfig, stored?.record.value_json),
      updatedBy,
    );
    return this.getAdminSettings();
  }

  async getConfig(): Promise<PaymentGatewayConfig> {
    const stored = await this.getStoredConfig();
    return stored?.config || getDefaultConfig();
  }

  private async resolveConfig(input: PaymentGatewaySettingsInput = {}): Promise<PaymentGatewayConfig> {
    const stored = await this.getStoredConfig();
    const base = stored?.config || getDefaultConfig();

    return {
      enabled: input.enabled === undefined ? base.enabled : Boolean(input.enabled),
      pid: input.pid === undefined ? base.pid : String(input.pid || '').trim(),
      private_key:
        input.private_key === undefined ? base.private_key : String(input.private_key || '').trim(),
      platform_public_key:
        input.platform_public_key === undefined
          ? base.platform_public_key
          : String(input.platform_public_key || '').trim(),
      notify_origin:
        input.notify_origin === undefined
          ? base.notify_origin
          : normalizeOriginUrl(String(input.notify_origin || '').trim()),
      epay: resolveEpayConfig(base.epay, input.epay),
      usdt: resolveUsdtConfig(base.usdt, input.usdt),
    };
  }

  private async getStoredConfig(): Promise<{
    record: SystemSettingRecord;
    config: PaymentGatewayConfig;
  } | null> {
    if (!this.systemSettingRepository) {
      return null;
    }

    const record = await this.systemSettingRepository.getByKey(PAYMENT_GATEWAY_SETTING_KEY);
    if (!record) {
      return null;
    }

    return {
      record,
      config: normalizeConfig(record.value_json),
    };
  }
}

function getDefaultConfig(): PaymentGatewayConfig {
  return {
    enabled: false,
    pid: '',
    private_key: '',
    platform_public_key: '',
    notify_origin: '',
    epay: getDefaultEpayConfig(),
    usdt: getDefaultUsdtConfig(),
  };
}

function getDefaultEpayConfig(): PaymentGatewayEpayConfig {
  return {
    enabled: false,
  };
}

function getDefaultUsdtConfig(): PaymentGatewayUsdtConfig {
  return {
    enabled: false,
    gateway_url: '',
    merchant_id: '',
    secret_key: '',
  };
}

function normalizeConfig(value: unknown): PaymentGatewayConfig {
  const record = toObject(value);
  const enabled = Boolean(record.enabled);
  const pid = stringOrEmpty(record.pid);
  const privateKey = stringOrEmpty(record.private_key);
  const platformPublicKey = stringOrEmpty(record.platform_public_key);
  return {
    enabled,
    pid,
    private_key: privateKey,
    platform_public_key: platformPublicKey,
    notify_origin: normalizeOriginUrl(stringOrEmpty(record.notify_origin)),
    epay: normalizeEpayConfig(record.epay, { enabled, pid, privateKey, platformPublicKey }),
    usdt: normalizeUsdtConfig(record.usdt),
  };
}

function normalizeEpayConfig(
  value: unknown,
  legacy: { enabled: boolean; pid: string; privateKey: string; platformPublicKey: string },
): PaymentGatewayEpayConfig {
  if (value === undefined) {
    return {
      enabled: Boolean(
        legacy.enabled &&
        legacy.pid &&
        legacy.privateKey &&
        legacy.platformPublicKey
      ),
    };
  }
  const record = toObject(value);
  return {
    enabled: Boolean(record.enabled),
  };
}

function normalizeUsdtConfig(value: unknown): PaymentGatewayUsdtConfig {
  const record = toObject(value);
  return {
    enabled: Boolean(record.enabled),
    gateway_url: normalizeGatewayUrl(stringOrEmpty(record.gateway_url)),
    merchant_id: stringOrEmpty(record.merchant_id),
    secret_key: stringOrEmpty(record.secret_key),
  };
}

function resolveEpayConfig(
  base: PaymentGatewayEpayConfig,
  input: PaymentGatewayEpaySettingsInput | undefined,
): PaymentGatewayEpayConfig {
  if (input === undefined) {
    return base;
  }
  return {
    enabled: input.enabled === undefined ? base.enabled : Boolean(input.enabled),
  };
}

function resolveUsdtConfig(
  base: PaymentGatewayUsdtConfig,
  input: PaymentGatewayUsdtSettingsInput | undefined,
): PaymentGatewayUsdtConfig {
  if (input === undefined) {
    return base;
  }
  return {
    enabled: input.enabled === undefined ? base.enabled : Boolean(input.enabled),
    gateway_url:
      input.gateway_url === undefined
        ? base.gateway_url
        : normalizeGatewayUrl(String(input.gateway_url || '').trim()),
    merchant_id:
      input.merchant_id === undefined ? base.merchant_id : String(input.merchant_id || '').trim(),
    secret_key:
      input.secret_key === undefined ? base.secret_key : String(input.secret_key || '').trim(),
  };
}

function preserveLegacyApplicationFee(
  config: PaymentGatewayConfig,
  storedValue: unknown,
): PaymentGatewayConfig & { application_fee_amount?: unknown } {
  const stored = toObject(storedValue);
  if (stored.application_fee_amount === undefined) {
    return config;
  }
  return {
    ...config,
    application_fee_amount: stored.application_fee_amount,
  };
}

function toObject(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringOrEmpty(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function maskPrivateKey(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > 32
    ? `${trimmed.slice(0, 16)}***${trimmed.slice(-16)}`
    : `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
}

function maskSecret(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > 16
    ? `${trimmed.slice(0, 6)}***${trimmed.slice(-6)}`
    : `${trimmed.slice(0, 3)}***${trimmed.slice(-3)}`;
}

function normalizeGatewayUrl(value: string): string {
  return value
    .replace(/\/+$/, '')
    .replace(/\/payments\/(?:epay|gmpay)\/v\d+\/order\/create-transaction$/i, '')
    .replace(/\/submit\.php$/i, '');
}

function normalizeOriginUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function buildNotifyUrls(origin: string): PaymentGatewaySettingsView['notify_urls'] {
  if (!origin) {
    return null;
  }
  return {
    application_payment: `${origin}/api/v1/portal/payment-notify`,
    recharge: `${origin}/api/v1/portal/recharge-notify`,
  };
}

function normalizeStoredUpdatedAt(value: unknown): string {
  if (value instanceof Date) {
    return formatDateTimeInTimezoneIso(value);
  }
  const raw = String(value || '').trim();
  const sqlMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  if (sqlMatch) {
    return formatDateTimeInTimezoneIso(new Date(`${sqlMatch[1]}T${sqlMatch[2]}Z`));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : formatDateTimeInTimezoneIso(parsed);
}

function validatePaymentGatewayConfig(
  config: PaymentGatewayConfig,
  input: PaymentGatewaySettingsInput,
): void {
  validateNotifyOrigin(config.notify_origin, input.notify_origin);
  validateUsdtConfig(config.usdt, input.usdt);

  const shouldRequireRsaConfig = config.enabled && config.epay.enabled;

  if (shouldRequireRsaConfig && !config.pid) {
    throw new HttpError(400, 'PAYMENT_GATEWAY_PID_REQUIRED', '启用支付前必须填写商户号 PID');
  }

  const shouldValidatePrivateKey = input.private_key !== undefined || shouldRequireRsaConfig;
  const shouldValidatePlatformPublicKey =
    input.platform_public_key !== undefined || shouldRequireRsaConfig;

  if (shouldValidatePrivateKey) {
    if (!config.private_key) {
      throw new HttpError(
        400,
        'PAYMENT_GATEWAY_PRIVATE_KEY_REQUIRED',
        '启用支付前必须填写商户私钥',
      );
    }
    validateMerchantPrivateKey(config.private_key);
  }

  if (shouldValidatePlatformPublicKey) {
    if (!config.platform_public_key) {
      throw new HttpError(
        400,
        'PAYMENT_GATEWAY_PLATFORM_PUBLIC_KEY_REQUIRED',
        '启用支付前必须填写平台公钥',
      );
    }
    validatePlatformPublicKey(config.platform_public_key);
  }
}

function validateNotifyOrigin(value: string, inputValue: string | undefined): void {
  if (inputValue === undefined && !value) {
    return;
  }
  if (!value) {
    return;
  }
  if (!/^https?:\/\//i.test(value)) {
    throw new HttpError(400, 'PAYMENT_GATEWAY_NOTIFY_ORIGIN_INVALID', '回调地址必须包含 http 或 https');
  }
  try {
    const parsed = new URL(value);
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
      throw new Error('origin only');
    }
  } catch {
    throw new HttpError(400, 'PAYMENT_GATEWAY_NOTIFY_ORIGIN_INVALID', '回调地址必须是完整 origin，例如 https://gate-rank.com');
  }
}

function validateUsdtConfig(
  config: PaymentGatewayUsdtConfig,
  input: PaymentGatewayUsdtSettingsInput | undefined,
): void {
  if (!input && !config.enabled) {
    return;
  }

  if (config.enabled && !config.gateway_url) {
    throw new HttpError(400, 'PAYMENT_GATEWAY_USDT_URL_REQUIRED', '启用 USDT 支付前必须填写支付网关地址');
  }
  if (config.gateway_url && !/^https?:\/\//i.test(config.gateway_url)) {
    throw new HttpError(400, 'PAYMENT_GATEWAY_USDT_URL_INVALID', 'USDT 支付网关地址必须包含 http 或 https');
  }
  if (config.enabled && !config.merchant_id) {
    throw new HttpError(400, 'PAYMENT_GATEWAY_USDT_MERCHANT_REQUIRED', '启用 USDT 支付前必须填写商户ID');
  }
  if (config.enabled && !config.secret_key) {
    throw new HttpError(400, 'PAYMENT_GATEWAY_USDT_SECRET_REQUIRED', '启用 USDT 支付前必须填写通信密钥');
  }
}

function validateMerchantPrivateKey(value: string): void {
  if (canParseRsaPrivateKey(value)) {
    return;
  }

  if (canParseRsaPublicKey(value)) {
    throw new HttpError(
      400,
      'PAYMENT_GATEWAY_INVALID_PRIVATE_KEY',
      '商户私钥格式无效：当前内容看起来是公钥，请粘贴平台生成的商户私钥，不要填写商户公钥或平台公钥',
    );
  }

  throw new HttpError(
    400,
    'PAYMENT_GATEWAY_INVALID_PRIVATE_KEY',
    '商户私钥格式无效：请粘贴平台生成的商户私钥，支持平台原始密钥串或 PEM',
  );
}

function validatePlatformPublicKey(value: string): void {
  if (canParseRsaPrivateKey(value)) {
    throw new HttpError(
      400,
      'PAYMENT_GATEWAY_INVALID_PLATFORM_PUBLIC_KEY',
      '平台公钥格式无效：当前内容看起来是私钥，请填写平台后台显示的平台公钥',
    );
  }

  if (canParseRsaPublicKey(value)) {
    return;
  }

  throw new HttpError(
    400,
    'PAYMENT_GATEWAY_INVALID_PLATFORM_PUBLIC_KEY',
    '平台公钥格式无效：请粘贴平台后台显示的平台公钥，支持平台原始密钥串或 PEM',
  );
}
