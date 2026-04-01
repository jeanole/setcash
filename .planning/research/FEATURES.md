# Feature Landscape — Hardening Milestone

**Domain:** Multi-tenant financial/expense tracking app (SetCash)
**Researched:** 2026-04-01
**Milestone scope:** Production hardening — no new features, no UI changes

---

## Table Stakes

Features/fixes that a production financial app must have. Missing any of these means the app is
not production-ready. They are not optional.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Path traversal guard on uploads endpoint | Financial apps are high-value targets; unauthenticated file-system reads are critical-severity (OWASP A01) | Low | Pattern already applied in bug-report screenshots route — copy it to uploads route. Resolve final path, assert it starts with UPLOADS_DIR. Decode URL-encoded segments before resolving. |
| Transaction scope for bill creation | Financial data tolerates zero silent failures; partial bill records (bill row exists, allocations missing) corrupt budget calculations silently | Medium | Move image records, saveAllocations, motive display update, and edit-log writes inside the existing Prisma serializable transaction. File moves cannot be transactional — add compensating cleanup on error. |
| Server-side role re-fetch for critical operations | JWT-embedded roles are stale after a role change; stale admin tokens remain valid until expiry — a demoted admin can still approve/delete bills | Low | Re-fetch user.role from DB on any state-changing operation (bill status change, delete, admin actions). Add a thin getEffectiveRole(userId) helper in lib/auth.ts. |
| Replace synchronous fs calls with async | Synchronous file I/O blocks the Node.js event loop; under concurrent load all requests queue behind a disk read | Medium | Replace readFileSync, renameSync, unlinkSync, existsSync across 5 files with fs.promises equivalents. Affects uploads serving, bill image handling, upload utility. |
| Extract duplicated saveAllocations and related helpers | Two identical copies of the same function guarantees divergence bugs — each future bug fix must be applied in two places | Low | Extract to nextjs/lib/bills.ts. Both bill route files import from the shared module. This is the prerequisite for the createMany optimization and transaction scope work. |
| Replace N+1 allocation writes with createMany | Sequential awaited DB writes for each allocation create one round-trip per allocation — 5 motives + 5 categories = 10 serial queries per bill save | Low | Use prisma.billMotive.createMany() and prisma.billCategory.createMany(). Natural follow-on after extraction to shared module. |
| Pin next-auth to exact version | ^5.0.0-beta.30 allows silent beta upgrades; auth is security-critical — beta APIs have no semver stability guarantee | Low | Change package.json to "next-auth": "5.0.0-beta.30" (no caret). Document upgrade path to stable v5 when released. |
| Move @types/* to devDependencies | Type-only packages in dependencies are bundled into production Docker image; not harmful but violates standard Node.js convention and inflates image size | Low | Move @types/archiver, @types/cropperjs, @types/formidable, @types/pdfkit to devDependencies. |
| Remove better-sqlite3 dependency | SQLite driver is unused after PostgreSQL migration; native module compilation increases install time and image size | Low | Remove better-sqlite3 and @types/better-sqlite3 from package.json. Archive scripts/migrate-sqlite-to-pg.ts (do not delete — preserves migration history). |
| Integration tests for critical paths | Only 3 of 87 API routes have tests; bill CRUD, auth, allocations, and authorization checks have zero coverage — regressions are invisible | High | Cover: bill create/update/delete lifecycle, allocation math, bill status transitions, auth guard (unauthenticated 401, wrong role 403). Use real DB per project convention. |
| Automated token cleanup | Expired PasswordResetToken, EmailVerificationToken, and TelegramLinkCode records accumulate indefinitely; large token tables slow auth lookups | Low | Add a scheduled cleanup (Prisma deleteMany where expiresAt < now()) run via a lightweight cron or Next.js startup hook. |

---

## Differentiators

Features that go above the baseline. Not required for "production-ready" but represent above-average
hardening common in well-run financial apps.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Stream file responses instead of loading into memory | Prevents memory pressure under concurrent downloads; important if bill images can be large (10+ MB receipts) | Medium | Replace readFileSync + Response(buffer) with ReadableStream wrapping fs.createReadStream(). Prerequisite: async I/O work is done first. |
| Legacy column removal (legacyId, motiveLegacy) | Removes fragile motiveLegacy denormalization that must be kept in sync on every bill write — current source of subtle bugs | High | Requires: (1) audit all consumers including external integrations reading legacyId, (2) write migration, (3) replace motiveLegacy reads with joins. High risk — gate behind explicit user confirmation that no external system reads these columns. |
| Origin header validation on mutations | Adds defense-in-depth against CSRF beyond SameSite cookies; standard for financial apps handling money transfers | Medium | Check Origin header on POST/PUT/DELETE routes. Reject requests where Origin does not match the app domain. Simpler than full CSRF tokens, compatible with App Router. |
| Idempotency keys on bill create and VGeld transfer | Prevents duplicate bill creation or double-transfers on network retries; a known issue class in financial apps | High | Client sends X-Idempotency-Key header; server stores key+result in a short-lived DB table. Returns cached result on duplicate key. High complexity — defer unless duplicate-submission bugs are observed in production. |
| Rate limiting on authentication endpoints | Brute-force protection on login and password reset; standard expectation for any app with user accounts | Medium | Apply per-IP rate limit (e.g., 10 attempts per 15 minutes) on /api/auth/signin, /api/auth/reset-password, /api/auth/verify-email. Can use a simple in-memory or Redis-backed counter. |
| Explicit Content-Security-Policy header | Mitigates XSS; the app serves user-uploaded images and receipts which are attack vectors | High | CSP for Next.js App Router is non-trivial due to inline scripts from the React runtime. Requires nonce-based approach or unsafe-inline fallback. Revisit in dedicated security milestone unless XSS risk is assessed as high. |

---

## Anti-Features

Things to deliberately NOT do in this hardening milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Migrate file storage to S3/GCS | Scope creep — this is a scaling concern, not a reliability concern for current load; requires environment changes, signed URL auth, and upload flow changes | Track as future scaling milestone. Note the horizontal scaling limit in docs. |
| Add E2E browser tests (Playwright/Cypress) | Slow to write, slow to run, brittle on UI changes — wrong investment when 84 of 87 API routes have zero integration test coverage | Write integration tests first; E2E adds value only once the API layer is trusted. |
| Implement CSRF tokens | SameSite=Lax + Origin header check provides adequate protection for a cookie-auth app without the complexity of token synchronization across SSR and API routes | Use Origin header validation (differentiator) if additional CSRF hardening is needed. |
| Upgrade next-auth to stable v5 | Stable v5 is a significant API surface change from beta.30 — introduces migration risk in the same milestone as reliability hardening | Pin the current beta, plan upgrade as a separate milestone item after test coverage exists to catch regressions. |
| Rewrite formidable integration | The mock-stream workaround is fragile but functional; rewriting it risks breaking file uploads | Document the fragility in a code comment; track as tech debt for a future milestone. |
| Add analytics retention automation | Out of scope per PROJECT.md; analytics tables growing unboundedly is a cost concern, not a correctness or security concern | Superadmin prune endpoint already exists. Document the manual prune procedure. |
| Remove or restructure the Telegram bot | Scaling limit (polling mode, single instance) is a future concern — the bot works correctly today | Note the horizontal-scaling limitation in architecture docs. |

---

## Feature Dependencies

```
saveAllocations extraction (lib/bills.ts)
  |-- createMany optimization        (requires shared module first)
  |-- Transaction scope fix          (requires shared module first)
  |-- Integration tests (bill flow)  (tests import shared helpers)

Async I/O replacement
  |-- File streaming (differentiator) (streaming requires async foundation)

Integration tests (auth guards)
  |-- Role re-fetch (critical ops)   (tests validate the fix works)
```

Key dependency chain: extract shared helpers first, then apply transaction fix and createMany,
then write integration tests that validate both.

---

## MVP Recommendation (Hardening Milestone Order)

Prioritize strictly by risk reduction:

1. Path traversal guard — critical severity, one-day fix, blocks file-system reads
2. Pin next-auth exact version — prevents surprise auth breakage, 30-minute fix
3. Dependency hygiene (@types to devDeps, remove better-sqlite3) — low-risk cleanup, clears noise
4. Extract shared bill helpers — prerequisite for items 5 and 6
5. Transaction scope for bill creation — highest correctness risk in the codebase
6. Replace N+1 writes with createMany — straightforward after extraction
7. Server-side role re-fetch — closes stale-JWT privilege escalation
8. Replace synchronous fs calls — event-loop safety under concurrent load
9. Automated token cleanup — prevents table bloat, low complexity
10. Integration tests — highest effort, highest long-term value; bill create/update/delete + auth + allocation math

Defer differentiators to a second pass after the above are complete.

---

## Sources

- Next.js Security Best Practices 2026: https://www.authgear.com/post/nextjs-security-best-practices
- Next.js Security Hardening (Medium): https://medium.com/@widyanandaadi22/next-js-security-hardening-five-steps-to-bulletproof-your-app-in-2026-61e00d4c006e
- Node.js Path Traversal Guide (StackHawk): https://www.stackhawk.com/blog/node-js-path-traversal-guide-examples-and-prevention/
- Secure Coding: Path Traversal in Node.js: https://www.nodejs-security.com/blog/secure-coding-practices-nodejs-path-traversal-vulnerabilities
- Idempotency in Finance (CockroachLabs): https://www.cockroachlabs.com/blog/idempotency-in-finance/
- Idempotent Payment APIs (Medium): https://medium.com/codeelevation/how-to-design-idempotent-payment-apis-for-reliable-financial-transactions-24513f6420ae
- Integration Testing with Prisma (Prisma Docs): https://www.prisma.io/docs/orm/prisma-client/testing/integration-testing
- Web Application Security Checklist (StackHawk): https://www.stackhawk.com/blog/web-application-security-checklist-10-improvements/
- Security Checklist for React/Next.js (The New Stack): https://thenewstack.io/a-security-checklist-for-your-react-and-next-js-apps/
- SetCash codebase audit: .planning/codebase/CONCERNS.md
- SetCash project context: .planning/PROJECT.md
