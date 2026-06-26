import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface HomeStats {
  monitored_airports: number;
  realtime_tests: number;
  latest_data_at: string | null;
}

interface CountRow extends RowDataPacket {
  total: number;
}

interface LatestRow extends RowDataPacket {
  latest_at: string | null;
}

export class StatsRepository {
  constructor(private readonly pool: Pool) {}

  async getHomeStats(date: string): Promise<HomeStats> {
    const [[airportRow], [probeRow], [latestRow]] = await Promise.all([
      this.pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM airports WHERE is_listed = 1'),
      this.pool.query<CountRow[]>('SELECT COUNT(*) AS total FROM airport_probe_samples'),
      this.pool.query<LatestRow[]>(
        `SELECT finished_at AS latest_at
           FROM admin_scheduler_runs
          WHERE task_key = 'aggregate_recompute'
            AND run_date = ?
            AND status = 'succeeded'
            AND finished_at IS NOT NULL
          ORDER BY id DESC
          LIMIT 1`,
        [date],
      ),
    ]);

    return {
      monitored_airports: Number(airportRow[0]?.total || 0),
      realtime_tests: Number(probeRow[0]?.total || 0),
      latest_data_at: latestRow[0]?.latest_at || null,
    };
  }
}
