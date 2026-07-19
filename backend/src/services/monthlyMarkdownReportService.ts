import type {
  ReportCapabilities,
  ReportCapabilityItem,
  ReportCapabilityRegion,
  ReportView,
} from '../types/domain';

interface MonthlyMarkdownReportInput {
  report: ReportView;
  year: number;
  month: number;
  requestedDate: string;
  siteOrigin?: string;
}

export function buildMonthlyMarkdownReport(input: MonthlyMarkdownReportInput): string {
  const { report, year, month, requestedDate } = input;
  const monthLabel = `${year}-${pad2(month)}`;
  const score = report.score_breakdown.final_score;
  const strengths = buildStrengths(report);
  const risks = buildRiskFindings(report);
  const trendSummary = summarizeTrends(report);
  const capabilitySummary = summarizeCapabilities(report.capabilities);
  const reportUrl = buildAirportReportUrl(input.siteOrigin, report.airport.slug);

  return [
    `# GateRank ${report.airport.name} ${monthLabel} 月度表现报告`,
    '',
    `> 报告期间：${monthLabel}-01 至 ${requestedDate}`,
    `> 数据口径：截至 ${report.date} 的近 30 天 GateRank 观测快照`,
    `> 机场榜报告：${reportUrl}`,
    '',
    '## 一、执行摘要',
    '',
    `${report.airport.name}在 ${monthLabel} 的 GateRank 月度报告中，综合分为 **${formatScore(score)}**。${report.summary_card.conclusion}`,
    '',
    `从核心指标看，稳定性得分 **${formatScore(report.score_breakdown.s)}**、性能得分 **${formatScore(report.score_breakdown.p)}**、价格得分 **${formatScore(report.score_breakdown.c)}**、风险得分 **${formatScore(report.score_breakdown.r)}**。${trendSummary}`,
    '',
    '本月核心观察：',
    ...strengths.map((item) => `- ${item}`),
    ...risks.map((item) => `- ${item}`),
    '',
    '## 二、整体表现与排名位置',
    '',
    '| 指标 | 数值 | 解读 |',
    '| --- | ---: | --- |',
    `| 综合分 | ${formatScore(score)} | ${describeOverallScore(score)} |`,
    `| 今日推荐排名 | ${formatRank(report.ranking.today_pick_rank)} | ${describeRank(report.ranking.today_pick_rank, '今日推荐')} |`,
    `| 长期稳定排名 | ${formatRank(report.ranking.most_stable_rank)} | ${describeRank(report.ranking.most_stable_rank, '长期稳定')} |`,
    `| 性价比排名 | ${formatRank(report.ranking.best_value_rank)} | ${describeRank(report.ranking.best_value_rank, '性价比')} |`,
    `| 风险预警排名 | ${formatRank(report.ranking.risk_alerts_rank)} | ${report.ranking.risk_alerts_rank ? '需要重点关注风险预警榜单暴露。' : '未进入风险预警榜，风险暴露相对可控。'} |`,
    '',
    'GateRank 的综合评价由稳定性、性能、价格与风险四个维度组成。月报采用月末近 30 天快照，适合观察机场在最近一个自然月收官时的连续表现，而不是单日偶然波动。',
    '',
    '### 分项评分',
    '',
    '| 维度 | 得分 | 本月评价 |',
    '| --- | ---: | --- |',
    `| 稳定性 S | ${formatScore(report.score_breakdown.s)} | ${describeDimension('stability', report.score_breakdown.s)} |`,
    `| 性能 P | ${formatScore(report.score_breakdown.p)} | ${describeDimension('performance', report.score_breakdown.p)} |`,
    `| 价格 C | ${formatScore(report.score_breakdown.c)} | ${describeDimension('price', report.score_breakdown.c)} |`,
    `| 风险 R | ${formatScore(report.score_breakdown.r)} | ${describeDimension('risk', report.score_breakdown.r)} |`,
    '',
    '## 三、稳定性表现',
    '',
    `过去 30 天，${report.airport.name} 的可用率为 **${formatPercent(report.metrics.uptime_percent_30d)}**，连续健康天数为 **${report.metrics.healthy_days_streak} 天**，连续稳定天数为 **${report.metrics.stable_days_streak} 天**。当前稳定性分档为 **${formatStabilityTier(report.metrics.stability_tier)}**。`,
    '',
    '| 稳定性指标 | 数值 |',
    '| --- | ---: |',
    `| 30 天可用率 | ${formatPercent(report.metrics.uptime_percent_30d)} |`,
    `| 延迟中位数 | ${formatMs(report.metrics.median_latency_ms)} |`,
    `| 代理请求失败率 | ${formatPercent(report.metrics.packet_loss_percent)} |`,
    `| 连续健康天数 | ${report.metrics.healthy_days_streak} 天 |`,
    `| 连续稳定天数 | ${report.metrics.stable_days_streak} 天 |`,
    '',
    describeStability(report),
    '',
    '## 四、性能体验',
    '',
    `性能维度主要观察节点建连延迟、下载速度与代理请求失败率。${report.airport.name}本月下载速度中位数为 **${formatMbps(report.metrics.median_download_mbps)}**，延迟中位数为 **${formatMs(report.metrics.median_latency_ms)}**，代理请求失败率为 **${formatPercent(report.metrics.packet_loss_percent)}**。`,
    '',
    '| 性能指标 | 数值 | 评价 |',
    '| --- | ---: | --- |',
    `| 下载速度中位数 | ${formatMbps(report.metrics.median_download_mbps)} | ${describeDownload(report.metrics.median_download_mbps)} |`,
    `| 延迟中位数 | ${formatMs(report.metrics.median_latency_ms)} | ${describeLatency(report.metrics.median_latency_ms)} |`,
    `| 代理请求失败率 | ${formatPercent(report.metrics.packet_loss_percent)} | ${describePacketLoss(report.metrics.packet_loss_percent)} |`,
    '',
    '## 五、风险与合规观察',
    '',
    buildRiskSection(report),
    '',
    '| 风险项 | 数值 |',
    '| --- | ---: |',
    `| 风险罚分 | ${formatScore(report.score_breakdown.risk_penalty)} |`,
    `| 域名罚分 | ${formatScore(report.score_breakdown.domain_penalty)} |`,
    `| SSL 罚分 | ${formatScore(report.score_breakdown.ssl_penalty)} |`,
    `| 投诉罚分 | ${formatScore(report.score_breakdown.complaint_penalty)} |`,
    `| 历史异常罚分 | ${formatScore(report.score_breakdown.history_penalty)} |`,
    `| 近期投诉数 | ${report.metrics.recent_complaints_count} |`,
    `| 历史异常数 | ${report.metrics.history_incidents} |`,
    '',
    '## 六、产品能力与用户适配',
    '',
    capabilitySummary,
    '',
    buildCapabilitiesTable(report.capabilities),
    '',
    '## 七、下月建议与观察项',
    '',
    ...buildRecommendations(report).map((item) => `- ${item}`),
    '',
    '## 八、附录：GateRank 评分口径',
    '',
    '- 稳定性 S：综合近 30 天可用率、延迟波动与连续健康/稳定天数。',
    '- 性能 P：综合节点建连延迟、下载速度与代理请求失败表现。',
    '- 价格 C：以月付价格为核心参考，价格越低且能力完整，价格维度越有优势。',
    '- 风险 R：从域名可用性、SSL 状态、近期投诉、历史异常与节点可用性等风险信号中扣分。',
    '- 综合分：按 GateRank 当前公开模型加权计算，并优先展示管理员人工确认后的公开总分。',
    '',
    `_本报告由 GateRank 后台于导出时生成，源数据来自 ${report.date} 的机场报告快照。_`,
    '',
  ].join('\n');
}

