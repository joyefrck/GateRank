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

export type SmtpTemplateKey =
  | 'applicant_credentials'
  | 'applicant_password_reset'
  | 'application_approved'
  | 'application_reply'
  | 'ad_expiry_reminder'
  | 'low_balance_warning'
  | 'airport_auto_unlisted'
  | 'airport_online';

export interface SmtpTemplateConfigItem {
  enabled: boolean;
  subject: string;
  body: string;
}

export interface SmtpTemplateConfig {
  applicant_credentials: SmtpTemplateConfigItem;
  applicant_password_reset: SmtpTemplateConfigItem;
  application_approved: SmtpTemplateConfigItem;
  application_reply: SmtpTemplateConfigItem;
  ad_expiry_reminder: SmtpTemplateConfigItem;
  low_balance_warning: SmtpTemplateConfigItem;
  airport_auto_unlisted: SmtpTemplateConfigItem;
  airport_online: SmtpTemplateConfigItem;
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
const OLD_APPLICATION_REPLY_TEMPLATE: SmtpTemplateConfigItem = {
  enabled: true,
  subject: 'GateRank 入驻申请回复 - {{airport_name}}',
  body: [
    '您好，{{airport_name}} 的 GateRank 入驻申请有新的回复。',
    '',
    '{{reply_body}}',
    '',
    '如需继续沟通，请直接回复本邮件或联系 GateRank 管理员。',
  ].join('\n'),
};
const DEFAULT_APPLICATION_REPLY_TEMPLATE: SmtpTemplateConfigItem = {
  enabled: true,
  subject: 'GateRank 入驻申请回复 - {{airport_name}}',
  body: [
    '您好，{{airport_name}} 的 GateRank 入驻申请有新的回复。',
    '',
    '{{reply_body}}',
    '',
    '本邮箱仅用于系统发信，无法接收回复。',
    '如需继续沟通，请通过 Telegram 联系管理员：{{admin_telegram_username}}',
    'Telegram 链接：{{admin_telegram_url}}',
    '',
    '申请人管理后台：{{portal_login_url}}',
  ].join('\n'),
};

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

