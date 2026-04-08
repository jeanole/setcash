# Frontend Implementation Plan — PROJ-1 CR-4 + CR-5

## Feature
PROJ-1: OCR / AI Bill Analysis — pending CRs
- CR-4: Analyse Button + Field Verification in Upload Modal
- CR-5: Re-Analyse Button for Already-Analysed Bills
Spec: `features/PROJ-1-ocr-bill-analysis.md`

## Context Summary
- PROJ-1 core + CR-1/CR-2/CR-3 all deployed; CR-4 and CR-5 are Pending Review
- The app is vanilla HTML/JS with Tailwind CSS classes
- Upload form: `public/index.html` lines 290-464 (tab-upload pane), submit handler in `public/js/core.js` lines 380-477
- Upload form fields: photos, type, brutto19/7/0, vendor, item, comment, motive/category allocations. **No date field in upload form** (date is auto-set to `new Date().toISOString()` on the server)
- Bill detail modal: `public/js/bills.js` has `triggerBillAnalysis()` (line 922), `showAnalyseButton()` (line 910), `applyOcrFieldHighlights()` (line 735), `verifyOcrField()` (line 814)
- OCR analyse endpoint: `POST /api/bills/:id/analyse` — requires a saved bill ID, fires `runOcrJob` in background, returns 202
- OCR polling: `startOcrPolling(billId)` polls `GET /api/bills/:id` until `ocrStatus` changes from "pending"

## Open Bug Reports to Address
None — all PROJ-1 bugs resolved.

## Key Architecture Decision: CR-4

**Problem:** The current analyse endpoint requires a saved bill (`POST /api/bills/:id/analyse`). CR-4 wants analysis _during upload, before saving_.

**Chosen approach: Two-step save-then-analyse**
1. When user clicks "Analyse" in the upload form, first save the bill immediately via `POST /upload` (existing endpoint) — this creates the bill with images
2. Then immediately trigger `POST /api/bills/:id/analyse` on the newly created bill
3. Poll for results via `startOcrPolling(billId)`
4. When OCR completes, pre-fill the form as an "edit view" — switch the upload form into an edit mode showing the OCR results with verification badges
5. User reviews/verifies fields and clicks "Save Changes" which calls `PUT /api/bills/:id`

**Why this approach:**
- No new backend endpoints needed — reuses existing `/upload`, `/api/bills/:id/analyse`, and `PUT /api/bills/:id`
- The bill is saved as a draft (status="draft" when vendor is empty and amounts are 0), so it's safe to save before OCR fills in values
- This matches the existing backend flow exactly

**UX flow:**
1. User attaches photo(s) → "Analyse" button appears
2. User clicks "Analyse" → button shows "Saving & Analysing..." spinner
3. Behind the scenes: POST /upload saves draft bill → POST /api/bills/:id/analyse triggers OCR → poll for results
4. When done: form switches to edit mode with OCR results pre-filled + amber verification badges
5. User reviews, verifies fields, clicks "Save Changes" (PUT /api/bills/:id)
6. On success: form resets, user sees success message

## Changes

### CR-5: Re-Analyse Button (simpler, do first)

**File: `public/js/bills.js`**

1. **Modify `showAnalyseButton(bill)` (line 910):**
   - If `bill.ocrStatus === "done"` or (`bill.ocrFields && bill.ocrFields.length > 0`): label = "Re-analyse"
   - Otherwise: label = "Analyse"
   - Store the label state on the button

2. **Modify `triggerBillAnalysis()` (line 922):**
   - Before triggering: check if bill has existing OCR results
   - If yes: show `confirm("This will re-analyse the bill and overwrite all AI-filled fields. Continue?")`
   - If user cancels: return early, do nothing
   - If user confirms or no prior analysis: proceed as before

3. **Modify `triggerBillAnalysisFromList(billId)` (line 957):**
   - Same confirm logic for list-level "Analyse" button
   - Update the button text in `renderFilteredBills()` to show "Re-analyse" when appropriate (line 301 template)

### CR-4: Analyse Button in Upload Modal

**File: `public/index.html`**

1. **Add "Analyse" button to upload form** — between the photo area and the Type field:
   ```html
   <div id="uploadAnalyseSection" style="display: none">
       <button type="button" id="uploadAnalyseBtn"
           onclick="triggerUploadAnalysis()"
           class="text-sm px-4 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors border border-amber-200 cursor-pointer flex items-center gap-2">
           <svg ...> <!-- small scan/sparkle icon -->
           Analyse
       </button>
       <div id="uploadAnalyseStatus" class="hidden text-sm mt-2"></div>
   </div>
   ```

