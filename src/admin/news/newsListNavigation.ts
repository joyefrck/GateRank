export type NewsListStatusFilter = 'all' | 'draft' | 'published' | 'archived';

export interface NewsListQueryState {
  keyword: string;
  status: NewsListStatusFilter;
  category: string;
  page: number;
}

const NEWS_STATUS_FILTERS = new Set<NewsListStatusFilter>([
  'all',
  'draft',
  'published',
  'archived',
]);

export function readNewsListQuery(search: string): NewsListQueryState {
  const params = new URLSearchParams(search);
  const status = params.get('status') || 'all';
  const page = Number(params.get('page'));

  return {
    keyword: (params.get('keyword') || '').trim(),
    status: NEWS_STATUS_FILTERS.has(status as NewsListStatusFilter)
      ? status as NewsListStatusFilter
      : 'all',
    category: (params.get('category') || '').trim() || 'all',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

export function buildNewsListSearch(query: NewsListQueryState): string {
  const params = new URLSearchParams();
  const keyword = query.keyword.trim();

  if (keyword) {
    params.set('keyword', keyword);
  }
  if (query.status !== 'all') {
    params.set('status', query.status);
  }
  if (query.category !== 'all') {
    params.set('category', query.category);
  }
  if (query.page > 1) {
    params.set('page', String(query.page));
  }

  const search = params.toString();
  return search ? `?${search}` : '';
}

export function buildNewsListPath(query: NewsListQueryState): string {
  return `/admin/news${buildNewsListSearch(query)}`;
}
