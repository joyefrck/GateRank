import type {
  Airport,
  MonthlyReport,
  MonthlyReportListItem,
} from '../types/domain';
import type { MonthlyReportRepository } from '../repositories/monthlyReportRepository';
import { buildAirportReportPath, buildAirportSlugCandidate } from '../../../shared/publicSeo';

export interface PublicMonthlyReportListView {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  items: MonthlyReportListItem[];
}

type MonthlyReportAirportLinkSource = Pick<Airport, 'id' | 'name' | 'website' | 'slug' | 'is_listed'>;

interface MonthlyReportAirportRepository {
  listAll(): Promise<MonthlyReportAirportLinkSource[]>;
}

export class MonthlyReportPublicService {
  constructor(
    private readonly monthlyReportRepository: MonthlyReportRepository,
    private readonly airportRepository?: MonthlyReportAirportRepository,
  ) {}

  async getListView(page = 1, pageSize = 12): Promise<PublicMonthlyReportListView> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(50, Math.max(1, pageSize));
    const result = await this.monthlyReportRepository.listByQuery({
      status: 'published',
      page: safePage,
      pageSize: safePageSize,
    });
    const items = result.items.filter((item) => Boolean(item.published_at));
    return {
      page: safePage,
      page_size: safePageSize,
      total: result.total,
      total_pages: Math.max(1, Math.ceil(result.total / safePageSize)),
      items,
    };
  }

  async getBySlug(slug: string): Promise<MonthlyReport | null> {
    const report = await this.monthlyReportRepository.getPublishedBySlug(slug);
    if (!report || !this.airportRepository) {
      return report;
    }

    const airports = await this.airportRepository.listAll();
    return {
      ...report,
      content_html: enhanceMonthlyReportAirportLinks(report.content_html, airports),
    };
  }

  async getSitemapItems(): Promise<MonthlyReportListItem[]> {
    return this.monthlyReportRepository.listPublishedForSitemap();
  }
}

export function enhanceMonthlyReportAirportLinks(
  html: string,
  airports: MonthlyReportAirportLinkSource[],
): string {
  const linkTargets = buildAirportLinkTargets(airports);
  if (!html || linkTargets.length === 0) {
    return html;
  }

  const hrefByName = new Map(linkTargets.map((target) => [target.name, target.href]));
  const namePattern = new RegExp(linkTargets.map((target) => escapeRegex(target.name)).join('|'), 'g');
  const tagPattern = /<[^>]*>/g;
  const blockedTagStack: string[] = [];
  let result = '';
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html))) {
    result += replaceAirportNamesInText(html.slice(cursor, match.index), namePattern, hrefByName, blockedTagStack.length > 0);

    const tag = match[0];
    result += tag;
    updateBlockedTagStack(tag, blockedTagStack);
    cursor = match.index + tag.length;
  }

  result += replaceAirportNamesInText(html.slice(cursor), namePattern, hrefByName, blockedTagStack.length > 0);
  return result;
}

function buildAirportLinkTargets(airports: MonthlyReportAirportLinkSource[]) {
  const seenNames = new Set<string>();
  return airports
    .filter((airport) => airport.is_listed)
    .map((airport) => {
      const name = airport.name.trim();
      const slug = airport.slug || buildAirportSlugCandidate({ name: airport.name, website: airport.website }) || `airport-${airport.id}`;
      return {
        name,
        href: buildAirportReportPath(slug),
      };
    })
    .filter((target) => {
      if (!target.name || seenNames.has(target.name)) {
        return false;
      }
      seenNames.add(target.name);
      return true;
    })
    .sort((a, b) => b.name.length - a.name.length);
}

function replaceAirportNamesInText(
  text: string,
  namePattern: RegExp,
  hrefByName: Map<string, string>,
  isBlocked: boolean,
): string {
  if (!text || isBlocked) {
    return text;
  }

  namePattern.lastIndex = 0;
  return text.replace(namePattern, (airportName) => {
    const href = hrefByName.get(airportName);
    if (!href) {
      return airportName;
    }

    return `<a class="news-link" href="${escapeHtmlAttribute(href)}" target="_blank" rel="noreferrer noopener">${escapeHtmlText(airportName)}</a>`;
  });
}

function updateBlockedTagStack(tag: string, stack: string[]): void {
  const tagName = getTagName(tag);
  if (!tagName || !['a', 'script', 'style'].includes(tagName)) {
    return;
  }

  if (/^<\s*\//.test(tag)) {
    const index = stack.lastIndexOf(tagName);
    if (index >= 0) {
      stack.splice(index, 1);
    }
    return;
  }

  if (!/\/\s*>$/.test(tag)) {
    stack.push(tagName);
  }
}

function getTagName(tag: string): string {
  const match = /^<\s*\/?\s*([a-z0-9:-]+)/i.exec(tag);
  return match?.[1]?.toLowerCase() || '';
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, '&quot;');
}
