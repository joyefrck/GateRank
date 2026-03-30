import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  SchedulerRun,
  SchedulerRunStatus,
  SchedulerTaskKey,
  SchedulerTriggerSource,
} from '../types/domain';
import { formatDateOnly, formatDateTimeInTimezoneIso } from '../utils/time';

interface SchedulerRunRow extends RowDataPacket {
  id: number;
  task_key: SchedulerTaskKey;
  run_date: unknown;
  trigger_source: SchedulerTriggerSource;
  status: SchedulerRunStatus;
  started_at: unknown;
  finished_at: unknown;
  duration_ms: number | null;
  message: string | null;
  detail_json: unknown;
  created_at: unknown;
}

interface SchedulerDailyStatRow extends RowDataPacket {
  run_date: unknown;
  task_key: SchedulerTaskKey;
  total_runs: number;
  success_count: number;
  failed_count: number;
  total_duration_ms: number | null;
  last_status: SchedulerRunStatus;
  last_started_at: unknown;
  last_finished_at: unknown;
}

export interface SchedulerRunQuery {
  taskKey?: SchedulerTaskKey;
  status?: SchedulerRunStatus;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface SchedulerDailyStat {
  run_date: string;
  task_key: SchedulerTaskKey;
  total_runs: number;
  success_count: number;
  failed_count: number;
  total_duration_ms: number;
  last_status: SchedulerRunStatus;
  last_started_at: string | null;
  last_finished_at: string | null;
}

export class SchedulerRunRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS admin_scheduler_runs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        task_key ENUM('stability', 'performance', 'risk', 'aggregate_recompute') NOT NULL,
        run_date DATE NOT NULL,
        trigger_source ENUM('schedule', 'restart', 'bootstrap_recover') NOT NULL DEFAULT 'schedule',
        status ENUM('running', 'succeeded', 'failed') NOT NULL DEFAULT 'running',
        started_at DATETIME NULL,
        finished_at DATETIME NULL,
        duration_ms INT UNSIGNED NULL,
        message TEXT NULL,
        detail_json JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_admin_scheduler_runs_task_created (task_key, created_at),
        INDEX idx_admin_scheduler_runs_date_task (run_date, task_key),
        INDEX idx_admin_scheduler_runs_status (status)
      )
    `);
  }

  async createRunning(input: {
    taskKey: SchedulerTaskKey;
    runDate: string;
    triggerSource: SchedulerTriggerSource;
    message?: string | null;
    detailJson?: Record<string, unknown> | null;
  }): Promise<SchedulerRun> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `INSERT INTO admin_scheduler_runs
        (task_key, run_date, trigger_source, status, started_at, message, detail_json)
       VALUES (?, ?, ?, 'running', CURRENT_TIMESTAMP, ?, ?)`,
      [input.taskKey, input.runDate, input.triggerSource, input.message || null, toJson(input.detailJson)],
    );
    const created = await this.getById(result.insertId);
    if (!created) {
      throw new Error(`scheduler run ${result.insertId} not found after create`);
    }
    return created;
  }

  async markFinished(input: {
    id: number;
    status: Extract<SchedulerRunStatus, 'succeeded' | 'failed'>;
    durationMs: number;
    message?: string | null;
    detailJson?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `UPDATE admin_scheduler_runs
          SET status = ?,
              finished_at = CURRENT_TIMESTAMP,
              duration_ms = ?,
              message = ?,
              detail_json = ?
        WHERE id = ?`,
      [input.status, input.durationMs, input.message || null, toJson(input.detailJson), input.id],
    );
  }

  async getById(id: number): Promise<SchedulerRun | null> {
    const [rows] = await this.pool.query<SchedulerRunRow[]>(
      `SELECT id, task_key, run_date, trigger_source, status,
              started_at, finished_at, duration_ms, message, detail_json, created_at
         FROM admin_scheduler_runs
        WHERE id = ?
        LIMIT 1`,
      [id],
    );
    return rows[0] ? toSchedulerRun(rows[0]) : null;
  }

  async listLatestByTaskKeys(taskKeys: SchedulerTaskKey[]): Promise<Record<SchedulerTaskKey, SchedulerRun | null>> {
    const result = {
      stability: null,
      performance: null,
      risk: null,
      aggregate_recompute: null,
    } as Record<SchedulerTaskKey, SchedulerRun | null>;

    if (taskKeys.length === 0) {
      return result;
    }

    const placeholders = taskKeys.map(() => '?').join(', ');
    const [rows] = await this.pool.query<SchedulerRunRow[]>(
      `SELECT r.id, r.task_key, r.run_date, r.trigger_source, r.status,
              r.started_at, r.finished_at, r.duration_ms, r.message, r.detail_json, r.created_at
         FROM admin_scheduler_runs r
         JOIN (
           SELECT task_key, MAX(id) AS max_id
             FROM admin_scheduler_runs
            WHERE task_key IN (${placeholders})
            GROUP BY task_key
         ) latest
           ON latest.max_id = r.id`,
      taskKeys,
    );

    for (const row of rows) {
      result[row.task_key] = toSchedulerRun(row);
    }
    return result;
  }

  async listByQuery(query: SchedulerRunQuery): Promise<{ items: SchedulerRun[]; total: number }> {
    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (query.taskKey) {
      conditions.push('task_key = ?');
      params.push(query.taskKey);
    }
    if (query.status) {
      conditions.push('status = ?');
      params.push(query.status);
    }
    if (query.dateFrom) {
      conditions.push('run_date >= ?');
      params.push(query.dateFrom);
    }
    if (query.dateTo) {
      conditions.push('run_date <= ?');
      params.push(query.dateTo);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
    const offset = (page - 1) * pageSize;

    const [countRows] = await this.pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM admin_scheduler_runs ${where}`,
      params,
    );
    const total = Number(countRows[0]?.total || 0);

    const [rows] = await this.pool.query<SchedulerRunRow[]>(
      `SELECT id, task_key, run_date, trigger_source, status,
              started_at, finished_at, duration_ms, message, detail_json, created_at
         FROM admin_scheduler_runs
         ${where}
        ORDER BY id DESC
        LIMIT ?
       OFFSET ?`,
      [...params, pageSize, offset],
    );

    return {
      total,
      items: rows.map(toSchedulerRun),
    };
  }

  async getDailyStats(query: {
    taskKey?: SchedulerTaskKey;
    dateFrom: string;
    dateTo: string;
  }): Promise<SchedulerDailyStat[]> {
    const conditions = ['run_date >= ?', 'run_date <= ?'];
    const params: Array<string | number> = [query.dateFrom, query.dateTo];

    if (query.taskKey) {
      conditions.push('task_key = ?');
      params.push(query.taskKey);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const [rows] = await this.pool.query<SchedulerDailyStatRow[]>(
      `SELECT agg.run_date,
              agg.task_key,
              agg.total_runs,
              agg.success_count,
              agg.failed_count,
              agg.total_duration_ms,
              latest.status AS last_status,
              latest.started_at AS last_started_at,
              latest.finished_at AS last_finished_at
         FROM (
           SELECT run_date,
                  task_key,
                  COUNT(*) AS total_runs,
                  SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS success_count,
                  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
                  COALESCE(SUM(duration_ms), 0) AS total_duration_ms,
                  MAX(id) AS last_run_id
             FROM admin_scheduler_runs
             ${where}
            GROUP BY run_date, task_key
         ) agg
         JOIN admin_scheduler_runs latest
           ON latest.id = agg.last_run_id
        ORDER BY agg.run_date DESC,
                 FIELD(agg.task_key, 'stability', 'performance', 'risk', 'aggregate_recompute')`,
      params,
    );

    return rows.map((row) => ({
      run_date: formatDateOnly(row.run_date),
      task_key: row.task_key,
      total_runs: Number(row.total_runs || 0),
      success_count: Number(row.success_count || 0),
      failed_count: Number(row.failed_count || 0),
      total_duration_ms: Number(row.total_duration_ms || 0),
      last_status: row.last_status,
      last_started_at: toDateTimeString(row.last_started_at),
      last_finished_at: toDateTimeString(row.last_finished_at),
    }));
  }
}

function toSchedulerRun(row: SchedulerRunRow): SchedulerRun {
  return {
    id: row.id,
    task_key: row.task_key,
    run_date: formatDateOnly(row.run_date),
    trigger_source: row.trigger_source,
    status: row.status,
    started_at: toDateTimeString(row.started_at),
    finished_at: toDateTimeString(row.finished_at),
    duration_ms: row.duration_ms === null || row.duration_ms === undefined ? null : Number(row.duration_ms),
    message: row.message,
    detail_json: parseJsonObject(row.detail_json),
    created_at: toDateTimeString(row.created_at) || new Date().toISOString(),
  };
}

function toDateTimeString(value: unknown): string | null {
  if (!value) {
    return null;
  }
  return sqlDateTimeUtcToShanghaiIso(value);
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return { raw: value };
    }
  }
  return null;
}

function toJson(value: Record<string, unknown> | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

function sqlDateTimeUtcToShanghaiIso(value: unknown): string {
  if (value instanceof Date) {
    return formatDateTimeInTimezoneIso(value, 'Asia/Shanghai');
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
    if (match) {
      return formatDateTimeInTimezoneIso(new Date(`${match[1]}T${match[2]}Z`), 'Asia/Shanghai');
    }
  }
  return String(value);
}
