import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import {
  resolveMarketingAttribution,
  resolveMarketingCountry,
  resolveMarketingSource,
} from '../src/utils/marketing';

test('resolveMarketingSource prioritizes utm source over external referrer host', () => {
  const result = resolveMarketingSource({
    utmSource: 'baidu',
    externalReferrerHost: 'google.com',
  });

  assert.equal(result.source_type, 'baidu');
  assert.equal(result.source_label, 'Baidu');
});

test('resolveMarketingAttribution maps external google referrer to known source', () => {
  const req = stubRequest({
    headers: {
      referer: 'https://www.google.com/search?q=gaterank',
    },
  });

  const result = resolveMarketingAttribution(req, {});

  assert.equal(result.external_referrer_host, 'google.com');
  assert.equal(result.source_type, 'google');
  assert.equal(result.source_label, 'Google');
});

test('resolveMarketingAttribution keeps internal referrer path out of external source attribution', () => {
  const req = stubRequest({
    headers: {
      referer: 'https://gaterank.local/rankings/all',
      host: 'gaterank.local',
    },
  });

  const result = resolveMarketingAttribution(req, {});

  assert.equal(result.external_referrer_host, null);
  assert.equal(result.source_type, 'direct_or_unknown');
});

test('resolveMarketingCountry prefers proxy country header', () => {
  const req = stubRequest({
    headers: {
      'cf-ipcountry': 'JP',
    },
    ip: '8.8.8.8',
  });

  const result = resolveMarketingCountry(req);

  assert.equal(result.country_code, 'JP');
  assert.equal(result.country_name, 'Japan');
});

test('resolveMarketingCountry falls back to geoip lookup', () => {
  const req = stubRequest({
    ip: '8.8.8.8',
  });

  const result = resolveMarketingCountry(req);

  assert.equal(result.country_code, 'US');
  assert.equal(result.country_name, 'United States');
});

function stubRequest(input: {
  headers?: Record<string, string>;
  query?: Record<string, string>;
  ip?: string;
}): Request {
  const headers = Object.fromEntries(
    Object.entries(input.headers || {}).map(([key, value]) => [key.toLowerCase(), value]),
  );
  const query = input.query || {};

  return {
    query,
    ip: input.ip || '127.0.0.1',
    header(name: string) {
      return headers[name.toLowerCase()];
    },
  } as Request;
}
