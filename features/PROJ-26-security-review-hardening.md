## PROJ-26: Security Review & Dependency Hardening (Oct 2026)

**Status:** In Review
**Branch:** `claude/keen-rubin-b78ded`

### Summary
Full code and security review of the Next.js app, followed by fixes for every
verified finding and an upgrade of all dependencies with known advisories.

### Changes

**Authentication & sessions**
- JWT re-validated against the DB on every request (role, superadmin flag,
  membership, `isActive`); `User.sessionVersion` revokes sessions on password
  change/reset. Client `update()` payloads are no longer trusted.
- Pre-registration account takeover closed (Google sign-in / invite acceptance
  on an unverified account discard the existing password); invites no longer
  re-activate disabled accounts and are claimed atomically.
- Login limited per IP and per email; client IPs never taken from
  `X-Forwarded-For` (`lib/client-ip.ts`, `TRUSTED_IP_HEADER`).
- Case-insensitive unique email index; email lookups case-insensitive.
- Demo-login token bound to a cookie (login CSRF); invite emails HTML-escaped.

**Access control**
- DB-verified guards for all admin and superadmin routes.
- Telegram invite no longer hands an admin another member's link code.
- OCR provider/base-URL change requires re-entering the API key.
- Member removal cleans up Telegram links and the default project; last-owner
  and last-superadmin checks run in serializable transactions.
- V-Geld: members only see their own transfers; analysis is admin-only.

**Correctness**
- V-Geld Confirm button called a non-existent route; one balance definition
  (`lib/vgeld.ts`) for dashboard, sidebar, analysis and PDF.
- Bill input validated with Zod; status/amount updates are conditional (409 on
  concurrent change); bill numbers no longer reused after deletes; uploads
  stored under unique names; images locked on approved/paid bills.
- OCR never overwrites approved/paid bills; atomic job claim.

**Hardening**
- SSRF-safe OCR fetch with connect-time address checks (`lib/safe-fetch.ts`).
- Nonce-based Content-Security-Policy (`lib/csp.ts`), Permissions-Policy,
  Next.js image optimizer disabled, Postgres bound to localhost in compose.
- Bug reports no longer auto-trigger the Claude GitHub Action; user text fenced
  as untrusted.
- Streaming exports with backpressure; spending aggregated in SQL.

**Dependencies** (`npm audit --omit=dev`: 21 → 0)
- Next.js 14.2.35 → 15.5.28, React 18 → 19, next-auth beta.30 → beta.32,
  node-telegram-bot-api 0.67 → 2.1.0 (bot migrated to the v2 API),
  resend 6.34, overrides for exceljs→uuid and next→postcss.

### Deployment Notes
- Two migrations: `20261018000000_session_version_and_indexes` and
  `20261018120000_user_email_case_insensitive_unique`. The second aborts with a
  clear message if emails differing only in case already exist — merge them
  first (query in the migration file).
- Set `TRUSTED_IP_HEADER` to match the reverse proxy (`none` if clients reach
  the app directly); optional `GOOGLE_CREDENTIALS_DIR`.
- Users are signed out after changing their password.

### Verification
- `next build`, `tsc`, lint clean; 80 Jest tests (real Postgres) pass.
- Browser smoke test against the production build: login, all protected and
  public pages render with zero CSP violations; session revocation verified.
- Telegram bot v2 migration verified with a stubbed Bot API only (no real
  token available) — test the photo → draft bill flow in staging.
