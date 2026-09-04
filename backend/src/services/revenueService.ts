import { EMPTY_REVENUE_TOTALS, revenuePeriods, shiftRevenueDate, type RevenueQuery, type RevenueGroup, type RevenueOverview, type RevenuePage } from '../../../shared/revenue';
import type { RevenueRepository } from '../repositories/revenueRepository';
export function previousRevenueQuery(query: RevenueQuery): RevenueQuery {
  const days = Math.round((Date.parse(query.date_to) - Date.parse(query.date_from)) / 86400000) + 1;
  return { ...query, date_from: shiftRevenueDate(query.date_from, -days), date_to: shiftRevenueDate(query.date_from, -1) };
}
export function fillRevenuePeriods(query: RevenueQuery, groups: RevenueGroup[]): RevenueGroup[] {
  const map = new Map(groups.map(group => [group.key, group]));
  return revenuePeriods(query).map(key => map.get(key) || { ...EMPTY_REVENUE_TOTALS, key, name: key });
}
export class RevenueService {
  constructor(private readonly repository: RevenueRepository) {}
  overview(query: RevenueQuery): Promise<RevenueOverview> {
    return this.repository.snapshot(async reader => {
      const updated_at = new Date().toISOString();
      const totals = await reader.totals(query), previous = await reader.totals(previousRevenueQuery(query));
      const trend = fillRevenuePeriods(query, await reader.groups(query, 'period'));
      const kinds = await reader.groups(query, 'kind');
      const channels = query.view === 'receipts' ? await reader.groups(query, 'channel') : [];
      const placements = query.view === 'income' ? await reader.groups(query, 'placement') : [];
      const top_airports = await reader.groups({ ...query, sort: 'amount', order: 'desc' }, 'entity', { limit: 10, offset: 0 });
      const top_five_share = totals.amount_cents ? top_airports.slice(0, 5).reduce((sum, row) => sum + row.amount_cents, 0) / totals.amount_cents : 0;
      return { totals, previous, trend, kinds, channels, placements, top_airports, top_five_share, updated_at, missing_payment_time_count: await reader.missingTimes(query) };
    });
  }
  airports(query: RevenueQuery): Promise<RevenuePage<RevenueGroup>> {
    return this.repository.snapshot(async reader => {
      const total = (await reader.totals(query)).entity_count;
      const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.page_size)));
      const items = await reader.groups(query, 'entity', { limit: query.page_size, offset: (page - 1) * query.page_size });
      return { items, total, page, page_size: query.page_size };
    });
  }
  periods(query: RevenueQuery): Promise<RevenuePage<RevenueGroup>> {
    return this.repository.snapshot(async reader => {
      const groups = fillRevenuePeriods(query, await reader.groups(query, 'period'));
      groups.sort((a, b) => {
        const difference = query.sort === 'amount' ? a.amount_cents - b.amount_cents : a.key.localeCompare(b.key);
        return (query.order === 'asc' ? difference : -difference) || a.key.localeCompare(b.key);
      });
      const total = groups.length, page = Math.min(query.page, Math.max(1, Math.ceil(total / query.page_size)));
      return { items: groups.slice((page - 1) * query.page_size, page * query.page_size), total, page, page_size: query.page_size };
    });
  }
  transactions(query: RevenueQuery) { return this.repository.snapshot(reader => reader.transactions(query)); }
  filters(query: RevenueQuery) {
    return this.repository.snapshot(async reader => (await reader.groups({ ...query, entity: '', sort: 'name', order: 'asc' }, 'entity')).map(({ key, name }) => ({ key, name })));
  }
}
