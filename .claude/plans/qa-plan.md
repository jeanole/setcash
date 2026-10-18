# QA Test Plan — PROJ-26: Security Review & Dependency Hardening

## Feature
PROJ-26 — Security Review & Dependency Hardening (Next.js 15 upgrade)
Spec: `features/PROJ-26-security-review-hardening.md`
Merged to `main` via jeanole/setcash#21 and #22; branch `claude/keen-rubin-b78ded` (HEAD `c8db29e`).

## Context Summary
- Large hardening pass across ~120 files: auth/session revalidation, DB-verified admin guards,
  bills/uploads/OCR hardening, V-Geld correctness, nonce-based CSP, Telegram bot rewrite (v2 lib),
  SSRF-safe OCR fetch, case-insensitive email uniqueness.
- Framework upgrade Next.js 14.2.35 → 15.5.28, React 18 → 19, next-auth beta.30 → beta.32,
  node-telegram-bot-api 0.67 → 2.1.0. `npm audit --omit=dev` = 0.
- Two new migrations: `20261018000000_session_version_and_indexes`,
  `20261018120000_user_email_case_insensitive_unique` (aborts if case-duplicate emails exist).
- Already verified by the implementer (re-verify, don't assume): `next build`, tsc, lint, 80 Jest tests,
  Chromium smoke of 14 protected + 5 public pages with zero CSP violations, Docker image boots
  (migrate + seed + health), `/_next/image` returns 404 in the container.
- Previously "Deployed" features in `features/INDEX.md` are the regression baseline.

## User Guidance
- Focus areas (go deep): **Auth & sessions**, **Money correctness**, **Next 15 regressions**, **Telegram bot v2**.
- Scope: **Full** — all ACs, edge cases, red-team security audit, regression, responsive checks.
- Environment: **local production build + fresh seeded Postgres** (no real prod data/secrets).
- Browsers: Chromium only (Firefox/Safari not installed in this environment — record as not tested).
- Telegram: no real bot token exists; test against a local stub of the Bot API (see below).
  Turnstile: no site key; record demo-login widget as not testable, but test the demo-login token/cookie logic.

## Environment Setup (do this first)
1. Postgres 16 (already initialised at `/var/tmp/setcash-pg/data`, port 5433, trust auth):
   `su postgres -s /bin/sh -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/tmp/setcash-pg/data -o '-p 5433 -k /var/tmp/setcash-pg' -l /var/tmp/setcash-pg/log start"`
   Create a fresh DB `qa_proj26` (drop if exists). Tests DB for Jest: `setcash_test` (same server).
2. Build & run the production server from `/home/user/setcash/nextjs` (NOT `next dev`):
   - `npx prisma migrate deploy` against `qa_proj26`, then seed with `ADMIN_EMAIL`/`ADMIN_PASSWORD`
     (`npx tsx prisma/seed.ts`).
   - `npx next build` with env: `DATABASE_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID=x`, `GOOGLE_CLIENT_SECRET=x`.
   - Start: `NODE_ENV=production PORT=3101 npx tsx server.ts` in the background with env:
     `DATABASE_URL, NEXTAUTH_SECRET (≥32 chars), NEXTAUTH_URL=AUTH_URL=http://localhost:3101,
     GOOGLE_CLIENT_ID=x, GOOGLE_CLIENT_SECRET=x, TELEGRAM_ENCRYPTION_KEY=<64 hex>,
     OCR_ENCRYPTION_SECRET=<≥16 chars>, SESSION_SECRET=<≥16 chars>, UPLOADS_DIR=<scratch dir>,
     TRUSTED_IP_HEADER=none`.
   - Never kill processes with `pkill -f "...server.ts"` — it matches your own shell; use the PID.
3. Seed test data via SQL or Prisma (bcrypt hashes via `node -e 'require("bcryptjs").hashSync(...)'`):
   - Project A: owner `owner-a@qa.test`, admin `admin-a@qa.test`, members `user-a1@qa.test`, `user-a2@qa.test`.
   - Project B: owner `owner-b@qa.test`, member `user-b1@qa.test`.
   - Superadmin `super@qa.test`. Deactivated user `disabled@qa.test`. A mixed-case user `Mixed.Case@QA.test`.
   - Bills in each status (draft, pending, confirmed, approved, rejected, paid) with images, motives,
     categories and allocations; confirmed and unconfirmed V-Geld transfers.
4. Browser automation: Playwright from `nextjs/node_modules/playwright`, launch with
   `executablePath: '/opt/pw-browsers/chromium'`. Do NOT run `playwright install`.
   Listen for `securitypolicyviolation`, `console` errors, `pageerror`, and HTTP ≥ 400.
5. Telegram stub: `TelegramClient`/`Bot` call `https://api.telegram.org`. Run the compiled bot code
   (`npx tsc -p tsconfig.server.json --outDir <scratch>`) with a stubbed global/undici `fetch`
   (see how `lib/telegram/client.ts` / `bot.ts` issue requests) to simulate `getUpdates` with
   `/start <code>`, `/link <code>`, photo messages, and `getFile`/file download.
6. Docker (optional, for AC-12): `dockerd` may need starting (`(dockerd > /var/tmp/dockerd.log 2>&1 &)`).
   Base image pulls may 429 from Docker Hub — use `mirror.gcr.io/library/node:20-alpine` in a
   scratch copy of the Dockerfile and inject `/root/.ccr/ca-bundle.crt` (see `--build-context ca=/root/.ccr`).
   Never edit the real `nextjs/Dockerfile`.

## Acceptance Criteria to Test

- **AC-1: Session revalidation (Auth — deep)**
  Expected: demotion (owner/admin → user), removal from project, superadmin flag cleared, deactivation and
  deletion take effect on the very next request without re-login; `/api/auth/session` reflects DB role;
  client `useSession().update({ currentProjectRole: 'owner', currentProjectId: <other project> })` cannot escalate.
  Test: log in via UI, mutate DB, call `/api/auth/session` and role-gated APIs (e.g. `PUT /api/project-settings`,
  `GET /api/admin/users`, `POST /api/bills/bulk-delete`); attempt the `update()` escalation from the browser console.

- **AC-2: Password change / reset revoke sessions**
  Expected: after `PATCH /api/users/me/password` the user is signed out (UI shows message then signs out);
  a second browser context with the old cookie gets 401; same after reset-password via token. Reset tokens
  single-use (two concurrent POSTs → only one succeeds). Password policy enforced (8–128, upper/lower/digit).

- **AC-3: Pre-registration takeover closed**
  Expected: attacker signs up `victim@qa.test` (unverified, attacker password). Then (a) victim accepts an
  invite for that email → must set own password; attacker password no longer works. (b) Simulate Google
  sign-in path by unit-level call of the `signIn` callback or code review + DB check: unverified account gets
  `passwordHash=''`, `sessionVersion+1`. Invite for a **deactivated** account returns 403, does not re-activate.
  Invite token single-use under concurrency.

- **AC-4: Login protections**
  Expected: per-IP (5/min) and per-email (10/15min) limits on `/api/auth/callback/credentials` → 429;
  spoofed `X-Forwarded-For` does not bypass; unknown-email logins take similar time to wrong-password logins
  (measure, report medians); disabled-account message only after correct password; mixed-case login works
  (`mixed.case@qa.test`).

- **AC-5: Case-insensitive email uniqueness**
  Expected: signup with `MIXED.CASE@qa.test` doesn't create a second account; DB rejects case-variant insert;
  forgot-password / resend-verification / invite / accept-invite find the stored mixed-case account.
  Migration guard aborts on pre-existing duplicates (apply migration SQL to a scratch DB with duplicates).

- **AC-6: DB-verified admin & superadmin guards**
  Expected: every route under `/api/admin/**`, `/api/superadmin/**`, `/api/project-settings`, `/api/ocr-log`
  returns 401/403 for regular members and for a demoted admin; superadmin cannot demote self / last superadmin;
  last owner cannot be removed/demoted (also with two concurrent requests); member `positionId` from another
  project rejected; non-admin calling `GET /api/project-settings` gets 403 and is NOT logged out.

- **AC-7: Telegram (deep, stubbed API)**
  Expected: `POST /api/admin/telegram/invite` returns `{ sent, expires }` and never the code/deepLink;
  link via `/start CODE` and `/link code` (lowercase) both work; >5 wrong codes per 10 min rejected;
  photo from a linked user creates a draft bill (transactional, image stored, allocations default);
  photo from a user removed from the project is refused and the stale link deleted; bot stops on 401/404/409
  from getUpdates and continues after a 400; bot token never appears in logs; restart/stop via admin routes works.

- **AC-8: Money correctness (deep)**
  Expected: V-Geld balance (sidebar `/api/vgeld/balance`), dashboard balance, `/api/vgeld/analysis` and user
  PDF Saldo all agree for each user = confirmed transfers − (brutto19+brutto7+brutto0 of confirmed/approved/paid
  bills); draft/pending/rejected excluded; unconfirmed transfers excluded; rounding to cents (test values like
  0.1+0.2, 33.333 splits). Spending by motive/category matches hand-computed allocation splits and budget
  matrix totals; unallocated row correct. Confirm button on `/vgeld` works (PATCH `/api/vgeld/[id]`), double
  confirm → 400. Members only see their own transfers; analysis 403 for members. Excel/Google-Sheet export
  totals match (Sheets: test the cell-sanitising function on `=HYPERLINK(...)`, `+1`, `-1`, `@x`).

- **AC-9: Bills, images & uploads**
  Expected: POST validation (negative/NaN/>1e6 amounts, bad date, allocations >100 or negative or duplicate ids,
  oversized strings) → 400 with no orphan files; unique stored filenames across users/projects; bill numbers not
  reused after delete; concurrent status changes → one 200, one 409; paid is terminal; images cannot be
  added/replaced/deleted/reordered on approved/paid bills by the submitter; image PUT validates magic bytes;
  `/api/uploads/...` denied to non-members and removed members; path traversal (`..%2f`) blocked; >cap body → 413;
  chunked upload without Content-Length still works.

- **AC-10: OCR SSRF & locking**
  Expected: provider/base-URL change without re-entering key → 400 (but an untouched settings form saves fine);
  `safeFetch` refuses private targets including DNS-rebinding (Jest `__tests__/lib/safe-fetch.test.ts` + a live
  attempt with `ocrBaseUrl=http://127.0.0.1:<port>` and `http://localtest.me`); re-analysis on approved/paid
  bill refused; duplicate analyse → 409.

- **AC-11: CSP & security headers (Next 15)**
  Expected: every HTML response has `Content-Security-Policy` with a fresh nonce per request, all `<script>` tags
  carry it, zero `securitypolicyviolation` events across all pages and flows (incl. bill upload preview + crop
  modal, budget matrix, charts on /spending, reports PDF download, settings modals); `X-Frame-Options`, HSTS,
  `Permissions-Policy`, nosniff present; `/_next/image` → 404; inline-script injection in a bill vendor field is
  not executed.

- **AC-12: Dependency & build health**
  Expected: `npm audit --omit=dev` → 0; `next build`, `tsc -p tsconfig.json`, `tsc -p tsconfig.server.json`, lint
  clean; full Jest suite green against `setcash_test`; (if Docker works) image builds, boots, migrates, seeds,
  `/api/health` 200.

## Edge Cases to Test
- EC-1: Old JWT issued before the deploy (no `sessionVersion` claim) keeps working.
- EC-2: Project switch (`/api/projects/switch` + `update()`) still works for members and superadmins.
- EC-3: User with no `defaultProjectId` / zero memberships can still log in and reach onboarding.
- EC-4: Google-only account (empty password) gets the "use Google / forgot password" message on password change.
- EC-5: Accept-invite for an existing *verified* account doesn't ask for a password and doesn't change it.
- EC-6: Bill with only `grossAmount` (OCR) — totals consistent across list, detail, PDF, spending.
- EC-7: Allocations summing to < 100% and exactly 100% with rounding (33.33×3).
- EC-8: V-Geld transfer to a user later removed from the project — balances/analysis still sane.
- EC-9: Upload of PDF receipt (magic bytes) and of a renamed non-image (`.jpg` with PDF bytes) → rejected.
- EC-10: Concurrent last-owner demotion from two browser contexts.
- EC-11: Rate limiter in-memory fallback (no Upstash) — limits reset after window.
- EC-12: Middleware matcher — paths with dots (`/api/uploads/x.jpg`) still require auth at route level.

## Security Audit Scope
- Authentication bypass: unauthenticated access to every `/api/**` route (script over the route list from
  `find app/api -name route.ts`), forged/expired/tampered JWT cookies, `callbackUrl` open redirect.
- Authorization (IDOR): user-a1 vs user-a2 vs user-b1 across bills, images, comments, V-Geld, notifications,
  reports `/api/reports/user/[email]/pdf`, uploads, telegram links; admin of A acting on project B via `[id]` params.
- Input injection: XSS in vendor/item/comment/bug report/invite message (rendered in UI, PDF, emails, Sheets);
  SQL injection attempts in query params (Prisma parameterised; raw SQL in `lib/spending.ts`, admin analytics).
- Rate limiting: login, signup, forgot/resend, invites, bill create, image upload, analyse, telegram link,
  analytics (global cap).
- Exposed secrets: no secrets in client bundles (`.next/static`), API responses (OCR key masked, bot token
  masked), logs, git history (`git log --all --diff-filter=A -- '*.env*'`).
- Sensitive data in responses: user listings, member names, analysis, error bodies (no Prisma internals).
- Bug-report → GitHub issue body: no `@claude`, user text fenced, `@` neutralised (inspect the built body
  without sending; GITHUB_TOKEN unset).

## Regression Test Scope
- All features with status Deployed/Complete in `features/INDEX.md`, spot-checked end-to-end in the UI:
  bills list/filter/new/detail/edit/crop/delete, status workflow, comments + mentions + notifications,
  budget matrix edit, spending tabs, V-Geld create/confirm/delete, reports (budget-matrix PDF, user PDF,
  Excel, images ZIP), settings (members, positions, motives, categories, OCR, Telegram, projects), superadmin
  modal (users, projects, config), tour, profile edit, bug report modal, analytics endpoints, demo login API.
- Next 15 specifics: every dynamic route (`[id]`, `[[...path]]`) with real params, client pages using
  `use(params)`, server components reading `headers()`/`cookies()`, middleware redirects with `callbackUrl`.

## Responsive / Cross-Browser Scope
- Breakpoints: 375px, 768px, 1440px — dashboard, bills list, new bill, bill detail, budget, V-Geld, settings.
- Browsers: Chromium only (Firefox/Safari unavailable here — record as not tested).

## Bug Report Template
Use `.claude/skills/qa/test-template.md`. Tag every bug with severity and responsible skill
([Frontend], [Backend], [Architecture], [Deploy]).
