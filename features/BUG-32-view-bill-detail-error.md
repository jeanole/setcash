# BUG-32 — Clicking "View" on Bills Table Produces Error

**Status:** Open
**Severity:** High
**Feature:** [PROJ-7](PROJ-7-bills-feature.md)
**Filed:** 2026-03-08
**Skill:** [Frontend]
**Fixed In:** —

---

## Summary

Clicking the "View" button on a row in the bills table navigates to `/bills/[id]` but the detail page shows an error. The `useBill` hook fetches `getBill(id)` and `getEditLogs()` in parallel via `Promise.all`. The `GET /api/bills/log` endpoint returns a 400 error when `currentProjectId` is absent from the session — the same pattern as BUG-30. Since `Promise.all` rejects on any failure, the entire bill detail page fails to load.

---

## Steps to Reproduce

1. Navigate to `/bills`
2. Click the "View" button on any bill row
3. Observe: the bill detail page fails to render — an error is displayed instead of the bill details

---

## Expected Behavior

Clicking "View" navigates to the bill detail page and shows:
- Bill fields (date, vendor, amount, type, etc.)
- Edit/action buttons
- Bill history / audit log

---

## Actual Behavior

The bill detail page shows an error. The `useBill` hook's `Promise.all([getBill(id), getEditLogs()])` rejects because `getEditLogs()` calls `GET /api/bills/log` which returns 400 when `currentProjectId` is not in the session.

---

## Root Cause

`nextjs/lib/hooks/useBills.ts` — the `useBill` hook calls `getEditLogs()` in parallel with `getBill(id)` via `Promise.all`. The logs endpoint (`GET /api/bills/log`) returns 400 when `session.user.currentProjectId` is null/undefined. This is the same BUG-30 pattern that was fixed for the VGeldBalance sidebar widget.

Fix: either guard `getEditLogs()` with a `hasProject` check in `useBill`, or handle the 400 error gracefully (treat as empty log array) so the bill detail page can still render with just the bill data.

---

## Environment

- Route: `/bills` → click View → `/bills/[id]`
- Browser: any
- OS: any

---

## Additional Context

Related to BUG-30 (`VGeld balance 400 when no project selected`) — same root cause pattern. The `/api/bills/log` endpoint requires `currentProjectId` in session. The fix pattern from BUG-30: guard the fetch when no project is selected, or catch errors on the log fetch specifically and fall back to an empty array.
