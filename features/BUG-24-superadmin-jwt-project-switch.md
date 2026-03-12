# BUG-24: Superadmin JWT Not Updating on Project Switch

## Status: Resolved
**Severity:** Critical
**Feature:** PROJ-10 (Members, Projects & Settings)
**Reported:** 2026-03-06
**Found in:** QA Round 2 (PROJ-10)

## Description

When a superadmin switches projects via `POST /api/projects/switch`, the API
updates the user's `defaultProjectId` in the database correctly, but the JWT
session is never updated. The session still shows `currentProjectId: null`,
`currentProjectRole: null`, and `currentProjectName: null`.

This means superadmins cannot access any project-scoped settings pages
(`/settings`, `/settings/members`, `/settings/positions`) because all those
pages require a non-null `currentProjectId` in the session.

## Steps to Reproduce

1. Sign in as a superadmin (e.g. `admin@example.com`)
2. `POST /api/projects/switch` with a valid `projectId`
3. API returns `{ currentProjectId, currentProjectRole, currentProjectName }` — OK
4. `GET /api/auth/session` → still shows `currentProjectId: null`
5. Navigate to `/settings` → sees "No Project Selected" or redirect

## Root Cause

In `nextjs/auth.ts` JWT callback:

- **On sign-in** (line 230–234): Superadmins have project fields forced to `null`:
  ```typescript
  if (token.role === 'superadmin') {
    token.currentProjectId = null;
    token.currentProjectRole = null;
    token.currentProjectName = null;
  }
  ```

- **On session refresh** (non-update path): The re-fetch block is guarded by
  `token.role !== 'superadmin'`, so superadmins are skipped entirely.

- **On `trigger === 'update'`**: The switch API calls `updateSession()` from the
  client, which should trigger this path. However, the JWT callback still applies
  the superadmin null-override at the end of the sign-in block (only on `user`
  present, so update trigger should work — needs verification).

The actual issue may be that `updateSession()` is not called from the client
after the switch API responds, or the update trigger path is not resetting the
superadmin null-override correctly.

## Impact

Superadmins cannot:
- View or edit General Settings for any project
- Access Members management for any project via project settings
- Access Positions management for any project via project settings

They must use the Super Admin panel (PROJ-17) for member management, but
General Settings (project title/subtitle) has no superadmin alternative.

## Fix

**Option A (Recommended): Allow superadmins to hold a project context in JWT**

Remove the forced null-reset on sign-in for superadmins. Instead, allow
superadmins to have a `currentProjectId` when they explicitly switch to a
project. The `isSuperAdmin` flag on the session is sufficient to grant
elevated access.

```typescript
// Remove or relax this block in auth.ts:
if (token.role === 'superadmin') {
  token.currentProjectId = null;   // <-- remove
  token.currentProjectRole = null; // <-- remove
  token.currentProjectName = null; // <-- remove
}
```

Then let superadmins go through the same project-context flow as regular users,
with their `isSuperAdmin` flag kept for privileged operations.

**Option B: Add superadmin-specific settings route**

Create a separate superadmin settings view that bypasses the `currentProjectId`
requirement by accepting a `projectId` query param. Higher complexity, diverges
from the regular settings UX.

**Option A is preferred** as it mirrors the Express behavior where superadmins
simply had full access to everything without special routing.

## Files Affected

- `nextjs/auth.ts` (lines 230–234, 275)
- `nextjs/app/(protected)/settings/members/page.tsx` (SSR guard logic)
- `nextjs/app/(protected)/settings/positions/page.tsx` (SSR guard logic)

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-07
**Fix Description:** Implemented Option A. Removed the forced `null` reset for superadmins on sign-in so they can hold a `currentProjectId` in the JWT. Fixed two secondary issues in `auth.ts`: (1) `trigger === 'update'` path now uses `session` data directly (validated by the switch API) rather than re-fetching from DB with the wrong ID; (2) `else if` re-fetch path changed from `token.id` to `userEmail` so Google OAuth users are looked up correctly. Superadmins can now switch projects via the ProjectSwitcher and access project-scoped settings pages.
