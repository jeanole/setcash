# BUG-76: Bill Bulk Delete Accepts Unlimited ID Array

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-7: Bills Feature

---

## Description

### Expected Behavior
The bulk delete endpoint should cap the number of IDs per request to prevent memory spikes.

### Actual Behavior
Zod schema `z.array(z.string()).min(1)` has no `.max()`. An admin can submit thousands of IDs, causing the server to load all matching bills into memory.

## Environment

- **File:** `nextjs/app/api/bills/bulk-delete/route.ts` lines 13-15
- **Date:** 2026-03-14

## Root Cause

`.max()` not applied to the Zod array schema. Admin-only, so low exploitability.

## Fix

Add `.max(500)` (or similar) to the array schema.
