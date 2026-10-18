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

---

## QA Test Results

**Tested:** 2026-10-18
**App URL:** http://localhost:3101 (local production build, `NODE_ENV=production tsx server.ts`, fresh seeded Postgres 16 on :5433)
**Tester:** QA Engineer (AI)
**Branch / commit:** `claude/keen-rubin-b78ded` @ `35e4331` (code = `c8db29e`)

**Method.** `next build` was re-run, then the app was driven with scripted HTTP clients (distinct loopback source IPs so the per-IP limiter could be exercised), Playwright Chromium (`/opt/pw-browsers/chromium`), real Prisma/SQL checks, a local Telegram Bot API emulator (all `api.telegram.org` traffic redirected by a preload stub) and Jest. Test data: projects A, B and C with owners, admins, members, a superadmin, a deactivated user, `Mixed.Case@QA.test`, and bills in every status with hand-computed V-Geld/allocation totals. No third-party service was contacted with real credentials.

### Acceptance Criteria Status

#### AC-1: Session revalidation — PASS
- [x] Owner→user demotion shows in `/api/auth/session` on the next request; `PUT /api/project-settings` and `POST /api/bills/bulk-delete` then return 403
- [x] Removal from the project sets `currentProjectId` to null; bill list and detail are refused
- [x] Clearing the superadmin flag drops the role; `GET /api/admin/users` then returns 403
- [x] Deactivation and deletion end the session on the next request (session `null`, APIs return 307)
- [x] `update()` escalation (`POST /api/auth/session` with `role: superadmin, currentProjectRole: owner, currentProjectId: <B>`) is ignored, tested over HTTP and from the browser console in Chromium
- [x] Promotion also takes effect on the next request
- [x] A valid JWT carrying escalated claims is re-synced from the DB. Forged (wrong secret), tampered, `alg:none` and expired tokens (beyond the 15 s clock tolerance) are rejected

#### AC-2: Password change / reset revoke sessions — FAIL (BUG-3)
- [x] Policy enforced: rejects under 8 chars, missing upper/lower case, missing digit, and more than 128 chars
- [x] `PATCH /api/users/me/password` returns `reauthRequired`. The UI shows "Password updated. Please sign in again…" and then signs out. A second browser context with the old cookie is logged out
- [x] Reset via token: two concurrent POSTs give exactly one 200 and one 400; the existing session is revoked; the token is single-use
- [x] Wrong current password → 401; the 6th attempt within 15 min → 429
- [ ] BUG-3: a superadmin password reset or set-password (`PUT /api/admin/users/[email]`) does **not** revoke the user's sessions

#### AC-3: Pre-registration takeover closed — PASS
- [x] Attacker pre-registers `victim@qa.test` and cannot log in (`EmailNotVerified`, shown only with the correct password)
- [x] Invite for that email: GET reports `userExists:false`. Accepting without a password → 400. The victim sets their own password, after which the attacker's password fails. `sessionVersion` goes 0→1 and the victim is auto-added to the project
- [x] Google `signIn` callback, called at unit level (Jest, real DB): an unverified account gets `passwordHash=''`, `sessionVersion+1` and is verified, and `user.email` is rewritten to the stored case. A verified account is untouched, a deactivated account is refused, and a new email is auto-created verified
- [x] Invite for a deactivated account → 403; the account is not re-activated and not added to the project
- [x] Invite token is single-use (reuse → 400; 3 concurrent accepts → exactly one 200)

#### AC-4: Login protections — FAIL (BUG-1, BUG-11)
- [x] Per-IP limit: the 6th attempt within a minute → 429. Spoofing `X-Forwarded-For`, `cf-connecting-ip`, `x-real-ip` or `x-setcash-peer-ip` does not bypass it (`TRUSTED_IP_HEADER=none`)
- [x] Per-email limit (10 per 15 min) with form bodies, across rotating IPs and upper/lower-case variants → 429
- [ ] BUG-1: the per-email limit is bypassed entirely when the credentials POST is JSON-encoded
- [x] Disabled-account message appears only after the correct password
- [x] Mixed-case login `mixed.case@qa.test` works; the session carries the stored `Mixed.Case@QA.test`
- [ ] BUG-11: timing is equal only for cost-12 hashes. Medians: unknown email 380 ms vs wrong password 383 ms (cost-12 account) — but 100 ms for cost-10 accounts
- [x] Path variants (`/callback/credentials/`, `%63redentials`, `CREDENTIALS`, `//auth`) do not reach `authorize` past the limiter

