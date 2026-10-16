import { randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import type { WebsiteProbeResult, WebsiteStatus } from '../../../shared/riskCheck';
import { normalizeWebsiteUrl } from '../../../shared/websiteUrl';
import { HttpError } from '../middleware/errorHandler';
import { emptyProbeResult } from './websiteProbe';

const LOCATIONS: Record<string, string> = { 'cn-shanghai': '上海', 'cn-guangzhou': '广州' };
const invalid = () => new HttpError(400, 'WEBSITE_PROBE_INVALID', 'Invalid website probe evidence');
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  return value as Record<string, unknown>;
}
function safeUrl(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || value.length > 4096) throw invalid();
  const url = new URL(normalizeWebsiteUrl(value));
  return `${url.origin}${url.pathname}`;
}
function code(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || !/^[A-Z0-9_]{1,64}$/.test(value)) throw invalid();
  return value;
}
function number(value: unknown, min: number, max: number): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw invalid();
  return value;
}
export function decodeWebsiteObservation(payload: unknown, job: { target_url: string; probe_id: string }): WebsiteProbeResult {
  const row = object(payload);
  const status = row.status as WebsiteStatus;
  if (!LOCATIONS[job.probe_id] || !['accessible', 'challenge', 'waf_challenge', 'restricted', 'tls_only', 'service_error', 'unreachable', 'config_error', 'internal_error'].includes(status)) throw invalid();
  const http = number(row.http_status, 100, 599);
  if (http !== null && !Number.isInteger(http)) throw invalid();
  if ((status === 'accessible' && (http === null || http < 200 || http >= 300))
    || (status === 'restricted' && ![401, 403, 429].includes(http!))
    || (status === 'challenge' && http === null)
    || (status === 'waf_challenge' && http !== 418)
    || (['tls_only', 'unreachable'].includes(status) && http !== null)
    || (status === 'service_error' && http !== null && http >= 200 && http < 300)) throw invalid();
  if (row.tls_authorized !== null && row.tls_authorized !== undefined && typeof row.tls_authorized !== 'boolean') throw invalid();
  const days = number(row.ssl_days_left, -36500, 36500);
  if (status === 'tls_only' && days === null) throw invalid();
  if (!Array.isArray(row.attempts) || row.attempts.length > 32) throw invalid();
  return { ...emptyProbeResult(status),
    domain_ok: ['config_error', 'internal_error'].includes(status) ? null : ['accessible', 'challenge', 'waf_challenge', 'restricted', 'tls_only'].includes(status),
    probe_location: LOCATIONS[job.probe_id], target_url: safeUrl(job.target_url),
    final_url: safeUrl(row.final_url), ssl_target_url: safeUrl(row.ssl_target_url),
    http_status: http, ssl_days_left: days, tls_authorized: row.tls_authorized as boolean ?? null,
    error_code: code(row.error_code), duration_ms: number(row.duration_ms, 0, 35000) ?? 0,
    root_fallback: row.root_fallback === true, retried: row.retried === true,
    attempts: row.attempts.map((value) => {
      const attempt = object(value);
      if (!['dns', 'http', 'tls'].includes(String(attempt.stage)) || ![1, 2].includes(Number(attempt.round))) throw invalid();
      return { stage: attempt.stage as 'dns' | 'http' | 'tls', url: safeUrl(attempt.url)!,
        round: Number(attempt.round), http_status: number(attempt.http_status, 100, 599), error_code: code(attempt.error_code) };
    }),
  };
}

