import test from 'node:test';
import assert from 'node:assert/strict';
import { MailService, SmtpSendError } from '../src/services/mailService';

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
        templates: {
          applicant_credentials: {
            subject: '账号开通 - {{airport_name}}',
            body: [
              '邮箱：{{portal_email}}',
              '密码：{{initial_password}}',
              '地址：{{portal_login_url}}',
            ].join('\n'),
          },
          application_approved: {
            subject: '审批通过 - {{airport_name}}',
            body: '您好，{{airport_name}} 审批已通过。',
          },
        },
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
        templates: {
          applicant_credentials: {
            subject: '账号开通 - {{airport_name}}',
            body: '您好，{{airport_name}}。',
          },
          application_approved: {
            subject: '审批通过 - {{airport_name}}',
            body: '您好，{{airport_name}} 审批已通过。',
          },
        },
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
        templates: {
          applicant_credentials: {
            subject: '账号开通 - {{airport_name}}',
            body: '您好，{{airport_name}}。',
          },
          application_approved: {
            subject: '审批通过 - {{airport_name}}',
            body: '您好，{{airport_name}} 审批已通过。',
          },
        },
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
