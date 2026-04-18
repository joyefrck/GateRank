import nodemailer from 'nodemailer';
import { HttpError } from '../middleware/errorHandler';
import type {
  SmtpConfig,
  SmtpSettingsInput,
  SmtpSettingsService,
  SmtpTemplateConfigItem,
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
    const rendered = renderTemplate(config.templates.applicant_credentials, {
      airport_name: input.airportName,
      applicant_email: input.to,
      portal_email: input.portalEmail,
      initial_password: input.initialPassword,
      portal_login_url: input.portalLoginUrl,
      site_name: 'GateRank',
    });
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
    const rendered = renderTemplate(config.templates.application_approved, {
      airport_name: input.airportName,
      applicant_email: input.to,
      site_name: 'GateRank',
    });
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
    input: { to: string; subject: string; text: string },
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
      });
    } catch (error) {
      throw normalizeSmtpSendError(error);
    }
  }
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
