import test from 'node:test';
import assert from 'node:assert/strict';
import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { PerformanceProbeJobRepository } from '../src/repositories/performanceProbeJobRepository';
import { SchedulerRunRepository } from '../src/repositories/schedulerRunRepository';
import { SchedulerTaskRepository } from '../src/repositories/schedulerTaskRepository';
import { NetworkCoverageProbeRepository } from '../src/repositories/networkCoverageProbeRepository';
import { NetworkCoverageProbeService } from '../src/services/networkCoverageProbeService';
import { getDateInTimezone } from '../src/utils/time';

test('MySQL retry boundaries and upgrade of the old scheduler task enum', {
  skip: process.env.PROBE_RETRY_TEST_MYSQL !== '1',
}, async (t) => {
  // Deliberately do not load application .env or use the application's database.
  const config = {
    host: '127.0.0.1', port: Number(process.env.PROBE_RETRY_TEST_PORT),
    user: 'root', password: process.env.PROBE_RETRY_TEST_PASSWORD || '',
  };
  assert.ok(config.port > 0, 'An explicit local test MySQL port is required');
  const admin = await mysql.createConnection(config);
  const database = `gaterank_retry_test_${process.pid}_${Date.now()}`;
  let pool: Pool | undefined;
  try {
    await admin.query(`CREATE DATABASE \`${database}\``);
    pool = mysql.createPool({ ...config, database });
    await pool.query('CREATE TABLE airports (id BIGINT UNSIGNED PRIMARY KEY)');
    await pool.query('CREATE TABLE performance_probes (probe_id VARCHAR(64) PRIMARY KEY)');
    await pool.query('CREATE TABLE airport_subscription_node_snapshots (id BIGINT UNSIGNED PRIMARY KEY)');
    await pool.query('INSERT INTO airports VALUES (1)');
    await pool.query("INSERT INTO performance_probes VALUES ('cn-shanghai'), ('cn-guangzhou')");
    await pool.query('INSERT INTO airport_subscription_node_snapshots VALUES (1)');
    const jobs = new PerformanceProbeJobRepository(pool);
    await jobs.ensureSchema();
    const db = pool;
    const seed = async (id: string, overrides: {
      attempts?: number; status?: string; active?: boolean; profile?: string;
      probe?: 'cn-shanghai' | 'cn-guangzhou';
    } = {}) => {
      await jobs.create({
        job_id: id, airport_id: 1, probe_id: overrides.probe || 'cn-shanghai',
        node_snapshot_id: 1, config_version: 1, test_enabled_snapshot: true,
        include_in_result_snapshot: true, selected_node_keys: [],
        test_profile: (overrides.profile || 'proxy_multi_target_v2') as never,
        scoring_rule_version: 'cn_dual_probe_v1', source: 'scheduler-performance',
        idempotency_key: id,
      });
      await db.execute(`UPDATE performance_probe_jobs SET attempts=?, status=?,
        lease_expires_at=DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? SECOND) WHERE job_id=?`,
      [overrides.attempts || 0, overrides.status || 'queued', overrides.active ? 3600 : -1, id]);
    };
    const clear = () => db.query('DELETE FROM performance_probe_jobs');

    await t.test('initial attempt and two retries, then advance to the next job', async () => {
      await seed('retry');
      for (let attempt = 1; attempt <= 3; attempt++) {
        const job = await jobs.leaseNext('cn-shanghai', 'worker', 900);
        assert.equal(job?.job_id, 'retry');
        assert.equal(job?.attempts, attempt);
        await db.query("UPDATE performance_probe_jobs SET lease_expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE job_id='retry'");
      }
      await seed('next');
      await db.query("UPDATE performance_probe_jobs SET created_at=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE job_id='retry'");
      assert.equal((await jobs.leaseNext('cn-shanghai', 'worker', 900))?.job_id, 'next');
      assert.equal((await jobs.getById('retry'))?.status, 'expired');
      assert.equal((await jobs.getById('retry'))?.attempts, 3);
      assert.equal(await jobs.markCompleted('retry', 'cn-shanghai', 999), false);
    });
    await t.test('last active attempt remains valid and can complete normally', async () => {
      await clear();
      await seed('active', { attempts: 3, status: 'leased', active: true });
      assert.equal(await jobs.leaseNext('cn-shanghai', 'worker', 900), null);
      assert.equal((await jobs.getById('active'))?.status, 'leased');
      assert.equal(await jobs.markCompleted('active', 'cn-shanghai', 7), true);
      assert.equal((await jobs.getById('active'))?.run_id, 7);
    });
    await t.test('historically exhausted jobs expire, without touching other probes or completed evidence', async () => {
      await clear();
      await seed('queued-over-limit', { attempts: 106 });
      await seed('lease-over-limit', { attempts: 108, status: 'leased' });
      await seed('other-probe', { attempts: 108, probe: 'cn-guangzhou' });
      await seed('completed', { attempts: 108, status: 'completed' });
      assert.equal(await jobs.leaseNext('cn-shanghai', 'worker', 900), null);
      for (const id of ['queued-over-limit', 'lease-over-limit']) {
        const job = await jobs.getById(id);
        assert.equal(job?.status, 'expired');
        assert.equal(job?.lease_expires_at, null);
      }
      assert.equal((await jobs.getById('other-probe'))?.status, 'queued');
      assert.equal((await jobs.getById('completed'))?.status, 'completed');
    });
    await t.test('coverage jobs have the same attempt limit while retaining their hour lease', async () => {
      await clear();
      await seed('coverage', { attempts: 2, profile: 'network_coverage_proxy_http_v1' });
      assert.equal(await jobs.leaseNext('cn-shanghai', 'old-worker', 900, false), null);
      assert.equal((await jobs.leaseNext('cn-shanghai', 'worker', 900, true))?.attempts, 3);
      const [rows] = await db.query<RowDataPacket[]>("SELECT TIMESTAMPDIFF(SECOND,NOW(),lease_expires_at) remaining FROM performance_probe_jobs WHERE job_id='coverage'");
      assert.ok(rows[0].remaining >= 3590);
      await db.query("UPDATE performance_probe_jobs SET lease_expires_at=DATE_SUB(NOW(),INTERVAL 1 SECOND)");
      assert.equal(await jobs.leaseNext('cn-shanghai', 'worker', 900, true), null);
      assert.equal((await jobs.getById('coverage'))?.status, 'expired');
    });
    await t.test('concurrent polls cannot grant a fourth attempt', async () => {
      await clear();
      await seed('last-attempt', { attempts: 2 });
      const results = await Promise.all([
        jobs.leaseNext('cn-shanghai', 'worker-a', 900),
        jobs.leaseNext('cn-shanghai', 'worker-b', 900),
      ]);
      assert.equal(results.filter(Boolean).length, 1);
      assert.equal((await jobs.getById('last-attempt'))?.attempts, 3);
    });
    await t.test('terminal coverage failure commits atomically and cannot be leased or completed again', async () => {
      await clear();
      await seed('rejected-coverage', { profile: 'network_coverage_proxy_http_v1' });
      await jobs.leaseNext('cn-shanghai', 'worker', 900, true);
      await assert.rejects(jobs.withTransaction(async (connection) => {
        assert.equal(await jobs.markFailed('rejected-coverage', 'cn-shanghai', connection), true);
        throw new Error('rollback-test');
      }), /rollback-test/);
      assert.equal((await jobs.getById('rejected-coverage'))?.status, 'leased');
      assert.equal(await jobs.markFailed('rejected-coverage', 'cn-guangzhou'), false);
      await jobs.withTransaction(async (connection) => {
        assert.equal(await jobs.markFailed('rejected-coverage', 'cn-shanghai', connection), true);
      });
      const failed = await jobs.getById('rejected-coverage');
      assert.equal(failed?.status, 'failed');
      assert.equal(failed?.lease_expires_at, null);
      assert.equal(failed?.lease_owner, null);
      assert.ok(failed?.completed_at);
      assert.equal(await jobs.leaseNext('cn-shanghai', 'worker', 900, true), null);
      assert.equal(await jobs.markCompleted('rejected-coverage', 'cn-shanghai', 7), false);
    });
    await t.test('coverage HTTP rejection preserves both terminal records after the real transaction commits', async () => {
      await clear();
      const batches = new NetworkCoverageProbeRepository(db);
      await batches.ensureSchema();
      const snapshot = { id: 1, airport_id: 1, subscription_url: 'https://example.test/sub',
        nodes: [{ name: 'HK', type: 'vless', region: 'HK', raw_uri: 'vless://test', outbound: {} }], unsupported_nodes: [] };
      const coverage = new NetworkCoverageProbeService({
        batchRepository: batches, jobRepository: jobs,
        snapshotRepository: { getById: async () => snapshot as never, getLatestByAirport: async () => snapshot as never },
        probeRepository: { list: async () => [{ probe_id: 'cn-shanghai', probe_type: 'mainland', globally_enabled: true, token_configured: true }] as never },
        airportRepository: { listAll: async () => [], getById: async () => ({ subscription_url: snapshot.subscription_url }) },
        runRepository: { insert: async () => { throw new Error('invalid evidence must not publish'); } },
        dispatchService: { waitForJobs: async () => ({ total: 1, completed: 0, failed: 1, pending: 0 }) },
        recomputeService: { recomputeAirportForDate: async () => { throw new Error('invalid evidence must not score'); } },
      });
      const date = getDateInTimezone();
      const batch = await coverage.dispatchAirport(1, date, 'manual-network-coverage:test');
      const job = await jobs.leaseNext('cn-shanghai', 'worker', 900, true);
      assert.ok(job);
      await assert.rejects(coverage.submitRun(job, { sampled_at: `${date}T12:00:00+08:00`, status: 'success', nodes: [] }), { code: 'COVERAGE_RESULT_INVALID' });
      assert.equal((await jobs.getById(job.job_id))?.status, 'failed');
      const saved = await batches.get(batch.batch_key);
      assert.equal(saved?.status, 'failed');
      assert.equal(saved?.error_code, 'COVERAGE_RESULT_INVALID');
      assert.deepEqual(saved?.results, {});
    });
    await t.test('old enum is upgraded repeatably and records the ad reminder without losing history', async () => {
      const tasks = new SchedulerTaskRepository(db);
      const runs = new SchedulerRunRepository(db);
      await tasks.ensureSchema();
      await runs.ensureSchema();
      const oldEnum = "ENUM('stability','subscription_node_refresh','performance','network_coverage','risk','aggregate_recompute','billing_listing_sync','stability_resample_guard')";
      await db.query(`ALTER TABLE admin_scheduler_runs MODIFY task_key ${oldEnum} NOT NULL`);
      const old = await runs.createRunning({ taskKey: 'stability', runDate: '2026-09-19', triggerSource: 'schedule' });
      await runs.ensureSchema();
      await runs.ensureSchema();
      const reminder = await runs.createRunning({ taskKey: 'ad_expiry_reminder', runDate: '2026-09-20', triggerSource: 'schedule' });
      await runs.markFinished({ id: reminder.id, status: 'succeeded', durationMs: 1 });
      assert.equal((await runs.getById(reminder.id))?.status, 'succeeded');
      assert.equal((await runs.getById(old.id))?.task_key, 'stability');
    });
  } finally {
    await pool?.end();
    await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
  }
});
