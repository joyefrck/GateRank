import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle, NewsTopicSummary } from '../src/types/domain';
import type { NewsListQuery } from '../src/repositories/newsRepository';
import { NewsContentService } from '../src/services/newsContentService';
import { NewsPublicService } from '../src/services/newsPublicService';

function createArticle(id: number): NewsArticle {
  const date = String(id).padStart(2, '0');
  return {
    id,
    title: `文章 ${id}`,
    slug: `story-${id}`,
    excerpt: `摘要 ${id}`,
    cover_image_url: '',
    content_markdown: `正文 ${id}`,
    content_html: `<p>正文 ${id}</p>`,
    category_id: null,
    is_featured: id === 1,
    is_recommended: id <= 18,
    recommend_weight: 100 - id,
    status: 'published',
    published_at: `2026-07-${date} 10:00:00`,
    view_count: id,
    created_at: `2026-07-${date} 09:00:00`,
    updated_at: `2026-07-${date} 10:00:00`,
    category: null,
    topics: [],
  };
}

function createHarness() {
  const articles = Array.from({ length: 20 }, (_, index) => createArticle(index + 1));
  const topic: NewsTopicSummary = {
    id: 7,
    name: '测试专题',
    slug: 'test-topic',
    description: '测试专题描述',
    sort_order: 1,
  };
  const detailedQueries: NewsListQuery[] = [];
  const repository = {
    listCategories: async () => [],
    listTopics: async () => [topic],
    getCategoryBySlug: async () => null,
    getTopicBySlug: async (slug: string) => (slug === topic.slug ? topic : null),
    getFeaturedPublished: async () => articles[0],
    listPublishedDetailed: async (options: NewsListQuery) => {
      detailedQueries.push(options);
      const excluded = new Set(options.exclude_ids || []);
      const available = articles.filter((article) => !excluded.has(article.id));
      const page = Math.max(1, options.page || 1);
      const pageSize = Math.max(1, options.pageSize || 12);
      const offset = (page - 1) * pageSize;
      return {
        total: available.length,
        items: available.slice(offset, offset + pageSize),
      };
    },
    listRecommendedPublished: async () => articles.slice(0, 18),
    listLatestByCategory: async (slug: string) => (
      slug === 'risk-warning'
        ? [articles[0], articles[1], articles[18], articles[19]]
        : [articles[0], articles[2], articles[17], articles[19]]
    ),
    listPublishedPinnedByTopic: async () => [articles[0], articles[1]],
  };
  return {
    articles,
    detailedQueries,
    service: new NewsPublicService(repository as never, new NewsContentService()),
  };
}

test('news index keeps a full main page and de-duplicates every visible module', async () => {
  const { service, detailedQueries } = createHarness();

  const view = await service.getListView(1, 12);
  const visibleIds = [
    ...(view.featured ? [view.featured.id] : []),
    ...view.items.map((item) => item.id),
    ...view.recommended.map((item) => item.id),
    ...view.risk_watch.map((item) => item.id),
    ...view.guides.map((item) => item.id),
  ];

  assert.equal(view.total, 20);
  assert.equal(view.items.length, 12);
  assert.equal(new Set(visibleIds).size, visibleIds.length);
  assert.deepEqual(detailedQueries.at(-1)?.exclude_ids, [1]);
});

test('topic page de-duplicates pinned, feed, and recommended articles', async () => {
  const { service } = createHarness();

  const view = await service.getTopicPageView('test-topic', 1, 12);
  assert.ok(view);
  const visibleIds = [
    ...view.pinned.map((item) => item.id),
    ...view.items.map((item) => item.id),
    ...view.recommended.map((item) => item.id),
  ];

  assert.equal(view.total, 20);
  assert.equal(view.items.length, 12);
  assert.equal(new Set(visibleIds).size, visibleIds.length);
});
