import { Router, type Request, type Response } from 'express';
import { HttpError } from '../middleware/errorHandler';
import type { NewsArticleListItem } from '../types/domain';
import { renderNewsArticlePage, renderNewsIndexPage } from '../services/newsPageRenderer';
import { renderPublishTokenDocsPage, renderPublishTokenDocsRawMarkdown } from '../services/publishTokenDocsPageRenderer';
import type { NewsPublicService } from '../services/newsPublicService';
import { PUBLISH_TOKEN_DOCS_LAST_UPDATED } from '../../../shared/publishTokenDocs';

interface NewsPublicDeps {
  newsPublicService: NewsPublicService;
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
    const urls = [
      '/',
      '/rankings/all',
      '/methodology',
      '/apply',
      '/publish-token-docs',
      '/news',
      ...items.map((item) => `/news/${item.slug}`),
    ];
    const xml = buildSitemapXml(siteUrl, urls, items, {
      '/publish-token-docs': PUBLISH_TOKEN_DOCS_LAST_UPDATED,
    });
    res.type('application/xml').send(xml);
  });

  return router;
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
