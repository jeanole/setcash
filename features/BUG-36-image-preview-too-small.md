# BUG-36: Crop Selection Area Is Too Small in Crop Modal

**Status:** Resolved
**Reported:** 2026-03-08
**Severity:** Medium
**Skill Tag:** [Frontend]
**Feature:** [PROJ-7: Bills Feature](PROJ-7-bills-feature.md)

---

## Description

### Expected Behavior
When the crop modal opens after selecting an image, the crop selection box should cover most of the image area so the user can immediately make a meaningful crop without having to resize from a tiny default.

### Actual Behavior
Cropper.js v2 initializes with a very small default selection box in the center of the image. The user must manually drag the handles to expand it before they can crop, which is tedious and unintuitive.

## Steps to Reproduce

1. Navigate to `/bills/new` or `/bills/[id]`
2. Select an image via the file picker or drag-and-drop
3. The crop modal opens
4. Observe: the crop selection box is very small (default Cropper.js v2 initial size)
5. User must manually resize the selection to cover the desired area

## Environment

- **Browser/Client:** Browser (unspecified)
- **OS:** N/A
- **Screen Size:** N/A
- **Date/Time:** 2026-03-08

## Additional Context

The `CropModal` component (`nextjs/components/bills/CropModal.tsx`) initializes Cropper.js v2 with `new Cropper(img)` and no configuration for the initial selection size. Cropper.js v2 defaults to a small centered selection.

**Fix:** After Cropper initializes, call `getCropperCanvas()` and `getCropperSelection()` on the instance, then use `$change()` on the selection to fill most of the canvas area (with a small padding), using `requestAnimationFrame` to wait for the DOM to settle.

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-08
**Fixed In:** — *(commit hash or PR)*
**Fix Description:** Two-part fix in `CropModal.tsx` and `globals.css`:
1. Added `cropper-canvas { width: 100% !important; height: 100% !important; }` to `globals.css` so the Cropper.js v2 canvas element fills the modal area rather than sizing to the image's natural dimensions.
2. Changed the cropper area inner wrapper from `w-full h-full` flex to `absolute inset-0` so it stretches to fill the fixed-height container reliably.
3. After `new Cropper(img)`, used `requestAnimationFrame` + `getCropperSelection().$change()` to expand the initial selection to fill ~90% of the canvas (5% padding), replacing the default tiny centered box.
