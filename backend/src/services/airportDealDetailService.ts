import type { Airport } from '../types/domain';
import {
  sortAirportDealViews,
  type AirportDealDetailView,
  type AirportDealView,
} from '../../../shared/airportAds';
import { formatDateTimeInTimezoneIso } from '../utils/time';

interface AirportDealDetailServiceDeps {
  airportRepository: {
    getBySlug(slug: string): Promise<Airport | null>;
  };
  airportAdCampaignRepository: {
    listActiveDeals(now?: Date): Promise<AirportDealView[]>;
  };
}

export class AirportDealDetailService {
  constructor(private readonly deps: AirportDealDetailServiceDeps) {}

  async getBySlug(slug: string, now: Date = new Date()): Promise<AirportDealDetailView | null> {
    const airport = await this.deps.airportRepository.getBySlug(slug);
    if (!airport || !airport.is_listed || !airport.slug) {
      return null;
    }

    const deals = await this.deps.airportAdCampaignRepository.listActiveDeals(now);
    const airportDeals = deals.filter((deal) => deal.airport_id === airport.id);
    airportDeals.forEach(assertRenderableAirportDeal);

    return {
      airport: {
        id: airport.id,
        slug: airport.slug,
        name: airport.name,
        website: airport.website,
        status: airport.status,
        plan_price_month: Number(airport.plan_price_month || 0),
        has_trial: Boolean(airport.has_trial),
        payment_methods: airport.payment_methods || [],
        airport_intro: airport.airport_intro || '',
        tags: airport.tags || [],
      },
      active_deals: sortAirportDealViews(airportDeals),
      generated_at: formatDateTimeInTimezoneIso(now),
    };
  }
}

function assertRenderableAirportDeal(deal: AirportDealView): void {
  for (const [field, value] of [
    ['coupon_code', deal.coupon_code],
    ['discount_title', deal.discount_title],
    ['discount_description', deal.discount_description],
    ['applicable_plan', deal.applicable_plan],
    ['starts_at', deal.starts_at],
    ['ends_at', deal.ends_at],
  ] as const) {
    if (!String(value || '').trim()) {
      throw new Error(`invalid active airport deal ${deal.campaign_id}: ${field}`);
    }
  }
}
