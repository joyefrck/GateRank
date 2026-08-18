import { createHash, createHmac } from 'node:crypto';
import { HttpError } from '../middleware/errorHandler';
import {
  buildRsaSignPayload,
  signWithRsaPrivateKey,
  verifyWithRsaPublicKey,
} from '../utils/rsaSignature';
import { formatDateTimeInTimezoneIso } from '../utils/time';
import type { PaymentGatewayConfig, PaymentGatewaySettingsService } from './paymentGatewaySettingsService';

export interface PaymentGatewayCreateOrderInput {
  out_trade_no: string;
  channel: PaymentGatewayChannel;
  name: string;
  money: number;
  notify_url: string;
  return_url: string;
  clientip: string;
  method?: 'jump' | 'web';
  device?: 'pc' | 'mobile';
  param?: string;
}

export type PaymentGatewayChannel = 'alipay' | 'wxpay' | 'usdt';

export interface PaymentGatewayCreateOrderResult {
  trade_no: string;
  pay_type: string;
  pay_info: string;
}

export interface PaymentGatewayQueryOrderResult {
  code: number;
  msg: string;
  trade_no: string;
  out_trade_no: string;
  api_trade_no: string;
  type: string;
  status: number;
  pid: string;
  addtime: string;
  endtime: string | null;
  name: string;
  money: number;
  param: string;
  raw: Record<string, unknown>;
}

interface PaymentGatewayServiceOptions {
  paymentGatewaySettingsService: Pick<PaymentGatewaySettingsService, 'getConfig'>;
  fetchImpl?: typeof fetch;
}

