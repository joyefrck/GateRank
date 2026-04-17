import type { SystemSettingRecord } from '../repositories/systemSettingRepository';
import { formatDateTimeInTimezoneIso } from '../utils/time';

export interface SmtpSettingsInput {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  templates?: Partial<Record<SmtpTemplateKey, Partial<SmtpTemplateConfigItem>>>;
}

export type SmtpTemplateKey = 'applicant_credentials' | 'application_approved';

export interface SmtpTemplateConfigItem {
  subject: string;
  body: string;
}

export interface SmtpTemplateConfig {
  applicant_credentials: SmtpTemplateConfigItem;
  application_approved: SmtpTemplateConfigItem;
}

export interface SmtpSettingsView {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  has_password: boolean;
  password_masked: string | null;
  from_name: string;
  from_email: string;
  reply_to: string;
  templates: SmtpTemplateConfig;
  updated_at: string | null;
  updated_by: string | null;
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from_name: string;
  from_email: string;
  reply_to: string;
  templates: SmtpTemplateConfig;
}

interface SmtpSettingsServiceOptions {
  systemSettingRepository?: {
    getByKey(settingKey: string): Promise<SystemSettingRecord | null>;
    upsert(settingKey: string, value: unknown, updatedBy: string): Promise<void>;
  };
}

const SMTP_SETTING_KEY = 'smtp_mail';

export class SmtpSettingsService {
  private readonly systemSettingRepository?: SmtpSettingsServiceOptions['systemSettingRepository'];

  constructor(options: SmtpSettingsServiceOptions = {}) {
    this.systemSettingRepository = options.systemSettingRepository;
  }

  async getAdminSettings(): Promise<SmtpSettingsView> {
    const stored = await this.getStoredConfig();
    const effective = stored?.config || getDefaultConfig();
    return {
      enabled: effective.enabled,
      host: effective.host,
      port: effective.port,
      secure: effective.secure,
      username: effective.username,
      has_password: effective.password.trim() !== '',
      password_masked: maskValue(effective.password),
      from_name: effective.from_name,
      from_email: effective.from_email,
      reply_to: effective.reply_to,
      templates: effective.templates,
      updated_at: stored?.record.updated_at ? normalizeStoredUpdatedAt(stored.record.updated_at) : null,
      updated_by: stored?.record.updated_by || null,
    };
  }

  async updateAdminSettings(input: SmtpSettingsInput, updatedBy: string): Promise<SmtpSettingsView> {
    if (!this.systemSettingRepository) {
      throw new Error('systemSettingRepository is not configured');
    }
    const nextConfig = await this.resolveConfig(input);
    await this.systemSettingRepository.upsert(SMTP_SETTING_KEY, nextConfig, updatedBy);
    return this.getAdminSettings();
  }

  async getConfig(): Promise<SmtpConfig> {
    const stored = await this.getStoredConfig();
    return stored?.config || getDefaultConfig();
  }

  private async resolveConfig(input: SmtpSettingsInput = {}): Promise<SmtpConfig> {
    const stored = await this.getStoredConfig();
    const base = stored?.config || getDefaultConfig();
    return {
      enabled: input.enabled === undefined ? base.enabled : Boolean(input.enabled),
      host: input.host === undefined ? base.host : String(input.host || '').trim(),
      port: input.port === undefined ? base.port : normalizePort(input.port),
      secure: input.secure === undefined ? base.secure : Boolean(input.secure),
      username: input.username === undefined ? base.username : String(input.username || '').trim(),
      password: input.password === undefined ? base.password : String(input.password || '').trim(),
      from_name: input.from_name === undefined ? base.from_name : String(input.from_name || '').trim(),
      from_email: input.from_email === undefined ? base.from_email : String(input.from_email || '').trim(),
      reply_to: input.reply_to === undefined ? base.reply_to : String(input.reply_to || '').trim(),
      templates: normalizeTemplates(input.templates, base.templates),
    };
  }

  private async getStoredConfig(): Promise<{ record: SystemSettingRecord; config: SmtpConfig } | null> {
    if (!this.systemSettingRepository) {
      return null;
    }

    const record = await this.systemSettingRepository.getByKey(SMTP_SETTING_KEY);
    if (!record) {
      return null;
    }

    return {
      record,
      config: normalizeConfig(record.value_json),
    };
  }
}

function getDefaultConfig(): SmtpConfig {
  return {
    enabled: false,
    host: '',
    port: 465,
    secure: true,
    username: '',
    password: '',
    from_name: 'GateRank',
    from_email: '',
    reply_to: '',
    templates: getDefaultTemplates(),
  };
}

function normalizeConfig(value: unknown): SmtpConfig {
  const record = toObject(value);
  return {
    enabled: Boolean(record.enabled),
    host: stringOrEmpty(record.host),
    port: normalizePort(record.port),
    secure: boolOrDefault(record.secure, true),
    username: stringOrEmpty(record.username),
    password: stringOrEmpty(record.password),
    from_name: stringOrEmpty(record.from_name) || 'GateRank',
    from_email: stringOrEmpty(record.from_email),
    reply_to: stringOrEmpty(record.reply_to),
    templates: normalizeTemplates(record.templates),
  };
}

function getDefaultTemplates(): SmtpTemplateConfig {
  return {
    applicant_credentials: {
      subject: 'GateRank 申请后台账号已开通 - {{airport_name}}',
      body: [
        '您好，{{airport_name}} 的申请已提交成功。',
        '',
        '登录邮箱：{{portal_email}}',
        '初始密码：{{initial_password}}',
        '登录地址：{{portal_login_url}}',
        '',
        '首次登录后请立即修改密码，然后完成支付并等待审批。',
      ].join('\n'),
    },
    application_approved: {
      subject: 'GateRank 审批通过通知 - {{airport_name}}',
      body: [
        '您好，{{airport_name}} 的 GateRank 入驻申请已审批通过。',
        '',
        '后续如需补充资料，请联系管理员。',
      ].join('\n'),
    },
  };
}

function normalizeTemplates(
  value: unknown,
  fallback: SmtpTemplateConfig = getDefaultTemplates(),
): SmtpTemplateConfig {
  const record = toObject(value);
  const defaults = getDefaultTemplates();
  return {
    applicant_credentials: normalizeTemplateItem(
      record.applicant_credentials,
      fallback.applicant_credentials || defaults.applicant_credentials,
    ),
    application_approved: normalizeTemplateItem(
      record.application_approved,
      fallback.application_approved || defaults.application_approved,
    ),
  };
}

function normalizeTemplateItem(
  value: unknown,
  fallback: SmtpTemplateConfigItem,
): SmtpTemplateConfigItem {
  const record = toObject(value);
  return {
    subject: stringOrEmpty(record.subject) || fallback.subject,
    body: stringOrEmpty(record.body) || fallback.body,
  };
}

function normalizePort(value: unknown): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : 465;
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

function maskValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= 8) {
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }
  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
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
