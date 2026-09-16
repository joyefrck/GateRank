import test from 'node:test';
import assert from 'node:assert/strict';
import { extractMonthlyReportSummary } from '../src/services/monthlyReportSummary';
import type { MonthlyReport } from '../src/types/domain';
import august from './fixtures/monthly-report-2026-08.json';

// Public snapshot from /monthly-reports/2026-08-airport-vpn-ranking-report,
// retrieved 2026-09-16. Preserve the real template, links and section boundaries.
const report = august as MonthlyReport;

test('HTML-only published reports retain the same facts as their Markdown source', () => {
  const expected = extractMonthlyReportSummary(report, report);
  assert.deepEqual(extractMonthlyReportSummary(report, { ...report, content_markdown: '  \n' }), expected);
});

test('overview and ranking tables work without introductory sample or top sentences', () => {
  const content_markdown = `## 二、全站样本概览

| 指标 | 数值 |
| --- | --- |
| 已上架样本 | 11 |

## 三、综合榜单变化

| 排名 | 机场 | 分数 |
| --- | --- | --- |
| 1 | **[Now加速·家宽机场](/airports/now)** | 94.37 |
| 2 | 大象网络 | 94.27 |
| 3 | Nice加速·AI专线 | 93.94 |

## 四、稳定性分类

| 机场 | 分数 |
| --- | --- |
| 不应混入综合榜的机场 | 100 |
`;
  const facts = extractMonthlyReportSummary(report, { ...report, content_markdown });
  assert.equal(facts.sample_size, 11);
  assert.deepEqual(facts.top_airports, ['Now加速·家宽机场', '大象网络', 'Nice加速·AI专线']);
});

test('risk tables preserve labels and observations without leaking adjacent sections', () => {
  const content_markdown = `## 七、风险观察

| 机场 | 风险罚分 | 观察 |
| --- | --- | --- |
| [风险节点](/airports/risk) | 34 | 风险观察 / 投诉 4 / 历史异常 2 |

## 八、新入榜与异常机场

### 新入榜样本

本月暂无新入榜已上架机场。

### 异常观察样本

本月暂无明显异常样本。
`;
  const facts = extractMonthlyReportSummary(report, { ...report, content_markdown });
  assert.deepEqual(facts.risk_observations, ['机场：风险节点；风险罚分：34；观察：风险观察 / 投诉 4 / 历史异常 2']);
  assert.deepEqual(facts.new_airports, []);
  assert.deepEqual(facts.abnormal_airports, []);
  assert.equal(facts.sample_size, null);
});

test('missing content is unknown rather than a fabricated zero, and explicit zero is retained', () => {
  const missing = extractMonthlyReportSummary(report);
  assert.equal(missing.sample_size, null);
  assert.equal(missing.summary, report.excerpt);
  const zero = extractMonthlyReportSummary(report, {
    ...report, content_markdown: '> 样本范围：0 个已上架机场\n\n本月综合表现最靠前的是 **暂无样本**。',
  });
  assert.equal(zero.sample_size, 0);
  assert.deepEqual(zero.top_airports, []);
});
