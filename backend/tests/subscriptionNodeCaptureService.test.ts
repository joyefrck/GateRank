import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpError } from '../src/middleware/errorHandler';
import { toSubscriptionNodeCaptureHttpError } from '../src/services/subscriptionNodeCaptureService';

test('subscription capture failures become safe actionable http errors', () => {
  const error = new Error('capture failed') as Error & { stdout: string };
  error.stdout = JSON.stringify({
    airport_count: 1,
    success_count: 0,
    failure_count: 1,
    failures: [{
      airport_id: 40,
      airport_name: '极速云机场',
      error: 'fetch failed for https://sub.example.com/s/private-token',
    }],
  });

  const result = toSubscriptionNodeCaptureHttpError(error);

  assert.ok(result instanceof HttpError);
  assert.equal(result.status, 502);
  assert.equal(result.code, 'SUBSCRIPTION_NODE_CAPTURE_FAILED');
  assert.match(result.message, /^获取订阅节点失败：/);
  assert.match(result.message, /极速云机场 #40/);
  assert.doesNotMatch(result.message, /sub\.example\.com|private-token/);
});
