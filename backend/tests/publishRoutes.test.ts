import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { AddressInfo } from 'node:net';
import { HttpError, errorHandler } from '../src/middleware/errorHandler';
import { createPublishRoutes } from '../src/routes/publishRoutes';

test('publish routes create draft article with bearer token', async () => {
  const app = express();
  const audits: Array<{ action: string; actor: string }> = [];
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1',
    createPublishRoutes({
      accessTokenService: {
        authenticateToken: async () => ({
          id: 1,
          name: 'openclaw',
          scopes: ['news:create', 'news:publish'],
          actor: 'publish_token:openclaw#1',
        }),
      } as never,
      auditRepository: {
        log: async (action: string, actor: string) => {
          audits.push({ action, actor });
        },
      } as never,
      newsMutationService: {
        create: async (_payload: Record<string, unknown>, publishMode: 'draft' | 'publish') => ({
          id: 9,
          title: '测试',
          slug: 'test',
          excerpt: '摘要',
          cover_image_url: '',
          content_markdown: 'hello',
          content_html: '<p>hello</p>',
          status: publishMode === 'publish' ? 'published' : 'draft',
          published_at: null,
          created_at: '2026-03-29 10:00:00',
          updated_at: '2026-03-29 10:00:00',
        }),
      } as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/publish/news`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer grpt_ok',
      },
      body: JSON.stringify({
        title: '测试',
        content_markdown: 'hello',
      }),
    });

    assert.equal(response.status, 201);
    const data = await response.json() as { status: string };
    assert.equal(data.status, 'draft');
    assert.equal(audits[0]?.action, 'token_create_news_article');
    assert.equal(audits[0]?.actor, 'publish_token:openclaw#1');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('publish routes reject direct publish without publish scope', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1',
    createPublishRoutes({
      accessTokenService: {
        authenticateToken: async () => ({
          id: 1,
          name: 'draft-only',
          scopes: ['news:create'],
          actor: 'publish_token:draft-only#1',
        }),
      } as never,
      auditRepository: { log: async () => undefined } as never,
      newsMutationService: {
        create: async () => {
          throw new Error('should not create');
        },
      } as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/publish/news`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer grpt_ok',
      },
      body: JSON.stringify({
        title: '测试',
        content_markdown: 'hello',
        publish_mode: 'publish',
      }),
    });

    assert.equal(response.status, 403);
    const data = await response.json() as { code: string };
    assert.equal(data.code, 'FORBIDDEN');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test('publish routes update article by numeric id', async () => {
  const calls: Array<{ action: string; id?: number; identifier?: string }> = [];
  const app = createUpdateTestApp({
    resolveArticleByIdOrSlug: async (identifier: string) => {
      calls.push({ action: 'resolve', identifier });
      return buildArticle({ id: 123, slug: 'existing-article' });
    },
    update: async (id: number, payload: Record<string, unknown>) => {
      calls.push({ action: 'update', id });
      assert.equal(payload.title, '更新后的标题');
      return buildArticle({ id, title: '更新后的标题', slug: 'existing-article' });
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/publish/news/123`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer grpt_ok',
      },
      body: JSON.stringify({ title: '更新后的标题' }),
    });

    assert.equal(response.status, 200);
    const data = await response.json() as { id: number; title: string; slug: string };
    assert.equal(data.id, 123);
    assert.equal(data.title, '更新后的标题');
    assert.equal(data.slug, 'existing-article');
  });

  assert.deepEqual(calls, [
    { action: 'resolve', identifier: '123' },
    { action: 'update', id: 123 },
  ]);
});

test('publish routes update article by slug', async () => {
  const calls: Array<{ action: string; id?: number; identifier?: string }> = [];
  const app = createUpdateTestApp({
    resolveArticleByIdOrSlug: async (identifier: string) => {
      calls.push({ action: 'resolve', identifier });
      return buildArticle({ id: 456, slug: 'new-article' });
    },
    update: async (id: number) => {
      calls.push({ action: 'update', id });
      return buildArticle({ id, slug: 'new-article', title: 'Slug updated' });
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/publish/news/new-article`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer grpt_ok',
      },
      body: JSON.stringify({ title: 'Slug updated' }),
    });

    assert.equal(response.status, 200);
    const data = await response.json() as { id: number; slug: string };
    assert.equal(data.id, 456);
    assert.equal(data.slug, 'new-article');
  });

  assert.deepEqual(calls, [
    { action: 'resolve', identifier: 'new-article' },
    { action: 'update', id: 456 },
  ]);
});

