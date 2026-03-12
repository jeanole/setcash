# BUG-43: System Nav Item Visible to All Users and Produces Blank Error

**Status:** Resolved
**Reported:** 2026-03-09
**Severity:** Critical
**Skill Tag:** [Frontend]
**Feature:** PROJ-17: Super-Admin

---

## Description

### Expected Behavior
The "System" link in the sidebar should only be visible to superadmins. Clicking it should navigate to a superadmin system settings page.

### Actual Behavior
Two problems:
1. **Visibility**: The "System" sidebar link is shown to **all authenticated users**, not just superadmins. This is a security/UX issue — regular users and project admins see it.
2. **Missing page**: The `/settings/system` route does not exist. Clicking the link produces a blank error page.

## Steps to Reproduce

1. Log in as a regular user (non-superadmin)
2. Observe: "System" link appears in the sidebar under the Settings section
3. Click "System"
4. Observe: blank error page — route `/settings/system` does not exist

## Environment

- **Browser/Client:** Browser
- **OS:** Local Docker (`docker-compose.test.yml`)
- **Screen Size:** N/A
- **Date/Time:** 2026-03-09

## Root Cause

In `nextjs/components/layout/Sidebar.tsx` around line 180, the "System" nav link is rendered unconditionally:

```tsx
<a href="/settings/system" ...>
  System
</a>
{isSuperAdmin && (
  <button onClick={onOpenSuperAdmin} ...>
    Super Admin
  </button>
)}
```

The "Super Admin" button below it IS correctly guarded by `{isSuperAdmin && ...}`, but the "System" link is not. Additionally, the `/settings/system` page (`nextjs/app/**/settings/system/`) does not exist.

## Fix Required

1. Wrap the "System" link in `{isSuperAdmin && ...}` in `Sidebar.tsx`
2. Create the `/settings/system` page with appropriate superadmin-only content (or redirect to the superadmin modal / integrate into the existing superadmin UI)

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-09
**Fixed In:** (pending commit)
**Fix Description:** Replaced the unguarded "System" `<a>` link and separate "Super Admin" button with a single `isSuperAdmin`-guarded "System" button that opens the Super Admin modal. Non-superadmins no longer see any system settings entry.
