import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  signWithRsaPrivateKey,
  verifyWithRsaPublicKey,
} from '../src/utils/rsaSignature';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 1024,
});

const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privateRaw = stripPem(privatePem);
const publicRaw = stripPem(publicPem);

test('rsaSignature signs and verifies PEM keys', () => {
  const payload = 'money=1000.00&name=GateRank&pid=28615';
  const signature = signWithRsaPrivateKey(payload, privatePem);
  assert.equal(verifyWithRsaPublicKey(payload, signature, publicPem), true);
});

test('rsaSignature signs and verifies raw base64 keys from gateway console', () => {
  const payload = 'money=1000.00&name=GateRank&type=alipay';
  const signature = signWithRsaPrivateKey(payload, privateRaw);
  assert.equal(verifyWithRsaPublicKey(payload, signature, publicRaw), true);
});

function stripPem(value: string): string {
  return value
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '');
}
