# Technology Stack: Hardening Tools

**Project:** SetCash — Reliability Hardening Milestone
**Researched:** 2026-04-01
**Scope:** Testing, security scanning, migration safety, dependency auditing, performance monitoring for an existing Next.js 14 + Prisma + PostgreSQL multi-tenant app

---

## Recommended Additions by Category

### Testing Framework (API Route Integration Tests)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `next-test-api-route-handler` (NTARH) | latest (4.x) | Invoke App Router route handlers in Jest without a running server | The only library that uses Next.js's own internal route resolver to emulate exact App Router behavior — including `NextRequest`/`NextResponse` Web API globals, `params`, and edge runtime. Tested against every Next.js release. Zero-config for existing Jest setups. |
| `jest` | 29.7 (already installed) | Test runner | Already present; no change needed. |
| `ts-jest` | 29.x (already installed) | TypeScript transform | Already present. |
| `@types/jest` | matching jest version | Type definitions | Move to `devDependencies` as part of the cleanup work already planned. |

**Why NTARH over alternatives:**
- Calling route handlers directly (without NTARH) requires manually constructing `NextRequest` objects and parsing `Response` bodies — fragile and verbose.
- `supertest` targets Express/Node `http.IncomingMessage`; it does not understand `NextRequest`/`NextResponse` or App Router `params`. Would require an actual running server.
- `node-mocks-http` was designed for the Pages Router (`req`/`res` pattern); it does not apply to App Router route handlers.

**NTARH confidence:** MEDIUM-HIGH. Package has healthy release cadence (~33K weekly downloads as of research date), is maintained actively, and is the most-cited community solution for this exact problem. Based on official GitHub README and multiple developer articles; not in Context7.

---

### Test Database Isolation

| Pattern | Why |
|---------|-----|
| Single shared PostgreSQL test database (already used per project convention) with per-test cleanup via `beforeEach`/`afterEach` `DELETE` or `TRUNCATE` on relevant tables | Matches the project's existing convention ("integration tests use real database"). Simple, no extra tooling. |
| Transaction-rollback isolation (optional upgrade) | Wrap each test in a `BEGIN`/`ROLLBACK` block so no cleanup SQL is needed. Works well but requires passing the same database connection into the route handler — non-trivial with Prisma's global singleton client. Mention as a future refinement, not a Phase 1 requirement. |

**What NOT to use:** Prisma mock clients (`jest-mock-extended` + manual Prisma type mocks). The project explicitly requires real-database integration tests. Mocking Prisma returns false confidence — it tests that your mock behaves correctly, not that your queries actually work against PostgreSQL.

---

### Session/Auth Mocking in Tests

| Pattern | Why |
|---------|-----|
| `jest.mock('next-auth')` with a module-level variable controlling the mock session | Standard pattern for next-auth v5 beta. Mock `auth` (the exported function from `nextjs/auth.ts`) to return a controlled session object. Lets you test both authenticated and unauthenticated branches without a real OAuth roundtrip. |

No additional library required. This is a Jest mock pattern, not a package.

---

### Dependency Auditing

| Tool | Purpose | Why | Confidence |
|------|---------|-----|------------|
| `npm audit` | Known CVE scanning against npm advisory database | Built into npm, zero setup, catches published CVEs. Run as `npm audit --audit-level=high` in CI to fail on high/critical issues only. | HIGH |
| Socket.dev GitHub App (free tier) | Behavioral analysis of dependency changes in PRs | Catches malicious packages and supply-chain attacks *before* they appear in CVE databases, by analyzing what packages actually do (filesystem access, network calls, install scripts). Complements `npm audit` which only catches already-known CVEs. Install as a GitHub App — no CLI integration needed. | MEDIUM (verified via multiple 2025 security sources) |

**Why NOT Snyk for this project:** Snyk is powerful but enterprise-focused with a paid tier required for full CI integration. For a single-team app, `npm audit` + Socket.dev covers the threat model. Snyk is worth revisiting if the team grows or a compliance requirement appears.

**What NOT to use:** `npm audit --fix` in CI. Auto-fixing in CI can break the lockfile unexpectedly. Run audit for reporting only; human reviews the output.

---

### Security Scanning (Static / Code-Level)

| Tool | Purpose | Why | Confidence |
|------|---------|-----|------------|
| `npm audit` | Dependency CVEs (see above) | — | HIGH |
| Next.js built-in security headers (already configured) | X-Frame-Options, HSTS, nosniff, Referrer-Policy are already set in `next.config.mjs` | No additional tooling needed here. | HIGH |
| Manual path-traversal guard (code change, not a tool) | Resolve upload path and assert it starts with `UPLOADS_DIR` | The specific vulnerability identified in CONCERNS.md. A library is not needed — a two-line guard using `path.resolve()` and `String.prototype.startsWith()` is sufficient and is the pattern already used in `nextjs/app/api/bug-reports/screenshots/[filename]/route.ts`. | HIGH |

