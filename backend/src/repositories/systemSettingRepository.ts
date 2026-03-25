import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

interface SystemSettingRow extends RowDataPacket {
  setting_key: string;
  value_json: unknown;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface SystemSettingRecord {
  setting_key: string;
  value_json: unknown;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export class SystemSettingRepository {
  constructor(private readonly pool: Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS admin_system_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        setting_key VARCHAR(128) NOT NULL,
        value_json JSON NOT NULL,
        updated_by VARCHAR(128) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_admin_system_settings_key (setting_key)
      )
    `);

    await this.ensureColumn('value_json', 'JSON NOT NULL AFTER setting_key');
    await this.ensureColumn('updated_by', 'VARCHAR(128) NOT NULL AFTER value_json');
    await this.ensureColumn('created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER updated_by');
    await this.ensureColumn(
      'updated_at',
      'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at',
    );
  }

  async getByKey(settingKey: string): Promise<SystemSettingRecord | null> {
    const [rows] = await this.pool.query<SystemSettingRow[]>(
      `SELECT
         setting_key,
         value_json,
         updated_by,
         DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM admin_system_settings
       WHERE setting_key = ?
       LIMIT 1`,
      [settingKey],
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0];
  }

  async upsert(settingKey: string, value: unknown, updatedBy: string): Promise<void> {
    await this.pool.execute<ResultSetHeader>(
      `INSERT INTO admin_system_settings (setting_key, value_json, updated_by)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         value_json = VALUES(value_json),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [settingKey, JSON.stringify(value ?? null), updatedBy],
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
      ['admin_system_settings', columnName],
    );

    if (rows.length === 0) {
      await this.pool.query(
        `ALTER TABLE admin_system_settings ADD COLUMN ${columnName} ${definition}`,
      );
    }
  }
}
