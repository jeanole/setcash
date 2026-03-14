# BUG-60: Budget Matrix PDF Missing Project Membership Verification

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-11: Reports & Exports

---

## Description

### Expected Behavior
The budget matrix PDF endpoint should verify the user is an active member of the project before returning data, not just that they have a session with `currentProjectId` set.

### Actual Behavior
The endpoint checks authentication and `currentProjectId` but does NOT call `prisma.projectMember.findUnique()` to verify active membership. A user removed from a project who retains a stale session can still generate the PDF.

## Environment

- **File:** `nextjs/app/api/reports/budget-matrix/pdf/route.ts` lines 15-25
- **Date:** 2026-03-14

## Root Cause

Membership check was added to `GET /api/budget-matrix` but not to the PDF export endpoint.

## Fix

Add the same `prisma.projectMember.findUnique()` check used in `app/api/budget-matrix/route.ts` lines 23-33.
