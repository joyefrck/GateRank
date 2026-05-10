import { APPLICATION_FEE_AMOUNT, CLICK_CHARGE_AMOUNT } from '../config/billing';
import { HttpError } from '../middleware/errorHandler';
import type { SystemSettingRecord } from '../repositories/systemSettingRepository';
import { formatDateTimeInTimezoneIso } from '../utils/time';

export interface MarketingSettingsInput {
  application_fee_amount?: number;
  click_charge_amount?: number;
}

export interface MarketingSettingsView {
  application_fee_amount: number;
  click_charge_amount: number;
  updated_at: string | null;
  updated_by: string | null;
}

export interface MarketingBillingConfig {
  application_fee_amount: number;
  click_charge_amount: number;
}

interface MarketingSettingsServiceOptions {
  systemSettingRepository?: {
    getByKey(settingKey: string): Promise<SystemSettingRecord | null>;
    upsert(settingKey: string, value: unknown, updatedBy: string): Promise<void>;
  };
}

const MARKETING_BILLING_SETTING_KEY = 'marketing_billing';
const PAYMENT_GATEWAY_SETTING_KEY = 'payment_gateway';

export const DEFAULT_MARKETING_APPLICATION_FEE_AMOUNT = APPLICATION_FEE_AMOUNT;
export const DEFAULT_MARKETING_CLICK_CHARGE_AMOUNT = CLICK_CHARGE_AMOUNT;

export class MarketingSettingsService {
  private readonly systemSettingRepository?: MarketingSettingsServiceOptions['systemSettingRepository'];

  constructor(options: MarketingSettingsServiceOptions = {}) {
    this.systemSettingRepository = options.systemSettingRepository;
  }

  async getAdminSettings(): Promise<MarketingSettingsView> {
    const stored = await this.getStoredConfig();
    const config = stored?.config || await this.getDefaultConfig();

    return {
      ...config,
      updated_at: stored?.record.updated_at ? normalizeStoredUpdatedAt(stored.record.updated_at) : null,
      updated_by: stored?.record.updated_by || null,
    };
  }

  async updateAdminSettings(input: MarketingSettingsInput, updatedBy: string): Promise<MarketingSettingsView> {
    if (!this.systemSettingRepository) {
      throw new Error('systemSettingRepository is not configured');
    }

    const base = await this.getConfig();
    const nextConfig = {
      application_fee_amount:
        input.application_fee_amount === undefined
          ? base.application_fee_amount
          : normalizePositiveAmount(input.application_fee_amount, 'application_fee_amount'),
      click_charge_amount:
        input.click_charge_amount === undefined
          ? base.click_charge_amount
          : normalizePositiveAmount(input.click_charge_amount, 'click_charge_amount'),
    };

    await this.systemSettingRepository.upsert(MARKETING_BILLING_SETTING_KEY, nextConfig, updatedBy);
    return this.getAdminSettings();
  }

  async getConfig(): Promise<MarketingBillingConfig> {
    const stored = await this.getStoredConfig();
    return stored?.config || await this.getDefaultConfig();
  }

  private async getStoredConfig(): Promise<{
    record: SystemSettingRecord;
    config: MarketingBillingConfig;
  } | null> {
    if (!this.systemSettingRepository) {
      return null;
    }

    const record = await this.systemSettingRepository.getByKey(MARKETING_BILLING_SETTING_KEY);
    if (!record) {
      return null;
    }

    return {
      record,
      config: normalizeConfig(record.value_json, getBaseDefaults()),
    };
  }

  private async getDefaultConfig(): Promise<MarketingBillingConfig> {
    if (!this.systemSettingRepository) {
      return getBaseDefaults();
    }

    const legacy = await this.systemSettingRepository.getByKey(PAYMENT_GATEWAY_SETTING_KEY);
    const legacyRecord = toObject(legacy?.value_json);
    return {
      ...getBaseDefaults(),
      application_fee_amount: normalizeStoredAmount(
        legacyRecord.application_fee_amount,
        DEFAULT_MARKETING_APPLICATION_FEE_AMOUNT,
      ),
    };
  }
}

function getBaseDefaults(): MarketingBillingConfig {
  return {
    application_fee_amount: DEFAULT_MARKETING_APPLICATION_FEE_AMOUNT,
    click_charge_amount: DEFAULT_MARKETING_CLICK_CHARGE_AMOUNT,
  };
}

function normalizeConfig(value: unknown, defaults: MarketingBillingConfig): MarketingBillingConfig {
  const record = toObject(value);
  return {
    application_fee_amount: normalizeStoredAmount(
      record.application_fee_amount,
      defaults.application_fee_amount,
    ),
    click_charge_amount: normalizeStoredAmount(
      record.click_charge_amount,
      defaults.click_charge_amount,
    ),
  };
}

function normalizeStoredAmount(value: unknown, fallback: number): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return fallback;
  }
  return Number(amount.toFixed(2));
}

function normalizePositiveAmount(value: unknown, fieldName: string): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be greater than 0`);
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
