# BUG-44: Header Renders on Top of Modals Due to z-index

**Status:** Resolved
**Reported:** 2026-03-09
**Severity:** High
**Skill Tag:** [Frontend]
**Feature:** PROJ-18: Atelier UI + Cinematic Effects

---

## Description

### Expected Behavior
Modals (Super Admin, Create User, Members, Password Reset) should render above all page chrome including the sticky header.

### Actual Behavior
The sticky header appears in the foreground when any modal is opened — the modal backdrop and content render behind the header bar.

## Steps to Reproduce

1. Log in as superadmin
2. Open the Super Admin modal (click "System" in sidebar)
3. Observe: the sticky header bar is visible on top of the modal overlay

## Environment

- **Browser/Client:** Browser
- **OS:** Local Docker (`docker-compose.test.yml`)
- **Screen Size:** N/A
- **Date/Time:** 2026-03-09

## Root Cause

`Header.tsx` uses `z-[1000]` on the sticky header element, far exceeding all modal z-indexes:

| Element | z-index |
|---------|---------|
| Header (sticky) | `z-[1000]` ← too high |
| SuperAdminModal overlay | `z-50` (50) |
| PasswordResetModal / CreateUserModal / MembersSubModal | `z-[60]` |
| ToastContainer | `z-[70]` |

Fix: lower header to `z-40` and raise modals to a consistent hierarchy above it.

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-09
**Fixed In:** (pending commit)
**Fix Description:** Lowered header `z-[1000]` → `z-40`. Raised modal z-indexes to a consistent hierarchy: SuperAdminModal `z-[200]`, sub-modals `z-[300]`, toasts `z-[400]`.
