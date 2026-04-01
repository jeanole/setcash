# Domain Pitfalls

**Domain:** Next.js 14 + Prisma + NextAuth multi-tenant expense tracking app — hardening milestone
**Researched:** 2026-04-01
**Overall confidence:** HIGH (pitfalls verified against official docs, GitHub issues, and codebase audit)

---

## Critical Pitfalls

Mistakes that cause data loss, security regressions, or full rewrites.

---

### Pitfall 1: Wrapping Existing Bill Creation Code in a Transaction Without Pruning It First

**What goes wrong:**
The current bill creation flow (`nextjs/app/api/bills/route.ts` lines 429-507) creates the bill record in a Serializable transaction, then performs file moves, image DB inserts, N+1 allocation writes, motive display string updates, and edit log creation outside the transaction. The natural fix is to pull all post-creation steps inside `prisma.$transaction()`. Done naively, this creates a long-running transaction that holds write locks across dozens of DB round-trips and a filesystem operation.

Prisma interactive transactions default to a **5000ms timeout** and a **2000ms acquire timeout**. A transaction containing N+1 `create()` calls for every allocation (potentially 10-30 round-trips), a `motiveLegacy` string update, and an edit log write will routinely breach 5 seconds under real load. Prisma throws a P2034 error (write conflict / timeout), the transaction rolls back, and the bill is never created — with no partial cleanup of already-moved files.

**Why it happens:**
Developers correctly identify "this needs a transaction" but wrap the existing sequential loop without first collapsing it into batch writes. The transaction body inherits all the latency of the original sequential pattern.

**Consequences:**
- Bill creation fails silently under concurrent load
- If file moves happen before the transaction (non-transactional by nature), files persist on disk with no DB record pointing to them — orphaned files accumulate
- P2034 errors without retry logic surface as 500s to users
- Increasing `timeout` is a band-aid that masks the real problem and degrades database performance globally

**Prevention:**
1. Batch before wrapping. Replace N+1 `billMotive.create()` and `billCategory.create()` loops with `createMany()` before introducing the transaction. This reduces 10-30 round-trips to 2.
2. Prepare data outside the transaction. Resolve UUIDs, build the `data` arrays for `createMany`, compute the motive display string — all outside `prisma.$transaction()`. Only the DB writes go inside.
3. Keep file operations outside. Filesystem moves are not transactional. Move files first, write DB records in the transaction, add compensating cleanup if the transaction fails.
4. Add retry logic for P2034. Wrap the transaction call in a small retry loop (3 attempts, exponential backoff) for write conflicts.

**Warning signs:**
- Bill creation succeeds in development (low concurrency) but fails intermittently in production
- Prisma logs showing `P2034: Transaction failed due to a write conflict or a deadlock`
- Timeout errors appearing only during peak hours

**Phase:** Transaction scope refactor — complete the `createMany` migration first, then wrap in transaction.

---

### Pitfall 2: Removing Legacy Columns Without Verifying All Read Paths

**What goes wrong:**
`legacyId` exists on 15+ models. `motiveLegacy` is actively written and read on every bill create/update. Dropping these columns via `prisma migrate dev` in a single step breaks any external system (Google Sheets sync, Telegram bot, PDF/Excel export) that reads the column directly via raw SQL or a named field, any code path that references the column and was missed in the grep audit, and Prisma migration history in production if the migration was applied in dev but not yet in staging (schema drift).

**Why it happens:**
Developers run a repo-wide grep for the column name, find no references in TypeScript, and conclude it is safe to drop. They miss raw SQL in `$queryRaw` calls, external scripts that SELECT *, and the Prisma schema still emitting the column in generated client types until regenerated.

**Consequences:**
- If `motiveLegacy` is dropped while the application still writes to it, every bill create/update throws a Prisma runtime error (P2009 or similar)
- Google Sheets sync exports break if the sync logic reads `motiveLegacy` as the display string
- Data cannot be recovered if the column is dropped and no backup was taken before migration

