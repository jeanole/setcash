# PROJ-5: NextAuth.js Authentication

## Status: Planned
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

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
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
