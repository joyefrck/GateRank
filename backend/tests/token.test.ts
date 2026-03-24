import test from 'node:test';
import assert from 'node:assert/strict';
import { signAdminToken, verifyAdminToken } from '../src/utils/token';

test('token sign and verify works', () => {
  const { token } = signAdminToken('secret-1', 1);
  assert.equal(verifyAdminToken('secret-1', token), true);
  assert.equal(verifyAdminToken('secret-2', token), false);
});
