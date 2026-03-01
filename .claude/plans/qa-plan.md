# QA Test Plan -- PROJ-1: OCR / AI Bill Analysis (Round 7)

## Feature
PROJ-1 -- `features/PROJ-1-ocr-bill-analysis.md`

## Context Summary
- Feature deployed as v1.9.0-PROJ-1 after 6 prior QA rounds
- Rounds 1-5 found and fixed many bugs. Round 6 found 2 new bugs.
- Round 7 is a focused fix-verification round for 2 bugs from Round 6:
  - NEW-BUG-R6-1 (Medium): netto_amount not recalculated during re-analysis
  - NEW-BUG-R6-2 (Low): session cookie missing secure flag and sameSite
- All other items passed in Round 6

## Focus Areas
1. Verify NEW-BUG-R6-1 fix: netto_amount recalculation guard now includes `isReanalysis`
2. Verify NEW-BUG-R6-2 fix: session cookie has `secure` and `sameSite` attributes
3. Regression spot-check: first-time analysis still preserves user-entered amounts
4. Check for any new issues introduced by the fixes

---

## Test Matrix

### Phase 1: NEW-BUG-R6-1 Fix Verification (netto_amount recalculation)

| Test | Description | Files |
|------|-------------|-------|
| R6-1-FIX-1 | Guard condition now includes `isReanalysis` | `routes/ocr.js` line 450 |
| R6-1-FIX-2 | Re-analysis scenario: brutto fields + netto recalculated | `routes/ocr.js` lines 450-460 |
| R6-1-FIX-3 | Regression: first-time analysis with zero amount still recalculates | `routes/ocr.js` lines 450-460 |
| R6-1-FIX-4 | Regression: first-time analysis with user-entered amount preserves it | `routes/ocr.js` lines 424, 450 |
| R6-1-FIX-5 | Check for double-push of "amount" to writtenFields | `routes/ocr.js` lines 424, 459 |

### Phase 2: NEW-BUG-R6-2 Fix Verification (session cookie)

| Test | Description | Files |
|------|-------------|-------|
| R6-2-FIX-1 | `secure` set to `process.env.NODE_ENV === "production"` | `server.js` line 109 |
| R6-2-FIX-2 | `sameSite` set to `"lax"` | `server.js` line 110 |
| R6-2-FIX-3 | Regression: httpOnly still true | `server.js` line 107 |
| R6-2-FIX-4 | Regression: maxAge still set | `server.js` line 108 |

### Phase 3: Broader Regression Spot-Check

| Test | Description | Files |
|------|-------------|-------|
| REG-1 | fieldChecks still guards first-time writes properly | `routes/ocr.js` lines 416-425 |
| REG-2 | isReanalysis detection unchanged | `routes/ocr.js` line 323 |
| REG-3 | SESSION_SECRET enforcement unchanged | `server.js` lines 42-53 |
| REG-4 | Security headers unchanged | `server.js` lines 81-88 |

---

## Bug Report Instructions
- APPEND results as "## QA Test Results (Round 7)" to `features/PROJ-1-ocr-bill-analysis.md`
- Use template from `.claude/skills/qa/test-template.md`
- Tag every bug with [Frontend] or [Backend]
- NEVER fix bugs -- only find, document, and prioritize
- Commit with: `test(PROJ-1): QA Round 7 -- R6 bug fix verification`