#### AC-5: Case-insensitive email uniqueness — FAIL (BUG-13, Low)
- [x] Signup with `MIXED.CASE@qa.test` returns the generic message and creates no second account
- [x] The DB rejects a case-variant insert (`duplicate key value violates unique constraint "User_email_lower_key"`)
- [x] forgot-password, resend-verification, platform invite and accept-invite all resolve the stored mixed-case account
- [x] Migration guard on a scratch DB holding `Dup@QA.test` and `dup@qa.test`: aborts with the documented message and creates no index; applies cleanly after the merge. `prisma migrate diff` does not try to drop the expression index
- [ ] BUG-13: `POST /api/projects/[id]/invite` compares emails case-sensitively

#### AC-6: DB-verified admin & superadmin guards — PASS
- [x] Sweep of 56 endpoint-methods under `/api/admin/**`, `/api/superadmin/**`, `/api/project-settings`, `/api/ocr-log` and `/api/projects/[id]/**` as anonymous, regular member and demoted admin: every admin-only operation is denied (401/403/307). Only member-level reads succeed (motives, categories, positions, names, quota, project GET), which is by design
- [x] Non-admin `GET /api/project-settings` → 403 and the session stays valid (not logged out)
- [x] Superadmin cannot demote or delete themselves. Concurrent mutual demotion of the last two superadmins: 3/3 rounds left one superadmin (one 200, one 409)
- [x] Last owner cannot be demoted or removed via the project routes or the superadmin routes. Two concurrent owner removals → one 200 + one 409 and an owner remains (EC-10)
- [x] A `positionId` from another project is rejected on both member routes
- [x] Admin of A cannot act on project B through `[id]` params (15 endpoints → 403/404)

#### AC-7: Telegram, stubbed Bot API — PASS (one extra finding: BUG-8)
- [x] Token is checked with `getMe` against the stub, encrypted at rest and masked (`...tXYZ`) in the settings response
- [x] `POST /api/admin/telegram/invite` returns exactly `{sent, expires}`; the deep link reaches only the member's notification
- [x] `/start CODE` and `/link code` (lower case) both link; codes are single-use
- [x] From one Telegram user, attempts 6 and 7 within 10 min → "Zu viele Versuche"
- [x] A photo from a linked user creates a draft bill in one transaction: largest size downloaded, file stored, Default/Uncategorized at 100%. An album creates one bill with 2 images
- [x] Photos from an unlinked user are refused. A user removed from the project (stale link) is refused and the link deleted. Member removal via the API deletes the link and clears the default project
- [x] Bot keeps polling after a 400 from getUpdates and stops on 401, 404 and 409. Admin restart works after each stop; disabling stops the bot; a member cannot restart it
- [x] The bot token never appears in the server logs (checked across two log files, including about 18k polling and download events)
- [ ] BUG-8 (extra): a **deactivated** user who is still a member can still create bills via Telegram

#### AC-8: Money correctness — FAIL (BUG-2, BUG-12)
- [x] Sidebar `/api/vgeld/balance`, dashboard, `/api/vgeld/analysis` and user-PDF "Saldo" agree: user-a1 = 200.30 − 133.63 = **66.67**, user-a2 = 30.00 − 25.01 = **4.99**. Draft, pending and rejected bills and unconfirmed transfers are excluded; 0.10 + 0.20 = 0.30 is exact
- [x] Spending by motive and category per row matches the hand computation (M1 33.63, M2 50.00, M3 33.33, Default 41.69; C1 50.30, C2 50.00, Uncategorized 58.34). With every bill allocated there is no unallocated row
- [x] V-Geld Confirm button (Chromium) → `PATCH /api/vgeld/[id]` 200 and confirmed in the DB. Double confirm → 400. A member cannot confirm (403), sees only their own 4 of 5 transfers, and gets 403 on analysis
- [x] Sheets cell sanitiser: `=HYPERLINK(…)`, `+1`, `-1`, `@x` and `\t=1` are prefixed with `'`; numbers are untouched (function extracted from the route and run)
- [ ] BUG-2: the Excel / Google-Sheets "Budget Matrix → Spent" totals do not match the app
- [ ] BUG-12: the motive-tab `totals.spent` is 158.65 while the category tab and the bills give 158.64 (one-cent drift)

