# BUG-34: Clicking View in Bills Table Not Working

**Status:** Resolved
**Reported:** 2026-03-08
**Severity:** Critical
**Skill Tag:** [Frontend]
**Feature:** [PROJ-7: Bills Feature](PROJ-7-bills-feature.md)

---

## Description

### Expected Behavior
Clicking "View" on a bill row in the bills table should open a modal to edit/view the bill details.

### Actual Behavior
Clicking "View" produces an error instead of opening the bill modal.

## Steps to Reproduce

1. Navigate to the bills table page
2. Click "View" on any bill row

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
**Fixed In:** pending commit
**Fix Description:** `BillDetailPage` used `use(params)` from React, but in Next.js 14 `params` is a plain synchronous object — not a Promise or React Context. React's `use()` throws `"An unsupported type was passed to use()"` for plain objects. Fixed by removing the `use()` wrapper and destructuring `params` directly: `const { id } = params`.
