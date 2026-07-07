import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

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
