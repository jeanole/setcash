# BUG-27: Project Switcher Broken — Selected Project Not Reflected in Title or Menubar

**Status:** Open
**Reported:** 2026-03-07
**Severity:** Critical
**Skill Tag:** [Frontend] [Backend] [Architecture]
**Feature:** Unknown / Cross-feature

---

## Description

### Expected Behavior
When selecting a project from the project switcher in the menubar/sidebar:
- The selected project's data loads into all views (bills, budget, etc.)
- The user's role for that project is applied (admin/user permissions update)
- The project name is displayed in the page title / header

### Actual Behavior
Nothing happens. Clicking a project in the quick-select menubar produces no visible change — no data reload, no title update, no role switch.

## Steps to Reproduce

1. Log in to the Next.js app with a user that belongs to multiple projects
2. Observe the project selector in the sidebar/menubar
3. Click the project selector to open the dropdown
4. Select a different project from the list
5. **Expected:** Page reloads with the new project's data, title updates, role updates
6. **Actual:** No change — current project data remains, title unchanged

## Environment

- **Browser/Client:** Browser (unspecified)
- **OS:** N/A
- **Screen Size:** N/A
- **Date/Time:** 2026-03-07

## Additional Context

This is a regression or missing implementation. Project switching was previously fixed for the Express app (BUG-13 fixed session not updating on project switch). The Next.js implementation may be missing:
- The API call to switch the active project in the session
- The client-side state update / page refresh after switching
- The project name render in the header title
- Quick-select UI in the menubar (may not be implemented at all)

Likely involves both frontend (UI trigger, title display) and backend (session update API), and potentially architecture-level decisions about how project context is managed across the Next.js app.

---

## Resolution

**Status:** Open
**Resolved Date:** —
**Fixed In:** —
**Fix Description:** —
