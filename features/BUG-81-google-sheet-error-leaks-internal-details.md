# BUG-81: Google Sheet Sync Error Message Leaks Internal Details to Client

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-12: Integrations (Google Sheets + Telegram)

---

## Description

### Expected Behavior
Error responses should return a generic message. Internal error details (service account emails, API error codes) should be logged server-side only.

### Actual Behavior
The catch block returns `error.message` directly: `'Google Sheet export failed: ' + (error.message || 'Unknown error')`. Google API errors can include service account email addresses and internal codes.

## Environment

- **File:** `nextjs/app/api/admin/export/google-sheet/route.ts` lines 357-362
- **Date:** 2026-03-14

## Fix

Return a generic message to the client and log the full error server-side:
```ts
console.error('Google Sheet export failed:', error);
return NextResponse.json({ error: 'Google Sheet export failed. Check server logs.' }, { status: 500 });
```
