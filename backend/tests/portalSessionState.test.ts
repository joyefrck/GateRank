import assert from 'node:assert/strict';
import test from 'node:test';
import { portalLoadError, readPortalResponse } from '../../src/portal/session';

async function loadError(status: number, body: unknown): Promise<unknown> {
  try {
    await readPortalResponse(new Response(JSON.stringify(body), { status }));
    assert.fail('Expected response to reject');
  } catch (error) {
    return error;
  }
}

test('only the initial anonymous session probe suppresses a missing-login notice', async () => {
  const error = await loadError(401, { code: 'PORTAL_AUTH_REQUIRED' });
  assert.equal(portalLoadError(error, true), '');
  assert.equal(portalLoadError(error), '登录已失效，请重新登录');
});

test('invalid sessions and unexpected failures remain visible on initial opening', async () => {
  for (const body of [{ code: 'UNAUTHORIZED' }, {}, null]) {
    assert.equal(portalLoadError(await loadError(401, body), true), '登录已失效，请重新登录');
  }
  assert.equal(portalLoadError(await loadError(503, { message: '服务暂时不可用' }), true), '服务暂时不可用');
  assert.equal(portalLoadError(new Error('网络异常'), true), '网络异常');
});

test('authenticated session responses retain the returned account data', async () => {
  const data = { account: { id: 1, email: 'user@example.com' } };
  assert.deepEqual(await readPortalResponse(new Response(JSON.stringify(data))), data);
});
