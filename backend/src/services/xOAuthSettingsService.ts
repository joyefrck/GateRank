import type { SystemSettingRecord } from '../repositories/systemSettingRepository';
import { HttpError } from '../middleware/errorHandler';
import { loadBackendEnv } from '../utils/backendEnv';
import { formatDateTimeInTimezoneIso } from '../utils/time';
import type { XOAuthConfig } from '../utils/xOAuthConfig';

export interface XOAuthSettingsInput {
  enabled?: boolean;
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  authorize_url?: string;
  token_url?: string;
  me_url?: string;
  scope?: string;
  code_challenge_method?: 'plain' | 'S256';
}

export interface XOAuthSettingsView {
  enabled: boolean;
  client_id: string;
  has_client_secret: boolean;
  client_secret_masked: string | null;
  redirect_uri: string;
  authorize_url: string;
  token_url: string;
  me_url: string;
  scope: string;
  code_challenge_method: 'plain' | 'S256';
  updated_at: string | null;
  updated_by: string | null;
}

export interface XOAuthRuntimeConfig extends XOAuthConfig {
  enabled: boolean;
  scope: string;
  codeChallengeMethod: 'plain' | 'S256';
}

interface XOAuthStoredConfig {
  enabled: boolean;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  authorize_url: string;
  token_url: string;
  me_url: string;
  scope: string;
  code_challenge_method: 'plain' | 'S256';
}

interface XOAuthSettingsServiceOptions {
  systemSettingRepository?: {
    getByKey(settingKey: string): Promise<SystemSettingRecord | null>;
    upsert(settingKey: string, value: unknown, updatedBy: string): Promise<void>;
  };
}

const X_OAUTH_SETTING_KEY = 'x_oauth';
const DEFAULT_AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize';
const DEFAULT_TOKEN_URL = 'https://api.x.com/2/oauth2/token';
const DEFAULT_ME_URL = 'https://api.x.com/2/users/me';
const DEFAULT_SCOPE = 'tweet.read users.read';

export class XOAuthSettingsService {
  private readonly systemSettingRepository?: XOAuthSettingsServiceOptions['systemSettingRepository'];

  constructor(options: XOAuthSettingsServiceOptions = {}) {
    this.systemSettingRepository = options.systemSettingRepository;
  }

  async getAdminSettings(): Promise<XOAuthSettingsView> {
    const stored = await this.getStoredConfig();
    const effective = stored?.config || getEnvFallbackConfig();
    return {
      enabled: effective.enabled,
      client_id: effective.client_id,
      has_client_secret: effective.client_secret.trim() !== '',
      client_secret_masked: maskValue(effective.client_secret),
      redirect_uri: effective.redirect_uri,
      authorize_url: effective.authorize_url,
      token_url: effective.token_url,
      me_url: effective.me_url,
      scope: effective.scope,
      code_challenge_method: effective.code_challenge_method,
      updated_at: stored?.record.updated_at ? normalizeStoredUpdatedAt(stored.record.updated_at) : null,
      updated_by: stored?.record.updated_by || null,
    };
  }

  async updateAdminSettings(input: XOAuthSettingsInput, updatedBy: string): Promise<XOAuthSettingsView> {
    if (!this.systemSettingRepository) {
      throw new Error('systemSettingRepository is not configured');
    }

    const nextConfig = await this.resolveConfig(input);
    this.validate(nextConfig);
    await this.systemSettingRepository.upsert(X_OAUTH_SETTING_KEY, nextConfig, updatedBy);
    return this.getAdminSettings();
  }

  async getConfig(): Promise<XOAuthRuntimeConfig> {
    const stored = await this.getStoredConfig();
    const effective = stored?.config || getEnvFallbackConfig();
    return {
      enabled: effective.enabled,
      clientId: effective.client_id,
      clientSecret: effective.client_secret,
      redirectUri: effective.redirect_uri,
      authorizeUrl: effective.authorize_url,
      tokenUrl: effective.token_url,
      meUrl: effective.me_url,
      scope: effective.scope,
      codeChallengeMethod: effective.code_challenge_method,
    };
  }

  private async resolveConfig(input: XOAuthSettingsInput = {}): Promise<XOAuthStoredConfig> {
    const stored = await this.getStoredConfig();
    const base = stored?.config || getEnvFallbackConfig();
    return {
      enabled: input.enabled === undefined ? base.enabled : Boolean(input.enabled),
      client_id: input.client_id === undefined ? base.client_id : stringOrEmpty(input.client_id),
      client_secret:
        input.client_secret === undefined ? base.client_secret : stringOrEmpty(input.client_secret),
      redirect_uri: input.redirect_uri === undefined ? base.redirect_uri : stringOrEmpty(input.redirect_uri),
      authorize_url: input.authorize_url === undefined ? base.authorize_url : stringOrEmpty(input.authorize_url),
      token_url: input.token_url === undefined ? base.token_url : stringOrEmpty(input.token_url),
      me_url: input.me_url === undefined ? base.me_url : stringOrEmpty(input.me_url),
      scope: input.scope === undefined ? base.scope : stringOrEmpty(input.scope) || DEFAULT_SCOPE,
      code_challenge_method:
        input.code_challenge_method === 'S256' ? 'S256' : input.code_challenge_method === 'plain' ? 'plain' : base.code_challenge_method,
    };
  }