export class WebsiteProbeQueue {
  constructor(private readonly pool: Pool) {}
  async ensureSchema(): Promise<void> {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS website_probe_jobs (
      job_id CHAR(36) PRIMARY KEY, group_id CHAR(36) NOT NULL, airport_id BIGINT UNSIGNED NOT NULL,
      probe_id VARCHAR(64) NOT NULL, target_url VARCHAR(4096) NOT NULL,
      status ENUM('queued','leased','completed') NOT NULL DEFAULT 'queued', lease_token CHAR(36) NULL,
      expires_at DATETIME NOT NULL, result_json JSON NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_website_probe_lease (probe_id,status,expires_at), INDEX idx_website_probe_group (group_id),
      CONSTRAINT fk_website_probe_airport FOREIGN KEY (airport_id) REFERENCES airports(id),
      CONSTRAINT fk_website_probe_identity FOREIGN KEY (probe_id) REFERENCES performance_probes(probe_id))`);
  }
  async inspect(airportId: number, website: string): Promise<WebsiteProbeResult[]> {
    const group = randomUUID();
    const url = normalizeWebsiteUrl(website);
    // No subscription/configuration dependency: website checks only need a globally enabled regional probe.
    await this.pool.execute(`INSERT INTO website_probe_jobs (job_id,group_id,airport_id,probe_id,target_url,expires_at)
      SELECT UUID(), ?, ?, probe_id, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 45 SECOND)
      FROM performance_probes WHERE globally_enabled = 1 AND probe_id IN ('cn-shanghai','cn-guangzhou')`, [group, airportId, url]);
    const deadline = Date.now() + 44000;
    while (Date.now() < deadline) {
      const [rows] = await this.pool.query<RowDataPacket[]>('SELECT status,result_json FROM website_probe_jobs WHERE group_id = ?', [group]);
      const results: WebsiteProbeResult[] = rows.filter((r) => r.result_json).map((r) => typeof r.result_json === 'string' ? JSON.parse(r.result_json) : r.result_json);
      if (!rows.length || rows.every((r) => r.status === 'completed')) return results;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const [rows] = await this.pool.query<RowDataPacket[]>('SELECT result_json FROM website_probe_jobs WHERE group_id = ? AND status = \'completed\'', [group]);
    return rows.map((r) => typeof r.result_json === 'string' ? JSON.parse(r.result_json) : r.result_json);
  }
  async lease(probeId: string): Promise<Record<string, unknown> | null> {
    if (!LOCATIONS[probeId]) return null;
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query<RowDataPacket[]>(`SELECT job_id,target_url FROM website_probe_jobs
        WHERE probe_id = ? AND status = 'queued' AND expires_at > DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 32 SECOND)
        ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`, [probeId]);
      if (!rows[0]) { await connection.commit(); return null; }
      const lease = randomUUID();
      await connection.execute('UPDATE website_probe_jobs SET status = \'leased\', lease_token = ? WHERE job_id = ?', [lease, rows[0].job_id]);
      await connection.commit();
      return { job_id: rows[0].job_id, target_url: rows[0].target_url, lease_token: lease };
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  async submit(probeId: string, value: unknown): Promise<void> {
    const row = object(value);
    if (typeof row.job_id !== 'string' || typeof row.lease_token !== 'string') throw invalid();
    const [jobs] = await this.pool.query<RowDataPacket[]>(`SELECT target_url,probe_id FROM website_probe_jobs
      WHERE job_id = ? AND probe_id = ? AND lease_token = ? AND status = 'leased' AND expires_at > CURRENT_TIMESTAMP`, [row.job_id, probeId, row.lease_token]);
    if (!jobs[0]) throw new HttpError(409, 'WEBSITE_PROBE_LEASE_INVALID', 'Website probe lease is unavailable');
    const result = decodeWebsiteObservation(row, { target_url: jobs[0].target_url, probe_id: probeId });
    const [updated] = await this.pool.execute<ResultSetHeader>(`UPDATE website_probe_jobs SET status = 'completed', result_json = ?
      WHERE job_id = ? AND probe_id = ? AND lease_token = ? AND status = 'leased' AND expires_at > CURRENT_TIMESTAMP`,
    [JSON.stringify(result), row.job_id, probeId, row.lease_token]);
    if (!updated.affectedRows) throw new HttpError(409, 'WEBSITE_PROBE_LEASE_INVALID', 'Website probe lease is unavailable');
  }
}
