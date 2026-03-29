import test from 'node:test';
import assert from 'node:assert/strict';
import { AccessTokenService } from '../src/services/accessTokenService';
import { hashAccessToken } from '../src/utils/accessToken';

test('AccessTokenService creates token without storing plaintext', async () => {
  const stored: Array<Record<string, unknown>> = [];
  let nextId = 1;

  const service = new AccessTokenService({
    accessTokenRepository: {
      listAll: async () => [],
      getById: async (id) => ({
        id,
        name: 'Openclaw 自动推文',
        description: '用于 AI 发稿',
        token_hash: String(stored[0]?.token_hash || ''),
        token_masked: String(stored[0]?.token_masked || ''),
        scopes: ['news:create', 'news:publish'],
        status: 'active',
        expires_at: null,
        last_used_at: null,
        last_used_ip: null,
        created_by: 'admin',
        created_at: '2026-03-29 10:00:00',
        updated_at: '2026-03-29 10:00:00',
      }),
      getByHash: async () => null,
      create: async (input) => {
        stored.push({ ...input });
        return nextId++;
      },
      revoke: async () => true,
      touchLastUsed: async () => undefined,
    },
  });

  const result = await service.createAdminToken({
    name: 'Openclaw 自动推文',
    description: '用于 AI 发稿',
    scopes: ['news:create', 'news:publish'],
  }, 'admin');

  assert.match(result.plain_token, /^grpt_/);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].token_hash, hashAccessToken(result.plain_token));
  assert.notEqual(stored[0].token_hash, result.plain_token);
  assert.ok(String(stored[0].token_masked).includes('***'));
});

test('AccessTokenService rejects revoked, expired and scope-mismatched tokens', async () => {
  const service = new AccessTokenService({
    accessTokenRepository: {
      listAll: async () => [],
      getById: async () => null,
      getByHash: async (tokenHash) => {
        if (tokenHash === hashAccessToken('grpt_active')) {
          return {
            id: 1,
            name: 'active',
            description: '',
            token_hash: tokenHash,
            token_masked: 'grpt_acti***ctive',
            scopes: ['news:create'],
            status: 'active',
            expires_at: null,
            last_used_at: null,
            last_used_ip: null,
            created_by: 'admin',
            created_at: '2026-03-29 10:00:00',
            updated_at: '2026-03-29 10:00:00',
          };
        }
        if (tokenHash === hashAccessToken('grpt_revoked')) {
          return {
            id: 2,
            name: 'revoked',
            description: '',
            token_hash: tokenHash,
            token_masked: 'grpt_revo***oked',
            scopes: ['news:create'],
            status: 'revoked',
            expires_at: null,
            last_used_at: null,
            last_used_ip: null,
            created_by: 'admin',
            created_at: '2026-03-29 10:00:00',
            updated_at: '2026-03-29 10:00:00',
          };
        }
        if (tokenHash === hashAccessToken('grpt_expired')) {
          return {
            id: 3,
            name: 'expired',
            description: '',
            token_hash: tokenHash,
            token_masked: 'grpt_expi***ired',
            scopes: ['news:create'],
            status: 'active',
            expires_at: '2020-01-01 00:00:00',
            last_used_at: null,
            last_used_ip: null,
            created_by: 'admin',
            created_at: '2026-03-29 10:00:00',
            updated_at: '2026-03-29 10:00:00',
          };
        }
        return null;
      },
      create: async () => 1,
      revoke: async () => true,
      touchLastUsed: async () => undefined,
    },
  });

  await assert.rejects(
    () => service.authenticateToken('grpt_revoked', ['news:create'], null),
    /Invalid or missing publish token/,
  );
  await assert.rejects(
    () => service.authenticateToken('grpt_expired', ['news:create'], null),
    /Publish token expired/,
  );
  await assert.rejects(
    () => service.authenticateToken('grpt_active', ['news:publish'], null),
    /Publish token scope not allowed/,
  );
});

test('AccessTokenService updates last_used_at on successful auth', async () => {
  const touches: Array<{ id: number; ip: string | null }> = [];
  const service = new AccessTokenService({
    accessTokenRepository: {
      listAll: async () => [],
      getById: async () => null,
      getByHash: async () => ({
        id: 7,
        name: 'openclaw',
        description: '',
        token_hash: hashAccessToken('grpt_ok'),
        token_masked: 'grpt_ok***ptok',
        scopes: ['news:create', 'news:publish'],
        status: 'active',
        expires_at: null,
        last_used_at: null,
        last_used_ip: null,
        created_by: 'admin',
        created_at: '2026-03-29 10:00:00',
        updated_at: '2026-03-29 10:00:00',
      }),
      create: async () => 1,
      revoke: async () => true,
      touchLastUsed: async (id, ip) => {
        touches.push({ id, ip });
      },
    },
  });

  const auth = await service.authenticateToken('grpt_ok', ['news:create'], '127.0.0.1');

  assert.equal(auth.actor, 'publish_token:openclaw#7');
  assert.deepEqual(touches, [{ id: 7, ip: '127.0.0.1' }]);
});
