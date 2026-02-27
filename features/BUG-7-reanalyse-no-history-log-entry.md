# BUG-7: Re-analysis Produces No Bill History Log Entry

**Status:** Open
**Reported:** 2026-02-27
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** [PROJ-1: OCR / AI Bill Analysis](PROJ-1-ocr-bill-analysis.md)

## Description

After re-analysing a bill (whether it succeeds or fails), no entry appears in the bill's History section. The bill log remains empty or unchanged. This includes both successful re-analysis runs and failed ones.

### Expected Behavior
Every OCR analysis run — including re-analysis — writes an entry to the bill's history log (`editlog` table):
- **On success:** an AI entry showing which fields were extracted (e.g. "AI scanned (openai) — extracted: vendor, date, amount"), as per CR-3
- **On failure:** an entry indicating the analysis was attempted but failed (e.g. "AI analysis failed — [error reason]"), so the user is informed via the audit trail and not left wondering what happened

### Actual Behavior
- Re-analysis runs but no log entry appears in the bill's History section
- Failed analyses produce no log entry at all, leaving no trace in the history

## Steps to Reproduce
1. Open any bill with at least one image
2. Click "Re-analyse" (or "Analyse" for a fresh bill), confirm if prompted
3. Wait for analysis to complete (success or failure)
4. Open the bill's History section
5. Observe: no new log entry for the re-analysis run

## Environment
- **Browser/Client:** N/A
- **OS:** N/A
- **Screen Size:** N/A

## Additional Context
- CR-3 (deployed) introduced `editlog` entries for OCR runs. The `runOcrJob` function in `routes/ocr.js` should already write an AI log entry on success. The issue may be:
  - The log entry is written but the frontend doesn't reload it after re-analysis polling completes
  - The log entry is not written at all on re-analysis (possible if it was only added for first-time analysis)
  - **Failure case is definitely missing:** CR-3 may only log on success; there is no failure log entry written in `runOcrJob`'s error paths
- Fix should ensure: (a) success log entries are always displayed after analysis, and (b) failure log entries are also written to `editlog` with `source = 'ai'` and a failure indicator

---

## Resolution
**Status:** Open
**Resolved Date:** —
**Fixed In:** — *(commit hash or PR)*
**Fix Description:** —