**What NOT to use:** DAST scanners (OWASP ZAP, Burp Suite) at this stage. They require a live deployment and add significant CI complexity. Defer to a dedicated security milestone. The identified vulnerabilities are known code issues, not unknown attack surface — fix them in code, not with scanning.

---

### Database Migration Safety

| Tool / Practice | Purpose | Why | Confidence |
|-----------------|---------|-----|------------|
| `prisma migrate deploy` (already used in Docker startup) | Apply pending migrations in production | Safe by design: only applies existing checked-in migrations, no drift detection, no schema regeneration. Does not alter anything not already in `prisma/migrations/`. | HIGH (official Prisma docs) |
| `prisma migrate dev --create-only` | Generate migration SQL without applying it | Use before every schema change to review the generated SQL manually. Lets you catch destructive operations (DROP COLUMN, DROP TABLE) before they run. | HIGH (official Prisma docs) |
| Review generated migration SQL in git PR before merge | Catch accidental column drops | `prisma migrate dev` adds migration files to `prisma/migrations/`. These should be committed and reviewed in PRs. The presence of `DROP COLUMN` or `DROP TABLE` in a migration file is a merge-blocking signal unless intentional. | HIGH |
| `prisma migrate resolve` | Reconcile migration history after a hotfix was applied directly to the DB | Use when a production hotfix creates schema drift. Marks the migration as applied without re-running it. | HIGH (official Prisma docs) |

**Specific concern from CONCERNS.md:** Removing `legacyId` columns from 15+ models and `motiveLegacy` from `Bill` requires a migration with `DROP COLUMN`. Use `--create-only`, inspect the SQL, verify no external reader exists, then apply.

**What NOT to use:** `prisma db push` in production. It applies schema changes without creating a migration file, making the change untracked and irreversible via standard migration tooling. Only appropriate for rapid prototyping.

**Prisma Next (emerging):** The upcoming Prisma Next migration runner adds hash-based pre-flight checks (verifies DB schema matches expected pre-migration state before running). Not yet stable as of research date. Monitor for production readiness.

---

### Performance Monitoring

| Tool | Purpose | Why | Confidence |
|------|---------|-----|------------|
| Sentry (`@sentry/nextjs`) | Error tracking + performance tracing (traces per route, slow DB queries) | First-party Next.js App Router support via `npx @sentry/wizard -i nextjs`. Instruments server components, API routes, server actions, and edge middleware in one SDK. Free tier (5K errors/month) sufficient for early production. Setup wizard generates `sentry.client.config.ts`, `sentry.server.config.ts`, and `sentry.edge.config.ts` automatically. Exposes transaction-level P50/P95 data per route without custom instrumentation. | HIGH (official Sentry docs, Next.js App Router confirmed) |
| Prisma query logging (built-in, zero cost) | Identify slow queries and N+1 patterns in development/staging | Enable via `new PrismaClient({ log: ['query', 'warn', 'error'] })` in non-production environments. Combined with Sentry's performance traces, this surfaces which DB calls are slow before they hit production. No additional package needed. | HIGH (official Prisma docs) |

**Why Sentry over Datadog:** Datadog is a full observability platform designed for infra teams. For an application-level hardening milestone on a single-instance app, Sentry provides error tracking + route performance in 15 minutes of setup. Datadog requires an agent, infrastructure integration, and significantly more configuration time. Revisit Datadog if the app scales to multiple instances or needs infrastructure-level metrics.

**Why Sentry over OpenTelemetry + custom backend:** OpenTelemetry is the correct long-term standard (Next.js 14 has built-in `instrumentation.ts` support). However, it requires choosing and configuring a backend (Jaeger, Zipkin, or a hosted service) and writing `instrumentation.ts` setup code. Sentry abstracts this. For a hardening milestone, Sentry gets monitoring in place faster. If vendor lock-in is a future concern, Sentry can be replaced with an OTel pipeline later — the application code changes are minimal.

**Sentry confidence:** HIGH. Official first-party support, wizard-based setup, confirmed to support Next.js 14 App Router.

---

### Zod Version Note

The project is already on Zod 4.3.6. This is the current major version. No migration needed.

**Caution:** Zod 4 has breaking changes from Zod 3. The codebase has been using Zod 4 directly (confirmed by `package.json` in STACK.md showing `zod@4.3.6`). If any utility or library internally depends on Zod 3 behavior, test those paths carefully. Key behavioral change: `z.string().uuid()` behavior changed — Zod 4 enforces RFC 4122 strictly; use `z.guid()` if you need the v3-compatible UUID validation.

---

### next-auth Pinning (Not a New Tool — An Existing Risk Fix)

