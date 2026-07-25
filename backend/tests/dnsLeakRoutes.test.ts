import test from 'node:test';
import assert from 'node:assert/strict';
import { AddressInfo } from 'node:net';
import express from 'express';
import { createToolsPublicRoutes } from '../src/routes/toolsPublicRoutes';
import { createDnsLeakInternalRoutes } from '../src/routes/dnsLeakInternalRoutes';
import { DnsLeakTestService } from '../src/services/dnsLeakTestService';
import {
  canonicalizeDnsLeakObservation,
  signDnsProbeCallback,
} from '../src/utils/dnsLeakProbeToken';
import type {
  DnsLeakObservation,
  DnsLeakTestResultResponse,
  DnsLeakTestStartResponse,
} from '../../shared/dnsLeakTest';
import type { IpCheckResult } from '../../shared/ipCheck';

const SESSION_SECRET = 'session-secret-at-least-thirty-two-characters';
const CALLBACK_SECRET = 'callback-secret-at-least-thirty-two-characters';
const SESSION_ID = '0123456789abcdef0123456789abcdef';
const NOW = Date.UTC(2026, 6, 25, 12, 0, 0);

test('DNS leak public routes start and poll a private visitor-bound session', async () => {
  const service = createService();
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createToolsPublicRoutes({
    toolsDownloadService: { getDownloadPageView: async () => ({}) } as never,
    dnsLeakTestService: service,
  }));
  const server = app.listen(0);

  try {
    const port = (server.address() as AddressInfo).port;
    const startedResponse = await fetch(`http://127.0.0.1:${port}/api/v1/tools/dns-leak-test/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '9.9.9.9' },
      body: '{}',
    });
    assert.equal(startedResponse.status, 200);
    assert.equal(startedResponse.headers.get('cache-control'), 'private, no-store');
    assert.equal(startedResponse.headers.get('pragma'), 'no-cache');
    const started = await startedResponse.json() as DnsLeakTestStartResponse;
    assert.equal(started.session_id, SESSION_ID);
    assert.equal(started.probe_hosts.length, 10);

    const resultResponse = await fetch(`http://127.0.0.1:${port}/api/v1/tools/dns-leak-test/result`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '9.9.9.9' },
      body: JSON.stringify({ session_id: SESSION_ID }),
    });
    assert.equal(resultResponse.status, 200);
    assert.equal(resultResponse.headers.get('cache-control'), 'private, no-store');
    const result = await resultResponse.json() as DnsLeakTestResultResponse;
    assert.equal(result.status, 'running');
    assert.equal(result.network.ip, '9.9.9.9');

    const foreignPoll = await fetch(`http://127.0.0.1:${port}/api/v1/tools/dns-leak-test/result`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '8.8.4.4' },
      body: JSON.stringify({ session_id: SESSION_ID }),
    });
    assert.equal(foreignPoll.status, 404);
    assert.equal((await foreignPoll.json() as { code: string }).code, 'DNS_LEAK_TEST_SESSION_NOT_FOUND');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('DNS leak internal route verifies signed observations and rejects replay', async () => {
  const service = createService();
  await service.createSession('9.9.9.9');
  const observation: DnsLeakObservation = {
    event_id: 'event-route-test',
    session_id: SESSION_ID,
    probe_index: 2,
    resolver_ip: '8.8.8.8',
    query_type: 'AAAA',
    dnssec_ok: true,
    observed_at: new Date(NOW).toISOString(),
  };
  const body = canonicalizeDnsLeakObservation(observation);
  const timestamp = String(Math.floor(NOW / 1000));
  const signature = signDnsProbeCallback(body, timestamp, CALLBACK_SECRET);

  const app = express();
  app.use(express.json());
  app.use('/api/v1/internal', createDnsLeakInternalRoutes(service));
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const send = () => fetch(`http://127.0.0.1:${port}/api/v1/internal/tools/dns-leak-test/observations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-dns-probe-timestamp': timestamp,
        'x-dns-probe-signature': signature,
      },
      body,
    });
    const accepted = await send();
    assert.equal(accepted.status, 202);
    assert.equal(accepted.headers.get('cache-control'), 'private, no-store');
    const replay = await send();
    assert.equal(replay.status, 409);
    assert.equal((await replay.json() as { code: string }).code, 'DNS_LEAK_TEST_REPLAYED_OBSERVATION');

    const result = await service.getResult(SESSION_ID, '9.9.9.9');
    assert.equal(result.resolvers[0]?.ip, '8.8.8.8');
    assert.equal(result.resolvers[0]?.dnssec_ok, true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('DNS leak start route returns an explicit 503 when the service is unavailable', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', createToolsPublicRoutes({
    toolsDownloadService: { getDownloadPageView: async () => ({}) } as never,
  }));
  const server = app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/tools/dns-leak-test/start`, {
      method: 'POST',
      headers: { 'cf-connecting-ip': '9.9.9.9' },
    });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal((await response.json() as { code: string }).code, 'DNS_LEAK_TEST_NOT_CONFIGURED');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

function createService(): DnsLeakTestService {
  return new DnsLeakTestService({
    ipCheckService: { lookup: async (ip) => ipResult(ip) },
    zone: 'dns-test.gate-rank.com',
    sessionSecret: SESSION_SECRET,
    callbackSecret: CALLBACK_SECRET,
    now: () => NOW,
    createSessionId: () => SESSION_ID,
  });
}

function ipResult(ip: string): IpCheckResult {
  return {
    ip,
    country: 'United States',
    country_code: 'US',
    region: '',
    region_name: '',
    city: '',
    postal_code: '',
    latitude: 0,
    longitude: 0,
    timezone: '',
    isp: 'Example Network',
    organization: 'Example Network',
    asn: 'AS64500',
  };
}