**Prevention:**
1. Audit all read paths, not just TypeScript imports. Search for the column name in raw SQL strings (`$queryRaw`, `$executeRaw`), Google Sheets export logic, any external scripts or cron jobs, and the Prisma schema itself.
2. Use the expand-and-contract pattern. For `motiveLegacy`: first make the code read from the `BillMotive` join instead, deploy, verify for one week, then drop the column. Never drop and migrate in the same PR as the code change.
3. Shadow the column before dropping. Add `@ignore` to the Prisma schema field first, regenerate the client, and run the full test suite. If nothing breaks, proceed to the migration that drops the column.
4. Take a point-in-time backup before applying the migration in production. Column drops are destructive and irreversible without a backup.

**Warning signs:**
- `motiveLegacy` still appears in Google Sheets export column headers
- Any bill route doing `bill.motiveLegacy` instead of a join on BillMotive
- The migration diff shows `DROP COLUMN` on a column with no prior code-level audit commit

**Phase:** Legacy column removal must be a dedicated phase after all consumers have been migrated. Do not combine with refactoring.

---

### Pitfall 3: Path Traversal Fix That Only Guards One Entry Point

**What goes wrong:**
The codebase audit identifies the primary traversal vector in `nextjs/app/api/uploads/[[...path]]/route.ts`. Fixing only that one file creates a false sense of security. The bug-reports screenshots route already has the guard pattern — which proves the pattern exists but has not been applied everywhere.

The correct guard pattern is:
```
const resolvedPath = path.resolve(UPLOADS_DIR, relPath);
if (!resolvedPath.startsWith(path.resolve(UPLOADS_DIR))) {
  return new Response('Forbidden', { status: 403 });
}
```

Common incomplete fixes include only checking for `..` in the raw path string (bypassed by URL encoding: `%2e%2e`, `%2f`), applying `path.normalize()` without then checking the resolved path against the allowed directory, and fixing the primary route but leaving any legacy fallback lookup paths unguarded.

**Why it happens:**
Developers fix the code path that was reported without auditing all file-serving routes in the codebase.

**Consequences:**
- An attacker reads `../../.env.local` via the legacy fallback lookup and obtains `DATABASE_URL`, `NEXTAUTH_SECRET`, `OCR_ENCRYPTION_SECRET`
- The partial DB lookup guard is bypass-resistant only if the legacy fallback is also guarded

**Prevention:**
1. Enumerate all file-serving routes before writing any fix. Search for `path.join`, `path.resolve`, `readFileSync`, `createReadStream`, `sendFile`, `statSync`, `existsSync` across all API routes.
2. Apply the `startsWith(resolve(UPLOADS_DIR))` guard to every file-serving route, not just the primary one.
3. Write a test that sends `../../../etc/passwd` as the path parameter and asserts a 403 response.
4. Do not rely on the DB lookup alone as the traversal guard. The legacy fallback proves DB filtering can be incomplete.

**Warning signs:**
- Any route that calls `path.join(SOME_DIR, userInput)` without a subsequent `startsWith` check
- File-serving routes added after the original audit

**Phase:** Security hardening — all file-serving guards must be applied and tested together in one phase.

---

### Pitfall 4: JWT Role Verification Fix That Stops at the Middleware Layer

**What goes wrong:**
The current architecture embeds `role` in the NextAuth JWT at sign-in time. The fix is to re-fetch the user's current role from the database for critical operations. A common incomplete implementation is to add the DB lookup only in the Next.js middleware (the `middleware.ts` auth guard) while leaving the route handler permission checks (`session.user.role === 'admin'`) unchanged.

Next.js middleware runs on the Edge Runtime. It receives a JWT from the cookie, decodes it, and can check claims. But the Edge Runtime cannot make direct Prisma/PostgreSQL connections. So developers either skip the DB check in middleware entirely without adding it to routes, or add an HTTP call back to their own API from middleware to verify the role, introducing a request loop.

The real fix must happen in the route handler itself for every mutation that is role-gated (bill status change, delete, admin operations). Middleware is a traffic filter, not an authorization layer.

