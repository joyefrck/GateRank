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

test('React report score card owns the methodology CTA and radar visualization', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

  const heroStart = source.indexOf('function ReportHeroV2');
  const heroEnd = source.indexOf('function ReportContentNarrative', heroStart);
  const heroSource = source.slice(heroStart, heroEnd);
  assert.doesNotMatch(heroSource, /buildMethodologyHref/);
  assert.doesNotMatch(heroSource, />\s*测评方法\s*</);

  const scoreStart = source.indexOf('function ReportScoreCard');
  const scoreEnd = source.indexOf('function ReportSnapshotGrid', scoreStart);
  const scoreSource = source.slice(scoreStart, scoreEnd);
  assert.match(scoreSource, /<ReportMethodologyCard data=\{data\} \/>/);
  assert.match(scoreSource, /buildReportRadarPoints\(data\.score_breakdown\)/);
  assert.match(scoreSource, /四维评分模型/);
  assert.match(scoreSource, /我们是如何测评的？/);
  assert.match(scoreSource, /navigate\(methodologyHref\)/);
  assert.match(scoreSource, /aria-labelledby="report-score-radar-title report-score-radar-description"/);
});

test('React report fixed navigation exposes scroll-aware current location state', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const navStart = source.indexOf('const REPORT_NAV_ACTIVATION_LINE');
  const navEnd = source.indexOf('function ReportContentV2', navStart);
  const navSource = source.slice(navStart, navEnd);

  assert.match(navSource, /resolveActiveReportAnchor/);
  assert.match(navSource, /requestAnimationFrame/);
  assert.match(navSource, /aria-current=\{isActive \? 'location' : undefined\}/);
  assert.match(navSource, /prefers-reduced-motion: reduce/);
  assert.match(navSource, /setActiveAnchor\(section\.id\)/);
});

test('React uptime sparklines use a fixed zero to one hundred percent domain', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

  assert.match(source, /title="30天可用率"[^\n]+domain=\{\[0, 100\]\}/);
  assert.match(source, /title="可用率趋势"[^\n]+domain=\{\[0, 100\]\}/);
  assert.match(source, /buildSparklineChartPoints\(values, domain\)/);
  assert.doesNotMatch(source, /title="延迟趋势 \(ms\)"[^\n]+domain=/);
  assert.doesNotMatch(source, /title="下载速率趋势 \(Mbps\)"[^\n]+domain=/);
});

test('React report renders proxy request failure history instead of an empty loss sparkline', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

  assert.match(
    source,
    /title="代理请求失败率"[^\n]+points=\{data\.trends\.packet_loss_30d\}/,
  );
  assert.doesNotMatch(source, /title="丢包率"[^\n]+points=\{\[\]\}/);
});

test('React report exposes only a restrained regional review notice', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const metricsStart = source.indexOf('function ReportCoreMetrics');
  const metricsEnd = source.indexOf('function ReportTrendSection', metricsStart);
  const metricsSource = source.slice(metricsStart, metricsEnd);

  assert.match(source, /performance_under_review: boolean/);
  assert.match(metricsSource, /data\.performance_under_review/);
  assert.match(metricsSource, /不同测试地区结果差异较大，正在复核/);
  assert.doesNotMatch(metricsSource, /performance_review_status|review_reasons|probe_ids/);
  assert.doesNotMatch(metricsSource, /作弊|造假/);
});

test('React report node coverage shows at most fourteen regions', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const start = source.indexOf('function ReportRegionGroup');
  const end = source.indexOf('function formatReportRegionLabel', start);
  const regionGroupSource = source.slice(start, end);

  assert.match(regionGroupSource, /regions\.slice\(0, 14\)/);
  assert.match(regionGroupSource, /regions\.length > 14/);
  assert.match(regionGroupSource, /regions\.length - 14/);
});

test('React methodology exposes evaluation principles without model parameters', async () => {
  const contentSource = await readFile(path.join(process.cwd(), 'src/pages/methodology/content.ts'), 'utf8');
  const pageSource = await readFile(path.join(process.cwd(), 'src/pages/methodology/MethodologyPage.tsx'), 'utf8');
  const publicSource = `${contentSource}\n${pageSource}`;

  assert.match(publicSource, /五维评估框架/);
  assert.match(publicSource, /稳定性/);
  assert.match(publicSource, /性能/);
  assert.match(publicSource, /网络覆盖/);
  assert.match(publicSource, /性价比/);
  assert.match(publicSource, /风险/);
  assert.match(publicSource, /模型参数、阈值与计算细节属于内部方法，不对外披露/);
  assert.match(publicSource, /数据如何形成结果/);
  assert.match(publicSource, /透明度边界/);

  assert.doesNotMatch(publicSource, /0\.30S|0\.4 ×|30 \/ 30 \/ 20 \/ 10 \/ 10/);
  assert.doesNotMatch(publicSource, /UptimeScore|RiskPenalty|days_diff|recent_complaints_count/);
  assert.doesNotMatch(publicSource, /冷启动系数\s*=|阈值分段|Nebula Air|Worked Example/);
});

test('React report switches between historical four-dimensional and current five-dimensional coverage views', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const methodologyStart = source.indexOf('function ReportMethodologyCard');
  const methodologyEnd = source.indexOf('function ReportSnapshotGrid', methodologyStart);
  assert.notEqual(methodologyStart, -1);
  assert.notEqual(methodologyEnd, -1);
  const methodologySource = source.slice(methodologyStart, methodologyEnd);

  assert.match(methodologySource, /data\.score_rule_version === 'v2_spncr'/);
  assert.match(methodologySource, /isV2 \? '五维评分模型' : '四维评分模型'/);
  assert.match(methodologySource, /isV2 \? 'S · P · N · C · R' : 'S · P · C · R'/);
  assert.match(methodologySource, /本报告\{isV2 \? '五维' : '四维'\}评分分布/);

  const breakdownStart = source.indexOf('function ReportScoreBreakdown');
  const breakdownEnd = source.indexOf('function ReportCoreMetrics', breakdownStart);
  assert.notEqual(breakdownStart, -1);
  assert.notEqual(breakdownEnd, -1);
  const breakdownSource = source.slice(breakdownStart, breakdownEnd);

  assert.match(breakdownSource, /data\.score_breakdown\.n === null \? \[\] :/);
  assert.match(breakdownSource, /label: '网络覆盖 \(N\)'/);
  assert.doesNotMatch(breakdownSource, /data\.network_coverage \? \(/);
  assert.doesNotMatch(breakdownSource, /网络覆盖快照|Healthy \/ Detected|UNKNOWN|unsupported/);
});
