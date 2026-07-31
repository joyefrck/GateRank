import test from 'node:test';
import assert from 'node:assert/strict';
import type { NewsArticle } from '../src/types/domain';
import type { UpdateNewsArticleInput } from '../src/repositories/newsRepository';
import { NewsMutationService } from '../src/services/newsMutationService';

function createHarness(status: NewsArticle['status'], publishedAt: string | null) {
  const article: NewsArticle = {
    id: 7,
    title: '时间测试',
    slug: 'publication-time-test',
    excerpt: '摘要',
    cover_image_url: '',
    content_markdown: '正文',
    content_html: '<p>正文</p>',
    category_id: null,
    is_featured: false,
    is_recommended: false,
    recommend_weight: 0,
    status,
    published_at: publishedAt,
    view_count: 0,
    created_at: '2026-05-01 08:00:00',
    updated_at: '2026-05-01 08:00:00',
    category: null,
    topics: [],
  };
  const service = new NewsMutationService({
    newsRepository: {
      getById: async () => article,
      getBySlug: async () => article,
      create: async () => article.id,
      update: async (_id: number, input: UpdateNewsArticleInput) => {
        Object.assign(article, input);
        return true;
      },
      resolveCategoryId: async () => null,
      resolveTopicIds: async () => [],
    } as never,
    newsContentService: {
      render: (markdown: string) => ({
        html: `<p>${markdown}</p>`,
        headings: [],
        reading_minutes: 1,
        plain_text: markdown,
      }),
    } as never,
    newsCoverImageService: { compressUploadedCover: async () => ({ url: '' }) } as never,
  });
  return { article, service };
}

test('first publish assigns published_at', async () => {
  const { article, service } = createHarness('draft', null);

  await service.publish(article.id);

  assert.match(String(article.published_at), /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
});

test('publishing an already published article preserves first publication time', async () => {
  const original = '2026-05-21 01:40:23';
  const { article, service } = createHarness('published', original);

  await service.publish(article.id);

  assert.equal(article.published_at, original);
});

test('restoring an archived article preserves first publication time', async () => {
  const original = '2026-06-06 14:25:36';
  const { article, service } = createHarness('archived', original);

  await service.publish(article.id);

  assert.equal(article.published_at, original);
  assert.equal(article.status, 'published');
});
