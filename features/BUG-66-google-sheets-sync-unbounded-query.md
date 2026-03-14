# BUG-66: Google Sheets Sync Fetches All Bills Unbounded — OOM Risk

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-12: Integrations (Google Sheets + Telegram)

---

## Description

### Expected Behavior
The Google Sheets sync should process bills in chunks to avoid loading the entire dataset into memory.

### Actual Behavior
`prisma.bill.findMany({ where: { projectId } })` fetches ALL bills for a project with no `take` limit. For projects with tens of thousands of bills, this causes the Node.js process to run out of memory and crash.

## Environment

- **File:** `nextjs/app/api/admin/export/google-sheet/route.ts` lines 63-66
- **Date:** 2026-03-14

## Root Cause

No pagination applied to the export query.

## Fix

Process bills in batches of 500 using cursor-based pagination, or add a hard limit with a user-facing warning when the limit is reached.
