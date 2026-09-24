import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWebsiteUrl, normalizeWebsiteUrls } from '../../shared/websiteUrl';

test('website normalization adds HTTPS without losing referral/query/hash', () => {
  assert.equal(normalizeWebsiteUrl('  www.example.com/signup?a=1#/register?ref=abc  '), 'https://www.example.com/signup?a=1#/register?ref=abc');
  assert.equal(normalizeWebsiteUrl('http://example.com:8080/path?q=x'), 'http://example.com:8080/path?q=x');
  assert.equal(normalizeWebsiteUrl('//example.com/path'), 'https://example.com/path');
  assert.deepEqual(normalizeWebsiteUrls(['example.com', 'https://example.com/']), ['https://example.com/']);
});

test('website normalization rejects invalid schemes, credentials and malformed addresses', () => {
  for (const input of ['', 'ftp://example.com', 'javascript:alert(1)', 'https:example.com', 'https://user:secret@example.com', 'not a website', 'https://']) {
    assert.throws(() => normalizeWebsiteUrl(input), /官网地址/);
  }
});
