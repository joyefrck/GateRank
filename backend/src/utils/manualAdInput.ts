import { AIRPORT_HOME_AD_SLOTS, type AirportHomeAdSlot } from '../../../shared/airportAds';
import type { ManualAdInput } from '../../../shared/manualAds';
import { HttpError } from '../middleware/errorHandler';

export function parseManualAdInput(value: unknown): ManualAdInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('请填写广告配置');
  const body = value as Record<string, unknown>;
  if (typeof body.airport_id !== 'number' || !Number.isSafeInteger(body.airport_id) || body.airport_id <= 0) fail('请选择有效机场');
  const homeSlot = body.home_slot;
  if (homeSlot !== null && (typeof homeSlot !== 'number' || !(AIRPORT_HOME_AD_SLOTS as readonly number[]).includes(homeSlot))) fail('请选择优惠活动或首页 1–5 号位');
  const text = (key: string, label: string, max: number, required = false) => {
    if (typeof body[key] !== 'string') fail(`${label}格式不正确`);
    const result = (body[key] as string).trim();
    if ((required && !result) || result.length > max) fail(`${label}${required ? '不能为空，且' : ''}最多 ${max} 个字符`);
    return result;
  };
  const date = (key: string, label: string) => {
    const raw = body[key];
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) fail(`${label}必须包含时区`);
    const result = new Date(raw as string);
    if (!Number.isFinite(result.getTime()) || result.getUTCFullYear() < 2000 || result.getUTCFullYear() > 2099) fail(`${label}无效`);
    // Date silently rolls invalid calendar days into the next month. Reject those inputs.
    const calendar = (raw as string).slice(0, 10);
    const [year, month, day] = calendar.split('-').map(Number);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.toISOString().slice(0, 10) !== calendar) fail(`${label}无效`);
    return new Date(Math.floor(result.getTime() / 1000) * 1000).toISOString();
  };
  const startsAt = date('starts_at', '开始时间');
  const endsAt = date('ends_at', '结束时间');
  if (endsAt <= startsAt) fail('结束时间必须晚于开始时间');
  const percent = body.discount_percent;
  if (percent !== null && (typeof percent !== 'number' || !Number.isFinite(percent) || percent < 0.01 || percent > 100)) fail('优惠百分比必须为 0.01 至 100');
  for (const key of ['is_stackable', 'refund_supported']) if (typeof body[key] !== 'boolean') fail('叠加和退款选项格式不正确');
  return {
    airport_id: body.airport_id as number,
    home_slot: homeSlot as AirportHomeAdSlot | null,
    coupon_code: text('coupon_code', '优惠码', 64),
    discount_title: text('discount_title', '优惠标题', 128, true),
    discount_description: text('discount_description', '优惠说明', 10000),
    applicable_plan: text('applicable_plan', '适用套餐', 128),
    discount_percent: percent === null ? null : Number((percent as number).toFixed(2)),
    is_stackable: body.is_stackable as boolean,
    refund_supported: body.refund_supported as boolean,
    starts_at: startsAt,
    ends_at: endsAt,
  };
}
function fail(message: string): never { throw new HttpError(400, 'BAD_REQUEST', message); }
