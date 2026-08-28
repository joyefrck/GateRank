import nodemailer from 'nodemailer';
import { HttpError } from '../middleware/errorHandler';
import type {
  SmtpConfig,
  SmtpSettingsInput,
  SmtpSettingsService,
  SmtpTemplateConfigItem,
  SmtpTemplateKey,
} from './smtpSettingsService';

interface MailServiceOptions {
  smtpSettingsService: Pick<SmtpSettingsService, 'getConfig'>;
  transportFactory?: typeof nodemailer.createTransport;
}

interface SmtpTransportError {
  code?: unknown;
  command?: unknown;
  message?: unknown;
  response?: unknown;
  responseCode?: unknown;
}

export class SmtpSendError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

export class MailService {
  private readonly smtpSettingsService: MailServiceOptions['smtpSettingsService'];
  private readonly transportFactory: typeof nodemailer.createTransport;

  constructor(options: MailServiceOptions) {
    this.smtpSettingsService = options.smtpSettingsService;
    this.transportFactory = options.transportFactory || nodemailer.createTransport;
  }

  async sendTestMail(input: SmtpSettingsInput & { test_to: string }): Promise<void> {
    const config = await this.resolveConfig(input);
    await this.sendWithConfig(config, {
      to: input.test_to,
      subject: 'GateRank SMTP 配置测试',
      text: '这是一封来自 GateRank 的 SMTP 测试邮件。',
    });
  }

  async sendApplicantCredentialsEmail(input: {
    to: string;
    airportName: string;
    portalEmail: string;
    initialPassword: string;
    portalLoginUrl: string;
  }): Promise<void> {
    const config = await this.requireConfigured();
    const rendered = renderConfiguredTemplate(config, 'applicant_credentials', {
      airport_name: input.airportName,
      applicant_email: input.to,
      portal_email: input.portalEmail,
      initial_password: input.initialPassword,
      portal_login_url: input.portalLoginUrl,
      site_name: 'GateRank',
    });
    if (!rendered) {
      return;
    }
    await this.sendWithConfig(config, {
      to: input.to,
      subject: rendered.subject,
      text: rendered.body,
    });
  }

  async sendApplicantPasswordResetEmail(input: {
    to: string;
    airportName: string;
    portalEmail: string;
    newPassword: string;
    portalLoginUrl: string;
  }): Promise<void> {
    const config = await this.requireConfigured();
    const rendered = renderConfiguredTemplate(config, 'applicant_password_reset', {
      airport_name: input.airportName,
      applicant_email: input.to,
      portal_email: input.portalEmail,
      new_password: input.newPassword,
      portal_login_url: input.portalLoginUrl,
      site_name: 'GateRank',
    });
    if (!rendered) {
      throw new HttpError(409, 'SMTP_TEMPLATE_DISABLED', '申请人密码重置邮件模板未启用');
    }
    await this.sendWithConfig(config, {
      to: input.to,
      subject: rendered.subject,
      text: rendered.body,
    });
  }

  async sendApplicationApprovedEmail(input: {
    to: string;
    airportName: string;
  }): Promise<void> {
    const config = await this.requireConfigured();
    const rendered = renderConfiguredTemplate(config, 'application_approved', {
      airport_name: input.airportName,
      applicant_email: input.to,
      site_name: 'GateRank',
    });
    if (!rendered) {
      return;
    }
    await this.sendWithConfig(config, {
      to: input.to,
      subject: rendered.subject,
      text: rendered.body,
    });
  }

  async sendApplicationReplyEmail(input: {
    to: string;
    airportName: string;
    replyBody: string;
    adminTelegramUsername: string;
    adminTelegramUrl: string;
    portalLoginUrl: string;
  }): Promise<void> {
    const config = await this.requireConfigured();
    const rendered = renderConfiguredTemplate(config, 'application_reply', {
      airport_name: input.airportName,
      applicant_email: input.to,
      reply_body: input.replyBody,
      admin_telegram_username: input.adminTelegramUsername,
      admin_telegram_url: input.adminTelegramUrl,
      portal_login_url: input.portalLoginUrl,
      site_name: 'GateRank',
    });
    if (!rendered) {
      return;
    }
    await this.sendWithConfig(config, {
      to: input.to,
      subject: rendered.subject,
      text: rendered.body,
    });
  }

  async sendApplicantEmailChangeCodeEmail(input: {
    to: string;
    code: string;
    expiresInMinutes: number;
  }): Promise<void> {
    const config = await this.requireConfigured();
    await this.sendWithConfig(config, {
      to: input.to,
      subject: 'GateRank 申请人后台邮箱验证码',
      text: [
        '您好，您正在修改 GateRank 申请人后台登录邮箱。',
        '',
        `验证码：${input.code}`,
        `有效期：${input.expiresInMinutes} 分钟`,
        '',
        '如果这不是您本人操作，请忽略本邮件。',
      ].join('\n'),
    });
  }

