import assert from 'node:assert/strict';
import test from 'node:test';

function installBrowserGlobals() {
  const appendedScripts: Array<{ async?: boolean; src?: string; attributes: Record<string, string> }> = [];
  const head = {
    querySelector: () => null,
    appendChild: (script: { async?: boolean; src?: string; attributes: Record<string, string> }) => {
      appendedScripts.push(script);
    },
  };
  const document = {
    title: '机场榜GateRank',
    head,
    querySelector: () => null,
    createElement: (tagName: string) => {
      assert.equal(tagName, 'script');
      return {
        async: false,
        src: '',
        attributes: {} as Record<string, string>,
        setAttribute(name: string, value: string) {
          this.attributes[name] = value;
        },
      };
    },
  };
  const window = {
    location: {
      pathname: '/',
      search: '',
      hash: '',
      href: 'https://gate-rank.com/',
    },
    dataLayer: [] as unknown[],
    __GATERANK_GA_INITIALIZED__: undefined as boolean | undefined,
  };

  Object.defineProperty(globalThis, 'document', {
    value: document,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'window', {
    value: window,
    configurable: true,
  });

  return { appendedScripts, window };
}

test('analytics uses the standard GA config page view and avoids a duplicate first manual page view', async () => {
  const { appendedScripts, window } = installBrowserGlobals();
  const analytics = await import(`../../src/site/analytics.ts?test=${Date.now()}`);

  analytics.initializeAnalytics();
  analytics.trackPageView();

  assert.deepEqual(window.dataLayer.map((args) => Array.from(args as ArrayLike<unknown>).map((value) => value instanceof Date ? '[Date]' : value)), [
    ['js', '[Date]'],
    ['config', 'G-4V9Z53GSP2'],
  ]);
  assert.equal(appendedScripts[0]?.src, 'https://www.googletagmanager.com/gtag/js?id=G-4V9Z53GSP2');

  window.location.pathname = '/rankings/all';
  window.location.href = 'https://gate-rank.com/rankings/all';
  analytics.trackPageView();

  assert.deepEqual(Array.from(window.dataLayer.at(-1) as ArrayLike<unknown>), [
    'event',
    'page_view',
    {
      send_to: 'G-4V9Z53GSP2',
      page_title: '机场榜GateRank',
      page_location: 'https://gate-rank.com/rankings/all',
      page_path: '/rankings/all',
    },
  ]);
});
