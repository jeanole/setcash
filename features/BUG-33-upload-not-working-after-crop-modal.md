# BUG-33: Upload Not Working After Crop Modal

**Status:** Resolved
**Reported:** 2026-03-08
**Severity:** Critical
**Skill Tag:** [Frontend]
**Feature:** [PROJ-7: Bills Feature](PROJ-7-bills-feature.md)

---

## Description

### Expected Behavior
After clicking "Crop & Save" or "Skip" in the image crop modal, the image should be uploaded and displayed in the bill form (shown as a thumbnail in the image wheel/preview grid).

### Actual Behavior
The crop modal closes but nothing happens — no upload occurs and no image appears. The form remains as if no file was selected.

## Steps to Reproduce

1. Navigate to the new bill upload page
2. Select or capture an image file (triggers the crop modal)
3. Click "Crop & Save" or "Skip" in the crop modal

## Environment

- **Browser/Client:** Browser (unspecified)
- **OS:** N/A
- **Screen Size:** N/A
- **Date/Time:** 2026-03-08

## Additional Context

N/A

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-08
**Fixed In:** fix(BUG-33) commit
**Fix Description:** `processNextFile()` in `BillImageUpload.tsx` cleared `processedFilesRef.current = []` synchronously after calling `setFiles((prev) => [...prev, ...processedFilesRef.current])`. Since React's functional state updater runs deferred (during reconciliation), the ref was already empty by the time the updater executed. Fix: snapshot the ref into a local variable before clearing it.
