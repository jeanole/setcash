# BUG-72: Credentials Login Uses Case-Sensitive Email Match

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-5: NextAuth.js Authentication

---

## Description

### Expected Behavior
Email login should be case-insensitive. A user registered as `User@Example.com` should be able to log in as `user@example.com`.

### Actual Behavior
`prisma.user.findUnique({ where: { email } })` performs a case-sensitive lookup in PostgreSQL. Admin user creation normalizes to lowercase, but a user who registered via Google OAuth with mixed-case email and then tries credentials login with a different casing will be denied.

## Environment

- **File:** `nextjs/auth.ts` line 160
- **Date:** 2026-03-14

## Root Cause

`findUnique` uses exact match. All admin API routes correctly use `mode: 'insensitive'` but the credentials login path does not.

## Fix

Normalize email to lowercase before the lookup:
```ts
const user = await prisma.user.findFirst({
  where: { email: { equals: credentials.email.toLowerCase(), mode: 'insensitive' } }
});
```
