import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNewsArticleLinkUrl,
  serializeNewsArticleLink,
} from '../../shared/newsArticleLink';

test('serializeNewsArticleLink builds an angle-bracket markdown link and escapes title brackets', () => {
  assert.equal(
    serializeNewsArticleLink({
      title: String.raw`OpenAI [update] \ notes`,
      url: 'https://example.com/news/openai-update?from=gate rank',
    }),
    String.raw`

[OpenAI \[update\] \\ notes](<https://example.com/news/openai-update?from=gate%20rank>)

`,
  );
});

test('normalizeNewsArticleLinkUrl accepts absolute http and https urls', () => {
  assert.equal(normalizeNewsArticleLinkUrl(' https://example.com/a '), 'https://example.com/a');
  assert.equal(normalizeNewsArticleLinkUrl('http://example.com/a'), 'http://example.com/a');
});

test('normalizeNewsArticleLinkUrl rejects empty, relative, javascript, and non-http urls', () => {
  for (const value of ['', '   ', '/news/article', 'javascript:alert(1)', 'ftp://example.com/file']) {
    assert.equal(normalizeNewsArticleLinkUrl(value), null);
  }
});