  async sendAdExpiryReminderEmail(input: {
    to: string;
    portalLoginUrl: string;
    campaigns: Array<{
      campaignId: number;
      airportName: string;
      placementLabel: string;
      endsAt: string;
      daysRemaining: 1 | 2 | 3;
    }>;
  }): Promise<'sent' | 'disabled'> {
    const config = await this.smtpSettingsService.getConfig();
    const template = config.templates.ad_expiry_reminder;
    if (!config.enabled || !template.enabled) {
      return 'disabled';
    }
    if (!config.host || !config.username || !config.password || !config.from_email) {
      throw new HttpError(409, 'SMTP_NOT_CONFIGURED', 'SMTP 配置不完整');
    }

    const campaignItems = input.campaigns.map(renderAdExpiryCampaignRow).join('');
    const subject = replaceTemplateVariables(template.subject, {
      campaign_count: String(input.campaigns.length),
      applicant_email: input.to,
      portal_login_url: input.portalLoginUrl,
      site_name: 'GateRank',
    });
    const html = replaceTemplateVariables(template.body, {
      campaign_count: escapeHtml(String(input.campaigns.length)),
      campaign_items: campaignItems,
      applicant_email: escapeHtml(input.to),
      portal_login_url: escapeHtml(input.portalLoginUrl),
      site_name: 'GateRank',
    });
    const text = renderAdExpiryPlainText(input.campaigns, input.portalLoginUrl);
    await this.sendWithConfig(config, { to: input.to, subject, text, html });
    return 'sent';
  }

  async sendLowBalanceWarningEmail(input: {
    to: string;
    airportName: string;
    balance: number;
    thresholdAmount: number;
  }): Promise<void> {
    await this.sendBillingTemplateEmail('low_balance_warning', input);
  }

  async sendAirportAutoUnlistedEmail(input: {
    to: string;
    airportName: string;
    balance: number;
    thresholdAmount: number;
  }): Promise<void> {
    await this.sendBillingTemplateEmail('airport_auto_unlisted', input);
  }

  async sendAirportOnlineEmail(input: {
    to: string;
    airportName: string;
    balance: number;
    thresholdAmount: number;
  }): Promise<void> {
    await this.sendBillingTemplateEmail('airport_online', input);
  }

  private async sendBillingTemplateEmail(
    templateKey: Extract<SmtpTemplateKey, 'low_balance_warning' | 'airport_auto_unlisted' | 'airport_online'>,
    input: {
      to: string;
      airportName: string;
      balance: number;
      thresholdAmount: number;
    },
  ): Promise<void> {
    const config = await this.requireConfigured();
    const rendered = renderConfiguredTemplate(config, templateKey, {
      airport_name: input.airportName,
      applicant_email: input.to,
      current_balance: input.balance.toFixed(2),
      threshold_amount: input.thresholdAmount.toFixed(2),
      site_name: 'GateRank',
    });
    if (!rendered) {
      return;
    }
    await this.sendWithConfig(config, {
      to: input.to,
      subject: rendered.subject,
      text: rendered.body,
    });
  }

  private async resolveConfig(input: SmtpSettingsInput): Promise<SmtpConfig> {
    const base = await this.smtpSettingsService.getConfig();
    return {
      enabled: input.enabled === undefined ? base.enabled : Boolean(input.enabled),
      host: input.host === undefined ? base.host : String(input.host || '').trim(),
      port: input.port === undefined ? base.port : Number(input.port || 0) || base.port,
      secure: input.secure === undefined ? base.secure : Boolean(input.secure),
      username: input.username === undefined ? base.username : String(input.username || '').trim(),
      password: input.password === undefined ? base.password : String(input.password || '').trim(),
      from_name: input.from_name === undefined ? base.from_name : String(input.from_name || '').trim(),
      from_email: input.from_email === undefined ? base.from_email : String(input.from_email || '').trim(),
      reply_to: input.reply_to === undefined ? base.reply_to : String(input.reply_to || '').trim(),
      templates: base.templates,
    };
  }

  private async requireConfigured(): Promise<SmtpConfig> {
    const config = await this.smtpSettingsService.getConfig();
    if (!config.enabled) {
      throw new HttpError(409, 'SMTP_NOT_ENABLED', 'SMTP 邮件发送未启用');
    }
    if (!config.host || !config.username || !config.password || !config.from_email) {
      throw new HttpError(409, 'SMTP_NOT_CONFIGURED', 'SMTP 配置不完整');
    }
    return config;
  }

