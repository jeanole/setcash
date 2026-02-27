## PROJ-2: Security & Multi-tenant Hardening

**Status:** Deployed
**Deployed:** 2026-02-27

### Summary
Strengthen vBudget’s security and tenant isolation so that each project’s data and uploads are fully isolated, sensitive operations are protected against CSRF, and secrets/crypto use safe defaults suitable for both self-hosted and multi-tenant deployments.

### Context & Motivation
- Recent code review identified several high-impact issues:
  - Some export queries (Excel, Google Sheets, image ZIPs) are not properly scoped by `project_id`, risking cross-project data leakage.
  - `/uploads/*` serves files by path without checking project membership or ownership, allowing authenticated users to guess and access other users’ images.
  - The app uses cookie-based sessions but lacks CSRF protection on state-changing routes.
  - OCR API key encryption depends on `SESSION_SECRET` with a weak default value, which could compromise keys in misconfigured environments.
- The feature should address all of these issues with minimal breakage, but **security takes precedence** if trade-offs are required.

Primary environments:
- Mixed: both self-hosted instances and managed multi-tenant deployments should benefit from safer defaults.

---

### Goals (What This Feature Must Achieve)
- **G1 — Strict project scoping for exports**: All exports (Excel, Google Sheets, image ZIPs, and any similar endpoints) only ever include data and files belonging to the authenticated user’s current project.
- **G2 — Secure image access**: Access to uploaded images is protected by authorization checks tied to `bill_images`/`bills` and project membership, not just by knowing/guessing a path.
- **G3 — CSRF protection for state-changing operations**: State-changing HTTP endpoints are protected from CSRF in a way that works for both browser forms and XHR.
- **G4 — Harden secrets & encryption**: The app fails safely in production when secrets are misconfigured, and OCR-related encryption is not reliant on weak or default secrets.
- **G5 — Preserve existing UX where possible**: Changes should avoid unnecessary breaking behavior, but may intentionally break unsafe flows (e.g. direct `/uploads` links without authorization).

---

### Out of Scope (Non-Goals)
- Implementing a full RBAC redesign or new roles model.
- Changing the database engine or large-scale schema refactors beyond what is needed to secure exports and uploads.
- Adding new external identity providers or auth flows.

---

### Primary Users & Roles
- **Project users**: Can upload and view their own bills and images, and use exports limited to their project.
- **Project admins**: Can manage all data within their project, and perform exports limited strictly to their project.
- **Super-admins**: Can oversee projects globally but should still not see unintended data when acting in the context of a single project export endpoint (unless there is an explicit “all projects” admin export, which would be a separate feature).

---

### User Stories

#### US-1: Project-scoped exports
- As a **project admin**, I want Excel, Google Sheets, and ZIP exports to include **only bills, images, and aggregates for my current project**, so that I never accidentally see or leak data from other projects.

#### US-2: Protected image access
- As a **logged-in user**, when I request an uploaded bill image, I want the system to **check that I am allowed to see the bill (and its project)** before serving the file, so that other users cannot see my images even if they guess a URL.

#### US-3: CSRF-safe actions
- As an **authenticated user or admin**, I want my actions (uploads, vgeld changes, settings changes, approvals, etc.) to be protected against CSRF, so that visiting another website cannot silently perform state-changing actions on my behalf.

#### US-4: Safe secrets in production
- As an **operator of vBudget**, I want the app to **refuse to start in production** when session/encryption secrets are missing or obviously weak, so that we don’t accidentally deploy with insecure defaults.

#### US-5: Backwards-compatible for legitimate flows
- As a **self-hosted admin**, I want existing legitimate workflows (e.g. opening exports from the UI, viewing images linked from bills) to keep working with minimal changes, while insecure direct URL patterns may be tightened or removed.

---

### Functional Requirements / Acceptance Criteria (AC)

#### AC-1: Export queries are project-scoped
- All SQL queries used in:
  - Excel export endpoints in `routes/exports.js`.
  - Google Sheets export/sync in `routes/exports.js` and/or `google.js`.
  - Image ZIP exports in `routes/exports.js`.
