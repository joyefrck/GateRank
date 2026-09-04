export type RevenueView = 'income' | 'receipts';
export type RevenueGranularity = 'day' | 'week' | 'month';
export type RevenueKind = 'application' | 'recharge' | 'click' | 'advertising';
export type RevenueTable = 'airports' | 'periods' | 'transactions';
export interface RevenueQuery {
  date_from: string; date_to: string; view: RevenueView; granularity: RevenueGranularity;
  entity: string; table: RevenueTable; page: number; page_size: number;
  sort: 'amount' | 'name' | 'time'; order: 'asc' | 'desc';
}
export interface RevenueTotals {
  amount_cents: number; application_cents: number; recharge_cents: number;
  click_cents: number; advertising_cents: number; record_count: number;
  click_count: number; advertising_count: number; entity_count: number;
}
export interface RevenueGroup extends RevenueTotals { key: string; name: string }
export interface RevenueTransaction {
  id: string; entity_key: string; name: string; kind: RevenueKind;
  amount_cents: number; occurred_at: string; reference: string; channel: string | null;
}
export interface RevenuePage<T> { items: T[]; total: number; page: number; page_size: number }
export interface RevenueOverview {
  totals: RevenueTotals; previous: RevenueTotals; trend: RevenueGroup[];
  kinds: RevenueGroup[]; channels: RevenueGroup[]; placements: RevenueGroup[];
  top_airports: RevenueGroup[]; top_five_share: number; updated_at: string;
  missing_payment_time_count: number;
}
export const REVENUE_KIND_LABELS: Record<RevenueKind, string> = {
  application: '入驻费', recharge: '充值', click: '点击扣费', advertising: '广告购买 / 续费',
};
export const REVENUE_CHANNEL_LABELS: Record<string, string> = { alipay: '支付宝', wxpay: '微信支付', usdt: '加密货币', unknown: '未知渠道' };
export const EMPTY_REVENUE_TOTALS: RevenueTotals = {
  amount_cents: 0, application_cents: 0, recharge_cents: 0, click_cents: 0,
  advertising_cents: 0, record_count: 0, click_count: 0, advertising_count: 0, entity_count: 0,
};
export function revenueToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function shiftRevenueDate(day: string, count: number): string {
  const value = new Date(`${day}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}
export const REVENUE_DATE_PRESETS = [
  { key: 'today', label: '今日' },
  { key: 'yesterday', label: '昨日' },
  { key: 'week', label: '近 7 天' },
  { key: 'recent', label: '最近一个月' },
  { key: 'quarter', label: '最近 3 个月' },
  { key: 'half_year', label: '最近半年' },
  { key: 'year_to_date', label: '年初至今' },
  { key: 'month', label: '本月' },
  { key: 'last', label: '上月' },
] as const;
export type RevenueDatePreset = typeof REVENUE_DATE_PRESETS[number]['key'];
function monthsBeforeRevenueDate(day: string, months: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target.toISOString().slice(0, 10);
}
export function revenuePresetRanges(now = new Date()): Record<RevenueDatePreset, { date_from: string; date_to: string }> {
  const today = revenueToday(now), month = `${today.slice(0, 7)}-01`, last = shiftRevenueDate(month, -1);
  const range = (from: string, to = today) => ({ date_from: from, date_to: to });
  return {
    today: range(today),
    yesterday: range(shiftRevenueDate(today, -1), shiftRevenueDate(today, -1)),
    week: range(shiftRevenueDate(today, -6)),
    recent: range(monthsBeforeRevenueDate(today, 1)),
    quarter: range(monthsBeforeRevenueDate(today, 3)),
    half_year: range(monthsBeforeRevenueDate(today, 6)),
    year_to_date: range(`${today.slice(0, 4)}-01-01`),
    month: range(month),
    last: range(`${last.slice(0, 7)}-01`, last),
  };
}
export function validRevenueDate(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(`${day}T00:00:00Z`))
    && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
}
export function revenuePeriod(day: string, granularity: RevenueGranularity): string {
  if (granularity === 'month') return `${day.slice(0, 7)}-01`;
  if (granularity === 'week') return shiftRevenueDate(day, -((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7));
  return day;
}
export function revenuePeriods(query: Pick<RevenueQuery, 'date_from' | 'date_to' | 'granularity'>): string[] {
  const keys: string[] = [];
  for (let day = revenuePeriod(query.date_from, query.granularity); day <= query.date_to;) {
    keys.push(day);
    if (query.granularity === 'month') {
      const next = new Date(`${day}T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1); day = next.toISOString().slice(0, 10);
    } else day = shiftRevenueDate(day, query.granularity === 'week' ? 7 : 1);
  }
  return keys;
}
export function defaultRevenueQuery(now = new Date()): RevenueQuery {
  return { ...revenuePresetRanges(now).recent, view: 'income', granularity: 'day', entity: '', table: 'airports', page: 1, page_size: 20, sort: 'amount', order: 'desc' };
}
export function revenueSearch(query: RevenueQuery): string {
  return new URLSearchParams(Object.entries(query).map(([key, value]) => [key, String(value)] as [string, string])).toString();
}
