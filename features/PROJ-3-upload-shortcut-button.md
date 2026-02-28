# PROJ-3: Upload Shortcut Button in Bills Table

## Status: Planned
**Created:** 2026-02-27
**Last Updated:** 2026-02-27

## Dependencies
- None (UI-only addition — reuses existing upload form markup)

---

## Overview

Add a prominent "+ Upload" button in the header area of the Bills table. Clicking it opens the upload form in a modal overlay so the user can submit a new bill without leaving the Bills view. On successful submission, the modal closes and the Bills table refreshes in place.

---

## User Stories

- As a **project member**, I want a visible "+ Upload" button on the Bills page so that I can submit a new bill directly from the list, without navigating away.
- As a **project member**, I want the upload form to appear as a modal so that I stay on the Bills view and see my new bill appear immediately after submission.
- As a **project member**, I want to be able to dismiss the modal without submitting, leaving the Bills list unchanged.

---

## Acceptance Criteria

- [ ] A "+ Upload" button is displayed in the header area of the Bills table (`#tab-bills`), next to or near the "All Bills" heading
- [ ] The button is visible to all logged-in project members (not admin-only)
- [ ] Clicking the button opens the upload form in a modal overlay (not a pane switch)
- [ ] The modal contains the same upload form fields as the existing Upload pane (photo, date, vendor, item, type, amounts, motive/category allocation)
- [ ] The modal can be dismissed (via ✕ button or clicking outside) without submitting anything
- [ ] On successful submission, the modal closes and the Bills table reloads to show the new bill
- [ ] The button uses the "+" symbol to signal "add new"
- [ ] The button style is consistent with the existing app UI (Tailwind utility classes, no inline styles)
- [ ] The button and modal are usable on mobile (375px), tablet (768px), and desktop (1440px)

---

## Edge Cases

- **Submit fails (server error):** Error message shown inside the modal; modal stays open so the user can retry or fix input.
- **User closes modal mid-fill:** Form state is discarded; Bills table is unchanged.
- **Mobile layout:** Modal is full-screen or near-full-screen on small viewports; button does not overflow the "All Bills" heading row.
- **User has no project selected:** Bills pane is already inaccessible; button inherits the same guard.
- **Duplicate submission (double-click):** Submit button disabled during in-flight request to prevent duplicate bills.

---

## Technical Requirements

- Frontend-only change — no new API endpoints, no DB changes
- Reuses the existing upload form fields and submission logic from the Upload pane
- The existing `POST /upload` endpoint handles the submission unchanged
- Files to modify: `public/index.html` (modal markup + button), `public/js/bills.js` (open/close modal, refresh table on success)
- No new npm packages

---

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results

---

**Tested:** 2026-02-28
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Source code inspection — `public/index.html`, `public/js/bills.js`, `public/js/core.js`, `public/js/utils.js`, `routes/bills.js`, `server.js`

---

### Acceptance Criteria Status

#### AC-1: "+ Upload" button displayed in Bills table header
- [x] Button present in `#tab-bills` at lines 488-491 of `public/index.html`
- [x] Placed inside `div.flex.items-center.justify-between.mb-4` next to the "All Bills" `<h2>`

**Result: PASS**

#### AC-2: Button visible to all logged-in project members (not admin-only)
- [x] Button element has no `admin-only` class and is not conditionally rendered by any JS `isAdmin` guard
- [x] `openUploadModal()` function in `public/js/bills.js` has no admin/role check
- [x] The `#tab-bills` pane is shown to all project members — button inherits that gate correctly

**Result: PASS**

#### AC-3: Clicking the button opens upload form in a modal overlay (not a pane switch)
- [x] `openUploadModal()` sets `modal.style.display = "flex"` directly — no `switchPane()` call
- [x] Modal is `position: fixed; inset: 0` (z-index 1300) — Bills table remains behind it in the DOM
- [x] Backdrop click listener: `onclick="if(event.target===this)closeUploadModal()"` on the modal wrapper

**Result: PASS**

#### AC-4: Modal contains same upload form fields as existing Upload pane
- [x] `openUploadModal()` physically moves the existing `#uploadForm` card from `#tab-upload` into `#uploadModalBody`
- [x] All fields present: photo upload, type select, brutto19/7/0, vendor, item, comment, date (type="date"), motive allocation widget, category allocation widget
- [x] Date field (`name="date"`, type="date") confirmed present at line 447-450 of `public/index.html`

**Result: PASS**

#### AC-5: Modal can be dismissed without submitting
- [x] Close (×) button: `onclick="closeUploadModal()"` at line 2298 of `public/index.html`
- [x] Backdrop click: `onclick="if(event.target===this)closeUploadModal()"` on outer div
- [x] `closeUploadModal()` does NOT call form.submit(); it moves the card back to `#tab-upload` and hides the modal
- [x] `closeUploadModal()` resets form (when called without `skipReset`): calls `form.reset()`, clears `pendingFiles`, re-initializes allocation widgets

