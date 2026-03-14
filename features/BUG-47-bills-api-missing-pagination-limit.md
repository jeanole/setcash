# BUG-47: GET /api/bills and /api/bills/log Have No Pagination Limit

**Status:** Open
**Reported:** 2026-03-14
**Severity:** High
**Skill Tag:** [Backend]
**Feature:** PROJ-7: Bills Feature

---

## Description

### Expected Behavior
List endpoints should apply a `take` limit per project rules ("Use `.limit()` on all list queries").

### Actual Behavior
`GET /api/bills` and `GET /api/bills/log` return the entire dataset for a project in a single response — no `take`, `skip`, or cursor-based pagination.

## Steps to Reproduce

1. Authenticate to a project with many bills
2. `GET /api/bills` — returns all bills with all nested images, motives, categories

## Environment

- **Files:**
  - `nextjs/app/api/bills/route.ts` lines 190-218
  - `nextjs/app/api/bills/log/route.ts` line 36
- **Date:** 2026-03-14

## Root Cause

`prisma.bill.findMany` is called without a `take` constraint. Violates backend rule.

## Fix

Add pagination parameters (`page`, `pageSize`) to both endpoints, apply `take` and `skip` to all `findMany` calls, and return total count for frontend pagination.
