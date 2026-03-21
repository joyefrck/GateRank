import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { DailyMetrics, DailyMetricsInput } from '../types/domain';

interface DailyMetricsRow extends RowDataPacket {
  airport_id: number;
  date: string;
  uptime_percent_30d: number;
  median_latency_ms: number;
  median_download_mbps: number;
  packet_loss_percent: number;
  stable_days_streak: number;
  domain_ok: number;
  ssl_days_left: number;
  recent_complaints_count: number;
  history_incidents: number;
}

export class MetricsRepository {
  constructor(private readonly pool: Pool) {}

  async upsertDaily(input: DailyMetricsInput): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airport_metrics_daily (
         airport_id, date, uptime_percent_30d, median_latency_ms, median_download_mbps,
         packet_loss_percent, stable_days_streak, domain_ok, ssl_days_left,
         recent_complaints_count, history_incidents
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         uptime_percent_30d = VALUES(uptime_percent_30d),
         median_latency_ms = VALUES(median_latency_ms),
         median_download_mbps = VALUES(median_download_mbps),
         packet_loss_percent = VALUES(packet_loss_percent),
         stable_days_streak = VALUES(stable_days_streak),
         domain_ok = VALUES(domain_ok),
         ssl_days_left = VALUES(ssl_days_left),
         recent_complaints_count = VALUES(recent_complaints_count),
         history_incidents = VALUES(history_incidents)`,
      [
        input.airport_id,
        input.date,
        input.uptime_percent_30d,
        input.median_latency_ms,
        input.median_download_mbps,
        input.packet_loss_percent,
        input.stable_days_streak,
        input.domain_ok ? 1 : 0,
        input.ssl_days_left,
        input.recent_complaints_count,
        input.history_incidents,
      ],
    );
  }

  async getByDate(date: string): Promise<DailyMetrics[]> {
    const [rows] = await this.pool.query<DailyMetricsRow[]>(
      `SELECT airport_id, date, uptime_percent_30d, median_latency_ms, median_download_mbps,
              packet_loss_percent, stable_days_streak, domain_ok, ssl_days_left,
              recent_complaints_count, history_incidents
         FROM airport_metrics_daily
        WHERE date = ?`,
      [date],
    );

    return rows.map((row) => ({
      airport_id: row.airport_id,
      date: row.date,
      uptime_percent_30d: Number(row.uptime_percent_30d),
      median_latency_ms: Number(row.median_latency_ms),
      median_download_mbps: Number(row.median_download_mbps),
      packet_loss_percent: Number(row.packet_loss_percent),
      stable_days_streak: Number(row.stable_days_streak),
      domain_ok: !!row.domain_ok,
      ssl_days_left: Number(row.ssl_days_left),
      recent_complaints_count: Number(row.recent_complaints_count),
      history_incidents: Number(row.history_incidents),
    }));
  }

  async getByAirportAndDate(airportId: number, date: string): Promise<DailyMetrics | null> {
    const [rows] = await this.pool.query<DailyMetricsRow[]>(
      `SELECT airport_id, date, uptime_percent_30d, median_latency_ms, median_download_mbps,
              packet_loss_percent, stable_days_streak, domain_ok, ssl_days_left,
              recent_complaints_count, history_incidents
         FROM airport_metrics_daily
        WHERE airport_id = ? AND date = ?
        LIMIT 1`,
      [airportId, date],
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      airport_id: row.airport_id,
      date: row.date,
      uptime_percent_30d: Number(row.uptime_percent_30d),
      median_latency_ms: Number(row.median_latency_ms),
      median_download_mbps: Number(row.median_download_mbps),
      packet_loss_percent: Number(row.packet_loss_percent),
      stable_days_streak: Number(row.stable_days_streak),
      domain_ok: !!row.domain_ok,
      ssl_days_left: Number(row.ssl_days_left),
      recent_complaints_count: Number(row.recent_complaints_count),
      history_incidents: Number(row.history_incidents),
    };
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
}
