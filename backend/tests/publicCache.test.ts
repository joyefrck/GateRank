import assert from 'node:assert/strict';
import test from 'node:test';
import { createTimedPromiseCache, setPublicCacheHeaders } from '../src/utils/publicCache';

test('concurrent live views share only pending work and re-read changed balances after completion', async () => {
  const cache = createTimedPromiseCache(300_000);
  let finish!: (value: { score: number | null }) => void;
  let loads = 0;
  const loader = () => {
    loads += 1;
    return new Promise<{ score: number | null }>((resolve) => { finish = resolve; });
  };
  const requests = Array.from({ length: 100 }, () => cache.getOrLoad('home:today', loader));
  assert.equal(loads, 1);
  finish({ score: 94.88 });
  assert.deepEqual(await Promise.all(requests), Array.from({ length: 100 }, () => ({ score: 94.88 })));
  assert.deepEqual(await cache.getOrLoad('home:today', async () => ({ score: null })), { score: null });
});

test('live-view capacity rejects excess work without starting it and recovers after rejection', async () => {
  const cache = createTimedPromiseCache(300_000, { maxPendingLoads: 1, maxPendingRequests: 2 });
  let reject!: (error: Error) => void;
  const first = cache.getOrLoad('home:today', () => new Promise((_, fail) => { reject = fail; }));
  const shared = cache.getOrLoad('home:today', async () => assert.fail('duplicate query'));
  let extraLoads = 0;
  await assert.rejects(cache.getOrLoad('full-ranking:today:1', async () => { extraLoads += 1; }),
    { status: 503, code: 'PUBLIC_LOAD_BUSY' });
  await assert.rejects(cache.getOrLoad('home:today', async () => { extraLoads += 1; }),
    { status: 503, code: 'PUBLIC_LOAD_BUSY' });
  assert.equal(extraLoads, 0);
  reject(new Error('database unavailable'));
  assert.deepEqual((await Promise.allSettled([first, shared])).map((result) => result.status), ['rejected', 'rejected']);
  assert.equal(await cache.getOrLoad('full-ranking:today:1', async () => 'recovered'), 'recovered');
});

test('clearing payload caches cannot forget unfinished database work or open extra capacity', async () => {
  const cache = createTimedPromiseCache(300_000, { maxPendingLoads: 1 });
  let finish!: (value: string) => void;
  const first = cache.getOrLoad('home:today', () => new Promise<string>((resolve) => { finish = resolve; }));
  cache.clear();
  const shared = cache.getOrLoad('home:today', async () => assert.fail('forgot running query'));
  await assert.rejects(cache.getOrLoad('report:another', async () => 'extra'), { status: 503 });
  finish('done');
  assert.deepEqual(await Promise.all([first, shared]), ['done', 'done']);
  assert.equal(await cache.getOrLoad('report:another', async () => 'fresh'), 'fresh');
});

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
