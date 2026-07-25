import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  DNS_LEAK_TEST_TOTAL_PROBES,
  type DnsLeakObservation,
} from '../../../shared/dnsLeakTest';

const SESSION_ID_PATTERN = /^[a-f0-9]{32}$/;
const MAC_PATTERN = /^[a-f0-9]{32}$/;

export interface DnsProbeTokenPayload {
  sessionId: string;
  probeIndex: number;
  expiresAt: number;
}

export function buildDnsProbeHostname(
  payload: DnsProbeTokenPayload,
  zone: string,
  secret: string,
): string {
  const normalizedZone = normalizeDnsZone(zone);
  validatePayload(payload);
  requireSecret(secret);
  const expiry = Math.floor(payload.expiresAt / 1000).toString(36);
  const index = payload.probeIndex.toString(36);
  const mac = signProbeLabels(payload.sessionId, index, expiry, secret);
  return `${payload.sessionId}.${index}.${expiry}.${mac}.${normalizedZone}`;
}

export function verifyDnsProbeHostname(
  hostname: string,
  zone: string,
  secret: string,
  now = Date.now(),
): DnsProbeTokenPayload | null {
  const normalizedZone = normalizeDnsZone(zone);
  requireSecret(secret);
  const normalizedHostname = normalizeDnsZone(hostname);
  const suffix = `.${normalizedZone}`;
  if (!normalizedHostname.endsWith(suffix)) return null;

  const prefix = normalizedHostname.slice(0, -suffix.length);
  const labels = prefix.split('.');
  if (labels.length !== 4) return null;
  const [sessionId, indexLabel, expiryLabel, actualMac] = labels;
  if (!SESSION_ID_PATTERN.test(sessionId) || !MAC_PATTERN.test(actualMac)) return null;
  if (!/^[0-9a-z]+$/.test(indexLabel) || !/^[0-9a-z]+$/.test(expiryLabel)) return null;

  const probeIndex = Number.parseInt(indexLabel, 36);
  const expiresAt = Number.parseInt(expiryLabel, 36) * 1000;
  if (
    !Number.isSafeInteger(probeIndex)
    || probeIndex < 0
    || probeIndex >= DNS_LEAK_TEST_TOTAL_PROBES
    || !Number.isSafeInteger(expiresAt)
    || expiresAt <= now
  ) {
    return null;
  }

  const expectedMac = signProbeLabels(sessionId, indexLabel, expiryLabel, secret);
  if (!safeEqual(actualMac, expectedMac)) return null;
  return { sessionId, probeIndex, expiresAt };
}

export function signDnsProbeCallback(body: string, timestamp: string, secret: string): string {
  requireSecret(secret);
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

export function canonicalizeDnsLeakObservation(observation: DnsLeakObservation): string {
  return JSON.stringify({
    event_id: observation.event_id,
    session_id: observation.session_id,
    probe_index: observation.probe_index,
    resolver_ip: observation.resolver_ip,
    query_type: observation.query_type,
    dnssec_ok: observation.dnssec_ok,
    observed_at: observation.observed_at,
  });
}

export function verifyDnsProbeCallback(
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
  now = Date.now(),
  toleranceMs = 60_000,
): boolean {
  requireSecret(secret);
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const requestTime = Number(timestamp) * 1000;
  if (!Number.isSafeInteger(requestTime) || Math.abs(now - requestTime) > toleranceMs) return false;
  return safeEqual(signature, signDnsProbeCallback(body, timestamp, secret));
}

export function normalizeDnsZone(value: string): string {
  const zone = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  if (
    !zone
    || zone.length > 253
    || zone.split('.').length < 2
    || zone.split('.').some((label) => (
      label.length < 1
      || label.length > 63
      || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    ))
  ) {
    throw new Error('DNS_LEAK_TEST_INVALID_ZONE');
  }
  return zone;
}

function signProbeLabels(sessionId: string, index: string, expiry: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(`${sessionId}.${index}.${expiry}`)
    .digest('hex')
    .slice(0, 32);
}

function validatePayload(payload: DnsProbeTokenPayload): void {
  if (
    !SESSION_ID_PATTERN.test(payload.sessionId)
    || !Number.isInteger(payload.probeIndex)
    || payload.probeIndex < 0
    || payload.probeIndex >= DNS_LEAK_TEST_TOTAL_PROBES
    || !Number.isSafeInteger(payload.expiresAt)
  ) {
    throw new Error('DNS_LEAK_TEST_INVALID_TOKEN_PAYLOAD');
  }
}

function requireSecret(secret: string): void {
  if (!secret || secret.length < 32) {
    throw new Error('DNS_LEAK_TEST_SECRET_TOO_SHORT');
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
