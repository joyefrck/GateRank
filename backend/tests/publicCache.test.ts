import assert from 'node:assert/strict';
import test from 'node:test';
import { createTimedPromiseCache, setPublicCacheHeaders } from '../src/utils/publicCache';

test('wallet-sensitive views bypass cached payloads, including a prewarmed score', async () => {
  const cache = createTimedPromiseCache(300_000);
  for (const key of ['home:today', 'full-ranking:today:1', 'risk-monitor:today:1', 'report:airport']) {
    await cache.getOrLoad(key, async () => ({ score: 94.88 }));
    assert.deepEqual(await cache.getOrLoad(key, async () => ({ score: null })), { score: null });
  }
});

test('score-sensitive HTML and API responses cannot reuse browser or edge caches', () => {
  for (const path of ['/', '/rankings/all?page=2', '/rankings/region/hk', '/airports/now', '/api/v1/pages/home', '/api/v1/airports/62/report-view']) {
    let header = '';
    setPublicCacheHeaders({ req: { originalUrl: path }, setHeader: (_name, value) => { header = value; } });
    assert.equal(header, 'no-store, max-age=0', path);
  }
});

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
