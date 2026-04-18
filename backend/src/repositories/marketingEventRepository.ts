import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  MarketingAirportConversionItem,
  MarketingAirportDetailView,
  MarketingGranularity,
  MarketingOverviewView,
  MarketingPageStatsItem,
  MarketingPlacement,
  MarketingTargetKind,
  MarketingTrendPoint,
} from '../types/domain';
import type { MarketingEventInsertRecord } from '../utils/marketing';
import { formatDateOnly, formatDateTimeInTimezoneIso } from '../utils/time';

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
        airport_id BIGINT UNSIGNED NULL,
        placement ENUM('home_card', 'full_ranking_item', 'risk_monitor_item', 'report_header') NULL,
        target_kind ENUM('website', 'subscription_url') NULL,
        target_url VARCHAR(2048) NULL,
        visitor_hash CHAR(64) NOT NULL,
        session_hash CHAR(64) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_marketing_events_date_type (event_date, event_type),
        INDEX idx_marketing_events_airport_date_type (airport_id, event_date, event_type),
        INDEX idx_marketing_events_page_kind_date (page_kind, event_date),
        INDEX idx_marketing_events_page_path (page_path(255)),
        INDEX idx_marketing_events_occurred_at (occurred_at)
      )
    `);
  }

  async insertMany(records: MarketingEventInsertRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const placeholders = records.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const params = records.flatMap((record) => [
      record.occurred_at,
      record.event_date,
      record.event_type,
      record.page_path,
      record.page_kind,
      record.referrer_path,
      record.airport_id,
      record.placement,
      record.target_kind,
      record.target_url,
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
         airport_id,
         placement,
         target_kind,
         target_url,
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
  }): Promise<MarketingOverviewView> {
    const [totalRows] = await this.pool.query<OverviewTotalsRow[]>(
      `SELECT
         SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
         COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) AS unique_visitors,
         SUM(CASE WHEN event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
         SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks
       FROM marketing_events
       WHERE event_date >= ? AND event_date <= ?`,
      [query.dateFrom, query.dateTo],
    );

    const [trendRows] = await this.pool.query<TrendRow[]>(
      `SELECT
         ${periodSql(query.granularity, 'event_date')} AS period_start,
         SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
         COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) AS unique_visitors,
         SUM(CASE WHEN event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
         SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks
       FROM marketing_events
       WHERE event_date >= ? AND event_date <= ?
       GROUP BY period_start
       ORDER BY period_start ASC`,
      [query.dateFrom, query.dateTo],
    );

    const totals = totalRows[0] || {
      page_views: 0,
      unique_visitors: 0,
      airport_impressions: 0,
      outbound_clicks: 0,
    };

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
      trends: trendRows.map(mapTrendRow),
    };
  }

  async getPageStats(query: {
    dateFrom: string;
    dateTo: string;
  }): Promise<MarketingPageStatsItem[]> {
    const [rows] = await this.pool.query<PageStatsRow[]>(
      `SELECT
         page_path,
         page_kind,
         SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
         COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) AS unique_visitors,
         SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks,
         MAX(CASE WHEN event_type = 'page_view' THEN occurred_at ELSE NULL END) AS last_visited_at
       FROM marketing_events
       WHERE event_date >= ? AND event_date <= ?
       GROUP BY page_path, page_kind
       HAVING page_views > 0 OR outbound_clicks > 0
       ORDER BY page_views DESC, outbound_clicks DESC, page_path ASC`,
      [query.dateFrom, query.dateTo],
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
  }): Promise<MarketingAirportConversionItem[]> {
    const where = ['me.event_date >= ?', 'me.event_date <= ?', 'me.airport_id IS NOT NULL'];
    const params: Array<string | number> = [query.dateFrom, query.dateTo];

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
  }): Promise<MarketingAirportDetailView | null> {
    const [airportRows] = await this.pool.query<AirportNameRow[]>(
      'SELECT id, name FROM airports WHERE id = ? LIMIT 1',
      [query.airportId],
    );
    if (airportRows.length === 0) {
      return null;
    }

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
         WHERE me.event_date >= ? AND me.event_date <= ? AND me.airport_id = ?
         GROUP BY me.airport_id, airport_name`,
        [query.dateFrom, query.dateTo, query.airportId],
      ),
      this.pool.query<TrendRow[]>(
        `SELECT
           ${periodSql(query.granularity, 'event_date')} AS period_start,
           SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) AS page_views,
           COUNT(DISTINCT CASE WHEN event_type = 'page_view' THEN visitor_hash END) AS unique_visitors,
           SUM(CASE WHEN event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
           SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks
         FROM marketing_events
         WHERE event_date >= ? AND event_date <= ? AND airport_id = ?
         GROUP BY period_start
         ORDER BY period_start ASC`,
        [query.dateFrom, query.dateTo, query.airportId],
      ),
      this.pool.query<AirportPlacementRow[]>(
        `SELECT
           placement,
           SUM(CASE WHEN event_type = 'airport_impression' THEN 1 ELSE 0 END) AS airport_impressions,
           SUM(CASE WHEN event_type = 'outbound_click' THEN 1 ELSE 0 END) AS outbound_clicks
         FROM marketing_events
         WHERE event_date >= ? AND event_date <= ? AND airport_id = ?
         GROUP BY placement
         ORDER BY outbound_clicks DESC, airport_impressions DESC, placement ASC`,
        [query.dateFrom, query.dateTo, query.airportId],
      ),
      this.pool.query<AirportTargetRow[]>(
        `SELECT
           target_kind,
           COUNT(*) AS outbound_clicks
         FROM marketing_events
         WHERE event_date >= ? AND event_date <= ? AND airport_id = ? AND event_type = 'outbound_click'
         GROUP BY target_kind
         ORDER BY outbound_clicks DESC, target_kind ASC`,
        [query.dateFrom, query.dateTo, query.airportId],
      ),
      this.pool.query<TotalClicksRow[]>(
        `SELECT COUNT(*) AS total_clicks
         FROM marketing_events
         WHERE event_date >= ? AND event_date <= ? AND event_type = 'outbound_click'`,
        [query.dateFrom, query.dateTo],
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
      trends: trendRows[0].map(mapTrendRow),
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
}

function periodSql(granularity: MarketingGranularity, columnName: string): string {
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
    period_start: formatDateOnly(row.period_start),
    page_views: Number(row.page_views || 0),
    unique_visitors: Number(row.unique_visitors || 0),
    airport_impressions: airportImpressions,
    outbound_clicks: outboundClicks,
    ctr: computeCtr(outboundClicks, airportImpressions),
  };
}

function computeCtr(clicks: number, impressions: number): number | null {
  if (impressions <= 0) {
    return null;
  }
  return clicks / impressions;
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
