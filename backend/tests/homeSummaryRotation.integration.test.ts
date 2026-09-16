import assert from 'node:assert/strict';
import test from 'node:test';
import mysql from 'mysql2/promise';
import { HomeAirportRotationService } from '../src/services/homeAirportRotationService';

test('summary MySQL queues: full pool, thresholds, independent state, concurrency, restart and withdrawal', {
  skip: !process.env.GATERANK_ROTATION_TEST_PORT,
}, async () => {
  const config = { host: '127.0.0.1', port: Number(process.env.GATERANK_ROTATION_TEST_PORT), user: 'root', password: '', decimalNumbers: true };
  const admin = mysql.createPool(config);
  const database = `gaterank_summary_test_${process.pid}_${Date.now()}`;
  await admin.query(`CREATE DATABASE ${database}`);
  const pool = mysql.createPool({ ...config, database, connectionLimit: 8 });
  try {
    for (const sql of [
      'CREATE TABLE airports (id INT PRIMARY KEY, is_listed TINYINT, status VARCHAR(20), tags_json JSON)',
      'CREATE TABLE airport_scores_daily (airport_id INT, date DATE, score_s DECIMAL(10,2), score_p DECIMAL(10,2), score_c DECIMAL(10,2), score_r DECIMAL(10,2), details_json JSON)',
      'CREATE TABLE airport_metrics_daily (airport_id INT, date DATE, stable_days_streak INT, domain_ok TINYINT, ssl_days_left INT, recent_complaints_count INT, history_incidents INT)',
    ]) await pool.query(sql);
    for (let id = 1; id <= 65; id++) {
      await pool.execute('INSERT INTO airports VALUES (?, ?, ?, ?)', [id, id === 63 ? 0 : 1, id === 64 ? 'risk' : 'normal', JSON.stringify(id === 65 ? ['风险观察'] : [])]);
      await pool.execute("INSERT INTO airport_scores_daily VALUES (?, '2026-09-16', 80, ?, 75, 75, ?)", [id, id === 55 ? 64 : 65,
        JSON.stringify(id === 59 ? { score_rule_version: 'v2_spncr' } : {})]);
      if (id !== 60) await pool.execute("INSERT INTO airport_metrics_daily VALUES (?, '2026-09-16', ?, 1, 90, ?, 0)", [id, id === 61 ? 13 : 14, id === 62 ? 1 : 0]);
    }
    const hidden = new Set([58]);
    const billing = { getSnapshot: async () => new Map(Array.from({ length: 65 }, (_, i) => [i + 1,
      { airport_id: i + 1, score_hidden: hidden.has(i + 1), score_hidden_reason: hidden.has(i + 1) ? 'insufficient_balance' as const : null,
        rank: i + 1, billing_rank: i + 1, click_charge_amount: 1 }])) };
    let now = Date.parse('2026-09-16T00:00:00Z');
    const service = new HomeAirportRotationService(pool, billing, () => now);
    await service.ensureSchema();
    await service.ensureSchema();
    const limits = { most_stable: 5, best_value: 4 };
    const get = (instance = service) => instance.getSummarySelections('2026-09-16', limits, 30, 'v1_spcr');
    const first = await get();
    assert.equal(first.most_stable.total, 57, 'candidates beyond the old fifty-row ranking limit participate');
    assert.equal(first.best_value.total, 56, 'only value pool excludes performance below 65');
    for (const result of await Promise.all(Array.from({ length: 24 }, () => get()))) assert.deepEqual(result, first);
    const stableLeaders = new Set<number>();
    const valueLeaders = new Set<number>();
    for (let slot = 0; slot < 57; slot++) {
      const result = await get(new HomeAirportRotationService(pool, billing, () => now));
      stableLeaders.add(result.most_stable.airport_ids[0]);
      if (slot < 56) valueLeaders.add(result.best_value.airport_ids[0]);
      now += 30 * 60_000;
    }
    assert.equal(stableLeaders.size, 57);
    assert.equal(valueLeaders.size, 56);
    assert.ok(stableLeaders.has(55)); assert.ok(!valueLeaders.has(55));
    assert.ok(stableLeaders.has(57)); assert.ok(valueLeaders.has(57));
    const current = await get();
    const removed = current.most_stable.airport_ids[0];
    await pool.execute('UPDATE airport_metrics_daily SET stable_days_streak = 0 WHERE airport_id = ?', [removed]);
    const afterLoss = await get();
    assert.equal(afterLoss.most_stable.total, 56);
    assert.ok(!afterLoss.most_stable.airport_ids.includes(removed));
    await pool.execute('UPDATE airport_metrics_daily SET stable_days_streak = 14 WHERE airport_id = ?', [removed]);
    assert.equal((await get()).most_stable.total, 57);
    const changed = await service.getSummarySelections('2026-09-16', { most_stable: 12, best_value: 12 }, 60, 'v1_spcr');
    assert.equal(changed.most_stable.airport_ids.length, 12);
    assert.equal(changed.most_stable.rotation.interval_minutes, 60);
    const [stateRows] = await pool.query<mysql.RowDataPacket[]>('SELECT state_json FROM home_airport_rotation WHERE id = 1');
    assert.equal(stateRows[0].state_json, null, 'summary rotations never change the excellent-airport queue');
    await pool.query('UPDATE airports SET is_listed = 0');
    const empty = await get();
    assert.deepEqual(empty.most_stable.airport_ids, []);
    assert.deepEqual(empty.best_value.airport_ids, []);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${database}`);
    await admin.end();
  }
});
