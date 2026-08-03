import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('app wires public HTML and API page routes to one shared timed cache', async () => {
  const source = await readFile(path.join(process.cwd(), 'backend/src/app.ts'), 'utf8');

  assert.doesNotMatch(source, /const publicApiPageCache = createTimedPromiseCache/);
  assert.doesNotMatch(source, /const publicHtmlPageCache = createTimedPromiseCache/);
  assert.match(source, /const publicPageCache = createTimedPromiseCache\(PUBLIC_PAGE_CACHE_TTL_MS\)/);
  assert.match(source, /const airportDealDetailService = new AirportDealDetailService\(\{/);
  assert.match(source, /createPublicRoutes\(\{[\s\S]*airportDealDetailService,[\s\S]*pageCache: publicPageCache/);
  assert.match(source, /createPublicPageRoutes\(\{[\s\S]*airportDealDetailService,[\s\S]*pageCache: publicPageCache/);
  assert.match(source, /createPublicRoutes\(\{[\s\S]*pageCache: publicPageCache/);
  assert.match(source, /createPublicPageRoutes\(\{[\s\S]*pageCache: publicPageCache/);
});
