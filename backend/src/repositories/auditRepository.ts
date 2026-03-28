import { createHash } from 'node:crypto';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export class AuditRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        actor VARCHAR(128) NOT NULL,
        action VARCHAR(128) NOT NULL,
        request_id VARCHAR(64) NOT NULL,
        payload_hash CHAR(64) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_admin_audit_logs_created_at (created_at)
      )
    `);

    await this.ensureColumn('actor', 'VARCHAR(128) NOT NULL AFTER id');
    await this.ensureColumn('action', 'VARCHAR(128) NOT NULL AFTER actor');
    await this.ensureColumn('request_id', 'VARCHAR(64) NOT NULL AFTER action');
    await this.ensureColumn('payload_hash', 'CHAR(64) NOT NULL AFTER request_id');
    await this.ensureColumn('created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER payload_hash');
  }

  async log(action: string, actor: string, requestId: string, payload: unknown): Promise<void> {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(payload ?? null))
      .digest('hex');

    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO admin_audit_logs (actor, action, request_id, payload_hash)
       VALUES (?, ?, ?, ?)`,
      [actor, action, requestId, payloadHash],
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
      ['admin_audit_logs', columnName],
    );

    if (rows.length === 0) {
      await this.pool.query(`ALTER TABLE admin_audit_logs ADD COLUMN ${columnName} ${definition}`);
    }
  }
}
