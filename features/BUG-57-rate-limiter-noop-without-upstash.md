# BUG-57: Rate Limiter Is a Silent No-Op When Upstash Redis Is Not Configured

**Status:** Resolved
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-19: OCR / AI Bill Analysis (Next.js)

---

## Description

### Expected Behavior
If rate limiting cannot be enforced, the application should fail closed or clearly alert operators that rate limiting is disabled.

### Actual Behavior
When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are not set, `MockRatelimit` always returns `{ success: true }`, silently disabling all rate limiting across the entire application (bill creation, OCR analysis, signup, forgot password, password change).

## Environment

- **File:** `nextjs/lib/ratelimit.ts` lines 42-72
- **Date:** 2026-03-14

## Root Cause

`MockRatelimit` is a permissive stub with no actual enforcement, used as a fallback when Redis is unavailable.

## Fix

Options (in order of preference):
1. Implement an in-memory rate limiter (e.g., using `lru-cache` with sliding window) as the fallback
2. Throw a startup error if Upstash credentials are missing in production
3. At minimum, log a `console.warn` on every rate-limit check when using the mock, not just at startup
