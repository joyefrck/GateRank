import { APPLICATION_FEE_AMOUNT, CLICK_CHARGE_AMOUNT, RECHARGE_AMOUNTS } from '../config/billing';
import { HttpError } from '../middleware/errorHandler';
import type { SystemSettingRecord } from '../repositories/systemSettingRepository';
import { formatDateTimeInTimezoneIso } from '../utils/time';
import {
  AIRPORT_AD_MONTHLY_PRICE,
  AIRPORT_HOME_AD_SLOTS,
  type AirportHomeAdSlotPrices,
} from '../../../shared/airportAds';

export interface MarketingSettingsInput {
  application_fee_amount?: number;
  click_charge_amount?: number;
  rank_click_charge_amounts?: Partial<RankClickChargeAmounts>;
  airport_ad_monthly_price?: number;
  home_ad_slot_monthly_prices?: Partial<AirportHomeAdSlotPrices>;
  recharge_amounts?: number[];
  admin_telegram_username?: string | null;
  home_section_limits?: Partial<HomeSectionLimits>;
}

export const CLICK_CHARGE_RANKS = [1, 2, 3, 4, 5, 6] as const;
export type ClickChargeRank = (typeof CLICK_CHARGE_RANKS)[number];
export type RankClickChargeAmounts = Record<ClickChargeRank, number | null>;

export interface HomeSectionLimits {
  today_pick: number;
  most_stable: number;
  best_value: number;
  new_entries: number;
  risk_alerts: number;
}

export interface MarketingSettingsView {
  application_fee_amount: number;
  click_charge_amount: number;
  rank_click_charge_amounts: RankClickChargeAmounts;
  airport_ad_monthly_price: number;
  home_ad_slot_monthly_prices: AirportHomeAdSlotPrices;
  recharge_amounts: number[];
  admin_telegram_username: string | null;
  home_section_limits: HomeSectionLimits;
  updated_at: string | null;
  updated_by: string | null;
}

export interface MarketingBillingConfig {
  application_fee_amount: number;
  click_charge_amount: number;
  rank_click_charge_amounts: RankClickChargeAmounts;
  airport_ad_monthly_price: number;
  home_ad_slot_monthly_prices: AirportHomeAdSlotPrices;
  recharge_amounts: number[];
  admin_telegram_username: string | null;
  home_section_limits: HomeSectionLimits;
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
export const DEFAULT_AIRPORT_AD_MONTHLY_PRICE = AIRPORT_AD_MONTHLY_PRICE;
export const DEFAULT_MARKETING_RECHARGE_AMOUNTS = [...RECHARGE_AMOUNTS];
export const DEFAULT_HOME_SECTION_LIMITS: HomeSectionLimits = {
  today_pick: 3,
  most_stable: 3,
  best_value: 3,
  new_entries: 6,
  risk_alerts: 1,
};

const HOME_SECTION_LIMIT_KEYS: Array<keyof HomeSectionLimits> = [
  'today_pick',
  'most_stable',
  'best_value',
  'new_entries',
  'risk_alerts',
];

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
      rank_click_charge_amounts:
        input.rank_click_charge_amounts === undefined
          ? base.rank_click_charge_amounts
          : normalizeRankClickChargeAmounts(
              input.rank_click_charge_amounts,
              base.rank_click_charge_amounts,
              true,
            ),
      airport_ad_monthly_price:
        input.airport_ad_monthly_price === undefined
          ? base.airport_ad_monthly_price
          : normalizePositiveAmount(input.airport_ad_monthly_price, 'airport_ad_monthly_price'),
      home_ad_slot_monthly_prices:
        input.home_ad_slot_monthly_prices === undefined
          ? base.home_ad_slot_monthly_prices
          : normalizeHomeAdSlotMonthlyPrices(
              input.home_ad_slot_monthly_prices,
              base.home_ad_slot_monthly_prices,
              true,
            ),
      recharge_amounts:
        input.recharge_amounts === undefined
          ? base.recharge_amounts
          : normalizeRechargeAmounts(input.recharge_amounts, base.recharge_amounts, true),
      admin_telegram_username:
        input.admin_telegram_username === undefined
          ? base.admin_telegram_username
          : normalizeTelegramUsername(input.admin_telegram_username),
      home_section_limits:
        input.home_section_limits === undefined
          ? base.home_section_limits
          : normalizeHomeSectionLimits(input.home_section_limits, base.home_section_limits, true),
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
    rank_click_charge_amounts: createDefaultRankClickChargeAmounts(),
    airport_ad_monthly_price: DEFAULT_AIRPORT_AD_MONTHLY_PRICE,
    home_ad_slot_monthly_prices: createDefaultHomeAdSlotMonthlyPrices(),
    recharge_amounts: [...DEFAULT_MARKETING_RECHARGE_AMOUNTS],
    admin_telegram_username: null,
    home_section_limits: { ...DEFAULT_HOME_SECTION_LIMITS },
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
    rank_click_charge_amounts: normalizeRankClickChargeAmounts(
      record.rank_click_charge_amounts,
      defaults.rank_click_charge_amounts,
      false,
    ),
    airport_ad_monthly_price: normalizeStoredAmount(
      record.airport_ad_monthly_price,
      defaults.airport_ad_monthly_price,
    ),
    home_ad_slot_monthly_prices: normalizeHomeAdSlotMonthlyPrices(
      record.home_ad_slot_monthly_prices,
      createDefaultHomeAdSlotMonthlyPrices(
        normalizeStoredAmount(record.airport_ad_monthly_price, defaults.airport_ad_monthly_price),
      ),
      false,
    ),
    recharge_amounts: normalizeRechargeAmounts(
      record.recharge_amounts,
      defaults.recharge_amounts,
      false,
    ),
    admin_telegram_username: normalizeStoredTelegramUsername(record.admin_telegram_username),
    home_section_limits: normalizeHomeSectionLimits(
      record.home_section_limits,
      defaults.home_section_limits,
      false,
    ),
  };
}

