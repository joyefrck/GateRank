import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { SchedulerTask, SchedulerTaskKey } from '../types/domain';
import { formatDateTimeInTimezoneIso } from '../utils/time';

interface SchedulerTaskRow extends RowDataPacket {
  task_key: SchedulerTaskKey;
  name: string;
  enabled: number;
  schedule_time: string;
  timezone: string;
  last_restarted_at: unknown;
  last_restarted_by: string | null;
  updated_by: string;
  created_at: unknown;
  updated_at: unknown;
}

const DEFAULT_TASKS: Array<Pick<SchedulerTask, 'task_key' | 'name' | 'schedule_time'>> = [
  { task_key: 'stability', name: '稳定性采集', schedule_time: '00:00' },
  { task_key: 'performance', name: '性能采集', schedule_time: '00:10' },
  { task_key: 'risk', name: '风险体检', schedule_time: '00:20' },
  { task_key: 'aggregate_recompute', name: '聚合重算', schedule_time: '00:30' },
];

export class SchedulerTaskRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS admin_scheduler_tasks (
        task_key ENUM('stability', 'performance', 'risk', 'aggregate_recompute') NOT NULL,
        name VARCHAR(128) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        schedule_time CHAR(5) NOT NULL,
        timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
        last_restarted_at DATETIME NULL,
        last_restarted_by VARCHAR(128) NULL,
        updated_by VARCHAR(128) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (task_key)
      )
    `);

    const enabledByDefault = isEnabledByDefault() ? 1 : 0;
    for (const task of DEFAULT_TASKS) {
      await this.pool.execute<ResultSetHeader>(
        `INSERT IGNORE INTO admin_scheduler_tasks
          (task_key, name, enabled, schedule_time, timezone, updated_by)
         VALUES (?, ?, ?, ?, 'Asia/Shanghai', 'system')`,
        [task.task_key, task.name, enabledByDefault, task.schedule_time],
      );
    }
  }

  async listAll(): Promise<SchedulerTask[]> {
    const [rows] = await this.pool.query<SchedulerTaskRow[]>(
      `SELECT task_key, name, enabled, schedule_time, timezone,
              last_restarted_at, last_restarted_by, updated_by, created_at, updated_at
         FROM admin_scheduler_tasks
        ORDER BY FIELD(task_key, 'stability', 'performance', 'risk', 'aggregate_recompute')`,
    );
    return rows.map(toSchedulerTask);
  }

  async getByKey(taskKey: SchedulerTaskKey): Promise<SchedulerTask | null> {
    const [rows] = await this.pool.query<SchedulerTaskRow[]>(
      `SELECT task_key, name, enabled, schedule_time, timezone,
              last_restarted_at, last_restarted_by, updated_by, created_at, updated_at
         FROM admin_scheduler_tasks
        WHERE task_key = ?
        LIMIT 1`,
      [taskKey],
    );
    return rows[0] ? toSchedulerTask(rows[0]) : null;
  }

  async update(
    taskKey: SchedulerTaskKey,
    patch: {
      enabled?: boolean;
      schedule_time?: string;
      updated_by: string;
    },
  ): Promise<void> {
    const fields: string[] = [];
    const values: Array<string | number> = [];

    if (patch.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(patch.enabled ? 1 : 0);
    }
    if (patch.schedule_time !== undefined) {
      fields.push('schedule_time = ?');
      values.push(patch.schedule_time);
    }
    fields.push('updated_by = ?');
    values.push(patch.updated_by);

    values.push(taskKey);
    await this.pool.execute<ResultSetHeader>(
      `UPDATE admin_scheduler_tasks
          SET ${fields.join(', ')}
        WHERE task_key = ?`,
      values,
    );
  }

  async markRestarted(taskKey: SchedulerTaskKey, actor: string): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `UPDATE admin_scheduler_tasks
          SET last_restarted_at = CURRENT_TIMESTAMP,
              last_restarted_by = ?,
              updated_by = ?
        WHERE task_key = ?`,
      [actor, actor, taskKey],
    );
  }
}

function toSchedulerTask(row: SchedulerTaskRow): SchedulerTask {
  return {
    task_key: row.task_key,
    name: row.name,
    enabled: Boolean(row.enabled),
    schedule_time: row.schedule_time,
    timezone: row.timezone,
    last_restarted_at: toDateTimeString(row.last_restarted_at),
    last_restarted_by: row.last_restarted_by,
    updated_by: row.updated_by,
    created_at: toDateTimeString(row.created_at) || new Date().toISOString(),
    updated_at: toDateTimeString(row.updated_at) || new Date().toISOString(),
  };
}

function toDateTimeString(value: unknown): string | null {
  if (!value) {
    return null;
  }
  return sqlDateTimeUtcToShanghaiIso(value);
}

function isEnabledByDefault(): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.NIGHTLY_PIPELINE_ENABLED || '0').trim().toLowerCase());
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
