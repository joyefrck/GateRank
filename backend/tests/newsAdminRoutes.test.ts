import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import express from 'express';
import { NewsCoverImageService } from '../src/services/newsCoverImageService';
import { createNewsAdminRoutes } from '../src/routes/newsAdminRoutes';
import { HttpError, errorHandler } from '../src/middleware/errorHandler';

interface StoredArticle {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  cover_image_url: string;
  content_markdown: string;
  content_html: string;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

test('news admin routes create, publish and archive article', async () => {
  const articles: StoredArticle[] = [];
  let nextId = 1;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: {
        log: async () => undefined,
      } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        getById: async (id: number) => articles.find((article) => article.id === id) || null,
        create: async (input: Omit<StoredArticle, 'id' | 'created_at' | 'updated_at'>) => {
          const article: StoredArticle = {
            id: nextId++,
            created_at: '2026-03-28 10:00:00',
            updated_at: '2026-03-28 10:00:00',
            ...input,
          };
          articles.push(article);
          return article.id;
        },
        update: async (id: number, input: Partial<StoredArticle>) => {
          const index = articles.findIndex((article) => article.id === id);
          if (index === -1) {
            return false;
          }
          articles[index] = {
            ...articles[index],
            ...input,
            updated_at: '2026-03-28 12:00:00',
          };
          return true;
        },
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: `<p class="news-paragraph">${markdown}</p>`,
          headings: [],
          reading_minutes: 2,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub(),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const createResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '测试文章',
        slug: 'test-article',
        excerpt: '测试摘要',
        cover_image_url: '/uploads/news/cover.jpg',
        content_markdown: 'hello world',
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()) as StoredArticle;
    assert.equal(created.status, 'draft');

    const publishResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/${created.id}/publish`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '测试文章',
        slug: 'test-article',
        excerpt: '测试摘要',
        cover_image_url: '/uploads/news/cover.jpg',
        content_markdown: 'hello world',
      }),
    });
    assert.equal(publishResponse.status, 200);
    const published = (await publishResponse.json()) as StoredArticle;
    assert.equal(published.status, 'published');
    assert.ok(published.published_at);

    const archiveResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/${created.id}/archive`, {
      method: 'POST',
    });
    assert.equal(archiveResponse.status, 200);
    const archived = (await archiveResponse.json()) as StoredArticle;
    assert.equal(archived.status, 'archived');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes allow publish without cover image', async () => {
  const articles: StoredArticle[] = [{
    id: 1,
    title: '草稿文章',
    slug: 'draft-article',
    excerpt: '已有摘要',
    cover_image_url: '',
    content_markdown: '正文内容',
    content_html: '<p class="news-paragraph">正文内容</p>',
    status: 'draft',
    published_at: null,
    created_at: '2026-03-28 10:00:00',
    updated_at: '2026-03-28 10:00:00',
  }];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: {
        log: async () => undefined,
      } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        getById: async (id: number) => articles.find((article) => article.id === id) || null,
        create: async () => 1,
        update: async (id: number, input: Partial<StoredArticle>) => {
          const index = articles.findIndex((article) => article.id === id);
          if (index === -1) {
            return false;
          }
          articles[index] = {
            ...articles[index],
            ...input,
            updated_at: '2026-03-28 12:00:00',
          };
          return true;
        },
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: `<p class="news-paragraph">${markdown}</p>`,
          headings: [],
          reading_minutes: 2,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub(),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const publishResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/1/publish`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '草稿文章',
        slug: 'draft-article',
        excerpt: '已有摘要',
        cover_image_url: '',
        content_markdown: '正文内容',
      }),
    });
    assert.equal(publishResponse.status, 200);
    const published = (await publishResponse.json()) as StoredArticle;
    assert.equal(published.status, 'published');
    assert.equal(published.cover_image_url, '');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes auto-generate excerpt when publish payload omits it', async () => {
  const articles: StoredArticle[] = [{
    id: 1,
    title: '草稿文章',
    slug: 'draft-article',
    excerpt: '',
    cover_image_url: '',
    content_markdown: '正文内容',
    content_html: '<p class="news-paragraph">正文内容</p>',
    status: 'draft',
    published_at: null,
    created_at: '2026-03-28 10:00:00',
    updated_at: '2026-03-28 10:00:00',
  }];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: {
        log: async () => undefined,
      } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        getById: async (id: number) => articles.find((article) => article.id === id) || null,
        create: async () => 1,
        update: async (id: number, input: Partial<StoredArticle>) => {
          const index = articles.findIndex((article) => article.id === id);
          if (index === -1) {
            return false;
          }
          articles[index] = {
            ...articles[index],
            ...input,
            updated_at: '2026-03-28 12:00:00',
          };
          return true;
        },
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: `<p class="news-paragraph">${markdown}</p>`,
          headings: [],
          reading_minutes: 2,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub(),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const publishResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/1/publish`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '草稿文章',
        slug: 'draft-article',
        excerpt: '',
        cover_image_url: '',
        content_markdown: '正文内容会自动变成摘要',
      }),
    });
    assert.equal(publishResponse.status, 200);
    const published = (await publishResponse.json()) as StoredArticle;
    assert.equal(published.status, 'published');
    assert.equal(published.excerpt, '正文内容会自动变成摘要');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes require manually entered slug', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: { log: async () => undefined } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        getById: async () => null,
        create: async () => {
          throw new Error('should not create without slug');
        },
        update: async () => {
          throw new Error('should not update without slug');
        },
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: markdown,
          headings: [],
          reading_minutes: 1,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub(),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const createResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '缺少 slug',
        slug: '',
        excerpt: '摘要',
        cover_image_url: '',
        content_markdown: 'hello',
      }),
    });
    assert.equal(createResponse.status, 400);
    const createData = (await createResponse.json()) as { code: string; message: string };
    assert.equal(createData.code, 'BAD_REQUEST');
    assert.equal(createData.message, 'slug 不能为空');

    const publishResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/1/publish`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '缺少 slug',
        content_markdown: 'hello',
      }),
    });
    assert.equal(publishResponse.status, 400);
    const publishData = (await publishResponse.json()) as { code: string; message: string };
    assert.equal(publishData.code, 'BAD_REQUEST');
    assert.equal(publishData.message, 'slug 不能为空');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes reject slug changes after article is published', async () => {
  const articles: StoredArticle[] = [{
    id: 1,
    title: '已发布文章',
    slug: 'published-article',
    excerpt: '摘要',
    cover_image_url: '',
    content_markdown: '旧正文',
    content_html: '<p class="news-paragraph">旧正文</p>',
    status: 'published',
    published_at: '2026-03-28 10:00:00',
    created_at: '2026-03-28 10:00:00',
    updated_at: '2026-03-28 10:00:00',
  }];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: {
        log: async () => undefined,
      } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        getById: async (id: number) => articles.find((article) => article.id === id) || null,
        create: async () => 1,
        update: async (id: number, input: Partial<StoredArticle>) => {
          const index = articles.findIndex((article) => article.id === id);
          if (index === -1) {
            return false;
          }
          articles[index] = {
            ...articles[index],
            ...input,
            updated_at: '2026-03-28 12:00:00',
          };
          return true;
        },
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: `<p class="news-paragraph">${markdown}</p>`,
          headings: [],
          reading_minutes: 2,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub(),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const updateResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/1`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '已发布文章',
        slug: 'published-article',
        excerpt: '摘要',
        cover_image_url: '',
        content_markdown: '新正文',
      }),
    });
    assert.equal(updateResponse.status, 200);
    assert.equal(articles[0]?.content_markdown, '新正文');
    assert.equal(articles[0]?.slug, 'published-article');

    const renameResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/1`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '已发布文章',
        slug: 'renamed-article',
        excerpt: '摘要',
        cover_image_url: '',
        content_markdown: '再改正文',
      }),
    });
    assert.equal(renameResponse.status, 400);
    const renameData = (await renameResponse.json()) as { code: string; message: string };
    assert.equal(renameData.code, 'BAD_REQUEST');
    assert.equal(renameData.message, '已发布文章的 slug 不能修改');
    assert.equal(articles[0]?.content_markdown, '新正文');
    assert.equal(articles[0]?.slug, 'published-article');

    const publishResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/1/publish`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '已发布文章',
        slug: 'renamed-again',
        excerpt: '摘要',
        cover_image_url: '',
        content_markdown: '发布正文',
      }),
    });
    assert.equal(publishResponse.status, 400);
    const publishData = (await publishResponse.json()) as { code: string; message: string };
    assert.equal(publishData.code, 'BAD_REQUEST');
    assert.equal(publishData.message, '已发布文章的 slug 不能修改');
    assert.equal(articles[0]?.slug, 'published-article');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes delete draft and archived articles only', async () => {
  const articles: StoredArticle[] = [
    {
      id: 1,
      title: '草稿文章',
      slug: 'draft-article',
      excerpt: '摘要',
      cover_image_url: '',
      content_markdown: '草稿正文',
      content_html: '<p class="news-paragraph">草稿正文</p>',
      status: 'draft',
      published_at: null,
      created_at: '2026-03-28 10:00:00',
      updated_at: '2026-03-28 10:00:00',
    },
    {
      id: 2,
      title: '已下线文章',
      slug: 'archived-article',
      excerpt: '摘要',
      cover_image_url: '',
      content_markdown: '下线正文',
      content_html: '<p class="news-paragraph">下线正文</p>',
      status: 'archived',
      published_at: '2026-03-28 10:00:00',
      created_at: '2026-03-28 10:00:00',
      updated_at: '2026-03-28 10:00:00',
    },
    {
      id: 3,
      title: '已发布文章',
      slug: 'published-article',
      excerpt: '摘要',
      cover_image_url: '',
      content_markdown: '发布正文',
      content_html: '<p class="news-paragraph">发布正文</p>',
      status: 'published',
      published_at: '2026-03-28 10:00:00',
      created_at: '2026-03-28 10:00:00',
      updated_at: '2026-03-28 10:00:00',
    },
  ];
  const auditEntries: Array<Record<string, unknown>> = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: {
        log: async (_action: string, _actor: string, _requestId: string, payload: Record<string, unknown>) => {
          auditEntries.push(payload);
        },
      } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        getById: async (id: number) => articles.find((article) => article.id === id) || null,
        create: async () => 1,
        update: async () => true,
        deleteById: async (id: number) => {
          const index = articles.findIndex((article) => article.id === id);
          if (index === -1) {
            return false;
          }
          articles.splice(index, 1);
          return true;
        },
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: `<p class="news-paragraph">${markdown}</p>`,
          headings: [],
          reading_minutes: 2,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub(),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const draftResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/1`, {
      method: 'DELETE',
    });
    assert.equal(draftResponse.status, 204);
    assert.equal(articles.some((article) => article.id === 1), false);

    const archivedResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/2/delete`, {
      method: 'POST',
    });
    assert.equal(archivedResponse.status, 204);
    assert.equal(articles.some((article) => article.id === 2), false);

    const publishedResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/3/delete`, {
      method: 'POST',
    });
    assert.equal(publishedResponse.status, 409);
    const publishedData = (await publishedResponse.json()) as { code: string; message: string };
    assert.equal(publishedData.code, 'NEWS_DELETE_NOT_ALLOWED');
    assert.equal(publishedData.message, '已发布文章不能删除，请先下线');
    assert.equal(articles.some((article) => article.id === 3), true);
    assert.deepEqual(auditEntries.map((entry) => entry.article_id), [1, 2]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes return 409 on slug conflict', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: { log: async () => undefined } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        getById: async () => null,
        create: async () => {
          throw { code: 'ER_DUP_ENTRY' };
        },
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: markdown,
          headings: [],
          reading_minutes: 1,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub(),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '冲突文章',
        slug: 'same-slug',
        excerpt: '摘要',
        cover_image_url: '/uploads/news/cover.jpg',
        content_markdown: 'hello',
      }),
    });
    assert.equal(response.status, 409);
    const data = (await response.json()) as { code: string };
    assert.equal(data.code, 'NEWS_SLUG_CONFLICT');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes compress cover uploads and keep body images unchanged', async () => {
  const uploadRoot = mkdtempSync(path.join(os.tmpdir(), 'gaterank-news-'));
  process.env.NEWS_UPLOAD_ROOT_DIR = uploadRoot;

  const app = express();
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: { log: async () => undefined } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        getById: async () => null,
        create: async () => 1,
        update: async () => true,
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: markdown,
          headings: [],
          reading_minutes: 1,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub(),
      newsCoverImageService: new NewsCoverImageService(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;

    const formData = new FormData();
    formData.set('mode', 'cover');
    formData.set('file', new Blob([getTinyPngBuffer()], { type: 'image/png' }), 'cover.png');
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/upload-image`, {
      method: 'POST',
      body: formData,
    });
    assert.equal(response.status, 201);
    const data = (await response.json()) as { url: string };
    assert.match(data.url, /^\/uploads\/news\/.+\.webp$/);

    const bodyForm = new FormData();
    bodyForm.set('mode', 'body');
    bodyForm.set('file', new Blob([getTinyPngBuffer()], { type: 'image/png' }), 'body.png');
    const bodyResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/upload-image`, {
      method: 'POST',
      body: bodyForm,
    });
    assert.equal(bodyResponse.status, 201);
    const bodyData = (await bodyResponse.json()) as { url: string };
    assert.match(bodyData.url, /^\/uploads\/news\/.+\.png$/);

    const badForm = new FormData();
    badForm.set('mode', 'cover');
    badForm.set('file', new Blob(['bad'], { type: 'text/plain' }), 'bad.txt');
    const badResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/upload-image`, {
      method: 'POST',
      body: badForm,
    });
    assert.equal(badResponse.status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    delete process.env.NEWS_UPLOAD_ROOT_DIR;
    rmSync(uploadRoot, { recursive: true, force: true });
  }
});

