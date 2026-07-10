import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('React streaming check only starts from the button and probes six services once per run', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/streamingCheck/StreamingCheckPage.tsx'), 'utf8');
  assert.match(source, /onClick=\{\(\) => \{ void runCheck\(\); \}\}/);
  assert.match(source, /const apiTask = requestStreamingCheck\(\)/);
  assert.match(source, /const probeTasks = STREAMING_SERVICES\.map/);
  assert.match(source, /const image = new Image\(\)/);
  assert.match(source, /image\.referrerPolicy = 'no-referrer'/);
  assert.match(source, /probeUrl\.searchParams\.set\('_gr_probe'/);
  assert.match(source, /window\.setTimeout\(\(\) => finish\('timeout'\), 8000\)/);
  assert.doesNotMatch(source, /mode: 'no-cors'/);
  assert.match(source, /NETFLIX_MANUAL_TESTS\.map/);
  assert.match(source, /rel="nofollow noreferrer noopener"/);
  assert.doesNotMatch(source, /useEffect\([\s\S]{0,200}runCheck/);
});

test('React full ranking report action remains a crawlable anchor', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const panelStart = source.indexOf('操作入口');
  assert.notEqual(panelStart, -1);
  const panelEnd = source.indexOf('</MarketingImpressionWrapper>', panelStart);
  assert.notEqual(panelEnd, -1);
  const fullRankingActionPanel = source.slice(panelStart, panelEnd);

  assert.match(fullRankingActionPanel, /href=\{item\.report_url\}/);
  assert.match(fullRankingActionPanel, /data-event="ranking_report_click"/);
  assert.doesNotMatch(fullRankingActionPanel, /navigate\(item\.report_url\)/);
});

test('React full ranking filter chips remain crawlable anchors with static SEO hrefs', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

  const groupStart = source.indexOf('function FullRankingFilterGroup');
  assert.notEqual(groupStart, -1);
  const groupEnd = source.indexOf('function FullRankingCapabilitySummary', groupStart);
  assert.notEqual(groupEnd, -1);
  const groupSource = source.slice(groupStart, groupEnd);

  assert.match(groupSource, /<a/);
  assert.match(groupSource, /href=\{buildFullRankingHref\(undefined, 1, toggleFullRankingFilterValue\(filters, category, option\.key\)\)\}/);
  assert.match(groupSource, /full-ranking-filter-chip/);
  assert.match(groupSource, /is-active border-neutral-900 bg-neutral-900 text-white/);
  assert.doesNotMatch(groupSource, /<button/);
});

test('React full ranking selected chips force readable active text color', async () => {
  const appSource = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
  const cssSource = await readFile(path.join(process.cwd(), 'src/index.css'), 'utf8');

  const panelStart = appSource.indexOf('function FullRankingFilterPanel');
  assert.notEqual(panelStart, -1);
  const panelEnd = appSource.indexOf('function FullRankingFilterGroup', panelStart);
  assert.notEqual(panelEnd, -1);
  const panelSource = appSource.slice(panelStart, panelEnd);

  assert.match(panelSource, /full-ranking-filter-chip is-active/);
  assert.match(panelSource, /full-ranking-filter-chip inline-flex/);
  assert.match(panelSource, /is-active border-neutral-900 bg-neutral-900 text-white/);
  assert.match(cssSource, /\.full-ranking-filter-chip\.is-active\s*\{/);
  assert.match(cssSource, /color:\s*#ffffff;/);
  assert.match(cssSource, /-webkit-text-fill-color:\s*#ffffff;/);
});

test('React report page keeps outbound CTA and comparison links as anchors', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

  const heroStart = source.indexOf('function ReportHeroV2');
  assert.notEqual(heroStart, -1);
  const heroEnd = source.indexOf('function ReportContentNarrative', heroStart);
  assert.notEqual(heroEnd, -1);
  const heroSource = source.slice(heroStart, heroEnd);
  assert.match(heroSource, /href=\{buildOutboundAirportHref\(data\.airport\.id, 'website', 'report_header'\)\}/);
  assert.match(heroSource, /target="_blank"/);
  assert.match(heroSource, /createTrackedOutboundClickHandler/);

  const comparisonStart = source.indexOf('function ReportComparisonLinks');
  assert.notEqual(comparisonStart, -1);
  const comparisonEnd = source.indexOf('function ReportScoreCard', comparisonStart);
  assert.notEqual(comparisonEnd, -1);
  const comparisonSource = source.slice(comparisonStart, comparisonEnd);
  assert.match(comparisonSource, /<a/);
  assert.match(comparisonSource, /href=\{link\.href\}/);
  assert.doesNotMatch(comparisonSource, /navigate\(link\.href\)/);
});

test('React deals page uses the shared orange list hero', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/deals/DealsPage.tsx'), 'utf8');

  assert.match(source, /<ListPageHero/);
  assert.match(source, /tone="orange"/);
  assert.match(source, /label: '当前活动'/);
  assert.match(source, /label: '免费试用'/);
  assert.match(source, /label: '支持 USDT'/);
  assert.match(source, /pt-10 md:pt-14/);
  assert.doesNotMatch(source, /function HeroMetric/);
});

test('React methodology page uses the shared sky list hero', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/methodology/MethodologyPage.tsx'), 'utf8');

  assert.match(source, /<ListPageHero/);
  assert.match(source, /tone="sky"/);
  assert.match(source, /label: item\.label/);
  assert.match(source, /value: item\.value/);
  assert.match(source, /pt-10 md:pt-14/);
});

