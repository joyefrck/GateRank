# Airport report discovery repair

Goal: Restore discovery of existing airport reports independently of current ranking scores.

Evidence: Live full-ranking HTML contains 68 airport rows but only 16 report links. Of the other 52 airports, 48 legacy report routes redirect to canonical report URLs and four return 404. Sample canonical reports return 200 with indexable robots metadata. Ranking V2 requires same-day scores, while report rendering permits historical scores.

- [x] Add regression coverage for historical report links without current scores, missing metrics, forced scoring rules, and sitemap pagination beyond 100 airports.
- [x] Add a batched repository lookup that uses each airport's latest eligible historical score and requires metrics for that exact date, matching report rendering. Keep score values, score dates, ordering, billing eligibility, and unpublished scores unchanged.
- [x] Use this lookup in the public ranking view shared by SSR and the client API. Airports without a renderable report retain a null report URL.
- [x] Traverse all ranking pages for both public and AI sitemaps, freeze the effective date after the first page, and deduplicate report URLs.
- [x] Run targeted regression tests, backend tests, type checks, and an isolated production build. Review the diff against pre-existing workspace changes.

Scope: No production mutations, deployment, invented report data, or new profile-page product behavior. Four airports with no report need a separate decision about profile-only pages if full 68-page coverage is required.

Verification: The initial four regression tests failed before implementation and passed afterward. A fifth route-level regression verifies 68 rows produce 64 existing report anchors while hydration remains 20 items and unpublished scores remain null. Full backend run: 1,042 passed, 4 skipped, 0 failed. Server typecheck, frontend TypeScript check, isolated production build, and git diff whitespace check passed. Production was only read; no code was committed, pushed, or deployed.

## Approved follow-up: remaining discovery requirements

The user explicitly excludes the four airports without reports. Keep their existing behavior.

- [x] Unify SSR and React ranking page sizes at 20, add real anchor pagination, preserve filters/date and canonical URLs, and test page boundaries including pages 2-4.
- [x] Add `/airports` with all available reports, alphabetically ordered, shared API/SSR/client data, ItemList metadata, footer/ranking/report links, sitemap inclusion and Nginx forwarding.
- [x] Extend factual long-tail FAQ with stability, pricing and trials; render the shared FAQ in React as well as raw SSR HTML.
- [x] Verify regression failures first, then backend tests, type checks, production build, desktop/mobile browser behavior and original existing workspace changes.

Follow-up verification: 1,048 backend tests total, 1,044 passed, 4 skipped, 0 failed. Frontend and server type checks and the isolated Vite build passed. The original regression was updated to walk four 20/20/20/8 ranking pages, compare raw HTML anchors with initial client data, verify filter/date links and reject page 5 with 404/noindex. Directory collection beyond 100 entries and factual FAQ/schema parity are covered. Chrome fixture preview verified 64 directory links on desktop and at 390px, functioning page-2/page-4 navigation, no horizontal overflow, and 16 visible report FAQs matching JSON-LD after React takeover. Production is unchanged; no commit, push or deployment was performed.
