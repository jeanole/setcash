# BUG-65: Telegram API Validation Fetch Has No Timeout

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Medium
**Skill Tag:** [Backend]
**Feature:** PROJ-12: Integrations (Google Sheets + Telegram)

---

## Description

### Expected Behavior
External HTTP calls should have a timeout to prevent indefinitely blocking server workers.

### Actual Behavior
The `fetch()` call to `https://api.telegram.org/bot.../getMe` in the settings update route has no `AbortController` or timeout. If Telegram's API is slow or unreachable, the server worker blocks indefinitely.

## Environment

- **File:** `nextjs/app/api/admin/telegram/settings/route.ts` line 121
- **Date:** 2026-03-14

## Root Cause

`fetch()` called without timeout signal.

## Fix

```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);
try {
  const resp = await fetch(url, { signal: controller.signal });
} finally {
  clearTimeout(timeout);
}
```
