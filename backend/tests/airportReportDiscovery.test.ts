import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { ScoreRepository } from '../src/repositories/scoreRepository';
import { PublicViewService } from '../src/services/publicViewService';
import { createNewsPublicRoutes } from '../src/routes/newsPublicRoutes';
import { createMachineReadableRoutes } from '../src/routes/machineReadableRoutes';
import { createPublicPageRoutes } from '../src/routes/publicPageRoutes';
import type { FullRankingItem } from '../src/types/domain';
import { getAirportDirectoryView } from '../src/services/airportDirectoryService';

test('directory collects later pages, sorts names, deduplicates and excludes unavailable reports', async () => {
  const calls: unknown[][] = [];
  const view = await getAirportDirectoryView({ getFullRankingView: async (...args: unknown[]) => {
    calls.push(args);
    return {
      date: '2026-09-16', total_pages: 2,
      items: args[1] === 1
        ? [{ name: 'Zulu', report_url: '/airports/zulu' }, { name: 'Missing', report_url: null }]
        : [{ name: 'Alpha', report_url: '/airports/alpha' }, { name: 'Zulu', report_url: '/airports/zulu' }],
    };
  } } as never, '2026-09-17');
  assert.deepEqual(view.items, [{ name: 'Alpha', path: '/airports/alpha' }, { name: 'Zulu', path: '/airports/zulu' }]);
  assert.deepEqual(calls, [['2026-09-17', 1, 100], ['2026-09-16', 2, 100]]);
});

