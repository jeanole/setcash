# BUG-15: Budget Matrix SQL Query Uses Wrong Column Names

## Status: Resolved
**Reported:** 2026-03-06
**Severity:** Critical
**Skill Tag:** [Backend]
**Feature:** [PROJ-8](PROJ-8-budget-matrix.md)

---

## Summary

The Budget Matrix page crashes with a Prisma `queryRaw` error. The raw SQL queries use snake_case column names (e.g., `bm.bill_id`) but the PostgreSQL database uses camelCase column names (e.g., `bm.billId`) as defined by Prisma's naming convention.

---

## Expected Behavior

Budget Matrix page should load successfully, displaying the matrix with motives as columns, categories as rows, and calculated spending data from bills.

---

## Actual Behavior

Page crashes with Server Error 500. The API route `/api/budget-matrix` fails with:

```
PrismaClientKnownRequestError: 
Invalid `prisma.$queryRaw()` invocation:
Raw query failed. Code: `42703`. Message: `column bm.bill_id does not exist`
```

---

## Steps to Reproduce

1. Navigate to `/budget` page
2. Page attempts to fetch budget matrix data
3. Server error occurs during spending calculation queries

---

## Environment

- **Branch:** `to_nextjs` (local)
- **Runtime:** Docker
- **Database:** PostgreSQL
- **Error Path:** `/app/.next/server/app/(protected)/budget/page.js`

---

## Root Cause Analysis

The raw SQL queries in `/api/budget-matrix/route.ts` use snake_case column names:
- `bm.bill_id` (should be `bm.billId`)
- `bm.motive_id` (should be `bm.motiveId`)
- `bc.category_id` (should be `bc.categoryId`)
- etc.

PostgreSQL with Prisma uses camelCase for column names by default. The queries need to be updated to match the actual database schema.

**Affected Queries:**
1. Motive spending calculation
2. Category spending calculation  
3. Cell spending calculation (motive × category intersection)

---

## Proposed Fix

Update the `$queryRaw` calls in `nextjs/app/api/budget-matrix/route.ts` to use camelCase column names:

```sql
-- Before (broken):
SELECT bm.motive_id, SUM(b.netto_amount * bm.percentage / 100) as spent
FROM "BillMotive" bm 
JOIN "Bill" b ON b.id = bm.bill_id

-- After (fixed):
SELECT bm."motiveId", SUM(b."nettoAmount" * bm.percentage / 100) as spent
FROM "BillMotive" bm 
JOIN "Bill" b ON b.id = bm."billId"
```

Note: PostgreSQL identifiers are case-insensitive unless quoted. Use double quotes for camelCase identifiers.

---

## Fixed In

Commit: `bug(BUG-15): Fix Budget Matrix SQL column names`
Date: 2026-03-06

---

## Resolution Notes

### Changes Made

Fixed SQL column names in **two files**:

**File 1: `/api/budget-matrix/route.ts`**
Updated raw SQL queries to use camelCase column names with double quotes.

**File 2: `/app/(protected)/budget/page.tsx`** (Server Component)
Same fix applied to the `getBudgetMatrixData()` function.

**Column Name Changes:**
- `bm.motive_id` → `bm."motiveId"`
- `b.netto_amount` → `b."nettoAmount"`
- `bm.bill_id` → `bm."billId"`
- `b.project_id` → `b."projectId"`
- `bc.category_id` → `bc."categoryId"`
- `bc.bill_id` → `bc."billId"`

**Fixed Queries:**
1. Motive spending query
2. Category spending query
3. Cell spending query (motive × category intersection)

**Note:** PostgreSQL identifiers are case-insensitive unless quoted. Double quotes are required for camelCase identifiers used by Prisma.