**Result: PASS**

#### AC-6: On successful submission, modal closes and Bills table reloads
- [x] Modal closes: success path in `core.js` (line 488-490) correctly calls `closeUploadModal(true)` when modal is open
- [ ] **BUG:** Bills table does NOT reload after successful standard (non-OCR) upload via modal. The success path in `core.js` (lines 466-490) calls `closeUploadModal(true)` but there is no subsequent call to `loadBills()` or `loadProjectData()`. The new bill will not appear in the Bills table until the user manually navigates away and back.
  - *Note: The OCR save path `saveUploadEditBill()` at line 597 correctly calls `loadProjectData()` — but only for the OCR flow.*

**Result: FAIL** — see BUG-1

#### AC-7: Button uses "+" symbol
- [x] Button text is `+ Upload` (line 490 of `public/index.html`)

**Result: PASS**

#### AC-8: Button style consistent with app UI — Tailwind classes, no inline styles
- [x] Button classes: `text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-1.5` — all Tailwind utilities, no `style=""` attribute
- [x] Modal outer wrapper uses `style="display:none"` — this is a JS visibility toggle pattern used consistently across all other modals in the app (same approach as `#billModal`, `#imageModal`, `#newProjectModal`), not a bespoke inline style
- [x] Modal inner container uses only Tailwind classes

**Result: PASS**

#### AC-9: Button and modal usable on mobile (375px), tablet (768px), desktop (1440px)
- [x] Modal outer: `p-4 md:p-5` — responsive padding; `w-full max-w-2xl` caps width on desktop
- [x] Modal inner: `max-h-[90vh] overflow-y-auto` — scrollable on short viewports
- [x] Button in heading row: both heading and button are small elements in a `flex items-center justify-between` row — expected to fit on 375px without overflow
- [ ] **BUG (Low):** No responsive truncation or wrapping guard on the heading row. On very narrow screens below 375px the heading "All Bills" and "± Upload" button could visually collide, but this is below the minimum supported breakpoint so it is low severity.
- [x] No critical overflow risk at 375px given the button label is only "+ Upload" (8 chars)

**Result: PASS** (minor note logged as low-severity BUG-4)

---

### Edge Cases Status

#### EC-1: Submit fails (server error) — error shown in modal, modal stays open
- [x] On non-OK JSON response, `showMessage("uploadResult", "Error: ...", true)` is called — this renders into `#uploadResult` which is inside the card that was moved into the modal, so the error IS visible inside the modal
- [x] Modal is NOT closed on error — only the success branch calls `closeUploadModal()`
- [ ] **BUG (Medium):** Error message auto-disappears after 3 seconds due to `showMessage`'s hardcoded `setTimeout` (line 38 of `utils.js`). User must retry quickly or will lose the error context with no visual indication of what went wrong.

**Result: PARTIAL** — error shows correctly but disappears after 3 s (BUG-2)

#### EC-2: User closes modal mid-fill — form state discarded, Bills table unchanged
- [x] `closeUploadModal()` (no `skipReset` arg) calls `form.reset()`, clears `pendingFiles`, re-initializes allocation widgets
- [x] Bills table is not touched — no data mutation on close
- [ ] **BUG (Low):** `closeUploadModal()` calls `typeof renderUploadThumbnails === "function"` to clear the thumbnail preview. However, `renderUploadThumbnails` is declared as a local function inside `init()` in `core.js` (line 327) and is never assigned to `window.renderUploadThumbnails`. The `typeof` guard evaluates to `false` and the thumbnail strip is NOT cleared when the modal is dismissed mid-fill. Stale thumbnail images remain visible when the user opens the modal again — and `pendingFiles` WAS correctly cleared, so the thumbnails will be out of sync with the actual pending files array.

**Result: PARTIAL** — state is mostly reset, but thumbnail preview retains stale images (BUG-3)

#### EC-3: Mobile layout — modal near-full-screen, button doesn't overflow heading row
- [x] Modal fills viewport minus 16px padding on mobile (`p-4`) — near-full-screen behaviour
- [x] Button is compact (fits in heading row at 375px)

**Result: PASS**

#### EC-4: No project selected — Bills pane inaccessible; button inherits the same guard
- [x] `#tab-bills` is only shown when `switchPane("bills")` is called, which requires `loadProjectData()` to have run after a project is selected. `openUploadModal()` is inside `#tab-bills` and therefore only reachable when a project is active.

**Result: PASS**