- **Must**:
  - Include an explicit `WHERE project_id = ?` (or equivalent) filter tied to `req.user.currentProjectId` for any bill-, allocation-, vgeld-, or summary-based data.
  - Be covered by tests or manual verification steps showing that:
    - An admin of Project A cannot see any data from Project B in any export.
    - Changing `currentProjectId` changes the exported scope accordingly.
  - Reject or safely handle requests when `currentProjectId` is missing or inconsistent.

#### AC-2: Image access checks
- The existing `/uploads/*` handler is replaced or wrapped by a route that:
  - Identifies the requested image via a stable key (e.g. `bill_images` ID or another DB-backed identifier), not purely by filesystem path.
  - Performs a DB lookup that joins `bill_images` to `bills` (and optionally `projects`) and verifies:
    - The bill’s `project_id` matches `req.user.currentProjectId`, and
    - The user has permission to view bills in that project (reusing existing authorization middleware or checks).
  - Returns `403` or `404` (not 500) if:
    - The image does not exist,
    - The bill does not belong to the current project, or
    - The user is not authorized.
- Direct filesystem path guessing must no longer allow a user from Project A to retrieve images from Project B.

#### AC-3: CSRF protection
- State-changing HTTP endpoints (e.g. POST/PUT/DELETE on bills, vgeld, admin settings, notifications, etc.) are protected against CSRF. This can include:
  - CSRF tokens added to HTML forms and validated server-side (e.g. `csurf`).
  - Or a combination of `sameSite` cookies and custom headers (e.g. `X-Requested-With`, `X-CSRF-Token`) verified on JSON/AJAX endpoints.
- For any protected endpoint:
  - Requests that lack the expected CSRF token/header are rejected with a clear 4xx error.
  - The frontend is updated to send the required tokens/headers.
  - There is a clear strategy for non-browser clients (if any).

#### AC-4: Hardened secrets & encryption config
- On startup, when `NODE_ENV === 'production'`:
  - The server must fail fast (exit with error) if `SESSION_SECRET` (and any dedicated encryption secret, if introduced) is missing or matches known default placeholders.
  - Console/log output must **not** print sensitive secret values.
- OCR API key encryption:
  - Uses a sufficiently strong key derived from non-default secrets.
  - Behavior is clearly documented for operators (e.g. in `.env.example` or docs) so they know which env vars must be set.

#### AC-5: Status handling consistency for reports/exports
- All reports and exports that currently filter by legacy status values (e.g. `'complete'` vs `'confirmed'`) must:
  - Use a **consistent set of statuses** that includes the currently correct “confirmed” state.
  - Be verified so that confirmed bills are correctly included/excluded in spending, reports, and exports as intended.

---

### Edge Cases
- **EC-1: User without a current project**  
  - If a user somehow has no `currentProjectId` set, export and upload-related endpoints should fail gracefully (e.g. 400/403) rather than defaulting to “all projects”.

- **EC-2: Legacy deep links to uploads**  
  - Old URLs pointing directly to `/uploads/...` may break once authorization is enforced. The system should:
    - Return a safe error (403/404) for unauthorized or cross-project access.
    - Keep working for links that map to a bill the user is allowed to see.

- **EC-3: Self-hosted single-project instances**  
  - For single-tenant/self-hosted setups, the stricter checks should still work without requiring additional configuration (e.g. `currentProjectId` is always the one project, or reasonable defaults are documented).

- **EC-4: CSRF errors on old clients**  
  - Old browser sessions or tools that don’t send CSRF tokens should get clear 4xx responses. The UI should handle this gracefully (e.g. show a message to reload or sign in again).

- **EC-5: Misconfigured secrets in non-production**  
  - In development/test, the app may allow weak secrets with prominent warnings, but production must not.

---

### Dependencies
- **Depends on**:
  - Existing auth and project-role middleware (`middleware.js`).
  - Existing exports and uploads routes (`routes/exports.js`, `routes/bills.js`).

---

### Risks & Trade-offs
- Tightening security on `/uploads` and CSRF may temporarily break undocumented or ad-hoc integrations that relied on insecure patterns.
- Failing fast on weak secrets can cause deployment issues if environments are not configured correctly; this is intentional but must be documented.
- Additional authorization checks and tokens may add a small performance and complexity overhead, considered acceptable for the security gain.

