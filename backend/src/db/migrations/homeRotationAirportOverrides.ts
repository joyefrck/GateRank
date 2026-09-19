import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { MarketingBillingConfig } from '../../services/marketingSettingsService';

/** Initial rollout selection only. An administrator's saved list (including []) always wins. */
export async function seedHomeRotationAirportOverrides(pool: Pool, defaults: MarketingBillingConfig): Promise<void> {
  const [airports] = await pool.query<Array<RowDataPacket & { id: number }>>(
    'SELECT id FROM airports WHERE name = ? ORDER BY id', ['大象网络'],
  );
  // Never guess if a copied database is missing the real airport or contains ambiguous names.
  if (airports.length !== 1) return;
  const ids = [Number(airports[0].id)];
  await pool.execute(
    `INSERT INTO admin_system_settings (setting_key, value_json, updated_by)
     VALUES ('marketing_billing', ?, 'migration:home-rotation-overrides')
     ON DUPLICATE KEY UPDATE
       updated_by = IF(JSON_CONTAINS_PATH(value_json, 'one', '$.home_rotation_airport_ids'), updated_by, VALUES(updated_by)),
       value_json = JSON_INSERT(value_json, '$.home_rotation_airport_ids', CAST(? AS JSON))`,
    [JSON.stringify({ ...defaults, home_rotation_airport_ids: ids }), JSON.stringify(ids)],
  );
}
