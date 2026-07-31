export const AIRPORT_AD_MONTHLY_PRICE = 1000;
export const AIRPORT_AD_LOW_BALANCE_WARNING_THRESHOLD = 100;
export const AIRPORT_AD_ALLOWED_MONTHS = [1, 2, 3, 6, 12] as const;
export const AIRPORT_HOME_AD_SLOTS = [1, 2, 3, 4] as const;

export type AirportAdMonthOption = (typeof AIRPORT_AD_ALLOWED_MONTHS)[number];
export type AirportHomeAdSlot = (typeof AIRPORT_HOME_AD_SLOTS)[number];
export type AirportHomeAdSlotPrices = Record<AirportHomeAdSlot, number>;
export type AirportHomeAdSlotAvailability = Record<AirportHomeAdSlot, boolean>;

export interface AirportDealView {
  campaign_id: number;
  airport_id: number;
  airport_name: string;
  airport_slug: string;
  website: string;
  report_url: string;
  plan_price_month?: number;
  founded_on?: string | null;
  airport_created_at?: string;
  airport_intro?: string;
  tags?: string[];
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
  home_slot?: AirportHomeAdSlot | null;
  is_homepage?: boolean;
  tracking_started_at?: string | null;
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
  monthly_price: number;
  home_slot_monthly_prices?: AirportHomeAdSlotPrices;
  home_slot_availability?: AirportHomeAdSlotAvailability;
  low_balance_warning_threshold: number;
  allowed_months: number[];
}

export interface PortalAirportAdDailyStat {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number | null;
}

export interface PortalAirportAdStatsView {
  campaign_id: number;
  tracking_started_on: string | null;
  summary: {
    impressions: number;
    clicks: number;
    ctr: number | null;
  };
  daily: PortalAirportAdDailyStat[];
  pagination: {
    page: number;
    page_size: 30;
    total: number;
    total_pages: number;
  };
}

export type AdminAirportAdStatusFilter = 'all' | 'active' | 'expired' | 'canceled';
export type AdminAirportAdPlacementFilter = 'all' | 'deal' | `home_${AirportHomeAdSlot}`;
export type AdminAirportAdDerivedStatus = Exclude<AdminAirportAdStatusFilter, 'all'>;

export interface AdminAirportAdStatsListItem {
  campaign_id: number;
  airport_id: number;
  airport_name: string;
  airport_slug: string;
  coupon_code: string;
  home_slot: AirportHomeAdSlot | null;
  starts_at: string;
  ends_at: string;
  purchased_months: number;
  status: AdminAirportAdDerivedStatus;
  tracking_started_on: string | null;
  summary: PortalAirportAdStatsView['summary'];
}

export interface AdminAirportAdStatsListView {
  items: AdminAirportAdStatsListItem[];
  pagination: {
    page: number;
    page_size: 20;
    total: number;
    total_pages: number;
  };
}

export interface AdminAirportAdStatsView extends PortalAirportAdStatsView {
  airport_id: number;
  airport_name: string;
  airport_slug: string;
  coupon_code: string;
  home_slot: AirportHomeAdSlot | null;
  starts_at: string;
  ends_at: string;
  purchased_months: number;
  status: AdminAirportAdDerivedStatus;
}
