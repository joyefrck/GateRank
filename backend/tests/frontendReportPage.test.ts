import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('React report card grids omit risk penalty metric cards', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

  const snapshotStart = source.indexOf('function ReportSnapshotGrid');
  assert.notEqual(snapshotStart, -1);
  const snapshotEnd = source.indexOf('function ReportCapabilitiesSection', snapshotStart);
  assert.notEqual(snapshotEnd, -1);
  const snapshotGrid = source.slice(snapshotStart, snapshotEnd);

  assert.match(snapshotGrid, /label="状态"/);
  assert.match(snapshotGrid, /label="数据日期"/);
  assert.match(snapshotGrid, /label="健康记录"/);
  assert.match(snapshotGrid, /label="稳定性"/);
  assert.doesNotMatch(snapshotGrid, /label="风险惩罚"/);

  const scoreStart = source.indexOf('function ReportScoreBreakdown');
  assert.notEqual(scoreStart, -1);
  const scoreEnd = source.indexOf('function ReportCoreMetrics', scoreStart);
  assert.notEqual(scoreEnd, -1);
  const scoreBreakdown = source.slice(scoreStart, scoreEnd);

  assert.doesNotMatch(scoreBreakdown, /label: '风险惩罚'/);
});

test('React report score card labels low score as limited rating instead of high risk', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const scoreGradeStart = source.indexOf('function getScoreGrade');
  assert.notEqual(scoreGradeStart, -1);
  const scoreGradeEnd = source.indexOf('function formatNullableSupport', scoreGradeStart);
  assert.notEqual(scoreGradeEnd, -1);
  const scoreGradeSource = source.slice(scoreGradeStart, scoreGradeEnd);

  assert.match(scoreGradeSource, /return '评级受限'/);
  assert.doesNotMatch(scoreGradeSource, /return '高风险'/);
});
