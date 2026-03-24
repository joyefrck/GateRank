import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { DailyMetrics, DailyMetricsInput } from '../types/domain';
import { formatDateOnly } from '../utils/time';

interface DailyMetricsRow extends RowDataPacket {
  airport_id: number;
  date: unknown;
  uptime_percent_30d: number;
  uptime_percent_today: number | null;
  latency_samples_ms: unknown;
  latency_mean_ms: number | null;
  latency_std_ms: number | null;
  latency_cv: number | null;
  download_samples_mbps: unknown;
  median_latency_ms: number;
  median_download_mbps: number;
  packet_loss_percent: number;
  stable_days_streak: number;
  is_stable_day: number | null;
  domain_ok: number;
  ssl_days_left: number | null;
  recent_complaints_count: number;
  history_incidents: number;
}

export class MetricsRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.ensureColumn('uptime_percent_today', 'DECIMAL(5,2) NULL AFTER uptime_percent_30d');
    await this.ensureColumn('latency_mean_ms', 'DECIMAL(8,2) NULL AFTER latency_samples_ms');
    await this.ensureColumn('latency_std_ms', 'DECIMAL(8,2) NULL AFTER latency_mean_ms');
    await this.ensureColumn('latency_cv', 'DECIMAL(10,4) NULL AFTER latency_std_ms');
    await this.ensureColumn('is_stable_day', 'TINYINT(1) NULL AFTER stable_days_streak');
    await this.ensureColumnNullable('ssl_days_left', 'INT NULL DEFAULT NULL');
  }

  async upsertDaily(input: DailyMetricsInput): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airport_metrics_daily (
         airport_id, date, uptime_percent_30d, uptime_percent_today, median_latency_ms, median_download_mbps,
         latency_samples_ms, latency_mean_ms, latency_std_ms, latency_cv, download_samples_mbps,
         packet_loss_percent, stable_days_streak, is_stable_day, domain_ok, ssl_days_left,
         recent_complaints_count, history_incidents
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         uptime_percent_30d = VALUES(uptime_percent_30d),
         uptime_percent_today = VALUES(uptime_percent_today),
         latency_samples_ms = VALUES(latency_samples_ms),
         latency_mean_ms = VALUES(latency_mean_ms),
         latency_std_ms = VALUES(latency_std_ms),
         latency_cv = VALUES(latency_cv),
         download_samples_mbps = VALUES(download_samples_mbps),
         median_latency_ms = VALUES(median_latency_ms),
         median_download_mbps = VALUES(median_download_mbps),
         packet_loss_percent = VALUES(packet_loss_percent),
         stable_days_streak = VALUES(stable_days_streak),
         is_stable_day = VALUES(is_stable_day),
         domain_ok = VALUES(domain_ok),
         ssl_days_left = VALUES(ssl_days_left),
         recent_complaints_count = VALUES(recent_complaints_count),
         history_incidents = VALUES(history_incidents)`,
      [
        input.airport_id,
        input.date,
        input.uptime_percent_30d,
        nullableNumber(input.uptime_percent_today),
        input.median_latency_ms,
        input.median_download_mbps,
        JSON.stringify(input.latency_samples_ms || []),
        nullableNumber(input.latency_mean_ms),
        nullableNumber(input.latency_std_ms),
        nullableNumber(input.latency_cv),
        JSON.stringify(input.download_samples_mbps || []),
        input.packet_loss_percent,
        input.stable_days_streak,
        nullableBoolean(input.is_stable_day),
        input.domain_ok ? 1 : 0,
        nullableNumber(input.ssl_days_left),
        input.recent_complaints_count,
        input.history_incidents,
      ],
    );
  }

  async getByDate(date: string): Promise<DailyMetrics[]> {
    const [rows] = await this.pool.query<DailyMetricsRow[]>(
      `SELECT airport_id, date, uptime_percent_30d, uptime_percent_today, median_latency_ms, median_download_mbps,
              latency_samples_ms, latency_mean_ms, latency_std_ms, latency_cv, download_samples_mbps, packet_loss_percent,
              stable_days_streak, is_stable_day, domain_ok, ssl_days_left,
              recent_complaints_count, history_incidents
         FROM airport_metrics_daily
        WHERE date = ?`,
      [date],
    );

    return rows.map(toDailyMetrics);
  }

  async getByAirportAndDate(airportId: number, date: string): Promise<DailyMetrics | null> {
    const [rows] = await this.pool.query<DailyMetricsRow[]>(
      `SELECT airport_id, date, uptime_percent_30d, uptime_percent_today, median_latency_ms, median_download_mbps,
              latency_samples_ms, latency_mean_ms, latency_std_ms, latency_cv, download_samples_mbps, packet_loss_percent,
              stable_days_streak, is_stable_day, domain_ok, ssl_days_left,
              recent_complaints_count, history_incidents
         FROM airport_metrics_daily
        WHERE airport_id = ? AND date = ?
        LIMIT 1`,
      [airportId, date],
    );

    if (rows.length === 0) {
      return null;
    }

    return toDailyMetrics(rows[0]);
  }

  async getLatestByAirportBeforeDate(airportId: number, date: string): Promise<DailyMetrics | null> {
    const [rows] = await this.pool.query<DailyMetricsRow[]>(
      `SELECT airport_id, date, uptime_percent_30d, uptime_percent_today, median_latency_ms, median_download_mbps,
              latency_samples_ms, latency_mean_ms, latency_std_ms, latency_cv, download_samples_mbps, packet_loss_percent,
              stable_days_streak, is_stable_day, domain_ok, ssl_days_left,
              recent_complaints_count, history_incidents
         FROM airport_metrics_daily
        WHERE airport_id = ? AND date <= ?
        ORDER BY date DESC
        LIMIT 1`,
      [airportId, date],
    );

    if (rows.length === 0) {
      return null;
    }

    return toDailyMetrics(rows[0]);
  }

  async getTrend(airportId: number, startDate: string, endDate: string): Promise<DailyMetrics[]> {
    const [rows] = await this.pool.query<DailyMetricsRow[]>(
      `SELECT airport_id, date, uptime_percent_30d, uptime_percent_today, median_latency_ms, median_download_mbps,
              latency_samples_ms, latency_mean_ms, latency_std_ms, latency_cv, download_samples_mbps, packet_loss_percent,
              stable_days_streak, is_stable_day, domain_ok, ssl_days_left,
              recent_complaints_count, history_incidents
         FROM airport_metrics_daily
        WHERE airport_id = ? AND date >= ? AND date <= ?
        ORDER BY date ASC`,
      [airportId, startDate, endDate],
    );

    return rows.map(toDailyMetrics);
  }

  async patchComplaintCount(
    airportId: number,
    date: string,
    count: number,
    mode: 'set' | 'increment' = 'increment',
  ): Promise<void> {
    const expression = mode === 'set' ? '?' : 'recent_complaints_count + ?';
    await this.pool.execute<ResultSetHeader>(
      `UPDATE airport_metrics_daily
          SET recent_complaints_count = ${expression}
        WHERE airport_id = ? AND date = ?`,
      [count, airportId, date],
    );
  }

  async patchIncidentCount(
    airportId: number,
    date: string,
    count: number,
    mode: 'set' | 'increment' = 'increment',
  ): Promise<void> {
    const expression = mode === 'set' ? '?' : 'history_incidents + ?';
    await this.pool.execute<ResultSetHeader>(
      `UPDATE airport_metrics_daily
          SET history_incidents = ${expression}
        WHERE airport_id = ? AND date = ?`,
      [count, airportId, date],
    );
  }

  private async ensureColumn(columnName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1`,
      ['airport_metrics_daily', columnName],
    );

    if (rows.length === 0) {
      await this.pool.query(
        `ALTER TABLE airport_metrics_daily ADD COLUMN ${columnName} ${definition}`,
      );
    }
  }

  private async ensureColumnNullable(columnName: string, definition: string): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT IS_NULLABLE
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1`,
      ['airport_metrics_daily', columnName],
    );

    if (rows.length === 0) {
      await this.pool.query(
        `ALTER TABLE airport_metrics_daily ADD COLUMN ${columnName} ${definition}`,
      );
      return;
    }

    if (String(rows[0].IS_NULLABLE).toUpperCase() !== 'YES') {
      await this.pool.query(
        `ALTER TABLE airport_metrics_daily MODIFY COLUMN ${columnName} ${definition}`,
      );
    }
  }
}

function toDailyMetrics(row: DailyMetricsRow): DailyMetrics {
  return {
    airport_id: row.airport_id,
    date: formatDateOnly(row.date),
    uptime_percent_30d: Number(row.uptime_percent_30d),
    uptime_percent_today: nullableRowNumber(row.uptime_percent_today),
    latency_samples_ms: safeJsonNumberArray(row.latency_samples_ms),
    latency_mean_ms: nullableRowNumber(row.latency_mean_ms),
    latency_std_ms: nullableRowNumber(row.latency_std_ms),
    latency_cv: nullableRowNumber(row.latency_cv),
    download_samples_mbps: safeJsonNumberArray(row.download_samples_mbps),
    median_latency_ms: Number(row.median_latency_ms),
    median_download_mbps: Number(row.median_download_mbps),
    packet_loss_percent: Number(row.packet_loss_percent),
    stable_days_streak: Number(row.stable_days_streak),
    is_stable_day: nullableRowBoolean(row.is_stable_day),
    domain_ok: !!row.domain_ok,
    ssl_days_left: nullableRowNumber(row.ssl_days_left),
    recent_complaints_count: Number(row.recent_complaints_count),
    history_incidents: Number(row.history_incidents),
  };
}

function safeJsonNumberArray(value: unknown): number[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  }
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  } catch {
    return [];
  }
}

function nullableNumber(value: number | null | undefined): number | null {
  return value === null || value === undefined ? null : value;
}

function nullableBoolean(value: boolean | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value ? 1 : 0;
}

function nullableRowNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function nullableRowBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) {
    return null;
  }
  return Number(value) !== 0;
}
