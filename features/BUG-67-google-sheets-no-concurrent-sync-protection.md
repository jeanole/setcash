# BUG-67: Google Sheets Sync Has No Concurrency Protection

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-12: Integrations (Google Sheets + Telegram)

---

## Description

### Expected Behavior
Per spec EC3: a second sync request should wait or return "Sync already in progress" while another sync is running.

### Actual Behavior
No per-project lock exists. Multiple admins or rapid double-clicks can trigger simultaneous syncs, causing race conditions and partially corrupt data in the Google Sheet.

## Environment

- **File:** `nextjs/app/api/admin/export/google-sheet/route.ts`
- **Date:** 2026-03-14

## Root Cause

Spec requirement EC3 was not implemented.

## Fix

Add a boolean `syncInProgress` flag per project (database column or Redis key). Set it at the start of sync, clear it on completion/error. Return 409 if already set.
