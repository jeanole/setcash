# PROJ-10: Members, Projects & Settings

## Status: Planned
**Created:** 2026-03-01
**Last Updated:** 2026-03-01

## Dependencies
- Requires: PROJ-5 (auth — admin + superadmin role checks)
- Requires: PROJ-6 (PostgreSQL data)

## User Stories
- As a superadmin, I want to create and delete projects so that I can manage tenants.
- As a superadmin, I want to list all users and change their global role so that I can manage
  access across the platform.
- As an admin, I want to invite new members to my project (by email) so that they can submit bills.
- As an admin, I want to remove a member from my project so that they lose access.
- As an admin, I want to promote a member to project admin or demote them to user so that
  I can delegate admin tasks.
- As an admin, I want to configure project-level settings (currency symbol, sheet ID, Telegram
  chat ID) so that the project behaves correctly.

## Acceptance Criteria
- [ ] `/app/(protected)/superadmin/projects/page.tsx` — list all projects; create-new form;
      delete button (with confirmation); superadmin-only guard
- [ ] `/app/(protected)/superadmin/users/page.tsx` — list all users with role selector;
      change role saved on select; superadmin-only guard
- [ ] `/app/(protected)/settings/members/page.tsx` — list project members; promote/demote
      role dropdown; remove-member button (with confirmation); admin-only guard
- [ ] Invite-by-email flow: admin enters email → if user exists in DB, added to project;
      if not, an invitation record is created (or a clear message "User not found — they must
      register first")
- [ ] `/app/(protected)/settings/page.tsx` — project settings form: currency symbol,
      Google Sheet ID, Google Drive folder ID, Telegram chat ID; save via Server Action
- [ ] Superadmin cannot remove themselves from superadmin role
- [ ] Admin cannot remove the last admin from a project
- [ ] All pages show a clear 403 page if accessed by a user with insufficient role

## Edge Cases
- Inviting an email already in the project → "Already a member" message
- Deleting a project that has bills → show "Cannot delete — project has N bills" or require
  explicit confirmation that all data will be deleted
- Superadmin demotes themselves to `user` → auto-logout and redirect to login (session invalid)
- Settings saved with an invalid Sheet ID → save succeeds (validation happens at sync time,
  not at settings save time)

## Technical Requirements
- Route-level role guard via Next.js middleware (extend PROJ-5 middleware)
- All mutations via Server Actions
- Branch: `to_nextjs`

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
