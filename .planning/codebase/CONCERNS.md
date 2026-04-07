# Codebase Concerns

**Analysis Date:** 2026-04-01

## Tech Debt

**Duplicated `saveAllocations` function:**
- Issue: The `saveAllocations` helper is copy-pasted identically in two files with sequential `await prisma.billMotive.create()` calls inside loops (N+1 writes).
- Files: `nextjs/app/api/bills/route.ts` (lines 71-160), `nextjs/app/api/bills/[id]/route.ts` (lines 34-123)
- Impact: Maintenance burden (changes must be made in two places), and sequential DB writes instead of bulk inserts slow down bill creation/updates.
- Fix approach: Extract to a shared module in `nextjs/lib/bills.ts`. Replace the `for` loop of `create()` calls with `createMany()` for motive and category allocations.

**Duplicated `syncLegacyImageColumns` and `getMotiveDisplayString` helpers:**
- Issue: Same functions duplicated across the two bill route files.
- Files: `nextjs/app/api/bills/route.ts` (lines 49-68, 520-531), `nextjs/app/api/bills/[id]/route.ts` (lines 126-159)
- Impact: Same as above -- divergence risk.
- Fix approach: Extract to `nextjs/lib/bills.ts`.

**Legacy columns still in active use:**
- Issue: `motiveLegacy` on `Bill` model and `legacyId` on nearly every model are remnants of a SQLite migration. `motiveLegacy` is actively written/read on every bill create/update. `legacyId` columns exist on 15+ models.
- Files: `nextjs/prisma/schema.prisma` (lines 143, 42, 67, 92, etc.)
- Impact: Schema bloat; `motiveLegacy` is a denormalized string that must be kept in sync with the `BillMotive` relation, adding fragile logic to every bill write.
- Fix approach: After confirming no external system reads `legacyId`, drop those columns via migration. Replace `motiveLegacy` reads with joins on `BillMotive`.

**`@types` packages in `dependencies` instead of `devDependencies`:**
- Issue: `@types/archiver`, `@types/cropperjs`, `@types/formidable`, `@types/pdfkit` are listed in `dependencies` rather than `devDependencies`.
- Files: `nextjs/package.json` (lines 24-27)
- Impact: Slightly larger production Docker images (types are bundled unnecessarily).
- Fix approach: Move to `devDependencies`.

**`better-sqlite3` still in devDependencies:**
- Issue: SQLite driver and its types remain in `devDependencies` even though the app has fully migrated to PostgreSQL. Only referenced by the one-time migration script.
- Files: `nextjs/package.json` (lines 52, 59), `nextjs/scripts/migrate-sqlite-to-pg.ts`
- Impact: Unnecessary native module compilation, increases `npm install` time and image size.
- Fix approach: Remove `better-sqlite3` and `@types/better-sqlite3` from `package.json`. Archive the migration script.

**`next-auth` on beta channel:**
- Issue: Using `next-auth@^5.0.0-beta.30` -- a pre-release version.
- Files: `nextjs/package.json` (line 39)
- Impact: Beta APIs may change between patches; no semver stability guarantee. Upgrading could introduce breaking changes unexpectedly.
- Fix approach: Pin to exact version (`5.0.0-beta.30`) to prevent accidental upgrades, and plan migration to the stable v5 release when available.

## Security Considerations

**Path traversal in file upload serving:**
- Risk: The uploads endpoint at `nextjs/app/api/uploads/[[...path]]/route.ts` (line 30-68) joins user-supplied path segments directly into a filesystem path via `path.join(UPLOADS_DIR, relPath)` without verifying the resolved path stays within `UPLOADS_DIR`. A crafted request like `/api/uploads/../../../etc/passwd` could escape the uploads directory.
- Files: `nextjs/app/api/uploads/[[...path]]/route.ts` (line 68)
- Current mitigation: The route does a DB lookup for the `relPath` in `BillImage`, which would fail for traversal paths. However, the fallback legacy lookup (`prisma.bill.findFirst({ where: { filename: relPath } })`) is looser.
- Recommendations: Add explicit path traversal guard (as done in `nextjs/app/api/bug-reports/screenshots/[filename]/route.ts` lines 33-38): resolve the final path and confirm it starts with the allowed directory.

**Synchronous file I/O in request handlers:**
- Risk: All file reads/writes use synchronous Node.js `fs` methods (`readFileSync`, `renameSync`, `unlinkSync`, `existsSync`), which block the event loop.
- Files: `nextjs/app/api/uploads/[[...path]]/route.ts` (line 74), `nextjs/app/api/bills/route.ts` (line 468), `nextjs/app/api/bills/[id]/route.ts` (line 487), `nextjs/app/api/bills/[id]/images/route.ts` (line 119), `nextjs/lib/upload.ts` (line 97)
- Current mitigation: None.
- Recommendations: Replace with async equivalents (`fs.promises.readFile`, `fs.promises.rename`, etc.) to avoid blocking under concurrent load.

**OCR encryption fallback to hardcoded default:**
- Risk: In non-production environments, if neither `OCR_ENCRYPTION_SECRET` nor `SESSION_SECRET` is set, the encryption key falls back to the hardcoded string `'change-this-in-production'`.
- Files: `nextjs/lib/ocr.ts` (lines 18-40)
- Current mitigation: Production mode refuses to start with weak/missing secrets (lines 28-36). Dev mode only logs a warning.
- Recommendations: Acceptable for development, but ensure staging environments also enforce strong secrets.

## Performance Bottlenecks

