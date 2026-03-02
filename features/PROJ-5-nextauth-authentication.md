# PROJ-5: NextAuth.js Authentication

## Status: In Progress
**Created:** 2026-03-01
**Last Updated:** 2026-03-02

## Dependencies
- Requires: PROJ-4 (Next.js scaffold + Prisma schema + PostgreSQL)

## User Stories
- As a user, I want to log in with my email and password so that I can access my project data.
- As a user, I want to log in with my Google account so that I don't have to manage a separate password.
- As an admin, I want my admin role to be recognised after login so that I see admin-only controls.
- As a superadmin, I want my superadmin role to be recognised so that I can manage all projects.
- As a user, I want to be redirected to the login page when my session expires so that I'm not stuck on a broken page.
- As a developer, I want protected routes to reject unauthenticated requests with 401/redirect so that security is enforced at the framework level.

## Acceptance Criteria
- [ ] NextAuth.js v5 (Auth.js) is installed and configured in `/nextjs/`
- [ ] `CredentialsProvider` supports email + bcrypt-hashed password login
- [ ] `GoogleProvider` supports Google OAuth 2.0 login (same credentials as existing Express app)
- [ ] Session strategy: **JWT** (stateless, no DB session table needed)
- [ ] JWT token includes: `id`, `email`, `name`, `role` (`user` | `admin` | `superadmin`),
      `currentProjectId`
- [ ] `middleware.ts` at `/nextjs/` root protects all routes under `/app/(protected)/`; unauthenticated
      requests are redirected to `/login`
- [ ] `/login` page renders email/password form + "Sign in with Google" button
- [ ] `/logout` action clears the session and redirects to `/login`
- [ ] Google OAuth callback URL is configurable via `NEXTAUTH_URL` env var
- [ ] Incorrect credentials return a user-facing error message ("Invalid email or password")
- [ ] Superadmin account is seeded from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars on first run
      (matches existing Express behaviour in `db.js` `initUsers()`)