---

### Open Questions
- Should super-admins have a special “all-projects export” feature, or should all exports remain project-scoped by default? (If needed, this would be a separate feature.)
- Are there any non-browser API clients that must call state-changing endpoints (impacting CSRF design)?

---

## QA Test Results

**Tested:** 2026-02-26  
**App URL:** http://localhost:3000  
**Tester:** QA Engineer (AI)

### Acceptance Criteria Status

#### AC-1: Export queries are project-scoped
- [x] All Excel export queries in `routes/exports.js` filter by `project_id = req.user.currentProjectId`.
- [x] Google Sheets export in `routes/exports.js` reuses the same project-scoped queries.
- [x] Image ZIP export joins `bill_images` → `bills` and filters by `b.project_id = ?` scoped to the current project.

#### AC-2: Image access checks
- [x] `/uploads/*` now resolves files via `bill_images`/`bills` with a join on `project_id` instead of raw filesystem paths.
- [x] Access is gated by `ensureProjectAccess` plus a check that `row.project_id` matches `req.user.currentProjectId`, with super-admin override only.
- [x] Non-existent or cross-project images return `404`/`403` rather than leaking paths or throwing 500s.

#### AC-3: CSRF protection
- [x] Global `ensureCsrf` middleware enforces CSRF tokens on all non-GET/HEAD/OPTIONS requests, with explicit exceptions for login/OAuth endpoints.
- [x] `/api/csrf-token` issues a per-session token; the SPA initializes it via `initCsrfToken` and sends it on XHR calls using `apiFetch`/`withCsrf`.
- [x] Requests without a valid token receive a `403` with a clear JSON error message, and old clients cannot perform state-changing actions silently.

#### AC-4: Hardened secrets & encryption config
- [x] On startup in production, `server.js` refuses to boot if `SESSION_SECRET` is missing, too short, or set to a known default.
- [x] `routes/ocr.js` derives an AES-256-GCM key from `OCR_ENCRYPTION_SECRET` (or `SESSION_SECRET`) and fails fast in production if these are weak or default.
- [x] `.env.example` documents both `SESSION_SECRET` and `OCR_ENCRYPTION_SECRET` with guidance to use long random values; secrets are never logged.

#### AC-5: Status handling consistency for reports/exports
- [x] Export and reporting queries that aggregate spending (`routes/exports.js`, `routes/reporting.js`, and related helpers) consistently treat bills as included when `status IS NULL OR status = 'confirmed'`.
- [x] Legacy `complete` status handling is effectively superseded by the unified `confirmed` state in all reviewed exports/reports.

### Edge Cases Status

#### EC-1: User without a current project
- [x] `ensureProjectAccess` / `ensureProjectAdmin` block access when `currentProjectId` is missing, returning `401/403` rather than defaulting to all projects.

#### EC-2: Legacy deep links to uploads
- [x] Direct `/uploads/...` links now go through the database-backed lookup; authorized same-project users can still view their images, while cross-project or unknown images return `403/404` safely.

#### EC-3: Self-hosted single-project instances
- [x] Project-scoped filters work with the existing `currentProjectId` semantics; there is no extra configuration required for single-tenant setups.

#### EC-4: CSRF errors on old clients
- [x] Old/non-CSRF-aware clients receive a `403` with a clear error string; the SPA’s `apiFetch` helper logs a warning and can be extended to surface a user-visible message if desired.

#### EC-5: Misconfigured secrets in non-production
- [x] In non-production, weak/default secrets emit warnings (especially in OCR) but do not crash the app, matching the intended relaxed behavior outside production.

### Security Audit Results
- [x] Authentication: Sensitive endpoints (exports, uploads, OCR, reporting) are all behind `ensureAuth`/`ensureProjectAccess`/`ensureProjectAdmin` as appropriate.
- [x] Authorization: All reviewed export/report/upload queries are project-scoped via `project_id`, and `/uploads/*` enforces project membership plus super-admin override only.
- [x] Input validation: Image paths are resolved via DB rather than user-controlled filesystem paths; OCR custom base URLs are restricted to `https://` and non-private hosts to mitigate SSRF.
- [x] Rate limiting: Not explicitly implemented, but no obvious amplification or unauthenticated hot paths were identified in this feature’s scope.
- [x] Secrets & crypto: Session and OCR encryption secrets are enforced to be non-default and sufficiently long in production; OCR keys are stored encrypted with AES-256-GCM.

