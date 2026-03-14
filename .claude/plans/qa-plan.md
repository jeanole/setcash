# QA Test Plan — CR-23 Round 2

## Feature
CR-23: Enrich Telegram Upload Response with OCR Fields, Errors, and Bill Link
Feature spec: `features/PROJ-12-integrations.md` → Change Requests → CR-23
Method: Code review (no running server)

## Context Summary
- Round 2 re-test after bug fixes in commit `c31cd7b`
- BUG-86 fixed: errorDetail sanitized via allowlist before sending to Telegram user
- BUG-87 fixed: German OCR note restored, "Bitte in SetCash vervollständigen" kept for all paths
- BUG-88 fixed: Date formatting uses getUTCDate/Month/FullYear
- File: `nextjs/lib/telegram/handlers.ts`

## User Guidance
- Full re-test: verify all 3 bugs are resolved + no regressions

## Acceptance Criteria to Test
Same as Round 1 (AC-1 through AC-7) — re-verify all pass with the fixes applied.

### AC-1: Initial acknowledgement
- ACK includes German "Beleganalyse läuft im Hintergrund." when OCR enabled
- ACK includes "Bitte in SetCash vervollständigen." in both OCR-enabled and OCR-disabled paths
- Bill link appended when NEXTAUTH_URL set

### AC-2: Follow-up with extracted fields
- Fields formatted correctly, date uses UTC methods

### AC-3: Follow-up on OCR failure
- Error message sanitized via SAFE_REASONS allowlist
- Unknown errors become "Analysis could not be completed"

### AC-4: Bill link included in both ACK and follow-up

### AC-5: Graceful omission when NEXTAUTH_URL not set

### AC-6: Follow-up is async / non-blocking

### AC-7: OCR disabled path still includes bill link

## Edge Cases to Test

### EC-1 through EC-6: Same as Round 1

### EC-7: Date uses UTC (BUG-88 fix verification)
- `getUTCDate()`, `getUTCMonth()`, `getUTCFullYear()` used instead of local methods

### EC-8: bot.sendMessage failure silently caught

### EC-9: Error sanitization edge cases (BUG-86 fix verification)
- Known error strings map to safe messages
- Unknown error strings map to generic "Analysis could not be completed"
- Null/empty errorDetail falls back to "Unknown error" → then mapped to generic message

## Security Audit Scope
- SEC-1: errorDetail allowlist — verify no internal details leak for unrecognized errors
- SEC-2: Verify all known OCR error strings are in the SAFE_REASONS map
- SEC-3: No new auth surface
- SEC-4: vendor/item values in follow-up — Telegram markdown injection check
- SEC-5: formatBillLink — no injection possible

## Regression Test Scope
- REG-1: /start, /link handlers unchanged
- REG-2: Photo auth flow unchanged
- REG-3: Media group buffering unchanged
- REG-4: German ACK text consistent in both single-photo and album paths
- REG-5: maybeRunOcr still fire-and-forget

## Bug Report Template
Use template from .claude/skills/qa/test-template.md

## Commit Message
test(CR-23): Add QA Round 2 test results for Telegram OCR follow-up
