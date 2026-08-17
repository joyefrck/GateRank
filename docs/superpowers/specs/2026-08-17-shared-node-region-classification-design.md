# Shared node region classification design

## Goal

Make report region coverage and network coverage classify the same subscription node as the same region. Preserve the existing report card layout and its 14-item display limit while exposing every recognized region in the report API.

## Root cause

- Network coverage and the public report maintain separate region tables.
- The report table only knows 11 regions, so valid snapshot regions are omitted.
- Both classifiers stop at the first substring match. `印度尼西亚` therefore matches `印度` before the more specific Indonesia alias.
- Chile is absent from network coverage and Macau is absent from the report table.

## Design

Create one backend node-region catalog containing the network code, public report key, Chinese label, score group, aliases, and report display order. Both services consume the catalog.

Alias matching evaluates every matching alias and selects the longest normalized alias. Equal-length matches retain catalog order. Short Latin codes keep word-boundary matching so names such as `HKT` do not become Hong Kong.

The report API returns all recognized snapshot regions with node counts. React and SSR continue to render the first 14 and the existing remaining-count note. The visual style is unchanged; the shared icon map gains flag entries for every catalog region so newly visible rows do not fall back to a generic symbol.

## Verification

- Unit regression: Macau, Chile, and Indonesia classify correctly; informational nodes remain unknown/ignored.
- Public view regression: a 21-region snapshot returns 21 correct regions with two nodes each and never emits India for Indonesia.
- Existing backend suite, backend/frontend typechecks, production build, React browser route, and SSR route.
- Production: deploy the published images, rerun network coverage only for airport 87 (`phl1`), then verify API, page, run data, and service health.