test('publish routes return 404 when slug cannot be resolved', async () => {
  const app = createUpdateTestApp({
    resolveArticleByIdOrSlug: async () => {
      throw new HttpError(404, 'NEWS_NOT_FOUND', 'news article missing-slug not found');
    },
    update: async () => {
      throw new Error('should not update');
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/publish/news/missing-slug`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer grpt_ok',
      },
      body: JSON.stringify({ title: 'missing' }),
    });

    assert.equal(response.status, 404);
    const data = await response.json() as { code: string };
    assert.equal(data.code, 'NEWS_NOT_FOUND');
  });
});

test('publish routes return 409 when slug update conflicts', async () => {
  const duplicateSlugError = Object.assign(new Error('duplicate slug'), { code: 'ER_DUP_ENTRY' });
  const app = createUpdateTestApp({
    resolveArticleByIdOrSlug: async () => buildArticle({ id: 88, slug: 'old-slug' }),
    update: async () => {
      throw duplicateSlugError;
    },
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/publish/news/old-slug`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer grpt_ok',
      },
      body: JSON.stringify({ slug: 'existing-slug' }),
    });

    assert.equal(response.status, 409);
    const data = await response.json() as { code: string };
    assert.equal(data.code, 'NEWS_SLUG_CONFLICT');
  });
});

test('publish and archive routes remain id-only', async () => {
  const app = express();
  let called = false;
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1',
    createPublishRoutes({
      accessTokenService: {
        authenticateToken: async () => ({
          id: 1,
          name: 'openclaw',
          scopes: ['news:publish', 'news:archive'],
          actor: 'publish_token:openclaw#1',
        }),
      } as never,
      auditRepository: { log: async () => undefined } as never,
      newsMutationService: {
        publish: async () => {
          called = true;
          throw new Error('should not publish by slug');
        },
        archive: async () => {
          called = true;
          throw new Error('should not archive by slug');
        },
      } as never,
    }),
  );
  app.use(errorHandler);

  await withServer(app, async (baseUrl) => {
    const publishResponse = await fetch(`${baseUrl}/api/v1/publish/news/new-article/publish`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer grpt_ok',
      },
      body: JSON.stringify({}),
    });
    assert.equal(publishResponse.status, 400);

    const archiveResponse = await fetch(`${baseUrl}/api/v1/publish/news/new-article/archive`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer grpt_ok',
      },
    });
    assert.equal(archiveResponse.status, 400);
  });

  assert.equal(called, false);
});

test('publish routes return 401 on invalid token', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1',
    createPublishRoutes({
      accessTokenService: {
        authenticateToken: async () => {
          throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or missing publish token');
        },
      } as never,
      auditRepository: { log: async () => undefined } as never,
      newsMutationService: {} as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/publish/news`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer bad',
      },
      body: JSON.stringify({ title: '测试', content_markdown: 'hello' }),
    });

    assert.equal(response.status, 401);
    const data = await response.json() as { code: string };
    assert.equal(data.code, 'UNAUTHORIZED');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

function createUpdateTestApp(newsMutationService: Record<string, unknown>): express.Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1',
    createPublishRoutes({
      accessTokenService: {
        authenticateToken: async () => ({
          id: 1,
          name: 'openclaw',
          scopes: ['news:update'],
          actor: 'publish_token:openclaw#1',
        }),
      } as never,
      auditRepository: { log: async () => undefined } as never,
      newsMutationService: newsMutationService as never,
    }),
  );
  app.use(errorHandler);
  return app;
}

function buildArticle(overrides: Record<string, unknown> = {}) {
  return {
    id: 9,
    title: '测试',
    slug: 'test',
    excerpt: '摘要',
    cover_image_url: '',
    content_markdown: 'hello',
    content_html: '<p>hello</p>',
    status: 'draft',
    published_at: null,
    created_at: '2026-03-29 10:00:00',
    updated_at: '2026-03-29 10:00:00',
    ...overrides,
  };
}

async function withServer(app: express.Express, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('publish routes enforce upload scope', async () => {
  const app = express();
  app.use((req, _res, next) => {
    req.requestId = 'test-request-id';
    next();
  });
  app.use(
    '/api/v1',
    createPublishRoutes({
      accessTokenService: {
        authenticateToken: async (_token: string, scopes: readonly string[]) => {
          if (scopes.includes('news:upload')) {
            throw new HttpError(403, 'FORBIDDEN', 'Publish token scope not allowed');
          }
          return {
            id: 1,
            name: 'openclaw',
            scopes: ['news:create'],
            actor: 'publish_token:openclaw#1',
          };
        },
      } as never,
      auditRepository: { log: async () => undefined } as never,
      newsMutationService: {} as never,
    }),
  );
  app.use(errorHandler);

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const formData = new FormData();
    formData.set('mode', 'cover');
    formData.set('file', new Blob(['tiny'], { type: 'image/png' }), 'cover.png');

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/publish/news/upload-image`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer grpt_ok',
      },
      body: formData,
    });

    assert.equal(response.status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
