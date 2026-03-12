# BUG-28: Motive/Category Allocation Widget Refuses Selection on New Bill

**Status:** Resolved
**Reported:** 2026-03-07
**Severity:** High
**Skill Tag:** [Frontend]
**Feature:** PROJ-7: Bills Feature

---

## Description

### Expected Behavior
When creating a new bill, the user should be able to click on motive and category allocation options in the allocation widget to select them. Selections should be reflected visually and included in the bill submission.

### Actual Behavior
Clicking on motive or category allocation options does nothing — the widget refuses to register the selection. The allocation cannot be changed from its default state.

## Steps to Reproduce

1. Navigate to Bills → New Bill (`/bills/new`)
2. Fill in bill fields (vendor, amount, etc.)
3. Attempt to click a motive or category in the allocation widget
4. Expected: motive/category is selected and highlighted
5. Actual: click is ignored; no selection occurs

## Environment

- **Browser/Client:** Not specified
- **OS:** Not specified
- **Screen Size:** Not specified
- **Date/Time:** 2026-03-07

## Additional Context

This is likely related to the allocation widget component (`allocation-widget.js` in Express, or its Next.js equivalent). Possible causes: event listeners not attached, widget rendered but non-interactive, or a z-index/pointer-events CSS issue blocking clicks.

Related: BUG-29 (bill save/display failure) — both discovered during new bill upload flow testing.

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-07
**Fixed In:** fix(BUG-28,BUG-29): Fix allocation widget feedback loop and bill save error surfacing
**Fix Description:** Two changes to `nextjs/components/bills/AllocationWidget.tsx`:
1. Changed the `updateParent` filter from `.filter((r) => r.id && r.percentage > 0)` to `.filter((r) => r.id)` — rows with `percentage: 0` (newly selected but not yet allocated) are now included in the parent `value`, so they survive the re-render cycle.
2. Added an `isInternalUpdate` ref (`useRef<boolean>(false)`) that is set to `true` before every internal `setRows` call (`addRow`, `removeRow`, `updateRow`). The `useEffect` that syncs `rows` from the external `value` prop checks this ref and skips the re-sync when the change originated from within the component, breaking the destructive feedback loop.
