import { Router } from 'express';
import type { FullRankingView, HomePageView, ReportView, RiskMonitorView } from '../types/domain';
import type { AirportDealView } from '../../../shared/airportAds';
import { getSiteOrigin } from '../utils/siteUrl';
import { getDateInTimezone } from '../utils/time';
import {
  createTimedPromiseCache,
  PUBLIC_PAGE_CACHE_TTL_MS,
  setPublicCacheHeaders,
  type TimedPromiseCache,
} from '../utils/publicCache';
import {
  renderApplyPublicPage,
  renderDealsPublicPage,
  renderFullRankingPublicPage,
  renderHomePublicPage,
  renderMethodologyPublicPage,
  renderMonthlyReportDetailPage,
  renderMonthlyReportsPublicPage,
  renderPublicHtmlError,
  renderReportPublicPage,
  renderRiskMonitorPublicPage,
} from '../services/publicPageRenderer';
import {
  resolvePublicFrontendAssets,
  type PublicFrontendAssets,
} from '../services/frontendAssets';
import {
  buildFullRankingPath,
  parseFullRankingFilters,
  parseFullRankingStaticPath,
  EMPTY_FULL_RANKING_FILTERS,
  type FullRankingFilters,
} from '../../../shared/fullRankingFilters';
import type { MonthlyReportPublicService } from '../services/monthlyReportPublicService';

interface PublicPageDeps {
  publicViewService: {
    getHomePageView(date: string): Promise<HomePageView>;
    getFullRankingView(date: string, page: number, pageSize: number, filters?: FullRankingFilters): Promise<FullRankingView>;
    getRiskMonitorView(date: string, page: number, pageSize: number): Promise<RiskMonitorView>;
    getReportView(airportId: number, date: string): Promise<ReportView | null>;
    getReportViewBySlug?(slug: string, date: string): Promise<ReportView | null>;
  };
  airportAdCampaignRepository?: {
    listActiveDeals(): Promise<AirportDealView[]>;
  };
  monthlyReportPublicService?: MonthlyReportPublicService;
  pageCache?: TimedPromiseCache;
  frontendAssets?: PublicFrontendAssets;
}

const FULL_RANKING_PUBLIC_PAGE_SIZE = 100;

