import { createHmac, timingSafeEqual } from 'node:crypto';

interface TokenPayload {
  sub: string;
  exp: number;
  applicant_id?: number;
  email?: string;
}

export function signAdminToken(secret: string, ttlHours: number): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const payload: TokenPayload = {
    sub: 'admin',
    exp: Math.floor(expiresAt.getTime() / 1000),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(secret, payloadB64);
  return { token: `${payloadB64}.${signature}`, expiresAt };
}

export function verifyAdminToken(secret: string, token: string): boolean {
  const payload = verifyToken(secret, token);
  return Boolean(payload && payload.sub === 'admin');
}

export function signApplicantToken(
  secret: string,
  applicantId: number,
  email: string,
  ttlHours: number,
): { token: string; expiresAt: Date } {
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
  const payload: TokenPayload = {
    sub: 'applicant',
    applicant_id: applicantId,
    email,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(secret, payloadB64);
  return { token: `${payloadB64}.${signature}`, expiresAt };
}

export interface VerifiedApplicantToken {
  applicant_id: number;
  email: string;
  exp: number;
}

export function verifyApplicantToken(secret: string, token: string): VerifiedApplicantToken | null {
  const payload = verifyToken(secret, token);
  if (!payload || payload.sub !== 'applicant') {
    return null;
  }
  if (!Number.isInteger(payload.applicant_id) || payload.applicant_id! <= 0) {
    return null;
  }
  if (typeof payload.email !== 'string' || payload.email.trim() === '') {
    return null;
  }

  return {
    applicant_id: payload.applicant_id!,
    email: payload.email!,
    exp: payload.exp,
  };
}

function verifyToken(secret: string, token: string): TokenPayload | null {
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) {
    return null;
  }

  const expected = sign(secret, payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as TokenPayload;
    if (typeof payload.sub !== 'string' || !Number.isFinite(payload.exp)) {
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now ? payload : null;
  } catch {
    return null;
  }
}

function sign(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}
