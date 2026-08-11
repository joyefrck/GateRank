# System-Authoritative Node Coverage Design

**Date:** 2026-08-12

## Goal

Make GateRank's system-generated subscription-node snapshot the only source that can establish which regions an airport actually covers. Applicants must not be able to declare or change node coverage, while system administrators retain control over descriptive attributes for regions that the system has detected.

## Root Cause

The applicant operations editor currently submits the complete airport profile, including `profile.regions`. The portal backend persists that profile on the application and synchronizes it to the approved airport. Public report construction then merges two independent inputs:

- node counts detected from the latest system subscription-node snapshot; and
- applicant-editable region attributes such as residential, native IP, IEPL, IPLC, CN2, BGP, and relay.

The public region builder treats either input as enough to publish a region. Consequently, an applicant can make a zero-node region appear on the report by selecting one or more descriptive attributes. This is why an airport with only Hong Kong nodes can appear to cover Taiwan, Japan, Singapore, the United States, and other regions.

## Confirmed Product Decisions

- Remove the Node Coverage tab from the applicant portal rather than showing a read-only replacement.
- Applicants may continue to update the test subscription URL.
- The daily subscription-node refresh remains responsible for parsing that URL and saving the authoritative system snapshot.
- Only system administrators may maintain residential, native-IP, and line-type metadata.
- A public report may show a region only when the latest system snapshot contains at least one recognized node in that region.
- Network Coverage scoring and performance collection must use system records, never applicant-declared regions.

## Source-of-Truth Model

### Region presence

The latest `airport_subscription_node_snapshots` record is authoritative for region presence and node counts. A region is public only when its normalized system node count is greater than zero.

The airport profile cannot establish region presence by itself. Existing profile metadata for a zero-node region stays stored for administrator use but is not published.

### Region metadata

`airports.airport_profile_json.regions` remains the administrator-owned source for:

- residential-node status;
- native-IP status; and
- line attributes such as IEPL, IPLC, CN2, BGP, and relay.

These attributes enrich a region already detected in the latest system snapshot. They cannot create coverage for a region with no detected nodes.

### Network Coverage score

The N dimension continues to read `airport_network_coverage_runs`, which is produced by probing every testable node from the stored system snapshot. Applicant profile fields do not participate in N scoring.

### Performance collection

Performance collection continues to load nodes from the stored system snapshot and applies the performance-node selection maintained through the system administrator API. It must not use applicant profile regions as a fallback or selection signal.

## Permission Boundaries

### Applicant portal UI

- Remove the `nodes` tab from the applicant operations tab list.
- Remove the Node Coverage editor and its region mutation controls from the applicant application page.
- Exclude `regions` from the profile object sent by applicant operations saves.
- Preserve all other applicant-editable operations fields and the existing visual hierarchy.

Visual thesis: remove the untrusted declaration surface entirely while leaving the remaining operations editor structurally unchanged.

### Applicant portal API

The API must enforce the boundary independently of the UI:

- Treat `profile.regions` in an applicant request as non-authoritative.
- Preserve the application record's existing regions when saving other applicant profile fields.
- Preserve the approved airport's existing administrator-owned regions during portal-to-airport synchronization.
- Continue saving permitted applicant fields even if an older or manually crafted client includes `profile.regions`.

Ignoring and preserving the protected field is preferred to rejecting the whole request because it is safe during rolling frontend/backend deployment and does not prevent applicants from updating unrelated permitted fields.

### System administrator

The existing system administrator Node Coverage editor remains available. Administrators may maintain descriptive metadata, inspect automatically detected node counts, capture subscription snapshots, configure performance test nodes, and run Network Coverage collection.

## Runtime Data Flow

1. The applicant or administrator maintains the airport's test subscription URL.
2. The scheduled subscription-node refresh fetches and parses the current URL.
3. The backend saves the parsed node set and normalized node regions as a system snapshot.
4. Network Coverage collection loads all testable nodes from that stored snapshot, performs real proxy HTTP health checks, and saves the N run.
5. Performance collection loads the same stored snapshot and applies the administrator-owned performance-node selection.
6. Public report construction counts regions from the latest system snapshot, discards zero-node regions, and enriches the remaining regions with administrator-owned metadata.
7. React, SSR, rankings, machine-readable output, and monthly summaries consume the same filtered public capability model.

## Existing Dirty Data

No destructive database cleanup is required for the initial fix. Once public region construction requires a positive system node count, old applicant-supplied attributes can no longer publish a false region.

For Now Acceleration, if the latest snapshot contains only two Hong Kong nodes, the public report will show only Hong Kong. Existing metadata for Taiwan, Japan, Singapore, the United States, and other zero-node regions will remain private until an administrator clears it or the system later detects actual nodes there.

## Missing or Stale System Data

- With no system snapshot, the public report shows no node-coverage regions. It must not fall back to profile declarations.
- A snapshot whose subscription URL does not match the current airport URL remains stale and is not reused by Network Coverage or performance collection.
- Collection failures retain the existing explicit `missing_subscription_node_snapshot`, `stale_subscription_node_snapshot`, and related failure states.
- Unrecognized node regions may still contribute to diagnostics and N scoring according to the existing rules, but they are not mapped to a false named public region.

## Compatibility

- Existing airport and application profile JSON remains readable; no schema migration is required.
- Older applicant clients that send a complete profile continue to save permitted fields, but protected regions are preserved server-side.
- The system administrator request contract remains unchanged.
- Public response shapes remain unchanged; only false zero-node region entries disappear.

## Verification Strategy

### Portal authorization regressions

- A portal operations request containing fabricated regions must not change the application record's existing regions.
- The same request must not change the approved airport's administrator-owned regions.
- Other permitted profile fields in that request must still update.
- The applicant operations UI must have no Node Coverage tab or region controls, and its request body must not contain `profile.regions`.

### Public report regressions

- Given an administrator profile with multiple region attributes and a latest snapshot containing only Hong Kong nodes, report capabilities must contain only Hong Kong with the correct node count.
- Given no latest snapshot, report capabilities must contain no regions even when profile attributes exist.
- React and SSR output must both use the filtered report capability response without reintroducing profile-only regions.
- Machine-readable rankings and monthly summaries must inherit the same filtered capability data.

### Collection regressions

- Network Coverage resolution must load every testable node from the stored system snapshot.
- Performance resolution must load the stored system snapshot and honor the administrator-owned selected-node keys.
- Neither collector may consult applicant profile regions.

### Release checks

Run the focused portal, public-view, Network Coverage, and performance collector tests, followed by backend tests, server type checking, lint, production build, and `git diff --check`. Verify desktop and mobile applicant portal rendering to confirm the Node Coverage tab is absent and the remaining tabs remain usable.

## Acceptance Criteria

- Applicants cannot view or modify Node Coverage controls in their portal.
- Direct applicant API submissions cannot change application or approved-airport regions.
- System administrators retain their Node Coverage controls.
- Public reports cannot show a region solely because profile metadata is present.
- Now Acceleration shows only regions present in its latest system snapshot.
- N scoring and performance collection continue to use system snapshot/run data and administrator configuration.
- No unrelated applicant operations fields regress.
