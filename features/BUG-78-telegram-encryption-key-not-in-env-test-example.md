# BUG-78: TELEGRAM_ENCRYPTION_KEY Not Documented in .env.test.example

**Status:** Open
**Reported:** 2026-03-14
**Severity:** Low
**Skill Tag:** [Backend]
**Feature:** PROJ-12: Integrations (Google Sheets + Telegram)

---

## Description

### Expected Behavior
All required environment variables must be documented in `nextjs/.env.test.example` per project security rules.

### Actual Behavior
`TELEGRAM_ENCRYPTION_KEY` is documented in the root `.env.example` but missing from `nextjs/.env.test.example`. Developers running tests may silently skip Telegram encryption.

## Environment

- **File:** `nextjs/.env.test.example`
- **Date:** 2026-03-14

## Fix

Add `TELEGRAM_ENCRYPTION_KEY=test-encryption-key-32-bytes-long!!` to `nextjs/.env.test.example`.
