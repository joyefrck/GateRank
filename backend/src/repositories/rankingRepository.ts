import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { RankingItem, RankingType } from '../types/domain';

interface RankingRow extends RowDataPacket {
  rank_no: number;
  airport_id: number;
  score: number;
  details_json: string;
  name: string;
  status: 'normal' | 'risk' | 'down';
  tags_json: string | null;
}

export class RankingRepository {
  constructor(private readonly pool: Pool) {}

  async replaceForDate(
    date: string,
    listType: RankingType,
    rows: Array<{ airport_id: number; rank: number; score: number; details: Record<string, unknown> }>,
  ): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `DELETE FROM airport_rankings_daily WHERE date = ? AND list_type = ?`,
      [date, listType],
    );

    if (rows.length === 0) {
      return;
    }

    const values = rows
      .map(() => '(?, ?, ?, ?, ?, ?)')
      .join(', ');

    const flat: Array<string | number> = [];
    for (const row of rows) {
      flat.push(row.airport_id, date, listType, row.rank, row.score, JSON.stringify(row.details));
    }

    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airport_rankings_daily (airport_id, date, list_type, rank_no, score, details_json)
       VALUES ${values}`,
      flat,
    );
  }

  async getRanking(date: string, listType: RankingType): Promise<RankingItem[]> {
    const [rows] = await this.pool.query<RankingRow[]>(
      `SELECT r.rank_no, r.airport_id, r.score, r.details_json,
              a.name, a.status, a.tags_json
         FROM airport_rankings_daily r
         JOIN airports a ON a.id = r.airport_id
        WHERE r.date = ? AND r.list_type = ?
        ORDER BY r.rank_no ASC`,
      [date, listType],
    );

    return rows.map((row) => {
      const details = safeJson(row.details_json);
      return {
        airport_id: row.airport_id,
        rank: row.rank_no,
        name: row.name,
        status: row.status,
        tags: safeJsonArray(row.tags_json),
        score: Number(row.score),
        key_metrics: {
          uptime_percent_30d: Number(details.uptime_percent_30d || 0),
          median_latency_ms: Number(details.median_latency_ms || 0),
          median_download_mbps: Number(details.median_download_mbps || 0),
          packet_loss_percent: Number(details.packet_loss_percent || 0),
        },
      };
    });
  }
}

function safeJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function safeJsonArray(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
