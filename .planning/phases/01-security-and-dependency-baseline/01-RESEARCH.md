# Phase 01: Security and Dependency Baseline - Research

**Researched:** 2026-04-02
**Domain:** Next.js 14 security hardening, path traversal prevention, JWT role validation, Origin header validation, npm dependency hygiene
**Confidence:** HIGH

## Summary

This phase addresses four security gaps and two dependency hygiene issues in the SetCash codebase. The work is well-scoped: path traversal guards need applying to 6+ file-serving routes, admin role checks need DB re-verification on critical writes, Origin header validation goes in the Edge middleware, and package.json needs version pinning and dependency cleanup.

The codebase already has a reference implementation for path traversal prevention in `bug-reports/screenshots/[filename]/route.ts` (resolve + startsWith). The JWT callback in `auth.ts` already re-fetches project roles on every request, but individual API routes trust `session.user.role` from the JWT without a secondary DB check -- the gap is that between JWT refresh and the API call, a demoted user's cached JWT still carries the old role.

**Primary recommendation:** Extract a shared `assertPathWithin()` helper in `lib/upload.ts`, add DB role re-fetch to critical admin routes, add Origin validation in `middleware.ts`, and clean up `package.json` in a single pass with a clean install.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-02:** All file-serving endpoints must be patched. Known endpoints: `/api/uploads/[[...path]]/route.ts`, `/api/bills/[id]/route.ts`, `/api/bills/[id]/images/[imageId]/route.ts`, `/api/bills/[id]/images/route.ts`, `/api/bills/bulk-delete/route.ts`, `/api/reports/user/[email]/pdf/route.ts`, `/api/bug-reports/route.ts`.
- **D-04:** When JWT role doesn't match DB role (user was demoted), force re-authentication -- invalidate the session and redirect to login so the user gets a fresh JWT. Do NOT just return 403.
- **D-05:** Origin validation lives in `middleware.ts` -- single check that covers all mutation routes automatically.
- **D-07:** Pin next-auth to exactly `5.0.0-beta.30` (no caret, no tilde).
- **D-08:** Move `@types/archiver`, `@types/cropperjs`, `@types/formidable`, `@types/pdfkit` from `dependencies` to `devDependencies`.
- **D-09:** Remove `better-sqlite3` and `@types/better-sqlite3` from `package.json`. Delete `scripts/migrate-sqlite-to-pg.ts` entirely.
- **D-10:** After all package.json changes, do a clean install: `rm -rf node_modules && npm install`.

