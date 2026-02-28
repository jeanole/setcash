# QA Test Plan -- PROJ-1: OCR / AI Bill Analysis (Round 6)

## Feature
PROJ-1 -- `features/PROJ-1-ocr-bill-analysis.md`

## Context Summary
- Feature deployed as v1.9.0-PROJ-1 after 5 prior QA rounds
- Rounds 1-4 found and fixed many bugs. Round 5 verified all fixes.
- 3 known low-severity items still open: R4-2, R4-3, R3-2
- CR-1 (OCR Log): Deployed
- CR-2 (Console Logging): Deployed
- CR-3 (Field Verification + Bill History): Deployed
- CR-4 (Analyse in Upload Modal): Code implemented, status says "In Progress"
- CR-5 (Re-Analyse Button): Code implemented, status says "In Progress"
- BUG-6 (Re-analyse fields not reset): Resolved
- BUG-7 (Re-analysis no history log): Resolved

## Focus Areas
1. Verify all previous bug fixes remain intact (regression)
2. Full security audit (SSRF, XSS, CSRF, auth, API key handling)
3. Test for any NEW regressions
4. Verify CR-3, CR-4, CR-5 functionality is complete
5. Verify the 3 still-open low-severity items status

---

## Test Matrix

### Phase 1: Previous Bug Fix Verification

| Bug | Description | Files to Check |
|-----|-------------|----------------|
| R2-BUG-1 | Property name mismatch (ocr_status vs ocrStatus) | `public/js/bills.js` |
| R2-BUG-2 | Non-admin users cannot see OCR features | `public/js/core.js`, `routes/projects.js` |
| R2-BUG-3 | PUT handler does not process date field | `routes/bills.js` |
| R2-BUG-4 | Analyse button for already-analysed bills | `public/js/bills.js` |
| R2-BUG-5 | Form field name mismatches | `public/js/bills.js`, `public/js/core.js` |
| R2-BUG-6 | SESSION_SECRET warning only in ocr.js | `server.js` |
| R3-BUG-3 | Re-analysis after failed analysis overwrites data | `routes/ocr.js` |
| R3-BUG-4 | SSRF full 127.0.0.0/8 range | `routes/ocr.js` |
| R4-BUG-1 | Date field not sent to backend | `public/js/core.js`, `routes/bills.js` |

### Phase 2: Still-Open Low-Severity Items

| ID | Description | Files |
|----|-------------|-------|
| R4-2 | Settings save path missing isPrivateUrl on standalone ocrBaseUrl | `routes/settings.js` |
| R4-3 | effectiveProvider defaults to "openai" instead of reading saved | `routes/settings.js` |
| R3-2 | List button label inconsistent with confirmation condition | `public/js/bills.js` |

### Phase 3: Original PROJ-1 Acceptance Criteria

| AC | Criterion | Files |
|----|-----------|-------|
| AC-1 | AI Analysis settings sub-tab | `public/index.html`, `public/js/admin.js` |
| AC-2 | Settings stored per project | `routes/settings.js` |
| AC-3 | API key never in GET response | `routes/settings.js` |
| AC-4 | Analyse button visible when OCR enabled | `public/js/bills.js` |
| AC-5 | Clicking Analyse returns 202 | `routes/ocr.js` |
| AC-6 | Analysing indicator while job runs | `public/js/bills.js` |
| AC-7 | Results shown on reload | `public/js/bills.js` |
| AC-8 | Telegram auto-trigger | `routes/telegram.js` |
| AC-9 | Background job logic | `routes/ocr.js` |
| AC-10 | Database columns migration | `db.js` |
| AC-11 | OCR fields stripping on edit | `routes/bills.js` |
| AC-12 | Badge rendering | `public/js/bills.js` |
| AC-13 | Field highlights in detail view | `public/js/bills.js` |
| AC-14 | Failure notification | `routes/ocr.js` |

### Phase 4: CR-3 Verification (Field Verification + Bill History)

