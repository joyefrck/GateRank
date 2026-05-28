import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsContentService } from '../src/services/newsContentService';
import { stripLeadingMarkdownH1 } from '../src/services/newsMutationService';
import { slugifyNewsText } from '../src/utils/news';

test('NewsContentService.render supports markdown lists', () => {
  const service = new NewsContentService();
  const rendered = service.render('## 清单\n\n- 第一项\n- 第二项');

  assert.match(rendered.html, /<ul class="news-list news-list-unordered">/);
  assert.match(rendered.html, /<li class="news-list-item">第一项<\/li>/);
  assert.match(rendered.html, /<li class="news-list-item">第二项<\/li>/);
  assert.deepEqual(rendered.headings, [{ id: slugifyNewsText('清单'), level: 2, text: '清单' }]);
});

test('NewsContentService.render strips dangerous raw HTML from markdown', () => {
  const service = new NewsContentService();
  const rendered = service.render([
    '<script>alert(1)</script>',
    '<img src="x" onerror="alert(2)">',
    '<xmp><img src=x onerror=alert(3)></xmp>',
    '<a href="javascript:alert(4)">bad link</a>',
  ].join('\n\n'));

  assert.doesNotMatch(rendered.html, /<script/i);
  assert.doesNotMatch(rendered.html, /onerror/i);
  assert.doesNotMatch(rendered.html, /<xmp/i);
  assert.doesNotMatch(rendered.html, /javascript:/i);
});

test('NewsContentService.render converts airport profile blocks into SEO-visible cards', () => {
  const service = new NewsContentService();
  const rendered = service.render([
    '正文开头',
    '',
    ':::gaterank-airport-profile',
    JSON.stringify({
      version: 1,
      airport_id: 12,
      rank: 2,
      name: '光速云',
      status: 'normal',
      website: 'https://vip.gsyaff.com/',
      report_url: '/airports/guangsu-cloud',
      airport_intro: '定价实惠便宜机场梯子工具，支持全平台客户端。',
      founded_on: '2025-01-15',
      plan_price_month: 17,
      has_trial: false,
      created_at: '2026-05-10',
      score: 80.87,
      score_date: '2026-05-25',
      score_delta_vs_yesterday: { label: '对比昨天', value: -0.24 },
      tags: ['解锁流媒体', '新手友好'],
      capability_labels: ['支付宝', 'USDT-TRC20', 'Clash'],
    }),
    ':::',
    '',
    '正文结尾',
  ].join('\n'));

  assert.match(rendered.html, /<article class="news-airport-profile-card"/);
  assert.match(rendered.html, /<div class="news-airport-profile-rank-value">#2<\/div>/);
  assert.match(rendered.html, /光速云/);
  assert.match(rendered.html, /定价实惠便宜机场梯子工具，支持全平台客户端。/);
  assert.match(rendered.html, /href="\/api\/v1\/outbound\/airports\/12\?target=website&amp;placement=news_article"/);
  assert.match(rendered.html, /data-airport-website="https:\/\/vip\.gsyaff\.com\/"/);
  assert.match(rendered.html, /href="\/airports\/guangsu-cloud"/);
  assert.match(rendered.html, /80\.87/);
  assert.match(rendered.html, /-0\.24/);
  assert.match(rendered.plain_text, /光速云/);
  assert.doesNotMatch(rendered.html, /gaterank-airport-profile/);
  assert.doesNotMatch(rendered.html, /"airport_id":12/);
});

test('NewsContentService.render escapes unsafe airport profile fields', () => {
  const service = new NewsContentService();
  const rendered = service.render([
    ':::gaterank-airport-profile',
    JSON.stringify({
      version: 1,
      airport_id: 99,
      rank: 1,
      name: '<img src=x onerror=alert(1)>',
      status: 'normal',
      website: 'javascript:alert(1)',
      report_url: 'javascript:alert(2)',
      airport_intro: '<script>alert(3)</script>',
      founded_on: '2026-01-01',
      plan_price_month: 0,
      has_trial: true,
      created_at: '2026-01-02',
      score: 99,
      score_date: '2026-01-03',
      score_delta_vs_yesterday: { label: '<b>bad</b>', value: 1.5 },
      tags: ['<svg onload=alert(4)>'],
      capability_labels: ['<iframe src=x>'],
    }),
    ':::',
  ].join('\n'));

  assert.match(rendered.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(rendered.html, /&lt;script&gt;alert\(3\)&lt;\/script&gt;/);
  assert.doesNotMatch(rendered.html, /javascript:/i);
  assert.doesNotMatch(rendered.html, /<img/i);
  assert.doesNotMatch(rendered.html, /<script/i);
  assert.doesNotMatch(rendered.html, /<svg/i);
  assert.doesNotMatch(rendered.html, /<iframe/i);
});

test('NewsContentService.render converts airport link blocks into inline paid outbound links', () => {
  const service = new NewsContentService();
  const rendered = service.render([
    '正文开头',
    '',
    ':::gaterank-airport-link',
    JSON.stringify({
      version: 1,
      airport_id: 12,
      name: '光速云',
      website: 'https://vip.gsyaff.com/',
    }),
    ':::',
    '',
    '正文结尾',
  ].join('\n'));

  assert.match(
    rendered.html,
    /<a class="news-airport-inline-link" href="\/api\/v1\/outbound\/airports\/12\?target=website&amp;placement=news_article" target="_blank" rel="noreferrer noopener" data-airport-website="https:\/\/vip\.gsyaff\.com\/">光速云<\/a>/,
  );
  assert.match(rendered.plain_text, /光速云/);
  assert.doesNotMatch(rendered.html, /gaterank-airport-link/);
  assert.doesNotMatch(rendered.html, /"airport_id":12/);
});

test('NewsContentService.render escapes unsafe airport link fields', () => {
  const service = new NewsContentService();
  const rendered = service.render([
    ':::gaterank-airport-link',
    JSON.stringify({
      version: 1,
      airport_id: '<script>alert(1)</script>',
      name: '<img src=x onerror=alert(1)>',
      website: 'javascript:alert(2)',
    }),
    ':::',
  ].join('\n'));

  assert.match(rendered.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(rendered.html, /javascript:/i);
  assert.doesNotMatch(rendered.html, /data-airport-website=/);
  assert.doesNotMatch(rendered.html, /<img/i);
});

test('stripLeadingMarkdownH1 removes only the first body H1 at document start', () => {
  assert.equal(
    stripLeadingMarkdownH1('\n\n# 文章标题\n\n## 小节\n\n正文\n\n# 后续 H1'),
    '## 小节\n\n正文\n\n# 后续 H1',
  );
  assert.equal(stripLeadingMarkdownH1('## 小节\n\n正文'), '## 小节\n\n正文');
  assert.equal(stripLeadingMarkdownH1('正文\n\n# 后续 H1'), '正文\n\n# 后续 H1');
});
