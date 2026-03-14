# BUG-53: Project Deletion Runs Sequential Deletes Without a Transaction

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-5: NextAuth.js Authentication

---

## Description

### Expected Behavior
All cascading deletes during project deletion should be atomic — either all succeed or none do.

### Actual Behavior
Seven sequential `deleteMany` calls followed by `project.delete` are executed without `prisma.$transaction()`. A failure partway through leaves the project in a partially deleted state with orphaned records.

## Environment

- **File:** `nextjs/app/api/admin/projects/[id]/route.ts` lines 38-70
- **Date:** 2026-03-14

## Root Cause

Sequential Prisma calls outside a transaction block.

## Fix

Wrap all delete operations in `prisma.$transaction([...])` or use the interactive transaction API.
