import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  MARKETING_PAGE_KINDS,
  getMarketingPageKindLabel,
  isMarketingPageKind,
} from '../../shared/marketingAnalytics';
import {
  MARKETING_PAGE_KIND_BY_ROUTE,
  toMarketingPageKind,
} from '../../src/site/marketingRoutes';

test('marketing page kind registry covers every public HTML module', () => {
  assert.deepEqual(MARKETING_PAGE_KINDS, [
    'home',
    'full_ranking',
    'risk_monitor',
    'report',
    'deals',
    'methodology',
    'news',
    'apply',
    'publish_token_docs',
    'monthly_reports',
    'monthly_report',
    'ranking_transparency',
    'tools_index',
    'tools_download',
    'streaming_check',
    'ip_check',
    'dns_leak_test',
    'for_ai',
  ]);
  assert.equal(getMarketingPageKindLabel('deals'), '活动优惠');
  assert.equal(getMarketingPageKindLabel('monthly_report'), '月报详情');
  assert.equal(getMarketingPageKindLabel('dns_leak_test'), 'DNS 泄漏检测');
  assert.equal(getMarketingPageKindLabel('unexpected_kind'), 'unexpected_kind');
  assert.equal(isMarketingPageKind('for_ai'), true);
  assert.equal(isMarketingPageKind('unexpected_kind'), false);
});

test('React route mapping explicitly classifies or excludes every route kind', () => {
  assert.deepEqual(MARKETING_PAGE_KIND_BY_ROUTE, {
    home: 'home',
    report: 'report',
    apply: 'apply',
    portal: null,
    full_ranking: 'full_ranking',
    monthly_reports: 'monthly_reports',
    monthly_report: 'monthly_report',
    deals: 'deals',
    risk_monitor: 'risk_monitor',
    methodology: 'methodology',
    ranking_transparency: 'ranking_transparency',
    publish_token_docs: 'publish_token_docs',
    tools_index: 'tools_index',
    tools_download: 'tools_download',
    streaming_check: 'streaming_check',
    ip_check: 'ip_check',
    dns_leak_test: 'dns_leak_test',
    not_found: null,
  });
  for (const [routeKind, expected] of Object.entries(MARKETING_PAGE_KIND_BY_ROUTE)) {
    assert.equal(
      toMarketingPageKind(routeKind as keyof typeof MARKETING_PAGE_KIND_BY_ROUTE),
      expected,
    );
  }
});

test('every registered page kind has a human-readable label', () => {
  for (const pageKind of MARKETING_PAGE_KINDS) {
    assert.notEqual(getMarketingPageKindLabel(pageKind), '');
    assert.notEqual(getMarketingPageKindLabel(pageKind), pageKind);
  }
});

test('DealsPage leaves page-view tracking to the global route effect', () => {
  const dealsPageSource = readFileSync(
    resolve(process.cwd(), 'src/pages/deals/DealsPage.tsx'),
    'utf8',
  );

  assert.doesNotMatch(dealsPageSource, /\btrackMarketingPageView\b/);
});
