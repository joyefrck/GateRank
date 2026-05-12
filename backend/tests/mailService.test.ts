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
    application_approved: {
      enabled: true,
      subject: '审批通过 - {{airport_name}}',
      body: '您好，{{airport_name}} 审批已通过。',
      ...overrides.application_approved,
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
