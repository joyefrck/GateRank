# GateRank Security Review

Date: 2026-05-17
Scope: local static review of the TypeScript/Express/React codebase plus `npm audit --omit=dev`.

## Executive Summary

This project has security issues that should be fixed before treating the current build as production-hardened.

The highest-priority issues are vulnerable production dependencies, missing brute-force protection on login endpoints, weak/default auth-secret fallbacks, and incomplete Express security baseline hardening. I did not find committed `.env` files in git, and the reviewed SQL paths mostly use parameterized queries. Payment callbacks do verify gateway signatures, which is a positive control.

## Critical

### SEC-001: Vulnerable `sanitize-html` is used on stored news content

- Severity: Critical
- Location: `package.json:34`, `backend/src/services/newsContentService.ts:99`
- Evidence: `sanitize-html` is a direct production dependency pinned by the lockfile at `2.17.2`; `npm audit --omit=dev` reports critical XSS advisories for `sanitize-html <=2.17.3`. The backend uses it to sanitize rendered Markdown before storing/rendering article HTML.
- Impact: A sanitizer bypass can become stored XSS through news content created by admins or publish tokens. Because admin and portal tokens are stored in browser localStorage, a successful XSS would be able to steal tokens from affected pages.
- Fix: Upgrade `sanitize-html` to a patched version, regenerate `package-lock.json`, and add regression tests with hostile Markdown/HTML payloads.
- Mitigation: Add a strict CSP on public/news pages after confirming the frontend bundle supports it.

### SEC-002: Critical vulnerable `protobufjs` is installed through unused `@google/genai`

- Severity: Critical
- Location: `package.json:19`
- Evidence: `npm audit --omit=dev` reports critical/high advisories for `protobufjs <=7.5.5`. `npm ls` shows it is pulled in by `@google/genai@1.46.0`. Repo search only found `@google/genai` in `package.json`, so it appears unused in the app code.
- Impact: If this package is later exercised with attacker-influenced protobuf input, the advisory class includes code execution and denial-of-service risks. Even if currently unused, it increases production supply-chain exposure.
- Fix: Remove `@google/genai` if it is not needed. If it is needed, update to a version resolving the `protobufjs` advisory.
- Mitigation: Keep unused AI SDKs out of the production dependency set.

## High

### SEC-003: Vite dev server has high-risk advisories and is configured to bind all interfaces

- Severity: High
- Location: `package.json:37`, `package.json:7`
- Evidence: `npm audit --omit=dev` reports high Vite advisories for `vite <=6.4.1`. The dev script is `vite --port=3000 --host=0.0.0.0`, which exposes the dev server on all interfaces.
- Impact: If the dev server is reachable from LAN or the internet, Vite file-read/path traversal advisories can expose local files.
- Fix: Upgrade Vite and change the default dev bind address to `127.0.0.1`; use a separate explicit script only when LAN access is required.
- Mitigation: Firewall local dev ports and never expose Vite dev server in production.

### SEC-004: Admin and applicant login endpoints have no visible rate limiting

- Severity: High
- Location: `backend/src/routes/adminAuthRoutes.ts:8`, `backend/src/routes/portalRoutes.ts:203`, `backend/src/routes/portalRoutes.ts:219`, `backend/src/routes/portalRoutes.ts:245`
- Evidence: Login and login-start routes accept repeated POSTs. Repo search found no `express-rate-limit`, `rateLimit`, or equivalent middleware.
- Impact: Attackers can brute-force the single admin password, applicant passwords, or abuse OAuth/Telegram login flow creation.
- Fix: Add rate limiting for `/api/v1/admin/login`, `/api/v1/portal/login`, OAuth start/complete, and Telegram login start/complete. Key by IP and account identifier where applicable.
- Mitigation: Add alerting/audit events for repeated failures.

### SEC-005: Auth secrets fall back to shared or default values

- Severity: High
- Location: `backend/src/utils/adminAuthConfig.ts:12`, `backend/src/utils/adminAuthConfig.ts:13`, `backend/src/utils/adminAuthConfig.ts:14`, `backend/src/utils/portalAuthConfig.ts:10`
- Evidence: Admin UI password defaults to `ADMIN_API_KEY`, admin JWT secret defaults to `ADMIN_API_KEY`, and portal JWT secret eventually defaults to the static string `gaterank-applicant-portal`.
- Impact: A missing production env var can make tokens forgeable or reuse one leaked admin API key as multiple secrets.
- Fix: In production, require separate strong values for `ADMIN_UI_PASSWORD`, `ADMIN_API_KEY`, `ADMIN_JWT_SECRET`, and `APPLICANT_PORTAL_JWT_SECRET`; fail startup if missing or too short.
- Mitigation: Rotate existing secrets after deploying stricter validation.