export function createPublicPageRoutes(deps: PublicPageDeps): Router {
  const router = Router();
  const pageCache = deps.pageCache || createTimedPromiseCache(PUBLIC_PAGE_CACHE_TTL_MS);
  const frontendAssets = deps.frontendAssets || resolvePublicFrontendAssets();

  router.get('/', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const requestedDate = parseDateQuery(req.query.date);
      const renderDate = requestedDate || getDateInTimezone();
      const view = await pageCache.getOrLoad(
        `home:${renderDate}`,
        () => deps.publicViewService.getHomePageView(renderDate),
      );
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderHomePublicPage(siteUrl, view, requestedDate, frontendAssets));
    } catch (error) {
      console.error('[public-page] failed to render home page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '首页加载失败', frontendAssets));
    }
  });

  router.get('/rankings/all', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const requestedDate = parseDateQuery(req.query.date);
      const page = toPositiveInt(req.query.page, 1);
      const filters = parseFullRankingFilters(req.query);
      if (redirectFullRankingQuery(req, res, requestedDate, page, filters)) {
        return;
      }
      const renderDate = requestedDate || getDateInTimezone();
      const view = await pageCache.getOrLoad(
        `full-ranking:${renderDate}:${page}:${FULL_RANKING_PUBLIC_PAGE_SIZE}:${JSON.stringify(filters)}`,
        () => deps.publicViewService.getFullRankingView(
          renderDate,
          page,
          FULL_RANKING_PUBLIC_PAGE_SIZE,
          filters,
        ),
      );
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderFullRankingPublicPage(
        siteUrl,
        view,
        requestedDate,
        page,
        filters,
        frontendAssets,
      ));
    } catch (error) {
      console.error('[public-page] failed to render full ranking page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '机场排行加载失败', frontendAssets));
    }
  });

  router.get('/rankings/:category/:slug', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const staticRoute = parseFullRankingStaticPath(req.path);
      if (!staticRoute) {
        res.status(404).type('html').send(renderPublicHtmlError(siteUrl, 404, '筛选榜单不存在', frontendAssets));
        return;
      }
      const requestedDate = parseDateQuery(req.query.date);
      const page = toPositiveInt(req.query.page, 1);
      const filters = {
        ...EMPTY_FULL_RANKING_FILTERS,
        [staticRoute.category]: [staticRoute.value],
      };
      if (redirectFullRankingQuery(req, res, requestedDate, page, filters)) {
        return;
      }
      const renderDate = requestedDate || getDateInTimezone();
      const view = await pageCache.getOrLoad(
        `full-ranking:${renderDate}:${page}:${FULL_RANKING_PUBLIC_PAGE_SIZE}:${JSON.stringify(filters)}`,
        () => deps.publicViewService.getFullRankingView(
          renderDate,
          page,
          FULL_RANKING_PUBLIC_PAGE_SIZE,
          filters,
        ),
      );
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderFullRankingPublicPage(
        siteUrl,
        view,
        requestedDate,
        page,
        filters,
        frontendAssets,
      ));
    } catch (error) {
      console.error('[public-page] failed to render static full ranking page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '筛选榜单加载失败', frontendAssets));
    }
  });

  router.get('/risk-monitor', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const requestedDate = parseDateQuery(req.query.date);
      const page = toPositiveInt(req.query.page, 1);
      if (redirectDefaultDateQuery(req, res, PUBLIC_RISK_MONITOR_PATH, requestedDate, page)) {
        return;
      }
      const renderDate = requestedDate || getDateInTimezone();
      const view = await pageCache.getOrLoad(
        `risk-monitor:${renderDate}:${page}:20`,
        () => deps.publicViewService.getRiskMonitorView(
          renderDate,
          page,
          20,
        ),
      );
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderRiskMonitorPublicPage(siteUrl, view, requestedDate, page, frontendAssets));
    } catch (error) {
      console.error('[public-page] failed to render risk monitor page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '跑路监测加载失败', frontendAssets));
    }
  });

  router.get('/deals', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      if (!deps.airportAdCampaignRepository) {
        throw new Error('airportAdCampaignRepository is not configured');
      }
      const deals = await pageCache.getOrLoad(
        'deals:active',
        () => deps.airportAdCampaignRepository!.listActiveDeals(),
      );
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderDealsPublicPage(siteUrl, deals, frontendAssets));
    } catch (error) {
      console.error('[public-page] failed to render deals page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '活动优惠加载失败', frontendAssets));
    }
  });

  router.get('/api/v1/monthly-reports', async (req, res, next) => {
    try {
      const service = requireMonthlyReportPublicService(deps);
      const page = toPositiveInt(req.query.page, 1);
      const pageSize = toPositiveInt(req.query.page_size, 12);
      res.json(await service.getListView(page, pageSize));
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/v1/monthly-reports/:slug', async (req, res, next) => {
    try {
      const service = requireMonthlyReportPublicService(deps);
      const report = await service.getBySlug(String(req.params.slug || ''));
      if (!report) {
        res.status(404).json({ code: 'MONTHLY_REPORT_NOT_FOUND', message: '月度报告不存在或尚未发布' });
        return;
      }
      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  router.get('/monthly-reports', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const service = requireMonthlyReportPublicService(deps);
      const page = toPositiveInt(req.query.page, 1);
      const view = await pageCache.getOrLoad(
        `monthly-reports:${page}:12`,
        () => service.getListView(page, 12),
      );
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderMonthlyReportsPublicPage(siteUrl, view, frontendAssets));
    } catch (error) {
      console.error('[public-page] failed to render monthly reports page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '月度报告加载失败', frontendAssets));
    }
  });

  router.get('/monthly-reports/:slug', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const service = requireMonthlyReportPublicService(deps);
      const slug = String(req.params.slug || '');
      const report = await pageCache.getOrLoad(
        `monthly-report:${slug}`,
        () => service.getBySlug(slug),
      );
      if (!report) {
        res.status(404).type('html').send(renderPublicHtmlError(siteUrl, 404, '月度报告不存在或尚未发布', frontendAssets));
        return;
      }
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderMonthlyReportDetailPage(siteUrl, report, false, frontendAssets));
    } catch (error) {
      console.error('[public-page] failed to render monthly report page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '月度报告加载失败', frontendAssets));
    }
  });

  router.get('/risk-watch', (req, res) => {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, `/risk-monitor${query}`);
  });

  router.get('/methodology', (_req, res) => {
    const siteUrl = getSiteOrigin(_req);
    setPublicCacheHeaders(res);
    res.status(200).type('html').send(renderMethodologyPublicPage(siteUrl, frontendAssets));
  });

  router.get('/apply', (_req, res) => {
    const siteUrl = getSiteOrigin(_req);
    setPublicCacheHeaders(res);
    res.status(200).type('html').send(renderApplyPublicPage(siteUrl, frontendAssets));
  });

  router.get('/airports/:slug', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const requestedDate = parseDateQuery(req.query.date);
      const view = await deps.publicViewService.getReportViewBySlug?.(
        String(req.params.slug || ''),
        requestedDate || getDateInTimezone(),
      );
      if (!view) {
        res.status(404).type('html').send(renderPublicHtmlError(siteUrl, 404, '报告不存在', frontendAssets));
        return;
      }

      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderReportPublicPage(siteUrl, view, requestedDate, frontendAssets));
    } catch (error) {
      console.error('[public-page] failed to render airport report page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '报告加载失败', frontendAssets));
    }
  });

  router.get('/reports/:id', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const airportId = toPositiveInt(req.params.id, 0);
      if (!airportId) {
        res.status(404).type('html').send(renderPublicHtmlError(siteUrl, 404, '报告不存在', frontendAssets));
        return;
      }

      const requestedDate = parseDateQuery(req.query.date);
      const view = await deps.publicViewService.getReportView(airportId, requestedDate || getDateInTimezone());
      if (!view) {
        res.status(404).type('html').send(renderPublicHtmlError(siteUrl, 404, '报告不存在', frontendAssets));
        return;
      }

      setPublicCacheHeaders(res);
      res.redirect(301, `/airports/${encodeURIComponent(view.airport.slug)}`);
      return;
    } catch (error) {
      console.error('[public-page] failed to render report page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '报告加载失败', frontendAssets));
    }
  });

  return router;
}