function buildAirportReportUrl(siteOrigin: string | undefined, slug: string): string {
  const path = `/airports/${slug}`;
  const origin = String(siteOrigin || '').trim().replace(/\/+$/, '');
  return origin ? `${origin}${path}` : path;
}

function buildStrengths(report: ReportView): string[] {
  const items: string[] = [];
  if (report.metrics.uptime_percent_30d >= 99) {
    items.push(`稳定性表现突出，30 天可用率达到 ${formatPercent(report.metrics.uptime_percent_30d)}。`);
  }
  if (report.metrics.healthy_days_streak >= 14) {
    items.push(`连续健康运行 ${report.metrics.healthy_days_streak} 天，具备较好的持续服务能力。`);
  }
  if (report.metrics.median_download_mbps >= 80) {
    items.push(`下载速度中位数达到 ${formatMbps(report.metrics.median_download_mbps)}，性能体验具备竞争力。`);
  }
  if (report.score_breakdown.r >= 85 && report.score_breakdown.risk_penalty <= 10) {
    items.push('风险暴露较低，域名、投诉和历史异常信号整体健康。');
  }
  if (report.capabilities.regions.length >= 3) {
    items.push(`节点覆盖 ${report.capabilities.regions.length} 个主要地区，适合多地区使用场景。`);
  }
  return items.length ? items : ['本月整体数据已形成可观察闭环，具备继续跟踪和优化的基础。'];
}

