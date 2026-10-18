## PROJ-26: Security Review & Dependency Hardening (Oct 2026)

**Status:** QA Passed
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

### QA Re-test (Round 2)

**Tested:** 2026-10-18
**App URL:** http://localhost:3101 (fresh DB `qa2_proj26`, `next build` + `NODE_ENV=production tsx server.ts`, Postgres 16 on :5433)
**Branch / commit:** `claude/keen-rubin-b78ded` @ `e348c17` (fix commits `67cf509`, `af9b231`, `e348c17`; new migration `20261019000000_bill_number_counter`)
**Method:** Same harness as round 1: scripted HTTP clients with rotating loopback IPs, Playwright Chromium, Prisma/SQL checks, the local Telegram Bot API emulator, Jest, and a Docker image built from a scratch copy of the Dockerfile (mirror base image plus the proxy CA). No third-party service was contacted.

#### Round-1 bugs

| Bug | Status | Evidence |
|---|---|---|
| BUG-1 (High) JSON login skips the per-email limit | VERIFIED FIXED | JSON body, 13 attempts with the IP rotated every 4: `302×10, 429×3`. `text/plain`, multipart and `Application/JSON` get 415. Malformed JSON, arrays and a missing email get 400. `email=decoy&email=victim` is limited per victim. The NextAuth client login still works. **But see BUG-24:** the per-email limit can still be bypassed with `_` variants of the address |
| BUG-2 (High) Excel/Sheets "Spent" ignores approved/paid bills | VERIFIED FIXED | Excel "Budget Matrix" Spent (brutto) row is 41.69 / 33.63 / 33.33 / 50.00, which equals `/api/spending` and `/api/budget-matrix`; grand total 158.64 = spending total. Values are rounded to cents. The Sheets route uses the same `getBudgetMatrixExportRows` |
| BUG-3 Superadmin password reset leaves sessions alive | VERIFIED FIXED | After `resetPassword` and after `password`, the old session returns `null` and `sessionVersion` is 2. The generated password meets the policy |
| BUG-4 Submitter edits approved/paid bills | VERIFIED FIXED | Owner edits of vendor, date, type, item, comment, allocations or amount on an approved bill → 200 and the bill goes back to `pending`. On a paid bill: 403 "Only an admin can modify a paid bill", and a refused allocation edit is rolled back. Saving an unchanged web bill keeps `approved`. Admin edits keep `approved` (an amount edit → `pending`), and an admin can edit a paid bill. **Regression: BUG-26** |
| BUG-5 `PUT /api/bills/[id]` lacks validation | VERIFIED FIXED | Returns 400 for 123456789012, 0.0001, negative, a string amount, 1e400, vendor of 100k chars, type >100, item >500, comment >2000. The vendor is trimmed and exactly 1e6 is accepted |
| BUG-6 Orphan files under unexpected field names | PARTIALLY FIXED | Bills POST, `POST …/images` and `PUT …/images/[id]` leave no stray file (including a 3 MB `evil` part, on both failure and success). Still open: the bug-report route keeps such files (BUG-28), and files past `maxFiles` are orphaned (BUG-27) |
| BUG-7 Bill number reused after deleting the latest bill | VERIFIED FIXED | Delete 1.03 → next is 1.04; a mixed-case user also never reuses a number, with one lower-cased counter row. 6 parallel first bills of a new user, 3 rounds: all 200 with 1.01–1.06. Ordinal 21 → 2.01. Migration backfill on a scratch DB: `Ann@X`/`ann@x` with 1.03 and 2.05 → `lastIndex` 25; `TG-…`, NULL and `1.5` are ignored |
| BUG-8 Deactivated users upload via Telegram | VERIFIED FIXED | Photo → "Dein SetCash-Account ist deaktiviert…" and 0 bills. `/link` by a deactivated user is refused (no link). After re-activation the kept link works again |
| BUG-9 Gross-only bills counted inconsistently | VERIFIED FIXED | A `grossAmount=50` bill (brutto 0, approved) shows 50.00 in the list, detail, sidebar balance, analysis, dashboard balance, dashboard recent bills, PDF row and Saldo ("Ohne MwSt.-Aufteilung" line), the spending motive/category deltas, the budget-matrix brutto delta and grand total, and the Excel Bills "Brutto Total". Netto side: see BUG-29 |
| BUG-10 Superadmin-created users cannot sign in | VERIFIED FIXED | `POST /api/admin/users` → the user logs in and reaches `/dashboard` |
| BUG-11 Login timing differs for cost-10 hashes | VERIFIED FIXED | Medians over 9 samples each: unknown email 354 ms, wrong password on a cost-10 account 354 ms, on a cost-12 account 346 ms. The cost-10 hash is upgraded to `$2b$12$` on login and login still works afterwards. Seed admin and demo users are at cost 12 |
| BUG-12 Motive-tab total off by one cent | VERIFIED FIXED | Motive and category tabs both give `spent` 158.64 and `nettoSpent` 139.12. The budget page grand total equals the server's once-rounded totals in both modes |
| BUG-13 Project invite is case-sensitive | VERIFIED FIXED | Invite to `mixed.case@qa.test` creates a `pending_invite` for `Mixed.Case@QA.test`. `USER-A1@QA.TEST` → 400 "already a member" |
| BUG-14 Telegram bypasses the upload quota | VERIFIED FIXED | A photo at exactly the quota (count = limit−1) is accepted and writes an EditLog entry `{source: telegram, _event: created}`. The next photo and an album → "Upload-Limit … erreicht", no bill, and the downloaded file is removed. The web upload is also 403 |
| BUG-15 `/api/ocr-log` with bad page/limit → 500 | VERIFIED FIXED | `page=abc&limit=xyz`, `page=0`, `limit=101`, `page=1.5` → 400. Empty params → 200 with the defaults |
| BUG-16 `/api/uploads/…%00…` → 500 | VERIFIED FIXED | `%00`, `%1f` and `%7f` → 400 "Bad request" |
| BUG-17 Hex/exponent amounts accepted | VERIFIED FIXED | `0x10`, `1e3`, `-5`, `abc`, `Infinity`, `1.001` → 400 "Must be a plain decimal number with at most 2 decimals" |
| BUG-18 Over-cap chunked upload → 400 instead of 413 | STILL FAILING | 102 MB multipart with `Transfer-Encoding: chunked` → `400 {"error":"Invalid upload"}` (with Content-Length → 413). Root cause: Next.js 15.5 truncates the body at 10 MB before the route sees it ("Request body exceeded 10MB for /api/bills"), so formidable gets a cut-off stream (`code 1012`) and the limiter never reaches its cap. See BUG-25 |
| BUG-19 Disallowed types silently dropped | VERIFIED FIXED | `.gif`, `.svg`, `.jpg + .exe`, and no extension → 415 "File type not allowed", no bill, nothing stored (also on `POST …/images`). An empty file input (`filename=""`) is ignored and the bill is created |
| BUG-20 Member sees an "Approve" button the API refuses | VERIFIED FIXED | Chromium. Author on own confirmed bill: only "Revert to Draft". Author on a paid bill: no status buttons. Admin: approved → "Reject" only; pending → "Approve" and "Reject" |
| BUG-21 Test compose exposes Postgres | VERIFIED FIXED | `docker-compose.test.yml` binds `127.0.0.1:5433:5432`. The password comes from `POSTGRES_TEST_PASSWORD`, falling back to `vbudget_test` (loopback only). It is documented in `.env.local.example` |
| BUG-22 HEALTHCHECK hard-codes port 3001 | VERIFIED FIXED | Image built from the current Dockerfile, run with `-e PORT=3201`: migrations (21) + seed + `Ready on :3201`, container `healthy` (first probe during boot failed, then 0), runs as `nextjs`, `/_next/image` 404 |
| BUG-23 Analytics events share the visit bucket | VERIFIED FIXED | 40 events from one IP: no 429, and visits #1–30 are still allowed (31st → 429). Events have their own 120/min bucket (#121 → 429). Chromium sessions logged no analytics 429s |

