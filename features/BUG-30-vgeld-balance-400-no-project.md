# BUG-30: V-Geld Balance Sidebar Widget Returns 400 When No Project Selected

**Status:** Open
**Reported:** 2026-03-07
**Severity:** Medium
**Skill Tag:** [Frontend]
**Feature:** PROJ-15: V-Geld (Advance Money)

---

## Description

### Expected Behavior
The V-Geld balance widget in the sidebar should either not fetch when no project is selected, or handle the 400 gracefully (show nothing / hide itself) rather than logging a console error.

### Actual Behavior
On page load, the `VGeldBalance` sidebar widget unconditionally fetches `GET /api/vgeld/balance`. If the user has no project currently selected (`session.user.currentProjectId` is null), the API returns `400 Bad Request` with `{ error: 'No project selected' }`. This appears as a red error in the browser console:

```
api/vgeld/balance:1  Failed to load resource: the server responded with a status of 400 (Bad Request)
```

## Steps to Reproduce

1. Log in as a user with no project selected (or freshly authenticated with no `currentProjectId` in session)
2. Navigate to any page that renders the sidebar (e.g. `/bills`, `/vgeld`)
3. Open browser DevTools → Console or Network tab
4. Observe: `GET /api/vgeld/balance` → 400 Bad Request

## Environment

- **Browser/Client:** Not specified
- **OS:** Not specified
- **Screen Size:** Not specified
- **Date/Time:** 2026-03-07

## Additional Context

Root cause is in `nextjs/components/layout/Sidebar.tsx` — the `VGeldBalance` widget fetches on mount without first checking whether a project is selected. The API at `nextjs/app/api/vgeld/balance/route.ts` (line 18-20) correctly returns 400 when `currentProjectId` is null.

Fix options:
1. **Frontend guard (preferred):** Before fetching, check if the user has a project selected (e.g. from session context). Skip fetch / hide widget if none selected.
2. **Graceful error handling:** Catch the 400 in the widget and render nothing (or a subtle "—") instead of letting it bubble to the console as an unhandled error.

---

## Resolution

**Status:** Open
**Resolved Date:** —
**Fixed In:** —
**Fix Description:** —
