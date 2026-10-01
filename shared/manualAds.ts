import type { AirportDealView, AirportHomeAdSlot } from './airportAds';

export type ManualAdStatus = 'scheduled' | 'active' | 'expired' | 'canceled';
export interface ManualAdInput {
  airport_id: number;
  home_slot: AirportHomeAdSlot | null;
  coupon_code: string;
  discount_title: string;
  discount_description: string;
  applicable_plan: string;
  discount_percent: number | null;
  is_stackable: boolean;
  refund_supported: boolean;
  starts_at: string;
  ends_at: string;
}
export interface ManualAdView extends AirportDealView {
  status: ManualAdStatus;
  updated_by: string | null;
}
export interface ManualAdList {
  items: ManualAdView[];
  pagination: { page: number; page_size: number; total: number; total_pages: number };
}
export interface ManualAdQuery {
  page: number;
  q?: string;
  status?: ManualAdStatus | 'all';
  placement?: 'all' | 'deal' | `home_${AirportHomeAdSlot}`;
}
