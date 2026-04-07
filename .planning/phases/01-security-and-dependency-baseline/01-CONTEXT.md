# Phase 1: Security and Dependency Baseline - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate path traversal vulnerabilities, stale JWT role checks, and dirty dependencies before any structural refactoring begins. Add Origin header validation on mutations. No new features, no refactoring of business logic — security and hygiene only.

</domain>

<decisions>
## Implementation Decisions

### Path Traversal Guard
- **D-01:** Claude's discretion on whether to extract a shared helper (e.g., `assertPathWithin()` in `lib/upload.ts`) vs inline the 3-line resolve+startsWith pattern in each route. The existing guard in `bug-reports/screenshots/[filename]/route.ts` (lines 33-38) is the reference pattern.
- **D-02:** All file-serving endpoints must be patched. Known endpoints: `/api/uploads/[[...path]]/route.ts`, `/api/bills/[id]/route.ts`, `/api/bills/[id]/images/[imageId]/route.ts`, `/api/bills/[id]/images/route.ts`, `/api/bills/bulk-delete/route.ts`, `/api/reports/user/[email]/pdf/route.ts`, `/api/bug-reports/route.ts`.

### Role Re-fetch
- **D-03:** Claude's discretion on which routes get DB role re-fetch — at minimum critical writes (bill status change, bill delete, admin actions), potentially all admin-gated routes based on risk/effort tradeoff.
- **D-04:** When JWT role doesn't match DB role (user was demoted), force re-authentication — invalidate the session and redirect to login so the user gets a fresh JWT. Do NOT just return 403.

### Origin Validation
- **D-05:** Origin validation lives in `middleware.ts` — single check that covers all mutation routes automatically.
- **D-06:** Claude's discretion on which routes to exempt from Origin validation. Audit routes for external callers (e.g., Telegram webhook at `/api/telegram/webhook` likely needs exemption). Exempt only what's necessary.

### Dependency Cleanup
- **D-07:** Pin next-auth to exactly `5.0.0-beta.30` (no caret, no tilde).
- **D-08:** Move `@types/archiver`, `@types/cropperjs`, `@types/formidable`, `@types/pdfkit` from `dependencies` to `devDependencies`.
- **D-09:** Remove `better-sqlite3` and `@types/better-sqlite3` from `package.json`. Delete `scripts/migrate-sqlite-to-pg.ts` entirely (git history preserves it).
- **D-10:** After all package.json changes, do a clean install: `rm -rf node_modules && npm install` to regenerate an accurate lockfile.

### Claude's Discretion
- Path traversal: shared helper vs inline pattern (D-01)
- Role re-fetch scope: critical writes only vs all admin routes (D-03)
- Origin validation exemptions: which routes need cross-origin access (D-06)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security
- `nextjs/app/api/bug-reports/screenshots/[filename]/route.ts` lines 33-38 — Reference implementation of path traversal guard (resolve + startsWith pattern)
- `nextjs/app/api/uploads/[[...path]]/route.ts` — Primary path traversal vulnerability (user-supplied path segments joined without verification)
- `nextjs/middleware.ts` — Edge middleware where Origin validation will be added

### Auth
- `nextjs/auth.ts` — Full NextAuth config with Prisma adapter
- `nextjs/auth.config.ts` — Edge-compatible auth config (no DB access)

### Dependencies
- `nextjs/package.json` — Source of truth for dependency versions and categorization

### Research
- `.planning/research/PITFALLS.md` — Transaction timeout risks, JWT re-verification gotchas
- `.planning/research/FEATURES.md` — Table stakes feature list with priority ordering
- `.planning/codebase/CONCERNS.md` — Full security concerns audit with file paths and line numbers

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Path traversal guard pattern already implemented in `bug-reports/screenshots/[filename]/route.ts` — can be copied or extracted
- `UPLOADS_DIR` constant already exported from `lib/upload.ts` — natural home for a shared guard helper
- `auth()` function from `@/auth` already used in all routes — role re-fetch would be a thin wrapper or inline addition

### Established Patterns
- All API routes use `const session = await auth()` as first line for auth checking
- Role checks use `session.user.role` and compare against string literals ('admin', 'superadmin')
- Middleware uses Edge-compatible `auth.config.ts` (no Prisma access in middleware)
- File paths are constructed with `path.join(UPLOADS_DIR, ...)` across all file-serving routes

### Integration Points
- Origin validation in middleware.ts — must not interfere with existing auth redirect logic
- Role re-fetch requires Prisma query in API routes (not middleware, which runs on Edge)
- Package.json changes affect Docker build — verify `npm ci` works in Dockerfile after changes

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for all implementation details. User deferred most technical decisions to Claude's discretion, with two firm decisions: force re-auth on role mismatch (not 403), and clean install after package.json changes.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-security-and-dependency-baseline*
*Context gathered: 2026-04-02*
