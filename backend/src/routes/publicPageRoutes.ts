import { Router } from 'express';
import type { FullRankingView, HomePageView, ReportView, RiskMonitorView } from '../types/domain';
import type { AirportDealDetailView, AirportDealView } from '../../../shared/airportAds';
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
  renderAirportDealDetailPublicPage,
  renderDealsPublicPage,
  renderFullRankingPublicPage,
  renderHomePublicPage,
  renderMethodologyPublicPage,
  renderMonthlyReportDetailPage,
  renderMonthlyReportsPublicPage,
  renderPublicHtmlError,
  renderRankingTransparencyPublicPage,
  renderReportPublicPage,
  renderRiskMonitorPublicPage,
  renderIpCheckPublicPage,
  renderStreamingCheckPublicPage,
  renderDnsLeakTestPublicPage,
  renderToolsIndexPublicPage,
  renderToolsDownloadPublicPage,
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
import type { ToolsDownloadService } from '../services/toolsDownloadService';
import { isToolDownloadPlatform } from '../../../shared/toolDownloads';
import { sendError } from '../utils/http';

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
  airportDealDetailService?: {
    getBySlug(slug: string): Promise<AirportDealDetailView | null>;
  };
  monthlyReportPublicService?: MonthlyReportPublicService;
  toolsDownloadService?: Pick<ToolsDownloadService, 'getDownloadPageView' | 'getDownloadFileTarget' | 'recordDownload'>;
  pageCache?: TimedPromiseCache;
  frontendAssets?: PublicFrontendAssets;
}

