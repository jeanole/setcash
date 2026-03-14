# BUG-73: trustHost: true Disables Host Header Validation in NextAuth

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-5: NextAuth.js Authentication

---

## Description

### Expected Behavior
In production, host header validation should be active to prevent OAuth redirect manipulation via host header injection.

### Actual Behavior
`trustHost: true` is set in both `auth.ts` and `auth.config.ts`, completely disabling NextAuth's host header validation. Without a properly configured reverse proxy that enforces the `Host` header, this could allow redirect manipulation.

## Environment

- **Files:** `nextjs/auth.ts` line 133, `nextjs/auth.config.ts` line 11
- **Date:** 2026-03-14

## Root Cause

`trustHost: true` required for Docker deployments behind a proxy. Not inherently wrong but requires operator awareness.

## Fix

Document that this setting requires a correctly configured reverse proxy (nginx/Traefik) that strips and re-sets the `Host` header. Alternatively, use `NEXTAUTH_URL` and remove `trustHost` if not behind a proxy.