#### EC-5: Duplicate submission (double-click) — submit button disabled during in-flight request
- [ ] **BUG (High):** In the standard upload submit handler (`core.js` lines 385-494), the submit button is **never disabled** before `apiFetch("/upload", ...)` is awaited. A user who double-clicks the Upload button will fire two concurrent POST requests to `/upload`, potentially creating two duplicate bill records. Only the OCR save path (`saveUploadEditBill`, line 548) disables the submit button. This is the pattern specified in AC edge case "Duplicate submission."

**Result: FAIL** — see BUG-5

---

### OCR Interaction Results

#### OCR-1: Modal upload triggers OCR analysis on uploaded image
- [x] The standard upload submit uses `apiFetch("/upload", ...)` — same `POST /upload` endpoint as the Upload pane
- [x] The Analyse with AI button (`triggerUploadAnalysis()`) and the OCR polling pipeline are part of the same moved form card — they are present and functional in the modal context

**Result: PASS**

#### OCR-2: OCR field results populated correctly after modal upload
- [x] `pollUploadOcr()` pre-fills form fields and calls `applyUploadOcrHighlights()` — same behaviour in and out of modal since the form elements are physically the same DOM nodes

**Result: PASS**

#### OCR-3: CSRF token included in modal upload request
- [x] Standard upload submit: `apiFetch("/upload", ...)` — `apiFetch` in `utils.js` (line 73-87) calls `withCsrf()` which injects `X-CSRF-Token` header for POST requests
- [x] OCR trigger: `apiFetch("/api/bills/" + billId + "/analyse", ...)` — also uses `apiFetch`
- [x] OCR polling (`fetch("/api/bills/.../ocr-status")`) and bills list reload (`fetch("/api/bills")`) use raw `fetch()` but are GET requests — CSRF not required for GET

**Result: PASS**

#### OCR-4: Date field present and wired through in modal form (regression for PROJ-1 R4-1)
- [x] Date field (`<input type="date" name="date">`) present in `#uploadForm` markup (line 447-450 of `index.html`)
- [x] Date field IS included in the standard upload FormData: `data.append("date", form.date.value)` at line 446 of `core.js`
- [x] Date field IS included in `saveUploadEditBill` payload: `date: form.date.value` at line 564 of `core.js`
- [ ] **BUG (Medium — Regression):** In `triggerUploadAnalysis()` (`bills.js` lines 1138-1182), the draft bill is saved to `/upload` via FormData but the `date` field is **not appended**: lines 1141-1153 append `type`, `brutto19`, `brutto7`, `brutto0`, `vendor`, `item`, `comment`, and photo files — but `data.append("date", ...)` is missing. The date entered by the user before clicking "Analyse with AI" is dropped from the draft bill. This is a regression of the PROJ-1 R4-1 fix (which wired date through the standard submit but not through the OCR draft save).

**Result: PARTIAL** — date wired in standard and OCR-edit paths, missing in OCR draft path (BUG-6)

---

### Security Audit Results

#### SEC-1: POST /upload unchanged and still requires auth
- [x] `POST /upload` is mounted at line 157 of `routes/bills.js` with `ensureProjectAccess` middleware — confirmed unchanged
- [x] No new endpoints introduced by PROJ-3

**Result: PASS**

#### SEC-2: Modal form uses `apiFetch()` — no CSRF bypass
- [x] Standard upload submit: `apiFetch("/upload", ...)` — CSRF token injected
- [x] OCR trigger: `apiFetch("/api/bills/.../analyse", ...)` — CSRF token injected
- [x] All state-mutating calls go through `apiFetch`

**Result: PASS**

#### SEC-3: Client-side file-type/size validation — check for bypass risk
- [x] Client side: `<input accept="image/*">` — browser-enforced but trivially bypassable (any `curl` call or modified request will bypass it)
- [ ] **BUG (Medium — Security):** `multer` is configured with only a size limit (`fileSize: 10MB`) and no `fileFilter` to validate MIME type on the server side (`server.js` line 58). A malicious actor can POST any file type (e.g., SVG with embedded script, HTML, PHP) to `POST /upload`. The uploaded file is stored on disk and served back via `/uploads/*` with the extension preserved (`routes/bills.js` line 798). If the web server or a downstream viewer renders the uploaded file, a stored XSS or SSRF vector exists. This is a pre-existing weakness surfaced by this audit — not introduced by PROJ-3 — but falls within the security audit scope.

**Result: PARTIAL** — no new bypass introduced by PROJ-3, but pre-existing server-side file-type validation gap confirmed (BUG-7)

