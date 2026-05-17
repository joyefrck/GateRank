import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicantEmailChangeCodeRepository } from '../src/repositories/applicantEmailChangeCodeRepository';

interface StoredApplicantEmailCode {
  code_hash: string;
  code_salt: string;
  consumed_at: string | null;
}

test('ApplicantEmailChangeCodeRepository.ensureSchema creates verification code table', async () => {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new ApplicantEmailChangeCodeRepository({
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      return [[]];
    },
  } as never);

  await repository.ensureSchema();

  assert.ok(calls[0]?.sql.includes('CREATE TABLE IF NOT EXISTS applicant_email_change_codes'));
  assert.ok(calls[0]?.sql.includes('code_hash CHAR(64) NOT NULL'));
  assert.ok(calls[0]?.sql.includes('idx_applicant_email_codes_account_email_created'));
});

test('ApplicantEmailChangeCodeRepository.create stores hashed code and consume marks it used', async () => {
  const now = new Date('2026-05-17T10:00:00.000Z');
  const storedRecords: StoredApplicantEmailCode[] = [];
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const repository = new ApplicantEmailChangeCodeRepository({
    execute: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('INSERT INTO applicant_email_change_codes')) {
        storedRecords[0] = {
          code_hash: String(params?.[2]),
          code_salt: String(params?.[3]),
          consumed_at: null,
        };
        return [{ insertId: 44, affectedRows: 1 }];
      }
      if (sql.includes('UPDATE applicant_email_change_codes')) {
        if (storedRecords[0]) {
          storedRecords[0] = { ...storedRecords[0], consumed_at: String(params?.[0]) };
        }
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    },
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (!storedRecords[0]) {
        return [[]];
      }
      return [[{
        id: 44,
        applicant_account_id: 1,
        email: 'new@example.com',
        code_hash: storedRecords[0].code_hash,
        code_salt: storedRecords[0].code_salt,
        expires_at: '2026-05-17 18:10:00',
        consumed_at: storedRecords[0].consumed_at,
        created_at: '2026-05-17 18:00:00',
      }]];
    },
  } as never);

  const record = await repository.create(1, 'new@example.com', '123456', now);
  const result = await repository.consume(1, 'new@example.com', '123456', now);

  assert.equal(record.id, 44);
  assert.equal(result, 'consumed');
  const finalStored = storedRecords[0];
  assert.ok(finalStored);
  assert.ok(finalStored.consumed_at);
  assert.ok(calls.some((call) => call.sql.includes('SET consumed_at = ?')));
  assert.notEqual(finalStored.code_hash, '123456');
});

test('ApplicantEmailChangeCodeRepository.consume rejects expired latest code', async () => {
  const repository = new ApplicantEmailChangeCodeRepository({
    query: async () => [[{
      id: 44,
      applicant_account_id: 1,
      email: 'new@example.com',
      code_hash: 'hash',
      code_salt: 'salt',
      expires_at: '2026-05-17 18:00:00',
      consumed_at: null,
      created_at: '2026-05-17 17:50:00',
    }]],
    execute: async () => [{ affectedRows: 0 }],
  } as never);

  const result = await repository.consume(1, 'new@example.com', '123456', new Date('2026-05-17T10:00:01.000Z'));

  assert.equal(result, 'expired');
});
