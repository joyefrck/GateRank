import test from 'node:test';
import assert from 'node:assert/strict';
import { NewsContentService } from '../src/services/newsContentService';
import { slugifyNewsText } from '../src/utils/news';

test('NewsContentService.render supports markdown lists', () => {
  const service = new NewsContentService();
  const rendered = service.render('## 清单\n\n- 第一项\n- 第二项');

  assert.match(rendered.html, /<ul class="news-list news-list-unordered">/);
  assert.match(rendered.html, /<li class="news-list-item">第一项<\/li>/);
  assert.match(rendered.html, /<li class="news-list-item">第二项<\/li>/);
  assert.deepEqual(rendered.headings, [{ id: slugifyNewsText('清单'), level: 2, text: '清单' }]);
});
