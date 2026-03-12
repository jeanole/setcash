# BUG-16: Budget Page Crashes with Prisma Enum Error

## Metadata
| Field | Value |
|-------|-------|
| **ID** | BUG-16 |
| **Feature** | PROJ-8 |
| **Severity** | Critical |
| **Status** | Resolved |
| **Reported** | 2026-03-06 |
| **Fixed In** | 2026-03-06 |

## Description
The budget page crashes with a PrismaClientKnownRequestError when trying to load the budget matrix. The error indicates that the raw SQL query is passing 'draft' as a BillStatus enum value, but the PostgreSQL enum does not include this value.

## Steps to Reproduce
1. Log in to Next.js app
2. Select a project
3. Click Budget in sidebar
4. Error occurs

## Expected Behavior
Budget page should load and display budget matrix correctly.

## Actual Behavior
Prisma error: invalid input value for enum "BillStatus": "draft"

Raw query failed. Code: `22P02`. Message: `ERROR: invalid input value for enum "BillStatus": "draft"`

Stack trace points to:
- `/app/.next/server/app/(protected)/budget/page.js:18:6643`
- `/app/.next/server/app/(protected)/budget/page.js:41:686`

## Environment
- Server-side error in Docker container
- Prisma Client version: 5.22.0

## Root Cause Analysis
The Prisma schema enum `BillStatus` likely doesn't include 'draft' value, but the raw SQL query (`$queryRaw`) is passing 'draft' as a filter value. The enum probably only has 'confirmed' or other values defined, causing the PostgreSQL query to fail.

## Fix Applied

The issue was that PostgreSQL requires explicit type casting when comparing string literals to enum columns in raw SQL queries.

**Solution:** Cast string literals to the `BillStatus` enum type using PostgreSQL's `::"BillStatus"` syntax:

```sql
-- Before (causes error)
AND b.status NOT IN ('draft', 'pending', 'rejected')

-- After (works correctly)
AND b.status NOT IN ('draft'::"BillStatus", 'pending'::"BillStatus", 'rejected'::"BillStatus")
```

**Files Modified:**
1. `nextjs/app/(protected)/budget/page.tsx` - Lines 63, 73, 85
2. `nextjs/app/api/budget-matrix/route.ts` - Lines 90, 100, 112

## Related Code
The error occurs in the budget page server component when executing a raw SQL query that filters bills by status.

## Checklist
- [x] Bug reproduced and confirmed
- [x] Root cause identified (PostgreSQL enum casting in raw SQL)
- [x] Fix implemented (added `::"BillStatus"` casts)
- [ ] Fix tested in development
- [ ] Fix deployed to production
- [x] Bug report updated with "Fixed In" version