#### AC-9: Bills, images & uploads — FAIL (BUG-6, BUG-7, BUG-17, BUG-18)
- [x] `POST /api/bills` → 400 with no bill and no orphan file for: negative, NaN, >1e6, three-decimal and Infinity amounts; bad date; year 2200; allocations over 100; negative allocation; duplicate ids; invalid JSON; cross-project motive; vendor >200, item >500, comment >2000 chars
- [x] Stored filenames are unique across users and uploads (random suffix)
- [x] Concurrent status changes → one 200 + one 409. `paid` is terminal (5 × 422). Paid amounts are immutable
- [x] The submitter cannot add, replace, delete or reorder images on approved or paid bills (403); an admin can
- [x] Image PUT checks magic bytes (`.jpg` with PDF bytes → 400; a real PNG → 200)
- [x] `/api/uploads/...`: owner, member and superadmin → 200. Non-member → 403. A removed member goes from allowed to 403. Unauthenticated → 401 (EC-12)
- [x] Path traversal variants (`..%2f`, `%2e%2e`, double-encoded, backslashes, screenshot route) → 404/400
- [x] Body over the cap with Content-Length → 413; a chunked upload without Content-Length succeeds
- [ ] BUG-6: files under unexpected field names are left as orphans
- [ ] BUG-7: a bill number is reused after deleting the user's latest bill
- [ ] BUG-17: hex and exponent amounts are accepted
- [ ] BUG-18: an over-cap chunked body returns 400 instead of 413
- [ ] Also found (Medium): BUG-4 (approved/paid bills editable by the submitter) and BUG-5 (no validation on `PUT /api/bills/[id]`)

#### AC-10: OCR SSRF & locking — PASS (extra: BUG-15)
- [x] Changing provider or base URL without re-entering the key → 400 (also when the masked key is sent back). An untouched settings form with the masked key saves with 200. The key is masked in GET responses and OCR logs
- [x] Live analyse attempts against a local TCP listener on 127.0.0.1:8443, the listener got **0 connections** for: `https://127.0.0.1`, `https://[::ffff:127.0.0.1]`, `https://2130706433`, `https://0x7f.1`, `https://169.254.169.254` (all private-address refusals), `http://127.0.0.1` (https required) and `https://localtest.me`. `localtest.me` did not resolve in the sandbox, so it was refused fail-closed. DNS rebinding is covered by `__tests__/lib/safe-fetch.test.ts`, which passes
- [x] Re-analysis of approved or paid bills → 409. Duplicate concurrent analyse → one 202 + one 409 (3/3 rounds). A member gets 403

#### AC-11: CSP & security headers (Next 15) — PASS
- [x] 21 HTML pages: a fresh nonce on every response (never reused) and every `<script>` carries it. Headers present on each: `X-Frame-Options: DENY`, HSTS `max-age=63072000; includeSubDomains; preload`, `nosniff`, `Permissions-Policy`, `Referrer-Policy`. CSP has no `unsafe-inline` or `unsafe-eval` for scripts
- [x] Zero `securitypolicyviolation` events in Chromium across all public and protected pages and flows: bill upload preview plus crop modal, budget edit and save, `/spending` charts, PDF/Excel/ZIP downloads, settings modal, superadmin modal, tour, and 375/768/1440 px viewports
- [x] `/_next/image` → 404 (local and remote URL), also inside the Docker image
- [x] Stored XSS in vendor, item, type, comment, bill comment, first name and invite message is not executed (`window.__xss` stays undefined) and renders as text. There is no `dangerouslySetInnerHTML` in the app
- [x] `callbackUrl` open redirect blocked on credentials login and signout. The middleware keeps `callbackUrl` relative

#### AC-12: Dependency & build health — PASS
- [x] `npm audit --omit=dev` → 0 vulnerabilities
- [x] `next build` OK (lint warnings only). `tsc -p tsconfig.json`, `tsc -p tsconfig.server.json` and `next lint` exit 0 (14 warnings, 0 errors)
- [x] Full Jest suite against `setcash_test`: 13 suites, 80/80 tests pass
- [x] Docker (scratch Dockerfile using `mirror.gcr.io` and the proxy CA): image builds; boot runs `migrate deploy` (20 migrations), seed and server; `/api/health` → 200; container `healthy`; runs as non-root `nextjs`; login works. See BUG-22 for the HEALTHCHECK port

### Edge Cases Status

