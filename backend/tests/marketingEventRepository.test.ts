import test from 'node:test';
import assert from 'node:assert/strict';
import { MarketingEventRepository } from '../src/repositories/marketingEventRepository';

test('MarketingEventRepository.ensureSchema creates marketing_events table', async () => {
  const queries: string[] = [];
  const repository = new MarketingEventRepository({
    query: async (sql: string) => {
      queries.push(sql);
      return [[]];
    },
    execute: async () => [{}],
  } as never);

  await repository.ensureSchema();

  assert.ok(queries.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS marketing_events')));
});

test('MarketingEventRepository.getOverview uses requested granularity and computes ctr', async () => {
  const queryCalls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new MarketingEventRepository({
    query: async (sql: string, params?: unknown[]) => {
      queryCalls.push({ sql, params });
      if (sql.includes('GROUP BY period_start')) {
        return [[{
          period_start: '2026-04-14',
          page_views: 30,
          unique_visitors: 20,
          airport_impressions: 10,
          outbound_clicks: 5,
        }]];
      }
      if (sql.includes('GROUP BY source_type, source_label')) {
        return [[{
          source_type: 'google',
          source_label: 'Google',
          page_views: 40,
          unique_visitors: 25,
          airport_impressions: 15,
          outbound_clicks: 6,
        }]];
      }
      if (sql.includes('GROUP BY country_code, country_name')) {
        return [[{
          country_code: 'US',
          country_name: 'United States',
          page_views: 50,
          unique_visitors: 30,
          airport_impressions: 12,
          outbound_clicks: 4,
        }]];
      }
      if (sql.includes('COUNT(DISTINCT CASE WHEN event_type = \'page_view\'')) {
        return [[{
          page_views: 120,
          unique_visitors: 88,
          airport_impressions: 40,
          outbound_clicks: 10,
        }]];
      }
      return [[]];
    },
    execute: async () => [{}],
  } as never);

  const result = await repository.getOverview({
    dateFrom: '2026-04-01',
    dateTo: '2026-04-18',
    granularity: 'week',
  });

  assert.equal(result.totals.page_views, 120);
  assert.equal(result.totals.unique_visitors, 88);
  assert.equal(result.totals.ctr, 0.25);
  assert.equal(result.trends[0]?.period_start, '2026-04-14');
  assert.equal(result.top_sources[0]?.source_label, 'Google');
  assert.equal(result.top_countries[0]?.country_code, 'US');

  const trendQuery = queryCalls.find((call) => call.sql.includes('GROUP BY period_start'));
  assert.ok(trendQuery);
  assert.match(trendQuery.sql, /WEEKDAY\(event_date\)/);
  assert.deepEqual(trendQuery.params, ['2026-04-01', '2026-04-18']);
});

test('MarketingEventRepository.getAirportStats sorts and computes primary placement', async () => {
  const repository = new MarketingEventRepository({
    query: async (sql: string) => {
      if (sql.includes('GROUP BY me.airport_id, airport_name')) {
        return [[
          {
            airport_id: 2,
            airport_name: 'Beta',
            airport_impressions: 10,
            outbound_clicks: 3,
            last_clicked_at: '2026-04-18 18:00:00',
          },
          {
            airport_id: 1,
            airport_name: 'Alpha',
            airport_impressions: 20,
            outbound_clicks: 12,
            last_clicked_at: '2026-04-18 19:00:00',
          },
        ]];
      }
      if (sql.includes('GROUP BY me.airport_id, me.placement')) {
        return [[
          { airport_id: 1, placement: 'report_header', airport_impressions: 8, outbound_clicks: 9 },
          { airport_id: 1, placement: 'home_card', airport_impressions: 12, outbound_clicks: 3 },
          { airport_id: 2, placement: 'home_card', airport_impressions: 10, outbound_clicks: 3 },
        ]];
      }
      return [[]];
    },
    execute: async () => [{}],
  } as never);

  const result = await repository.getAirportStats({
    dateFrom: '2026-04-01',
    dateTo: '2026-04-18',
    sortBy: 'clicks',
    sortOrder: 'desc',
  });

  assert.equal(result[0]?.airport_name, 'Alpha');
  assert.equal(result[0]?.primary_placement, 'report_header');
  assert.equal(result[0]?.ctr, 0.6);
  assert.equal(result[1]?.airport_name, 'Beta');
});
