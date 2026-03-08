# BUG-36: Uploaded Image Previews Displayed Too Small

**Status:** Open
**Reported:** 2026-03-08
**Severity:** Medium
**Skill Tag:** [Frontend]
**Feature:** [PROJ-7: Bills Feature](PROJ-7-bills-feature.md)

---

## Description

### Expected Behavior
Image previews in the upload component should be large enough to be clearly identifiable — users should be able to see what image they've selected before submitting.

### Actual Behavior
The thumbnail previews of selected/uploaded images are displayed very small, making it difficult to verify the correct files were chosen.

## Steps to Reproduce

**New bill form:**
1. Navigate to `/bills/new`
2. Select one or more images via the file picker or drag-and-drop
3. Observe the thumbnail previews — they appear very small

**Bill detail page:**
1. Navigate to `/bills/[id]`
2. Scroll to the "Add More Images" section
3. Select images
4. Observe the thumbnail previews — they appear very small

## Environment

- **Browser/Client:** Browser (unspecified)
- **OS:** N/A
- **Screen Size:** N/A
- **Date/Time:** 2026-03-08

## Additional Context

The preview thumbnails are rendered inside `BillImageUpload` (`nextjs/components/bills/BillImageUpload.tsx`). The grid and image sizing CSS classes on the thumbnail container likely need to be increased. The `existingImages` thumbnail grid (added in BUG-31 fix) and the selected `files` preview list both appear affected.

---

## Resolution

**Status:** Open
**Resolved Date:** —
**Fixed In:** — *(commit hash or PR)*
**Fix Description:** —
