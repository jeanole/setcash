# Project Research Summary

**Project:** SetCash — Reliability Hardening Milestone
**Domain:** Multi-tenant financial/expense tracking web app (Next.js 14 + Prisma + PostgreSQL)
**Researched:** 2026-04-01
**Confidence:** HIGH

## Executive Summary

SetCash is a production multi-tenant expense tracking application that requires a hardening milestone — not a feature build. The research confirms four categories of work: security fixes (path traversal, stale JWT roles), data correctness fixes (transaction scope, N+1 writes), code quality cleanup (shared helpers, async I/O, dependency hygiene), and test coverage (integration tests for critical paths). This is not greenfield work; every recommendation is grounded in a direct audit of the existing codebase. No new frameworks, databases, or architectural patterns are required.

The recommended approach is to execute in strict dependency order. Security fixes and dependency pinning have no prerequisites and should be done first. Shared helper extraction is the central prerequisite: it unblocks transaction scope expansion, the createMany optimization, and the integration test suite. Legacy column removal is a separate, irreversible phase gated on full consumer migration. Attempting to combine these phases or invert their order is the primary source of rework risk in this type of refactoring milestone.

The key risk is scope creep and phase order violations. All four research files converge on the same warning: do not expand the transaction scope before batching writes, do not drop legacy columns before migrating all consumers, and do not write integration tests against the fragile pre-extraction code path. The pitfalls here are not hypothetical — they are the exact failure modes documented in Prisma's own issue tracker and in the codebase's CONCERNS.md.

---

## Key Findings

### Recommended Stack

The existing stack requires no changes. All tooling additions are either already present (Jest 29, ts-jest, Prisma, Zod 4) or are lightweight additions with zero architectural impact. The only new production dependency recommended is @sentry/nextjs for error tracking and route-level performance tracing, which has first-party Next.js App Router support and a wizard-based setup. The only new test dependency is next-test-api-route-handler (NTARH), which is the only library that correctly invokes App Router route handlers in Jest without a running server.

**Core technologies:**
- `next-test-api-route-handler` (4.x): API route testing without a running server — the only library using Next.js's internal route resolver for App Router; zero-config with existing Jest setup
- `@sentry/nextjs`: Error tracking and performance tracing — first-party App Router support, wizard-based setup, free tier sufficient for production; replaces manual logging with structured observability
- `npm audit` + Socket.dev GitHub App: Dependency security scanning — npm audit covers known CVEs; Socket.dev catches behavioral supply-chain attacks not yet in CVE databases
- `prisma migrate deploy` (existing): Production migration safety — already used in Docker startup; only tool appropriate for production schema changes
- `jest.mock('next-auth')` pattern (no new package): Auth mocking in tests — standard module-level mock pattern for next-auth v5 beta; no extra library needed

**What not to add:** Playwright/Cypress (E2E out of scope), Vitest (zero gain over existing Jest), Snyk CLI (redundant with npm audit + Socket.dev for single-team project), Helmet.js (not applicable to App Router), Prisma Accelerate (single-instance Docker app), jest-mock-extended (contradicts real-database test convention).

---

### Expected Features

This milestone has no user-facing features. All items are internal reliability, security, and maintainability fixes. The table-stakes list represents what is required for a financial application to be considered production-ready.

