import {
  AIRPORT_FILTER_CATALOG,
  AIRPORT_PRIMARY_INDEXABLE_FILTER_CATEGORIES,
  getAirportFilterOption,
  getAirportFilterSeoLabel,
  type AirportFilterCategory,
  type AirportPrimaryIndexableFilterCategory,
} from './airportFilterCatalog';

export interface FullRankingFilters {
  q: string;
  payment: string[];
  streaming: string[];
  client: string[];
  import: string[];
  region: string[];
  line: string[];
  trial: boolean | null;
  annual: boolean | null;
  lifetime: boolean | null;
  telegram: boolean | null;
  price_min: number | null;
  price_max: number | null;
}

export interface FullRankingSeoDecision {
  robots: 'index,follow,max-image-preview:large' | 'noindex,follow';
  canonicalFilters: FullRankingFilters;
  isIndexable: boolean;
  primaryCategory: AirportPrimaryIndexableFilterCategory | null;
  primaryValue: string | null;
  primaryLabel: string | null;
}

export interface FullRankingStaticFilterRoute {
  category: AirportPrimaryIndexableFilterCategory;
  value: string;
}

export const EMPTY_FULL_RANKING_FILTERS: FullRankingFilters = {
  q: '',
  payment: [],
  streaming: [],
  client: [],
  import: [],
  region: [],
  line: [],
  trial: null,
  annual: null,
  lifetime: null,
  telegram: null,
  price_min: null,
  price_max: null,
};

const ARRAY_FILTER_KEYS = ['payment', 'streaming', 'client', 'import', 'region', 'line'] as const;
type ArrayFilterKey = (typeof ARRAY_FILTER_KEYS)[number];

export function parseFullRankingFilters(source: URLSearchParams | Record<string, unknown>): FullRankingFilters {
  const filters: FullRankingFilters = { ...EMPTY_FULL_RANKING_FILTERS };
  filters.q = normalizeSearchText(firstValue(source, 'q'));
  for (const key of ARRAY_FILTER_KEYS) {
    filters[key] = normalizeKnownValues(values(source, key), key);
  }
  filters.trial = normalizeBooleanFilter(firstValue(source, 'trial'));
  filters.annual = normalizeBooleanFilter(firstValue(source, 'annual'));
  filters.lifetime = normalizeBooleanFilter(firstValue(source, 'lifetime'));
  filters.telegram = normalizeBooleanFilter(firstValue(source, 'telegram'));
  filters.price_min = normalizePrice(firstValue(source, 'price_min'));
  filters.price_max = normalizePrice(firstValue(source, 'price_max'));
  if (filters.price_min !== null && filters.price_max !== null && filters.price_min > filters.price_max) {
    [filters.price_min, filters.price_max] = [filters.price_max, filters.price_min];
  }
  return filters;
}

export function hasFullRankingFilters(filters: FullRankingFilters): boolean {
  return getFullRankingFilterCount(filters) > 0;
}

export function getFullRankingFilterCount(filters: FullRankingFilters): number {
  return [
    filters.q ? 1 : 0,
    ...ARRAY_FILTER_KEYS.map((key) => filters[key].length),
    filters.trial === null ? 0 : 1,
    filters.annual === null ? 0 : 1,
    filters.lifetime === null ? 0 : 1,
    filters.telegram === null ? 0 : 1,
    filters.price_min === null ? 0 : 1,
    filters.price_max === null ? 0 : 1,
  ].reduce((sum, value) => sum + value, 0);
}