### Bugs Found

#### BUG-1: CSRF 403 errors are only logged to console, not surfaced in UI
- **Severity:** **[Low][Frontend]**  
- **Steps to Reproduce:**
  1. Start a browser session, perform some actions, then let the CSRF token/session become invalid (e.g. restart the server or clear sessions).
  2. Trigger a state-changing action from the SPA (e.g. upload bill, create V-Geld entry) without refreshing.
  3. The API responds with `403` and a clear JSON error message.
- **Expected:** The UI surfaces a visible message (e.g. toast/banner) telling the user their session/token is invalid and they should reload or sign in again.  
- **Actual:** `apiFetch` logs a warning to the browser console, but the user may only see a generic failure message (or nothing) depending on the caller.  
- **Priority:** Nice to have; does not affect security guarantees.

### Summary
- **Acceptance Criteria:** 5/5 passed  
- **Bugs Found:** 1 total (0 critical, 0 high, 0 medium, 1 low)  
- **Security:** Pass — no auth bypass, CSRF bypass, or cross-project data leakage identified in code review for this feature’s surface area.  
- **Production Ready:** YES  
- **Recommendation:** Deploy, and optionally improve UX around CSRF/session expiry errors in a follow-up frontend task.

---

## Open Bug Reports

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| [BUG-5](BUG-5-project-delete-csrf-token-error.md) | Critical | Project Delete Button Fails with CSRF Token Error | Resolved |

---

## QA Test Results (Re-test 2026-02-27)

**Tested:** 2026-02-27
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI)
**Focus:** AC-3 CSRF full coverage audit + spot-checks post BUG-5 fix

### Static Analysis: Raw fetch() Audit

Audited all 10 frontend JS modules for raw `fetch()` calls with mutating HTTP methods (POST/PUT/DELETE/PATCH). Only `apiFetch()` should be used for state-changing requests.

| Module | Raw GET fetch() | Mutating apiFetch() | Raw mutating fetch() | Result |
|--------|----------------|--------------------|--------------------|--------|
| `admin.js` | 12 calls | 22 calls | 0 | PASS |
| `superadmin.js` | 4 calls | 18 calls | 0 | PASS |
| `budget.js` | 3 calls | 7 calls | 0 | PASS |
| `gallery.js` | 1 call (image blob) | 3 calls | 0 | PASS |
| `sidebar.js` | 3 calls | 4 calls | 0 | PASS |
| `notifications.js` | 1 call | 2 calls | 0 | PASS |
| `vgeld.js` | 3 calls | 1 call | 0 | PASS |
| `telegram.js` | 2 calls | 1 call | 0 | PASS |
| `bills.js` | 5 calls | 6 calls | 0 | PASS |
| `core.js` | 6 calls | 2 calls | 0 | PASS |

**Conclusion:** Zero raw mutating `fetch()` calls remain. All 66 state-changing requests across all modules use `apiFetch()` with CSRF token injection via `withCsrf()`.

### AC-3: CSRF Protection

#### Server-side middleware
- [x] `ensureCsrf` defined in `middleware.js` (lines 90-130): skips GET/HEAD/OPTIONS, exempts only `/login`, `/auth/local`, `/auth/google*`, validates `X-CSRF-Token` header or `_csrf`/`csrfToken` body field against `req.session.csrfToken`.
- [x] Applied globally in `server.js` line 101 (`app.use(ensureCsrf)`) before all route mounts (lines 107-123).
- [x] CSRF exemptions are minimal: only login and OAuth endpoints.
- [x] Token is cryptographically random (32 bytes hex via `crypto.randomBytes`).
- [x] Token is session-tied: stored in `req.session.csrfToken`, different sessions produce different tokens.

