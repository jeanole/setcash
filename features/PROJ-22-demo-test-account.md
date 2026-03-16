# PROJ-22: Demo / Test Account

**Status:** Planned
**Priority:** Medium
**Created:** 2026-03-16
**Dependencies:** PROJ-5, PROJ-10, PROJ-16

---

## Overview

A restricted demo/exploration account (`testuser`) that is permanently locked to the Example Project. The account can browse and interact with the app but cannot upload bills, invite others, or change any settings. Superadmins retain full access to the Example Project including bill uploads.

---

## User Stories

- **As a visitor/evaluator**, I want to log in with a demo account and explore SetCash without needing to register, so I can assess the app before committing.
- **As a superadmin**, I want to retain full edit rights on the Example Project (including uploads) even when the demo account cannot upload.
- **As an admin**, I want the demo account to be unable to send invites or change settings so it cannot pollute the user base or configuration.

---

## Acceptance Criteria

- [ ] A seeded user `testuser@example.com` (or configurable via env) with password `supersafepw` exists after `npm run seed` (credentials stored via env vars, not hardcoded)
- [ ] `testuser` is a member of the Example Project with role `user`
- [ ] `testuser` cannot upload bills (blocked at API and UI level with a clear message)
- [ ] `testuser` cannot send platform invites or project invites
- [ ] `testuser` cannot access or modify any settings pages (account settings, project settings, integrations)
- [ ] `testuser` cannot create or switch to any project other than the Example Project
- [ ] Superadmins can upload bills and perform all actions on the Example Project without restriction
- [ ] The demo account restriction is enforced server-side (not just UI-gated)

---

## Technical Notes

- Introduce a `isDemoAccount Boolean @default(false)` field on the `User` model
- Seed script creates `testuser` with `isDemoAccount: true` and assigns to the Example Project
- Middleware or API guards check `isDemoAccount` and block: bill creation, invite sending (both `/api/auth/invite` and `/api/projects/[id]/invite`), and settings mutations
- Frontend reads `isDemoAccount` from session and hides/disables relevant UI controls with an explanation message
- `isDemoAccount` exposed via session JWT (alongside `isExampleProject`)
- Superadmin bypass: `isDemoAccount` checks are skipped when `isSuperAdmin` is true

---

## Change Requests

### CR-27: Demo / Test Account with Restricted Access
**Requested:** 2026-03-16 | **Priority:** Medium | **Status:** Pending Review

**Current Behavior:** No demo/test account exists. Visitors must register or be invited to explore the app.

**Desired Behavior:** A pre-seeded `testuser` account (credentials configurable via env) exists with permanent membership in the Example Project. The account can browse bills, the budget matrix, and reports but cannot upload bills, invite users, or change any settings. Superadmins retain full access to the Example Project including uploads.

**Rationale:** Enables product demos and self-service evaluation without exposing the invite flow or creating noise in real projects.

**Proposed Acceptance Criteria:**
- [ ] `testuser` logs in and lands on the Example Project
- [ ] Bill upload blocked (API 403 + UI message)
- [ ] Invite buttons hidden/disabled (platform invite and project invite)
- [ ] Settings pages inaccessible (redirected or hidden)
- [ ] Project switcher hidden or locked to Example Project
- [ ] Superadmin can upload bills on Example Project normally
- [ ] Credentials sourced from env vars (`DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`), not hardcoded

**Resolution:** Pending