function buildRiskFindings(report: ReportView): string[] {
  const items: string[] = [];
  if (report.metrics.recent_complaints_count > 0) {
    items.push(`近期投诉 ${report.metrics.recent_complaints_count} 条，需要持续跟进用户反馈。`);
  }
  if (report.metrics.history_incidents > 0) {
    items.push(`历史异常记录 ${report.metrics.history_incidents} 次，建议在公开运营和服务承诺上保持透明。`);
  }
  if (report.score_breakdown.risk_penalty > 20) {
    items.push(`风险罚分为 ${formatScore(report.score_breakdown.risk_penalty)}，下月应优先排查风险扣分来源。`);
  }
  return items;
}

function summarizeTrends(report: ReportView): string {
  const scoreTrend = describeTrend(report.trends.score_30d);
  const uptimeTrend = describeTrend(report.trends.uptime_30d);
  return `近 30 天综合分趋势${scoreTrend}，可用率趋势${uptimeTrend}。`;
}

function describeTrend(items: Array<{ date: string; value: number }>): string {
  if (items.length < 2) {
    return '暂无足够连续数据';
  }
  const first = items[0].value;
  const last = items[items.length - 1].value;
  const delta = last - first;
  if (Math.abs(delta) < 1) {
    return '基本稳定';
  }
  return delta > 0 ? `上升 ${formatScore(delta)} 点` : `下降 ${formatScore(Math.abs(delta))} 点`;
}

function buildRiskSection(report: ReportView): string {
  if (report.score_breakdown.risk_penalty <= 10 && report.metrics.recent_complaints_count === 0 && report.metrics.history_incidents === 0) {
    return `${report.airport.name}本月风险面表现较好，未观察到明显投诉和历史异常压力，风险罚分仅为 **${formatScore(report.score_breakdown.risk_penalty)}**。这类表现有助于增强用户对机场长期运营稳定性的信任，也适合在对外沟通中强调其低风险、低波动优势。`;
  }
  return `${report.airport.name}本月风险罚分为 **${formatScore(report.score_breakdown.risk_penalty)}**，风险分为 **${formatScore(report.score_breakdown.r)}**。${report.summary_card.conclusion} 下月建议优先处理仍在扣分的风险项，尤其是投诉、历史异常或域名/SSL 相关问题。`;
}

function summarizeCapabilities(capabilities: ReportCapabilities): string {
  const regions = capabilities.regions.length
    ? capabilities.regions.map((item) => `${item.label} ${item.node_count} 个节点`).join('、')
    : '暂无明确地区覆盖数据';
  const streaming = formatItems(capabilities.streaming);
  const payments = formatItems(capabilities.payment_methods);
  const clients = formatItems(capabilities.clients);
  return `产品能力方面，当前节点地区覆盖为：${regions}。流媒体与应用支持包括：${streaming}；支付方式包括：${payments}；客户端与导入体验包括：${clients}。`;
}

function buildCapabilitiesTable(capabilities: ReportCapabilities): string {
  const plan = capabilities.plan;
  const telegram = capabilities.telegram;
  return [
    '| 能力项 | 当前状态 |',
    '| --- | --- |',
    `| 月付套餐 | ${formatBoolean(plan.supports_monthly)}，最低月付 ${formatMoney(plan.lowest_monthly_price)} |`,
    `| 年付折算 | ${formatMoney(plan.lowest_annual_monthly_price)} / 月 |`,
    `| 试用 / 一次性套餐 | 试用：${formatBoolean(plan.has_trial_plan)}；一次性套餐：${formatBoolean(plan.has_lifetime_plan)} |`,
    `| 流媒体支持 | ${formatItems(capabilities.streaming)} |`,
    `| 支付方式 | ${formatItems(capabilities.payment_methods)} |`,
    `| Telegram 社群 | 群组：${formatBoolean(telegram.has_group)}；可发言：${formatBoolean(telegram.group_allows_speaking)}；成员数：${telegram.group_member_count ?? '-'} |`,
    `| 客户端 | ${formatItems(capabilities.clients)} |`,
    `| 导入方式 | ${formatItems(capabilities.import_methods)} |`,
    `| 节点地区 | ${formatRegions(capabilities.regions)} |`,
  ].join('\n');
}

