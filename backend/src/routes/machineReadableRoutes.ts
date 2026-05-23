import { Router } from 'express';
import type { FullRankingView, HomePageView, ReportView, RiskMonitorView } from '../types/domain';
import { setPublicCacheHeaders } from '../utils/publicCache';
import { getSiteOrigin } from '../utils/siteUrl';
import { getDateInTimezone } from '../utils/time';
import {
  buildRankingsData,
  buildRiskMonitorData,
  buildSummaryData,
  renderAirportMarkdown,
  renderDataIndexMarkdown,
  renderLlmsFullTxt,
  renderLlmsTxt,
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

interface MachineReadableDeps {
  publicViewService: {
    getHomePageView(date: string): Promise<HomePageView>;
    getFullRankingView(date: string, page: number, pageSize: number): Promise<FullRankingView>;
    getRiskMonitorView(date: string, page: number, pageSize: number): Promise<RiskMonitorView>;
    getReportViewBySlug?(slug: string, date: string): Promise<ReportView | null>;
  };
  frontendAssets?: PublicFrontendAssets;
}

const MACHINE_READABLE_PAGE_SIZE = 100;

export function createMachineReadableRoutes(deps: MachineReadableDeps): Router {
  const router = Router();
  const frontendAssets = deps.frontendAssets || resolvePublicFrontendAssets();

  router.get('/robots.txt', (req, res) => {
    sendText(res, 'text/plain; charset=utf-8', renderRobotsTxt(getSiteOrigin(req)));
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

  router.get('/for-ai', async (req, res) => {
    try {
      const siteUrl = getSiteOrigin(req);
      const summary = await getSummary(deps, siteUrl);
      setPublicCacheHeaders(res);
      res.status(200).type('html').send(renderForAiPublicPage(siteUrl, summary, frontendAssets));
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
