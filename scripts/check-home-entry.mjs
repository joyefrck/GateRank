import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

// Run against the production bundle, not source spelling: catch accidental
// static imports that silently bring tool/report/animation code back home.
const root = path.resolve(process.argv[2] || 'dist');
const manifest = JSON.parse(await readFile(path.join(root, '.vite/manifest.json'), 'utf8'));
function closure(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  assert.ok(manifest[entry], `Missing manifest entry: ${entry}`);
  seen.add(entry);
  for (const dependency of manifest[entry].imports || []) closure(dependency, seen);
  return seen;
}
const entries = [...closure('index.html')];
assert.ok(!entries.some((entry) => /(?:^|\/)App\.tsx$|IPCheck|IpCheckMap/.test(entry)), 'Homepage must not eagerly load other pages');
const files = entries.map((entry) => manifest[entry].file);
const bundles = await Promise.all(files.map((file) => readFile(path.join(root, file))));
const bytes = bundles.reduce((total, bundle) => total + bundle.length, 0);
const gzipBytes = bundles.reduce((total, bundle) => total + gzipSync(bundle).length, 0);
assert.ok(bytes < 450_000, `Homepage initial JS exceeds 450 KB budget: ${bytes}`);
for (const bundle of bundles) {
  assert.doesNotMatch(bundle.toString(), /Leaflet|framer-motion|motion-dom/, 'Map and animation runtimes belong outside the homepage');
}
for (const entry of entries) {
  for (const file of manifest[entry].css || []) {
    const css = await readFile(path.join(root, file), 'utf8');
    assert.doesNotMatch(css, /fonts\.googleapis\.com/, 'Remote font CSS must not block first paint');
  }
}
const appEntry = Object.keys(manifest).find((key) => manifest[key].name === 'App');
assert.ok(appEntry && manifest[appEntry].isDynamicEntry, 'Other public pages must remain loadable');
assert.ok(!entries.includes(appEntry), 'Homepage must not eagerly load App');
assert.ok(manifest['src/pages/ipCheck/IPCheckPage.tsx']?.isDynamicEntry, 'IP map should load only with its tool');
assert.ok(![...closure(appEntry)].some((entry) => /IPCheckPage|IpCheckMap/.test(entry)), 'Non-map routes must not eagerly load the map');
console.log(JSON.stringify({ files, bytes, gzipBytes, budgetBytes: 450_000 }, null, 2));
