import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import express from 'express';
import { privateSeoGuard, PRIVATE_SEO_ROBOTS } from '../src/middleware/privateSeoGuard';

test('privateSeoGuard adds noindex header to admin and portal surfaces only', async () => {
  const app = express();
  app.use(privateSeoGuard);
  app.use((_req, res) => {
    res.type('html').send('<!doctype html><title>ok</title>');
  });

  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    for (const path of ['/admin/login', '/admin', '/portal', '/portal/recharge', '/api/v1/admin/login', '/api/v1/portal/me']) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.headers.get('x-robots-tag'), PRIVATE_SEO_ROBOTS, path);
    }

    for (const path of ['/', '/rankings/all', '/api/v1/public/home']) {
      const response = await fetch(`${baseUrl}${path}`);
      assert.equal(response.headers.get('x-robots-tag'), null, path);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
