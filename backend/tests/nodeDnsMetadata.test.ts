import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNodeDnsMetadata } from '../src/utils/nodeDnsMetadata';

test('subscription DNS metadata accepts scoped resolvers without changing legacy nodes', () => {
  assert.deepEqual(parseNodeDnsMetadata({}), {});
  assert.deepEqual(parseNodeDnsMetadata({ dns_resolvers: [' 192.0.2.53 ', '192.0.2.53'], dns_ipv6: false }),
    { dns_resolvers: ['192.0.2.53'], dns_ipv6: false });
  assert.deepEqual(parseNodeDnsMetadata({ dns_resolvers: ['https://dns.example/dns-query', 'tls://192.0.2.53', 'tcp://192.0.2.53:5353'] }),
    { dns_resolvers: ['https://dns.example/dns-query', 'tls://192.0.2.53', 'tcp://192.0.2.53:5353'] });
});

test('subscription DNS metadata rejects invalid or credential-bearing values safely', () => {
  for (const dns_resolvers of ['192.0.2.53', ['file:///tmp/dns'], ['https://user:secret@dns.example/dns-query'],
    ['192.0.2.53#RULES'], Array(9).fill('192.0.2.53')]) {
    assert.throws(() => parseNodeDnsMetadata({ dns_resolvers }), /^Error: invalid_node_dns_resolver$/);
  }
  assert.throws(() => parseNodeDnsMetadata({ dns_ipv6: 'false' }), /invalid_node_dns_ipv6/);
});