#### SEC-4: XSS — user-supplied values rendered in modal
- [x] `showMessage()` uses `el.textContent = text` — not `innerHTML`, so XSS-safe
- [x] `escapeHtml()` used in `saveUploadEditBill` error paths (lines 599, 603 of `core.js`)
- [x] `statusDiv.textContent` used in OCR error/success messages — not `innerHTML`
- [ ] **Note (Low):** Standard upload error at `core.js` line 492 renders `json.error` via `showMessage()` without calling `escapeHtml()` first — however `showMessage` uses `textContent` not `innerHTML`, so this is safe in practice. No actionable XSS risk.

**Result: PASS**

#### SEC-5: No secrets or credentials in new JS code
- [x] `bills.js` lines added by PROJ-3 (openUploadModal, closeUploadModal functions) contain no hardcoded secrets, tokens, or credentials

**Result: PASS**

---

### Regression Test Results

#### REG-1: Existing Upload pane (non-modal) still works after PROJ-3 changes
- [x] The Upload pane (`#tab-upload`) still contains `#uploadForm` when the modal is not open — `openUploadModal` moves the card into the modal and `closeUploadModal` moves it back. When the modal has never been opened, the pane is unaffected.
- [x] All submit-handler wiring in `core.js` attaches to the DOM element once at `DOMContentLoaded` — the event listener persists through DOM moves (listeners survive `appendChild`)
- [x] `loadBills()` and allocation widget initialization in `core.js` `loadProjectData()` are independent of the modal

**Result: PASS**

#### REG-2: Bills table loads normally without modal open
- [x] `loadBills()` function unmodified; `#billsBody` and filter bar are inside `#tab-bills` which is unaffected by the upload card move

**Result: PASS**

#### REG-3: PROJ-1 OCR flow via standard Upload pane unaffected
- [x] `triggerUploadAnalysis()`, `pollUploadOcr()`, `applyUploadOcrHighlights()`, `clearAllUploadOcrHighlights()` are unchanged by PROJ-3
- [ ] **BUG-6 (see OCR-4):** The date regression in `triggerUploadAnalysis` affects both the Upload pane and the modal Upload — pre-existing in PROJ-1 or introduced during PROJ-3 integration, now confirmed by this audit.

**Result: PASS** (with caveat — BUG-6 is shared with the standard Upload pane)

---

### Bugs Found

#### BUG-1: Bills table does not reload after successful upload via modal
- **Severity:** High
- **Skill:** [Frontend]
- **Steps to Reproduce:**
  1. Open the Bills tab
  2. Click "+ Upload" to open the upload modal
  3. Fill in required fields and click "Upload"
  4. Observe: modal closes, but the Bills table does not refresh — new bill does not appear until the user leaves and returns to the Bills tab
- **Root Cause:** `core.js` upload success path (line 466-490) calls `closeUploadModal(true)` but does not call `loadBills()` or `loadProjectData()` afterwards
- **Expected:** Bills table reloads immediately after successful upload (per AC-6)
- **Actual:** Table retains stale data; user must manually navigate away and back
- **Priority:** Fix before deployment

#### BUG-2: Upload error message disappears after 3 seconds in modal
- **Severity:** Medium
- **Skill:** [Frontend]
- **Steps to Reproduce:**
  1. Open the upload modal
  2. Submit with a server error condition (e.g., disconnect network)
  3. Error message appears inside modal
  4. Wait 3 seconds: error message silently disappears
  5. Modal is still open, form is unchanged — user has no persistent indication of failure
- **Root Cause:** `showMessage()` in `utils.js` (line 38) has a hardcoded 3-second `setTimeout` that clears any message, including error messages. This is appropriate for transient success feedback but not for error states where the user needs to take action.
- **Expected:** Error message persists in modal until user interacts (retries or closes)
- **Actual:** Error message vanishes after 3 seconds
- **Priority:** Fix before deployment

#### BUG-3: Stale thumbnail images shown when upload modal is reopened after mid-fill close
- **Severity:** Low
- **Skill:** [Frontend]
- **Steps to Reproduce:**
  1. Open the upload modal
  2. Add one or more photos (thumbnails appear)
  3. Close the modal without submitting (× button or backdrop click)
  4. Reopen the modal
  5. Observe: photo thumbnails from the previous session are still visible even though no files are actually pending
- **Root Cause:** `closeUploadModal()` in `bills.js` (line 1371) checks `typeof renderUploadThumbnails === "function"` to clear the thumbnail strip, but `renderUploadThumbnails` is declared as a local function inside `init()` in `core.js` (line 327) and never exposed to the global scope. The guard always evaluates to `false`, so thumbnail clearing is silently skipped. `pendingFiles` IS correctly cleared (line 1370), creating a mismatch between the UI state and the actual pending files array.
- **Expected:** Thumbnail preview is cleared when the modal is closed
- **Actual:** Stale thumbnails remain visible; `pendingFiles` is empty so they would not be re-uploaded, but the visual state misleads the user
- **Priority:** Fix before deployment