**Totals:** 21 verified fixed, 1 partially fixed (BUG-6), 1 still failing (BUG-18). BUG-24 to BUG-29 below are new.

#### Failed criteria re-tested in full

- **AC-2: Password change / reset — PASS.** Policy (5 cases), change → `reauthRequired`. Old cookie in a second context → `null`/307, and the changing context is signed out. New password works and the old one is rejected. Concurrent reset → one 200 and one 400; reset revokes sessions; the token is single-use. Superadmin reset and set-password revoke sessions (BUG-3). 6th attempt → 429. In Chromium the UI shows "Password updated. Please sign in again…" and signs out.
- **AC-4: Login protections — FAIL (BUG-24).** Passing: per-IP 5/min, with spoofed `X-Forwarded-For`/`cf-connecting-ip`/`x-real-ip`/`x-setcash-peer-ip` all ignored. Per-email 10/15 min for form and JSON bodies across rotating IPs and letter case. Timing is equal (BUG-11). Disabled-account message only after the correct password. Mixed-case login works. Path variants do not reach `authorize`. Failing: after `t-wild@qa.test` hit 429, 15 further guesses with `t_wild@`, `__wild@`, `t-w_ld@`, `_-wild@`, `t_w_ld@` were all processed (`302 CredentialsSignin`). `t_wi_d@qa.test` with the real password logged in as `t-wild@qa.test`.
- **AC-5: Case-insensitive email uniqueness — FAIL (BUG-24).** Passing: a `MIXED.CASE@qa.test` signup creates no second account. The DB rejects `USER-A1@qa.TEST` (`User_email_lower_key`). forgot-password, resend-verification, project/platform invite and accept-invite resolve the stored mixed-case account. The migration guard aborts on `Dup@`/`dup@` with the documented message and applies after the merge. Failing: the case-insensitive lookups also treat `_` as a wildcard, so `user_b1@qa.test` cannot sign up (silently refused) and resolves to `user-b1@qa.test`.
- **AC-8: Money correctness — PASS.** Balance, dashboard, analysis and PDF Saldo agree: user-a1 66.67, user-a2 4.99. Spending per motive and category matches the hand computation. Both tabs total 158.64. Excel export matches (BUG-2). Gross-only bills are consistent (BUG-9). Confirm button works and a double confirm → 400. A member sees only own transfers and gets 403 on analysis. The Sheets sanitiser still neutralises `=HYPERLINK`, `+1`, `-1`, `@x`.
- **AC-9: Bills, images & uploads — FAIL (BUG-18, BUG-25, BUG-27).** Passing: POST validation (22 cases → 400, no bill, no orphan). Unique filenames. Bill numbers are never reused (BUG-7). Concurrent approve vs reject, 4 rounds: one 200 and one 409. `paid` is terminal and its amounts are immutable. Image lock on approved/paid bills for the submitter while an admin can still change images. Magic-byte checks. Uploads: owner, member and superadmin 200; non-member 403; removed member 403; anonymous 401. Traversal variants → 404/400. Over-cap with Content-Length → 413. Chunked upload under 10 MB works.
- **EC-6: Gross-only bill — PASS** (brutto totals consistent everywhere; netto see BUG-29).

#### Regression