export function resolveClickChargeAmount(
  config: {
    click_charge_amount: number;
    rank_click_charge_amounts?: Partial<RankClickChargeAmounts>;
  },
  rank: number | null,
): number {
  if (rank !== null && (CLICK_CHARGE_RANKS as readonly number[]).includes(rank)) {
    const configured = config.rank_click_charge_amounts?.[rank as ClickChargeRank];
    if (configured !== null && configured !== undefined) {
      return configured;
    }
  }
  return config.click_charge_amount;
}

export function createDefaultRankClickChargeAmounts(): RankClickChargeAmounts {
  return {
    1: null,
    2: null,
    3: null,
    4: null,
    5: null,
    6: null,
  };
}

export function createDefaultHomeAdSlotMonthlyPrices(
  fallback = DEFAULT_AIRPORT_AD_MONTHLY_PRICE,
): AirportHomeAdSlotPrices {
  return Object.fromEntries(
    AIRPORT_HOME_AD_SLOTS.map((slot) => [slot, fallback]),
  ) as AirportHomeAdSlotPrices;
}

function normalizeHomeAdSlotMonthlyPrices(
  value: unknown,
  defaults: AirportHomeAdSlotPrices,
  strict: boolean,
): AirportHomeAdSlotPrices {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (strict) {
      throw new HttpError(400, 'BAD_REQUEST', 'home_ad_slot_monthly_prices must be an object');
    }
    return { ...defaults };
  }

  const record = value as Record<string, unknown>;
  const allowedKeys = new Set(AIRPORT_HOME_AD_SLOTS.map(String));
  if (strict) {
    const unknownKey = Object.keys(record).find((key) => !allowedKeys.has(key));
    if (unknownKey) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        `home_ad_slot_monthly_prices.${unknownKey} is not supported`,
      );
    }
  }

  const result = { ...defaults };
  for (const slot of AIRPORT_HOME_AD_SLOTS) {
    const key = String(slot);
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      continue;
    }
    try {
      result[slot] = normalizePositiveAmount(record[key], `home_ad_slot_monthly_prices.${slot}`);
    } catch (error) {
      if (strict) {
        throw error;
      }
      result[slot] = defaults[slot];
    }
  }
  return result;
}