const PAY_CREATE_URL = 'https://pay.v8jisu.cn/api/pay/create';
const PAY_QUERY_URL = 'https://pay.v8jisu.cn/api/pay/query';

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
    if (input.channel === 'usdt') {
      return this.createUsdtOrder(input, config);
    }
    this.assertEpayConfigured(config);
    try {
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

      const rawBody = await response.text();
      const data = parsePaymentGatewayJson(rawBody);
      if (!response.ok) {
        throw new HttpError(
          502,
          'PAYMENT_GATEWAY_HTTP_ERROR',
          String(data?.msg || `支付网关请求失败: HTTP ${response.status}${rawBody ? ` ${truncateGatewayBody(rawBody)}` : ''}`),
        );
      }

      if (!data) {
        throw new HttpError(
          502,
          'PAYMENT_GATEWAY_BAD_RESPONSE',
          `支付网关返回了非 JSON 响应: ${truncateGatewayBody(rawBody)}`,
        );
      }

      if (Number(data.code) !== 0) {
        throw new HttpError(
          400,
          'PAYMENT_GATEWAY_CREATE_FAILED',
          String(data.msg || '支付网关下单失败'),
        );
      }

      this.assertVerifiedPayload(data, config.platform_public_key);

      return {
        trade_no: String(data.trade_no || ''),
        pay_type: String(data.pay_type || ''),
        pay_info: String(data.pay_info || ''),
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw normalizePaymentGatewayTransportError(error);
    }
  }

  async verifyNotificationPayload(
    payload: Record<string, unknown>,
    channel: PaymentGatewayChannel = 'alipay',
  ): Promise<boolean> {
    const config = await this.requireConfigured();
    if (channel === 'usdt') {
      return this.verifyUsdtPayload(payload, config.usdt?.secret_key || '');
    }
    return this.verifyPayload(payload, config.platform_public_key);
  }

  async queryOrder(
    outTradeNo: string,
    channel: PaymentGatewayChannel = 'alipay',
  ): Promise<PaymentGatewayQueryOrderResult> {
    const config = await this.requireConfigured();
    if (channel === 'usdt') {
      throw new HttpError(503, 'PAYMENT_GATEWAY_QUERY_NOT_SUPPORTED', 'USDT 支付暂不支持主动查单，请等待支付网关异步回调');
    }
    this.assertEpayConfigured(config);
    try {
      const requestParams: Record<string, string> = {
        pid: config.pid,
        out_trade_no: outTradeNo,
        timestamp: String(Math.floor(Date.now() / 1000)),
        sign_type: 'RSA',
      };
      requestParams.sign = signWithRsaPrivateKey(buildRsaSignPayload(requestParams), config.private_key);

      const response = await this.fetchImpl(PAY_QUERY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(requestParams).toString(),
      });

      const rawBody = await response.text();
      const data = parsePaymentGatewayJson(rawBody);
      if (!response.ok) {
        throw new HttpError(
          502,
          'PAYMENT_GATEWAY_HTTP_ERROR',
          String(data?.msg || `支付网关查单失败: HTTP ${response.status}${rawBody ? ` ${truncateGatewayBody(rawBody)}` : ''}`),
        );
      }

      if (!data) {
        throw new HttpError(
          502,
          'PAYMENT_GATEWAY_BAD_RESPONSE',
          `支付网关返回了非 JSON 响应: ${truncateGatewayBody(rawBody)}`,
        );
      }

      if (Number(data.code) !== 0) {
        throw new HttpError(
          400,
          'PAYMENT_GATEWAY_QUERY_FAILED',
          String(data.msg || '支付网关查单失败'),
        );
      }

      this.assertVerifiedPayload(data, config.platform_public_key);

      return {
        code: Number(data.code),
        msg: String(data.msg || ''),
        trade_no: String(data.trade_no || ''),
        out_trade_no: String(data.out_trade_no || ''),
        api_trade_no: String(data.api_trade_no || ''),
        type: String(data.type || ''),
        status: Number(data.status),
        pid: String(data.pid || ''),
        addtime: String(data.addtime || ''),
        endtime: stringOrNull(data.endtime),
        name: String(data.name || ''),
        money: Number(data.money || 0),
        param: String(data.param || ''),
        raw: data,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw normalizePaymentGatewayTransportError(error);
    }
  }

  verifyPayload(payload: Record<string, unknown>, publicKey: string): boolean {
    const sign = String(payload.sign || '').trim();
    if (!sign) {
      return false;
    }
    const plain = buildRsaSignPayload(payload);
    return verifyWithRsaPublicKey(plain, sign, publicKey);
  }

  private async createUsdtOrder(
    input: PaymentGatewayCreateOrderInput,
    config: PaymentGatewayConfig,
  ): Promise<PaymentGatewayCreateOrderResult> {
    const usdtConfig = config.usdt;
    if (!usdtConfig?.enabled) {
      throw new HttpError(409, 'PAYMENT_USDT_NOT_ENABLED', 'USDT 支付未启用');
    }
    if (!usdtConfig.gateway_url || !usdtConfig.merchant_id || !usdtConfig.secret_key) {
      throw new HttpError(409, 'PAYMENT_USDT_NOT_CONFIGURED', 'USDT 支付配置不完整');
    }

    const requestParams: Record<string, string | number> = {
      pid: usdtConfig.merchant_id,
      order_id: input.out_trade_no,
      amount: Number(input.money.toFixed(2)),
      notify_url: input.notify_url,
      redirect_url: input.return_url,
      name: input.name,
    };
    requestParams.signature = signWithHmacSha256Secret(requestParams, usdtConfig.secret_key);

    try {
      const createUrl = buildEpusdtGmpayCreateUrl(usdtConfig.gateway_url);
      const sendRequest = () => this.fetchImpl(createUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestParams),
        });

      let response = await sendRequest();
      // During the rolling upgrade, an old EPUSDT rejects the v2 HMAC with
      // HTTP 401 before creating an order. Retry only that explicit signature
      // failure with legacy MD5; never replay transport or other HTTP errors.
      if (response.status === 401) {
        requestParams.signature = signWithMd5Secret(requestParams, usdtConfig.secret_key);
        response = await sendRequest();
      }

      const rawBody = await response.text();
      const data = parsePaymentGatewayJson(rawBody);
      if (!response.ok) {
        throw new HttpError(
          502,
          'PAYMENT_GATEWAY_HTTP_ERROR',
          String(data?.message || data?.msg || `EPUSDT 请求失败: HTTP ${response.status}${rawBody ? ` ${truncateGatewayBody(rawBody)}` : ''}`),
        );
      }

      if (!data) {
        throw new HttpError(
          502,
          'PAYMENT_GATEWAY_BAD_RESPONSE',
          `EPUSDT 返回了非 JSON 响应: ${truncateGatewayBody(rawBody)}`,
        );
      }

      const statusCode = data.status_code === undefined ? data.code : data.status_code;
      if (!isEpusdtSuccessCode(statusCode)) {
        throw new HttpError(
          400,
          'PAYMENT_GATEWAY_CREATE_FAILED',
          String(data.message || data.msg || 'EPUSDT 下单失败'),
        );
      }

      const responseData = toRecord(data.data);
      const paymentUrl = normalizeEpusdtPaymentUrl(
        String(responseData.payment_url || '').trim(),
        usdtConfig.gateway_url,
      );
      if (!paymentUrl) {
        throw new HttpError(
          502,
          'PAYMENT_GATEWAY_BAD_RESPONSE',
          'EPUSDT 下单返回缺少 payment_url',
        );
      }

      return {
        trade_no: String(responseData.trade_id || ''),
        pay_type: 'usdt',
        pay_info: paymentUrl,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw normalizePaymentGatewayTransportError(error);
    }
  }

  private verifyUsdtPayload(payload: Record<string, unknown>, secretKey: string): boolean {
    const signature = String(payload.signature || '').trim();
    if (!signature || !secretKey) {
      return false;
    }
    const normalized = signature.toLowerCase();
    return normalized === signWithHmacSha256Secret(payload, secretKey)
      || normalized === signWithMd5Secret(payload, secretKey);
  }

  private assertVerifiedPayload(payload: Record<string, unknown>, publicKey: string): void {
    const sign = String(payload.sign || '').trim();
    if (!sign) {
      throw new HttpError(502, 'PAYMENT_GATEWAY_MISSING_SIGNATURE', '支付网关成功返回缺少签名');
    }
    if (!this.verifyPayload(payload, publicKey)) {
      throw new HttpError(400, 'PAYMENT_GATEWAY_INVALID_SIGNATURE', '支付网关验签失败');
    }
  }

  private assertEpayConfigured(config: PaymentGatewayConfig): void {
    if (!config.epay?.enabled) {
      throw new HttpError(409, 'PAYMENT_EPAY_NOT_ENABLED', '普通 epay 支付未启用');
    }
    if (!config.pid || !config.private_key || !config.platform_public_key) {
      throw new HttpError(409, 'PAYMENT_NOT_CONFIGURED', '普通 epay 支付配置不完整');
    }
  }

  private async requireConfigured() {
    const config = await this.paymentGatewaySettingsService.getConfig();
    if (!config.enabled) {
      throw new HttpError(409, 'PAYMENT_NOT_ENABLED', '支付功能未启用');
    }
    const epayEnabled = Boolean(config.epay?.enabled);
    const usdtEnabled = Boolean(config.usdt?.enabled);
    if (!epayEnabled && !usdtEnabled) {
      throw new HttpError(409, 'PAYMENT_METHOD_NOT_ENABLED', '支付方式未启用');
    }
    const hasRsaConfig = epayEnabled && config.pid && config.private_key && config.platform_public_key;
    const hasUsdtConfig =
      usdtEnabled && config.usdt.gateway_url && config.usdt.merchant_id && config.usdt.secret_key;
    if (!hasRsaConfig && !hasUsdtConfig) {
      throw new HttpError(409, 'PAYMENT_NOT_CONFIGURED', '支付配置不完整');
    }
    return config;
  }
}