  private async getStoredConfig(): Promise<{ record: SystemSettingRecord; config: XOAuthStoredConfig } | null> {
    if (!this.systemSettingRepository) {
      return null;
    }
    const record = await this.systemSettingRepository.getByKey(X_OAUTH_SETTING_KEY);
    if (!record) {
      return null;
    }
    return {
      record,
      config: normalizeConfig(record.value_json, getEnvFallbackConfig()),
    };
  }

  private validate(config: XOAuthStoredConfig): void {
    if (!config.enabled) {
      return;
    }
    for (const [field, value] of [
      ['Client ID', config.client_id],
      ['Callback URI', config.redirect_uri],
      ['Authorize URL', config.authorize_url],
      ['Token URL', config.token_url],
      ['User API URL', config.me_url],
      ['Scope', config.scope],
    ] as Array<[string, string]>) {
      if (!value.trim()) {
        throw new HttpError(400, 'BAD_REQUEST', `启用 X 登录前必须填写 ${field}`);
      }
    }
    for (const [field, value] of [
      ['Callback URI', config.redirect_uri],
      ['Authorize URL', config.authorize_url],
      ['Token URL', config.token_url],
      ['User API URL', config.me_url],
    ] as Array<[string, string]>) {
      try {
        new URL(value);
      } catch {
        throw new HttpError(400, 'BAD_REQUEST', `${field} 必须是合法 URL`);
      }
    }
  }
}

function getEnvFallbackConfig(): XOAuthStoredConfig {
  const env = loadBackendEnv();
  return {
    enabled: Boolean(stringFromEnv('X_OAUTH_CLIENT_ID', env) && stringFromEnv('X_OAUTH_REDIRECT_URI', env)),
    client_id: stringFromEnv('X_OAUTH_CLIENT_ID', env),
    client_secret: stringFromEnv('X_OAUTH_CLIENT_SECRET', env),
    redirect_uri: stringFromEnv('X_OAUTH_REDIRECT_URI', env),
    authorize_url: stringFromEnv('X_OAUTH_AUTHORIZE_URL', env) || DEFAULT_AUTHORIZE_URL,
    token_url: stringFromEnv('X_OAUTH_TOKEN_URL', env) || DEFAULT_TOKEN_URL,
    me_url: stringFromEnv('X_OAUTH_ME_URL', env) || DEFAULT_ME_URL,
    scope: stringFromEnv('X_OAUTH_SCOPE', env) || DEFAULT_SCOPE,
    code_challenge_method: stringFromEnv('X_OAUTH_CODE_CHALLENGE_METHOD', env) === 'S256' ? 'S256' : 'plain',
  };
}

function normalizeConfig(value: unknown, fallback: XOAuthStoredConfig): XOAuthStoredConfig {
  const record = toObject(value);
  return {
    enabled: record.enabled === undefined ? fallback.enabled : Boolean(record.enabled),
    client_id: stringFieldOrFallback(record, 'client_id', fallback.client_id),
    client_secret: stringFieldOrFallback(record, 'client_secret', fallback.client_secret),
    redirect_uri: stringFieldOrFallback(record, 'redirect_uri', fallback.redirect_uri),
    authorize_url: stringFieldOrFallback(record, 'authorize_url', fallback.authorize_url),
    token_url: stringFieldOrFallback(record, 'token_url', fallback.token_url),
    me_url: stringFieldOrFallback(record, 'me_url', fallback.me_url),
    scope: stringFieldOrFallback(record, 'scope', fallback.scope || DEFAULT_SCOPE) || DEFAULT_SCOPE,
    code_challenge_method: record.code_challenge_method === 'S256' ? 'S256' : 'plain',
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

function stringFromEnv(key: string, env: Record<string, string>): string {
  return String(process.env[key] || env[key] || '').trim();
}

function stringOrEmpty(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function stringFieldOrFallback(record: Record<string, unknown>, field: string, fallback: string): string {
  return Object.prototype.hasOwnProperty.call(record, field)
    ? stringOrEmpty(record[field])
    : fallback;
}

function maskValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > 16
    ? `${trimmed.slice(0, 6)}***${trimmed.slice(-6)}`
    : `${trimmed.slice(0, 3)}***${trimmed.slice(-3)}`;
}

function normalizeStoredUpdatedAt(value: unknown): string {
  if (value instanceof Date) {
    return formatDateTimeInTimezoneIso(value);
  }
  const raw = String(value || '').trim();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw : formatDateTimeInTimezoneIso(parsed);
}
