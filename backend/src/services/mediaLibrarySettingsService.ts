import type { SystemSettingRecord } from '../repositories/systemSettingRepository';
import { formatDateTimeInTimezoneIso } from '../utils/time';

export type MediaLibraryProviderKey = 'pexels';

export interface PexelsMediaLibrarySettingsInput {
  enabled?: boolean;
  api_key?: string;
  timeout_ms?: number;
}

export interface MediaLibrarySettingsInput {
  providers?: {
    pexels?: PexelsMediaLibrarySettingsInput;
  };
}

export interface MediaLibrarySettingsView {
  providers: {
    pexels: {
      enabled: boolean;
      has_api_key: boolean;
      api_key_masked: string | null;
      timeout_ms: number;
    };
  };
  updated_at: string | null;
  updated_by: string | null;
}

export interface PexelsMediaLibraryConfig {
  enabled: boolean;
  api_key: string;
  timeout_ms: number;
}

interface MediaLibraryConfig {
  providers: {
    pexels: PexelsMediaLibraryConfig;
  };
}

interface MediaLibrarySettingsServiceOptions {
  systemSettingRepository?: {
    getByKey(settingKey: string): Promise<SystemSettingRecord | null>;
    upsert(settingKey: string, value: unknown, updatedBy: string): Promise<void>;
  };
}

const MEDIA_LIBRARY_SETTING_KEY = 'media_libraries';
export const DEFAULT_MEDIA_LIBRARY_TIMEOUT_MS = 8_000;

export class MediaLibrarySettingsService {
  private readonly systemSettingRepository?: MediaLibrarySettingsServiceOptions['systemSettingRepository'];

  constructor(options: MediaLibrarySettingsServiceOptions = {}) {
    this.systemSettingRepository = options.systemSettingRepository;
  }

  async getAdminSettings(): Promise<MediaLibrarySettingsView> {
    const stored = await this.getStoredConfig();
    const effective = stored?.config || getDefaultConfig();

    return {
      providers: {
        pexels: {
          enabled: effective.providers.pexels.enabled,
          has_api_key: effective.providers.pexels.api_key.trim() !== '',
          api_key_masked: maskToken(effective.providers.pexels.api_key),
          timeout_ms: effective.providers.pexels.timeout_ms,
        },
      },
      updated_at: stored?.record.updated_at ? normalizeStoredUpdatedAt(stored.record.updated_at) : null,
      updated_by: stored?.record.updated_by || null,
    };
  }

  async updateAdminSettings(input: MediaLibrarySettingsInput, updatedBy: string): Promise<MediaLibrarySettingsView> {
    if (!this.systemSettingRepository) {
      throw new Error('systemSettingRepository is not configured');
    }

    const nextConfig = await this.resolveConfig(input);
    await this.systemSettingRepository.upsert(MEDIA_LIBRARY_SETTING_KEY, nextConfig, updatedBy);
    return this.getAdminSettings();
  }

  async getPexelsConfig(): Promise<PexelsMediaLibraryConfig> {
    const stored = await this.getStoredConfig();
    return (stored?.config || getDefaultConfig()).providers.pexels;
  }

  private async resolveConfig(input: MediaLibrarySettingsInput = {}): Promise<MediaLibraryConfig> {
    const stored = await this.getStoredConfig();
    const base = stored?.config || getDefaultConfig();
    const pexelsInput = toObject(input.providers).pexels;
    const pexels = toObject(pexelsInput);

    return {
      providers: {
        pexels: {
          enabled:
            pexels.enabled === undefined
              ? base.providers.pexels.enabled
              : boolOrDefault(pexels.enabled, false),
          api_key:
            pexels.api_key === undefined
              ? base.providers.pexels.api_key
              : stringOrEmpty(pexels.api_key),
          timeout_ms:
            pexels.timeout_ms === undefined
              ? base.providers.pexels.timeout_ms
              : normalizeTimeoutMs(pexels.timeout_ms),
        },
      },
    };
  }

  private async getStoredConfig(): Promise<{
    record: SystemSettingRecord;
    config: MediaLibraryConfig;
  } | null> {
    if (!this.systemSettingRepository) {
      return null;
    }

    const record = await this.systemSettingRepository.getByKey(MEDIA_LIBRARY_SETTING_KEY);
    if (!record) {
      return null;
    }

    return {
      record,
      config: normalizeConfig(record.value_json),
    };
  }
}

function getDefaultConfig(): MediaLibraryConfig {
  return {
    providers: {
      pexels: {
        enabled: false,
        api_key: '',
        timeout_ms: DEFAULT_MEDIA_LIBRARY_TIMEOUT_MS,
      },
    },
  };
}

function normalizeConfig(value: unknown): MediaLibraryConfig {
  const record = toObject(value);
  const providers = toObject(record.providers);
  const pexels = toObject(providers.pexels);

  return {
    providers: {
      pexels: {
        enabled: boolOrDefault(pexels.enabled, false),
        api_key: stringOrEmpty(pexels.api_key),
        timeout_ms: normalizeTimeoutMs(pexels.timeout_ms),
      },
    },
  };
}

function normalizeTimeoutMs(value: unknown): number {
  const timeout = Number(value);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    return DEFAULT_MEDIA_LIBRARY_TIMEOUT_MS;
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
