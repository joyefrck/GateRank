export const REPORT_ANCHOR_SECTIONS = [
  { id: 'report-overview', label: '概览' },
  { id: 'report-content', label: '测评摘要' },
  { id: 'report-snapshot', label: '数据快照' },
  { id: 'report-capabilities', label: '服务能力' },
  { id: 'report-score', label: '评分拆解' },
  { id: 'report-metrics', label: '核心指标' },
  { id: 'report-trends', label: '趋势' },
  { id: 'report-plan-telegram', label: '套餐电报' },
  { id: 'report-conclusion', label: '结论建议' },
] as const;

export type ReportAnchorId = (typeof REPORT_ANCHOR_SECTIONS)[number]['id'];

export interface ReportAnchorPosition {
  id: ReportAnchorId;
  top: number;
}

export interface ReportRadarScores {
  s: number | null;
  p: number | null;
  n?: number | null;
  c: number | null;
  r: number | null;
}

export type SparklineDomain = readonly [number, number];

const REPORT_RADAR_CENTER = 60;
const REPORT_RADAR_RADIUS = 48;

export function resolveActiveReportAnchor(
  positions: ReadonlyArray<ReportAnchorPosition>,
  activationLine: number,
  isAtDocumentEnd: boolean,
): ReportAnchorId {
  if (isAtDocumentEnd) {
    return REPORT_ANCHOR_SECTIONS[REPORT_ANCHOR_SECTIONS.length - 1].id;
  }

  let active = positions[0]?.id ?? REPORT_ANCHOR_SECTIONS[0].id;
  for (const position of positions) {
    if (position.top > activationLine) {
      break;
    }
    active = position.id;
  }
  return active;
}

export function buildReportRadarPoints(scores: ReportRadarScores): string {
  if (scores.s === null || scores.p === null || scores.c === null || scores.r === null) return '';
  if (typeof scores.n === 'number' && Number.isFinite(scores.n)) {
    return buildPolarRadarPoints([scores.s, scores.p, scores.n, scores.c, scores.r]);
  }
  const s = scaleRadarScore(scores.s);
  const p = scaleRadarScore(scores.p);
  const c = scaleRadarScore(scores.c);
  const r = scaleRadarScore(scores.r);

  return [
    `${REPORT_RADAR_CENTER},${formatRadarCoordinate(REPORT_RADAR_CENTER - s)}`,
    `${formatRadarCoordinate(REPORT_RADAR_CENTER + p)},${REPORT_RADAR_CENTER}`,
    `${REPORT_RADAR_CENTER},${formatRadarCoordinate(REPORT_RADAR_CENTER + c)}`,
    `${formatRadarCoordinate(REPORT_RADAR_CENTER - r)},${REPORT_RADAR_CENTER}`,
  ].join(' ');
}

function buildPolarRadarPoints(values: ReadonlyArray<number>): string {
  return values.map((value, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / values.length;
    const radius = scaleRadarScore(value);
    const x = REPORT_RADAR_CENTER + Math.cos(angle) * radius;
    const y = REPORT_RADAR_CENTER + Math.sin(angle) * radius;
    return `${formatRadarCoordinate(x)},${formatRadarCoordinate(y)}`;
  }).join(' ');
}

export function buildSparklineChartPoints(
  values: ReadonlyArray<number>,
  domain?: SparklineDomain,
): string[] {
  if (values.length < 2) {
    return [];
  }

  const min = domain?.[0] ?? Math.min(...values);
  const max = domain?.[1] ?? Math.max(...values);
  const range = max - min || 1;
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const normalizedValue = Math.max(0, Math.min(1, (value - min) / range));
    const y = 92 - normalizedValue * 76;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
}

function scaleRadarScore(value: number): number {
  const score = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  return (score / 100) * REPORT_RADAR_RADIUS;
}

function formatRadarCoordinate(value: number): string {
  return Number(value.toFixed(2)).toString();
}
