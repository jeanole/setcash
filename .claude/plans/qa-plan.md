# QA Test Plan — PROJ-20 User Profile Edit Panel

## Feature
PROJ-20: User Profile Edit Panel — `features/PROJ-20-user-profile-edit.md`

## Context Summary
- Frontend: ProfileModal.tsx (new), Header.tsx (modified), AppShell.tsx (modified), layout.tsx (modified)
- Backend: GET/PATCH /api/users/me, PATCH /api/users/me/password, Prisma migration (4 new User columns)
- No running server — QA is code-level static analysis of all changed files
- Password change is inline (current + new), not email-based

## User Guidance
- Full scope: all 7 acceptance criteria, 3 edge cases, full security audit, regression spot-check
- Code-level review (no live server)

## Acceptance Criteria to Test

### AC-1: Avatar opens profile panel
- Expected: clicking avatar button in Header opens ProfileModal
- How: verify Header renders a `<button>` with onClick, AppShell wires `isProfileOpen` state, ProfileModal receives `isOpen` prop

### AC-2: Panel displays and allows editing all 4 fields
- Expected: username, firstName, lastName, mobile all present as editable inputs
- How: read ProfileModal.tsx, verify all 4 fields rendered with correct input types

### AC-3: Save persists to database
- Expected: PATCH /api/users/me saves to DB via Prisma update
- How: read api/users/me/route.ts, verify prisma.user.update is called with validated data

### AC-4: Password change available
- Expected: separate password section with current + new + confirm fields
- How: verify ProfileModal has password section, PATCH /api/users/me/password exists and verifies current password

### AC-5: Success/error feedback shown
- Expected: green success banner and rose error banner per section, success auto-dismisses
- How: verify ProfileModal state management for error and success, check auto-dismiss timer

### AC-6: Panel is responsive
- Expected: bottom-sheet on mobile, centered modal on sm+
- How: verify `items-end sm:items-center` classes on modal overlay

### AC-7: Username reflected in header immediately after save
- Expected: onProfileUpdated callback updates AppShell state, Header re-renders with new initial
- How: verify AppShell has onProfileUpdated handler updating local state, Header uses firstName for initials

## Edge Cases to Test

### EC-1: Username uniqueness
- Expected: PATCH returns 409 when username taken, ProfileModal shows inline error
- How: verify case-insensitive uniqueness check in API, 409 handling in modal

### EC-2: Mobile field optional
- Expected: mobile can be null/empty with no validation error
- How: verify Zod schema uses .nullable().optional() for mobile

### EC-3: Confirm password match
- Expected: client-side check newPassword === confirmPassword before API call
- How: verify ProfileModal validates match client-side

## Security Audit Scope

1. Auth bypass — GET and PATCH /api/users/me must 401 without session
2. User isolation — PATCH must only update session user, no userId in body
3. Password verification — PATCH /api/users/me/password must verify currentPassword
4. Input injection — Zod schemas with max lengths on all string inputs
5. Username self-conflict — uniqueness query must exclude current user (no false 409)
6. Password strength — min 8 + uppercase + lowercase + digit enforced
7. Sensitive data — GET /api/users/me must NOT return passwordHash
8. Email immutability — PATCH must not accept email changes

## Regression Scope
- Header still renders with null profile fields (fallback to email initial)
- AppShell BugReportModal unaffected
- Protected layout still passes email and role to AppShell

## Bug Report Template
See `.claude/skills/qa/test-template.md`

## Commit Message
test(PROJ-20): Add QA test results for User Profile Edit Panel