#### EC-1: Pre-deploy JWT without `sessionVersion`
- [x] Still valid and can call the API. It is correctly rejected once the user's `sessionVersion` is above 0
#### EC-2: Project switch
- [x] Works for owners and members (session shows the new project and role) and for superadmins (the UI shows the new project)
#### EC-3: User with zero memberships
- [x] Logs in; session has a null project; `/dashboard` returns 200 (onboarding)
#### EC-4: Google-only account changes password
- [x] Credentials login gets `code=GoogleOnlyAccount`. Password change → 400: "This account signs in with Google. Use "Forgot password"…"
#### EC-5: Invite for an existing verified account
- [x] GET reports `userExists:true`. Accepting does not change the password, even when one is sent
#### EC-6: Bill with only `grossAmount` (OCR)
- [ ] BUG-9: list and detail show 50.00, the PDF row shows 0.00, and balance, spending and Saldo ignore the bill
#### EC-7: Allocations below 100% and 33.33 × 3
- [x] The remainder goes to Default (0.01 for 33.33 × 3; 50% for a 50% allocation). The Default motive cannot be deleted (400), so spending always totals 100%
#### EC-8: V-Geld transfer to a member later removed
- [x] Analysis still shows received 40 / spent 15 / remaining 25; the transfer list and the PDF still work
#### EC-9: PDF receipts and renamed files
- [x] A real PDF is accepted and served as `application/pdf` with `nosniff`. A `.jpg` holding PDF bytes is rejected (see BUG-19 for silently dropped types)
#### EC-10: Concurrent last-owner demotion
- [x] Always leaves at least one owner (one 200 + one 409/403)
#### EC-11: In-memory limiter
- [x] Blocks at the limit and resets after the window (6th attempt 429; after 61 s → 302)
#### EC-12: Dotted paths skip the middleware
- [x] `/api/uploads/x.jpg` without a session → 401 from the route

### Security Audit Results
- [x] Authentication: all 122 non-public endpoint-methods (from `find app/api -name route.ts`) return 401/307 without a session. Forged, tampered, `alg:none` and expired JWTs are rejected; no open redirect via `callbackUrl`
- [x] Authorization (IDOR, 38 checks), all denied or no effect: user-a2 vs user-a1 (edit/delete bill, images, reorder, status, verify-field, comment edit/delete, V-Geld delete, report PDF in either letter case); user-b1 vs project A (bill, ocr-status, comments, uploads, V-Geld confirm, members/names, project, switch, PDF); admin-A vs project B (bill GET/DELETE/status, bulk-delete deletes 0, PDF, Telegram invite, V-Geld to a non-member, budget-matrix write with B's ids, PUT with B's motive). `POST /api/notifications/<other user's id>/read` returns 200 but changes nothing (DB unchanged)
- [x] Input injection: XSS payloads inert in the UI (above); invite emails use `escapeHtml`; Sheets formula injection neutralised; Excel writes strings as text. SQL-injection probes on bills, spending, vgeld, admin analytics, ocr-log and notifications produce no error leak, no delay and intact tables (raw SQL uses tagged templates)
- [x] Rate limiting verified: login per IP and per email (see BUG-1), signup 3/10 min/IP, forgot-password 1/5 min/email (case-insensitive), resend 1/2 min, platform invite 10/h/user, project invite 20/h/project, bill create 10/min, image upload 30/min, analyse 5/min, Telegram link 5/10 min, link-code 5/10 min, comments 20/min, analytics 30/min/IP, password change 5/15 min
- [x] Exposed secrets: no secret values or server env names in `.next/static` (only `NEXT_PUBLIC_TURNSTILE_SITE_KEY`). OCR key and bot token are masked in responses and absent from logs. `git log --all --diff-filter=A -- '*.env*'` shows only example files; a truncated Google OAuth client-id prefix (`976956404918-`, empty secret) sits in the historical `.env.example` (informational)
- [x] Sensitive data: no password hashes or session versions in user or member listings or `/api/users/me`. Error bodies carry no Prisma or stack internals. The 500s found are generic (BUG-15, BUG-16)
- [x] Bug report → GitHub issue body, built with `GITHUB_TOKEN` stubbed and `fetch` captured, nothing sent: the user text sits in a fence longer than any backtick run in it, every `@` becomes `@‍` (no `@claude` substring in title or body, so `claude.yml` `contains()` will not match), reporter is a hash ref (no email), and an untrusted-input banner is present
- [ ] BUG-1 (High): per-email brute-force limit bypass via JSON body
- [ ] BUG-3 (Medium): admin password reset leaves the attacker's sessions alive
- [ ] BUG-6 (Medium): unauthenticated-content disk fill via stray multipart fields (authenticated users only)
- [ ] BUG-8 (Medium): deactivated users keep a Telegram upload channel

### Bugs Found

IDs below are local to this QA run (not yet registered in `features/INDEX.md`; next global ID there is BUG-85).

#### BUG-1: Per-email login rate limit bypassed with a JSON-encoded credentials body
- **Severity:** High · **Skill:** [Backend]
- **Where:** `nextjs/app/api/auth/callback/credentials/route.ts:24-32`. `getLoginEmail()` only reads `req.clone().formData()`, which throws for `application/json`, so the email is `null` and `loginEmailLimiter` is skipped. Auth.js accepts JSON bodies on this endpoint.
- **Steps to Reproduce:**
  1. `GET /api/auth/csrf` (keep the cookie).
  2. `POST /api/auth/callback/credentials` with `Content-Type: application/json` and body `{"email":"user-b1@qa.test","password":"wrongN","csrfToken":"…"}`. Repeat 13 times, rotating the client IP after every 4 attempts.
  3. Expected: 429 from attempt 11 (10 per 15 min per email), as happens with form bodies.
  4. Actual: all 13 return `302 …/login?error=CredentialsSignin`; no 429 ever. A JSON request with the correct password returns `302 /dashboard` and sets `authjs.session-token`, so JSON is a fully working login channel. Only the per-IP limit (5/min) remains.
