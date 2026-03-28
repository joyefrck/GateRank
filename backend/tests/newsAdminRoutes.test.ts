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
          throw new HttpError(503, 'PEXELS_NOT_CONFIGURED', '未配置 PEXELS_API_KEY，无法使用封面图库');
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
    assert.equal(data.code, 'PEXELS_NOT_CONFIGURED');
    assert.equal(data.message, '未配置 PEXELS_API_KEY，无法使用封面图库');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('news admin routes import pexels cover image', async () => {
  const app = express();
  const auditEntries: Array<Record<string, unknown>> = [];
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
        importCoverImage: async () => ({ url: '/uploads/news/imported-cover.webp' }),
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
    assert.equal(response.status, 201);
    const data = await response.json() as { url: string };
    assert.equal(data.url, '/uploads/news/imported-cover.webp');
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