#### BUG-4: No explicit overflow guard on heading row at extreme narrow widths
- **Severity:** Low
- **Skill:** [Frontend]
- **Steps to Reproduce:**
  1. Open the Bills tab on a viewport narrower than ~300px
  2. Observe: "All Bills" heading and "+ Upload" button may collide or wrap unexpectedly
- **Root Cause:** The heading row uses `flex items-center justify-between mb-4` with no `min-width`, `truncate`, or `flex-wrap` — below ~300px the layout could break
- **Expected:** Heading row handles all widths within supported breakpoints gracefully
- **Actual:** At supported minimum (375px) the layout is fine; risk only below 300px
- **Priority:** Nice to have (below minimum supported breakpoint)

#### BUG-5: Submit button not disabled during in-flight upload request — duplicate bill risk
- **Severity:** High
- **Skill:** [Frontend]
- **Steps to Reproduce:**
  1. Open the upload modal and fill in fields
  2. Double-click the "Upload" button rapidly
  3. Two concurrent POST requests are sent to `/upload`
  4. Two bill records are created in the database
- **Root Cause:** The upload form submit handler in `core.js` (lines 385-494) does not disable the submit button before `apiFetch("/upload", ...)` is awaited. Only the OCR save path (`saveUploadEditBill`, line 548) implements the `submitBtn.disabled = true` pattern.
- **Expected:** Submit button is disabled on first click and re-enabled after response
- **Actual:** Button remains enabled throughout the request — double-clicks create duplicate bills
- **Priority:** Fix before deployment

#### BUG-6: Date field missing from OCR draft upload in `triggerUploadAnalysis()` — regression of PROJ-1 R4-1
- **Severity:** Medium
- **Skill:** [Frontend]
- **Steps to Reproduce:**
  1. Open the Upload pane (or upload modal)
  2. Attach a photo and fill in the Date field
  3. Click "Analyse with AI"
  4. Observe: the draft bill is saved without the date value — after OCR completes and you save, the date the user entered before analysis is lost unless OCR extracted it
- **Root Cause:** `triggerUploadAnalysis()` in `bills.js` (lines 1140-1153) builds a FormData object for the draft POST but does not include `data.append("date", form.date.value)`. The standard submit path (line 446 of `core.js`) and the OCR save path (`saveUploadEditBill`, line 564) both correctly include the date field.
- **Expected:** Date entered by user before clicking "Analyse with AI" is preserved in the draft bill
- **Actual:** Date is omitted from the draft POST — the bill is saved without a date until OCR completes (if OCR extracts date) or the user re-enters it
- **Priority:** Fix before deployment

#### BUG-7: No server-side file-type validation on uploaded images — pre-existing security gap
- **Severity:** Medium
- **Skill:** [Backend] [Security]
- **Steps to Reproduce:**
  1. Using `curl` or a modified browser request, POST a non-image file (e.g., an SVG with embedded `<script>`, an HTML file) to `POST /upload`
  2. The file is accepted, stored, and served back via `/uploads/*`
  3. If a browser opens the uploaded file directly (e.g., full-size image view), malicious content may execute
- **Root Cause:** `multer` in `server.js` (line 58) is configured with only a `fileSize` limit: `multer({ limits: { fileSize: 10 * 1024 * 1024 } })`. No `fileFilter` validates `req.file.mimetype` against an allowed list. The `accept="image/*"` attribute on file inputs is client-side only and trivially bypassed.
- **Expected:** Server rejects any uploaded file whose MIME type is not in an approved image list (e.g., `image/jpeg`, `image/png`, `image/webp`, `image/gif`)
- **Actual:** Any file type is accepted and stored
- **Priority:** Fix before deployment (pre-existing, but within security audit scope)

---

### Summary
- **Acceptance Criteria:** 7/9 passed (AC-6 FAIL, AC-9 PARTIAL)
- **Edge Cases:** 3/5 passed (EC-1 PARTIAL, EC-2 PARTIAL, EC-5 FAIL)
- **OCR Interaction:** 3/4 passed (OCR-4 PARTIAL)
- **Security:** 4/5 passed (SEC-3 PARTIAL — pre-existing backend gap)
- **Regression:** 3/3 passed (with BUG-6 caveat shared between pane and modal)
- **Bugs Found:** 7 total (0 critical, 2 high, 3 medium, 2 low)
- **Security:** 1 pre-existing medium-severity backend issue confirmed
- **Production Ready:** NO
- **Recommendation:** Fix BUG-1 (no table reload), BUG-5 (duplicate submit), BUG-3 (stale thumbnails), and BUG-6 (date regression in OCR draft) before deployment. BUG-2 (error message timeout) and BUG-7 (server-side file validation) should also be resolved. BUG-4 is a low-priority cosmetic edge case below the minimum supported breakpoint.