  async updateTemplateEnabled(
    templateKey: SmtpTemplateKey,
    enabled: boolean,
    updatedBy: string,
  ): Promise<SmtpSettingsView> {
    if (!this.systemSettingRepository) {
      throw new Error('systemSettingRepository is not configured');
    }
    const stored = await this.getStoredConfig();
    const base = stored?.config || getDefaultConfig();
    const nextConfig: SmtpConfig = {
      ...base,
      templates: {
        ...base.templates,
        [templateKey]: {
          ...base.templates[templateKey],
          enabled,
        },
      },
    };
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
      enabled: true,
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
    applicant_password_reset: {
      enabled: true,
      subject: 'GateRank 申请人后台密码已重置 - {{airport_name}}',
      body: [
        '您好，{{airport_name}} 的申请人后台登录密码已由管理员重置。',
        '',
        '登录邮箱：{{portal_email}}',
        '新密码：{{new_password}}',
        '登录地址：{{portal_login_url}}',
        '',
        '请使用新密码登录，并在登录后立即修改密码。',
      ].join('\n'),
    },
    application_approved: {
      enabled: true,
      subject: 'GateRank 审批通过通知 - {{airport_name}}',
      body: [
        '您好，{{airport_name}} 的 GateRank 入驻申请已审批通过。',
        '',
        '后续如需补充资料，请联系管理员。',
      ].join('\n'),
    },
    application_reply: {
      ...DEFAULT_APPLICATION_REPLY_TEMPLATE,
    },
	ad_expiry_reminder: {
	  enabled: true,
	  subject: 'GateRank 广告即将到期提醒（共 {{campaign_count}} 项）',
	  body: [
	    '<!doctype html>',
	    '<html lang="zh-CN">',
	    '<body style="margin:0;padding:0;background:#f5f5f5;color:#171717;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">',
	    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:32px 16px;">',
	    '<tr><td align="center">',
	    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e5e5;border-radius:20px;overflow:hidden;">',
	    '<tr><td style="padding:32px;">',
	    '<div style="font-size:12px;font-weight:700;letter-spacing:.14em;color:#6366f1;text-transform:uppercase;">GateRank</div>',
	    '<h1 style="margin:10px 0 8px;font-size:26px;line-height:1.3;">广告即将到期</h1>',
	    '<p style="margin:0 0 24px;color:#525252;line-height:1.7;">您有 {{campaign_count}} 项广告将在 3 天内到期，请及时续费，避免广告展示中断。</p>',
	    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 10px;">{{campaign_items}}</table>',
	    '<div style="margin:26px 0;text-align:center;"><a href="{{portal_login_url}}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#171717;color:#ffffff;text-decoration:none;font-weight:700;">登录申请人后台</a></div>',
	    '<div style="padding:18px;border:1px solid #e5e5e5;border-radius:14px;background:#fafafa;">',
	    '<div style="font-weight:700;margin-bottom:10px;">续费操作指引</div>',
	    '<ol style="margin:0;padding-left:20px;color:#525252;line-height:1.8;"><li>登录申请人后台</li><li>打开“广告管理”</li><li>选择对应广告续费并完成支付</li></ol>',
	    '</div>',
	    '<p style="margin:22px 0 0;color:#737373;font-size:13px;line-height:1.6;">申请人账号：{{applicant_email}}。如已完成续费，请忽略本邮件。</p>',
	    '</td></tr></table>',
	    '</td></tr></table>',
	    '</body></html>',
	  ].join(''),
	},
	    low_balance_warning: {
	      enabled: true,
	      subject: 'GateRank 余额提醒 - {{airport_name}}',
	      body: [
	        '您好，{{airport_name}} 当前账户余额已低于 {{threshold_amount}} 元。',
	        '',
        '余额偏低可能影响公开总分展示和榜单排序，建议您方便时及时完成充值。',
	        '',
	        '如已完成充值，请忽略本邮件。感谢您的理解与支持。',
	      ].join('\n'),
	    },
	    airport_auto_unlisted: {
	      enabled: true,
	      subject: 'GateRank 余额不足提醒 - {{airport_name}}',
	      body: [
	        '您好，{{airport_name}} 当前因账户余额不足，公开综合总分已暂不展示。',
	        '',
        '机场仍会保留在 GateRank 并继续参与监测评分，官网跳转仍可正常访问，但公开榜单会排在余额正常机场之后。',
	        '',
	        '请您及时充值。余额恢复到单次点击费用以上后，系统会自动恢复公开总分和正常排序。',
	        '',
	        '感谢您的理解与配合，如需协助请联系 GateRank 管理员。',
	      ].join('\n'),
	    },
	    airport_online: {
	      enabled: true,
	      subject: 'GateRank 余额恢复通知 - {{airport_name}}',
	      body: [
	        '您好，{{airport_name}} 当前余额已恢复到可用状态。',
	        '',
        '该机场的公开综合总分和榜单排序已恢复正常。',
	        '',
	        '感谢您对 GateRank 的支持。',
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
    applicant_password_reset: normalizeTemplateItem(
      record.applicant_password_reset,
      fallback.applicant_password_reset || defaults.applicant_password_reset,
    ),
    application_approved: normalizeTemplateItem(
      record.application_approved,
      fallback.application_approved || defaults.application_approved,
    ),
    application_reply: normalizeApplicationReplyTemplateItem(
      record.application_reply,
      fallback.application_reply || defaults.application_reply,
    ),
    ad_expiry_reminder: normalizeTemplateItem(
      record.ad_expiry_reminder,
      fallback.ad_expiry_reminder || defaults.ad_expiry_reminder,
    ),
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
  };
}

function normalizeTemplateItem(
  value: unknown,
  fallback: SmtpTemplateConfigItem,
): SmtpTemplateConfigItem {
  const record = toObject(value);
  return {
    enabled: boolOrDefault(record.enabled, fallback.enabled),
    subject: stringOrEmpty(record.subject) || fallback.subject,
    body: stringOrEmpty(record.body) || fallback.body,
  };
}

function normalizeApplicationReplyTemplateItem(
  value: unknown,
  fallback: SmtpTemplateConfigItem,
): SmtpTemplateConfigItem {
  const normalized = normalizeTemplateItem(value, fallback);
  if (
    normalized.subject === OLD_APPLICATION_REPLY_TEMPLATE.subject
    && normalized.body === OLD_APPLICATION_REPLY_TEMPLATE.body
  ) {
    return {
      enabled: normalized.enabled,
      subject: DEFAULT_APPLICATION_REPLY_TEMPLATE.subject,
      body: DEFAULT_APPLICATION_REPLY_TEMPLATE.body,
    };
  }
  return normalized;
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
