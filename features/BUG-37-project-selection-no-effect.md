# BUG-37: Project Selection Has No Effect

**Status:** Open
**Reported:** 2026-03-08
**Severity:** Critical
**Skill Tag:** Not sure
**Feature:** Unknown

---

## Description

### Expected Behavior
When a project is selected from the project dropdown/switcher, the application should switch to that project — loading its data and allowing the user to view and edit it.

### Actual Behavior
Selecting a project has no visible effect. The UI does not switch to the selected project and nothing changes.

## Steps to Reproduce

1. Open the application in a browser
2. Locate the project selector (project switcher in the sidebar or during user/resource creation)
3. Select a project from the dropdown
4. Observe: nothing happens — the project is not activated and no data changes

## Environment

- **Browser/Client:** Browser (unspecified)
- **OS:** N/A
- **Screen Size:** N/A
- **Date/Time:** 2026-03-08

## Additional Context

N/A

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-08
**Fixed In:** fix(BUG-37)
**Fix Description:**
Three root causes fixed:

1. **JWT `trigger === 'update'` block** (`auth.ts`): Was re-reading from DB using `token.id`, which is the Google OAuth provider ID for Google users (not the DB UUID). This caused silent token update failure. Fixed to use the `session` parameter data directly — it was already validated server-side by `/api/projects/switch`.

2. **JWT `else if` block** (`auth.ts`): Was using `token.id` for DB user lookup (wrong for Google OAuth users). Changed to use `userEmail` which works for both credential and Google OAuth users. Also fixed an edge case where a null `dbUser` would incorrectly clear `currentProjectId`.

3. **`/api/projects/switch` superadmin bypass**: Superadmins can now switch to any project without needing a `projectMember` record — they bypass the membership check and look up the project directly.
