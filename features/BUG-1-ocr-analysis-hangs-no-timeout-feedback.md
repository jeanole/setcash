# BUG-1: OCR Analysis Runs Indefinitely With No UI Feedback or Timeout

**Status:** Open
**Reported:** 2026-02-26
**Severity:** High
**Skill Tag:** [Frontend] [Backend]
**Feature:** [PROJ-1: OCR / AI Bill Analysis]

## Description

### Expected Behavior
When a user triggers "Analyse Bill", the bill row shows an "Analysing…" spinner. The analysis job completes within a reasonable time (2–15 seconds per spec), and the bill row updates on next load to show either the "AI ✓ check" badge or an "Analysis failed" badge with a notification. If the job stalls (e.g. provider unresponsive), a timeout should eventually set `ocr_status = 'failed'` and notify the user so they are not left waiting forever.

### Actual Behavior
The analysis appears to run indefinitely — the "Analysing…" spinner (or equivalent indicator) remains visible with no state change. The user receives no failure notification and no completion badge, even after many minutes. There is no timeout mechanism in `runOcrJob` to bail out if the AI provider call hangs.

Additionally, the UI does not poll or auto-refresh bill status while a job is pending, so even if the job does complete in the background, the user only sees the updated state on a full manual page reload.

## Steps to Reproduce
1. Configure OCR for a project with a valid provider and API key
2. Upload a bill with an image
3. Click "Analyse Bill" on the bill row
4. Observe: the bill row shows "Analysing…" (or no visible state at all, per NEW-BUG-1)
5. Wait several minutes — no completion feedback appears, no notification, status never changes in the UI

## Root Cause (Suspected)
- `runOcrJob` uses `fetch()` with no `AbortController` / timeout — if the provider is slow or unresponsive, the promise never resolves and the job hangs indefinitely in the Node.js event loop
- The UI has no polling mechanism for `ocr_status = 'pending'` bills — it only reflects state on the next full bills list load
- No server-side job timeout means `ocr_status` can remain `'pending'` permanently after a server restart or provider hang

## Environment
- **Browser/Client:** All browsers
- **OS:** Any
- **Screen Size:** N/A (server-side issue primarily)

## Additional Context
- Related to NEW-BUG-1 (property name mismatch) which also prevents badge rendering — fixing NEW-BUG-1 first will make the "Analysing…" spinner visible, but the hang/timeout issue will then be clearly apparent
- The spec states "Server restarts mid-job: Bill stays at `pending`; user can click 'Analyse' again" — this is an acceptable fallback, but only if the user knows the job is stuck. With no timeout, they have no signal.

---

## Resolution
**Status:** Open
**Resolved Date:** —
**Fixed In:** —
**Fix Description:** —
