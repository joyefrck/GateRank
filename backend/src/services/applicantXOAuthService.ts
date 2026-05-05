import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from '../middleware/errorHandler';
import type { ApplicantAccount, ApplicantXIdentityInput } from '../repositories/applicantAccountRepository';
import type {
  ApplicantXOAuthFlow,
  ApplicantXOAuthFlowRepository,
  ApplicantXOAuthFlowType,
} from '../repositories/applicantXOAuthFlowRepository';
import { formatSqlDateTimeInTimezone } from '../utils/time';
import { getXOAuthConfig, isXOAuthConfigured, type XOAuthConfig } from '../utils/xOAuthConfig';

const DEFAULT_X_OAUTH_SCOPE = 'tweet.read users.read';
const FLOW_TTL_MS = 10 * 60 * 1000;
const HANDOFF_TTL_MS = 2 * 60 * 1000;

interface XOAuthRuntimeConfig extends XOAuthConfig {
  enabled?: boolean;
  scope?: string;
  codeChallengeMethod?: 'plain' | 'S256';
}

interface ApplicantXOAuthServiceOptions {
  applicantAccountRepository: {
    getById(id: number): Promise<ApplicantAccount | null>;
    getByXUserId(xUserId: string): Promise<ApplicantAccount | null>;
    bindXIdentity(id: number, input: ApplicantXIdentityInput): Promise<boolean>;
    unbindXIdentity(id: number): Promise<boolean>;
  };
  applicantXOAuthFlowRepository: Pick<
    ApplicantXOAuthFlowRepository,
    'create' | 'getPendingByState' | 'complete' | 'expire' | 'consumeHandoffCode'
  >;
  fetchFn?: typeof fetch;
  configFactory?: () => XOAuthRuntimeConfig | Promise<XOAuthRuntimeConfig>;
}

interface XUserIdentity {
  id: string;
  username: string | null;
  name: string | null;
}

export class ApplicantXOAuthService {
  private readonly applicantAccountRepository: ApplicantXOAuthServiceOptions['applicantAccountRepository'];
  private readonly applicantXOAuthFlowRepository: ApplicantXOAuthServiceOptions['applicantXOAuthFlowRepository'];
  private readonly fetchFn: typeof fetch;
  private readonly configFactory: () => XOAuthRuntimeConfig | Promise<XOAuthRuntimeConfig>;

  constructor(options: ApplicantXOAuthServiceOptions) {
    this.applicantAccountRepository = options.applicantAccountRepository;
    this.applicantXOAuthFlowRepository = options.applicantXOAuthFlowRepository;
    this.fetchFn = options.fetchFn || fetch;
    this.configFactory = options.configFactory || getXOAuthConfig;
  }

  async startBind(applicantAccountId: number): Promise<{ authorization_url: string; expires_at: string }> {
    await this.requireApplicantAccount(applicantAccountId);
    return this.startFlow('bind', applicantAccountId);
  }

  async startLogin(): Promise<{ authorization_url: string; expires_at: string }> {
    return this.startFlow('login', null);
  }

  async handleCallback(input: { state: string; code: string }): Promise<{
    flow_type: ApplicantXOAuthFlowType;
    handoff_code: string | null;
  }> {
    const flow = await this.requirePendingFlow(input.state);
    const now = new Date();
    const consumedAt = formatSqlDateTimeInTimezone(now, 'Asia/Shanghai');
    if (new Date(flow.expires_at).getTime() <= now.getTime()) {
      await this.applicantXOAuthFlowRepository.expire(flow.id, consumedAt);
      throw new HttpError(400, 'X_OAUTH_STATE_EXPIRED', 'X 授权已过期，请重新发起绑定或登录');
    }

    const identity = await this.fetchXIdentity(input.code, flow.code_verifier);
    if (flow.flow_type === 'bind') {
      if (!flow.applicant_account_id) {
        throw new HttpError(400, 'BAD_REQUEST', 'X 绑定流程缺少申请人账号');
      }
      const existing = await this.applicantAccountRepository.getByXUserId(identity.id);
      if (existing && existing.id !== flow.applicant_account_id) {
        throw new HttpError(409, 'X_ACCOUNT_ALREADY_BOUND', '该 X 账号已绑定其他申请人后台');
      }
      await this.applicantAccountRepository.bindXIdentity(flow.applicant_account_id, {
        x_user_id: identity.id,
        x_username: identity.username,
        x_display_name: identity.name,
        x_bound_at: consumedAt,
      });
      await this.applicantXOAuthFlowRepository.complete(flow.id, {
        x_user_id: identity.id,
        x_username: identity.username,
        x_display_name: identity.name,
      });
      return { flow_type: 'bind', handoff_code: null };
    }

    const account = await this.applicantAccountRepository.getByXUserId(identity.id);
    if (!account) {
      await this.applicantXOAuthFlowRepository.complete(flow.id, {
        x_user_id: identity.id,
        x_username: identity.username,
        x_display_name: identity.name,
      });
      throw new HttpError(401, 'X_ACCOUNT_NOT_BOUND', '该 X 账号尚未绑定申请人后台，请先使用邮箱登录后绑定');
    }

    const handoffCode = randomToken();
    await this.applicantXOAuthFlowRepository.complete(flow.id, {
      handoff_code: handoffCode,
      handoff_expires_at: formatSqlDateTimeInTimezone(new Date(now.getTime() + HANDOFF_TTL_MS), 'Asia/Shanghai'),
      x_user_id: identity.id,
      x_username: identity.username,
      x_display_name: identity.name,
    });

    return { flow_type: 'login', handoff_code: handoffCode };
  }

