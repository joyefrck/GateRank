import { HttpError } from '../middleware/errorHandler';
import type { AccessTokenRecord } from '../repositories/accessTokenRepository';
import {
  generateAccessToken,
  hashAccessToken,
  hasRequiredScopes,
  maskAccessToken,
  normalizeAccessTokenScopes,
  type AccessTokenScope,
} from '../utils/accessToken';
import { formatSqlDateTimeInTimezone } from '../utils/time';

export interface AccessTokenAdminView {
  id: number;
  name: string;
  description: string;
  token_masked: string;
  scopes: AccessTokenScope[];
  status: 'active' | 'revoked';
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AccessTokenAdminListView {
  items: AccessTokenAdminView[];
}

export interface AccessTokenAdminCreateInput {
  name: string;
  description?: string;
  scopes: AccessTokenScope[];
  expires_at?: string | null;
}

export interface AccessTokenAdminCreateResult {
  token: AccessTokenAdminView;
  plain_token: string;
}

export interface AccessTokenAuthResult {
  id: number;
  name: string;
  scopes: AccessTokenScope[];
  actor: string;
}

interface AccessTokenServiceOptions {
  accessTokenRepository?: {
    listAll(): Promise<AccessTokenRecord[]>;
    getById(id: number): Promise<AccessTokenRecord | null>;
    getByHash(tokenHash: string): Promise<AccessTokenRecord | null>;
    create(input: {
      name: string;
      description: string;
      token_hash: string;
      token_masked: string;
      scopes: AccessTokenScope[];
      expires_at: string | null;
      created_by: string;
    }): Promise<number>;
    revoke(id: number): Promise<boolean>;
    touchLastUsed(id: number, ip: string | null): Promise<void>;
  };
}

export class AccessTokenService {
  private readonly accessTokenRepository?: AccessTokenServiceOptions['accessTokenRepository'];

  constructor(options: AccessTokenServiceOptions = {}) {
    this.accessTokenRepository = options.accessTokenRepository;
  }

  async listAdminTokens(): Promise<AccessTokenAdminListView> {
    return {
      items: (await this.getRepository().listAll()).map((record) => toAdminView(record)),
    };
  }

  async createAdminToken(input: AccessTokenAdminCreateInput, createdBy: string): Promise<AccessTokenAdminCreateResult> {
    const scopes = normalizeAccessTokenScopes(input.scopes);
    if (scopes.length === 0) {
      throw new HttpError(400, 'BAD_REQUEST', 'scopes 至少需要选择一项');
    }

    const name = String(input.name || '').trim();
    if (!name) {
      throw new HttpError(400, 'BAD_REQUEST', 'name 不能为空');
    }

    const description = String(input.description || '').trim();
    const expiresAt = normalizeExpiresAt(input.expires_at);
    const plainToken = generateAccessToken();
    const tokenHash = hashAccessToken(plainToken);

    const id = await this.getRepository().create({
      name,
      description,
      token_hash: tokenHash,
      token_masked: maskAccessToken(plainToken),
      scopes,
      expires_at: expiresAt,
      created_by: createdBy,
    });

    const record = await this.getRepository().getById(id);
    if (!record) {
      throw new Error(`failed to load created access token: ${id}`);
    }

    return {
      token: toAdminView(record),
      plain_token: plainToken,
    };
  }

  async revokeAdminToken(id: number): Promise<AccessTokenAdminView> {
    const record = await this.getRepository().getById(id);
    if (!record) {
      throw new HttpError(404, 'ACCESS_TOKEN_NOT_FOUND', `publish token ${id} not found`);
    }

    if (record.status !== 'revoked') {
      await this.getRepository().revoke(id);
    }

    const updated = await this.getRepository().getById(id);
    if (!updated) {
      throw new Error(`failed to load revoked access token: ${id}`);
    }

    return toAdminView(updated);
  }

  async authenticateToken(
    token: string,
    requiredScopes: readonly AccessTokenScope[],
    clientIp: string | null,
  ): Promise<AccessTokenAuthResult> {
    const trimmed = String(token || '').trim();
    if (!trimmed) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or missing publish token');
    }

    const record = await this.getRepository().getByHash(hashAccessToken(trimmed));
    if (!record || record.status !== 'active') {
      throw new HttpError(401, 'UNAUTHORIZED', 'Invalid or missing publish token');
    }

    if (record.expires_at && new Date(`${record.expires_at.replace(' ', 'T')}+08:00`).getTime() <= Date.now()) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Publish token expired');
    }

    if (!hasRequiredScopes(record.scopes, requiredScopes)) {
      throw new HttpError(403, 'FORBIDDEN', 'Publish token scope not allowed');
    }

    await this.getRepository().touchLastUsed(record.id, clientIp);

    return {
      id: record.id,
      name: record.name,
      scopes: record.scopes,
      actor: buildActor(record),
    };
  }

  private getRepository() {
    if (!this.accessTokenRepository) {
      throw new Error('accessTokenRepository is not configured');
    }
    return this.accessTokenRepository;
  }
}

function toAdminView(record: AccessTokenRecord): AccessTokenAdminView {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    token_masked: record.token_masked,
    scopes: record.scopes,
    status: record.status,
    expires_at: record.expires_at,
    last_used_at: record.last_used_at,
    last_used_ip: record.last_used_ip,
    created_by: record.created_by,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

function normalizeExpiresAt(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, 'BAD_REQUEST', 'expires_at must be valid datetime');
  }

  return formatSqlDateTimeInTimezone(parsed, 'Asia/Shanghai');
}

function buildActor(record: Pick<AccessTokenRecord, 'id' | 'name'>): string {
  return `publish_token:${record.name}#${record.id}`;
}