## QA Test Results (Round 2)

---

**Tested:** 2026-02-28
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Method:** Source code inspection — `public/index.html`, `public/js/bills.js`, `public/js/core.js`, `public/js/utils.js`, `routes/bills.js`, `server.js`
**Round 2 Focus:** Bug fix verification (BUG-1 through BUG-7) + full re-test of all ACs, ECs, OCR, Security, and Regression items

---

### Round 1 Bug Fix Verification

#### BUG-1: Bills table does not reload after successful upload via modal
- **Status: FIXED**
- `core.js` lines 490-496: after calling `closeUploadModal(true)`, the success path now calls `loadBills()` unconditionally (not gated on modal state). The fix is correct and covers both modal and non-modal upload paths.
- Regression check: non-modal upload also benefits from the same `loadBills()` call — no regression.

#### BUG-2: Upload error message disappears after 3 seconds in modal
- **Status: FIXED**
- `utils.js` line 38: `if (!isError) setTimeout(() => { el.textContent = ''; el.className = ''; }, 3000)` — the `setTimeout` is now guarded by `!isError`. Error messages persist indefinitely; only success messages auto-clear after 3 seconds.
- Regression check: success messages in all other parts of the app still auto-clear — confirmed unaffected.

#### BUG-3: Stale thumbnails shown when upload modal reopened after mid-fill close
- **Status: FIXED**
- `bills.js` line 1372-1373: `closeUploadModal()` now directly clears thumbnails via `uploadThumbnails.innerHTML = ""` rather than calling the locally-scoped `renderUploadThumbnails`. The DOM is cleared correctly regardless of function scope.
- Regression check: `renderUploadThumbnails` inside `init()` in `core.js` is still used for live thumbnail rendering during file selection — unaffected.

#### BUG-4: Overflow guard below 300px — confirm status
- **Status: ACCEPTED (no fix applied)**
- No responsive truncation or wrapping class was added to the heading row. Accepted as below the minimum supported breakpoint (375px). At 375px the layout is correct.

#### BUG-5: Submit button not disabled during in-flight upload — duplicate bill risk
- **Status: FIXED**
- `core.js` lines 461-462: `submitBtn.disabled = true; submitBtn.textContent = "Uploading..."` is set immediately before `apiFetch("/upload", ...)`. Lines 470 and 498: button is re-enabled in both the success path and the error path.
- Regression check: button re-enables on error so retries are possible — confirmed correct.

#### BUG-6: Date field missing from OCR draft in `triggerUploadAnalysis()` — PROJ-1 regression
- **Status: FIXED**
- `bills.js` line 1148: `data.append("date", form.date.value)` is now present in `triggerUploadAnalysis()` FormData construction, consistent with the standard submit path (`core.js` line 446) and OCR save path (`core.js` line 571).
- Regression check: date field is not double-appended; each path appends it exactly once.

#### BUG-7: No server-side file-type validation in multer
- **Status: FIXED — but a new related bug introduced (see BUG-8)**
- `server.js` lines 58-68: `ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]` and a `fileFilter` function now validate `file.mimetype` against the allowed list. Files with disallowed MIME types trigger `cb(new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed"))`.
- **NEW FINDING:** The `fileFilter` correctly rejects disallowed files, but when it calls `next(err)`, there is no error-handler middleware in the route chain at `/upload`, `/api/bills/:id/images`, or the two `PUT` image-replacement endpoints. Express's built-in error handler will respond with a `500 Internal Server Error` (HTML body), not a `400 Bad Request` (JSON body). This means a rejected file returns an unhandled 500 rather than the expected 4xx JSON `{ error: "..." }`. Logged as BUG-8.

---

### Acceptance Criteria Status

#### AC-1: "+ Upload" button displayed in Bills table header
- [x] Button present in `#tab-bills` at lines 488-491 of `public/index.html`
- [x] Placed inside `div.flex.items-center.justify-between.mb-4` next to the "All Bills" `<h2>`

**Result: PASS**

#### AC-2: Button visible to all logged-in project members (not admin-only)
- [x] Button element has no `admin-only` class and no JS `isAdmin` guard
- [x] `openUploadModal()` in `bills.js` has no role check

**Result: PASS**

#### AC-3: Clicking button opens upload form in a modal overlay (not a pane switch)
- [x] `openUploadModal()` sets `modal.style.display = "flex"` — no `switchPane()` call
- [x] Modal is `position: fixed; inset: 0` with `z-[1300]`

**Result: PASS**

#### AC-4: Modal contains same upload form fields as existing Upload pane
- [x] `openUploadModal()` physically moves `#uploadForm` card into `#uploadModalBody`
- [x] All fields present: photo, type, brutto amounts, vendor, item, comment, date, motive + category allocation widgets