- **Priority:** Fix before deployment

#### BUG-2: Excel and Google-Sheets export "Budget Matrix → Spent" ignores approved/paid bills (and is netto, unrounded)
- **Severity:** High · **Skill:** [Backend]
- **Where:** `nextjs/app/api/admin/export/excel/route.ts:260-271` and `nextjs/app/api/admin/export/google-sheet/route.ts:276-287` use `WHERE b.status = 'confirmed'`. The app uses `SPENDING_BILL_STATUSES` (confirmed, approved, paid) in `lib/spending.ts` and the budget page.
- **Steps to Reproduce:**
  1. Have one confirmed, one approved and one paid bill allocated to different motives (seed: a1B2 approved on M1/M2/M3, a1B3 paid on M2).
  2. As admin, `GET /api/admin/export/excel` and open the "Budget Matrix" sheet.
  3. Expected: the Spent row and column equal `/api/spending` and `/budget`.
  4. Actual: Spent M2 = 0 and M3 = 0, while `/api/spending` netto shows M2 = 44.67 and M3 = 32.21. Values are unrounded (e.g. `904.7662766040994`).
- **Priority:** Fix before deployment

#### BUG-3: Superadmin password reset / set-password does not revoke existing sessions
- **Severity:** Medium · **Skill:** [Backend]
- **Where:** `nextjs/app/api/admin/users/[email]/route.ts` `PUT`. The `updates` object only sets `passwordHash` and `isSuperAdmin`, with no `sessionVersion: { increment: 1 }`.
- **Steps to Reproduce:**
  1. Log in as `t-adminreset@qa.test` (session S).
  2. As superadmin, `PUT /api/admin/users/t-adminreset@qa.test` with `{"resetPassword":true}` (also tried `{"password":"Custom0Passw"}`); both return 200.
  3. Expected: S is revoked, as with self-service change or reset.
  4. Actual: `GET /api/auth/session` with S still returns the user; DB `sessionVersion` stays 0. An admin "reset because compromised" leaves the attacker logged in.
- **Priority:** Fix before deployment

#### BUG-4: Submitter can re-allocate and edit vendor/date/item of approved and PAID bills without re-approval
- **Severity:** Medium · **Skill:** [Backend]
- **Where:** `nextjs/app/api/bills/[id]/route.ts` `PUT`. The paid/approved rules only cover `brutto*` changes; allocations, date, vendor, item and type are always writable by the owner.
- **Steps to Reproduce:**
  1. As user-a1, on own approved bill a1B2 (M1/M2/M3 33.33% each), `PUT /api/bills/<id>` with `{"motiveAllocations":[{"motiveId":"<M3>","percentage":100}],"vendor":"edited after approval","date":"2025-01-01T00:00:00.000Z"}`.
  2. Expected: 403/409, or reset to pending like an amount change.
  3. Actual: 200; status stays `approved`; spending moves M1 33.63 → 0.30 and M3 → 105.00. The same works on a `paid` bill (200).
- **Priority:** Fix before deployment

#### BUG-5: `PUT /api/bills/[id]` lacks the POST validation (amount cap, cent precision, string lengths)
- **Severity:** Medium · **Skill:** [Backend]
- **Where:** `nextjs/app/api/bills/[id]/route.ts:22-33` (`updateBillSchema`: `z.number().min(0)`, `z.string()` with no max).
- **Steps to Reproduce:**
  1. `PUT /api/bills/<own bill>` with `{"brutto19":123456789012}`, then `{"brutto7":0.0001}`, then `{"vendor":"V"×100000}`.
  2. Expected: 400 each, like `POST /api/bills` (1e6 cap, `multipleOf(0.01)`, vendor ≤200).
  3. Actual: 200 each. Stored `brutto19=123456789012`, `brutto7=0.0001`, `grossAmount=123456789012.0001`, a 100,000-char vendor; the dashboard showed "Budget spent 123.456.790.204,38 of 700,00 €".
- **Priority:** Fix before deployment