### Claude's Discretion
- **D-01:** Path traversal: shared helper vs inline pattern
- **D-03:** Role re-fetch scope: critical writes only vs all admin routes
- **D-06:** Origin validation exemptions: which routes need cross-origin access

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-01 | All file-serving endpoints reject path traversal attempts | Reference pattern exists in `bug-reports/screenshots/[filename]/route.ts` lines 33-38; 6 additional routes identified needing the guard; `UPLOADS_DIR` constant available in `lib/upload.ts` |
| SEC-02 | Critical write operations re-fetch user role from database instead of trusting JWT | `auth.ts` JWT callback re-fetches on project switch but not per-request for role changes; `ProjectMember` table is the source of truth; identified 5 routes with admin role checks from JWT |
| SEC-03 | next-auth pinned to exact version 5.0.0-beta.30 | Currently `"^5.0.0-beta.30"` in package.json line 39; change to `"5.0.0-beta.30"` |
| SEC-04 | All mutation endpoints validate Origin header | Middleware.ts is the single enforcement point; 60 mutation handlers identified; analytics and auth callback routes need exemption |
| QUAL-04 | @types/* packages moved from dependencies to devDependencies | 4 packages identified in dependencies: `@types/archiver`, `@types/cropperjs`, `@types/formidable`, `@types/pdfkit` |
| QUAL-05 | better-sqlite3 removed; migration script archived | `better-sqlite3` in devDependencies, `@types/better-sqlite3` in devDependencies; `scripts/migrate-sqlite-to-pg.ts` to delete |
</phase_requirements>

## Standard Stack

No new libraries needed. This phase modifies existing code and configuration only.

### Core (Already Installed)
| Library | Version | Purpose | Relevant to Phase |
|---------|---------|---------|-------------------|
| next | 14.2.35 | Framework, middleware | Origin validation in Edge middleware |
| next-auth | 5.0.0-beta.30 | Auth | Version pinning, session invalidation |
| @prisma/client | ^5.22.0 | Database | Role re-fetch queries |
| zod | ^4.3.6 | Validation | N/A (already used in routes) |

### Packages to Remove
| Package | Current Location | Action |
|---------|-----------------|--------|
| `better-sqlite3` | devDependencies | Remove entirely |
| `@types/better-sqlite3` | devDependencies | Remove entirely |

### Packages to Move (dependencies -> devDependencies)
| Package | Current Location | Target |
|---------|-----------------|--------|
| `@types/archiver` | dependencies | devDependencies |
| `@types/cropperjs` | dependencies | devDependencies |
| `@types/formidable` | dependencies | devDependencies |
| `@types/pdfkit` | dependencies | devDependencies |

## Architecture Patterns

### Pattern 1: Path Traversal Guard (Shared Helper)
**What:** Extract a reusable `assertPathWithin(filePath: string, allowedDir: string)` function in `lib/upload.ts`.
**When to use:** Every route that constructs a filesystem path from user input.
**Recommendation:** Use a shared helper (D-01 discretion). The pattern is 3 lines but the consequence of missing it in any route is a security vulnerability. A shared function ensures consistency and makes auditing trivial.

```typescript
// In lib/upload.ts
export function assertPathWithin(filePath: string, allowedDir: string): void {
  const resolved = path.resolve(filePath);
  const allowed = path.resolve(allowedDir);
  if (resolved !== allowed && !resolved.startsWith(allowed + path.sep)) {
    throw new Error('Path traversal attempt blocked');
  }
}
```

**Critical detail:** The `startsWith` check must append `path.sep` to the directory, otherwise `/uploads-evil/secret` would pass a check against `/uploads`. The reference implementation in `bug-reports/screenshots` does NOT include this trailing separator -- it needs fixing too.

### Pattern 2: DB Role Re-fetch for Critical Writes
**What:** Before allowing admin actions, query `ProjectMember` for the user's current role and compare with JWT.
**When to use:** Bill status change, bill delete, bulk delete, and other admin-only mutations.

**Recommendation (D-03 discretion):** Apply to critical writes only -- bill status change (`PATCH /api/bills/[id]/status`), bill delete (`DELETE /api/bills/[id]`), bulk delete (`POST /api/bills/bulk-delete`), image operations that check admin role. This covers the highest-risk operations without adding DB queries to every admin route.

**Session invalidation (D-04 locked):** When the DB role is lower than the JWT role (demotion detected), the route must force re-authentication. In NextAuth v5 with JWT strategy, there is no server-side session store to invalidate. The approach:
1. Query `ProjectMember` for current role
2. If DB role !== JWT role and the action requires admin, return a response that forces client logout
3. Delete the JWT cookie directly in the API response using `cookies().delete()`

```typescript
// Pattern for role re-fetch in API routes
import { cookies } from 'next/headers';

async function verifyAdminRole(session: Session, projectId: string): Promise<boolean> {
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userEmail: {
        projectId,
        userEmail: session.user.email,
      },
    },
  });

  const dbRole = membership?.role;

  // Superadmin check from DB
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { isSuperAdmin: true },
  });
  if (dbUser?.isSuperAdmin) return true;

  if (!dbRole || (dbRole !== 'admin' && dbRole !== 'owner')) {
    // User was demoted -- force re-auth
    const cookieStore = await cookies();
    cookieStore.delete('authjs.session-token');
    cookieStore.delete('__Secure-authjs.session-token');
    return false;
  }

  return true;
}
```

**Important:** NextAuth v5 uses `authjs.session-token` (or `__Secure-authjs.session-token` in production with HTTPS). The cookie name depends on whether the app runs behind HTTPS.

### Pattern 3: Origin Header Validation in Middleware
**What:** Check the `Origin` header on all non-GET/HEAD/OPTIONS requests in Edge middleware.
**When to use:** All mutation endpoints (POST, PUT, PATCH, DELETE).

```typescript
// In middleware.ts, inside the auth callback before the public route check
const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
const isExemptPath =
  nextUrl.pathname.startsWith('/api/auth/') ||
  nextUrl.pathname === '/api/analytics/visit' ||
  nextUrl.pathname === '/api/analytics/event';

if (isMutation && !isExemptPath) {
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      const requestHost = (req.headers.get('host') || '').split(':')[0];
      if (originHost !== requestHost) {
        return NextResponse.json(
          { error: 'Cross-origin request rejected' },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid Origin header' },
        { status: 403 }
      );
    }
  }
}
```

**Exemption list (D-06 discretion):** Based on codebase audit:
- `/api/auth/` -- OAuth callbacks from Google, NextAuth internal routes
- `/api/analytics/visit` and `/api/analytics/event` -- already public, no auth required, may receive cross-origin pings
- No Telegram webhook endpoint found -- the bot uses polling mode (`initAllBots()` in `server.ts`), not webhooks. No exemption needed.

**Edge Runtime constraint:** Middleware runs on Edge, so no `node:` imports, no Prisma. Origin validation is purely header-based which is Edge-compatible.

### Anti-Patterns to Avoid
- **Regex-based path sanitization:** The `replace(/\.\./g, '')` pattern in `reports/user/[email]/pdf/route.ts` and `admin/export/images/route.ts` is insufficient. It strips `..` but does not verify the final resolved path stays within bounds. Use resolve + startsWith instead.
- **Trusting `session.user.role` for authorization:** The JWT is refreshed only on specific triggers (project switch, initial sign-in). Between refreshes, a demoted user retains their old role in the JWT.
- **Checking Origin without considering host:** The Origin header contains the scheme + host + port. Compare hostname only, not the full string, to handle port differences between dev and prod.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path traversal prevention | Custom regex filtering | `path.resolve()` + `startsWith()` | Regex misses edge cases (encoded slashes, null bytes, symlinks); resolve+startsWith is the Node.js standard pattern |
| Session invalidation | Custom token blacklist | Delete the JWT cookie directly | NextAuth v5 JWT strategy has no server-side session store; cookie deletion is the only mechanism |
| CSRF protection | Custom token system | Origin header validation + SameSite cookies | Out of scope per REQUIREMENTS.md; Origin validation is sufficient |

## Common Pitfalls

### Pitfall 1: Missing path.sep in startsWith Check
**What goes wrong:** `resolvedPath.startsWith(allowedDir)` passes for `/uploads-evil/secret` when checking against `/uploads`.
**Why it happens:** Forgetting that `startsWith` is a string operation, not a filesystem operation.
**How to avoid:** Always append `path.sep` to the directory: `resolvedPath.startsWith(allowedDir + path.sep)` or check `resolvedPath === allowedDir`.
**Warning signs:** Tests pass with paths inside the directory but no test for paths that are prefixes of the directory name.

### Pitfall 2: NextAuth v5 Cookie Names Are Environment-Dependent
**What goes wrong:** Deleting `authjs.session-token` in production does nothing because the cookie is actually named `__Secure-authjs.session-token` (HTTPS prefix).
**Why it happens:** NextAuth v5 automatically prefixes cookie names with `__Secure-` when running behind HTTPS.
**How to avoid:** Delete both cookie variants, or check `process.env.NEXTAUTH_URL` for the scheme.
**Warning signs:** Force-reauth works in local dev but not in production.

### Pitfall 3: Origin Header Missing on Same-Origin Requests
**What goes wrong:** Blocking requests with no `Origin` header breaks same-origin form submissions and fetch calls from the same domain (some browsers omit `Origin` on same-origin requests).
**Why it happens:** The `Origin` header is only reliably sent on cross-origin requests. Same-origin requests may or may not include it.
**How to avoid:** Only reject when `Origin` is present AND doesn't match. Allow requests with no `Origin` header through (they are same-origin by definition in modern browsers).
**Warning signs:** POST requests from the app itself start returning 403.

### Pitfall 4: Middleware Matcher Not Covering API Routes
**What goes wrong:** The current middleware matcher pattern excludes paths with file extensions but may not cover all API routes depending on how Next.js resolves them.
**Why it happens:** The regex is designed for auth redirect, not for Origin validation.
**How to avoid:** The current matcher already covers `/api/*` routes (they don't have extensions). Verify by testing that the middleware runs for mutation API calls. The existing matcher should work for Origin validation without changes.

### Pitfall 5: npm ci vs npm install After package.json Changes
**What goes wrong:** Using `npm ci` after manual package.json edits fails because the lockfile doesn't match.
**Why it happens:** `npm ci` requires perfect lockfile alignment; it does not update the lockfile.
**How to avoid:** Use `rm -rf node_modules && npm install` (as specified in D-10) to regenerate the lockfile, then commit both `package.json` and `package-lock.json`.

### Pitfall 6: Docker Build Break After Dependency Changes
**What goes wrong:** The Dockerfile uses `npm ci` in the build stage. If `package-lock.json` is not updated and committed, Docker builds fail.
**Why it happens:** `npm ci` is the correct command for Docker (deterministic), but it requires an up-to-date lockfile.
**How to avoid:** Always commit `package-lock.json` alongside `package.json` changes. Verify with `docker build .` after dependency changes.

## Code Examples

### Path Traversal Guard Helper
```typescript
// lib/upload.ts - new export
import path from 'path';

/**
 * Verify that a resolved file path stays within the allowed directory.
 * Throws an Error if the path escapes the allowed directory (path traversal).
 */
