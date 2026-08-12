# Full Ranking Pagination Count Design

## Problem

The public full-ranking API currently returns list rows and pagination metadata from different populations under the V2 scoring rule. The item query keeps every listed `normal` or `risk` airport, including airports without a same-day V2 score, while the count query only counts airports that have a same-day V2 score. On 2026-08-12 this produces 20 items with `total = 13` and `total_pages = 1`, which disables navigation even though 61 airports are available.

## Intended behavior

- `/rankings/all` remains the full list of listed `normal` and `risk` airports.
- Airports with a current public score are ordered first by the existing ranking order.
- Airports without a current V2 score remain in the list and display the existing unpublished-score state.
- `total` and `total_pages` are calculated from exactly the same airport filters as the item query.
- The SSR crawlable view remains capped at 100 items and the React hydration/API view remains 20 items per page.

## Implementation

Remove the V2 same-day score participation predicate from the count query in `ScoreRepository.getPublicFullRankingByDate`. Keep the current-date, current-rule score join unchanged so stale V1 or prior-day scores are not exposed as current V2 scores.

Update the repository regression test to assert that V2 pagination counts all matching listed airports while its score join remains restricted to the requested date and rule version. The test must also assert that the count query and row query use the same public airport filters.

## Verification

- Run the focused score repository test and confirm the regression fails before the code change and passes afterward.
- Run the relevant public view and public route tests.
- Run backend tests and the production build.
- After deployment, verify the live API returns `total = 61`, `total_pages = 4`, page sizes `20/20/20/1`, and that the public UI enables page navigation.

## Scope boundaries

No scoring, aggregation, ordering, billing visibility, frontend layout, or production airport data changes are included.
