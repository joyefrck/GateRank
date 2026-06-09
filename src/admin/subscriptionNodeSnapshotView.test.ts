import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSubscriptionNodeViewRows } from './subscriptionNodeSnapshotView';

test('subscription node view rows omit raw credentials', () => {
  const rows = buildSubscriptionNodeViewRows([
    {
      name: 'HK-1',
      region: 'HK',
      type: 'vless',
      raw_uri: 'vless://secret-uuid@hk.example.com:443?security=tls#HK-1',
      outbound: {
        server: 'hk.example.com',
        server_port: 443,
        uuid: 'secret-uuid',
        password: 'secret-password',
        network: 'ws',
        security: 'tls',
      },
    },
  ]);

  assert.deepEqual(rows, [
    {
      name: 'HK-1',
      region: 'HK',
      type: 'vless',
      server: 'hk.example.com',
      port: '443',
      transportSecurity: 'ws / TLS',
    },
  ]);
  const renderedPayload = JSON.stringify(rows);
  assert.doesNotMatch(renderedPayload, /raw_uri|secret-uuid|secret-password|vless:\/\//);
});
