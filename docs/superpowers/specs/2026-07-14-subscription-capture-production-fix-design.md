# Production Subscription Capture Fix Design

**Date:** 2026-07-14

## Problem

The production API container can fetch airport #40's subscription successfully with the ClashMeta user agent, but the response is Clash YAML and the image does not include PyYAML. The parser therefore produces no supported nodes. Its fallback request uses the GateRank user agent, which the upstream subscription service rejects with HTTP 403. The capture script reports `subscription_fetch_or_parse_failed`, and the generic error middleware hides that failure behind `Internal server error`.

## Scope

This change will:

1. Install Alpine's `py3-yaml` package in the production API image.
2. Convert sanitized subscription-capture process failures into an explicit HTTP error that the admin frontend can display.
3. Add focused regression coverage for the HTTP error contract and production image dependency.
4. Build, publish, deploy, and verify the API image against airport #40's saved subscription.

This change will not alter subscription URLs, node credentials, parsing rules, scheduler behavior, or unrelated containers.

## Design

### Runtime dependency

`Dockerfile.api` will install `py3-yaml` alongside the existing Python runtime packages. The image verification must prove that `python3 -c 'import yaml'` exits successfully.

### Error contract

`SubscriptionNodeCaptureService` will preserve the existing sanitized script summary and raise an `HttpError` with:

- status: `502`
- code: `SUBSCRIPTION_NODE_CAPTURE_FAILED`
- message prefix: `获取订阅节点失败：`

The message may include the existing safe summary containing airport ID/name and a normalized failure reason. It must not contain the subscription URL, token, raw node URI, or outbound credentials. The existing admin `apiFetch` path already displays the API `message`, so no frontend behavior change is required.

Configuration failures detected before the child process starts remain internal configuration errors and are not reclassified as upstream subscription failures.

## Testing

Focused tests will verify:

1. The API image definition includes `py3-yaml`.
2. A capture-service child-process failure is represented by the expected `502` error contract without exposing subscription secrets.
3. Existing subscription parser and admin route tests continue to pass.
4. Type checking and production builds succeed.
5. A locally built API image can import `yaml`.

## Production rollout

After pushing the verified change and waiting for the GitHub Actions image publication:

1. Pull the new `gaterank-api:main` image on the production host.
2. Recreate only `gaterank-api`; do not restart unrelated containers.
3. Confirm container health and `import yaml` inside the running container.
4. Trigger the existing capture endpoint for airport #40 using production's internal admin authentication.
5. Confirm a new snapshot is created with at least one supported node and no new capture error in the API logs.

If publication or runtime verification fails, stop without changing subscription data and report the exact failing boundary.
