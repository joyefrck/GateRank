import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsPublicationTimeRepairService } from '../src/services/newsPublicationTimeRepairService';

const validEntry = {
  id: 16,
  expected_published_at: '2026-07-30 11:16:45',
  published_at: '2026-05-20 20:30:00',
  expected_updated_at: '2026-07-31 09:00:00',
  updated_at: '2026-05-20 20:30:00',
  source: 'mysql-binlog-before-2026-07-30',
};

const currentRow = {
  id: 16,
  created_at: '2026-05-20 20:00:00',
  published_at: validEntry.expected_published_at,
  updated_at: validEntry.expected_updated_at,
};

class FakeRepairConnection {
  sql: string[] = [];
  events: string[] = [];
  beginTransactionCalls = 0;
  commitCalls = 0;
  rollbackCalls = 0;
  nextAffectedRows = 1;

  constructor(public rows = [currentRow]) {}

  async query(sql: string, _params?: unknown[]): Promise<[unknown[]]> {
    this.sql.push(sql);
    this.events.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
    if (sql.includes('COUNT(*) AS total')) return [[{ total: this.rows.length }]];
    if (sql.includes('FROM news_articles')) return [this.rows];
    return [[]];
  }

  async execute(sql: string, _params?: unknown[]): Promise<[{ affectedRows: number }]> {
    this.sql.push(sql);
    this.events.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
    return [{ affectedRows: this.nextAffectedRows }];
  }

  async beginTransaction(): Promise<void> {
    this.beginTransactionCalls += 1;
    this.events.push('BEGIN');
  }

  async commit(): Promise<void> {
    this.commitCalls += 1;
    this.events.push('COMMIT');
  }

  async rollback(): Promise<void> {
    this.rollbackCalls += 1;
    this.events.push('ROLLBACK');
  }

  release(): void {}
}

function createHarness(rows = [currentRow]) {
  const connection = new FakeRepairConnection(rows);
  const service = new NewsPublicationTimeRepairService(
    { getConnection: async () => connection } as never,
    () => new Date('2026-07-31T23:30:00+08:00'),
  );
  return { connection, service };
}

test('dry run rejects missing source, future dates, and duplicate article ids', async () => {
  const { service } = createHarness();
  await assert.rejects(
    () => service.dryRun([
      { ...validEntry, source: '' },
      { ...validEntry, id: 17, published_at: '2099-01-01 00:00:00' },
      { ...validEntry },
    ]),
    /invalid repair mapping/,
  );
});

test('dry run rejects publication before creation without an explicit justification', async () => {
  const { service } = createHarness();
  await assert.rejects(
    () => service.dryRun([{ ...validEntry, published_at: '2026-05-19 20:30:00' }]),
    /allow_before_created_at.*justification/,
  );
});

test('dry run rejects impossible SQL datetime values', async () => {
  const { service } = createHarness();
  await assert.rejects(
    () => service.dryRun([{ ...validEntry, published_at: '2026-02-30 20:30:00' }]),
    /invalid published_at/,
  );
});

test('dry run reports current-value conflicts without opening a transaction', async () => {
  const { connection, service } = createHarness([{
    ...currentRow,
    published_at: '2026-07-30 11:00:00',
  }]);
  const report = await service.dryRun([validEntry]);
  assert.equal(report.ready, false);
  assert.deepEqual(report.conflicts, [{ id: 16, field: 'published_at' }]);
  assert.equal(connection.beginTransactionCalls, 0);
});

test('apply backs up and updates every mapped row in one transaction', async () => {
  const { connection, service } = createHarness();
  const report = await service.apply([validEntry], '20260731T233000');
  assert.equal(report.updated, 1);
  assert.equal(report.backup_table, 'news_publication_time_backup_20260731T233000');
  assert.equal(connection.beginTransactionCalls, 1);
  assert.equal(connection.commitCalls, 1);
  assert.equal(connection.rollbackCalls, 0);
  assert.match(connection.sql.join('\n'), /CREATE TABLE news_publication_time_backup_20260731T233000/);
  assert.match(connection.sql.join('\n'), /WHERE id = \? AND published_at = \? AND updated_at = \?/);
  assert.ok(connection.events.findIndex((event) => event.startsWith('CREATE TABLE')) < connection.events.indexOf('BEGIN'));
});

test('apply rolls back when an optimistic update affects zero rows', async () => {
  const { connection, service } = createHarness();
  connection.nextAffectedRows = 0;
  await assert.rejects(() => service.apply([validEntry], '20260731T233001'), /row count mismatch/);
  assert.equal(connection.rollbackCalls, 1);
  assert.equal(connection.commitCalls, 0);
});

test('rollback restores backup values only when current values match the mapping', async () => {
  const { connection, service } = createHarness([{
    ...currentRow,
    published_at: validEntry.published_at,
    updated_at: validEntry.updated_at,
  }]);
  const report = await service.rollback([validEntry], '20260731T233000');
  assert.equal(report.updated, 1);
  assert.match(connection.sql.join('\n'), /news_publication_time_backup_20260731T233000/);
  assert.match(connection.sql.join('\n'), /a\.published_at = \? AND a\.updated_at = \?/);
});
