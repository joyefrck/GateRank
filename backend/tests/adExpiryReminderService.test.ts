import test from 'node:test';
import assert from 'node:assert/strict';
import { AdExpiryReminderService } from '../src/services/adExpiryReminderService';
import type { DueAdCampaign } from '../src/repositories/adExpiryReminderRepository';

function campaign(overrides: Partial<DueAdCampaign> = {}): DueAdCampaign {
  return {
    campaign_id: 1,
    applicant_account_id: 7,
    applicant_email: 'owner@example.com',
    airport_name: '大象网络',
    placement_label: '首页广告位 1',
    ends_at: '2026-09-01T00:02:02+08:00',
    days_remaining: 3,
    ...overrides,
  };
}

test('AdExpiryReminderService merges campaigns by applicant and sends applicants independently', async () => {
  const sent: Array<{ to: string; campaigns: number[] }> = [];
  const succeeded: number[] = [];
  const failed: number[] = [];
  const service = new AdExpiryReminderService({
    repository: {
      listDueCampaigns: async () => [
        campaign({ campaign_id: 2, days_remaining: 1 }),
        campaign({ campaign_id: 1, days_remaining: 3 }),
        campaign({ campaign_id: 3, applicant_account_id: 8, applicant_email: 'other@example.com' }),
      ],
      getDelivery: async () => null,
      markSucceeded: async ({ applicantAccountId }) => { succeeded.push(applicantAccountId); },
      markFailed: async ({ applicantAccountId }) => { failed.push(applicantAccountId); },
    },
    mailService: {
      sendAdExpiryReminderEmail: async (input) => {
        sent.push({ to: input.to, campaigns: input.campaigns.map((item) => item.campaignId) });
        if (input.to === 'other@example.com') throw new Error('SMTP timeout\nsecret detail');
        return 'sent';
      },
    },
  });

  const result = await service.run('2026-08-29', 'https://gate-rank.com/portal');

  assert.deepEqual(sent, [
    { to: 'owner@example.com', campaigns: [2, 1] },
    { to: 'other@example.com', campaigns: [3] },
  ]);
  assert.deepEqual(succeeded, [7]);
  assert.deepEqual(failed, [8]);
  assert.deepEqual(result, {
    candidate_campaign_count: 3,
    applicant_count: 2,
    success_count: 1,
    failure_count: 1,
    skipped_count: 0,
    failures: [{ applicant_account_id: 8, applicant_email: 'other@example.com', error: 'SMTP timeout secret detail' }],
  });
});

test('AdExpiryReminderService skips successful deliveries and retries failed deliveries', async () => {
  const sent: string[] = [];
  const service = new AdExpiryReminderService({
    repository: {
      listDueCampaigns: async () => [
        campaign(),
        campaign({ campaign_id: 3, applicant_account_id: 8, applicant_email: 'retry@example.com' }),
      ],
      getDelivery: async (applicantAccountId) => applicantAccountId === 7
        ? { status: 'succeeded', attempt_count: 1 }
        : { status: 'failed', attempt_count: 1 },
      markSucceeded: async () => undefined,
      markFailed: async () => undefined,
    },
    mailService: {
      sendAdExpiryReminderEmail: async ({ to }) => {
        sent.push(to);
        return 'sent';
      },
    },
  });

  const result = await service.run('2026-08-29', 'https://gate-rank.com/portal');

  assert.deepEqual(sent, ['retry@example.com']);
  assert.equal(result.success_count, 1);
  assert.equal(result.skipped_count, 1);
  assert.equal(result.failure_count, 0);
});

test('AdExpiryReminderService treats a disabled template as skipped', async () => {
  let writes = 0;
  const service = new AdExpiryReminderService({
    repository: {
      listDueCampaigns: async () => [campaign()],
      getDelivery: async () => null,
      markSucceeded: async () => { writes += 1; },
      markFailed: async () => { writes += 1; },
    },
    mailService: {
      sendAdExpiryReminderEmail: async () => 'disabled',
    },
  });

  const result = await service.run('2026-08-29', 'https://gate-rank.com/portal');

  assert.equal(result.skipped_count, 1);
  assert.equal(result.success_count, 0);
  assert.equal(result.failure_count, 0);
  assert.equal(writes, 0);
});
