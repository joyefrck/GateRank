import type {
  BillingMailNotificationEvent,
  BillingMailNotificationType,
} from '../repositories/applicantBillingRepository';
import type { ApplicantTelegramBinding } from '../repositories/applicantTelegramBindingRepository';
import {
  type UserTelegramBotConfig,
  type UserTelegramBotSettingsService,
  type UserTelegramBotTemplateConfigItem,
  type UserTelegramBotTemplateKey,
} from './userTelegramBotSettingsService';

export interface UserTelegramBotBillingNotificationService {
  sendBillingNotifications(events: BillingMailNotificationEvent[] | undefined): Promise<void>;
  sendRechargeWelcome(input: {
    applicantAccountId: number;
    airportName: string;
    applicantEmail?: string | null;
    rechargeAmount: number;
    balance: number;
  }): Promise<void>;
}

interface UserTelegramBotMessageServiceOptions {
  userTelegramBotSettingsService: Pick<UserTelegramBotSettingsService, 'getConfig'>;
  applicantTelegramBindingRepository: {
    getByApplicantAccountId(applicantAccountId: number): Promise<ApplicantTelegramBinding | null>;
  };
  fetchImpl?: typeof fetch;
}

export class UserTelegramBotMessageService implements UserTelegramBotBillingNotificationService {
  private readonly userTelegramBotSettingsService: UserTelegramBotMessageServiceOptions['userTelegramBotSettingsService'];
  private readonly applicantTelegramBindingRepository: UserTelegramBotMessageServiceOptions['applicantTelegramBindingRepository'];
  private readonly fetchImpl: typeof fetch;

  constructor(options: UserTelegramBotMessageServiceOptions) {
    this.userTelegramBotSettingsService = options.userTelegramBotSettingsService;
    this.applicantTelegramBindingRepository = options.applicantTelegramBindingRepository;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async sendBillingNotifications(events: BillingMailNotificationEvent[] | undefined): Promise<void> {
    if (!events?.length) {
      return;
    }
    for (const event of events) {
      await this.sendBillingNotification(event);
    }
  }

  async sendRechargeWelcome(input: {
    applicantAccountId: number;
    airportName: string;
    applicantEmail?: string | null;
    rechargeAmount: number;
    balance: number;
  }): Promise<void> {
    const config = await this.getRunnableConfig();
    if (!config) {
      return;
    }
    const template = config.templates.recharge_welcome;
    if (!template.enabled) {
      return;
    }
    await this.sendTemplateToApplicant(config, input.applicantAccountId, template, {
      airport_name: input.airportName,
      applicant_email: input.applicantEmail || '',
      recharge_amount: input.rechargeAmount.toFixed(2),
      current_balance: input.balance.toFixed(2),
      site_name: 'GateRank',
    });
  }

  private async sendBillingNotification(event: BillingMailNotificationEvent): Promise<void> {
    if (!event.applicantAccountId) {
      return;
    }
    const config = await this.getRunnableConfig();
    if (!config) {
      return;
    }
    const templateKey = toTemplateKey(event.type);
    const template = config.templates[templateKey];
    if (!template.enabled) {
      return;
    }
    await this.sendTemplateToApplicant(config, event.applicantAccountId, template, {
      airport_name: event.airportName,
      applicant_email: event.to,
      current_balance: event.balance.toFixed(2),
      threshold_amount: event.thresholdAmount.toFixed(2),
      site_name: 'GateRank',
    });
  }

  private async sendTemplateToApplicant(
    config: UserTelegramBotConfig,
    applicantAccountId: number,
    template: UserTelegramBotTemplateConfigItem,
    variables: Record<string, string>,
  ): Promise<void> {
    const binding = await this.applicantTelegramBindingRepository.getByApplicantAccountId(applicantAccountId);
    if (!binding) {
      return;
    }
    const text = renderTemplateBody(template.body, variables);
    if (!text) {
      return;
    }
    await this.sendTelegramMessage(config, binding.telegram_chat_id, text);
  }

  private async getRunnableConfig(): Promise<UserTelegramBotConfig | null> {
    const config = await this.userTelegramBotSettingsService.getConfig();
    if (!config.enabled || !config.bot_token.trim()) {
      return null;
    }
    return config;
  }

  private async sendTelegramMessage(
    config: UserTelegramBotConfig,
    chatId: string,
    text: string,
  ): Promise<void> {
    await this.fetchImpl(`${config.api_base}/bot${config.bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
      }),
    });
  }
}

export async function sendUserTelegramBotBillingNotificationsSafely(
  service: UserTelegramBotBillingNotificationService | undefined,
  events: BillingMailNotificationEvent[] | undefined,
  logger: Pick<Console, 'error'> = console,
): Promise<void> {
  if (!service || !events?.length) {
    return;
  }
  try {
    await service.sendBillingNotifications(events);
  } catch (error) {
    logger.error('[user-telegram-bot] failed to send billing notification', { error });
  }
}

export async function sendUserTelegramBotRechargeWelcomeSafely(
  service: UserTelegramBotBillingNotificationService | undefined,
  input: {
    applicantAccountId: number;
    airportName: string;
    applicantEmail?: string | null;
    rechargeAmount: number;
    balance: number;
  },
  logger: Pick<Console, 'error'> = console,
): Promise<void> {
  if (!service) {
    return;
  }
  try {
    await service.sendRechargeWelcome(input);
  } catch (error) {
    logger.error('[user-telegram-bot] failed to send recharge welcome', { error });
  }
}

function toTemplateKey(type: BillingMailNotificationType): UserTelegramBotTemplateKey {
  if (type === 'low_balance_warning') {
    return 'low_balance_warning';
  }
  if (type === 'airport_auto_unlisted') {
    return 'airport_auto_unlisted';
  }
  return 'airport_online';
}

function renderTemplateBody(template: string, variables: Record<string, string>): string {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    return variables[key] ?? '';
  }).trim();
}
