# BUG-75: GET /api/vgeld Has No Pagination Limit

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-15: V-Geld (Advance Money)

---

## Description

### Expected Behavior
List endpoints should apply a `take` limit per project rules ("Use `.limit()` on all list queries").

### Actual Behavior
`GET /api/vgeld` returns all V-Geld transfers for a project with no `take` constraint.

## Environment

- **File:** `nextjs/app/api/vgeld/route.ts` lines 44-47
- **Date:** 2026-03-14

## Root Cause

`prisma.vgeld.findMany` called without `take`.

## Fix

Add pagination parameters and apply `take`/`skip` to the query.
