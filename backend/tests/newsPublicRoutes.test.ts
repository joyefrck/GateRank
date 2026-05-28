import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import express from 'express';
import { createNewsPublicRoutes } from '../src/routes/newsPublicRoutes';
import { errorHandler } from '../src/middleware/errorHandler';
import { renderNewsArticlePage } from '../src/services/newsPageRenderer';

test('GET /api/v1/news returns public news list payload', async () => {
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async () => ({
          page: 1,
          page_size: 12,
          total: 2,
          total_pages: 1,
          featured: {
            id: 1,
            title: '头条文章',
            slug: 'headline',
            excerpt: '头条摘要',
            cover_image_url: '/uploads/news/headline.jpg',
            published_at: '2026-03-28 10:00:00',
            reading_minutes: 5,
          },
          items: [
            {
              id: 2,
              title: '次条文章',
              slug: 'follow-up',
              excerpt: '次条摘要',
              cover_image_url: '/uploads/news/follow-up.jpg',
              published_at: '2026-03-27 10:00:00',
              reading_minutes: 4,
            },
          ],
        }),
        getArticleViewBySlug: async () => null,
        getPreviewArticleView: async () => null,
        getSitemapItems: async () => [],
      } as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/news`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as { featured: { title: string }; items: Array<{ slug: string }> };
    assert.equal(data.featured.title, '头条文章');
    assert.equal(data.items[0].slug, 'follow-up');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /news returns server-rendered HTML with aligned public header tokens', async () => {
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async () => ({
          page: 1,
          page_size: 12,
          total: 1,
          total_pages: 1,
          featured: {
            id: 1,
            title: '头条文章',
            slug: 'headline',
            excerpt: '头条摘要',
            cover_image_url: '/uploads/news/headline.jpg',
            published_at: '2026-03-28 10:00:00',
            reading_minutes: 5,
          },
          items: [],
        }),
        getArticleViewBySlug: async () => null,
        getPreviewArticleView: async () => null,
        getSitemapItems: async () => [],
      } as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/news`, {
      headers: {
        host: `127.0.0.1:${port}`,
      },
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /\.public-top-nav-inner\s*\{[\s\S]*height:\s*72px;/);
    assert.match(html, /\.public-top-nav-links\s*\{[\s\S]*font-size:\s*13px;[\s\S]*letter-spacing:\s*2\.34px;/);
    assert.match(html, /data-public-top-nav="true"/);
    assert.match(html, /<span class="public-top-nav-brand-title">机场榜GateRank<\/span>/);
    assert.match(html, /<a class="public-top-nav-link" href="\/methodology" data-client-nav="true">测评方法<\/a>/);
    assert.match(html, /<a class="public-top-nav-link is-active" href="\/news">News<\/a>/);
    assert.match(html, /<a class="public-top-nav-login" href="\/portal" target="_blank" rel="noreferrer">登录<\/a>/);
    assert.match(html, /<a class="public-top-nav-apply" href="\/apply" target="_blank" rel="noreferrer">/);
    assert.match(html, /<path d="M15 3h6v6"><\/path>/);
    assert.doesNotMatch(html, /nav-link is-news/);
    assert.doesNotMatch(html, /\.nav-link\.is-news/);
    assert.doesNotMatch(html, /\.topbar-inner/);
    assert.doesNotMatch(html, /\.nav-link\s*\{/);
    assert.match(html, /<h1 class="news-index-title">机场榜资讯中心：机场推荐、跑路预警与科学上网指南<\/h1>/);
    assert.match(html, /<h2 class="hero-title"><a href="\/news\/headline">头条文章<\/a><\/h2>/);
    assert.doesNotMatch(html, /<h1 class="hero-title">/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /publish-token-docs returns server-rendered HTML with crawlable doc content', async () => {
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async () => ({
          page: 1,
          page_size: 12,
          total: 0,
          total_pages: 1,
          featured: null,
          items: [],
        }),
        getArticleViewBySlug: async () => null,
        getPreviewArticleView: async () => null,
        getSitemapItems: async () => [],
      } as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/publish-token-docs`, {
      headers: {
        host: `127.0.0.1:${port}`,
      },
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    const description = extractMetaDescription(html);
    assert.ok(description.length >= 80, `publish token docs description too short: ${description.length}`);
    assert.ok(description.length <= 150, `publish token docs description too long: ${description.length}`);
    assert.match(description, /自动发稿与内容系统/);
    assert.match(description, /GateRank News API/);
    assert.match(html, /<h1>机场榜GateRank 发布令牌接入说明<\/h1>/);
    assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/publish-token-docs"/);
    assert.match(html, /<link rel="alternate" type="text\/markdown" href="http:\/\/127\.0\.0\.1:\d+\/publish-token-docs\.md"/);
    assert.match(
      html,
      /<meta name="keywords" content="机场榜GateRank,GateRank,发布令牌,API,文档,新闻发布,Bearer Token"/,
    );
    assert.match(html, /"@type":"TechArticle"/);
    assert.match(html, /"encodingFormat":"text\/markdown"/);
    assert.match(html, /Base URL/);
    assert.match(html, /Authorization: Bearer &lt;publish_token&gt;/);
    assert.match(html, /class="copy-button"/);
    assert.match(html, /class="copy-button-label">复制<\/span>/);
    assert.match(html, /<section id="create" class="doc-section">[\s\S]*?<div class="doc-stack">/);
    assert.match(html, /<section id="upload" class="doc-section">[\s\S]*?<div class="doc-stack">/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

function extractMetaDescription(html: string): string {
  const matched = html.match(/<meta name="description" content="([^"]+)"/);
  assert.ok(matched, 'meta description missing');
  return matched[1];
}

function createPreviewRouteApp() {
  const router = express.Router();
  router.get('/news/:id/preview', (req, res) => {
    res
      .status(200)
      .type('html')
      .send(renderNewsArticlePage({
        siteUrl: `${req.protocol}://${req.get('host')}`,
        preview: true,
        article: {
          id: Number(req.params.id),
          title: '机场链接预览',
          slug: 'airport-link-preview',
          excerpt: '用于验证 News 预览页不扣费。',
          cover_image_url: '',
          published_at: '2026-03-28 18:00:00',
          reading_minutes: 3,
          content_html: '<p class="news-paragraph"><a class="news-airport-inline-link" href="/api/v1/outbound/airports/12?target=website&amp;placement=news_article" target="_blank" rel="noreferrer noopener" data-airport-website="https://vip.gsyaff.com/">光速云</a></p>',
          headings: [],
          category: null,
          topics: [],
          is_featured: false,
          is_recommended: false,
          recommend_weight: 0,
          previous: null,
          next: null,
        },
      }));
  });
  return router;
}

