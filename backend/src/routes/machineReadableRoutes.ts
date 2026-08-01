import { Router } from 'express';
import type { FullRankingView, HomePageView, MonthlyReport, ReportView, RiskMonitorView } from '../types/domain';
import type { AirportDealView } from '../../../shared/airportAds';
import { setPublicCacheHeaders } from '../utils/publicCache';
import { getSiteOrigin } from '../utils/siteUrl';
import { getDateInTimezone } from '../utils/time';
import {
  buildDealsData,
  buildMonthlyReportsData,
  buildRankingsData,
  buildRiskMonitorData,
  buildSummaryData,
  renderAirportMarkdown,
  renderDataIndexMarkdown,
  renderDealsMarkdown,
  renderLlmsFullTxt,
  renderLlmsTxt,
  renderMonthlyReportDetailMarkdown,
  renderMonthlyReportsMarkdown,
  renderRankingsMarkdown,
  renderRobotsTxt,
  renderRiskMonitorMarkdown,
  renderSummaryMarkdown,
} from '../services/machineReadableRenderer';
import { renderForAiPublicPage } from '../services/publicPageRenderer';
import {
  resolvePublicFrontendAssets,
  type PublicFrontendAssets,
} from '../services/frontendAssets';
import type { MonthlyReportPublicService } from '../services/monthlyReportPublicService';
import { renderAiSitemapXml } from '../services/aiSitemapRenderer';
import {
  trackServerMarketingPageView,
  type MarketingPageViewRepository,
} from '../utils/marketing';

interface MachineReadableDeps {
  publicViewService: {
    getHomePageView(date: string): Promise<HomePageView>;
    getFullRankingView(date: string, page: number, pageSize: number): Promise<FullRankingView>;
    getRiskMonitorView(date: string, page: number, pageSize: number): Promise<RiskMonitorView>;
    getReportViewBySlug?(slug: string, date: string): Promise<ReportView | null>;
  };
  airportAdCampaignRepository?: {
    listActiveDeals(): Promise<AirportDealView[]>;
  };
  monthlyReportPublicService?: MonthlyReportPublicService;
  frontendAssets?: PublicFrontendAssets;
  marketingRepository?: MarketingPageViewRepository;
}

const MACHINE_READABLE_PAGE_SIZE = 100;

