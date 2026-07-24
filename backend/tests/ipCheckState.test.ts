import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveIpCheckErrorMessage,
  resolveVisibleQuery,
  shouldUseIpifyFallback,
} from '../../src/pages/ipCheck/ipCheckState';

test('uses ipify only when automatic server detection needs a client IP', () => {
  assert.equal(shouldUseIpifyFallback('IP_CHECK_CLIENT_IP_REQUIRED', undefined), true);
  assert.equal(shouldUseIpifyFallback('IP_CHECK_CLIENT_IP_REQUIRED', 'example.com'), false);
  assert.equal(shouldUseIpifyFallback('IP_CHECK_UPSTREAM_ERROR', undefined), false);
});

test('preserves manual input and displays resolved IP for automatic detection', () => {
  assert.equal(resolveVisibleQuery('example.com', '93.184.216.34'), 'example.com');
  assert.equal(resolveVisibleQuery(undefined, '8.8.8.8'), '8.8.8.8');
});

test('resolves localized stable error messages', () => {
  assert.match(resolveIpCheckErrorMessage('IP_CHECK_UPSTREAM_TIMEOUT', 'zh'), /超时/);
  assert.match(resolveIpCheckErrorMessage('IP_CHECK_UPSTREAM_TIMEOUT', 'en'), /timed out/i);
  assert.match(resolveIpCheckErrorMessage('UNKNOWN', 'zh'), /网络/);
});