  private async sendWithConfig(
    config: SmtpConfig,
    input: { to: string; subject: string; text: string; html?: string },
  ): Promise<void> {
    try {
      const transporter = this.transportFactory({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.username,
          pass: config.password,
        },
      });

      await transporter.sendMail({
        from: config.from_name
          ? `"${config.from_name.replace(/"/g, '\\"')}" <${config.from_email}>`
          : config.from_email,
        to: input.to,
        replyTo: config.reply_to || undefined,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    } catch (error) {
      throw normalizeSmtpSendError(error);
    }
  }
}

function renderAdExpiryCampaignRow(campaign: {
  airportName: string;
  placementLabel: string;
  endsAt: string;
  daysRemaining: 1 | 2 | 3;
}): string {
  return [
    '<tr><td style="padding:16px;border:1px solid #e5e5e5;border-radius:12px;background:#fafafa;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>',
    `<td style="font-weight:700;color:#171717;">${escapeHtml(campaign.airportName)}</td>`,
    `<td align="right" style="font-weight:700;color:#dc2626;white-space:nowrap;">还剩 ${campaign.daysRemaining} 天</td>`,
    '</tr></table>',
    `<div style="margin-top:7px;color:#525252;font-size:14px;">${escapeHtml(campaign.placementLabel)}</div>`,
    `<div style="margin-top:4px;color:#737373;font-size:13px;">到期时间：${escapeHtml(formatAdExpiryDate(campaign.endsAt))}</div>`,
    '</td></tr>',
  ].join('');
}

function renderAdExpiryPlainText(
  campaigns: Array<{ airportName: string; placementLabel: string; endsAt: string; daysRemaining: 1 | 2 | 3 }>,
  portalLoginUrl: string,
): string {
  return [
    `您好，您有 ${campaigns.length} 项 GateRank 广告将在 3 天内到期，请及时续费。`,
    '',
    ...campaigns.flatMap((campaign, index) => [
      `${index + 1}. ${campaign.airportName} · ${campaign.placementLabel}`,
      `   到期时间：${formatAdExpiryDate(campaign.endsAt)}（还剩 ${campaign.daysRemaining} 天）`,
    ]),
    '',
    `登录申请人后台：${portalLoginUrl}`,
    '',
    '续费操作指引：',
    '1. 登录申请人后台',
    '2. 打开“广告管理”',
    '3. 选择对应广告续费并完成支付',
    '',
    '如已完成续费，请忽略本邮件。',
  ].join('\n');
}

function formatAdExpiryDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderTemplate(
  template: SmtpTemplateConfigItem,
  variables: Record<string, string>,
): { subject: string; body: string } {
  return {
    subject: replaceTemplateVariables(template.subject, variables),
    body: replaceTemplateVariables(template.body, variables),
  };
}

function renderConfiguredTemplate(
  config: SmtpConfig,
  templateKey: SmtpTemplateKey,
  variables: Record<string, string>,
): { subject: string; body: string } | null {
  const template = config.templates[templateKey];
  if (!template.enabled) {
    return null;
  }
  return renderTemplate(template, variables);
}

function replaceTemplateVariables(template: string, variables: Record<string, string>): string {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    return variables[key] ?? '';
  });
}

function normalizeSmtpSendError(error: unknown): SmtpSendError {
  if (error instanceof SmtpSendError) {
    return error;
  }
  if (error instanceof HttpError) {
    return new SmtpSendError(error.message, error.status);
  }

  const detail = toSmtpErrorDetail(error);
  const code = normalizeErrorCode(detail.code);
  const responseCode = toPositiveInteger(detail.responseCode);
  const rawDetail = firstNonEmptyString(detail.response, detail.message);
  const normalizedDetail = sanitizeSmtpDetail(rawDetail);
  const suffix = normalizedDetail ? `：${normalizedDetail}` : '';

  if (code === 'EAUTH' || responseCode === 535) {
    return new SmtpSendError(`SMTP 认证失败，请检查用户名和密码${suffix}`, 400);
  }

  if (code === 'ETIMEDOUT' || code === 'ECONNECTION') {
    return new SmtpSendError(`SMTP 连接超时，请检查 Host、端口和网络连通性${suffix}`, 504);
  }

  if (
    code === 'ESOCKET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EHOSTUNREACH' ||
    code === 'ECONNRESET'
  ) {
    return new SmtpSendError(`SMTP 服务器连接失败，请检查 Host、端口和安全连接配置${suffix}`, 502);
  }

  if (code === 'EENVELOPE') {
    return new SmtpSendError(`SMTP 发件人或收件人地址无效${suffix}`, 400);
  }

  if (code === 'EMESSAGE') {
    return new SmtpSendError(`SMTP 邮件内容无效${suffix}`, 400);
  }

  return new SmtpSendError(`SMTP 发送失败${suffix}`, 502);
}

function toSmtpErrorDetail(error: unknown): SmtpTransportError {
  if (!error || typeof error !== 'object') {
    return {};
  }
  return error as SmtpTransportError;
}

function normalizeErrorCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function toPositiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function firstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

function sanitizeSmtpDetail(value: string): string {
  if (!value) {
    return '';
  }

  return value
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 240);
}
