import type {
  AdExpiryReminderDelivery,
  DeliveryWriteInput,
  DueAdCampaign,
} from '../repositories/adExpiryReminderRepository';

interface AdExpiryReminderServiceDeps {
  repository: {
    listDueCampaigns(reminderDate: string): Promise<DueAdCampaign[]>;
    getDelivery(applicantAccountId: number, reminderDate: string): Promise<AdExpiryReminderDelivery | null>;
    markSucceeded(input: DeliveryWriteInput): Promise<void>;
    markFailed(input: DeliveryWriteInput & { error: string }): Promise<void>;
  };
  mailService: {
    sendAdExpiryReminderEmail(input: {
      to: string;
      portalLoginUrl: string;
      campaigns: Array<{
        campaignId: number;
        airportName: string;
        placementLabel: string;
        endsAt: string;
        daysRemaining: 1 | 2 | 3;
      }>;
    }): Promise<'sent' | 'disabled'>;
  };
}

export interface AdExpiryReminderRunResult {
  candidate_campaign_count: number;
  applicant_count: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  failures: Array<{ applicant_account_id: number; applicant_email: string; error: string }>;
}

export class AdExpiryReminderService {
  constructor(private readonly deps: AdExpiryReminderServiceDeps) {}

  async run(reminderDate: string, portalLoginUrl: string): Promise<AdExpiryReminderRunResult> {
    const campaigns = await this.deps.repository.listDueCampaigns(reminderDate);
    const groups = groupCampaignsByApplicant(campaigns);
    const result: AdExpiryReminderRunResult = {
      candidate_campaign_count: campaigns.length,
      applicant_count: groups.length,
      success_count: 0,
      failure_count: 0,
      skipped_count: 0,
      failures: [],
    };

    for (const group of groups) {
      const delivery = await this.deps.repository.getDelivery(group.applicantAccountId, reminderDate);
      if (delivery?.status === 'succeeded') {
        result.skipped_count += 1;
        continue;
      }

      const writeInput: DeliveryWriteInput = {
        applicantAccountId: group.applicantAccountId,
        reminderDate,
        recipientEmail: group.applicantEmail,
        campaignCount: group.campaigns.length,
      };
      try {
        const sendResult = await this.deps.mailService.sendAdExpiryReminderEmail({
          to: group.applicantEmail,
          portalLoginUrl,
          campaigns: group.campaigns.map((campaign) => ({
            campaignId: campaign.campaign_id,
            airportName: campaign.airport_name,
            placementLabel: campaign.placement_label,
            endsAt: campaign.ends_at,
            daysRemaining: campaign.days_remaining,
          })),
        });
        if (sendResult === 'disabled') {
          result.skipped_count += 1;
          continue;
        }
        await this.deps.repository.markSucceeded(writeInput);
        result.success_count += 1;
      } catch (error) {
        const message = sanitizeFailure(error);
        await this.deps.repository.markFailed({ ...writeInput, error: message });
        result.failure_count += 1;
        result.failures.push({
          applicant_account_id: group.applicantAccountId,
          applicant_email: group.applicantEmail,
          error: message,
        });
      }
    }

    return result;
  }
}

function groupCampaignsByApplicant(campaigns: DueAdCampaign[]): Array<{
  applicantAccountId: number;
  applicantEmail: string;
  campaigns: DueAdCampaign[];
}> {
  const groups = new Map<number, { applicantEmail: string; campaigns: DueAdCampaign[] }>();
  for (const campaign of campaigns) {
    const current = groups.get(campaign.applicant_account_id);
    if (current) {
      current.campaigns.push(campaign);
    } else {
      groups.set(campaign.applicant_account_id, {
        applicantEmail: campaign.applicant_email,
        campaigns: [campaign],
      });
    }
  }
  return Array.from(groups.entries()).map(([applicantAccountId, group]) => ({
    applicantAccountId,
    applicantEmail: group.applicantEmail,
    campaigns: group.campaigns.sort((left, right) => (
      left.days_remaining - right.days_remaining
      || left.ends_at.localeCompare(right.ends_at)
      || left.campaign_id - right.campaign_id
    )),
  }));
}

function sanitizeFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500) || 'unknown error';
}
