# Performance Run Node Details Design

## Goal

Make every Shanghai, Guangzhou, and legacy-control evidence panel display only the nodes tested by that exact `PerformanceRun`, and remove the detached global latest-run node list.

## Current Problem

The per-region evidence panels render `performance.probe_runs`, but the bottom `节点明细` section renders `performance.tested_nodes`. That top-level field comes from the latest performance run across all probes, so expanding legacy-control can be followed by Shanghai node data when Shanghai finished later.

## Approved Design

- Extend the frontend `probe_runs` item type with its existing backend `tested_nodes` payload.
- Inside every expanded regional `<details>` panel, render a `本次运行节点明细` subsection from `run.tested_nodes`.
- Reuse the current node field layout and existing `ReadField` component; do not introduce new colors, controls, cards, or interactions.
- Show the subsection only when that run has at least one tested node.
- Remove the bottom page-level `节点明细` section that renders `dashboard.performance.tested_nodes`.
- Keep the backend response and scoring/aggregation behavior unchanged. The backend already returns `tested_nodes` on each `probe_runs` item.

## Data Flow

1. `GET /airports/:id/dashboard` builds each entry with `buildAdminPerformanceProbeRun(run, targets)`.
2. Each entry already contains `tested_nodes: run.tested_nodes || []`.
3. `AdminApp` renders those nodes inside the matching run panel identified by `run.id`.
4. No node data is read from the top-level latest-run field for this visual section.

## Accessibility and Layout

- Preserve the existing accessible `<details>/<summary>` interaction and keyboard behavior.
- Keep node details within the expanded panel so region, timestamp, target distribution, and nodes form one evidence unit.
- Reuse the existing responsive two-column field grid.

## Tests and Acceptance

- Add a source regression test asserting node rendering is scoped to `run.tested_nodes`.
- Assert the global `dashboard.performance.tested_nodes.map` rendering is absent.
- Run the focused admin UI test, frontend type checking, lint, and production build.
- Browser acceptance: expanding Shanghai, Guangzhou, and legacy-control shows each run's own nodes and no detached bottom node list.

## Out of Scope

- No scoring formula, probe collection, database, API response, scheduling, or node-selection changes.
- Do not remove the top-level API fields yet; they may have other consumers and are harmless once the misleading UI is removed.
