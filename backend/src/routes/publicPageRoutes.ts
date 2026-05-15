import { Router } from 'express';
import type { FullRankingView, HomePageView, ReportView, RiskMonitorView } from '../types/domain';
import { getSiteOrigin } from '../utils/siteUrl';
import { getDateInTimezone } from '../utils/time';
import {
  renderApplyPublicPage,
  renderFullRankingPublicPage,
  renderHomePublicPage,
  renderMethodologyPublicPage,
  renderPublicHtmlError,
  renderReportPublicPage,
  renderRiskMonitorPublicPage,
} from '../services/publicPageRenderer';

interface PublicPageDeps {
  publicViewService: {
    getHomePageView(date: string): Promise<HomePageView>;
    getFullRankingView(date: string, page: number, pageSize: number): Promise<FullRankingView>;
    getRiskMonitorView(date: string, page: number, pageSize: number): Promise<RiskMonitorView>;
    getReportView(airportId: number, date: string): Promise<ReportView | null>;
    getReportViewBySlug?(slug: string, date: string): Promise<ReportView | null>;
  };
}

export function createPublicPageRoutes(deps: PublicPageDeps): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const requestedDate = parseDateQuery(req.query.date);
      const view = await deps.publicViewService.getHomePageView(requestedDate || getDateInTimezone());
      res.status(200).type('html').send(renderHomePublicPage(siteUrl, view, requestedDate));
    } catch (error) {
      console.error('[public-page] failed to render home page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '首页加载失败'));
    }
  });

  router.get('/rankings/all', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const requestedDate = parseDateQuery(req.query.date);
      const page = toPositiveInt(req.query.page, 1);
      const view = await deps.publicViewService.getFullRankingView(
        requestedDate || getDateInTimezone(),
        page,
        20,
      );
      res.status(200).type('html').send(renderFullRankingPublicPage(siteUrl, view, requestedDate, page));
    } catch (error) {
      console.error('[public-page] failed to render full ranking page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '全量榜单加载失败'));
    }
  });

  router.get('/risk-monitor', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const requestedDate = parseDateQuery(req.query.date);
      const page = toPositiveInt(req.query.page, 1);
      const view = await deps.publicViewService.getRiskMonitorView(
        requestedDate || getDateInTimezone(),
        page,
        20,
      );
      res.status(200).type('html').send(renderRiskMonitorPublicPage(siteUrl, view, requestedDate, page));
    } catch (error) {
      console.error('[public-page] failed to render risk monitor page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '跑路监测加载失败'));
    }
  });

  router.get('/risk-watch', (req, res) => {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, `/risk-monitor${query}`);
  });

  router.get('/methodology', (_req, res) => {
    const siteUrl = getSiteOrigin(_req);
    res.status(200).type('html').send(renderMethodologyPublicPage(siteUrl));
  });

  router.get('/apply', (_req, res) => {
    const siteUrl = getSiteOrigin(_req);
    res.status(200).type('html').send(renderApplyPublicPage(siteUrl));
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
        res.status(404).type('html').send(renderPublicHtmlError(siteUrl, 404, '报告不存在'));
        return;
      }

      res.status(200).type('html').send(renderReportPublicPage(siteUrl, view, requestedDate));
    } catch (error) {
      console.error('[public-page] failed to render airport report page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '报告加载失败'));
    }
  });

  router.get('/reports/:id', async (req, res) => {
    const siteUrl = getSiteOrigin(req);
    try {
      const airportId = toPositiveInt(req.params.id, 0);
      if (!airportId) {
        res.status(404).type('html').send(renderPublicHtmlError(siteUrl, 404, '报告不存在'));
        return;
      }

      const requestedDate = parseDateQuery(req.query.date);
      const view = await deps.publicViewService.getReportView(airportId, requestedDate || getDateInTimezone());
      if (!view) {
        res.status(404).type('html').send(renderPublicHtmlError(siteUrl, 404, '报告不存在'));
        return;
      }

      res.redirect(301, `/airports/${encodeURIComponent(view.airport.slug)}`);
      return;
    } catch (error) {
      console.error('[public-page] failed to render report page', { error, requestId: req.requestId || 'unknown' });
      res.status(500).type('html').send(renderPublicHtmlError(siteUrl, 500, '报告加载失败'));
    }
  });

  return router;
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
