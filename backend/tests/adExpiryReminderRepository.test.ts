import test from 'node:test';
import assert from 'node:assert/strict';
import { AdExpiryReminderRepository } from '../src/repositories/adExpiryReminderRepository';

test('AdExpiryReminderRepository creates an idempotent daily delivery table', async () => {
  const queries: string[] = [];
  const repository = new AdExpiryReminderRepository({
    query: async (sql: string) => {
      queries.push(sql);
      return [[]];
    },
    execute: async () => [{ affectedRows: 1 }],
  } as never);

  await repository.ensureSchema();

  const schema = queries.find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS ad_expiry_reminder_deliveries')) || '';
  assert.match(schema, /UNIQUE KEY uk_ad_expiry_reminder_daily \(applicant_account_id, reminder_date\)/);
  assert.match(schema, /status ENUM\('succeeded', 'failed'\)/);
  assert.doesNotMatch(schema, /body|html|subject/);
});

test('AdExpiryReminderRepository lists only active campaigns due in one to three Shanghai calendar days', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AdExpiryReminderRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [[{
        campaign_id: 91,
        applicant_account_id: 7,
        applicant_email: 'owner@example.com',
        airport_name: '大象 & 网络',
        home_slot: 2,
        ends_at: '2026-09-01 00:02:02',
        days_remaining: 3,
      }]];
    },
    execute: async () => [{ affectedRows: 1 }],
  } as never);

  const items = await repository.listDueCampaigns('2026-08-29');

  assert.deepEqual(items, [{
    campaign_id: 91,
    applicant_account_id: 7,
    applicant_email: 'owner@example.com',
    airport_name: '大象 & 网络',
    placement_label: '首页广告位 2',
    ends_at: '2026-09-01T00:02:02+08:00',
    days_remaining: 3,
  }]);
  assert.match(calls[0]?.sql || '', /campaign\.status = 'active'/);
  assert.match(calls[0]?.sql || '', /DATEDIFF\(DATE\(campaign\.ends_at\), \?\) BETWEEN 1 AND 3/);
  assert.deepEqual(calls[0]?.params, ['2026-08-29', '2026-08-29']);
});

test('AdExpiryReminderRepository reads and upserts delivery state without message content', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new AdExpiryReminderRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM ad_expiry_reminder_deliveries')) {
        return [[{
          applicant_account_id: 7,
          reminder_date: '2026-08-29',
          status: 'failed',
          attempt_count: 1,
          last_error: 'timeout',
          sent_at: null,
        }]];
      }
      return [[]];
    },
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [{ affectedRows: 1 }];
    },
  } as never);

  const delivery = await repository.getDelivery(7, '2026-08-29');
  await repository.markFailed({
    applicantAccountId: 7,
    reminderDate: '2026-08-29',
    recipientEmail: 'owner@example.com',
    campaignCount: 2,
    error: 'SMTP timeout',
  });
  await repository.markSucceeded({
    applicantAccountId: 7,
    reminderDate: '2026-08-29',
    recipientEmail: 'owner@example.com',
    campaignCount: 2,
  });

  assert.equal(delivery?.status, 'failed');
  assert.ok(calls.some((call) => call.sql.includes("status = 'failed'") && call.sql.includes('attempt_count = attempt_count + 1')));
  assert.ok(calls.some((call) => call.sql.includes("status = 'succeeded'") && call.sql.includes('sent_at = NOW()')));
  assert.ok(calls.every((call) => !/message_body|html_body|subject/.test(call.sql)));
});
