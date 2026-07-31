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
  assert.ok(queries.some((sql) => sql.includes('campaign_id BIGINT UNSIGNED NULL')));
  assert.ok(queries.some((sql) => sql.includes('idx_marketing_events_campaign_date_type')));
});

test('MarketingEventRepository.insertMany persists campaign ids', async () => {
  let insertSql = '';
  let insertParams: unknown[] = [];
  const repository = new MarketingEventRepository({
    query: async () => [[]],
    execute: async (sql: string, params?: unknown[]) => {
      insertSql = sql;
      insertParams = params || [];
      return [{}];
    },
  } as never);

  await repository.insertMany([{
    occurred_at: '2026-07-31 10:00:00',
    event_date: '2026-07-31',
    event_type: 'airport_impression',
    page_path: '/',
    page_kind: 'home',
    referrer_path: null,
    external_referrer_host: null,
    source_type: 'direct_or_unknown',
    source_label: 'Direct / Unknown',
    airport_id: 7,
    campaign_id: 77,
    placement: 'deal_card',
    target_kind: null,
    target_url: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    country_code: 'ZZ',
    country_name: 'Unknown',
    visitor_hash: 'v'.repeat(64),
    session_hash: 's'.repeat(64),
  }]);

  assert.match(insertSql, /airport_id,\s+campaign_id,\s+placement/);
  assert.equal(insertParams[10], 77);
});

test('MarketingEventRepository migrates legacy page kind ENUM to VARCHAR once', async () => {
  const queries: string[] = [];
  const repository = new MarketingEventRepository({
    query: async (sql: string, params?: unknown[]) => {
      queries.push(sql);
      if (sql.includes('SHOW COLUMNS FROM marketing_events LIKE ?')) {
        const field = String(params?.[0] || '');
        return [[{
          Field: field,
          Type: field === 'page_kind'
            ? "enum('home','full_ranking','risk_monitor')"
            : 'varchar(255)',
        }]];
      }
      if (sql.includes('SHOW INDEX')) return [[{ Key_name: 'existing' }]];
      return [[]];
    },
    execute: async () => [{}],
  } as never);

  await repository.ensureSchema();

  assert.equal(
    queries.filter((sql) => (
      /ALTER TABLE marketing_events\s+MODIFY COLUMN page_kind VARCHAR\(64\) NOT NULL/i
        .test(sql)
    )).length,
    1,
  );
});

test('MarketingEventRepository leaves an existing VARCHAR page kind unchanged', async () => {
  const queries: string[] = [];
  const repository = new MarketingEventRepository({
    query: async (sql: string, params?: unknown[]) => {
      queries.push(sql);
      if (sql.includes('SHOW COLUMNS FROM marketing_events LIKE ?')) {
        return [[{ Field: String(params?.[0] || ''), Type: 'varchar(64)' }]];
      }
      if (sql.includes('SHOW INDEX')) return [[{ Key_name: 'existing' }]];
      return [[]];
    },
    execute: async () => [{}],
  } as never);

  await repository.ensureSchema();

  assert.equal(
    queries.some((sql) => /MODIFY COLUMN page_kind/i.test(sql)),
    false,
  );
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
