import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  MarketingAirportConversionItem,
  MarketingAirportDetailView,
  MarketingCountryBreakdownItem,
  MarketingCountryFilterItem,
  MarketingGranularity,
  MarketingOverviewView,
  MarketingPageStatsItem,
  MarketingPlacement,
  MarketingSourceBreakdownItem,
  MarketingSourceFilterItem,
  MarketingSourceType,
  MarketingTargetKind,
  MarketingTrendPoint,
} from '../types/domain';
import type { MarketingEventInsertRecord } from '../utils/marketing';
import { dateDaysAfter, formatDateOnly, formatDateTimeInTimezoneIso } from '../utils/time';

interface OverviewTotalsRow extends RowDataPacket {
  page_views: number;
  unique_visitors: number;
  airport_impressions: number;
  outbound_clicks: number;
}

interface TrendRow extends RowDataPacket {
  period_start: string;
  page_views: number;
  unique_visitors: number;
  airport_impressions: number;
  outbound_clicks: number;
}

interface SourceBreakdownRow extends RowDataPacket {
  source_type: MarketingSourceType;
  source_label: string;
  page_views: number;
  unique_visitors: number;
  airport_impressions: number;
  outbound_clicks: number;
}

interface CountryBreakdownRow extends RowDataPacket {
  country_code: string;
  country_name: string;
  page_views: number;
  unique_visitors: number;
  airport_impressions: number;
  outbound_clicks: number;
}

interface PageStatsRow extends RowDataPacket {
  page_path: string;
  page_kind: string;
  page_views: number;
  unique_visitors: number;
  outbound_clicks: number;
  last_visited_at: unknown;
}

interface AirportStatsRow extends RowDataPacket {
  airport_id: number;
  airport_name: string;
  airport_impressions: number;
  outbound_clicks: number;
  last_clicked_at: unknown;
}

interface AirportPlacementRow extends RowDataPacket {
  airport_id: number;
  placement: MarketingPlacement | null;
  airport_impressions: number;
  outbound_clicks: number;
}

interface AirportTargetRow extends RowDataPacket {
  target_kind: MarketingTargetKind | null;
  outbound_clicks: number;
}

interface TotalClicksRow extends RowDataPacket {
  total_clicks: number;
}

interface AirportNameRow extends RowDataPacket {
  id: number;
  name: string;
}

interface ColumnInfoRow extends RowDataPacket {
  Field: string;
}

interface IndexInfoRow extends RowDataPacket {
  Key_name: string;
}

