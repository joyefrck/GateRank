export const AIRPORT_AD_MONTHLY_PRICE = 1000;
export const AIRPORT_AD_SLOT_LIMIT = 6;
export const AIRPORT_AD_LOW_BALANCE_WARNING_THRESHOLD = 100;
export const AIRPORT_AD_ALLOWED_MONTHS = [1, 2, 3, 6, 12] as const;

export type AirportAdMonthOption = (typeof AIRPORT_AD_ALLOWED_MONTHS)[number];

export interface AirportDealView {
  campaign_id: number;
  airport_id: number;
  airport_name: string;
  airport_slug: string;
  website: string;
  report_url: string;
  coupon_code: string;
  discount_title: string;
  discount_description: string;
  applicable_plan: string;
  starts_at: string;
  ends_at: string;
  purchased_months: number;
  billed_amount: number;
  is_stackable: boolean;
  refund_supported: boolean;
  supports_trial: boolean;
  supports_usdt: boolean;
  supports_streaming: boolean;
  supports_ai: boolean;
  low_price_plan: boolean;
  discount_percent: number | null;
  created_at: string;
}

export type PortalAirportAdCampaignStatus = 'active' | 'expired' | 'canceled';

export interface PortalAirportAdCampaignView extends AirportDealView {
  status: PortalAirportAdCampaignStatus;
  status_label: string;
  is_active: boolean;
}

export interface PortalAirportAdStatus {
  active_campaign: AirportDealView | null;
  campaigns: PortalAirportAdCampaignView[];
  remaining_slots: number;
  slot_limit: number;
  monthly_price: number;
  low_balance_warning_threshold: number;
  allowed_months: number[];
}
