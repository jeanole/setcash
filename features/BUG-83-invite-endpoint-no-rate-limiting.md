# BUG-83: No Rate Limiting on Project Invite Endpoint — Email Spam Risk

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-10: Members, Projects & Settings

---

## Description

### Expected Behavior
The invite endpoint should be rate-limited to prevent admins from sending excessive invitation emails.

### Actual Behavior
`POST /api/projects/[id]/invite` sends an email and has no rate limiting. An admin could trigger many invitation emails in rapid succession. Previous tokens for the same email+project are deleted (preventing token accumulation) but emails are still sent.

## Environment

- **File:** `nextjs/app/api/projects/[id]/invite/route.ts`
- **Date:** 2026-03-14

## Fix

Apply a rate limiter (e.g., 20 invites per hour per project) using the existing `lib/ratelimit.ts` infrastructure.