function requireMonthlyReportPublicService(deps: PublicPageDeps): MonthlyReportPublicService {
  if (!deps.monthlyReportPublicService) {
    throw new Error('monthlyReportPublicService is not configured');
  }
  return deps.monthlyReportPublicService;
}

const PUBLIC_RANKING_PATH = '/rankings/all';
const PUBLIC_RISK_MONITOR_PATH = '/risk-monitor';
function redirectDefaultDateQuery(
  req: { query: Record<string, unknown> },
  res: { redirect(status: number, path: string): void },
  pathname: string,
  requestedDate: string | undefined,
  page: number,
): boolean {
  if (!requestedDate || req.query.date !== requestedDate || requestedDate !== getDateInTimezone()) {
    return false;
  }

  const search = new URLSearchParams();
  if (page > 1) {
    search.set('page', String(page));
  }
  const query = search.toString();
  res.redirect(301, `${pathname}${query ? `?${query}` : ''}`);
  return true;
}

function redirectFullRankingQuery(
  req: { query: Record<string, unknown>; originalUrl?: string; url?: string },
  res: { redirect(status: number, path: string): void },
  requestedDate: string | undefined,
  page: number,
  filters: FullRankingFilters,
): boolean {
  const normalizedDate = requestedDate === getDateInTimezone() ? undefined : requestedDate;
  const normalizedPath = buildFullRankingPath(filters, { date: normalizedDate, page });
  const currentPath = req.originalUrl || req.url || PUBLIC_RANKING_PATH;
  if (currentPath !== normalizedPath) {
    res.redirect(301, normalizedPath);
    return true;
  }
  return false;
}

function parseDateQuery(input: unknown): string | undefined {
  if (input === undefined || input === null || input === '') {
    return undefined;
  }
  const date = String(input);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
}

function toPositiveInt(value: unknown, fallback: number): number {
  const num = Number(value ?? fallback);
  return Number.isInteger(num) && num > 0 ? num : fallback;
}
