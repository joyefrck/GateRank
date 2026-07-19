import type {
  Airport,
  AirportScoreDaily,
  DailyMetrics,
  MonthlyReportStatus,
  RankingItem,
  RankingType,
} from '../types/domain';
import type { NewsContentService } from './newsContentService';

export interface GeneratedMonthlyReportInput {
  year: number;
  month: number;
  slug: string;
  title: string;
  h1: string;
  excerpt: string;
  content_markdown: string;
  content_html: string;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  cover_image_url: string;
  og_image_url: string;
  og_image_alt: string;
  status: MonthlyReportStatus;
  published_at: string | null;
}

export interface MonthlyReportPeriodOption {
  year: number;
  month: number;
  label: string;
  available: boolean;
  reason: string | null;
}

export interface MonthlyReportPeriodOptionsView {
  years: Array<{
    year: number;
    months: MonthlyReportPeriodOption[];
  }>;
}

interface MonthlyReportGenerationDeps {
  airportRepository: {
    listAll(): Promise<Airport[]>;
  };
  metricsRepository: {
    getByAirportIdsAndDate(airportIds: number[], date: string): Promise<Map<number, DailyMetrics>>;
  };
  scoreRepository: {
    getLatestAvailableDate(onOrBefore: string): Promise<string | null>;
    getByAirportIdsAndDate(airportIds: number[], date: string): Promise<Map<number, AirportScoreDaily>>;
  };
  rankingRepository: {
    getRanking(date: string, listType: RankingType): Promise<RankingItem[]>;
  };
  monthlyReportRepository?: {
    listPeriods(): Promise<Array<{ year: number; month: number }>>;
  };
  newsContentService: NewsContentService;
  now?: () => Date;
}

interface ReportRow {
  airport: Airport;
  metrics: DailyMetrics;
  score: AirportScoreDaily;
}

const REPORT_KEYWORDS = '机场VPN月度报告,机场推荐,机场排名,机场VPN排名,科学上网机场,跑路机场,GateRank';

export class MonthlyReportGenerationService {
  constructor(private readonly deps: MonthlyReportGenerationDeps) {}

  async generate(period: { year: number; month: number }): Promise<GeneratedMonthlyReportInput> {
    const { year, month } = period;
    const requestedDate = getMonthEndDate(year, month);
    const sourceDate = await this.deps.scoreRepository.getLatestAvailableDate(requestedDate);
    if (!sourceDate || !isSameReportMonth(sourceDate, year, month)) {
      throw new Error('MONTHLY_REPORT_SOURCE_DATA_NOT_FOUND');
    }

    const airports = (await this.deps.airportRepository.listAll()).filter((airport) => airport.is_listed);
    const airportIds = airports.map((airport) => airport.id);
    const [metricsById, scoresById, rankingLists] = await Promise.all([
      this.deps.metricsRepository.getByAirportIdsAndDate(airportIds, sourceDate),
      this.deps.scoreRepository.getByAirportIdsAndDate(airportIds, sourceDate),
      this.loadRankingLists(sourceDate),
    ]);
    const rows = airports
      .map((airport) => {
        const metrics = metricsById.get(airport.id);
        const score = scoresById.get(airport.id);
        return metrics && score ? { airport, metrics, score } : null;
      })
      .filter((row): row is ReportRow => row !== null);
    if (rows.length === 0) {
      throw new Error('MONTHLY_REPORT_SOURCE_DATA_NOT_FOUND');
    }

    const title = `${year}年${month}月机场 VPN 月度报告`;
    const markdown = buildMonthlySummaryMarkdown({ year, month, requestedDate, sourceDate, rows, rankingLists });
    const rendered = this.deps.newsContentService.render(markdown);
    const excerpt = buildExcerpt(year, month, sourceDate, rows);
    return {
      year,
      month,
      slug: `${year}-${pad2(month)}-airport-vpn-ranking-report`,
      title,
      h1: title,
      excerpt,
      content_markdown: markdown,
      content_html: rendered.html,
      seo_title: `${title} - GateRank 机场推荐与机场排行榜`,
      seo_description: excerpt,
      seo_keywords: REPORT_KEYWORDS,
      cover_image_url: '',
      og_image_url: '',
      og_image_alt: title,
      status: 'draft',
      published_at: null,
    };
  }

