# BUG-50: No Rate Limiting on Telegram Link Code Generation

**Status:** Open
**Reported:** 2026-03-14
**Severity:** High
**Skill Tag:** [Backend]
**Feature:** PROJ-12: Integrations (Google Sheets + Telegram)

---

## Description

### Expected Behavior
The `GET /api/telegram/link-code` endpoint should be rate-limited as explicitly required by the PROJ-12 spec (Security Requirements section).

### Actual Behavior
The endpoint has no rate limiting. An authenticated user can call it in a tight loop, flooding the `TelegramLinkCode` table with thousands of valid codes.

## Steps to Reproduce

1. Authenticate as any user
2. Loop `GET /api/telegram/link-code` rapidly — each call succeeds and creates a DB record

## Environment

- **File:** `nextjs/app/api/telegram/link-code/route.ts`
- **Date:** 2026-03-14

## Root Cause

No `ratelimit()` call applied to this endpoint, despite `lib/ratelimit.ts` having the infrastructure and the spec explicitly requiring it.

## Fix

Apply a rate limiter (e.g., 5 requests per 10 minutes per user) following the pattern used in `api/auth/signup/route.ts`.