| Test | Criterion | Files |
|------|-----------|-------|
| CR3-1 | Verify button per AI-filled field | `public/js/bills.js` |
| CR3-2 | PATCH /api/bills/:id/verify-field endpoint | `routes/bills.js` |
| CR3-3 | Bill history with source column | `db.js`, `routes/ocr.js`, `routes/bills.js` |
| CR3-4 | History rendering (AI vs user) | `public/js/bills.js` |
| CR3-5 | "created" event logged on upload | `routes/bills.js` |

### Phase 5: CR-4 Verification (Analyse in Upload Modal)

| Test | Criterion | Files |
|------|-----------|-------|
| CR4-1 | Analyse button visible when photos attached | `public/js/core.js` |
| CR4-2 | Saves draft + triggers OCR | `public/js/bills.js` |
| CR4-3 | Pre-fills form on success | `public/js/bills.js` |
| CR4-4 | OCR highlights in upload form | `public/js/bills.js` |
| CR4-5 | Save-after-OCR uses PUT | `public/js/core.js` |
| CR4-6 | Error handling | `public/js/bills.js` |

### Phase 6: CR-5 Verification (Re-Analyse Button)

| Test | Criterion | Files |
|------|-----------|-------|
| CR5-1 | Button label changes to "Re-analyse" | `public/js/bills.js` |
| CR5-2 | Confirmation dialog | `public/js/bills.js` |
| CR5-3 | Backend re-analysis overwrites fields | `routes/ocr.js` |
| CR5-4 | First-time Analyse has no confirmation | `public/js/bills.js` |

### Phase 7: Security Audit

| SEC | Check | Files |
|-----|-------|-------|
| SEC-1 | API key never leaked to client | `routes/settings.js` |
| SEC-2 | API key encrypted at rest (AES-256-GCM) | `routes/ocr.js` |
| SEC-3 | SSRF protection on custom URLs | `routes/ocr.js`, `routes/settings.js` |
| SEC-4 | Auth on all OCR endpoints | `routes/ocr.js`, `routes/bills.js` |
| SEC-5 | CSRF on all state-changing requests | `middleware.js`, `public/js/bills.js` |
| SEC-6 | XSS in OCR-extracted fields | `public/js/bills.js` |
| SEC-7 | SQL injection prevention | All route files |
| SEC-8 | Cross-project data access | `routes/ocr.js`, `routes/bills.js` |
| SEC-9 | SESSION_SECRET enforcement | `server.js`, `routes/ocr.js` |
| SEC-10 | Security headers | `server.js` |
| SEC-11 | Input validation on endpoints | `routes/ocr.js`, `routes/bills.js`, `routes/settings.js` |
| SEC-12 | Gemini API key not in URL | `routes/ocr.js` |
| SEC-13 | No secrets in console logging | `routes/ocr.js` |
| SEC-14 | Encryption key derivation security | `routes/ocr.js` |
| SEC-15 | Path traversal on image reads | `routes/ocr.js`, `routes/bills.js` |

### Phase 8: Edge Cases

| EC | Case | Files |
|----|------|-------|
| EC-1 | No image on bill | `routes/ocr.js` |
| EC-2 | Multi-image bill (first image only) | `routes/ocr.js` |
| EC-3 | Provider 429 rate limit | `routes/ocr.js` |
| EC-4 | Invalid API key / 401 | `routes/ocr.js` |
| EC-5 | Partial extraction | `routes/ocr.js` |
| EC-6 | OCR disabled for project | `routes/ocr.js`, `routes/telegram.js` |
| EC-7 | User edits bill before analysis finishes | `routes/ocr.js` |
| EC-8 | Server restart mid-job | `routes/ocr.js` |
| EC-9 | Duplicate analysis prevention | `routes/ocr.js` |
| EC-10 | Amount auto-clear on verify | `routes/bills.js` |

---

## Bug Report Instructions
- APPEND results as "## QA Test Results (Round 6)" to `features/PROJ-1-ocr-bill-analysis.md`
- Use template from `.claude/skills/qa/test-template.md`
- Tag every bug with [Frontend] or [Backend]
- NEVER fix bugs -- only find, document, and prioritize
- Commit with: `test(PROJ-1): QA Round 6 results`
