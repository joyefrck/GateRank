import type {
  AirportProfile,
  AirportProfileClientKey,
  AirportProfileLineType,
  AirportProfileRegionInfo,
  AirportProfileRegionKey,
} from '../types/domain';
import { HttpError } from '../middleware/errorHandler';

export const AIRPORT_PROFILE_CLIENT_KEYS: AirportProfileClientKey[] = [
  'self_built_client',
  'clash',
  'clash_verge',
  'shadowrocket',
  'quantumult_x',
  'stash',
  'surge',
  'sing_box',
  'v2rayn',
  'v2rayng',
  'nekobox',
  'surfboard',
  'xiaohuojian',
  'openclash',
];

export const AIRPORT_PROFILE_REGION_KEYS: AirportProfileRegionKey[] = [
  'hong_kong',
  'taiwan',
  'japan',
  'singapore',
  'united_states',
  'south_korea',
  'united_kingdom',
  'germany',
  'turkey',
  'argentina',
  'india',
];

export const AIRPORT_PROFILE_LINE_TYPES: AirportProfileLineType[] = ['iepl', 'iplc', 'cn2', 'bgp', 'relay'];

type PlainRecord = Record<string, unknown>;

export function createDefaultAirportProfile(): AirportProfile {
  return {
    plan: {
      supports_monthly: null,
      supports_quarterly: null,
      supports_half_yearly: null,
      supports_annual: null,
      lowest_monthly_price: null,
      lowest_annual_monthly_price: null,
      has_trial_plan: null,
      has_lifetime_plan: null,
    },
    telegram: {
      has_group: null,
      group_url: null,
      has_channel: null,
      channel_url: null,
      group_allows_speaking: null,
      group_member_count: null,
      recent_active_at: null,
      has_customer_service_bot: null,
      has_ticket_system: null,
    },
    clients: Object.fromEntries(AIRPORT_PROFILE_CLIENT_KEYS.map((key) => [key, null])) as Record<
      AirportProfileClientKey,
      boolean | null
    >,
    import_methods: {
      one_click_import: null,
      subscription_link: null,
      universal_subscription: null,
      qr_code_import: null,
      tutorials: null,
    },
    regions: Object.fromEntries(
      AIRPORT_PROFILE_REGION_KEYS.map((key) => [key, createDefaultRegionInfo()]),
    ) as Record<AirportProfileRegionKey, AirportProfileRegionInfo>,
  };
}

export function normalizeAirportProfile(value: unknown): AirportProfile {
  return parseAirportProfile(value, false);
}

export function parseAirportProfilePayload(value: unknown, fieldName = 'profile'): AirportProfile {
  if (value === undefined || value === null || value === '') {
    return createDefaultAirportProfile();
  }
  return parseAirportProfile(value, true, fieldName);
}