export function signWithMd5Secret(params: Record<string, unknown>, secretKey: string): string {
  const plain = buildMd5SignPayload(params) + secretKey;
  return createHash('md5').update(plain, 'utf8').digest('hex');
}

export function signWithHmacSha256Secret(params: Record<string, unknown>, secretKey: string): string {
  return createHmac('sha256', secretKey)
    .update(buildMd5SignPayload(params), 'utf8')
    .digest('hex');
}

export function buildMd5SignPayload(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && key !== 'sign_type' && key !== 'signature' && isMd5SignableValue(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
}

export function buildEpusdtGmpayCreateUrl(gatewayUrl: string): string {
  const trimmed = gatewayUrl.trim().replace(/\/+$/, '');
  const knownPaymentPath = /\/payments\/(?:epay|gmpay)\/v\d+\/order\/create-transaction$/i;
  if (knownPaymentPath.test(trimmed)) {
    return trimmed.replace(knownPaymentPath, '/payments/gmpay/v1/order/create-transaction');
  }
  if (/\/submit\.php$/i.test(trimmed)) {
    return trimmed.replace(/\/submit\.php$/i, '/payments/gmpay/v1/order/create-transaction');
  }
  return `${trimmed}/payments/gmpay/v1/order/create-transaction`;
}

export function normalizeEpusdtPaymentUrl(paymentUrl: string, gatewayUrl: string): string {
  if (!paymentUrl) {
    return '';
  }
  try {
    const payment = new URL(paymentUrl);
    const gateway = new URL(buildEpusdtGmpayCreateUrl(gatewayUrl));
    return `${gateway.origin}${payment.pathname}${payment.search}${payment.hash}`;
  } catch {
    return paymentUrl;
  }
}

function isEpusdtSuccessCode(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  const normalized = String(value).trim().toLowerCase();
  return normalized === '200' || normalized === '0' || normalized === 'success';
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function parsePaymentGatewayJson(rawBody: string): Record<string, unknown> | null {
  const body = rawBody.trim();
  if (!body) {
    return null;
  }

  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function truncateGatewayBody(rawBody: string): string {
  return rawBody.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function normalizePaymentGatewayTransportError(error: unknown): HttpError {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code || '') : '';
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String(error.message || '')
      : '支付网关请求失败';

  if (
    message.includes('private key') ||
    message.includes('DECODER routines') ||
    message.includes('unsupported')
  ) {
    return new HttpError(
      400,
      'PAYMENT_GATEWAY_SIGN_FAILED',
      `支付签名失败，请检查商户私钥是否填写正确: ${message}`,
    );
  }

  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
    return new HttpError(504, 'PAYMENT_GATEWAY_TIMEOUT', `支付网关请求超时: ${message}`);
  }

  return new HttpError(502, 'PAYMENT_GATEWAY_UNAVAILABLE', `支付网关请求失败: ${message}`);
}

export function isPaymentSuccessNotification(payload: Record<string, unknown>): boolean {
  if (String(payload.order_id || '').trim() && String(payload.signature || '').trim()) {
    const status = String(payload.status || payload.trade_status || '').trim().toLowerCase();
    if (!status) {
      return true;
    }
    return ['success', 'paid', 'completed', 'confirmed', '1', '2'].includes(status);
  }
  const tradeStatus = String(payload.trade_status || '').trim().toUpperCase();
  if (tradeStatus) {
    return tradeStatus === 'TRADE_SUCCESS';
  }
  return String(payload.code || '').trim() === '0';
}

export function isPaymentQueryPaid(result: PaymentGatewayQueryOrderResult): boolean {
  return result.code === 0 && result.status === 1;
}

export function buildGatewayTrace(payload: Record<string, unknown>): string {
  return [
    String(payload.trade_no || payload.trade_id || ''),
    String(payload.out_trade_no || payload.order_id || ''),
    formatDateTimeInTimezoneIso(),
  ]
    .filter(Boolean)
    .join(' / ');
}

function stringOrNull(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const next = String(value).trim();
  return next || null;
}

function isMd5SignableValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (Array.isArray(value) || typeof value === 'object') {
    return false;
  }
  return String(value) !== '';
}
