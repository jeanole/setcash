# BUG-56: No Rate Limiting on Password Change Endpoint

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-20: User Profile Edit Panel

---

## Description

### Expected Behavior
The password change endpoint should be rate-limited to prevent brute-force attacks against `currentPassword`.

### Actual Behavior
`PATCH /api/users/me/password` has no rate limiting. An attacker with a stolen session can rapidly submit different `currentPassword` values and use the 401 vs 200 response as an oracle to brute-force the current password.

## Environment

- **File:** `nextjs/app/api/users/me/password/route.ts`
- **Date:** 2026-03-14

## Root Cause

Rate limiting was applied to login and signup but not to the password change endpoint.

## Fix

Apply a rate limiter (e.g., 5 attempts per 15 minutes per user) using the existing `lib/ratelimit.ts` infrastructure.
