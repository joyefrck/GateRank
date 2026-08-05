import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasNewsMermaidDiagram,
  renderNewsMermaidModuleScript,
} from '../src/services/newsMermaid';
import { renderNewsArticlePage } from '../src/services/newsPageRenderer';

test('hasNewsMermaidDiagram detects only Mermaid language code blocks', () => {
  assert.equal(
    hasNewsMermaidDiagram('<pre><code class="news-code" data-language="mermaid">flowchart TD</code></pre>'),
    true,
  );
  assert.equal(
    hasNewsMermaidDiagram('<pre><code class="news-code" data-language="typescript">const x = 1</code></pre>'),
    false,
  );
  assert.equal(
    hasNewsMermaidDiagram('<p data-language="mermaid">not a code block</p>'),
    false,
  );
});

test('renderNewsMermaidModuleScript loads the self-hosted module only when needed', () => {
  assert.equal(
    renderNewsMermaidModuleScript('<code data-language="mermaid">flowchart TD</code>'),
    '<script type="module" src="/assets/news-mermaid.js"></script>',
  );
  assert.equal(renderNewsMermaidModuleScript('<p>ordinary article</p>'), '');
});

test('renderNewsArticlePage loads Mermaid only for articles that need it', () => {
  const mermaidPage = renderNewsArticlePage({
    siteUrl: 'https://gate-rank.com',
    article: createArticle('<pre class="news-code-block"><code class="news-code" data-language="mermaid">flowchart TD</code></pre>'),
  });
  const ordinaryPage = renderNewsArticlePage({
    siteUrl: 'https://gate-rank.com',
    article: createArticle('<p class="news-paragraph">普通正文</p>'),
  });

  assert.match(mermaidPage, /<script type="module" src="\/assets\/news-mermaid\.js"><\/script>/);
  assert.doesNotMatch(ordinaryPage, /news-mermaid\.js/);
});

function createArticle(contentHtml: string) {
  return {
    id: 1,
    title: '流程图测试',
    slug: 'mermaid-test',
    excerpt: '流程图测试摘要',
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
    content_html: contentHtml,
    headings: [],
    previous: null,
    next: null,
  };
}
