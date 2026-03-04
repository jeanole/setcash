# BUG-9: Duplicate Image Upload Sections on New Bill Page

**Status:** Open
**Reported:** 2026-03-04
**Severity:** High
**Skill Tag:** [Frontend]
**Feature:** PROJ-7: Bills Feature

## Description

### Expected Behavior
The `/bills/new` page should have only ONE image upload section, positioned at the **top** of the form (as per original vBudget design where photos are captured first).

### Actual Behavior
The `/bills/new` page currently displays **two** image upload sections when creating a new bill:
1. One inside the `BillForm` component (lines 320-331 in BillForm.tsx)
2. One separate section at the bottom of the page (lines 130-141 in page.tsx)

Both sections are visible simultaneously, creating a confusing user experience.

## Steps to Reproduce
1. Navigate to `/bills/new`
2. Observe there are two "Images" sections on the page
3. One appears within the form (middle of page)
4. Another appears as a separate card at the bottom

## Environment
- **Browser/Client:** All browsers
- **OS:** All
- **Screen Size:** All

## Root Cause Analysis
The issue stems from having `BillImageUpload` in two places:
- `BillForm.tsx` has an image upload section (line 320-331) shown when `!initialData?.id`
- `page.tsx` also renders `BillImageUpload` separately after the form (line 130-141)

## Proposed Fix
1. Remove the image upload section from `BillForm.tsx` (lines 320-331)
2. Keep only the image upload in `page.tsx`
3. Move the image upload section to the **TOP** of the form (above Basic Information), matching the original vBudget layout

## Additional Context
The original vBudget app positioned the photo upload at the top of the upload form, as users typically want to capture the receipt image first before entering details.

---

## Resolution
**Status:** Open | In Progress | Resolved | Won't Fix
**Resolved Date:** —
**Fixed In:** — *(commit hash or PR)*
**Fix Description:** —