export function buildFullRankingQuery(filters: FullRankingFilters, input: {
  date?: string;
  page?: number;
} = {}): string {
  const search = new URLSearchParams();
  if (input.date) {
    search.set('date', input.date);
  }
  if (input.page && input.page > 1) {
    search.set('page', String(input.page));
  }
  if (filters.q) {
    search.set('q', filters.q);
  }
  for (const key of ARRAY_FILTER_KEYS) {
    for (const value of filters[key]) {
      search.append(key, value);
    }
  }
  setBooleanParam(search, 'trial', filters.trial);
  setBooleanParam(search, 'annual', filters.annual);
  setBooleanParam(search, 'lifetime', filters.lifetime);
  setBooleanParam(search, 'telegram', filters.telegram);
  if (filters.price_min !== null) {
    search.set('price_min', formatPriceParam(filters.price_min));
  }
  if (filters.price_max !== null) {
    search.set('price_max', formatPriceParam(filters.price_max));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function buildFullRankingPath(filters: FullRankingFilters, input: {
  date?: string;
  page?: number;
} = {}): string {
  const staticRoute = getSingleStaticFilterRoute(filters);
  if (staticRoute && (!input.page || input.page <= 1)) {
    const query = buildQueryFromEntries(input.date ? [['date', input.date]] : []);
    return `${buildFullRankingStaticPath(staticRoute.category, staticRoute.value)}${query}`;
  }
  return `/rankings/all${buildFullRankingQuery(filters, input)}`;
}

export function getIndexableFullRankingFilterPaths(): string[] {
  return AIRPORT_PRIMARY_INDEXABLE_FILTER_CATEGORIES.flatMap((category) => (
    AIRPORT_FILTER_CATALOG[category].filter((option) => option.indexable !== false).map((option) => (
      buildFullRankingStaticPath(category, option.key)
    ))
  ));
}

export function buildFullRankingStaticPath(category: AirportPrimaryIndexableFilterCategory, value: string): string {
  return `/rankings/${buildFullRankingStaticCategorySegment(category)}/${encodeURIComponent(buildFullRankingStaticSlug(value))}`;
}

export function parseFullRankingStaticPath(pathname: string): FullRankingStaticFilterRoute | null {
  const match = pathname.match(/^\/rankings\/([^/?#]+)\/([^/?#]+)\/?$/);
  if (!match) {
    return null;
  }
  const category = parseFullRankingStaticCategorySegment(decodeURIComponent(match[1]));
  if (!category) {
    return null;
  }
  const slug = decodeURIComponent(match[2]);
  const option = AIRPORT_FILTER_CATALOG[category].find((item) => (
    item.indexable !== false && buildFullRankingStaticSlug(item.key) === slug
  ));
  return option ? { category, value: option.key } : null;
}

export function getSingleStaticFilterRoute(filters: FullRankingFilters): FullRankingStaticFilterRoute | null {
  const decision = getFullRankingSeoDecision(filters, 1);
  if (!decision.primaryCategory || !decision.primaryValue || getFullRankingFilterCount(filters) !== 1) {
    return null;
  }
  return {
    category: decision.primaryCategory,
    value: decision.primaryValue,
  };
}

export function getFullRankingSeoDecision(filters: FullRankingFilters, page = 1): FullRankingSeoDecision {
  const primarySelections = AIRPORT_PRIMARY_INDEXABLE_FILTER_CATEGORIES.flatMap((category) => (
    filters[category].map((value) => ({ category, value }))
  ));
  const hasDisqualifyingFilter = Boolean(
    filters.q
    || filters.import.length > 0
    || filters.trial !== null
    || filters.annual !== null
    || filters.lifetime !== null
    || filters.telegram !== null
    || filters.price_min !== null
    || filters.price_max !== null,
  );
  const basePage = primarySelections.length === 0 && !hasDisqualifyingFilter;
  const singlePrimary = primarySelections.length === 1;
  const primary = singlePrimary ? primarySelections[0] : null;
  const indexablePrimary = primary
    && getAirportFilterOption(primary.category, primary.value)?.indexable !== false
    ? primary
    : null;
  const isIndexable = basePage || (Boolean(indexablePrimary) && !hasDisqualifyingFilter && page <= 1);
  const canonicalFilters = indexablePrimary
    ? { ...EMPTY_FULL_RANKING_FILTERS, [indexablePrimary.category]: [indexablePrimary.value] }
    : { ...EMPTY_FULL_RANKING_FILTERS };

  return {
    robots: isIndexable ? 'index,follow,max-image-preview:large' : 'noindex,follow',
    canonicalFilters,
    isIndexable,
    primaryCategory: indexablePrimary?.category || null,
    primaryValue: indexablePrimary?.value || null,
    primaryLabel: indexablePrimary
      ? getAirportFilterSeoLabel(indexablePrimary.category, indexablePrimary.value)
      : null,
  };
}

export function fullRankingFiltersEqual(left: FullRankingFilters, right: FullRankingFilters): boolean {
  return buildFullRankingQuery(left) === buildFullRankingQuery(right);
}

export function cloneFullRankingFilters(filters: FullRankingFilters): FullRankingFilters {
  return {
    q: filters.q,
    payment: [...filters.payment],
    streaming: [...filters.streaming],
    client: [...filters.client],
    import: [...filters.import],
    region: [...filters.region],
    line: [...filters.line],
    trial: filters.trial,
    annual: filters.annual,
    lifetime: filters.lifetime,
    telegram: filters.telegram,
    price_min: filters.price_min,
    price_max: filters.price_max,
  };
}

function normalizeKnownValues(values: string[], category: ArrayFilterKey): string[] {
  const allowed = new Set(AIRPORT_FILTER_CATALOG[category].map((item) => item.key));
  return [...new Set(values.map((item) => item.trim()).filter((item) => allowed.has(item)))];
}

function buildFullRankingStaticCategorySegment(category: AirportPrimaryIndexableFilterCategory): string {
  return category === 'streaming' ? 'unlock' : category;
}

function parseFullRankingStaticCategorySegment(segment: string): AirportPrimaryIndexableFilterCategory | null {
  const category = segment === 'unlock' ? 'streaming' : segment;
  return (AIRPORT_PRIMARY_INDEXABLE_FILTER_CATEGORIES as readonly string[]).includes(category)
    ? category as AirportPrimaryIndexableFilterCategory
    : null;
}

function buildFullRankingStaticSlug(value: string): string {
  return value.replace(/_/g, '-');
}

function buildQueryFromEntries(entries: Array<[string, string]>): string {
  const search = new URLSearchParams(entries);
  const query = search.toString();
  return query ? `?${query}` : '';
}

function values(source: URLSearchParams | Record<string, unknown>, key: string): string[] {
  if (source instanceof URLSearchParams) {
    return splitValues(source.getAll(key));
  }
  const value = source[key];
  if (Array.isArray(value)) {
    return splitValues(value.map((item) => String(item)));
  }
  if (value === undefined || value === null) {
    return [];
  }
  return splitValues([String(value)]);
}

function firstValue(source: URLSearchParams | Record<string, unknown>, key: string): string | undefined {
  return values(source, key)[0];
}

function splitValues(rawValues: string[]): string[] {
  return rawValues
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSearchText(value: string | undefined): string {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function normalizeBooleanFilter(value: string | undefined): boolean | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no') {
    return false;
  }
  return null;
}

function normalizePrice(value: string | undefined): number | null {
  if (value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100) / 100;
}

function setBooleanParam(search: URLSearchParams, key: string, value: boolean | null): void {
  if (value !== null) {
    search.set(key, value ? '1' : '0');
  }
}

function formatPriceParam(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}