#### BUG-6: Files sent under an unexpected multipart field name are left as orphans in UPLOADS_DIR
- **Severity:** Medium · **Skill:** [Backend]
- **Where:** `nextjs/lib/upload.ts` `parseForm` stores every file part with an allowed extension. The routes only collect and clean `photos` (`app/api/bills/route.ts`, `app/api/bills/[id]/images/route.ts`) or `photo` (`…/images/[imageId]/route.ts`). Other parts are neither validated (magic bytes) nor deleted, whether the request fails or succeeds.
- **Steps to Reproduce:**
  1. `POST /api/bills` multipart with `brutto19=-1` and a 3 MB file in field `evil` named `big.jpg` (content: 0x01 bytes).
  2. Expected: 400 and no file left behind.
  3. Actual: 400 (`brutto19: Too small`), yet `UPLOADS_DIR/lcmkx80l5v50chndafclsquec.jpg` (3,145,728 B) remains. The same happens on a successful POST. Up to ~100 MB per request can be persisted this way (disk-fill), with no magic check.
- **Priority:** Fix before deployment

#### BUG-7: Bill number is reused after deleting the user's latest bill
- **Severity:** Medium · **Skill:** [Backend]
- **Where:** `nextjs/app/api/bills/_lib/shared.ts` `nextBillNumber()` takes max(existing)+1, so deleting the highest number frees it.
- **Steps to Reproduce:**
  1. New user creates bills 1.01, 1.02, 1.03.
  2. Delete 1.03; create a new bill.
  3. Expected: 1.04 (spec: "bill numbers no longer reused after deletes").
  4. Actual: the new bill gets **1.03**, the same number as the deleted bill, which is recorded in the EditLog `_event: deleted` row and possibly in earlier exports. Deleting a middle bill is fine (next is 1.04).
- **Priority:** Fix in next sprint

#### BUG-8: Deactivated users can still upload bills through Telegram
- **Severity:** Medium · **Skill:** [Backend]
- **Where:** `nextjs/lib/telegram/handlers.ts` `handleMessage` photo branch. It checks `TelegramLink` + `ProjectMember` only, never `User.isActive`.
- **Steps to Reproduce:**
  1. Link `tg-deact@qa.test` (member of A) via `/link CODE`.
  2. Set `isActive=false` (deactivated; web sessions now end).
  3. Send a photo from that Telegram user.
  4. Expected: refused, as for removed members.
  5. Actual: reply "✓ Foto empfangen – Beleg als Entwurf gespeichert"; one draft bill created for the deactivated user (log: `[TG …] Created draft bill #4c65f212… for tg-deact@qa.test`).
- **Priority:** Fix before deployment

#### BUG-9: Bills with only `grossAmount` (OCR "amount" path) are counted inconsistently
- **Severity:** Medium · **Skill:** [Backend]
- **Where:** `lib/ocr.ts:684-690` can write `grossAmount` with all `brutto*` = 0. `lib/vgeld.ts`, `lib/spending.ts` and the user PDF sum only `brutto19+brutto7+brutto0`; the list and detail show `amount = grossAmount`.
- **Steps to Reproduce:**
  1. Bill with vendor "OCR Vendor", `grossAmount=50`, brutto 0 (what OCR writes for a receipt without a VAT breakdown); admin moves it to confirmed and then approved.
  2. User has 100.00 confirmed V-Geld.
  3. Expected: all views agree (balance 50.00).
  4. Actual: list/detail `amount` 50.00; PDF row 0.00; sidebar, dashboard and PDF Saldo **100.00**; spending ignores the bill.
- **Priority:** Fix in next sprint

#### BUG-10: Users created by a superadmin cannot sign in (regression of CR-8, pre-existing)
- **Severity:** Medium · **Skill:** [Backend]
- **Where:** `nextjs/app/api/admin/users/route.ts` `POST` creates the user without `emailVerified`; `auth.ts` `authorize` throws `EmailNotVerified`. These accounts are also treated as "unverified" by the new takeover protection (their password is dropped on Google sign-in or invite).
- **Steps to Reproduce:**
  1. Superadmin `POST /api/admin/users` `{"email":"Created.By.Super@QA.test","password":"Created0Pw"}` → 200.
  2. Log in with those credentials.
  3. Actual: `302 /login?error=CredentialsSignin&code=EmailNotVerified`, and no verification email is ever sent.
- **Priority:** Fix in next sprint

#### BUG-11: Login timing still distinguishes known emails whose hash cost is not 12
- **Severity:** Low · **Skill:** [Backend]
- **Where:** `nextjs/auth.ts` `DUMMY_PASSWORD_HASH` (cost 12) vs `prisma/seed.ts` (`bcrypt.hash(…, 10)` for the admin and demo users) and any legacy or migrated hashes.
- **Evidence:** 9 samples each. Unknown email: median 380 ms. Wrong password on a cost-12 account: 383 ms (OK). Wrong password on a cost-10 account: 100 ms. So the seeded admin and demo accounts are enumerable by timing.
- **Priority:** Nice to have