  async buildPeriodOptions(yearCount = 8): Promise<MonthlyReportPeriodOptionsView> {
    const current = getCurrentYearMonth(this.deps.now?.() || new Date());
    const existingPeriods = new Set(
      (await this.deps.monthlyReportRepository?.listPeriods() || [])
        .map((item) => periodKey(item.year, item.month)),
    );
    const years = Array.from({ length: yearCount }, (_, index) => current.year - index).map((year) => ({
      year,
      months: Array.from({ length: 12 }, (_, index) => {
        const month = index + 1;
        const completed = isCompletedReportMonth(year, month, current);
        const exists = existingPeriods.has(periodKey(year, month));
        const reason = exists
          ? '该月份已经存在报告'
          : completed ? null : (year === current.year && month === current.month ? '当前月尚未结束' : '未来月份不可生成');
        return {
          year,
          month,
          label: `${month} 月`,
          available: completed && !exists,
          reason,
        };
      }),
    }));
    return { years };
  }

  private async loadRankingLists(date: string): Promise<Record<RankingType, RankingItem[]>> {
    const [today, stable, value, newest, risk] = await Promise.all([
      this.deps.rankingRepository.getRanking(date, 'today'),
      this.deps.rankingRepository.getRanking(date, 'stable'),
      this.deps.rankingRepository.getRanking(date, 'value'),
      this.deps.rankingRepository.getRanking(date, 'new'),
      this.deps.rankingRepository.getRanking(date, 'risk'),
    ]);
    return { today, stable, value, new: newest, risk };
  }
}

