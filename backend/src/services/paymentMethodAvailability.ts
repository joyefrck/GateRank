import type { PaymentGatewayChannel } from './paymentGatewayService';

export function resolveAvailablePaymentMethods(config: unknown): PaymentGatewayChannel[] {
  const record = toPlainObject(config);
  const methods: PaymentGatewayChannel[] = [];
  const epay = toPlainObject(record.epay);

  if (
    Boolean(record.enabled) &&
    Boolean(epay.enabled) &&
    String(record.pid || '').trim() &&
    String(record.private_key || '').trim() &&
    String(record.platform_public_key || '').trim()
  ) {
    methods.push('alipay', 'wxpay');
  }

  const usdt = toPlainObject(record.usdt);
  if (
    Boolean(record.enabled) &&
    Boolean(usdt.enabled) &&
    String(usdt.gateway_url || '').trim() &&
    String(usdt.merchant_id || '').trim() &&
    String(usdt.secret_key || '').trim()
  ) {
    methods.push('usdt');
  }

  return methods;
}

function toPlainObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
