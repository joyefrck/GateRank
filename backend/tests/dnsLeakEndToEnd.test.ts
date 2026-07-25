import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createNetServer } from 'node:net';
import express from 'express';
import DNS from 'dns2';
import type { DnsLeakTestResultResponse, DnsLeakTestStartResponse } from '../../shared/dnsLeakTest';
import type { IpCheckResult } from '../../shared/ipCheck';
import { createDnsLeakInternalRoutes } from '../src/routes/dnsLeakInternalRoutes';
import { createToolsPublicRoutes } from '../src/routes/toolsPublicRoutes';
import { DnsLeakAuthoritativeServer } from '../src/services/dnsLeakAuthoritativeServer';
import { DnsLeakTestService } from '../src/services/dnsLeakTestService';

const SESSION_SECRET = 'e2e-session-secret-at-least-thirty-two-characters';
const CALLBACK_SECRET = 'e2e-callback-secret-at-least-thirty-two-characters';

test('local API and authoritative probe complete a real UDP/TCP DNS leak session', async () => {
  const app = express();
  app.use(express.json());
  const ipCheckService = {
    lookup: async (ip: string) => ipResult(ip),
  };
  const service = new DnsLeakTestService({
    ipCheckService,
    zone: 'dns-test.gate-rank.com',
    sessionSecret: SESSION_SECRET,
    callbackSecret: CALLBACK_SECRET,
    allowPrivateResolverIps: true,
  });
  app.use('/api/v1', createToolsPublicRoutes({
    toolsDownloadService: {
      getDownloadPageView: async () => {
        throw new Error('unused');
      },
    },
    ipCheckService,
    dnsLeakTestService: service,
  }));
  app.use('/api/v1/internal', createDnsLeakInternalRoutes(service));

  const apiServer = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    apiServer.once('listening', resolve);
    apiServer.once('error', reject);
  });
  const apiAddress = apiServer.address();
  assert.ok(apiAddress && typeof apiAddress === 'object');

  const dnsPort = await findFreePort();
  const probe = new DnsLeakAuthoritativeServer({
    zone: 'dns-test.gate-rank.com',
    publicIpv4: '8.8.4.4',
    sessionSecret: SESSION_SECRET,
    callbackSecret: CALLBACK_SECRET,
    callbackUrl: `http://127.0.0.1:${apiAddress.port}/api/v1/internal/tools/dns-leak-test/observations`,
    allowPrivateResolverIps: true,
  });
  await probe.listen({ address: '127.0.0.1', port: dnsPort });

  try {
    const startResponse = await fetch(
      `http://127.0.0.1:${apiAddress.port}/api/v1/tools/dns-leak-test/start`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
    );
    assert.equal(startResponse.status, 200);
    assert.match(startResponse.headers.get('cache-control') || '', /private, no-store/);
    const started = await startResponse.json() as DnsLeakTestStartResponse;
    assert.equal(started.probe_hosts.length, 10);

    const udp = DNS.UDPClient({ dns: '127.0.0.1', port: dnsPort, timeout: 2_000 });
    const tcp = DNS.TCPClient({ dns: '127.0.0.1', port: dnsPort });
    for (const [index, hostname] of started.probe_hosts.entries()) {
      const response = index % 2 === 0
        ? await udp(hostname, 'A')
        : await tcp(hostname, 'AAAA');
      assert.equal(response.header.aa, 1);
      assert.equal(response.header.ra, 0);
      assert.equal(response.header.rcode, 3);
    }
    await probe.waitForCallbacks();

    const resultResponse = await fetch(
      `http://127.0.0.1:${apiAddress.port}/api/v1/tools/dns-leak-test/result`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: started.session_id }),
      },
    );
    assert.equal(resultResponse.status, 200);
    assert.match(resultResponse.headers.get('cache-control') || '', /private, no-store/);
    const result = await resultResponse.json() as DnsLeakTestResultResponse;
    assert.equal(result.status, 'complete');
    assert.equal(result.observed_probe_count, 10);
    assert.equal(result.resolvers.length, 1);
    assert.equal(result.resolvers[0]?.ip, '127.0.0.1');
    assert.equal(result.verdict, 'no_obvious_leak');
  } finally {
    await probe.close();
    await new Promise<void>((resolve, reject) => (
      apiServer.close((error) => error ? reject(error) : resolve())
    ));
  }
});

function ipResult(ip: string): IpCheckResult {
  return {
    ip,
    country: 'Local Test Network',
    country_code: 'US',
    region: '',
    region_name: '',
    city: '',
    postal_code: '',
    latitude: 0,
    longitude: 0,
    timezone: 'UTC',
    isp: 'GateRank Test',
    organization: 'GateRank Test',
    asn: 'AS64500',
  };
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
  await new Promise<void>((resolve, reject) => (
    server.close((error) => error ? reject(error) : resolve())
  ));
  return port;
}
