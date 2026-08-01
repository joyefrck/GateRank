import {
  AIRPORT_HOME_AD_SLOTS,
  type AdminAirportAdPlacementFilter,
  type AdminAirportAdStatusFilter,
} from '../../../shared/airportAds';

export interface AdminMarketingStatisticsQueryState {
  page: number;
  q: string;
  status: AdminAirportAdStatusFilter;
  placement: AdminAirportAdPlacementFilter;
}

const STATUS_VALUES: AdminAirportAdStatusFilter[] = ['all', 'active', 'expired', 'canceled'];
const PLACEMENT_VALUES: AdminAirportAdPlacementFilter[] = [
  'all',
  'deal',
  ...AIRPORT_HOME_AD_SLOTS.map((slot): `home_${typeof slot}` => `home_${slot}`),
];

export function readAdminMarketingStatisticsQuery(search: string): AdminMarketingStatisticsQueryState {
  const params = new URLSearchParams(search);
  const pageValue = Number(params.get('page'));
  const statusValue = params.get('status');
  const placementValue = params.get('placement');
  return {
    page: Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1,
    q: (params.get('q') || '').trim(),
    status: STATUS_VALUES.includes(statusValue as AdminAirportAdStatusFilter)
      ? statusValue as AdminAirportAdStatusFilter
      : 'all',
    placement: PLACEMENT_VALUES.includes(placementValue as AdminAirportAdPlacementFilter)
      ? placementValue as AdminAirportAdPlacementFilter
      : 'all',
  };
}

export function buildAdminMarketingStatisticsSearch(state: AdminMarketingStatisticsQueryState): string {
  const params = new URLSearchParams();
  const keyword = state.q.trim();
  if (keyword) params.set('q', keyword);
  if (state.status !== 'all') params.set('status', state.status);
  if (state.placement !== 'all') params.set('placement', state.placement);
  if (state.page > 1) params.set('page', String(state.page));
  const search = params.toString();
  return search ? `?${search}` : '';
}

export function updateAdminMarketingStatisticsQuery(
  current: AdminMarketingStatisticsQueryState,
  patch: Partial<AdminMarketingStatisticsQueryState>,
): AdminMarketingStatisticsQueryState {
  const changesFilter = patch.q !== undefined || patch.status !== undefined || patch.placement !== undefined;
  return {
    ...current,
    ...patch,
    page: changesFilter ? 1 : patch.page ?? current.page,
  };
}
