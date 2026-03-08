# CR-10: Remove Separate Upload Button from New Bill Form

**Feature:** [PROJ-7: Bills Feature](PROJ-7-bills-feature.md)
**Requested:** 2026-03-08
**Priority:** Medium
**Status:** Pending Review

---

## Current Behavior

On the "Upload New Bill" page (`/bills/new`), after selecting images via the file picker or camera, the user must click a dedicated **"Upload"** button inside `BillImageUpload` to upload the files. This is a separate step from submitting the bill form, resulting in a two-step flow:

1. Select files → click **Upload**
2. Fill in bill fields → click **Submit**

## Desired Behavior

Images should be submitted as part of the bill form. There should be no separate "Upload" button. The user selects their files, fills in the bill details, and clicks **Submit** once — the images are included in the bill creation request automatically.

## Rationale

The extra "Upload" step is redundant and confusing. In standard form UX, files selected in a form are submitted together with the rest of the form fields. Having a separate upload action creates friction and risks user error (e.g., forgetting to click Upload before submitting).

## Proposed Acceptance Criteria

- [ ] `BillImageUpload` on the new bill page does NOT render an "Upload" button
- [ ] Files selected in `BillImageUpload` are held in local state and returned to the parent when the bill form is submitted
- [ ] The bill creation flow is a single step: fill out form → click Submit → bill and images are saved together
- [ ] Existing behavior on the bill detail page ("Add More Images") is unaffected — that context still uploads immediately after selection (or on a manual trigger) since there is no enclosing form
- [ ] Error handling for upload failures is surfaced at the point of bill submission (not as a separate step)
- [ ] UX still shows selected files as thumbnails with the ability to remove them before submitting

## Resolution

**Status:** Deployed
**Resolved Date:** 2026-03-08
**Notes:** Implemented as part of BUG-35 fix. `BillImageUpload` redesigned — no internal `onUpload` prop or Upload button. New bill page passes `selectedFiles={pendingFiles}` + `onSelectedFilesChange={setPendingFiles}`; files are included in the FormData on form submit. Also fixed object URL memory leak in the selected-files preview grid.
