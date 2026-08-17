import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyNetworkCoverageRegion,
  computeNetworkCoverageScore,
  scoreExtendedRegionCount,
  scoreHealthyNodeCount,
  scoreRegionBalance,
} from '../src/services/networkCoverageScoring';

test('network coverage region classifier recognizes core, extended, flag and unknown names', () => {
  assert.deepEqual(classifyNetworkCoverageRegion('🇭🇰 香港 IEPL 01'), {
    region_code: 'HK', region_name: '香港', region_group: 'core',
  });
  assert.equal(classifyNetworkCoverageRegion('Tokyo JP-01').region_code, 'JP');
  assert.equal(classifyNetworkCoverageRegion('Frankfurt DE Premium').region_code, 'DE');
  assert.equal(classifyNetworkCoverageRegion('Premium Relay 01').region_code, 'UNKNOWN');
  assert.equal(classifyNetworkCoverageRegion('HKT Premium').region_code, 'UNKNOWN');
  assert.equal(classifyNetworkCoverageRegion('剩余流量：4763.25 GB').region_code, 'UNKNOWN');
  assert.equal(classifyNetworkCoverageRegion('韩国-标准套餐01').region_code, 'KR');
  assert.equal(classifyNetworkCoverageRegion('套餐到期：长期有效 UK').region_code, 'UNKNOWN');
  assert.equal(classifyNetworkCoverageRegion('London UK-01').region_code, 'GB');
  for (const name of ['澳门专线 01', '澳門 IPLC 02', 'Macau Premium', 'Macao-01', 'MO-01', '🇲🇴 澳门']) {
    assert.deepEqual(classifyNetworkCoverageRegion(name), {
      region_code: 'MO', region_name: '澳门', region_group: 'extended',
    });
  }
  assert.equal(classifyNetworkCoverageRegion('澳大利亚 Sydney 01').region_code, 'AU');
  assert.equal(classifyNetworkCoverageRegion('澳洲 01').region_code, 'AU');
  assert.deepEqual(classifyNetworkCoverageRegion('🇮🇩IDR-印度尼西亚01'), {
    region_code: 'ID', region_name: '印度尼西亚', region_group: 'extended',
  });
  assert.deepEqual(classifyNetworkCoverageRegion('🇨🇱CL-智利01'), {
    region_code: 'CL', region_name: '智利', region_group: 'extended',
  });
});

test('network coverage scoring tables preserve every documented boundary', () => {
  assert.deepEqual([0, 1, 5, 6, 10, 11, 20, 21, 30, 31, 50, 51].map(scoreHealthyNodeCount),
    [0, 20, 20, 40, 40, 60, 60, 75, 75, 90, 90, 100]);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map(scoreExtendedRegionCount),
    [0, 30, 50, 65, 75, 85, 92, 92, 100]);
  assert.deepEqual([40, 40.01, 50, 50.01, 60, 60.01, 70, 70.01, 80, 80.01, 90, 90.01]
    .map((share) => scoreRegionBalance(share, 10)), [100, 90, 90, 75, 75, 60, 60, 40, 40, 20, 20, 0]);
  assert.equal(scoreRegionBalance(0, 0), 0);
});

test('network coverage scoring matches the v1 document example', () => {
  const healthyNames = [
    ...Array.from({ length: 35 }, (_, index) => `JP-${index}`),
    ...Array.from({ length: 5 }, (_, index) => `HK-${index}`),
    ...Array.from({ length: 3 }, (_, index) => `US-${index}`),
    ...Array.from({ length: 2 }, (_, index) => `UK-${index}`),
  ];
  const nodes = [
    ...healthyNames.map((name, index) => ({ key: `healthy-${index}`, name, healthy: true })),
    ...Array.from({ length: 5 }, (_, index) => ({ key: `failed-${index}`, name: `JP-failed-${index}`, healthy: false })),
  ];
  const result = computeNetworkCoverageScore(nodes, 3);

  assert.equal(result.detected_nodes_count, 50);
  assert.equal(result.healthy_nodes_count, 45);
  assert.equal(result.healthy_node_rate, 90);
  assert.equal(result.node_count_score, 90);
  assert.equal(result.core_coverage_score, 60);
  assert.equal(result.extended_coverage_score, 30);
  assert.equal(result.region_score, 54);
  assert.equal(result.max_region_share, 77.78);
  assert.equal(result.balance_score, 40);
  assert.equal(result.score_n, 68.8);
  assert.equal(result.unsupported_nodes_count, 3);
});

test('unknown healthy nodes count toward health and conservative balance but not coverage', () => {
  const result = computeNetworkCoverageScore([
    { key: '1', name: 'JP-01', healthy: true },
    { key: '2', name: 'Premium Relay 01', healthy: true },
    { key: '3', name: 'Premium Relay 02', healthy: true },
    { key: '4', name: 'US-01', healthy: false },
  ]);

  assert.equal(result.healthy_node_rate, 75);
  assert.deepEqual(result.core_regions, ['JP']);
  assert.deepEqual(result.extended_regions, []);
  assert.equal(result.unknown_healthy_nodes_count, 2);
  assert.equal(result.region_counts.UNKNOWN, 2);
  assert.equal(result.max_region_code, 'UNKNOWN');
  assert.equal(result.max_region_share, 66.67);
  assert.equal(result.balance_score, 60);
});

test('zero detected nodes produces an explicit zero score', () => {
  const result = computeNetworkCoverageScore([], 2);
  assert.equal(result.detected_nodes_count, 0);
  assert.equal(result.healthy_node_rate, 0);
  assert.equal(result.balance_score, 0);
  assert.equal(result.score_n, 0);
});