**Why it happens:**
Middleware feels like "the auth layer" so developers put role checks there. The JWT callback in `auth.ts` is also a tempting location, but it only fires on token rotation — not on every request.

**Consequences:**
- A user demoted from admin retains admin-level access via the JWT until session expiration (default: hours to days)
- Authorization bypass is possible for the full session window after a role change
- If the fix is only in middleware, route handlers still trust `session.user.role` — the attack surface is unchanged

**Prevention:**
1. In route handlers (not middleware), add a DB lookup for operations that require elevated roles. For example: fetch the user from the DB by `session.user.id` and check `freshUser.role` before allowing the operation.
2. Apply this to every DELETE route, every status-change route, and every admin-only operation. Not just the ones that seem sensitive — all of them.
3. In the NextAuth `jwt()` callback, set `maxAge` to a short value (e.g., 15 minutes) so stale JWTs expire quickly even without the DB lookup.
4. Middleware is for coarse-grained routing (unauthenticated users to `/login`). Authorization of specific actions belongs in route handlers.

**Warning signs:**
- Any route handler that reads `session.user.role` to gate a destructive or administrative operation without a subsequent DB lookup
- `middleware.ts` containing role checks — this is not where the authoritative check lives

**Phase:** JWT/role hardening — audit all role-gated routes in one sweep, not ad hoc.

---

## Moderate Pitfalls

### Pitfall 5: Integration Tests That Contaminate Each Other via Shared Database State

**What goes wrong:**
The project uses a real PostgreSQL database for integration tests. Without test isolation, tests that create bills, users, or projects leak state into subsequent tests. A test that verifies "bill count is 1 after creation" passes in isolation but fails when run after another test that also created bills.

Common antipatterns:
- Relying on `afterEach` DELETE cleanup that misses cascade-deleted records or runs in the wrong order
- Running tests in parallel against a shared schema (Jest default `--maxWorkers` behavior)
- Using the production or development database instead of a dedicated test database
- Wrapping each test in a transaction and rolling back — this breaks for testing Prisma's own transaction behavior, which is the most critical path being tested (bill creation)

