# BUG-31 — Images Not Visible After Upload in New Bill Form

**Status:** Open
**Severity:** High
**Feature:** [PROJ-7](PROJ-7-bills-feature.md)
**Filed:** 2026-03-08
**Skill:** [Frontend]
**Fixed In:** —

---

## Summary

When uploading images on the new bill form, the uploaded files are not displayed visually. Users cannot see, review, or delete images after clicking "Upload X files". The `existingImages` prop on `BillImageUpload` is rendered only as a text count ("X image(s) already uploaded"), with no thumbnails, preview, or delete buttons.

---

## Steps to Reproduce

1. Navigate to `/bills/new`
2. Select one or more image files using the file picker
3. Click "Upload X files"
4. Observe: files are acknowledged with a text count but no visual thumbnails appear
5. There is no way to see which images are staged, review them, or remove individual files

---

## Expected Behavior

After selecting and uploading files:
- A visual grid of image thumbnails should appear
- Each thumbnail should have an "×" / delete button to remove the file
- Existing images attached to a bill (on edit) should also show as thumbnails with delete capability
- Users should be able to review all staged images before saving the bill

---

## Actual Behavior

The component shows plain text: "X image(s) already uploaded" with no thumbnails. Staged files are moved to `pendingFiles` state in the parent (`new/page.tsx`) and passed back as `existingImages`, but `BillImageUpload` only renders a count — making it impossible to see, review, or remove individual images.

---

## Root Cause

`nextjs/components/bills/BillImageUpload.tsx` — the `existingImages` prop is rendered as a text label only (e.g. `"{existingImages.length} image(s) already uploaded"`). There is no thumbnail grid, `<img>` element, or per-image delete button for either existing images or newly staged files.

---

## Environment

- Route: `/bills/new`
- Browser: any
- OS: any

---

## Additional Context

This affects both:
- **New bill page**: staged files are invisible after clicking "Upload"
- **Edit bill page**: existing images attached to a bill cannot be previewed or individually deleted

The fix requires adding a thumbnail grid to `BillImageUpload` for `existingImages`, with per-image remove capability. Image URLs for existing images come from `bill.imageUrls` (array of signed URLs from the API).
