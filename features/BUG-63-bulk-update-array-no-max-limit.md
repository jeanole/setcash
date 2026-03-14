# BUG-63: Budget Bulk Update Zod Array Has No Maximum Size Limit

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-8: Budget Matrix

---

## Description

### Expected Behavior
The bulk update endpoint should reject requests with an unreasonably large number of update objects.

### Actual Behavior
The Zod schema `z.array(z.object({...}))` has no `.max()` constraint. A user can submit hundreds of thousands of update objects in one request, creating an enormous database transaction that locks tables and exhausts server memory.

## Environment

- **File:** `nextjs/app/api/budget-matrix/bulk-update/route.ts` lines 11-19
- **Date:** 2026-03-14

## Root Cause

`.max()` not applied to the Zod array schema.

## Fix

Add a reasonable cap:
```ts
z.array(z.object({...})).min(1).max(1000)
```