function buildMonthlySummaryMarkdown(input: {
  year: number;
  month: number;
  requestedDate: string;
  sourceDate: string;
  rows: ReportRow[];
  rankingLists: Record<RankingType, RankingItem[]>;
}): string {
  const { year, month, requestedDate, sourceDate, rows, rankingLists } = input;
  const monthLabel = `${year}-${pad2(month)}`;
  const byScore = [...rows].sort((a, b) => getDisplayScore(b.score) - getDisplayScore(a.score));
  const byStable = [...rows].sort((a, b) => b.score.s - a.score.s);
  const byPerformance = [...rows].sort((a, b) => b.score.p - a.score.p);
  const byValue = [...rows].sort((a, b) => b.score.c - a.score.c || a.airport.plan_price_month - b.airport.plan_price_month);
  const riskRows = rows
    .filter((row) => row.airport.status === 'risk' || row.airport.status === 'down' || row.score.risk_penalty > 10 || row.metrics.recent_complaints_count > 0 || row.metrics.history_incidents > 0)
    .sort((a, b) => b.score.risk_penalty - a.score.risk_penalty);
  const newRows = rows
    .filter((row) => isSameReportMonth(row.airport.created_at, year, month))
    .sort((a, b) => b.airport.created_at.localeCompare(a.airport.created_at));
  const abnormalRows = rows
    .filter((row) => row.metrics.uptime_percent_30d < 95 || row.metrics.packet_loss_percent >= 1 || row.metrics.median_latency_ms >= 180)
    .sort((a, b) => b.score.risk_penalty - a.score.risk_penalty);

  return [
    `# ${year}年${month}月机场 VPN 月度报告`,
    '',
    `> 报告期间：${monthLabel}-01 至 ${requestedDate}`,
    `> 数据口径：截至 ${sourceDate} 的近 30 天 GateRank 全站观测快照`,
    `> 样本范围：${rows.length} 个已上架机场`,
    '',
    '## 一、执行摘要',
    '',
    `GateRank 在 ${monthLabel} 的月度汇总报告覆盖 **${rows.length} 个已上架机场**。本月综合表现最靠前的是 **${airportNames(byScore, 3)}**；稳定性表现最突出的是 **${airportNames(byStable, 3)}**；性价比观察中更值得关注的是 **${airportNames(byValue, 3)}**。`,
    '',
    `风险侧，本月共有 **${riskRows.length} 个机场** 进入风险观察样本。报告会把综合榜单、稳定性、性能、价格和风险放在同一份固定模板里，便于跟踪机场推荐、机场排行榜和长期测评结论。`,
    '',
    '## 二、全站样本概览',
    '',
    '| 指标 | 数值 |',
    '| --- | ---: |',
    `| 已上架样本 | ${rows.length} |`,
    `| 正常机场 | ${rows.filter((row) => row.airport.status === 'normal').length} |`,
    `| 风险观察 | ${rows.filter((row) => row.airport.status === 'risk').length} |`,
    `| 跑路/不可用 | ${rows.filter((row) => row.airport.status === 'down').length} |`,
    `| 平均综合分 | ${formatScore(avg(rows.map((row) => getDisplayScore(row.score))))} |`,
    `| 平均 30 天可用率 | ${formatPercent(avg(rows.map((row) => row.metrics.uptime_percent_30d)))} |`,
    `| 平均下载中位数 | ${formatMbps(avg(rows.map((row) => row.metrics.median_download_mbps)))} |`,
    `| 平均月付价格 | ${formatMoney(avg(rows.map((row) => row.airport.plan_price_month)))} |`,
    '',
    '## 三、综合榜单变化',
    '',
    renderRankingSection(rankingLists.today, byScore),
    '',
    '## 四、稳定性分类',
    '',
    renderAirportTable(byStable.slice(0, 10), '稳定性 S', (row) => formatScore(row.score.s), (row) => `${formatPercent(row.metrics.uptime_percent_30d)} / 健康 ${row.metrics.healthy_days_streak ?? row.metrics.stable_days_streak} 天`),
    '',
    '## 五、性能分类',
    '',
    renderAirportTable(byPerformance.slice(0, 10), '性能 P', (row) => formatScore(row.score.p), (row) => `${formatMbps(row.metrics.median_download_mbps)} / ${formatMs(row.metrics.median_latency_ms)}`),
    '',
    '## 六、性价比分类',
    '',
    renderAirportTable(byValue.slice(0, 10), '价格 C', (row) => formatScore(row.score.c), (row) => `${formatMoney(row.airport.plan_price_month)} / 月，试用：${row.airport.has_trial ? '支持' : '不明确'}`),
    '',
    '## 七、风险观察',
    '',
    riskRows.length
      ? renderAirportTable(riskRows.slice(0, 10), '风险罚分', (row) => formatScore(row.score.risk_penalty), (row) => `${formatAirportStatus(row.airport.status)} / 投诉 ${row.metrics.recent_complaints_count} / 历史异常 ${row.metrics.history_incidents}`)
      : '本月已上架样本中未观察到明显风险集中暴露。',
    '',
    '## 八、新入榜与异常机场',
    '',
    '### 新入榜样本',
    '',
    newRows.length ? renderAirportTable(newRows.slice(0, 8), '综合分', (row) => formatScore(getDisplayScore(row.score)), (row) => `创建于 ${row.airport.created_at.slice(0, 10)}`) : '本月暂无新入榜已上架机场。',
    '',
    '### 异常观察样本',
    '',
    abnormalRows.length ? renderAirportTable(abnormalRows.slice(0, 8), '风险罚分', (row) => formatScore(row.score.risk_penalty), (row) => `${formatPercent(row.metrics.uptime_percent_30d)} / 代理请求失败 ${formatPercent(row.metrics.packet_loss_percent)} / 延迟 ${formatMs(row.metrics.median_latency_ms)}`) : '本月暂无明显异常样本。',
    '',
    '## 九、客户端、节点与支付能力分布',
    '',
    renderCapabilitySummary(rows),
    '',
    '## 十、下月观察项',
    '',
    ...buildNextMonthWatchItems(rows, riskRows, abnormalRows).map((item) => `- ${item}`),
    '',
    '## 十一、评分口径附录',
    '',
    '- 稳定性 S：综合近 30 天可用率、延迟波动、连续健康天数和稳定天数。',
    '- 性能 P：综合下载速度中位数、延迟中位数、代理请求失败率和节点可用性。',
    '- 价格 C：以月付价格、试用、套餐形态和能力覆盖作为主要参考。',
    '- 风险 R：从域名、SSL、投诉、历史异常、状态标签和节点可用性中扣分。',
    '- 综合分：采用 GateRank 当前公开评分模型，并优先使用管理员确认后的公开总分。',
    '',
    `_本报告由 GateRank 后台自动生成，源数据来自 ${sourceDate} 的全站月度快照。_`,
    '',
  ].join('\n');
}

function renderRankingSection(ranking: RankingItem[], fallbackRows: ReportRow[]): string {
  const items = ranking.length
    ? ranking.slice(0, 10).map((item) => `| ${item.rank} | ${item.name} | ${formatScore(item.score)} | ${formatAirportStatus(item.status)} |`)
    : fallbackRows.slice(0, 10).map((row, index) => `| ${index + 1} | ${row.airport.name} | ${formatScore(getDisplayScore(row.score))} | ${formatAirportStatus(row.airport.status)} |`);
  return [
    '| 排名 | 机场 | 分数 | 状态 |',
    '| ---: | --- | ---: | --- |',
    ...items,
  ].join('\n');
}

