import { isIP } from 'node:net';

export interface NodeDnsMetadata {
  dns_resolvers?: string[];
  dns_ipv6?: boolean;
}

export function parseNodeDnsMetadata(record: Record<string, unknown>): NodeDnsMetadata {
  const result: NodeDnsMetadata = {};
  if (record.dns_resolvers !== undefined && record.dns_resolvers !== null) {
    const values = record.dns_resolvers;
    if (!Array.isArray(values) || values.length > 8) throw new Error('invalid_node_dns_resolver');
    const resolvers = values.map((value) => {
      if (typeof value !== 'string' || !value.trim() || value.length > 512) throw new Error('invalid_node_dns_resolver');
      const text = value.trim();
      if (isIP(text)) return text;
      try {
        const url = new URL(text.includes('://') ? text : `udp://${text}`);
        if (!['udp:', 'tcp:', 'tls:', 'https:'].includes(url.protocol)
            || !url.hostname || url.username || url.password || url.hash || url.search
            || (url.protocol !== 'https:' && !['', '/'].includes(url.pathname))
            || (url.port && Number(url.port) < 1)) throw new Error();
      } catch {
        throw new Error('invalid_node_dns_resolver');
      }
      return text;
    });
    if (resolvers.length) result.dns_resolvers = [...new Set(resolvers)];
  }
  if (record.dns_ipv6 !== undefined && record.dns_ipv6 !== null) {
    if (typeof record.dns_ipv6 !== 'boolean') throw new Error('invalid_node_dns_ipv6');
    result.dns_ipv6 = record.dns_ipv6;
  }
  return result;
}
