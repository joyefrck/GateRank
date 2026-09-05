import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createToolsPublicRoutes } from '../src/routes/toolsPublicRoutes';
import { createPublicRoutes } from '../src/routes/publicRoutes';

test('download ads expose only card fields and homepage campaign ordering', async () => {
  const app = express();
  app.use(createToolsPublicRoutes({
    toolsDownloadService: {} as never,
    airportAdCampaignRepository: { listActiveHomeDeals: async () => [1, 3].map((slot) => ({
      campaign_id: slot + 10, airport_id: slot, home_slot: slot,
      airport_name: `广告 ${slot}`, website: 'https://example.com',
      discount_title: '优惠', airport_created_at: '2026-01-01', billed_amount: 1000,
    })) as never },
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/tools/download-ads`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const { items } = await response.json() as any;
    assert.deepEqual(items.map((item: any) => item.home_slot), [1, 3]);
    assert.equal(items[0].campaign_id, 11);
    assert.equal(items[0].name, '广告 1');
    assert.equal('billed_amount' in items[0], false);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('home and download clicks enter the same campaign with distinct source pages', async () => {
  const records: any[] = [];
  const app = express(); app.use(express.json());
  app.use(createPublicRoutes({ marketingRepository: { insertMany: async (input: any[]) => records.push(...input) } } as never));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/marketing/events`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: ['home', 'tools_download'].map((page_kind) => ({
        event_type: 'outbound_click', page_kind, page_path: page_kind === 'home' ? '/' : '/tools/download',
        airport_id: 1, campaign_id: 11, placement: 'deal_card', target_kind: 'website', target_url: 'https://example.com',
      })) }),
    });
    assert.equal(response.status, 201);
    assert.equal(records.length, 2);
    assert.deepEqual(records.map((event) => event.campaign_id), [11, 11]);
    assert.deepEqual(records.map((event) => event.page_kind), ['home', 'tools_download']);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('empty ad inventory returns a successful empty list', async () => {
  const app = express();
  app.use(createToolsPublicRoutes({ toolsDownloadService: {} as never, airportAdCampaignRepository: { listActiveHomeDeals: async () => [] } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/tools/download-ads`);
    assert.deepEqual(await response.json(), { items: [] });
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});
