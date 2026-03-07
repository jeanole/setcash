# BUG-29: New Bill Not Saved or Not Appearing in Bills Table

**Status:** Resolved
**Reported:** 2026-03-07
**Severity:** High
**Skill Tag:** [Frontend]
**Feature:** PROJ-7: Bills Feature

---

## Description

### Expected Behavior
After filling in a new bill form and clicking Save/Submit, the bill should be saved to the database and appear in the bills table on the `/bills` page.

### Actual Behavior
After clicking Save on the new bill form, either:
- The save operation silently fails (no error shown), or
- The bill is saved but does not appear in the bills table

## Steps to Reproduce

1. Navigate to Bills → New Bill (`/bills/new`)
2. Fill in bill fields (vendor, amount, etc.)
3. Click Save / Submit
4. Expected: redirected to bills list; new bill visible in table
5. Actual: bill not visible in bills table, or save silently fails

## Environment

- **Browser/Client:** Not specified
- **OS:** Not specified
- **Screen Size:** Not specified
- **Date/Time:** 2026-03-07

## Additional Context

Possible causes:
- POST `/api/bills` returns an error that is not surfaced in the UI
- After successful save, navigation or data refetch does not include the new bill
- Bill is created with `draft` status and filtered out of the default table view
- Race condition between save and redirect/refetch

Related: BUG-28 (motive/category allocation refuses selection) — both discovered during new bill upload flow testing.

---

## Resolution

**Status:** Resolved
**Resolved Date:** 2026-03-07
**Fixed In:** fix(BUG-28,BUG-29): Fix allocation widget feedback loop and bill save error surfacing
**Fix Description:** Improved error surfacing in `nextjs/app/(protected)/bills/new/page.tsx`. The `api.createBill` wrapper (`fetchWithError`) already throws with the API's error message on non-ok HTTP responses, so the redundant `response.ok` else branch (which referenced `response.status`/`response.json()`/`response.statusText` — properties absent from the typed return value) was removed. A `console.error` call was added in the catch block so all bill creation failures are logged to the browser console with full error detail. The existing `result` state already surfaces the error message in the UI via the rose-colored banner.