export function createMachineReadableRoutes(deps: MachineReadableDeps): Router {
  const router = Router();
  const frontendAssets = deps.frontendAssets || resolvePublicFrontendAssets();

  router.get('/robots.txt', (req, res) => {
    sendText(res, 'text/plain; charset=utf-8', renderRobotsTxt(getSiteOrigin(req)));
  });

  router.get('/sitemap-ai.xml', async (req, res) => {
    try {
      const date = getDateInTimezone();
      const [rankingsView, monthlyReportSlugs] = await Promise.all([
        deps.publicViewService.getFullRankingView(date, 1, MACHINE_READABLE_PAGE_SIZE),
        getAiSitemapMonthlyReportSlugs(deps),
      ]);
      const airportReportPaths = rankingsView.items
        .map((item) => item.report_url || '')
        .filter((path) => path.startsWith('/airports/'));
      setPublicCacheHeaders(res);
      res
        .status(200)
        .type('application/xml')
        .send(renderAiSitemapXml(getSiteOrigin(req), airportReportPaths, monthlyReportSlugs));
    } catch (error) {
      console.error('[machine-readable] failed to render sitemap-ai.xml', {
        error,
        requestId: req.requestId || 'unknown',
      });
      sendText(res.status(500), 'text/plain; charset=utf-8', 'GateRank AI sitemap 暂时无法生成');
    }
  });

  router.get('/openapi.json', (_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'GateRank public OpenAPI document is not published in this phase.',
      },
    });
  });

  router.get('/.well-known/ai-plugin.json', (_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'GateRank AI plugin manifest is not published in this phase.',
      },
    });
  });

  router.get('/llms.txt', async (req, res) => {
    try {
      const siteUrl = getSiteOrigin(req);
      const summary = await getSummary(deps, siteUrl);
      sendText(res, 'text/plain; charset=utf-8', renderLlmsTxt(siteUrl, summary));
    } catch (error) {
      console.error('[machine-readable] failed to render llms.txt', { error, requestId: req.requestId || 'unknown' });
      sendText(res.status(500), 'text/plain; charset=utf-8', 'GateRank llms.txt 暂时无法生成');
    }
  });

  router.get('/llms-full.txt', async (req, res) => {
    try {
      const siteUrl = getSiteOrigin(req);
      const date = getDateInTimezone();
      const [summary, rankingsView] = await Promise.all([
        getSummary(deps, siteUrl, date),
        deps.publicViewService.getFullRankingView(date, 1, MACHINE_READABLE_PAGE_SIZE),
      ]);
      const rankings = buildRankingsData(siteUrl, rankingsView);
      sendText(res, 'text/plain; charset=utf-8', renderLlmsFullTxt(siteUrl, summary, rankings));
    } catch (error) {
      console.error('[machine-readable] failed to render llms-full.txt', { error, requestId: req.requestId || 'unknown' });
      sendText(res.status(500), 'text/plain; charset=utf-8', 'GateRank llms-full.txt 暂时无法生成');
    }
  });

  router.get('/deals.md', async (req, res) => {
    try {
      const siteUrl = getSiteOrigin(req);
      const deals = await getDeals(deps);
      const data = buildDealsData(siteUrl, deals, new Date().toISOString());
      sendText(res, 'text/markdown; charset=utf-8', renderDealsMarkdown(siteUrl, data));
    } catch (error) {
      console.error('[machine-readable] failed to render deals markdown', { error, requestId: req.requestId || 'unknown' });
      sendText(res.status(500), 'text/plain; charset=utf-8', 'GateRank deals markdown 暂时无法生成');
    }
  });

  router.get('/data/deals.json', async (req, res) => {
    try {
      const deals = await getDeals(deps);
      setPublicCacheHeaders(res);
      res.json(buildDealsData(getSiteOrigin(req), deals, new Date().toISOString()));
    } catch (error) {
      console.error('[machine-readable] failed to render deals json', { error, requestId: req.requestId || 'unknown' });
      res.status(500).json({ error: { code: 'DEALS_UNAVAILABLE', message: 'deals data is temporarily unavailable' } });
    }
  });

  router.get('/monthly-reports.md', async (req, res) => {
    try {
      const data = await getMonthlyReportsData(deps, getSiteOrigin(req));
      sendText(res, 'text/markdown; charset=utf-8', renderMonthlyReportsMarkdown(data));
    } catch (error) {
      console.error('[machine-readable] failed to render monthly reports markdown', { error, requestId: req.requestId || 'unknown' });
      sendText(res.status(500), 'text/plain; charset=utf-8', 'GateRank monthly reports markdown 暂时无法生成');
    }
  });

  router.get('/data/monthly-reports.json', async (req, res) => {
    try {
      setPublicCacheHeaders(res);
      res.json(await getMonthlyReportsData(deps, getSiteOrigin(req)));
    } catch (error) {
      console.error('[machine-readable] failed to render monthly reports json', { error, requestId: req.requestId || 'unknown' });
      res.status(500).json({ error: { code: 'MONTHLY_REPORTS_UNAVAILABLE', message: 'monthly reports data is temporarily unavailable' } });
    }
  });

  router.get('/monthly-reports/:slug.md', async (req, res) => {
    try {
      const service = requireMonthlyReportPublicService(deps);
      const slug = String(req.params.slug || '').replace(/\.md$/i, '');
      const report = await service.getBySlug(slug);
      if (!report) {
        sendText(res.status(404), 'text/plain; charset=utf-8', 'GateRank monthly report markdown not found');
        return;
      }
      sendText(res, 'text/markdown; charset=utf-8', renderMonthlyReportDetailMarkdown(report));
    } catch (error) {
      console.error('[machine-readable] failed to render monthly report markdown', { error, requestId: req.requestId || 'unknown' });
      sendText(res.status(500), 'text/plain; charset=utf-8', 'GateRank monthly report markdown 暂时无法生成');
    }
  });

  router.get('/for-ai', async (req, res) => {
    try {
      const siteUrl = getSiteOrigin(req);
      const summary = await getSummary(deps, siteUrl);
      const html = renderForAiPublicPage(siteUrl, summary, frontendAssets);
      setPublicCacheHeaders(res);
      trackServerMarketingPageView(deps.marketingRepository, req, {
        page_kind: 'for_ai',
        page_path: '/for-ai',
      });
      res.status(200).type('html').send(html);
    } catch (error) {
      console.error('[machine-readable] failed to render for-ai page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send('GateRank for AI 页面暂时无法生成');
    }
  });

  router.get('/data', async (req, res) => {
    try {
      const summary = await getSummary(deps, getSiteOrigin(req));
      sendText(res, 'text/markdown; charset=utf-8', renderDataIndexMarkdown(summary));
    } catch (error) {
      console.error('[machine-readable] failed to render data index', { error, requestId: req.requestId || 'unknown' });
      sendText(res.status(500), 'text/plain; charset=utf-8', 'GateRank data index 暂时无法生成');
    }
  });

  router.get('/data/summary.json', async (req, res) => {
    try {
      setPublicCacheHeaders(res);
      res.json(await getSummary(deps, getSiteOrigin(req)));
    } catch (error) {
      console.error('[machine-readable] failed to render summary json', { error, requestId: req.requestId || 'unknown' });
      res.status(500).json({ error: { code: 'SUMMARY_UNAVAILABLE', message: 'summary data is temporarily unavailable' } });
    }
  });

  router.get('/data/rankings.json', async (req, res) => {
    try {
      const date = getDateInTimezone();
      const view = await deps.publicViewService.getFullRankingView(date, 1, MACHINE_READABLE_PAGE_SIZE);
      setPublicCacheHeaders(res);
      res.json(buildRankingsData(getSiteOrigin(req), view));
    } catch (error) {
      console.error('[machine-readable] failed to render rankings json', { error, requestId: req.requestId || 'unknown' });
      res.status(500).json({ error: { code: 'RANKINGS_UNAVAILABLE', message: 'rankings data is temporarily unavailable' } });
    }
  });

  router.get('/data/risk-monitor.json', async (req, res) => {
    try {
      const date = getDateInTimezone();
      const view = await deps.publicViewService.getRiskMonitorView(date, 1, MACHINE_READABLE_PAGE_SIZE);
      setPublicCacheHeaders(res);
      res.json(buildRiskMonitorData(getSiteOrigin(req), view));
    } catch (error) {
      console.error('[machine-readable] failed to render risk json', { error, requestId: req.requestId || 'unknown' });
      res.status(500).json({ error: { code: 'RISK_MONITOR_UNAVAILABLE', message: 'risk monitor data is temporarily unavailable' } });
    }
  });

  router.get('/data/summary.md', async (req, res) => {
    try {
      const summary = await getSummary(deps, getSiteOrigin(req));
      sendText(res, 'text/markdown; charset=utf-8', renderSummaryMarkdown(summary));
    } catch (error) {
      console.error('[machine-readable] failed to render summary md', { error, requestId: req.requestId || 'unknown' });
      sendText(res.status(500), 'text/plain; charset=utf-8', 'GateRank summary markdown 暂时无法生成');
    }
  });

  router.get('/data/rankings.md', async (req, res) => {
    try {
      const date = getDateInTimezone();
      const view = await deps.publicViewService.getFullRankingView(date, 1, MACHINE_READABLE_PAGE_SIZE);
      sendText(res, 'text/markdown; charset=utf-8', renderRankingsMarkdown(buildRankingsData(getSiteOrigin(req), view)));
    } catch (error) {
      console.error('[machine-readable] failed to render rankings md', { error, requestId: req.requestId || 'unknown' });
      sendText(res.status(500), 'text/plain; charset=utf-8', 'GateRank rankings markdown 暂时无法生成');
    }
  });

  router.get('/data/risk-monitor.md', async (req, res) => {
    try {
      const date = getDateInTimezone();
      const view = await deps.publicViewService.getRiskMonitorView(date, 1, MACHINE_READABLE_PAGE_SIZE);
      sendText(res, 'text/markdown; charset=utf-8', renderRiskMonitorMarkdown(buildRiskMonitorData(getSiteOrigin(req), view)));
    } catch (error) {
      console.error('[machine-readable] failed to render risk md', { error, requestId: req.requestId || 'unknown' });
      sendText(res.status(500), 'text/plain; charset=utf-8', 'GateRank risk monitor markdown 暂时无法生成');
    }
  });

  router.get('/airports/:slug.md', async (req, res) => {
    try {
      const date = getDateInTimezone();
      const slug = String(req.params.slug || '').replace(/\.md$/i, '');
      const view = await deps.publicViewService.getReportViewBySlug?.(slug, date);
      if (!view) {
        sendText(res.status(404), 'text/plain; charset=utf-8', 'GateRank airport markdown not found');
        return;
      }
      const siteUrl = getSiteOrigin(req);
      const rankingsView = await deps.publicViewService.getFullRankingView(view.date, 1, MACHINE_READABLE_PAGE_SIZE);
      const rankings = buildRankingsData(siteUrl, rankingsView);
      const rankMap = new Map(
        rankings.items
          .filter((item) => item.slug)
          .map((item) => [item.slug as string, item.rank]),
      );
      sendText(res, 'text/markdown; charset=utf-8', renderAirportMarkdown(siteUrl, view, rankMap.get(view.airport.slug)));
    } catch (error) {
      console.error('[machine-readable] failed to render airport md', { error, requestId: req.requestId || 'unknown' });
      sendText(res.status(500), 'text/plain; charset=utf-8', 'GateRank airport markdown 暂时无法生成');
    }
  });

  return router;
}