function normalizeRankClickChargeAmounts(
  value: unknown,
  defaults: RankClickChargeAmounts,
  strict: boolean,
): RankClickChargeAmounts {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (strict) {
      throw new HttpError(400, 'BAD_REQUEST', 'rank_click_charge_amounts must be an object');
    }
    return { ...defaults };
  }

  const record = value as Record<string, unknown>;
  const allowedKeys = new Set(CLICK_CHARGE_RANKS.map(String));
  if (strict) {
    const unknownKey = Object.keys(record).find((key) => !allowedKeys.has(key));
    if (unknownKey) {
      throw new HttpError(
        400,
        'BAD_REQUEST',
        `rank_click_charge_amounts.${unknownKey} is not supported`,
      );
    }
  }

  const result = { ...defaults };
  for (const rank of CLICK_CHARGE_RANKS) {
    const key = String(rank);
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      continue;
    }
    const amount = record[key];
    if (amount === null) {
      result[rank] = null;
      continue;
    }
    try {
      result[rank] = normalizePositiveAmount(amount, `rank_click_charge_amounts.${rank}`);
    } catch (error) {
      if (strict) {
        throw error;
      }
      result[rank] = defaults[rank];
    }
  }
  return result;
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

function normalizeRechargeAmounts(value: unknown, fallback: number[], strict: boolean): number[] {
  if (!Array.isArray(value)) {
    if (strict) {
      throw new HttpError(400, 'BAD_REQUEST', 'recharge_amounts must be an array');
    }
    return [...fallback];
  }

  const amounts: number[] = [];
  const seen = new Set<number>();
  for (const item of value) {
    const amount = Number(item);
    if (!Number.isInteger(amount) || amount <= 0) {
      if (strict) {
        throw new HttpError(400, 'BAD_REQUEST', 'recharge_amounts must contain positive integer amounts');
      }
      return [...fallback];
    }
    if (seen.has(amount)) {
      if (strict) {
        throw new HttpError(400, 'BAD_REQUEST', 'recharge_amounts must be unique');
      }
      return [...fallback];
    }
    seen.add(amount);
    amounts.push(amount);
  }

  if (amounts.length < 1 || amounts.length > 8) {
    if (strict) {
      throw new HttpError(400, 'BAD_REQUEST', 'recharge_amounts must contain 1 to 8 amounts');
    }
    return [...fallback];
  }

  return amounts.sort((a, b) => a - b);
}

function normalizeTelegramUsername(value: unknown): string | null {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }
  const withoutProtocol = raw.replace(/^https?:\/\/(?:www\.)?/i, '');
  const withoutHost = withoutProtocol.replace(/^t\.me\//i, '');
  const username = withoutHost.replace(/^@+/, '').replace(/\/+$/, '').trim();
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) {
    throw new HttpError(400, 'BAD_REQUEST', 'admin_telegram_username must be a valid Telegram username');
  }
  return username;
}

function normalizeStoredTelegramUsername(value: unknown): string | null {
  try {
    return normalizeTelegramUsername(value);
  } catch {
    return null;
  }
}

function normalizeHomeSectionLimits(
  value: unknown,
  defaults: HomeSectionLimits,
  strict: boolean,
): HomeSectionLimits {
  const record = toObject(value);
  const result = { ...defaults };

  for (const key of HOME_SECTION_LIMIT_KEYS) {
    if (record[key] === undefined) {
      continue;
    }
    result[key] = normalizeHomeSectionLimit(record[key], `home_section_limits.${key}`, result[key], strict);
  }

  return result;
}

function normalizeHomeSectionLimit(
  value: unknown,
  fieldName: string,
  fallback: number,
  strict: boolean,
): number {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) {
    if (strict) {
      throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be an integer between 1 and 12`);
    }
    return fallback;
  }
  return limit;
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
