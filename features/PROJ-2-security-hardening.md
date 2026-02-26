## PROJ-2: Security & Multi-tenant Hardening

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
