import test from 'node:test';
import assert from 'node:assert/strict';
import { isWebsiteWafChallenge } from '../src/services/websiteProbe';
const body = '<html><title>安全验证</title><script src="/_waf/example.js"></script></html>';
test('VeilX verification needs server, title and challenge resource markers', () => {
  assert.equal(isWebsiteWafChallenge('Nginx/VeilX-Edge',body),true);
  assert.equal(isWebsiteWafChallenge('nginx',body),false);
  assert.equal(isWebsiteWafChallenge('Nginx/VeilX-Edge','error'),false);
  assert.equal(isWebsiteWafChallenge('Nginx/VeilX-Edge','<title>安全验证</title>'),false);
});
