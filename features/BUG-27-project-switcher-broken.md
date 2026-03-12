# BUG-27: Project Switcher Broken — Selected Project Not Reflected in Title or Menubar

**Status:** Resolved
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

## Tech Design (Solution Architect)

### Root Cause (confirmed by code analysis)

The backend is **100% complete** — this is a frontend-only bug:

- The session already exposes `currentProjectName`, `currentProjectId`, and `currentProjectRole` to every client component
- `POST /api/projects/switch` works correctly
- `useProjects` hook with `switchProject()` already exists and wires API + session refresh together
- The only place to switch projects is buried in **Settings > Projects** — the Sidebar and Header never surface the current project name or a switcher

The fix is: **add a project context block to the Sidebar** with the current project name and a dropdown to switch projects without leaving the page.

---

### A) Component Structure

```
Sidebar.tsx [MODIFY]
+-- Logo / App Title (existing)
+-- ProjectSwitcher [NEW CLIENT COMPONENT]
|   +-- Current project name (bold)
|   +-- Chevron icon (if user has >1 project)
|   +-- Dropdown (opens on click, if >1 project)
|       +-- Project list item × N
|           +-- Project name
|           +-- "Current" badge (active item)
|           +-- Click to switch (inactive items)
+-- Nav items (existing, unchanged)
+-- Footer (existing, unchanged)
```

The `ProjectSwitcher` component sits between the logo and the nav links — exactly where the user expects a project context indicator in a multi-tenant app.

---

### B) Data Model

No new data needed. Everything already exists in the session:

| Field | Source | Used for |
|-------|--------|----------|
| `currentProjectName` | `session.user.currentProjectName` | Display active project name |
| `currentProjectId` | `session.user.currentProjectId` | Highlight active project in dropdown |
| `currentProjectRole` | `session.user.currentProjectRole` | (Optional) show role badge |
| Project list | `GET /api/projects` (useProjects hook) | Populate dropdown |
| Switch action | `POST /api/projects/switch` (useProjects hook) | Switch on click |

---

### C) Tech Decisions

**Why frontend-only?**
The session, API endpoint, and data-fetching hook all already work. Adding backend changes would be wasted effort.

**Why a Sidebar dropdown (not a Header dropdown)?**
The current project name is contextual navigation — it belongs with the nav, not the user account controls. The Sidebar has space below the logo. This also matches common patterns in Linear, Notion, and Vercel dashboards.

**Why reuse `useProjects` hook?**
The hook already handles fetching the project list, calling the switch API, and refreshing the session token. No new logic needed.

**What happens after switching?**
After `switchProject()` completes, `router.refresh()` (Next.js) re-runs all Server Components on the current page, loading the new project's data automatically. No full page reload needed.

**What if the user has only one project?**
The switcher renders as a plain label with no chevron or dropdown — no interaction available.

---

### D) New Files

| File | Action |
|------|--------|
| `nextjs/components/layout/ProjectSwitcher.tsx` | NEW — dropdown component |
| `nextjs/components/layout/Sidebar.tsx` | MODIFY — embed ProjectSwitcher |

No backend changes. No new packages. No schema changes.

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-07
**Fixed In:** fix(BUG-27): Add ProjectSwitcher to sidebar for quick project switching (be5e3b9)
**Fix Description:** Created `ProjectSwitcher.tsx` client component — displays current project name + role badge in the sidebar. Multi-project users get a dropdown (ChevronDown) to switch projects via the existing `useProjects` hook. Added to both desktop and mobile sidebar variants. No backend changes needed.
