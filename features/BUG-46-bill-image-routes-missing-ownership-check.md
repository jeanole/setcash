# BUG-46: Bill Image Upload/Replace/Delete Routes Missing Owner-or-Admin Check

**Status:** Open
**Reported:** 2026-03-14
**Severity:** High
**Skill Tag:** [Backend]
**Feature:** PROJ-7: Bills Feature

---

## Description

### Expected Behavior
Only the bill submitter or a project admin should be able to add, replace, or delete images on a bill.

### Actual Behavior
Any authenticated member of the same project can upload images to, crop images on, or delete images from any other member's bill. The routes verify the bill belongs to the project but do not check whether the requester owns the bill or is an admin.

## Steps to Reproduce

1. Log in as User A in a project, note a bill ID submitted by User B
2. Send `POST /api/bills/<bill-B-id>/images` with a file — succeeds
3. Send `PUT /api/bills/<bill-B-id>/images/<imageId>` with crop data — succeeds
4. Send `DELETE /api/bills/<bill-B-id>/images/<imageId>` — succeeds

## Environment

- **Files:**
  - `nextjs/app/api/bills/[id]/images/route.ts` lines 59-65
  - `nextjs/app/api/bills/[id]/images/[imageId]/route.ts` lines 57-63 (PUT), 137-143 (DELETE)
- **Date:** 2026-03-14

## Root Cause

The image mutation routes use `findFirst({ where: { id, projectId } })` to scope to the project but omit the `isOwner || isAdmin` check that `PUT /api/bills/[id]` and `DELETE /api/bills/[id]` correctly implement (lines 295-303 and 474-479).

## Fix

Add ownership/admin check to all three image routes, mirroring the pattern in `bills/[id]/route.ts`:
```ts
const isOwner = bill.submittedByEmail === session.user.email;
const isAdmin = ['admin', 'owner', 'superadmin'].includes(session.user.currentProjectRole);
if (!isOwner && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
```
