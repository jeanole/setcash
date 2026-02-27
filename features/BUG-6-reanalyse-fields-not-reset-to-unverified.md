# BUG-6: Re-analyse Does Not Reset Fields to Unverified State

**Status:** Resolved
**Reported:** 2026-02-27
**Severity:** High
**Skill Tag:** [Frontend]
**Feature:** [PROJ-1: OCR / AI Bill Analysis](PROJ-1-ocr-bill-analysis.md)

## Description

After triggering re-analysis on a bill that was previously analysed and verified, the re-analysed fields do not show the amber "AI — please verify" badge and "✓ Verified" button. Fields appear as plain text with no visual indication they need review, even though they were just overwritten by a new AI scan.

### Expected Behavior
After re-analysis completes, all fields that were overwritten by the new AI scan are marked as unverified: they show the amber highlight, the "AI — please verify" badge, and the "✓ Verified" button — regardless of whether those fields were previously verified.

This is explicitly required by CR-5 AC: _"After re-analysis, all overwritten fields are marked unverified (amber badge + verify button) regardless of prior verification state."_

### Actual Behavior
Re-analysis runs and fields are overwritten with new values, but no amber verification badges or verify buttons appear. The user cannot tell which fields were changed by the AI and has no way to confirm them.

## Steps to Reproduce
1. Open a bill that has already been analysed (has `ocr_status = 'done'`)
2. Verify one or more AI-filled fields (clear the amber badges)
3. Click "Re-analyse" and confirm
4. Wait for re-analysis to complete
5. Observe: fields have new values but show no amber highlighting or verification UI

## Environment
- **Browser/Client:** N/A
- **OS:** N/A
- **Screen Size:** N/A

## Additional Context
The root cause is likely that `triggerBillAnalysis()` does not call `clearOcrFieldHighlights()` + `applyOcrFieldHighlights()` after the OCR polling completes. The existing OCR polling flow (`startOcrPolling`) updates `bill.ocrFields` and `bill.ocrStatus` in state but may not re-apply the highlights in the open detail modal.

---

## Resolution
**Status:** Resolved
**Resolved Date:** 2026-02-27
**Fixed In:** d44367648aab8a31b03bfc4d6c35db00a5a11f33
**Fix Description:** `runOcrJob` now detects re-analysis by checking if `ocr_status` was previously set. On re-analysis, `isReanalysis = true` causes `fieldChecks` to overwrite all OCR-extracted fields (not just empty ones), ensuring `ocr_fields` is populated and amber verification badges are applied after polling completes.