**Result: PASS**

#### AC-5: Modal can be dismissed without submitting
- [x] × button calls `closeUploadModal()` (no submit)
- [x] Backdrop click: `onclick="if(event.target===this)closeUploadModal()"` on wrapper div
- [x] `closeUploadModal()` does not call form submit

**Result: PASS**

#### AC-6: On successful submission, modal closes and Bills table reloads (was FAIL in R1)
- [x] Success path calls `closeUploadModal(true)` (line 493)
- [x] Immediately followed by `loadBills()` (line 496) — BUG-1 fix confirmed effective

**Result: PASS** (was FAIL in Round 1 — now FIXED)

#### AC-7: Button uses "+" symbol
- [x] Button text is `+ Upload`

**Result: PASS**

#### AC-8: Button style consistent with app UI — Tailwind classes, no inline styles
- [x] Button uses only Tailwind utility classes; no `style=""` attribute
- [x] Modal wrapper uses `style="display:none"` — consistent with all other modals in the app

**Result: PASS**

#### AC-9: Button and modal usable on mobile (375px), tablet (768px), desktop (1440px)
- [x] Modal: `p-4 md:p-5` padding, `w-full max-w-2xl` width cap, `max-h-[90vh] overflow-y-auto`
- [x] Button label is short ("+ Upload") — fits in heading row at 375px

**Result: PASS**

---

### Edge Cases Status

#### EC-1: Submit fails — error shown in modal, modal stays open (was PARTIAL in R1)
- [x] Error message shown via `showMessage("uploadResult", ..., true)` inside moved card — visible in modal
- [x] Modal not closed on error — only success path calls `closeUploadModal()`
- [x] Error message now persists (BUG-2 fix: `if (!isError)` guards the `setTimeout`)

**Result: PASS** (was PARTIAL in Round 1 — now FIXED)

#### EC-2: User closes modal mid-fill — form state discarded, thumbnails cleared (was PARTIAL in R1)
- [x] `form.reset()` called, `pendingFiles = []` set (line 1370-1371)
- [x] `uploadThumbnails.innerHTML = ""` now clears thumbnail DOM directly (line 1372-1373) — BUG-3 fix confirmed
- [x] Bills table not touched on close

**Result: PASS** (was PARTIAL in Round 1 — now FIXED)

#### EC-3: Mobile layout — modal near-full-screen, button fits heading row
- [x] Responsive classes confirmed (same as R1)

**Result: PASS**

#### EC-4: No project selected — Bills pane inaccessible; button inherits guard
- [x] Confirmed — unchanged from R1

**Result: PASS**

#### EC-5: Duplicate submission — submit button disabled during in-flight request (was FAIL in R1)
- [x] `submitBtn.disabled = true` set before `apiFetch()` (line 462)
- [x] Re-enabled in success path (line 470) and error path (line 498)
- [x] `finally` block pattern not needed — both branches re-enable

**Result: PASS** (was FAIL in Round 1 — now FIXED)

---

### OCR Interaction Results

#### OCR-1: Modal upload triggers OCR pipeline
- [x] Same `POST /upload` endpoint — OCR pipeline unchanged

**Result: PASS**

#### OCR-2: OCR field results populated correctly after modal upload
- [x] `pollUploadOcr()` pre-fills same DOM nodes — unaffected by modal context

**Result: PASS**

#### OCR-3: CSRF token included in modal upload request
- [x] `apiFetch()` injects `X-CSRF-Token` for all POST/PUT requests

**Result: PASS**

#### OCR-4: Date field wired through in OCR draft path (was PARTIAL in R1)
- [x] `data.append("date", form.date.value)` present at `bills.js` line 1148 — BUG-6 fix confirmed

**Result: PASS** (was PARTIAL in Round 1 — now FIXED)

---

### Security Audit Results

#### SEC-1: POST /upload still requires auth — no new unprotected endpoints
- [x] `ensureProjectAccess` middleware unchanged on all upload endpoints

**Result: PASS**

#### SEC-2: Modal uses `apiFetch()` — CSRF token carried in all state-mutating requests
- [x] All POST/PUT calls go through `apiFetch()` which calls `withCsrf()`

**Result: PASS**

#### SEC-3: Server-side file-type validation now in place (was PARTIAL in R1)
- [x] `ALLOWED_IMAGE_TYPES` array and `fileFilter` present in `server.js` — BUG-7 core fix confirmed
- [ ] **BUG-8 (Medium — Backend):** When `fileFilter` rejects a file, multer calls `next(err)`. There is no error-handling middleware in the route chain for `/upload`, `/api/bills/:id/images`, or the two image-replacement `PUT` endpoints. Express's default error handler returns a `500 Internal Server Error` (HTML body) instead of a `400 Bad Request` (JSON). The frontend `apiFetch` call receives a non-JSON 500 response, causing `resp.json()` to throw an unhandled exception in the upload handler (`core.js` line 468: `const json = await resp.json()`). The user sees a JS error rather than a clean error message.

