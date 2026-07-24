import test from 'node:test';
import assert from 'node:assert/strict';
import { IpCheckServiceError, IpGeolocationService } from '../src/services/ipGeolocationService';

const SUCCESS_RESPONSE = {
  ip: '8.8.8.8',
  success: true,
  country: 'United States',
  country_code: 'US',
  region: 'Virginia',
  region_code: 'VA',
  city: 'Ashburn',
  latitude: 39.03,
  longitude: -77.5,
  postal: '20149',
  connection: {
    asn: 15169,
    org: 'Google LLC',
    isp: 'Google LLC',
  },
  timezone: { id: 'America/New_York' },
};

test('normalizes a successful ipwho.is response', async () => {
  let requestedUrl = '';
  const service = new IpGeolocationService({
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return Response.json(SUCCESS_RESPONSE);
    },
  });

  const result = await service.lookup('8.8.8.8');
  assert.deepEqual(result, {
    ip: '8.8.8.8',
    country: 'United States',
    country_code: 'US',
    region: 'VA',
    region_name: 'Virginia',
    city: 'Ashburn',
    postal_code: '20149',
    latitude: 39.03,
    longitude: -77.5,
    timezone: 'America/New_York',
    isp: 'Google LLC',
    organization: 'Google LLC',
    asn: 'AS15169',
  });
  assert.equal(new URL(requestedUrl).hostname, 'ipwho.is');
  assert.equal(new URL(requestedUrl).pathname, '/8.8.8.8');
  assert.equal(new URL(requestedUrl).search, '');
});

test('maps provider lookup failures without exposing the provider body', async () => {
  const service = new IpGeolocationService({
    fetchImpl: async () => Response.json({
      success: false,
      message: 'invalid query containing secret details',
    }),
  });

  await assert.rejects(service.lookup('example.com'), (error: unknown) => {
    assert.ok(error instanceof IpCheckServiceError);
    assert.equal(error.code, 'IP_CHECK_LOOKUP_FAILED');
    assert.equal(error.status, 422);
    assert.doesNotMatch(error.message, /secret details|example\.com/);
    return true;
  });
});

test('maps free-provider quota exhaustion to the stable rate-limit error', async () => {
  const service = new IpGeolocationService({
    fetchImpl: async () => Response.json(
      { success: false, message: 'Rate limit exceeded' },
      { status: 429 },
    ),
  });

  await assert.rejects(service.lookup('8.8.8.8'), hasCode('IP_CHECK_RATE_LIMITED', 429));
});

test('maps invalid upstream responses to a stable error', async () => {
  const invalidJson = new IpGeolocationService({
    fetchImpl: async () => new Response('{', { status: 200 }),
  });
  await assert.rejects(invalidJson.lookup('8.8.8.8'), hasCode('IP_CHECK_UPSTREAM_ERROR', 502));

  const invalidCoordinates = new IpGeolocationService({
    fetchImpl: async () => Response.json({ ...SUCCESS_RESPONSE, latitude: null }),
  });
  await assert.rejects(invalidCoordinates.lookup('8.8.8.8'), hasCode('IP_CHECK_UPSTREAM_ERROR', 502));
});

test('caches successful lookups until the configured TTL expires', async () => {
  let requests = 0;
  let now = 1_000;
  const service = new IpGeolocationService({
    now: () => now,
    cacheTtlMs: 60_000,
    fetchImpl: async () => {
      requests += 1;
      return Response.json(SUCCESS_RESPONSE);
    },
  });

  assert.equal((await service.lookup('8.8.8.8')).city, 'Ashburn');
  assert.equal((await service.lookup('8.8.8.8')).city, 'Ashburn');
  assert.equal(requests, 1);

  now += 60_001;
  assert.equal((await service.lookup('8.8.8.8')).city, 'Ashburn');
  assert.equal(requests, 2);
});

test('evicts the oldest cache entry when the configured bound is reached', async () => {
  let requests = 0;
  const service = new IpGeolocationService({
    cacheMaxEntries: 1,
    fetchImpl: async (input) => {
      requests += 1;
      const ip = new URL(String(input)).pathname.slice(1);
      return Response.json({ ...SUCCESS_RESPONSE, ip });
    },
  });

  await service.lookup('8.8.8.8');
  await service.lookup('1.1.1.1');
  await service.lookup('8.8.8.8');
  assert.equal(requests, 3);
});

test('maps aborted upstream calls to a timeout error', async () => {
  const service = new IpGeolocationService({
    timeoutMs: 5,
    fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    }),
  });

  await assert.rejects(service.lookup('8.8.8.8'), hasCode('IP_CHECK_UPSTREAM_TIMEOUT', 504));
});

function hasCode(code: string, status: number) {
  return (error: unknown) => {
    assert.ok(error instanceof IpCheckServiceError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    return true;
  };
}