function buildRecommendations(report: ReportView): string[] {
  const items: string[] = [];
  if (report.metrics.uptime_percent_30d < 99) {
    items.push('优先提升可用率，把 30 天可用率稳定推进到 99% 以上。');
  } else {
    items.push('继续维持当前可用率表现，将稳定性优势沉淀为长期口碑。');
  }
  if (report.metrics.median_download_mbps < 50) {
    items.push('针对下载速度进行节点和带宽优化，优先改善高峰期吞吐表现。');
  } else {
    items.push('保持现有性能采样水位，持续观察下载中位数和地区节点差异。');
  }
  if (report.score_breakdown.risk_penalty > 10) {
    items.push('逐项复盘风险扣分来源，优先处理投诉、域名、SSL 或历史异常问题。');
  } else {
    items.push('风险面较健康，可在公开介绍中强调稳定运营和低风险观察结果。');
  }
  if (report.capabilities.regions.length < 3) {
    items.push('补充主要地区节点覆盖，提升不同用户群体的可选空间。');
  } else {
    items.push('继续维护多地区节点质量，避免地区覆盖丰富但单点体验波动。');
  }
  return items;
}

function describeStability(report: ReportView): string {
  if (report.metrics.uptime_percent_30d >= 99 && report.metrics.healthy_days_streak >= 14) {
    return '稳定性是本月最值得强调的优势之一。连续健康天数和高可用率共同说明该机场在近 30 天内具备较好的服务连续性，适合强调长期使用体验。';
  }
  if (report.metrics.uptime_percent_30d >= 95) {
    return '稳定性处于可用区间，但仍有进一步压低波动的空间。建议重点观察异常日期、节点可用率和高峰时段延迟表现。';
  }
  return '稳定性仍是下月需要优先改善的方向。建议先定位不可用样本来源，再结合节点地区和线路质量做针对性修复。';
}

function describeOverallScore(score: number | null): string {
  if (score === null) return '当前公开总分未展示，可能受余额或数据完整性影响。';
  if (score >= 80) return '综合竞争力较强，适合对外强调稳定和体验优势。';
  if (score >= 60) return '综合表现可用，但仍有明确优化空间。';
  return '综合表现偏弱，需要优先改善短板项。';
}

function describeDimension(type: 'stability' | 'performance' | 'price' | 'risk', score: number): string {
  if (score >= 85) {
    return {
      stability: '稳定性优势明显。',
      performance: '性能体验具备亮点。',
      price: '价格竞争力较强。',
      risk: '风险面表现健康。',
    }[type];
  }
  if (score >= 65) {
    return {
      stability: '稳定性基本可控。',
      performance: '性能处于可用区间。',
      price: '价格处于中等区间。',
      risk: '风险整体可控但需跟踪。',
    }[type];
  }
  return {
    stability: '稳定性短板明显。',
    performance: '性能仍需优化。',
    price: '价格优势不足。',
    risk: '风险暴露偏高。',
  }[type];
}

function describeRank(rank: number | null, label: string): string {
  if (!rank) return `未进入${label}榜单。`;
  if (rank <= 3) return `${label}榜单头部位置。`;
  if (rank <= 10) return `${label}榜单前列。`;
  return `${label}榜单第 ${rank} 位。`;
}

function describeDownload(value: number): string {
  if (value >= 100) return '高吞吐表现，适合强调速度优势。';
  if (value >= 50) return '速度表现良好，满足主流使用场景。';
  return '速度偏保守，建议继续优化。';
}

function describeLatency(value: number): string {
  if (value <= 100) return '低延迟体验优秀。';
  if (value <= 250) return '延迟可控。';
  return '延迟偏高，建议关注线路质量。';
}

function describePacketLoss(value: number): string {
  if (value <= 0.5) return '代理请求失败控制优秀。';
  if (value <= 2) return '代理请求失败处于可接受范围。';
  return '代理请求失败率偏高，建议排查节点稳定性。';
}

function formatRank(value: number | null): string {
  return value ? `#${value}` : '-';
}

function formatScore(value: number | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }
  return Number(value).toFixed(2).replace(/\.00$/, '');
}

function formatPercent(value: number): string {
  return `${formatScore(value)}%`;
}

function formatMs(value: number): string {
  return `${formatScore(value)} ms`;
}

function formatMbps(value: number): string {
  return `${formatScore(value)} Mbps`;
}

function formatMoney(value: number | null): string {
  return value === null || value === undefined ? '-' : `¥${formatScore(value)}`;
}

function formatBoolean(value: boolean | null): string {
  if (value === null || value === undefined) return '未确认';
  return value ? '是' : '否';
}

function formatItems(items: ReportCapabilityItem[]): string {
  return items.length ? items.map((item) => item.label).join('、') : '暂无明确数据';
}

function formatRegions(items: ReportCapabilityRegion[]): string {
  return items.length
    ? items.map((item) => `${item.label}（${item.node_count}）`).join('、')
    : '暂无明确数据';
}

function formatStabilityTier(value: string): string {
  if (value === 'stable') return '稳定';
  if (value === 'minor_fluctuation') return '轻微波动';
  return '波动';
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}
