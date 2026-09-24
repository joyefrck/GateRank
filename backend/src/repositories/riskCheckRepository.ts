import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { RiskCheckHistory, RiskCheckRun, WebsiteProbeResult } from '../../../shared/riskCheck';
import type { DailyMetrics } from '../types/domain';

export const RISK_CHECK_SCHEMA = `CREATE TABLE IF NOT EXISTS airport_risk_checks (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  airport_id BIGINT UNSIGNED NOT NULL,
  date DATE NOT NULL,
  applied_to_metrics TINYINT(1) NOT NULL,
  result_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_risk_airport_date (airport_id, date, id),
  KEY idx_risk_applied (airport_id, applied_to_metrics, date, id),
  CONSTRAINT fk_risk_check_airport FOREIGN KEY (airport_id) REFERENCES airports(id) ON DELETE CASCADE
)`;

/** Immutable observations; a metrics update and its evidence always commit together. */
export class RiskCheckRepository {
  constructor(private readonly pool: Pool) {}
  async ensureSchema(): Promise<void> { await this.pool.query(RISK_CHECK_SCHEMA); }

  async save(airportId: number, date: string, result: WebsiteProbeResult, base: DailyMetrics | null): Promise<void> {
    const applied = result.domain_ok !== null;
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      // Serialize concurrent manual/scheduled checks for this airport.
      await connection.query('SELECT id FROM airports WHERE id = ? FOR UPDATE', [airportId]);
      if (applied) {
        await connection.execute(
          `INSERT INTO airport_metrics_daily (
            airport_id, date, uptime_percent_30d, median_latency_ms, median_download_mbps,
            packet_loss_percent, stable_days_streak, recent_complaints_count, history_incidents, domain_ok, ssl_days_left
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE domain_ok = VALUES(domain_ok), ssl_days_left = VALUES(ssl_days_left)`,
          [airportId, date, base?.uptime_percent_30d ?? 0, base?.median_latency_ms ?? 999,
            base?.median_download_mbps ?? 0, base?.packet_loss_percent ?? 100, base?.stable_days_streak ?? 0,
            base?.recent_complaints_count ?? 0, base?.history_incidents ?? 0, result.domain_ok ? 1 : 0, result.ssl_days_left],
        );
      }
      await connection.execute(
        'INSERT INTO airport_risk_checks (airport_id, date, applied_to_metrics, result_json) VALUES (?, ?, ?, ?)',
        [airportId, date, applied ? 1 : 0, JSON.stringify(result)],
      );
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }

  async getHistory(airportId: number, date: string): Promise<RiskCheckHistory> {
    const read = async (applied: boolean): Promise<RiskCheckRun | null> => {
      const [rows] = await this.pool.query<RowDataPacket[]>(
        `SELECT id, DATE_FORMAT(date, '%Y-%m-%d') AS date, applied_to_metrics, result_json
         FROM airport_risk_checks WHERE airport_id = ? AND date <= ? ${applied ? 'AND applied_to_metrics = 1' : ''}
         ORDER BY date DESC, id DESC LIMIT 1`, [airportId, date],
      );
      const row = rows[0];
      if (!row) return null;
      const result = typeof row.result_json === 'string' ? JSON.parse(row.result_json) : row.result_json;
      return { ...result, id: Number(row.id), date: row.date, applied_to_metrics: Boolean(row.applied_to_metrics) };
    };
    const [latest, last_applied] = await Promise.all([read(false), read(true)]);
    return { latest, last_applied };
  }
}
