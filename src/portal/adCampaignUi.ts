import {
  AIRPORT_AD_MONTHLY_PRICE,
  type PortalAirportAdCampaignView,
  type PortalAirportAdStatus,
} from '../../shared/airportAds';

export function getCampaignMonthlyPrice(
  status: PortalAirportAdStatus,
  campaign: Pick<PortalAirportAdCampaignView, 'home_slot'>,
): number {
  const ordinaryPrice = status.monthly_price || AIRPORT_AD_MONTHLY_PRICE;
  if (!campaign.home_slot) {
    return ordinaryPrice;
  }
  return status.home_slot_monthly_prices?.[campaign.home_slot] || ordinaryPrice;
}

export function getRenewalEndsAt(
  campaign: Pick<PortalAirportAdCampaignView, 'ends_at'>,
  months: number,
  now: Date = new Date(),
): Date {
  const currentEndsAt = new Date(campaign.ends_at);
  const base = Number.isNaN(currentEndsAt.getTime()) || currentEndsAt.getTime() <= now.getTime()
    ? now
    : currentEndsAt;
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}
