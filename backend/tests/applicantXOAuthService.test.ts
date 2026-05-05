import test from 'node:test';
import assert from 'node:assert/strict';
import { ApplicantXOAuthService } from '../src/services/applicantXOAuthService';
import type { ApplicantAccount } from '../src/repositories/applicantAccountRepository';
import type {
  ApplicantXOAuthFlow,
  CreateApplicantXOAuthFlowInput,
  CompleteApplicantXOAuthFlowInput,
} from '../src/repositories/applicantXOAuthFlowRepository';

function createAccount(overrides: Partial<ApplicantAccount> = {}): ApplicantAccount {
  return {
    id: 1,
    application_id: 7,
    email: 'user@example.com',
    password_hash: 'hash',
    must_change_password: false,
    last_login_at: null,
    x_user_id: null,
    x_username: null,
    x_display_name: null,
    x_bound_at: null,
    created_at: '2026-05-04T10:00:00+08:00',
    updated_at: '2026-05-04T10:00:00+08:00',
    ...overrides,
  };
}

function createFlowRepository() {
  let nextId = 1;
  const flows: ApplicantXOAuthFlow[] = [];
  return {
    flows,
    create: async (input: CreateApplicantXOAuthFlowInput) => {
      flows.push({
        id: nextId,
        flow_type: input.flow_type,
        state: input.state,
        code_verifier: input.code_verifier,
        applicant_account_id: input.applicant_account_id ?? null,
        status: 'pending',
        handoff_code: null,
        handoff_expires_at: null,
        x_user_id: null,
        x_username: null,
        x_display_name: null,
        expires_at: new Date(input.expires_at).toISOString(),
        consumed_at: null,
        created_at: '2026-05-04T10:00:00+08:00',
        updated_at: '2026-05-04T10:00:00+08:00',
      });
      nextId += 1;
      return nextId - 1;
    },
    getPendingByState: async (state: string) => flows.find((flow) => flow.state === state && flow.status === 'pending') || null,
    complete: async (id: number, input: CompleteApplicantXOAuthFlowInput) => {
      const flow = flows.find((item) => item.id === id && item.status === 'pending');
      if (!flow) return false;
      Object.assign(flow, {
        status: 'completed',
        handoff_code: input.handoff_code ?? null,
        handoff_expires_at: input.handoff_expires_at ? new Date(input.handoff_expires_at).toISOString() : null,
        x_user_id: input.x_user_id,
        x_username: input.x_username,
        x_display_name: input.x_display_name,
      });
      return true;
    },
    expire: async (id: number, consumedAt: string) => {
      const flow = flows.find((item) => item.id === id && item.status === 'pending');
      if (!flow) return false;
      flow.status = 'expired';
      flow.consumed_at = consumedAt;
      return true;
    },
    consumeHandoffCode: async (handoffCode: string, consumedAt: string) => {
      const flow = flows.find((item) => item.handoff_code === handoffCode && item.status === 'completed');
      if (!flow) return null;
      flow.status = 'consumed';
      flow.consumed_at = consumedAt;
      return flow;
    },
  };
}

function createFetch(xUserId = 'x-123') {
  return (async (url: string | URL | Request) => {
    const target = String(url);
    if (target.includes('/oauth2/token')) {
      return new Response(JSON.stringify({ access_token: 'x-access-token' }), { status: 200 });
    }
    if (target.includes('/users/me')) {
      return new Response(JSON.stringify({ data: { id: xUserId, username: 'gaterank', name: 'GateRank' } }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;
}

const configFactory = () => ({
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://example.com/api/v1/portal/x-oauth/callback',
  authorizeUrl: 'https://x.com/i/oauth2/authorize',
  tokenUrl: 'https://api.x.com/2/oauth2/token',
  meUrl: 'https://api.x.com/2/users/me',
});

test('ApplicantXOAuthService rejects binding an X user already bound to another applicant', async () => {
  const flowRepository = createFlowRepository();
  const account = createAccount();
  const service = new ApplicantXOAuthService({
    applicantAccountRepository: {
      getById: async () => account,
      getByXUserId: async () => createAccount({ id: 2, x_user_id: 'x-123' }),
      bindXIdentity: async () => {
        throw new Error('should not bind');
      },
      unbindXIdentity: async () => true,
    },
    applicantXOAuthFlowRepository: flowRepository,
    fetchFn: createFetch(),
    configFactory,
  });

  await service.startBind(account.id);
  const flow = flowRepository.flows[0];
  await assert.rejects(
    service.handleCallback({ state: flow.state, code: 'auth-code' }),
    /该 X 账号已绑定其他申请人后台/,
  );
});

test('ApplicantXOAuthService creates and consumes X login handoff once', async () => {
  const flowRepository = createFlowRepository();
  const account = createAccount({ x_user_id: 'x-123', x_username: 'gaterank' });
  const service = new ApplicantXOAuthService({
    applicantAccountRepository: {
      getById: async () => account,
      getByXUserId: async (xUserId) => (xUserId === 'x-123' ? account : null),
      bindXIdentity: async () => true,
      unbindXIdentity: async () => true,
    },
    applicantXOAuthFlowRepository: flowRepository,
    fetchFn: createFetch(),
    configFactory,
  });

  await service.startLogin();
  const callback = await service.handleCallback({ state: flowRepository.flows[0].state, code: 'auth-code' });

  assert.equal(callback.flow_type, 'login');
  assert.ok(callback.handoff_code);
  const consumedAccount = await service.consumeLoginHandoff(callback.handoff_code!);
  assert.equal(consumedAccount.id, account.id);
  await assert.rejects(
    service.consumeLoginHandoff(callback.handoff_code!),
    /X 登录凭证已失效/,
  );
});