- **Chromium (production build):**
  - The real NextAuth login form works: urlencoded → 200 → `/dashboard`, and a wrong password shows an error, not a 415.
  - New bill: file select → crop modal → "Crop & Save" → submit → 200 with 1 image, number 1.09.
  - Bill detail: "Save Changes" works, adding an image works, and re-cropping an existing image (`PUT …/images/[id]`) works. Saving an approved web bill unchanged keeps `approved`.
  - Budget page: the Brutto/Netto toggle switches the grand spent total to the server's once-rounded totals.
  - Dashboard recent bills show 50,00 € for the gross-only bill. The V-Geld page renders for a member, and the admin Confirm button → 200.
  - `/reports`: the user PDF download opens (`%PDF`, Saldo present). The Excel download opens with exceljs (sheets Bills, V-Geld, Budget Matrix), and its grand Spent equals `/api/spending`.
  - Zero `securitypolicyviolation` events across 16 admin pages, 7 member pages at 375 px, 5 public pages and all flows above. No horizontal overflow at 375 px. Console errors: 1 recharts `rx` warning on `/bills/new` and the expected 400 on `/verify-email?token=abc`.
- **Telegram (stub):** the full AC-7 suite passes again (28/28). Extra checks for BUG-8 and BUG-14 are in the table above.
- **API regression:** projects, motives, categories, positions, members, superadmin, profile, tour, notifications, comments with @mention notifications, image reorder/delete, bulk delete, images ZIP, budget-matrix PDF and Sheets "not configured" handling all pass (40/41; the one failure is a duplicate-user artefact of this run).
- **Spot checks of passing criteria:**
  - AC-1: 19/19.
  - AC-3: 15/15.
  - AC-6: same result as round 1. Every admin operation is denied; only the member-level reads succeed, by design. Non-admin `GET /api/project-settings` → 403 without logout.
  - AC-7: 28/28.
  - AC-10: key re-entry rule; SSRF targets refused with 0 listener hits; re-analysis of approved/paid bills refused; duplicate concurrent analyse → 202 + 409 (3/3 rounds).
  - AC-11: 21 HTML pages with fresh nonces and all headers; `/_next/image` 404; no open redirect.
  - AC-12:
    - `npm audit --omit=dev`: 0 vulnerabilities.
    - `tsc -p tsconfig.json` and `tsc -p tsconfig.server.json`: exit 0.
    - `next lint`: 0 errors, 14 warnings.
    - `next build`: OK.
    - Jest against `setcash_test`: 21 suites, 214/214 tests pass.
    - Docker: OK (BUG-22).

#### New bugs (round 2)