**Sequential DB writes in allocation saving:**
- Problem: Creating bill motive/category allocations uses a `for` loop with individual `await prisma.billMotive.create()` calls -- one DB round-trip per allocation.
- Files: `nextjs/app/api/bills/route.ts` (lines 92-112), `nextjs/app/api/bills/[id]/route.ts` (lines 55-86)
- Cause: Not using `createMany()` for batch inserts.
- Improvement path: Use `prisma.billMotive.createMany({ data: [...] })` and `prisma.billCategory.createMany({ data: [...] })`.

**File reads loaded entirely into memory:**
- Problem: The uploads serving endpoint reads entire files into memory with `fs.readFileSync()` before sending as response.
- Files: `nextjs/app/api/uploads/[[...path]]/route.ts` (line 74)
- Cause: No streaming.
- Improvement path: Use `fs.createReadStream()` and pipe to response, or use Next.js `ReadableStream` constructor to stream file content.

**Analytics tables without retention policy:**
- Problem: `VisitLog` and `PageEvent` tables grow unboundedly. Only a manual superadmin prune endpoint exists.
- Files: `nextjs/prisma/schema.prisma` (lines 403-436), `nextjs/app/api/admin/analytics/prune/route.ts`
- Cause: No automated cleanup job or TTL-based retention.
- Improvement path: Add a scheduled job (cron or DB-level) to prune records older than N days.

## Fragile Areas

**Bill creation outside transaction scope:**
- Files: `nextjs/app/api/bills/route.ts` (lines 429-507)
- Why fragile: The bill record is created inside a Serializable transaction (good), but file uploads, image records, allocation saving, motive display update, and edit log creation all happen *outside* the transaction. If any of these steps fail, the bill exists in the DB but is incomplete (missing images, allocations, or logs).
- Safe modification: Wrap the post-creation steps (image records, allocations, edit log) inside the same transaction. File moves are inherently non-transactional but could have compensating cleanup.
- Test coverage: No test covers the bill creation flow.

**Role checking uses session-embedded role:**
- Files: `nextjs/app/api/bills/[id]/route.ts` (lines 296-299), most API routes
- Why fragile: Permission checks rely on `session.user.role` which is set at JWT creation time. If a user's role changes (e.g., demoted from admin), the old JWT still grants elevated access until it expires/rotates.
- Safe modification: For critical operations (delete, status change), re-fetch the user's current role from the database.
- Test coverage: No tests for authorization edge cases.

**Expired token cleanup is ad-hoc:**
- Files: `nextjs/app/api/auth/verify-email/route.ts` (line 38), `nextjs/app/api/auth/reset-password/route.ts` (line 35)
- Why fragile: Expired `PasswordResetToken`, `EmailVerificationToken`, and `TelegramLinkCode` records are only cleaned up when individually accessed. Stale records accumulate.
- Safe modification: Add a periodic cleanup job or DB-level TTL index.

## Scaling Limits

**Local filesystem for uploads:**
- Current capacity: Limited by server disk space.
- Limit: Cannot scale horizontally (multiple server instances cannot share a local filesystem).
- Scaling path: Migrate to object storage (S3, GCS, or similar) with signed URLs.

**In-process Telegram bot:**
- Current capacity: Single server instance runs the Telegram bot via `node-telegram-bot-api`.
- Limit: Running multiple instances would create duplicate bot listeners.
- Scaling path: Extract bot to a separate worker process or use webhook mode instead of polling.

## Test Coverage Gaps

**Minimal test suite:**
- What's not tested: 87 API routes exist, but only 3 have tests (categories, health, motives). Bill CRUD, authentication flows, authorization checks, file uploads, budget matrix, vgeld transfers, project management, and all admin routes are untested.
- Files: `nextjs/__tests__/` (280 total lines across 6 files including helpers)
- Risk: Regressions in core business logic (bill creation, status transitions, allocation calculations) would go unnoticed.
- Priority: **Critical** -- bill creation/update, authorization checks, and allocation math should be tested first.

**No E2E tests:**
- What's not tested: Full user flows (login, create bill, approve bill, export).
- Files: No Playwright/Cypress config detected.
- Risk: Integration issues between frontend and API go undetected.
- Priority: Medium -- add after unit/integration test coverage improves.

## Dependencies at Risk

**`next-auth@5.0.0-beta.30`:**
- Risk: Pre-release dependency for a security-critical component (authentication). Beta API surface may change.
- Impact: Auth could break on minor version bumps. Security patches may lag behind stable releases.
- Migration plan: Pin exact version immediately. Monitor for stable v5 release and upgrade.

**`formidable@3.5.4`:**
- Risk: Used for multipart parsing but Next.js App Router does not natively support Node.js `IncomingMessage`. The upload utility creates a mock `Readable` stream to work around this (`nextjs/lib/upload.ts` lines 41-47), which is fragile.
- Impact: Breaks if formidable changes its internal stream handling.
- Migration plan: Consider switching to Next.js built-in `request.formData()` API or a library designed for Web API `Request` objects.

## Missing Critical Features

**No automated database backups:**
- Problem: No backup strategy is documented or automated.
- Blocks: Disaster recovery.

**No CSRF protection:**
- Problem: API routes rely solely on session cookies for auth. No CSRF tokens are generated or validated on state-changing requests.
- Files: All POST/PUT/DELETE routes in `nextjs/app/api/`
- Current mitigation: `SameSite` cookie attribute (set by NextAuth) provides partial protection. The `X-Frame-Options: DENY` header prevents clickjacking.
- Recommendation: For cookie-based auth, consider adding a CSRF token or verifying the `Origin` header on mutations.

---

*Concerns audit: 2026-04-01*
