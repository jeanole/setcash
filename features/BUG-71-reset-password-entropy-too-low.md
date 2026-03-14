# BUG-71: Admin-Generated Reset Password Is 8 Characters, Not 12 as Specified

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-5: NextAuth.js Authentication

---

## Description

### Expected Behavior
Admin-generated reset passwords must be 12+ characters per spec.

### Actual Behavior
`randomBytes(6).toString('base64').slice(0, 12)` — 6 bytes produces only 8 base64 characters before the slice, so `slice(0, 12)` still yields 8 characters. The result also does not guarantee uppercase + lowercase + digit, so generated passwords may fail the strength regex.

## Environment

- **File:** `nextjs/app/api/admin/users/[email]/route.ts` line 75
- **Date:** 2026-03-14

## Root Cause

Miscalculation: 6 bytes × 4/3 (base64 ratio) = 8 chars, not 12.

## Fix

Use `randomBytes(9).toString('base64')` (produces 12 chars) or `randomBytes(12).toString('hex')` (produces 24 hex chars). Verify generated password passes the strength regex before saving.