| Action | Why | Confidence |
|--------|-----|------------|
| Pin `next-auth` to exact version `5.0.0-beta.30` in `package.json` (change `^5.0.0-beta.30` to `5.0.0-beta.30`) | Beta semver ranges are unreliable. `^` on a beta version allows npm to upgrade to any `5.0.0-beta.X` without explicit intent. Auth breaks are the highest-severity regression possible. | HIGH (CONCERNS.md confirms this risk explicitly) |

This is a one-character change, not a new dependency.

---

## What NOT to Add (Explicitly Out of Scope)

| Tool | Why Not |
|------|---------|
| Playwright / Cypress | E2E tests are explicitly out of scope for this milestone per PROJECT.md. Add after integration test coverage improves. |
| `@prisma/extension-accelerate` | Prisma connection pooling extension for edge. Not relevant — this is a single-instance Docker app, not a serverless/edge deployment. |
| Vitest | Testing framework alternative to Jest. The project already has Jest 29 configured with ts-jest and an `.env.test` file. Switching would require rewriting the test infrastructure for zero functional gain. |
| `jest-mock-extended` for Prisma | Produces mock-based tests that pass without touching the real database. Contradicts the project convention and would create false confidence in bill creation/allocation logic. |
| Helmet.js | Express.js security headers middleware. This is a Next.js App Router app — security headers are already set via `next.config.mjs` `headers()`. Helmet is not applicable. |
| Prisma Accelerate (cloud connection pooler) | Adds external dependency and cost. The app runs one instance; PgBouncer at the infrastructure level is the right tool if pooling is needed, not an SDK. |
| Snyk CLI in CI | Redundant with `npm audit` + Socket.dev for a single-team project. Re-evaluate at compliance threshold. |

---

## Installation

All additions are `devDependencies` except Sentry (which instruments production behavior):

```bash
cd nextjs

# Testing: API route handler invocation
npm install -D next-test-api-route-handler

# Error monitoring + performance tracing (production dependency)
npm install @sentry/nextjs
# Then run the wizard:
npx @sentry/wizard -i nextjs

# Socket.dev: install as GitHub App, no npm package
# https://socket.dev/

# No additional packages needed for:
#   - npm audit (built into npm)
#   - Prisma migration safety (built into Prisma CLI)
#   - Prisma query logging (built into @prisma/client)
#   - next-auth pinning (package.json edit only)
```

---

## Confidence Summary

| Area | Confidence | Notes |
|------|------------|-------|
| Testing (NTARH) | MEDIUM-HIGH | Not in Context7; verified via GitHub README, Arcjet blog, multiple community articles. Actively maintained. |
| Test DB pattern | HIGH | Consistent with existing project convention; no new tooling risk. |
| Auth mocking | HIGH | Standard Jest module mock pattern; no new library. |
| Dependency auditing (npm audit) | HIGH | Built into npm; official tool. |
| Dependency auditing (Socket.dev) | MEDIUM | Verified via multiple 2025 security sources; no official benchmark. |
| Migration safety | HIGH | All recommendations from official Prisma documentation. |
| Performance monitoring (Sentry) | HIGH | Official Next.js + Sentry integration; wizard-based setup documented. |
| next-auth pinning | HIGH | Confirmed risk in CONCERNS.md; fix is a package.json edit. |

---

## Sources

- [next-test-api-route-handler GitHub](https://github.com/Xunnamius/next-test-api-route-handler)
- [Testing Next.js App Router API routes — Arcjet Blog](https://blog.arcjet.com/testing-next-js-app-router-api-routes/)
- [Next.js Testing Guide — Official Docs](https://nextjs.org/docs/app/guides/testing)
- [Prisma Migrate: Development and Production — Official Docs](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- [prisma migrate deploy — Official Docs](https://www.prisma.io/docs/cli/migrate/deploy)
- [Rethinking Database Migrations — Prisma Blog](https://www.prisma.io/blog/rethinking-database-migrations)
- [Sentry for Next.js — Official Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [NPM Security Best Practices 2025 — Snyk](https://snyk.io/articles/npm-security-best-practices-shai-hulud-attack/)
- [Audit npm Packages Definitive 2025 Playbook — BrightCoding](https://www.blog.brightcoding.dev/2025/11/06/audit-npm-packages-before-installation-the-definitive-2025-security-playbook-with-case-studies-tools-checklist/)
- [Next.js Security Checklist — Arcjet Blog](https://blog.arcjet.com/next-js-security-checklist/)
- [OpenTelemetry — Next.js Official](https://nextjs.org/docs/app/guides/open-telemetry)
- [Zod v4 Changelog](https://zod.dev/v4/changelog)
- [Prisma Query Optimization](https://www.prisma.io/docs/v6/orm/prisma-client/queries/query-optimization-performance)
- [Monitoring Next.js with OpenTelemetry — Checkly](https://www.checklyhq.com/blog/in-depth-guide-to-monitoring-next-js-apps-with-opentelemetry/)

---

*Research date: 2026-04-01 | Overall confidence: MEDIUM-HIGH*
