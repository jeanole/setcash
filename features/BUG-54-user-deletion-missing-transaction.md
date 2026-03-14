# BUG-54: User Deletion Not Wrapped in Transaction

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-17: Super-Admin

---

## Description

### Expected Behavior
Deleting a user's project memberships and then the user account should be atomic.

### Actual Behavior
`projectMember.deleteMany` followed by `user.delete` are separate calls. If membership deletion succeeds but `user.delete` fails, the user loses all project access while the account remains, leaving it in an unrecoverable orphaned state.

## Environment

- **File:** `nextjs/app/api/admin/users/[email]/route.ts` lines 158-164
- **Date:** 2026-03-14

## Root Cause

Sequential Prisma calls outside a transaction block.

## Fix

Wrap in `prisma.$transaction()`.
