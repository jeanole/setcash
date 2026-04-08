# BUG-3: Bill Actions Fail with CSRF Token Error

**Status:** Open
**Reported:** 2026-02-27
**Severity:** High
**Skill Tag:** [Frontend]
**Feature:** PROJ-1: OCR / AI Bill Analysis

## Description

Multiple bill actions (Save Changes, Delete Bill, Bulk Delete) throw `"Error: Invalid or missing CSRF token. Please reload the page and try again."` The actions never complete.

### Expected Behavior
Clicking "Save Changes" sends `PUT /api/bills/:id`, "Delete Bill" sends `DELETE /api/bills/:id`, and "Bulk Delete" sends `POST /api/bills/bulk-delete` — all succeed with a 200 response.

### Actual Behavior
All three requests are rejected by the server's CSRF middleware with a 403 error because the `X-CSRF-Token` header is missing.

### Root Cause
Three call sites in `public/js/bills.js` use raw `fetch()` instead of the CSRF-aware `apiFetch()` helper:

- Line 590: `fetch("/api/bills/" + currentBillId, { method: "DELETE" })` — delete bill
- Line 641: `fetch("/api/bills/bulk-delete", { method: "POST", ... })` — bulk delete
- Line 958: `fetch("/api/bills/" + currentBillId, { method: "PUT", ... })` — save changes

Same root cause as BUG-2 (fixed on the Analyse button) — these call sites predate CSRF protection.

## Steps to Reproduce
1. Log in, navigate to Bills list
2. Open a bill, edit a field, click "Save Changes"
3. Error toast appears: "Error: Invalid or missing CSRF token. Please reload the page and try again."
4. Same error on "Delete Bill" and "Bulk Delete" actions.

## Environment
- **Browser/Client:** Chrome
- **OS:** Windows
- **Screen Size:** Desktop

## Additional Context
Fix: replace `fetch(url, options)` with `apiFetch(url, options)` at all three call sites. `apiFetch()` is defined in `public/js/utils.js`.

---

## Resolution
**Status:** Resolved
**Resolved Date:** 2026-02-27
**Fixed In:** fix(BUG-3) commit
**Fix Description:** Replaced raw `fetch()` with `apiFetch()` in `deleteBill()` (DELETE), `bulkDeleteBills()` (POST bulk-delete), and the `billDetailForm` submit handler (PUT) so the X-CSRF-Token header is included.