async function getDeals(deps: MachineReadableDeps): Promise<AirportDealView[]> {
  if (!deps.airportAdCampaignRepository) {
    throw new Error('airportAdCampaignRepository is not configured');
  }
  return deps.airportAdCampaignRepository.listActiveDeals();
}

async function getMonthlyReportsData(deps: MachineReadableDeps, siteUrl: string) {
  const service = requireMonthlyReportPublicService(deps);
  const view = await service.getListView(1, 50);
  const details = await Promise.all(view.items.map((item) => service.getBySlug(item.slug)));
  const detailsBySlug = new Map(
    details
      .filter((item): item is MonthlyReport => Boolean(item))
      .map((item) => [item.slug, item]),
  );
  return buildMonthlyReportsData(siteUrl, view.items, detailsBySlug);
}

function requireMonthlyReportPublicService(deps: MachineReadableDeps): MonthlyReportPublicService {
  if (!deps.monthlyReportPublicService) {
    throw new Error('monthlyReportPublicService is not configured');
  }
  return deps.monthlyReportPublicService;
}

async function getAiSitemapMonthlyReportSlugs(deps: MachineReadableDeps): Promise<string[]> {
  if (!deps.monthlyReportPublicService) {
    return [];
  }
  try {
    const items = await deps.monthlyReportPublicService.getSitemapItems();
    return items
      .filter((item) => item.status === 'published' && Boolean(item.published_at))
      .map((item) => item.slug);
  } catch (error) {
    console.error('[machine-readable] failed to load AI sitemap monthly reports', { error });
    return [];
  }
}

async function getSummary(deps: MachineReadableDeps, siteUrl: string, date = getDateInTimezone()) {
  const [home, risk] = await Promise.all([
    deps.publicViewService.getHomePageView(date),
    deps.publicViewService.getRiskMonitorView(date, 1, MACHINE_READABLE_PAGE_SIZE),
  ]);
  return buildSummaryData(siteUrl, home, risk);
}

function sendText(res: {
  setHeader(name: string, value: string): unknown;
  set(name: string, value: string): unknown;
  status(code: number): unknown;
  send(body: string): unknown;
}, contentType: string, body: string): void {
  setPublicCacheHeaders(res);
  res.set('Content-Type', contentType);
  res.send(body);
}
