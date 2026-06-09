export interface SubscriptionNodeSnapshotViewNode {
  name: string;
  region?: string | null;
  type?: string | null;
  outbound?: Record<string, unknown>;
  raw_uri?: string;
}

export interface SubscriptionNodeViewRow {
  name: string;
  region: string;
  type: string;
  server: string;
  port: string;
  transportSecurity: string;
}

export function buildSubscriptionNodeViewRows(nodes: SubscriptionNodeSnapshotViewNode[]): SubscriptionNodeViewRow[] {
  return nodes.map((node) => {
    const outbound = node.outbound || {};
    return {
      name: displayText(node.name),
      region: displayText(node.region),
      type: displayText(node.type),
      server: displayText(readString(outbound.server)),
      port: displayText(readString(outbound.server_port)),
      transportSecurity: displayText(formatTransportSecurity(outbound)),
    };
  });
}

function formatTransportSecurity(outbound: Record<string, unknown>): string {
  const labels = [formatTransport(outbound), formatSecurity(outbound)].filter((item) => item);
  return labels.join(' / ');
}

function formatTransport(outbound: Record<string, unknown>): string {
  const transport = outbound.transport;
  const transportType = isRecord(transport) ? readString(transport.type) : readString(transport);
  const network = readString(outbound.network) || transportType;
  return labelTransport(network);
}

function formatSecurity(outbound: Record<string, unknown>): string {
  const tls = outbound.tls;
  if (isRecord(tls)) {
    const reality = tls.reality;
    if (isRecord(reality) && reality.enabled === true) {
      return 'Reality';
    }
    if (tls.enabled === true) {
      return 'TLS';
    }
  }
  const security = readString(outbound.security) || readString(tls);
  if (security.toLowerCase() === 'reality') {
    return 'Reality';
  }
  if (security.toLowerCase() === 'tls') {
    return 'TLS';
  }
  return security;
}

function labelTransport(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === 'tcp' || normalized === 'none') {
    return '';
  }
  if (normalized === 'ws' || normalized === 'websocket') {
    return 'ws';
  }
  if (normalized === 'grpc') {
    return 'gRPC';
  }
  if (normalized === 'h2' || normalized === 'http2') {
    return 'HTTP/2';
  }
  return value.trim();
}

function readString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

function displayText(value: unknown): string {
  const text = readString(value);
  return text || '-';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
