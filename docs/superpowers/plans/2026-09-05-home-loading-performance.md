# Homepage Loading Performance Implementation Plan

**Goal:** Reduce homepage resources and rendering delays while preserving SSR, navigation and analytics.

**Architecture:** A small public entry renders HomePageV3 directly and imports the existing App only for other routes. Native CSS handles homepage feedback and offscreen layout. Existing SSR stays visible while initial route code loads.

**Tech Stack:** React 19, Vite, TypeScript, hand-written SSR, node:test.

- [x] Build baseline with `npx vite build --outDir /tmp/gaterank-home-perf-before --emptyOutDir`; record transitive entry resources.
- [x] Add `src/site/PublicEntry.tsx`: public location handling, lazy legacy App, homepage page-view tracking, loading/error feedback. Update `src/main.tsx` to preload initial non-home route before replacing SSR.
- [x] Update HomePageV3: replace Motion with native elements/CSS, preserve FAQ interaction and sponsored tracking, add offscreen section markers. Remove remote font import and use system stacks in `src/index.css`.
- [x] Add matching offscreen rules to `backend/src/services/publicPageRenderer.ts`; keep all SSR links and text.
- [x] Add focused regression tests for the bootstrap dependency boundary, no initial hidden hero/ranking, no remote font import and SSR offscreen content preservation. Run existing link, renderer and asset tests, frontend/backend typechecks, and production build into `/tmp/gaterank-home-perf-after`.
- [x] Compare transitive initial JS size and verify no Leaflet/Motion in the homepage static graph. Use Chrome on a local production-build fixture for desktop/mobile, route navigation, history, FAQ and content checks. Report fixture limits; do not claim deployed timing improvements.

User approved the design on 2026-09-05. Execute inline on current main; do not commit or deploy as part of this phase.

## Verification results

- Baseline transitive initial JS: 990149 bytes. Final: 341694 bytes (65.5% reduction).
- `node scripts/check-home-entry.mjs /tmp/gaterank-home-perf-after`: passed, below 450000-byte budget. Home static graph excludes App, Leaflet and Motion; IP page is dynamically loaded.
- `npm run test:backend`: 976 total, 974 passed, 2 skipped, 0 failed.
- `npm run lint`, `npm run server:typecheck`, production Vite build, `git diff --check`: passed.
- Chrome tested the local production bundle with a captured public SSR snapshot at desktop and 390px mobile widths: 10 ranking rows, visible hero/rows, no document horizontal overflow, no runtime errors or Google Fonts requests; homepage-to-ranking navigation and Back, date query, and FAQ expansion worked.
- Local analytics sink received home/full-ranking page views and ranking impressions. Sponsored link attributes and handlers remain covered by regression tests; no real ad click was sent.
- IP tool JS loaded only on its route. Its data API was stubbed in the fixture, so the live lookup/map data service was not an end-to-end acceptance target.
- Below-fold content-visibility is limited to sponsored/tools/News sections after mobile testing; FAQ and long introduction sections use normal layout.
- Browser timings came from localhost with a fixture, not comparable to the user's production timings. Production FCP/DCL/Load remain to be measured after deployment.
- Existing tracked dist and Python-cache modifications were preserved; no commit/push/deployment performed.
