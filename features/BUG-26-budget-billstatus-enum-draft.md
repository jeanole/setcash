# BUG-26: Budget Page Crashes with Invalid BillStatus Enum Value "draft"

**Status:** Resolved
**Reported:** 2026-03-07
**Severity:** Critical
**Skill Tag:** [Backend]
**Feature:** PROJ-8: Budget Matrix

---

## Description

### Expected Behavior
The Budget Matrix page loads successfully, showing spending data alongside budget allocations.

### Actual Behavior
The page crashes with a Prisma raw query error:
```
PrismaClientKnownRequestError:
Invalid `prisma.$queryRaw()` invocation:
Raw query failed. Code: `22P02`.
Message: `ERROR: invalid input value for enum "BillStatus": "draft"`
```
The budget page is completely inaccessible.

## Steps to Reproduce

1. Log in to the Next.js app
2. Navigate to `/budget`
3. Page crashes with 500 error / Prisma exception

## Environment

- **Browser/Client:** N/A (server-side error)
- **OS:** Docker container (Linux)
- **Screen Size:** N/A
- **Date/Time:** 2026-03-07

## Additional Context

Full stack trace:
```
PrismaClientKnownRequestError:
Invalid `prisma.$queryRaw()` invocation:
Raw query failed. Code: `22P02`. Message: `ERROR: invalid input value for enum "BillStatus": "draft"`

    at $n.handleRequestError (.../library.js:121:7315)
    at async o (.next/server/app/(protected)/budget/page.js:24:5280)
    at async c (.next/server/app/(protected)/budget/page.js:47:722) {
  code: 'P2010',
  clientVersion: '5.22.0',
  meta: {
    code: '22P02',
    message: 'ERROR: invalid input value for enum "BillStatus": "draft"'
  }
}
```

Root cause: A `prisma.$queryRaw()` call in `nextjs/app/(protected)/budget/page.tsx` (or a function it calls) passes the string `"draft"` as a filter for the `BillStatus` PostgreSQL enum. The PostgreSQL enum only includes uppercase values (e.g. `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`) — the lowercase `"draft"` is not a valid enum value.

Fix should update the raw query to use the correct cased enum value (e.g. `DRAFT`) or use Prisma's typed enum constant (`BillStatus.DRAFT`) instead of a raw string.

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-07
**Fixed In:** fix(BUG-26): Add missing draft value to BillStatus PostgreSQL enum
**Fix Description:** Created Prisma migration `20260307000000_add_draft_to_billstatus` that adds the missing `draft` value to the PostgreSQL `"BillStatus"` enum via `ALTER TYPE "BillStatus" ADD VALUE IF NOT EXISTS 'draft'`. No code changes were needed — the raw SQL queries already used the correct casting syntax.
