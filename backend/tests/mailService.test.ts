import test from 'node:test';
import assert from 'node:assert/strict';
import { MailService, SmtpSendError } from '../src/services/mailService';
import type { SmtpTemplateConfig } from '../src/services/smtpSettingsService';

function createTemplates(
  overrides: Partial<Record<keyof SmtpTemplateConfig, Partial<SmtpTemplateConfig[keyof SmtpTemplateConfig]>>> = {},
): SmtpTemplateConfig {
  return {
    applicant_credentials: {
      enabled: true,
      subject: '账号开通 - {{airport_name}}',
      body: '您好，{{airport_name}}。',
      ...overrides.applicant_credentials,
    },
    applicant_password_reset: {
      enabled: true,
      subject: '密码重置 - {{airport_name}}',
      body: '邮箱：{{portal_email}}，新密码：{{new_password}}，地址：{{portal_login_url}}',
      ...overrides.applicant_password_reset,
    },
    application_approved: {
      enabled: true,
      subject: '审批通过 - {{airport_name}}',
      body: '您好，{{airport_name}} 审批已通过。',
      ...overrides.application_approved,
    },
    application_reply: {
      enabled: true,
      subject: '申请回复 - {{airport_name}}',
      body: '回复：{{reply_body}}',
      ...overrides.application_reply,
    },
    low_balance_warning: {
      enabled: true,
      subject: '余额提醒 - {{airport_name}}',
      body: '余额：{{current_balance}}',
      ...overrides.low_balance_warning,
    },
    airport_auto_unlisted: {
      enabled: true,
      subject: '下线提醒 - {{airport_name}}',
      body: '余额：{{current_balance}}',
      ...overrides.airport_auto_unlisted,
    },
    airport_online: {
      enabled: true,
      subject: '上线通知 - {{airport_name}}',
      body: '余额：{{current_balance}}',
      ...overrides.airport_online,
    },
  };
}