export class MarketingEventRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS marketing_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        occurred_at DATETIME NOT NULL,
        event_date DATE NOT NULL,
        event_type ENUM('page_view', 'airport_impression', 'outbound_click') NOT NULL,
        page_path VARCHAR(1024) NOT NULL,
        page_kind ENUM('home', 'full_ranking', 'risk_monitor', 'report', 'methodology', 'news', 'apply', 'publish_token_docs') NOT NULL,
        referrer_path VARCHAR(1024) NULL,
        external_referrer_host VARCHAR(255) NULL,
        source_type VARCHAR(64) NOT NULL DEFAULT 'direct_or_unknown',
        source_label VARCHAR(255) NOT NULL DEFAULT 'Direct / Unknown',
        airport_id BIGINT UNSIGNED NULL,
        placement ENUM('home_card', 'full_ranking_item', 'risk_monitor_item', 'report_header') NULL,
        target_kind ENUM('website', 'subscription_url') NULL,
        target_url VARCHAR(2048) NULL,
        utm_source VARCHAR(255) NULL,
        utm_medium VARCHAR(255) NULL,
        utm_campaign VARCHAR(255) NULL,
        utm_content VARCHAR(255) NULL,
        utm_term VARCHAR(255) NULL,
        country_code CHAR(2) NOT NULL DEFAULT 'ZZ',
        country_name VARCHAR(128) NOT NULL DEFAULT 'Unknown',
        visitor_hash CHAR(64) NOT NULL,
        session_hash CHAR(64) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_marketing_events_date_type (event_date, event_type),
        INDEX idx_marketing_events_airport_date_type (airport_id, event_date, event_type),
        INDEX idx_marketing_events_page_kind_date (page_kind, event_date),
        INDEX idx_marketing_events_page_path (page_path(255)),
        INDEX idx_marketing_events_occurred_at (occurred_at),
        INDEX idx_marketing_events_source_label_date (source_label(191), event_date),
        INDEX idx_marketing_events_country_code_date (country_code, event_date)
      )
    `);
    await this.ensureColumnExists('external_referrer_host', 'ALTER TABLE marketing_events ADD COLUMN external_referrer_host VARCHAR(255) NULL AFTER referrer_path');
    await this.ensureColumnExists('source_type', 'ALTER TABLE marketing_events ADD COLUMN source_type VARCHAR(64) NOT NULL DEFAULT \'direct_or_unknown\' AFTER external_referrer_host');
    await this.ensureColumnExists('source_label', 'ALTER TABLE marketing_events ADD COLUMN source_label VARCHAR(255) NOT NULL DEFAULT \'Direct / Unknown\' AFTER source_type');
    await this.ensureColumnExists('utm_source', 'ALTER TABLE marketing_events ADD COLUMN utm_source VARCHAR(255) NULL AFTER target_url');
    await this.ensureColumnExists('utm_medium', 'ALTER TABLE marketing_events ADD COLUMN utm_medium VARCHAR(255) NULL AFTER utm_source');
    await this.ensureColumnExists('utm_campaign', 'ALTER TABLE marketing_events ADD COLUMN utm_campaign VARCHAR(255) NULL AFTER utm_medium');
    await this.ensureColumnExists('utm_content', 'ALTER TABLE marketing_events ADD COLUMN utm_content VARCHAR(255) NULL AFTER utm_campaign');
    await this.ensureColumnExists('utm_term', 'ALTER TABLE marketing_events ADD COLUMN utm_term VARCHAR(255) NULL AFTER utm_content');
    await this.ensureColumnExists('country_code', 'ALTER TABLE marketing_events ADD COLUMN country_code CHAR(2) NOT NULL DEFAULT \'ZZ\' AFTER utm_term');
    await this.ensureColumnExists('country_name', 'ALTER TABLE marketing_events ADD COLUMN country_name VARCHAR(128) NOT NULL DEFAULT \'Unknown\' AFTER country_code');
    await this.ensureIndexExists('idx_marketing_events_source_label_date', 'CREATE INDEX idx_marketing_events_source_label_date ON marketing_events (source_label(191), event_date)');
    await this.ensureIndexExists('idx_marketing_events_country_code_date', 'CREATE INDEX idx_marketing_events_country_code_date ON marketing_events (country_code, event_date)');
  }

  async insertMany(records: MarketingEventInsertRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const params = records.flatMap((record) => [
      record.occurred_at,
      record.event_date,
      record.event_type,
      record.page_path,
      record.page_kind,
      record.referrer_path,
      record.external_referrer_host,
      record.source_type,
      record.source_label,
      record.airport_id,
      record.placement,
      record.target_kind,
      record.target_url,
      record.utm_source,
      record.utm_medium,
      record.utm_campaign,
      record.utm_content,
      record.utm_term,
      record.country_code,
      record.country_name,
      record.visitor_hash,
      record.session_hash,
    ]);

    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO marketing_events (
         occurred_at,
         event_date,
         event_type,
         page_path,
         page_kind,
         referrer_path,
         external_referrer_host,
         source_type,
         source_label,
         airport_id,
         placement,
         target_kind,
         target_url,
         utm_source,
         utm_medium,
         utm_campaign,
         utm_content,
         utm_term,
         country_code,
         country_name,
         visitor_hash,
         session_hash
       ) VALUES ${placeholders}`,
      params,
    );
  }

  async getOverview(query: {
    dateFrom: string;
    dateTo: string;
    granularity: MarketingGranularity;
    sourceLabel?: string;
    countryCode?: string;
  }): Promise<MarketingOverviewView> {
    const filters = buildMarketingFilters('', query);
    const [totalRows] = await this.pool.query<OverviewTotalsRow[]>(
      `SELECT
         SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
         COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) AS unique_visitors,
         SUM(CASE WHEN event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
         SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks
       FROM marketing_events
       ${filters.whereSql}`,
      filters.params,
    );

    const [trendRows, sourceRows, countryRows] = await Promise.all([
      this.pool.query<TrendRow[]>(
      `SELECT
         ${periodSql(query.granularity, trendColumn(query.granularity))} AS period_start,
         SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
         COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) AS unique_visitors,
         SUM(CASE WHEN event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
         SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks
       FROM marketing_events
       ${filters.whereSql}
       GROUP BY period_start
       ORDER BY period_start ASC`,
      filters.params,
    ),
      this.pool.query<SourceBreakdownRow[]>(
        `SELECT
           source_type,
           source_label,
           SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
           COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) AS unique_visitors,
           SUM(CASE WHEN event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
           SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks
         FROM marketing_events
         ${filters.whereSql}
         GROUP BY source_type, source_label
         ORDER BY page_views DESC, unique_visitors DESC, outbound_clicks DESC, source_label ASC`,
        filters.params,
      ),
      this.pool.query<CountryBreakdownRow[]>(
        `SELECT
           country_code,
           country_name,
           SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
           COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) AS unique_visitors,
           SUM(CASE WHEN event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
           SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks
         FROM marketing_events
         ${filters.whereSql}
         GROUP BY country_code, country_name
         ORDER BY page_views DESC, unique_visitors DESC, outbound_clicks DESC, country_name ASC`,
        filters.params,
      ),
    ]);

    const totals = totalRows[0] || {
      page_views: 0,
      unique_visitors: 0,
      airport_impressions: 0,
      outbound_clicks: 0,
    };
    const totalPageViews = Number(totals.page_views || 0);
    const sourceBreakdown = sourceRows[0].map((row) => mapSourceBreakdownRow(row, totalPageViews));
    const countryBreakdown = countryRows[0].map((row) => mapCountryBreakdownRow(row, totalPageViews));

    return {
      date_from: query.dateFrom,
      date_to: query.dateTo,
      granularity: query.granularity,
      totals: {
        page_views: Number(totals.page_views || 0),
        unique_visitors: Number(totals.unique_visitors || 0),
        airport_impressions: Number(totals.airport_impressions || 0),
        outbound_clicks: Number(totals.outbound_clicks || 0),
        ctr: computeCtr(Number(totals.outbound_clicks || 0), Number(totals.airport_impressions || 0)),
      },
      trends: mapTrendRows(trendRows[0], query.granularity, query.dateFrom, query.dateTo),
      source_breakdown: sourceBreakdown,
      country_breakdown: countryBreakdown,
      top_sources: sourceBreakdown.slice(0, 8),
      top_countries: countryBreakdown.slice(0, 8),
      filters: {
        sources: sourceBreakdown.map((item) => ({
          source_type: item.source_type,
          source_label: item.source_label,
        })),
        countries: countryBreakdown.map((item) => ({
          country_code: item.country_code,
          country_name: item.country_name,
        })),
      },
    };
  }

  async getPageStats(query: {
    dateFrom: string;
    dateTo: string;
    sourceLabel?: string;
    countryCode?: string;
  }): Promise<MarketingPageStatsItem[]> {
    const filters = buildMarketingFilters('', query);
    const [rows] = await this.pool.query<PageStatsRow[]>(
      `SELECT
         page_path,
         page_kind,
         SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
         COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) AS unique_visitors,
         SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks,
         MAX(CASE WHEN event_type = 'page_view' THEN occurred_at ELSE NULL END) AS last_visited_at
       FROM marketing_events
       ${filters.whereSql}
       GROUP BY page_path, page_kind
       HAVING page_views > 0 OR outbound_clicks > 0
       ORDER BY page_views DESC, outbound_clicks DESC, page_path ASC`,
      filters.params,
    );

    return rows.map((row) => ({
      page_path: row.page_path,
      page_kind: row.page_kind as MarketingPageStatsItem['page_kind'],
      page_views: Number(row.page_views || 0),
      unique_visitors: Number(row.unique_visitors || 0),
      outbound_clicks: Number(row.outbound_clicks || 0),
      last_visited_at: row.last_visited_at ? formatDateTimeInTimezoneIso(new Date(String(row.last_visited_at))) : null,
    }));
  }

  async getAirportStats(query: {
    dateFrom: string;
    dateTo: string;
    keyword?: string;
    sortBy?: 'ctr' | 'clicks' | 'impressions' | 'last_clicked_at';
    sortOrder?: 'asc' | 'desc';
    sourceLabel?: string;
    countryCode?: string;
  }): Promise<MarketingAirportConversionItem[]> {
    const { clauses, params } = buildMarketingFilterParts('me', query);
    const where = [...clauses, 'me.airport_id IS NOT NULL'];

    if (query.keyword?.trim()) {
      where.push('a.name LIKE ?');
      params.push(`%${query.keyword.trim()}%`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const [rows] = await this.pool.query<AirportStatsRow[]>(
      `SELECT
         me.airport_id,
         COALESCE(a.name, CONCAT('机场 #', me.airport_id)) AS airport_name,
         SUM(CASE WHEN me.event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
         SUM(CASE WHEN me.event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks,
         MAX(CASE WHEN me.event_type = 'outbound_click' THEN me.occurred_at ELSE NULL END) AS last_clicked_at
       FROM marketing_events me
       LEFT JOIN airports a ON a.id = me.airport_id
       ${whereSql}
       GROUP BY me.airport_id, airport_name`,
      params,
    );

    const [placementRows] = await this.pool.query<AirportPlacementRow[]>(
      `SELECT
         me.airport_id,
         me.placement,
         SUM(CASE WHEN me.event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
         SUM(CASE WHEN me.event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks
       FROM marketing_events me
       LEFT JOIN airports a ON a.id = me.airport_id
       ${whereSql}
       GROUP BY me.airport_id, me.placement`,
      params,
    );

    const placementMap = new Map<number, AirportPlacementRow[]>();
    for (const row of placementRows) {
      const airportId = Number(row.airport_id || 0);
      const list = placementMap.get(airportId) || [];
      list.push(row);
      placementMap.set(airportId, list);
    }

    const items = rows.map((row) => {
      const airportId = Number(row.airport_id || 0);
      const placements = placementMap.get(airportId) || [];
      const primaryPlacement = placements
        .slice()
        .sort((left, right) =>
          Number(right.outbound_clicks || 0) - Number(left.outbound_clicks || 0) ||
          Number(right.airport_impressions || 0) - Number(left.airport_impressions || 0) ||
          String(left.placement || '').localeCompare(String(right.placement || '')))
        [0]?.placement || null;

      const airportImpressions = Number(row.airport_impressions || 0);
      const outboundClicks = Number(row.outbound_clicks || 0);

      return {
        airport_id: airportId,
        airport_name: row.airport_name,
        airport_impressions: airportImpressions,
        outbound_clicks: outboundClicks,
        ctr: computeCtr(outboundClicks, airportImpressions),
        primary_placement: primaryPlacement,
        last_clicked_at: row.last_clicked_at ? formatDateTimeInTimezoneIso(new Date(String(row.last_clicked_at))) : null,
      } satisfies MarketingAirportConversionItem;
    });

    const sortBy = query.sortBy || 'ctr';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    return items.sort((left, right) => {
      const comparison = compareAirportItems(left, right, sortBy);
      return comparison === 0
        ? left.airport_name.localeCompare(right.airport_name, 'zh-CN')
        : comparison * sortOrder;
    });
  }

  async getAirportDetail(query: {
    airportId: number;
    dateFrom: string;
    dateTo: string;
    granularity: MarketingGranularity;
    sourceLabel?: string;
    countryCode?: string;
  }): Promise<MarketingAirportDetailView | null> {
    const [airportRows] = await this.pool.query<AirportNameRow[]>(
      'SELECT id, name FROM airports WHERE id = ? LIMIT 1',
      [query.airportId],
    );
    if (airportRows.length === 0) {
      return null;
    }

    const filters = buildMarketingFilters('me', query);
    const eventFilters = buildMarketingFilters('', query);
    const [summaryRows, trendRows, placementRows, targetRows, totalClickRows] = await Promise.all([
      this.pool.query<AirportStatsRow[]>(
        `SELECT
           me.airport_id,
           COALESCE(a.name, CONCAT('机场 #', me.airport_id)) AS airport_name,
           SUM(CASE WHEN me.event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
           SUM(CASE WHEN me.event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks,
           MAX(CASE WHEN me.event_type = 'outbound_click' THEN me.occurred_at ELSE NULL END) AS last_clicked_at
         FROM marketing_events me
         LEFT JOIN airports a ON a.id = me.airport_id
         ${filters.whereSql} AND me.airport_id = ?
         GROUP BY me.airport_id, airport_name`,
        [...filters.params, query.airportId],
      ),
      this.pool.query<TrendRow[]>(
        `SELECT
           ${periodSql(query.granularity, trendColumn(query.granularity))} AS period_start,
           SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
           COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) AS unique_visitors,
           SUM(CASE WHEN event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
           SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks
         FROM marketing_events
         ${eventFilters.whereSql} AND airport_id = ?
         GROUP BY period_start
         ORDER BY period_start ASC`,
        [...eventFilters.params, query.airportId],
      ),
      this.pool.query<AirportPlacementRow[]>(
        `SELECT
           placement,
           SUM(CASE WHEN event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
           SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks
         FROM marketing_events
         ${eventFilters.whereSql} AND airport_id = ?
         GROUP BY placement
         ORDER BY outbound_clicks DESC, airport_impressions DESC, placement ASC`,
        [...eventFilters.params, query.airportId],
      ),
      this.pool.query<AirportTargetRow[]>(
        `SELECT
           target_kind,
           COUNT(*) AS outbound_clicks
         FROM marketing_events
         ${eventFilters.whereSql} AND airport_id = ? AND event_type = 'outbound_click'
         GROUP BY target_kind
         ORDER BY outbound_clicks DESC, target_kind ASC`,
        [...eventFilters.params, query.airportId],
      ),
      this.pool.query<TotalClicksRow[]>(
        `SELECT COUNT(*) AS total_clicks
         FROM marketing_events
         ${eventFilters.whereSql} AND event_type = 'outbound_click'`,
        eventFilters.params,
      ),
    ]);

    const summary = summaryRows[0][0] || {
      airport_id: query.airportId,
      airport_name: airportRows[0].name,
      airport_impressions: 0,
      outbound_clicks: 0,
      last_clicked_at: null,
    };
    const totalSiteClicks = Number(totalClickRows[0][0]?.total_clicks || 0);
    const airportImpressions = Number(summary.airport_impressions || 0);
    const outboundClicks = Number(summary.outbound_clicks || 0);

    return {
      airport_id: query.airportId,
      airport_name: airportRows[0].name,
      date_from: query.dateFrom,
      date_to: query.dateTo,
      granularity: query.granularity,
      summary: {
        airport_impressions: airportImpressions,
        outbound_clicks: outboundClicks,
        ctr: computeCtr(outboundClicks, airportImpressions),
        site_click_share: totalSiteClicks > 0 ? outboundClicks / totalSiteClicks : null,
        last_clicked_at: summary.last_clicked_at ? formatDateTimeInTimezoneIso(new Date(String(summary.last_clicked_at))) : null,
      },
      trends: mapTrendRows(trendRows[0], query.granularity, query.dateFrom, query.dateTo),
      placement_breakdown: placementRows[0].map((row) => {
        const impressions = Number(row.airport_impressions || 0);
        const clicks = Number(row.outbound_clicks || 0);
        return {
          placement: row.placement,
          airport_impressions: impressions,
          outbound_clicks: clicks,
          ctr: computeCtr(clicks, impressions),
        };
      }),
      target_breakdown: targetRows[0].map((row) => ({
        target_kind: row.target_kind,
        outbound_clicks: Number(row.outbound_clicks || 0),
      })),
    };
  }

  private async ensureColumnExists(columnName: string, alterSql: string): Promise<void> {
    const [rows] = await this.pool.query<ColumnInfoRow[]>('SHOW COLUMNS FROM marketing_events LIKE ?', [columnName]);
    if (rows.length === 0) {
      await this.pool.query(alterSql);
    }
  }

  private async ensureIndexExists(indexName: string, createSql: string): Promise<void> {
    const [rows] = await this.pool.query<IndexInfoRow[]>('SHOW INDEX FROM marketing_events WHERE Key_name = ?', [indexName]);
    if (rows.length === 0) {
      await this.pool.query(createSql);
    }
  }
}

function buildMarketingFilters(
  alias: string,
  query: {
    dateFrom: string;
    dateTo: string;
    sourceLabel?: string;
    countryCode?: string;
  },
): {
  whereSql: string;
  params: Array<string | number>;
} {
  const { clauses, params } = buildMarketingFilterParts(alias, query);
  return {
    whereSql: `WHERE ${clauses.join(' AND ')}`,
    params,
  };
}

function buildMarketingFilterParts(
  alias: string,
  query: {
    dateFrom: string;
    dateTo: string;
    sourceLabel?: string;
    countryCode?: string;
  },
): {
  clauses: string[];
  params: Array<string | number>;
} {
  const prefix = alias ? `${alias}.` : '';
  const clauses = [`${prefix}event_date >= ?`, `${prefix}event_date <= ?`];
  const params: Array<string | number> = [query.dateFrom, query.dateTo];

  if (query.sourceLabel?.trim()) {
    clauses.push(`${prefix}source_label = ?`);
    params.push(query.sourceLabel.trim());
  }

  if (query.countryCode?.trim()) {
    clauses.push(`${prefix}country_code = ?`);
    params.push(query.countryCode.trim().toUpperCase());
  }

  return { clauses, params };
}

function trendColumn(granularity: MarketingGranularity): string {
  return granularity === 'hour' ? 'occurred_at' : 'event_date';
}

function periodSql(granularity: MarketingGranularity, columnName: string): string {
  if (granularity === 'hour') {
    return `DATE_FORMAT(${columnName}, '%Y-%m-%d %H:00:00')`;
  }
  if (granularity === 'week') {
    return `DATE_FORMAT(DATE_SUB(${columnName}, INTERVAL WEEKDAY(${columnName}) DAY), '%Y-%m-%d')`;
  }
  if (granularity === 'month') {
    return `DATE_FORMAT(${columnName}, '%Y-%m-01')`;
  }
  return `DATE_FORMAT(${columnName}, '%Y-%m-%d')`;
}

function mapTrendRow(row: TrendRow): MarketingTrendPoint {
  const airportImpressions = Number(row.airport_impressions || 0);
  const outboundClicks = Number(row.outbound_clicks || 0);
  return {
    period_start: normalizeTrendPeriodStart(row.period_start),
    page_views: Number(row.page_views || 0),
    unique_visitors: Number(row.unique_visitors || 0),
    airport_impressions: airportImpressions,
    outbound_clicks: outboundClicks,
    ctr: computeCtr(outboundClicks, airportImpressions),
  };
}

function mapTrendRows(
  rows: TrendRow[],
  granularity: MarketingGranularity,
  dateFrom: string,
  dateTo: string,
): MarketingTrendPoint[] {
  const items = rows.map(mapTrendRow);
  if (granularity !== 'hour' || items.length === 0) {
    return items;
  }

  const itemByPeriod = new Map(items.map((item) => [item.period_start, item]));
  return buildHourlyPeriods(dateFrom, dateTo).map((periodStart) => (
    itemByPeriod.get(periodStart) || {
      period_start: periodStart,
      page_views: 0,
      unique_visitors: 0,
      airport_impressions: 0,
      outbound_clicks: 0,
      ctr: null,
    }
  ));
}

function buildHourlyPeriods(dateFrom: string, dateTo: string): string[] {
  const periods: string[] = [];
  for (let date = dateFrom; date <= dateTo; date = dateDaysAfter(date, 1)) {
    for (let hour = 0; hour < 24; hour += 1) {
      periods.push(`${date} ${String(hour).padStart(2, '0')}:00`);
    }
  }
  return periods;
}

function normalizeTrendPeriodStart(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const hourMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):\d{2}:\d{2}$/);
    if (hourMatch) {
      return `${hourMatch[1]} ${hourMatch[2]}:00`;
    }
  }
  return formatDateOnly(value);
}

