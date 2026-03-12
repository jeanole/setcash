# BUG-18: Missing Skeleton Loader During Data Fetch

## Metadata
| Field | Value |
|-------|-------|
| **ID** | BUG-18 |
| **Feature** | PROJ-8 |
| **Severity** | Low |
| **Status** | Open |
| **Reported** | 2026-03-06 |
| **Fixed In** | 2026-03-06 |

## Description
The Budget Matrix page lacks a skeleton loader or loading state while data is being fetched. On slow networks, the page may appear blank briefly before content loads.

## Steps to Reproduce
1. Navigate to Budget Matrix with slow network (throttle to 3G)
2. Observe: Page content area is blank while data loads

## Expected Behavior
A skeleton loader with pulsing grid placeholders should be displayed while the budget matrix data is being fetched server-side.

## Actual Behavior
No loading state is shown; the page content area may appear blank or empty during the initial data fetch.

## Files to Modify
- `nextjs/app/(protected)/budget/page.tsx` - Add loading.tsx or Suspense boundary
- Create `nextjs/app/(protected)/budget/loading.tsx` - Skeleton loader component

## Acceptance Criteria
- [ ] Skeleton loader shows grid-like structure matching matrix layout
- [ ] Pulsing animation indicates loading state
- [ ] Skeleton disappears smoothly when data loads
- [ ] Matches existing skeleton patterns in the app (e.g., DataTable)

## Checklist
- [ ] Bug reproduced and confirmed
- [ ] Fix implemented
- [ ] Fix tested in development
- [ ] Bug report updated with "Fixed In" version