### SEC-006: Potential client bundle secret exposure via Vite `define`

- Severity: High
- Location: `vite.config.ts:61`
- Evidence: Vite defines `process.env.GEMINI_API_KEY` from `env.GEMINI_API_KEY`. Repo search found no runtime use, but any client reference would inline the value into browser-delivered JavaScript.
- Impact: If `GEMINI_API_KEY` is set during build and referenced by frontend code, the key becomes public.
- Fix: Remove this `define` entry. AI/API secrets should only be read server-side.
- Mitigation: Treat all Vite-exposed config as public.

## Medium

### SEC-007: Express security baseline is incomplete

- Severity: Medium
- Location: `backend/src/app.ts:215`, `backend/src/app.ts:216`, `backend/src/app.ts:217`, `backend/src/app.ts:220`
- Evidence: The app creates Express without `helmet`, does not disable `x-powered-by`, and uses JSON/urlencoded parsers without explicit project limits.
- Impact: Missing browser security headers weakens XSS/clickjacking defense-in-depth, and default framework fingerprints remain visible unless handled at the edge.
- Fix: Add `helmet`, call `app.disable('x-powered-by')`, set explicit parser limits, and verify production response headers.
- Mitigation: If Nginx/CDN already sets these headers, document and test that at runtime.

### SEC-008: CORS is globally permissive for privileged headers

- Severity: Medium
- Location: `backend/src/app.ts:220`
- Evidence: Every response gets `Access-Control-Allow-Origin: *` and allows `Authorization` plus `x-api-key`.
- Impact: Bearer tokens are not sent automatically like cookies, so this is not CSRF by itself. But if any privileged token/key leaks, any website can call the API from a browser and read responses.
- Fix: Restrict CORS origins to the production site and known local dev origins; keep public read endpoints separate if they truly need wildcard CORS.
- Mitigation: Prefer route-specific CORS policies.

### SEC-009: Browser tokens are stored in localStorage

- Severity: Medium
- Location: `src/admin/AdminApp.tsx:1035`, `src/admin/AdminApp.tsx:1262`, `src/App.tsx:902`, `src/App.tsx:907`
- Evidence: Admin and applicant portal bearer tokens are read from and written to localStorage.
- Impact: Any XSS on the same origin can steal long-lived admin or portal tokens.
- Fix: Prefer HttpOnly, SameSite cookies with CSRF protection, or reduce token TTL and add refresh/session revocation controls if bearer-token storage must remain.
- Mitigation: Prioritize XSS fixes and CSP while migrating token storage.

### SEC-010: Payment origin construction can trust request headers when no configured origin exists

- Severity: Medium
- Location: `backend/src/routes/portalRoutes.ts:1458`, `backend/src/routes/portalRoutes.ts:1464`, `backend/src/utils/siteUrl.ts:9`
- Evidence: Payment notify/return origins fall back to `x-forwarded-*`, `host`, `origin`, or `referer` when `notify_origin`, `PAYMENT_NOTIFY_ORIGIN`, and `API_BASE` are unset.
- Impact: If the reverse proxy does not sanitize these headers and payment origins are not configured, generated payment callback/return URLs can be host-header influenced.
- Fix: Require `notify_origin` or `PAYMENT_NOTIFY_ORIGIN` when payments are enabled. Avoid deriving payment callback origins from client-controlled request headers.
- Mitigation: Enforce canonical host headers at Nginx/CDN.

## Lower-Risk / Positive Findings

- `.env` and `backend/.env` are ignored and are not tracked by git; only `backend/.env.example` is tracked.
- Reviewed payment notification routes call `verifyNotificationPayload` before marking orders paid.
- News upload filenames use server-generated UUIDs and file-size limits.
- Many repository queries use parameterized `execute`/`query` placeholders; no definite SQL injection was found in the sampled request-to-query paths.

## Verification Commands Run

- `npm audit --omit=dev --json`
- `npm ls sanitize-html protobufjs vite path-to-regexp picomatch nodemailer geoip-country ip-address postcss @protobufjs/utf8 --all --omit=dev`
- `rg` searches for auth, CORS, Helmet/rate-limit, DOM XSS sinks, redirects, shell execution, filesystem, SQL, and secret patterns
- Manual review of Express app bootstrap, auth middleware/routes, portal payment routes, news rendering/upload paths, and Vite config