**Result: PARTIAL** — file-type validation logic is correct but error response path is broken (BUG-8)

#### SEC-4: XSS — user-supplied values in modal use textContent / escapeHtml
- [x] `showMessage()` uses `el.textContent` — not `innerHTML`
- [x] Error paths in `saveUploadEditBill` use `escapeHtml()`
- [x] OCR status messages use `textContent`

**Result: PASS**

#### SEC-5: No secrets in new JS code
- [x] No hardcoded credentials or tokens in any modified JS files

**Result: PASS**

---

### Regression Test Results

#### REG-1: Existing Upload pane (non-modal) still works after fixes
- [x] `closeUploadModal()` thumbnail clearing now uses `uploadThumbnails.innerHTML = ""` — does not affect the Upload pane when modal is never opened
- [x] All event listeners attached at `DOMContentLoaded` survive DOM moves
- [x] Submit button disable/enable pattern applies equally in pane and modal contexts

**Result: PASS**

#### REG-2: Bills table loads normally without modal open
- [x] `loadBills()` called unconditionally after upload success — no modal state dependency introduced

**Result: PASS**

#### REG-3: PROJ-1 OCR flow via standard Upload pane unaffected
- [x] BUG-6 fix adds `data.append("date", ...)` to `triggerUploadAnalysis()` — date now preserved in OCR draft for both pane and modal

**Result: PASS**

#### REG-4: `showMessage()` auto-clear for success messages not broken by BUG-2 fix
- [x] `if (!isError) setTimeout(...)` — success messages still auto-clear after 3 seconds; fix is minimal and targeted

**Result: PASS**

#### REG-5: BUG-7 multer fix does not break valid image uploads
- [x] Valid JPEG, PNG, WebP, GIF files pass `ALLOWED_IMAGE_TYPES.includes(file.mimetype)` and reach `cb(null, true)` — no regression for valid uploads

**Result: PASS**

---

### Bugs Found (Round 2)

#### BUG-8: Multer fileFilter rejection returns 500 HTML instead of 400 JSON — unhandled error
- **Severity:** Medium
- **Skill:** [Backend]
- **Steps to Reproduce:**
  1. Using `curl` or a request tool, POST a file with a non-image MIME type (e.g., `application/pdf` or `text/html`) to `POST /upload`
  2. The `fileFilter` callback fires with `cb(new Error("Only image files (JPEG, PNG, WebP, GIF) are allowed"))`
  3. Multer calls `next(err)` — no error-handler middleware in the route chain catches it
  4. Express's default error handler responds with a `500 Internal Server Error` (HTML page)
  5. The frontend `apiFetch` receives a non-JSON 500, causing `resp.json()` to throw, and the upload form handler crashes silently
- **Root Cause:** All four multer-using route handlers in `routes/bills.js` (lines 157-164, 608-615, 682-688, 778-779) call `upload.array/single()(req, res, next)` without a following error-handler middleware argument. The `fileFilter` error is never converted to a structured `{ error: "..." }` JSON response with a 4xx status code.
- **Expected:** Rejected file returns `400 Bad Request` with JSON body `{ "error": "Only image files (JPEG, PNG, WebP, GIF) are allowed" }`
- **Actual:** Rejected file returns `500 Internal Server Error` with HTML body; frontend JS throws on `resp.json()`
- **Priority:** Fix before deployment

---

### Summary
- **Round 1 Bugs Fixed:** 6/7 (BUG-1 FIXED, BUG-2 FIXED, BUG-3 FIXED, BUG-4 ACCEPTED/no fix, BUG-5 FIXED, BUG-6 FIXED, BUG-7 FIXED with caveat — see BUG-8)
- **Acceptance Criteria:** 9/9 passed (all Round 1 failures resolved)
- **Edge Cases:** 5/5 passed (all Round 1 failures resolved)
- **OCR Interaction:** 4/4 passed (OCR-4 failure resolved)
- **Security:** 4/5 passed (SEC-3 PARTIAL — BUG-8 new finding)
- **Regression:** 5/5 passed
- **New Bugs Found:** 1 (BUG-8 — medium severity, backend)
- **Production Ready:** NO (BUG-8 must be fixed: multer rejects return unhandled 500 instead of 400 JSON)
- **Recommendation:** Fix BUG-8 (add multer error-handler middleware to all four upload endpoints returning 400 JSON) before deployment. All Round 1 bugs are resolved. Feature is otherwise complete and correct.

## Deployment
_To be added by /deploy_
