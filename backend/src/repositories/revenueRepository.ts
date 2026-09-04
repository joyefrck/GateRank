import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { RevenueQuery, RevenueGroup, RevenueTotals, RevenueTransaction, RevenuePage } from '../../../shared/revenue';

// Only persisted successful gateway orders and actual business debits enter this relation.
// Never join paid application flags or sum wallet credit/adjustment rows.
export function revenueSource(query: RevenueQuery, missingTime = false): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const time = (column: string) => {
    if (missingTime) return `${column} IS NULL`;
    params.push(`${query.date_from} 00:00:00`, `${query.date_to} 00:00:00`);
    return `${column} >= ? AND ${column} < DATE_ADD(?, INTERVAL 1 DAY)`;
  };
  const sources = [`SELECT CONCAT('application:', o.id) id, a.approved_airport_id airport_id,
      o.application_id, NULL account_id, a.name fallback_name, 'application' kind,
      CAST(ROUND(o.amount * 100) AS SIGNED) amount_cents, o.paid_at occurred_at,
      o.out_trade_no reference, o.channel, NULL placement
    FROM application_payment_orders o LEFT JOIN airport_applications a ON a.id = o.application_id
    WHERE o.status = 'paid' AND o.amount > 0 AND ${time('o.paid_at')}`];
  if (query.view === 'receipts') {
    sources.push(`SELECT CONCAT('recharge:', o.id) id, COALESCE(w.airport_id, a.approved_airport_id) airport_id,
      w.application_id, o.applicant_account_id account_id, a.name fallback_name, 'recharge' kind, CAST(ROUND(o.amount * 100) AS SIGNED) amount_cents,
      o.paid_at occurred_at, o.out_trade_no reference, o.channel, NULL placement
      FROM applicant_recharge_orders o LEFT JOIN applicant_wallets w ON w.applicant_account_id = o.applicant_account_id
      LEFT JOIN airport_applications a ON a.id = w.application_id
      WHERE o.status = 'paid' AND o.amount > 0 AND ${time('o.paid_at')}`);
  } else if (!missingTime) {
    sources.push(`SELECT CONCAT('wallet:', t.id) id, COALESCE(t.airport_id, a.approved_airport_id, w.airport_id) airport_id,
      t.application_id, t.applicant_account_id account_id, a.name fallback_name,
      CASE WHEN t.transaction_type = 'click_charge' THEN 'click' ELSE 'advertising' END kind,
      CAST(ROUND(-t.amount * 100) AS SIGNED) amount_cents, t.created_at occurred_at, CAST(t.id AS CHAR) reference, NULL channel,
      CASE WHEN t.transaction_type = 'click_charge' THEN COALESCE(c.placement, 'unknown') ELSE NULL END placement
      FROM applicant_wallet_transactions t LEFT JOIN airport_applications a ON a.id = t.application_id
      LEFT JOIN applicant_wallets w ON w.id = t.wallet_id
      LEFT JOIN outbound_click_records c ON t.reference_type = 'outbound_click' AND c.click_id = t.reference_id
      WHERE t.transaction_type IN ('click_charge', 'ad_campaign_charge') AND t.amount < 0
        AND (t.transaction_type != 'click_charge' OR c.click_id IS NULL OR c.billing_status = 'billed')
        AND ${time('t.created_at')}`);
  }
  // Older tables and connection literals can use different utf8mb4 collations.
  const normalizedSources = sources.map(sql => `SELECT
    ${['id', 'airport_id', 'application_id', 'account_id', 'fallback_name', 'kind', 'amount_cents', 'occurred_at', 'reference', 'channel', 'placement'].map(column =>
      ['id', 'fallback_name', 'kind', 'reference', 'channel', 'placement'].includes(column)
        ? `CONVERT(${column} USING utf8mb4) COLLATE utf8mb4_unicode_ci AS ${column}` : column).join(', ')}
    FROM (${sql}) source`);
  const relation = `SELECT r.*, CASE WHEN r.airport_id IS NOT NULL THEN CONCAT('airport:', r.airport_id)
      WHEN r.application_id IS NOT NULL THEN CONCAT('application:', r.application_id)
      ELSE CONCAT('account:', r.account_id) END entity_key,
      COALESCE(p.name, IF(r.airport_id IS NOT NULL, CONCAT(COALESCE(r.fallback_name, '机场'), '（历史机场 #', r.airport_id, '）'),
        CONCAT(COALESCE(r.fallback_name, CONCAT('申请 #', r.application_id), CONCAT('账户 #', r.account_id)), '（未关联机场）'))) name
    FROM (${normalizedSources.join(' UNION ALL ')}) r LEFT JOIN airports p ON p.id = r.airport_id`;
  if (query.entity) params.push(query.entity);
  return { sql: `SELECT * FROM (${relation}) identified${query.entity ? ' WHERE entity_key = ?' : ''}`, params };
}
const totalsSql = `COALESCE(SUM(amount_cents), 0) amount_cents,
  COALESCE(SUM(IF(kind = 'application', amount_cents, 0)), 0) application_cents,
  COALESCE(SUM(IF(kind = 'recharge', amount_cents, 0)), 0) recharge_cents,
  COALESCE(SUM(IF(kind = 'click', amount_cents, 0)), 0) click_cents,
  COALESCE(SUM(IF(kind = 'advertising', amount_cents, 0)), 0) advertising_cents,
  COUNT(*) record_count, COALESCE(SUM(kind = 'click'), 0) click_count,
  COALESCE(SUM(kind = 'advertising'), 0) advertising_count, COUNT(DISTINCT entity_key) entity_count`;