**File: `public/js/bills.js`** (or a new section in `core.js`)

2. **Show/hide Analyse button based on photo state:**
   - In the existing `renderUploadThumbnails()` or photo change handlers:
     if `pendingFiles.length > 0 && projectOcrEnabled` → show `#uploadAnalyseSection`
     else → hide it

3. **New function `triggerUploadAnalysis()`:**
   ```
   async function triggerUploadAnalysis() {
     // 1. Disable button, show "Saving & Analysing..."
     // 2. Build FormData from current upload form fields + pendingFiles
     // 3. POST /upload → get { ok: true, billId: N }
     // 4. POST /api/bills/:billId/analyse → get { ok: true }
     // 5. Poll via startOcrPolling(billId) with a callback
     // 6. When OCR completes:
     //    a. Fetch GET /api/bills/:billId for full bill data
     //    b. Switch upload form into "edit mode":
     //       - Store billId in a variable (uploadEditBillId)
     //       - Pre-fill all form fields with OCR-extracted values
     //       - Apply OCR field highlights (amber badges + verify buttons)
     //       - Change submit button text to "Save Changes"
     //       - Change form submit handler to PUT /api/bills/:billId
     //    c. Show success message
     // 7. On error: show inline error, re-enable button
   }
   ```

4. **Modify upload form submit handler** (in `core.js` line 382):
   - Check if `uploadEditBillId` is set
   - If yes: submit as PUT /api/bills/:id instead of POST /upload
   - Include `ocrFields` tracking (which fields are still unverified)
   - On success: reset form + clear uploadEditBillId

5. **OCR field highlighting in upload form:**
   - Need a fieldMap for upload form IDs (different from detail form IDs):
     ```
     uploadFieldMap = {
       date: null,  // no date field in upload form
       vendor: uploadForm.vendor,
       item: uploadForm.item,
       type: uploadForm.type,
       brutto19: uploadForm.brutto19,
       brutto7: uploadForm.brutto7,
       brutto0: uploadForm.brutto0,
       comment: uploadForm.comment
     }
     ```
   - Apply same amber highlight + verify button pattern
   - Track verified fields client-side in a Set

6. **Reset function** — when switching away from upload tab or after successful save:
   - Clear `uploadEditBillId`
   - Clear all OCR highlights from upload form
   - Reset button text back to "Upload"

## Files to Modify

| File | Changes |
|------|---------|
| `public/js/bills.js` | CR-5: modify `showAnalyseButton()`, `triggerBillAnalysis()`, `triggerBillAnalysisFromList()`, bill list template; CR-4: add `triggerUploadAnalysis()`, `applyUploadOcrHighlights()`, upload field verification tracking |
| `public/js/core.js` | CR-4: modify upload form submit handler to support edit mode, show/hide analyse button on photo changes |
| `public/index.html` | CR-4: add analyse button + status area in upload form |

No new npm packages. No backend changes needed.

## Checklist

### CR-5
- [ ] Analyse button shows "Re-analyse" when bill has existing OCR results
- [ ] Clicking "Re-analyse" shows confirmation dialog
- [ ] Cancelling confirmation does nothing
- [ ] Confirming triggers re-analysis normally
- [ ] List-level button also shows "Re-analyse" and has confirmation
- [ ] First-time "Analyse" has no confirmation (works as before)

### CR-4
- [ ] "Analyse" button appears in upload form when photos attached + OCR enabled
- [ ] Button hidden when no photos
- [ ] Clicking "Analyse" saves draft bill and triggers OCR
- [ ] Loading spinner shown during save + analysis
- [ ] On OCR success: form fields pre-filled with extracted values
- [ ] OCR-filled fields show amber highlight + "AI - please verify" + verify button
- [ ] Verify button clears highlight client-side
- [ ] Submit button changes to "Save Changes" after analysis
- [ ] Submitting after analysis calls PUT (not POST /upload)
- [ ] Unverified fields tracked in ocr_fields on save
- [ ] OCR failure shows inline error in upload form
- [ ] Normal upload (without analyse) works unchanged
- [ ] Form resets cleanly after successful save
- [ ] All dynamic content uses escapeHtml() for XSS safety
