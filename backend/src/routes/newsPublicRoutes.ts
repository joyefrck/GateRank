import { Router, type Request, type Response } from 'express';
import { HttpError } from '../middleware/errorHandler';
import type { NewsArticleListItem } from '../types/domain';
import { renderNewsArticlePage, renderNewsIndexPage } from '../services/newsPageRenderer';
import { renderPublishTokenDocsPage, renderPublishTokenDocsRawMarkdown } from '../services/publishTokenDocsPageRenderer';
import type { NewsPublicService } from '../services/newsPublicService';
import { buildServerPageViewRecord } from '../utils/marketing';
import { setPublicCacheHeaders } from '../utils/publicCache';
import { getDateInTimezone } from '../utils/time';
import { PUBLISH_TOKEN_DOCS_LAST_UPDATED } from '../../../shared/publishTokenDocs';
import { PUBLIC_SEO_STATIC_LASTMOD } from '../../../shared/publicSeo';

interface NewsPublicDeps {
  newsPublicService: NewsPublicService;
  publicViewService?: {
    getFullRankingView(date: string, page: number, pageSize: number): Promise<{
      date?: string;
      items: Array<{ report_url?: string | null }>;
    }>;
  };
  marketingRepository?: {
    insertMany(records: ReturnType<typeof buildServerPageViewRecord>[]): Promise<void>;
  };
}

export function createNewsPublicRoutes(deps: NewsPublicDeps): Router {
  const router = Router();

  router.get('/api/v1/news', async (req, res, next) => {
    try {
      const page = toPositiveInt(req.query.page, 1);
      const pageSize = toPositiveInt(req.query.page_size, 12);
      res.json(await deps.newsPublicService.getListView(page, pageSize));
    } catch (error) {
      next(error);
    }
  });

  router.get('/api/v1/news/:slug', async (req, res, next) => {
    try {
      const article = await deps.newsPublicService.getArticleViewBySlug(String(req.params.slug || ''));
      if (!article) {
        throw new HttpError(404, 'NEWS_NOT_FOUND', `news article not found: ${req.params.slug}`);
      }
      res.json(article);
    } catch (error) {
      next(error);
    }
  });

  router.get('/news', async (req, res) => {
    try {
      const page = toPositiveInt(req.query.page, 1);
      const view = await deps.newsPublicService.getListView(page, 12);
      trackMarketingPageView(deps, req, '/news', 'news');
      res
        .status(200)
        .type('html')
        .send(renderNewsIndexPage({ siteUrl: getSiteUrl(req), listView: view }));
    } catch (error) {
      renderHtmlError(res, 500, 'News 页面加载失败');
    }
  });

  router.get('/news/:slug', async (req, res) => {
    try {
      const article = await deps.newsPublicService.getArticleViewBySlug(String(req.params.slug || ''));
      if (!article) {
        renderHtmlError(res, 404, '文章不存在或尚未发布');
        return;
      }
      trackMarketingPageView(deps, req, req.path, 'news');
      res
        .status(200)
        .type('html')
        .send(renderNewsArticlePage({ siteUrl: getSiteUrl(req), article }));
    } catch {
      renderHtmlError(res, 500, '文章加载失败');
    }
  });

  router.get('/publish-token-docs', (req, res) => {
    try {
      trackMarketingPageView(deps, req, '/publish-token-docs', 'publish_token_docs');
      res
        .status(200)
        .type('html')
        .send(renderPublishTokenDocsPage(getSiteUrl(req)));
    } catch {
      renderHtmlError(res, 500, '发布令牌文档加载失败');
    }
  });

  router.get('/publish-token-docs.md', (req, res) => {
    try {
      res
        .status(200)
        .type('text/markdown; charset=utf-8')
        .send(renderPublishTokenDocsRawMarkdown(getSiteUrl(req)));
    } catch {
      res.status(500).type('text/plain; charset=utf-8').send('发布令牌 Markdown 文档加载失败');
    }
  });

  router.get('/sitemap.xml', async (req, res) => {
    const siteUrl = getSiteUrl(req);
    const items = await deps.newsPublicService.getSitemapItems();
    const reportEntries = await getReportSitemapEntries(deps);
    const dataLastmod = reportEntries[0]?.lastmod || formatSitemapLastmodDate(getDateInTimezone());
    const urls = [
      '/',
      '/rankings/all',
      '/methodology',
      '/apply',
      '/risk-monitor',
      '/publish-token-docs',
      '/news',
      ...reportEntries.map((entry) => entry.path),
      ...items.map((item) => `/news/${item.slug}`),
    ];
    const staticLastmodByPath = {
      '/': dataLastmod,
      '/rankings/all': dataLastmod,
      '/risk-monitor': dataLastmod,
      '/methodology': PUBLIC_SEO_STATIC_LASTMOD,
      '/apply': PUBLIC_SEO_STATIC_LASTMOD,
      '/publish-token-docs': PUBLISH_TOKEN_DOCS_LAST_UPDATED,
      '/news': getNewsIndexLastmod(items),
      ...Object.fromEntries(reportEntries.map((entry) => [entry.path, entry.lastmod])),
    };
    const xml = buildSitemapXml(siteUrl, urls, items, staticLastmodByPath);
    setPublicCacheHeaders(res);
    res.type('application/xml').send(xml);
  });

  return router;
}