test('React homepage renders shared SEO content with crawlable anchors', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

  assert.match(source, /HOME_SEO_CONTENT_SECTIONS/);
  assert.match(source, /HOME_FAQ_ITEMS/);

  const contentStart = source.indexOf('function HomeSeoContent');
  assert.notEqual(contentStart, -1);
  const contentEnd = source.indexOf('function FullRankingPage', contentStart);
  assert.notEqual(contentEnd, -1);
  const contentSource = source.slice(contentStart, contentEnd);

  assert.match(contentSource, /<a/);
  assert.match(contentSource, /href=\{link\.href\}/);
  assert.doesNotMatch(contentSource, /navigate\(link\.href\)/);
});

test('React homepage SEO guide keeps inner topics below the section H2', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/App.tsx'), 'utf8');

  const contentStart = source.indexOf('function HomeSeoContent');
  assert.notEqual(contentStart, -1);
  const contentEnd = source.indexOf('function FullRankingPage', contentStart);
  assert.notEqual(contentEnd, -1);
  const contentSource = source.slice(contentStart, contentEnd);

  assert.match(contentSource, />读懂机场推荐逻辑<\/h2>/);
  assert.match(contentSource, /<h3[^>]*>\{section\.title\}<\/h3>/);
  assert.match(contentSource, /<h3[^>]*>\{entrySection\.title\}<\/h3>/);
  assert.match(contentSource, /<h3[^>]*>常见问题<\/h3>/);
});

test('React monthly report rows expose the view action as a crawlable anchor', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/pages/monthlyReports/MonthlyReportsPage.tsx'), 'utf8');

  const rowStart = source.indexOf('function MonthlyReportRow');
  assert.notEqual(rowStart, -1);
  const rowEnd = source.indexOf('function HeroMetric', rowStart);
  assert.notEqual(rowEnd, -1);
  const rowSource = source.slice(rowStart, rowEnd);

  assert.match(rowSource, /<a[^>]+href=\{href\}[^>]*>/);
  assert.match(rowSource, /navigate\(href\)/);
  assert.doesNotMatch(rowSource, /<button/);
});

test('React SEO hook reuses the server-rendered JSON-LD script when present', async () => {
  const source = await readFile(path.join(process.cwd(), 'src/site/publicSite.tsx'), 'utf8');

  const hookStart = source.indexOf('export function usePageSeo');
  assert.notEqual(hookStart, -1);
  const hookEnd = source.indexOf('function toAbsoluteImageUrl', hookStart);
  assert.notEqual(hookEnd, -1);
  const hookSource = source.slice(hookStart, hookEnd);

  assert.match(hookSource, /document\.head\.querySelector\('script\[type="application\/ld\+json"\]'\)/);
  assert.match(hookSource, /script\.id = scriptId/);
});