- [ ] All auth env vars (`NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) documented
      in `.env.test.example`

## Edge Cases
- User exists in DB with Google account but tries to log in with credentials → show "Use Google login"
- User account is disabled or not yet approved → show "Account not active" message
- Google OAuth account email does not match any existing user → create new user with `user` role
- `NEXTAUTH_SECRET` missing → app fails fast with a clear startup error
- Session JWT expiry: default 30 days; refresh silently on activity

## Technical Requirements
- Library: NextAuth.js v5 / Auth.js
- Session: JWT (not database sessions)
- Password hashing: bcryptjs (same as Express app — passwords are portable)
- Branch: `to_nextjs`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Overview
PROJ-5 wires NextAuth.js v5 into the existing Next.js 14 scaffold. It replaces the current stub login page and open-access protected routes with a full credential + Google OAuth flow, mirroring the role and project logic already present in the Express app.

---

### Component Structure

```
Auth System
+-- NextAuth Config  (nextjs/auth.ts)
|   +-- CredentialsProvider  → email lookup + bcrypt compare
|   +-- GoogleProvider       → Google OAuth 2.0
|   +-- JWT callbacks        → embed id, email, role, currentProjectId in token
|
+-- API Route  (app/api/auth/[...nextauth]/route.ts)
|   └── Delegates all OAuth flows and token exchange to NextAuth
|
+-- Middleware  (nextjs/middleware.ts)
|   └── Edge middleware — intercepts every request
|       → Session present  → allow through
|       → Session missing  → redirect to /login
|       (only applies to routes under /(protected)/)
|
+-- Login Page  (app/(public)/login/page.tsx)
|   +-- LoginForm component
|   |   +-- Email field
|   |   +-- Password field
|   |   +-- Error message area  ("Invalid email or password")
|   |   +-- Sign In button
|   |   +-- Divider
|   |   +-- "Sign in with Google" button
|   └── (public) route group — never intercepted by middleware
|
+-- Protected Layout  (app/(protected)/layout.tsx)
|   +-- Server-side session guard  → redirects to /login if session absent
|   +-- SessionProvider wrapper   → makes session available to client components
|   +-- AppShell  (Sidebar + Header)
|
+-- Header  (components/layout/Header.tsx)  [updated]
|   +-- User initials avatar  (derived from email)
|   +-- User email display
|   +-- SignOutButton component
|
+-- Auth Components  (components/auth/)
|   +-- LoginForm.tsx      — form with error state, credential + Google sign-in
|   +-- SignOutButton.tsx  — calls NextAuth signOut(), redirects to /login
|
+-- Session Helper  (lib/auth/session.ts)
    +-- getCurrentUser()  — server-side wrapper around getServerSession()
        Returns: { id, email, role, currentProjectId } or null
```

---

### Data Model

No new database tables are needed.

**What is stored in the JWT cookie (encrypted, client-readable only by the server):**

| Field | Type | Description |
|---|---|---|
| `id` | UUID string | User's primary key from the `User` table |
| `email` | string | User's email address |
| `role` | `"user"` \| `"admin"` \| `"superadmin"` | Resolved at login — see Role Derivation below |
| `currentProjectId` | UUID string or null | The project the user is currently working in |

**Role Derivation (resolved once at login, stored in the JWT):**
1. If `User.isSuperAdmin = true` → role is `"superadmin"`
2. Else look up `ProjectMember` for the resolved `currentProjectId` → `ProjectMember.role` (`"admin"` or `"user"`)
3. If no active project or no membership → role is `"user"`

**Project Auto-Selection (mirrors Express `initUsers()` logic):**
1. Use `User.defaultProjectId` if the field is set
2. Otherwise, query all `ProjectMember` rows for the user — if there is exactly one, use that project
3. Otherwise `currentProjectId` is null (user must select a project later)

**Password Portability:**
Passwords are stored as bcrypt hashes in `User.passwordHash` using the same library (`bcryptjs`, 10 rounds) as the Express app. The same account works in both the Express app and the Next.js app without any migration.

---

### Tech Decisions

| Decision | Choice | Why |
|---|---|---|
| Auth library | NextAuth.js v5 (Auth.js) | Industry standard for Next.js App Router; handles OAuth state, CSRF, token rotation automatically |
| Session storage | JWT cookies | Stateless — no extra database table; matches the spec requirement; works on serverless edge |
| Password login | CredentialsProvider | Lets us call bcrypt.compare() against the existing `passwordHash` column |
| Google login | GoogleProvider | Reuses the same Google OAuth app and credentials already deployed for the Express app |
| Role embedding | Role stored in JWT | Avoids a database round-trip on every page load; role changes take effect at next login |
| Middleware placement | Edge middleware at root | Runs before any rendering; most efficient and reliable guard for protected routes |
| No DB session adapter | Omitted | JWT strategy doesn't need one; avoids an extra table and complexity |

---

### New Files

| File | Purpose |
|---|---|
| `nextjs/auth.ts` | NextAuth v5 configuration: providers, JWT callbacks, session shape |
| `nextjs/middleware.ts` | Edge middleware: protects all `/(protected)/` routes |
| `nextjs/app/api/auth/[...nextauth]/route.ts` | Mounts NextAuth HTTP handlers (GET + POST) |
| `nextjs/components/auth/LoginForm.tsx` | Login form with credential fields, error message, Google button |
| `nextjs/components/auth/SignOutButton.tsx` | Client component: calls `signOut()` and redirects to `/login` |
| `nextjs/lib/auth/session.ts` | `getCurrentUser()` helper for server components and API routes |

### Modified Files

| File | What changes |
|---|---|
| `nextjs/app/(public)/login/page.tsx` | Replace stub with real page using `LoginForm` |
| `nextjs/app/(protected)/layout.tsx` | Add server-side session check + `SessionProvider` wrapper |
| `nextjs/components/layout/Header.tsx` | Display user email, derived initials, and `SignOutButton` |
| `nextjs/app/layout.tsx` | Ensure `SessionProvider` is available to client tree |
| `nextjs/lib/env.ts` | Add `NEXTAUTH_SECRET` to the validated env var list |

---

### Dependencies

| Package | Purpose |
|---|---|
| `next-auth@beta` | NextAuth.js v5 — the `@beta` tag is required for Next.js 14 App Router support |

> `bcryptjs` is already installed from PROJ-4. No DB adapter needed (JWT strategy).

---

### Environment Variables

All auth env vars are already documented in `.env.test.example` at the repo root (added in PROJ-4 BUG-2 fix). The frontend developer must verify `nextjs/.env.test.example` is also updated.

| Variable | Description |
|---|---|
| `NEXTAUTH_SECRET` | Long random string — signs and encrypts JWT cookies |
| `NEXTAUTH_URL` | Public base URL of the app (`http://localhost:3001` for local Docker) |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 client ID (same as Express app) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth 2.0 client secret (same as Express app) |

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