function renderAirportTable(
  rows: ReportRow[],
  metricLabel: string,
  metricValue: (row: ReportRow) => string,
  note: (row: ReportRow) => string,
): string {
  return [
    `| 机场 | ${metricLabel} | 观察 |`,
    '| --- | ---: | --- |',
    ...rows.map((row) => `| ${row.airport.name} | ${metricValue(row)} | ${note(row)} |`),
  ].join('\n');
}

function renderCapabilitySummary(rows: ReportRow[]): string {
  const trialCount = rows.filter((row) => row.airport.has_trial).length;
  const annualCount = rows.filter((row) => row.airport.has_annual_plan).length;
  const telegramCount = rows.filter((row) => row.airport.has_telegram_group).length;
  const cryptoCount = rows.filter((row) => (row.airport.payment_methods || []).some((method) => method.startsWith('usdt') || method === 'crypto_other')).length;
  const streaming = countValues(rows.flatMap((row) => row.airport.streaming_support || []));
  const payments = countValues(rows.flatMap((row) => row.airport.payment_methods || []));
  return [
    `本月样本中，支持试用的机场有 **${trialCount} 个**，明确支持年付套餐的机场有 **${annualCount} 个**，有 Telegram 社群的机场有 **${telegramCount} 个**，支持 USDT 或其他加密货币支付的机场有 **${cryptoCount} 个**。`,
    '',
    '| 能力项 | 分布 |',
    '| --- | --- |',
    `| 流媒体支持 | ${formatCountMap(streaming)} |`,
    `| 支付方式 | ${formatCountMap(payments)} |`,
  ].join('\n');
}

function buildNextMonthWatchItems(rows: ReportRow[], riskRows: ReportRow[], abnormalRows: ReportRow[]): string[] {
  const items = [
    `继续跟踪综合分前 ${Math.min(5, rows.length)} 的机场，确认稳定性和性能是否能跨月保持。`,
  ];
  if (riskRows.length > 0) {
    items.push(`重点复核 ${airportNames(riskRows, 5)} 的风险扣分来源，避免风险样本扩大。`);
  }
  if (abnormalRows.length > 0) {
    items.push(`复查 ${airportNames(abnormalRows, 5)} 的低可用率、高延迟或高代理请求失败表现。`);
  }
  items.push('观察新入榜机场是否具备连续 30 天数据，避免单月短期表现误导推荐结论。');
  return items;
}

function buildExcerpt(year: number, month: number, sourceDate: string, rows: ReportRow[]): string {
  const byScore = [...rows].sort((a, b) => getDisplayScore(b.score) - getDisplayScore(a.score));
  return `${year}年${month}月 GateRank 机场 VPN 月度报告，基于截至 ${sourceDate} 的 ${rows.length} 个已上架机场全量样本，汇总机场推荐、机场排行榜、稳定性、性能、性价比和风险观察。综合表现靠前：${airportNames(byScore, 3)}。`;
}

function getDisplayScore(score: AirportScoreDaily): number {
  const manual = score.details?.manual_total_score;
  return typeof manual === 'number' ? manual : score.final_score;
}

function airportNames(rows: ReportRow[], limit: number): string {
  return rows.slice(0, limit).map((row) => row.airport.name).join('、') || '暂无样本';
}

function avg(values: number[]): number {
  const safeValues = values.filter((value) => Number.isFinite(value));
  return safeValues.length ? safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length : 0;
}

function countValues(values: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const value of values) {
    map.set(value, (map.get(value) || 0) + 1);
  }
  return map;
}

function formatCountMap(map: Map<string, number>): string {
  if (map.size === 0) return '暂无明确数据';
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, value]) => `${key} ${value}`)
    .join('、');
}

function formatScore(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-';
}

function formatPercent(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)}%` : '-';
}

function formatMbps(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(2)} Mbps` : '-';
}

function formatMs(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(0)} ms` : '-';
}

function formatMoney(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `¥${value.toFixed(2)}` : '-';
}

function formatAirportStatus(status: string): string {
  if (status === 'risk') return '风险观察';
  if (status === 'down') return '跑路/不可用';
  return '正常';
}

function getCurrentYearMonth(date: Date): { year: number; month: number } {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(date);
  const [year, month] = formatted.split('-').map((part) => Number(part));
  return { year, month };
}

function isCompletedReportMonth(year: number, month: number, current: { year: number; month: number }): boolean {
  return year < current.year || (year === current.year && month < current.month);
}

function getMonthEndDate(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function isSameReportMonth(date: string, year: number, month: number): boolean {
  return date.slice(0, 7) === `${year}-${pad2(month)}`;
}

function periodKey(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