#### BUG-12: Spending motive-tab total drifts by one cent (sum of per-row rounded values)
- **Severity:** Low · **Skill:** [Backend]
- **Where:** `nextjs/lib/spending.ts` `getSpendingTotals()` sums already-rounded rows. `roundCents` uses `Math.round(x*100)/100`, so half-cents round upward per row (`49.995 → 50.00`, `41.685 → 41.69`).
- **Evidence:** `/api/spending?tab=motive` `totals.spent = 158.65` (netto 139.12), while `?tab=category` = 158.64 (netto 139.13) and the sum of spending bills = 158.64.
- **Priority:** Fix in next sprint

#### BUG-13: Project invite handles email case-sensitively
- **Severity:** Low · **Skill:** [Backend]
- **Where:** `nextjs/app/api/projects/[id]/invite/route.ts`. The schema does not lowercase; `existingMember` and `prisma.user.findUnique({ where: { email } })` are exact matches.
- **Steps to Reproduce:**
  1. Invite `mixed.case@qa.test` to project B. Expected: an in-app `pending_invite` notification for the stored `Mixed.Case@QA.test`. Actual: 0 notifications (the platform invite does create one).
  2. Invite `USER-A1@QA.TEST` to project A (already a member). Expected: 400 "already a member". Actual: 200 "Invitation sent" (accepting is harmless).
- **Priority:** Nice to have

#### BUG-14: Telegram uploads bypass the project upload quota (PROJ-24, pre-existing)
- **Severity:** Low · **Skill:** [Backend]
- **Where:** `nextjs/lib/telegram/handlers.ts` `createDraftBill`: no `uploadLimit` check (and no EditLog entry for Telegram-created bills).
- **Evidence:** with `uploadLimit` = current count, web `POST /api/bills` → 403 "Upload limit reached", but a Telegram photo created bill #12 (before = 11).
- **Priority:** Fix in next sprint

#### BUG-15: `/api/ocr-log` with non-numeric `page`/`limit` → 500
- **Severity:** Low · **Skill:** [Backend]
- **Where:** `nextjs/app/api/ocr-log/route.ts`. `parseInt('abc')` → NaN reaches Prisma `skip`/`take`.
- **Steps:** as admin, `GET /api/ocr-log?page=abc&limit=xyz` → `500 {"error":"Internal server error"}` (stack in server log at `.next/server/app/api/ocr-log/route.js`).
- **Priority:** Nice to have

#### BUG-16: `/api/uploads/...%00...` → 500
- **Severity:** Low · **Skill:** [Backend]
- **Where:** `nextjs/app/api/uploads/[[...path]]/route.ts`. A NUL byte reaches the Prisma/Postgres query.
- **Steps:** `GET /api/uploads/a%00b.jpg` (authenticated) → `500 Internal server error`. Expected 400/404. No file access occurs.
- **Priority:** Nice to have

#### BUG-17: `POST /api/bills` accepts hex/exponent amount strings
- **Severity:** Low · **Skill:** [Backend]
- **Where:** `nextjs/app/api/bills/route.ts` `amountField` uses `Number(v)`.
- **Steps:** `brutto0=0x10` → 200 stored as 16; `brutto19=1e3` → 200 stored as 1000. Expected 400 ("anything that is not a plain decimal number is rejected").
- **Priority:** Nice to have

#### BUG-18: Over-cap chunked upload answers 400 instead of 413
- **Severity:** Low · **Skill:** [Backend]
- **Where:** `nextjs/lib/upload.ts` `toUploadError`. The limiter's `UploadError(413)` is lost when formidable reports the aborted stream.
- **Steps:** 102 MB multipart body sent with `Transfer-Encoding: chunked` → `400 {"error":"Invalid upload"}`. The same body with Content-Length → 413. The request is still rejected and no temp file remains.
- **Priority:** Nice to have

#### BUG-19: Disallowed file types are silently dropped and the bill is still created
- **Severity:** Low · **Skill:** [Backend] [Frontend]
- **Where:** `nextjs/lib/upload.ts` formidable `filter` discards non-allowed extensions without an error.
- **Steps:** `POST /api/bills` with `x.svg` (or `.gif`) → `200 {"ok":true}`, bill created with 0 images; the user gets no feedback.
- **Priority:** Nice to have

#### BUG-20: Member sees an "Approve" button on their own confirmed bill that the API refuses (pre-existing)
- **Severity:** Low · **Skill:** [Frontend]
- **Where:** `nextjs/app/(protected)/bills/[id]/page.tsx:202` (`canSelfApprove`) → `components/bills/BillDetailHeader.tsx`. The status API only allows authors confirmed→draft.
- **Steps:** as user-a1, open own confirmed bill and click "Approve" → `PATCH …/status` `403 {"error":"Forbidden"}`.
- **Priority:** Fix in next sprint

