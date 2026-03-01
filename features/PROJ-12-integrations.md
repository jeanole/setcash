# PROJ-12: Integrations (Google Sheets + Telegram)

## Status: Planned
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

## Dependencies
- Requires: PROJ-5 (auth — admin-only actions)
- Requires: PROJ-6 (PostgreSQL data)
- Requires: PROJ-10 (project settings store Sheet ID and Telegram chat ID)

## User Stories
- As an admin, I want to sync approved bills to a Google Sheet so that the finance team
  has a live spreadsheet view.
- As an admin, I want to trigger a full sync to Google Sheets (overwrite) so that the
  sheet is always up-to-date after bulk changes.
- As an admin, I want to receive a Telegram notification when a new bill is submitted
  so that I don't have to poll the app.
- As a user, I want to receive a Telegram notification when my bill status changes
  (approved, rejected, paid) so that I'm kept informed.

## Acceptance Criteria
- [ ] Google Sheets sync:
  - [ ] POST `/api/integrations/sheets/append` — appends a single bill row to the sheet;
        called automatically after admin approves a bill
  - [ ] POST `/api/integrations/sheets/sync` — full overwrite sync of all approved bills
        to the sheet; admin-only, accessible from Settings page
  - [ ] Google service account credentials loaded from `GOOGLE_CREDENTIALS_PATH` env var
        (path to `google-credentials.json`); falls back to `data/google-credentials.json`
  - [ ] Sheet column layout matches existing Express app output (date, vendor, amount,
        motive, category, status, submitted by)
  - [ ] If `TARGET_SHEET_ID` is not configured for the project, sync is a no-op with a
        warning log — no error thrown
- [ ] Telegram notifications:
  - [ ] Telegram bot client initialised from `TELEGRAM_BOT_TOKEN` env var
  - [ ] Message sent to project's `telegram_chat_id` (from settings) on bill submit:
        "New bill submitted by [name]: [vendor] €[amount]"
  - [ ] Message sent to bill owner's personal chat (if they've linked Telegram) on status
        change: "Your bill [vendor] has been [approved/rejected/paid]"
  - [ ] `/app/(protected)/settings/telegram/page.tsx` — UI to set project chat ID and
        instructions for users to link their personal Telegram account
  - [ ] Telegram link flow: user gets a unique token from the app, sends it to the bot;
        bot registers the mapping `telegram_user_id` ↔ `user.id`
  - [ ] If `TELEGRAM_BOT_TOKEN` is not set, all Telegram calls are silently skipped
- [ ] Both integrations are fire-and-forget (failures are logged but do not fail the
      primary action that triggered them)

## Edge Cases
- Google API rate limit hit → log the error, show admin a toast "Sheet sync failed — retry later"
- Telegram message fails (chat not found, bot blocked) → log and skip; do not crash the app
- `google-credentials.json` missing → sheet sync returns 503 with "Google credentials not configured"
- Bill has no vendor name → use "Unknown vendor" in notification/sheet row
- Multiple rapid approvals → sheet appends may race; acceptably handled by Google Sheets API
  (rows may appear out of order)

## Technical Requirements
- Google Sheets: `googleapis` npm package (same as existing Express app)
- Telegram: `node-telegram-bot-api` or `grammy` npm package
- All integration calls wrapped in try/catch; errors logged to console, never surfaced to user
  as fatal errors
- Credentials and tokens from env vars only — never hardcoded
- Branch: `to_nextjs`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
