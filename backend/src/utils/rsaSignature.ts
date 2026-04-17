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
  return signer.sign(createPrivateKey(privateKeyPem), 'base64');
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
    return verifier.verify(createPublicKey(publicKeyPem), signature, 'base64');
  } catch {
    return false;
  }
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