test('news admin routes search pexels cover images', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: { log: async () => undefined } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        getById: async () => null,
        create: async () => 1,
        update: async () => true,
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: markdown,
          headings: [],
          reading_minutes: 1,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub({
        searchCoverCandidates: async (query: string, page: number, perPage: number) => ({
          page,
          per_page: perPage,
          total: 1,
          items: [{
            id: 123,
            width: 1600,
            height: 900,
            alt: `${query}-cover`,
            photographer: 'Tester',
            photographer_url: 'https://www.pexels.com/@tester',
            pexels_url: 'https://www.pexels.com/photo/test-cover-123/',
            preview_url: 'https://images.pexels.com/photos/123/pexels-photo-123.jpeg',
            download_url: 'https://images.pexels.com/photos/123/pexels-photo-123.jpeg',
          }],
        }),
      }),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/cover-search?q=airport&page=2&per_page=6`);
    assert.equal(response.status, 200);
    const data = await response.json() as {
      page: number;
      per_page: number;
      total: number;
      items: Array<{ id: number; alt: string }>;
    };
    assert.equal(data.page, 2);
    assert.equal(data.per_page, 6);
    assert.equal(data.total, 1);
    assert.equal(data.items[0]?.id, 123);
    assert.equal(data.items[0]?.alt, 'airport-cover');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes return pexels configuration error', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: { log: async () => undefined } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        getById: async () => null,
        create: async () => 1,
        update: async () => true,
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: markdown,
          headings: [],
          reading_minutes: 1,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub({
        searchCoverCandidates: async () => {
          throw new HttpError(503, 'MEDIA_LIBRARY_NOT_CONFIGURED', '未在后台“系统设置 > 图库设置”中配置 Pexels API Key，无法使用封面图库');
        },
      }),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/cover-search?q=airport`);
    assert.equal(response.status, 503);
    const data = await response.json() as { code: string; message: string };
    assert.equal(data.code, 'MEDIA_LIBRARY_NOT_CONFIGURED');
    assert.equal(data.message, '未在后台“系统设置 > 图库设置”中配置 Pexels API Key，无法使用封面图库');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes import pexels cover image', async () => {
  const app = express();
  const auditEntries: Array<Record<string, unknown>> = [];
  let importInput: {
    id: number;
    download_url: string;
    context_slug?: string;
    alt?: string;
    target?: string;
  } | null = null;
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: {
        log: async (_event: string, _actor: string, _requestId: string, payload: Record<string, unknown>) => {
          auditEntries.push(payload);
        },
      } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        getById: async () => null,
        create: async () => 1,
        update: async () => true,
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: markdown,
          headings: [],
          reading_minutes: 1,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub({
        importCoverImage: async (input) => {
          importInput = input;
          return { url: '/uploads/news/imported-cover.webp' };
        },
      }),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/import-cover-image`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: 123,
        download_url: 'https://images.pexels.com/photos/123/pexels-photo-123.jpeg',
        context_slug: '../Runaway Airport Monitoring!!',
        alt: 'Runway skyline at dusk',
        target: 'topic',
      }),
    });
    assert.equal(response.status, 201);
    const data = await response.json() as { url: string };
    assert.equal(data.url, '/uploads/news/imported-cover.webp');
    assert.deepEqual(importInput, {
      id: 123,
      download_url: 'https://images.pexels.com/photos/123/pexels-photo-123.jpeg',
      context_slug: '../Runaway Airport Monitoring!!',
      alt: 'Runway skyline at dusk',
      target: 'topic',
    });
    assert.equal(auditEntries.length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes reject invalid pexels image import', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: { log: async () => undefined } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        getById: async () => null,
        create: async () => 1,
        update: async () => true,
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: markdown,
          headings: [],
          reading_minutes: 1,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub({
        importCoverImage: async () => {
          throw new HttpError(400, 'BAD_REQUEST', '远程图片格式不受支持');
        },
      }),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/import-cover-image`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: 123,
        download_url: 'https://images.pexels.com/photos/123/pexels-photo-123.jpeg',
      }),
    });
    assert.equal(response.status, 400);
    const data = await response.json() as { message: string };
    assert.equal(data.message, '远程图片格式不受支持');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes create, update and archive manually managed topics', async () => {
  const topics: Array<{
    id: number;
    name: string;
    slug: string;
    description: string;
    seo_title: string;
    seo_description: string;
    h1: string;
    intro: string;
    cover_image_url: string;
    accent_color: string;
    faq_items: Array<{ question: string; answer: string }>;
    sort_order: number;
    is_active: boolean;
    pinned_article_ids: number[];
  }> = [];
  let nextId = 1;
  const audits: string[] = [];
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: {
        log: async (action: string) => {
          audits.push(action);
        },
      } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        listTopics: async () => topics,
        getById: async () => null,
        getTopicById: async (id: number) => topics.find((topic) => topic.id === id) || null,
        createTopic: async (input: Omit<(typeof topics)[number], 'id'>) => {
          const topic = { ...input, id: nextId++ };
          topics.push(topic);
          return topic.id;
        },
        updateTopic: async (id: number, input: Partial<(typeof topics)[number]>) => {
          const index = topics.findIndex((topic) => topic.id === id);
          if (index === -1) {
            return false;
          }
          topics[index] = { ...topics[index], ...input };
          return true;
        },
        archiveTopic: async (id: number) => {
          const topic = topics.find((item) => item.id === id);
          if (!topic) {
            return false;
          }
          topic.is_active = false;
          return true;
        },
        validateTopicPinnedArticleIds: async (_topicId: number, ids: number[]) => ids.every((id) => [1, 3, 8].includes(id)),
        create: async () => 1,
        update: async () => true,
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: markdown,
          headings: [],
          reading_minutes: 1,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub(),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const createResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/topics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '2026 推荐专题',
        slug: 'airport-recommendations-2026',
        description: '专题描述',
        seo_title: '2026 机场推荐专题 SEO',
        seo_description: '专题 SEO 描述',
        h1: '2026 机场推荐专题',
        intro: '专题导语',
        cover_image_url: '/uploads/news/topic.webp',
        accent_color: '#d43d31',
        faq_items: [{ question: '怎么选？', answer: '优先看稳定性。' }],
        sort_order: 10,
        is_active: true,
        pinned_article_ids: [3, 1],
      }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json() as { id: number; pinned_article_ids: number[] };
    assert.deepEqual(created.pinned_article_ids, [3, 1]);

    const updateResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/topics/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '2026 推荐专题更新',
        accent_color: '#0f766e',
        faq_items: [{ question: '是否收录 FAQ？', answer: '是。' }],
        pinned_article_ids: [8],
      }),
    });
    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json() as { name: string; accent_color: string; pinned_article_ids: number[] };
    assert.equal(updated.name, '2026 推荐专题更新');
    assert.equal(updated.accent_color, '#0f766e');
    assert.deepEqual(updated.pinned_article_ids, [8]);

    const archiveResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/topics/${created.id}/archive`, {
      method: 'POST',
    });
    assert.equal(archiveResponse.status, 200);
    const archived = await archiveResponse.json() as { is_active: boolean };
    assert.equal(archived.is_active, false);
    assert.deepEqual(audits, ['create_news_topic', 'update_news_topic', 'archive_news_topic']);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes keep saved topic slug immutable', async () => {
  const topic = {
    id: 12,
    name: '跑路机场监测专题',
    slug: 'runaway-airport-monitoring',
    description: '现有专题描述',
    seo_title: '',
    seo_description: '',
    h1: '',
    intro: '',
    cover_image_url: '',
    accent_color: '#0f766e',
    faq_items: [],
    sort_order: 20,
    is_active: true,
    pinned_article_ids: [],
  };
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: { log: async () => undefined } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        listTopics: async () => [topic],
        getById: async () => null,
        getTopicById: async (id: number) => (id === topic.id ? topic : null),
        validateTopicPinnedArticleIds: async () => true,
        createTopic: async () => 1,
        updateTopic: async (id: number, input: Partial<typeof topic>) => {
          if (id !== topic.id) {
            return false;
          }
          Object.assign(topic, input);
          return true;
        },
        create: async () => 1,
        update: async () => true,
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: markdown,
          headings: [],
          reading_minutes: 1,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub(),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const updateWithoutSlugResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/topics/${topic.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '跑路机场监测专题更新',
      }),
    });
    assert.equal(updateWithoutSlugResponse.status, 200);
    assert.equal(topic.name, '跑路机场监测专题更新');
    assert.equal(topic.slug, 'runaway-airport-monitoring');

    const changeSlugResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/topics/${topic.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        slug: 'changed-topic-slug',
      }),
    });
    assert.equal(changeSlugResponse.status, 400);
    const data = await changeSlugResponse.json() as { message: string };
    assert.equal(data.message, '专题保存后 slug 不能修改');
    assert.equal(topic.slug, 'runaway-airport-monitoring');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes reject invalid topic color and pinned article ids', async () => {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/admin',
    createNewsAdminRoutes({
      auditRepository: { log: async () => undefined } as never,
      newsRepository: {
        listByQuery: async () => ({ items: [], total: 0 }),
        listTopics: async () => [],
        getById: async () => null,
        getTopicById: async (id: number) => ({
          id,
          name: '现有专题',
          slug: 'existing-topic',
          description: '现有描述',
          sort_order: 10,
          is_active: true,
        }),
        validateTopicPinnedArticleIds: async () => false,
        createTopic: async () => 1,
        updateTopic: async () => true,
        create: async () => 1,
        update: async () => true,
      } as never,
      newsContentService: {
        render: (markdown: string) => ({
          html: markdown,
          headings: [],
          reading_minutes: 1,
          plain_text: markdown,
        }),
      } as never,
      newsPublicService: {
        getPreviewArticleView: async () => null,
      } as never,
      pexelsCoverService: createPexelsServiceStub(),
      newsCoverImageService: createNewsCoverImageServiceStub(),
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const badColorResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/topics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '坏颜色',
        slug: 'bad-color',
        description: '描述',
        accent_color: 'red',
      }),
    });
    assert.equal(badColorResponse.status, 400);
    const badColor = await badColorResponse.json() as { message: string };
    assert.equal(badColor.message, 'accent_color 必须是 #RRGGBB 格式');

    const badPinResponse = await fetch(`http://127.0.0.1:${port}/api/v1/admin/news/topics/1`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pinned_article_ids: [999],
      }),
    });
    assert.equal(badPinResponse.status, 400);
    const badPin = await badPinResponse.json() as { message: string };
    assert.equal(badPin.message, '置顶文章必须是当前专题下的已发布文章');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

function createPexelsServiceStub(overrides: {
  searchCoverCandidates?: (query: string, page: number, perPage: number) => Promise<unknown>;
  importCoverImage?: (input: { id: number; download_url: string }, maxBytes: number) => Promise<{ url: string }>;
} = {}) {
  return {
    searchCoverCandidates: overrides.searchCoverCandidates || (async (_query: string, page: number, perPage: number) => ({
      page,
      per_page: perPage,
      total: 0,
      items: [],
    })),
    importCoverImage: overrides.importCoverImage || (async (_input: { id: number; download_url: string }, _maxBytes: number) => ({
      url: '/uploads/news/default-cover.webp',
    })),
  } as never;
}

function createNewsCoverImageServiceStub(overrides: {
  compressUploadedCover?: (inputPath: string) => Promise<{ url: string }>;
} = {}) {
  return {
    compressUploadedCover: overrides.compressUploadedCover || (async (_inputPath: string) => ({
      url: '/uploads/news/default-cover.webp',
    })),
  } as never;
}

function getTinyPngBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z0X8AAAAASUVORK5CYII=',
    'base64',
  );
}
