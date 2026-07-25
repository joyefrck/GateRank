import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createNetServer } from 'node:net';
import DNS from 'dns2';
import { DnsLeakAuthoritativeServer } from '../src/services/dnsLeakAuthoritativeServer';
import {
  buildDnsProbeHostname,
  verifyDnsProbeCallback,
} from '../src/utils/dnsLeakProbeToken';
import type { DnsLeakObservation } from '../../shared/dnsLeakTest';

const SESSION_SECRET = 'session-secret-at-least-thirty-two-characters';
const CALLBACK_SECRET = 'callback-secret-at-least-thirty-two-characters';
const SESSION_ID = '0123456789abcdef0123456789abcdef';
const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);

test('authoritative probe serves SOA and signed NXDOMAIN over UDP and TCP without recursion', async () => {
  const callbacks: Array<{ body: DnsLeakObservation; timestamp: string; signature: string }> = [];
  const port = await findFreePort();
  const server = createProbeServer(async (_input, init) => {
    callbacks.push({
      body: JSON.parse(String(init?.body)) as DnsLeakObservation,
      timestamp: String((init?.headers as Record<string, string>)['x-dns-probe-timestamp']),
      signature: String((init?.headers as Record<string, string>)['x-dns-probe-signature']),
    });
    return Response.json({ accepted: true }, { status: 202 });
  });
  await server.listen({ address: '127.0.0.1', port });

  try {
    const udp = DNS.UDPClient({ dns: '127.0.0.1', port, timeout: 2_000 });
    const tcp = DNS.TCPClient({ dns: '127.0.0.1', port });
    const soa = await udp('dns-test.gate-rank.com', 'SOA');
    assert.equal(soa.header.aa, 1);
    assert.equal(soa.header.ra, 0);
    assert.equal(soa.header.rcode, 0);
    assert.equal(soa.answers[0]?.type, DNS.Packet.TYPE.SOA);

    const hostname = buildDnsProbeHostname({
      sessionId: SESSION_ID,
      probeIndex: 3,
      expiresAt: NOW + 120_000,
    }, 'dns-test.gate-rank.com', SESSION_SECRET);
    const udpResult = await udp(hostname, 'A');
    const tcpResult = await tcp(hostname, 'AAAA');
    assert.equal(udpResult.header.aa, 1);
    assert.equal(udpResult.header.rcode, 3);
    assert.equal(udpResult.authorities[0]?.type, DNS.Packet.TYPE.SOA);
    assert.equal(tcpResult.header.rcode, 3);

    const refused = await udp('example.com', 'A');
    assert.equal(refused.header.rcode, 5);

    await server.waitForCallbacks();
    assert.equal(callbacks.length, 2);
    assert.deepEqual(new Set(callbacks.map((item) => item.body.query_type)), new Set(['A', 'AAAA']));
    for (const item of callbacks) {
      assert.equal(item.body.resolver_ip, '127.0.0.1');
      assert.equal(item.body.probe_index, 3);
      assert.equal(verifyDnsProbeCallback(
        JSON.stringify(item.body),
        item.timestamp,
        item.signature,
        CALLBACK_SECRET,
        NOW,
      ), true);
    }
  } finally {
    await server.close();
  }
});

test('authoritative probe captures the EDNS DO capability signal', async () => {
  const callbacks: DnsLeakObservation[] = [];
  const server = createProbeServer(async (_input, init) => {
    callbacks.push(JSON.parse(String(init?.body)) as DnsLeakObservation);
    return new Response(null, { status: 202 });
  });
  const hostname = buildDnsProbeHostname({
    sessionId: SESSION_ID,
    probeIndex: 1,
    expiresAt: NOW + 120_000,
  }, 'dns-test.gate-rank.com', SESSION_SECRET);
  const request = new DNS.Packet();
  request.header.id = 1;
  request.header.rd = 1;
  request.questions.push({
    name: hostname,
    type: DNS.Packet.TYPE.A,
    class: DNS.Packet.CLASS.IN,
    toBuffer: DNS.Packet.Question.prototype?.toBuffer,
  } as DNS.Packet.Question);
  request.additionals.push({
    name: '',
    type: DNS.Packet.TYPE.EDNS,
    class: 1232,
    ttl: 0x8000,
    doFlag: true,
  } as DNS.Packet.Resource & { doFlag: boolean });

  const response = server.buildResponse(request, '8.8.8.8');
  assert.equal(response.header.rcode, 3);
  await server.waitForCallbacks();
  assert.equal(callbacks[0]?.dnssec_ok, true);
});

test('authoritative probe retries transient callback failures and stops after acceptance', async () => {
  let attempts = 0;
  const server = createProbeServer(async () => {
    attempts += 1;
    return new Response(null, { status: attempts < 3 ? 503 : 202 });
  });
  const hostname = buildDnsProbeHostname({
    sessionId: SESSION_ID,
    probeIndex: 0,
    expiresAt: NOW + 120_000,
  }, 'dns-test.gate-rank.com', SESSION_SECRET);
  const request = DNS.Packet.createResponseFromRequest(new DNS.Packet());
  request.questions.push(new DNS.Packet.Question(hostname, DNS.Packet.TYPE.A, DNS.Packet.CLASS.IN));

  server.buildResponse(request, '8.8.8.8');
  await server.waitForCallbacks();
  assert.equal(attempts, 3);
});

function createProbeServer(fetchImpl: typeof fetch): DnsLeakAuthoritativeServer {
  let event = 0;
  return new DnsLeakAuthoritativeServer({
    zone: 'dns-test.gate-rank.com',
    publicIpv4: '8.8.4.4',
    sessionSecret: SESSION_SECRET,
    callbackSecret: CALLBACK_SECRET,
    callbackUrl: 'https://gate-rank.com/api/v1/internal/tools/dns-leak-test/observations',
    fetchImpl,
    now: () => NOW,
    createEventId: () => `event-probe-${++event}`,
    delay: async () => {},
    allowPrivateResolverIps: true,
  });
}

async function findFreePort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}
