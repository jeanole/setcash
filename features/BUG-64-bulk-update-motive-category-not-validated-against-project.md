# BUG-64: Budget Bulk Update motiveId/categoryId Not Validated Against Current Project

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-8: Budget Matrix

---

## Description

### Expected Behavior
`motiveId` and `categoryId` values in bulk update requests should be verified to belong to the current project before upserting.

### Actual Behavior
The bulk update endpoint uses `projectId` in the upsert key but does not verify that the submitted `motiveId` and `categoryId` belong to that project. An admin who belongs to multiple projects could create `BudgetMatrix` records in Project A that reference motives from Project B.

## Steps to Reproduce

1. Note a `motiveId` from Project B
2. As admin in Project A, submit a bulk update with that `motiveId`
3. A `BudgetMatrix` row is created in Project A referencing Project B's motive

## Environment

- **File:** `nextjs/app/api/budget-matrix/bulk-update/route.ts` lines 57-79
- **Date:** 2026-03-14

## Root Cause

No lookup to verify `motive.projectId === currentProjectId` before upserting.

## Fix

Before the transaction, fetch the submitted `motiveId` and `categoryId` values and verify their `projectId` matches the session's `currentProjectId`. Return 400 if any mismatch is found.
