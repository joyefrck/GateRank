# Shared node region classification implementation plan

1. Add failing classifier tests for `印度尼西亚` and Chile, plus a public-view snapshot regression covering all 21 拼好连 regions.
2. Add `backend/src/utils/nodeRegion.ts` as the single region catalog and longest-alias matcher.
3. Refactor network coverage scoring and public report capability construction to consume the shared catalog.
4. Add flag icons for every report key represented by the catalog.
5. Run focused tests, the full backend suite, both typechecks, build, React browser acceptance, and SSR acceptance.
6. Commit only intended files, push current `main`, wait for image publication, deploy production, rerun airport 87 network coverage, and verify live output.

