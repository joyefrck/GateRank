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
