# BUG-49: Telegram Token Encryption Silently Falls Back to Plaintext When Key Missing

**Status:** Open
**Reported:** 2026-03-14
**Severity:** High
**Skill Tag:** [Backend]
**Feature:** PROJ-12: Integrations (Google Sheets + Telegram)

---

## Description

### Expected Behavior
If `TELEGRAM_ENCRYPTION_KEY` is not set, the application should refuse to store a bot token and throw a hard error.

### Actual Behavior
`encrypt()` in `lib/telegram/encryption.ts` logs `console.error` but returns the plaintext token. The token is stored unencrypted in the database with no indication to the operator.

## Steps to Reproduce

1. Start the app without `TELEGRAM_ENCRYPTION_KEY` set
2. Configure a Telegram bot token via admin settings
3. Query the database — `TelegramSettings.encryptedBotToken` contains the raw token

## Environment

- **File:** `nextjs/lib/telegram/encryption.ts` lines 28-37
- **Date:** 2026-03-14

## Root Cause

The missing-key branch returns `token` (plaintext) instead of throwing. Only a `console.error` is emitted — no exception propagates.

## Fix

Replace the fallback return with a thrown error:
```ts
if (!ENCRYPTION_KEY) {
  throw new Error('TELEGRAM_ENCRYPTION_KEY is not configured. Cannot store bot token.');
}
```
Add a production startup guard similar to the `OCR_ENCRYPTION_SECRET` check.