async function getReportSitemapEntries(deps: NewsPublicDeps): Promise<Array<{ path: string; lastmod: string }>> {
  if (!deps.publicViewService) {
    return [];
  }
  try {
    const view = await deps.publicViewService.getFullRankingView(getDateInTimezone(), 1, 100);
    const lastmod = formatSitemapLastmodDate(view.date || getDateInTimezone());
    return view.items
      .map((item) => item.report_url || '')
      .filter((url) => url.startsWith('/airports/'))
      .map((path) => ({ path, lastmod }));
  } catch (error) {
    console.error('[sitemap] failed to load report urls', { error });
    return [];
  }
}

function getNewsIndexLastmod(items: NewsArticleListItem[]): string {
  const latest = items
    .map((item) => item.published_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  return latest ? formatSitemapLastmodDateTime(latest) : PUBLIC_SEO_STATIC_LASTMOD;
}

function formatSitemapLastmodDate(date: string): string {
  return `${date}T00:00:00+08:00`;
}

function formatSitemapLastmodDateTime(dateTime: string): string {
  return dateTime.includes('T') ? dateTime : `${dateTime.replace(' ', 'T')}+08:00`;
}

function getSiteUrl(req: Request): string {
  const fromEnv = process.env.VITE_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }
  const protocol = req.header('x-forwarded-proto') || req.protocol || 'https';
  const host = req.header('x-forwarded-host') || req.header('host') || 'localhost:3000';
  return `${protocol}://${host}`.replace(/\/+$/, '');
}

function toPositiveInt(value: unknown, fallback: number): number {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function renderHtmlError(res: Response, status: number, message: string): void {
  res
    .status(status)
    .type('html')
    .send(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${message}</title><style>body{margin:0;padding:40px;background:#f6f2eb;color:#111;font-family:"IBM Plex Sans","PingFang SC","Microsoft YaHei",sans-serif}main{max-width:760px;margin:0 auto;background:rgba(255,255,255,.9);border-radius:28px;padding:36px;box-shadow:0 20px 60px rgba(0,0,0,.08)}</style></head><body><main><h1 style="margin:0 0 14px;font-size:42px;line-height:1.05;">${message}</h1><p style="margin:0;color:rgba(17,17,17,.68);font-size:16px;line-height:1.8;">请返回 <a href="/" style="color:#c93a2e;">GateRank 首页</a>，或稍后再试。</p></main></body></html>`);
}

function buildSitemapXml(
  siteUrl: string,
  urls: string[],
  newsItems: NewsArticleListItem[],
  staticLastmodByPath: Record<string, string> = {},
): string {
  const lastmodByPath = new Map<string, string>();
  Object.entries(staticLastmodByPath).forEach(([path, lastmod]) => {
    lastmodByPath.set(path, lastmod);
  });
  newsItems.forEach((item) => {
    if (item.published_at) {
      lastmodByPath.set(`/news/${item.slug}`, item.published_at.replace(' ', 'T') + '+08:00');
    }
  });

  const uniqueUrls = Array.from(new Set(urls));
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniqueUrls
  .map((path) => {
    const lastmod = lastmodByPath.get(path);
    return `  <url>
    <loc>${escapeXml(`${siteUrl}${path}`)}</loc>
${lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>\n` : ''}  </url>`;
  })
  .join('\n')}
</urlset>
`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function trackMarketingPageView(
  deps: NewsPublicDeps,
  req: Request,
  pagePath: string,
  pageKind: 'news' | 'publish_token_docs',
): void {
  if (!deps.marketingRepository) {
    return;
  }

  void deps.marketingRepository
    .insertMany([buildServerPageViewRecord(req, { page_kind: pageKind, page_path: pagePath })])
    .catch((error) => {
      console.error('[marketing] failed to record server-side page view', {
        pagePath,
        pageKind,
        requestId: req.requestId || 'unknown',
        error,
      });
    });
}
