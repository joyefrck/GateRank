interface ReportRankingPage {
  date?: string;
  total_pages?: number;
  items: Array<{ report_url?: string | null }>;
}

export interface ReportRankingSource {
  getFullRankingView(date: string, page: number, pageSize: number): Promise<ReportRankingPage>;
}

/** Collect every existing report, independently of the first ranking page size. */
export async function getPublicReportPaths(source: ReportRankingSource, date: string) {
  const first = await source.getFullRankingView(date, 1, 100);
  const resolvedDate = first.date || date;
  const paths = new Set<string>();
  const collect = (view: ReportRankingPage) => {
    for (const item of view.items) {
      if (item.report_url?.startsWith('/airports/')) paths.add(item.report_url);
    }
  };
  collect(first);
  for (let page = 2; page <= (first.total_pages || 1); page += 1) {
    collect(await source.getFullRankingView(resolvedDate, page, 100));
  }
  return { date: resolvedDate, paths: [...paths] };
}
