import assert from 'node:assert/strict';
import test from 'node:test';
import { createTimedPromiseCache } from '../src/utils/publicCache';

test('createTimedPromiseCache evicts the oldest cached key when the cache reaches its limit', async () => {
  const cache = createTimedPromiseCache(60_000, { maxEntries: 2 });
  let aLoads = 0;

  await cache.getOrLoad('a', async () => {
    aLoads += 1;
    return `a-${aLoads}`;
  });
  await cache.getOrLoad('b', async () => 'b-1');
  await cache.getOrLoad('c', async () => 'c-1');

  const value = await cache.getOrLoad('a', async () => {
    aLoads += 1;
    return `a-${aLoads}`;
  });

  assert.equal(value, 'a-2');
  assert.equal(aLoads, 2);
});

test('createTimedPromiseCache keeps recently used keys ahead of older keys', async () => {
  const cache = createTimedPromiseCache(60_000, { maxEntries: 2 });
  let aLoads = 0;
  let bLoads = 0;

  await cache.getOrLoad('a', async () => {
    aLoads += 1;
    return `a-${aLoads}`;
  });
  await cache.getOrLoad('b', async () => {
    bLoads += 1;
    return `b-${bLoads}`;
  });
  await cache.getOrLoad('a', async () => {
    aLoads += 1;
    return `a-${aLoads}`;
  });
  await cache.getOrLoad('c', async () => 'c-1');

  const aValue = await cache.getOrLoad('a', async () => {
    aLoads += 1;
    return `a-${aLoads}`;
  });
  const bValue = await cache.getOrLoad('b', async () => {
    bLoads += 1;
    return `b-${bLoads}`;
  });

  assert.equal(aValue, 'a-1');
  assert.equal(bValue, 'b-2');
  assert.equal(aLoads, 1);
  assert.equal(bLoads, 2);
});