export function assertPathWithin(filePath: string, allowedDir: string): void {
  const resolved = path.resolve(filePath);
  const allowed = path.resolve(allowedDir);
  if (resolved !== allowed && !resolved.startsWith(allowed + path.sep)) {
    throw new Error('Path traversal attempt blocked');
  }
}
```

### Applying Guard to /api/uploads/[[...path]]/route.ts
```typescript
// After constructing filePath from user input:
const filePath = path.join(UPLOADS_DIR, relPath);
assertPathWithin(filePath, UPLOADS_DIR);
// ... continue with file serving
```

### Origin Validation in middleware.ts
```typescript
// Add inside auth callback, before the public route check
const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
const isExemptPath =
  nextUrl.pathname.startsWith('/api/auth/') ||
  nextUrl.pathname === '/api/analytics/visit' ||
  nextUrl.pathname === '/api/analytics/event';

if (isMutation && !isExemptPath) {
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const originHost = new URL(origin).hostname;
      const requestHost = (req.headers.get('host') || '').split(':')[0];
      if (originHost !== requestHost) {
        return NextResponse.json(
          { error: 'Cross-origin request rejected' },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid Origin header' },
        { status: 403 }
      );
    }
  }
}
```

### Force Re-auth Response Pattern
```typescript
// In API routes that detect role demotion:
import { cookies } from 'next/headers';

