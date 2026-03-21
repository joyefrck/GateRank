import { createHash } from 'node:crypto';
import type { Pool, ResultSetHeader } from 'mysql2/promise';

export class AuditRepository {
  constructor(private readonly pool: Pool) {}

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
}
