# PROJ-20: User Profile Edit Panel

**Status:** Planned
**Created:** 2026-03-13
**Dependencies:** PROJ-5 (NextAuth.js Authentication)

## Overview

Users can click their avatar/logo next to the Sign Out button in the header to open a profile panel where they can view and edit their own account data, and trigger a password reset.

## User Stories

- As a user, I want to click my avatar in the header to open my profile panel
- As a user, I want to edit my username, first name, last name, and mobile number
- As a user, I want to trigger a password reset from my profile panel
- As a user, I want my changes to be saved and reflected immediately in the UI

## Acceptance Criteria

- [ ] Clicking the avatar/logo next to Sign Out opens a profile panel (modal or slide-over)
- [ ] Panel displays and allows editing: username, first name, last name, mobile number
- [ ] Save action persists changes to the database
- [ ] Password reset option is available in the panel (sends reset email or redirects to reset flow)
- [ ] Success/error feedback shown after save
- [ ] Panel is responsive (mobile, tablet, desktop)
- [ ] Changes to username are reflected in the header immediately after save

## Edge Cases

- Username uniqueness — show error if username already taken
- Mobile field is optional
- Password reset should use the existing reset flow (CR-12) if implemented

## Out of Scope

- Changing email address
- Profile picture upload
- Notification preferences (covered in PROJ-16)

---

## Change Requests

### CR-14: Add User Profile Edit Panel
**Requested:** 2026-03-13 | **Priority:** Medium | **Status:** Pending Review

**Current Behavior:** No way for users to edit their own profile data. No avatar click target in the header.

**Desired Behavior:** Clicking the avatar/logo next to Sign Out opens a panel to edit username, first name, last name, mobile, and trigger a password reset.

**Rationale:** Basic account self-service expected in any multi-user app.

**Proposed Acceptance Criteria:**
- [ ] Avatar in header is clickable
- [ ] Profile panel opens with editable fields: username, first name, last name, mobile
- [ ] Password reset option available
- [ ] Save persists changes, UI updates immediately

**Resolution:** Pending
