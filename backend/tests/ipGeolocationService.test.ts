import test from 'node:test';
import assert from 'node:assert/strict';
import { IpCheckServiceError, IpGeolocationService } from '../src/services/ipGeolocationService';

test('normalizes a successful ip-api Pro response', async () => {
  let requestedUrl = '';
  const service = new IpGeolocationService({
    apiKey: 'test-secret',
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({
        status: 'success',
        query: '8.8.8.8',
        country: 'United States',
        countryCode: 'US',
        region: 'VA',
        regionName: 'Virginia',
        city: 'Ashburn',
        zip: '20149',
        lat: 39.03,
        lon: -77.5,
        timezone: 'America/New_York',
        isp: 'Google LLC',
        org: 'Google Public DNS',
        as: 'AS15169 Google LLC',
      }), { status: 200 });
    },
  });

  const result = await service.lookup('8.8.8.8');
  assert.equal(result.ip, '8.8.8.8');
  assert.equal(result.country_code, 'US');
  assert.equal(result.latitude, 39.03);
  assert.equal(result.organization, 'Google Public DNS');
  assert.equal(new URL(requestedUrl).hostname, 'pro.ip-api.com');
  assert.equal(new URL(requestedUrl).searchParams.get('key'), 'test-secret');
});

test('maps provider lookup failures without exposing the provider body', async () => {
  const service = new IpGeolocationService({
    apiKey: 'test-secret',
    fetchImpl: async () => new Response(JSON.stringify({
      status: 'fail',
      message: 'invalid query containing secret details',
    }), { status: 200 }),
  });

  await assert.rejects(service.lookup('example.com'), (error: unknown) => {
    assert.ok(error instanceof IpCheckServiceError);
    assert.equal(error.code, 'IP_CHECK_LOOKUP_FAILED');
    assert.equal(error.status, 422);
    assert.doesNotMatch(error.message, /secret details|example\.com|test-secret/);
    return true;
  });
});

test('maps invalid responses and missing configuration to stable errors', async () => {
  const invalid = new IpGeolocationService({
    apiKey: 'test-secret',
    fetchImpl: async () => new Response('{', { status: 200 }),
  });
  await assert.rejects(invalid.lookup('8.8.8.8'), hasCode('IP_CHECK_UPSTREAM_ERROR', 502));

  const missing = new IpGeolocationService({ apiKey: '' });
  await assert.rejects(missing.lookup('8.8.8.8'), hasCode('IP_CHECK_NOT_CONFIGURED', 503));
});

test('maps aborted upstream calls to a timeout error', async () => {
  const service = new IpGeolocationService({
    apiKey: 'test-secret',
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
