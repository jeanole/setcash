# BUG-2: Analyse Button Fails with CSRF Token Error

**Status:** Resolved
**Reported:** 2026-02-27
**Severity:** High
**Skill Tag:** [Frontend]
**Feature:** PROJ-1: OCR / AI Bill Analysis

## Description

Clicking the "Analyse Bill" button throws an error: `"Invalid or missing CSRF token. Please reload the page and try again."` The analysis never starts.

### Expected Behavior
Clicking "Analyse Bill" sends a `POST /api/bills/:id/analyse` request and receives a 202 "Analysis started" response.

### Actual Behavior
The POST request is rejected by the server's CSRF middleware with a 403 error because the `X-CSRF-Token` header is missing.

### Root Cause
`triggerBillAnalysis()` and `triggerBillAnalysisFromList()` in `public/js/bills.js` call `fetch()` directly for the analyse endpoint instead of using the CSRF-aware `apiFetch()` helper defined in `public/js/utils.js`. All state-changing POST requests must go through `apiFetch()` (or at minimum `withCsrf()`) to include the `X-CSRF-Token` header.

## Steps to Reproduce
1. Log in, navigate to Bills list
2. Upload a bill with an image
3. Click the "Analyse Bill" button on the bill row
4. Error toast appears: "Invalid or missing CSRF token. Please reload the page and try again."

## Environment
- **Browser/Client:** Chrome
- **OS:** Windows
- **Screen Size:** Desktop

## Additional Context
`apiFetch()` is defined in `public/js/utils.js` and already used by other bill actions. The fix is a one-line change per call site: replace `fetch(url, { method: "POST", ... })` with `apiFetch(url, { method: "POST", ... })`.

---

## Resolution
**Status:** Resolved
**Resolved Date:** 2026-02-27
**Fixed In:** fix(BUG-2) commit
**Fix Description:** Replaced raw `fetch()` with `apiFetch()` in `triggerBillAnalysis()` and `triggerBillAnalysisFromList()` so the X-CSRF-Token header is included.
