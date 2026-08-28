import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

export interface DueAdCampaign {
  campaign_id: number;
  applicant_account_id: number;
  applicant_email: string;
  airport_name: string;
  placement_label: string;
  ends_at: string;
  days_remaining: 1 | 2 | 3;
}

export interface AdExpiryReminderDelivery {
  status: 'succeeded' | 'failed';
  attempt_count: number;
}

export interface DeliveryWriteInput {
  applicantAccountId: number;
  reminderDate: string;
  recipientEmail: string;
  campaignCount: number;
}

interface DueCampaignRow extends RowDataPacket {
  campaign_id: number;
  applicant_account_id: number;
  applicant_email: string;
  airport_name: string;
  home_slot: number | null;
  ends_at: string;
  days_remaining: number;
}

interface DeliveryRow extends RowDataPacket {
  status: 'succeeded' | 'failed';
  attempt_count: number;
}

export class AdExpiryReminderRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ad_expiry_reminder_deliveries (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        applicant_account_id BIGINT UNSIGNED NOT NULL,
        reminder_date DATE NOT NULL,
        recipient_email VARCHAR(255) NOT NULL,
        campaign_count INT UNSIGNED NOT NULL,
        status ENUM('succeeded', 'failed') NOT NULL,
        attempt_count INT UNSIGNED NOT NULL DEFAULT 1,
        last_error VARCHAR(500) NULL,
        sent_at DATETIME NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_ad_expiry_reminder_daily (applicant_account_id, reminder_date),
        INDEX idx_ad_expiry_reminder_date_status (reminder_date, status)
      )
    `);
  }

  async listDueCampaigns(reminderDate: string): Promise<DueAdCampaign[]> {
    const [rows] = await this.pool.query<DueCampaignRow[]>(
      `SELECT campaign.id AS campaign_id,
              campaign.applicant_account_id,
              account.email AS applicant_email,
              airport.name AS airport_name,
              campaign.home_slot,
              DATE_FORMAT(campaign.ends_at, '%Y-%m-%d %H:%i:%s') AS ends_at,
              DATEDIFF(DATE(campaign.ends_at), ?) AS days_remaining
         FROM airport_ad_campaigns campaign
         JOIN applicant_accounts account ON account.id = campaign.applicant_account_id
         JOIN airports airport ON airport.id = campaign.airport_id
        WHERE campaign.status = 'active'
          AND DATEDIFF(DATE(campaign.ends_at), ?) BETWEEN 1 AND 3
        ORDER BY campaign.applicant_account_id ASC,
                 days_remaining ASC,
                 campaign.ends_at ASC,
                 campaign.id ASC`,
      [reminderDate, reminderDate],
    );

    return rows.map((row) => ({
      campaign_id: Number(row.campaign_id),
      applicant_account_id: Number(row.applicant_account_id),
      applicant_email: String(row.applicant_email || '').trim(),
      airport_name: String(row.airport_name || '').trim(),
      placement_label: formatPlacementLabel(row.home_slot),
      ends_at: sqlDateTimeToTimezoneIso(row.ends_at),
      days_remaining: normalizeDaysRemaining(row.days_remaining),
    }));
  }

  async getDelivery(applicantAccountId: number, reminderDate: string): Promise<AdExpiryReminderDelivery | null> {
    const [rows] = await this.pool.query<DeliveryRow[]>(
      `SELECT status, attempt_count
         FROM ad_expiry_reminder_deliveries
        WHERE applicant_account_id = ?
          AND reminder_date = ?
        LIMIT 1`,
      [applicantAccountId, reminderDate],
    );
    return rows[0]
      ? { status: rows[0].status, attempt_count: Number(rows[0].attempt_count || 0) }
      : null;
  }

  async markSucceeded(input: DeliveryWriteInput): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO ad_expiry_reminder_deliveries
        (applicant_account_id, reminder_date, recipient_email, campaign_count, status, attempt_count, last_error, sent_at)
       VALUES (?, ?, ?, ?, 'succeeded', 1, NULL, NOW())
       ON DUPLICATE KEY UPDATE
         recipient_email = VALUES(recipient_email),
         campaign_count = VALUES(campaign_count),
         status = 'succeeded',
         attempt_count = attempt_count + 1,
         last_error = NULL,
         sent_at = NOW()`,
      [input.applicantAccountId, input.reminderDate, input.recipientEmail, input.campaignCount],
    );
  }

  async markFailed(input: DeliveryWriteInput & { error: string }): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO ad_expiry_reminder_deliveries
        (applicant_account_id, reminder_date, recipient_email, campaign_count, status, attempt_count, last_error, sent_at)
       VALUES (?, ?, ?, ?, 'failed', 1, ?, NULL)
       ON DUPLICATE KEY UPDATE
         recipient_email = VALUES(recipient_email),
         campaign_count = VALUES(campaign_count),
         status = 'failed',
         attempt_count = attempt_count + 1,
         last_error = VALUES(last_error),
         sent_at = NULL`,
      [input.applicantAccountId, input.reminderDate, input.recipientEmail, input.campaignCount, input.error],
    );
  }
}

function normalizeDaysRemaining(value: number): 1 | 2 | 3 {
  const days = Number(value);
  if (days === 1 || days === 2 || days === 3) {
    return days;
  }
  throw new Error(`invalid ad expiry reminder day: ${value}`);
}

function formatPlacementLabel(homeSlot: number | null): string {
  const slot = Number(homeSlot);
  return Number.isInteger(slot) && slot > 0 ? `首页广告位 ${slot}` : '优惠活动广告';
}
