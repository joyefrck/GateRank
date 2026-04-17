import { HttpError } from '../middleware/errorHandler';
import {
  buildRsaSignPayload,
  signWithRsaPrivateKey,
  verifyWithRsaPublicKey,
} from '../utils/rsaSignature';
import { formatDateTimeInTimezoneIso } from '../utils/time';
import type { PaymentGatewaySettingsService } from './paymentGatewaySettingsService';

export interface PaymentGatewayCreateOrderInput {
  out_trade_no: string;
  channel: 'alipay' | 'wxpay';
  name: string;
  money: number;
  notify_url: string;
  return_url: string;
  clientip: string;
  method?: 'jump' | 'web';
  device?: 'pc' | 'mobile';
  param?: string;
}

export interface PaymentGatewayCreateOrderResult {
  trade_no: string;
  pay_type: string;
  pay_info: string;
}

interface PaymentGatewayServiceOptions {
  paymentGatewaySettingsService: Pick<PaymentGatewaySettingsService, 'getConfig'>;
  fetchImpl?: typeof fetch;
}

const PAY_CREATE_URL = 'https://pay.v8jisu.cn/api/pay/create';

export class PaymentGatewayService {
  private readonly paymentGatewaySettingsService: PaymentGatewayServiceOptions['paymentGatewaySettingsService'];
  private readonly fetchImpl: typeof fetch;

  constructor(options: PaymentGatewayServiceOptions) {
    this.paymentGatewaySettingsService = options.paymentGatewaySettingsService;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  async createOrder(
    input: PaymentGatewayCreateOrderInput,
  ): Promise<PaymentGatewayCreateOrderResult> {
    const config = await this.requireConfigured();
    const requestParams: Record<string, string> = {
      pid: config.pid,
      method: input.method || 'jump',
      device: input.device || 'pc',
      type: input.channel,
      out_trade_no: input.out_trade_no,
      notify_url: input.notify_url,
      return_url: input.return_url,
      name: input.name,
      money: input.money.toFixed(2),
      clientip: input.clientip,
      param: input.param || '',
      timestamp: String(Math.floor(Date.now() / 1000)),
      sign_type: 'RSA',
    };
    const payload = buildRsaSignPayload(requestParams);
    requestParams.sign = signWithRsaPrivateKey(payload, config.private_key);

    const response = await this.fetchImpl(PAY_CREATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(requestParams).toString(),
    });

    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      throw new HttpError(
        502,
        'PAYMENT_GATEWAY_HTTP_ERROR',
        String(data.msg || `支付网关请求失败: ${response.status}`),
      );
    }

    this.assertVerifiedPayload(data, config.platform_public_key);

    if (Number(data.code) !== 0) {
      throw new HttpError(
        400,
        'PAYMENT_GATEWAY_CREATE_FAILED',
        String(data.msg || '支付网关下单失败'),
      );
    }

    return {
      trade_no: String(data.trade_no || ''),
      pay_type: String(data.pay_type || ''),
      pay_info: String(data.pay_info || ''),
    };
  }

  async verifyNotificationPayload(payload: Record<string, unknown>): Promise<boolean> {
    const config = await this.requireConfigured();
    return this.verifyPayload(payload, config.platform_public_key);
  }

  verifyPayload(payload: Record<string, unknown>, publicKey: string): boolean {
    const sign = String(payload.sign || '').trim();
    if (!sign) {
      return false;
    }
    const plain = buildRsaSignPayload(payload);
    return verifyWithRsaPublicKey(plain, sign, publicKey);
  }

  private assertVerifiedPayload(payload: Record<string, unknown>, publicKey: string): void {
    if (!this.verifyPayload(payload, publicKey)) {
      throw new HttpError(400, 'PAYMENT_GATEWAY_INVALID_SIGNATURE', '支付网关验签失败');
    }
  }

  private async requireConfigured() {
    const config = await this.paymentGatewaySettingsService.getConfig();
    if (!config.enabled) {
      throw new HttpError(409, 'PAYMENT_NOT_ENABLED', '支付功能未启用');
    }
    if (!config.pid || !config.private_key || !config.platform_public_key) {
      throw new HttpError(409, 'PAYMENT_NOT_CONFIGURED', '支付配置不完整');
    }
    return config;
  }
}

export function isPaymentSuccessNotification(payload: Record<string, unknown>): boolean {
  const tradeStatus = String(payload.trade_status || '').trim().toUpperCase();
  if (tradeStatus) {
    return tradeStatus === 'TRADE_SUCCESS';
  }
  return String(payload.code || '').trim() === '0';
}

export function buildGatewayTrace(payload: Record<string, unknown>): string {
  return [
    String(payload.trade_no || ''),
    String(payload.out_trade_no || ''),
    formatDateTimeInTimezoneIso(),
  ]
    .filter(Boolean)
    .join(' / ');
}
