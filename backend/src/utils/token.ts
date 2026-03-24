import { createHmac, timingSafeEqual } from 'node:crypto';

interface TokenPayload {
  sub: string;
  exp: number;
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
  const [payloadB64, signature] = token.split('.');
  if (!payloadB64 || !signature) {
    return false;
  }

  const expected = sign(secret, payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return false;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as TokenPayload;
    if (payload.sub !== 'admin' || !Number.isFinite(payload.exp)) {
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    return payload.exp > now;
  } catch {
    return false;
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