test('GET /publish-token-docs.md returns markdown source', async () => {
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async () => ({
          page: 1,
          page_size: 12,
          total: 0,
          total_pages: 1,
          featured: null,
          items: [],
        }),
        getArticleViewBySlug: async () => null,
        getPreviewArticleView: async () => null,
        getSitemapItems: async () => [],
      } as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/publish-token-docs.md`, {
      headers: {
        host: `127.0.0.1:${port}`,
      },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/markdown/);
    const markdown = await response.text();
    assert.match(markdown, /^# 机场榜GateRank 发布令牌接入说明/m);
    assert.match(markdown, /## 快速开始/);
    assert.match(markdown, /```bash/);
    assert.match(markdown, /\/api\/v1\/publish\/news/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /news/:slug returns server-rendered HTML with seo metadata', async () => {
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async () => ({
          page: 1,
          page_size: 12,
          total: 0,
          total_pages: 1,
          featured: null,
          items: [],
        }),
        getArticleViewBySlug: async () => ({
          id: 8,
          title: '服务端 SEO 测试',
          slug: 'seo-test',
          excerpt: '用于验证文章详情页 meta、canonical 和 JSON-LD。',
          cover_image_url: '/uploads/news/cover.webp',
          published_at: '2026-03-28 18:00:00',
          reading_minutes: 6,
          content_html: '<p class="news-paragraph">hello world</p>',
          headings: [{ id: 'hello', level: 2, text: 'Hello' }],
          previous: null,
          next: null,
        }),
        getPreviewArticleView: async () => null,
        getSitemapItems: async () => [{ slug: 'seo-test' }],
      } as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/news/seo-test`, {
      headers: {
        host: `127.0.0.1:${port}`,
      },
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /<meta property="og:title" content="服务端 SEO 测试 \| GateRank News"/);
    assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/news\/seo-test"/);
    assert.match(html, /<meta property="og:image" content="http:\/\/127\.0\.0\.1:\d+\/uploads\/news\/cover\.webp"/);
    assert.match(html, /<meta property="og:image:secure_url" content="http:\/\/127\.0\.0\.1:\d+\/uploads\/news\/cover\.webp"/);
    assert.match(html, /<meta property="og:image:type" content="image\/webp"/);
    assert.match(html, /<meta property="og:image:alt" content="服务端 SEO 测试"/);
    assert.match(html, /<meta name="twitter:image" content="http:\/\/127\.0\.0\.1:\d+\/uploads\/news\/cover\.webp"/);
    assert.match(html, /<meta name="twitter:image:alt" content="服务端 SEO 测试"/);
    assert.match(html, /"@type":"Article"/);
    assert.match(html, /"image":\["http:\/\/127\.0\.0\.1:\d+\/uploads\/news\/cover\.webp"\]/);
    assert.match(html, /分享到 Reddit/);
    assert.match(html, /\.public-top-nav-inner\s*\{[\s\S]*height:\s*72px;/);
    assert.match(html, /<span class="public-top-nav-brand-title">机场榜GateRank<\/span>/);
    assert.match(html, /<a class="public-top-nav-link is-active" href="\/news">News<\/a>/);
    assert.match(html, /<a class="public-top-nav-apply" href="\/apply" target="_blank" rel="noreferrer">/);
    assert.match(html, /<path d="M15 3h6v6"><\/path>/);
    assert.doesNotMatch(html, /nav-link is-news/);
    assert.doesNotMatch(html, /\.nav-link\.is-news/);
    assert.doesNotMatch(html, /\.topbar-inner/);
    assert.doesNotMatch(html, /\.nav-link\s*\{/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /news/:slug preserves paid outbound airport links in published article html', async () => {
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async () => ({
          page: 1,
          page_size: 12,
          total: 0,
          total_pages: 1,
          featured: null,
          items: [],
        }),
        getArticleViewBySlug: async () => ({
          id: 8,
          title: '机场链接测试',
          slug: 'airport-link-test',
          excerpt: '用于验证 News 正文机场链接扣费。',
          cover_image_url: '',
          published_at: '2026-03-28 18:00:00',
          reading_minutes: 3,
          content_html: '<p class="news-paragraph"><a class="news-airport-inline-link" href="/api/v1/outbound/airports/12?target=website&amp;placement=news_article" target="_blank" rel="noreferrer noopener" data-airport-website="https://vip.gsyaff.com/">光速云</a></p>',
          headings: [],
          previous: null,
          next: null,
        }),
        getPreviewArticleView: async () => null,
        getSitemapItems: async () => [],
      } as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/news/airport-link-test`, {
      headers: {
        host: `127.0.0.1:${port}`,
      },
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /href="\/api\/v1\/outbound\/airports\/12\?target=website&amp;placement=news_article"/);
    assert.match(html, /data-airport-website="https:\/\/vip\.gsyaff\.com\/"/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /api/v1/admin/news/:id/preview rewrites airport links to direct websites without paid placement', async () => {
  const app = express();
  app.use('/api/v1/admin', createPreviewRouteApp());
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/8/preview`, {
      headers: {
        host: `127.0.0.1:${port}`,
      },
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /href="https:\/\/vip\.gsyaff\.com\/"/);
    assert.doesNotMatch(html, /placement=news_article/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /news/:slug returns 404 html for missing article', async () => {
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async () => ({
          page: 1,
          page_size: 12,
          total: 0,
          total_pages: 1,
          featured: null,
          items: [],
        }),
        getArticleViewBySlug: async () => null,
        getPreviewArticleView: async () => null,
        getSitemapItems: async () => [],
      } as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/news/missing`);
    assert.equal(response.status, 404);
    const html = await response.text();
    assert.match(html, /文章不存在或尚未发布/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /sitemap.xml includes published news urls', async () => {
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async () => ({
          page: 1,
          page_size: 12,
          total: 0,
          total_pages: 1,
          featured: null,
          items: [],
        }),
        getArticleViewBySlug: async () => null,
        getPreviewArticleView: async () => null,
        getSitemapItems: async () => [
          {
            id: 1,
            title: '已发布文章',
            slug: 'published-story',
            excerpt: '摘要',
            cover_image_url: '/uploads/news/story.jpg',
            status: 'published',
            published_at: '2026-03-28 18:00:00',
            created_at: '2026-03-28 18:00:00',
            updated_at: '2026-03-28 18:00:00',
          },
        ],
      } as never,
      publicViewService: {
        getFullRankingView: async () => ({
          date: '2026-03-23',
          items: [
            { report_url: '/airports/nebula' },
            { report_url: null },
          ],
        }),
      },
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/sitemap.xml`, {
      headers: {
        host: `127.0.0.1:${port}`,
      },
    });
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('cache-control'),
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
    const xml = await response.text();
    const urlBlocks = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
    assert.equal(urlBlocks.length, 57);
    urlBlocks.forEach((block) => {
      assert.match(block, /<lastmod>[^<]+<\/lastmod>/);
    });
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/rankings\/all<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/rankings\/all\?payment=alipay<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/rankings\/all\?client=clash<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/rankings\/all\?region=hong_kong<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/risk-monitor<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/deals<\/loc>\n    <lastmod>2026-05-26T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/methodology<\/loc>\n    <lastmod>2026-05-17T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/apply<\/loc>\n    <lastmod>2026-05-17T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/for-ai<\/loc>\n    <lastmod>2026-05-17T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/publish-token-docs<\/loc>\n    <lastmod>2026-05-24T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/airports\/nebula<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/news\/published-story<\/loc>\n    <lastmod>2026-03-28T18:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/news<\/loc>\n    <lastmod>2026-03-28T18:00:00\+08:00<\/lastmod>/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
