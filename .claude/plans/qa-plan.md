# QA Test Plan — PROJ-3: Upload Shortcut Button (Round 4 — Full Post-Deploy Verification)

## Feature
PROJ-3 · `features/PROJ-3-upload-shortcut-button.md`

## Context Summary
- Feature deployed as v1.10.0-PROJ-3 after 3 QA rounds
- Rounds 1-3 found and resolved BUG-1 through BUG-8
- This is a comprehensive post-deployment verification pass

## Scope
- **Full verification:** All 9 ACs, all 5 ECs, OCR interaction, security audit, regression
- **Confirm all previous bug fixes remain intact:** BUG-1 through BUG-8
- **Find any NEW issues or regressions**

---

## Test Matrix

### Phase 1: Previous Bug Fix Verification (BUG-1 through BUG-8)

| Bug | Description | Where to Verify |
|-----|-------------|-----------------|
| BUG-1 | Bills table reload after modal upload | `core.js` ~line 496 — `loadBills()` after `closeUploadModal(true)` |
| BUG-2 | Error message persists (no auto-disappear) | `utils.js` ~line 38 — `if (!isError)` guard on setTimeout |
| BUG-3 | Thumbnail clearing on modal close | `bills.js` ~line 1372 — `uploadThumbnails.innerHTML = ""` |
| BUG-4 | Overflow at narrow widths (accepted, no fix) | Confirm still within design tolerance |
| BUG-5 | Submit button disabled during upload | `core.js` ~line 462 — `submitBtn.disabled = true` |
| BUG-6 | Date in OCR draft path | `bills.js` ~line 1148 — `data.append("date", ...)` |
| BUG-7 | Server-side file-type validation | `server.js` ~lines 58-68 — `fileFilter` + `ALLOWED_IMAGE_TYPES` |
| BUG-8 | Multer error returns 400 JSON | `routes/bills.js` — all 4 multer call sites with inline error callback |

### Phase 2: Acceptance Criteria (AC-1 through AC-9)

| AC | Criterion | Source Files |
|----|-----------|--------------|
| AC-1 | "+ Upload" button in Bills table header | `index.html` ~lines 486-491 |
| AC-2 | Button visible to all project members | `index.html`, `bills.js` — no admin guard |
| AC-3 | Button opens modal overlay (not pane switch) | `bills.js` `openUploadModal()` |
| AC-4 | Modal has same form fields as Upload pane | `bills.js` DOM move of `#uploadForm` card |
| AC-5 | Modal dismissible without submitting | `bills.js` `closeUploadModal()`, backdrop click, X button |
| AC-6 | Success closes modal + reloads bills | `core.js` ~lines 490-496 |
| AC-7 | Button uses "+" symbol | `index.html` button text |
| AC-8 | Tailwind styling, no inline styles | `index.html` button/modal classes |
| AC-9 | Responsive at 375px, 768px, 1440px | `index.html` modal responsive classes |

### Phase 3: Edge Cases (EC-1 through EC-5)

| EC | Case | Source Files |
|----|------|--------------|
| EC-1 | Server error shows in modal, modal stays open | `core.js` error path, `utils.js` showMessage |
| EC-2 | Close mid-fill discards state + clears thumbnails | `bills.js` `closeUploadModal()` |
| EC-3 | Mobile layout | CSS classes in `index.html` |
| EC-4 | No project selected guard | `#tab-bills` visibility gating |
| EC-5 | Double-click protection | `core.js` submitBtn.disabled |

### Phase 4: Security Audit (SEC-1 through SEC-5)

| SEC | Check | Source Files |
|-----|-------|--------------|
| SEC-1 | POST /upload requires auth | `routes/bills.js` ensureProjectAccess middleware |
| SEC-2 | CSRF token in modal requests | `utils.js` apiFetch/withCsrf |
| SEC-3 | Server-side file-type validation complete | `server.js` fileFilter + `routes/bills.js` error handlers |
| SEC-4 | XSS — textContent/escapeHtml used | `utils.js`, `core.js`, `bills.js` |
| SEC-5 | No secrets in new JS | `bills.js` PROJ-3 additions |

### Phase 5: Regression (REG-1 through REG-5)

| REG | Check | Source Files |
|-----|-------|--------------|
| REG-1 | Upload pane (non-modal) still works | `core.js`, `bills.js` DOM move logic |
| REG-2 | Bills table loads normally | `bills.js` loadBills(), `core.js` |
| REG-3 | PROJ-1 OCR flow unaffected | `bills.js` triggerUploadAnalysis, pollUploadOcr |
| REG-4 | showMessage auto-clear for success msgs | `utils.js` BUG-2 fix |
| REG-5 | Valid image uploads unbroken by BUG-7 fix | `server.js` fileFilter + `routes/bills.js` |

---

## NEW inspection focus for Round 4

- **Error handling completeness:** Upload submit handler has no try/catch around `resp.json()` — if server returns non-JSON, the handler will crash silently with the button stuck in "Uploading..." state
- **Body scroll lock cleanup:** `openUploadModal` sets `document.body.style.overflow = "hidden"` — verify `closeUploadModal` always restores it
- **Escape key dismissal:** Check if modal can be closed with Escape key (accessibility)
- **Form reset in success path:** Verify the success path properly handles all form state cleanup

---

## Bug Report Instructions
- Append results as "## QA Test Results (Round 4)" to `features/PROJ-3-upload-shortcut-button.md`
- Use template from `.claude/skills/qa/test-template.md`
- Tag every bug with [Frontend] or [Backend]
- NEVER fix bugs — only find, document, and prioritize
- Commit with: `test(PROJ-3): QA Round 4 results`
