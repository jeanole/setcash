# BUG-13: Project Switching Does Not Update Session

**Status:** Resolved
**Reported:** 2026-03-05
**Severity:** Critical
**Skill Tag:** Backend
**Feature:** PROJ-10: Members, Projects & Settings

---

## Description

### Expected Behavior
When a user switches to a different project via the Projects tab in Settings:
1. The project switch API should update the user's session with the new project context
2. The sidebar and header should immediately reflect the new current project
3. All project-scoped data (bills, budget, etc.) should display the new project's data

### Actual Behavior
1. User clicks "Switch" button on a project
2. API call to `/api/projects/switch` succeeds and updates `defaultProjectId` in database
3. **Session is NOT updated** - `currentProjectId`, `currentProjectRole`, and `currentProjectName` remain at old values
4. UI continues to show old project data
5. User must log out and log back in to see the new project context

## Root Cause

In NextAuth v5 with JWT strategy, the `jwt` callback only runs during initial sign-in and session refresh. The current implementation sets `currentProjectId` from `defaultProjectId` only when `user` is present (initial sign-in):

```typescript
async jwt({ token, user }) {
  if (user) {
    // Only runs on initial sign-in!
    token.currentProjectId = u.defaultProjectId;
    // ...
  }
  return token;
}
```

When the user switches projects, the database is updated but the JWT token still contains the old project ID. The session never gets the updated project context.

## Steps to Reproduce

1. Log in to the Next.js app
2. Go to Settings → Projects tab
3. Click "Switch" on a different project
4. Observe: Page reloads but still shows old project name in header/sidebar
5. Navigate to Bills - still shows old project's bills

## Environment

- **App:** vBudget Next.js migration
- **Branch:** to_nextjs
- **Auth:** NextAuth.js v5 with JWT strategy
- **Database:** PostgreSQL with Prisma
- **Date/Time:** 2026-03-05

## Additional Context

### Comparison with Express Implementation
The old Express app stored session server-side and updated it directly:
```javascript
// Express - works because session is server-side
req.session.user.currentProjectId = projectId;
req.session.user.currentProjectRole = membership.project_role;
```

### Required Fix
The JWT callback needs to re-fetch the user's `defaultProjectId` from the database on every request to keep the session in sync:

```typescript
async jwt({ token, user, trigger, session }) {
  if (user) {
    // Initial sign-in logic...
  }
  
  // Re-fetch current project from DB on every token refresh
  // This ensures project switch is reflected in session
  const dbUser = await prisma.user.findUnique({
    where: { id: token.id },
    select: { defaultProjectId: true }
  });
  
  if (dbUser?.defaultProjectId) {
    // Update token with current project from DB
    token.currentProjectId = dbUser.defaultProjectId;
    // Also need to fetch membership to get role and project name
  }
  
  return token;
}
```

### Alternative Approaches Considered

1. **Client-side session refresh after switch** - Call `useSession().update()` after switch API succeeds
   - Pro: Simple to implement
   - Con: Race condition between DB update and session refresh

2. **Database-only approach** - Don't store current project in JWT, fetch from DB on every request
   - Pro: Always accurate
   - Con: Extra DB query on every auth check, more refactoring needed

3. **Trigger-based JWT update** - Use `trigger: 'update'` mechanism (recommended)
   - Pro: Explicit control over when session updates
   - Con: Requires client to trigger update after switch

The recommended fix combines approaches 2 and 3: re-fetch from DB in JWT callback + trigger session update from client after switch.

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-05
**Fixed In:** `auth.ts` JWT callback refactoring
**Fix Description:** 

### Changes Made

1. **Added `getCurrentProjectDetails()` helper function** (`auth.ts`):
   - Fetches user's membership and project details from database
   - Returns current project ID, role, and name

2. **Updated JWT callback** (`auth.ts`):
   - Added `email` to JWT token for DB lookups
   - Re-fetches `defaultProjectId` from database on every request
   - When project changes or `trigger === 'update'`, refreshes project context
   - Updates `currentProjectId`, `currentProjectRole`, `currentProjectName`, and `role`

3. **Updated session callback** (`auth.ts`):
   - Added `email` to session user object

4. **Updated client-side hook** (`useProjects.ts`):
   - Added `useSession().update()` call after successful project switch
   - Triggers JWT refresh to get updated project context

### Technical Details

The fix ensures the JWT token is always in sync with the database by:
- Checking `defaultProjectId` from DB on every JWT refresh
- Comparing with current token value to detect changes
- Re-fetching membership details when project changes
- Client explicitly triggering session update via `updateSession()` after switch API succeeds

This approach balances performance (no unnecessary DB queries when project hasn't changed) with correctness (session always reflects current project after switch).
