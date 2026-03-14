# BUG-55: Admin User Update Bypasses Zod Validation on resetPassword Path

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-17: Super-Admin

---

## Description

### Expected Behavior
All user input must be validated with Zod before processing, as required by project security rules.

### Actual Behavior
When `body.resetPassword === true`, the handler skips Zod validation entirely. `body.isSuperAdmin` is read directly from the raw request body without schema validation.

## Environment

- **File:** `nextjs/app/api/admin/users/[email]/route.ts` lines 73-91
- **Date:** 2026-03-14

## Root Cause

The `resetPassword` branch short-circuits before the Zod `safeParse` call that protects the other code paths.

## Fix

Add a Zod schema for the reset-password body path that validates `resetPassword: z.literal(true)` and `isSuperAdmin: z.boolean().optional()`.
