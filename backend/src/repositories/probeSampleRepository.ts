import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { ProbeSample, ProbeSampleInput, ProbeSampleType, ProbeScope } from '../types/domain';
import { sqlDateTimeToTimezoneIso } from '../utils/time';

interface ProbeSampleRow extends RowDataPacket {
  id: number;
  airport_id: number;
  sampled_at: string;
  sample_type: ProbeSampleType;
  probe_scope: ProbeScope;
  latency_ms: number | null;
  download_mbps: number | null;
  availability: number | null;
  source: string;
}

interface PacketLossRow extends RowDataPacket {
  id: number;
  airport_id: number;
  sampled_at: string;
  probe_scope: ProbeScope;
  packet_loss_percent: number;
  source: string;
}

export class ProbeSampleRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    const probeScopeExists = await this.hasColumn('airport_probe_samples', 'probe_scope');
    if (!probeScopeExists) {
      await this.pool.query(
        "ALTER TABLE airport_probe_samples ADD COLUMN probe_scope ENUM('stability', 'performance') NULL AFTER sample_type",
      );
    }
    await this.pool.query(
      `UPDATE airport_probe_samples
          SET probe_scope = CASE
            WHEN sample_type = 'download' THEN 'performance'
            ELSE 'stability'
          END
        WHERE probe_scope IS NULL`,
    );
    await this.pool.query(
      "ALTER TABLE airport_probe_samples MODIFY COLUMN probe_scope ENUM('stability', 'performance') NOT NULL DEFAULT 'stability'",
    );

    const packetLossScopeExists = await this.hasColumn('airport_packet_loss_samples', 'probe_scope');
    if (!packetLossScopeExists) {
      await this.pool.query(
        "ALTER TABLE airport_packet_loss_samples ADD COLUMN probe_scope ENUM('stability', 'performance') NULL AFTER sampled_at",
      );
    }
    await this.pool.query(
      `UPDATE airport_packet_loss_samples
          SET probe_scope = 'performance'
        WHERE probe_scope IS NULL`,
    );
    await this.pool.query(
      "ALTER TABLE airport_packet_loss_samples MODIFY COLUMN probe_scope ENUM('stability', 'performance') NOT NULL DEFAULT 'performance'",
    );
  }

  async insertProbeSample(input: ProbeSampleInput): Promise<number> {
    const probeScope = input.probe_scope || defaultProbeScope(input.sample_type);
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airport_probe_samples (
         airport_id, sampled_at, sample_type, probe_scope, latency_ms, download_mbps, availability, source
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.airport_id,
        input.sampled_at,
        input.sample_type,
        probeScope,
        input.latency_ms ?? null,
        input.download_mbps ?? null,
        input.availability === undefined ? null : input.availability ? 1 : 0,
        input.source || 'manual',
      ],
    );
    return result.insertId;
  }

  async insertPacketLossSample(input: ProbeSampleInput): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO airport_packet_loss_samples (airport_id, sampled_at, probe_scope, packet_loss_percent, source)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.airport_id,
        input.sampled_at,
        input.probe_scope || 'performance',
        input.packet_loss_percent ?? 0,
        input.source || 'manual',
      ],
    );
    return result.insertId;
  }

  async listProbeSamples(
    airportId: number,
    date: string,
    sampleType?: ProbeSampleType,
    limit?: number,
    probeScope?: ProbeScope,
  ): Promise<ProbeSample[]> {
    const start = `${date} 00:00:00`;
    const end = `${date} 23:59:59`;
    const hasType = Boolean(sampleType);
    const hasLimit = Boolean(limit && limit > 0);
    const hasScope = Boolean(probeScope);
    const [rows] = await this.pool.query<ProbeSampleRow[]>(
      `SELECT id, airport_id, sampled_at, sample_type, probe_scope, latency_ms, download_mbps, availability, source
         FROM airport_probe_samples
        WHERE airport_id = ?
          AND sampled_at >= ?
          AND sampled_at <= ?
          ${hasType ? 'AND sample_type = ?' : ''}
          ${hasScope ? 'AND probe_scope = ?' : ''}
        ORDER BY sampled_at DESC
          ${hasLimit ? 'LIMIT ?' : ''}`,
      buildListParams({ airportId, start, end, sampleType, probeScope, limit }),
    );

    return rows.map((row) => toProbeSample(row));
  }

  async getProbeSamplesInRange(
    airportId: number,
    startDate: string,
    endDate: string,
  ): Promise<ProbeSample[]> {
    const [rows] = await this.pool.query<ProbeSampleRow[]>(
      `SELECT id, airport_id, sampled_at, sample_type, probe_scope, latency_ms, download_mbps, availability, source
         FROM airport_probe_samples
        WHERE airport_id = ?
          AND sampled_at >= ?
          AND sampled_at <= ?
        ORDER BY sampled_at ASC`,
      [airportId, `${startDate} 00:00:00`, `${endDate} 23:59:59`],
    );

    return rows.map((row) => toProbeSample(row));
  }

  async getPacketLossSamplesByDate(
    airportId: number,
    date: string,
    probeScope: ProbeScope = 'performance',
  ): Promise<number[]> {
    const [rows] = await this.pool.query<PacketLossRow[]>(
      `SELECT id, airport_id, sampled_at, probe_scope, packet_loss_percent, source
         FROM airport_packet_loss_samples
        WHERE airport_id = ?
          AND probe_scope = ?
          AND sampled_at >= ?
          AND sampled_at <= ?
        ORDER BY sampled_at ASC`,
      [airportId, probeScope, `${date} 00:00:00`, `${date} 23:59:59`],
    );

    return rows.map((row) => Number(row.packet_loss_percent));
  }

  async listLatestProbeSamples(
    airportId: number,
    limit: number,
    sampleType?: ProbeSampleType,
    probeScope?: ProbeScope,
  ): Promise<ProbeSample[]> {
    const hasType = Boolean(sampleType);
    const hasScope = Boolean(probeScope);
    const [rows] = await this.pool.query<ProbeSampleRow[]>(
      `SELECT id, airport_id, sampled_at, sample_type, probe_scope, latency_ms, download_mbps, availability, source
         FROM airport_probe_samples
        WHERE airport_id = ?
          ${hasType ? 'AND sample_type = ?' : ''}
          ${hasScope ? 'AND probe_scope = ?' : ''}
        ORDER BY sampled_at DESC, id DESC
        LIMIT ?`,
      buildLatestParams({ airportId, sampleType, probeScope, limit }),
    );

    return rows.map((row) => toProbeSample(row));
  }

  private async hasColumn(tableName: string, columnName: string): Promise<boolean> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT 1
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
        LIMIT 1`,
      [tableName, columnName],
    );

    return rows.length > 0;
  }
}

function toProbeSample(row: ProbeSampleRow): ProbeSample {
  return {
    id: row.id,
    airport_id: row.airport_id,
    sampled_at: toIso(row.sampled_at),
    sample_type: row.sample_type,
    probe_scope: row.probe_scope,
    latency_ms: row.latency_ms === null ? null : Number(row.latency_ms),
    download_mbps: row.download_mbps === null ? null : Number(row.download_mbps),
    availability: row.availability === null ? null : Boolean(row.availability),
    source: row.source,
  };
}

function buildListParams(input: {
  airportId: number;
  start: string;
  end: string;
  sampleType?: ProbeSampleType;
  probeScope?: ProbeScope;
  limit?: number;
}): Array<string | number> {
  const values: Array<string | number> = [input.airportId, input.start, input.end];
  if (input.sampleType) {
    values.push(input.sampleType);
  }
  if (input.probeScope) {
    values.push(input.probeScope);
  }
  if (input.limit && input.limit > 0) {
    values.push(input.limit);
  }
  return values;
}

function buildLatestParams(input: {
  airportId: number;
  sampleType?: ProbeSampleType;
  probeScope?: ProbeScope;
  limit: number;
}): Array<string | number> {
  const values: Array<string | number> = [input.airportId];
  if (input.sampleType) {
    values.push(input.sampleType);
  }
  if (input.probeScope) {
    values.push(input.probeScope);
  }
  values.push(input.limit);
  return values;
}

function defaultProbeScope(sampleType: ProbeSampleType): ProbeScope {
  if (sampleType === 'download') {
    return 'performance';
  }
  return 'stability';
}

function toIso(input: string): string {
  return sqlDateTimeToTimezoneIso(input);
}