const FULL_RANKING_PUBLIC_PAGE_SIZE = 100;
const FULL_RANKING_CLIENT_PAGE_SIZE = 20;

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
      const [view, clientView] = await Promise.all([
        getCachedFullRankingView(pageCache, deps.publicViewService, renderDate, page, FULL_RANKING_PUBLIC_PAGE_SIZE, filters),
        getCachedFullRankingView(pageCache, deps.publicViewService, renderDate, page, FULL_RANKING_CLIENT_PAGE_SIZE, filters),
      ]);
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderFullRankingPublicPage(
        siteUrl,
        view,
        requestedDate,
        page,
        filters,
        frontendAssets,
        clientView,
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
      const [view, clientView] = await Promise.all([
        getCachedFullRankingView(pageCache, deps.publicViewService, renderDate, page, FULL_RANKING_PUBLIC_PAGE_SIZE, filters),
        getCachedFullRankingView(pageCache, deps.publicViewService, renderDate, page, FULL_RANKING_CLIENT_PAGE_SIZE, filters),
      ]);
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderFullRankingPublicPage(
        siteUrl,
        view,
        requestedDate,
        page,
        filters,
        frontendAssets,
        clientView,
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

  router.get('/deals/:slug', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    const slug = String(req.params.slug || '');
    try {
      if (!deps.airportDealDetailService) {
        throw new Error('airportDealDetailService is not configured');
      }
      const view = await pageCache.getOrLoad(
        `deal-detail:${slug}`,
        () => deps.airportDealDetailService!.getBySlug(slug),
      );
      if (!view) {
        res.status(404).type('html').send(renderPublicHtmlError(siteUrl, 404, '机场优惠页面不存在', frontendAssets));
        return;
      }
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderAirportDealDetailPublicPage(siteUrl, view, frontendAssets));
    } catch (error) {
      console.error('[public-page] failed to render airport deal page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '机场优惠页面加载失败', frontendAssets));
    }
  });

  const redirectToToolsDownload = (req: { url: string }, res: { redirect: (status: number, url: string) => void }) => {
    const queryIndex = req.url.indexOf('?');
    const query = queryIndex >= 0 ? req.url.slice(queryIndex) : '';
    res.redirect(301, `/tools/download${query}`);
  };

  router.get('/download', redirectToToolsDownload);
  router.get('/download/', redirectToToolsDownload);

  router.get('/tools', (req, res) => {
    const siteUrl = getSiteOrigin(req);
    setPublicCacheHeaders(res);
    res.status(200).type('html').send(renderToolsIndexPublicPage(siteUrl, frontendAssets));
  });

  router.get('/tools/', (req, res) => {
    const siteUrl = getSiteOrigin(req);
    setPublicCacheHeaders(res);
    res.status(200).type('html').send(renderToolsIndexPublicPage(siteUrl, frontendAssets));
  });

  router.get('/download/file/:slug', async (req, res, next) => {
    try {
      if (isObviousDownloadBot(req)) {
        sendError(res, 403, 'DOWNLOAD_FORBIDDEN', '当前下载请求被拒绝', req.requestId || 'unknown');
        return;
      }
      const rateLimit = checkToolDownloadRateLimit(req);
      if ('retryAfterMs' in rateLimit) {
        res.setHeader('Retry-After', String(Math.ceil(rateLimit.retryAfterMs / 1000)));
        sendError(res, 429, 'DOWNLOAD_RATE_LIMITED', '下载请求过于频繁，请稍后再试', req.requestId || 'unknown');
        return;
      }
      if (!isToolDownloadPlatform(req.query.platform)) {
        sendError(res, 400, 'BAD_REQUEST', '下载平台无效', req.requestId || 'unknown');
        return;
      }

      const target = await requireToolsDownloadService(deps).getDownloadFileTarget(
        String(req.params.slug || ''),
        req.query.platform,
      );
      await requireToolsDownloadService(deps).recordDownload(target.item.id);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.setHeader('Content-Type', 'application/octet-stream');
      if (target.internalRedirectPath) {
        res.setHeader('Content-Disposition', buildAttachmentContentDisposition(target.downloadFilename));
        res.setHeader('X-Accel-Redirect', target.internalRedirectPath);
        res.status(200).end();
        return;
      }
      res.download(target.absolutePath, target.downloadFilename, (error) => {
        if (error && !res.headersSent) {
          next(error);
        }
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/tools/download', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const service = requireToolsDownloadService(deps);
      const platform = isToolDownloadPlatform(req.query.platform) ? req.query.platform : null;
      const view = await pageCache.getOrLoad(
        `tools-download:${platform || 'all'}`,
        () => service.getDownloadPageView(platform),
      );
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderToolsDownloadPublicPage(siteUrl, view, frontendAssets));
    } catch (error) {
      console.error('[public-page] failed to render download page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '工具下载页加载失败', frontendAssets));
    }
  });

  router.get('/tools/download/', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const service = requireToolsDownloadService(deps);
      const platform = isToolDownloadPlatform(req.query.platform) ? req.query.platform : null;
      const view = await pageCache.getOrLoad(
        `tools-download:${platform || 'all'}`,
        () => service.getDownloadPageView(platform),
      );
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderToolsDownloadPublicPage(siteUrl, view, frontendAssets));
    } catch (error) {
      console.error('[public-page] failed to render download page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '工具下载页加载失败', frontendAssets));
    }
  });

  router.get('/tools/streaming-check', (req, res) => {
    const siteUrl = getSiteOrigin(req);
    setPublicCacheHeaders(res);
    res.status(200).type('html').send(renderStreamingCheckPublicPage(siteUrl, frontendAssets));
  });

  router.get('/tools/ip-check', (req, res) => {
    const siteUrl = getSiteOrigin(req);
    setPublicCacheHeaders(res);
    res.status(200).type('html').send(renderIpCheckPublicPage(siteUrl, frontendAssets));
  });

  router.get('/tools/dns-leak-test', (req, res) => {
    const siteUrl = getSiteOrigin(req);
    setPublicCacheHeaders(res);
    res.status(200).type('html').send(renderDnsLeakTestPublicPage(siteUrl, frontendAssets));
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

  router.get('/ranking-transparency', (_req, res) => {
    const siteUrl = getSiteOrigin(_req);
    setPublicCacheHeaders(res);
    res.status(200).type('html').send(renderRankingTransparencyPublicPage(siteUrl, frontendAssets));
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

function getCachedFullRankingView(
  pageCache: TimedPromiseCache,
  publicViewService: PublicPageDeps['publicViewService'],
  renderDate: string,
  page: number,
  pageSize: number,
  filters: FullRankingFilters,
): Promise<FullRankingView> {
  return pageCache.getOrLoad(
    `full-ranking:${renderDate}:${page}:${pageSize}:${JSON.stringify(filters)}`,
    () => publicViewService.getFullRankingView(renderDate, page, pageSize, filters),
  );
}

function requireMonthlyReportPublicService(deps: PublicPageDeps): MonthlyReportPublicService {
  if (!deps.monthlyReportPublicService) {
    throw new Error('monthlyReportPublicService is not configured');
  }
  return deps.monthlyReportPublicService;
}

function requireToolsDownloadService(deps: PublicPageDeps): Pick<ToolsDownloadService, 'getDownloadPageView' | 'getDownloadFileTarget' | 'recordDownload'> {
  if (!deps.toolsDownloadService) {
    throw new Error('toolsDownloadService is not configured');
  }
  return deps.toolsDownloadService;
}

const TOOL_DOWNLOAD_RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();

function checkToolDownloadRateLimit(req: { headers: Record<string, unknown>; ip?: string }): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const windowMs = Math.max(1000, Number(process.env.TOOL_DOWNLOAD_RATE_WINDOW_MS || 60_000));
  const maxRequests = Math.max(1, Number(process.env.TOOL_DOWNLOAD_RATE_MAX || 30));
  const now = Date.now();
  const key = getDownloadRateLimitKey(req);
  const bucket = TOOL_DOWNLOAD_RATE_BUCKETS.get(key);
  if (!bucket || bucket.resetAt <= now) {
    TOOL_DOWNLOAD_RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  bucket.count += 1;
  if (bucket.count > maxRequests) {
    return { allowed: false, retryAfterMs: Math.max(1000, bucket.resetAt - now) };
  }
  return { allowed: true };
}

function getDownloadRateLimitKey(req: { headers: Record<string, unknown>; ip?: string }): string {
  return String(req.headers['cf-connecting-ip'] || getFirstForwardedIp(req.headers['x-forwarded-for']) || req.ip || 'unknown');
}

function getFirstForwardedIp(value: unknown): string {
  const header = Array.isArray(value) ? value[0] : value;
  return String(header || '').split(',')[0]?.trim() || '';
}

function isObviousDownloadBot(req: { headers: Record<string, unknown> }): boolean {
  const userAgent = String(req.headers['user-agent'] || '').trim().toLowerCase();
  if (!userAgent) {
    return true;
  }
  return /\b(curl|wget|python-requests|python-urllib|go-http-client|java\/|libwww-perl|scrapy|httpclient|okhttp|axios|node-fetch|undici|headlesschrome|phantomjs|bot|crawler|spider|scanner)\b/.test(userAgent);
}

function buildAttachmentContentDisposition(filename: string): string {
  const fallback = filename
    .replace(/[^\x20-\x7E]+/g, '_')
    .replace(/["\\;]+/g, '_')
    .trim() || 'download';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeRfc5987ValueChars(filename)}`;
}

function encodeRfc5987ValueChars(value: string): string {
  return encodeURIComponent(value)
    .replace(/['()]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, '%2A');
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
