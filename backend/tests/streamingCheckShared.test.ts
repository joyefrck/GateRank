import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStreamingRegionAssessments,
  inferNetflixRegion,
  mergeStreamingEvidence,
  NETFLIX_MANUAL_TESTS,
  STREAMING_SERVICES,
} from '../../shared/streamingCheck';

test('inferNetflixRegion distinguishes US, Japan, Singapore, other and unknown regions', () => {
  assert.equal(inferNetflixRegion('US'), 'us');
  assert.equal(inferNetflixRegion('jp'), 'jp');
  assert.equal(inferNetflixRegion('SG'), 'sg');
  assert.equal(inferNetflixRegion('DE'), 'other');
  assert.equal(inferNetflixRegion('ZZ'), 'unknown');
});

test('streaming assessments cover all services and keep TikTok connectivity-only', () => {
  const assessments = buildStreamingRegionAssessments('SG');
  assert.equal(assessments.length, STREAMING_SERVICES.length);
  assert.equal(assessments.find((item) => item.key === 'chatgpt')?.region_support, 'supported');
  assert.equal(assessments.find((item) => item.key === 'netflix')?.region_support, 'supported');
  assert.equal(assessments.find((item) => item.key === 'tiktok')?.region_support, 'unknown');
  assert.equal(assessments.find((item) => item.key === 'tiktok')?.basis, 'connectivity_only');
});

test('unknown countries never produce a supported assessment', () => {
  const assessments = buildStreamingRegionAssessments('ZZ');
  assert.ok(assessments.every((item) => item.region_support !== 'supported'));
});

test('Netflix official unsupported countries are classified as unsupported', () => {
  const netflix = buildStreamingRegionAssessments('CN').find((item) => item.key === 'netflix');
  assert.equal(netflix?.region_support, 'unsupported');
});

test('mergeStreamingEvidence never upgrades unknown, failed or timed out evidence', () => {
  assert.equal(mergeStreamingEvidence('reachable', 'supported', true), 'likely_supported');
  assert.equal(mergeStreamingEvidence('reachable', 'unsupported', true), 'reachable_region_unsupported');
  assert.equal(mergeStreamingEvidence('reachable', 'supported', false), 'reachable_only');
  assert.equal(mergeStreamingEvidence('reachable', 'unknown', true), 'reachable_only');
  assert.equal(mergeStreamingEvidence('unreachable', 'supported', true), 'unconfirmed');
  assert.equal(mergeStreamingEvidence('timeout', 'supported', true), 'unconfirmed');
});

test('Netflix manual registry includes public, US, Japan and Singapore references', () => {
  assert.deepEqual(NETFLIX_MANUAL_TESTS.map((item) => item.key), ['public', 'us', 'jp', 'sg']);
  assert.equal(NETFLIX_MANUAL_TESTS.find((item) => item.key === 'us')?.title, '绝命毒师');
  assert.ok(NETFLIX_MANUAL_TESTS.every((item) => /^https:\/\/www\.netflix\.com\/title\/\d+$/.test(item.href)));
});
