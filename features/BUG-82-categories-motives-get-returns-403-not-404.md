# BUG-82: Motive/Category GET Endpoints Return 403 Instead of 404 for Non-Members

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-9: Categories & Motives Admin Pages

---

## Description

### Expected Behavior
Per spec AC14, non-member access should return 404 to prevent project ID enumeration.

### Actual Behavior
GET endpoints return 403 when the user is not a member, confirming that the project ID exists.

## Environment

- **File:** `nextjs/app/api/projects/[id]/motives/route.ts` lines 34-36
- **Date:** 2026-03-14

## Root Cause

Access check returns 403 instead of 404. UUIDs reduce brute-force risk but 404 is still preferred.

## Fix

Change the access check response from 403 to 404 for GET requests on project resources.