function computeCtr(clicks: number, impressions: number): number | null {
  if (impressions <= 0) {
    return null;
  }
  return clicks / impressions;
}

function mapSourceBreakdownRow(row: SourceBreakdownRow, totalPageViews: number): MarketingSourceBreakdownItem {
  const pageViews = Number(row.page_views || 0);
  const airportImpressions = Number(row.airport_impressions || 0);
  const outboundClicks = Number(row.outbound_clicks || 0);
  return {
    source_type: row.source_type,
    source_label: row.source_label,
    page_views: pageViews,
    unique_visitors: Number(row.unique_visitors || 0),
    airport_impressions: airportImpressions,
    outbound_clicks: outboundClicks,
    ctr: computeCtr(outboundClicks, airportImpressions),
    traffic_share: totalPageViews > 0 ? pageViews / totalPageViews : null,
  };
}

function mapCountryBreakdownRow(row: CountryBreakdownRow, totalPageViews: number): MarketingCountryBreakdownItem {
  const pageViews = Number(row.page_views || 0);
  const airportImpressions = Number(row.airport_impressions || 0);
  const outboundClicks = Number(row.outbound_clicks || 0);
  return {
    country_code: row.country_code,
    country_name: row.country_name,
    page_views: pageViews,
    unique_visitors: Number(row.unique_visitors || 0),
    airport_impressions: airportImpressions,
    outbound_clicks: outboundClicks,
    ctr: computeCtr(outboundClicks, airportImpressions),
    traffic_share: totalPageViews > 0 ? pageViews / totalPageViews : null,
  };
}

function compareAirportItems(
  left: MarketingAirportConversionItem,
  right: MarketingAirportConversionItem,
  sortBy: 'ctr' | 'clicks' | 'impressions' | 'last_clicked_at',
): number {
  if (sortBy === 'clicks') {
    return left.outbound_clicks - right.outbound_clicks;
  }
  if (sortBy === 'impressions') {
    return left.airport_impressions - right.airport_impressions;
  }
  if (sortBy === 'last_clicked_at') {
    return dateNumber(left.last_clicked_at) - dateNumber(right.last_clicked_at);
  }
  return ctrNumber(left.ctr) - ctrNumber(right.ctr);
}

function ctrNumber(value: number | null): number {
  return value === null ? -1 : value;
}

function dateNumber(value: string | null): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
