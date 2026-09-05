import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { downloadFilename, retryAfterDeadline, startToolDownload } from './toolDownloadTransfer';

class Request {
  status = 200;
  response = new Blob(['package-content']);
  headers: Record<string, string> = { 'Content-Disposition': "attachment; filename*=UTF-8''%E5%AE%89%E8%A3%85%E5%8C%85.zip" };
  onprogress: any; onload: any; onerror: any; ontimeout: any;
  aborted = false;
  sent = 0;
  open() {} send() { this.sent++; } abort() { this.aborted = true; }
  getResponseHeader(key: string) { return this.headers[key] || null; }
}
function setup(request = new Request()) {
  const progress: any[] = [], completed: any[] = [], failed: any[] = [];
  const stop = startToolDownload('/download/file/test?platform=windows', 'fallback.zip', {
    progress: (value) => progress.push(value), complete: (blob, filename) => completed.push({ blob, filename }), failure: (error) => failed.push(error),
  }, () => request as unknown as XMLHttpRequest);
  return { request, progress, completed, failed, stop };
}
test('transfer reports real known/unknown sizes and preserves downloaded bytes and filename', async () => {
  const result = setup();
  result.request.onprogress({ loaded: 5, total: 15, lengthComputable: true });
  result.request.onprogress({ loaded: 10, total: 0, lengthComputable: false });
  assert.deepEqual(result.progress, [{ loaded: 5, total: 15 }, { loaded: 10, total: null }]);
  result.request.onload();
  assert.equal(result.request.sent, 1);
  assert.equal(result.completed[0].filename, '安装包.zip');
  const digest = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
  assert.equal(digest(new Uint8Array(await result.completed[0].blob.arrayBuffer())), digest('package-content'));
  result.stop();
});
test('cancel detaches events and prevents stale completion from saving', () => {
  const result = setup();
  const lateLoad = result.request.onload;
  result.stop(); lateLoad();
  assert.equal(result.request.aborted, true);
  assert.equal(result.request.onprogress, null);
  assert.deepEqual(result.completed, []);
});
test('HTTP errors and network errors never save error bodies; 429 observes Retry-After', () => {
  for (const status of [403, 404, 429, 500]) {
    const result = setup(); result.request.status = status;
    result.request.headers['Retry-After'] = '120';
    const now = Date.now(); result.request.onload();
    assert.equal(result.completed.length, 0);
    assert.equal(result.failed.length, 1);
    if (status === 429) assert.ok(result.failed[0].retryAt >= now + 120_000);
    result.stop();
  }
  const result = setup(); result.request.onerror();
  assert.match(result.failed[0].message, /网络/);
  result.stop();
});
test('filename parsing sanitizes paths and retry supports HTTP date', () => {
  assert.equal(downloadFilename('attachment; filename="../test.zip"', 'fallback.zip'), '.._test.zip');
  assert.equal(downloadFilename("attachment; filename*=UTF-8''%broken", 'fallback.zip'), 'fallback.zip');
  assert.equal(retryAfterDeadline('Wed, 21 Oct 2015 07:28:00 GMT', 0), Date.parse('2015-10-21T07:28:00Z'));
});