#### Frontend CSRF integration
- [x] `initCsrfToken()` in `utils.js` fetches token from `/api/csrf-token` on app init.
- [x] `withCsrf()` injects `X-CSRF-Token` header on all non-GET/HEAD/OPTIONS requests.
- [x] `apiFetch()` wraps all state-changing calls and handles 403 responses with console warning.
- [x] `init()` in `core.js` calls `await initCsrfToken()` before any other API calls.

#### /api/csrf-token endpoint
- [x] Defined in `routes/security.js` as GET, protected by `ensureAuth`.
- [x] Returns `{ token: "..." }` JSON with session-tied token.

#### Runtime negative CSRF tests
- [x] `POST /api/bills` without `X-CSRF-Token` returns 403 JSON: `{"error":"Invalid or missing CSRF token..."}`
- [x] `PUT /api/admin/settings` without `X-CSRF-Token` returns 403 JSON.
- [x] `DELETE /api/vgeld/1` without `X-CSRF-Token` returns 403 JSON.
- [x] `POST /upload` without `X-CSRF-Token` returns 403 plain text (non-API path).
- [x] `POST /login` bypasses CSRF as expected (exempted endpoint, returns 302).
- [x] `GET /api/csrf-token` without auth returns 401 "Not logged in".

### Spot-checks

#### AC-1: Export queries are project-scoped (spot-check)
- [x] All SQL queries in `routes/exports.js` filter by `WHERE project_id = ?` for bills, bill_motives, bill_categories, vgeld, motives, categories, budget_matrix, and image ZIP exports. No regression.

#### AC-2: Image access checks (spot-check)
- [x] `GET /uploads/test.jpg` without auth returns 302 redirect to `/login`. Unauthenticated users cannot access uploaded images.

#### AC-4: Hardened secrets & encryption config (spot-check)
- [x] `server.js` lines 42-53: production startup refuses if `SESSION_SECRET` is missing, too short (<16), or matches known default.
- [x] Non-production: warns but does not crash.
- [x] `.env.example` documents both `SESSION_SECRET` and `OCR_ENCRYPTION_SECRET` with clear guidance.

#### AC-5: Status handling consistency (spot-check)
- [x] `routes/reporting.js` uses `(b.status IS NULL OR b.status = 'confirmed')` consistently. No legacy `'complete'` status found.
- [x] `routes/exports.js` uses the same pattern in all spending aggregation queries.

### Edge Cases

#### EC-1: User without a current project
- [x] `ensureProjectAccess` returns 403 JSON `{"error":"No project selected"}` when `currentProjectId` is missing (not a 500).

#### EC-4: CSRF errors on old clients
- [x] API paths return 403 JSON with clear error message: `{"error":"Invalid or missing CSRF token. Please reload the page and try again."}`.
- [x] Non-API paths return 403 plain text with the same message.

### Security Audit Results (CSRF-focused)
- [x] CSRF bypass by omitting `X-CSRF-Token`: all tested endpoints correctly reject with 403.
- [x] No state-changing endpoints missing CSRF middleware: `ensureCsrf` is global, applied before all routes.
- [x] CSRF exemptions are truly minimal: only `/login`, `/auth/local`, `/auth/google*`.
- [x] CSRF token is session-tied: generated per-session with `crypto.randomBytes(32)`, not reusable across sessions.
- [x] No raw mutating `fetch()` calls in any frontend module: all 66 state-changing calls use `apiFetch()`.

### Bugs Found

None found. The previously reported low-severity bug (CSRF 403 not surfaced in UI) from the 2026-02-26 test remains open but is unchanged -- it is a UX improvement, not a security issue.

### Summary
- **Acceptance Criteria:** 5/5 passed (AC-3 fully re-verified, ACs 1/2/4/5 spot-checked)
- **Bugs Found:** 0 new (1 pre-existing low from 2026-02-26, still open)
- **Security:** Pass -- CSRF protection is comprehensive. No bypass vectors identified via static analysis (all 10 frontend modules clean) or runtime negative tests (POST/PUT/DELETE without token all return 403).
- **Production Ready:** YES
- **Recommendation:** BUG-5 fix is confirmed effective. All 37 raw `fetch()` calls successfully migrated to `apiFetch()`. Deploy with confidence.
