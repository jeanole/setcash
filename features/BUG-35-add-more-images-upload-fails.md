# BUG-35: Add More Images Upload Fails on Bill Detail Page

**Status:** Open
**Reported:** 2026-03-08
**Severity:** Critical
**Skill Tag:** [Frontend]
**Feature:** [PROJ-7: Bills Feature](PROJ-7-bills-feature.md)

---

## Description

### Expected Behavior
On the bill detail page (`/bills/[id]`), using the "Add More Images" section should successfully upload selected images and attach them to the bill.

### Actual Behavior
The upload fails. Images are not uploaded/attached to the bill.

## Steps to Reproduce

1. Log in and navigate to `/bills`
2. Click "View" on any bill row
3. On the bill detail page, scroll to the "Add More Images" section
4. Select one or more image files (via file picker or drag-and-drop)
5. Click the Upload button (or trigger the upload)
6. Observe: upload fails — images are not saved to the bill

## Environment

- **Browser/Client:** Browser (unspecified)
- **OS:** N/A
- **Screen Size:** N/A
- **Date/Time:** 2026-03-08

## Additional Context

The user also noted that reworking the bill detail view as a modal (rather than a separate page) should be considered — this may involve an architecture review. That is a separate change request to be logged after this bug is fixed.

The `BillImageUpload` component on the detail page calls `uploadImages` from `useBill`, which POSTs to `/api/bills/[id]/images`. The failure could be in the upload hook, the route handler, or the component itself. The component was recently modified for BUG-33 (crop modal fix) and BUG-31 (thumbnail visibility).

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-08
**Fixed In:** — *(commit hash or PR)*
**Fix Description:** Root cause: `BillImageUpload` fired `onUpload` (typed `void`) fire-and-forget; errors from the async `uploadImages` hook landed in hook-internal state and were never shown to the user. Fix: redesigned `BillImageUpload` to expose `selectedFiles` + `onSelectedFilesChange` instead of `onUpload`. The detail page now owns `filesToUpload` state and renders an explicit Upload button with loading state, awaits the result, and shows success/error via the existing `result` banner.
