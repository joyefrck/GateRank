import { createHash } from 'node:crypto';
import type { SubscriptionNodeSnapshotNode } from '../types/domain';

export function buildPerformanceNodeKey(node: SubscriptionNodeSnapshotNode): string {
  const rawUri = String(node.raw_uri || '').trim();
  if (rawUri) {
    return sha256(rawUri);
  }
  const outbound = node.outbound || {};
  const identity = [
    node.name || '',
    node.type || '',
    String(outbound.server || ''),
    String(outbound.server_port || ''),
  ].join('|');
  return sha256(identity);
}

export function buildPerformanceNodeMatchIdentity(node: {
  name?: string | null;
  region?: string | null;
  type?: string | null;
}): string {
  const identity = [
    normalizeIdentityPart(node.name),
    normalizeIdentityPart(node.region),
    normalizeIdentityPart(node.type),
  ].join('|');
  return sha256(identity);
}

function normalizeIdentityPart(value: string | null | undefined): string {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