**Must have (table stakes) — ordered by risk:**
- Path traversal guard on uploads endpoint — critical severity; unauthenticated filesystem reads are OWASP A01
- Transaction scope for bill creation — partial bill records (bill row with no allocations) corrupt budget calculations silently
- Server-side role re-fetch for critical operations — stale JWT allows demoted admins to approve/delete bills until session expiry
- Replace synchronous fs calls with async equivalents — synchronous I/O blocks the event loop under concurrent load
- Extract duplicated saveAllocations helpers — identical code in two files guarantees divergence bugs; prerequisite for items above
- Replace N+1 allocation writes with createMany — 10-30 serial DB round-trips per bill save reduced to 2
- Pin next-auth to exact version — beta semver ranges allow silent auth-breaking upgrades
- Move @types/* to devDependencies — convention fix, reduces production Docker image size
- Remove better-sqlite3 dependency — unused after PostgreSQL migration; native module compilation overhead
- Integration tests for critical paths — 84 of 87 API routes have zero test coverage; regressions are invisible
- Automated token cleanup — expired tokens accumulate indefinitely, slowing auth lookups

**Should have (above-baseline hardening):**
- Stream file responses instead of loading into memory — prevents memory pressure under concurrent downloads
- Origin header validation on mutations — defense-in-depth against CSRF beyond SameSite cookies
- Rate limiting on authentication endpoints — brute-force protection on login and password reset
- Legacy column removal (legacyId, motiveLegacy) — removes fragile denormalization; requires dedicated phase

**Defer to separate milestone:**
- S3/GCS file storage migration — scaling concern, not current reliability concern
- E2E browser tests (Playwright/Cypress) — invest after API integration test coverage is established
- Explicit Content-Security-Policy header — requires nonce-based approach; non-trivial for App Router
- Idempotency keys on bill create — high complexity; only needed if duplicate-submission bugs are observed
- next-auth stable v5 upgrade — introduces migration risk; plan after test coverage exists

---

### Architecture Approach

SetCash is a monolithic Next.js 14 App Router application with well-defined layers: edge middleware for JWT gating, server components for SSR shells, client components for interactive UI, API routes for REST handlers, and a shared lib layer over Prisma/PostgreSQL. The hardening work targets two API routes (app/api/bills/route.ts, app/api/bills/[id]/route.ts) and one file-serving route (app/api/uploads/[[...path]]/route.ts). A new shared module (lib/bills.ts) must be created as the extraction target. No new architectural layers are introduced.

**Major components (hardening targets):**
1. `app/api/bills/route.ts` — Bill creation: currently fragile; steps 5-11 of bill creation are outside the transaction, leaving partial records on failure
2. `app/api/bills/[id]/route.ts` — Bill read/update/delete: role checks read stale JWT role; duplicate saveAllocations implementation
3. `app/api/uploads/[[...path]]/route.ts` — File serving: no path traversal guard; synchronous readFileSync loads entire file into memory; legacy fallback accepts arbitrary relPath
4. `lib/bills.ts` (new) — Shared bill helpers: extraction target for saveAllocations, syncLegacyImageColumns, getMotiveDisplayString; helpers must accept a Prisma TransactionClient parameter
5. `__tests__/api/` (new files) — Integration tests: uses existing createTestContext/cleanupTestContext/makeSession infrastructure from __tests__/helpers.ts

---

### Critical Pitfalls

1. **Expanding transaction scope before batching writes** — The 5000ms Prisma interactive transaction timeout is breached by N+1 allocation writes inside a transaction. Batch writes with createMany first (reduces 10-30 round-trips to 2), then wrap in transaction. Failure produces P2034 errors and bill creation failures under concurrent load.

2. **Dropping legacy columns without confirming all consumers** — motiveLegacy is actively read by Google Sheets sync. Dropping the column while any reader exists causes P2009 runtime errors on every bill create/update. Use expand-and-contract: replace all reads with BillMotive joins first, deploy, verify, then drop in a separate migration.

3. **Path traversal fix that guards only one entry point** — Fixing app/api/uploads/[[...path]]/route.ts without auditing all file-serving routes leaves the legacy fallback lookup path unguarded. An attacker reads ../../.env.local via the unguarded path, obtaining DATABASE_URL and NEXTAUTH_SECRET. Enumerate all routes calling path.join(someDir, userInput) before writing any fix.

4. **JWT role re-verification fix applied only in middleware** — Next.js Edge Runtime middleware cannot make direct Prisma connections. Adding the DB role check only in middleware and leaving session.user.role checks unchanged in route handlers closes zero attack surface. The DB lookup must be in the route handler itself for every role-gated mutation.

5. **Integration tests that contaminate each other via shared database state** — Tests that create bills without TRUNCATE CASCADE teardown accumulate state across runs. Tests pass individually but fail in suite. Establish --runInBand serial execution and TRUNCATE teardown infrastructure before writing any test.

---

## Implications for Roadmap

Based on research, the dependency graph drives a strict 4-phase structure. Parallelism is possible within phases but phases cannot be reordered.

### Phase 1: Security and Dependency Baseline
**Rationale:** These items have zero dependencies on each other or on any other work. They are the highest-severity issues (critical security) and the lowest-risk changes (additive guards, package.json edits). Doing them first prevents them from creating merge conflicts during the structural refactoring in later phases.
**Delivers:** No path traversal vulnerability, no stale-JWT privilege escalation, no silent next-auth beta upgrades, clean dependency tree, no Docker build size inflation from unused packages.
**Addresses:** Path traversal guard, server-side role re-fetch, next-auth pin, @types to devDeps, remove better-sqlite3.
**Avoids:** Pitfall 3 (partial path traversal fix) — enumerate all file-serving routes and guard them all in one sweep; Pitfall 4 (JWT fix in wrong layer) — apply DB lookup in route handlers, not middleware; Pitfall 6 (lockfile resolves newer next-auth) — delete lockfile and reinstall to verify.
**Research flag:** Standard patterns. No additional research needed. Reference pattern is already in app/api/bug-reports/screenshots/[filename]/route.ts lines 33-38.

### Phase 2: Shared Helper Extraction
**Rationale:** lib/bills.ts is the central prerequisite for Phase 3. saveAllocations must accept a Prisma TransactionClient parameter before it can be used inside $transaction(). Attempting transaction expansion against the current duplicated code would require applying the change twice and make the duplication worse. This is a pure refactor with no behavior change — a safe, isolated phase.
**Delivers:** Single source of truth for bill allocation logic; helpers accept transaction client parameter; both bill route files import from shared module; N+1 createMany optimization applied.
**Addresses:** Extract saveAllocations/syncLegacyImageColumns/getMotiveDisplayString to lib/bills.ts; replace N+1 allocation writes with createMany.
**Avoids:** Anti-pattern of expanding transaction without extracting first (helpers would silently bypass transaction isolation by closing over module-level prisma client).
**Research flag:** Standard refactor. No additional research needed. Prisma TransactionClient type is Prisma.TransactionClient from @prisma/client.

### Phase 3: Data Correctness and Test Coverage
**Rationale:** Transaction scope expansion requires lib/bills.ts from Phase 2. Integration tests for bill creation should be written against the refactored (transactional) code, not the fragile pre-extraction flow — otherwise tests encode buggy behavior and must be rewritten. Bill creation formData mocking (the only complexity above the existing categories.test.ts pattern) is more straightforward after the route is simplified by extraction.
**Delivers:** Atomic bill creation (no partial records on failure), async file I/O (event-loop safe under load), integration test coverage for bill CRUD + auth + allocation math, automated token cleanup.
**Addresses:** Transaction scope for bill creation, replace synchronous fs calls, integration tests for critical paths, automated token cleanup.
**Avoids:** Pitfall 1 (transaction timeout) — createMany is already applied in Phase 2, so transaction body is lean; prepare data outside transaction, add P2034 retry; Pitfall 5 (test state contamination) — establish TRUNCATE CASCADE teardown and --runInBand before writing any test; Pitfall 7 (missing await on async replacements) — replace one file at a time, verify await at every call site.
**Research flag:** Bill creation FormData mocking needs one exploratory spike. The formidable mock-stream workaround may require a test helper. The existing __tests__/helpers.ts infrastructure covers auth mocking; multipart mocking is the gap.

### Phase 4: Legacy Column Removal
**Rationale:** This is the only irreversible phase. It must follow Phase 3 because: (1) the Google Sheets sync motiveLegacy read path must be replaced with a BillMotive join first (requires lib/bills.ts from Phase 2), (2) integration tests from Phase 3 must cover the migrated code path before the column is dropped, (3) the database migration is destructive — a production backup is required before running it. Combining this with any earlier phase introduces unnecessary risk.
**Delivers:** motiveLegacy denormalization removed, legacyId columns removed from 15+ models, schema matches actual data access patterns, no more dual-write maintenance burden.
**Addresses:** Legacy column removal (legacyId, motiveLegacy).
**Avoids:** Pitfall 2 (dropping columns without confirming all consumers) — use expand-and-contract: replace all reads with joins in Phase 3/4a, run git grep motiveLegacy and git grep legacyId across all non-migration files, use @ignore in Prisma schema before the DROP COLUMN migration, take a point-in-time backup.
**Research flag:** Needs validation that no external system (Google Sheets export, Telegram bot, any raw SQL) reads legacyId before migration proceeds. A full git grep and review of Sheets sync code is mandatory before Phase 4 can begin.

---

### Phase Ordering Rationale

- Security fixes come first because they are independent, low-risk, and the most severe issues. Deferring them past structural refactoring creates unnecessary merge window exposure.
- Helper extraction precedes both transaction expansion and integration tests because both depend on the extracted module signature (TransactionClient parameter). This is a hard technical dependency, not a preference.
- Integration tests come after extraction and transaction expansion so tests validate the correct, production-intended behavior rather than the fragile pre-refactor flow.
- Legacy column removal is last and isolated because DROP COLUMN is irreversible. No other work item is irreversible. It requires all consumers to be migrated before the migration runs.
- Differentiators (file streaming, Origin header validation, rate limiting on auth endpoints) are not assigned to a phase. Add them to Phase 3 or as a Phase 5 if the team has capacity after the table-stakes work is complete.

---

### Research Flags

Phases likely needing deeper research or exploratory spikes during planning:
- **Phase 3 (Integration tests):** Multipart FormData mocking for bill creation tests with formidable. The existing test infrastructure covers JSON-body routes; multipart requires a Readable stream mock or a test helper. One spike recommended before committing to test scope estimates.
- **Phase 4 (Legacy column removal):** External consumer audit. Google Sheets sync, Telegram bot, and any external scripts that may SELECT * or reference legacyId columns need explicit verification. Cannot be resolved by TypeScript analysis alone.

Phases with standard patterns (no additional research needed):
- **Phase 1:** Path traversal guard pattern already exists in the codebase. JWT role re-verification pattern is documented in ARCHITECTURE.md with exact code. Dependency cleanup is mechanical.
- **Phase 2:** Prisma TransactionClient extraction is a standard refactor. createMany is documented in official Prisma docs.
- **Phase 3 (transaction scope):** Prisma $transaction with Serializable isolation is official-doc-backed. P2034 retry pattern is standard. Async fs.promises replacement is mechanical.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All additions verified via official docs or existing project conventions. NTARH is MEDIUM-HIGH (community-verified, not in Context7). |
| Features | HIGH | Based on direct codebase audit (CONCERNS.md) and financial app security best practices. Feature list is concrete, not speculative. |
| Architecture | HIGH | Sourced entirely from direct codebase audit. No inference required — all file locations, line numbers, and data flows are verified. |
| Pitfalls | HIGH | All critical pitfalls verified against official Prisma docs, Prisma GitHub issues, and Auth.js RBAC guides. Codebase audit confirms each pitfall is present. |

**Overall confidence:** HIGH

### Gaps to Address

- **formidable multipart mocking in tests:** No established pattern exists in the current test suite for FormData/multipart requests. An exploratory spike is needed before estimating Phase 3 integration test effort. The workaround may involve constructing a fake Readable stream or using a helper library.
- **External consumer audit for legacy columns:** TypeScript analysis cannot detect raw SQL strings, Google Sheets export column references, or external scripts using SELECT *. A manual audit of the Sheets sync code and any non-TypeScript consumers is required before Phase 4 can begin. This is a validation step, not a research gap.
- **Sentry DSN and configuration:** Sentry setup requires creating a project in the Sentry dashboard and obtaining a DSN. This is an operational step, not a technical blocker, but should be confirmed with the team before Phase 3 adds performance monitoring.

---

## Sources

### Primary (HIGH confidence)
- Official Prisma Docs — transactions, migration deploy, migration dev, createMany, query logging
- Official Sentry Docs — Next.js App Router integration, wizard setup
- Official Next.js Docs — App Router testing guide, OpenTelemetry
- Auth.js RBAC Guide — role-based access control patterns
- Prisma GitHub issues 14487, discussions 25922 — transaction timeout defaults and deadlock behavior
- HackerOne report 329837 — incomplete path traversal fix bypass patterns
- SetCash codebase direct audit — CONCERNS.md, app/api/bills/route.ts, app/api/uploads/[[...path]]/route.ts, __tests__/

### Secondary (MEDIUM confidence)
- next-test-api-route-handler GitHub README + Arcjet blog — NTARH usage patterns and App Router compatibility
- Socket.dev — supply-chain attack behavioral analysis (multiple 2025 security sources)
- NextAuth JWT token refresh GitHub discussion — stale JWT behavior
- Expand-and-contract pattern (NexisLtd blog, Xata blog) — zero-downtime schema migration strategy
- Multi-tenancy with Prisma (ZenStack blog) — cross-tenant isolation patterns

### Tertiary (LOW confidence)
- None. All findings have at least MEDIUM confidence backing.

---
*Research completed: 2026-04-01*
*Ready for roadmap: yes*
