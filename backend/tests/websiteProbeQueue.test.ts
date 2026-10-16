import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeWebsiteObservation, WebsiteProbeQueue } from '../src/services/websiteProbeQueue';
const job = { target_url: 'https://example.com/register?code=private#/signup', probe_id: 'cn-guangzhou' };
const payload = { status: 'accessible', domain_ok: true, http_status: 200, ssl_days_left: 88,
  tls_authorized: true, final_url: 'https://example.com/?secret=hidden', duration_ms: 20,
  attempts: [{ stage: 'http', url: 'https://example.com/?secret=hidden', round: 1, http_status: 200, error_code: null }] };
test('remote evidence uses server probe identity and strips queries and unknown fields', () => {
  const result = decodeWebsiteObservation({ ...payload, probe_location: 'forged', token: 'secret' }, job);
  assert.equal(result.probe_location, '广州');
  assert.equal(result.domain_ok, true);
  assert.doesNotMatch(JSON.stringify(result), /private|hidden|forged|secret|signup/);
});
test('a remote 418 cannot claim successful accessibility', () => {
  assert.throws(() => decodeWebsiteObservation({ ...payload, http_status: 418 }, job));
});
test('unknown TLS expiration cannot be represented as zero', () => {
  assert.equal(decodeWebsiteObservation({ ...payload, ssl_days_left: null }, job).ssl_days_left, null);
});
for (const changes of [{ status: 'bogus' }, { ssl_days_left: '88' }, { attempts: new Array(40).fill({}) }, { final_url: 'file:///etc/passwd' }]) {
  test(`reject invalid remote payload ${JSON.stringify(changes).slice(0,50)}`, () => {
    assert.throws(() => decodeWebsiteObservation({ ...payload, ...changes }, job));
  });
}
test('submissions are scoped by authenticated probe, lease token and expiration', async () => {
  let sql = '';
  let params: unknown[] = [];
  const queue = new WebsiteProbeQueue({ execute: async (statement: string, values: unknown[]) => {
    sql = statement; params = values; return [{ affectedRows: 0 }];
  }, query: async () => [[{ ...job, result_json: null }]] } as never);
  await assert.rejects(queue.submit('cn-shanghai', { ...payload, job_id: 'job', lease_token: 'lease' }));
  assert.match(sql, /probe_id = \?/);
  assert.match(sql, /lease_token = \?/);
  assert.match(sql, /expires_at > CURRENT_TIMESTAMP/);
  assert.ok(params.includes('cn-shanghai'));
  assert.ok(params.includes('lease'));
});
test('a fast successful site does not discard a slower site observation', async () => {
  let reads = 0;
  const second = { ...payload, probe_location:'广州' };
  const queue = new WebsiteProbeQueue({execute:async () => [{affectedRows:2}], query:async () => {
    reads++;
    return [[{status:'completed',result_json:payload}, reads === 1 ? {status:'leased',result_json:null} : {status:'completed',result_json:second}]];
  }} as never);
  assert.equal((await queue.inspect(42,'https://example.com/')).length,2);
});
