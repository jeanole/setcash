# BUG-68: Admin Can Self-Modify Own Project Member Record Without Restriction

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-10: Members, Projects & Settings

---

## Description

### Expected Behavior
Admins should not be able to modify their own membership record fields (e.g., assign themselves a position).

### Actual Behavior
The PUT endpoint for member updates does not prevent an admin from finding their own `memberId` and updating fields on their own record. Role escalation to `owner` is blocked by the owner-only guard, but self-modification of other fields (e.g., `positionId`) is unrestricted.

## Environment

- **File:** `nextjs/app/api/projects/[id]/members/[memberId]/route.ts` lines 48-76
- **Date:** 2026-03-14

## Root Cause

No self-modification guard in the PUT handler.

## Fix

Add a check: if `member.userEmail === session.user.email && session.user.currentProjectRole !== 'owner'`, return 403.