test('ranking SSR and hydration share page contents and directory exposes all existing reports', async () => {
  const items: FullRankingItem[] = Array.from({ length: 68 }, (_, i) => ({
    airport_id: i + 1, rank: i + 1, name: `Airport ${i + 1}`,
    website: `https://airport-${i + 1}.example.com`, status: 'normal', tags: [],
    founded_on: null, plan_price_month: 10, has_trial: false, airport_intro: null,
    created_at: '2026-01-01', score: i < 16 ? 90 : null,
    score_date: i < 16 ? '2026-09-16' : null,
    score_delta_vs_yesterday: { label: '对比昨天', value: null },
    report_url: i < 16 ? `/airports/airport-${i + 1}` : null,
  }));
  const publicViewService = new PublicViewService({
    scoreRepository: {
      getLatestAvailableDate: async () => '2026-09-16',
      getPublicFullRankingByDate: async (_date: string, page: number, size: number) => ({
        total: 68, items: items.slice((page - 1) * size, page * size),
      }),
      getAvailableReportLinksByAirportIds: async (ids: number[]) => new Map(
        ids.filter((id) => id <= 64).map((id) => [id, `/airports/airport-${id}`]),
      ),
    },
  } as never);
  const app = express();
  app.use(createPublicPageRoutes({ publicViewService } as never));
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const allLinks = new Set<string>();
    for (let page = 1; page <= 4; page++) {
      const response = await fetch(`${base}/rankings/all?page=${page}`);
      assert.equal(response.status, 200);
      const html = await response.text();
      const links = [...html.matchAll(/href="(\/airports\/[^"?]+)"/g)].map((match) => match[1]);
      links.forEach((link) => allLinks.add(link));
      const initial = JSON.parse(html.match(/id="__GATERANK_INITIAL_DATA__"[^>]*>(.*?)<\/script>/s)![1]);
      assert.deepEqual([...new Set(links)], initial.payload.items.filter((item: FullRankingItem) => item.report_url).map((item: FullRankingItem) => item.report_url));
      assert.equal(initial.payload.items.length, page < 4 ? 20 : 8);
      assert.equal(initial.payload.items[0].airport_id, (page - 1) * 20 + 1);
      assert.equal(initial.payload.total, 68);
      assert.equal(initial.payload.total_pages, 4);
      assert.match(html, /aria-label="机场排行分页"/);
      if (page < 4) assert.ok(html.includes(`href="/rankings/all?page=${page + 1}"`));
      if (page > 1) assert.ok(html.includes(`href="/rankings/all${page === 2 ? '' : `?page=${page - 1}`}"`));
    }
    assert.equal(allLinks.size, 64);
    const filtered = await fetch(`${base}/rankings/all?date=2026-09-01&page=2&payment=alipay`);
    const filteredHtml = await filtered.text();
    assert.equal(filtered.status, 200);
    assert.match(filteredHtml, /href="\/rankings\/all\?date=2026-09-01&amp;page=3&amp;payment=alipay"/);
    const invalid = await fetch(`${base}/rankings/all?page=5`);
    assert.equal(invalid.status, 404);
    assert.match(await invalid.text(), /content="noindex,follow"/);
    const directory = await fetch(`${base}/airports`);
    assert.equal(directory.status, 200);
    const html = await directory.text();
    assert.equal(new Set([...html.matchAll(/href="(\/airports\/[^"?]+)"/g)].map((match) => match[1])).size, 64);
    assert.match(html, /href="http:\/\/127\.0\.0\.1:\d+\/airports"/);
    assert.doesNotMatch(html, /href="\/airports\/airport-65"/);
    const api = await fetch(`${base}/api/v1/pages/airports`);
    assert.equal(api.status, 200);
    assert.equal(((await api.json()) as { items: unknown[] }).items.length, 64);

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('report discovery requires metrics for the latest historical score, independently of billing and current scores', async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const repository = new ScoreRepository({
    query: async (sql: string, params: unknown[]) => {
      calls.push({ sql, params });
      return [[{ airport_id: 87, slug: 'phl1', name: '拼好连', website: 'https://example.com' }]];
    },
  } as never);
  const links = await repository.getAvailableReportLinksByAirportIds([87, 92], '2026-09-16');
  assert.deepEqual([...links], [[87, '/airports/phl1']]);
  assert.match(calls[0].sql, /MAX\(date\)/);
  assert.match(calls[0].sql, /date <= \?/);
  assert.match(calls[0].sql, /JOIN airport_metrics_daily/);
  assert.match(calls[0].sql, /m\.date = latest_report\.report_date/);
  assert.match(calls[0].sql, /a\.is_listed = 1/);
  assert.doesNotMatch(calls[0].sql, /applicant_wallets|balance|score_rule_version/);
  assert.deepEqual(calls[0].params, [87, 92, '2026-09-16']);
  await repository.getAvailableReportLinksByAirportIds([87], '2026-09-16', 'v1_spcr');
  assert.match(calls[1].sql, /score_rule_version/);
  assert.deepEqual(calls[1].params, [87, '2026-09-16', 'v1_spcr']);
  assert.equal((await repository.getAvailableReportLinksByAirportIds([], '2026-09-16')).size, 0);
  assert.equal(calls.length, 2);
});

test('ranking restores historical report links without restoring unpublished scores or nonexistent reports', async () => {
  for (const forced of [false, true]) {
    const calls: unknown[][] = [];
    const items = [
      { airport_id: 87, score: null, score_date: null, score_hidden: true, report_url: null },
      { airport_id: 92, score: null, score_date: null, score_hidden: false, report_url: '/airports/stale-link' },
    ];
    const service = new PublicViewService({
      scoreRepository: {
        getLatestAvailableDate: async () => '2026-09-15',
        getPublicFullRankingByDate: async () => ({ total: 2, items }),
        getAvailableReportLinksByAirportIds: async (...args: unknown[]) => {
          calls.push(args);
          return new Map([[87, '/airports/phl1']]);
        },
      },
      scoreRuleService: {
        resolveRuleVersion: async () => forced ? 'v1_spcr' : 'v2_spncr',
        isForceDisabled: () => forced,
      },
    } as never);
    const result = await service.getFullRankingView('2026-09-16', 1, 20);
    assert.deepEqual(result.items, [
      { ...items[0], report_url: '/airports/phl1' },
      { ...items[1], report_url: null },
    ]);
    assert.deepEqual(calls, [[[87, 92], '2026-09-16', forced ? 'v1_spcr' : undefined]]);
    assert.equal(items[0].report_url, null);
  }
});

for (const path of ['/sitemap.xml', '/sitemap-ai.xml']) {
  test(`${path} includes reports after the first 100 airports and deduplicates links`, async () => {
    const calls: Array<[string, number, number]> = [];
    const publicViewService = {
      getFullRankingView: async (date: string, page: number, size: number) => {
        calls.push([date, page, size]);
        return {
          date: '2026-09-15', total_pages: 2,
          items: page === 1
            ? Array.from({ length: 100 }, (_, i) => ({ report_url: `/airports/airport-${i}` }))
            : [{ report_url: '/airports/historical' }, { report_url: null }, { report_url: '/airports/airport-0' }],
        };
      },
    };
    const app = express();
    app.use(path === '/sitemap.xml'
      ? createNewsPublicRoutes({ publicViewService, newsPublicService: { getSitemapItems: async () => [] } } as never)
      : createMachineReadableRoutes({ publicViewService } as never));
    const server = app.listen(0);
    try {
      const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`);
      assert.equal(response.status, 200);
      const xml = await response.text();
      const extension = path === '/sitemap-ai.xml' ? '\\.md' : '';
      assert.match(xml, new RegExp(`/airports/historical${extension}</loc>`));
      assert.equal(xml.match(new RegExp(`/airports/airport-0${extension}</loc>`, 'g'))?.length, 1);
      assert.equal(calls.length, 2);
      assert.equal(calls[0][1], 1);
      assert.deepEqual(calls[1], ['2026-09-15', 2, 100]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
