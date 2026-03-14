# BUG-45: JWT Session Update Trusts Client-Supplied Role — Privilege Escalation

**Status:** Open
**Reported:** 2026-03-14
**Severity:** High
**Skill Tag:** [Backend]
**Feature:** PROJ-5: NextAuth.js Authentication

---

## Description

### Expected Behavior
Calling `updateSession()` from the browser should never allow a user to change their own project role. Role changes must be re-validated against the database before being written to the JWT.

### Actual Behavior
The JWT callback's `trigger === 'update'` branch in `auth.ts:270-283` blindly trusts `session.currentProjectRole` from the client. Any authenticated user can open browser DevTools and call `updateSession({ currentProjectRole: 'admin', currentProjectId: '<their-project-id>' })`, causing the JWT callback to write `token.currentProjectRole = 'admin'` without any database verification.

## Steps to Reproduce

1. Log in as a regular user (role: `user`) in any project
2. Open browser DevTools console
3. Run: `await fetch('/api/auth/session', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ data: { currentProjectRole: 'admin' } }) })`
4. Observe: subsequent API calls that check `session.user.currentProjectRole === 'admin'` now succeed

## Environment

- **File:** `nextjs/auth.ts` lines 270-283
- **Date:** 2026-03-14

## Root Cause

The JWT callback at `auth.ts:274-278` sets `token.currentProjectRole = session.currentProjectRole` without re-fetching from the `projectMember` table. The comment claims this is "validated server-side by POST /api/projects/switch" but nothing enforces that the switch endpoint was actually called first.

## Fix

In the `trigger === 'update'` branch, re-fetch the user's actual role from `prisma.projectMember` using `token.currentProjectId` and `token.email` before writing to the JWT. Reject the update if membership is not found.
