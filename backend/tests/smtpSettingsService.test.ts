import test from 'node:test';
import assert from 'node:assert/strict';
import { SmtpSettingsService } from '../src/services/smtpSettingsService';

test('SmtpSettingsService returns default view', async () => {
  const service = new SmtpSettingsService({
    systemSettingRepository: {
      getByKey: async () => null,
      upsert: async () => undefined,
    },
  });

  const view = await service.getAdminSettings();
  assert.equal(view.enabled, false);
  assert.equal(view.host, '');
  assert.equal(view.has_password, false);
  assert.equal(view.from_name, 'GateRank');
  assert.equal(view.templates.applicant_credentials.enabled, true);
  assert.match(view.templates.applicant_credentials.subject, /账号已开通/);
  assert.equal(view.templates.applicant_password_reset.enabled, true);
  assert.match(view.templates.applicant_password_reset.subject, /密码已重置/);
  assert.match(view.templates.applicant_password_reset.body, /\{\{new_password\}\}/);
  assert.match(view.templates.application_approved.subject, /审批通过通知/);
  assert.match(view.templates.application_reply.subject, /入驻申请回复/);
  assert.match(view.templates.application_reply.body, /本邮箱仅用于系统发信，无法接收回复/);
  assert.match(view.templates.application_reply.body, /\{\{admin_telegram_username\}\}/);
  assert.match(view.templates.application_reply.body, /\{\{portal_login_url\}\}/);
  assert.doesNotMatch(view.templates.application_reply.body, /回复本邮件|直接回复本邮件/);
  assert.match(view.templates.low_balance_warning.subject, /余额提醒/);
  assert.match(view.templates.airport_auto_unlisted.subject, /下线提醒/);
  assert.match(view.templates.airport_online.subject, /上线通知/);
});

test('SmtpSettingsService saves and masks password', async () => {
  let storedValue: unknown = null;
  const service = new SmtpSettingsService({
    systemSettingRepository: {
      getByKey: async () => storedValue
        ? {
          setting_key: 'smtp_mail',
          value_json: storedValue,
          updated_by: 'admin',
          created_at: '2026-04-18 10:00:00',
          updated_at: '2026-04-18 10:00:00',
        }
        : null,
      upsert: async (_settingKey, value) => {
        storedValue = value;
      },
    },
  });

  const view = await service.updateAdminSettings({
    enabled: true,
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    username: 'mailer',
    password: 'smtp-secret-password',
    from_name: 'GateRank Mail',
    from_email: 'noreply@example.com',
    templates: {
      applicant_credentials: {
        subject: '欢迎入驻 - {{airport_name}}',
        body: '账号：{{portal_email}}',
      },
    },
  }, 'admin');

  assert.equal(view.enabled, true);
  assert.equal(view.host, 'smtp.example.com');
  assert.equal(view.port, 587);
  assert.equal(view.has_password, true);
  assert.ok(view.password_masked);
  assert.equal(view.templates.applicant_credentials.subject, '欢迎入驻 - {{airport_name}}');
  assert.equal(view.templates.applicant_credentials.body, '账号：{{portal_email}}');
  assert.equal(view.templates.applicant_credentials.enabled, true);
  assert.match(view.templates.applicant_password_reset.subject, /密码已重置/);
  assert.match(view.templates.applicant_password_reset.body, /\{\{new_password\}\}/);
  assert.match(view.templates.application_approved.subject, /审批通过通知/);
  assert.match(view.templates.application_reply.subject, /入驻申请回复/);
  assert.equal(view.templates.low_balance_warning.enabled, true);
});

test('SmtpSettingsService upgrades stored old default application reply template', async () => {
  const oldApplicationReplyBody = [
    '您好，{{airport_name}} 的 GateRank 入驻申请有新的回复。',
    '',
    '{{reply_body}}',
    '',
    '如需继续沟通，请直接回复本邮件或联系 GateRank 管理员。',
  ].join('\n');
  const service = new SmtpSettingsService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'smtp_mail',
        value_json: {
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
            application_reply: {
              enabled: false,
              subject: 'GateRank 入驻申请回复 - {{airport_name}}',
              body: oldApplicationReplyBody,
            },
          },
        },
        updated_by: 'admin',
        created_at: '2026-04-18 10:00:00',
        updated_at: '2026-04-18 10:00:00',
      }),
      upsert: async () => undefined,
    },
  });

  const view = await service.getAdminSettings();

  assert.equal(view.templates.application_reply.enabled, false);
  assert.match(view.templates.application_reply.body, /本邮箱仅用于系统发信，无法接收回复/);
  assert.match(view.templates.application_reply.body, /\{\{admin_telegram_url\}\}/);
  assert.match(view.templates.application_reply.body, /\{\{portal_login_url\}\}/);
  assert.doesNotMatch(view.templates.application_reply.body, /直接回复本邮件/);
});

test('SmtpSettingsService preserves customized application reply template', async () => {
  const customBody = '自定义回复：{{reply_body}}';
  const service = new SmtpSettingsService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'smtp_mail',
        value_json: {
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
            application_reply: {
              enabled: true,
              subject: '自定义主题 - {{airport_name}}',
              body: customBody,
            },
          },
        },
        updated_by: 'admin',
        created_at: '2026-04-18 10:00:00',
        updated_at: '2026-04-18 10:00:00',
      }),
      upsert: async () => undefined,
    },
  });

  const view = await service.getAdminSettings();

  assert.equal(view.templates.application_reply.subject, '自定义主题 - {{airport_name}}');
  assert.equal(view.templates.application_reply.body, customBody);
});

test('SmtpSettingsService updates one template enabled flag without changing existing content', async () => {
  let storedValue: unknown = {
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
        body: '账号：{{portal_email}}',
      },
    },
  };
  const service = new SmtpSettingsService({
    systemSettingRepository: {
      getByKey: async () => ({
        setting_key: 'smtp_mail',
        value_json: storedValue,
        updated_by: 'admin',
        created_at: '2026-04-18 10:00:00',
        updated_at: '2026-04-18 10:00:00',
      }),
      upsert: async (_settingKey, value) => {
        storedValue = value;
      },
    },
  });

  const view = await service.updateTemplateEnabled('applicant_credentials', false, 'tester');

  assert.equal(view.templates.applicant_credentials.enabled, false);
  assert.equal(view.templates.applicant_credentials.subject, '账号开通 - {{airport_name}}');
  assert.equal(view.templates.application_reply.enabled, true);
  assert.equal(view.templates.low_balance_warning.enabled, true);
});
