# BUG-80: Telegram Photo Download Does Not Validate File Extension

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-12: Integrations (Google Sheets + Telegram)

---

## Description

### Expected Behavior
Files downloaded from Telegram via the bot should have their extension validated against the allowed list before saving.

### Actual Behavior
`downloadTelegramFile()` saves files with whatever extension Telegram provides, without checking against `ALLOWED_EXTENSIONS` defined in `upload.ts`. A file with `.html` or `.svg` extension could theoretically be saved to the uploads directory.

## Environment

- **File:** `nextjs/lib/telegram/handlers.ts` lines 44-46
- **Date:** 2026-03-14

## Root Cause

The allowed extensions check from `upload.ts` was not applied to the Telegram download path.

## Fix

Import and apply `ALLOWED_EXTENSIONS` from `upload.ts` before saving.