  async consumeLoginHandoff(handoffCode: string): Promise<ApplicantAccount> {
    const consumedAt = formatSqlDateTimeInTimezone(new Date(), 'Asia/Shanghai');
    const flow = await this.applicantXOAuthFlowRepository.consumeHandoffCode(handoffCode, consumedAt);
    if (!flow || !flow.handoff_expires_at || new Date(flow.handoff_expires_at).getTime() <= Date.now()) {
      throw new HttpError(401, 'X_LOGIN_CODE_INVALID', 'X 登录凭证已失效，请重新登录');
    }
    if (!flow.x_user_id) {
      throw new HttpError(401, 'X_LOGIN_CODE_INVALID', 'X 登录凭证无效，请重新登录');
    }
    const account = await this.applicantAccountRepository.getByXUserId(flow.x_user_id);
    if (!account) {
      throw new HttpError(401, 'X_ACCOUNT_NOT_BOUND', '该 X 账号尚未绑定申请人后台，请先使用邮箱登录后绑定');
    }
    return account;
  }

  async unbind(applicantAccountId: number): Promise<void> {
    await this.requireApplicantAccount(applicantAccountId);
    await this.applicantAccountRepository.unbindXIdentity(applicantAccountId);
  }

  private async startFlow(
    flowType: ApplicantXOAuthFlowType,
    applicantAccountId: number | null,
  ): Promise<{ authorization_url: string; expires_at: string }> {
    const config = await this.requireConfig();
    const state = randomToken();
    const codeVerifier = randomToken();
    const codeChallengeMethod = config.codeChallengeMethod || 'plain';
    const codeChallenge = codeChallengeMethod === 'S256'
      ? createHash('sha256').update(codeVerifier).digest('base64url')
      : codeVerifier;
    const expiresAt = new Date(Date.now() + FLOW_TTL_MS);

    await this.applicantXOAuthFlowRepository.create({
      flow_type: flowType,
      state,
      code_verifier: codeVerifier,
      applicant_account_id: applicantAccountId,
      expires_at: formatSqlDateTimeInTimezone(expiresAt, 'Asia/Shanghai'),
    });

    const authorizationUrl = buildAuthorizeUrl(config.authorizeUrl, {
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope || DEFAULT_X_OAUTH_SCOPE,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
    });

    return {
      authorization_url: authorizationUrl,
      expires_at: expiresAt.toISOString(),
    };
  }

  private async requirePendingFlow(state: string): Promise<ApplicantXOAuthFlow> {
    const flow = await this.applicantXOAuthFlowRepository.getPendingByState(state);
    if (!flow) {
      throw new HttpError(400, 'X_OAUTH_STATE_INVALID', 'X 授权状态无效，请重新发起绑定或登录');
    }
    return flow;
  }

  private async requireApplicantAccount(applicantAccountId: number): Promise<ApplicantAccount> {
    const account = await this.applicantAccountRepository.getById(applicantAccountId);
    if (!account) {
      throw new HttpError(401, 'UNAUTHORIZED', '登录已失效，请重新登录');
    }
    return account;
  }

  async getReturnOrigin(): Promise<string | null> {
    const config = await this.configFactory();
    if (!config.redirectUri) {
      return null;
    }
    try {
      const url = new URL(config.redirectUri);
      return `${url.protocol}//${url.host}`;
    } catch {
      return null;
    }
  }

  private async requireConfig(): Promise<XOAuthRuntimeConfig> {
    const config = await this.configFactory();
    if (config.enabled === false || !isXOAuthConfigured(config)) {
      throw new HttpError(503, 'X_OAUTH_NOT_CONFIGURED', 'X 登录尚未配置，请联系管理员');
    }
    return config;
  }

  private async fetchXIdentity(code: string, codeVerifier: string): Promise<XUserIdentity> {
    const config = await this.requireConfig();
    const tokenResponse = await this.fetchFn(config.tokenUrl, {
      method: 'POST',
      headers: this.buildTokenHeaders(config),
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
        client_id: config.clientId,
      }),
    });
    if (!tokenResponse.ok) {
      throw new HttpError(502, 'X_OAUTH_TOKEN_EXCHANGE_FAILED', 'X 授权换取访问凭证失败');
    }
    const tokenData = await tokenResponse.json() as { access_token?: string };
    if (!tokenData.access_token) {
      throw new HttpError(502, 'X_OAUTH_TOKEN_EXCHANGE_FAILED', 'X 授权未返回访问凭证');
    }

    const meUrl = new URL(config.meUrl);
    meUrl.searchParams.set('user.fields', 'username,name');
    const userResponse = await this.fetchFn(meUrl.toString(), {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });
    if (!userResponse.ok) {
      throw new HttpError(502, 'X_OAUTH_PROFILE_FAILED', '读取 X 用户资料失败');
    }
    const userData = await userResponse.json() as {
      data?: { id?: string; username?: string; name?: string };
    };
    const id = String(userData.data?.id || '').trim();
    if (!id) {
      throw new HttpError(502, 'X_OAUTH_PROFILE_FAILED', 'X 用户资料缺少用户 ID');
    }
    return {
      id,
      username: stringOrNull(userData.data?.username),
      name: stringOrNull(userData.data?.name),
    };
  }

  private buildTokenHeaders(config: XOAuthConfig): Headers {
    const headers = new Headers();
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
    if (config.clientSecret) {
      headers.set(
        'Authorization',
        `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      );
    }
    return headers;
  }
}

function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function buildAuthorizeUrl(baseUrl: string, params: Record<string, string>): string {
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${query}`;
}

function stringOrNull(value: unknown): string | null {
  const result = String(value || '').trim();
  return result ? result : null;
}
