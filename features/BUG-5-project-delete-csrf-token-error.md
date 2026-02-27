# BUG-5: Project Delete Button Fails with CSRF Token Error

**Status:** Open
**Reported:** 2026-02-27
**Severity:** Critical
**Skill Tag:** [Backend] / [Frontend] — root cause unknown
**Feature:** [PROJ-2: Security & Multi-tenant Hardening](PROJ-2-security-hardening.md)

## Description

Clicking the project delete button throws a CSRF token error: `Invalid or missing CSRF token. Please reload the page and try again.`

This indicates the delete action is either not sending the CSRF token, or the token is not being attached to that specific request. The same class of issue was previously seen on bill actions (BUG-3) and the OCR analyse button (BUG-2), suggesting there may be other buttons/actions in the app that are similarly missing CSRF token coverage.

### Expected Behavior
Clicking the project delete button sends the CSRF token with the DELETE request and the action completes successfully.

### Actual Behavior
The request is rejected with HTTP 403: `Invalid or missing CSRF token. Please reload the page and try again.`

## Steps to Reproduce
1. Log in as a project admin or super-admin
2. Navigate to the project settings or admin panel where a delete project button is available
3. Click the delete project button
4. Observe the CSRF token error

## Audit Scope
All state-changing buttons and actions in the app should be audited to ensure they send the CSRF token via `apiFetch` or `withCsrf`. Prior bugs (BUG-2, BUG-3) suggest this is a recurring gap in coverage.

Known buttons/flows to check:
- Project delete (**confirmed broken**)
- Any other admin/superadmin actions using raw `fetch()` instead of `apiFetch()`
- Any form submissions not going through the CSRF-aware helper

## Environment
- **Browser/Client:** N/A
- **OS:** N/A
- **Screen Size:** N/A

## Additional Context
- BUG-2: Analyse button fixed (PROJ-1 context)
- BUG-3: Bill action buttons fixed (PROJ-1 context)
- Pattern: wherever `fetch()` is used directly instead of `apiFetch()`, CSRF token is not sent

---

## Resolution
**Status:** Open
**Resolved Date:** —
**Fixed In:** — *(commit hash or PR)*
**Fix Description:** —
