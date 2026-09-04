import type { Pool } from 'mysql2/promise';
// Dedicated disposable test database only; intentionally mixes historical table collations.
export async function seedRevenueFixture(pool: Pool) {
  await pool.query(`CREATE TABLE airports (id BIGINT PRIMARY KEY, name VARCHAR(128), is_listed BOOLEAN) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await pool.query(`CREATE TABLE airport_applications (id BIGINT PRIMARY KEY, approved_airport_id BIGINT NULL, name VARCHAR(128), payment_status VARCHAR(16), payment_amount DECIMAL(10,2), paid_at DATETIME NULL) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE applicant_wallets (id BIGINT PRIMARY KEY, applicant_account_id BIGINT UNIQUE, application_id BIGINT, airport_id BIGINT NULL) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE application_payment_orders (id BIGINT PRIMARY KEY, application_id BIGINT, out_trade_no VARCHAR(64) UNIQUE, status VARCHAR(16), amount DECIMAL(10,2), paid_at DATETIME NULL, channel VARCHAR(16)) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await pool.query(`CREATE TABLE applicant_recharge_orders (id BIGINT PRIMARY KEY, applicant_account_id BIGINT, out_trade_no VARCHAR(64) UNIQUE, status VARCHAR(16), amount DECIMAL(10,2), paid_at DATETIME NULL, channel VARCHAR(16)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE applicant_wallet_transactions (id BIGINT PRIMARY KEY, wallet_id BIGINT, application_id BIGINT, applicant_account_id BIGINT, airport_id BIGINT NULL, transaction_type VARCHAR(32), amount DECIMAL(10,2), created_at DATETIME, reference_type VARCHAR(64), reference_id VARCHAR(128), UNIQUE KEY ref(reference_type, reference_id)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE outbound_click_records (click_id VARCHAR(128) UNIQUE, placement VARCHAR(64), billing_status VARCHAR(32)) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await pool.query("INSERT INTO airports VALUES (1, '测试机场 Alpha', 1), (2, '测试机场 Beta（已下架）', 0)");
  await pool.query(`INSERT INTO airport_applications VALUES (1, 1, 'Alpha 申请', 'paid', 100, '2026-09-01'), (2, 2, 'Beta 申请', 'paid', 50, '2026-09-02'), (3, NULL, '待审核测试机场', 'paid', 20, '2026-09-03'), (4, NULL, '人工标记不计入', 'paid', 99999, '2026-09-03')`);
  await pool.query('INSERT INTO applicant_wallets VALUES (1, 11, 1, 1), (2, 12, 2, 2), (3, 13, 3, NULL)');
  await pool.query(`INSERT INTO application_payment_orders VALUES
    (1, 1, 'app-1', 'paid', 100, '2026-09-01 00:00:00', 'alipay'),
    (2, 2, 'app-2', 'paid', 50, '2026-09-02 23:59:59', 'wxpay'),
    (3, 3, 'app-3', 'paid', 20, '2026-09-03 12:00:00', 'usdt'),
    (4, 4, 'app-manual', 'expired', 99999, NULL, 'alipay'),
    (5, 1, 'app-failed', 'failed', 99999, '2026-09-01', 'alipay'),
    (6, 1, 'app-missing', 'paid', 888, NULL, 'alipay'),
    (7, 1, 'app-previous', 'paid', 10, '2026-08-31 23:59:59', 'alipay')`);
  await pool.query(`INSERT INTO applicant_recharge_orders VALUES
    (1, 11, 'recharge-1', 'paid', 1000, '2026-09-01 10:00:00', 'alipay'),
    (2, 12, 'recharge-2', 'paid', 300, '2026-09-04 23:59:59', 'wxpay'),
    (3, 13, 'recharge-3', 'paid', 80, '2026-09-03', 'usdt'),
    (4, 11, 'recharge-unpaid', 'created', 99999, NULL, 'alipay'),
    (5, 11, 'recharge-missing', 'paid', 333, NULL, 'alipay'),
    (6, 11, 'recharge-next', 'paid', 300, '2026-09-05 00:00:00', 'alipay')`);
  await pool.query(`INSERT INTO outbound_click_records VALUES ('click-1', 'home_card', 'billed'), ('click-2', 'full_ranking_item', 'billed'), ('click-free', 'home_card', 'free'), ('click-duplicate', 'home_card', 'duplicate')`);
  await pool.query(`INSERT INTO applicant_wallet_transactions VALUES
    (1, 1, 1, 11, 1, 'adjustment', 99999, '2026-09-01', 'adjustment', 'manual-credit'),
    (2, 1, 1, 11, 1, 'recharge', 1000, '2026-09-01', 'recharge_order', '1'),
    (3, 1, 1, 11, 1, 'click_charge', -0.10, '2026-09-01 00:00:00', 'outbound_click', 'click-1'),
    (4, 2, 2, 12, 2, 'click_charge', -0.20, '2026-09-02', 'outbound_click', 'click-2'),
    (5, 1, 1, 11, 1, 'ad_campaign_charge', -200, '2026-09-02', 'ad_campaign', 'purchase-uuid'),
    (6, 1, 1, 11, 1, 'ad_campaign_charge', -150, '2026-09-04 23:59:59', 'ad_campaign', 'renew-uuid'),
    (7, 1, 1, 11, 1, 'adjustment', -100, '2026-09-03', 'adjustment', 'manual-debit'),
    (8, 1, 1, 11, 1, 'click_charge', -999, '2026-09-03', 'outbound_click', 'click-free'),
    (9, 1, 1, 11, 1, 'click_charge', -0.30, '2026-09-03', 'outbound_click', 'missing-click'),
    (10, 1, 1, 11, 1, 'click_charge', -999, '2026-09-03', 'outbound_click', 'click-duplicate'),
    (11, 1, 1, 11, 1, 'ad_campaign_charge', -999, '2026-09-05 00:00:00', 'ad_campaign', 'outside-range')`);
}
