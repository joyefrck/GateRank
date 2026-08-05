import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PUBLIC_TOP_NAV_BORDER_PX,
  PUBLIC_TOP_NAV_HEIGHT_PX,
  PUBLIC_TOP_NAV_STICKY_OFFSET_PX,
  PUBLIC_TOP_NAV_STYLES,
} from '../../shared/publicTopNav';
import { renderNewsArticlePage } from '../src/services/newsPageRenderer';

test('news reading progress stays flush with the public navigation bottom edge', () => {
  const page = renderNewsArticlePage({
    siteUrl: 'https://gate-rank.com',
    article: createArticle(),
  });

  assert.equal(
    PUBLIC_TOP_NAV_STICKY_OFFSET_PX,
    PUBLIC_TOP_NAV_HEIGHT_PX + PUBLIC_TOP_NAV_BORDER_PX,
  );
  assert.match(PUBLIC_TOP_NAV_STYLES, new RegExp(`height: ${PUBLIC_TOP_NAV_HEIGHT_PX}px;`));
  assert.match(
    page,
    new RegExp(`\\.article-progress \\{[\\s\\S]*?top: ${PUBLIC_TOP_NAV_STICKY_OFFSET_PX}px;`),
  );
});

function createArticle() {
  return {
    id: 1,
    title: '阅读进度测试',
    slug: 'reading-progress-test',
    excerpt: '阅读进度条应紧贴公共导航底边。',
    cover_image_url: '',
    published_at: '2026-08-05 12:00:00',
    updated_at: '2026-08-05 12:00:00',
    view_count: 0,
    reading_minutes: 1,
    category: null,
    topics: [],
    is_featured: false,
    is_recommended: false,
    recommend_weight: 0,
    content_html: '<p class="news-paragraph">正文</p>',
    headings: [],
    previous: null,
    next: null,
  };
}
