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
  assert.match(view.templates.applicant_credentials.subject, /账号已开通/);
  assert.match(view.templates.application_approved.subject, /审批通过通知/);
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
  assert.match(view.templates.application_approved.subject, /审批通过通知/);
});
