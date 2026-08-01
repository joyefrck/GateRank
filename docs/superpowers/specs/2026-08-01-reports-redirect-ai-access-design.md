# Reports Redirect and AI Access Design

## Goal

Retire the two collection aliases `/reports` and `/reports/` with a single-hop permanent redirect to `https://gate-rank.com/monthly-reports`, while preserving the existing `/reports/:id` compatibility redirect to an airport report and allowing search/retrieval AI agents to follow the retired collection aliases.

## Current behavior and root cause

- `nginx.conf` currently defines only the prefix location `location /reports/`.
- Nginx therefore normalizes `/reports` to `/reports/` before proxying and constructs `http://gate-rank.com/reports/` from the container-side request scheme.
- The backend defines `/reports/:id` but not the bare `/reports/` collection route, so a normal request to `/reports/` reaches the backend and returns 404.
- The Cloudflare custom Skip rule for search/retrieval AI agents does not include either bare reports path, so those agents receive 403 before Nginx can redirect them.

## Selected design

Add two exact Nginx locations before the existing reports prefix location:

```nginx
location = /reports {
  return 301 https://gate-rank.com/monthly-reports;
}

location = /reports/ {
  return 301 https://gate-rank.com/monthly-reports;
}
```

Exact locations take precedence over the existing `location /reports/` prefix. Consequently, the two collection aliases redirect directly to the canonical monthly-report center while `/reports/:id` continues to proxy to the backend and redirect to `/airports/:slug`.

Update the existing Cloudflare custom rule `Allow AI crawlers on public content` by adding only `"/reports"` and `"/reports/"` to its exact public path set. Keep the rule limited to `GET` and `HEAD`, retain the existing six search/retrieval user agents, and do not add training agents such as `GPTBot`, `ClaudeBot`, or `Bytespider`.

## Alternatives considered

1. Add Express routes for the two aliases and proxy them through Nginx. This adds an unnecessary application hop and reintroduces proxy-scheme handling for a static redirect.
2. Implement the redirects only in Cloudflare Redirect Rules. This removes the canonical behavior from version-controlled infrastructure and makes it more sensitive to Cloudflare rule ordering.

The exact Nginx redirect plus precise Cloudflare access exception is the smallest version-controlled change and preserves the legacy detail route.

## Error and edge behavior

- Redirect targets are absolute HTTPS URLs and do not depend on `$scheme`, `Host`, or forwarded headers.
- `/reports` and `/reports/` both produce one 301 response with the same canonical `Location`.
- `/reports/:id` is not matched by either exact location and retains its current application behavior.
- Unsupported methods are not added to the Cloudflare exception; only `GET` and `HEAD` remain eligible.
- Training crawlers remain outside the Skip rule and may continue to receive Cloudflare 403 responses under the current `ai-train=no` policy.

## Verification

1. Add Nginx configuration tests that require both exact locations, status 301, and the exact HTTPS target, while retaining the reports prefix proxy assertion.
2. Run the focused Nginx tests in a red state before changing the configuration, then green after the change.
3. Run the full backend suite, server typecheck, production build, and `git diff --check`.
4. Save the Cloudflare rule and verify it remains active and first in order.
5. Probe `/reports` and `/reports/` with a normal user agent and all six search/retrieval agents; every request must return 301 with `Location: https://gate-rank.com/monthly-reports` after deployment.
6. Probe representative training agents to confirm the change did not grant them the new exception.
7. Probe an existing `/reports/:id` URL and confirm its compatibility redirect remains intact.
