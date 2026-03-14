# BUG-70: Motive/Category Manual Cascade Delete Not Wrapped in Transaction

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-9: Categories & Motives Admin Pages

---

## Description

### Expected Behavior
Deleting a motive or category should be atomic — all related records deleted together or not at all.

### Actual Behavior
Three sequential deletes (BillMotive/BillCategory, BudgetMatrix, then Motive/Category) are executed without `prisma.$transaction()`. A failure mid-sequence leaves orphaned records.

## Environment

- **File:** `nextjs/app/api/projects/[id]/motives/[motiveId]/route.ts` lines 165-178
- **Date:** 2026-03-14

## Root Cause

Sequential Prisma calls without a transaction wrapper. Note: the schema already defines `onDelete: Cascade` on relations, making the manual deletes partially redundant.

## Fix

Either wrap the three deletes in `prisma.$transaction()`, or remove the manual deletes and rely on the existing `onDelete: Cascade` schema constraints.
