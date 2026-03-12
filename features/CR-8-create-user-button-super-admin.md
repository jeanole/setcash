# CR-8: Add Create User Button to Super Admin Users Tab

**Requested:** 2026-03-04 | **Priority:** Medium | **Status:** Deployed

**Feature:** [PROJ-17: Super-Admin](PROJ-17-super-admin.md)

## Current Behavior
The Super Admin Users Tab displays all users and provides actions: Toggle Admin, Reset Password, and Delete. However, there is no way to create a new user account directly from the Super Admin panel. Super admins must rely on users self-registering or manual database insertion.

## Desired Behavior
Add a "Create User" button to the Super Admin Users Tab that opens a form/modal to create new user accounts directly.

**Form Fields:**
- Email (required, email validation)
- Password (optional — if empty, auto-generate like password reset)
- isSuperAdmin checkbox (default: unchecked)

**Flow:**
1. Click "Create User" button in Users Tab header
2. Modal opens with form
3. On submit: POST to existing `/api/admin/users` endpoint
4. Success: Close modal, refresh users list, show toast "User created"
5. If password was auto-generated: Display it once with copy-to-clipboard (same pattern as password reset)

## Rationale
Super admins need the ability to provision accounts for team members without requiring them to go through a registration flow. This is especially useful for:
- Setting up accounts for non-technical users
- Creating service accounts
- Rapid onboarding during production setup

## Proposed Acceptance Criteria
- [ ] "Create User" button visible in Users Tab header (superadmin only)
- [ ] Clicking opens modal with email, password (optional), isSuperAdmin fields
- [ ] Form validation: email required, valid email format
- [ ] If password empty: auto-generate 16-char secure password
- [ ] POST to `/api/admin/users` with `{ email, password, isSuperAdmin }`
- [ ] On success: refresh users list, show success toast
- [ ] If auto-generated password: display once with copy button (like password reset flow)
- [ ] Error handling: show inline errors (duplicate email, weak password, etc.)

**Resolution:** Deployed — Create User button and modal fully implemented in `UsersTab.tsx` + `CreateUserModal.tsx`, wired via `SuperAdminModal.tsx`. All acceptance criteria met: email/password/isSuperAdmin form, auto-generated 16-char password with copy-to-clipboard, inline error handling, user list refresh on success.
