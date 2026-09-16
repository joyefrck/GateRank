import type { FullRankingView } from '../types/domain';
import type { AirportDirectoryView } from '../../../shared/airportDirectory';

export async function getAirportDirectoryView(source: {
  getFullRankingView(date: string, page: number, pageSize: number): Promise<FullRankingView>;
}, date: string): Promise<AirportDirectoryView> {
  const first = await source.getFullRankingView(date, 1, 100);
  const items = new Map<string, { name: string; path: string }>();
  const collect = (view: FullRankingView) => {
    for (const item of view.items) {
      if (item.report_url?.startsWith('/airports/')) {
        items.set(item.report_url, { name: item.name, path: item.report_url });
      }
    }
  };
  collect(first);
  for (let page = 2; page <= first.total_pages; page++) {
    collect(await source.getFullRankingView(first.date, page, 100));
  }
  return { date: first.date, items: [...items.values()].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN') || a.path.localeCompare(b.path)) };
}