#### BUG-21: `docker-compose.test.yml` publishes Postgres on all interfaces with a hard-coded password (pre-existing)
- **Severity:** Low · **Skill:** [Deploy]
- **Where:** `docker-compose.test.yml:28-34` (`"5433:5432"`, `POSTGRES_PASSWORD: vbudget_test`). The main compose binds to `127.0.0.1` correctly.
- **Priority:** Nice to have

#### BUG-22: Dockerfile HEALTHCHECK hard-codes port 3001
- **Severity:** Low · **Skill:** [Deploy]
- **Where:** `nextjs/Dockerfile` (`wget … http://127.0.0.1:3001/api/health`).
- **Evidence:** with `-e PORT=3201` the app served 200 on 3201 but the container went `unhealthy` (5 failed probes). With the default port it is `healthy`.
- **Priority:** Nice to have

#### BUG-23: Analytics event/visit share one 30/min per-IP bucket, so normal browsing hits 429
- **Severity:** Low · **Skill:** [Backend]
- **Where:** `app/api/analytics/event/route.ts` uses `visitLogLimiter` (`event:${ip}`).
- **Evidence:** one Chromium session browsing ~20 pages logged 25+ `429 POST /api/analytics/event` console errors. Users behind a shared NAT will lose analytics data and see console noise.
- **Priority:** Nice to have

**Design note (not counted as a bug):** the per-email login limit also locks out the legitimate user for 15 min after 10 bad attempts by anyone; the correct password got 429. Consider a CAPTCHA step-up instead of a hard block. [Architecture]

### Not Tested / Limitations
- Firefox and Safari: not installed in this environment (Chromium only).
- Turnstile widget on demo login: no site/secret key. `POST /api/auth/demo-login` → 500 "Server configuration error". The token/cookie logic was tested with tokens inserted in the DB: cookie-bound, single-use, expiry, other-user reset token refused, demo password not resettable.
- Real Telegram: no bot token. Everything ran against a local Bot API emulator (getMe, getUpdates, sendMessage, getFile, file download), including 400/401/404/409 polling errors.
- Google OAuth sign-in end-to-end: covered only by a unit-level call of the `signIn` callback against the real DB. Google Sheets export only up to "credentials missing" (400) plus the sanitiser function. No Google API calls were made.
- Email delivery (Resend): not configured; tokens were read from or injected into the DB. Production logging never prints reset/invite URLs (code review).
- OCR providers: no API keys, so no successful OCR run. SSRF and locking were tested; DNS rebinding only via the Jest suite (`localtest.me` does not resolve in the sandbox).
- Upstash Redis limiter: not configured; only the in-memory fallback was tested. Limits are per process (not shared across instances).
- Docker: built from a scratch copy of the Dockerfile (`mirror.gcr.io/library/node:20-alpine` and the proxy CA); the real `nextjs/Dockerfile` was not modified.
- Image-lock race (bill approved while an image upload is in flight): not exercised.

### Summary
- **Acceptance Criteria:** 7/12 passed (AC-1, AC-3, AC-6, AC-7, AC-10, AC-11, AC-12). Failed: AC-2, AC-4, AC-5, AC-8, AC-9.
- **Edge Cases:** 11/12 passed (EC-6 failed).
- **Bugs Found:** 23 total (0 critical, 2 high, 8 medium, 13 low). 5 are pre-existing: BUG-10, 14, 20, 21, 23.
- **Security:** Issues found. BUG-1 (High) login brute-force limit bypass; BUG-3, BUG-6, BUG-8 (Medium).
- **Regression:** Deployed features work end to end in Chromium: bills list/new/crop/detail/edit/delete, status workflow, comments with @mentions and notifications, budget matrix edit, spending tabs, V-Geld create/confirm/delete, reports (budget PDF, user PDF, Excel, images ZIP), settings CRUD (members, positions, motives, categories, projects, OCR, Telegram), superadmin modal and APIs, tour, profile edit, bug-report modal, analytics endpoints, demo-login API. Next 15 dynamic routes, `use(params)` pages and middleware `callbackUrl` redirects work. No horizontal overflow at 375/768/1440 px; the mobile drawer works. Regressions found: BUG-10 and BUG-20 (both pre-existing).
- **Production Ready:** NO
- **Recommendation:** Fix BUG-1 and BUG-2 (High) first, then the Medium bugs BUG-3 to BUG-9. Re-run QA on AC-2, AC-4, AC-8 and AC-9 afterwards.
