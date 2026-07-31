import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export interface NewsPublicationTimeRepairEntry {
  id: number;
  expected_published_at: string;
  published_at: string;
  expected_updated_at: string;
  updated_at: string;
  source: string;
  allow_before_created_at?: boolean;
  justification?: string;
}

export interface NewsPublicationTimeRepairConflict {
  id: number;
  field: 'missing' | 'published_at' | 'updated_at';
}

export interface NewsPublicationTimeRepairReport {
  ready: boolean;
  checked: number;
  updated: number;
  conflicts: NewsPublicationTimeRepairConflict[];
  backup_table?: string;
}

interface CurrentNewsPublicationRow extends RowDataPacket {
  id: number;
  created_at: string;
  published_at: string | null;
  updated_at: string;
}

interface CountRow extends RowDataPacket {
  total: number;
}

const SQL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const RUN_ID_PATTERN = /^\d{8}T\d{6}$/;

export class NewsPublicationTimeRepairService {
  constructor(
    private readonly pool: Pick<Pool, 'getConnection'>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async dryRun(entries: NewsPublicationTimeRepairEntry[]): Promise<NewsPublicationTimeRepairReport> {
    this.validateEntries(entries);
    const connection = await this.pool.getConnection();
    try {
      const rows = await this.selectCurrentRows(connection, entries.map((entry) => entry.id));
      const rowsById = new Map(rows.map((row) => [Number(row.id), row]));
      const conflicts: NewsPublicationTimeRepairConflict[] = [];
      const validationErrors: string[] = [];

      for (const entry of entries) {
        const row = rowsById.get(entry.id);
        if (!row) {
          conflicts.push({ id: entry.id, field: 'missing' });
          continue;
        }
        if (row.published_at !== entry.expected_published_at) {
          conflicts.push({ id: entry.id, field: 'published_at' });
        }
        if (row.updated_at !== entry.expected_updated_at) {
          conflicts.push({ id: entry.id, field: 'updated_at' });
        }
        if (toShanghaiTimestamp(entry.published_at) < toShanghaiTimestamp(row.created_at)) {
          if (entry.allow_before_created_at !== true || !entry.justification?.trim()) {
            validationErrors.push(
              `article ${entry.id} requires allow_before_created_at=true and a non-empty justification`,
            );
          }
        }
      }

      if (validationErrors.length > 0) {
        throw invalidMappingError(validationErrors);
      }

      return {
        ready: conflicts.length === 0,
        checked: entries.length,
        updated: 0,
        conflicts,
      };
    } finally {
      connection.release();
    }
  }

  async apply(
    entries: NewsPublicationTimeRepairEntry[],
    runId: string,
  ): Promise<NewsPublicationTimeRepairReport> {
    const backupTable = getBackupTableName(runId);
    const dryRunReport = await this.dryRun(entries);
    if (!dryRunReport.ready) {
      throw new Error(`repair mapping conflicts: ${JSON.stringify(dryRunReport.conflicts)}`);
    }

    const connection = await this.pool.getConnection();
    let transactionStarted = false;
    try {
      const ids = entries.map((entry) => entry.id);
      const placeholders = ids.map(() => '?').join(', ');
      await connection.query(`CREATE TABLE ${backupTable} LIKE news_articles`);
      await connection.query(
        `INSERT INTO ${backupTable}
         SELECT * FROM news_articles WHERE id IN (${placeholders})`,
        ids,
      );
      await this.requireBackupRowCount(connection, backupTable, ids);

      await connection.beginTransaction();
      transactionStarted = true;
      for (const entry of entries) {
        const [result] = await connection.execute<ResultSetHeader>(
          `UPDATE news_articles
              SET published_at = ?, updated_at = ?
            WHERE id = ? AND published_at = ? AND updated_at = ?`,
          [
            entry.published_at,
            entry.updated_at,
            entry.id,
            entry.expected_published_at,
            entry.expected_updated_at,
          ],
        );
        if (result.affectedRows !== 1) {
          throw new Error(`row count mismatch for article ${entry.id}`);
        }
      }
      await connection.commit();
      transactionStarted = false;
      return {
        ready: true,
        checked: entries.length,
        updated: entries.length,
        conflicts: [],
        backup_table: backupTable,
      };
    } catch (error) {
      if (transactionStarted) {
        await connection.rollback();
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async rollback(
    entries: NewsPublicationTimeRepairEntry[],
    runId: string,
  ): Promise<NewsPublicationTimeRepairReport> {
    this.validateEntries(entries);
    const backupTable = getBackupTableName(runId);
    const connection = await this.pool.getConnection();
    let transactionStarted = false;
    try {
      const ids = entries.map((entry) => entry.id);
      await this.requireBackupRowCount(connection, backupTable, ids);
      await connection.beginTransaction();
      transactionStarted = true;

      for (const entry of entries) {
        const [result] = await connection.execute<ResultSetHeader>(
          `UPDATE news_articles a
            INNER JOIN ${backupTable} backup ON backup.id = a.id
              SET a.published_at = backup.published_at,
                  a.updated_at = backup.updated_at
            WHERE a.id = ? AND a.published_at = ? AND a.updated_at = ?`,
          [entry.id, entry.published_at, entry.updated_at],
        );
        if (result.affectedRows !== 1) {
          throw new Error(`rollback row count mismatch for article ${entry.id}`);
        }
      }

      await connection.commit();
      transactionStarted = false;
      return {
        ready: true,
        checked: entries.length,
        updated: entries.length,
        conflicts: [],
        backup_table: backupTable,
      };
    } catch (error) {
      if (transactionStarted) {
        await connection.rollback();
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  private validateEntries(entries: NewsPublicationTimeRepairEntry[]): void {
    const errors: string[] = [];
    const seenIds = new Set<number>();
    const nowTimestamp = this.now().getTime();

    if (!Array.isArray(entries) || entries.length === 0) {
      errors.push('mapping must contain at least one entry');
    }

    for (const [index, entry] of entries.entries()) {
      const label = Number.isInteger(entry?.id) ? `article ${entry.id}` : `entry ${index + 1}`;
      if (!Number.isInteger(entry?.id) || entry.id <= 0) {
        errors.push(`${label} has an invalid id`);
      } else if (seenIds.has(entry.id)) {
        errors.push(`${label} has a duplicate id`);
      } else {
        seenIds.add(entry.id);
      }

      for (const field of [
        'expected_published_at',
        'published_at',
        'expected_updated_at',
        'updated_at',
      ] as const) {
        if (!isValidSqlDateTime(entry?.[field])) {
          errors.push(`${label} has an invalid ${field}`);
        }
      }
      if (!entry?.source?.trim()) {
        errors.push(`${label} has an empty source`);
      }

      if (isValidSqlDateTime(entry?.published_at) && toShanghaiTimestamp(entry.published_at) > nowTimestamp) {
        errors.push(`${label} has a future published_at`);
      }
      if (isValidSqlDateTime(entry?.updated_at) && toShanghaiTimestamp(entry.updated_at) > nowTimestamp) {
        errors.push(`${label} has a future updated_at`);
      }
      if (
        isValidSqlDateTime(entry?.published_at)
        && isValidSqlDateTime(entry?.updated_at)
        && toShanghaiTimestamp(entry.updated_at) < toShanghaiTimestamp(entry.published_at)
      ) {
        errors.push(`${label} has updated_at before published_at`);
      }
      if (
        isValidSqlDateTime(entry?.expected_published_at)
        && isValidSqlDateTime(entry?.expected_updated_at)
        && toShanghaiTimestamp(entry.expected_updated_at) < toShanghaiTimestamp(entry.expected_published_at)
      ) {
        errors.push(`${label} has expected_updated_at before expected_published_at`);
      }
    }

    if (errors.length > 0) {
      throw invalidMappingError(errors);
    }
  }

  private async selectCurrentRows(
    connection: Awaited<ReturnType<Pool['getConnection']>>,
    ids: number[],
  ): Promise<CurrentNewsPublicationRow[]> {
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await connection.query<CurrentNewsPublicationRow[]>(
      `SELECT id,
              DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
              DATE_FORMAT(published_at, '%Y-%m-%d %H:%i:%s') AS published_at,
              DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
         FROM news_articles
        WHERE id IN (${placeholders})`,
      ids,
    );
    return rows;
  }

  private async requireBackupRowCount(
    connection: Awaited<ReturnType<Pool['getConnection']>>,
    backupTable: string,
    ids: number[],
  ): Promise<void> {
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await connection.query<CountRow[]>(
      `SELECT COUNT(*) AS total
         FROM ${backupTable}
        WHERE id IN (${placeholders})`,
      ids,
    );
    const total = Number(rows[0]?.total || 0);
    if (total !== ids.length) {
      throw new Error(`backup row count mismatch: expected ${ids.length}, received ${total}`);
    }
  }
}

function getBackupTableName(runId: string): string {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error('invalid run id; expected YYYYMMDDTHHMMSS');
  }
  return `news_publication_time_backup_${runId}`;
}

function isValidSqlDateTime(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = SQL_DATETIME_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (year < 1000 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) {
    return false;
  }
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= lastDayOfMonth;
}

function toShanghaiTimestamp(value: string): number {
  return Date.parse(`${value.replace(' ', 'T')}+08:00`);
}

function invalidMappingError(errors: string[]): Error {
  return new Error(`invalid repair mapping: ${errors.join('; ')}`);
}
