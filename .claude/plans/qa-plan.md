# QA Test Plan — PROJ-1 Round 5

## Feature
PROJ-1: OCR / AI Bill Analysis
Spec: `features/PROJ-1-ocr-bill-analysis.md`

## Context Summary
**Focus:** Verify R4-1 fix (commit `02e47d3`) — date field now wired through upload and save-after-OCR payloads.

**Changes made in the fix (3 edits):**
1. `public/js/core.js` ~L446: Added `data.append("date", form.date.value)` to upload POST FormData
2. `public/js/core.js` ~L559: Added `date: form.date.value` to `saveUploadEditBill()` PUT payload
3. `routes/bills.js` ~L167/211: Destructured `date` from `req.body`; uses `date || new Date().toISOString()` in INSERT

## User Guidance
- **Focus:** R4-1 fix verification only
- **Credentials:** admin@example.com / adminadminA1
- **Environment:** http://localhost:3000

---

## Test 1: Fix 1 — Upload POST FormData includes date

### Code checks:
- [ ] `public/js/core.js` upload FormData section now has `data.append("date", form.date.value)`
- [ ] The date append occurs BEFORE the `apiFetch("/upload", ...)` call
- [ ] The field name `"date"` matches the HTML input's `name="date"` attribute in the upload form

---

## Test 2: Fix 2 — saveUploadEditBill PUT payload includes date

### Code checks:
- [ ] `public/js/core.js` `saveUploadEditBill()` payload object includes `date: form.date.value`
- [ ] The property name `date` matches what the PUT handler in `routes/bills.js` destructures from `req.body`

---

## Test 3: Fix 3 — POST /upload handler reads date from req.body

### Code checks:
- [ ] `routes/bills.js` POST /upload handler destructures `date` from `req.body`
- [ ] INSERT statement uses `date || new Date().toISOString()` (not hardcoded `new Date().toISOString()`)
- [ ] Fallback to current timestamp preserved for callers that don't send date (Telegram, legacy)

---

## Test 4: End-to-end date flow verification

### Normal upload path (no OCR):
- [ ] User fills in date field in upload form → date value is included in FormData → backend stores the user-provided date (not server timestamp)

### OCR upload path (Analyse in upload modal):
- [ ] OCR extracts a date → `pollUploadOcr` pre-fills the date input → user clicks Save → date is in the PUT payload → backend stores OCR-extracted date
- [ ] If user edits the OCR date before saving → edited value is stored, `"date"` removed from `ocr_fields`
- [ ] If user verifies the OCR date (clicks Verified) → date saved as-is, `"date"` removed from `ocr_fields`

### No date provided:
- [ ] Upload without filling date field → backend falls back to `new Date().toISOString()` (backward compat)

---

## Test 5: Regression checks

- [ ] `pollUploadOcr()` still pre-fills the date input from the bill data after OCR completes
- [ ] `applyUploadOcrHighlights()` still highlights the date field with amber badge when OCR fills it
- [ ] PUT /api/bills/:id still processes date changes and strips `"date"` from `ocr_fields` (R3-1 fix intact)
- [ ] Normal upload (no OCR) flow unaffected — form submits, bill created correctly
- [ ] Telegram uploads still work (no date in request → fallback to server timestamp)

---

## Test 6: Security spot-check

- [ ] Date field value is not used in any unsafe context (no innerHTML, no SQL concatenation)
- [ ] Date goes through parameterized query in the INSERT
- [ ] No XSS vector introduced via date input

---

## Still-open items (not retesting, just confirm status):
- R4-2 (Low): settings.js SSRF defense-in-depth gap — non-blocking
- R4-3 (Low): settings.js provider default — non-blocking
- R3-2 (Low): cosmetic label inconsistency — non-blocking

## Test Credentials
- URL: http://localhost:3000
- Admin: admin@example.com / adminadminA1