test('MailService renders applicant credential template variables', async () => {
  const sent: Array<Record<string, unknown>> = [];
  const service = new MailService({
    smtpSettingsService: {
      getConfig: async () => ({
        enabled: true,
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        username: 'mailer',
        password: 'secret',
        from_name: 'GateRank',
        from_email: 'noreply@example.com',
        reply_to: 'support@example.com',
        templates: createTemplates({
          applicant_credentials: {
            subject: '账号开通 - {{airport_name}}',
            body: [
              '邮箱：{{portal_email}}',
              '密码：{{initial_password}}',
              '地址：{{portal_login_url}}',
            ].join('\n'),
          },
        }),
      }),
    },
    transportFactory: (() => ({
      sendMail: async (payload: Record<string, unknown>) => {
        sent.push(payload);
      },
    })) as never,
  });

  await service.sendApplicantCredentialsEmail({
    to: 'user@example.com',
    airportName: '大象网络',
    portalEmail: 'user@example.com',
    initialPassword: 'Passw0rd!',
    portalLoginUrl: 'https://gaterank.example.com/portal',
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.subject, '账号开通 - 大象网络');
  assert.match(String(sent[0]?.text || ''), /邮箱：user@example\.com/);
  assert.match(String(sent[0]?.text || ''), /密码：Passw0rd!/);
  assert.match(String(sent[0]?.text || ''), /地址：https:\/\/gaterank\.example\.com\/portal/);
});

test('MailService renders application approved template variables', async () => {
  const sent: Array<Record<string, unknown>> = [];
  const service = new MailService({
    smtpSettingsService: {
      getConfig: async () => ({
        enabled: true,
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        username: 'mailer',
        password: 'secret',
        from_name: 'GateRank',
        from_email: 'noreply@example.com',
        reply_to: '',
        templates: createTemplates({
          application_approved: {
            subject: '审批通过 - {{airport_name}}',
            body: '您好，{{airport_name}} 审批已通过。',
          },
        }),
      }),
    },
    transportFactory: (() => ({
      sendMail: async (payload: Record<string, unknown>) => {
        sent.push(payload);
      },
    })) as never,
  });

  await service.sendApplicationApprovedEmail({
    to: 'user@example.com',
    airportName: '大象网络',
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.subject, '审批通过 - 大象网络');
  assert.match(String(sent[0]?.text || ''), /大象网络 审批已通过/);
});

test('MailService renders applicant password reset template variables', async () => {
  const sent: Array<Record<string, unknown>> = [];
  const service = new MailService({
    smtpSettingsService: {
      getConfig: async () => ({
        enabled: true,
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        username: 'mailer',
        password: 'secret',
        from_name: 'GateRank',
        from_email: 'noreply@example.com',
        reply_to: '',
        templates: createTemplates({
          applicant_password_reset: {
            subject: '密码重置 - {{airport_name}}',
            body: [
              '申请邮箱：{{applicant_email}}',
              '登录邮箱：{{portal_email}}',
              '新密码：{{new_password}}',
              '后台：{{portal_login_url}}',
            ].join('\n'),
          },
        }),
      }),
    },
    transportFactory: (() => ({
      sendMail: async (payload: Record<string, unknown>) => {
        sent.push(payload);
      },
    })) as never,
  });

  await service.sendApplicantPasswordResetEmail({
    to: 'user@example.com',
    airportName: '大象网络',
    portalEmail: 'login@example.com',
    newPassword: 'NewPassw0rd!',
    portalLoginUrl: 'https://gaterank.example.com/portal',
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.subject, '密码重置 - 大象网络');
  assert.match(String(sent[0]?.text || ''), /申请邮箱：user@example\.com/);
  assert.match(String(sent[0]?.text || ''), /登录邮箱：login@example\.com/);
  assert.match(String(sent[0]?.text || ''), /新密码：NewPassw0rd!/);
  assert.match(String(sent[0]?.text || ''), /后台：https:\/\/gaterank\.example\.com\/portal/);
});

test('MailService rejects disabled applicant password reset template', async () => {
  const sent: Array<Record<string, unknown>> = [];
  const service = new MailService({
    smtpSettingsService: {
      getConfig: async () => ({
        enabled: true,
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        username: 'mailer',
        password: 'secret',
        from_name: 'GateRank',
        from_email: 'noreply@example.com',
        reply_to: '',
        templates: createTemplates({
          applicant_password_reset: {
            enabled: false,
          },
        }),
      }),
    },
    transportFactory: (() => ({
      sendMail: async (payload: Record<string, unknown>) => {
        sent.push(payload);
      },
    })) as never,
  });

  await assert.rejects(
    () =>
      service.sendApplicantPasswordResetEmail({
        to: 'user@example.com',
        airportName: '大象网络',
        portalEmail: 'user@example.com',
        newPassword: 'NewPassw0rd!',
        portalLoginUrl: 'https://gaterank.example.com/portal',
      }),
    (error: unknown) => {
      assert.equal((error as { status?: number }).status, 409);
      assert.equal((error as { code?: string }).code, 'SMTP_TEMPLATE_DISABLED');
      return true;
    },
  );
  assert.equal(sent.length, 0);
});

test('MailService renders application reply template variables', async () => {
  const sent: Array<Record<string, unknown>> = [];
  const service = new MailService({
    smtpSettingsService: {
      getConfig: async () => ({
        enabled: true,
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        username: 'mailer',
        password: 'secret',
        from_name: 'GateRank',
        from_email: 'noreply@example.com',
        reply_to: '',
        templates: createTemplates({
          application_reply: {
            subject: '申请回复 - {{airport_name}}',
            body: [
              '邮箱：{{applicant_email}}',
              '内容：{{reply_body}}',
              '本邮箱仅用于系统发信，无法接收回复。',
              'Telegram：{{admin_telegram_username}}',
              'Telegram 链接：{{admin_telegram_url}}',
              '后台：{{portal_login_url}}',
            ].join('\n'),
          },
        }),
      }),
    },
    transportFactory: (() => ({
      sendMail: async (payload: Record<string, unknown>) => {
        sent.push(payload);
      },
    })) as never,
  });

  await service.sendApplicationReplyEmail({
    to: 'user@example.com',
    airportName: '大象网络',
    replyBody: '请补充测试账号。',
    adminTelegramUsername: '@gaterank_admin',
    adminTelegramUrl: 'https://t.me/gaterank_admin',
    portalLoginUrl: 'https://gaterank.example.com/portal',
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.subject, '申请回复 - 大象网络');
  assert.match(String(sent[0]?.text || ''), /邮箱：user@example\.com/);
  assert.match(String(sent[0]?.text || ''), /内容：请补充测试账号。/);
  assert.match(String(sent[0]?.text || ''), /本邮箱仅用于系统发信，无法接收回复。/);
  assert.match(String(sent[0]?.text || ''), /Telegram：@gaterank_admin/);
  assert.match(String(sent[0]?.text || ''), /Telegram 链接：https:\/\/t\.me\/gaterank_admin/);
  assert.match(String(sent[0]?.text || ''), /后台：https:\/\/gaterank\.example\.com\/portal/);
  assert.doesNotMatch(String(sent[0]?.text || ''), /回复本邮件|直接回复本邮件/);
});

test('MailService skips disabled template without sending', async () => {
  const sent: Array<Record<string, unknown>> = [];
  const service = new MailService({
    smtpSettingsService: {
      getConfig: async () => ({
        enabled: true,
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        username: 'mailer',
        password: 'secret',
        from_name: 'GateRank',
        from_email: 'noreply@example.com',
        reply_to: '',
        templates: createTemplates({
          low_balance_warning: {
            enabled: false,
            subject: '余额提醒 - {{airport_name}}',
            body: '余额：{{current_balance}}',
          },
        }),
      }),
    },
    transportFactory: (() => ({
      sendMail: async (payload: Record<string, unknown>) => {
        sent.push(payload);
      },
    })) as never,
  });

  await service.sendLowBalanceWarningEmail({
    to: 'user@example.com',
    airportName: '大象网络',
    balance: 18.5,
    thresholdAmount: 30,
  });

  assert.equal(sent.length, 0);
});

test('MailService renders billing notification variables', async () => {
  const sent: Array<Record<string, unknown>> = [];
  const service = new MailService({
    smtpSettingsService: {
      getConfig: async () => ({
        enabled: true,
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        username: 'mailer',
        password: 'secret',
        from_name: 'GateRank',
        from_email: 'noreply@example.com',
        reply_to: '',
        templates: createTemplates({
          airport_online: {
            subject: '上线通知 - {{airport_name}}',
            body: '您好，{{airport_name}} 已上线，余额 {{current_balance}}，阈值 {{threshold_amount}}。',
          },
        }),
      }),
    },
    transportFactory: (() => ({
      sendMail: async (payload: Record<string, unknown>) => {
        sent.push(payload);
      },
    })) as never,
  });

  await service.sendAirportOnlineEmail({
    to: 'user@example.com',
    airportName: '大象网络',
    balance: 120,
    thresholdAmount: 30,
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.subject, '上线通知 - 大象网络');
  assert.match(String(sent[0]?.text || ''), /余额 120\.00/);
  assert.match(String(sent[0]?.text || ''), /阈值 30\.00/);
});

test('MailService normalizes SMTP auth errors for test mail', async () => {
  const service = new MailService({
    smtpSettingsService: {
      getConfig: async () => ({
        enabled: true,
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        username: 'mailer',
        password: 'secret',
        from_name: 'GateRank',
        from_email: 'noreply@example.com',
        reply_to: '',
        templates: createTemplates(),
      }),
    },
    transportFactory: (() => ({
      sendMail: async () => {
        const error = new Error('Invalid login: 535 Authentication failed') as Error & {
          code?: string;
          responseCode?: number;
        };
        error.code = 'EAUTH';
        error.responseCode = 535;
        throw error;
      },
    })) as never,
  });

  await assert.rejects(
    () =>
      service.sendTestMail({
        enabled: true,
        host: 'smtp.example.com',
        port: 465,
        secure: true,
        username: 'mailer',
        password: 'secret',
        from_name: 'GateRank',
        from_email: 'noreply@example.com',
        reply_to: '',
        test_to: 'user@example.com',
      }),
    (error: unknown) => {
      assert.ok(error instanceof SmtpSendError);
      assert.equal(error.status, 400);
      assert.match(error.message, /SMTP 认证失败/);
      assert.match(error.message, /Invalid login/);
      return true;
    },
  );
});
