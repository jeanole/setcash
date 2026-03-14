# BUG-59: Bill Number Generation Race Condition Produces Duplicates

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-7: Bills Feature

---

## Description

### Expected Behavior
Each user's bill number within a project should be unique and sequential.

### Actual Behavior
`calculateBillNumber` reads the current bill count and derives the next number. Two concurrent POST requests will read the same count and produce the same bill number. No database unique constraint enforces uniqueness.

## Steps to Reproduce

1. Send two simultaneous `POST /api/bills` requests from the same user
2. Both may receive the same bill number

## Environment

- **File:** `nextjs/app/api/bills/route.ts` lines 35-46
- **Date:** 2026-03-14

## Root Cause

Read-then-write pattern without a database-level unique constraint or advisory lock.

## Fix

Add a `@@unique([projectId, submittedByEmail, billNumber])` constraint in the schema, and handle the unique violation with a retry loop, or generate bill numbers using a database sequence/serial pattern.
