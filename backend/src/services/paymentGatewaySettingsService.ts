import type { SystemSettingRecord } from '../repositories/systemSettingRepository';
import { formatDateTimeInTimezoneIso } from '../utils/time';

export interface PaymentGatewaySettingsInput {
  enabled?: boolean;
  pid?: string;
  private_key?: string;
  platform_public_key?: string;
  application_fee_amount?: number;
}

export interface PaymentGatewaySettingsView {
  enabled: boolean;
  pid: string;
  has_private_key: boolean;
  private_key_masked: string | null;
  platform_public_key: string;
  application_fee_amount: number;
  updated_at: string | null;
  updated_by: string | null;
}

export interface PaymentGatewayConfig {
  enabled: boolean;
  pid: string;
  private_key: string;
  platform_public_key: string;
  application_fee_amount: number;
}

interface PaymentGatewaySettingsServiceOptions {
  systemSettingRepository?: {
    getByKey(settingKey: string): Promise<SystemSettingRecord | null>;
    upsert(settingKey: string, value: unknown, updatedBy: string): Promise<void>;
  };
}

const PAYMENT_GATEWAY_SETTING_KEY = 'payment_gateway';
export const DEFAULT_APPLICATION_FEE_AMOUNT = 1000;

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
      application_fee_amount: effective.application_fee_amount,
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

    const nextConfig = await this.resolveConfig(input);
    await this.systemSettingRepository.upsert(PAYMENT_GATEWAY_SETTING_KEY, nextConfig, updatedBy);
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
      application_fee_amount:
        input.application_fee_amount === undefined
          ? base.application_fee_amount
          : normalizeAmount(input.application_fee_amount),
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
    application_fee_amount: DEFAULT_APPLICATION_FEE_AMOUNT,
  };
}

function normalizeConfig(value: unknown): PaymentGatewayConfig {
  const record = toObject(value);
  return {
    enabled: Boolean(record.enabled),
    pid: stringOrEmpty(record.pid),
    private_key: stringOrEmpty(record.private_key),
    platform_public_key: stringOrEmpty(record.platform_public_key),
    application_fee_amount: normalizeAmount(record.application_fee_amount),
  };
}

function normalizeAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return DEFAULT_APPLICATION_FEE_AMOUNT;
  }
  return Number(amount.toFixed(2));
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
