import test from 'node:test';
import assert from 'node:assert/strict';
import {
  signAdminToken,
  signApplicantToken,
  verifyAdminToken,
  verifyApplicantToken,
} from '../src/utils/token';

test('token sign and verify works', () => {
  const { token } = signAdminToken('secret-1', 1);
  assert.equal(verifyAdminToken('secret-1', token), true);
  assert.equal(verifyAdminToken('secret-2', token), false);
});

test('applicant token sign and verify works', () => {
  const { token } = signApplicantToken('portal-secret', 7, 'user@example.com', 1);
  const payload = verifyApplicantToken('portal-secret', token);
  assert.equal(payload?.applicant_id, 7);
  assert.equal(payload?.email, 'user@example.com');
  assert.equal(verifyApplicantToken('wrong-secret', token), null);
});