**Prevention:**
1. Use a dedicated test database (separate `DATABASE_URL` in `.env.test`, never remove or overwrite `.env.test` — this file has been deleted twice in this project's history and must be preserved).
2. Run Jest with `--runInBand` (serial) for database-backed integration tests to prevent parallel contamination.
3. Use `beforeEach` to seed and `afterEach` to truncate with `TRUNCATE ... RESTART IDENTITY CASCADE` — faster and more reliable than selective DELETEs.
4. Do not use rollback-per-test for transaction tests. If testing that the bill creation transaction actually commits, you cannot roll it back inside the test. Use TRUNCATE cleanup instead.

**Warning signs:**
- Tests pass individually but fail when the full suite runs
- Tests that assert exact counts (e.g., `toBe(1)`) without first truncating the relevant table
- Test suite taking more than 60 seconds, suggesting accumulated shared state

**Phase:** Testing infrastructure must be established before writing any test — get isolation right first.

---

### Pitfall 6: Pinning next-auth Without Auditing the Lockfile

**What goes wrong:**
The current `package.json` uses `^5.0.0-beta.30` for `next-auth`. The fix is to pin to `5.0.0-beta.30` exactly (no caret). Two failure modes remain after pinning:

1. The lockfile (`package-lock.json`) already has a newer beta resolved. If someone ran `npm install` before pinning, the lockfile may have `5.0.0-beta.35` or later. Changing `package.json` to pin `5.0.0-beta.30` without regenerating the lockfile results in `npm ci` still installing the newer version (lockfile wins over `package.json` in `npm ci`).

2. Peer dependency pressure from Next.js. If Next.js is updated during the milestone, its peer dependency on `next-auth` may force an upgrade. The exact pin prevents this silently, but `npm install` will warn — and developers may resolve the warning by changing the pin, undoing the work.

**Prevention:**
1. Pin `next-auth` to `5.0.0-beta.30` (no `^`) in `package.json`.
2. Delete `package-lock.json` and run `npm install` fresh to generate a lockfile that resolves exactly `5.0.0-beta.30`.
3. Verify: `npm list next-auth` should show exactly `5.0.0-beta.30`.
4. Do not update Next.js itself during this milestone unless a security patch requires it.
5. Document in `CLAUDE.md` that `next-auth` is intentionally pinned and must not be changed without a deliberate decision.

**Warning signs:**
- `npm list next-auth` shows a version different from what `package.json` specifies
- `package-lock.json` has a `next-auth` resolution block pointing to a version other than beta.30
- Any `npm audit fix --force` run that touches next-auth

**Phase:** Dependency cleanup — pin and verify before any other work that calls `npm install`.

---

### Pitfall 7: Replacing Synchronous fs Calls With Async Equivalents But Missing await or Swallowing Errors

**What goes wrong:**
The codebase uses `readFileSync`, `renameSync`, `unlinkSync`, `existsSync` throughout bill and upload handlers. The mechanical fix is to replace with `fs.promises` equivalents. This works correctly only if every call site also has proper `await` and error propagation. Two specific failure modes:

1. Missing `await` on a renamed async call. `const data = fs.promises.readFile(path)` without `await` returns a Promise — `data` is a Promise object, not a Buffer, and downstream code silently uses it incorrectly.
2. Broad catch blocks that swallow the error. If a file rename fails (disk full, permission error) and the catch block only logs or does nothing, the bill record is committed to the DB pointing to a file that was never moved. The bill appears created but has no accessible image.

**Prevention:**
1. Replace calls one file at a time, not with a bulk find-replace across the repo.
2. After each replacement, verify `await` is present at every call site.
3. Ensure error propagation: an async file operation failure inside a request handler should result in a 500 response, not silent continuation.
4. Use the `fs.promises` namespace directly (not the callback API with `promisify`) for clarity.

**Warning signs:**
- `fs.promises.readFile(...)` without `await` in the same expression
- Catch blocks containing only `console.error(err)` with no re-throw or error response

**Phase:** Async file I/O refactor — do this after transaction scope work is complete, since both touch the bill creation flow. Combining them in one PR risks interaction bugs.

---

### Pitfall 8: Fixing Multi-Tenant Isolation Only in Application Code With No Test Verification

**What goes wrong:**
Multi-tenant isolation is enforced by manually adding `projectId` filters to every Prisma query. When 45+ bugs are being triaged and queries are patched, a missing `where: { projectId }` silently exposes all tenants' data. There is no database-level enforcement (no PostgreSQL Row-Level Security) to catch this. The application layer is the only guard.

**Prevention:**
1. During bug triage, test cross-tenant access explicitly for every modified query. Assert that user A cannot see user B's bills, not just that the happy path returns the right bills.
2. Treat "missing projectId filter" as a bug category in code review, not a style issue.
3. Note: adding PostgreSQL RLS is the correct long-term fix but is out of scope for this milestone. Test coverage must compensate.

**Warning signs:**
- A query that uses `findMany` without a `projectId` in the `where` clause
- Any route that uses `req.params.id` to fetch a record without also verifying `record.projectId === session.user.projectId`

**Phase:** Bug triage — check every modified query for tenant filter before marking a bug fixed.

---

## Minor Pitfalls

### Pitfall 9: Moving @types Packages to devDependencies Breaks Docker Build

**What goes wrong:**
Moving `@types/archiver`, `@types/formidable`, etc. from `dependencies` to `devDependencies` is correct. However, the `Dockerfile` may run `npm ci --production` (or `npm install --omit=dev`) in the build stage. If TypeScript compilation happens after the production install, the types are missing and the build fails.

**Prevention:**
1. After moving `@types` packages, run `docker build` locally and verify the build succeeds.
2. Check the `Dockerfile` for `--production` or `--omit=dev` flags on the install step.
3. TypeScript compilation must happen before the production install step, or the build stage must include devDependencies.

**Warning signs:**
- Docker build failing with "Cannot find type definition" after the move
- `Dockerfile` using `npm ci --omit=dev` before `npm run build`

**Phase:** Dependency cleanup.

---

### Pitfall 10: Analytics Table Batch Cleanup Causing Lock Contention

**What goes wrong:**
Adding automated cleanup for `VisitLog` and `PageEvent` tables via a scheduled `DELETE WHERE createdAt < NOW() - INTERVAL '90 days'` on a large table causes a full table scan with a long-held lock. Under concurrent load, this blocks inserts into the same table.

**Prevention:**
1. Use `DELETE ... LIMIT 1000` in a loop (batch deletes) rather than a single large delete.
2. Add an index on `createdAt` before introducing any time-based delete query.
3. Run cleanup during off-peak hours if possible.

**Phase:** Infrastructure cleanup — low priority, address after critical security and reliability work.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Dependency pinning | Lockfile resolves newer next-auth than package.json pin | Delete lockfile, reinstall, verify with `npm list` |
| Async file I/O refactor | Missing `await` on renamed async calls | Replace one file at a time; code review diff carefully |
| `createMany` migration | Extracting shared module breaks import paths in both bill routes | Verify both routes import from new module; run build before committing |
| Transaction scope expansion | Long transaction timeout under load | Batch writes first, prepare data outside transaction, add P2034 retry |
| Legacy column removal | `motiveLegacy` still read by Google Sheets sync | Audit sync code before any migration; use expand-and-contract |
| Path traversal fix | Partial fix leaves legacy fallback path unguarded | Enumerate all file-serving routes; write a 403 test for traversal input |
| JWT role re-verification | Fix applied only in middleware, not route handlers | Apply DB lookup in every role-gated mutation handler |
| Integration test setup | Test database state contamination between tests | Establish TRUNCATE CASCADE teardown and --runInBand before writing any tests |
| Multi-tenant bug triage | Patch removes projectId filter inadvertently | Cross-tenant access assertion required for every modified query |
| Analytics cleanup | Full-table delete causing lock contention | Batch deletes with LIMIT; index on createdAt first |

---

## Sources

- Prisma Transactions Reference: https://www.prisma.io/docs/orm/prisma-client/queries/transactions — timeout defaults, deadlock guidance (HIGH confidence)
- Prisma Discussion 25922 — Transaction Deadlocks and Timeouts: https://github.com/prisma/prisma/discussions/25922 (HIGH confidence)
- Prisma Issue 14487 — Global Transaction Timeout: https://github.com/prisma/prisma/issues/14487 (HIGH confidence)
- Auth.js Role Based Access Control Guide: https://authjs.dev/guides/role-based-access-control (HIGH confidence)
- NextAuth JWT Token Refresh Discussion: https://github.com/nextauthjs/next-auth/discussions/4229 (MEDIUM confidence)
- Next.js Session Management: https://clerk.com/articles/nextjs-session-management-solving-nextauth-persistence-issues (MEDIUM confidence)
- Testing Next.js App Router API Routes: https://blog.arcjet.com/testing-next-js-app-router-api-routes/ (MEDIUM confidence)
- How to test App Router and RSC with Jest: https://github.com/vercel/next.js/discussions/49603 (MEDIUM confidence)
- Expand and Contract Pattern: https://nexisltd.com/blog/database-migration-strategies-zero-downtime (HIGH confidence)
- Zero-Downtime PostgreSQL Schema Changes: https://xata.io/blog/zero-downtime-schema-migrations-postgresql (HIGH confidence)
- Node.js Path Traversal Guide: https://www.stackhawk.com/blog/node-js-path-traversal-guide-examples-and-prevention/ (HIGH confidence)
- HackerOne 329837 — Bypass to defective path traversal fix: https://hackerone.com/reports/329837 (HIGH confidence)
- CVE-2025-27210 incomplete fix: https://zeropath.com/blog/cve-2025-27210-nodejs-path-traversal-windows (HIGH confidence)
- Renovate dependency pinning guide: https://docs.renovatebot.com/dependency-pinning/ (HIGH confidence)
- Multi-Tenancy with Prisma: https://zenstack.dev/blog/multi-tenant (MEDIUM confidence)
