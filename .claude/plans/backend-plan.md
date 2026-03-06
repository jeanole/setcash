# Backend Implementation Plan

## Feature
BUG-16: Budget Page Crashes with Prisma Enum Error

## Context Summary
The budget page crashes with a PrismaClientKnownRequestError when loading the budget matrix. The error is:
```
ERROR: invalid input value for enum "BillStatus": "draft"
```

The Prisma schema correctly defines the `BillStatus` enum with `draft` as a value:
```prisma
enum BillStatus {
  draft
  confirmed
  pending
  approved
  rejected
  paid
}
```

The issue is in the raw SQL queries in:
1. `nextjs/app/(protected)/budget/page.tsx` (lines 58-87)
2. `nextjs/app/api/budget-matrix/route.ts` (lines 85-114)

These queries use string literals directly:
```sql
AND b.status NOT IN ('draft', 'pending', 'rejected')
```

In PostgreSQL, when using `$queryRaw`, string literals must be explicitly cast to the enum type.

## User Decisions
N/A - This is a bug fix, no user decisions needed.

## Open Bug Reports to Address
None - This is the only open bug for PROJ-8.

## Fix Required

### Files to Modify

1. **nextjs/app/(protected)/budget/page.tsx**
   - Lines 58-65: Motive spending query
   - Lines 68-75: Category spending query  
   - Lines 78-87: Cell spending query

2. **nextjs/app/api/budget-matrix/route.ts**
   - Lines 85-92: Motive spending query
   - Lines 95-102: Category spending query
   - Lines 105-114: Cell spending query

### Solution

Cast string literals to the `BillStatus` enum type using PostgreSQL's `::"BillStatus"` syntax:

```sql
AND b.status NOT IN ('draft'::"BillStatus", 'pending'::"BillStatus", 'rejected'::"BillStatus")
```

Alternatively, use the `!=` operator with OR conditions which sometimes works better with Prisma's raw query parameter binding.

## Checklist
- [x] Bug reproduced and understood
- [x] Root cause identified (PostgreSQL enum casting in raw SQL)
- [ ] Fix implemented in budget/page.tsx
- [ ] Fix implemented in api/budget-matrix/route.ts
- [ ] Fix tested in development
- [ ] Bug report updated with "Fixed In" version