function parseAirportProfile(value: unknown, strict: boolean, fieldName = 'profile'): AirportProfile {
  const profile = createDefaultAirportProfile();
  const source = toObject(value, strict, fieldName);
  if (!source) {
    return profile;
  }

  const plan = toObject(source.plan, strict, `${fieldName}.plan`);
  if (plan) {
    profile.plan.supports_monthly = nullableBoolean(plan.supports_monthly, strict, `${fieldName}.plan.supports_monthly`);
    profile.plan.supports_quarterly = nullableBoolean(plan.supports_quarterly, strict, `${fieldName}.plan.supports_quarterly`);
    profile.plan.supports_half_yearly = nullableBoolean(
      plan.supports_half_yearly,
      strict,
      `${fieldName}.plan.supports_half_yearly`,
    );
    profile.plan.supports_annual = nullableBoolean(plan.supports_annual, strict, `${fieldName}.plan.supports_annual`);
    profile.plan.lowest_monthly_price = nonNegativeNumber(
      plan.lowest_monthly_price,
      strict,
      `${fieldName}.plan.lowest_monthly_price`,
    );
    profile.plan.lowest_annual_monthly_price = nonNegativeNumber(
      plan.lowest_annual_monthly_price,
      strict,
      `${fieldName}.plan.lowest_annual_monthly_price`,
    );
    profile.plan.has_trial_plan = nullableBoolean(plan.has_trial_plan, strict, `${fieldName}.plan.has_trial_plan`);
    profile.plan.has_lifetime_plan = nullableBoolean(
      plan.has_lifetime_plan,
      strict,
      `${fieldName}.plan.has_lifetime_plan`,
    );
  }

  const telegram = toObject(source.telegram, strict, `${fieldName}.telegram`);
  if (telegram) {
    profile.telegram.has_group = nullableBoolean(telegram.has_group, strict, `${fieldName}.telegram.has_group`);
    profile.telegram.group_url = nullableString(telegram.group_url);
    profile.telegram.has_channel = nullableBoolean(telegram.has_channel, strict, `${fieldName}.telegram.has_channel`);
    profile.telegram.channel_url = nullableString(telegram.channel_url);
    profile.telegram.group_allows_speaking = nullableBoolean(
      telegram.group_allows_speaking,
      strict,
      `${fieldName}.telegram.group_allows_speaking`,
    );
    profile.telegram.group_member_count = nonNegativeInteger(
      telegram.group_member_count,
      strict,
      `${fieldName}.telegram.group_member_count`,
    );
    profile.telegram.recent_active_at = nullableString(telegram.recent_active_at);
    profile.telegram.has_customer_service_bot = nullableBoolean(
      telegram.has_customer_service_bot,
      strict,
      `${fieldName}.telegram.has_customer_service_bot`,
    );
    profile.telegram.has_ticket_system = nullableBoolean(
      telegram.has_ticket_system,
      strict,
      `${fieldName}.telegram.has_ticket_system`,
    );
  }

  const clients = toObject(source.clients, strict, `${fieldName}.clients`);
  if (clients) {
    for (const key of AIRPORT_PROFILE_CLIENT_KEYS) {
      profile.clients[key] = nullableBoolean(clients[key], strict, `${fieldName}.clients.${key}`);
    }
  }

  const importMethods = toObject(source.import_methods, strict, `${fieldName}.import_methods`);
  if (importMethods) {
    profile.import_methods.one_click_import = nullableBoolean(
      importMethods.one_click_import,
      strict,
      `${fieldName}.import_methods.one_click_import`,
    );
    profile.import_methods.subscription_link = nullableBoolean(
      importMethods.subscription_link,
      strict,
      `${fieldName}.import_methods.subscription_link`,
    );
    profile.import_methods.universal_subscription = nullableBoolean(
      importMethods.universal_subscription,
      strict,
      `${fieldName}.import_methods.universal_subscription`,
    );
    profile.import_methods.qr_code_import = nullableBoolean(
      importMethods.qr_code_import,
      strict,
      `${fieldName}.import_methods.qr_code_import`,
    );
    profile.import_methods.tutorials = nullableBoolean(
      importMethods.tutorials,
      strict,
      `${fieldName}.import_methods.tutorials`,
    );
  }

  const regions = toObject(source.regions, strict, `${fieldName}.regions`);
  if (regions) {
    for (const key of AIRPORT_PROFILE_REGION_KEYS) {
      const region = toObject(regions[key], strict, `${fieldName}.regions.${key}`);
      if (!region) {
        continue;
      }
      profile.regions[key] = {
        has_residential: nullableBoolean(region.has_residential, strict, `${fieldName}.regions.${key}.has_residential`),
        has_native_ip: nullableBoolean(region.has_native_ip, strict, `${fieldName}.regions.${key}.has_native_ip`),
        line_types: enumArray(region.line_types, AIRPORT_PROFILE_LINE_TYPES, strict, `${fieldName}.regions.${key}.line_types`),
      };
    }
  }

  return profile;
}

function createDefaultRegionInfo(): AirportProfileRegionInfo {
  return {
    has_residential: null,
    has_native_ip: null,
    line_types: [],
  };
}

function toObject(value: unknown, strict: boolean, fieldName: string): PlainRecord | null {
  const parsed = safeJson(value);
  if (parsed === undefined || parsed === null || parsed === '') {
    return null;
  }
  if (typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as PlainRecord;
  }
  if (strict) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be object`);
  }
  return null;
}

function nullableBoolean(value: unknown, strict: boolean, fieldName: string): boolean | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (value === true || value === 1) {
    return true;
  }
  if (value === false || value === 0) {
    return false;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
      return true;
    }
    if (normalized === '0' || normalized === 'false' || normalized === 'no') {
      return false;
    }
  }
  if (strict) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be boolean or null`);
  }
  return null;
}

function nullableString(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed || null;
}

function nonNegativeNumber(value: unknown, strict: boolean, fieldName: string): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.round(parsed * 100) / 100;
  }
  if (strict) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be a non-negative number`);
  }
  return null;
}

function nonNegativeInteger(value: unknown, strict: boolean, fieldName: string): number | null {
  const parsed = nonNegativeNumber(value, strict, fieldName);
  if (parsed === null) {
    return null;
  }
  if (Number.isInteger(parsed)) {
    return parsed;
  }
  if (strict) {
    throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be a non-negative integer`);
  }
  return null;
}

function enumArray<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  strict: boolean,
  fieldName: string,
): T[] {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  const parsed = Array.isArray(value) ? value : safeJson(value);
  if (!Array.isArray(parsed)) {
    if (strict) {
      throw new HttpError(400, 'BAD_REQUEST', `${fieldName} must be array`);
    }
    return [];
  }
  const allowed = new Set(allowedValues);
  const normalized = parsed.map((item) => String(item).trim()).filter(Boolean);
  const invalid = normalized.find((item) => !allowed.has(item as T));
  if (invalid) {
    if (strict) {
      throw new HttpError(400, 'BAD_REQUEST', `${fieldName} contains unsupported value: ${invalid}`);
    }
    return normalized.filter((item): item is T => allowed.has(item as T));
  }
  return [...new Set(normalized as T[])];
}

function safeJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  if (value.trim() === '') {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
