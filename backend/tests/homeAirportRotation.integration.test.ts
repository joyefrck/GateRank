import assert from 'node:assert/strict';
import test from 'node:test';
import mysql from 'mysql2/promise';
import { HomeAirportRotationService } from '../src/services/homeAirportRotationService';
import { BillingEligibilityService } from '../src/services/billingEligibilityService';
import { MarketingSettingsService } from '../src/services/marketingSettingsService';
import { SystemSettingRepository } from '../src/repositories/systemSettingRepository';
import { ScoreRuleService } from '../src/services/scoreRuleService';

test('homepage rotation MySQL: eligibility, concurrency, persistence and balance changes', {
  skip: !process.env.GATERANK_ROTATION_TEST_PORT,
}, async () => {
  const config = { host: '127.0.0.1', port: Number(process.env.GATERANK_ROTATION_TEST_PORT), user: 'root', password: '', decimalNumbers: true };
  const admin = mysql.createPool(config);
  const database = `gaterank_rotation_test_${process.pid}_${Date.now()}`;
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = mysql.createPool({ ...config, database, connectionLimit: 8 });
  try {
    const ddl = [
      'CREATE TABLE airports (id INT PRIMARY KEY, is_listed TINYINT, status VARCHAR(20), created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE airport_applications (id INT PRIMARY KEY, approved_airport_id INT, payment_status VARCHAR(20))',
      'CREATE TABLE applicant_accounts (id INT PRIMARY KEY, application_id INT)',
      'CREATE TABLE applicant_wallets (id INT PRIMARY KEY, applicant_account_id INT, airport_id INT, balance DECIMAL(10,2))',
      'CREATE TABLE applicant_wallet_transactions (wallet_id INT, transaction_type VARCHAR(30), amount DECIMAL(10,2))',
      'CREATE TABLE airport_scores_daily (airport_id INT, date DATE, final_score DECIMAL(10,2), details_json JSON)',
      'CREATE TABLE airport_rankings_daily (airport_id INT, date DATE, list_type VARCHAR(20), rank_no INT, score DECIMAL(10,2))',
    ];
    for (const sql of ddl) await pool.query(sql);
    const repository = new SystemSettingRepository(pool);
    await repository.ensureSchema();
    const settings = new MarketingSettingsService({ systemSettingRepository: repository });
    await settings.updateAdminSettings({ click_charge_amount: 1, rank_click_charge_amounts: { 1: 2 } }, 'test');
    for (let id = 1; id <= 10; id++) {
      await pool.execute('INSERT INTO airports (id, is_listed, status) VALUES (?, ?, ?)', [id, id === 9 ? 0 : 1, id === 10 ? 'down' : 'normal']);
      await pool.execute('INSERT INTO airport_applications VALUES (?, ?, ?)', [id, id, id === 6 ? 'unpaid' : 'paid']);
      await pool.execute('INSERT INTO applicant_accounts VALUES (?, ?)', [id, id]);
      await pool.execute('INSERT INTO applicant_wallets VALUES (?, ?, ?, ?)', [id, id, id, id === 8 ? 0.5 : 100]);
      if (id !== 7) await pool.execute("INSERT INTO applicant_wallet_transactions VALUES (?, 'recharge', 100)", [id]);
      await pool.execute("INSERT INTO airport_scores_daily VALUES (?, CURRENT_DATE, ?, JSON_OBJECT('score_rule_version', 'v1_spcr'))", [id, 100-id]);
    }
    const billing = new BillingEligibilityService(pool, settings, new ScoreRuleService({ systemSettingRepository: repository }));
    let now = Date.now();
    const duration = 120 * 60_000;
    const service = new HomeAirportRotationService(pool, billing, () => now);
    await service.ensureSchema();
    await service.ensureSchema();
    const first = await service.getSelection(4, 120);
    assert.equal(first.total, 5);
    assert.equal(first.airport_ids.length, 4);
    const concurrent = await Promise.all(Array.from({ length: 24 }, () => service.getSelection(4, 120)));
    for (const result of concurrent) assert.deepEqual(result, first);
    const leaders = [first.airport_ids[0]];
    for (let slot = 1; slot < 5; slot++) {
      now += duration;
      // New service instance stands in for an API restart; the state lives in MySQL.
      const restarted = new HomeAirportRotationService(pool, billing, () => now);
      const result = await restarted.getSelection(4, 120);
      assert.equal(result.rotation.round, 1);
      leaders.push(result.airport_ids[0]);
    }
    assert.deepEqual([...leaders].sort(), [1,2,3,4,5]);
    const before = await billing.getSnapshot();
    now += duration;
    const next = await service.getSelection(4, 120);
    assert.equal(next.rotation.round, 2);
    assert.notEqual(next.airport_ids[0], leaders[4]);
    assert.deepEqual(await billing.getSnapshot(), before, 'homepage rotation must not alter score ranks or billing tiers');
    await pool.execute('UPDATE applicant_wallets SET balance = 0 WHERE airport_id = ?', [next.airport_ids[0]]);
    const afterLoss = await service.getSelection(4, 120);
    assert.equal(afterLoss.total, 4);
    assert.ok(!afterLoss.airport_ids.includes(next.airport_ids[0]));
    await pool.execute('UPDATE applicant_wallets SET balance = 100 WHERE airport_id = ?', [next.airport_ids[0]]);
    assert.equal((await service.getSelection(4, 120)).total, 5);
    const changed = await service.getSelection(12, 30);
    assert.equal(changed.airport_ids.length, 5);
    assert.equal(changed.rotation.interval_minutes, 30);
    await pool.query('UPDATE applicant_wallets SET balance = 0');
    const empty = await service.getSelection(4, 120);
    assert.deepEqual(empty.airport_ids, []);
    assert.equal(empty.total, 0);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
});
