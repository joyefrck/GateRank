import { createPrivateKey, createPublicKey, createSign, createVerify } from 'node:crypto';

export function buildRsaSignPayload(params: Record<string, unknown>): string {
  return Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && key !== 'sign_type' && isSignableValue(value))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('&');
}

export function signWithRsaPrivateKey(payload: string, privateKeyPem: string): string {
  const signer = createSign('RSA-SHA256');
  signer.update(payload, 'utf8');
  signer.end();
  return signer.sign(parsePrivateKey(privateKeyPem), 'base64');
}

export function verifyWithRsaPublicKey(
  payload: string,
  signature: string,
  publicKeyPem: string,
): boolean {
  const verifier = createVerify('RSA-SHA256');
  verifier.update(payload, 'utf8');
  verifier.end();
  try {
    return verifier.verify(parsePublicKey(publicKeyPem), signature, 'base64');
  } catch {
    return false;
  }
}

export function canParseRsaPrivateKey(value: string): boolean {
  try {
    parsePrivateKey(value);
    return true;
  } catch {
    return false;
  }
}

export function canParseRsaPublicKey(value: string): boolean {
  try {
    parsePublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function parsePrivateKey(value: string) {
  const attempts = buildPrivateKeyCandidates(value, [
    { pemLabel: 'PRIVATE KEY', derType: 'pkcs8' },
    { pemLabel: 'RSA PRIVATE KEY', derType: 'pkcs1' },
  ]);

  for (const attempt of attempts) {
    try {
      if (typeof attempt === 'string') {
        return createPrivateKey(attempt);
      }
      return createPrivateKey(attempt);
    } catch {
      continue;
    }
  }

  throw new Error('Unsupported merchant private key format');
}

function parsePublicKey(value: string) {
  const attempts = buildPublicKeyCandidates(value, [
    { pemLabel: 'PUBLIC KEY', derType: 'spki' },
    { pemLabel: 'RSA PUBLIC KEY', derType: 'pkcs1' },
  ]);

  for (const attempt of attempts) {
    try {
      if (typeof attempt === 'string') {
        return createPublicKey(attempt);
      }
      return createPublicKey(attempt);
    } catch {
      continue;
    }
  }

  throw new Error('Unsupported platform public key format');
}

function buildPrivateKeyCandidates(
  value: string,
  kinds: Array<{ pemLabel: string; derType: 'pkcs1' | 'pkcs8' }>,
): Array<string | { key: Buffer; format: 'der'; type: 'pkcs1' | 'pkcs8' }> {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return [''];
  }

  const candidates: Array<string | { key: Buffer; format: 'der'; type: 'pkcs1' | 'pkcs8' }> = [trimmed];

  if (containsPemHeader(trimmed)) {
    return candidates;
  }

  const compact = trimmed.replace(/\s+/g, '');
  if (!isBase64Key(compact)) {
    return candidates;
  }

  for (const kind of kinds) {
    candidates.push(wrapPem(compact, kind.pemLabel));
  }

  const der = Buffer.from(compact, 'base64');
  for (const kind of kinds) {
    candidates.push({
      key: der,
      format: 'der',
      type: kind.derType,
    });
  }

  return candidates;
}

function buildPublicKeyCandidates(
  value: string,
  kinds: Array<{ pemLabel: string; derType: 'pkcs1' | 'spki' }>,
): Array<string | { key: Buffer; format: 'der'; type: 'pkcs1' | 'spki' }> {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return [''];
  }

  const candidates: Array<string | { key: Buffer; format: 'der'; type: 'pkcs1' | 'spki' }> = [trimmed];

  if (containsPemHeader(trimmed)) {
    return candidates;
  }

  const compact = trimmed.replace(/\s+/g, '');
  if (!isBase64Key(compact)) {
    return candidates;
  }

  for (const kind of kinds) {
    candidates.push(wrapPem(compact, kind.pemLabel));
  }

  const der = Buffer.from(compact, 'base64');
  for (const kind of kinds) {
    candidates.push({
      key: der,
      format: 'der',
      type: kind.derType,
    });
  }

  return candidates;
}

function containsPemHeader(value: string): boolean {
  return /-----BEGIN [A-Z ]+-----/.test(value);
}

function isBase64Key(value: string): boolean {
  return value.length > 0 && value.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(value);
}

function wrapPem(value: string, label: string): string {
  const lines = value.match(/.{1,64}/g) || [value];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

function isSignableValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  if (Array.isArray(value)) {
    return false;
  }
  if (typeof value === 'string') {
    return value !== '';
  }
  if (typeof value === 'object') {
    return false;
  }
  return true;
}
