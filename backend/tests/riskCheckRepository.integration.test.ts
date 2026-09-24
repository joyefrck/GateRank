import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';
import { RiskCheckRepository } from '../src/repositories/riskCheckRepository';
import { emptyProbeResult } from '../src/services/websiteProbe';

test('risk diagnostics and metrics are atomic in MySQL, preserve other fields, and retain prior applied record', {
  skip: !process.env.GATERANK_RISK_TEST_PORT,
}, async () => {
  const config = { host: '127.0.0.1', port: Number(process.env.GATERANK_RISK_TEST_PORT), user: 'root', password: '', decimalNumbers: true };
  const admin = mysql.createPool(config);
  const database = `gaterank_risk_test_${process.pid}_${Date.now()}`;
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = mysql.createPool({ ...config, database, connectionLimit: 4 });
  try {
    await pool.query('CREATE TABLE airports (id BIGINT UNSIGNED NOT NULL PRIMARY KEY)');
    await pool.query('INSERT INTO airports VALUES (94)');
    const schema = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
    const metricsSql = schema.match(/CREATE TABLE IF NOT EXISTS airport_metrics_daily \([\s\S]*?\n\);/)![0];
    await pool.query(metricsSql);
    const repo = new RiskCheckRepository(pool);
    await repo.ensureSchema();
    await repo.ensureSchema();
    const good = { ...emptyProbeResult('challenge'), domain_ok: true, ssl_days_left: 74 };
    await repo.save(94, '2026-09-24', good, null);
    await pool.query('UPDATE airport_metrics_daily SET median_download_mbps = 321, recent_complaints_count = 7 WHERE airport_id = 94');
    await repo.save(94, '2026-09-24', { ...good, ssl_days_left: 73 }, null);
    let [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM airport_metrics_daily');
    assert.equal(rows[0].median_download_mbps, 321);
    assert.equal(rows[0].recent_complaints_count, 7);
    assert.equal(rows[0].ssl_days_left, 73);
    await repo.save(94, '2026-09-24', emptyProbeResult('config_error'), null);
    const history = await repo.getHistory(94, '2026-09-24');
    assert.equal(history.latest?.status, 'config_error');
    assert.equal(history.latest?.applied_to_metrics, false);
    assert.equal(history.last_applied?.ssl_days_left, 73);
    assert.deepEqual(await repo.getHistory(94, '2026-09-23'), { latest: null, last_applied: null });
    await pool.query("CREATE TRIGGER reject_diagnostic BEFORE INSERT ON airport_risk_checks FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'reject diagnostic'");
    await assert.rejects(repo.save(94, '2026-09-24', { ...good, domain_ok: false, ssl_days_left: null }, null), /reject diagnostic/);
    [rows] = await pool.query<mysql.RowDataPacket[]>('SELECT * FROM airport_metrics_daily');
    assert.equal(rows[0].domain_ok, 1);
    assert.equal(rows[0].ssl_days_left, 73);
    assert.equal((await repo.getHistory(94, '2026-09-24')).latest?.id, history.latest?.id);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
});
