import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import express from 'express';
import { createNewsPublicRoutes } from '../src/routes/newsPublicRoutes';
import { errorHandler } from '../src/middleware/errorHandler';
import { renderNewsArticlePage } from '../src/services/newsPageRenderer';
import type { MarketingEventInsertRecord } from '../src/utils/marketing';

test('News and publish docs HTML record once while markdown and News errors record none', async () => {
  const records: MarketingEventInsertRecord[] = [];
  const app = express();
  app.use(createNewsPublicRoutes({
    newsPublicService: {
      getListView: async () => ({
        page: 1,
        page_size: 12,
        total: 0,
        total_pages: 1,
        featured: null,
        items: [],
      }),
      getArticleViewBySlug: async (slug: string) => {
        if (slug === 'error') {
          throw new Error('news unavailable');
        }
        return null;
      },
      getPreviewArticleView: async () => null,
      getSitemapItems: async () => [],
    } as never,
    marketingRepository: {
      insertMany: async (items) => { records.push(...items); },
    },
  }));

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    assert.equal((await fetch(`http://127.0.0.1:${port}/news`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/publish-token-docs`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/publish-token-docs.md`)).status, 200);
    assert.equal((await fetch(`http://127.0.0.1:${port}/news/missing`)).status, 404);
    assert.equal((await fetch(`http://127.0.0.1:${port}/news/error`)).status, 500);
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(
      records.map(({ page_kind, page_path }) => ({ page_kind, page_path })),
      [
        { page_kind: 'news', page_path: '/news' },
        { page_kind: 'publish_token_docs', page_path: '/publish-token-docs' },
      ],
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close(
      (error) => (error ? reject(error) : resolve()),
    ));
  }
});

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
            view_count: 42,
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
              view_count: 87,
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
            view_count: 42,
            reading_minutes: 5,
          },
          items: [
            {
              id: 2,
              title: '次条文章',
              slug: 'follow-up',
              excerpt: '次条摘要',
              cover_image_url: '',
              published_at: '2026-03-27 10:00:00',
              view_count: 87,
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
    assert.match(html, /<a class="public-top-nav-link" href="\/rankings\/all" data-client-nav="true">机场排行<\/a>/);
    assert.doesNotMatch(html, /<a class="public-top-nav-link" href="\/methodology" data-client-nav="true">测评方法<\/a>/);
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
    assertNewsOgImage(html, `http://127.0.0.1:${port}`, '/uploads/news/headline.jpg', '头条文章', 'image/jpeg');
    assert.match(html, /42 次访问/);
    assert.match(html, /87 次访问/);
    assert.doesNotMatch(html, /<h1 class="hero-title">/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /news and /news/category/:slug use static OG fallbacks when no featured cover exists', async () => {
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async (_page: number, _pageSize: number, filters?: { category_slug?: string }) => ({
          page: 1,
          page_size: 12,
          total: 1,
          total_pages: 1,
          query: '',
          category: filters?.category_slug
            ? {
              id: 20,
              name: '风险预警',
              slug: filters.category_slug,
              description: '跑路机场、支付风险、服务异常和订阅安全预警。',
              sort_order: 20,
              is_active: true,
              updated_at: '2026-04-02 09:30:00',
            }
            : null,
          topic: null,
          categories: [],
          topics: [],
          featured: null,
          items: [
            {
              id: 2,
              title: '无封面文章',
              slug: 'no-cover-story',
              excerpt: '这篇文章没有封面。',
              cover_image_url: '',
              published_at: '2026-03-27 10:00:00',
              view_count: 87,
              reading_minutes: 4,
              category: null,
              topics: [],
              is_featured: false,
              is_recommended: false,
              recommend_weight: 0,
            },
          ],
          recommended: [],
          risk_watch: [],
          guides: [],
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
    const baseUrl = `http://127.0.0.1:${port}`;

    const newsResponse = await fetch(`${baseUrl}/news`, { headers: { host: `127.0.0.1:${port}` } });
    assert.equal(newsResponse.status, 200);
    assertNewsOgImage(await newsResponse.text(), baseUrl, '/og/news.png', 'GateRank News 资讯中心分享图', 'image/png');

    const categoryResponse = await fetch(`${baseUrl}/news/category/risk-warning`, { headers: { host: `127.0.0.1:${port}` } });
    assert.equal(categoryResponse.status, 200);
    assertNewsOgImage(await categoryResponse.text(), baseUrl, '/og/news-category.png', 'GateRank News 分类页分享图', 'image/png');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /news?page=2 renders page article in lead slot instead of first-article placeholder', async () => {
  const calls: Array<{ page: number }> = [];
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async (page: number) => {
          calls.push({ page });
          return {
            page,
            page_size: 12,
            total: 13,
            total_pages: 2,
            query: '',
            category: null,
            topic: null,
            categories: [],
            topics: [],
            featured: null,
            items: [
              {
                id: 13,
                title: '第二页文章',
                slug: 'page-two-story',
                excerpt: '第二页仍然应该显示文章内容。',
                cover_image_url: '',
                published_at: '2026-03-20 10:00:00',
                view_count: 12,
                reading_minutes: 3,
                category: null,
                topics: [],
                is_featured: false,
                is_recommended: false,
                recommend_weight: 0,
              },
            ],
            recommended: [],
            risk_watch: [],
            guides: [],
          };
        },
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
    const response = await fetch(`http://127.0.0.1:${port}/news?page=2`, {
      headers: {
        host: `127.0.0.1:${port}`,
      },
    });
    assert.equal(response.status, 200);
    const html = await response.text();

    assert.deepEqual(calls, [{ page: 2 }]);
    assert.match(html, /<h2 class="hero-title"><a href="\/news\/page-two-story">第二页文章<\/a><\/h2>/);
    assert.doesNotMatch(html, /第一篇文章发布后，这里会显示精选头条与最新文章流。/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /api/v1/news/:slug returns article without incrementing view count', async () => {
  const calls: Array<{ slug: string; options?: { countView?: boolean } }> = [];
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
        getArticleViewBySlug: async (slug: string, options?: { countView?: boolean }) => {
          calls.push({ slug, options });
          return {
            id: 8,
            title: 'API 文章',
            slug,
            excerpt: '用于验证 API 不计数。',
            cover_image_url: '',
            published_at: '2026-03-28 18:00:00',
            view_count: 9,
            reading_minutes: 2,
            content_html: '<p class="news-paragraph">api</p>',
            headings: [],
            previous: null,
            next: null,
          };
        },
        getPreviewArticleView: async () => null,
        getSitemapItems: async () => [],
      } as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/news/api-test`);
    assert.equal(response.status, 200);
    const data = (await response.json()) as { slug: string; view_count: number };
    assert.equal(data.slug, 'api-test');
    assert.equal(data.view_count, 9);
    assert.deepEqual(calls, [{ slug: 'api-test', options: undefined }]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /news/topic/:slug returns independent topic SEO page with pinned articles and FAQ JSON-LD', async () => {
  const calls: Array<{ slug: string; page: number; pageSize: number; q?: string }> = [];
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async () => ({
          page: 1,
          page_size: 12,
          total: 0,
          total_pages: 1,
          query: '',
          category: null,
          topic: null,
          categories: [],
          topics: [],
          featured: null,
          items: [],
          recommended: [],
          risk_watch: [],
          guides: [],
        }),
        getTopicPageView: async (slug: string, page: number, pageSize: number, filters?: { q?: string }) => {
          calls.push({ slug, page, pageSize, q: filters?.q });
          return {
            page,
            page_size: pageSize,
            total: 2,
            total_pages: 1,
            query: filters?.q || '',
            topic: {
              id: 10,
              name: '2026机场推荐专题',
              slug,
              description: '默认专题描述',
              seo_title: '2026机场推荐专题 SEO 标题',
              seo_description: '2026 机场推荐专题 SEO 描述，覆盖选择标准、稳定性和风险。',
              h1: '2026 机场推荐专题独立页',
              intro: '这里是后台维护的专题导语。',
              cover_image_url: '/uploads/news/topic-cover.webp',
              accent_color: '#d43d31',
              faq_items: [{ question: '怎么选择机场？', answer: '优先交叉查看稳定性、价格和风险记录。' }],
              sort_order: 10,
              is_active: true,
              updated_at: '2026-04-02 09:30:00',
            },
            categories: [],
            topics: [],
            pinned: [
              {
                id: 3,
                title: '置顶专题文章',
                slug: 'pinned-story',
                excerpt: '置顶摘要',
                cover_image_url: '',
                published_at: '2026-04-01 10:00:00',
                view_count: 12,
                reading_minutes: 3,
                category: null,
                topics: [],
                is_featured: false,
                is_recommended: false,
                recommend_weight: 0,
              },
            ],
            items: [
              {
                id: 4,
                title: '普通专题文章',
                slug: 'regular-story',
                excerpt: '普通摘要',
                cover_image_url: '/uploads/news/regular-cover.webp',
                published_at: '2026-03-31 10:00:00',
                view_count: 8,
                reading_minutes: 2,
                category: null,
                topics: [],
                is_featured: false,
                is_recommended: false,
                recommend_weight: 0,
              },
            ],
            recommended: [],
          };
        },
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
    const response = await fetch(`http://127.0.0.1:${port}/news/topic/airport-recommendations-2026`, {
      headers: {
        host: `127.0.0.1:${port}`,
      },
    });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.deepEqual(calls, [{ slug: 'airport-recommendations-2026', page: 1, pageSize: 12, q: undefined }]);
    assert.match(html, /<title>2026机场推荐专题 SEO 标题<\/title>/);
    assert.match(html, /<meta name="description" content="2026 机场推荐专题 SEO 描述，覆盖选择标准、稳定性和风险。"/);
    assert.match(html, /<link rel="canonical" href="http:\/\/127\.0\.0\.1:\d+\/news\/topic\/airport-recommendations-2026"/);
    assert.match(html, /<h1 class="topic-hero-title">2026 机场推荐专题独立页<\/h1>/);
    assert.match(html, /这里是后台维护的专题导语。/);
    assert.match(html, /置顶专题文章/);
    assert.match(html, /普通专题文章/);
    assert.match(html, /"@type":"FAQPage"/);
    assert.match(html, /怎么选择机场？/);
    assert.match(html, /<meta property="og:image" content="http:\/\/127\.0\.0\.1:\d+\/uploads\/news\/topic-cover\.webp"/);
    assert.match(html, /<img src="\/uploads\/news\/topic-cover\.webp" alt="2026机场推荐专题" loading="eager" decoding="async" fetchpriority="high"/);
    assert.match(html, /<img src="\/uploads\/news\/regular-cover\.webp" alt="普通专题文章" loading="lazy" decoding="async"/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /news/topic/:slug uses static topic OG fallback when topic has no cover', async () => {
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async () => ({
          page: 1,
          page_size: 12,
          total: 0,
          total_pages: 1,
          query: '',
          category: null,
          topic: null,
          categories: [],
          topics: [],
          featured: null,
          items: [],
          recommended: [],
          risk_watch: [],
          guides: [],
        }),
        getTopicPageView: async (slug: string) => ({
          page: 1,
          page_size: 12,
          total: 0,
          total_pages: 1,
          query: '',
          topic: {
            id: 10,
            name: '无封面专题',
            slug,
            description: '没有封面的专题描述。',
            seo_title: '无封面专题 SEO 标题',
            seo_description: '无封面专题 SEO 描述。',
            h1: '无封面专题',
            intro: '没有封面的专题导语。',
            cover_image_url: '',
            accent_color: '#d43d31',
            faq_items: [],
            sort_order: 10,
            is_active: true,
            updated_at: '2026-04-02 09:30:00',
          },
          categories: [],
          topics: [],
          pinned: [],
          items: [],
          recommended: [],
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
    const baseUrl = `http://127.0.0.1:${port}`;
    const response = await fetch(`${baseUrl}/news/topic/no-cover-topic`, { headers: { host: `127.0.0.1:${port}` } });
    assert.equal(response.status, 200);
    assertNewsOgImage(await response.text(), baseUrl, '/og/news-topic.png', 'GateRank News 专题页分享图', 'image/png');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /news/topic/:slug returns 404 html for inactive or missing topic', async () => {
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
        getTopicPageView: async () => null,
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
    const response = await fetch(`http://127.0.0.1:${port}/news/topic/inactive-topic`);
    assert.equal(response.status, 404);
    const html = await response.text();
    assert.match(html, /专题不存在或尚未发布/);
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
    assertNewsOgImage(html, `http://127.0.0.1:${port}`, '/og/publish-token-docs.png', 'GateRank 发布令牌接入说明分享图', 'image/png');
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertNewsOgImage(html: string, baseUrl: string, imagePath: string, alt: string, type: string) {
  const imageUrl = `${baseUrl}${imagePath}`;
  assert.match(html, new RegExp(`<meta property="og:image" content="${escapeRegExp(imageUrl)}" />`));
  assert.match(html, new RegExp(`<meta property="og:image:secure_url" content="${escapeRegExp(imageUrl)}" />`));
  assert.match(html, new RegExp(`<meta property="og:image:type" content="${escapeRegExp(type)}" />`));
  assert.match(html, new RegExp(`<meta property="og:image:alt" content="${escapeRegExp(alt)}" />`));
  assert.match(html, new RegExp(`<meta name="twitter:image" content="${escapeRegExp(imageUrl)}" />`));
  assert.match(html, new RegExp(`<meta name="twitter:image:alt" content="${escapeRegExp(alt)}" />`));
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
          view_count: 0,
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
  const calls: Array<{ slug: string; options?: { countView?: boolean } }> = [];
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
        getArticleViewBySlug: async (slug: string, options?: { countView?: boolean }) => {
          calls.push({ slug, options });
          return {
            id: 8,
            title: '服务端 SEO 测试',
            slug: 'seo-test',
            excerpt: '用于验证文章详情页 meta、canonical 和 JSON-LD。',
            cover_image_url: '/uploads/news/cover.webp',
            published_at: '2026-03-28 18:00:00',
            view_count: 123,
            reading_minutes: 6,
            content_html: '<p class="news-paragraph">hello world</p>',
            headings: [{ id: 'hello', level: 2, text: 'Hello' }],
            previous: null,
            next: null,
          };
        },
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
    assert.match(html, /<img src="\/uploads\/news\/cover\.webp" alt="服务端 SEO 测试" loading="eager" decoding="async" fetchpriority="high"/);
    assert.match(html, /分享到 Reddit/);
    assert.match(html, /123 次访问/);
    assert.deepEqual(calls, [{ slug: 'seo-test', options: { countView: true } }]);
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

test('GET /news/:slug uses static article OG fallback when article has no cover', async () => {
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
        getArticleViewBySlug: async (slug: string) => ({
          id: 9,
          title: '无封面文章',
          slug,
          excerpt: '用于验证文章详情页无封面时也有分享图。',
          cover_image_url: '',
          published_at: '2026-03-28 18:00:00',
          view_count: 123,
          reading_minutes: 6,
          content_html: '<p class="news-paragraph">hello world</p>',
          headings: [],
          previous: null,
          next: null,
        }),
        getPreviewArticleView: async () => null,
        getSitemapItems: async () => [{ slug: 'no-cover-article' }],
      } as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;
    const response = await fetch(`${baseUrl}/news/no-cover-article`, { headers: { host: `127.0.0.1:${port}` } });
    assert.equal(response.status, 200);
    assertNewsOgImage(await response.text(), baseUrl, '/og/news-article.png', 'GateRank News 文章分享图', 'image/png');
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
        getSitemapTaxonomy: async () => ({
          categories: [],
          topics: [
            {
              id: 10,
              name: 'Active Topic',
              slug: 'active-topic',
              description: 'active',
              sort_order: 10,
              is_active: true,
              updated_at: '2026-04-02 09:30:00',
            },
            {
              id: 11,
              name: 'Inactive Topic',
              slug: 'inactive-topic',
              description: 'inactive',
              sort_order: 20,
              is_active: false,
              updated_at: '2026-04-03 09:30:00',
            },
          ],
        }),
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
    assert.equal(urlBlocks.length, 66);
    urlBlocks.forEach((block) => {
      assert.match(block, /<lastmod>[^<]+<\/lastmod>/);
    });
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/rankings\/all<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/rankings\/payment\/alipay<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/rankings\/client\/clash<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/rankings\/region\/hong-kong<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.doesNotMatch(xml, /\/rankings\/all\?payment=alipay/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/monthly-reports<\/loc>\n    <lastmod>2026-05-17T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/risk-monitor<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/deals<\/loc>\n    <lastmod>2026-05-26T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/methodology<\/loc>\n    <lastmod>2026-05-17T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/ranking-transparency<\/loc>\n    <lastmod>2026-07-09T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/apply<\/loc>\n    <lastmod>2026-05-17T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/for-ai<\/loc>\n    <lastmod>2026-05-17T00:00:00\+08:00<\/lastmod>/);
    assert.doesNotMatch(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/tools<\/loc>/);
    assert.doesNotMatch(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/tools\/download<\/loc>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/download<\/loc>\n    <lastmod>2026-05-17T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/tools\/streaming-check<\/loc>\n    <lastmod>2026-07-10T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/tools\/ip-check<\/loc>\n    <lastmod>2026-07-24T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/tools\/dns-leak-test<\/loc>\n    <lastmod>2026-07-25T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/publish-token-docs<\/loc>\n    <lastmod>2026-05-24T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/airports\/nebula<\/loc>\n    <lastmod>2026-03-23T00:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/news\/topic\/active-topic<\/loc>\n    <lastmod>2026-04-02T09:30:00\+08:00<\/lastmod>/);
    assert.doesNotMatch(xml, /\/news\/topic\/inactive-topic/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/news\/published-story<\/loc>\n    <lastmod>2026-03-28T18:00:00\+08:00<\/lastmod>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/news<\/loc>\n    <lastmod>2026-03-28T18:00:00\+08:00<\/lastmod>/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('GET /sitemap.xml includes published monthly reports only', async () => {
  const app = express();
  app.use(
    createNewsPublicRoutes({
      newsPublicService: {
        getListView: async () => ({ page: 1, page_size: 12, total: 0, total_pages: 1, featured: null, items: [] }),
        getArticleViewBySlug: async () => null,
        getPreviewArticleView: async () => null,
        getSitemapItems: async () => [],
        getSitemapTaxonomy: async () => ({ categories: [], topics: [] }),
      } as never,
      publicViewService: {
        getFullRankingView: async () => ({
          date: '2026-06-30',
          items: [],
        }),
      },
      monthlyReportPublicService: {
        getSitemapItems: async () => [
          {
            id: 1,
            year: 2026,
            month: 6,
            slug: '2026-06-airport-vpn-ranking-report',
            title: '2026年6月机场 VPN 月度报告',
            h1: '2026年6月机场 VPN 月度报告',
            excerpt: '摘要',
            seo_title: '',
            seo_description: '',
            seo_keywords: '',
            cover_image_url: '',
            og_image_url: '',
            og_image_alt: '',
            status: 'published',
            published_at: '2026-07-01 10:00:00',
            created_at: '2026-07-01 09:00:00',
            updated_at: '2026-07-01 10:30:00',
          },
          {
            id: 2,
            year: 2026,
            month: 7,
            slug: '2026-07-draft-report',
            title: '草稿',
            h1: '草稿',
            excerpt: '草稿',
            seo_title: '',
            seo_description: '',
            seo_keywords: '',
            cover_image_url: '',
            og_image_url: '',
            og_image_alt: '',
            status: 'draft',
            published_at: null,
            created_at: '2026-07-02 09:00:00',
            updated_at: '2026-07-02 10:30:00',
          },
        ],
      } as never,
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
    const xml = await response.text();
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/monthly-reports<\/loc>/);
    assert.match(xml, /<loc>http:\/\/127\.0\.0\.1:\d+\/monthly-reports\/2026-06-airport-vpn-ranking-report<\/loc>\n    <lastmod>2026-07-01T10:30:00\+08:00<\/lastmod>/);
    assert.doesNotMatch(xml, /2026-07-draft-report/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
