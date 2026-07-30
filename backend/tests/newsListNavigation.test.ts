import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNewsListPath,
  buildNewsListSearch,
  readNewsListQuery,
} from '../../src/admin/news/newsListNavigation';

test('readNewsListQuery restores valid news list state', () => {
  assert.deepEqual(
    readNewsListQuery('?keyword=USDT&status=published&category=guide&page=3'),
    {
      keyword: 'USDT',
      status: 'published',
      category: 'guide',
      page: 3,
    },
  );
});

test('readNewsListQuery falls back from invalid values', () => {
  assert.deepEqual(
    readNewsListQuery('?keyword=%20%20&status=unknown&category=%20&page=-2'),
    {
      keyword: '',
      status: 'all',
      category: 'all',
      page: 1,
    },
  );
});

test('news list URL builders omit defaults and preserve active state', () => {
  assert.equal(
    buildNewsListSearch({
      keyword: ' USDT ',
      status: 'published',
      category: 'guide',
      page: 3,
    }),
    '?keyword=USDT&status=published&category=guide&page=3',
  );
  assert.equal(
    buildNewsListPath({
      keyword: '',
      status: 'all',
      category: 'all',
      page: 1,
    }),
    '/admin/news',
  );
});