// After detecting DB role < JWT role:
const cookieStore = await cookies();
cookieStore.delete('authjs.session-token');
cookieStore.delete('__Secure-authjs.session-token');
return NextResponse.json(
  { error: 'Session expired - role changed', code: 'ROLE_CHANGED' },
  { status: 401 }
);
```

## Inventory of Routes Needing Changes

### File-Serving Routes (SEC-01: Path Traversal Guard)
| Route | Current Protection | Action |
|-------|-------------------|--------|
| `api/uploads/[[...path]]/route.ts` | None | Add `assertPathWithin(filePath, UPLOADS_DIR)` |
| `api/bills/[id]/route.ts` (DELETE) | None (uses `path.join(UPLOADS_DIR, img.filePath)`) | Add guard before `unlinkSync` |
| `api/bills/[id]/images/[imageId]/route.ts` (PUT) | None (uses `path.join(UPLOADS_DIR, image.filePath)`) | Add guard before `copyFileSync` |
| `api/bills/[id]/images/[imageId]/route.ts` (DELETE) | None | Add guard before `unlinkSync` |
| `api/bills/[id]/images/route.ts` (POST) | None (constructs path from email) | Add guard -- path derived from user email which could contain traversal |
| `api/bills/bulk-delete/route.ts` | None | Add guard before `unlinkSync` in loop |
| `api/reports/user/[email]/pdf/route.ts` | Weak: `replace(/\.\./g, '')` | Replace with `assertPathWithin` |
| `api/admin/export/images/route.ts` | Weak: `replace(/\.\./g, '')` | Replace with `assertPathWithin` |
| `api/bug-reports/route.ts` | Uses `crypto.randomUUID()` for filename | Low risk but add guard for consistency |
| `api/bug-reports/screenshots/[filename]/route.ts` | Has resolve+startsWith (reference) | Fix missing `path.sep` in startsWith check |

### Admin Role Check Routes (SEC-02: DB Role Re-fetch)
| Route | Current Check | Action |
|-------|--------------|--------|
| `api/bills/[id]/status/route.ts` (PATCH) | `session.user.role` from JWT | Add DB re-fetch, force re-auth on demotion |
| `api/bills/[id]/route.ts` (DELETE) | `session.user.role` from JWT | Add DB re-fetch for admin path |
| `api/bills/bulk-delete/route.ts` (POST) | `session.user.role` from JWT | Add DB re-fetch, force re-auth on demotion |
| `api/bills/[id]/route.ts` (PUT) | `session.user.role` from JWT | Add DB re-fetch for admin path |
| `api/bills/[id]/images/[imageId]/route.ts` (PUT, DELETE) | `session.user.role` from JWT | Add DB re-fetch for admin path |
| `api/bills/[id]/images/route.ts` (POST) | `session.user.role` from JWT | Add DB re-fetch for admin path |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7 with ts-jest 29.4.6 |
| Config file | `nextjs/jest.config.js` |
| Quick run command | `cd nextjs && npm test -- --testPathPattern="security" --forceExit` |
| Full suite command | `cd nextjs && npm test -- --forceExit` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-01 | Path traversal rejected with 400/403 | unit | `cd nextjs && npx jest __tests__/lib/upload.test.ts --forceExit` | Wave 0 |
| SEC-02 | Demoted user gets force-reauth on admin action | integration | `cd nextjs && npx jest __tests__/api/bills-status.test.ts --forceExit` | Wave 0 |
| SEC-03 | next-auth pinned to exact version | smoke | Inline node -e check | N/A |
| SEC-04 | Cross-origin POST rejected | integration | `cd nextjs && npx jest __tests__/api/origin-validation.test.ts --forceExit` | Wave 0 |
| QUAL-04 | No @types/* in production deps | smoke | Inline node -e check | N/A |
| QUAL-05 | better-sqlite3 absent from package.json | smoke | Inline node -e check | N/A |

### Sampling Rate
- **Per task commit:** Quick run against changed test files
- **Per wave merge:** Full test suite
- **Phase gate:** Full suite green + all smoke checks pass

### Wave 0 Gaps
- [ ] `__tests__/lib/upload.test.ts` -- unit tests for `assertPathWithin` helper
- [ ] `__tests__/api/bills-status.test.ts` -- integration test for role demotion detection (consider unit-testing the `verifyAdminRole` helper instead)
- [ ] `__tests__/api/origin-validation.test.ts` -- test that middleware rejects cross-origin mutations (requires middleware test setup)

## Open Questions

1. **JWT cookie name in production**
   - What we know: NextAuth v5 uses `authjs.session-token` in dev, `__Secure-authjs.session-token` in production (HTTPS)
   - What's unclear: Whether `trustHost: true` changes this behavior
   - Recommendation: Delete both cookie names unconditionally in the force-reauth handler

2. **Client-side handling of force-reauth**
   - What we know: API returns 401 with `code: 'ROLE_CHANGED'`
   - What's unclear: Whether all client-side fetch wrappers (`fetchWithError`) handle this correctly
   - Recommendation: The existing `fetchWithError` throws on non-OK responses; hooks catch errors and display them. A 401 should trigger a page reload or redirect to login. May need a global 401 handler in the client API layer -- but this is minimal scope.

3. **Middleware execution order with Origin check + auth check**
   - What we know: The middleware wraps NextAuth's `auth()` function. Origin validation should run before auth to reject bad requests early.
   - What's unclear: Whether returning `NextResponse.json()` from inside the `auth()` callback works correctly or needs to be before the `auth()` wrapper.
   - Recommendation: Place Origin check inside the existing `auth(function middleware(req) { ... })` callback, before the public route check. This is the simplest approach and keeps everything in one middleware function.

## Project Constraints (from CLAUDE.md)

- All application code lives in `nextjs/` subdirectory
- Use `@/` import paths, never relative `../` (except middleware.ts)
- All API routes wrap entire handler in try/catch
- Auth check first, project context second, membership third
- Return `{ error: 'message' }` for errors
- Integration tests use real database, not mocks
- Validate all inputs with Zod
- Import DB as `import { db as prisma } from '@/lib/db'`
- Commit format: `type(PROJ-X): description`
- Always read a file before modifying it
- Never commit secrets to git
- Security changes require explicit user approval

## Sources

### Primary (HIGH confidence)
- Codebase audit: All 10 file-serving routes read and analyzed
- Codebase audit: `nextjs/auth.ts` JWT callback analyzed for role refresh behavior
- Codebase audit: `nextjs/middleware.ts` structure analyzed for Origin validation placement
- Codebase audit: `nextjs/package.json` dependencies verified

### Secondary (MEDIUM confidence)
- NextAuth v5 JWT cookie naming convention (from training data, verified against `auth.config.ts` `trustHost` setting)
- `path.resolve` + `startsWith` as the standard Node.js path traversal prevention pattern

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, only modifying existing code
- Architecture: HIGH - reference pattern exists in codebase, clear implementation path
- Pitfalls: HIGH - pitfalls derived from actual code analysis (missing path.sep, regex-only sanitization, cookie naming)

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable domain, no fast-moving dependencies)