#### BUG-24: Case-insensitive email lookups treat `_` as a wildcard — Google sign-in takes over another account (including superadmin)
- **Severity:** Critical · **Skill:** [Backend]
- **Where:** Prisma `email: { equals: x, mode: 'insensitive' }` is compiled to `"email" ILIKE $1` without escaping (verified with query logging), so `_` matches any single character. Affected code: `nextjs/auth.ts` (`authorizeCredentials` and the Google `signIn` callback), `app/api/auth/{signup,forgot-password,resend-verification,invite,accept-invite}`, `app/api/projects/[id]/invite`, `app/api/reports/user/[email]/pdf`, `app/api/bills/_lib/shared.ts`, `app/api/admin/users/**`, `app/api/users/me`.
- **Steps to Reproduce:**
  1. Call the Google `signIn` callback (unit level against the real DB, as in round 1) with `user.email = 'sup_r@qa.test'`, as for a Google account whose verified address differs from the victim's only by `_`.
  2. Expected: a separate new account `sup_r@qa.test` (or a refusal).
  3. Actual: `signIn → true`, `user.email` is rewritten to `super@qa.test`, and the `jwt` callback issues `role: superadmin`. `user_a1@qa.test` likewise becomes `user-a1@qa.test` (project member). Anyone who can hold a Google account at the victim's mail domain with `_` in place of any local-part character (e.g. `john_smith@outlook.com` vs `john.smith@outlook.com`) signs in as the victim, with no password needed.
  4. Credentials login: once `t-wild@qa.test` is email-limited (429), `t_wild@`, `__wild@`, `t-w_ld@`… each get their own 10 attempts (2^n variants for an n-char local part), and `t_wi_d@qa.test` with the real password logs in as `t-wild@qa.test`.
  5. forgot-password: `user-a2@` → 200, again → 429, then `user_a2@`, `u_er-a2@`, `us_r-a2@` → 200 each. The 1 per 5 min limit is bypassed and mail goes to the stored address.
  6. Signup `user_b1@qa.test` → generic 200 and no account. A legitimate `_` address cannot register if a matching address exists.
  7. User PDF: member `t_x@qa.test` downloads their own report, and it lists the bill "SECRET-OF-T-DASH-X" (77.00) of `t-x@qa.test` (and would list that user's V-Geld transfers). The summary uses an exact `LOWER()=` match, so rows and totals disagree.
- **Fix hint:** compare `LOWER(email) = LOWER($1)` (matches the unique index), or escape `\ % _` before `mode: 'insensitive'`; never resolve an OAuth identity through a pattern match.
- **Priority:** Fix before deployment

#### BUG-25: Uploads over 10 MB fail with 400 "Invalid upload" (Next.js 15.5 middleware body limit)
- **Severity:** High · **Skill:** [Backend] [Architecture]
- **Where:** `nextjs/middleware.ts` matches `/api/bills/**`. With middleware present, Next.js 15.5 buffers at most `middlewareClientMaxBodySize` (default 10 MB) and passes a truncated body to the route; `next.config.mjs` does not configure it. The UI allows up to 10 files of 10 MB each (`BillImageUpload` "up to 10MB", `lib/upload.ts` cap 10×10 MB). Introduced by the Next 15 upgrade; not found in round 1.
- **Steps to Reproduce:**
  1. `POST /api/bills` with 2 JPEGs of 6 MB (body 12 MB), with Content-Length or chunked.
  2. Expected: 200, bill with 2 images.
  3. Actual: `400 {"error":"Invalid upload"}`. Server log: "Request body exceeded 10MB for /api/bills. Only the first 10MB will be available…" and formidable `MultipartParser.end(): stream ended unexpectedly` (code 1012). The same happens with 3×5 MB and with `POST /api/bills/[id]/images` 2×6 MB. 1×9.9 MB works.
  4. In Chromium: selecting two 6 MB receipts on `/bills/new` and submitting shows "Invalid upload". Phone photos and the 4096 px crops (JPEG q 0.92) are often 3–6 MB, so multi-photo bills fail.
  5. Also the cause of BUG-18.
- **Priority:** Fix before deployment

#### BUG-26: Saving an approved Telegram bill without changes resets it to `pending` and strips its time of day (regression of the BUG-4 fix)
- **Severity:** Medium · **Skill:** [Backend] [Frontend]
- **Where:** `app/(protected)/bills/[id]/page.tsx` always sends `date: new Date(formData.date /* YYYY-MM-DD */).toISOString()`. `app/api/bills/[id]/route.ts` compares it with the stored `bill.date.toISOString()`. Telegram bills (and any bill whose date carries a time) always differ, so `changes.date` is set. Since BUG-4 this counts as a non-admin edit of an approved bill and resets the status.
- **Steps to Reproduce:**
  1. A linked user sends a photo via Telegram; the admin fills vendor/amount, confirms and approves (`date` = `2026-10-18T13:54:07.128Z`).
  2. The owner opens the bill and clicks "Save Changes" without editing (exact UI payload).
  3. Expected: 200, still `approved`.
  4. Actual: 200, status `pending`, date stored as `2026-10-18T00:00:00.000Z`. EditLog `{"date":"2026-10-18T00:00:00.000Z","motive":"Default","status":"pending"}`. The bill silently leaves spending/V-Geld until it is re-approved. Web-created bills (midnight UTC) are not affected.
- **Priority:** Fix before deployment

#### BUG-27: Files beyond `maxFiles` are left as orphans after the 413
- **Severity:** Medium · **Skill:** [Backend]
- **Where:** `nextjs/lib/upload.ts` `parseForm`. `removeWritten()` runs once when formidable reports `options.maxFiles (10) exceeded` (code 1015). Parts after the limit are still written, after the cleanup, and never removed.
- **Steps to Reproduce:**
  1. `POST /api/bills` with 11, 12 or 15 JPEG parts.
  2. Expected: 413 and no file left.
  3. Actual: 413 "Upload too large", but 1, 2 and 5 files respectively remain in `UPLOADS_DIR` root (e.g. `w8c3qkvcj6v1gpx3g1yoj9y15.jpg`). An authenticated user can still fill the disk (bounded only by the 10 MB body truncation and 10 creates/min).
- **Priority:** Fix in next sprint

#### BUG-28: Bug-report upload keeps files sent under unexpected field names (remainder of BUG-6)
- **Severity:** Low · **Skill:** [Backend]
- **Where:** `app/api/bug-reports/route.ts` calls `parseForm(req, { maxFiles: 1 })` without `fields: ['screenshot']` and only cleans up on error paths.
- **Steps to Reproduce:** route handler run in Jest with `GITHUB_TOKEN` stubbed and `fetch` captured. A report with the file in field `evil` → 201, and `UPLOADS_DIR/ougoy8y7dlqxeggz4ykd3vder.png` (308 B) remains. A PNG screenshot is still stored under `bug-reports/`, and a `.gif` screenshot → 415.
- **Priority:** Nice to have

#### BUG-29: Gross-only bills count as 0 in every netto figure
- **Severity:** Low · **Skill:** [Backend]
- **Where:** `lib/ocr.ts` writes only `grossAmount` on the bare-total path (`nettoAmount` stays 0). The netto figures read `nettoAmount`: budget page Netto mode, `nettoSpent`, Excel "Netto", PDF netto columns.
- **Evidence:** the 50.00 gross-only bill adds +50.00 to the budget-matrix brutto figures but +0.00 netto, and its PDF/Excel netto is 0.00. Netto spending is understated; it needs a product decision (estimate at 19 %, or flag it as "no VAT breakdown").
- **Priority:** Nice to have

#### Not tested / limitations (round 2)
- Firefox and Safari: not installed (Chromium only).
- Real Google OAuth: BUG-24 was reproduced by calling the `signIn`/`jwt` callbacks against the real DB. Whether a given mail provider allows a matching `_` address was not tested.
- Real Telegram, Resend, OCR providers, Google Sheets API and Upstash: not available. These ran against the stub, DB tokens, the SSRF harness and the in-memory limiter, as in round 1.
- Bug-report route end to end: needs a `GITHUB_TOKEN`; tested at handler level with `fetch` stubbed.
- Concurrency of the Telegram quota (two simultaneous photos at limit−1): not exercised; serialisable-transaction code reviewed only.
- Docker: built from a scratch copy of the current Dockerfile (mirror base image plus proxy CA). The real `nextjs/Dockerfile` was not modified.

#### Summary (round 2)
- **Round-1 bugs:** 21/23 verified fixed, 1 partially fixed (BUG-6; remainder BUG-27/28), 1 still failing (BUG-18, root cause BUG-25).
- **Acceptance Criteria:** AC-2 and AC-8 now pass. AC-4, AC-5 (both BUG-24) and AC-9 (BUG-18/25/27) still fail. Spot checks of AC-1, 3, 6, 7, 10, 11 and 12 pass, so 9/12 pass in total.
- **Edge Cases:** EC-6 now passes, so 12/12 pass.
- **New bugs:** 6 (1 critical, 1 high, 2 medium, 2 low): BUG-24, BUG-25, BUG-26, BUG-27, BUG-28, BUG-29.
- **Open bugs overall:** BUG-24 (Critical), BUG-25 (High), BUG-26 and BUG-27 (Medium), BUG-18, BUG-28 and BUG-29 (Low). BUG-6 is partial and tracked via BUG-27/28.
- **Security:** Issues found. BUG-24 allows account takeover through Google sign-in (including superadmin) and bypasses the per-email login and forgot-password limits.
- **Production Ready:** NO
- **Recommendation:** Fix BUG-24 (exact `LOWER()` comparison, or escape `_`/`%`) and BUG-25 (raise `middlewareClientMaxBodySize` above the upload cap, or exclude the upload routes from the middleware matcher) first. Then fix BUG-26 (keep the stored date when only the day is unchanged, or compare dates by day) and BUG-27. Afterwards re-run AC-4, AC-5 and AC-9.

### QA Re-test (Round 3)

**Tested:** 2026-10-18
**App URL:** http://localhost:3101 (fresh DB `qa3_proj26`, `next build` + `NODE_ENV=production tsx server.ts`, Postgres 16 on :5433)
**Branch / commit:** `claude/keen-rubin-b78ded` @ `3e460d7` (fix commits `d6d7ccd`, `da98e2a`, `3e460d7`; no new migrations)
**Method:** Same harness as rounds 1 and 2: scripted HTTP clients with rotating loopback IPs, curl, Playwright Chromium, Prisma/SQL checks, the local Telegram Bot API emulator and Jest (handler-level tests with `fetch`/Google stubbed, run against `qa3_proj26`). The Google sign-in was exercised through the real `signIn` + `jwt` callbacks and `resolveGoogleSignIn` against the real DB.

#### Round-2 bugs

| Bug | Status | Evidence |
|---|---|---|
| BUG-24 (Critical) `_` treated as a wildcard in email lookups | VERIFIED FIXED | All 7 steps re-run. **1** Google `signIn` + `jwt`: `sup_r@qa.test` → own new account, role `user`; `user_a1@qa.test` → own account, no project; `s%@`, `%@`, `super%@`, `_____@`, `su\per@` → own accounts; `SUPER@QA.TEST` → `super@qa.test` (superadmin) and `mixed.case@qa.test` → `Mixed.Case@QA.test` (letter case still resolves); `G_EXACT@` → `g_exact@`, not `g-exact@`; deactivated → refused. **4** After `t-wild@` hit 429 (the real password is also 429), 15 guesses with `t_wild@`, `__wild@`, `t-w_ld@`, `_-wild@`, `t_w_ld@` are answered as unknown accounts. The real password via `t_wi_d@`, `t_wild@`, `T_WILD@`, `______@` or `t%@` gives no session. A real `t_x@` account logs in (also as `T_X@QA.TEST`) and only with its own password, separate from `t-x@`. **5** forgot-password: `user-a2@` 200, then 429. `user_a2@`, `u_er-a2@` and `us_r-a2@` → generic 200 with no token; `user%@` → 400. Only the one token for `user-a2@` exists. `T_X@` gets a token for exactly `t_x@`. **6** Signup of `user_b1@qa.test` (next to `user-b1@`) creates its own unverified account; `USER_B1@QA.TEST` creates no second one; resend-verification gives `user_b1@` its token; resend for `user_a1@` sends nothing. **7** The PDF of `t_x@` lists only its own bill (Saldo −11.00) and none of `t-x@`'s 77.00 bill or its 500.00 V-Geld. `t_x@` → `t-x@` report is 403. The admin's `t-x@` report lists only `t-x` (Saldo 423.00). `T_X@QA.TEST` → the `t_x` report |
| BUG-25 (High) uploads over 10 MB fail | VERIFIED FIXED | Node client, `POST /api/bills`: 1×9.9 MB, 2×6 MB, 3×5 MB (Content-Length and chunked) and 10×9.5 MB (95 MB, at the cap) → 200, every stored file byte-identical (SHA-256). `POST …/images` 2×6 MB (CL and chunked) → 200. `PUT …/images/[id]` 9.5 MB chunked → 200; 10.5 MB → 413. curl: 2×6 MB JPEG, 3×5 MB JPEG, 2×6 MB and 3×5 MB PDF chunked, and `/images` 2×6 MB (plain and chunked) → 200 with all images. Chromium `/bills/new`: 2×6 MB PDF, 3×5 MB PDF, 2×6.1 MB and 3×5.1 MB JPEG (crop skipped) and 2×6.1 MB JPEG via "Crop & Save" → 200 with 2/3/2/3/2 images and no error shown. Bill detail "add images" 2×6 MB → 200 (4 images). Zero CSP violations |
| BUG-18 (Low) over-cap chunked upload → 400 | VERIFIED FIXED | 102.3 MB multipart chunked → 413 "Upload too large"; with Content-Length → 413; one 102 MB file chunked → 413 (node and curl). No file left in `UPLOADS_DIR` after any of them |
| BUG-26 (Medium) approved Telegram bill reset on unchanged save | VERIFIED FIXED | A bill created by the bot through the stub (`2026-10-18T14:47:41.026Z`, caption as comment); the admin fills vendor/amount, confirms and approves. Owner `PUT` with the exact new UI payload (no `date`) → 200, still `approved`, timestamp unchanged. The old payload (same day as midnight UTC) and a same-day `23:59:59Z` → unchanged too. An approved bill with NULL vendor/item/comment saved unchanged → stays `approved`. Chromium, "Save Changes" without edits on an approved bill dated `23:47:41Z`, with browser time zones UTC, America/Los_Angeles and Pacific/Kiritimati: the PUT carries no `date`, the bill stays `approved` and keeps its time. The BUG-4 lock still holds: a day change (API, or the date field in the UI → `2026-10-03T00:00Z`) → `pending`; a comment added to a NULL comment → `pending`; on a paid bill an unchanged save → 200 (still `paid`) and a day change → 403. Note: every save still writes an EditLog entry `{"allocations":"updated"}` even when nothing changed (cosmetic, pre-existing) |
| BUG-27 (Medium) orphan files past `maxFiles` | VERIFIED FIXED | `POST /api/bills` with 11, 12 (chunked) and 15 tiny parts, 11×1 MB, 15×2 MB chunked, 20×0.5 MB and 11×9 MB chunked → 413, 0 files left after 3 s, no bill (fresh user per request). `POST …/images` with 12 parts → 413; `PUT …/images/[id]` with 3 parts → 413; nothing left. Exactly 10 parts → 200 with 10 images |
| BUG-28 (Low) bug-report keeps stray files | VERIFIED FIXED | Handler level (`fetch` stubbed). File under `evil` → 201, no stray file. `evil` + screenshot → only the screenshot is stored. GitHub answering 500 → 502 and the stored screenshot is removed. Invalid input → 400, nothing left. Two screenshots → 413, nothing left. `.gif` → 415. Live HTTP: same results, nothing left in `UPLOADS_DIR` |
| BUG-29 (Low) gross-only bills count 0 netto | VERIFIED FIXED (product decision: flag, not estimate). **See BUG-30** | No gross-only bills yet: `grossOnly.count` is 0 in `/api/spending` and `/api/budget-matrix`. No notice on `/budget` or `/spending` in either mode, and no Excel note. After an approved 50.00 and a paid 7.50 gross-only bill (plus a pending 400 and a draft 9, which are not counted): both spending tabs and the budget matrix return `{count: 2, grossSum: 57.5}`. Brutto totals +57.50, netto unchanged. Chromium: in Netto mode `/budget` and `/spending` (also after switching to the category tab) show "2 bills without a VAT breakdown (57,50 € brutto) are not included in the netto figures."; in Brutto mode there is no notice. No overflow at 375 px. Excel Bills sheet: a blank row, then "Note: 2 counted bills have no VAT breakdown (only a gross amount, 57.50 EUR brutto). Netto is 0 for these bills, so they are not included in the netto figures." User PDF (pdftotext): the header reads "Netto\*" with the footnote "\* Netto-Summen enthalten nicht 1 Beleg ohne MwSt.-Aufteilung (50.00 EUR brutto, Netto = 0.00)." The paid 7.50 counts for its submitter while pending/draft do not. Users without such bills get no footnote and a plain "Netto" header. Sheets (stubbed API): the note is written below the data, but stale rows can remain next to it (BUG-30) |
| BUG-6 (remainder) | VERIFIED FIXED | Closed by BUG-27 and BUG-28 |

**Totals:** all 7 open round-2 bugs (BUG-18, 24, 25, 26, 27, 28, 29) and the BUG-6 remainder are verified fixed. BUG-30 to BUG-32 below are new.

#### Failed criteria re-tested in full

- **AC-4: Login protections — PASS.**
  - Per-IP 5/min: `302×5, 429×2`. Spoofed `X-Forwarded-For`, `cf-connecting-ip`, `x-real-ip` and `x-setcash-peer-ip` are ignored.
  - Per-email 10/15 min: form bodies with rotating IPs and alternating letter case → `302×10, 429×2`, and the correct password is then also 429. JSON bodies with the IP rotated every 4 → `302×10, 429×3`.
  - `_`/`%` variants no longer reach the account (BUG-24).
  - Timing: medians over 9 samples are 354 ms (unknown email) and 351 ms (wrong password).
  - Disabled account: a wrong password gives the generic error; `AccountDisabled` only with the correct password.
  - Mixed-case login works and the session carries `Mixed.Case@QA.test`.
  - Path variants (`/credentials/`, `%63redentials`, `CREDENTIALS`, `//auth`) do not authenticate.
- **AC-5: Case-insensitive email uniqueness — PASS.**
  - A signup with `MIXED.CASE@qa.test` creates no second account.
  - The DB rejects `USER-A1@qa.TEST` and `user_a1@QA.test` (`User_email_lower_key`).
  - forgot-password, resend-verification, project invite (lower case → `pending_invite` for the stored account), accept-invite (`userExists: true`, membership for `Mixed.Case@QA.test`, no new user) and platform invite all resolve the stored mixed-case account. `USER-A1@QA.TEST` → 400 "already a member".
  - Migration guard on a scratch DB: aborts on `Dup@`/`dup@` with the documented message. With `u_x@` and `u-x@` present it applies after the merge (they are not treated as duplicates).
  - `_` addresses are separate accounts:
    - Invite and accept for `user_a2@` (new) creates its own account; `user-a2@` keeps its password.
    - A project invite to `user_a1@` is not "already a member".
    - A platform invite to `owner_a@` does not notify `owner-a@`.
- **AC-9: Bills, images & uploads — PASS.** POST validation: 16 cases → 400 with no bill and no orphan file (the last 6 were re-run with a fresh user because the 10/min bill limit also counts rejected attempts). Also passing: unique filenames, uploads ACL and traversal (`ac9b` 8/8, `ac9c` 11/11, `upl` 12/12), bill numbering (5/5, never reused), PUT validation and the BUG-4 lock (`edit` 24/24, including the Telegram-style case that failed in round 2). Uploads over 10 MB: BUG-25. Over-cap: BUG-18. maxFiles: BUG-27. A chunked upload under the cap works.

#### Regression

- **Middleware matcher change:**
  - Unauthenticated sweep over all 88 route files (122 endpoint-methods):
    - 96 are redirected by middleware (307 to `/?callbackUrl=…`).
    - The 6 methods of the 4 excluded upload endpoints (`GET`/`POST /api/bills`, `POST …/images`, `PUT`/`DELETE …/images/[imageId]`, `POST /api/bug-reports`) answer 401 JSON.
    - 3 methods whose sweep path contains a dot (`[email]` = `user-a1@qa.test`) answer 401 JSON from the route. This exclusion of dotted paths from middleware is pre-existing and unchanged.
    - Public endpoints are unchanged.
  - Path variants:
    - `…/images/%72eorder`, `/api/Bills`, `/api/bills/bulk-delete` and `…/images/y/z` are still redirected.
    - Trailing slashes → 308 to the canonical path.
    - `PUT …/images/reorder` is still behind middleware (307 anonymous) and works for the owner.
  - On the excluded endpoints:
    - Deactivated user → 401.
    - Tampered cookie → 401.
    - Removed member → 400 "No project selected", with no bill or image written.
    - Anonymous 60 MB uploads (plain or chunked) → 401 within 10 ms; curl had sent under 3 MB of the body and nothing was stored.
  - `GET /api/bills` still carries XFO, nosniff, HSTS and Referrer-Policy.
  - All 16 protected pages redirect unauthenticated users to `/?callbackUrl=<page>`.
  - 21 HTML pages have a fresh nonce, every `<script>` is nonced and all security headers are present. `/_next/image` → 404. No open redirect.
- **Case-insensitive name checks (categories, motives, positions; create and rename):**
  - `Travel_X` and `Travel-X` coexist, and `TravelZX`, `Tr%` and `Back\slash` are accepted.
  - `travel_x`, `travel` (after `Travel`) and `back\SLASH` collide (400 "…already exists").
  - Renaming to `TRAVEL_X` collides, while renaming to a different name or to the own name in another case works.
  - Usernames: `qa_name` and `qa-name` coexist, `QA_NAME` → 409, `qa%` is accepted.
- **Admin users and members:**
  - `POST /api/admin/users`: `adm_new@` and `adm-new@` are both created; `ADM-NEW@` → "User already exists".
  - `PUT`/`DELETE` on `adm_new@` touch only that account; `adm%new@` → 404; `DELETE ADM-NEW@QA.TEST` finds `adm-new@`.
  - Admin add-member with `user_a2@` → "User not found"; `USER-A2@` adds `user-a2@`.
  - `/api/reports/users` for a `_` member lists only that member.
  - Bill numbers of `t_x@` and `t-x@` are independent (1.01 each, then 1.02).
- **Telegram (stub):** AC-7 suite 28/28 and the BUG-8/BUG-14 extras 8/8.
- **Money:** unchanged from round 2.
  - Balance, dashboard, analysis and PDF Saldo: user-a1 66.67, user-a2 4.99.
  - Spending by motive: Default 41.69, M1 33.63, M2 50.00, M3 33.33. By category: C1 50.30, C2 50.00, Uncategorized 58.34.
  - Both tabs total 158.64 (netto 139.12).
  - The Excel Budget Matrix "Spent (brutto)" row equals this, and the Sheets sanitiser still neutralises `=HYPERLINK`, `+1`, `-1`, `@x` (money script 21/21).
- **Chromium (production build):**
  - Login form (wrong password shows an error; the correct one reaches `/dashboard`).
  - Bill create with the crop modal (number 1.05), detail edit and save, adding an image, re-cropping (`PUT …/images/[id]` 200), and an unchanged save of an approved web bill (stays approved).
  - Status buttons (BUG-20); the V-Geld page and the admin Confirm button.
  - Budget Brutto/Netto totals equal the server's.
  - `/reports` PDF and Excel downloads; the Excel grand Spent equals `/api/spending`.
  - The AC-2 password change signs the user out. No overflow at 375 px.
  - **Zero CSP violations** across all pages and flows of the session (br2 suite 18/19: the re-crop step timed out in the script and passed when run on its own).
  - Console errors: the known recharts `rx` warning, and BUG-31.
- **API regression:** 41/41 (projects, motives, categories, positions, members, superadmin, profile, tour, notifications, comments with mentions, image reorder/delete, bulk delete, images ZIP, budget PDF, Sheets "not configured"). IDOR matrix: 36 of 38 checks pass. The 2 flagged are by design: an `updateMany` scoped to the caller returns 200 with no effect, and `/api/reports/users` lists only the caller.
- **Spot checks:**
  - AC-1: 19/19.
  - AC-2: 22/22.
  - AC-3: 15/15.
  - AC-6: same result as rounds 1 and 2. All admin operations are denied, member-level reads succeed by design, last-owner and last-superadmin rules hold, and the concurrent owner removal leaves 1 owner.
  - AC-7: 28/28.
  - AC-8: 21/21.
  - AC-10: key re-entry rule. SSRF targets (`127.0.0.1`, `localtest.me`, `[::ffff:127.0.0.1]`, `2130706433`, `0x7f.1`, `169.254.169.254`, `http://`) are refused with 0 listener hits. Re-analysis of approved/paid bills → 409. A duplicate concurrent analyse → 202 + 409 in 3/3 rounds.
  - AC-11: see above.
  - AC-12:
    - `npm audit --omit=dev`: 0 vulnerabilities.
    - `tsc -p tsconfig.json` and `tsc -p tsconfig.server.json`: exit 0.
    - `next lint`: 0 errors, 14 warnings.
    - `next build`: OK.
    - Jest against `setcash_test`: 27 suites, 274/274 tests pass. `auth-credentials-limit.test.ts` fails (5 tests hit the per-IP 429) if `TRUSTED_IP_HEADER=none` is set in the shell, because the test relies on the default header. This is environment coupling of the test, not an app bug.
    - Docker: not rebuilt. The Dockerfile, `next.config.mjs`, package files and migrations are unchanged since round 2.

#### New bugs (round 3)

#### BUG-30: Google-Sheets export leaves stale bill rows next to the new netto note (regression of the BUG-29 fix)
- **Severity:** Medium · **Skill:** [Backend]
- **Where:** `app/api/admin/export/google-sheet/route.ts`. The note is written as `[[''], [note]]` at `Bills!A{n+1}`. With `values.batchUpdate` this only sets column A of rows n+1 and n+2. The tail clear now starts at `Bills!A{n+3}:ZZ` instead of `A{n+1}`, so columns B–O of the two rows under the data keep whatever the previous export wrote there.
- **Steps to Reproduce:**
  1. The project has at least one counted gross-only bill. A previous Sheets export had more bill rows than now (e.g. bills were deleted in between).
  2. Run "Export to Google Sheets" (handler run in Jest with a stub that applies the Sheets cell semantics, against `qa3_proj26`; the Bills tab was pre-filled with a larger previous export).
  3. Expected: the bill rows, a blank row, the note, and nothing else.
  4. Actual: row n+1 still holds a full stale bill row (columns B–O), and row n+2 holds the note in A followed by another stale bill row in B–O. A deleted bill's amounts stay in the sheet, so column sums (Brutto Total, Netto) in the sheet are overstated. Without gross-only bills the tail is cleared from n+1 as before.
- **Fix hint:** keep clearing from `A{n+1}` and write the note afterwards, or write full-width rows (15 cells) for the blank and note rows.
- **Priority:** Fix in next sprint

#### BUG-31: Clearing the date on the bill page and saving hangs on "Saving…" (pre-existing)
- **Severity:** Low · **Skill:** [Frontend]
- **Where:** `app/(protected)/bills/[id]/page.tsx` `handleSave`. An empty date counts as "changed", and `new Date('').toISOString()` throws `RangeError: Invalid time value` before the request. `setIsSaving(false)` is never reached. The line was touched by the BUG-26 fix, but it threw before the fix as well.
- **Steps to Reproduce:** open your own confirmed bill, clear the date field, click "Save Changes". Expected: a validation message, or the date left unchanged. Actual: no request is sent, the button stays disabled on "Saving…" until reload, and the console logs a page error "Invalid time value". This breaks the frontend rule "always reset loading state in all code paths".
- **Priority:** Nice to have

#### BUG-32: User PDF report decodes the address twice — `%` in an email gives a 500 (pre-existing)
- **Severity:** Low · **Skill:** [Backend]
- **Where:** `app/api/reports/user/[email]/pdf/route.ts` calls `decodeURIComponent(params.email)`, but Next.js has already decoded the route param.
- **Steps to Reproduce:** `GET /api/reports/user/t%25x%40qa.test/pdf` (as admin, or as a user whose address contains `%`) → 500, and the log shows "URIError: URI malformed". Expected: 404/empty report, or the report for that exact address. Google sign-in can create accounts with `%` in the local part (verified: `s%@qa.test`), and such a user cannot download their own report. An address containing `%25`/`%40` sequences would be decoded to a different address. The admin users route does not double-decode (`adm%new@` → 404).
- **Priority:** Nice to have

#### Not tested / limitations (round 3)
- Firefox and Safari: not installed (Chromium only).
- Real Google OAuth: BUG-24 was verified through the real `signIn`/`jwt` callbacks and `resolveGoogleSignIn` against the DB. Google Sheets was tested only with a stubbed API that applies cell-write semantics (BUG-30).
- Real Telegram, Resend, OCR providers and Upstash: not available. These ran against the stub, DB tokens, the SSRF harness and the in-memory limiter, as before.
- Bug-report → GitHub: tested at handler level with `fetch` stubbed. The QA server inherited a placeholder `GITHUB_TOKEN` from the sandbox shell, so one live bug-report request in this round sent a request to `api.github.com`. It was rejected with 401 "Bad credentials" and no issue was created. That 502 path showed the screenshot cleanup working.
- Docker image: not rebuilt in this round (deploy files unchanged since round 2, where it passed).
- Image-lock race and concurrent Telegram quota: not exercised (same as round 2).

#### Summary (round 3)
- **Round-2 bugs:** 7/7 verified fixed (BUG-18, BUG-24, BUG-25, BUG-26, BUG-27, BUG-28, BUG-29). The BUG-6 remainder is closed.
- **Acceptance Criteria:** AC-4, AC-5 and AC-9 now pass. Spot checks of AC-1, 2, 3, 6, 7, 8, 10, 11 and 12 pass, so **12/12 pass**.
- **Edge Cases:** 12/12 (EC-6 re-checked with BUG-29).
- **New bugs:** 3 (0 critical, 0 high, 1 medium, 2 low): BUG-30 (Medium, regression of the BUG-29 fix), BUG-31 and BUG-32 (Low, both pre-existing).
- **Open bugs overall:** BUG-30 (Medium), BUG-31 and BUG-32 (Low). No Critical or High bug is open from any round.
- **Security:** No open security issues. BUG-24 (account takeover and limiter bypass) is closed. Moving the upload endpoints out of middleware did not open an unauthenticated path; they authenticate before reading the body.
- **Production Ready:** YES
- **Recommendation:** Deploy. Fix BUG-30 before relying on the Google-Sheets export for gross-only bills (or fix it in the next sprint), and fix BUG-31 and BUG-32 when convenient.

### Post-QA Fixes (after Round 3)

| Bug | Fix | Verification |
|---|---|---|
| BUG-30 (Medium) Sheets export leaves stale rows next to the netto note | The Bills tail is cleared from the row after the data again; the note is written afterwards (`values.update`), one blank row below the bills | `__tests__/api/export-gross-only.test.ts` models the Sheets cell grid with a larger previous export: no stale cells remain; the test fails against the previous route |
| BUG-31 (Low) Clearing the date and saving hangs on "Saving…" | `handleSave` validates the date before sending ("Please enter a valid date") and resets the saving state in `finally` | Chromium against the production build: validation shown, no request sent, button usable; a valid save still succeeds |
| BUG-32 (Low) User PDF decodes the email twice | The already-decoded route param is used as-is | `__tests__/api/user-pdf.test.ts`: own report for `s%x…@qa.test` → 200 PDF (500 before) |

Full suite after these fixes: 275/275 Jest tests, both `tsc` configs and lint clean, `next build` OK.
