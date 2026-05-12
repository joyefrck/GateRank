import type { BillingMailNotificationEvent } from '../repositories/applicantBillingRepository';

export interface BillingMailService {
  sendLowBalanceWarningEmail(input: {
    to: string;
    airportName: string;
    balance: number;
    thresholdAmount: number;
  }): Promise<void>;
  sendAirportAutoUnlistedEmail(input: {
    to: string;
    airportName: string;
    balance: number;
    thresholdAmount: number;
  }): Promise<void>;
  sendAirportOnlineEmail(input: {
    to: string;
    airportName: string;
    balance: number;
    thresholdAmount: number;
  }): Promise<void>;
}

export async function sendBillingMailNotificationsSafely(
  mailService: BillingMailService | undefined,
  events: BillingMailNotificationEvent[] | undefined,
  logger: Pick<Console, 'error'> = console,
): Promise<void> {
  if (!mailService || !events?.length) {
    return;
  }

  for (const event of events) {
    try {
      if (event.type === 'low_balance_warning') {
        await mailService.sendLowBalanceWarningEmail(event);
      } else if (event.type === 'airport_auto_unlisted') {
        await mailService.sendAirportAutoUnlistedEmail(event);
      } else {
        await mailService.sendAirportOnlineEmail(event);
      }
    } catch (error) {
      logger.error('[mail] failed to send billing notification email', {
        type: event.type,
        to: event.to,
        airportName: event.airportName,
        error,
      });
    }
  }
}
