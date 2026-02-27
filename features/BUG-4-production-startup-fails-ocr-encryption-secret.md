# BUG-4: Production Startup Fails — OCR_ENCRYPTION_SECRET Not Set

**Status:** Resolved
**Reported:** 2026-02-27
**Severity:** High
**Skill Tag:** [Deploy]
**Feature:** PROJ-1: OCR / AI Bill Analysis

## Description

The server refuses to start in production with the following errors:

```
[OCR] OCR_ENCRYPTION_SECRET / SESSION_SECRET is missing, too short, or using a default value. Refusing to start in production.
[OCR] WARNING: SESSION_SECRET is not set or uses the default value. Set a strong SESSION_SECRET environment variable before storing API keys.
```

### Root Cause

`routes/ocr.js` added a production startup guard (as part of the OCR API key encryption feature) that calls `process.exit(1)` when neither `OCR_ENCRYPTION_SECRET` nor a sufficiently strong `SESSION_SECRET` is present. The `OCR_ENCRYPTION_SECRET` env var was added to `.env.example` as a comment (optional-looking), but is effectively required in production — leading to a missing env var on the server.

Secondary issue: the log prefix `[OCR]` is misleading for what is a server startup security check, not an OCR job event. Should use `[Startup]` to match the pattern in `server.js`.

### Expected Behavior

Server starts successfully in production. `OCR_ENCRYPTION_SECRET` is documented as required, set in the production environment, and the error messages use `[Startup]` prefix for consistency.

### Actual Behavior

Server exits immediately on startup in production with exit code 1 due to missing `OCR_ENCRYPTION_SECRET`. The `[OCR]` log prefix misdirects debugging attention.

## Steps to Reproduce
1. Deploy to production without `OCR_ENCRYPTION_SECRET` set in environment
2. Server fails to start — `process.exit(1)` is called in `routes/ocr.js` lines 22–30

## Environment
- **Browser/Client:** N/A (server-side)
- **OS:** Production server (Docker)
- **Screen Size:** N/A

## Additional Context

**Fix has two parts:**

1. **Deploy fix (immediate):** Set `OCR_ENCRYPTION_SECRET` in the production environment to a strong random value (32+ chars). Can use `SESSION_SECRET` as fallback — but a dedicated key is preferred.

2. **Code fix:**
   - Change `[OCR]` prefix to `[Startup]` in the two warning/error log calls in `routes/ocr.js` (lines 18, 26)
   - Uncomment and mark `OCR_ENCRYPTION_SECRET` as required (or at minimum clearly recommended) in `.env.example`

---

## Resolution
**Status:** Resolved
**Resolved Date:** 2026-02-27
**Fixed In:** fix(BUG-4) commit
**Fix Description:** Changed `[OCR]` log prefix to `[Startup]` in `routes/ocr.js` for the two startup secret validation messages. Uncommented `OCR_ENCRYPTION_SECRET` in `.env.example` and marked it as required in production with a clear explanation.
