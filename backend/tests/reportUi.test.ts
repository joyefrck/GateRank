import test from 'node:test';
import assert from 'node:assert/strict';

import {
  REPORT_ANCHOR_SECTIONS,
  buildReportRadarPoints,
  buildSparklineChartPoints,
  resolveActiveReportAnchor,
} from '../../shared/reportUi';

test('resolveActiveReportAnchor follows the latest section past the reading line', () => {
  const positions = REPORT_ANCHOR_SECTIONS.map((section, index) => ({
    id: section.id,
    top: 120 + index * 320,
  }));

  assert.equal(resolveActiveReportAnchor(positions, 160, false), 'report-overview');
  assert.equal(resolveActiveReportAnchor(positions, 450, false), 'report-content');
  assert.equal(resolveActiveReportAnchor(positions, 780, false), 'report-snapshot');
});

test('resolveActiveReportAnchor keeps the current section through gaps and supports rapid jumps', () => {
  const positions = [
    { id: 'report-overview' as const, top: -900 },
    { id: 'report-content' as const, top: -420 },
    { id: 'report-snapshot' as const, top: 80 },
    { id: 'report-capabilities' as const, top: 680 },
  ];

  assert.equal(resolveActiveReportAnchor(positions, 160, false), 'report-snapshot');
  assert.equal(resolveActiveReportAnchor(positions, -500, false), 'report-overview');
});

test('resolveActiveReportAnchor selects the conclusion at the end of the document', () => {
  const positions = REPORT_ANCHOR_SECTIONS.map((section, index) => ({
    id: section.id,
    top: index * 300,
  }));

  assert.equal(resolveActiveReportAnchor(positions, 160, true), 'report-conclusion');
  assert.equal(resolveActiveReportAnchor([], 160, false), 'report-overview');
});

test('buildReportRadarPoints clamps scores and maps S P C R to the four axes', () => {
  assert.equal(
    buildReportRadarPoints({ s: 100, p: 50, c: 0, r: 120 }),
    '60,12 84,60 60,60 12,60',
  );
  assert.equal(
    buildReportRadarPoints({ s: -20, p: 0, c: 50, r: 100 }),
    '60,60 60,60 60,84 12,60',
  );
});

test('buildReportRadarPoints maps v2 S P N C R to five axes', () => {
  assert.equal(
    buildReportRadarPoints({ s: 100, p: 100, n: 100, c: 100, r: 100 }),
    '60,12 105.65,45.17 88.21,98.83 31.79,98.83 14.35,45.17',
  );
});

test('buildSparklineChartPoints places a constant 100 percent series near the top', () => {
  assert.deepEqual(
    buildSparklineChartPoints([100, 100, 100], [0, 100]),
    ['0.00,16.00', '50.00,16.00', '100.00,16.00'],
  );
});

test('buildSparklineChartPoints preserves relative scaling when no fixed domain is provided', () => {
  assert.deepEqual(
    buildSparklineChartPoints([40, 50, 60]),
    ['0.00,92.00', '50.00,54.00', '100.00,16.00'],
  );
});