function numeric<T>(row: RowDataPacket): T {
  const result = { ...row };
  for (const key of Object.keys(result)) if (key.endsWith('_cents') || key.endsWith('_count')) result[key] = Number(result[key]);
  return result as T;
}
export class RevenueReader {
  constructor(private readonly connection: PoolConnection) {}
  async totals(query: RevenueQuery): Promise<RevenueTotals> {
    const source = revenueSource(query);
    const [rows] = await this.connection.query<RowDataPacket[]>(`SELECT ${totalsSql} FROM (${source.sql}) facts`, source.params);
    return numeric(rows[0]);
  }
  async groups(query: RevenueQuery, dimension: 'entity' | 'period' | 'kind' | 'channel' | 'placement', page?: { limit: number; offset: number }): Promise<RevenueGroup[]> {
    const source = revenueSource(query);
    const period = query.granularity === 'month' ? "DATE_FORMAT(occurred_at, '%Y-%m-01')"
      : query.granularity === 'week' ? "DATE_FORMAT(DATE_SUB(occurred_at, INTERVAL WEEKDAY(occurred_at) DAY), '%Y-%m-%d')" : "DATE_FORMAT(occurred_at, '%Y-%m-%d')";
    const key = dimension === 'entity' ? 'entity_key' : dimension === 'period' ? period : dimension === 'channel' ? "COALESCE(channel, 'unknown')" : dimension;
    const label = dimension === 'entity' ? 'MAX(name)' : key;
    const sort = query.sort === 'name' ? 'name' : query.sort === 'time' ? (dimension === 'period' ? '`key`' : 'MAX(occurred_at)') : 'amount_cents';
    const [rows] = await this.connection.query<RowDataPacket[]>(`SELECT ${key} AS \`key\`, ${label} name, ${totalsSql}
      FROM (${source.sql}) facts ${dimension === 'placement' ? "WHERE kind = 'click'" : ''} GROUP BY ${key}
      ORDER BY ${sort} ${query.order === 'asc' ? 'ASC' : 'DESC'}, \`key\` ASC ${page ? 'LIMIT ? OFFSET ?' : ''}`,
    [...source.params, ...(page ? [page.limit, page.offset] : [])]);
    return rows.map(row => numeric<RevenueGroup>(row));
  }
  async transactions(query: RevenueQuery): Promise<RevenuePage<RevenueTransaction>> {
    const source = revenueSource(query);
    const [counts] = await this.connection.query<RowDataPacket[]>(`SELECT COUNT(*) total FROM (${source.sql}) facts`, source.params);
    const total = Number(counts[0].total);
    const page = Math.min(query.page, Math.max(1, Math.ceil(total / query.page_size)));
    const sort = query.sort === 'name' ? 'name' : query.sort === 'amount' ? 'amount_cents' : 'occurred_at';
    const [rows] = await this.connection.query<RowDataPacket[]>(`SELECT id, entity_key, name, kind, amount_cents,
      DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s+08:00') occurred_at, reference, channel
      FROM (${source.sql}) facts ORDER BY ${sort} ${query.order === 'asc' ? 'ASC' : 'DESC'}, id DESC LIMIT ? OFFSET ?`,
    [...source.params, query.page_size, (page - 1) * query.page_size]);
    return { items: rows.map(row => numeric<RevenueTransaction>(row)), total, page, page_size: query.page_size };
  }
  async missingTimes(query: RevenueQuery): Promise<number> {
    const source = revenueSource(query, true);
    const [rows] = await this.connection.query<RowDataPacket[]>(`SELECT COUNT(*) total FROM (${source.sql}) facts`, source.params);
    return Number(rows[0].total);
  }
}
export class RevenueRepository {
  constructor(private readonly pool: Pool) {}
  async snapshot<T>(read: (reader: RevenueReader) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try {
      await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
      await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
      const result = await read(new RevenueReader(connection));
      await connection.commit(); return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async ensureSchema(): Promise<void> {
    const indexes = [
      ['application_payment_orders', 'idx_revenue_application_paid', 'status, paid_at'],
      ['applicant_recharge_orders', 'idx_revenue_recharge_paid', 'status, paid_at'],
      ['applicant_wallet_transactions', 'idx_revenue_transaction_date', 'transaction_type, created_at'],
    ];
    for (const [table, name, columns] of indexes) {
      const [rows] = await this.pool.query<RowDataPacket[]>('SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1', [table, name]);
      if (!rows.length) {
        try { await this.pool.query(`ALTER TABLE ${table} ADD INDEX ${name} (${columns})`); }
        catch (error) { if ((error as { code?: string }).code !== 'ER_DUP_KEYNAME') throw error; }
      }
    }
  }
}
